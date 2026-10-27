import React from 'react';

export const BrandLogoMark: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="36" height="36" rx="10" fill="#F1FAF0" stroke="#36A853" strokeWidth="2" />
    {/* QR Finder Corners */}
    <rect x="7" y="7" width="9" height="9" rx="2" stroke="#18261E" strokeWidth="2.2" />
    <rect x="10" y="10" width="3" height="3" rx="0.5" fill="#36A853" />
    <rect x="24" y="7" width="9" height="9" rx="2" stroke="#18261E" strokeWidth="2.2" />
    <rect x="27" y="10" width="3" height="3" rx="0.5" fill="#36A853" />
    <rect x="7" y="24" width="9" height="9" rx="2" stroke="#18261E" strokeWidth="2.2" />
    <rect x="10" y="27" width="3" height="3" rx="0.5" fill="#36A853" />
    {/* Botanical Leaf integrated into lower-right QR quadrant */}
    <path
      d="M21 33C21 25.5 25.5 20.5 33 19.5C32.5 27 28 32.5 21 33Z"
      fill="#36A853"
    />
    <path
      d="M21 33C24 28.5 27.5 25 31.5 21.5"
      stroke="#8BCF5B"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect x="19" y="19" width="3" height="3" rx="0.6" fill="#18261E" />
  </svg>
);

export const SupplyChainHeroArtwork: React.FC = () => (
  <div className="relative w-full rounded-2xl border border-[#E5E7EB] bg-[#F1FAF0] p-6 md:p-8 overflow-hidden">
    <svg
      viewBox="0 0 640 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      role="img"
      aria-label="Illustration of agricultural produce journey from farm harvest through refrigerated transport, wholesale hub, retail store, and QR scan by consumer"
    >
      {/* Bright Sky & Rolling Farmland */}
      <rect width="640" height="340" rx="16" fill="#EFF8FF" />
      <circle cx="556" cy="64" r="34" fill="#FFD166" />
      <path
        d="M0 235C110 205 220 215 340 240C450 262 550 230 640 218V340H0V235Z"
        fill="#8BCF5B"
        fillOpacity="0.45"
      />
      <path
        d="M0 268C150 245 310 278 470 258C545 248 600 255 640 264V340H0V268Z"
        fill="#36A853"
        fillOpacity="0.28"
      />

      {/* Connecting Supply Chain Route Line */}
      <path
        d="M96 196 H228 H366 H508"
        stroke="#36A853"
        strokeWidth="3.5"
        strokeDasharray="7 7"
      />

      {/* Stage 1: Farm */}
      <g transform="translate(36, 128)">
        <rect x="0" y="0" width="116" height="122" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
        <path d="M36 52L58 34L80 52V74H36V52Z" fill="#FFAD66" stroke="#18261E" strokeWidth="2" />
        <rect x="52" y="58" width="12" height="16" fill="#FFFFFF" stroke="#18261E" strokeWidth="1.8" />
        <path d="M24 74H92" stroke="#36A853" strokeWidth="3" strokeLinecap="round" />
        <text x="58" y="96" textAnchor="middle" fill="#18261E" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          1. Farm Origin
        </text>
        <text x="58" y="111" textAnchor="middle" fill="#4B5563" fontSize="10" fontFamily="DM Sans, sans-serif">
          Batch + QR Issued
        </text>
      </g>

      {/* Stage 2: Cold Chain & Wholesale */}
      <g transform="translate(184, 128)">
        <rect x="0" y="0" width="116" height="122" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
        <rect x="26" y="42" width="44" height="26" rx="4" fill="#45B8E8" stroke="#18261E" strokeWidth="2" />
        <path d="M70 50H84L90 58V68H70V50Z" fill="#EFF8FF" stroke="#18261E" strokeWidth="2" />
        <circle cx="38" cy="70" r="6" fill="#18261E" />
        <circle cx="78" cy="70" r="6" fill="#18261E" />
        <text x="58" y="96" textAnchor="middle" fill="#18261E" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          2. Wholesale
        </text>
        <text x="58" y="111" textAnchor="middle" fill="#4B5563" fontSize="10" fontFamily="DM Sans, sans-serif">
          Transit & Cold Log
        </text>
      </g>

      {/* Stage 3: Retail Shop */}
      <g transform="translate(332, 128)">
        <rect x="0" y="0" width="116" height="122" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
        <path d="M30 46H86L80 34H36L30 46Z" fill="#8BCF5B" stroke="#18261E" strokeWidth="2" />
        <rect x="34" y="46" width="48" height="28" fill="#F1FAF0" stroke="#18261E" strokeWidth="2" />
        <rect x="46" y="54" width="24" height="20" fill="#FFFFFF" stroke="#18261E" strokeWidth="1.8" />
        <text x="58" y="96" textAnchor="middle" fill="#18261E" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          3. Retail Store
        </text>
        <text x="58" y="111" textAnchor="middle" fill="#4B5563" fontSize="10" fontFamily="DM Sans, sans-serif">
          Shelf Arrival Logged
        </text>
      </g>

      {/* Stage 4: Consumer QR Scan */}
      <g transform="translate(480, 128)">
        <rect x="0" y="0" width="124" height="122" rx="14" fill="#FFFFFF" stroke="#36A853" strokeWidth="2.5" />
        <rect x="42" y="28" width="40" height="46" rx="6" fill="#F1FAF0" stroke="#18261E" strokeWidth="2" />
        <rect x="50" y="36" width="10" height="10" stroke="#36A853" strokeWidth="2" />
        <rect x="64" y="36" width="10" height="10" stroke="#36A853" strokeWidth="2" />
        <rect x="50" y="50" width="10" height="10" stroke="#36A853" strokeWidth="2" />
        <path d="M64 60C64 53 68 50 74 49C73 56 69 60 64 60Z" fill="#36A853" />
        <text x="62" y="96" textAnchor="middle" fill="#18261E" fontSize="12" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          4. Consumer Scan
        </text>
        <text x="62" y="111" textAnchor="middle" fill="#36A853" fontSize="10" fontWeight="600" fontFamily="DM Sans, sans-serif">
          Verified Timeline
        </text>
      </g>

      {/* Header Callout inside Canvas */}
      <g transform="translate(36, 32)">
        <rect x="0" y="0" width="320" height="62" rx="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
        <circle cx="28" cy="31" r="12" fill="#36A853" />
        <path d="M23 31L26.5 34.5L33.5 27.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="50" y="27" fill="#18261E" fontSize="13" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
          Chronological Append-Only History
        </text>
        <text x="50" y="45" fill="#4B5563" fontSize="11" fontFamily="JetBrains Mono, monospace">
          FT-2026-DEMO8492 · 4 Recorded Stages
        </text>
      </g>
    </svg>
  </div>
);

export const ProduceArtworkThumb: React.FC<{
  category: string;
  produceName: string;
  imageDataUrl?: string;
  className?: string;
}> = ({ category, produceName, imageDataUrl, className = 'w-16 h-16' }) => {
  const [imgFailed, setImgFailed] = React.useState(false);

  if (imageDataUrl && !imgFailed) {
    return (
      <img
        src={imageDataUrl}
        alt={produceName}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${className} rounded-xl object-cover border border-[#E5E7EB] bg-[#F1FAF0]`}
      />
    );
  }

  const lower = category.toLowerCase();
  let bg = 'bg-[#F1FAF0]';
  let stroke = '#36A853';
  let fill = '#8BCF5B';

  if (lower.includes('tomato') || lower.includes('apple')) {
    bg = 'bg-[#FFF5EE]';
    stroke = '#D95D39';
    fill = '#FFAD66';
  } else if (lower.includes('tropical') || lower.includes('grain')) {
    bg = 'bg-[#FFFBEB]';
    stroke = '#B45309';
    fill = '#FFD166';
  } else if (lower.includes('root') || lower.includes('potato')) {
    bg = 'bg-[#EFF8FF]';
    stroke = '#0284C7';
    fill = '#45B8E8';
  }

  return (
    <div
      className={`${className} rounded-xl border border-[#E5E7EB] ${bg} flex items-center justify-center shrink-0`}
      aria-label={produceName}
    >
      <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden="true">
        <circle cx="18" cy="20" r="10" fill={fill} fillOpacity="0.45" stroke={stroke} strokeWidth="2" />
        <path d="M18 10C18 6.5 21 5 24 5C23.5 8 21 10 18 10Z" fill="#36A853" />
        <path d="M18 10C16 7 13.5 6 11 6.5" stroke="#36A853" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
};
