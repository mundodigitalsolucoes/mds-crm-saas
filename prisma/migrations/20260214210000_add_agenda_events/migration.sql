-- CreateTable
CREATE TABLE "agenda_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'meeting',
    "status" TEXT NOT NULL DEFAULT 'agendado',
    "color" TEXT,
    "location" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "reminder_minutes" INTEGER,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "lead_id" TEXT,
    "project_id" TEXT,
    "assigned_to" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_events_organization_id_idx" ON "agenda_events"("organization_id");

-- CreateIndex
CREATE INDEX "agenda_events_date_idx" ON "agenda_events"("date");

-- CreateIndex
CREATE INDEX "agenda_events_status_idx" ON "agenda_events"("status");

-- CreateIndex
CREATE INDEX "agenda_events_assigned_to_idx" ON "agenda_events"("assigned_to");

-- CreateIndex
CREATE INDEX "agenda_events_lead_id_idx" ON "agenda_events"("lead_id");

-- CreateIndex
CREATE INDEX "agenda_events_organization_id_date_idx" ON "agenda_events"("organization_id", "date");

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "marketing_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
