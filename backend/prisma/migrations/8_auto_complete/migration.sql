-- Bookings the system completes after the session ends. auto_completed_at
-- opens the instructor's 24-hour window to correct it to a no-show.
ALTER TABLE "bookings" ADD COLUMN "auto_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "auto_completed_at" TIMESTAMPTZ(6);
CREATE INDEX "bookings_auto_completed_at_idx" ON "bookings"("auto_completed_at");

-- A rating on a session later corrected to a no-show stays on record but no
-- longer counts towards any average.
ALTER TABLE "ratings" ADD COLUMN "excluded_at" TIMESTAMPTZ(6);

CREATE TABLE "cron_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_count" INTEGER NOT NULL DEFAULT 0,
    "cash_unpaid_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cron_runs_job_started_at_idx" ON "cron_runs"("job", "started_at" DESC);

INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES ('autoCompleteGraceHours', '2', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
