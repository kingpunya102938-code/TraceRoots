import React, { useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  apiRequest,
  compressImageFileToDataUrl,
  createIdempotencyKey,
  formatLocalDateInput,
  formatLocalTimeInput,
} from '../lib/api';
import type {
  LocationProvenance,
  ProduceBatch,
  ProduceCondition,
  StorageMethod,
  TrackingEventType,
} from '../shared/types';
import { LocationTimeFields } from './LocationTimeFields';

interface HandoffEventFormProps {
  batch: Pick<
    ProduceBatch,
    'id' | 'batchCode' | 'produceName' | 'quantity' | 'unit' | 'storageMethod'
  >;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const HandoffEventForm: React.FC<HandoffEventFormProps> = ({
  batch,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const role = user?.role || 'partner';

  const defaultEventType: TrackingEventType =
    role === 'wholesaler'
      ? 'Wholesaler Received'
      : role === 'retailer'
        ? 'Retailer Received'
        : role === 'transporter'
          ? 'Picked Up by Transporter'
          : 'Partner Handoff';

  const [eventType, setEventType] = useState<TrackingEventType>(defaultEventType);
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [purchasePricePerUnit, setPurchasePricePerUnit] = useState('');
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState('');

  const [arrivalLocation, setArrivalLocation] = useState(user?.address || '');
  const [arrivalProvenance, setArrivalProvenance] =
    useState<LocationProvenance>('manual_entry');
  const [arrivalDate, setArrivalDate] = useState(formatLocalDateInput());
  const [arrivalTime, setArrivalTime] = useState(formatLocalTimeInput());

  const [includeDeparture, setIncludeDeparture] = useState(
    role === 'transporter'
  );
  const [departureLocation, setDepartureLocation] = useState('');
  const [departureProvenance, setDepartureProvenance] =
    useState<LocationProvenance>('not_recorded');
  const [departureDate, setDepartureDate] = useState(formatLocalDateInput());
  const [departureTime, setDepartureTime] = useState(formatLocalTimeInput());

  const [storageMethod, setStorageMethod] = useState<StorageMethod>(
    batch.storageMethod || 'ventilated_crate'
  );
  const [storageTemperatureC, setStorageTemperatureC] = useState('');
  const [refrigerationInterrupted, setRefrigerationInterrupted] = useState(false);
  const [produceCondition, setProduceCondition] = useState<ProduceCondition>('Good');
  const [transportMethod, setTransportMethod] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [destinationParticipant, setDestinationParticipant] = useState('');
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);

  const [idempotencyKey] = useState(() => createIdempotencyKey('handoff'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const supportsPricing =
    role === 'wholesaler' || role === 'retailer' || role === 'partner';

  const availableEventTypes: TrackingEventType[] =
    role === 'wholesaler'
      ? ['Wholesaler Received', 'Wholesaler Dispatched']
      : role === 'retailer'
        ? ['Retailer Received', 'Retailer Dispatched']
        : role === 'transporter'
          ? ['Picked Up by Transporter', 'Delivered by Transporter']
          : ['Partner Handoff', 'Picked Up by Transporter', 'Wholesaler Dispatched'];

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 720, 0.78);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const arrivalIso = new Date(`${arrivalDate}T${arrivalTime}:00`).toISOString();
      const departureIso =
        includeDeparture && departureDate && departureTime
          ? new Date(`${departureDate}T${departureTime}:00`).toISOString()
          : '';

      await apiRequest(`/api/batches/${encodeURIComponent(batch.id)}/handoff`, {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,
          eventType,
          businessName,
          quantity: Number(quantity),
          purchasePricePerUnit: supportsPricing ? purchasePricePerUnit : '',
          sellingPricePerUnit: supportsPricing ? sellingPricePerUnit : '',
          arrivalLocation,
          arrivalLocationProvenance: arrivalProvenance,
          arrivalTimestamp: arrivalIso,
          departureLocation: includeDeparture ? departureLocation : '',
          departureLocationProvenance: includeDeparture
            ? departureProvenance
            : 'not_recorded',
          departureTimestamp: departureIso,
          storageMethod,
          storageTemperatureC,
          refrigerationInterrupted,
          produceCondition,
          transportMethod,
          vehicleDetails,
          destinationParticipant,
          notes,
          photoDataUrl,
        }),
      });

      setDone(true);
      setTimeout(() => {
        onSuccess();
      }, 600);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-[#F1FAF0] border border-[#8BCF5B] rounded-2xl p-6 text-center space-y-2">
        <CheckCircle2 className="w-10 h-10 text-[#36A853] mx-auto" />
        <h3 className="text-lg font-bold text-[#18261E] font-display">
          Supply-Chain Event Appended
        </h3>
        <p className="text-sm text-[#4B5563]">
          Your record has been appended chronologically to batch {batch.batchCode}. Earlier history remains intact.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 space-y-6"
    >
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-[#18261E] font-display">
            Record Supply-Chain Handoff — {batch.produceName}
          </h3>
          <p className="text-xs text-[#4B5563] mt-0.5">
            Batch <span className="font-mono font-semibold">{batch.batchCode}</span> · Append-only record as{' '}
            <span className="capitalize font-medium">{role}</span> ({user?.fullName})
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Event Stage <span className="text-red-600">*</span>
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as TrackingEventType)}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18261E] focus:outline-none focus:ring-2 focus:ring-[#36A853]"
          >
            {availableEventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Business / Shop / Fleet Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Registered business name"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18261E]"
          />
        </div>
      </div>

      {/* Private Transaction Fields for Wholesaler / Retailer / Partner */}
      {supportsPricing && (
        <div className="rounded-xl bg-[#F9FBF9] border border-[#E5E7EB] p-4 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[#18261E]">
              Confidential Transaction Details (Price Privacy Protected)
            </h4>
            <p className="text-xs text-[#4B5563]">
              Visible only to your account and the registering farmer. Never shown on public QR pages or to consumers.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#18261E] mb-1">
                Quantity Handled ({batch.unit})
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#18261E] mb-1">
                Purchase Price (₹ per {batch.unit})
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={purchasePricePerUnit}
                onChange={(e) => setPurchasePricePerUnit(e.target.value)}
                placeholder="e.g. 26"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#18261E] mb-1">
                Selling Price (₹ per {batch.unit}, optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={sellingPricePerUnit}
                onChange={(e) => setSellingPricePerUnit(e.target.value)}
                placeholder="e.g. 34"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {/* Arrival / Pickup Location & Time */}
      <LocationTimeFields
        labelPrefix={role === 'transporter' ? 'Pickup' : 'Arrival'}
        locationValue={arrivalLocation}
        provenance={arrivalProvenance}
        onLocationChange={(loc, prov) => {
          setArrivalLocation(loc);
          setArrivalProvenance(prov);
        }}
        dateValue={arrivalDate}
        onDateChange={setArrivalDate}
        timeValue={arrivalTime}
        onTimeChange={setArrivalTime}
        required
      />

      {/* Optional Departure / Delivery Location & Time */}
      <div className="pt-2 border-t border-[#E5E7EB]">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-[#18261E] cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={includeDeparture}
            onChange={(e) => setIncludeDeparture(e.target.checked)}
            className="rounded border-gray-300 text-[#36A853] focus:ring-[#36A853]"
          />
          <span>
            Also record {role === 'transporter' ? 'Delivery' : 'Departure / Dispatch'} location & time now
          </span>
        </label>

        {includeDeparture && (
          <LocationTimeFields
            labelPrefix={role === 'transporter' ? 'Delivery' : 'Departure'}
            locationValue={departureLocation}
            provenance={departureProvenance}
            onLocationChange={(loc, prov) => {
              setDepartureLocation(loc);
              setDepartureProvenance(prov);
            }}
            dateValue={departureDate}
            onDateChange={setDepartureDate}
            timeValue={departureTime}
            onTimeChange={setDepartureTime}
            required={false}
          />
        )}
      </div>

      {/* Storage, Condition & Transport */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E5E7EB]">
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
            <option value="cold_storage">Cold Storage Chamber</option>
            <option value="refrigerated_transport">Refrigerated Transport</option>
            <option value="controlled_atmosphere">Controlled Atmosphere</option>
            <option value="dry_warehouse">Dry Warehouse</option>
            <option value="ambient">Ambient Room / Open</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Storage Temperature (°C, if known)
          </label>
          <input
            type="number"
            step="0.5"
            value={storageTemperatureC}
            onChange={(e) => setStorageTemperatureC(e.target.value)}
            placeholder="e.g. 12.0"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Produce Condition on Arrival
          </label>
          <select
            value={produceCondition}
            onChange={(e) => setProduceCondition(e.target.value as ProduceCondition)}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
          >
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair - Minor Bruising">Fair - Minor Bruising</option>
            <option value="Caution - Ripening Fast">Caution - Ripening Fast</option>
            <option value="Damaged">Damaged</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Transport Method / Vehicle Details
          </label>
          <input
            type="text"
            value={transportMethod}
            onChange={(e) => setTransportMethod(e.target.value)}
            placeholder="e.g. Insulated Reefer Van MH-12-AB-1234"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            Destination / Next Participant (if known)
          </label>
          <input
            type="text"
            value={destinationParticipant}
            onChange={(e) => setDestinationParticipant(e.target.value)}
            placeholder="Next buyer, shop, or city"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-sm text-[#4B5563] cursor-pointer">
          <input
            type="checkbox"
            checked={refrigerationInterrupted}
            onChange={(e) => setRefrigerationInterrupted(e.target.checked)}
            className="rounded border-gray-300 text-[#EA580C]"
          />
          <span>Report known interruption in refrigeration / cold chain during transit</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#18261E] mb-1.5">
          Handling, Quality, or Delay Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record inspection observations, crate condition, or transit delays..."
          className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#18261E] mb-1.5">
          Optional Produce Photograph (Compressed Automatically)
        </label>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FBF9] hover:bg-[#F1FAF0] text-xs font-medium text-[#18261E] cursor-pointer">
            <Upload className="w-4 h-4 text-[#36A853]" />
            <span>Select Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
          {photoDataUrl && (
            <img
              src={photoDataUrl}
              alt="Upload preview"
              className="w-12 h-12 rounded-lg object-cover border border-[#E5E7EB]"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#4B5563] hover:text-[#18261E] cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-[#36A853] hover:bg-[#2B8A43] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
        >
          {submitting ? 'Recording Event...' : 'Submit Supply-Chain Event'}
        </button>
      </div>
    </form>
  );
};
