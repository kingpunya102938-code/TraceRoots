import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_FRESHNESS_PARAMETERS,
} from '../src/shared/freshness.ts';
import type {
  AccountStatus,
  AuditLogEntry,
  BatchStatus,
  ConsentRecords,
  ConsumerScanRecord,
  FinancialTransaction,
  FreshnessParameter,
  NotificationItem,
  PaymentRecord,
  PricingConfiguration,
  ProduceBatch,
  PublicUserProfile,
  SubscriptionRecord,
  TrackingEvent,
  UserRole,
} from '../src/shared/types.ts';

export interface StoredUser extends PublicUserProfile {
  passwordHash: string;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
  expiresAtUtc: string;
  used: boolean;
  createdAtUtc: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  batches: ProduceBatch[];
  events: TrackingEvent[];
  transactions: FinancialTransaction[];
  subscriptions: SubscriptionRecord[];
  consumerScans: ConsumerScanRecord[];
  payments: PaymentRecord[];
  freshnessParameters: FreshnessParameter[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
  passwordResets: PasswordResetRecord[];
  pricing: PricingConfiguration;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'traceroots-db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const [, salt, hashHex] = parts;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateBatchCode(existingCodes: Set<string>): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 25; attempt++) {
    const bytes = crypto.randomBytes(8);
    let suffix = '';
    for (let i = 0; i < 8; i++) {
      suffix += alphabet[bytes[i] % alphabet.length];
    }
    const candidate = `FT-${year}-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `FT-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function generateSecureTrackingToken(existingTokens: Set<string>): string {
  for (let attempt = 0; attempt < 25; attempt++) {
    const token = crypto.randomBytes(24).toString('base64url');
    if (!existingTokens.has(token)) {
      return token;
    }
  }
  return crypto.randomBytes(32).toString('base64url');
}

export function toPublicUser(user: StoredUser): PublicUserProfile {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}

function createInitialSeedDatabase(): DatabaseSchema {
  const now = new Date();
  const isoNow = now.toISOString();
  const harvestTime = new Date(now.getTime() - 38 * 60 * 60 * 1000); // 38 hours ago
  const transportPickup = new Date(now.getTime() - 34 * 60 * 60 * 1000);
  const wholesalerArr = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const wholesalerDep = new Date(now.getTime() - 16 * 60 * 60 * 1000);
  const retailerArr = new Date(now.getTime() - 10 * 60 * 60 * 1000);

  const harvest2Time = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18 hours ago

  const demoConsent: ConsentRecords = {
    termsAcceptedAt: isoNow,
    privacyAcceptedAt: isoNow,
    publicFarmNameConsent: true,
    locationConsent: true,
  };

  const demoPasswordHash = hashPassword('Demo@1234');

  const farmerUser: StoredUser = {
    id: 'usr_demo_farmer_1',
    publicCode: 'FRM-2026-101',
    fullName: 'Rajesh Patil',
    mobile: '+91 98230 44110',
    email: 'farmer@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'farmer',
    businessName: 'Sahyadri Green Valley Farms',
    address: 'Plot 14, Niphad Taluka, Nashik, Maharashtra 422303',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  const wholesalerUser: StoredUser = {
    id: 'usr_demo_wholesaler_1',
    publicCode: 'WHL-2026-201',
    fullName: 'Vikram Deshmukh',
    mobile: '+91 98220 77812',
    email: 'wholesaler@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'wholesaler',
    businessName: 'Deccan Fresh APMC Mandi Traders',
    address: 'Gala 42, Market Yard, Gultekdi, Pune, Maharashtra 411037',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  const retailerUser: StoredUser = {
    id: 'usr_demo_retailer_1',
    publicCode: 'RTL-2026-301',
    fullName: 'Ananya Kulkarni',
    mobile: '+91 97654 11908',
    email: 'retailer@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'retailer',
    businessName: 'GreenBasket Neighbourhood Mart',
    address: 'Shop 7, Baner High Street, Pune, Maharashtra 411045',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  const transporterUser: StoredUser = {
    id: 'usr_demo_transporter_1',
    publicCode: 'TRN-2026-401',
    fullName: 'Suresh Jadhav',
    mobile: '+91 98901 55231',
    email: 'transporter@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'transporter',
    businessName: 'KisanCool Reefer Logistics',
    address: 'NH-60 Logistics Park, Sinnar, Nashik, Maharashtra 422103',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  const partnerUser: StoredUser = {
    id: 'usr_demo_partner_1',
    publicCode: 'PRT-2026-501',
    fullName: 'Meera Nair',
    mobile: '+91 98450 66219',
    email: 'partner@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'partner',
    businessName: 'AgriCold Packhouse & Grading Hub',
    address: 'MIDC Cold Storage Zone, Chakan, Pune, Maharashtra 410501',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  const consumerUser: StoredUser = {
    id: 'usr_demo_consumer_1',
    publicCode: 'CNS-2026-601',
    fullName: 'Priya Sharma',
    mobile: '+91 98112 30944',
    email: 'consumer@demo.traceroots.in',
    passwordHash: demoPasswordHash,
    role: 'consumer',
    businessName: '',
    address: 'Aundh, Pune, Maharashtra 411007',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: ['tr_demo_roma_tomatoes_8492k9m2x7q4p1n8'],
    isDemo: true,
  };

  const adminBootstrapEmail =
    process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@demo.traceroots.in';
  const adminUser: StoredUser = {
    id: 'usr_demo_admin_1',
    publicCode: 'ADM-2026-001',
    fullName: 'kavita Rao (Platform Admin)',
    mobile: '+91 90000 10001',
    email: adminBootstrapEmail.toLowerCase(),
    passwordHash: demoPasswordHash,
    role: 'admin',
    businessName: 'TraceRoots Governance & Trust Ops',
    address: 'Bengaluru, Karnataka 560001',
    accountStatus: 'active',
    createdAt: isoNow,
    consentRecords: demoConsent,
    savedBatchTokens: [],
    isDemo: true,
  };

  // Active subscription for Demo Farmer
  const subPaymentId = 'pay_demo_sub_001';
  const subStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const subRenew = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();

  const demoSubscription: SubscriptionRecord = {
    id: 'sub_demo_farmer_1',
    farmerId: farmerUser.id,
    planId: 'farmer_monthly_inr_100',
    planName: 'Farmer Monthly Traceability Plan',
    amountInr: 100,
    currency: 'INR',
    status: 'active',
    startDateUtc: subStart,
    renewalDateUtc: subRenew,
    cancelledAtUtc: null,
    paymentId: subPaymentId,
    providerSubscriptionRef: 'sub_test_demo_001',
  };

  const demoSubPayment: PaymentRecord = {
    id: subPaymentId,
    receiptNumber: 'RCP-2026-100421',
    userId: farmerUser.id,
    purpose: 'farmer_subscription',
    relatedBatchId: null,
    relatedBatchCode: null,
    relatedSubscriptionId: demoSubscription.id,
    amountInr: 100,
    currency: 'INR',
    provider: 'razorpay_test_sandbox',
    providerOrderId: 'order_test_demosub001',
    providerPaymentId: 'pay_test_demosub001',
    providerSignature: 'demo_seeded_signature',
    verificationStatus: 'verified_paid',
    idempotencyKey: 'idem_demo_sub_1',
    createdAtUtc: subStart,
    updatedAtUtc: subStart,
  };

  // Demo Batch 1: Complete Farmer -> Transporter -> Wholesaler -> Retailer chain
  const batch1: ProduceBatch = {
    id: 'bat_demo_1',
    batchCode: 'FT-2026-DEMO8492',
    trackingToken: 'tr_demo_roma_tomatoes_8492k9m2x7q4p1n8',
    idempotencyKey: 'idem_demo_batch_1',
    farmerId: farmerUser.id,
    farmerName: farmerUser.fullName,
    farmName: farmerUser.businessName,
    farmerPublicId: farmerUser.publicCode,
    farmerContact: farmerUser.mobile,
    farmLocation: 'Niphad Taluka, Nashik, Maharashtra',
    showFarmerNamePublicly: true,
    produceName: 'Vine-Ripened Roma Tomatoes',
    category: 'Tomatoes & Fruit Vegetables',
    variety: 'Sahyadri Hybrid F1',
    quantity: 450,
    unit: 'kg',
    harvestDate: harvestTime.toISOString().slice(0, 10),
    harvestTime: harvestTime.toISOString().slice(11, 16),
    harvestTimestampUtc: harvestTime.toISOString(),
    expectedShelfLifeDays: 12,
    storageMethod: 'ventilated_crate',
    batchDescription:
      'DEMO BATCH: Hand-picked firm red Roma tomatoes sorted into clean 20 kg ventilated plastic crates immediately after morning harvest.',
    qualityNotes: 'Uniform Grade-A size, zero pest blemish, precooled in shade.',
    departureLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
    departureLocationProvenance: 'manual_entry',
    departureCoordinates: { lat: 20.0784, lng: 74.1098 },
    departureDate: harvestTime.toISOString().slice(0, 10),
    departureTime: transportPickup.toISOString().slice(11, 16),
    destination: 'Deccan Fresh APMC Mandi, Pune',
    transportMethod: 'Refrigerated Light Commercial Truck',
    vehicleDetails: 'MH-15-JC-4821 (KisanCool Reefer)',
    createdAtUtc: harvestTime.toISOString(),
    currentStatus: 'At Retailer',
    isDemo: true,
  };

  // Demo Batch 2: Fresh Spinach currently in transit to Wholesaler
  const batch2: ProduceBatch = {
    id: 'bat_demo_2',
    batchCode: 'FT-2026-DEMO3910',
    trackingToken: 'tr_demo_organic_spinach_3910p4w8z2m6v5r3',
    idempotencyKey: 'idem_demo_batch_2',
    farmerId: farmerUser.id,
    farmerName: farmerUser.fullName,
    farmName: farmerUser.businessName,
    farmerPublicId: farmerUser.publicCode,
    farmerContact: farmerUser.mobile,
    farmLocation: 'Niphad Taluka, Nashik, Maharashtra',
    showFarmerNamePublicly: true,
    produceName: 'Tender Organic Spinach (Palak)',
    category: 'Leafy Vegetables',
    variety: 'All-GreenNashik',
    quantity: 120,
    unit: 'kg',
    harvestDate: harvest2Time.toISOString().slice(0, 10),
    harvestTime: harvest2Time.toISOString().slice(11, 16),
    harvestTimestampUtc: harvest2Time.toISOString(),
    expectedShelfLifeDays: 6,
    storageMethod: 'cold_storage',
    batchDescription:
      'DEMO BATCH: Hydro-cooled tender spinach bunches packed in breathable cold-chain liners.',
    qualityNotes: 'Washed in potable farm water and chilled to 4°C before dispatch.',
    departureLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
    departureLocationProvenance: 'manual_entry',
    departureCoordinates: { lat: 20.0784, lng: 74.1098 },
    departureDate: harvest2Time.toISOString().slice(0, 10),
    departureTime: harvest2Time.toISOString().slice(11, 16),
    destination: 'Pune Cold Hub & Wholesalers',
    transportMethod: 'Insulated Cold Van',
    vehicleDetails: 'MH-15-EF-9012',
    createdAtUtc: harvest2Time.toISOString(),
    currentStatus: 'In Transit',
    isDemo: true,
  };

  const txnWholesaler: FinancialTransaction = {
    id: 'txn_demo_1',
    referenceCode: 'TXN-2026-8801',
    batchId: batch1.id,
    batchCode: batch1.batchCode,
    produceName: batch1.produceName,
    relatedEventId: 'evt_demo_3',
    participantId: wholesalerUser.id,
    participantRole: 'wholesaler',
    participantName: wholesalerUser.fullName,
    participantBusiness: wholesalerUser.businessName,
    quantity: 450,
    unit: 'kg',
    purchasePricePerUnit: 24,
    totalPurchasePrice: 10800,
    sellingPricePerUnit: 31,
    expectedTotalSellingValue: 13950,
    currency: 'INR',
    createdAtUtc: wholesalerArr.toISOString(),
  };

  const txnRetailer: FinancialTransaction = {
    id: 'txn_demo_2',
    referenceCode: 'TXN-2026-8802',
    batchId: batch1.id,
    batchCode: batch1.batchCode,
    produceName: batch1.produceName,
    relatedEventId: 'evt_demo_4',
    participantId: retailerUser.id,
    participantRole: 'retailer',
    participantName: retailerUser.fullName,
    participantBusiness: retailerUser.businessName,
    quantity: 200,
    unit: 'kg',
    purchasePricePerUnit: 31,
    totalPurchasePrice: 6200,
    sellingPricePerUnit: 42,
    expectedTotalSellingValue: 8400,
    currency: 'INR',
    createdAtUtc: retailerArr.toISOString(),
  };

  const events: TrackingEvent[] = [
    {
      id: 'evt_demo_1',
      batchId: batch1.id,
      sequenceNumber: 1,
      participantId: farmerUser.id,
      participantRole: 'farmer',
      participantName: farmerUser.fullName,
      participantBusiness: farmerUser.businessName,
      eventType: 'Harvested & Registered',
      arrivalLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
      arrivalLocationProvenance: 'manual_entry',
      arrivalTimestamp: harvestTime.toISOString(),
      departureLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
      departureLocationProvenance: 'manual_entry',
      departureTimestamp: transportPickup.toISOString(),
      storageMethod: 'ventilated_crate',
      storageTemperatureC: 14,
      refrigerationInterrupted: false,
      produceCondition: 'Excellent',
      transportMethod: 'Refrigerated Light Commercial Truck',
      vehicleDetails: 'MH-15-JC-4821',
      destinationParticipant: 'Deccan Fresh APMC Mandi Traders',
      notes: 'DEMO RECORD: Morning harvest sorted into 22 crates and precooled prior to loading.',
      transactionId: null,
      transactionRefCode: null,
      correctionOfEventId: null,
      correctionReason: null,
      verificationStatus: 'Submitted by registered participant',
      serverCreatedAtUtc: harvestTime.toISOString(),
      idempotencyKey: 'idem_evt_demo_1',
    },
    {
      id: 'evt_demo_2',
      batchId: batch1.id,
      sequenceNumber: 2,
      participantId: transporterUser.id,
      participantRole: 'transporter',
      participantName: transporterUser.fullName,
      participantBusiness: transporterUser.businessName,
      eventType: 'Picked Up by Transporter',
      arrivalLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
      arrivalLocationProvenance: 'manual_entry',
      arrivalTimestamp: transportPickup.toISOString(),
      departureLocation: 'Gultekdi APMC Market Yard, Pune',
      departureLocationProvenance: 'manual_entry',
      departureTimestamp: wholesalerArr.toISOString(),
      storageMethod: 'refrigerated_transport',
      storageTemperatureC: 11.5,
      refrigerationInterrupted: false,
      produceCondition: 'Excellent',
      transportMethod: 'Reefer Truck (NH-60 Nashik–Pune Corridor)',
      vehicleDetails: 'MH-15-JC-4821',
      destinationParticipant: 'Deccan Fresh APMC Mandi Traders',
      notes: 'DEMO RECORD: Reefer setpoint maintained at 11.5°C throughout 215 km transit.',
      transactionId: null,
      transactionRefCode: null,
      correctionOfEventId: null,
      correctionReason: null,
      verificationStatus: 'Submitted by registered participant',
      serverCreatedAtUtc: transportPickup.toISOString(),
      idempotencyKey: 'idem_evt_demo_2',
    },
    {
      id: 'evt_demo_3',
      batchId: batch1.id,
      sequenceNumber: 3,
      participantId: wholesalerUser.id,
      participantRole: 'wholesaler',
      participantName: wholesalerUser.fullName,
      participantBusiness: wholesalerUser.businessName,
      eventType: 'Wholesaler Received',
      arrivalLocation: 'Gala 42, Gultekdi APMC Market Yard, Pune',
      arrivalLocationProvenance: 'manual_entry',
      arrivalTimestamp: wholesalerArr.toISOString(),
      departureLocation: 'Gala 42, Gultekdi APMC Market Yard, Pune',
      departureLocationProvenance: 'manual_entry',
      departureTimestamp: wholesalerDep.toISOString(),
      storageMethod: 'cold_storage',
      storageTemperatureC: 12,
      refrigerationInterrupted: false,
      produceCondition: 'Excellent',
      transportMethod: 'City Insulated Delivery Van',
      vehicleDetails: 'MH-12-TR-7731',
      destinationParticipant: 'GreenBasket Neighbourhood Mart',
      notes: 'DEMO RECORD: Inspected crates on arrival; zero transit bruising. Stored in cool chamber.',
      transactionId: txnWholesaler.id,
      transactionRefCode: txnWholesaler.referenceCode,
      correctionOfEventId: null,
      correctionReason: null,
      verificationStatus: 'Submitted by registered participant',
      serverCreatedAtUtc: wholesalerArr.toISOString(),
      idempotencyKey: 'idem_evt_demo_3',
    },
    {
      id: 'evt_demo_4',
      batchId: batch1.id,
      sequenceNumber: 4,
      participantId: retailerUser.id,
      participantRole: 'retailer',
      participantName: retailerUser.fullName,
      participantBusiness: retailerUser.businessName,
      eventType: 'Retailer Received',
      arrivalLocation: 'GreenBasket Mart, Baner High Street, Pune',
      arrivalLocationProvenance: 'manual_entry',
      arrivalTimestamp: retailerArr.toISOString(),
      departureLocation: '',
      departureLocationProvenance: 'not_recorded',
      departureTimestamp: '',
      storageMethod: 'cold_storage',
      storageTemperatureC: 12.5,
      refrigerationInterrupted: false,
      produceCondition: 'Good',
      transportMethod: 'Retail Chill Display',
      vehicleDetails: '',
      destinationParticipant: 'Walk-in Retail Consumers',
      notes: 'DEMO RECORD: 200 kg sub-lot stocked on chilled produce aisle with QR shelf talker.',
      transactionId: txnRetailer.id,
      transactionRefCode: txnRetailer.referenceCode,
      correctionOfEventId: null,
      correctionReason: null,
      verificationStatus: 'Submitted by registered participant',
      serverCreatedAtUtc: retailerArr.toISOString(),
      idempotencyKey: 'idem_evt_demo_4',
    },
    {
      id: 'evt_demo_5',
      batchId: batch2.id,
      sequenceNumber: 1,
      participantId: farmerUser.id,
      participantRole: 'farmer',
      participantName: farmerUser.fullName,
      participantBusiness: farmerUser.businessName,
      eventType: 'Harvested & Registered',
      arrivalLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
      arrivalLocationProvenance: 'manual_entry',
      arrivalTimestamp: harvest2Time.toISOString(),
      departureLocation: 'Sahyadri Green Valley Farms, Niphad, Nashik',
      departureLocationProvenance: 'manual_entry',
      departureTimestamp: harvest2Time.toISOString(),
      storageMethod: 'cold_storage',
      storageTemperatureC: 4,
      refrigerationInterrupted: false,
      produceCondition: 'Excellent',
      transportMethod: 'Insulated Cold Van',
      vehicleDetails: 'MH-15-EF-9012',
      destinationParticipant: 'Deccan Fresh APMC Mandi Traders',
      notes: 'DEMO RECORD: Hydro-cooled spinach bunches dispatched in 4°C cold van.',
      transactionId: null,
      transactionRefCode: null,
      correctionOfEventId: null,
      correctionReason: null,
      verificationStatus: 'Submitted by registered participant',
      serverCreatedAtUtc: harvest2Time.toISOString(),
      idempotencyKey: 'idem_evt_demo_5',
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'ntf_demo_1',
      userId: farmerUser.id,
      type: 'wholesaler_received',
      title: 'Wholesaler Received Demo Batch FT-2026-DEMO8492',
      message:
        'Deccan Fresh APMC Mandi Traders logged arrival and purchase record (₹24/kg) for Vine-Ripened Roma Tomatoes.',
      relatedBatchId: batch1.id,
      read: false,
      createdAtUtc: wholesalerArr.toISOString(),
    },
    {
      id: 'ntf_demo_2',
      userId: farmerUser.id,
      type: 'retailer_received',
      title: 'Retailer Stocked Demo Batch FT-2026-DEMO8492',
      message:
        'GreenBasket Neighbourhood Mart received 200 kg in Baner, Pune and placed QR labels on display.',
      relatedBatchId: batch1.id,
      read: false,
      createdAtUtc: retailerArr.toISOString(),
    },
  ];

  return {
    users: [
      farmerUser,
      wholesalerUser,
      retailerUser,
      transporterUser,
      partnerUser,
      consumerUser,
      adminUser,
    ],
    batches: [batch1, batch2],
    events,
    transactions: [txnWholesaler, txnRetailer],
    subscriptions: [demoSubscription],
    consumerScans: [],
    payments: [demoSubPayment],
    freshnessParameters: structuredClone(DEFAULT_FRESHNESS_PARAMETERS),
    notifications,
    auditLogs: [
      {
        id: 'aud_seed_1',
        actorUserId: null,
        actorRole: 'system',
        action: 'DATABASE_SEED_DEMO_RECORDS',
        targetType: 'system',
        targetId: 'traceroots_init',
        outcome: 'allowed',
        details: 'Initialized clearly labeled [DEMO DATA] accounts and batches.',
        ipHash: 'system',
        createdAtUtc: isoNow,
      },
    ],
    passwordResets: [],
    pricing: {
      farmerMonthlyPriceInr: 100,
      consumerScanFeeInr: 10,
      currency: 'INR',
      wholesalerFeeInr: 0,
      retailerFeeInr: 0,
      transporterFeeInr: 0,
      updatedAtUtc: isoNow,
    },
  };
}

class TraceRootsDatabase {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw) as DatabaseSchema;
      } catch {
        this.data = createInitialSeedDatabase();
        this.persist();
      }
    } else {
      this.data = createInitialSeedDatabase();
      this.persist();
    }
  }

  public persist(): void {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public get state(): DatabaseSchema {
    return this.data;
  }

  public transact<T>(fn: (state: DatabaseSchema) => T): T {
    const snapshot = JSON.stringify(this.data);
    try {
      const result = fn(this.data);
      this.persist();
      return result;
    } catch (err) {
      this.data = JSON.parse(snapshot) as DatabaseSchema;
      throw err;
    }
  }

  public addAuditLog(entry: {
    actorUserId: string | null;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    outcome: 'allowed' | 'denied' | 'error';
    details: string;
    ip: string;
  }): void {
    const ipHash = crypto
      .createHash('sha256')
      .update(entry.ip || 'unknown')
      .digest('hex')
      .slice(0, 16);

    this.data.auditLogs.unshift({
      id: `aud_${crypto.randomUUID()}`,
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      outcome: entry.outcome,
      details: entry.details,
      ipHash,
      createdAtUtc: new Date().toISOString(),
    });

    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.length = 1000;
    }
    this.persist();
  }

  public addNotification(item: {
    userId: string;
    type: NotificationItem['type'];
    title: string;
    message: string;
    relatedBatchId: string | null;
  }): void {
    this.data.notifications.unshift({
      id: `ntf_${crypto.randomUUID()}`,
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      relatedBatchId: item.relatedBatchId,
      read: false,
      createdAtUtc: new Date().toISOString(),
    });
  }

  public getAndRefreshFarmerSubscription(farmerId: string): SubscriptionRecord | null {
    const sub = this.data.subscriptions.find((s) => s.farmerId === farmerId) || null;
    if (!sub) return null;
    if (sub.status === 'active' && Date.parse(sub.renewalDateUtc) < Date.now()) {
      sub.status = 'expired';
      this.addNotification({
        userId: farmerId,
        type: 'subscription_alert',
        title: 'Monthly Subscription Expired',
        message:
          'Your ₹100/month TraceRoots farmer subscription has expired. Existing QR codes remain active, and you can renew anytime to register new batches.',
        relatedBatchId: null,
      });
      this.persist();
    }
    return sub;
  }

  public computeBatchStatusFromEvent(
    eventType: TrackingEvent['eventType'],
    currentStatus: BatchStatus
  ): BatchStatus {
    switch (eventType) {
      case 'Harvested & Registered':
        return 'Registered';
      case 'Picked Up by Transporter':
        return 'In Transit';
      case 'Delivered by Transporter':
        return 'In Transit';
      case 'Wholesaler Received':
        return 'At Wholesaler';
      case 'Wholesaler Dispatched':
        return 'Dispatched by Wholesaler';
      case 'Retailer Received':
        return 'At Retailer';
      case 'Retailer Dispatched':
        return 'Delivered / Consumer Ready';
      case 'Partner Handoff':
        return 'At Partner Hub';
      case 'Correction Record':
        return currentStatus;
      default:
        return currentStatus;
    }
  }

  public updateUserStatus(userId: string, status: AccountStatus): StoredUser | null {
    const u = this.data.users.find((x) => x.id === userId);
    if (!u) return null;
    u.accountStatus = status;
    this.persist();
    return u;
  }

  public updateUserRole(userId: string, role: UserRole): StoredUser | null {
    const u = this.data.users.find((x) => x.id === userId);
    if (!u) return null;
    u.role = role;
    this.persist();
    return u;
  }
}

export const db = new TraceRootsDatabase();
