import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
} from 'lucide-react';
import type { FreshnessBand, FreshnessEstimate } from '../shared/types';

function getBandVisuals(band: FreshnessBand) {
  switch (band) {
    case 'Green':
      return {
        surface: 'bg-[#F1FAF0] border-[#8BCF5B]',
        bar: 'bg-[#36A853]',
        text: 'text-[#166534]',
        Icon: CheckCircle2,
      };
    case 'Yellow':
      return {
        surface: 'bg-[#FFFBEB] border-[#FFD166]',
        bar: 'bg-[#D97706]',
        text: 'text-[#92400E]',
        Icon: Clock,
      };
    case 'Orange':
      return {
        surface: 'bg-[#FFF7ED] border-[#FFAD66]',
        bar: 'bg-[#EA580C]',
        text: 'text-[#9A3412]',
        Icon: AlertTriangle,
      };
    case 'Red':
      return {
        surface: 'bg-[#FEF2F2] border-[#FCA5A5]',
        bar: 'bg-[#DC2626]',
        text: 'text-[#991B1B]',
        Icon: AlertOctagon,
      };
    default:
      return {
        surface: 'bg-gray-50 border-[#E5E7EB]',
        bar: 'bg-gray-400',
        text: 'text-[#4B5563]',
        Icon: HelpCircle,
      };
  }
}

export const FreshnessBadgeInline: React.FC<{ freshness: FreshnessEstimate }> = ({
  freshness,
}) => {
  const { text, Icon } = getBandVisuals(freshness.band);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>
        {freshness.band} · {freshness.shortStatus}
      </span>
    </span>
  );
};

export const FreshnessCard: React.FC<{
  freshness: FreshnessEstimate;
  compact?: boolean;
}> = ({ freshness, compact = false }) => {
  const { surface, bar, text, Icon } = getBandVisuals(freshness.band);

  const widthClasses =
    freshness.progressPercent >= 95
      ? 'w-full'
      : freshness.progressPercent >= 80
        ? 'w-4/5'
        : freshness.progressPercent >= 65
          ? 'w-2/3'
          : freshness.progressPercent >= 45
            ? 'w-1/2'
            : freshness.progressPercent >= 25
              ? 'w-1/3'
              : 'w-1/6';

  return (
    <div className={`rounded-2xl border p-5 ${surface} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-6 h-6 shrink-0 ${text}`} />
          <div>
            <p className="text-xs font-medium text-[#4B5563]">Estimated Freshness Status</p>
            <h3 className={`text-base sm:text-lg font-bold font-display ${text}`}>
              {freshness.label}
            </h3>
          </div>
        </div>
        <div className="text-right font-mono tabular-nums text-xs text-[#4B5563]">
          <span>Shelf-life elapsed: {freshness.progressPercent}%</span>
        </div>
      </div>

      {/* Accessible Progress Bar */}
      <div
        className="w-full h-2.5 bg-white/90 rounded-full overflow-hidden border border-[#E5E7EB]"
        role="progressbar"
        aria-valuenow={freshness.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Estimated shelf-life consumed: ${freshness.progressPercent}%`}
      >
        <div className={`h-full rounded-full ${bar} ${widthClasses} transition-transform`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-xs text-[#4B5563] block">Time Since Harvest</span>
          <span className="font-semibold font-mono tabular-nums text-[#18261E]">
            {freshness.elapsedFormatted}
          </span>
        </div>
        <div>
          <span className="text-xs text-[#4B5563] block">Estimated Shelf-Life Remaining</span>
          <span className="font-semibold text-[#18261E]">{freshness.remainingFormatted}</span>
        </div>
      </div>

      {!compact && (
        <div className="pt-3 border-t border-black/10 space-y-2 text-xs text-[#4B5563]">
          <p>
            <strong className="text-[#18261E]">Confidence:</strong> {freshness.confidenceReason}
          </p>
          <p>
            <strong className="text-[#18261E]">Storage Assumptions:</strong>{' '}
            {freshness.storageAssumptionsUsed}
          </p>
          <p>
            <strong className="text-[#18261E]">Temperature History:</strong>{' '}
            {freshness.temperatureSummary}
          </p>
          <div className="mt-2 pt-2 border-t border-black/10 flex items-start gap-2 text-[11px] text-[#374151]">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#4B5563]" />
            <span>{freshness.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  );
};
