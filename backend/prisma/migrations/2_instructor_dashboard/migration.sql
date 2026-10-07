-- CreateEnum
CREATE TYPE "BookingAction" AS ENUM ('CREATED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'CASH_RECORDED');

-- CreateEnum
CREATE TYPE "VoidRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Rename in place: existing APPROVED rows become CONFIRMED, no table rewrite.
ALTER TYPE "BookingStatus" RENAME VALUE 'APPROVED' TO 'CONFIRMED';
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "instructor_id" UUID,
ADD COLUMN     "last_action_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_action_by" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "recorded_by" UUID,
ADD COLUMN     "voided_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "booking_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "action" "BookingAction" NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus",
    "old_scheduled_at" TIMESTAMPTZ(6),
    "new_scheduled_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "changed_by" UUID,
    "changed_by_role" "UserRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instructor_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_days_off" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instructor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_days_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instructor_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "booking_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "stars" SMALLINT NOT NULL,
    "comment" VARCHAR(500),
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_void_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "VoidRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_void_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_history_booking_id_created_at_idx" ON "booking_history"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_history_changed_by_idx" ON "booking_history"("changed_by");

-- CreateIndex
CREATE INDEX "instructor_availability_instructor_id_day_of_week_idx" ON "instructor_availability"("instructor_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_days_off_instructor_id_date_key" ON "instructor_days_off"("instructor_id", "date");

-- CreateIndex
CREATE INDEX "client_notes_instructor_id_client_id_created_at_idx" ON "client_notes"("instructor_id", "client_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_booking_id_key" ON "ratings"("booking_id");

-- CreateIndex
CREATE INDEX "ratings_instructor_id_created_at_idx" ON "ratings"("instructor_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_void_requests_payment_id_idx" ON "cash_void_requests"("payment_id");

-- CreateIndex
CREATE INDEX "cash_void_requests_status_created_at_idx" ON "cash_void_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_instructor_id_scheduled_at_idx" ON "bookings"("instructor_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "payments_recorded_by_created_at_idx" ON "payments"("recorded_by", "created_at");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_last_action_by_fkey" FOREIGN KEY ("last_action_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_days_off" ADD CONSTRAINT "instructor_days_off_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_void_requests" ADD CONSTRAINT "cash_void_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_void_requests" ADD CONSTRAINT "cash_void_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_void_requests" ADD CONSTRAINT "cash_void_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Constraints Prisma cannot express.
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_day_check" CHECK ("day_of_week" BETWEEN 0 AND 6);
ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_time_check"
  CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" > "start_time");
CREATE UNIQUE INDEX "cash_void_requests_one_pending_idx" ON "cash_void_requests"("payment_id") WHERE "status" = 'PENDING';

-- Every existing booking gets its "created" history entry.
INSERT INTO "booking_history" ("booking_id", "action", "to_status", "new_scheduled_at", "changed_by", "changed_by_role", "created_at")
SELECT "id", 'CREATED', 'PENDING', "scheduled_at", "client_id", 'CLIENT', "created_at" FROM "bookings";
