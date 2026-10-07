-- Role rename: rows keep their value, no table rewrite.
ALTER TYPE "UserRole" RENAME VALUE 'STAFF' TO 'INSTRUCTOR';

-- service_requests: rename the assignee column in place.
ALTER TABLE "service_requests" RENAME COLUMN "assigned_staff_id" TO "assigned_instructor_id";
ALTER INDEX "service_requests_assigned_staff_id_idx" RENAME TO "service_requests_assigned_instructor_id_idx";
ALTER TABLE "service_requests" RENAME CONSTRAINT "service_requests_assigned_staff_id_fkey" TO "service_requests_assigned_instructor_id_fkey";

-- Audit history follows the rename.
UPDATE "audit_logs" SET "action" = replace("action", 'STAFF_', 'INSTRUCTOR_') WHERE "action" LIKE 'STAFF\_%';
UPDATE "audit_logs" SET "metadata" = jsonb_set("metadata", '{role}', '"INSTRUCTOR"') WHERE "metadata"->>'role' = 'STAFF';

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_profiles" (
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "street" TEXT NOT NULL,
    "barangay" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_name_key" ON "branches"("name");

-- CreateIndex
CREATE INDEX "instructor_profiles_branch_id_idx" ON "instructor_profiles"("branch_id");

-- AddForeignKey
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
