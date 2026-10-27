import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  db,
  generateBatchCode,
  generateSecureTrackingToken,
  hashPassword,
  toPublicUser,
  verifyPassword,
  type StoredUser,
} from './server/db.ts';
import { calculateFreshnessEstimate } from './src/shared/freshness.ts';
import type {
  ConsumerScanRecord,
  FinancialTransaction,
  LocationProvenance,
  PaymentRecord,
  ProduceBatch,
  ProduceCondition,
  ProduceUnit,
  PublicTrackingResponse,
  StorageMethod,
  SubscriptionRecord,
  TrackingEvent,
  TrackingEventType,
  UserRole,
  VerificationStatus,
} from './src/shared/types.ts';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'replace_with_32_byte_cryptographic_secret'
    ? process.env.SESSION_SECRET
    : 'traceroots_dev_hmac_secret_9f4b2c8e1a7d3f6a5b0c8e2d4f1a9b7c';

const TEST_PAYMENT_HMAC_SECRET = crypto
  .createHash('sha256')
  .update(`${SESSION_SECRET}:razorpay_test_sandbox_gateway`)
  .digest('hex');

function isLiveRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_ID.trim() !== '' &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_SECRET.trim() !== ''
  );
}

// Clean HTML/script tags from string inputs (XSS defense)
function cleanString(val: unknown, maxLen = 1000): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

// Signed stateless + server-checked session token
interface SessionPayload {
  uid: string;
  role: UserRole;
  exp: number;
}

function signSessionToken(user: StoredUser): string {
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | undefined): StoredUser | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as SessionPayload;
    if (!payload.uid || Date.now() > payload.exp) return null;
    const user = db.state.users.find((u) => u.id === payload.uid);
    if (!user || user.accountStatus !== 'active') return null;
    return user;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function extractAuthenticatedUser(req: Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.tr_session) {
    return verifySessionToken(cookies.tr_session);
  }
  return null;
}

// Simple in-memory sliding window rate limiter
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }
    timestamps.push(now);
    rateBuckets.set(key, timestamps);
    next();
  };
}

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = extractAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = extractAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      db.addAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'UNAUTHORIZED_ROLE_ACCESS',
        targetType: 'endpoint',
        targetId: req.originalUrl,
        outcome: 'denied',
        details: `Role "${user.role}" attempted access restricted to [${allowedRoles.join(', ')}]`,
        ip: req.ip || 'unknown',
      });
      res.status(403).json({
        error: `Access denied. Your account role (${user.role}) is not authorised for this resource.`,
      });
      return;
    }
    req.user = user;
    next();
  };
}

// Enforce strict price privacy rules on the backend
function filterTransactionsForViewer(
  batch: ProduceBatch,
  allBatchTransactions: FinancialTransaction[],
  viewer: StoredUser | null
): FinancialTransaction[] {
  if (!viewer) {
    return [];
  }
  // Registering farmer & explicit platform admin see complete price history for the batch
  if (viewer.role === 'admin' || (viewer.role === 'farmer' && batch.farmerId === viewer.id)) {
    return allBatchTransactions;
  }
  // Consumers and transporters see no private purchase/selling prices
  if (viewer.role === 'consumer' || viewer.role === 'transporter') {
    return [];
  }
  // Wholesalers, retailers, and partners see ONLY transactions they personally recorded
  return allBatchTransactions.filter((t) => t.participantId === viewer.id);
}

function computeMissingSupplyChainStages(events: TrackingEvent[]): string[] {
  const canonicalStages: Array<{ label: string; matchTypes: TrackingEventType[] }> = [
    { label: 'Harvested & Registered', matchTypes: ['Harvested & Registered'] },
    {
      label: 'Picked Up / In Transit',
      matchTypes: ['Picked Up by Transporter', 'Delivered by Transporter'],
    },
    {
      label: 'Wholesaler Received',
      matchTypes: ['Wholesaler Received', 'Wholesaler Dispatched'],
    },
    {
      label: 'Retailer Received',
      matchTypes: ['Retailer Received', 'Retailer Dispatched'],
    },
  ];
  const recordedTypes = new Set(events.map((e) => e.eventType));
  return canonicalStages
    .filter((st) => !st.matchTypes.some((m) => recordedTypes.has(m)))
    .map((st) => st.label);
}

function computeStageDurationHours(event: TrackingEvent, nextEvent?: TrackingEvent): number | null {
  const startMs = event.arrivalTimestamp ? Date.parse(event.arrivalTimestamp) : NaN;
  const endCandidate = event.departureTimestamp
    ? Date.parse(event.departureTimestamp)
    : nextEvent?.arrivalTimestamp
      ? Date.parse(nextEvent.arrivalTimestamp)
      : NaN;

  if (!Number.isNaN(startMs) && !Number.isNaN(endCandidate) && endCandidate >= startMs) {
    return Number(((endCandidate - startMs) / (1000 * 60 * 60)).toFixed(1));
  }
  return null;
}

function resolvePublicOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    const protoHeader = req.headers['x-forwarded-proto'];
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
    if (hostHeader && typeof hostHeader === 'string') {
      const proto = typeof protoHeader === 'string' ? protoHeader.split(',')[0] : req.protocol;
      return `${proto}://${hostHeader}`;
    }
    return process.env.APP_URL.replace(/\/$/, '');
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const proto = typeof protoHeader === 'string' ? protoHeader.split(',')[0] : req.protocol || 'http';
  return `${proto}://${hostHeader}`;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '4mb' }));

  // Security headers (iframe-compatible for AI Studio preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ==========================================================================
  // 1. SYSTEM & CONFIGURATION STATUS
  // ==========================================================================
  app.get('/api/system/config', (_req, res) => {
    const liveRazorpay = isLiveRazorpayConfigured();
    res.json({
      paymentMode: liveRazorpay ? 'razorpay_live' : 'razorpay_test_sandbox',
      razorpayKeyId: liveRazorpay ? process.env.RAZORPAY_KEY_ID : null,
      geocodingConfigured: Boolean(process.env.GEOCODING_API_KEY),
      geocodingProvider: process.env.GEOCODING_PROVIDER || 'nominatim',
      emailNotificationsConfigured: Boolean(process.env.SMTP_WEBHOOK_URL),
      smsNotificationsConfigured: Boolean(process.env.SMS_WEBHOOK_URL),
      pricing: db.state.pricing,
    });
  });

  app.get('/api/freshness-parameters', (_req, res) => {
    res.json({ parameters: db.state.freshnessParameters });
  });

  // ==========================================================================
  // 2. AUTHENTICATION & USER PROFILE
  // ==========================================================================
  app.post('/api/auth/register', rateLimit(20, 60_000), (req, res) => {
    const fullName = cleanString(req.body?.fullName, 140);
    const mobile = cleanString(req.body?.mobile, 24);
    const email = cleanString(req.body?.email, 200).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedRole = cleanString(req.body?.role, 32) as UserRole;
    const businessName = cleanString(req.body?.businessName, 180);
    const address = cleanString(req.body?.address, 400);
    const avatarDataUrl =
      typeof req.body?.avatarDataUrl === 'string' && req.body.avatarDataUrl.startsWith('data:image/')
        ? req.body.avatarDataUrl.slice(0, 600_000)
        : undefined;
    const consentAccepted = Boolean(req.body?.consentAccepted);
    const publicFarmNameConsent = req.body?.publicFarmNameConsent !== false;

    const permittedSelfRegisterRoles: UserRole[] = [
      'farmer',
      'wholesaler',
      'retailer',
      'consumer',
      'transporter',
      'partner',
    ];

    if ((requestedRole as string) === 'admin' || !permittedSelfRegisterRoles.includes(requestedRole)) {
      db.addAuditLog({
        actorUserId: null,
        actorRole: 'anonymous',
        action: 'PRIVILEGE_ESCALATION_ATTEMPT_REGISTER',
        targetType: 'user',
        targetId: email || mobile || 'unknown',
        outcome: 'denied',
        details: `Blocked attempt to self-register restricted role: "${requestedRole}"`,
        ip: req.ip || 'unknown',
      });
      res.status(403).json({
        error: 'Invalid or restricted role selected. Administrator privileges cannot be self-registered.',
      });
      return;
    }

    if (!fullName || fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!mobile || mobile.length < 8) {
      res.status(400).json({ error: 'Please enter a valid mobile number.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (!consentAccepted) {
      res.status(400).json({
        error: 'You must accept the TraceRoots Terms & Conditions and Privacy Policy to create an account.',
      });
      return;
    }

    const existingEmail = db.state.users.find(
      (u) => u.email.toLowerCase() === email && u.accountStatus !== 'deleted'
    );
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const rolePrefixMap: Record<UserRole, string> = {
      farmer: 'FRM',
      wholesaler: 'WHL',
      retailer: 'RTL',
      consumer: 'CNS',
      transporter: 'TRN',
      partner: 'PRT',
      admin: 'ADM',
    };
    const nowIso = new Date().toISOString();
    const publicCode = `${rolePrefixMap[requestedRole]}-${new Date().getUTCFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      publicCode,
      fullName,
      mobile,
      email,
      passwordHash: hashPassword(password),
      role: requestedRole,
      businessName,
      address,
      avatarDataUrl,
      accountStatus: 'active',
      createdAt: nowIso,
      consentRecords: {
        termsAcceptedAt: nowIso,
        privacyAcceptedAt: nowIso,
        publicFarmNameConsent,
        locationConsent: false,
      },
      savedBatchTokens: [],
      isDemo: false,
    };

    db.transact((state) => {
      state.users.push(newUser);
      if (newUser.role === 'farmer') {
        state.notifications.unshift({
          id: `ntf_${crypto.randomUUID()}`,
          userId: newUser.id,
          type: 'subscription_alert',
          title: 'Welcome to TraceRoots — Activate Monthly Plan',
          message:
            'Activate your ₹100/month Farmer Subscription to start registering produce batches and generating printable QR labels.',
          relatedBatchId: null,
          read: false,
          createdAtUtc: nowIso,
        });
      }
    });

    db.addAuditLog({
      actorUserId: newUser.id,
      actorRole: newUser.role,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: newUser.id,
      outcome: 'allowed',
      details: `Registered ${newUser.role} account (${newUser.publicCode})`,
      ip: req.ip || 'unknown',
    });

    const token = signSessionToken(newUser);
    res.setHeader(
      'Set-Cookie',
      `tr_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`
    );
    res.status(201).json({
      user: toPublicUser(newUser),
      token,
      subscription: null,
    });
  });

  app.post('/api/auth/login', rateLimit(25, 60_000), (req, res) => {
    const identifier = cleanString(req.body?.identifier, 200).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Please enter your email/mobile and password.' });
      return;
    }

    const normalizedDigits = identifier.replace(/\D/g, '');
    const user = db.state.users.find((u) => {
      if (u.accountStatus === 'deleted') return false;
      if (u.email.toLowerCase() === identifier) return true;
      const uDigits = u.mobile.replace(/\D/g, '');
      return normalizedDigits.length >= 10 && uDigits.endsWith(normalizedDigits.slice(-10));
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      db.addAuditLog({
        actorUserId: user?.id || null,
        actorRole: user?.role || 'anonymous',
        action: 'USER_LOGIN_FAILED',
        targetType: 'user',
        targetId: identifier,
        outcome: 'denied',
        details: 'Invalid credentials submitted',
        ip: req.ip || 'unknown',
      });
      res.status(401).json({ error: 'Invalid email/mobile number or password.' });
      return;
    }

    if (user.accountStatus === 'suspended') {
      res.status(403).json({
        error: 'This account has been suspended by an administrator. Please contact support.',
      });
      return;
    }

    const token = signSessionToken(user);
    res.setHeader(
      'Set-Cookie',
      `tr_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${7 * 86400}; SameSite=Lax`
    );

    const subscription =
      user.role === 'farmer' ? db.getAndRefreshFarmerSubscription(user.id) : null;

    db.addAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      outcome: 'allowed',
      details: `Signed in as ${user.role}`,
      ip: req.ip || 'unknown',
    });

    res.json({
      user: toPublicUser(user),
      token,
      subscription,
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'tr_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = extractAuthenticatedUser(req);
    if (!user) {
      res.json({ user: null, subscription: null, unreadNotifications: 0 });
      return;
    }
    const subscription =
      user.role === 'farmer' ? db.getAndRefreshFarmerSubscription(user.id) : null;
    const unreadNotifications = db.state.notifications.filter(
      (n) => n.userId === user.id && !n.read
    ).length;
    res.json({
      user: toPublicUser(user),
      subscription,
      unreadNotifications,
    });
  });

  app.post('/api/auth/forgot-password', rateLimit(10, 60_000), async (req, res) => {
    const email = cleanString(req.body?.email, 200).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid registered email address.' });
      return;
    }
    const user = db.state.users.find(
      (u) => u.email.toLowerCase() === email && u.accountStatus === 'active'
    );
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAtUtc = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    if (user) {
      db.transact((state) => {
        state.passwordResets.push({
          id: `rst_${crypto.randomUUID()}`,
          userId: user.id,
          email: user.email,
          codeHash: hashPassword(code),
          expiresAtUtc,
          used: false,
          createdAtUtc: new Date().toISOString(),
        });
      });
    }

    const smtpUrl = process.env.SMTP_WEBHOOK_URL;
    if (smtpUrl && user) {
      try {
        const resp = await fetch(smtpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: 'TraceRoots Password Reset Verification Code',
            code,
          }),
        });
        if (resp.ok) {
          res.json({
            ok: true,
            emailDeliveryConfirmed: true,
            message: 'Password reset code sent to your email via configured SMTP webhook.',
          });
          return;
        }
      } catch {
        // Fall through honestly
      }
    }

    // Honest reporting when SMTP_WEBHOOK_URL is not configured
    res.json({
      ok: true,
      emailDeliveryConfirmed: false,
      devVerificationCode: user ? code : null,
      message:
        'External SMTP/SMS provider is not configured in environment variables (SMTP_WEBHOOK_URL). No external email was sent. In development/test mode, use the verification code shown below to complete password reset.',
    });
  });

  app.post('/api/auth/reset-password', rateLimit(10, 60_000), (req, res) => {
    const email = cleanString(req.body?.email, 200).toLowerCase();
    const code = cleanString(req.body?.code, 16);
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !code || newPassword.length < 8) {
      res.status(400).json({
        error: 'Valid email, 6-digit verification code, and a new password (min 8 chars) are required.',
      });
      return;
    }

    const matchingReset = [...db.state.passwordResets]
      .reverse()
      .find(
        (r) =>
          r.email.toLowerCase() === email &&
          !r.used &&
          Date.parse(r.expiresAtUtc) > Date.now() &&
          verifyPassword(code, r.codeHash)
      );

    if (!matchingReset) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    db.transact((state) => {
      const targetReset = state.passwordResets.find((r) => r.id === matchingReset.id);
      if (targetReset) targetReset.used = true;
      const targetUser = state.users.find((u) => u.id === matchingReset.userId);
      if (targetUser) {
        targetUser.passwordHash = hashPassword(newPassword);
      }
    });

    db.addAuditLog({
      actorUserId: matchingReset.userId,
      actorRole: 'user',
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'user',
      targetId: matchingReset.userId,
      outcome: 'allowed',
      details: 'Password updated via verified reset code',
      ip: req.ip || 'unknown',
    });

    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const fullName = cleanString(req.body?.fullName, 140);
    const mobile = cleanString(req.body?.mobile, 24);
    const businessName = cleanString(req.body?.businessName, 180);
    const address = cleanString(req.body?.address, 400);
    const publicFarmNameConsent =
      typeof req.body?.publicFarmNameConsent === 'boolean'
        ? req.body.publicFarmNameConsent
        : user.consentRecords.publicFarmNameConsent;
    const locationConsent =
      typeof req.body?.locationConsent === 'boolean'
        ? req.body.locationConsent
        : user.consentRecords.locationConsent;

    if (!fullName || fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }

    if (req.body?.newPassword) {
      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters.' });
        return;
      }
      user.passwordHash = hashPassword(newPassword);
    }

    db.transact((state) => {
      const u = state.users.find((x) => x.id === user.id);
      if (!u) return;
      u.fullName = fullName;
      if (mobile) u.mobile = mobile;
      u.businessName = businessName;
      u.address = address;
      if (typeof req.body?.avatarDataUrl === 'string') {
        u.avatarDataUrl = req.body.avatarDataUrl.startsWith('data:image/')
          ? req.body.avatarDataUrl.slice(0, 600_000)
          : undefined;
      }
      u.consentRecords.publicFarmNameConsent = publicFarmNameConsent;
      u.consentRecords.locationConsent = locationConsent;
    });

    const refreshed = db.state.users.find((x) => x.id === user.id)!;
    res.json({ user: toPublicUser(refreshed) });
  });

  app.post('/api/auth/delete-account', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const confirmText = cleanString(req.body?.confirmText, 32);
    if (confirmText !== 'DELETE') {
      res.status(400).json({ error: 'Please type DELETE to confirm account deletion.' });
      return;
    }
    if (user.isDemo) {
      res.status(400).json({
        error: 'Pre-seeded [DEMO] sandbox accounts cannot be deleted so evaluation workflows remain intact. Register a live account to test deletion.',
      });
      return;
    }

    db.transact((state) => {
      const u = state.users.find((x) => x.id === user.id);
      if (!u) return;
      u.accountStatus = 'deleted';
      u.email = `deleted_${u.id}@redacted.traceroots.local`;
      u.mobile = 'REDACTED';
      u.address = 'REDACTED';
      u.avatarDataUrl = undefined;
    });

    db.addAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'USER_ACCOUNT_DELETED',
      targetType: 'user',
      targetId: user.id,
      outcome: 'allowed',
      details: 'Personal profile redacted; historical supply-chain events retained per traceability integrity policy.',
      ip: req.ip || 'unknown',
    });

    res.setHeader('Set-Cookie', 'tr_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  });

  app.post('/api/auth/save-batch', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const trackingToken = cleanString(req.body?.trackingToken, 120);
    const batch = db.state.batches.find((b) => b.trackingToken === trackingToken);
    if (!batch) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }
    db.transact((state) => {
      const u = state.users.find((x) => x.id === user.id);
      if (!u) return;
      const idx = u.savedBatchTokens.indexOf(trackingToken);
      if (idx >= 0) {
        u.savedBatchTokens.splice(idx, 1);
      } else {
        u.savedBatchTokens.unshift(trackingToken);
      }
    });
    const updated = db.state.users.find((x) => x.id === user.id)!;
    res.json({ savedBatchTokens: updated.savedBatchTokens });
  });

  // ==========================================================================
  // 3. GEOCODING PROXY (Location & Time Service)
  // ==========================================================================
  app.get('/api/geocode/reverse', rateLimit(30, 60_000), async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const coordLabel = `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const apiKey = process.env.GEOCODING_API_KEY;
    const provider = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();

    try {
      if (apiKey && provider === 'google') {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(4500) });
        if (r.ok) {
          const data = (await r.json()) as { results?: Array<{ formatted_address?: string }> };
          const addr = data.results?.[0]?.formatted_address;
          if (addr) {
            res.json({
              formattedAddress: addr,
              coordinates: { lat, lng },
              provider: 'google_maps',
              provenance: 'gps_geocoded',
            });
            return;
          }
        }
      }

      // OpenStreetMap Nominatim clean lookup with timeout
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`;
      const nomResp = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'TraceRoots-AgriSupplyChain/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });
      if (nomResp.ok) {
        const nomData = (await nomResp.json()) as { display_name?: string };
        if (nomData.display_name) {
          res.json({
            formattedAddress: nomData.display_name,
            coordinates: { lat, lng },
            provider: 'openstreetmap_nominatim',
            provenance: 'gps_geocoded',
          });
          return;
        }
      }
    } catch {
      // Graceful fallback below
    }

    res.json({
      formattedAddress: coordLabel,
      coordinates: { lat, lng },
      provider: 'coordinates_fallback',
      provenance: 'gps_detected',
      notice:
        'Reverse geocoding service unavailable or unconfigured; raw GPS coordinates populated. You may edit or refine the address manually.',
    });
  });

  // ==========================================================================
  // 4. PUBLIC TRACKING & QR RESOLUTION (STRICT PRIVACY FILTERING)
  // ==========================================================================
  app.get('/api/public/resolve/:query', rateLimit(60, 60_000), (req, res) => {
    const raw = cleanString(req.params.query, 300);
    if (!raw) {
      res.status(400).json({ error: 'Empty tracking lookup.' });
      return;
    }
    // Extract token if full URL was pasted or scanned
    let candidate = raw;
    const trackIdx = raw.indexOf('/track/');
    if (trackIdx >= 0) {
      candidate = raw
        .slice(trackIdx + 7)
        .split(/[?#\s]/)[0]
        .trim();
    }

    const batch = db.state.batches.find(
      (b) =>
        b.trackingToken === candidate ||
        b.batchCode.toUpperCase() === candidate.toUpperCase()
    );

    if (!batch) {
      res.status(404).json({
        error: 'No valid produce batch matches this QR code or Batch ID.',
      });
      return;
    }

    res.json({
      trackingToken: batch.trackingToken,
      batchCode: batch.batchCode,
      produceName: batch.produceName,
      category: batch.category,
      currentStatus: batch.currentStatus,
      isDemo: batch.isDemo,
    });
  });

  app.get('/api/public/track/:token', rateLimit(90, 60_000), (req, res) => {
    const token = cleanString(req.params.token, 128);
    const batch = db.state.batches.find((b) => b.trackingToken === token);
    if (!batch) {
      res.status(404).json({
        error: 'Invalid or unknown tracking token. This QR code does not match any registered batch.',
      });
      return;
    }

    const viewer = extractAuthenticatedUser(req);
    const clientEntitlementKey = cleanString(req.headers['x-entitlement-key'], 128);

    const events = db.state.events
      .filter((e) => e.batchId === batch.id)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    const freshness = calculateFreshnessEstimate(
      batch,
      events,
      db.state.freshnessParameters
    );

    // Check if paid consumer experience is unlocked for this consumer or entitlement key
    const unlockedScan: ConsumerScanRecord | undefined = db.state.consumerScans.find(
      (sc) =>
        sc.batchId === batch.id &&
        sc.entitlementStatus === 'unlocked' &&
        ((viewer && sc.consumerId === viewer.id) ||
          (clientEntitlementKey && sc.clientEntitlementKey === clientEntitlementKey))
    );

    const paymentForScan = unlockedScan
      ? db.state.payments.find((p) => p.id === unlockedScan.paymentId)
      : undefined;

    const publicEvents: PublicTrackingResponse['events'] = events.map((ev, idx) => ({
      id: ev.id,
      sequenceNumber: ev.sequenceNumber,
      participantRole: ev.participantRole,
      participantBusiness: ev.participantBusiness || `${ev.participantRole} participant`,
      eventType: ev.eventType,
      arrivalLocation: ev.arrivalLocation,
      arrivalLocationProvenance: ev.arrivalLocationProvenance,
      arrivalTimestamp: ev.arrivalTimestamp,
      departureLocation: ev.departureLocation,
      departureLocationProvenance: ev.departureLocationProvenance,
      departureTimestamp: ev.departureTimestamp,
      storageMethod: ev.storageMethod,
      storageTemperatureC: ev.storageTemperatureC,
      refrigerationInterrupted: ev.refrigerationInterrupted,
      produceCondition: ev.produceCondition,
      transportMethod: ev.transportMethod,
      destinationParticipant: ev.destinationParticipant,
      notes: ev.notes,
      photoDataUrl: ev.photoDataUrl,
      transactionRefCode: ev.transactionRefCode,
      correctionOfEventId: ev.correctionOfEventId,
      correctionReason: ev.correctionReason,
      verificationStatus: ev.verificationStatus,
      serverCreatedAtUtc: ev.serverCreatedAtUtc,
      stageDurationHours: computeStageDurationHours(ev, events[idx + 1]),
    }));

    const tempsWithValues = events.filter((e) => typeof e.storageTemperatureC === 'number');
    const compliantTemps = tempsWithValues.filter((e) => !e.refrigerationInterrupted);

    const responsePayload: PublicTrackingResponse = {
      batch: {
        batchCode: batch.batchCode,
        trackingToken: batch.trackingToken,
        produceName: batch.produceName,
        category: batch.category,
        variety: batch.variety,
        quantity: batch.quantity,
        unit: batch.unit,
        harvestDate: batch.harvestDate,
        harvestTime: batch.harvestTime,
        harvestTimestampUtc: batch.harvestTimestampUtc,
        farmerDisplayName: batch.showFarmerNamePublicly
          ? `${batch.farmName || batch.farmerName}`
          : 'Registered Farm (Name withheld by farmer privacy setting)',
        farmLocation: batch.farmLocation,
        storageMethod: batch.storageMethod,
        batchDescription: batch.batchDescription,
        imageDataUrl: batch.imageDataUrl,
        qualityNotes: batch.qualityNotes,
        departureLocation: batch.departureLocation,
        departureLocationProvenance: batch.departureLocationProvenance,
        departureDate: batch.departureDate,
        departureTime: batch.departureTime,
        destination: batch.destination,
        transportMethod: batch.transportMethod,
        createdAtUtc: batch.createdAtUtc,
        currentStatus: batch.currentStatus,
        isDemo: batch.isDemo,
      },
      events: publicEvents,
      freshness,
      missingStages: computeMissingSupplyChainStages(events),
      paidConsumerUnlocked: Boolean(unlockedScan),
      paidConsumerAnalytics: unlockedScan
        ? {
            coldChainCompliancePercent:
              tempsWithValues.length > 0
                ? Math.round((compliantTemps.length / tempsWithValues.length) * 100)
                : null,
            totalRecordedHandoffs: events.length,
            stageBreakdown: publicEvents.map((pe) => ({
              stage: pe.eventType,
              business: pe.participantBusiness,
              hoursSpent: pe.stageDurationHours ?? 0,
              storage: pe.storageMethod,
              temperatureC: pe.storageTemperatureC,
            })),
            provenanceCertificateId: unlockedScan.scanCode,
            scanReceiptNumber: paymentForScan?.receiptNumber || unlockedScan.scanCode,
            unlockedAtUtc: unlockedScan.createdAtUtc,
          }
        : null,
      consumerScanFeeInr: db.state.pricing.consumerScanFeeInr,
    };

    res.json(responsePayload);
  });

  // ==========================================================================
  // 5. BATCH REGISTRATION, QR GENERATION & SUPPLY-CHAIN HANDOFFS
  // ==========================================================================
  app.get('/api/batches', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const includeDemo = req.query.includeDemo !== 'false';

    let accessibleBatches: ProduceBatch[] = [];

    if (user.role === 'admin') {
      accessibleBatches = db.state.batches;
    } else if (user.role === 'farmer') {
      accessibleBatches = db.state.batches.filter(
        (b) => b.farmerId === user.id || (includeDemo && b.isDemo && user.isDemo)
      );
    } else if (
      user.role === 'wholesaler' ||
      user.role === 'retailer' ||
      user.role === 'transporter' ||
      user.role === 'partner'
    ) {
      // Participants see batches they have handled plus active dispatches awaiting handoff
      const myBatchIds = new Set(
        db.state.events.filter((e) => e.participantId === user.id).map((e) => e.batchId)
      );
      accessibleBatches = db.state.batches.filter(
        (b) =>
          myBatchIds.has(b.id) ||
          b.currentStatus !== 'Delivered / Consumer Ready' ||
          (includeDemo && b.isDemo)
      );
    } else if (user.role === 'consumer') {
      const scannedBatchIds = new Set(
        db.state.consumerScans
          .filter((s) => s.consumerId === user.id)
          .map((s) => s.batchId)
      );
      const savedSet = new Set(user.savedBatchTokens);
      accessibleBatches = db.state.batches.filter(
        (b) =>
          scannedBatchIds.has(b.id) ||
          savedSet.has(b.trackingToken) ||
          (includeDemo && b.isDemo)
      );
    }

    if (!includeDemo) {
      accessibleBatches = accessibleBatches.filter((b) => !b.isDemo);
    }

    const enriched = accessibleBatches
      .map((batch) => {
        const events = db.state.events
          .filter((e) => e.batchId === batch.id)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        const freshness = calculateFreshnessEstimate(
          batch,
          events,
          db.state.freshnessParameters
        );
        const allTxns = db.state.transactions.filter((t) => t.batchId === batch.id);
        const permittedTxns = filterTransactionsForViewer(batch, allTxns, user);

        // Redact farmer private contact for consumers
        const safeBatch =
          user.role === 'consumer'
            ? { ...batch, farmerContact: 'Restricted' }
            : batch;

        return {
          batch: safeBatch,
          eventCount: events.length,
          latestEvent: events[events.length - 1] || null,
          freshness,
          transactions: permittedTxns,
        };
      })
      .sort(
        (a, b) =>
          Date.parse(b.batch.createdAtUtc) - Date.parse(a.batch.createdAtUtc)
      );

    res.json({ items: enriched });
  });

  // Farmer Batch Registration
  app.post(
    '/api/batches',
    requireRoles(['farmer']),
    rateLimit(25, 60_000),
    (req: AuthedRequest, res) => {
      const farmer = req.user!;

      // Verify active subscription
      const subscription = db.getAndRefreshFarmerSubscription(farmer.id);
      if (!subscription || subscription.status !== 'active') {
        res.status(402).json({
          error:
            'Active Farmer Subscription (₹100/month) required to register new produce batches. Previously registered batches remain active and traceable.',
          subscriptionStatus: subscription?.status || 'none',
        });
        return;
      }

      const idempotencyKey = cleanString(req.body?.idempotencyKey, 128);
      if (!idempotencyKey) {
        res.status(400).json({ error: 'Missing idempotencyKey for duplicate submission protection.' });
        return;
      }

      // Prevent accidental duplicate batch registration
      const existingByIdem = db.state.batches.find((b) => b.idempotencyKey === idempotencyKey);
      if (existingByIdem) {
        res.status(200).json({ batch: existingByIdem, duplicatePrevented: true });
        return;
      }

      const farmName = cleanString(req.body?.farmName, 180) || farmer.businessName;
      const farmerContact = cleanString(req.body?.farmerContact, 80) || farmer.mobile;
      const farmLocation = cleanString(req.body?.farmLocation, 300) || farmer.address;
      const produceName = cleanString(req.body?.produceName, 160);
      const category = cleanString(req.body?.category, 120);
      const variety = cleanString(req.body?.variety, 120);
      const quantity = Number(req.body?.quantity);
      const unit = (cleanString(req.body?.unit, 24) || 'kg') as ProduceUnit;
      const harvestDate = cleanString(req.body?.harvestDate, 16);
      const harvestTime = cleanString(req.body?.harvestTime, 16) || '07:00';
      const expectedShelfLifeDays =
        req.body?.expectedShelfLifeDays !== '' &&
        req.body?.expectedShelfLifeDays !== null &&
        req.body?.expectedShelfLifeDays !== undefined
          ? Number(req.body.expectedShelfLifeDays)
          : null;
      const storageMethod = (cleanString(req.body?.storageMethod, 48) ||
        'ventilated_crate') as StorageMethod;
      const batchDescription = cleanString(req.body?.batchDescription, 1000);
      const qualityNotes = cleanString(req.body?.qualityNotes, 600);
      const departureLocation = cleanString(req.body?.departureLocation, 350);
      const departureLocationProvenance = (cleanString(
        req.body?.departureLocationProvenance,
        32
      ) || 'manual_entry') as LocationProvenance;
      const departureDate = cleanString(req.body?.departureDate, 16);
      const departureTime = cleanString(req.body?.departureTime, 16);
      const destination = cleanString(req.body?.destination, 250);
      const transportMethod = cleanString(req.body?.transportMethod, 150);
      const vehicleDetails = cleanString(req.body?.vehicleDetails, 180);
      const storageTemperatureC =
        req.body?.storageTemperatureC !== '' &&
        req.body?.storageTemperatureC !== null &&
        req.body?.storageTemperatureC !== undefined
          ? Number(req.body.storageTemperatureC)
          : null;

      if (!farmName || !farmLocation) {
        res.status(400).json({ error: 'Farm name and farm location are required.' });
        return;
      }
      if (!produceName || !category) {
        res.status(400).json({ error: 'Produce name and category are required.' });
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        res.status(400).json({ error: 'Quantity must be a positive number.' });
        return;
      }
      if (!harvestDate || Number.isNaN(Date.parse(`${harvestDate}T${harvestTime}:00`))) {
        res.status(400).json({ error: 'Valid harvest date is required.' });
        return;
      }
      if (!departureLocation || !departureDate || !departureTime) {
        res.status(400).json({
          error: 'Departure location, departure date, and departure time are required.',
        });
        return;
      }

      const harvestTimestampUtc = new Date(`${harvestDate}T${harvestTime}:00`).toISOString();
      const departureTimestampUtc = new Date(`${departureDate}T${departureTime}:00`).toISOString();
      const nowIso = new Date().toISOString();

      const existingCodes = new Set(db.state.batches.map((b) => b.batchCode));
      const existingTokens = new Set(db.state.batches.map((b) => b.trackingToken));

      const batchCode = generateBatchCode(existingCodes);
      const trackingToken = generateSecureTrackingToken(existingTokens);

      const imageDataUrl =
        typeof req.body?.imageDataUrl === 'string' && req.body.imageDataUrl.startsWith('data:image/')
          ? req.body.imageDataUrl.slice(0, 750_000)
          : undefined;

      const coordinates =
        req.body?.departureCoordinates &&
        typeof req.body.departureCoordinates.lat === 'number' &&
        typeof req.body.departureCoordinates.lng === 'number'
          ? {
              lat: Number(req.body.departureCoordinates.lat),
              lng: Number(req.body.departureCoordinates.lng),
            }
          : null;

      const newBatch: ProduceBatch = {
        id: `bat_${crypto.randomUUID()}`,
        batchCode,
        trackingToken,
        idempotencyKey,
        farmerId: farmer.id,
        farmerName: farmer.fullName,
        farmName,
        farmerPublicId: farmer.publicCode,
        farmerContact,
        farmLocation,
        showFarmerNamePublicly: farmer.consentRecords.publicFarmNameConsent,
        produceName,
        category,
        variety,
        quantity,
        unit,
        harvestDate,
        harvestTime,
        harvestTimestampUtc,
        expectedShelfLifeDays:
          expectedShelfLifeDays !== null && Number.isFinite(expectedShelfLifeDays)
            ? expectedShelfLifeDays
            : null,
        storageMethod,
        batchDescription,
        imageDataUrl,
        qualityNotes,
        departureLocation,
        departureLocationProvenance,
        departureCoordinates: coordinates,
        departureDate,
        departureTime,
        destination,
        transportMethod,
        vehicleDetails,
        createdAtUtc: nowIso,
        currentStatus: transportMethod ? 'In Transit' : 'Registered',
        isDemo: false,
      };

      const initialVerification: VerificationStatus =
        departureLocationProvenance === 'gps_geocoded' ||
        departureLocationProvenance === 'gps_detected'
          ? 'Submitted by registered participant'
          : 'Manually entered';

      const initialEvent: TrackingEvent = {
        id: `evt_${crypto.randomUUID()}`,
        batchId: newBatch.id,
        sequenceNumber: 1,
        participantId: farmer.id,
        participantRole: 'farmer',
        participantName: farmer.fullName,
        participantBusiness: farmName,
        eventType: 'Harvested & Registered',
        arrivalLocation: farmLocation,
        arrivalLocationProvenance: 'manual_entry',
        arrivalTimestamp: harvestTimestampUtc,
        departureLocation,
        departureLocationProvenance,
        departureTimestamp: departureTimestampUtc,
        storageMethod,
        storageTemperatureC:
          storageTemperatureC !== null && Number.isFinite(storageTemperatureC)
            ? storageTemperatureC
            : null,
        refrigerationInterrupted: false,
        produceCondition: 'Excellent',
        transportMethod,
        vehicleDetails,
        destinationParticipant: destination,
        notes: qualityNotes || batchDescription || 'Initial farm harvest and batch registration.',
        photoDataUrl: imageDataUrl,
        transactionId: null,
        transactionRefCode: null,
        correctionOfEventId: null,
        correctionReason: null,
        verificationStatus: initialVerification,
        serverCreatedAtUtc: nowIso,
        idempotencyKey: `evt_${idempotencyKey}`,
      };

      db.transact((state) => {
        state.batches.unshift(newBatch);
        state.events.push(initialEvent);
        state.notifications.unshift({
          id: `ntf_${crypto.randomUUID()}`,
          userId: farmer.id,
          type: 'batch_registered',
          title: `Batch ${newBatch.batchCode} Registered`,
          message: `${newBatch.produceName} (${newBatch.quantity} ${newBatch.unit}) registered with unique QR tracking token.`,
          relatedBatchId: newBatch.id,
          read: false,
          createdAtUtc: nowIso,
        });
      });

      db.addAuditLog({
        actorUserId: farmer.id,
        actorRole: farmer.role,
        action: 'BATCH_REGISTERED',
        targetType: 'batch',
        targetId: newBatch.batchCode,
        outcome: 'allowed',
        details: `Created batch ${newBatch.batchCode} (${newBatch.produceName})`,
        ip: req.ip || 'unknown',
      });

      res.status(201).json({ batch: newBatch, initialEvent });
    }
  );

  // Role-Scoped Batch Detail Endpoint
  app.get('/api/batches/:batchId', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const key = cleanString(req.params.batchId, 128);
    const batch = db.state.batches.find(
      (b) => b.id === key || b.batchCode === key || b.trackingToken === key
    );
    if (!batch) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }

    // Security Workflow E2: Prevent one farmer from viewing/modifying another farmer's private batch dashboard
    if (user.role === 'farmer' && batch.farmerId !== user.id && !(batch.isDemo && user.isDemo)) {
      db.addAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'UNAUTHORIZED_BATCH_ACCESS',
        targetType: 'batch',
        targetId: batch.batchCode,
        outcome: 'denied',
        details: `Farmer ${user.id} attempted to inspect batch owned by ${batch.farmerId}`,
        ip: req.ip || 'unknown',
      });
      res.status(403).json({
        error: 'Access denied. Farmers may only access full private records for batches they registered.',
      });
      return;
    }

    const events = db.state.events
      .filter((e) => e.batchId === batch.id)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    const eventsWithDurations = events.map((ev, idx) => ({
      ...ev,
      stageDurationHours: computeStageDurationHours(ev, events[idx + 1]),
    }));

    const allTxns = db.state.transactions
      .filter((t) => t.batchId === batch.id)
      .sort((a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc));

    const permittedTransactions = filterTransactionsForViewer(batch, allTxns, user);
    const freshness = calculateFreshnessEstimate(
      batch,
      events,
      db.state.freshnessParameters
    );

    const safeBatch =
      user.role === 'consumer'
        ? { ...batch, farmerContact: 'Restricted' }
        : batch;

    res.json({
      batch: safeBatch,
      events: eventsWithDurations,
      transactions: permittedTransactions,
      freshness,
      missingStages: computeMissingSupplyChainStages(events),
      canViewFullPriceHistory:
        user.role === 'admin' || (user.role === 'farmer' && batch.farmerId === user.id),
    });
  });

  // QR Code PNG & SVG Generation Endpoint
  app.get('/api/batches/:batchId/qr', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.user!;
    const key = cleanString(req.params.batchId, 128);
    const batch = db.state.batches.find(
      (b) => b.id === key || b.batchCode === key || b.trackingToken === key
    );
    if (!batch) {
      res.status(404).json({ error: 'Batch not found.' });
      return;
    }

    if (user.role === 'farmer' && batch.farmerId !== user.id && !(batch.isDemo && user.isDemo)) {
      res.status(403).json({ error: 'Access denied to another farmer’s QR label.' });
      return;
    }

    const origin = resolvePublicOrigin(req);
    const trackingUrl = `${origin}/track/${batch.trackingToken}`;

    const pngDataUrl = await QRCode.toDataURL(trackingUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: {
        dark: '#18261E',
        light: '#FFFFFF',
      },
    });

    const svgMarkup = await QRCode.toString(trackingUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#18261E',
        light: '#FFFFFF',
      },
    });

    res.json({
      batchCode: batch.batchCode,
      trackingToken: batch.trackingToken,
      trackingUrl,
      pngDataUrl,
      svgMarkup,
    });
  });

  // Append-Only Supply-Chain Handoff Event Endpoint
  app.post(
    '/api/batches/:batchId/handoff',
    requireRoles(['wholesaler', 'retailer', 'transporter', 'partner', 'farmer', 'admin']),
    rateLimit(30, 60_000),
    (req: AuthedRequest, res) => {
      const actor = req.user!;
      const key = cleanString(req.params.batchId, 128);
      const batch = db.state.batches.find(
        (b) => b.id === key || b.batchCode === key || b.trackingToken === key
      );

      if (!batch) {
        res.status(404).json({ error: 'Batch not found.' });
        return;
      }

      // A farmer can only append dispatch/correction notes to their own batch, never another farmer's
      if (actor.role === 'farmer' && batch.farmerId !== actor.id) {
        db.addAuditLog({
          actorUserId: actor.id,
          actorRole: actor.role,
          action: 'UNAUTHORIZED_BATCH_HANDOFF_ATTEMPT',
          targetType: 'batch',
          targetId: batch.batchCode,
          outcome: 'denied',
          details: 'Farmer attempted to modify batch belonging to another farmer',
          ip: req.ip || 'unknown',
        });
        res.status(403).json({ error: 'You cannot record events on another farmer’s batch.' });
        return;
      }

      const idempotencyKey = cleanString(req.body?.idempotencyKey, 128);
      if (!idempotencyKey) {
        res.status(400).json({ error: 'Missing idempotencyKey to prevent duplicate scan events.' });
        return;
      }

      const duplicateEvent = db.state.events.find((e) => e.idempotencyKey === idempotencyKey);
      if (duplicateEvent) {
        res.status(200).json({ event: duplicateEvent, duplicatePrevented: true });
        return;
      }

      const eventType = cleanString(req.body?.eventType, 64) as TrackingEventType;
      const allowedEventTypes: TrackingEventType[] = [
        'Picked Up by Transporter',
        'Delivered by Transporter',
        'Wholesaler Received',
        'Wholesaler Dispatched',
        'Retailer Received',
        'Retailer Dispatched',
        'Partner Handoff',
        'Correction Record',
      ];
      if (!allowedEventTypes.includes(eventType)) {
        res.status(400).json({ error: 'Invalid tracking event type.' });
        return;
      }

      const correctionOfEventId = cleanString(req.body?.correctionOfEventId, 128) || null;
      const correctionReason = cleanString(req.body?.correctionReason, 500) || null;

      if (eventType === 'Correction Record' && (!correctionOfEventId || !correctionReason)) {
        res.status(400).json({
          error: 'Correction records require selecting the target event and stating a clear reason.',
        });
        return;
      }

      const businessName =
        cleanString(req.body?.businessName, 180) || actor.businessName || actor.fullName;
      const arrivalLocation = cleanString(req.body?.arrivalLocation, 350);
      const arrivalLocationProvenance = (cleanString(
        req.body?.arrivalLocationProvenance,
        32
      ) || 'manual_entry') as LocationProvenance;
      const arrivalTimestamp = cleanString(req.body?.arrivalTimestamp, 40);

      const departureLocation = cleanString(req.body?.departureLocation, 350);
      const departureLocationProvenance = (cleanString(
        req.body?.departureLocationProvenance,
        32
      ) || (departureLocation ? 'manual_entry' : 'not_recorded')) as LocationProvenance;
      const departureTimestamp = cleanString(req.body?.departureTimestamp, 40);

      if (!arrivalLocation && eventType !== 'Correction Record') {
        res.status(400).json({ error: 'Arrival / pickup location is required.' });
        return;
      }

      const storageMethod = (cleanString(req.body?.storageMethod, 48) ||
        batch.storageMethod) as StorageMethod;
      const storageTemperatureC =
        req.body?.storageTemperatureC !== '' &&
        req.body?.storageTemperatureC !== null &&
        req.body?.storageTemperatureC !== undefined
          ? Number(req.body.storageTemperatureC)
          : null;
      const refrigerationInterrupted = Boolean(req.body?.refrigerationInterrupted);
      const produceCondition = (cleanString(req.body?.produceCondition, 48) ||
        'Good') as ProduceCondition;
      const transportMethod = cleanString(req.body?.transportMethod, 150);
      const vehicleDetails = cleanString(req.body?.vehicleDetails, 180);
      const destinationParticipant = cleanString(req.body?.destinationParticipant, 200);
      const notes = cleanString(req.body?.notes, 1000);
      const photoDataUrl =
        typeof req.body?.photoDataUrl === 'string' && req.body.photoDataUrl.startsWith('data:image/')
          ? req.body.photoDataUrl.slice(0, 750_000)
          : undefined;

      // Optional financial transaction for Wholesaler / Retailer / Partner
      const hasPurchasePrice =
        (actor.role === 'wholesaler' || actor.role === 'retailer' || actor.role === 'partner') &&
        req.body?.purchasePricePerUnit !== '' &&
        req.body?.purchasePricePerUnit !== undefined &&
        req.body?.purchasePricePerUnit !== null;

      let createdTxn: FinancialTransaction | null = null;
      const nowIso = new Date().toISOString();
      const eventId = `evt_${crypto.randomUUID()}`;

      if (hasPurchasePrice) {
        const purchasePricePerUnit = Number(req.body.purchasePricePerUnit);
        const txnQuantity =
          req.body?.quantity !== undefined && req.body?.quantity !== ''
            ? Number(req.body.quantity)
            : batch.quantity;
        const sellingPricePerUnit =
          req.body?.sellingPricePerUnit !== '' &&
          req.body?.sellingPricePerUnit !== undefined &&
          req.body?.sellingPricePerUnit !== null
            ? Number(req.body.sellingPricePerUnit)
            : null;

        if (!Number.isFinite(purchasePricePerUnit) || purchasePricePerUnit < 0) {
          res.status(400).json({ error: 'Purchase price must be a valid non-negative amount.' });
          return;
        }
        if (!Number.isFinite(txnQuantity) || txnQuantity <= 0) {
          res.status(400).json({ error: 'Transaction quantity must be greater than zero.' });
          return;
        }

        createdTxn = {
          id: `txn_${crypto.randomUUID()}`,
          referenceCode: `TXN-${new Date().getUTCFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          batchId: batch.id,
          batchCode: batch.batchCode,
          produceName: batch.produceName,
          relatedEventId: eventId,
          participantId: actor.id,
          participantRole: actor.role,
          participantName: actor.fullName,
          participantBusiness: businessName,
          quantity: txnQuantity,
          unit: batch.unit,
          purchasePricePerUnit,
          totalPurchasePrice: Number((purchasePricePerUnit * txnQuantity).toFixed(2)),
          sellingPricePerUnit:
            sellingPricePerUnit !== null && Number.isFinite(sellingPricePerUnit)
              ? sellingPricePerUnit
              : null,
          expectedTotalSellingValue:
            sellingPricePerUnit !== null && Number.isFinite(sellingPricePerUnit)
              ? Number((sellingPricePerUnit * txnQuantity).toFixed(2))
              : null,
          currency: 'INR',
          createdAtUtc: nowIso,
        };
      }

      const existingBatchEvents = db.state.events.filter((e) => e.batchId === batch.id);
      const nextSeq =
        existingBatchEvents.reduce((max, e) => Math.max(max, e.sequenceNumber), 0) + 1;

      const verificationStatus: VerificationStatus =
        eventType === 'Correction Record' && actor.role === 'admin'
          ? 'Audited admin correction'
          : arrivalLocationProvenance === 'gps_geocoded' ||
              arrivalLocationProvenance === 'gps_detected'
            ? 'Submitted by registered participant'
            : 'Manually entered';

      const parsedArrivalIso =
        arrivalTimestamp && !Number.isNaN(Date.parse(arrivalTimestamp))
          ? new Date(arrivalTimestamp).toISOString()
          : nowIso;
      const parsedDepartureIso =
        departureTimestamp && !Number.isNaN(Date.parse(departureTimestamp))
          ? new Date(departureTimestamp).toISOString()
          : '';

      const newEvent: TrackingEvent = {
        id: eventId,
        batchId: batch.id,
        sequenceNumber: nextSeq,
        participantId: actor.id,
        participantRole: actor.role,
        participantName: actor.fullName,
        participantBusiness: businessName,
        eventType,
        arrivalLocation,
        arrivalLocationProvenance,
        arrivalTimestamp: parsedArrivalIso,
        departureLocation,
        departureLocationProvenance,
        departureTimestamp: parsedDepartureIso,
        storageMethod,
        storageTemperatureC:
          storageTemperatureC !== null && Number.isFinite(storageTemperatureC)
            ? storageTemperatureC
            : null,
        refrigerationInterrupted,
        produceCondition,
        transportMethod,
        vehicleDetails,
        destinationParticipant,
        notes,
        photoDataUrl,
        transactionId: createdTxn ? createdTxn.id : null,
        transactionRefCode: createdTxn ? createdTxn.referenceCode : null,
        correctionOfEventId,
        correctionReason,
        verificationStatus,
        serverCreatedAtUtc: nowIso,
        idempotencyKey,
      };

      db.transact((state) => {
        state.events.push(newEvent);
        if (createdTxn) {
          state.transactions.push(createdTxn);
        }
        const targetBatch = state.batches.find((b) => b.id === batch.id);
        if (targetBatch) {
          targetBatch.currentStatus = db.computeBatchStatusFromEvent(
            eventType,
            targetBatch.currentStatus
          );
        }

        // Notify the registering farmer
        if (batch.farmerId !== actor.id) {
          const notifType =
            actor.role === 'wholesaler'
              ? 'wholesaler_received'
              : actor.role === 'retailer'
                ? 'retailer_received'
                : 'transporter_update';
          state.notifications.unshift({
            id: `ntf_${crypto.randomUUID()}`,
            userId: batch.farmerId,
            type: notifType,
            title: `${eventType} — ${batch.batchCode}`,
            message: `${businessName} recorded "${eventType}" at ${arrivalLocation || 'recorded location'}${
              createdTxn ? ` (Purchase ₹${createdTxn.purchasePricePerUnit}/${batch.unit})` : ''
            }.`,
            relatedBatchId: batch.id,
            read: false,
            createdAtUtc: nowIso,
          });
        }
      });

      db.addAuditLog({
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'TRACKING_EVENT_APPENDED',
        targetType: 'batch',
        targetId: batch.batchCode,
        outcome: 'allowed',
        details: `Appended seq #${nextSeq} (${eventType})`,
        ip: req.ip || 'unknown',
      });

      res.status(201).json({ event: newEvent, transaction: createdTxn });
    }
  );

  // Farmer Dedicated Complete Price History
  app.get('/api/farmer/price-history', requireRoles(['farmer', 'admin']), (req: AuthedRequest, res) => {
    const user = req.user!;
    const batches =
      user.role === 'admin'
        ? db.state.batches
        : db.state.batches.filter(
            (b) => b.farmerId === user.id || (b.isDemo && user.isDemo)
          );

    const records = batches.map((batch) => {
      const txns = db.state.transactions
        .filter((t) => t.batchId === batch.id)
        .sort((a, b) => Date.parse(a.createdAtUtc) - Date.parse(b.createdAtUtc));
      return {
        batch,
        transactions: txns,
      };
    });

    res.json({ records });
  });

  // Participant's Own Authorised Financial Records
  app.get(
    '/api/transactions/my',
    requireRoles(['wholesaler', 'retailer', 'partner', 'farmer', 'admin']),
    (req: AuthedRequest, res) => {
      const user = req.user!;
      let txns: FinancialTransaction[] = [];
      if (user.role === 'admin') {
        txns = db.state.transactions;
      } else if (user.role === 'farmer') {
        const myBatchIds = new Set(
          db.state.batches
            .filter((b) => b.farmerId === user.id || (b.isDemo && user.isDemo))
            .map((b) => b.id)
        );
        txns = db.state.transactions.filter((t) => myBatchIds.has(t.batchId));
      } else {
        txns = db.state.transactions.filter((t) => t.participantId === user.id);
      }
      res.json({
        transactions: txns.sort(
          (a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc)
        ),
      });
    }
  );

  // ==========================================================================
  // 6. SUBSCRIPTIONS & PAYMENTS (RAZORPAY + VERIFIED TEST SANDBOX)
  // ==========================================================================
  app.get('/api/subscription', requireRoles(['farmer']), (req: AuthedRequest, res) => {
    const farmer = req.user!;
    const subscription = db.getAndRefreshFarmerSubscription(farmer.id);
    const payments = db.state.payments
      .filter((p) => p.userId === farmer.id && p.purpose === 'farmer_subscription')
      .sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc));

    res.json({
      subscription,
      payments,
      monthlyPriceInr: db.state.pricing.farmerMonthlyPriceInr,
    });
  });

  app.post('/api/subscription/cancel', requireRoles(['farmer']), (req: AuthedRequest, res) => {
    const farmer = req.user!;
    const sub = db.state.subscriptions.find((s) => s.farmerId === farmer.id);
    if (!sub) {
      res.status(404).json({ error: 'No subscription found for this account.' });
      return;
    }
    const nowIso = new Date().toISOString();
    db.transact((state) => {
      const target = state.subscriptions.find((s) => s.id === sub.id);
      if (target) {
        target.status = 'cancelled';
        target.cancelledAtUtc = nowIso;
      }
      state.notifications.unshift({
        id: `ntf_${crypto.randomUUID()}`,
        userId: farmer.id,
        type: 'subscription_alert',
        title: 'Farmer Subscription Cancelled',
        message:
          'Your monthly subscription has been cancelled. All previously registered batches and QR codes remain permanently traceable.',
        relatedBatchId: null,
        read: false,
        createdAtUtc: nowIso,
      });
    });

    res.json({
      subscription: db.state.subscriptions.find((s) => s.id === sub.id),
    });
  });

  // Create Server-Side Payment Order
  app.post('/api/payments/create-order', rateLimit(25, 60_000), async (req, res) => {
    const viewer = extractAuthenticatedUser(req);
    const purpose = cleanString(req.body?.purpose, 32) as
      | 'farmer_subscription'
      | 'consumer_scan';
    const idempotencyKey = cleanString(req.body?.idempotencyKey, 128);
    const trackingToken = cleanString(req.body?.trackingToken, 128);
    const clientEntitlementKey = cleanString(req.body?.clientEntitlementKey, 128);

    if (!idempotencyKey) {
      res.status(400).json({ error: 'Missing idempotencyKey.' });
      return;
    }

    // Return existing order if idempotencyKey matches
    const existingOrder = db.state.payments.find((p) => p.idempotencyKey === idempotencyKey);
    if (existingOrder) {
      res.json({
        payment: existingOrder,
        paymentMode: existingOrder.provider,
        razorpayKeyId: isLiveRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : null,
      });
      return;
    }

    let amountInr = 0;
    let relatedBatch: ProduceBatch | null = null;

    if (purpose === 'farmer_subscription') {
      if (!viewer || viewer.role !== 'farmer') {
        res.status(403).json({
          error: 'Only signed-in Farmer accounts can purchase the Farmer Monthly Subscription.',
        });
        return;
      }
      amountInr = db.state.pricing.farmerMonthlyPriceInr;
    } else if (purpose === 'consumer_scan') {
      if (!trackingToken) {
        res.status(400).json({ error: 'Tracking token is required for paid consumer scan.' });
        return;
      }
      relatedBatch = db.state.batches.find((b) => b.trackingToken === trackingToken) || null;
      if (!relatedBatch) {
        res.status(404).json({ error: 'Batch not found for this QR code.' });
        return;
      }
      if (!viewer && !clientEntitlementKey) {
        res.status(400).json({ error: 'Client entitlement identifier required.' });
        return;
      }
      // Prevent duplicate charges if consumer already unlocked this batch!
      const alreadyUnlocked = db.state.consumerScans.find(
        (sc) =>
          sc.batchId === relatedBatch!.id &&
          sc.entitlementStatus === 'unlocked' &&
          ((viewer && sc.consumerId === viewer.id) ||
            (clientEntitlementKey && sc.clientEntitlementKey === clientEntitlementKey))
      );
      if (alreadyUnlocked) {
        const existingPay = db.state.payments.find((p) => p.id === alreadyUnlocked.paymentId);
        res.json({
          alreadyUnlocked: true,
          scanRecord: alreadyUnlocked,
          payment: existingPay || null,
        });
        return;
      }
      amountInr = db.state.pricing.consumerScanFeeInr;
    } else {
      res.status(400).json({ error: 'Unsupported payment purpose.' });
      return;
    }

    const liveMode = isLiveRazorpayConfigured();
    let providerOrderId = `order_test_${crypto.randomBytes(8).toString('hex')}`;
    const provider: PaymentRecord['provider'] = liveMode
      ? 'razorpay_live'
      : 'razorpay_test_sandbox';

    if (liveMode) {
      try {
        const auth = Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64');
        const rzResp = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInr * 100, // paise
            currency: 'INR',
            receipt: `tr_${Date.now()}`,
            notes: {
              purpose,
              batchCode: relatedBatch?.batchCode || '',
            },
          }),
        });
        if (!rzResp.ok) {
          res.status(502).json({
            error: 'Razorpay order creation failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
          });
          return;
        }
        const rzOrder = (await rzResp.json()) as { id: string };
        providerOrderId = rzOrder.id;
      } catch {
        res.status(502).json({
          error: 'Could not reach Razorpay API to create order.',
        });
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const paymentRecord: PaymentRecord = {
      id: `pay_${crypto.randomUUID()}`,
      receiptNumber: `RCP-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: viewer?.id || null,
      purpose,
      relatedBatchId: relatedBatch?.id || null,
      relatedBatchCode: relatedBatch?.batchCode || null,
      relatedSubscriptionId: null,
      amountInr,
      currency: 'INR',
      provider,
      providerOrderId,
      providerPaymentId: null,
      providerSignature: null,
      verificationStatus: 'created',
      idempotencyKey,
      createdAtUtc: nowIso,
      updatedAtUtc: nowIso,
    };

    db.transact((state) => {
      state.payments.unshift(paymentRecord);
    });

    res.status(201).json({
      payment: paymentRecord,
      paymentMode: provider,
      razorpayKeyId: liveMode ? process.env.RAZORPAY_KEY_ID : null,
      clientEntitlementKey,
    });
  });

  // Development / Test Payment Gateway Bank Simulator (STRICTLY DISABLED IN LIVE RAZORPAY MODE)
  app.post('/api/payments/test-gateway-authorize', rateLimit(20, 60_000), (req, res) => {
    if (isLiveRazorpayConfigured()) {
      res.status(403).json({
        error: 'Test sandbox simulator is disabled when live Razorpay credentials are configured.',
      });
      return;
    }

    const paymentId = cleanString(req.body?.paymentId, 128);
    const outcome = cleanString(req.body?.outcome, 24) as 'success' | 'failed' | 'cancelled';
    const payment = db.state.payments.find((p) => p.id === paymentId);

    if (!payment || payment.provider !== 'razorpay_test_sandbox') {
      res.status(404).json({ error: 'Test payment order not found.' });
      return;
    }

    if (outcome === 'failed' || outcome === 'cancelled') {
      const nowIso = new Date().toISOString();
      db.transact((state) => {
        const target = state.payments.find((p) => p.id === payment.id);
        if (target && target.verificationStatus !== 'verified_paid') {
          target.verificationStatus = outcome === 'failed' ? 'failed' : 'cancelled';
          target.updatedAtUtc = nowIso;
        }
        if (payment.userId && outcome === 'failed') {
          state.notifications.unshift({
            id: `ntf_${crypto.randomUUID()}`,
            userId: payment.userId,
            type: 'payment_failed',
            title: 'Payment Failed',
            message: `Your ₹${payment.amountInr} payment (${payment.receiptNumber}) did not succeed. No entitlement was granted.`,
            relatedBatchId: payment.relatedBatchId,
            read: false,
            createdAtUtc: nowIso,
          });
        }
      });
      res.json({
        status: outcome,
        payment: db.state.payments.find((p) => p.id === payment.id),
      });
      return;
    }

    // Issue cryptographically signed test gateway credentials to be verified by /api/payments/verify
    const providerPaymentId = `pay_test_${crypto.randomBytes(8).toString('hex')}`;
    const signature = crypto
      .createHmac('sha256', TEST_PAYMENT_HMAC_SECRET)
      .update(`${payment.providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    res.json({
      providerOrderId: payment.providerOrderId,
      providerPaymentId,
      providerSignature: signature,
    });
  });

  // Server-Side Cryptographic Payment Signature Verification
  app.post('/api/payments/verify', rateLimit(25, 60_000), (req, res) => {
    const viewer = extractAuthenticatedUser(req);
    const paymentId = cleanString(req.body?.paymentId, 128);
    const providerOrderId = cleanString(req.body?.providerOrderId, 128);
    const providerPaymentId = cleanString(req.body?.providerPaymentId, 128);
    const providerSignature = cleanString(req.body?.providerSignature, 256);
    const clientEntitlementKey = cleanString(req.body?.clientEntitlementKey, 128);

    const payment = db.state.payments.find((p) => p.id === paymentId);
    if (!payment) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }

    // Idempotent return if already verified
    if (payment.verificationStatus === 'verified_paid') {
      res.json({
        verified: true,
        payment,
        duplicatePrevented: true,
      });
      return;
    }

    if (!providerOrderId || !providerPaymentId || !providerSignature || providerOrderId !== payment.providerOrderId) {
      db.addAuditLog({
        actorUserId: viewer?.id || null,
        actorRole: viewer?.role || 'guest_consumer',
        action: 'FABRICATED_PAYMENT_REJECTED',
        targetType: 'payment',
        targetId: payment.id,
        outcome: 'denied',
        details: 'Missing or mismatched order/payment identifiers in verification call',
        ip: req.ip || 'unknown',
      });
      res.status(400).json({ error: 'Payment verification failed: invalid payment parameters.' });
      return;
    }

    const secretKey =
      payment.provider === 'razorpay_live'
        ? process.env.RAZORPAY_KEY_SECRET || ''
        : TEST_PAYMENT_HMAC_SECRET;

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(`${payment.providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    const sigBufA = Buffer.from(providerSignature);
    const sigBufB = Buffer.from(expectedSignature);
    const isValidSig =
      sigBufA.length === sigBufB.length && crypto.timingSafeEqual(sigBufA, sigBufB);

    if (!isValidSig) {
      db.transact((state) => {
        const p = state.payments.find((x) => x.id === payment.id);
        if (p) {
          p.verificationStatus = 'failed';
          p.updatedAtUtc = new Date().toISOString();
        }
      });
      db.addAuditLog({
        actorUserId: viewer?.id || null,
        actorRole: viewer?.role || 'guest_consumer',
        action: 'PAYMENT_SIGNATURE_INVALID',
        targetType: 'payment',
        targetId: payment.id,
        outcome: 'denied',
        details: 'Rejected fabricated or invalid HMAC-SHA256 payment signature',
        ip: req.ip || 'unknown',
      });
      res.status(400).json({
        error: 'Cryptographic payment signature verification failed. Entitlement was NOT unlocked.',
      });
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let unlockedSubscription: SubscriptionRecord | null = null;
    let unlockedScan: ConsumerScanRecord | null = null;

    db.transact((state) => {
      const targetPayment = state.payments.find((p) => p.id === payment.id)!;
      targetPayment.providerPaymentId = providerPaymentId;
      targetPayment.providerSignature = providerSignature;
      targetPayment.verificationStatus = 'verified_paid';
      targetPayment.updatedAtUtc = nowIso;

      if (targetPayment.purpose === 'farmer_subscription' && targetPayment.userId) {
        const renewalIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const existingSub = state.subscriptions.find((s) => s.farmerId === targetPayment.userId);
        if (existingSub) {
          existingSub.status = 'active';
          existingSub.startDateUtc = nowIso;
          existingSub.renewalDateUtc = renewalIso;
          existingSub.cancelledAtUtc = null;
          existingSub.paymentId = targetPayment.id;
          existingSub.amountInr = targetPayment.amountInr;
          targetPayment.relatedSubscriptionId = existingSub.id;
          unlockedSubscription = existingSub;
        } else {
          const newSub: SubscriptionRecord = {
            id: `sub_${crypto.randomUUID()}`,
            farmerId: targetPayment.userId,
            planId: 'farmer_monthly_inr_100',
            planName: 'Farmer Monthly Traceability Plan',
            amountInr: targetPayment.amountInr,
            currency: 'INR',
            status: 'active',
            startDateUtc: nowIso,
            renewalDateUtc: renewalIso,
            cancelledAtUtc: null,
            paymentId: targetPayment.id,
            providerSubscriptionRef: providerPaymentId,
          };
          state.subscriptions.push(newSub);
          targetPayment.relatedSubscriptionId = newSub.id;
          unlockedSubscription = newSub;
        }

        state.notifications.unshift({
          id: `ntf_${crypto.randomUUID()}`,
          userId: targetPayment.userId,
          type: 'payment_verified',
          title: 'Farmer Subscription Activated (₹100/month)',
          message: `Receipt ${targetPayment.receiptNumber} verified. Your subscription is active until ${renewalIso.slice(0, 10)}.`,
          relatedBatchId: null,
          read: false,
          createdAtUtc: nowIso,
        });
      } else if (targetPayment.purpose === 'consumer_scan' && targetPayment.relatedBatchId) {
        const batch = state.batches.find((b) => b.id === targetPayment.relatedBatchId);
        if (batch) {
          const entitlementKey =
            clientEntitlementKey || (viewer ? `usr_${viewer.id}` : `pay_${targetPayment.id}`);
          const existingScan = state.consumerScans.find(
            (s) => s.batchId === batch.id && s.clientEntitlementKey === entitlementKey
          );
          if (existingScan) {
            unlockedScan = existingScan;
          } else {
            const newScan: ConsumerScanRecord = {
              id: `scn_${crypto.randomUUID()}`,
              scanCode: `SCN-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
              batchId: batch.id,
              batchCode: batch.batchCode,
              produceName: batch.produceName,
              trackingToken: batch.trackingToken,
              consumerId: viewer?.id || targetPayment.userId,
              clientEntitlementKey: entitlementKey,
              paymentId: targetPayment.id,
              amountInr: targetPayment.amountInr,
              entitlementStatus: 'unlocked',
              createdAtUtc: nowIso,
            };
            state.consumerScans.unshift(newScan);
            unlockedScan = newScan;
          }

          if (targetPayment.userId) {
            state.notifications.unshift({
              id: `ntf_${crypto.randomUUID()}`,
              userId: targetPayment.userId,
              type: 'payment_verified',
              title: `Consumer Scan Unlocked — ${batch.batchCode}`,
              message: `₹${targetPayment.amountInr} scan payment verified (${targetPayment.receiptNumber}). Extended cold-chain & stage analytics unlocked.`,
              relatedBatchId: batch.id,
              read: false,
              createdAtUtc: nowIso,
            });
          }
        }
      }
    });

    db.addAuditLog({
      actorUserId: viewer?.id || null,
      actorRole: viewer?.role || 'guest_consumer',
      action: 'PAYMENT_VERIFIED_SERVER_SIDE',
      targetType: 'payment',
      targetId: payment.id,
      outcome: 'allowed',
      details: `Verified ₹${payment.amountInr} (${payment.purpose}) via ${payment.provider}`,
      ip: req.ip || 'unknown',
    });

    res.json({
      verified: true,
      payment: db.state.payments.find((p) => p.id === payment.id),
      subscription: unlockedSubscription,
      scanRecord: unlockedScan,
    });
  });

  // Razorpay Webhook Signature Verification Endpoint
  app.post('/api/payments/webhook', (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(503).json({
        error: 'RAZORPAY_WEBHOOK_SECRET is not configured on this server.',
      });
      return;
    }
    const signature = cleanString(req.headers['x-razorpay-signature'], 256);
    const payloadStr = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadStr)
      .digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(400).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const orderId = req.body?.payload?.payment?.entity?.order_id;
    const payId = req.body?.payload?.payment?.entity?.id;
    const status = req.body?.payload?.payment?.entity?.status;

    if (orderId && status === 'captured') {
      db.transact((state) => {
        const target = state.payments.find((p) => p.providerOrderId === orderId);
        if (target && target.verificationStatus !== 'verified_paid') {
          target.verificationStatus = 'verified_paid';
          target.providerPaymentId = payId || target.providerPaymentId;
          target.updatedAtUtc = new Date().toISOString();
        }
      });
    }
    res.json({ received: true });
  });

  app.get('/api/payments/receipt/:paymentId', (req, res) => {
    const viewer = extractAuthenticatedUser(req);
    const clientEntitlementKey = cleanString(req.headers['x-entitlement-key'], 128);
    const id = cleanString(req.params.paymentId, 128);
    const payment = db.state.payments.find((p) => p.id === id || p.receiptNumber === id);
    if (!payment) {
      res.status(404).json({ error: 'Receipt not found.' });
      return;
    }

    const matchingScan = db.state.consumerScans.find((s) => s.paymentId === payment.id);
    const isOwner =
      (viewer && (viewer.role === 'admin' || payment.userId === viewer.id)) ||
      (matchingScan &&
        clientEntitlementKey &&
        matchingScan.clientEntitlementKey === clientEntitlementKey);

    if (!isOwner && payment.userId !== null) {
      res.status(403).json({ error: 'You are not authorised to view this payment receipt.' });
      return;
    }

    res.json({ payment, scanRecord: matchingScan || null });
  });

  app.get('/api/consumer/scans', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const scans = db.state.consumerScans.filter((s) => s.consumerId === user.id);
    const payments = db.state.payments.filter((p) => p.userId === user.id);
    res.json({ scans, payments });
  });

  // ==========================================================================
  // 7. NOTIFICATIONS
  // ==========================================================================
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const items = db.state.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc));
    res.json({ notifications: items });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const id = cleanString(req.params.id, 128);
    db.transact((state) => {
      const target = state.notifications.find((n) => n.id === id && n.userId === user.id);
      if (target) target.read = true;
    });
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    db.transact((state) => {
      for (const n of state.notifications) {
        if (n.userId === user.id) n.read = true;
      }
    });
    res.json({ ok: true });
  });

  // ==========================================================================
  // 8. PROTECTED ADMINISTRATOR DASHBOARD API
  // ==========================================================================
  app.get('/api/admin/overview', requireRoles(['admin']), (_req, res) => {
    res.json({
      users: db.state.users.map(toPublicUser),
      batches: db.state.batches,
      subscriptions: db.state.subscriptions,
      payments: db.state.payments,
      consumerScans: db.state.consumerScans,
      freshnessParameters: db.state.freshnessParameters,
      auditLogs: db.state.auditLogs.slice(0, 200),
      pricing: db.state.pricing,
      systemHealth: {
        databaseStatus: 'Healthy (Persistent Atomic File Store)',
        totalUsers: db.state.users.length,
        totalBatches: db.state.batches.length,
        totalEvents: db.state.events.length,
        totalTransactions: db.state.transactions.length,
        livePaymentConfigured: isLiveRazorpayConfigured(),
        geocodingConfigured: Boolean(process.env.GEOCODING_API_KEY),
        webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      },
    });
  });

  app.patch('/api/admin/users/:userId', requireRoles(['admin']), (req: AuthedRequest, res) => {
    const admin = req.user!;
    const targetId = cleanString(req.params.userId, 128);
    const newRole = cleanString(req.body?.role, 32) as UserRole | '';
    const newStatus = cleanString(req.body?.accountStatus, 24) as
      | 'active'
      | 'suspended'
      | '';

    const target = db.state.users.find((u) => u.id === targetId);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (newRole) {
      db.updateUserRole(target.id, newRole);
    }
    if (newStatus) {
      db.updateUserStatus(target.id, newStatus);
    }

    db.addAuditLog({
      actorUserId: admin.id,
      actorRole: 'admin',
      action: 'ADMIN_USER_UPDATED',
      targetType: 'user',
      targetId: target.id,
      outcome: 'allowed',
      details: `Updated user ${target.publicCode} (role=${newRole || target.role}, status=${newStatus || target.accountStatus})`,
      ip: req.ip || 'unknown',
    });

    res.json({ user: toPublicUser(db.state.users.find((u) => u.id === targetId)!) });
  });

  app.put(
    '/api/admin/freshness-parameters/:paramId',
    requireRoles(['admin']),
    (req: AuthedRequest, res) => {
      const admin = req.user!;
      const paramId = cleanString(req.params.paramId, 64);
      const param = db.state.freshnessParameters.find((p) => p.id === paramId);
      if (!param) {
        res.status(404).json({ error: 'Freshness parameter record not found.' });
        return;
      }

      const ambientMinDays = Number(req.body?.ambientMinDays);
      const ambientMaxDays = Number(req.body?.ambientMaxDays);
      const coldMinDays = Number(req.body?.coldMinDays);
      const coldMaxDays = Number(req.body?.coldMaxDays);
      const optimalTempMinC = Number(req.body?.optimalTempMinC);
      const optimalTempMaxC = Number(req.body?.optimalTempMaxC);
      const storageAssumptions = cleanString(req.body?.storageAssumptions, 400);

      if (
        !Number.isFinite(ambientMinDays) ||
        !Number.isFinite(ambientMaxDays) ||
        ambientMinDays <= 0 ||
        ambientMaxDays < ambientMinDays
      ) {
        res.status(400).json({ error: 'Invalid ambient shelf-life day range.' });
        return;
      }

      db.transact((state) => {
        const p = state.freshnessParameters.find((x) => x.id === paramId);
        if (!p) return;
        p.ambientMinDays = ambientMinDays;
        p.ambientMaxDays = ambientMaxDays;
        if (Number.isFinite(coldMinDays) && coldMinDays > 0) p.coldMinDays = coldMinDays;
        if (Number.isFinite(coldMaxDays) && coldMaxDays >= p.coldMinDays) p.coldMaxDays = coldMaxDays;
        if (Number.isFinite(optimalTempMinC)) p.optimalTempMinC = optimalTempMinC;
        if (Number.isFinite(optimalTempMaxC)) p.optimalTempMaxC = optimalTempMaxC;
        if (storageAssumptions) p.storageAssumptions = storageAssumptions;
        p.updatedAtUtc = new Date().toISOString();
      });

      db.addAuditLog({
        actorUserId: admin.id,
        actorRole: 'admin',
        action: 'ADMIN_FRESHNESS_PARAM_UPDATED',
        targetType: 'freshness_parameter',
        targetId: paramId,
        outcome: 'allowed',
        details: `Updated shelf-life assumptions for ${param.category}`,
        ip: req.ip || 'unknown',
      });

      res.json({ parameters: db.state.freshnessParameters });
    }
  );

  app.put('/api/admin/pricing', requireRoles(['admin']), (req: AuthedRequest, res) => {
    const admin = req.user!;
    const farmerMonthlyPriceInr = Number(req.body?.farmerMonthlyPriceInr);
    const consumerScanFeeInr = Number(req.body?.consumerScanFeeInr);
    if (
      !Number.isFinite(farmerMonthlyPriceInr) ||
      farmerMonthlyPriceInr < 1 ||
      !Number.isFinite(consumerScanFeeInr) ||
      consumerScanFeeInr < 1
    ) {
      res.status(400).json({ error: 'Valid positive INR plan amounts are required.' });
      return;
    }

    db.transact((state) => {
      state.pricing.farmerMonthlyPriceInr = Math.round(farmerMonthlyPriceInr);
      state.pricing.consumerScanFeeInr = Math.round(consumerScanFeeInr);
      state.pricing.updatedAtUtc = new Date().toISOString();
    });

    db.addAuditLog({
      actorUserId: admin.id,
      actorRole: 'admin',
      action: 'ADMIN_PRICING_UPDATED',
      targetType: 'pricing',
      targetId: 'global_pricing',
      outcome: 'allowed',
      details: `Set Farmer plan ₹${farmerMonthlyPriceInr}/mo, Consumer scan ₹${consumerScanFeeInr}`,
      ip: req.ip || 'unknown',
    });

    res.json({ pricing: db.state.pricing });
  });

  // Catch-all for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // ==========================================================================
  // 9. VITE MIDDLEWARE (DEVELOPMENT) OR STATIC DIST (PRODUCTION)
  // ==========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TraceRoots server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
