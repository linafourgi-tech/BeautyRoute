-- S5 (production-readiness audit): rows must not reference records that
-- belong to a different workspace -- including under concurrent requests.
--
-- Root cause: every reference between workspace-scoped tables is a plain
-- single-column foreign key to id, and foreign key checks ignore row level
-- security. The write policies on these tables ("*_access", FOR ALL, no
-- WITH CHECK -- so their USING clause is reused for writes) only check the
-- writing row's OWN workspace, never the referenced row's. A member of
-- workspace A who knows a record id from workspace B (a former staff member,
-- a client UUID from a Beauty Passport URL, a member of both) could create:
--   * appointments.client_id / visits.client_id -> B's client, and
--     appointment_services.service_id -> B's service. These foreign keys are
--     ON DELETE RESTRICT, so B could no longer delete that client or service,
--     and delete_workspace(B) failed (23503) -- with the blocking row
--     invisible to B;
--   * visits.appointment_id, client_tags.tag_id, ai_history.client_id,
--     revenues.visit_id, expenses.receipt_file_id -> B's rows (inconsistent
--     cross-workspace relationships).
-- A member of BOTH workspaces could also create them from the other side, by
-- moving a referenced row (for example B's client) into A while B's rows
-- still point at it -- and, even with per-statement checks, by racing a
-- reference write against a concurrent move: each statement's check reads
-- its own snapshot, and the foreign key's KEY SHARE lock does not conflict
-- with an ordinary row update, so neither side waited for the other.
--
-- Fix, in two layers. Neither uses SECURITY DEFINER, any other privilege
-- bypass, or a new grant.
--
-- 1. Policies (first line of defence). Each existing FOR ALL policy gets an
--    explicit WITH CHECK (INSERT and UPDATE); USING -- and therefore SELECT
--    and DELETE -- is unchanged. Referencing side: membership plus "every
--    referenced record (when non-NULL) is in the row's own workspace".
--    Referenced side (clients, services, tags, appointments, visits, files):
--    membership plus "no row in another workspace references this record".
--    The subqueries run with the caller's own privileges and row level
--    security, so a record in a workspace the caller cannot see fails the
--    check the same way whether or not it exists. clients' and appointments'
--    checks deliberately do not read client_tags / appointment_services:
--    those link tables' own USING clauses read clients / appointments back,
--    which Postgres rejects as infinite policy recursion (42P17).
--
-- 2. Triggers (complete and concurrency-safe). Plain SECURITY INVOKER
--    plpgsql with a pinned search_path, so they run with the caller's own
--    privileges and row level security. Triggers are not policies, so they
--    add no policy recursion.
--      * Reference side -- BEFORE INSERT OR UPDATE on the 7 referencing
--        tables (8 references): lock every non-NULL referenced row FOR KEY
--        SHARE, filtered to the referencing row's workspace, and refuse
--        (42501) if it is not there. NULL references are skipped, so ON
--        DELETE SET NULL actions keep working.
--      * Move side -- BEFORE UPDATE OF workspace_id on the 6 referenced
--        tables (only when workspace_id actually changes): lock the moving
--        row FOR UPDATE, then refuse (42501) if any row still references it
--        from a different workspace -- including the client_tags and
--        appointment_services links the policies cannot check.
--    FOR UPDATE conflicts with FOR KEY SHARE, so a reference write and a
--    move of the same row are serialized: whichever comes second waits for
--    the first to finish, then re-checks against the committed state (the
--    locking read re-evaluates its filter on the latest row version; the
--    move side's checks are fresh queries run after its lock is granted).
--    Ordinary edits (UPDATE of other columns) take only FOR NO KEY UPDATE,
--    which does not conflict with FOR KEY SHARE, so they are not blocked.
--    The locks use the caller's existing UPDATE privilege on these tables
--    and only touch rows the caller can already see and update.
--
-- Limits (documented, not hidden): service_role and direct SQL as postgres
-- (dashboard / SQL editor) bypass the policies but not the triggers.
-- Multi-statement transactions that both reference and move rows in
-- opposite orders can deadlock; Postgres detects it and aborts one
-- transaction, so no invalid row is committed.
--
-- No column, grant, or data change; read and delete behavior is unchanged.
-- Production held zero cross-workspace references when this was written
-- (read-only aggregate audit), so no existing row is affected.

-- 1. Policies -------------------------------------------------------------

ALTER POLICY "appointments_access" ON "public"."appointments"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND EXISTS (SELECT 1 FROM "public"."clients" c
                    WHERE c."id" = "appointments"."client_id" AND c."workspace_id" = "appointments"."workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."visits" v
                        WHERE v."appointment_id" = "appointments"."id" AND v."workspace_id" <> "appointments"."workspace_id")
    );

ALTER POLICY "visits_access" ON "public"."visits"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND EXISTS (SELECT 1 FROM "public"."clients" c
                    WHERE c."id" = "visits"."client_id" AND c."workspace_id" = "visits"."workspace_id")
        AND ("visits"."appointment_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."appointments" a
                        WHERE a."id" = "visits"."appointment_id" AND a."workspace_id" = "visits"."workspace_id"))
        AND NOT EXISTS (SELECT 1 FROM "public"."revenues" r
                        WHERE r."visit_id" = "visits"."id" AND r."workspace_id" <> "visits"."workspace_id")
    );

ALTER POLICY "appointment_services_access" ON "public"."appointment_services"
    WITH CHECK (
        EXISTS (SELECT 1 FROM "public"."appointments" a
                JOIN "public"."services" s ON s."id" = "appointment_services"."service_id"
                WHERE a."id" = "appointment_services"."appointment_id"
                  AND s."workspace_id" = a."workspace_id"
                  AND "public"."is_workspace_member"(a."workspace_id"))
    );

ALTER POLICY "client_tags_access" ON "public"."client_tags"
    WITH CHECK (
        EXISTS (SELECT 1 FROM "public"."clients" c
                JOIN "public"."tags" t ON t."id" = "client_tags"."tag_id"
                WHERE c."id" = "client_tags"."client_id"
                  AND t."workspace_id" = c."workspace_id"
                  AND "public"."is_workspace_member"(c."workspace_id"))
    );

ALTER POLICY "ai_history_access" ON "public"."ai_history"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND EXISTS (SELECT 1 FROM "public"."clients" c
                    WHERE c."id" = "ai_history"."client_id" AND c."workspace_id" = "ai_history"."workspace_id")
    );

ALTER POLICY "revenues_access" ON "public"."revenues"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND ("revenues"."visit_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."visits" v
                        WHERE v."id" = "revenues"."visit_id" AND v."workspace_id" = "revenues"."workspace_id"))
    );

ALTER POLICY "expenses_access" ON "public"."expenses"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND ("expenses"."receipt_file_id" IS NULL
             OR EXISTS (SELECT 1 FROM "public"."files" f
                        WHERE f."id" = "expenses"."receipt_file_id" AND f."workspace_id" = "expenses"."workspace_id"))
    );

ALTER POLICY "clients_access" ON "public"."clients"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."appointments" a
                        WHERE a."client_id" = "clients"."id" AND a."workspace_id" <> "clients"."workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."visits" v
                        WHERE v."client_id" = "clients"."id" AND v."workspace_id" <> "clients"."workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."ai_history" h
                        WHERE h."client_id" = "clients"."id" AND h."workspace_id" <> "clients"."workspace_id")
    );

ALTER POLICY "services_access" ON "public"."services"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."appointment_services" x
                        JOIN "public"."appointments" a ON a."id" = x."appointment_id"
                        WHERE x."service_id" = "services"."id" AND a."workspace_id" <> "services"."workspace_id")
    );

ALTER POLICY "tags_access" ON "public"."tags"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."client_tags" ct
                        JOIN "public"."clients" c ON c."id" = ct."client_id"
                        WHERE ct."tag_id" = "tags"."id" AND c."workspace_id" <> "tags"."workspace_id")
    );

ALTER POLICY "files_access" ON "public"."files"
    WITH CHECK (
        "public"."is_workspace_member"("workspace_id")
        AND NOT EXISTS (SELECT 1 FROM "public"."expenses" e
                        WHERE e."receipt_file_id" = "files"."id" AND e."workspace_id" <> "files"."workspace_id")
    );

-- 2a. Reference side: lock-and-check every non-NULL reference ---------------

CREATE FUNCTION "public"."same_workspace_appointment_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.clients c
   WHERE c.id = NEW.client_id AND c.workspace_id = NEW.workspace_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The appointment''s client is not in the appointment''s workspace' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_visit_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.clients c
   WHERE c.id = NEW.client_id AND c.workspace_id = NEW.workspace_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The visit''s client is not in the visit''s workspace' USING ERRCODE = '42501';
  END IF;
  IF NEW.appointment_id IS NOT NULL THEN
    PERFORM 1 FROM public.appointments a
     WHERE a.id = NEW.appointment_id AND a.workspace_id = NEW.workspace_id
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The visit''s appointment is not in the visit''s workspace' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_appointment_service_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.appointments a, public.services s
   WHERE a.id = NEW.appointment_id AND s.id = NEW.service_id AND s.workspace_id = a.workspace_id
   FOR KEY SHARE OF a, s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The service is not in the appointment''s workspace' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_client_tag_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.clients c, public.tags t
   WHERE c.id = NEW.client_id AND t.id = NEW.tag_id AND t.workspace_id = c.workspace_id
   FOR KEY SHARE OF c, t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The tag is not in the client''s workspace' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_ai_history_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.clients c
   WHERE c.id = NEW.client_id AND c.workspace_id = NEW.workspace_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The client is not in the AI history row''s workspace' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_revenue_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.visit_id IS NOT NULL THEN
    PERFORM 1 FROM public.visits v
     WHERE v.id = NEW.visit_id AND v.workspace_id = NEW.workspace_id
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The revenue''s visit is not in the revenue''s workspace' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_expense_refs"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.receipt_file_id IS NOT NULL THEN
    PERFORM 1 FROM public.files f
     WHERE f.id = NEW.receipt_file_id AND f.workspace_id = NEW.workspace_id
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The expense''s receipt file is not in the expense''s workspace' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2b. Move side: lock the moving row, then re-check its references ---------

CREATE FUNCTION "public"."same_workspace_client_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.clients WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id = OLD.id AND a.workspace_id <> NEW.workspace_id)
     OR EXISTS (SELECT 1 FROM public.visits v WHERE v.client_id = OLD.id AND v.workspace_id <> NEW.workspace_id)
     OR EXISTS (SELECT 1 FROM public.ai_history h WHERE h.client_id = OLD.id AND h.workspace_id <> NEW.workspace_id)
     OR EXISTS (SELECT 1 FROM public.client_tags ct JOIN public.tags t ON t.id = ct.tag_id
                WHERE ct.client_id = OLD.id AND t.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'A client cannot move to another workspace while records of its current workspace reference it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_service_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.services WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.appointment_services x JOIN public.appointments a ON a.id = x.appointment_id
             WHERE x.service_id = OLD.id AND a.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'A service cannot move to another workspace while appointments of its current workspace use it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_tag_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.tags WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.client_tags ct JOIN public.clients c ON c.id = ct.client_id
             WHERE ct.tag_id = OLD.id AND c.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'A tag cannot move to another workspace while clients of its current workspace use it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_appointment_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.appointments WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.visits v WHERE v.appointment_id = OLD.id AND v.workspace_id <> NEW.workspace_id)
     OR EXISTS (SELECT 1 FROM public.appointment_services x JOIN public.services s ON s.id = x.service_id
                WHERE x.appointment_id = OLD.id AND s.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'An appointment cannot move to another workspace while records of its current workspace are linked to it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_visit_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.visits WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.revenues r WHERE r.visit_id = OLD.id AND r.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'A visit cannot move to another workspace while revenues of its current workspace reference it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."same_workspace_file_move"() RETURNS trigger
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM 1 FROM public.files WHERE id = OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.expenses e WHERE e.receipt_file_id = OLD.id AND e.workspace_id <> NEW.workspace_id) THEN
    RAISE EXCEPTION 'A file cannot move to another workspace while expenses of its current workspace reference it' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions are never called directly (PostgREST does not expose
-- functions returning trigger, and Postgres checks EXECUTE only when a
-- trigger is created); keep them out of every client role's reach anyway.
REVOKE ALL ON FUNCTION
    "public"."same_workspace_appointment_refs"(), "public"."same_workspace_visit_refs"(),
    "public"."same_workspace_appointment_service_refs"(), "public"."same_workspace_client_tag_refs"(),
    "public"."same_workspace_ai_history_refs"(), "public"."same_workspace_revenue_refs"(),
    "public"."same_workspace_expense_refs"(),
    "public"."same_workspace_client_move"(), "public"."same_workspace_service_move"(),
    "public"."same_workspace_tag_move"(), "public"."same_workspace_appointment_move"(),
    "public"."same_workspace_visit_move"(), "public"."same_workspace_file_move"()
    FROM PUBLIC, "anon", "authenticated";

-- 2c. Triggers. On appointments and visits both kinds exist; "_move" sorts
-- before "_refs", so the move guard always runs first (Postgres fires BEFORE
-- triggers in name order). Each is independent of the other's outcome.

CREATE TRIGGER "trg_appointments_same_workspace_refs"
    BEFORE INSERT OR UPDATE OF "client_id", "workspace_id" ON "public"."appointments"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_appointment_refs"();

CREATE TRIGGER "trg_visits_same_workspace_refs"
    BEFORE INSERT OR UPDATE OF "client_id", "appointment_id", "workspace_id" ON "public"."visits"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_visit_refs"();

CREATE TRIGGER "trg_appointment_services_same_workspace_refs"
    BEFORE INSERT OR UPDATE ON "public"."appointment_services"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_appointment_service_refs"();

CREATE TRIGGER "trg_client_tags_same_workspace_refs"
    BEFORE INSERT OR UPDATE ON "public"."client_tags"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_client_tag_refs"();

CREATE TRIGGER "trg_ai_history_same_workspace_refs"
    BEFORE INSERT OR UPDATE OF "client_id", "workspace_id" ON "public"."ai_history"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_ai_history_refs"();

CREATE TRIGGER "trg_revenues_same_workspace_refs"
    BEFORE INSERT OR UPDATE OF "visit_id", "workspace_id" ON "public"."revenues"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_revenue_refs"();

CREATE TRIGGER "trg_expenses_same_workspace_refs"
    BEFORE INSERT OR UPDATE OF "receipt_file_id", "workspace_id" ON "public"."expenses"
    FOR EACH ROW EXECUTE FUNCTION "public"."same_workspace_expense_refs"();

CREATE TRIGGER "trg_clients_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."clients"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_client_move"();

CREATE TRIGGER "trg_services_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."services"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_service_move"();

CREATE TRIGGER "trg_tags_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."tags"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_tag_move"();

CREATE TRIGGER "trg_appointments_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."appointments"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_appointment_move"();

CREATE TRIGGER "trg_visits_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."visits"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_visit_move"();

CREATE TRIGGER "trg_files_same_workspace_move"
    BEFORE UPDATE OF "workspace_id" ON "public"."files"
    FOR EACH ROW WHEN (OLD."workspace_id" IS DISTINCT FROM NEW."workspace_id")
    EXECUTE FUNCTION "public"."same_workspace_file_move"();
