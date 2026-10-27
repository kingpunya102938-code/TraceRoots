export type UserRole =
  | 'farmer'
  | 'wholesaler'
  | 'retailer'
  | 'consumer'
  | 'transporter'
  | 'partner'
  | 'admin';

export type AccountStatus = 'active' | 'suspended' | 'deleted';

export type LocationProvenance =
  | 'gps_detected'
  | 'gps_geocoded'
  | 'manual_entry'
  | 'not_recorded';

export type StorageMethod =
  | 'ambient'
  | 'ventilated_crate'
  | 'cold_storage'
  | 'controlled_atmosphere'
  | 'refrigerated_transport'
  | 'dry_warehouse';

export type ProduceUnit = 'kg' | 'quintal' | 'tonne' | 'crate' | 'other';

export type BatchStatus =
  | 'Registered'
  | 'In Transit'
  | 'At Wholesaler'
  | 'Dispatched by Wholesaler'
  | 'At Retailer'
  | 'Dispatched by Retailer'
  | 'At Partner Hub'
  | 'Delivered / Consumer Ready';

export type TrackingEventType =
  | 'Harvested & Registered'
  | 'Picked Up by Transporter'
  | 'Delivered by Transporter'
  | 'Wholesaler Received'
  | 'Wholesaler Dispatched'
  | 'Retailer Received'
  | 'Retailer Dispatched'
  | 'Partner Handoff'
  | 'Correction Record';

export type ProduceCondition =
  | 'Excellent'
  | 'Good'
  | 'Fair - Minor Bruising'
  | 'Caution - Ripening Fast'
  | 'Damaged';

export type VerificationStatus =
  | 'Submitted by registered participant'
  | 'Automatically recorded by platform'
  | 'Manually entered'
  | 'Not verified independently'
  | 'Audited admin correction';

export type SubscriptionStatus =
  | 'active'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type PaymentVerificationStatus =
  | 'created'
  | 'verified_paid'
  | 'failed'
  | 'cancelled'
  | 'pending';

export type FreshnessBand = 'Green' | 'Yellow' | 'Orange' | 'Red' | 'Grey';

export interface ConsentRecords {
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  publicFarmNameConsent: boolean;
  locationConsent: boolean;
}

export interface PublicUserProfile {
  id: string;
  publicCode: string;
  fullName: string;
  mobile: string;
  email: string;
  role: UserRole;
  businessName: string;
  address: string;
  avatarDataUrl?: string;
  accountStatus: AccountStatus;
  createdAt: string;
  consentRecords: ConsentRecords;
  savedBatchTokens: string[];
  isDemo?: boolean;
}

export interface FreshnessParameter {
  id: string;
  category: string;
  produceExamples: string;
  ambientMinDays: number;
  ambientMaxDays: number;
  coldMinDays: number;
  coldMaxDays: number;
  optimalTempMinC: number;
  optimalTempMaxC: number;
  storageAssumptions: string;
  referenceNotes: string;
  updatedAtUtc: string;
}

export interface FreshnessEstimate {
  band: FreshnessBand;
  label: string;
  shortStatus: string;
  elapsedHours: number;
  elapsedFormatted: string;
  expectedMinDays: number;
  expectedMaxDays: number;
  remainingMinDays: number;
  remainingMaxDays: number;
  remainingFormatted: string;
  progressPercent: number;
  confidence: 'High' | 'Moderate' | 'Limited';
  confidenceReason: string;
  storageAssumptionsUsed: string;
  temperatureSummary: string;
  disclaimer: string;
}

export interface ProduceBatch {
  id: string;
  batchCode: string;
  trackingToken: string;
  idempotencyKey: string;
  farmerId: string;
  farmerName: string;
  farmName: string;
  farmerPublicId: string;
  farmerContact: string;
  farmLocation: string;
  showFarmerNamePublicly: boolean;
  produceName: string;
  category: string;
  variety: string;
  quantity: number;
  unit: ProduceUnit;
  harvestDate: string;
  harvestTime: string;
  harvestTimestampUtc: string;
  expectedShelfLifeDays: number | null;
  storageMethod: StorageMethod;
  batchDescription: string;
  imageDataUrl?: string;
  qualityNotes: string;
  departureLocation: string;
  departureLocationProvenance: LocationProvenance;
  departureCoordinates?: { lat: number; lng: number } | null;
  departureDate: string;
  departureTime: string;
  destination: string;
  transportMethod: string;
  vehicleDetails: string;
  createdAtUtc: string;
  currentStatus: BatchStatus;
  isDemo: boolean;
}

export interface TrackingEvent {
  id: string;
  batchId: string;
  sequenceNumber: number;
  participantId: string;
  participantRole: UserRole;
  participantName: string;
  participantBusiness: string;
  eventType: TrackingEventType;
  arrivalLocation: string;
  arrivalLocationProvenance: LocationProvenance;
  arrivalTimestamp: string;
  departureLocation: string;
  departureLocationProvenance: LocationProvenance;
  departureTimestamp: string;
  storageMethod: StorageMethod;
  storageTemperatureC: number | null;
  refrigerationInterrupted: boolean;
  produceCondition: ProduceCondition;
  transportMethod: string;
  vehicleDetails: string;
  destinationParticipant: string;
  notes: string;
  photoDataUrl?: string;
  transactionId: string | null;
  transactionRefCode: string | null;
  correctionOfEventId: string | null;
  correctionReason: string | null;
  verificationStatus: VerificationStatus;
  serverCreatedAtUtc: string;
  idempotencyKey: string;
}

export interface FinancialTransaction {
  id: string;
  referenceCode: string;
  batchId: string;
  batchCode: string;
  produceName: string;
  relatedEventId: string;
  participantId: string;
  participantRole: UserRole;
  participantName: string;
  participantBusiness: string;
  quantity: number;
  unit: ProduceUnit;
  purchasePricePerUnit: number;
  totalPurchasePrice: number;
  sellingPricePerUnit: number | null;
  expectedTotalSellingValue: number | null;
  currency: 'INR';
  createdAtUtc: string;
}

export interface SubscriptionRecord {
  id: string;
  farmerId: string;
  planId: string;
  planName: string;
  amountInr: number;
  currency: 'INR';
  status: SubscriptionStatus;
  startDateUtc: string;
  renewalDateUtc: string;
  cancelledAtUtc: string | null;
  paymentId: string;
  providerSubscriptionRef: string;
}

export interface ConsumerScanRecord {
  id: string;
  scanCode: string;
  batchId: string;
  batchCode: string;
  produceName: string;
  trackingToken: string;
  consumerId: string | null;
  clientEntitlementKey: string;
  paymentId: string;
  amountInr: number;
  entitlementStatus: 'unlocked' | 'refunded';
  createdAtUtc: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  userId: string | null;
  purpose: 'farmer_subscription' | 'consumer_scan';
  relatedBatchId: string | null;
  relatedBatchCode: string | null;
  relatedSubscriptionId: string | null;
  amountInr: number;
  currency: 'INR';
  provider: 'razorpay_live' | 'razorpay_test_sandbox';
  providerOrderId: string;
  providerPaymentId: string | null;
  providerSignature: string | null;
  verificationStatus: PaymentVerificationStatus;
  idempotencyKey: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type:
    | 'batch_registered'
    | 'wholesaler_received'
    | 'retailer_received'
    | 'transporter_update'
    | 'batch_delivered'
    | 'subscription_alert'
    | 'payment_verified'
    | 'payment_failed'
    | 'freshness_warning'
    | 'missing_info';
  title: string;
  message: string;
  relatedBatchId: string | null;
  read: boolean;
  createdAtUtc: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: 'allowed' | 'denied' | 'error';
  details: string;
  ipHash: string;
  createdAtUtc: string;
}

export interface PricingConfiguration {
  farmerMonthlyPriceInr: number;
  consumerScanFeeInr: number;
  currency: 'INR';
  wholesalerFeeInr: number;
  retailerFeeInr: number;
  transporterFeeInr: number;
  updatedAtUtc: string;
}

export interface PublicTrackingResponse {
  batch: {
    batchCode: string;
    trackingToken: string;
    produceName: string;
    category: string;
    variety: string;
    quantity: number;
    unit: ProduceUnit;
    harvestDate: string;
    harvestTime: string;
    harvestTimestampUtc: string;
    farmerDisplayName: string;
    farmLocation: string;
    storageMethod: StorageMethod;
    batchDescription: string;
    imageDataUrl?: string;
    qualityNotes: string;
    departureLocation: string;
    departureLocationProvenance: LocationProvenance;
    departureDate: string;
    departureTime: string;
    destination: string;
    transportMethod: string;
    createdAtUtc: string;
    currentStatus: BatchStatus;
    isDemo: boolean;
  };
  events: Array<{
    id: string;
    sequenceNumber: number;
    participantRole: UserRole;
    participantBusiness: string;
    eventType: TrackingEventType;
    arrivalLocation: string;
    arrivalLocationProvenance: LocationProvenance;
    arrivalTimestamp: string;
    departureLocation: string;
    departureLocationProvenance: LocationProvenance;
    departureTimestamp: string;
    storageMethod: StorageMethod;
    storageTemperatureC: number | null;
    refrigerationInterrupted: boolean;
    produceCondition: ProduceCondition;
    transportMethod: string;
    destinationParticipant: string;
    notes: string;
    photoDataUrl?: string;
    transactionRefCode: string | null;
    correctionOfEventId: string | null;
    correctionReason: string | null;
    verificationStatus: VerificationStatus;
    serverCreatedAtUtc: string;
    stageDurationHours: number | null;
  }>;
  freshness: FreshnessEstimate;
  missingStages: string[];
  paidConsumerUnlocked: boolean;
  paidConsumerAnalytics: {
    coldChainCompliancePercent: number | null;
    totalRecordedHandoffs: number;
    stageBreakdown: Array<{
      stage: string;
      business: string;
      hoursSpent: number;
      storage: string;
      temperatureC: number | null;
    }>;
    provenanceCertificateId: string;
    scanReceiptNumber: string;
    unlockedAtUtc: string;
  } | null;
  consumerScanFeeInr: number;
}
