CREATE TABLE "google_identities" (
    "google_sub" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "google_identities_pkey" PRIMARY KEY ("google_sub")
);
CREATE UNIQUE INDEX "google_identities_user_id_key" ON "google_identities"("user_id");
ALTER TABLE "google_identities" ADD CONSTRAINT "google_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
