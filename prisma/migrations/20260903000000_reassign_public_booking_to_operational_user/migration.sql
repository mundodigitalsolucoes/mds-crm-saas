-- A conta fabio@mundodigital.com.br permanece exclusivamente administrativa.
-- A agenda pública da MDS e os registros criados por ela pertencem ao usuário
-- operacional fabiomundodigital@gmail.com.

DO $$
DECLARE
    profile_record RECORD;
    operational_user_id TEXT;
BEGIN
    SELECT bp."id", bp."organization_id", bp."user_id"
    INTO profile_record
    FROM "booking_profiles" bp
    WHERE bp."slug" = 'fabio-alves'
    ORDER BY bp."created_at" ASC
    LIMIT 1;

    IF profile_record."id" IS NULL THEN
        RAISE EXCEPTION 'Perfil público fabio-alves não encontrado';
    END IF;

    SELECT u."id"
    INTO operational_user_id
    FROM "users" u
    WHERE
        u."organization_id" = profile_record."organization_id"
        AND u."deleted_at" IS NULL
        AND lower(u."email") = 'fabiomundodigital@gmail.com'
    LIMIT 1;

    IF operational_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário operacional fabiomundodigital@gmail.com não encontrado na organização do perfil';
    END IF;

    UPDATE "agenda_events"
    SET
        "assigned_to" = operational_user_id,
        "created_by" = CASE
            WHEN "created_by" = profile_record."user_id" THEN operational_user_id
            ELSE "created_by"
        END,
        "updated_at" = NOW()
    WHERE
        "organization_id" = profile_record."organization_id"
        AND "assigned_to" = profile_record."user_id"
        AND "description" LIKE '%Origem: link da bio MDS%';

    UPDATE "leads"
    SET
        "assigned_to" = operational_user_id,
        "created_by" = CASE
            WHEN "created_by" = profile_record."user_id" THEN operational_user_id
            ELSE "created_by"
        END,
        "updated_at" = NOW()
    WHERE
        "organization_id" = profile_record."organization_id"
        AND "assigned_to" = profile_record."user_id"
        AND "custom_fields" LIKE '%"linkBio"%';

    UPDATE "booking_profiles"
    SET
        "user_id" = operational_user_id,
        "updated_at" = NOW()
    WHERE "id" = profile_record."id";
END $$;
