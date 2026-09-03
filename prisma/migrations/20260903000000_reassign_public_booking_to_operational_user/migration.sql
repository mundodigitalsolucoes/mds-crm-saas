-- A conta fabio@mundodigital.com.br permanece exclusivamente administrativa.
-- A agenda pública da MDS e os registros criados por ela pertencem ao usuário
-- operacional fabiomundodigital@gmail.com.

DO $$
DECLARE
    public_profile_id TEXT;
    source_organization_id TEXT;
    source_user_id TEXT;
    operational_user_id TEXT;
    operational_organization_id TEXT;
    conflicting_profile_id TEXT;
BEGIN
    SELECT bp."id", bp."organization_id", bp."user_id"
    INTO public_profile_id, source_organization_id, source_user_id
    FROM "booking_profiles" bp
    WHERE bp."id" = '7b6c8918-f5b7-44c5-8f54-45e3dd9912f1'
    LIMIT 1;

    IF public_profile_id IS NULL THEN
        RAISE EXCEPTION 'Perfil público fabio-alves não encontrado';
    END IF;

    SELECT u."id", u."organization_id"
    INTO operational_user_id, operational_organization_id
    FROM "users" u
    WHERE
        u."deleted_at" IS NULL
        AND lower(u."email") = 'fabiomundodigital@gmail.com'
    ORDER BY u."created_at" ASC
    LIMIT 1;

    IF operational_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário operacional fabiomundodigital@gmail.com não encontrado';
    END IF;

    SELECT bp."id"
    INTO conflicting_profile_id
    FROM "booking_profiles" bp
    WHERE
        bp."id" <> public_profile_id
        AND bp."organization_id" = operational_organization_id
        AND (bp."slug" = 'fabio-alves' OR bp."user_id" = operational_user_id)
    LIMIT 1;

    IF conflicting_profile_id IS NOT NULL THEN
        RAISE EXCEPTION 'A conta operacional já possui outro perfil público: %', conflicting_profile_id;
    END IF;

    UPDATE "agenda_events"
    SET
        "organization_id" = operational_organization_id,
        "assigned_to" = operational_user_id,
        "created_by" = CASE
            WHEN "created_by" = source_user_id THEN operational_user_id
            ELSE "created_by"
        END,
        "updated_at" = NOW()
    WHERE
        "organization_id" = source_organization_id
        AND ("assigned_to" = source_user_id OR "created_by" = source_user_id)
        AND "description" LIKE '%Origem: link da bio MDS%';

    UPDATE "leads"
    SET
        "organization_id" = operational_organization_id,
        "assigned_to" = operational_user_id,
        "created_by" = CASE
            WHEN "created_by" = source_user_id THEN operational_user_id
            ELSE "created_by"
        END,
        "updated_at" = NOW()
    WHERE
        "organization_id" = source_organization_id
        AND ("assigned_to" = source_user_id OR "created_by" = source_user_id)
        AND "custom_fields" LIKE '%"linkBio"%';

    UPDATE "booking_profiles"
    SET
        "organization_id" = operational_organization_id,
        "user_id" = operational_user_id,
        "updated_at" = NOW()
    WHERE "id" = public_profile_id;
END $$;
