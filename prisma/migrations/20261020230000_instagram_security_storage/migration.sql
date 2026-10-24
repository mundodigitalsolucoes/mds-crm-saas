-- CreateTable
CREATE TABLE "instagram_oauth_states" (
    "nonce_hash" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_oauth_states_pkey" PRIMARY KEY ("nonce_hash")
);

-- CreateTable
CREATE TABLE "instagram_webhook_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_hash" TEXT NOT NULL,
    "chatwoot_account_id" INTEGER NOT NULL,
    "chatwoot_inbox_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_oauth_states_organization_id_user_id_expires_at_idx" ON "instagram_oauth_states"("organization_id", "user_id", "expires_at");

-- CreateIndex
CREATE INDEX "instagram_oauth_states_expires_at_idx" ON "instagram_oauth_states"("expires_at");

-- CreateIndex
CREATE INDEX "instagram_webhook_receipts_status_created_at_idx" ON "instagram_webhook_receipts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_webhook_receipts_organization_id_event_hash_key" ON "instagram_webhook_receipts"("organization_id", "event_hash");

-- AddForeignKey
ALTER TABLE "instagram_oauth_states" ADD CONSTRAINT "instagram_oauth_states_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_oauth_states" ADD CONSTRAINT "instagram_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_webhook_receipts" ADD CONSTRAINT "instagram_webhook_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

