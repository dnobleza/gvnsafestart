-- SafeStart client portal schema (PostgreSQL)
--
-- Prisma (backend/prisma/schema.prisma) is the source of truth for migrations.
-- This file mirrors that schema so it can be pasted into the pgAdmin 4 Query Tool
-- or reviewed as plain SQL. Use EITHER this script OR `prisma migrate dev` on a
-- given database -- not both, or the Prisma migration history will disagree with
-- the live schema.
--
-- Usage in pgAdmin 4:
--   1. Databases -> Create -> Database... -> name: safestart
--   2. Right-click safestart -> Query Tool -> paste this file -> Execute (F5)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- enums

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('ONE_TIME', 'MONTHLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK', 'PHONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Databases created before the instructor dashboard still have APPROVED.
DO $$ BEGIN
  ALTER TYPE "BookingStatus" RENAME VALUE 'APPROVED' TO 'CONFIRMED';
EXCEPTION WHEN invalid_parameter_value THEN NULL; END $$;
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'FAILED', 'REFUNDED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

DO $$ BEGIN
  CREATE TYPE "BookingAction" AS ENUM ('CREATED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'CASH_RECORDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VoidRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "BookingAction" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';

DO $$ BEGIN
  CREATE TYPE "ActorRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'CLIENT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'CASH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'AWAITING_CASH', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------- updated_at trigger

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- tables

-- email and password_hash are nullable: a phone-only or Google-only account has
-- neither. The CHECK guarantees at least one way to reach the person.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        UNIQUE,
  password_hash text,
  role          "UserRole"  NOT NULL,
  full_name     text        NOT NULL,
  phone         text        UNIQUE,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_or_phone_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- Permanent record of what each person submitted when they signed up. Written in
-- the same transaction as their users row, but deliberately NOT linked to it:
-- no user_id column, no FK. users is the live login record; this is the history.
CREATE TABLE IF NOT EXISTS registrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text           UNIQUE,
  phone            text           UNIQUE,
  password_hash    text,
  full_name        text           NOT NULL,
  role             "UserRole"     NOT NULL DEFAULT 'CLIENT',
  provider         "AuthProvider" NOT NULL DEFAULT 'LOCAL',
  provider_user_id text,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT registrations_email_or_phone_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_provider_provider_user_id_key
  ON registrations (provider, provider_user_id);
CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON registrations (created_at);

-- One row per external provider linked to an account, so the same person can
-- sign in with Google and Facebook and land on one users row.
CREATE TABLE IF NOT EXISTS auth_identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid           NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  provider         "AuthProvider" NOT NULL,
  provider_user_id text           NOT NULL,
  email            text,
  created_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_identities_provider_provider_user_id_key
  ON auth_identities (provider, provider_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_identities_user_id_provider_key
  ON auth_identities (user_id, provider);

-- Short-lived SMS codes. code_hash is bcrypt; the raw code is never stored.
CREATE TABLE IF NOT EXISTS phone_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otps_phone_expires_at_idx ON phone_otps (phone, expires_at);

CREATE TABLE IF NOT EXISTS client_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  company_name    text,
  billing_address text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text           NOT NULL UNIQUE,
  name          text           NOT NULL,
  description   text,
  price         numeric(12, 2) NOT NULL,
  currency      char(3)        NOT NULL DEFAULT 'USD',
  billing_cycle "BillingCycle" NOT NULL,
  is_active     boolean        NOT NULL DEFAULT true,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  updated_at    timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS services_is_active_idx ON services (is_active);

CREATE TABLE IF NOT EXISTS service_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid            NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  service_id        uuid            NOT NULL REFERENCES services (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  assigned_instructor_id uuid            REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  status            "RequestStatus" NOT NULL DEFAULT 'PENDING',
  title             text            NOT NULL,
  details           text,
  requested_at      timestamptz     NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_client_id_status_idx ON service_requests (client_id, status);
CREATE INDEX IF NOT EXISTS service_requests_assigned_instructor_id_idx ON service_requests (assigned_instructor_id);
CREATE INDEX IF NOT EXISTS service_requests_service_id_idx ON service_requests (service_id);

CREATE TABLE IF NOT EXISTS request_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid            NOT NULL REFERENCES service_requests (id) ON DELETE CASCADE ON UPDATE CASCADE,
  from_status   "RequestStatus",
  to_status     "RequestStatus" NOT NULL,
  changed_by_id uuid            REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  note          text,
  created_at    timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_status_history_request_id_idx ON request_status_history (request_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     text            NOT NULL UNIQUE,
  client_id          uuid            NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  service_request_id uuid            REFERENCES service_requests (id) ON DELETE SET NULL ON UPDATE CASCADE,
  status             "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  currency           char(3)         NOT NULL DEFAULT 'USD',
  subtotal           numeric(12, 2)  NOT NULL,
  tax                numeric(12, 2)  NOT NULL DEFAULT 0,
  total              numeric(12, 2)  NOT NULL,
  issued_at          timestamptz,
  due_at             timestamptz,
  paid_at            timestamptz,
  created_at         timestamptz     NOT NULL DEFAULT now(),
  updated_at         timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_client_id_status_idx ON invoices (client_id, status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid           NOT NULL REFERENCES invoices (id) ON DELETE CASCADE ON UPDATE CASCADE,
  description text           NOT NULL,
  quantity    numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price  numeric(12, 2) NOT NULL,
  line_total  numeric(12, 2) NOT NULL,
  created_at  timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items (invoice_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid            NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  lesson_type      text            NOT NULL,
  area             text,
  scheduled_at     timestamptz     NOT NULL,
  duration_minutes integer         NOT NULL DEFAULT 60,
  status           "BookingStatus" NOT NULL DEFAULT 'PENDING',
  notes            text,
  cancel_reason    text,
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_scheduled_at_idx ON bookings (scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_status_scheduled_at_idx ON bookings (status, scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON bookings (client_id);

CREATE TABLE IF NOT EXISTS payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid            REFERENCES bookings (id) ON DELETE SET NULL ON UPDATE CASCADE,
  client_id  uuid            NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount     numeric(12, 2)  NOT NULL,
  currency   char(3)         NOT NULL DEFAULT 'PHP',
  status     "PaymentStatus" NOT NULL,
  method     text,
  reference  text,
  paid_at    timestamptz,
  created_at timestamptz     NOT NULL DEFAULT now(),
  updated_at timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_status_created_at_idx ON payments (status, created_at);
CREATE INDEX IF NOT EXISTS payments_client_id_idx ON payments (client_id);

CREATE TABLE IF NOT EXISTS branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Address lives here, not on users, so it is only ever read through the
-- instructor detail and self-profile endpoints.
CREATE TABLE IF NOT EXISTS instructor_profiles (
  user_id    uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_id  uuid        NOT NULL REFERENCES branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  street     text        NOT NULL,
  barangay   text        NOT NULL,
  city       text        NOT NULL,
  province   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instructor_profiles_branch_id_idx ON instructor_profiles (branch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  actor_email text        NOT NULL,
  action      text        NOT NULL,
  target_type text        NOT NULL,
  target_id   text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs (actor_id);

-- ------------------------------------------------- instructor dashboard

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS instructor_id  uuid REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_action_by uuid REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_action_at timestamptz;
CREATE INDEX IF NOT EXISTS bookings_instructor_id_scheduled_at_idx ON bookings (instructor_id, scheduled_at);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at   timestamptz;
CREATE INDEX IF NOT EXISTS payments_recorded_by_created_at_idx ON payments (recorded_by, created_at);

CREATE TABLE IF NOT EXISTS booking_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid            NOT NULL REFERENCES bookings (id) ON DELETE CASCADE ON UPDATE CASCADE,
  action           "BookingAction" NOT NULL,
  from_status      "BookingStatus",
  to_status        "BookingStatus",
  old_scheduled_at timestamptz,
  new_scheduled_at timestamptz,
  reason           text,
  changed_by       uuid            REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  changed_by_role  "ActorRole"     NOT NULL,
  created_at       timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_history_booking_id_created_at_idx ON booking_history (booking_id, created_at);
CREATE INDEX IF NOT EXISTS booking_history_changed_by_idx ON booking_history (changed_by);

-- Times are local wall-clock "HH:MM" in APP_TIMEZONE.
CREATE TABLE IF NOT EXISTS instructor_availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  day_of_week   smallint    NOT NULL CONSTRAINT instructor_availability_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    varchar(5)  NOT NULL,
  end_time      varchar(5)  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instructor_availability_time_check
    CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_time > start_time)
);
CREATE INDEX IF NOT EXISTS instructor_availability_instructor_id_day_of_week_idx ON instructor_availability (instructor_id, day_of_week);

CREATE TABLE IF NOT EXISTS instructor_days_off (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  date          date        NOT NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, date)
);

CREATE TABLE IF NOT EXISTS client_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  note          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_notes_instructor_id_client_id_created_at_idx ON client_notes (instructor_id, client_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  type       text        NOT NULL,
  title      text        NOT NULL,
  message    text        NOT NULL,
  booking_id uuid        REFERENCES bookings (id) ON DELETE SET NULL ON UPDATE CASCADE,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid         NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id     uuid         NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  instructor_id uuid         NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  stars         smallint     NOT NULL CONSTRAINT ratings_stars_check CHECK (stars BETWEEN 1 AND 5),
  comment       varchar(500),
  is_hidden     boolean      NOT NULL DEFAULT false,
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ratings_instructor_id_created_at_idx ON ratings (instructor_id, created_at);

CREATE TABLE IF NOT EXISTS cash_void_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid                NOT NULL REFERENCES payments (id) ON DELETE CASCADE ON UPDATE CASCADE,
  requested_by uuid                NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  reason       text                NOT NULL,
  status       "VoidRequestStatus" NOT NULL DEFAULT 'PENDING',
  reviewed_by  uuid                REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  reviewed_at  timestamptz,
  created_at   timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_void_requests_payment_id_idx ON cash_void_requests (payment_id);
CREATE INDEX IF NOT EXISTS cash_void_requests_status_created_at_idx ON cash_void_requests (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS cash_void_requests_one_pending_idx ON cash_void_requests (payment_id) WHERE status = 'PENDING';

-- ---------------------------------------------- client booking + payments

-- Databases created before this section still store history roles as "UserRole".
ALTER TABLE booking_history ALTER COLUMN changed_by_role TYPE "ActorRole" USING (changed_by_role::text::"ActorRole");

ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude  numeric(9, 6);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);
DO $$ BEGIN
  ALTER TABLE branches ADD CONSTRAINT branches_coordinates_check
    CHECK ((latitude IS NULL) = (longitude IS NULL)
       AND (latitude IS NULL OR latitude BETWEEN -90 AND 90)
       AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS saved_city      text;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS saved_latitude  numeric(9, 6);
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS saved_longitude numeric(9, 6);
DO $$ BEGIN
  ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_saved_coordinates_check
    CHECK ((saved_latitude IS NULL) = (saved_longitude IS NULL)
       AND (saved_latitude IS NULL OR saved_latitude BETWEEN -90 AND 90)
       AND (saved_longitude IS NULL OR saved_longitude BETWEEN -180 AND 180));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method "PaymentMethod"        NOT NULL DEFAULT 'CASH';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status "BookingPaymentStatus" NOT NULL DEFAULT 'AWAITING_CASH';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price          numeric(12, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;
CREATE INDEX IF NOT EXISTS bookings_payment_status_payment_due_at_idx ON bookings (payment_status, payment_due_at);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider           text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_url       text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expires_at         timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_key ON payments (provider_reference);

-- One row per provider webhook event, so a redelivered event is ignored.
CREATE TABLE IF NOT EXISTS payment_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text        NOT NULL,
  event_id    text        NOT NULL,
  type        text        NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_by uuid        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (key, value) VALUES
  ('clientChangeCutoffHours', '24'),
  ('onlinePaymentExpiryMinutes', '30'),
  ('cashAutoCancelHours', '12'),
  ('pricePerHour', '800'),
  ('reservationFee', '1000')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------------------------------- packages

DO $$ BEGIN
  CREATE TYPE "TrainingType" AS ENUM ('OWN_CAR', 'CAR_RENTAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PackagePaymentStatus" AS ENUM ('UNPAID', 'AWAITING_CASH', 'RESERVED', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS service_areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  is_active  boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  description       text,
  sessions          integer     NOT NULL,
  hours_per_session integer     NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  sort_order        integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT packages_shape_check CHECK (sessions BETWEEN 1 AND 20 AND hours_per_session BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS package_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id      uuid           NOT NULL REFERENCES packages (id) ON DELETE CASCADE ON UPDATE CASCADE,
  service_area_id uuid           NOT NULL REFERENCES service_areas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  training_type   "TrainingType" NOT NULL,
  price           numeric(12, 2) NOT NULL CONSTRAINT package_rates_price_check CHECK (price > 0),
  updated_at      timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (package_id, service_area_id, training_type)
);

-- One purchase. Name, price, session count and length are snapshots, so later
-- catalogue edits never change what a client already bought.
CREATE TABLE IF NOT EXISTS client_packages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid                   NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  package_id          uuid                   NOT NULL REFERENCES packages (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  service_area_id     uuid                   NOT NULL REFERENCES service_areas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  training_type       "TrainingType"         NOT NULL,
  instructor_id       uuid                   NOT NULL REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  package_name        text                   NOT NULL,
  price               numeric(12, 2)         NOT NULL,
  sessions_total      integer                NOT NULL,
  minutes_per_session integer                NOT NULL,
  pickup_address      text                   NOT NULL,
  payment_method      "PaymentMethod"        NOT NULL,
  reservation_fee     numeric(12, 2)         NOT NULL,
  amount_paid         numeric(12, 2)         NOT NULL DEFAULT 0,
  payment_status      "PackagePaymentStatus" NOT NULL,
  payment_due_at      timestamptz,
  status              "PackageStatus"        NOT NULL DEFAULT 'ACTIVE',
  created_at          timestamptz            NOT NULL DEFAULT now(),
  updated_at          timestamptz            NOT NULL DEFAULT now(),
  CONSTRAINT client_packages_amounts_check CHECK (price > 0 AND reservation_fee >= 0 AND amount_paid >= 0)
);
CREATE INDEX IF NOT EXISTS client_packages_client_id_created_at_idx ON client_packages (client_id, created_at);
CREATE INDEX IF NOT EXISTS client_packages_payment_status_payment_due_at_idx ON client_packages (payment_status, payment_due_at);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_package_id uuid REFERENCES client_packages (id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_number    integer;
CREATE INDEX IF NOT EXISTS bookings_client_package_id_idx ON bookings (client_package_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_package_id uuid REFERENCES client_packages (id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS payments_client_package_id_idx ON payments (client_package_id);

INSERT INTO service_areas (name, sort_order) VALUES
  ('Metro Manila', 1),
  ('Rizal (Antipolo, Cainta, Taytay, San Mateo, Rodriguez)', 2),
  ('Rizal (Angono, Baras, Binangonan, Cardona, Jalajala, Morong, Pililla, Tanay, Teresa)', 3),
  ('Cavite', 4),
  ('Laguna', 5),
  ('Batangas', 6),
  ('Bulacan', 7),
  ('Pampanga', 8),
  ('Tarlac (Bamban, Capas, Concepcion, Tarlac City)', 9)
ON CONFLICT (name) DO NOTHING;

INSERT INTO packages (code, name, description, sessions, hours_per_session, sort_order) VALUES
  ('OPTION_1', 'Option 1', 'One session of 5 hours of actual driving. Ideal for a quick refresher or initial assessment.', 1, 5, 1),
  ('OPTION_1_PLUS', 'Option 1+', 'Two sessions of 5 hours each, spread across 2 days.', 2, 5, 2),
  ('OPTION_2', 'Option 2', 'Three sessions totaling 15 hours of actual driving. Our most popular package for beginners.', 3, 5, 3),
  ('OPTION_3', 'Option 3', 'One extended session of 12 hours of actual driving. Intensive training in a single day.', 1, 12, 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO package_rates (package_id, service_area_id, training_type, price)
SELECT p.id, a.id, 'OWN_CAR', v.price
FROM (VALUES ('OPTION_1', 2500), ('OPTION_1_PLUS', 5000), ('OPTION_2', 7000), ('OPTION_3', 5000)) AS v(code, price)
JOIN packages p ON p.code = v.code
JOIN service_areas a ON a.name = 'Metro Manila'
ON CONFLICT (package_id, service_area_id, training_type) DO NOTHING;

-- ------------------------------------------- official receipt numbers

-- OR numbers (OR-<year>-<n>) restart at 1 each calendar year. The counter row
-- is incremented inside the payment's transaction, so concurrent payments
-- queue on the row lock and a rolled-back payment leaves no gap.
CREATE TABLE IF NOT EXISTS receipt_counters (
  year        integer PRIMARY KEY,
  last_number integer NOT NULL
);
DROP SEQUENCE IF EXISTS official_receipt_seq;
CREATE UNIQUE INDEX IF NOT EXISTS payments_cash_reference_key
  ON payments (reference) WHERE method = 'Cash' AND reference IS NOT NULL;

-- ------------------------------------------------------------- triggers

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['users', 'registrations', 'client_profiles', 'services', 'service_requests', 'invoices', 'bookings', 'payments', 'branches', 'instructor_profiles'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------- seed
-- Optional starter data. Uncomment to run.
-- Replace the password_hash values with real bcrypt hashes, e.g.:
--   node -e "console.log(require('bcrypt').hashSync('YourPassword1!', 12))"
--
-- INSERT INTO users (email, password_hash, role, full_name) VALUES
--   ('admin@safestart.local',  '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'ADMIN',  'Portal Admin'),
--   ('instructor@safestart.local', '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'INSTRUCTOR', 'Demo Instructor'),
--   ('client@safestart.local', '$2b$12$REPLACE_WITH_BCRYPT_HASH', 'CLIENT', 'Demo Client')
-- ON CONFLICT (email) DO NOTHING;
--
-- Registering through the API writes both a users row and a registrations row,
-- so seeding users by hand leaves no signup history. That is fine for the demo
-- accounts above; real accounts come in through POST /api/v1/auth/register.
--
-- INSERT INTO services (slug, name, description, price, billing_cycle) VALUES
--   ('website-care',    'Website Care Plan', 'Monthly maintenance, updates and backups.',     149.00, 'MONTHLY'),
--   ('security-audit',  'Security Audit',    'One-time review of your application security.', 950.00, 'ONE_TIME'),
--   ('managed-hosting', 'Managed Hosting',   'Hosting with monitoring and 24/7 support.',    1290.00, 'YEARLY')
-- ON CONFLICT (slug) DO NOTHING;
