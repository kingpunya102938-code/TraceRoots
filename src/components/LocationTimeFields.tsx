import React, { useState } from 'react';
import { LocateFixed, MapPin, PencilLine, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { LocationProvenance } from '../shared/types';

interface LocationTimeFieldsProps {
  labelPrefix: string; // e.g., "Departure" or "Arrival"
  locationValue: string;
  provenance: LocationProvenance;
  onLocationChange: (location: string, provenance: LocationProvenance, coords?: { lat: number; lng: number } | null) => void;
  dateValue: string;
  onDateChange: (date: string) => void;
  timeValue: string;
  onTimeChange: (time: string) => void;
  required?: boolean;
  locationPlaceholder?: string;
}

export const LocationTimeFields: React.FC<LocationTimeFieldsProps> = ({
  labelPrefix,
  locationValue,
  provenance,
  onLocationChange,
  dateValue,
  onDateChange,
  timeValue,
  onTimeChange,
  required = true,
  locationPlaceholder = 'Village / Mandi / Street, District, State',
}) => {
  const [detecting, setDetecting] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleDetectGps = () => {
    setGeoError(null);
    setGeoNotice(null);

    if (!('geolocation' in navigator)) {
      setGeoError(
        'Geolocation is not supported by this browser. Please enter the location manually below.'
      );
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await apiRequest<{
            formattedAddress: string;
            coordinates: { lat: number; lng: number };
            provenance: LocationProvenance;
            notice?: string;
          }>(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);

          onLocationChange(res.formattedAddress, res.provenance, res.coordinates);
          setGeoNotice(
            res.notice ||
              'Device GPS coordinates converted to readable address. You can still edit it manually if needed.'
          );
        } catch {
          const fallbackAddr = `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onLocationChange(fallbackAddr, 'gps_detected', { lat, lng });
          setGeoNotice(
            'GPS coordinates captured (reverse geocoding offline). You may refine the place name manually.'
          );
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            'Location permission was denied. Please type the location manually in the field below.'
          );
        } else {
          setGeoError(
            'Could not determine GPS position right now. Please enter the location manually.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60_000,
      }
    );
  };

  const provenanceDescription =
    provenance === 'gps_geocoded'
      ? 'Source: Detected via device GPS & reverse-geocoded'
      : provenance === 'gps_detected'
        ? 'Source: Raw device GPS coordinates'
        : provenance === 'manual_entry' && locationValue.trim() !== ''
          ? 'Source: Manually entered by participant'
          : 'Source: Not recorded yet';

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label className="block text-sm font-medium text-[#18261E]">
            {labelPrefix} Location {required && <span className="text-red-600">*</span>}
          </label>
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={detecting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EFF8FF] text-[#0369A1] border border-[#BAE6FD] hover:bg-[#E0F2FE] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {detecting ? 'Detecting GPS...' : 'Detect Device GPS'}
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            required={required}
            value={locationValue}
            onChange={(e) => {
              // User manual edit explicitly switches provenance to manual_entry and is never silently overwritten
              onLocationChange(e.target.value, 'manual_entry', null);
            }}
            placeholder={locationPlaceholder}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#18261E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#36A853] focus:border-transparent"
          />
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#4B5563]">
          {provenance === 'gps_geocoded' || provenance === 'gps_detected' ? (
            <MapPin className="w-3.5 h-3.5 text-[#36A853] shrink-0" />
          ) : (
            <PencilLine className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
          )}
          <span>{provenanceDescription}</span>
        </div>

        {geoNotice && (
          <p className="mt-1.5 text-xs text-[#1D6F34] bg-[#F1FAF0] border border-[#BBF7D0] rounded-lg px-3 py-2">
            {geoNotice}
          </p>
        )}

        {geoError && (
          <div className="mt-1.5 flex items-start gap-2 text-xs text-[#9A3412] bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{geoError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            {labelPrefix} Date {required && <span className="text-red-600">*</span>}
          </label>
          <input
            type="date"
            required={required}
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#18261E] focus:outline-none focus:ring-2 focus:ring-[#36A853]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#18261E] mb-1.5">
            {labelPrefix} Time {required && <span className="text-red-600">*</span>}
          </label>
          <input
            type="time"
            required={required}
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#18261E] focus:outline-none focus:ring-2 focus:ring-[#36A853]"
          />
        </div>
      </div>
    </div>
  );
};
