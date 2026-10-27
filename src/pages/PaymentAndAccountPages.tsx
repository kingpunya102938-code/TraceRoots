import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  Printer,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { PublicLayout, WorkspaceLayout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  compressImageFileToDataUrl,
  createIdempotencyKey,
  formatDisplayDateTime,
  formatInr,
  getClientEntitlementKey,
} from '../lib/api';
import type {
  ConsumerScanRecord,
  NotificationItem,
  PaymentRecord,
  SubscriptionRecord,
} from '../shared/types';

// ============================================================================
// 1. FARMER SUBSCRIPTION MANAGEMENT PAGE (/subscription)
// ============================================================================
export const SubscriptionPage: React.FC = () => {
  const { refreshAuth } = useAuth();
  const [sub, setSub] = useState<SubscriptionRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [monthlyPriceInr, setMonthlyPriceInr] = useState(100);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadSubscription = useCallback(() => {
    setLoading(true);
    apiRequest<{
      subscription: SubscriptionRecord | null;
      payments: PaymentRecord[];
      monthlyPriceInr: number;
    }>('/api/subscription')
      .then((res) => {
        setSub(res.subscription);
        setPayments(res.payments);
        setMonthlyPriceInr(res.monthlyPriceInr);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await apiRequest('/api/subscription/cancel', { method: 'POST' });
      setConfirmCancel(false);
      await refreshAuth();
      loadSubscription();
    } finally {
      setCancelling(false);
    }
  };

  const daysUntilRenewal = sub
    ? Math.ceil((Date.parse(sub.renewalDateUtc) - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <WorkspaceLayout
      title="Farmer Monthly Subscription"
      subtitle="Manage your ₹100/month TraceRoots Farmer Plan, billing status, and verified payment history."
    >
      <div className="max-w-4xl space-y-6">
        {loading ? (
          <div className="p-8 text-sm text-[#4B5563]">Loading subscription details...</div>
        ) : (
          <>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#36A853]">
                    Farmer Monthly Traceability Plan
                  </p>
                  <h2 className="text-2xl font-bold text-[#18261E] font-display mt-0.5">
                    ₹{monthlyPriceInr} / month
                  </h2>
                  <p className="text-sm text-[#4B5563] mt-1">
                    Current Status:{' '}
                    <strong className="capitalize text-[#18261E]">
                      {sub ? sub.status : 'Not Subscribed'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {sub?.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <Link
                      to="/payment?purpose=farmer_subscription"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {sub ? `Renew Subscription (₹${monthlyPriceInr})` : `Activate Subscription (₹${monthlyPriceInr})`}
                      </span>
                    </Link>
                  )}
                </div>
              </div>

              {sub && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E5E7EB] text-sm">
                  <div>
                    <span className="text-xs text-[#6B7280] block">Start Date</span>
                    <span className="font-mono tabular-nums font-medium">
                      {formatDisplayDateTime(sub.startDateUtc)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6B7280] block">Renewal / Expiry Date</span>
                    <span className="font-mono tabular-nums font-medium">
                      {formatDisplayDateTime(sub.renewalDateUtc)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-[#6B7280] block">Renewal Reminder</span>
                    <span className="font-medium text-[#18261E]">
                      {sub.status === 'active' && daysUntilRenewal !== null
                        ? `${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'} remaining`
                        : 'Inactive — renew anytime'}
                    </span>
                  </div>
                </div>
              )}

              {confirmCancel && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
                  <p className="text-sm text-red-800 font-medium">
                    Confirm cancellation? You will not be able to register new produce batches
                    until you renew, but all previously issued QR codes and tracking records will
                    remain permanently active.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={handleCancelSubscription}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      className="px-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-xs font-medium cursor-pointer"
                    >
                      Keep Active Plan
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-[#F1FAF0] border border-[#8BCF5B] p-4 text-xs text-[#166534]">
                <strong>Permanent Batch Traceability Guarantee:</strong> Batches registered during
                an active subscription remain permanently traceable across wholesalers, retailers,
                and consumers even if your monthly subscription later expires or is cancelled.
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB]">
                <h3 className="text-base font-bold text-[#18261E] font-display">
                  Subscription Payment History
                </h3>
              </div>

              {payments.length === 0 ? (
                <div className="p-6 text-sm text-[#4B5563]">
                  No subscription payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                        <th className="py-3 px-4">Receipt</th>
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Verification Status</th>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-mono text-xs font-semibold">
                            {p.receiptNumber}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#4B5563]">
                            {p.providerOrderId}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatInr(p.amountInr)}
                          </td>
                          <td className="py-3 px-4 text-xs capitalize">
                            {p.verificationStatus.replace('_', ' ')}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                            {formatDisplayDateTime(p.createdAtUtc)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              to={`/payment/receipt/${p.id}`}
                              className="text-xs font-semibold text-[#1D6F34] hover:underline"
                            >
                              Receipt →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
};

// ============================================================================
// 2. SERVER-VERIFIED PAYMENT CHECKOUT PAGE (/payment)
// ============================================================================
export const PaymentPage: React.FC = () => {
  const { user, systemConfig, refreshAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const purpose = (searchParams.get('purpose') || 'farmer_subscription') as
    | 'farmer_subscription'
    | 'consumer_scan';
  const trackingToken = searchParams.get('token') || '';

  const [idempotencyKey] = useState(() => createIdempotencyKey('pay'));
  const [orderPayment, setOrderPayment] = useState<PaymentRecord | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [processingGateway, setProcessingGateway] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountInr =
    purpose === 'farmer_subscription'
      ? systemConfig?.pricing.farmerMonthlyPriceInr ?? 100
      : systemConfig?.pricing.consumerScanFeeInr ?? 10;

  const isLiveRazorpay = systemConfig?.paymentMode === 'razorpay_live';

  const handleCreateOrder = async () => {
    setError(null);
    setCreatingOrder(true);
    try {
      const res = await apiRequest<{
        alreadyUnlocked?: boolean;
        payment: PaymentRecord | null;
        scanRecord?: ConsumerScanRecord;
      }>('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          trackingToken,
          idempotencyKey,
          clientEntitlementKey: getClientEntitlementKey(),
        }),
      });

      if (res.alreadyUnlocked && trackingToken) {
        navigate(`/track/${trackingToken}`, { replace: true });
        return;
      }

      setOrderPayment(res.payment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleTestGatewayOutcome = async (outcome: 'success' | 'failed' | 'cancelled') => {
    if (!orderPayment) return;
    setError(null);
    setProcessingGateway(true);
    try {
      const gwRes = await apiRequest<{
        status?: string;
        providerOrderId?: string;
        providerPaymentId?: string;
        providerSignature?: string;
      }>('/api/payments/test-gateway-authorize', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: orderPayment.id,
          outcome,
        }),
      });

      if (outcome !== 'success') {
        navigate(`/payment/receipt/${orderPayment.id}`);
        return;
      }

      // Verify cryptographic signature server-side before unlocking any entitlement!
      await apiRequest('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          paymentId: orderPayment.id,
          providerOrderId: gwRes.providerOrderId,
          providerPaymentId: gwRes.providerPaymentId,
          providerSignature: gwRes.providerSignature,
          clientEntitlementKey: getClientEntitlementKey(),
        }),
      });

      await refreshAuth();
      navigate(`/payment/receipt/${orderPayment.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessingGateway(false);
    }
  };

  const checkoutBody = (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Honest Payment Mode Banner */}
      <div
        className={`rounded-2xl border p-4 text-xs sm:text-sm ${
          isLiveRazorpay
            ? 'bg-[#F1FAF0] border-[#8BCF5B] text-[#166534]'
            : 'bg-[#EFF8FF] border-[#BAE6FD] text-[#0369A1]'
        }`}
      >
        {isLiveRazorpay ? (
          <p>
            <strong>Live Razorpay Mode Active:</strong> Orders and HMAC-SHA256 payment signatures
            are verified directly with Razorpay servers.
          </p>
        ) : (
          <div className="space-y-1">
            <p>
              <strong>Development / Test Payment Mode (Honest Setup Disclosure):</strong> Live
              Razorpay credentials (<span className="font-mono">RAZORPAY_KEY_ID</span> and{' '}
              <span className="font-mono">RAZORPAY_KEY_SECRET</span>) are not configured in server
              environment variables yet.
            </p>
            <p className="text-xs">
              Orders below use the clearly marked TraceRoots Test Payment Sandbox with real
              server-side HMAC-SHA256 signature verification and duplicate-charge protection. See{' '}
              <Link to="/help" className="underline font-semibold">
                Help & Setup Guide
              </Link>{' '}
              to switch to Live Razorpay.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#E5E7EB] pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#36A853]">
              {purpose === 'farmer_subscription'
                ? 'Farmer Monthly Subscription'
                : 'Consumer Batch Scan Unlock'}
            </p>
            <h2 className="text-2xl font-bold text-[#18261E] font-display mt-0.5">
              {purpose === 'farmer_subscription'
                ? 'Activate Monthly Farmer Plan'
                : 'Unlock Extended Consumer Scan Report'}
            </h2>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold font-mono tabular-nums text-[#18261E]">
              {formatInr(amountInr)}
            </span>
            <span className="block text-xs text-[#4B5563]">Inclusive of taxes</span>
          </div>
        </div>

        {/* Billing Rules Disclosure Before Payment */}
        <div className="bg-[#F9FBF9] border border-[#E5E7EB] rounded-xl p-4 text-xs sm:text-sm text-[#374151] space-y-1.5">
          <p className="font-semibold text-[#18261E]">Billing & Entitlement Disclosure:</p>
          {purpose === 'farmer_subscription' ? (
            <ul className="list-disc pl-5 space-y-1">
              <li>Charges ₹{amountInr} for 30 days of active farmer batch registration & QR label printing.</li>
              <li>Batches registered during an active period remain traceable permanently.</li>
              <li>Subscription activates only after server-side signature verification succeeds.</li>
            </ul>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                One-time ₹{amountInr} consumer scan fee unlocks cold-chain compliance & stage dwell
                analytics for this specific produce batch.
              </li>
              <li>
                Idempotent entitlement: refreshing the tracking page will never charge you again
                for this batch.
              </li>
              <li>Basic public farm origin and journey timeline remain free without payment.</li>
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!orderPayment ? (
          <button
            type="button"
            disabled={creatingOrder}
            onClick={handleCreateOrder}
            className="w-full py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
          >
            {creatingOrder
              ? 'Creating Server Payment Order...'
              : `Confirm & Proceed to Pay ${formatInr(amountInr)}`}
          </button>
        ) : (
          <div className="rounded-2xl border border-[#8BCF5B] bg-[#F1FAF0] p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1D6F34]">Server Order Created</span>
              <span className="font-mono text-[#18261E]">{orderPayment.providerOrderId}</span>
            </div>

            {!isLiveRazorpay ? (
              <div className="space-y-3">
                <p className="text-xs text-[#374151]">
                  <strong>Test Payment Gateway Controls:</strong> Choose an outcome below to test
                  server-side HMAC verification, failed payment handling, or user cancellation.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    disabled={processingGateway}
                    onClick={() => handleTestGatewayOutcome('success')}
                    className="py-2.5 px-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs font-semibold cursor-pointer"
                  >
                    {processingGateway ? 'Verifying...' : 'Authorize Test Payment'}
                  </button>
                  <button
                    type="button"
                    disabled={processingGateway}
                    onClick={() => handleTestGatewayOutcome('failed')}
                    className="py-2.5 px-3 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                  >
                    Simulate Bank Failure
                  </button>
                  <button
                    type="button"
                    disabled={processingGateway}
                    onClick={() => handleTestGatewayOutcome('cancelled')}
                    className="py-2.5 px-3 rounded-xl bg-white border border-[#E5E7EB] text-[#4B5563] text-xs font-semibold cursor-pointer"
                  >
                    Cancel Checkout
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#166534]">
                Order {orderPayment.providerOrderId} initialized with Razorpay Live API (Key:{' '}
                {systemConfig?.razorpayKeyId}). Complete checkout using Razorpay Checkout SDK
                integration.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (user) {
    return (
      <WorkspaceLayout title="Secure Payment Checkout" subtitle="Server-verified INR checkout.">
        {checkoutBody}
      </WorkspaceLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">{checkoutBody}</div>
    </PublicLayout>
  );
};

// ============================================================================
// 3. PAYMENT RESULT & RECEIPT PAGE (/payment/receipt/:paymentId)
// ============================================================================
export const PaymentReceiptPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { user } = useAuth();
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [scanRecord, setScanRecord] = useState<ConsumerScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    apiRequest<{ payment: PaymentRecord; scanRecord: ConsumerScanRecord | null }>(
      `/api/payments/receipt/${encodeURIComponent(paymentId)}`
    )
      .then((res) => {
        setPayment(res.payment);
        setScanRecord(res.scanRecord);
      })
      .catch((err) => setError((err as Error).message));
  }, [paymentId]);

  const receiptCard = error ? (
    <div className="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700">
      {error}
    </div>
  ) : !payment ? (
    <div className="max-w-lg mx-auto p-8 text-center text-sm text-[#4B5563]">
      Loading payment verification receipt...
    </div>
  ) : (
    <div className="max-w-xl mx-auto bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6 print-sheet">
      <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          {payment.verificationStatus === 'verified_paid' ? (
            <CheckCircle2 className="w-8 h-8 text-[#36A853]" />
          ) : payment.verificationStatus === 'failed' ? (
            <XCircle className="w-8 h-8 text-red-600" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          )}
          <div>
            <h2 className="text-xl font-bold text-[#18261E] font-display">
              {payment.verificationStatus === 'verified_paid'
                ? 'Payment Verified'
                : payment.verificationStatus === 'failed'
                  ? 'Payment Failed'
                  : 'Payment Cancelled / Pending'}
            </h2>
            <p className="text-xs font-mono text-[#4B5563]">{payment.receiptNumber}</p>
          </div>
        </div>
        <span className="text-2xl font-bold font-mono tabular-nums text-[#18261E]">
          {formatInr(payment.amountInr)}
        </span>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
          <span className="text-[#4B5563]">Purpose</span>
          <span className="font-medium text-[#18261E]">
            {payment.purpose === 'farmer_subscription'
              ? 'Farmer Monthly Subscription (30 Days)'
              : `Consumer Scan Unlock (${payment.relatedBatchCode || 'Batch'})`}
          </span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
          <span className="text-[#4B5563]">Provider Mode</span>
          <span className="font-mono text-xs">
            {payment.provider === 'razorpay_live'
              ? 'Razorpay Live'
              : 'TraceRoots Test Payment Sandbox'}
          </span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
          <span className="text-[#4B5563]">Order ID</span>
          <span className="font-mono text-xs">{payment.providerOrderId}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
          <span className="text-[#4B5563]">Transaction Ref</span>
          <span className="font-mono text-xs">
            {payment.providerPaymentId || 'Not completed'}
          </span>
        </div>
        {scanRecord && (
          <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]">
            <span className="text-[#4B5563]">Scan Entitlement ID</span>
            <span className="font-mono text-xs font-semibold text-[#1D6F34]">
              {scanRecord.scanCode}
            </span>
          </div>
        )}
        <div className="flex justify-between py-1.5">
          <span className="text-[#4B5563]">Timestamp</span>
          <span className="font-mono tabular-nums text-xs">
            {formatDisplayDateTime(payment.updatedAtUtc)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB] no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Receipt</span>
        </button>

        {payment.verificationStatus === 'verified_paid' ? (
          scanRecord ? (
            <Link
              to={`/track/${scanRecord.trackingToken}`}
              className="px-5 py-2.5 rounded-xl bg-[#36A853] text-white text-xs sm:text-sm font-semibold"
            >
              Open Unlocked Batch Report →
            </Link>
          ) : (
            <Link
              to="/farmer/register-produce"
              className="px-5 py-2.5 rounded-xl bg-[#36A853] text-white text-xs sm:text-sm font-semibold"
            >
              Register Produce Batch →
            </Link>
          )
        ) : (
          <Link
            to={
              payment.purpose === 'farmer_subscription'
                ? '/payment?purpose=farmer_subscription'
                : '/scan'
            }
            className="px-5 py-2.5 rounded-xl bg-[#18261E] text-white text-xs sm:text-sm font-semibold"
          >
            Retry Checkout
          </Link>
        )}
      </div>
    </div>
  );

  if (user) {
    return <WorkspaceLayout title="Payment Result & Receipt">{receiptCard}</WorkspaceLayout>;
  }
  return (
    <PublicLayout>
      <div className="py-12 px-4">{receiptCard}</div>
    </PublicLayout>
  );
};

// ============================================================================
// 4. IN-APP NOTIFICATION CENTRE (/notifications)
// ============================================================================
export const NotificationCentrePage: React.FC = () => {
  const { systemConfig, refreshAuth } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(() => {
    setLoading(true);
    apiRequest<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    await refreshAuth();
    loadNotifications();
  };

  const markSingleRead = async (id: string) => {
    await apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    });
    await refreshAuth();
    loadNotifications();
  };

  return (
    <WorkspaceLayout
      title="Notification Centre"
      subtitle="Real database-driven alerts for batch registrations, handoffs, subscriptions, and payments."
    >
      <div className="max-w-3xl space-y-6">
        <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#0369A1]">
          <span>
            External Email/SMS Status: SMTP (
            {systemConfig?.emailNotificationsConfigured ? 'Configured' : 'Not configured'}) · SMS (
            {systemConfig?.smsNotificationsConfigured ? 'Configured' : 'Not configured'}). In-app
            database notifications are always active.
          </span>
          {items.some((n) => !n.read) && (
            <button
              type="button"
              onClick={markAllRead}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#BAE6FD] font-semibold text-[#18261E] cursor-pointer"
            >
              Mark All Read
            </button>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">Loading notifications...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#4B5563] space-y-2">
              <Bell className="w-6 h-6 text-[#9CA3AF] mx-auto" />
              <p>You have no notifications yet.</p>
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  !n.read ? 'bg-[#F1FAF0]/60' : 'bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#18261E]">{n.title}</h3>
                    {!n.read && (
                      <span className="text-[11px] font-semibold text-[#1D6F34]">· Unread</span>
                    )}
                  </div>
                  <p className="text-sm text-[#374151]">{n.message}</p>
                  <p className="text-xs font-mono tabular-nums text-[#6B7280]">
                    {formatDisplayDateTime(n.createdAtUtc)}
                  </p>
                </div>

                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markSingleRead(n.id)}
                    className="text-xs font-semibold text-[#1D6F34] hover:underline shrink-0 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
};

// ============================================================================
// 5. PROFILE, CONSENT & ACCOUNT DELETION PAGE (/profile)
// ============================================================================
export const ProfileSettingsPage: React.FC = () => {
  const { user, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [address, setAddress] = useState(user?.address || '');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(user?.avatarDataUrl);
  const [publicFarmNameConsent, setPublicFarmNameConsent] = useState(
    user?.consentRecords.publicFarmNameConsent ?? true
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file, 256, 0.8);
    setAvatarDataUrl(compressed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          mobile,
          businessName,
          address,
          avatarDataUrl: avatarDataUrl || '',
          publicFarmNameConsent,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      await refreshAuth();
      setSavedMsg('Profile and privacy settings saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await apiRequest('/api/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ confirmText: deleteConfirmText }),
      });
      await logout();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <WorkspaceLayout
      title="Profile, Privacy & Account Settings"
      subtitle="Manage your participant details, public consent preferences, password, and data retention controls."
    >
      <div className="max-w-3xl space-y-8">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="rounded-xl bg-[#F1FAF0] border border-[#8BCF5B] p-4 text-sm text-[#166534]">
            {savedMsg}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-4 pb-4 border-b border-[#E5E7EB]">
            {avatarDataUrl ? (
              <img
                src={avatarDataUrl}
                alt={fullName}
                className="w-14 h-14 rounded-full object-cover border border-[#E5E7EB]"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#F1FAF0] border border-[#8BCF5B] flex items-center justify-center font-bold text-[#1D6F34]">
                {fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="space-y-1">
              <p className="font-bold text-[#18261E]">
                {user?.email}{' '}
                <span className="font-mono text-xs font-normal text-[#4B5563]">
                  ({user?.publicCode})
                </span>
              </p>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D6F34] cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" />
                <span>Update Profile Photo</span>
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-1">Mobile</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-1">
                Business / Farm / Shop Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#18261E] mb-1">
                Operating Location
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          {user?.role === 'farmer' && (
            <label className="flex items-start gap-2.5 text-xs text-[#4B5563] cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={publicFarmNameConsent}
                onChange={(e) => setPublicFarmNameConsent(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#36A853]"
              />
              <span>
                Consent to display Farm Name on public consumer QR tracking pages. (Unchecking
                withholds your farm name on newly registered batches.)
              </span>
            </label>
          )}

          <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
            <h3 className="text-sm font-bold text-[#18261E]">Change Password (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-sm"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>

        {/* Privacy-Compliant Account Deletion */}
        <form
          onSubmit={handleDeleteAccount}
          className="bg-white border border-red-200 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            <h3 className="text-base font-bold font-display">
              Account Deletion & Data Retention Policy
            </h3>
          </div>
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Deleting your account permanently redacts your email, phone number, address, and avatar
            from our user table. Historical supply-chain tracking events previously appended to
            produce batches are retained in anonymised form so downstream consumers do not lose
            food origin history.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-sm font-mono"
            />
            <button
              type="submit"
              disabled={deleting || deleteConfirmText !== 'DELETE'}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceLayout>
  );
};
