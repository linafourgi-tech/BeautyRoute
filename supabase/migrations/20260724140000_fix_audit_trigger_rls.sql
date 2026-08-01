-- Fixes audit_trigger() failing on every authenticated INSERT/UPDATE/DELETE
-- to appointments, clients, services, or visits.
--
-- audit_trigger() was LANGUAGE plpgsql with no SECURITY DEFINER, so its own
-- INSERT INTO audit_logs ran with the calling (authenticated) role's
-- privileges. audit_logs has RLS enabled with only a FOR SELECT policy -- no
-- INSERT policy exists -- so that internal insert was rejected, which rolled
-- back the entire statement on the audited table.
--
-- Fix: SECURITY DEFINER + a pinned search_path, the same pattern already
-- used by is_workspace_member() for the identical class of problem. The
-- function owner is postgres (unchanged), so its internal insert now runs as
-- postgres and bypasses RLS -- but auth.uid() is untouched by this: it reads
-- the request's JWT claim from session state, not the executing role, so
-- actor_id still records the real signed-in user, not the function owner.
--
-- No change to audit_logs' policies (still SELECT-only -- authenticated
-- users still cannot INSERT into it directly), and no change to the four
-- triggers themselves -- CREATE OR REPLACE FUNCTION updates their behavior
-- in place. Audit payload/behavior is otherwise byte-for-byte identical.

CREATE OR REPLACE FUNCTION "public"."audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN

IF TG_OP = 'INSERT' THEN

INSERT INTO public.audit_logs(
workspace_id,
actor_id,
table_name,
record_id,
action,
new_value
)
VALUES(
NEW.workspace_id,
auth.uid(),
TG_TABLE_NAME,
NEW.id,
'INSERT',
to_jsonb(NEW)
);

RETURN NEW;

ELSIF TG_OP = 'UPDATE' THEN

INSERT INTO public.audit_logs(
workspace_id,
actor_id,
table_name,
record_id,
action,
old_value,
new_value
)
VALUES(
NEW.workspace_id,
auth.uid(),
TG_TABLE_NAME,
NEW.id,
'UPDATE',
to_jsonb(OLD),
to_jsonb(NEW)
);

RETURN NEW;

ELSIF TG_OP = 'DELETE' THEN

INSERT INTO public.audit_logs(
workspace_id,
actor_id,
table_name,
record_id,
action,
old_value
)
VALUES(
OLD.workspace_id,
auth.uid(),
TG_TABLE_NAME,
OLD.id,
'DELETE',
to_jsonb(OLD)
);

RETURN OLD;

END IF;

RETURN NULL;

END;
$$;

ALTER FUNCTION "public"."audit_trigger"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";
