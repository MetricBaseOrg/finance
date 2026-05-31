-- FieldFlow ↔ ProBase: replace the field→project binding with a task-assignment
-- model. Field work assigned to a user is recorded as a ProBase Task in an
-- auto-provisioned "Field Operations" project (Project.isFieldOps), with an
-- optional soft link back to the originating field record (Task.fieldRefType/Id).
-- Idempotent so it applies cleanly on databases that already reflect this state.

-- DropForeignKey / DropIndex / DropColumn: remove the previous project binding.
ALTER TABLE "nodes"    DROP CONSTRAINT IF EXISTS "nodes_project_id_fkey";
ALTER TABLE "flows"    DROP CONSTRAINT IF EXISTS "flows_project_id_fkey";
ALTER TABLE "liftings" DROP CONSTRAINT IF EXISTS "liftings_project_id_fkey";
ALTER TABLE "targets"  DROP CONSTRAINT IF EXISTS "targets_project_id_fkey";

DROP INDEX IF EXISTS "nodes_project_id_idx";
DROP INDEX IF EXISTS "flows_project_id_idx";
DROP INDEX IF EXISTS "liftings_project_id_idx";
DROP INDEX IF EXISTS "targets_project_id_idx";

ALTER TABLE "nodes"    DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "flows"    DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "liftings" DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "targets"  DROP COLUMN IF EXISTS "project_id";

-- AlterTable: ProBase Task gains an optional soft link to a field record.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "fieldRefType" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "fieldRefId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_fieldRefType_fieldRefId_idx" ON "Task"("fieldRefType", "fieldRefId");

-- AlterTable: marker for the per-org Field Operations project.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isFieldOps" BOOLEAN NOT NULL DEFAULT false;
