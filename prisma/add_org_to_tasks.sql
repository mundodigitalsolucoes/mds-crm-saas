DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "tasks" ADD COLUMN "organization_id" TEXT;

    UPDATE "tasks" t
    SET "organization_id" = u."organization_id"
    FROM "users" u
    WHERE t."created_by" = u."id"
    AND t."organization_id" IS NULL;

    UPDATE "tasks"
    SET "organization_id" = (SELECT "id" FROM "organizations" LIMIT 1)
    WHERE "organization_id" IS NULL;

    ALTER TABLE "tasks" ALTER COLUMN "organization_id" SET NOT NULL;

    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

    CREATE INDEX "tasks_organization_id_idx" ON "tasks"("organization_id");
    CREATE INDEX "tasks_organization_id_status_idx" ON "tasks"("organization_id", "status");
    CREATE INDEX "tasks_organization_id_due_date_idx" ON "tasks"("organization_id", "due_date");
  END IF;
END $$;
