-- Completa o perfil inicial quando o cadastro do responsável usa outro e-mail ou variação de nome.
-- O escopo permanece restrito à organização MDS e prioriza o usuário Fábio; no MVP,
-- o proprietário/administrador é usado como fallback seguro.

WITH target_user AS (
    SELECT u."id", u."organization_id"
    FROM "users" u
    INNER JOIN "organizations" o ON o."id" = u."organization_id"
    WHERE
        u."deleted_at" IS NULL
        AND o."slug" = 'mundo-digital'
    ORDER BY
        CASE
            WHEN lower(u."email") LIKE '%fabio%' THEN 0
            WHEN lower(u."name") LIKE '%fabio%' OR lower(u."name") LIKE '%fábio%' THEN 1
            WHEN u."role" = 'owner' THEN 2
            WHEN u."role" = 'admin' THEN 3
            ELSE 4
        END,
        u."created_at" ASC
    LIMIT 1
)
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
    target_user."organization_id",
    target_user."id",
    'fabio-alves',
    'America/Sao_Paulo',
    60,
    60,
    0,
    60,
    60
FROM target_user
ON CONFLICT DO NOTHING;

INSERT INTO "booking_availability" (
    "id", "booking_profile_id", "weekday", "start_time", "end_time"
)
SELECT schedule."id", bp."id", schedule."weekday", schedule."start_time", schedule."end_time"
FROM (
    VALUES
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f11', 1, '09:00', '20:00'),
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f12', 2, '09:00', '20:00'),
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f13', 3, '09:00', '20:00'),
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f14', 4, '09:00', '20:00'),
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f15', 5, '09:00', '20:00'),
        ('8c7fd22f-7097-4554-ad1e-c2fa5a129f16', 6, '09:00', '14:00')
) AS schedule("id", "weekday", "start_time", "end_time")
INNER JOIN "booking_profiles" bp ON bp."slug" = 'fabio-alves'
INNER JOIN "organizations" o
    ON o."id" = bp."organization_id"
    AND o."slug" = 'mundo-digital'
ON CONFLICT DO NOTHING;
