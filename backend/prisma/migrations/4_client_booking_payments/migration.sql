-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'AWAITING_CASH', 'PAID', 'REFUNDED');

-- AlterEnum
ALTER TYPE "BookingAction" ADD VALUE 'PAYMENT_RECEIVED';

-- Widen the actor role in place so existing history keeps its values.
ALTER TABLE "booking_history" ALTER COLUMN "changed_by_role" TYPE "ActorRole" USING ("changed_by_role"::text::"ActorRole");

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "payment_due_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "payment_status" "BookingPaymentStatus" NOT NULL DEFAULT 'AWAITING_CASH',
ADD COLUMN     "price" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "saved_city" TEXT,
ADD COLUMN     "saved_latitude" DECIMAL(9,6),
ADD COLUMN     "saved_longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkout_url" TEXT,
ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "provider_reference" TEXT;

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_event_id_key" ON "payment_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "bookings_payment_status_payment_due_at_idx" ON "bookings"("payment_status", "payment_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Constraints Prisma cannot express.
ALTER TABLE "branches" ADD CONSTRAINT "branches_coordinates_check"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL)
     AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
     AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_saved_coordinates_check"
  CHECK (("saved_latitude" IS NULL) = ("saved_longitude" IS NULL)
     AND ("saved_latitude" IS NULL OR "saved_latitude" BETWEEN -90 AND 90)
     AND ("saved_longitude" IS NULL OR "saved_longitude" BETWEEN -180 AND 180));

-- Existing bookings: paid if a payment says so, otherwise they were cash bookings.
UPDATE "bookings" b SET "payment_status" = 'PAID'
WHERE EXISTS (SELECT 1 FROM "payments" p WHERE p."booking_id" = b."id" AND p."status" = 'PAID');

-- Defaults the admin can change from the Settings page.
INSERT INTO "app_settings" ("key", "value") VALUES
  ('clientChangeCutoffHours', '24'),
  ('onlinePaymentExpiryMinutes', '30'),
  ('cashAutoCancelHours', '12'),
  ('pricePerHour', '800')
ON CONFLICT ("key") DO NOTHING;
