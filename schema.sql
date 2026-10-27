-- ============================================================================
-- TraceRoots — Relational Database Schema & Row-Level Security Reference (SQL)
-- Entities: Users, ProduceBatches, TrackingEvents (append-only), Transactions,
-- Subscriptions, ConsumerScans, Payments, FreshnessParameters, Notifications, AuditLogs
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY,
  public_code VARCHAR(24) UNIQUE NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  mobile VARCHAR(24) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('farmer','wholesaler','retailer','consumer','transporter','partner','admin')),
  business_name VARCHAR(200) DEFAULT '',
  address TEXT DEFAULT '',
  avatar_data_url TEXT,
  account_status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended','deleted')),
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  privacy_accepted_at TIMESTAMPTZ NOT NULL,
  public_farm_name_consent BOOLEAN NOT NULL DEFAULT TRUE,
  location_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_mobile ON users(mobile);

CREATE TABLE produce_batches (
  id UUID PRIMARY KEY,
  batch_code VARCHAR(32) UNIQUE NOT NULL,
  tracking_token VARCHAR(64) UNIQUE NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  farmer_id UUID NOT NULL REFERENCES users(id),
  farmer_name VARCHAR(160) NOT NULL,
  farm_name VARCHAR(200) NOT NULL,
  farmer_public_id VARCHAR(32) NOT NULL,
  farmer_contact VARCHAR(120) NOT NULL,
  farm_location TEXT NOT NULL,
  show_farmer_name_publicly BOOLEAN NOT NULL DEFAULT TRUE,
  produce_name VARCHAR(160) NOT NULL,
  category VARCHAR(120) NOT NULL,
  variety VARCHAR(120) DEFAULT '',
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(24) NOT NULL,
  harvest_date DATE NOT NULL,
  harvest_time VARCHAR(16) DEFAULT '',
  harvest_timestamp_utc TIMESTAMPTZ NOT NULL,
  expected_shelf_life_days NUMERIC(6, 2),
  storage_method VARCHAR(48) NOT NULL,
  batch_description TEXT DEFAULT '',
  image_data_url TEXT,
  quality_notes TEXT DEFAULT '',
  departure_location TEXT NOT NULL,
  departure_location_provenance VARCHAR(32) NOT NULL,
  departure_lat DOUBLE PRECISION,
  departure_lng DOUBLE PRECISION,
  departure_date DATE NOT NULL,
  departure_time VARCHAR(16) NOT NULL,
  destination TEXT DEFAULT '',
  transport_method VARCHAR(120) DEFAULT '',
  vehicle_details VARCHAR(200) DEFAULT '',
  current_status VARCHAR(64) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_farmer ON produce_batches(farmer_id);
CREATE INDEX idx_batches_token ON produce_batches(tracking_token);
CREATE INDEX idx_batches_status ON produce_batches(current_status);

-- Append-only Supply-Chain Tracking Events (no UPDATE or DELETE allowed for standard roles)
CREATE TABLE tracking_events (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES produce_batches(id),
  sequence_number INTEGER NOT NULL,
  participant_id UUID NOT NULL REFERENCES users(id),
  participant_role VARCHAR(32) NOT NULL,
  participant_name VARCHAR(160) NOT NULL,
  participant_business VARCHAR(200) DEFAULT '',
  event_type VARCHAR(64) NOT NULL,
  arrival_location TEXT DEFAULT '',
  arrival_location_provenance VARCHAR(32) NOT NULL,
  arrival_timestamp TIMESTAMPTZ,
  departure_location TEXT DEFAULT '',
  departure_location_provenance VARCHAR(32) NOT NULL,
  departure_timestamp TIMESTAMPTZ,
  storage_method VARCHAR(48) NOT NULL,
  storage_temperature_c NUMERIC(5, 2),
  refrigeration_interrupted BOOLEAN NOT NULL DEFAULT FALSE,
  produce_condition VARCHAR(48) NOT NULL,
  transport_method VARCHAR(120) DEFAULT '',
  vehicle_details VARCHAR(200) DEFAULT '',
  destination_participant VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  photo_data_url TEXT,
  transaction_id UUID,
  correction_of_event_id UUID REFERENCES tracking_events(id),
  correction_reason TEXT,
  verification_status VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  server_created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, sequence_number)
);

CREATE INDEX idx_events_batch_seq ON tracking_events(batch_id, sequence_number);

-- Private Financial Transactions (Restricted via RBAC & Row-Level Security)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  reference_code VARCHAR(32) UNIQUE NOT NULL,
  batch_id UUID NOT NULL REFERENCES produce_batches(id),
  related_event_id UUID NOT NULL REFERENCES tracking_events(id),
  participant_id UUID NOT NULL REFERENCES users(id),
  participant_role VARCHAR(32) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(24) NOT NULL,
  purchase_price_per_unit NUMERIC(12, 2) NOT NULL CHECK (purchase_price_per_unit >= 0),
  total_purchase_price NUMERIC(14, 2) NOT NULL CHECK (total_purchase_price >= 0),
  selling_price_per_unit NUMERIC(12, 2),
  expected_total_selling_value NUMERIC(14, 2),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_batch ON transactions(batch_id);
CREATE INDEX idx_transactions_participant ON transactions(participant_id);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  farmer_id UUID NOT NULL REFERENCES users(id),
  plan_id VARCHAR(64) NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  amount_inr INTEGER NOT NULL DEFAULT 100,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(24) NOT NULL CHECK (status IN ('active','pending','failed','cancelled','expired')),
  start_date_utc TIMESTAMPTZ NOT NULL,
  renewal_date_utc TIMESTAMPTZ NOT NULL,
  cancelled_at_utc TIMESTAMPTZ,
  payment_id UUID,
  provider_subscription_ref VARCHAR(128),
  UNIQUE (farmer_id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  receipt_number VARCHAR(32) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('farmer_subscription','consumer_scan')),
  related_batch_id UUID REFERENCES produce_batches(id),
  related_subscription_id UUID REFERENCES subscriptions(id),
  amount_inr INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  provider VARCHAR(32) NOT NULL,
  provider_order_id VARCHAR(128) UNIQUE NOT NULL,
  provider_payment_id VARCHAR(128),
  provider_signature TEXT,
  verification_status VARCHAR(24) NOT NULL CHECK (verification_status IN ('created','verified_paid','failed','cancelled','pending')),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consumer_scans (
  id UUID PRIMARY KEY,
  scan_code VARCHAR(32) UNIQUE NOT NULL,
  batch_id UUID NOT NULL REFERENCES produce_batches(id),
  tracking_token VARCHAR(64) NOT NULL,
  consumer_id UUID REFERENCES users(id),
  client_entitlement_key VARCHAR(128) NOT NULL,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_inr INTEGER NOT NULL DEFAULT 10,
  entitlement_status VARCHAR(24) NOT NULL DEFAULT 'unlocked',
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, client_entitlement_key)
);

CREATE TABLE freshness_parameters (
  id VARCHAR(48) PRIMARY KEY,
  category VARCHAR(120) UNIQUE NOT NULL,
  produce_examples TEXT NOT NULL,
  ambient_min_days NUMERIC(6, 2) NOT NULL,
  ambient_max_days NUMERIC(6, 2) NOT NULL,
  cold_min_days NUMERIC(6, 2) NOT NULL,
  cold_max_days NUMERIC(6, 2) NOT NULL,
  optimal_temp_min_c NUMERIC(5, 2) NOT NULL,
  optimal_temp_max_c NUMERIC(5, 2) NOT NULL,
  storage_assumptions TEXT NOT NULL,
  reference_notes TEXT NOT NULL,
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  outcome VARCHAR(24) NOT NULL,
  details TEXT NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
