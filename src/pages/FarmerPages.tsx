import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  PackagePlus,
  Printer,
  QrCode,
  Upload,
} from 'lucide-react';
import { BrandLogoMark, ProduceArtworkThumb } from '../components/BrandLogo';
import { FreshnessBadgeInline } from '../components/FreshnessCard';
import { WorkspaceLayout } from '../components/Layout';
import { LocationTimeFields } from '../components/LocationTimeFields';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  compressImageFileToDataUrl,
  createIdempotencyKey,
  exportRowsToCsv,
  formatDisplayDateTime,
  formatInr,
  formatLocalDateInput,
  formatLocalTimeInput,
  formatStorageMethodLabel,
} from '../lib/api';
import type {
  FinancialTransaction,
  FreshnessEstimate,
  FreshnessParameter,
  LocationProvenance,
  ProduceBatch,
  ProduceUnit,
  StorageMethod,
  TrackingEvent,
} from '../shared/types';

interface EnrichedBatchItem {
  batch: ProduceBatch;
  eventCount: number;
  latestEvent: TrackingEvent | null;
  freshness: FreshnessEstimate;
  transactions: FinancialTransaction[];
}

export const FarmerDashboardPage: React.FC = () => {
  const { user, subscription } = useAuth();
  const [items, setItems] = useState<EnrichedBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDemo, setShowDemo] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<{ items: EnrichedBatchItem[] }>(`/api/batches?includeDemo=${showDemo}`)
      .then((res) => {
        if (active) setItems(res.items);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showDemo]);

  const totalBatches = items.length;
  const inTransitCount = items.filter(
    (x) =>
      x.batch.currentStatus === 'In Transit' ||
      x.batch.currentStatus === 'Dispatched by Wholesaler'
  ).length;
  const deliveredOrRetailCount = items.filter(
    (x) =>
      x.batch.currentStatus === 'At Retailer' ||
      x.batch.currentStatus === 'Delivered / Consumer Ready'
  ).length;

  // Aggregate quantity by produce category for clean visual chart
  const categoryTotals = items.reduce<Record<string, number>>((acc, cur) => {
    const k = cur.batch.category;
    acc[k] = (acc[k] || 0) + cur.batch.quantity;
    return acc;
  }, {});
  const maxCatQty = Math.max(1, ...Object.values(categoryTotals));

  const subActive = subscription?.status === 'active';

  return (
    <WorkspaceLayout
      title={`Welcome, ${user?.fullName || 'Farmer'}`}
      subtitle="Manage farm harvest batches, generate scannable QR crate labels, and inspect full supply-chain price histories."
    >
      <div className="space-y-8">
        {/* Subscription Banner */}
        <div
          className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            subActive
              ? 'bg-[#F1FAF0] border-[#8BCF5B]'
              : 'bg-[#FFFBEB] border-[#FFD166]'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#18261E]">
              Monthly Farmer Subscription ·{' '}
              <span className="capitalize">
                {subscription ? subscription.status : 'Not Activated'}
              </span>
            </div>
            <p className="text-sm text-[#374151]">
              {subActive && subscription ? (
                <>
                  Your ₹100/month plan is active until{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {subscription.renewalDateUtc.slice(0, 10)}
                  </span>
                  . Unlimited batch registrations & QR labels enabled.
                </>
              ) : (
                <>
                  Activate the ₹100/month Farmer Plan to register new produce batches. Previously
                  issued QR codes remain permanently traceable.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={subActive ? '/subscription' : '/payment?purpose=farmer_subscription'}
              className="px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              {subActive ? 'Manage Plan' : 'Activate Plan (₹100/mo)'}
            </Link>
          </div>
        </div>

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Total Batches Registered</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#18261E] mt-2">
              {totalBatches}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Currently In Transit</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0284C7] mt-2">
              {inTransitCount}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">At Retail / Delivered</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#36A853] mt-2">
              {deliveredOrRetailCount}
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <p className="text-xs font-medium text-[#4B5563]">Active QR Codes</p>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#18261E] mt-2">
              {totalBatches}
            </p>
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E5E7EB] rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/farmer/register-produce"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Register New Produce</span>
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              <span>View All Records</span>
            </Link>
            <Link
              to="/farmer/price-history"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#EFF8FF] text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0284C7]" />
              <span>Complete Price History</span>
            </Link>
          </div>

          {user?.isDemo && (
            <label className="inline-flex items-center gap-2 text-xs text-[#4B5563] cursor-pointer">
              <input
                type="checkbox"
                checked={showDemo}
                onChange={(e) => setShowDemo(e.target.checked)}
                className="rounded border-gray-300 text-[#36A853]"
              />
              <span>Include [DEMO] sample batches</span>
            </label>
          )}
        </div>

        {/* Produce Volume Breakdown Chart */}
        {Object.keys(categoryTotals).length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#18261E] font-display">
              Registered Produce Volume by Category
            </h2>
            <div className="space-y-3">
              {Object.entries(categoryTotals).map(([cat, qty]) => {
                const pct = Math.max(8, Math.round((qty / maxCatQty) * 100));
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#18261E]">{cat}</span>
                      <span className="font-mono tabular-nums text-[#4B5563]">{qty} units</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F1FAF0] rounded-full overflow-hidden">
                      <svg className="w-full h-full" preserveAspectRatio="none">
                        <rect
                          x="0"
                          y="0"
                          width={`${pct}%`}
                          height="100%"
                          rx="4"
                          fill="#36A853"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Registered Batches Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="text-base font-bold text-[#18261E] font-display">
              Your Registered Produce Batches
            </h2>
            <span className="text-xs text-[#4B5563] font-mono tabular-nums">
              {items.length} batch{items.length === 1 ? '' : 'es'}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">
              Loading registered produce records...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-[#4B5563]">
                You have not registered any produce batches yet.
              </p>
              <Link
                to="/farmer/register-produce"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold"
              >
                <PackagePlus className="w-4 h-4" />
                <span>Register First Produce Batch</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs font-semibold text-[#4B5563]">
                    <th className="py-3 px-4">Produce & Batch ID</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Harvest Date</th>
                    <th className="py-3 px-4">Status & Handoffs</th>
                    <th className="py-3 px-4">Estimated Freshness</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {items.map(({ batch, eventCount, freshness }) => (
                    <tr key={batch.id} className="hover:bg-[#F1FAF0]/40 transition-colors">
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
                                <span className="ml-2 text-[11px] font-normal text-[#B45309]">
                                  · Demo Data
                                </span>
                              )}
                            </p>
                            <p className="text-xs font-mono text-[#4B5563]">{batch.batchCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {batch.quantity} {batch.unit}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                        {batch.harvestDate}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#18261E]">
                        <span className="font-medium">{batch.currentStatus}</span>
                        <span className="text-[#6B7280]"> · {eventCount} events</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <FreshnessBadgeInline freshness={freshness} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/farmer/qr-label/${batch.batchCode}`}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs font-medium whitespace-nowrap"
                          >
                            QR Label
                          </Link>
                          <Link
                            to={`/batches/${batch.batchCode}`}
                            className="px-2.5 py-1.5 rounded-lg bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Full History
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
      </div>
    </WorkspaceLayout>
  );
};

export const RegisterProducePage: React.FC = () => {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<FreshnessParameter[]>([]);
  const [farmName, setFarmName] = useState(user?.businessName || '');
  const [farmerContact, setFarmerContact] = useState(user?.mobile || '');
  const [farmLocation, setFarmLocation] = useState(user?.address || '');

  const [produceName, setProduceName] = useState('');
  const [category, setCategory] = useState('Tomatoes & Fruit Vegetables');
  const [variety, setVariety] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<ProduceUnit>('kg');
  const [harvestDate, setHarvestDate] = useState(formatLocalDateInput());
  const [harvestTime, setHarvestTime] = useState('07:00');
  const [expectedShelfLifeDays, setExpectedShelfLifeDays] = useState('');
  const [storageMethod, setStorageMethod] = useState<StorageMethod>('ventilated_crate');
  const [storageTemperatureC, setStorageTemperatureC] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [qualityNotes, setQualityNotes] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);

  // Automatic local date/time & non-intrusive GPS location detection
  const [departureLocation, setDepartureLocation] = useState(user?.address || '');
  const [departureProvenance, setDepartureProvenance] =
    useState<LocationProvenance>('manual_entry');
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [departureDate, setDepartureDate] = useState(formatLocalDateInput());
  const [departureTime, setDepartureTime] = useState(formatLocalTimeInput());
  const [destination, setDestination] = useState('');
  const [transportMethod, setTransportMethod] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');

  // Track if user manually edited departureLocation so auto-GPS NEVER overwrites manual edits
  const userEditedDepartureRef = useRef(false);

  const [idempotencyKey] = useState(() => createIdempotencyKey('batch'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ parameters: FreshnessParameter[] }>('/api/freshness-parameters')
      .then((res) => {
        setCategories(res.parameters);
        if (res.parameters.length > 0) {
          setCategory(res.parameters[0].category);
        }
      })
      .catch(() => {});

    // Attempt initial browser GPS lookup if permitted without overwriting manual edits
    if ('geolocation' in navigator && !user?.address) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (userEditedDepartureRef.current) return;
          try {
            const res = await apiRequest<{
              formattedAddress: string;
              coordinates: { lat: number; lng: number };
              provenance: LocationProvenance;
            }>(
              `/api/geocode/reverse?lat=${encodeURIComponent(pos.coords.latitude)}&lng=${encodeURIComponent(pos.coords.longitude)}`
            );
            if (!userEditedDepartureRef.current) {
              setDepartureLocation(res.formattedAddress);
              setDepartureProvenance(res.provenance);
              setDepartureCoords(res.coordinates);
              if (!farmLocation) setFarmLocation(res.formattedAddress);
            }
          } catch {
            // Silent fallback to manual entry
          }
        },
        () => {
          // Permission denied or unavailable; manual input stays ready
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 720, 0.78);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ batch: ProduceBatch }>('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,
          farmName,
          farmerContact,
          farmLocation,
          produceName,
          category,
          variety,
          quantity: Number(quantity),
          unit,
          harvestDate,
          harvestTime,
          expectedShelfLifeDays,
          storageMethod,
          storageTemperatureC,
          batchDescription,
          qualityNotes,
          imageDataUrl,
          departureLocation,
          departureLocationProvenance: departureProvenance,
          departureCoordinates: departureCoords,
          departureDate,
          departureTime,
          destination,
          transportMethod,
          vehicleDetails,
        }),
      });
      navigate(`/farmer/batch-success/${res.batch.batchCode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const subActive = subscription?.status === 'active';

  return (
    <WorkspaceLayout
      title="Register New Produce Batch"
      subtitle="Create a traceable farm harvest record and generate a unique QR code for crates and sacks."
    >
      <div className="max-w-4xl space-y-6">
        {!subActive && (
          <div className="rounded-2xl bg-[#FFFBEB] border border-[#FFD166] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#92400E] font-display">
                Active Farmer Subscription Required (₹100 / month)
              </h2>
              <p className="text-sm text-[#78350F]">
                Please activate or renew your ₹100/month Farmer Subscription before submitting a
                new produce batch.
              </p>
            </div>
            <Link
              to="/payment?purpose=farmer_subscription"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold shrink-0"
            >
              <CreditCard className="w-4 h-4" />
              <span>Activate Plan (₹100)</span>
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Farmer Information */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#18261E] font-display border-b border-[#E5E7EB] pb-3">
              1. Farmer & Origin Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Farmer Full Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.fullName || ''}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-gray-50 px-3.5 py-2.5 text-sm text-[#4B5563]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Farmer ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.publicCode || ''}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-gray-50 px-3.5 py-2.5 text-sm font-mono text-[#4B5563]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Farm Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. Sahyadri Green Valley Farms"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Contact Information (Private — Not Public) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmerContact}
                  onChange={(e) => setFarmerContact(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Farm Location (Village, Taluka, District, State) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder="e.g. Niphad Taluka, Nashik, Maharashtra"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Produce Information */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#18261E] font-display border-b border-[#E5E7EB] pb-3">
              2. Produce & Harvest Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Produce Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={produceName}
                  onChange={(e) => setProduceName(e.target.value)}
                  placeholder="e.g. Vine-Ripened Roma Tomatoes"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Produce Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
                >
                  {(categories.length > 0
                    ? categories.map((c) => c.category)
                    : [
                        'Leafy Vegetables',
                        'Root Vegetables',
                        'Tomatoes & Fruit Vegetables',
                        'Apples & Temperate Fruits',
                        'Bananas & Tropical Fruits',
                        'Potatoes & Onions',
                        'Grains & Pulses',
                        'Other Produce',
                      ]
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Variety (Optional)
                </label>
                <input
                  type="text"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="e.g. Ratnagiri Alphonso / Hybrid F1"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                    Quantity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="250"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#18261E] mb-1.5">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as ProduceUnit)}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="quintal">quintal</option>
                    <option value="tonne">tonne</option>
                    <option value="crate">crate</option>
                    <option value="other">other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Harvest Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Harvest Time (Optional)
                </label>
                <input
                  type="time"
                  value={harvestTime}
                  onChange={(e) => setHarvestTime(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Storage Method
                </label>
                <select
                  value={storageMethod}
                  onChange={(e) => setStorageMethod(e.target.value as StorageMethod)}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
                >
                  <option value="ventilated_crate">Ventilated Crates</option>
                  <option value="cold_storage">Farm Cold Storage</option>
                  <option value="refrigerated_transport">Precooling + Reefer</option>
                  <option value="controlled_atmosphere">Controlled Atmosphere</option>
                  <option value="dry_warehouse">Dry Ventilated Warehouse</option>
                  <option value="ambient">Ambient Field Shade</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                    Expected Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={expectedShelfLifeDays}
                    onChange={(e) => setExpectedShelfLifeDays(e.target.value)}
                    placeholder="Auto by crop"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                    Pack Temp (°C, Optional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={storageTemperatureC}
                    onChange={(e) => setStorageTemperatureC(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Batch Description
                </label>
                <textarea
                  rows={2}
                  value={batchDescription}
                  onChange={(e) => setBatchDescription(e.target.value)}
                  placeholder="Describe growing practices, sorting grade, or packaging format..."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Handling & Quality Notes (Printed on Label & Timeline)
                </label>
                <input
                  type="text"
                  value={qualityNotes}
                  onChange={(e) => setQualityNotes(e.target.value)}
                  placeholder="e.g. Keep dry and cool between 10–13°C; do not stack >5 crates high."
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Optional Produce Image
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FBF9] hover:bg-[#F1FAF0] text-xs font-medium cursor-pointer">
                    <Upload className="w-4 h-4 text-[#36A853]" />
                    <span>Upload Produce Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  {imageDataUrl && (
                    <img
                      src={imageDataUrl}
                      alt="Produce preview"
                      className="w-14 h-14 rounded-xl object-cover border border-[#E5E7EB]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Departure Information with Automatic Date, Time & GPS */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#18261E] font-display border-b border-[#E5E7EB] pb-3">
              3. Farm Departure & Dispatch Information
            </h2>

            <LocationTimeFields
              labelPrefix="Departure"
              locationValue={departureLocation}
              provenance={departureProvenance}
              onLocationChange={(loc, prov, coords) => {
                if (prov === 'manual_entry') {
                  userEditedDepartureRef.current = true;
                }
                setDepartureLocation(loc);
                setDepartureProvenance(prov);
                setDepartureCoords(coords || null);
              }}
              dateValue={departureDate}
              onDateChange={setDepartureDate}
              timeValue={departureTime}
              onTimeChange={setDepartureTime}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Destination (if known)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Pune APMC Market"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Transport Method
                </label>
                <input
                  type="text"
                  value={transportMethod}
                  onChange={(e) => setTransportMethod(e.target.value)}
                  placeholder="e.g. Insulated Pickup Van"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18261E] mb-1.5">
                  Vehicle / Transporter Details
                </label>
                <input
                  type="text"
                  value={vehicleDetails}
                  onChange={(e) => setVehicleDetails(e.target.value)}
                  placeholder="e.g. MH-15-JC-4821"
                  className="w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/farmer"
              className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#4B5563]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !subActive}
              className="px-6 py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Generating Batch & QR...' : 'Register Batch & Generate QR Code'}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceLayout>
  );
};

interface QrPayload {
  batchCode: string;
  trackingToken: string;
  trackingUrl: string;
  pngDataUrl: string;
  svgMarkup: string;
}

export const BatchSuccessPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<ProduceBatch | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    Promise.all([
      apiRequest<{ batch: ProduceBatch }>(`/api/batches/${encodeURIComponent(batchId)}`),
      apiRequest<QrPayload>(`/api/batches/${encodeURIComponent(batchId)}/qr`),
    ])
      .then(([bRes, qRes]) => {
        setBatch(bRes.batch);
        setQr(qRes);
      })
      .catch((err) => setError((err as Error).message));
  }, [batchId]);

  const downloadPng = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.pngDataUrl;
    a.download = `${qr.batchCode}-QR.png`;
    a.click();
  };

  const downloadSvg = () => {
    if (!qr) return;
    const blob = new Blob([qr.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qr.batchCode}-QR.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <WorkspaceLayout title="Produce Registered Successfully!">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700">
          {error}
        </div>
      ) : !batch || !qr ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-sm text-[#4B5563]">
          Generating cryptographic tracking token and QR code...
        </div>
      ) : (
        <div className="max-w-3xl bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3 pb-4 border-b border-[#E5E7EB]">
            <CheckCircle2 className="w-8 h-8 text-[#36A853] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-2xl font-bold text-[#18261E] font-display">
                Produce Registered Successfully!
              </h2>
              <p className="text-sm text-[#4B5563] mt-0.5">
                Attach this unique QR code to your produce crates or bags before dispatch.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 flex flex-col items-center bg-[#F1FAF0] border border-[#8BCF5B] rounded-2xl p-5">
              <img
                src={qr.pngDataUrl}
                alt={`QR Code for ${batch.batchCode}`}
                className="w-48 h-48 rounded-xl bg-white p-2 border border-[#E5E7EB]"
              />
              <p className="mt-3 text-xs font-mono font-semibold text-[#18261E]">
                {batch.batchCode}
              </p>
            </div>

            <div className="md:col-span-7 space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                <span className="text-[#4B5563]">Batch ID</span>
                <span className="font-mono font-bold text-[#18261E]">{batch.batchCode}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                <span className="text-[#4B5563]">Produce Name</span>
                <span className="font-semibold text-[#18261E]">
                  {batch.produceName} ({batch.quantity} {batch.unit})
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                <span className="text-[#4B5563]">Harvest Date</span>
                <span className="font-mono tabular-nums text-[#18261E]">{batch.harvestDate}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                <span className="text-[#4B5563]">Farmer / Farm</span>
                <span className="text-[#18261E]">{batch.farmName || batch.farmerName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
                <span className="text-[#4B5563]">Registration Timestamp</span>
                <span className="font-mono tabular-nums text-xs text-[#18261E]">
                  {formatDisplayDateTime(batch.createdAtUtc)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR (PNG)</span>
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-sm font-semibold cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[#36A853]" />
              <span>Download SVG</span>
            </button>
            <Link
              to={`/farmer/qr-label/${batch.batchCode}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18261E] hover:bg-[#283E31] text-white text-sm font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>Print QR Label</span>
            </Link>
            <Link
              to={`/track/${batch.trackingToken}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#EFF8FF] text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4 text-[#0284C7]" />
              <span>View Tracking Page</span>
            </Link>
            <Link
              to="/farmer/register-produce"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium"
            >
              <span>Register Another Batch</span>
            </Link>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
};

export const QrLabelPrintPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<ProduceBatch | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [layoutMode, setLayoutMode] = useState<'single' | 'a4_quad'>('single');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    Promise.all([
      apiRequest<{ batch: ProduceBatch }>(`/api/batches/${encodeURIComponent(batchId)}`),
      apiRequest<QrPayload>(`/api/batches/${encodeURIComponent(batchId)}/qr`),
    ])
      .then(([bRes, qRes]) => {
        setBatch(bRes.batch);
        setQr(qRes);
      })
      .catch((err) => setError((err as Error).message));
  }, [batchId]);

  const downloadPng = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.pngDataUrl;
    a.download = `${qr.batchCode}-Label-QR.png`;
    a.click();
  };

  const downloadSvg = () => {
    if (!qr) return;
    const blob = new Blob([qr.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qr.batchCode}-Label-QR.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSingleLabelCard = (idx: number) => {
    if (!batch || !qr) return null;
    return (
      <div
        key={idx}
        className="print-sheet bg-white border-2 border-[#18261E] rounded-2xl p-6 max-w-md w-full space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2 font-display font-bold text-[#18261E]">
            <BrandLogoMark className="w-7 h-7" />
            <span>TraceRoots</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#18261E]">{batch.batchCode}</span>
        </div>

        <div className="flex items-center gap-5">
          <img
            src={qr.pngDataUrl}
            alt={`QR Code for ${batch.batchCode}`}
            className="w-36 h-36 border border-[#E5E7EB] rounded-lg p-1 shrink-0"
          />
          <div className="space-y-1.5 text-xs">
            <p className="text-base font-bold text-[#18261E] font-display">{batch.produceName}</p>
            <p className="text-[#374151]">
              <strong>Origin:</strong> {batch.farmName || batch.farmerName}
            </p>
            <p className="text-[#374151] font-mono tabular-nums">
              <strong>Harvest:</strong> {batch.harvestDate}
            </p>
            <p className="text-[#374151] font-mono tabular-nums">
              <strong>Net Qty:</strong> {batch.quantity} {batch.unit}
            </p>
            <p className="text-[#374151]">
              <strong>Storage:</strong> {formatStorageMethodLabel(batch.storageMethod)}
            </p>
          </div>
        </div>

        {batch.qualityNotes && (
          <p className="text-[11px] text-[#374151] bg-gray-50 border border-[#E5E7EB] rounded-lg px-3 py-2">
            <strong>Handling:</strong> {batch.qualityNotes}
          </p>
        )}

        <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between text-xs font-semibold text-[#1D6F34]">
          <span>Scan to trace this produce.</span>
          <span className="font-mono text-[10px] text-[#4B5563]">traceroots/track</span>
        </div>
      </div>
    );
  };

  return (
    <WorkspaceLayout
      title="Printable QR Crate Label"
      subtitle="Print cleanly on A4 sheets or thermal/adhesive crate labels. Navigation menus hide automatically in print mode."
    >
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700">
          {error}
        </div>
      ) : !batch || !qr ? (
        <div className="p-8 text-sm text-[#4B5563]">Preparing printable QR label...</div>
      ) : (
        <div className="space-y-6">
          {/* Controls hidden when printing */}
          <div className="no-print bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-[#F1FAF0] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLayoutMode('single')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  layoutMode === 'single' ? 'bg-white text-[#18261E] shadow-xs' : 'text-[#4B5563]'
                }`}
              >
                Single Crate Label
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('a4_quad')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  layoutMode === 'a4_quad' ? 'bg-white text-[#18261E] shadow-xs' : 'text-[#4B5563]'
                }`}
              >
                A4 4-Up Label Sheet
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={downloadPng}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold hover:bg-[#F1FAF0] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold hover:bg-[#F1FAF0] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SVG</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Label Now</span>
              </button>
            </div>
          </div>

          {layoutMode === 'single' ? (
            <div className="flex justify-center py-4">{renderSingleLabelCard(0)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
              {[0, 1, 2, 3].map((idx) => renderSingleLabelCard(idx))}
            </div>
          )}
        </div>
      )}
    </WorkspaceLayout>
  );
};

export const FarmerPriceHistoryPage: React.FC = () => {
  const [records, setRecords] = useState<
    Array<{ batch: ProduceBatch; transactions: FinancialTransaction[] }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{
      records: Array<{ batch: ProduceBatch; transactions: FinancialTransaction[] }>;
    }>('/api/farmer/price-history')
      .then((res) => setRecords(res.records))
      .finally(() => setLoading(false));
  }, []);

  const handleExportCsv = () => {
    const rows: Array<Array<string | number | null>> = [];
    for (const r of records) {
      for (const t of r.transactions) {
        rows.push([
          r.batch.batchCode,
          r.batch.produceName,
          t.referenceCode,
          t.participantRole,
          t.participantBusiness,
          t.quantity,
          t.unit,
          t.purchasePricePerUnit,
          t.totalPurchasePrice,
          t.sellingPricePerUnit,
          t.expectedTotalSellingValue,
          t.createdAtUtc,
        ]);
      }
    }
    exportRowsToCsv(
      `TraceRoots-Farmer-Price-History-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Batch ID',
        'Produce',
        'Txn Ref',
        'Stage Role',
        'Business Name',
        'Quantity',
        'Unit',
        'Purchase Price / Unit (INR)',
        'Total Purchase (INR)',
        'Selling Price / Unit (INR)',
        'Expected Selling Total (INR)',
        'Timestamp UTC',
      ],
      rows
    );
  };

  return (
    <WorkspaceLayout
      title="Farmer Complete Price History"
      subtitle="Confidential farmer-only visibility into purchase and selling prices recorded across every stage of your registered batches."
    >
      <div className="space-y-6">
        <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-[#0369A1]">
            <strong>Strict Backend Price Privacy Rule:</strong> Only the registering farmer of a
            batch can view multi-stage prices across wholesalers and retailers. Public QR pages and
            consumers never see financial figures.
          </p>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#BAE6FD] text-xs font-semibold text-[#18261E] hover:bg-[#F1FAF0] shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#36A853]" />
            <span>Export Price Ledger (CSV)</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#4B5563]">
            Loading confidential batch price histories...
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center text-sm text-[#4B5563]">
            No registered batches found yet.
          </div>
        ) : (
          records.map(({ batch, transactions }) => (
            <div
              key={batch.id}
              className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#F9FBF9] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#18261E] font-display">
                    {batch.produceName}{' '}
                    <span className="font-mono text-xs font-normal text-[#4B5563]">
                      ({batch.batchCode})
                    </span>
                    {batch.isDemo && (
                      <span className="ml-2 text-xs font-normal text-[#B45309]">· Demo Data</span>
                    )}
                  </h3>
                  <p className="text-xs text-[#4B5563]">
                    Registered Volume: {batch.quantity} {batch.unit} · Harvested {batch.harvestDate}
                  </p>
                </div>
                <Link
                  to={`/batches/${batch.batchCode}`}
                  className="text-xs font-semibold text-[#1D6F34] hover:underline"
                >
                  Open Full Batch Timeline →
                </Link>
              </div>

              {transactions.length === 0 ? (
                <div className="p-6 text-sm text-[#4B5563]">
                  No downstream wholesaler or retailer financial transactions recorded for this
                  batch yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-xs font-semibold text-[#4B5563]">
                        <th className="py-3 px-4">Stage & Business</th>
                        <th className="py-3 px-4">Ref</th>
                        <th className="py-3 px-4 text-right">Quantity</th>
                        <th className="py-3 px-4 text-right">Purchase / Unit</th>
                        <th className="py-3 px-4 text-right">Total Purchase</th>
                        <th className="py-3 px-4 text-right">Selling / Unit</th>
                        <th className="py-3 px-4">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-sm">
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="hover:bg-[#F1FAF0]/30">
                          <td className="py-3 px-4">
                            <span className="capitalize font-semibold text-[#18261E]">
                              {txn.participantRole}
                            </span>
                            <span className="text-[#4B5563]"> · {txn.participantBusiness}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#4B5563]">
                            {txn.referenceCode}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {txn.quantity} {txn.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#18261E]">
                            {formatInr(txn.purchasePricePerUnit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4B5563]">
                            {formatInr(txn.totalPurchasePrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#1D6F34]">
                            {txn.sellingPricePerUnit !== null
                              ? formatInr(txn.sellingPricePerUnit)
                              : 'Not listed'}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#4B5563]">
                            {formatDisplayDateTime(txn.createdAtUtc)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </WorkspaceLayout>
  );
};
