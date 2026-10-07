-- CreateEnum
CREATE TYPE "TrainingType" AS ENUM ('OWN_CAR', 'CAR_RENTAL');

-- CreateEnum
CREATE TYPE "PackagePaymentStatus" AS ENUM ('UNPAID', 'AWAITING_CASH', 'RESERVED', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "client_package_id" UUID,
ADD COLUMN     "session_number" INTEGER;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "client_package_id" UUID;

-- CreateTable
CREATE TABLE "service_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessions" INTEGER NOT NULL,
    "hours_per_session" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_id" UUID NOT NULL,
    "service_area_id" UUID NOT NULL,
    "training_type" "TrainingType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "service_area_id" UUID NOT NULL,
    "training_type" "TrainingType" NOT NULL,
    "instructor_id" UUID NOT NULL,
    "package_name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "sessions_total" INTEGER NOT NULL,
    "minutes_per_session" INTEGER NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reservation_fee" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_status" "PackagePaymentStatus" NOT NULL,
    "payment_due_at" TIMESTAMPTZ(6),
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_name_key" ON "service_areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "packages_code_key" ON "packages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "package_rates_package_id_service_area_id_training_type_key" ON "package_rates"("package_id", "service_area_id", "training_type");

-- CreateIndex
CREATE INDEX "client_packages_client_id_created_at_idx" ON "client_packages"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "client_packages_payment_status_payment_due_at_idx" ON "client_packages"("payment_status", "payment_due_at");

-- CreateIndex
CREATE INDEX "bookings_client_package_id_idx" ON "bookings"("client_package_id");

-- CreateIndex
CREATE INDEX "payments_client_package_id_idx" ON "payments"("client_package_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "client_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "client_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_rates" ADD CONSTRAINT "package_rates_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_rates" ADD CONSTRAINT "package_rates_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Constraints Prisma cannot express.
ALTER TABLE "packages" ADD CONSTRAINT "packages_shape_check"
  CHECK ("sessions" BETWEEN 1 AND 20 AND "hours_per_session" BETWEEN 1 AND 12);
ALTER TABLE "package_rates" ADD CONSTRAINT "package_rates_price_check" CHECK ("price" > 0);
ALTER TABLE "client_packages" ADD CONSTRAINT "client_packages_amounts_check"
  CHECK ("price" > 0 AND "reservation_fee" >= 0 AND "amount_paid" >= 0);

-- Catalogue as sold on gvnsafestart.com/packages.
INSERT INTO "service_areas" ("name", "sort_order") VALUES
  ('Metro Manila', 1),
  ('Rizal (Antipolo, Cainta, Taytay, San Mateo, Rodriguez)', 2),
  ('Rizal (Angono, Baras, Binangonan, Cardona, Jalajala, Morong, Pililla, Tanay, Teresa)', 3),
  ('Cavite', 4),
  ('Laguna', 5),
  ('Batangas', 6),
  ('Bulacan', 7),
  ('Pampanga', 8),
  ('Tarlac (Bamban, Capas, Concepcion, Tarlac City)', 9)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "packages" ("code", "name", "description", "sessions", "hours_per_session", "sort_order") VALUES
  ('OPTION_1', 'Option 1', 'One session of 5 hours of actual driving. Ideal for a quick refresher or initial assessment.', 1, 5, 1),
  ('OPTION_1_PLUS', 'Option 1+', 'Two sessions of 5 hours each, spread across 2 days.', 2, 5, 2),
  ('OPTION_2', 'Option 2', 'Three sessions totaling 15 hours of actual driving. Our most popular package for beginners.', 3, 5, 3),
  ('OPTION_3', 'Option 3', 'One extended session of 12 hours of actual driving. Intensive training in a single day.', 1, 12, 4)
ON CONFLICT ("code") DO NOTHING;

-- Only the Metro Manila / own-car prices are published; admins fill in the rest.
INSERT INTO "package_rates" ("package_id", "service_area_id", "training_type", "price")
SELECT p."id", a."id", 'OWN_CAR', v.price
FROM (VALUES ('OPTION_1', 2500), ('OPTION_1_PLUS', 5000), ('OPTION_2', 7000), ('OPTION_3', 5000)) AS v(code, price)
JOIN "packages" p ON p."code" = v.code
JOIN "service_areas" a ON a."name" = 'Metro Manila'
ON CONFLICT ("package_id", "service_area_id", "training_type") DO NOTHING;

INSERT INTO "app_settings" ("key", "value") VALUES ('reservationFee', '1000') ON CONFLICT ("key") DO NOTHING;
