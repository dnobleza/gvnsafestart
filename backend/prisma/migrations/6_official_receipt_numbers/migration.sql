-- Official receipt (OR) numbers for cash payments are issued by the system
-- from one sequence, so they are unique and gap-tolerant under concurrency.
CREATE SEQUENCE IF NOT EXISTS "official_receipt_seq" START 1;

-- A receipt number can belong to only one cash payment.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_cash_reference_key"
  ON "payments" ("reference") WHERE "method" = 'Cash' AND "reference" IS NOT NULL;
