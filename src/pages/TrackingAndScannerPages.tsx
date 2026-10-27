import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  AlertTriangle,
  Bookmark,
  Camera,
  CameraOff,
  CheckCircle2,
  Download,
  FilePlus2,
  Lock,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ProduceArtworkThumb } from '../components/BrandLogo';
import { FreshnessBadgeInline, FreshnessCard } from '../components/FreshnessCard';
import { HandoffEventForm } from '../components/HandoffEventForm';
import { PublicLayout, WorkspaceLayout } from '../components/Layout';
import { SupplyChainTimeline } from '../components/SupplyChainTimeline';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  createIdempotencyKey,
  exportRowsToCsv,
  formatDisplayDateTime,
  formatInr,
  formatStorageMethodLabel,
} from '../lib/api';
import { calculateFreshnessEstimate, FOOD_SAFETY_DISCLAIMER } from '../shared/freshness';
import type {
  FinancialTransaction,
  FreshnessBand,
  FreshnessEstimate,
  FreshnessParameter,
  ProduceBatch,
  PublicTrackingResponse,
  StorageMethod,
  TrackingEvent,
} from '../shared/types';

// ============================================================================
// 1. INTEGRATED QR CAMERA & MANUAL SCANNER PAGE (/scan)
// ============================================================================
export const QrScannerPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedLockRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manualQuery, setManualQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [scannedBatch, setScannedBatch] = useState<{
    id: string;
    batchCode: string;
    trackingToken: string;
    produceName: string;
    category: string;
    quantity: number;
    unit: ProduceBatch['unit'];
    storageMethod: StorageMethod;
    currentStatus: string;
    farmerDisplayName: string;
    harvestDate: string;
    isDemo: boolean;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const resolveScannedInput = useCallback(
    async (rawText: string) => {
      if (!rawText.trim()) return;
      setScanError(null);
      setResolving(true);
      try {
        const resolved = await apiRequest<{
          trackingToken: string;
          batchCode: string;
        }>(`/api/public/resolve/${encodeURIComponent(rawText.trim())}`);

        // Fetch public summary + internal ID if authenticated for handoff
        const pubData = await apiRequest<PublicTrackingResponse>(
          `/api/public/track/${encodeURIComponent(resolved.trackingToken)}`
        );

        let batchInternalId = resolved.batchCode;
        if (user) {
          try {
            const authedDetail = await apiRequest<{ batch: ProduceBatch }>(
              `/api/batches/${encodeURIComponent(resolved.batchCode)}`
            );
            batchInternalId = authedDetail.batch.id;
          } catch {
            // Consumer or restricted role uses batchCode
          }
        }

        setScannedBatch({
          id: batchInternalId,
          batchCode: pubData.batch.batchCode,
          trackingToken: pubData.batch.trackingToken,
          produceName: pubData.batch.produceName,
          category: pubData.batch.category,
          quantity: pubData.batch.quantity,
          unit: pubData.batch.unit,
          storageMethod: pubData.batch.storageMethod,
          currentStatus: pubData.batch.currentStatus,
          farmerDisplayName: pubData.batch.farmerDisplayName,
          harvestDate: pubData.batch.harvestDate,
          isDemo: pubData.batch.isDemo,
        });
      } catch (err) {
        setScanError((err as Error).message);
        scannedLockRef.current = false;
      } finally {
        setResolving(false);
      }
    },
    [user]
  );

  const startCamera = async (preferredDeviceId?: string) => {
    setCameraError(null);
    setScanError(null);
    scannedLockRef.current = false;
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera access is not supported in this browser. Use QR Image Upload or Manual Batch ID entry below.'
      );
      return;
    }

    try {
      const videoConstraints: MediaTrackConstraints = preferredDeviceId
        ? { deviceId: { exact: preferredDeviceId } }
        : { facingMode: { ideal: 'environment' } };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const scanLoop = () => {
        if (!videoRef.current || !canvasRef.current || scannedLockRef.current) return;
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (decoded && decoded.data) {
              scannedLockRef.current = true;
              stopCamera();
              resolveScannedInput(decoded.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };

      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      const domErr = err as DOMException;
      if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
        setCameraError(
          'Camera permission was denied. Please grant camera access in browser settings, upload a QR image, or enter the Batch ID manually.'
        );
      } else {
        setCameraError(
          'Unable to open camera on this device. You can upload a downloaded QR code image or type the Batch ID below.'
        );
      }
    }
  };

  const handleQrImageFileScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          resolveScannedInput(code.data);
        } else {
          setScanError(
            'No valid QR code was detected in that image. Try a clearer QR image or enter the Batch ID manually.'
          );
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const canRecordHandoff =
    user &&
    (user.role === 'wholesaler' ||
      user.role === 'retailer' ||
      user.role === 'transporter' ||
      user.role === 'partner');

  const content = (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#18261E] font-display">
              Scan Produce QR Code
            </h2>
            <p className="text-sm text-[#4B5563] mt-0.5">
              Camera permission is requested only when you click Start Camera. You can also scan a
              saved QR image or enter a Batch ID directly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {!cameraActive ? (
              <button
                type="button"
                onClick={() => startCamera(selectedDeviceId || undefined)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera Scanner</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            )}

            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FBF9] hover:bg-[#F1FAF0] text-sm font-medium text-[#18261E] cursor-pointer">
              <Upload className="w-4 h-4 text-[#36A853]" />
              <span>Scan QR Image File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageFileScan}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {devices.length > 1 && cameraActive && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#4B5563]">Camera Lens:</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                startCamera(e.target.value);
              }}
              className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Camera Viewport */}
        <div
          className={`${
            cameraActive ? 'block' : 'hidden'
          } relative rounded-2xl overflow-hidden border-2 border-[#36A853] bg-gray-900 max-w-md mx-auto`}
        >
          <video ref={videoRef} playsInline muted className="w-full h-72 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-xs px-4 py-2 text-center">
            Scanning for TraceRoots QR code... Hold steady 15–25 cm from label.
          </div>
        </div>

        {cameraError && (
          <div className="rounded-xl bg-[#FFF7ED] border border-[#FED7AA] p-4 flex items-start gap-2.5 text-xs sm:text-sm text-[#9A3412]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>{cameraError}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className="underline font-semibold cursor-pointer"
              >
                Retry Camera Permission
              </button>
            </div>
          </div>
        )}

        {/* Manual Batch ID or URL Lookup */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            resolveScannedInput(manualQuery);
          }}
          className="pt-4 border-t border-[#E5E7EB] space-y-2"
        >
          <label className="block text-sm font-medium text-[#18261E]">
            Manual Batch ID, Tracking Token, or Tracking URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="e.g. FT-2026-DEMO8492 or /track/..."
              className="flex-1 rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
            />
            <button
              type="submit"
              disabled={resolving}
              className="px-5 py-2.5 rounded-xl bg-[#18261E] hover:bg-[#283E31] text-white text-sm font-semibold cursor-pointer"
            >
              {resolving ? 'Looking Up...' : 'Lookup Batch'}
            </button>
          </div>
          <div className="text-xs text-[#4B5563]">
            Quick demo test:{' '}
            <button
              type="button"
              onClick={() => {
                setManualQuery('FT-2026-DEMO8492');
                resolveScannedInput('FT-2026-DEMO8492');
              }}
              className="font-mono font-semibold text-[#1D6F34] underline cursor-pointer"
            >
              Load FT-2026-DEMO8492
            </button>
          </div>
        </form>

        {scanError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{scanError}</span>
            <Link
              to={`/invalid-qr?q=${encodeURIComponent(manualQuery)}`}
              className="text-xs font-semibold underline shrink-0"
            >
              Troubleshooting →
            </Link>
          </div>
        )}
      </div>

      {/* Scanned Batch Summary & Role Action */}
      {scannedBatch && (
        <div className="space-y-6">
          <div className="bg-[#F1FAF0] border border-[#8BCF5B] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1D6F34]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Batch Verified in TraceRoots Registry</span>
                {scannedBatch.isDemo && (
                  <span className="text-[#B45309]">· Demo Record</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#18261E] font-display">
                {scannedBatch.produceName} ({scannedBatch.quantity} {scannedBatch.unit})
              </h3>
              <p className="text-xs text-[#374151]">
                Batch ID <span className="font-mono font-semibold">{scannedBatch.batchCode}</span> ·
                Origin: {scannedBatch.farmerDisplayName} · Harvested {scannedBatch.harvestDate} ·
                Status: {scannedBatch.currentStatus}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                to={`/track/${scannedBatch.trackingToken}`}
                className="px-4 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold whitespace-nowrap"
              >
                Open Public Tracking Page
              </Link>
              {user && user.role !== 'consumer' && (
                <Link
                  to={`/batches/${scannedBatch.batchCode}`}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-sm font-semibold text-[#18261E] whitespace-nowrap"
                >
                  Batch Details
                </Link>
              )}
            </div>
          </div>

          {canRecordHandoff && (
            <HandoffEventForm
              batch={scannedBatch}
              onSuccess={() => navigate(`/batches/${scannedBatch.batchCode}`)}
              onCancel={() => setScannedBatch(null)}
            />
          )}
        </div>
      )}
    </div>
  );

  if (user) {
    return (
      <WorkspaceLayout
        title="QR Code Scanner & Batch Lookup"
        subtitle="Scan a batch QR code to inspect provenance or append your supply-chain arrival and departure event."
      >
        {content}
      </WorkspaceLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-10 px-4 sm:px-6 lg:px-8">{content}</div>
    </PublicLayout>
  );
};

// ============================================================================
// 2. PUBLIC CONSUMER TRACKING PAGE (/track/:token)
// ============================================================================
export const PublicTrackingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshAuth } = useAuth();

  const [data, setData] = useState<PublicTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<PublicTrackingResponse>(`/api/public/track/${encodeURIComponent(token)}`)
      .then((res) => setData(res))
      .catch(() => {
        navigate(`/invalid-qr?q=${encodeURIComponent(token)}`, { replace: true });
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const handleToggleSave = async () => {
    if (!user || !data) return;
    setSavingBookmark(true);
    try {
      await apiRequest('/api/auth/save-batch', {
        method: 'POST',
        body: JSON.stringify({ trackingToken: data.batch.trackingToken }),
      });
      await refreshAuth();
    } finally {
      setSavingBookmark(false);
    }
  };

  if (loading || !data) {
    return (
      <PublicLayout>
        <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-[#4B5563]">
          Loading verified public traceability timeline...
        </div>
      </PublicLayout>
    );
  }

  const { batch, events, freshness, missingStages, paidConsumerUnlocked, paidConsumerAnalytics } =
    data;

  const lastEvent = events[events.length - 1];
  const currentKnownLocation =
    lastEvent?.arrivalLocation || lastEvent?.departureLocation || batch.farmLocation;

  const isSaved = user?.savedBatchTokens.includes(batch.trackingToken);

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {batch.isDemo && (
          <div className="rounded-xl bg-[#FFFBEB] border border-[#FFD166] px-4 py-3 text-xs sm:text-sm text-[#92400E]">
            <strong>[DEMO DATA RECORD]:</strong> This batch ({batch.batchCode}) is a pre-seeded
            demonstration record clearly separated from live production farm records.
          </div>
        )}

        {/* Batch Origin Hero Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <ProduceArtworkThumb
                category={batch.category}
                produceName={batch.produceName}
                imageDataUrl={batch.imageDataUrl}
                className="w-20 h-20"
              />
              <div className="space-y-1.5">
                <div className="text-xs text-[#4B5563]">
                  <span>{batch.category}</span>
                  {batch.variety && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span>{batch.variety}</span>
                    </>
                  )}
                  <span className="mx-1.5">·</span>
                  <span className="font-mono font-semibold text-[#18261E]">
                    {batch.batchCode}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#18261E] font-display">
                  {batch.produceName}
                </h1>
                <p className="text-sm text-[#374151]">
                  Origin: <strong>{batch.farmerDisplayName}</strong> ({batch.farmLocation})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 no-print">
              {user && (
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={savingBookmark}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs font-semibold cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#36A853]" />
                  <span>{isSaved ? 'Saved in Hub' : 'Save Batch'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Summary</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E5E7EB] text-sm">
            <div>
              <span className="text-xs text-[#6B7280] block">Harvest Date</span>
              <span className="font-semibold font-mono tabular-nums text-[#18261E]">
                {batch.harvestDate} {batch.harvestTime}
              </span>
            </div>
            <div>
              <span className="text-xs text-[#6B7280] block">Batch Volume</span>
              <span className="font-semibold font-mono tabular-nums text-[#18261E]">
                {batch.quantity} {batch.unit}
              </span>
            </div>
            <div>
              <span className="text-xs text-[#6B7280] block">Current Status</span>
              <span className="font-semibold text-[#1D6F34]">{batch.currentStatus}</span>
            </div>
            <div>
              <span className="text-xs text-[#6B7280] block">Last Recorded Location</span>
              <span className="font-medium text-[#18261E] line-clamp-2">
                {currentKnownLocation}
              </span>
            </div>
          </div>

          {(batch.batchDescription || batch.qualityNotes) && (
            <div className="bg-[#F9FBF9] border border-[#E5E7EB] rounded-xl p-4 text-sm text-[#374151] space-y-1">
              {batch.batchDescription && <p>{batch.batchDescription}</p>}
              {batch.qualityNotes && (
                <p className="text-xs text-[#4B5563]">
                  <strong>Handling Guidance:</strong> {batch.qualityNotes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Visual Freshness Estimation System */}
        <FreshnessCard freshness={freshness} />

        {/* Paid Consumer Scan Experience (₹10 Unlock — Free Public Info Remains Intact!) */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
          {!paidConsumerUnlocked ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Optional Consumer Deep-Dive Report · ₹{data.consumerScanFeeInr} One-Time Unlock</span>
                </div>
                <h2 className="text-lg font-bold text-[#18261E] font-display">
                  Unlock Stage-by-Stage Dwell Time & Cold-Chain Analytics
                </h2>
                <p className="text-sm text-[#4B5563]">
                  Basic public farm origin and journey timeline below are always free. Pay{' '}
                  <strong className="font-mono">₹{data.consumerScanFeeInr}</strong> once for this
                  batch to unlock cold-chain compliance metrics, stage dwell breakdown, and a
                  downloadable consumer scan receipt. Refreshing this page will never charge you
                  twice.
                </p>
              </div>
              <Link
                to={`/payment?purpose=consumer_scan&token=${encodeURIComponent(batch.trackingToken)}`}
                className="px-5 py-3 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold whitespace-nowrap shrink-0 text-center"
              >
                Unlock Paid Scan (₹{data.consumerScanFeeInr})
              </Link>
            </div>
          ) : (
            paidConsumerAnalytics && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#1D6F34] font-display">
                    <Sparkles className="w-4 h-4 text-[#36A853]" />
                    <span>Paid Consumer Scan Unlocked — Extended Cold-Chain & Dwell Report</span>
                  </div>
                  <span className="text-xs font-mono text-[#4B5563]">
                    Cert: {paidConsumerAnalytics.provenanceCertificateId} · Receipt:{' '}
                    {paidConsumerAnalytics.scanReceiptNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#F1FAF0] border border-[#8BCF5B] rounded-xl p-4">
                    <span className="text-xs text-[#4B5563] block">Cold-Chain Log Compliance</span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-[#18261E]">
                      {paidConsumerAnalytics.coldChainCompliancePercent !== null
                        ? `${paidConsumerAnalytics.coldChainCompliancePercent}%`
                        : 'No Temp Logs'}
                    </span>
                  </div>
                  <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-xl p-4">
                    <span className="text-xs text-[#4B5563] block">Total Recorded Handoffs</span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-[#18261E]">
                      {paidConsumerAnalytics.totalRecordedHandoffs}
                    </span>
                  </div>
                  <div className="bg-[#F9FBF9] border border-[#E5E7EB] rounded-xl p-4">
                    <span className="text-xs text-[#4B5563] block">Entitlement Status</span>
                    <span className="text-sm font-semibold text-[#1D6F34] block mt-1">
                      Verified Paid (No Repeat Charge on Refresh)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-xs text-[#4B5563]">
                        <th className="py-2 px-3">Stage</th>
                        <th className="py-2 px-3">Participant Business</th>
                        <th className="py-2 px-3">Storage Method</th>
                        <th className="py-2 px-3 text-right">Logged Temp</th>
                        <th className="py-2 px-3 text-right">Dwell Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {paidConsumerAnalytics.stageBreakdown.map((st, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-3 font-medium text-[#18261E]">{st.stage}</td>
                          <td className="py-2.5 px-3 text-[#4B5563]">{st.business}</td>
                          <td className="py-2.5 px-3 text-[#4B5563]">
                            {formatStorageMethodLabel(st.storage)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {st.temperatureC !== null ? `${st.temperatureC}°C` : 'Not logged'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {st.hoursSpent > 0 ? `${st.hoursSpent}h` : '<1h / Current'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>

        {/* Missing Stages / Transparency Disclosure */}
        {missingStages.length > 0 && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 text-xs sm:text-sm text-[#92400E]">
            <strong>Unrecorded Stages Notice:</strong> The following supply-chain checkpoints have
            not been recorded yet: {missingStages.join(', ')}. TraceRoots displays only events
            submitted by participants and never invents missing stages.
          </div>
        )}

        {/* Complete Public Timeline */}
        <SupplyChainTimeline events={events} consumerAccessed />
      </div>
    </PublicLayout>
  );
};

// ============================================================================
// 3. AUTHENTICATED BATCH DETAILS & AUDITABLE CORRECTIONS (/batches/:batchId)
// ============================================================================
export const BatchDetailsPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const { user } = useAuth();

  const [detail, setDetail] = useState<{
    batch: ProduceBatch;
    events: Array<TrackingEvent & { stageDurationHours: number | null }>;
    transactions: FinancialTransaction[];
    freshness: FreshnessEstimate;
    missingStages: string[];
    canViewFullPriceHistory: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);

  // Auditable Correction Fields
  const [targetEventId, setTargetEventId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const loadDetail = useCallback(() => {
    if (!batchId) return;
    setError(null);
    apiRequest<{
      batch: ProduceBatch;
      events: Array<TrackingEvent & { stageDurationHours: number | null }>;
      transactions: FinancialTransaction[];
      freshness: FreshnessEstimate;
      missingStages: string[];
      canViewFullPriceHistory: boolean;
    }>(`/api/batches/${encodeURIComponent(batchId)}`)
      .then((res) => {
        setDetail(res);
        if (res.events.length > 0 && !targetEventId) {
          setTargetEventId(res.events[res.events.length - 1].id);
        }
      })
      .catch((err) => setError((err as Error).message));
  }, [batchId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmittingCorrection(true);
    try {
      await apiRequest(`/api/batches/${encodeURIComponent(detail.batch.id)}/handoff`, {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: createIdempotencyKey('corr'),
          eventType: 'Correction Record',
          correctionOfEventId: targetEventId,
          correctionReason,
          notes: correctionNotes,
          arrivalLocation: detail.batch.farmLocation,
          arrivalLocationProvenance: 'manual_entry',
          storageMethod: detail.batch.storageMethod,
          produceCondition: 'Good',
        }),
      });
      setShowCorrectionForm(false);
      setCorrectionReason('');
      setCorrectionNotes('');
      loadDetail();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const canAppendHandoff =
    user &&
    (user.role === 'wholesaler' ||
      user.role === 'retailer' ||
      user.role === 'transporter' ||
      user.role === 'partner');

  return (
    <WorkspaceLayout
      title={detail ? `Batch ${detail.batch.batchCode} — ${detail.batch.produceName}` : 'Batch Details'}
      subtitle="Role-scoped traceability record, storage timeline, and authorised financial entries."
    >
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <ShieldAlert className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Link to="/history" className="inline-block text-xs font-semibold underline text-red-800">
            Return to Authorised Batch Records
          </Link>
        </div>
      ) : !detail ? (
        <div className="p-8 text-sm text-[#4B5563]">Loading batch details...</div>
      ) : (
        <div className="space-y-8">
          {/* Header Summary Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <ProduceArtworkThumb
                  category={detail.batch.category}
                  produceName={detail.batch.produceName}
                  imageDataUrl={detail.batch.imageDataUrl}
                  className="w-16 h-16"
                />
                <div>
                  <p className="text-xs text-[#4B5563]">
                    {detail.batch.category} · <span className="font-mono">{detail.batch.batchCode}</span>
                    {detail.batch.isDemo && (
                      <span className="text-[#B45309]"> · Demo Data</span>
                    )}
                  </p>
                  <h2 className="text-2xl font-bold text-[#18261E] font-display">
                    {detail.batch.produceName} ({detail.batch.quantity} {detail.batch.unit})
                  </h2>
                  <p className="text-sm text-[#374151]">
                    Registered by {detail.batch.farmName} ({detail.batch.farmerName}) ·{' '}
                    {detail.batch.farmLocation}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 no-print">
                {canAppendHandoff && (
                  <button
                    type="button"
                    onClick={() => setShowHandoffForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>{showHandoffForm ? 'Close Handoff Form' : 'Record Handoff Event'}</span>
                  </button>
                )}

                {(user?.role === 'farmer' || user?.role === 'admin') && (
                  <Link
                    to={`/farmer/qr-label/${detail.batch.batchCode}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs font-semibold"
                  >
                    <QrCode className="w-4 h-4 text-[#36A853]" />
                    <span>QR Label</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setShowCorrectionForm((v) => !v)}
                  className="px-3.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#FFFBEB] text-xs font-medium cursor-pointer"
                >
                  Log Auditable Correction
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-xs font-medium cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
              </div>
            </div>
          </div>

          {showHandoffForm && (
            <HandoffEventForm
              batch={detail.batch}
              onSuccess={() => {
                setShowHandoffForm(false);
                loadDetail();
              }}
              onCancel={() => setShowHandoffForm(false)}
            />
          )}

          {showCorrectionForm && (
            <form
              onSubmit={handleCorrectionSubmit}
              className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-6 space-y-4 no-print"
            >
              <h3 className="text-base font-bold text-[#92400E] font-display">
                Append Auditable Correction Record
              </h3>
              <p className="text-xs text-[#78350F]">
                TraceRoots never deletes or silently edits historical tracking events. Submitting
                this form appends a new Correction Record linked to the original event with your
                identity and timestamp.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#18261E] mb-1">
                    Which Previous Event Does This Refer To?
                  </label>
                  <select
                    value={targetEventId}
                    onChange={(e) => setTargetEventId(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs"
                  >
                    {detail.events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        Seq #{ev.sequenceNumber} — {ev.eventType} ({ev.participantBusiness})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#18261E] mb-1">
                    Reason for Correction <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="e.g. Typo in vehicle registration number"
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#18261E] mb-1">
                  Corrected Information <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Enter the accurate corrected details..."
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionForm(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="px-4 py-2 rounded-xl bg-[#18261E] text-white text-xs font-semibold cursor-pointer"
                >
                  {submittingCorrection ? 'Appending...' : 'Append Correction Event'}
                </button>
              </div>
            </form>
          )}

          {/* Freshness Estimate */}
          <FreshnessCard freshness={detail.freshness} />

          {/* Role-Scoped Financial Records */}
          {(detail.canViewFullPriceHistory || detail.transactions.length > 0) && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#18261E] font-display">
                    {detail.canViewFullPriceHistory
                      ? 'Complete Multi-Stage Price History (Farmer / Admin Authorised View)'
                      : 'Your Authorised Transaction Records (Other Participants’ Prices Hidden)'}
                  </h3>
                </div>
              </div>

              {detail.transactions.length === 0 ? (
                <div className="p-6 text-sm text-[#4B5563]">
                  No financial transactions recorded for your visibility scope on this batch yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                        <th className="py-3 px-4">Participant</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4 text-right">Quantity</th>
                        <th className="py-3 px-4 text-right">Purchase Price / Unit</th>
                        <th className="py-3 px-4 text-right">Total Purchase</th>
                        <th className="py-3 px-4 text-right">Selling Price / Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {detail.transactions.map((txn) => (
                        <tr key={txn.id}>
                          <td className="py-3 px-4">
                            <span className="capitalize font-semibold">{txn.participantRole}</span>{' '}
                            · {txn.participantBusiness}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{txn.referenceCode}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {txn.quantity} {txn.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            {formatInr(txn.purchasePricePerUnit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatInr(txn.totalPurchasePrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#1D6F34] font-semibold">
                            {txn.sellingPricePerUnit !== null
                              ? formatInr(txn.sellingPricePerUnit)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Full Chronological Timeline */}
          <SupplyChainTimeline events={detail.events} />
        </div>
      )}
    </WorkspaceLayout>
  );
};

// ============================================================================
// 4. SEARCH, FILTERS, PAGINATION & CSV REPORTS (/history)
// ============================================================================
export const TrackingHistoryPage: React.FC = () => {
  const [items, setItems] = useState<
    Array<{
      batch: ProduceBatch;
      eventCount: number;
      freshness: FreshnessEstimate;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [freshnessFilter, setFreshnessFilter] = useState<'all' | FreshnessBand>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'qty_desc'>('newest');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    apiRequest<{
      items: Array<{
        batch: ProduceBatch;
        eventCount: number;
        freshness: FreshnessEstimate;
      }>;
    }>('/api/batches')
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items
    .filter(({ batch, freshness }) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          batch.batchCode.toLowerCase().includes(q) ||
          batch.produceName.toLowerCase().includes(q) ||
          batch.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter !== 'all' && batch.currentStatus !== statusFilter) {
        return false;
      }
      if (freshnessFilter !== 'all' && freshness.band !== freshnessFilter) {
        return false;
      }
      if (dateFrom && batch.harvestDate < dateFrom) return false;
      if (dateTo && batch.harvestDate > dateTo) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return Date.parse(a.batch.createdAtUtc) - Date.parse(b.batch.createdAtUtc);
      }
      if (sortBy === 'qty_desc') {
        return b.batch.quantity - a.batch.quantity;
      }
      return Date.parse(b.batch.createdAtUtc) - Date.parse(a.batch.createdAtUtc);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCsv = () => {
    exportRowsToCsv(
      `TraceRoots-Batches-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Batch ID',
        'Produce Name',
        'Category',
        'Quantity',
        'Unit',
        'Harvest Date',
        'Current Status',
        'Freshness Band',
        'Recorded Events',
        'Origin Farm',
      ],
      filtered.map(({ batch, eventCount, freshness }) => [
        batch.batchCode,
        batch.produceName,
        batch.category,
        batch.quantity,
        batch.unit,
        batch.harvestDate,
        batch.currentStatus,
        freshness.band,
        eventCount,
        batch.farmName,
      ])
    );
  };

  return (
    <WorkspaceLayout
      title="Search, Filter & Batch Reports"
      subtitle="Search authorised produce batches by ID, crop, date range, supply-chain stage, or freshness band."
    >
      <div className="space-y-6">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Batch ID or Produce..."
                className="w-full rounded-xl border border-[#E5E7EB] pl-9 pr-3.5 py-2 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="all">All Supply-Chain Stages</option>
              <option value="Registered">Registered</option>
              <option value="In Transit">In Transit</option>
              <option value="At Wholesaler">At Wholesaler</option>
              <option value="Dispatched by Wholesaler">Dispatched by Wholesaler</option>
              <option value="At Retailer">At Retailer</option>
              <option value="Delivered / Consumer Ready">Delivered / Consumer Ready</option>
            </select>

            <select
              value={freshnessFilter}
              onChange={(e) => {
                setFreshnessFilter(e.target.value as 'all' | FreshnessBand);
                setPage(1);
              }}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="all">All Freshness Bands</option>
              <option value="Green">Green — Fresh</option>
              <option value="Yellow">Yellow — Declining</option>
              <option value="Orange">Orange — Caution</option>
              <option value="Red">Red — Limit Exceeded</option>
              <option value="Grey">Grey — Insufficient Data</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'qty_desc')}
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="qty_desc">Sort: Highest Quantity</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
              <span>Harvest From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 font-mono"
              />
              <span>To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F1FAF0] text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#36A853]" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Table</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">Loading records...</div>
          ) : paginated.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5563]">
              No batches match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                    <th className="py-3 px-4">Batch ID</th>
                    <th className="py-3 px-4">Produce</th>
                    <th className="py-3 px-4 text-right">Volume</th>
                    <th className="py-3 px-4">Harvest Date</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Freshness</th>
                    <th className="py-3 px-4 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {paginated.map(({ batch, freshness }) => (
                    <tr key={batch.id} className="hover:bg-[#F1FAF0]/30">
                      <td className="py-3 px-4 font-mono text-xs font-semibold">
                        {batch.batchCode}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#18261E]">{batch.produceName}</span>
                        {batch.isDemo && (
                          <span className="ml-1.5 text-xs text-[#B45309]">· Demo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {batch.quantity} {batch.unit}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs">
                        {batch.harvestDate}
                      </td>
                      <td className="py-3 px-4 text-xs">{batch.currentStatus}</td>
                      <td className="py-3 px-4">
                        <FreshnessBadgeInline freshness={freshness} />
                      </td>
                      <td className="py-3 px-4 text-right no-print">
                        <Link
                          to={`/batches/${batch.batchCode}`}
                          className="text-xs font-semibold text-[#1D6F34] hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs no-print">
              <span className="text-[#4B5563] font-mono tabular-nums">
                Page {page} of {totalPages} ({filtered.length} matching records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
};

// ============================================================================
// 5. FRESHNESS ESTIMATION DETAILS & SIMULATOR PAGE (/freshness)
// ============================================================================
export const FreshnessDetailsPage: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useState<FreshnessParameter[]>([]);
  const [simCategory, setSimCategory] = useState('Leafy Vegetables');
  const [simHoursAgo, setSimHoursAgo] = useState(36);
  const [simStorage, setSimStorage] = useState<StorageMethod>('ventilated_crate');
  const [simTemp, setSimTemp] = useState<string>('14');
  const [simInterrupted, setSimInterrupted] = useState(false);

  useEffect(() => {
    apiRequest<{ parameters: FreshnessParameter[] }>('/api/freshness-parameters').then((res) => {
      setParams(res.parameters);
      if (res.parameters.length > 0) setSimCategory(res.parameters[0].category);
    });
  }, []);

  const simulatedHarvestIso = new Date(
    Date.now() - simHoursAgo * 60 * 60 * 1000
  ).toISOString();

  const simEstimate = calculateFreshnessEstimate(
    {
      category: simCategory,
      harvestTimestampUtc: simulatedHarvestIso,
      expectedShelfLifeDays: null,
      storageMethod: simStorage,
    },
    [
      {
        eventType: 'Wholesaler Received',
        storageMethod: simStorage,
        storageTemperatureC: simTemp !== '' ? Number(simTemp) : null,
        refrigerationInterrupted: simInterrupted,
        produceCondition: 'Good',
      },
    ],
    params
  );

  const body = (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-[#FFFBEB] border border-[#FFD166] rounded-2xl p-5 text-sm text-[#78350F]">
        {FOOD_SAFETY_DISCLAIMER}
      </div>

      {/* Live Freshness Simulator */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-[#18261E] font-display">
            Interactive Crop Freshness Calculator
          </h2>
          <p className="text-sm text-[#4B5563]">
            Inspect how TraceRoots computes freshness status from configured produce parameters,
            elapsed post-harvest hours, and storage temperature history.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#18261E] mb-1">
              Produce Category
            </label>
            <select
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              {params.map((p) => (
                <option key={p.id} value={p.category}>
                  {p.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18261E] mb-1">
              Hours Since Harvest ({simHoursAgo}h)
            </label>
            <input
              type="range"
              min={2}
              max={360}
              value={simHoursAgo}
              onChange={(e) => setSimHoursAgo(Number(e.target.value))}
              className="w-full mt-2 accent-[#36A853]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18261E] mb-1">
              Storage Method
            </label>
            <select
              value={simStorage}
              onChange={(e) => setSimStorage(e.target.value as StorageMethod)}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="ambient">Ambient Room / Open</option>
              <option value="ventilated_crate">Ventilated Crates</option>
              <option value="cold_storage">Cold Storage Chamber</option>
              <option value="refrigerated_transport">Refrigerated Transport</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18261E] mb-1">
              Logged Temperature (°C, blank = unknown)
            </label>
            <input
              type="number"
              value={simTemp}
              onChange={(e) => setSimTemp(e.target.value)}
              placeholder="Leave blank to test incomplete data"
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[#4B5563] cursor-pointer">
          <input
            type="checkbox"
            checked={simInterrupted}
            onChange={(e) => setSimInterrupted(e.target.checked)}
            className="rounded border-gray-300 text-[#EA580C]"
          />
          <span>Simulate refrigeration interruption during transport</span>
        </label>

        <FreshnessCard freshness={simEstimate} />
      </div>

      {/* Documented Produce Shelf-Life Parameter Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-bold text-[#18261E] font-display">
            Configured Produce Shelf-Life Reference Database
          </h2>
          <p className="text-xs text-[#4B5563]">
            Used dynamically across all TraceRoots batch evaluations (editable by Platform
            Administrators).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FBF9] text-xs text-[#4B5563]">
                <th className="py-3 px-4">Category & Crops</th>
                <th className="py-3 px-4 text-right">Ambient Window</th>
                <th className="py-3 px-4 text-right">Cold-Chain Window</th>
                <th className="py-3 px-4 text-right">Optimal Temp</th>
                <th className="py-3 px-4">Assumptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {params.map((p) => (
                <tr key={p.id}>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#18261E]">{p.category}</p>
                    <p className="text-xs text-[#4B5563]">{p.produceExamples}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                    {p.ambientMinDays}–{p.ambientMaxDays} days
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-[#1D6F34] font-semibold">
                    {p.coldMinDays}–{p.coldMaxDays} days
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                    {p.optimalTempMinC}–{p.optimalTempMaxC}°C
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#4B5563] max-w-xs">
                    {p.storageAssumptions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (user) {
    return (
      <WorkspaceLayout
        title="Freshness Estimation Engine & Crop Parameters"
        subtitle="Documented shelf-life assumptions, confidence scoring, and food safety boundaries."
      >
        {body}
      </WorkspaceLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="py-10 px-4 sm:px-6 lg:px-8">{body}</div>
    </PublicLayout>
  );
};

// ============================================================================
// 6. ERROR & INVALID QR PAGE (/invalid-qr)
// ============================================================================
export const InvalidQrPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const attempted = searchParams.get('q') || '';
  const navigate = useNavigate();
  const [retryInput, setRetryInput] = useState(attempted);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryError(null);
    if (!retryInput.trim()) return;
    try {
      const res = await apiRequest<{ trackingToken: string }>(
        `/api/public/resolve/${encodeURIComponent(retryInput.trim())}`
      );
      navigate(`/track/${res.trackingToken}`);
    } catch (err) {
      setRetryError((err as Error).message);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#18261E] font-display">
            Unrecognised or Invalid QR Code
          </h1>
          <p className="text-sm text-[#4B5563]">
            {attempted ? (
              <>
                No registered produce batch matches{' '}
                <span className="font-mono font-semibold text-[#18261E]">{attempted}</span>.
              </>
            ) : (
              'The scanned QR code or tracking token was not found in the TraceRoots registry.'
            )}{' '}
            Verify that the label is an official TraceRoots batch QR code or check for typos in
            the Batch ID.
          </p>

          <form onSubmit={handleRetry} className="space-y-3 text-left pt-2">
            <label className="block text-xs font-semibold text-[#18261E]">
              Try Entering the Printed Batch ID (e.g. FT-2026-DEMO8492)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={retryInput}
                onChange={(e) => setRetryInput(e.target.value)}
                placeholder="FT-2026-XXXXXXXX"
                className="flex-1 rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#36A853] text-white text-sm font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
            {retryError && <p className="text-xs text-red-600">{retryError}</p>}
          </form>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-center gap-4 text-sm">
            <Link to="/scan" className="font-semibold text-[#1D6F34] hover:underline">
              Open Camera QR Scanner
            </Link>
            <span className="text-gray-300">·</span>
            <Link to="/" className="text-[#4B5563] hover:text-[#18261E]">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
