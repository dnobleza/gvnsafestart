-- OR numbers restart at 000001 every calendar year. One row per year; the
-- increment runs inside the payment's transaction, so a rolled-back payment
-- gives its number back and concurrent payments queue on the row lock.
CREATE TABLE "receipt_counters" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL,
    CONSTRAINT "receipt_counters_pkey" PRIMARY KEY ("year")
);

-- Carry on from any OR numbers already issued by the old sequence.
INSERT INTO "receipt_counters" ("year", "last_number")
SELECT substring("reference" from 4 for 4)::int, max(substring("reference" from 9)::int)
FROM "payments"
WHERE "method" = 'Cash' AND "reference" ~ '^OR-[0-9]{4}-[0-9]+$'
GROUP BY 1;

DROP SEQUENCE IF EXISTS "official_receipt_seq";
