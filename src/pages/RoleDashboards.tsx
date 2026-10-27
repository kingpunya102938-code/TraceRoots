import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Download,
  FilePlus2,
  QrCode,
  Receipt,
  Search,
  Truck,
} from 'lucide-react';
import { ProduceArtworkThumb } from '../components/BrandLogo';
import { FreshnessBadgeInline } from '../components/FreshnessCard';
import { HandoffEventForm } from '../components/HandoffEventForm';
import { WorkspaceLayout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  exportRowsToCsv,
  formatDisplayDateTime,
  formatInr,
} from '../lib/api';
import type {
  ConsumerScanRecord,
  FinancialTransaction,
  FreshnessEstimate,
  PaymentRecord,
  ProduceBatch,
  TrackingEvent,
} from '../shared/types';

interface RoleBatchRow {
  batch: ProduceBatch;
  eventCount: number;
  latestEvent: TrackingEvent | null;
  freshness: FreshnessEstimate;
  transactions: FinancialTransaction[];
}

// Shared Trade & Logistics Workspace Engine for Wholesaler, Retailer, Transporter, Partner
const TradeRoleWorkspace: React.FC<{
  roleTitle: string;
  roleSubtitle: string;
  mode: 'wholesaler' | 'retailer' | 'transporter' | 'partner';
}> = ({ roleTitle, roleSubtitle, mode }) => {
  const [rows, setRows] = useState<RoleBatchRow[]>([]);
  const [myTransactions, setMyTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeHandoffBatch, setActiveHandoffBatch] = useState<ProduceBatch | null>(null);

  const loadWorkspace = useCallback(() => {
    setLoading(true);
    const promises: [
      Promise<{ items: RoleBatchRow[] }>,
      Promise<{ transactions: FinancialTransaction[] }> | Promise<null>,
    ] = [
      apiRequest<{ items: RoleBatchRow[] }>('/api/batches'),
      mode !== 'transporter'
        ? apiRequest<{ transactions: FinancialTransaction[] }>('/api/transactions/my')
        : Promise.resolve(null),
    ];

    Promise.all(promises)
      .then(([bRes, tRes]) => {
        setRows(bRes.items);
        if (tRes) setMyTransactions(tRes.transactions);
      })
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const filteredRows = rows.filter(({ batch }) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      batch.batchCode.toLowerCase().includes(q) ||
      batch.produceName.toLowerCase().includes(q) ||
      batch.farmName.toLowerCase().includes(q)
    );
  });

  const incomingCount = rows.filter(
    (r) =>
      r.batch.currentStatus === 'Registered' ||
      r.batch.currentStatus === 'In Transit' ||
      r.batch.currentStatus === 'Dispatched by Wholesaler'
  ).length;

  const receivedCount = rows.filter((r) =>
    mode === 'wholesaler'
      ? r.batch.currentStatus === 'At Wholesaler'
      : mode === 'retailer'
        ? r.batch.currentStatus === 'At Retailer'
        : r.eventCount >= 2
  ).length;

  const dispatchedCount = rows.filter((r) =>
    mode === 'wholesaler'
      ? r.batch.currentStatus === 'Dispatched by Wholesaler' ||
        r.batch.currentStatus === 'At Retailer'
      : r.batch.currentStatus === 'Delivered / Consumer Ready'
  ).length;

  const totalPurchaseSpend = myTransactions.reduce((sum, t) => sum + t.totalPurchasePrice, 0);

  const exportMyTransactionsCsv = () => {
    exportRowsToCsv(
      `TraceRoots-${mode}-Transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Reference',
        'Batch ID',
        'Produce',
        'Quantity',
        'Unit',
        'Purchase / Unit (INR)',
        'Total Purchase (INR)',
        'Selling / Unit (INR)',
        'Timestamp UTC',
      ],
      myTransactions.map((t) => [
        t.referenceCode,
        t.batchCode,
        t.produceName,
        t.quantity,
        t.unit,
        t.purchasePricePerUnit,
        t.totalPurchasePrice,
        t.sellingPricePerUnit,
        t.createdAtUtc,
      ])
    );
  };

  return (
    <WorkspaceLayout title={roleTitle} subtitle={roleSubtitle}>
      <div className="space-y-8">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">
              {mode === 'transporter' ? 'Assigned / In-Transit Runs' : 'Incoming / Awaiting Receipt'}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0284C7] mt-2">
              {incomingCount}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">
              {mode === 'retailer' ? 'Current Store Inventory' : 'Batches Handled / Received'}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#36A853] mt-2">
              {receivedCount}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">
              {mode === 'retailer' ? 'Sold / Completed Batches' : 'Dispatched Downstream'}
            </p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#18261E] mt-2">
              {dispatchedCount}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">
              {mode === 'transporter' ? 'Total Tracked Batches' : 'My Logged Purchase Value'}
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#18261E] mt-2">
              {mode === 'transporter' ? rows.length : formatInr(totalPurchaseSpend)}
            </p>
          </div>
        </div>

        {/* Scanner & Search Action Bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Batch ID, produce name, or origin farm..."
              className="w-full rounded-xl border border-[#E5E7EB] pl-9 pr-3.5 py-2 text-sm"
            />
          </div>
          <Link
            to="/scan"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Produce QR Code</span>
          </Link>
        </div>

        {/* Inline Handoff Recording Drawer when selected */}
        {activeHandoffBatch && (
          <HandoffEventForm
            batch={activeHandoffBatch}
            onSuccess={() => {
              setActiveHandoffBatch(null);
              loadWorkspace();
            }}
            onCancel={() => setActiveHandoffBatch(null)}
          />
        )}

        {/* Authorised Supply-Chain Batches Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="text-base font-bold text-[#18261E] font-display">
              {mode === 'transporter'
                ? 'Active Deliveries & Transport History'
                : 'Incoming & Handled Produce Batches'}
            </h2>
            <span className="text-xs font-mono text-[#4B5563]">
              {filteredRows.length} batch{filteredRows.length === 1 ? '' : 'es'}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">Loading batches...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">
              No matching batches found. Scan a QR code to record a new arrival.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                    <th className="py-3 px-4">Batch & Produce</th>
                    <th className="py-3 px-4">Origin Farm</th>
                    <th className="py-3 px-4 text-right">Volume</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Freshness</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredRows.map(({ batch, freshness }) => (
                    <tr key={batch.id} className="hover:bg-[#F1FAF0]/35">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <ProduceArtworkThumb
                            category={batch.category}
                            produceName={batch.produceName}
                            imageDataUrl={batch.imageDataUrl}
                            className="w-10 h-10"
                          />
                          <div>
                            <p className="font-semibold text-[#18261E]">
                              {batch.produceName}
                              {batch.isDemo && (
                                <span className="ml-1.5 text-xs font-normal text-[#B45309]">
                                  · Demo
                                </span>
                              )}
                            </p>
                            <p className="text-xs font-mono text-[#4B5563]">{batch.batchCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#374151]">
                        {batch.farmName}
                        <span className="block text-[#6B7280]">{batch.farmLocation}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {batch.quantity} {batch.unit}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium">{batch.currentStatus}</td>
                      <td className="py-3.5 px-4">
                        <FreshnessBadgeInline freshness={freshness} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveHandoffBatch(batch)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                          >
                            <FilePlus2 className="w-3.5 h-3.5" />
                            <span>
                              {mode === 'transporter' ? 'Log Pickup/Drop' : 'Record Handoff'}
                            </span>
                          </button>
                          <Link
                            to={`/batches/${batch.batchCode}`}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 text-xs font-medium whitespace-nowrap"
                          >
                            History
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Own Authorised Purchase & Sales Ledger (Hidden for Transporters) */}
        {mode !== 'transporter' && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#18261E] font-display">
                  Your Authorised Purchase & Sales Records
                </h2>
                <p className="text-xs text-[#4B5563]">
                  Confidential to your account and the registering farmer. Prices charged by other
                  supply-chain participants are never exposed here.
                </p>
              </div>
              {myTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={exportMyTransactionsCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#36A853]" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            {myTransactions.length === 0 ? (
              <div className="p-6 text-sm text-[#4B5563]">
                You have not recorded any financial purchase or selling entries yet. Scan a batch
                QR code or click Record Handoff above to log a transaction.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                      <th className="py-3 px-4">Ref</th>
                      <th className="py-3 px-4">Batch & Produce</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Purchase / Unit</th>
                      <th className="py-3 px-4 text-right">Total Purchase</th>
                      <th className="py-3 px-4 text-right">Selling / Unit</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {myTransactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-3 px-4 font-mono text-xs">{t.referenceCode}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-[#18261E]">{t.produceName}</span>
                          <span className="block text-xs font-mono text-[#4B5563]">
                            {t.batchCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {t.quantity} {t.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatInr(t.purchasePricePerUnit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatInr(t.totalPurchasePrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#1D6F34] font-semibold">
                          {t.sellingPricePerUnit !== null
                            ? formatInr(t.sellingPricePerUnit)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                          {formatDisplayDateTime(t.createdAtUtc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
};

export const WholesalerDashboardPage: React.FC = () => (
  <TradeRoleWorkspace
    mode="wholesaler"
    roleTitle="Wholesaler Dashboard"
    roleSubtitle="Scan incoming farm batches, record APMC/wholesale arrivals & dispatches, and manage confidential trade records."
  />
);

export const RetailerDashboardPage: React.FC = () => (
  <TradeRoleWorkspace
    mode="retailer"
    roleTitle="Retailer Dashboard"
    roleSubtitle="Verify produce provenance on store arrival, manage retail produce inventory, and display QR traceability for shoppers."
  />
);

export const TransporterDashboardPage: React.FC = () => (
  <TradeRoleWorkspace
    mode="transporter"
    roleTitle="Transporter Logistics Dashboard"
    roleSubtitle="Record farm pickup and market drop-off timestamps, vehicle identifiers, cold-chain temperatures, and transit notes."
  />
);

export const PartnerDashboardPage: React.FC = () => (
  <TradeRoleWorkspace
    mode="partner"
    roleTitle="Supply-Chain Partner Dashboard"
    roleSubtitle="Log packhouse grading, cold-storage chamber transfers, or cooperative aggregation handoffs."
  />
);

// ============================================================================
// CONSUMER DASHBOARD (/consumer)
// ============================================================================
export const ConsumerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<RoleBatchRow[]>([]);
  const [scans, setScans] = useState<ConsumerScanRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<{ items: RoleBatchRow[] }>('/api/batches'),
      apiRequest<{ scans: ConsumerScanRecord[]; payments: PaymentRecord[] }>('/api/consumer/scans'),
    ])
      .then(([bRes, sRes]) => {
        setBatches(bRes.items);
        setScans(sRes.scans);
        setPayments(sRes.payments);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceLayout
      title={`Consumer Hub — ${user?.fullName || 'Shopper'}`}
      subtitle="Scan produce QR codes in stores, review farm-to-fork timelines, and access your ₹10 unlocked scan reports & receipts."
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Saved & Accessed Batches</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#36A853] mt-2">
              {batches.length}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Paid Consumer Scans (₹10)</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#18261E] mt-2">
              {scans.length}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Payment Receipts</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0284C7] mt-2">
              {payments.length}
            </p>
          </div>
        </div>

        <div className="bg-[#F1FAF0] border border-[#8BCF5B] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#18261E] font-display">
              Check Produce Origin Before You Buy
            </h2>
            <p className="text-sm text-[#374151]">
              Scan any TraceRoots QR label on crates or retail shelves to view harvest dates,
              locations, and freshness estimates.
            </p>
          </div>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Produce QR</span>
          </Link>
        </div>

        {/* Saved & Accessed Batches */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#36A853]" />
            <h2 className="text-base font-bold text-[#18261E] font-display">
              Saved & Recently Accessed Produce Batches
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">
              No batches saved yet. Scan a produce QR code to view and bookmark its journey.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {batches.map(({ batch, freshness }) => (
                <div
                  key={batch.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F1FAF0]/35"
                >
                  <div className="flex items-center gap-3.5">
                    <ProduceArtworkThumb
                      category={batch.category}
                      produceName={batch.produceName}
                      imageDataUrl={batch.imageDataUrl}
                      className="w-12 h-12"
                    />
                    <div>
                      <p className="font-semibold text-[#18261E]">
                        {batch.produceName}
                        {batch.isDemo && (
                          <span className="ml-2 text-xs font-normal text-[#B45309]">
                            · Demo Record
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#4B5563]">
                        <span className="font-mono">{batch.batchCode}</span> · Origin:{' '}
                        {batch.farmName} · Harvested {batch.harvestDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <FreshnessBadgeInline freshness={freshness} />
                    <Link
                      to={`/track/${batch.trackingToken}`}
                      className="px-3.5 py-2 rounded-xl bg-[#36A853] text-white text-xs font-semibold whitespace-nowrap"
                    >
                      View Journey
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paid Scan History & Receipts */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0284C7]" />
            <h2 className="text-base font-bold text-[#18261E] font-display">
              Paid Scan History & Verified Receipts
            </h2>
          </div>

          {scans.length === 0 ? (
            <div className="p-6 text-sm text-[#4B5563]">
              You have not unlocked any ₹10 paid consumer deep-dive scans yet. Basic public batch
              timelines are always free to inspect.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                    <th className="py-3 px-4">Scan Cert ID</th>
                    <th className="py-3 px-4">Produce & Batch</th>
                    <th className="py-3 px-4 text-right">Fee Paid</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Receipt & Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {scans.map((sc) => (
                    <tr key={sc.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{sc.scanCode}</td>
                      <td className="py-3 px-4">
                        {sc.produceName} ({sc.batchCode})
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {formatInr(sc.amountInr)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                        {formatDisplayDateTime(sc.createdAtUtc)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-3">
                        <Link
                          to={`/payment/receipt/${sc.paymentId}`}
                          className="text-xs font-semibold text-[#0284C7] hover:underline"
                        >
                          Receipt
                        </Link>
                        <Link
                          to={`/track/${sc.trackingToken}`}
                          className="text-xs font-semibold text-[#1D6F34] hover:underline"
                        >
                          Report →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
};
