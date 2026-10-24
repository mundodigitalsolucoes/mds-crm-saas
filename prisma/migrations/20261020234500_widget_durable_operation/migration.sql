-- CreateTable
CREATE TABLE "widget_inbox_operations" (
    "organization_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "connected_account_id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "base_url" TEXT NOT NULL,
    "inbox_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_inbox_operations_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_inbox_operations_operation_id_key" ON "widget_inbox_operations"("operation_id");

-- AddForeignKey
ALTER TABLE "widget_inbox_operations" ADD CONSTRAINT "widget_inbox_operations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

