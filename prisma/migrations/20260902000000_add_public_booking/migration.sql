CREATE TABLE "booking_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "slot_interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "min_notice_minutes" INTEGER NOT NULL DEFAULT 60,
    "max_advance_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_availability" (
    "id" TEXT NOT NULL,
    "booking_profile_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_availability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_availability_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6)
);

CREATE UNIQUE INDEX "booking_profiles_organization_id_slug_key"
ON "booking_profiles"("organization_id", "slug");

CREATE UNIQUE INDEX "booking_profiles_organization_id_user_id_key"
ON "booking_profiles"("organization_id", "user_id");

CREATE INDEX "booking_profiles_organization_id_idx"
ON "booking_profiles"("organization_id");

CREATE INDEX "booking_profiles_user_id_idx"
ON "booking_profiles"("user_id");

CREATE UNIQUE INDEX "booking_availability_booking_profile_id_weekday_key"
ON "booking_availability"("booking_profile_id", "weekday");

CREATE INDEX "booking_availability_booking_profile_id_idx"
ON "booking_availability"("booking_profile_id");

ALTER TABLE "booking_profiles"
ADD CONSTRAINT "booking_profiles_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_profiles"
ADD CONSTRAINT "booking_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_availability"
ADD CONSTRAINT "booking_availability_booking_profile_id_fkey"
FOREIGN KEY ("booking_profile_id") REFERENCES "booking_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Perfil inicial da MDS. O modelo permanece multi-tenant e permite um perfil por usuário.
INSERT INTO "booking_profiles" (
    "id",
    "organization_id",
    "user_id",
    "slug",
    "timezone",
    "duration_minutes",
    "slot_interval_minutes",
    "buffer_minutes",
    "min_notice_minutes",
    "max_advance_days"
)
SELECT
    '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1',
    u."organization_id",
    u."id",
    'fabio-alves',
    'America/Sao_Paulo',
    60,
    60,
    0,
    60,
    60
FROM "users" u
WHERE
    u."deleted_at" IS NULL
    AND (
        lower(u."email") = 'fabio@mundodigitalsolucoes.com.br'
        OR lower(u."name") IN ('fábio alves', 'fabio alves')
    )
ORDER BY CASE WHEN lower(u."email") = 'fabio@mundodigitalsolucoes.com.br' THEN 0 ELSE 1 END
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO "booking_availability" (
    "id", "booking_profile_id", "weekday", "start_time", "end_time"
)
SELECT availability.*
FROM (
    VALUES
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f11', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 1, '09:00', '20:00'),
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f12', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 2, '09:00', '20:00'),
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f13', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 3, '09:00', '20:00'),
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f14', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 4, '09:00', '20:00'),
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f15', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 5, '09:00', '20:00'),
        ('3f6fd22f-7097-4554-ad1e-c2fa5a129f16', '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1', 6, '09:00', '14:00')
) AS availability("id", "booking_profile_id", "weekday", "start_time", "end_time")
WHERE EXISTS (
    SELECT 1 FROM "booking_profiles" bp WHERE bp."id" = availability."booking_profile_id"
)
ON CONFLICT DO NOTHING;
