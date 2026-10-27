import React from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  FileWarning,
  MapPin,
  Thermometer,
  Truck,
} from 'lucide-react';
import { formatDisplayDateTime, formatStorageMethodLabel } from '../lib/api';
import type { PublicTrackingResponse, TrackingEventType } from '../shared/types';

type TimelineEventItem = PublicTrackingResponse['events'][number];

const CANONICAL_CHAIN_STEPS: Array<{
  title: string;
  match: TrackingEventType[];
}> = [
  { title: 'Harvested & Registered', match: ['Harvested & Registered'] },
  {
    title: 'Picked Up / Transit',
    match: ['Picked Up by Transporter', 'Delivered by Transporter'],
  },
  { title: 'Wholesaler Received', match: ['Wholesaler Received'] },
  { title: 'Wholesaler Dispatched', match: ['Wholesaler Dispatched'] },
  { title: 'Retailer Received', match: ['Retailer Received'] },
  { title: 'Retailer Dispatched', match: ['Retailer Dispatched'] },
];

export const SupplyChainTimeline: React.FC<{
  events: TimelineEventItem[];
  consumerAccessed?: boolean;
}> = ({ events, consumerAccessed = false }) => {
  const recordedEventTypes = new Set(events.map((e) => e.eventType));

  // Extract distinct recorded locations in chronological order for schematic journey view
  const recordedStops = events
    .map((ev) => ({
      seq: ev.sequenceNumber,
      role: ev.participantRole,
      business: ev.participantBusiness,
      location: ev.arrivalLocation || ev.departureLocation || 'Location not specified',
      time: ev.arrivalTimestamp || ev.serverCreatedAtUtc,
    }))
    .filter((s) => Boolean(s.location));

  return (
    <div className="space-y-8">
      {/* Canonical Sequence Strip — Honest "Not recorded yet" for missing stages */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-[#18261E] font-display">
            Supply-Chain Stage Checkpoints
          </h3>
          <span className="text-xs text-[#4B5563]">
            Unrecorded stages are explicitly marked rather than assumed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {CANONICAL_CHAIN_STEPS.map((step) => {
            const done = step.match.some((t) => recordedEventTypes.has(t));
            return (
              <div
                key={step.title}
                className={`rounded-xl border p-3 ${
                  done
                    ? 'bg-[#F1FAF0] border-[#8BCF5B] text-[#18261E]'
                    : 'bg-gray-50/70 border-[#E5E7EB] text-[#6B7280]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#36A853] shrink-0" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  )}
                  <span className="truncate">{step.title}</span>
                </div>
                <p className="mt-1 text-[11px]">
                  {done ? 'Recorded in ledger' : 'Not recorded yet'}
                </p>
              </div>
            );
          })}

          <div
            className={`rounded-xl border p-3 ${
              consumerAccessed
                ? 'bg-[#EFF8FF] border-[#45B8E8] text-[#18261E]'
                : 'bg-gray-50/70 border-[#E5E7EB] text-[#6B7280]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {consumerAccessed ? (
                <CheckCircle2 className="w-4 h-4 text-[#0284C7] shrink-0" />
              ) : (
                <CircleDashed className="w-4 h-4 text-[#9CA3AF] shrink-0" />
              )}
              <span className="truncate">Consumer Accessed</span>
            </div>
            <p className="mt-1 text-[11px]">
              {consumerAccessed ? 'Viewing now' : 'Not recorded yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Recorded Journey Locations Schematic (No fabricated road distances) */}
      {recordedStops.length > 0 && (
        <div className="bg-[#EFF8FF]/60 border border-[#BAE6FD] rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-[#18261E] font-display">
              Recorded Journey Locations ({recordedStops.length} Checkpoints)
            </h3>
            <span className="text-xs text-[#4B5563]">
              Chronological participant-submitted stops (no fabricated transit distances)
            </span>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 overflow-x-auto pb-1">
            {recordedStops.map((stop, idx) => (
              <React.Fragment key={`${stop.seq}-${idx}`}>
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 min-w-[200px] flex-1">
                  <div className="text-xs text-[#4B5563]">
                    Stop #{stop.seq} · <span className="capitalize">{stop.role}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#18261E] mt-0.5 truncate">
                    {stop.business}
                  </p>
                  <p className="text-xs text-[#4B5563] mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#36A853] shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{stop.location}</span>
                  </p>
                </div>
                {idx < recordedStops.length - 1 && (
                  <div className="hidden md:flex items-center justify-center text-[#36A853] font-bold px-1">
                    →
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Chronological Event History */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#18261E] font-display">
          Chronological Event Ledger ({events.length} Recorded Event{events.length === 1 ? '' : 's'})
        </h3>

        {events.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center text-sm text-[#4B5563]">
            No tracking events have been recorded for this batch yet.
          </div>
        ) : (
          <ol className="relative border-l-2 border-[#8BCF5B] ml-3 space-y-6">
            {events.map((ev) => {
              const isCorrection = ev.eventType === 'Correction Record';
              return (
                <li key={ev.id} className="ml-6">
                  <span
                    className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${
                      isCorrection
                        ? 'bg-[#FFD166] text-[#18261E]'
                        : 'bg-[#36A853] text-white'
                    }`}
                  >
                    {ev.sequenceNumber}
                  </span>

                  <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-[#4B5563]">
                          <span className="capitalize font-medium text-[#18261E]">
                            {ev.participantRole}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>{ev.participantBusiness}</span>
                          {ev.transactionRefCode && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono">{ev.transactionRefCode}</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-[#18261E] font-display mt-0.5">
                          {ev.eventType}
                        </h4>
                      </div>

                      <div className="text-xs text-[#4B5563] text-right">
                        <div>{ev.verificationStatus}</div>
                        <div className="text-[11px] text-[#6B7280]">
                          Not verified independently · Logged{' '}
                          <span className="font-mono tabular-nums">
                            {formatDisplayDateTime(ev.serverCreatedAtUtc)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isCorrection && (
                      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 text-xs text-[#92400E] flex items-start gap-2">
                        <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Auditable Correction Notice:</strong> Refers to earlier event ID{' '}
                          <span className="font-mono">{ev.correctionOfEventId}</span>. Reason:{' '}
                          {ev.correctionReason}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-1">
                      <div className="space-y-1">
                        <span className="text-xs text-[#6B7280] block">Arrival / Origin</span>
                        <p className="font-medium text-[#18261E]">
                          {ev.arrivalLocation || 'Not recorded'}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-[#4B5563]">
                          {formatDisplayDateTime(ev.arrivalTimestamp)} (
                          {ev.arrivalLocationProvenance.replace('_', ' ')})
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs text-[#6B7280] block">Departure / Next Stop</span>
                        <p className="font-medium text-[#18261E]">
                          {ev.departureLocation ||
                            ev.destinationParticipant ||
                            'Not recorded yet'}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-[#4B5563]">
                          {ev.departureTimestamp
                            ? `${formatDisplayDateTime(ev.departureTimestamp)} (${ev.departureLocationProvenance.replace('_', ' ')})`
                            : 'Departure timestamp not recorded yet'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-[#E5E7EB] text-xs text-[#4B5563]">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-[#0284C7]" />
                        Storage: {formatStorageMethodLabel(ev.storageMethod)}
                        {ev.storageTemperatureC !== null && ` (${ev.storageTemperatureC}°C)`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Condition: {ev.produceCondition}</span>
                      {ev.transportMethod && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-[#36A853]" />
                            {ev.transportMethod}
                          </span>
                        </>
                      )}
                      {ev.stageDurationHours !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-[#4B5563]" />
                            Stage duration: {ev.stageDurationHours}h
                          </span>
                        </>
                      )}
                    </div>

                    {ev.notes && (
                      <p className="text-sm text-[#374151] bg-[#F9FBF9] rounded-xl px-3.5 py-2.5 border border-[#E5E7EB]">
                        {ev.notes}
                      </p>
                    )}

                    {ev.photoDataUrl && (
                      <div className="pt-1">
                        <img
                          src={ev.photoDataUrl}
                          alt={`Stage ${ev.sequenceNumber} produce check`}
                          referrerPolicy="no-referrer"
                          className="h-32 w-auto rounded-xl border border-[#E5E7EB] object-cover"
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
