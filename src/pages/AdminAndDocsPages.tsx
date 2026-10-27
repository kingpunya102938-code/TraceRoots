import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Database,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PublicLayout, WorkspaceLayout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatDisplayDateTime, formatInr } from '../lib/api';
import type {
  AuditLogEntry,
  ConsumerScanRecord,
  FreshnessParameter,
  PaymentRecord,
  PricingConfiguration,
  ProduceBatch,
  PublicUserProfile,
  SubscriptionRecord,
  UserRole,
} from '../shared/types';

// ============================================================================
// 1. PROTECTED ADMINISTRATOR DASHBOARD (/admin)
// ============================================================================
interface AdminOverviewResponse {
  users: PublicUserProfile[];
  batches: ProduceBatch[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  consumerScans: ConsumerScanRecord[];
  freshnessParameters: FreshnessParameter[];
  auditLogs: AuditLogEntry[];
  pricing: PricingConfiguration;
  systemHealth: {
    databaseStatus: string;
    totalUsers: number;
    totalBatches: number;
    totalEvents: number;
    totalTransactions: number;
    livePaymentConfigured: boolean;
    geocodingConfigured: boolean;
    webhookSecretConfigured: boolean;
  };
}

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'batches' | 'payments' | 'freshness' | 'audit'
  >('overview');

  const [farmerPrice, setFarmerPrice] = useState('100');
  const [scanFee, setScanFee] = useState('10');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadAdmin = useCallback(() => {
    setLoading(true);
    apiRequest<AdminOverviewResponse>('/api/admin/overview')
      .then((res) => {
        setData(res);
        setFarmerPrice(String(res.pricing.farmerMonthlyPriceInr));
        setScanFee(String(res.pricing.consumerScanFeeInr));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const handleUpdateUser = async (
    userId: string,
    updates: { role?: UserRole; accountStatus?: 'active' | 'suspended' }
  ) => {
    await apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setStatusMsg('User role/status updated and logged to Security Audit Logs.');
    loadAdmin();
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({
        farmerMonthlyPriceInr: Number(farmerPrice),
        consumerScanFeeInr: Number(scanFee),
      }),
    });
    setStatusMsg('Pricing plans updated server-side.');
    loadAdmin();
  };

  const handleUpdateFreshnessParam = async (param: FreshnessParameter) => {
    await apiRequest(`/api/admin/freshness-parameters/${encodeURIComponent(param.id)}`, {
      method: 'PUT',
      body: JSON.stringify(param),
    });
    setStatusMsg(`Updated shelf-life parameters for ${param.category}.`);
    loadAdmin();
  };

  const updateLocalParam = (
    id: string,
    field: keyof FreshnessParameter,
    val: string | number
  ) => {
    if (!data) return;
    setData({
      ...data,
      freshnessParameters: data.freshnessParameters.map((p) =>
        p.id === id ? { ...p, [field]: val } : p
      ),
    });
  };

  return (
    <WorkspaceLayout
      title="Administrator Governance Console"
      subtitle="Restricted platform administration: RBAC user controls, payment reconciliation, crop parameters, and security audit logs."
    >
      {loading || !data ? (
        <div className="p-8 text-sm text-[#4B5563]">Loading administrator telemetry...</div>
      ) : (
        <div className="space-y-6">
          {statusMsg && (
            <div className="rounded-xl bg-[#F1FAF0] border border-[#8BCF5B] px-4 py-3 text-xs sm:text-sm text-[#166534] flex items-center justify-between">
              <span>{statusMsg}</span>
              <button
                type="button"
                onClick={() => setStatusMsg(null)}
                className="text-xs font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Segmented Admin Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E5E7EB] p-1.5 rounded-2xl">
            {(
              [
                ['overview', 'System & Pricing'],
                ['users', `Users (${data.users.length})`],
                ['batches', `Batches (${data.batches.length})`],
                ['payments', `Payments & Scans (${data.payments.length})`],
                ['freshness', 'Freshness Parameters'],
                ['audit', `Audit Logs (${data.auditLogs.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === key
                    ? 'bg-[#36A853] text-white'
                    : 'text-[#4B5563] hover:text-[#18261E] hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW & PRICING */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
                  <p className="text-xs text-[#4B5563]">Total Registered Users</p>
                  <p className="text-3xl font-bold font-mono tabular-nums mt-1">
                    {data.systemHealth.totalUsers}
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
                  <p className="text-xs text-[#4B5563]">Total Produce Batches</p>
                  <p className="text-3xl font-bold font-mono tabular-nums mt-1">
                    {data.systemHealth.totalBatches}
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
                  <p className="text-xs text-[#4B5563]">Append-Only Tracking Events</p>
                  <p className="text-3xl font-bold font-mono tabular-nums mt-1">
                    {data.systemHealth.totalEvents}
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
                  <p className="text-xs text-[#4B5563]">Active Subscriptions</p>
                  <p className="text-3xl font-bold font-mono tabular-nums text-[#36A853] mt-1">
                    {data.subscriptions.filter((s) => s.status === 'active').length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 font-display font-bold text-[#18261E]">
                    <Activity className="w-5 h-5 text-[#36A853]" />
                    <h3>System Health & External Integrations</h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#4B5563]">Database Engine</span>
                      <span className="font-semibold text-[#1D6F34]">
                        {data.systemHealth.databaseStatus}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#4B5563]">Razorpay Payment Mode</span>
                      <span className="font-mono text-xs">
                        {data.systemHealth.livePaymentConfigured
                          ? 'Live Keys Configured'
                          : 'Test Sandbox Active (Set RAZORPAY_KEY_ID)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                      <span className="text-[#4B5563]">Webhook Signature Secret</span>
                      <span className="font-mono text-xs">
                        {data.systemHealth.webhookSecretConfigured ? 'Configured' : 'Unset'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#4B5563]">Geocoding API Key</span>
                      <span className="font-mono text-xs">
                        {data.systemHealth.geocodingConfigured
                          ? 'Configured'
                          : 'Using OpenStreetMap Nominatim'}
                      </span>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSavePricing}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 font-display font-bold text-[#18261E]">
                    <Database className="w-5 h-5 text-[#0284C7]" />
                    <h3>Supported Pricing Plans Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#18261E] mb-1">
                        Farmer Monthly Plan (INR)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={farmerPrice}
                        onChange={(e) => setFarmerPrice(e.target.value)}
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#18261E] mb-1">
                        Paid Consumer Scan Fee (INR)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={scanFee}
                        onChange={(e) => setScanFee(e.target.value)}
                        className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-sm font-mono tabular-nums"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[#4B5563]">
                    Wholesaler, Retailer, and Transporter handoff fees remain ₹0 by platform
                    policy.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#36A853] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Plan Pricing</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: USER & ROLE MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#36A853]" />
                <h3 className="text-base font-bold font-display">User & Role Governance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                      <th className="py-3 px-4">Code & Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#18261E]">{u.fullName}</span>
                          <span className="block text-xs font-mono text-[#4B5563]">
                            {u.publicCode} {u.isDemo ? '· Demo' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{u.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleUpdateUser(u.id, { role: e.target.value as UserRole })
                            }
                            className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs capitalize"
                          >
                            <option value="farmer">farmer</option>
                            <option value="wholesaler">wholesaler</option>
                            <option value="retailer">retailer</option>
                            <option value="consumer">consumer</option>
                            <option value="transporter">transporter</option>
                            <option value="partner">partner</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-xs capitalize font-medium">
                          {u.accountStatus}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {u.accountStatus !== 'deleted' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateUser(u.id, {
                                  accountStatus:
                                    u.accountStatus === 'active' ? 'suspended' : 'active',
                                })
                              }
                              className="px-3 py-1 rounded-lg border border-[#E5E7EB] text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                            >
                              {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BATCH INVESTIGATION */}
          {activeTab === 'batches' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB]">
                <h3 className="text-base font-bold font-display">
                  Batch Registry & Auditable Correction Access
                </h3>
                <p className="text-xs text-[#4B5563]">
                  Administrators cannot silently rewrite history; open any batch to append an
                  auditable Correction Record.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                      <th className="py-3 px-4">Batch ID</th>
                      <th className="py-3 px-4">Produce</th>
                      <th className="py-3 px-4">Origin Farm</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Investigate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {data.batches.map((b) => (
                      <tr key={b.id}>
                        <td className="py-3 px-4 font-mono text-xs font-semibold">
                          {b.batchCode}
                        </td>
                        <td className="py-3 px-4">
                          {b.produceName} {b.isDemo ? '(Demo)' : ''}
                        </td>
                        <td className="py-3 px-4 text-xs">{b.farmName}</td>
                        <td className="py-3 px-4 text-xs">{b.currentStatus}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/batches/${b.batchCode}`}
                            className="text-xs font-semibold text-[#1D6F34] hover:underline"
                          >
                            Inspect & Audit →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT RECONCILIATION & SCANS */}
          {activeTab === 'payments' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB]">
                <h3 className="text-base font-bold font-display">
                  Payment Reconciliation & Consumer Scan Ledger
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                      <th className="py-3 px-4">Receipt</th>
                      <th className="py-3 px-4">Purpose</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-mono text-xs font-semibold">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 px-4 text-xs">{p.purpose}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatInr(p.amountInr)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{p.provider}</td>
                        <td className="py-3 px-4 text-xs font-semibold capitalize">
                          {p.verificationStatus.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                          {formatDisplayDateTime(p.createdAtUtc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FRESHNESS PARAMETER MANAGEMENT */}
          {activeTab === 'freshness' && (
            <div className="space-y-4">
              {data.freshnessParameters.map((fp) => (
                <div
                  key={fp.id}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-[#18261E] font-display">{fp.category}</h4>
                      <p className="text-xs text-[#4B5563]">{fp.produceExamples}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateFreshnessParam(fp)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#36A853] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Category</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="block text-[#4B5563] mb-1">Ambient Min (d)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.ambientMinDays}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'ambientMinDays', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#4B5563] mb-1">Ambient Max (d)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.ambientMaxDays}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'ambientMaxDays', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#4B5563] mb-1">Cold Min (d)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.coldMinDays}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'coldMinDays', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#4B5563] mb-1">Cold Max (d)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.coldMaxDays}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'coldMaxDays', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#4B5563] mb-1">Opt Temp Min (°C)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.optimalTempMinC}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'optimalTempMinC', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#4B5563] mb-1">Opt Temp Max (°C)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fp.optimalTempMaxC}
                        onChange={(e) =>
                          updateLocalParam(fp.id, 'optimalTempMaxC', Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: SECURITY AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#36A853]" />
                <h3 className="text-base font-bold font-display">
                  Security & Authorization Audit Trail
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-[#4B5563]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor Role</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Outcome</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {data.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[#4B5563]">
                          {formatDisplayDateTime(log.createdAtUtc)}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{log.actorRole}</td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#18261E]">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-semibold ${
                              log.outcome === 'allowed' ? 'text-[#1D6F34]' : 'text-red-700'
                            }`}
                          >
                            {log.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[#374151]">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </WorkspaceLayout>
  );
};

// ============================================================================
// 2. HELP, FAQ & EXTERNAL API CONFIGURATION GUIDE (/help)
// ============================================================================
export const HelpFaqPage: React.FC = () => {
  const { user } = useAuth();

  const content = (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#18261E] font-display">
          Help, FAQ & Production Setup Guide
        </h1>
        <p className="text-sm text-[#4B5563]">
          Step-by-step workflow guidance for supply-chain participants and environment variable
          instructions for deploying TraceRoots with external providers.
        </p>

        <div className="space-y-4 pt-2">
          <div className="border-t border-[#E5E7EB] pt-4">
            <h2 className="text-base font-bold text-[#18261E]">
              How does Farmer → Wholesaler → Retailer → Consumer tracking work?
            </h2>
            <p className="text-sm text-[#4B5563] mt-1 leading-relaxed">
              1. A subscribed Farmer registers a harvested produce batch and prints the generated
              QR crate label. 2. Transporters, Wholesalers, and Retailers scan that same QR code
              using the TraceRoots camera scanner (or upload/lookup) and append their arrival,
              departure, storage temperature, and confidential trade price. 3. Consumers scan the
              QR code with any smartphone camera to view the chronological origin story and crop
              freshness estimate.
            </p>
          </div>

          <div className="border-t border-[#E5E7EB] pt-4">
            <h2 className="text-base font-bold text-[#18261E]">
              Who can see purchase prices and selling prices?
            </h2>
            <p className="text-sm text-[#4B5563] mt-1 leading-relaxed">
              Price confidentiality is enforced strictly on the server: the Farmer who registered a
              batch sees all recorded purchase and selling prices across every downstream stage.
              Wholesalers and Retailers see only the financial entries they personally submitted.
              Consumers and public QR tracking pages never receive financial figures.
            </p>
          </div>

          <div className="border-t border-[#E5E7EB] pt-4">
            <h2 className="text-base font-bold text-[#18261E]">
              What happens to QR codes if a Farmer’s ₹100/month subscription expires?
            </h2>
            <p className="text-sm text-[#4B5563] mt-1 leading-relaxed">
              Every batch registered during an active subscription remains permanently traceable.
              Wholesalers, retailers, and consumers can continue scanning and appending events to
              those QR codes. Renewing is only needed when the farmer wishes to register new
              batches.
            </p>
          </div>
        </div>
      </div>

      {/* Honest External Integration Configuration Reference */}
      <div className="bg-[#F9FBF9] border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-[#1D6F34] font-bold font-display">
          <CheckCircle2 className="w-5 h-5" />
          <h2>Production Environment Variable & API Configuration</h2>
        </div>
        <p className="text-sm text-[#374151]">
          Configure these server-side environment variables (never expose secrets in client
          variables) when deploying to production:
        </p>
        <ul className="space-y-2.5 text-xs sm:text-sm text-[#374151] font-mono bg-white border border-[#E5E7EB] rounded-xl p-4">
          <li>
            <strong>SESSION_SECRET</strong> — 32+ byte random secret for HMAC-SHA256 session tokens
          </li>
          <li>
            <strong>RAZORPAY_KEY_ID</strong> &amp; <strong>RAZORPAY_KEY_SECRET</strong> — Enables
            Live Razorpay INR order creation and signature verification
          </li>
          <li>
            <strong>RAZORPAY_WEBHOOK_SECRET</strong> — Enables /api/payments/webhook signature
            validation
          </li>
          <li>
            <strong>GEOCODING_API_KEY</strong> &amp; <strong>GEOCODING_PROVIDER=google</strong> —
            Optional reverse geocoding key (falls back cleanly to Nominatim/manual entry)
          </li>
          <li>
            <strong>SMTP_WEBHOOK_URL</strong> / <strong>SMS_WEBHOOK_URL</strong> — Optional
            transactional email/SMS delivery endpoints
          </li>
        </ul>
      </div>
    </div>
  );

  if (user) {
    return <WorkspaceLayout title="Help, FAQ & Setup Guide">{content}</WorkspaceLayout>;
  }
  return (
    <PublicLayout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">{content}</div>
    </PublicLayout>
  );
};

// ============================================================================
// 3. PRIVACY POLICY (/privacy) & TERMS AND CONDITIONS (/terms)
// ============================================================================
export const PrivacyPolicyPage: React.FC = () => (
  <PublicLayout>
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-3xl font-bold text-[#18261E] font-display">Privacy Policy</h1>
        <p className="text-xs text-[#6B7280]">Effective Date: October 2026</p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          1. Minimal Personal Data & Public QR Separation
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Public QR tracking pages (/track/token) expose only produce attributes, farm origin name
          (subject to farmer consent), supply-chain business names, timestamps, and storage
          conditions. Personal phone numbers, email addresses, passwords, internal user IDs, and
          financial purchase/selling prices are never exposed on public endpoints.
        </p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          2. Purpose-Bound Location Collection
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Browser GPS location is requested strictly on demand when recording a batch departure or
          handoff arrival. TraceRoots never tracks participant locations continuously in the
          background, and every detected location can be edited or entered manually prior to
          submission.
        </p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          3. Consumer Privacy
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Consumers may scan QR codes and view public traceability timelines without creating an
          account or disclosing personal contact details.
        </p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          4. Account Deletion & Supply-Chain Retention
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Users may delete their account at any time from Profile & Settings, which permanently
          redacts personal contact identifiers while preserving anonymised supply-chain event
          continuity for already-distributed food batches.
        </p>
      </div>
    </div>
  </PublicLayout>
);

export const TermsPage: React.FC = () => (
  <PublicLayout>
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-3xl font-bold text-[#18261E] font-display">Terms and Conditions</h1>
        <p className="text-xs text-[#6B7280]">Effective Date: October 2026</p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          1. Honest Provenance & Append-Only Records
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Participants are responsible for the accuracy of harvest dates, locations, storage
          temperatures, and trade records they submit. Submitted tracking events are append-only;
          corrections must be submitted as auditable Correction Records referencing the earlier
          entry. TraceRoots clearly labels participant-submitted versus manually entered records and
          does not claim independent physical inspection unless verified.
        </p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          2. Food Safety Estimation Disclaimer
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Freshness indicators (Green, Yellow, Orange, Red, Grey) are algorithmic estimates derived
          from crop shelf-life parameters and recorded handling data. They are not laboratory tests,
          certifications, or guarantees that food is safe to eat.
        </p>

        <h2 className="text-lg font-bold text-[#18261E] pt-2">
          3. Subscriptions & Consumer Scan Fees
        </h2>
        <p className="text-sm text-[#374151] leading-relaxed">
          Farmer subscriptions are billed at ₹100 per 30-day period. Paid consumer deep-dive scans
          are billed at ₹10 per unlocked batch with idempotent protection against duplicate charges
          on page refresh. Wholesalers, retailers, and transporters log supply-chain events at ₹0.
        </p>
      </div>
    </div>
  </PublicLayout>
);
