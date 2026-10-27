import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  QrCode,
  Search,
  ShoppingBag,
  Sprout,
  Store,
  Truck,
  Upload,
  Users,
} from 'lucide-react';
import { SupplyChainHeroArtwork } from '../components/BrandLogo';
import { PublicLayout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  compressImageFileToDataUrl,
  getDashboardPathForRole,
} from '../lib/api';
import type { UserRole } from '../shared/types';

export interface RoleCardMeta {
  role: UserRole;
  title: string;
  description: string;
  surfaceClass: string;
  accentTextClass: string;
  buttonLabel: string;
  Icon: React.FC<{ className?: string }>;
}

export const ROLE_CARDS: RoleCardMeta[] = [
  {
    role: 'farmer',
    title: 'Farmer',
    description:
      'Register harvested produce batches, generate printable QR labels, track full journeys, and view complete multi-stage price history.',
    surfaceClass: 'bg-[#F1FAF0] border-[#8BCF5B]',
    accentTextClass: 'text-[#1D6F34]',
    buttonLabel: 'Continue as Farmer',
    Icon: Sprout,
  },
  {
    role: 'wholesaler',
    title: 'Wholesaler',
    description:
      'Scan incoming farm QR codes, log APMC/mandi arrival & dispatch times, record confidential purchase/sales prices, and log cold storage.',
    surfaceClass: 'bg-[#EFF8FF] border-[#45B8E8]',
    accentTextClass: 'text-[#0369A1]',
    buttonLabel: 'Continue as Wholesaler',
    Icon: Building2,
  },
  {
    role: 'retailer',
    title: 'Retailer',
    description:
      'Verify upstream batch origin on delivery, record retail receipt, track shop inventory, and display scannable QR codes for shoppers.',
    surfaceClass: 'bg-[#FFFBEB] border-[#FFD166]',
    accentTextClass: 'text-[#92400E]',
    buttonLabel: 'Continue as Retailer',
    Icon: Store,
  },
  {
    role: 'consumer',
    title: 'Consumer',
    description:
      'Scan produce QR codes to inspect farm origin, chronological stops, and freshness estimates, or unlock ₹10 deep cold-chain analytics.',
    surfaceClass: 'bg-[#FFF7ED] border-[#FFAD66]',
    accentTextClass: 'text-[#9A3412]',
    buttonLabel: 'Continue as Consumer',
    Icon: ShoppingBag,
  },
  {
    role: 'transporter',
    title: 'Transporter',
    description:
      'Log farm pickup and market delivery timestamps, vehicle details, reefer temperatures, and transit handling conditions.',
    surfaceClass: 'bg-[#EFF8FF] border-[#93C5FD]',
    accentTextClass: 'text-[#1D4ED8]',
    buttonLabel: 'Continue as Transporter',
    Icon: Truck,
  },
  {
    role: 'partner',
    title: 'Other / Supply Chain Partner',
    description:
      'Record packhouse grading, cold-storage chamber transfers, or cooperative aggregation handoffs in the shared batch ledger.',
    surfaceClass: 'bg-[#F1FAF0] border-[#BBF7D0]',
    accentTextClass: 'text-[#166534]',
    buttonLabel: 'Continue as Partner',
    Icon: Users,
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lookupInput, setLookupInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const handleQuickLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    if (!lookupInput.trim()) return;
    setLookingUp(true);
    try {
      const res = await apiRequest<{ trackingToken: string }>(
        `/api/public/resolve/${encodeURIComponent(lookupInput.trim())}`
      );
      navigate(`/track/${res.trackingToken}`);
    } catch {
      navigate(`/invalid-qr?q=${encodeURIComponent(lookupInput.trim())}`);
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#F1FAF0] to-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-sm font-semibold text-[#1D6F34]">
                Welcome to TraceRoots — Track Produce. Build Trust.
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#18261E] headline-balance leading-[1.12] font-display">
                From Farm to Fork, Every Step Tracked.
              </h1>
              <p className="text-base sm:text-lg text-[#4B5563] leading-relaxed max-w-xl">
                Connect farmers, transporters, wholesalers, retailers, and consumers through
                cryptographically unique QR batch codes, chronological handoff histories, and
                transparent crop freshness estimates.
              </p>

              {/* Primary CTA + QR Scanner Action */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={user ? getDashboardPathForRole(user.role) : '/roles'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <span>{user ? 'Open My Role Dashboard' : 'Select Your Role & Start'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/scan"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F1FAF0] text-[#18261E] text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <QrCode className="w-4 h-4 text-[#36A853]" />
                  <span>Scan Produce QR</span>
                </Link>
              </div>

              {/* Instant Batch / Token Lookup */}
              <form
                onSubmit={handleQuickLookup}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-3 flex flex-col sm:flex-row gap-2 max-w-xl"
              >
                <div className="flex-1 flex items-center gap-2 px-2">
                  <Search className="w-4 h-4 text-[#6B7280] shrink-0" />
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Enter Batch ID (e.g. FT-2026-DEMO8492) or Tracking URL"
                    className="w-full text-sm text-[#18261E] placeholder:text-[#9CA3AF] focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookingUp}
                  className="px-4 py-2 rounded-xl bg-[#18261E] hover:bg-[#283E31] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {lookingUp ? 'Searching...' : 'Trace Batch'}
                </button>
              </form>
              {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}

              <div className="text-xs text-[#4B5563]">
                Try the clearly labeled demo batch:{' '}
                <Link
                  to="/track/tr_demo_roma_tomatoes_8492k9m2x7q4p1n8"
                  className="font-mono font-semibold text-[#1D6F34] underline underline-offset-2"
                >
                  FT-2026-DEMO8492 (Vine-Ripened Roma Tomatoes)
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <SupplyChainHeroArtwork />
            </div>
          </div>
        </div>
      </section>

      {/* "Who are you?" Role Selection Section */}
      <section className="py-16 lg:py-20 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-sm font-semibold text-[#36A853]">Role-Based Supply Chain Access</p>
            <h2 className="text-3xl font-bold text-[#18261E] font-display">Who are you?</h2>
            <p className="text-sm sm:text-base text-[#4B5563]">
              Choose your role in the agricultural supply chain to register a new account or sign
              in to your dedicated workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ROLE_CARDS.map((card) => {
              const Icon = card.Icon;
              return (
                <div
                  key={card.role}
                  className={`rounded-2xl border p-6 flex flex-col justify-between ${card.surfaceClass} transition-transform hover:-translate-y-0.5`}
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${card.accentTextClass}`} />
                    </div>
                    <h3 className="text-xl font-bold text-[#18261E] font-display">{card.title}</h3>
                    <p className="text-sm text-[#374151] leading-relaxed">{card.description}</p>
                  </div>
                  <div className="pt-6 flex items-center gap-3">
                    <Link
                      to={`/register?role=${card.role}`}
                      className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      {card.buttonLabel}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Capabilities — Editorial Numbering */}
      <section className="py-16 lg:py-20 bg-[#EFF8FF]/50 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-3xl font-bold text-[#18261E] font-display">
              Built for Real Agricultural Accountability
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563]">
              Every record is permission-checked on the server, timestamped in UTC, and presented
              with honest provenance disclosures.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-2">
              <h3 className="text-lg font-bold text-[#18261E] font-display">
                01. Cryptographic QR Batch Tokens
              </h3>
              <p className="text-sm text-[#4B5563] leading-relaxed">
                Each registered farm batch receives a human-readable Batch ID (FT-2026-XXXXXXXX)
                and an unpredictable 192-bit URL token for printable crate labels. Internal
                database keys and credentials are never exposed.
              </p>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-2">
              <h3 className="text-lg font-bold text-[#18261E] font-display">
                02. Append-Only Multi-Handoff History
              </h3>
              <p className="text-sm text-[#4B5563] leading-relaxed">
                Transporters, wholesalers, retailers, and cold-storage partners append sequential
                arrival and departure events without overwriting the farmer’s original record or
                prior participants’ entries.
              </p>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-2">
              <h3 className="text-lg font-bold text-[#18261E] font-display">
                03. Server-Enforced Price Confidentiality
              </h3>
              <p className="text-sm text-[#4B5563] leading-relaxed">
                Registering farmers see complete purchase and selling price progression across
                every stage of their batch. Wholesalers and retailers see only their own financial
                entries, and public consumer scans never expose trade margins.
              </p>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-2">
              <h3 className="text-lg font-bold text-[#18261E] font-display">
                04. Crop-Specific Freshness Estimation
              </h3>
              <p className="text-sm text-[#4B5563] leading-relaxed">
                Evaluates crop category shelf-life windows, storage methods, temperature readings,
                and cold-chain interruptions with clear confidence indicators and food safety
                disclaimers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Architecture */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-3xl font-bold text-[#18261E] font-display">
              Simple, Fair Pricing Across the Supply Chain
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563]">
              Wholesalers, retailers, and transporters record supply-chain handoffs at zero
              charge. Previously issued QR codes remain permanently traceable even if a farmer’s
              subscription expires.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-[#8BCF5B] bg-[#F1FAF0] p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#1D6F34]">For Farmers & Grower Groups</p>
                <div className="flex items-baseline gap-1 font-display">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[#18261E]">
                    ₹100
                  </span>
                  <span className="text-sm text-[#4B5563]">/ month</span>
                </div>
                <ul className="space-y-2 text-sm text-[#374151] pt-2">
                  <li>Register unlimited produce batches while active</li>
                  <li>Download & print A4 / crate QR labels (PNG & SVG)</li>
                  <li>Complete multi-stage purchase & selling price visibility</li>
                  <li>Issued QR codes stay traceable forever</li>
                </ul>
              </div>
              <Link
                to="/register?role=farmer"
                className="w-full text-center px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold"
              >
                Register as Farmer
              </Link>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#0369A1]">
                  For Wholesalers, Retailers & Transporters
                </p>
                <div className="flex items-baseline gap-1 font-display">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[#18261E]">
                    ₹0
                  </span>
                  <span className="text-sm text-[#4B5563]">free handoff logging</span>
                </div>
                <ul className="space-y-2 text-sm text-[#374151] pt-2">
                  <li>Integrated mobile camera QR code scanner</li>
                  <li>GPS + local date/time prefill with manual override</li>
                  <li>Private transaction ledger scoped to your business</li>
                  <li>CSV export of authorised batch records</li>
                </ul>
              </div>
              <Link
                to="/roles"
                className="w-full text-center px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#EFF8FF] text-[#18261E] text-sm font-semibold"
              >
                Select Trade Role
              </Link>
            </div>

            <div className="rounded-2xl border border-[#FFAD66] bg-[#FFF7ED] p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#9A3412]">For Everyday Consumers</p>
                <div className="flex items-baseline gap-2 font-display">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[#18261E]">
                    ₹10
                  </span>
                  <span className="text-sm text-[#4B5563]">/ paid batch unlock</span>
                </div>
                <ul className="space-y-2 text-sm text-[#374151] pt-2">
                  <li>Basic public farm origin & timeline free without login</li>
                  <li>₹10 unlocks stage-by-stage dwell & cold-chain report</li>
                  <li>Idempotent entitlement — refreshing never double-charges</li>
                  <li>Instant downloadable payment receipt & certificate</li>
                </ul>
              </div>
              <Link
                to="/scan"
                className="w-full text-center px-4 py-2.5 rounded-xl bg-[#18261E] hover:bg-[#283E31] text-white text-sm font-semibold"
              >
                Scan a Batch QR
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export const RoleSelectionPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold text-[#36A853]">
            Welcome to TraceRoots — Track Produce. Build Trust.
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#18261E] font-display">
            Who are you?
          </h1>
          <p className="text-base text-[#4B5563]">
            Select your participant role below to create a new account or sign in to an existing
            account. Server-side permissions automatically configure your dashboard and data
            visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ROLE_CARDS.map((card) => {
            const Icon = card.Icon;
            return (
              <div
                key={card.role}
                className={`rounded-2xl border p-6 flex flex-col justify-between ${card.surfaceClass}`}
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center">
                    <Icon className={`w-6 h-6 ${card.accentTextClass}`} />
                  </div>
                  <h2 className="text-xl font-bold text-[#18261E] font-display">{card.title}</h2>
                  <p className="text-sm text-[#374151] leading-relaxed">{card.description}</p>
                </div>

                <div className="pt-6 flex items-center gap-3">
                  <Link
                    to={`/register?role=${card.role}`}
                    className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold"
                  >
                    Register
                  </Link>
                  <Link
                    to={`/login?role=${card.role}`}
                    className="px-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#18261E] text-sm font-semibold"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts: Array<{ label: string; email: string; role: string }> = [
    { label: 'Farmer Demo', email: 'farmer@demo.traceroots.in', role: 'Farmer' },
    { label: 'Wholesaler Demo', email: 'wholesaler@demo.traceroots.in', role: 'Wholesaler' },
    { label: 'Retailer Demo', email: 'retailer@demo.traceroots.in', role: 'Retailer' },
    { label: 'Consumer Demo', email: 'consumer@demo.traceroots.in', role: 'Consumer' },
    { label: 'Transporter Demo', email: 'transporter@demo.traceroots.in', role: 'Transporter' },
    { label: 'Partner Hub Demo', email: 'partner@demo.traceroots.in', role: 'Partner' },
    { label: 'Admin Demo', email: 'admin@demo.traceroots.in', role: 'Admin' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(identifier, password);
      if (redirectParam && redirectParam.startsWith('/')) {
        navigate(redirectParam);
      } else {
        navigate(getDashboardPathForRole(loggedInUser.role));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoQuickSignIn = async (demoEmail: string) => {
    setError(null);
    setIdentifier(demoEmail);
    setPassword('Demo@1234');
    setSubmitting(true);
    try {
      const loggedInUser = await login(demoEmail, 'Demo@1234');
      navigate(getDashboardPathForRole(loggedInUser.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#18261E] font-display">
                Sign In to TraceRoots
              </h1>
              <p className="text-sm text-[#4B5563] mt-1">
                Enter your registered email address or 10-digit mobile number.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Email Address or Mobile Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +91 98230 44110"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#36A853]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-[#18261E]">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#1D6F34] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#36A853]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <p className="text-sm text-[#4B5563] pt-2 border-t border-[#E5E7EB]">
              New to TraceRoots?{' '}
              <Link to="/roles" className="font-semibold text-[#1D6F34] hover:underline">
                Select your role and create an account
              </Link>
            </p>
          </div>

          {/* Clearly Labeled Demo Sandbox Accounts */}
          <div className="lg:col-span-5 bg-[#F1FAF0] border border-[#8BCF5B] rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#1D6F34]">
                Development & Testing Convenience
              </p>
              <h2 className="text-lg font-bold text-[#18261E] font-display mt-0.5">
                Demo Sandbox Accounts
              </h2>
              <p className="text-xs text-[#374151] mt-1 leading-relaxed">
                Clearly separated demo accounts (password: <span className="font-mono">Demo@1234</span>)
                let you immediately test Farmer, Wholesaler, Retailer, Consumer, Transporter,
                Partner, and Admin workflows. You can also register brand-new accounts at any time.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoQuickSignIn(acc.email)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#36A853] text-left text-xs transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-[#18261E] block">{acc.label}</span>
                    <span className="font-mono text-[#4B5563]">{acc.email}</span>
                  </div>
                  <span className="font-semibold text-[#36A853] shrink-0">Sign in →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRoleParam = (searchParams.get('role') || 'farmer') as UserRole;
  const validRoles: UserRole[] = [
    'farmer',
    'wholesaler',
    'retailer',
    'consumer',
    'transporter',
    'partner',
  ];
  const initialRole = validRoles.includes(initialRoleParam) ? initialRoleParam : 'farmer';

  const [role, setRole] = useState<UserRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [publicFarmNameConsent, setPublicFarmNameConsent] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsBusinessLabel =
    role === 'farmer'
      ? 'Farm Name'
      : role === 'retailer'
        ? 'Shop / Store Name'
        : role === 'transporter'
          ? 'Transport / Fleet Name'
          : role === 'consumer'
            ? 'Household / Organization (Optional)'
            : 'Business / Mandi Firm Name';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 256, 0.8);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await register({
        fullName,
        mobile,
        email,
        password,
        role,
        businessName,
        address,
        avatarDataUrl,
        consentAccepted,
        publicFarmNameConsent,
      });
      navigate(getDashboardPathForRole(created.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#36A853]">Create TraceRoots Account</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#18261E] font-display mt-0.5">
              Participant Registration
            </h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Register with your real role in the agricultural supply chain. Role permissions are
              enforced on the server.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-2">
                Select Your Role <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ROLE_CARDS.map((rc) => (
                  <button
                    key={rc.role}
                    type="button"
                    onClick={() => setRole(rc.role)}
                    className={`px-3 py-2.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      role === rc.role
                        ? 'bg-[#F1FAF0] border-[#36A853] text-[#18261E] font-semibold'
                        : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                    }`}
                  >
                    {rc.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sunita Deshmukh"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Mobile Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Password (min 8 characters) <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  {needsBusinessLabel} {role !== 'consumer' && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="text"
                  required={role !== 'consumer'}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={role === 'farmer' ? 'e.g. Kaveri Organic Farm' : 'Business name'}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Address / Operating Location {role !== 'consumer' && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="text"
                  required={role !== 'consumer'}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Taluka / Market / City, State"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                Optional Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FBF9] hover:bg-[#F1FAF0] text-xs font-medium cursor-pointer">
                  <Upload className="w-4 h-4 text-[#36A853]" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
                {avatarDataUrl && (
                  <img
                    src={avatarDataUrl}
                    alt="Avatar preview"
                    className="w-10 h-10 rounded-full object-cover border border-[#E5E7EB]"
                  />
                )}
              </div>
            </div>

            {role === 'farmer' && (
              <label className="flex items-start gap-2.5 text-xs text-[#4B5563] cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicFarmNameConsent}
                  onChange={(e) => setPublicFarmNameConsent(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#36A853]"
                />
                <span>
                  Display my Farm Name on public consumer QR tracking pages (my phone number and
                  email are always kept private).
                </span>
              </label>
            )}

            <label className="flex items-start gap-2.5 text-sm text-[#18261E] cursor-pointer pt-2 border-t border-[#E5E7EB]">
              <input
                type="checkbox"
                required
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-[#36A853]"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="text-[#1D6F34] underline">
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-[#1D6F34] underline">
                  Privacy Policy
                </Link>
                , including append-only supply-chain history retention.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Creating Account...' : 'Create Account & Continue'}
            </button>
          </form>

          <p className="text-sm text-[#4B5563]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#1D6F34] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        emailDeliveryConfirmed: boolean;
        devVerificationCode?: string | null;
        message: string;
      }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatusMessage(res.message);
      setDevCodeHint(res.devVerificationCode || null);
      setStep('reset');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      });
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-lg mx-auto px-4 py-14">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F1FAF0] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#36A853]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#18261E] font-display">Reset Password</h1>
              <p className="text-xs text-[#4B5563]">
                Secure verification-code password recovery
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold cursor-pointer"
              >
                {loading ? 'Generating Reset Code...' : 'Request Reset Verification Code'}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {statusMessage && (
                <div className="rounded-xl bg-[#EFF8FF] border border-[#BAE6FD] p-3.5 text-xs text-[#0369A1] space-y-1.5">
                  <p>{statusMessage}</p>
                  {devCodeHint && (
                    <p className="font-mono font-bold text-sm text-[#18261E]">
                      Test Verification Code: {devCodeHint}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold cursor-pointer"
              >
                {loading ? 'Updating Password...' : 'Verify Code & Update Password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-10 h-10 text-[#36A853] mx-auto" />
              <p className="text-sm font-medium text-[#18261E]">
                Your password has been updated securely.
              </p>
              <Link
                to="/login"
                className="inline-block px-5 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold"
              >
                Proceed to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};
