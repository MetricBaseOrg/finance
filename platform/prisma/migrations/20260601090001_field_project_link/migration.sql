-- Baseline migration: links Field (FieldFlow) records to ProBase Projects via an
-- optional project_id on nodes/flows/liftings/targets. Previously applied via
-- `prisma db push`; this captures it in migration history. Idempotent so it is
-- safe on databases that already have the columns (and on fresh databases).

-- AlterTable
ALTER TABLE "nodes"    ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "flows"    ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "liftings" ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "targets"  ADD COLUMN IF NOT EXISTS "project_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "nodes_project_id_idx"    ON "nodes"("project_id");
CREATE INDEX IF NOT EXISTS "flows_project_id_idx"    ON "flows"("project_id");
CREATE INDEX IF NOT EXISTS "liftings_project_id_idx" ON "liftings"("project_id");
CREATE INDEX IF NOT EXISTS "targets_project_id_idx"  ON "targets"("project_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "nodes"    ADD CONSTRAINT "nodes_project_id_fkey"    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "flows"    ADD CONSTRAINT "flows_project_id_fkey"    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "liftings" ADD CONSTRAINT "liftings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "targets"  ADD CONSTRAINT "targets_project_id_fkey"  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
