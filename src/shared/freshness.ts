import type {
  FreshnessBand,
  FreshnessEstimate,
  FreshnessParameter,
  ProduceBatch,
  StorageMethod,
  TrackingEvent,
} from './types.ts';

export const FOOD_SAFETY_DISCLAIMER =
  'Important Food Safety Notice: Estimated freshness is calculated from recorded harvest dates, configured crop shelf-life parameters, and participant-submitted storage conditions. It is NOT a food-safety guarantee, laboratory inspection, or certification that produce is safe to consume. Always inspect produce physically and wash thoroughly before consumption.';

export const DEFAULT_FRESHNESS_PARAMETERS: FreshnessParameter[] = [
  {
    id: 'fp_leafy',
    category: 'Leafy Vegetables',
    produceExamples: 'Spinach (Palak), Coriander, Fenugreek (Methi), Lettuce, Amaranth',
    ambientMinDays: 1.5,
    ambientMaxDays: 2.5,
    coldMinDays: 5,
    coldMaxDays: 8,
    optimalTempMinC: 1,
    optimalTempMaxC: 5,
    storageAssumptions: 'High respiration rate; rapid moisture loss above 15°C without misting or cold chain.',
    referenceNotes: 'ICAR Post-Harvest Horticulture Guidelines — Leafy Greens',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_root',
    category: 'Root Vegetables',
    produceExamples: 'Carrots, Radish, Beetroot, Turnip',
    ambientMinDays: 5,
    ambientMaxDays: 8,
    coldMinDays: 14,
    coldMaxDays: 28,
    optimalTempMinC: 0,
    optimalTempMaxC: 4,
    storageAssumptions: 'Topped roots stored in ventilated crates; high relative humidity slows shrivelling.',
    referenceNotes: 'Post-Harvest Cold Chain Standards — Root Crops',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_fruit_veg',
    category: 'Tomatoes & Fruit Vegetables',
    produceExamples: 'Tomatoes, Bell Peppers (Capsicum), Brinjal, Okra, Cucumber',
    ambientMinDays: 4,
    ambientMaxDays: 7,
    coldMinDays: 10,
    coldMaxDays: 16,
    optimalTempMinC: 10,
    optimalTempMaxC: 13,
    storageAssumptions: 'Chilling-sensitive below 8°C; cool ventilated crates at 10–13°C maximize firmness.',
    referenceNotes: 'NHB Post-Harvest Handling Manual — Solanaceous Crops',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_apples_fruits',
    category: 'Apples & Temperate Fruits',
    produceExamples: 'Apples, Pears, Table Grapes, Pomegranates, Strawberries',
    ambientMinDays: 7,
    ambientMaxDays: 14,
    coldMinDays: 30,
    coldMaxDays: 60,
    optimalTempMinC: 1,
    optimalTempMaxC: 4,
    storageAssumptions: 'Precooling within 12h of harvest and uninterrupted 1–4°C storage preserves crispness.',
    referenceNotes: 'Cold Chain Association Temperate Fruit Shelf-Life Reference',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_tropical_fruits',
    category: 'Bananas & Tropical Fruits',
    produceExamples: 'Bananas, Alphonso Mangoes, Papaya, Guava, Pineapple',
    ambientMinDays: 3,
    ambientMaxDays: 6,
    coldMinDays: 8,
    coldMaxDays: 14,
    optimalTempMinC: 13,
    optimalTempMaxC: 15,
    storageAssumptions: 'Climacteric ripening accelerates sharply above 25°C; chilling injury occurs below 12°C.',
    referenceNotes: 'Tropical Fruit Ripening & Transit Reference Matrix',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_potatoes_onions',
    category: 'Potatoes & Onions',
    produceExamples: 'Potatoes, Red Onions, White Onions, Garlic, Ginger',
    ambientMinDays: 21,
    ambientMaxDays: 45,
    coldMinDays: 60,
    coldMaxDays: 120,
    optimalTempMinC: 4,
    optimalTempMaxC: 15,
    storageAssumptions: 'Well-cured bulbs/tubers in dry, dark, ventilated bags or cured cold storage.',
    referenceNotes: 'Directorate of Onion & Garlic / CPRI Storage Guidelines',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_grains_pulses',
    category: 'Grains & Pulses',
    produceExamples: 'Basmati Rice, Wheat, Tur Dal, Moong Dal, Chickpeas, Millets',
    ambientMinDays: 120,
    ambientMaxDays: 240,
    coldMinDays: 240,
    coldMaxDays: 365,
    optimalTempMinC: 10,
    optimalTempMaxC: 25,
    storageAssumptions: 'Dried below 12% moisture content in clean, pest-protected dry warehouse storage.',
    referenceNotes: 'FCI / Dry Commodity Storage Standards',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'fp_other',
    category: 'Other Produce',
    produceExamples: 'Mixed Farm Produce, Herbs, Gourds, Specialty Crops',
    ambientMinDays: 3,
    ambientMaxDays: 5,
    coldMinDays: 7,
    coldMaxDays: 12,
    optimalTempMinC: 4,
    optimalTempMaxC: 12,
    storageAssumptions: 'Conservative general horticultural baseline applied when specific crop model is not selected.',
    referenceNotes: 'TraceRoots Conservative Baseline',
    updatedAtUtc: '2026-10-01T00:00:00.000Z',
  },
];

function isColdStorageMethod(method: StorageMethod): boolean {
  return (
    method === 'cold_storage' ||
    method === 'controlled_atmosphere' ||
    method === 'refrigerated_transport'
  );
}

export function formatElapsedDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '0 hours';
  const totalHours = Math.floor(hours);
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  if (days === 0) {
    return `${remHours} hour${remHours === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}, ${remHours} hour${remHours === 1 ? '' : 's'}`;
}

export function calculateFreshnessEstimate(
  batch: Pick<
    ProduceBatch,
    | 'category'
    | 'harvestTimestampUtc'
    | 'expectedShelfLifeDays'
    | 'storageMethod'
  >,
  events: Array<
    Pick<
      TrackingEvent,
      | 'storageMethod'
      | 'storageTemperatureC'
      | 'refrigerationInterrupted'
      | 'produceCondition'
      | 'eventType'
    >
  >,
  parameters: FreshnessParameter[],
  nowDate: Date = new Date()
): FreshnessEstimate {
  const harvestMs = Date.parse(batch.harvestTimestampUtc);
  if (Number.isNaN(harvestMs)) {
    return {
      band: 'Grey',
      label: 'Grey — Insufficient data',
      shortStatus: 'Insufficient data',
      elapsedHours: 0,
      elapsedFormatted: 'Unknown',
      expectedMinDays: 0,
      expectedMaxDays: 0,
      remainingMinDays: 0,
      remainingMaxDays: 0,
      remainingFormatted: 'Unable to estimate — valid harvest timestamp missing.',
      progressPercent: 0,
      confidence: 'Limited',
      confidenceReason: 'Harvest date/time is missing or invalid in batch record.',
      storageAssumptionsUsed: 'None — insufficient baseline data.',
      temperatureSummary: 'No temperature logs recorded.',
      disclaimer: FOOD_SAFETY_DISCLAIMER,
    };
  }

  const param =
    parameters.find(
      (p) => p.category.toLowerCase() === batch.category.toLowerCase()
    ) ||
    parameters.find((p) => p.id === 'fp_other') ||
    DEFAULT_FRESHNESS_PARAMETERS[DEFAULT_FRESHNESS_PARAMETERS.length - 1];

  const elapsedMs = Math.max(0, nowDate.getTime() - harvestMs);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const elapsedDays = elapsedHours / 24;

  // Determine storage continuity across all events
  const allStorageMethods: StorageMethod[] = [
    batch.storageMethod,
    ...events.map((e) => e.storageMethod),
  ];
  const coldCount = allStorageMethods.filter(isColdStorageMethod).length;
  const allCold = coldCount === allStorageMethods.length;
  const anyCold = coldCount > 0;

  const recordedTemps = events
    .map((e) => e.storageTemperatureC)
    .filter((t): t is number => typeof t === 'number' && !Number.isNaN(t));

  const anyInterruption = events.some((e) => e.refrigerationInterrupted);
  const tempOutOfRange = recordedTemps.some(
    (t) => t > param.optimalTempMaxC + 4 || t < param.optimalTempMinC - 3
  );

  // Base shelf-life window
  let minDays = param.ambientMinDays;
  let maxDays = param.ambientMaxDays;
  let storageDesc = `Ambient / ventilated handling (${param.ambientMinDays}–${param.ambientMaxDays} days baseline)`;

  if (allCold && !anyInterruption) {
    minDays = param.coldMinDays;
    maxDays = param.coldMaxDays;
    storageDesc = `Continuous cold-chain storage (${param.coldMinDays}–${param.coldMaxDays} days baseline, optimal ${param.optimalTempMinC}–${param.optimalTempMaxC}°C)`;
  } else if (anyCold) {
    // Mixed cold and ambient: conservative blended shelf-life
    minDays = Number(((param.ambientMinDays + param.coldMinDays) * 0.42).toFixed(1));
    maxDays = Number(((param.ambientMaxDays + param.coldMaxDays) * 0.45).toFixed(1));
    storageDesc = `Partial cold-chain with ambient stages (conservative blended window ${minDays}–${maxDays} days)`;
  }

  // Respect farmer's explicit conservative shelf-life override if shorter
  if (
    typeof batch.expectedShelfLifeDays === 'number' &&
    batch.expectedShelfLifeDays > 0 &&
    batch.expectedShelfLifeDays < maxDays
  ) {
    maxDays = batch.expectedShelfLifeDays;
    minDays = Math.min(minDays, Math.max(0.5, Number((maxDays * 0.7).toFixed(1))));
    storageDesc += `; capped at farmer-declared ${batch.expectedShelfLifeDays}d shelf-life`;
  }

  // Penalize refrigeration interruptions or high-temp excursions
  if (anyInterruption || tempOutOfRange) {
    minDays = Number((minDays * 0.75).toFixed(1));
    maxDays = Number((maxDays * 0.78).toFixed(1));
  }

  // Penalize adverse physical condition reports
  const latestCondition =
    events.length > 0 ? events[events.length - 1].produceCondition : 'Good';
  if (latestCondition === 'Caution - Ripening Fast' || latestCondition === 'Fair - Minor Bruising') {
    minDays = Number((minDays * 0.8).toFixed(1));
    maxDays = Number((maxDays * 0.82).toFixed(1));
  } else if (latestCondition === 'Damaged') {
    minDays = Number((minDays * 0.4).toFixed(1));
    maxDays = Number((maxDays * 0.5).toFixed(1));
  }

  const remainingMinDays = Number((minDays - elapsedDays).toFixed(1));
  const remainingMaxDays = Number((maxDays - elapsedDays).toFixed(1));
  const ratioToMin = minDays > 0 ? elapsedDays / minDays : 1;
  const ratioToMax = maxDays > 0 ? elapsedDays / maxDays : 1;
  const progressPercent = Math.min(100, Math.max(2, Math.round(ratioToMax * 100)));

  let band: FreshnessBand = 'Green';
  let label = 'Green — Estimated fresh';
  let shortStatus = 'Estimated fresh';

  if (latestCondition === 'Damaged' || elapsedDays >= maxDays) {
    band = 'Red';
    label = 'Red — Estimated shelf-life limit exceeded';
    shortStatus = 'Shelf-life limit exceeded';
  } else if (
    elapsedDays >= minDays ||
    anyInterruption ||
    latestCondition === 'Caution - Ripening Fast'
  ) {
    band = 'Orange';
    label = 'Orange — Use caution';
    shortStatus = 'Use caution';
  } else if (ratioToMin >= 0.65 || tempOutOfRange) {
    band = 'Yellow';
    label = 'Yellow — Freshness declining';
    shortStatus = 'Freshness declining';
  }

  // Determine confidence level honestly
  let confidence: 'High' | 'Moderate' | 'Limited' = 'Limited';
  const reasons: string[] = [];

  if (events.length <= 1) {
    reasons.push('only initial registration stage recorded');
  }
  if (recordedTemps.length === 0) {
    reasons.push('storage temperature history is incomplete');
  } else if (recordedTemps.length < events.length) {
    reasons.push('partial temperature logs across handoffs');
  }
  if (anyInterruption) {
    reasons.push('refrigeration interruption reported');
  }

  if (recordedTemps.length >= Math.max(1, events.length - 1) && events.length >= 2 && !anyInterruption) {
    confidence = 'High';
  } else if (events.length >= 2 || recordedTemps.length >= 1) {
    confidence = 'Moderate';
  } else {
    confidence = 'Limited';
  }

  const confidenceReason =
    reasons.length > 0
      ? `${confidence} — ${reasons.join('; ')}; conservative assumptions applied.`
      : `${confidence} — multi-stage timestamps and storage temperature readings recorded.`;

  let remainingFormatted = '';
  if (remainingMaxDays <= 0) {
    const overdueDays = Math.abs(remainingMaxDays).toFixed(1);
    remainingFormatted = `Estimated window exceeded by ~${overdueDays} days under selected storage assumptions.`;
  } else if (remainingMinDays <= 0) {
    remainingFormatted = `Up to ~${Math.max(0.2, remainingMaxDays).toFixed(1)} days remaining under upper storage assumptions.`;
  } else {
    remainingFormatted = `Approximately ${Math.max(0.5, remainingMinDays).toFixed(1)}–${remainingMaxDays.toFixed(1)} days under selected storage assumptions.`;
  }

  const temperatureSummary =
    recordedTemps.length > 0
      ? `Recorded temperatures: ${Math.min(...recordedTemps)}°C to ${Math.max(...recordedTemps)}°C (${recordedTemps.length} reading${recordedTemps.length === 1 ? '' : 's'})`
      : 'No measured thermometer readings submitted; relying on declared storage method.';

  return {
    band,
    label,
    shortStatus,
    elapsedHours: Number(elapsedHours.toFixed(1)),
    elapsedFormatted: formatElapsedDuration(elapsedHours),
    expectedMinDays: minDays,
    expectedMaxDays: maxDays,
    remainingMinDays,
    remainingMaxDays,
    remainingFormatted,
    progressPercent,
    confidence,
    confidenceReason,
    storageAssumptionsUsed: storageDesc,
    temperatureSummary,
    disclaimer: FOOD_SAFETY_DISCLAIMER,
  };
}
