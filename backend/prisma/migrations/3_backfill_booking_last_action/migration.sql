-- Bookings that predate action tracking: the client created them.
UPDATE "bookings" SET "last_action_by" = "client_id", "last_action_at" = "created_at" WHERE "last_action_by" IS NULL;
