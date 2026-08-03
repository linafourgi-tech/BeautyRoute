


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'noshow'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'app',
    'whatsapp',
    'sms',
    'email'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."plan_tier" AS ENUM (
    'Starter',
    'Pro',
    'Studio'
);


ALTER TYPE "public"."plan_tier" OWNER TO "postgres";


CREATE TYPE "public"."service_category" AS ENUM (
    'consultation',
    'haircut',
    'styling',
    'color',
    'treatment',
    'extensions',
    'bridal',
    'specialty'
);


ALTER TYPE "public"."service_category" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'staff',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_slug text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspace_staff WHERE profile_id = auth.uid()) THEN
    RAISE EXCEPTION 'Onboarding already completed for this user';
  END IF;

  v_slug := lower(regexp_replace(p_business_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.workspaces
    (owner_id, name, slug, display_brand, city, business_type,
     subscription_status, trial_started_at, trial_ends_at)
  VALUES
    (auth.uid(), p_business_name, v_slug, p_business_name, p_city, p_business_type,
     'trial', now(), now() + interval '7 days')
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active)
  VALUES (v_workspace_id, auth.uid(), true);

  INSERT INTO public.workspace_settings (workspace_id)
  VALUES (v_workspace_id);

  UPDATE public.profiles SET onboarding_completed = true WHERE id = auth.uid();

  RETURN v_workspace_id;
END;
$$;


ALTER FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only the workspace's owner may delete the entire workspace -- a much
  -- narrower authorization boundary than is_workspace_member(), which would
  -- let any active staff member destroy the whole business's data.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the workspace owner can delete this workspace'
      USING ERRCODE = '42501';
  END IF;

  -- Join tables / leaves first -- nothing else depends on these, and
  -- deleting them explicitly here (rather than relying on their own
  -- ON DELETE CASCADE) keeps every step in this function independently
  -- documented instead of leaning on cross-table cascade ordering again.
  DELETE FROM public.appointment_services
    WHERE appointment_id IN (SELECT id FROM public.appointments WHERE workspace_id = p_workspace_id);
  DELETE FROM public.client_tags
    WHERE client_id IN (SELECT id FROM public.clients WHERE workspace_id = p_workspace_id);
  DELETE FROM public.revenues WHERE workspace_id = p_workspace_id;
  DELETE FROM public.ai_history WHERE workspace_id = p_workspace_id;
  DELETE FROM public.expenses WHERE workspace_id = p_workspace_id;
  DELETE FROM public.notifications WHERE workspace_id = p_workspace_id;

  -- appointments and visits MUST be deleted before clients: both carry
  -- ON DELETE RESTRICT against clients.id, so clients cannot be removed
  -- while either still references it. Deleting them here -- while the
  -- workspaces row still exists -- also means their AFTER DELETE audit
  -- triggers' INSERT INTO audit_logs succeeds normally, since audit_logs'
  -- own FK to workspaces(id) still has a live row to point at.
  DELETE FROM public.appointments WHERE workspace_id = p_workspace_id;
  DELETE FROM public.visits WHERE workspace_id = p_workspace_id;

  -- services next: appointment_services.service_id is ON DELETE RESTRICT,
  -- but every appointment_services row for this workspace was already
  -- removed in the first step above, so this is now safe.
  DELETE FROM public.services WHERE workspace_id = p_workspace_id;

  -- clients: every RESTRICTing dependent (appointments, visits) and every
  -- dependent this function orders deliberately (client_tags, ai_history)
  -- are already gone.
  DELETE FROM public.clients WHERE workspace_id = p_workspace_id;

  DELETE FROM public.tags WHERE workspace_id = p_workspace_id;
  DELETE FROM public.files WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_settings WHERE workspace_id = p_workspace_id;
  DELETE FROM public.workspace_staff WHERE workspace_id = p_workspace_id;

  -- Detach (not delete) this workspace's audit history -- preserves the
  -- forensic record of everything that happened, including the deletes
  -- just performed above, rather than losing it to workspaces' own
  -- ON DELETE CASCADE on audit_logs.workspace_id when the final delete
  -- below runs. workspace_id on audit_logs has always been nullable.
  UPDATE public.audit_logs SET workspace_id = NULL WHERE workspace_id = p_workspace_id;

  -- Last: nothing references this row anymore, so this is now a plain,
  -- single-row delete with no cascade side effects left to worry about.
  DELETE FROM public.workspaces WHERE id = p_workspace_id;
END;
$$;


ALTER FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        avatar_url
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    imported_count INTEGER := 0;
BEGIN

    INSERT INTO public.services
    (
        workspace_id,
        name,
        category,
        price,
        duration_minutes,
        description,
        display_order,
        color_hex,
        is_active
    )
    SELECT
        p_workspace_id,
        st.name,
        st.category,
        st.default_price,
        st.default_duration,
        st.description,
        st.display_order,
        st.color_hex,
        TRUE
    FROM public.service_templates st
    WHERE st.id = ANY(p_template_ids)
    AND NOT EXISTS (
        SELECT 1
        FROM public.services s
        WHERE s.workspace_id = p_workspace_id
          AND s.name = st.name
    );

    GET DIAGNOSTICS imported_count = ROW_COUNT;

    RETURN imported_count;
END;
$$;


ALTER FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("workspace" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.workspace_staff ws
    WHERE ws.workspace_id = workspace
      AND ws.profile_id = auth.uid()
      AND ws.is_active = true
);
$$;


ALTER FUNCTION "public"."is_workspace_member"("workspace" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "insight_type" "text" NOT NULL,
    "input_context" "jsonb" NOT NULL,
    "ai_response" "jsonb" NOT NULL,
    "model_name" "text" NOT NULL,
    "tokens_used" integer DEFAULT 0,
    "confidence_score" numeric(5,2),
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_history_tokens_used_check" CHECK (("tokens_used" >= 0))
);


ALTER TABLE "public"."ai_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "custom_price" numeric(10,2)
);


ALTER TABLE "public"."appointment_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "assigned_staff_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'pending'::"public"."appointment_status" NOT NULL,
    "location_address" "text",
    "deposit_amount" numeric(10,2) DEFAULT 0.00,
    "is_deposit_paid" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appointments_deposit_amount_check" CHECK (("deposit_amount" >= (0)::numeric)),
    CONSTRAINT "chk_timeline" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "actor_id" "uuid",
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_tags" (
    "client_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."client_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "date_of_birth" "date",
    "gender" "text",
    "occupation" "text",
    "instagram" "text",
    "tier" "text" DEFAULT 'Bronze'::"text" NOT NULL,
    "allergies" "text"[],
    "internal_notes" "text",
    "last_visit_at" timestamp with time zone,
    "next_appointment_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clients_tier_check" CHECK (("tier" = ANY (ARRAY['Bronze'::"text", 'Silver'::"text", 'Gold'::"text", 'Platinum'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "receipt_file_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "incurred_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_purpose" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "recipient_profile_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "channel" "public"."notification_channel" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "avatar_url" "text",
    "role" "public"."user_role" DEFAULT 'owner'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "visit_id" "uuid",
    "invoice_number" "text",
    "gross_amount" numeric(10,2) NOT NULL,
    "tip_amount" numeric(10,2) DEFAULT 0.00,
    "discount_amount" numeric(10,2) DEFAULT 0.00,
    "tax_amount" numeric(10,2) DEFAULT 0.00,
    "net_total" numeric(10,2) GENERATED ALWAYS AS (((("gross_amount" + "tip_amount") - "discount_amount") + "tax_amount")) STORED,
    "payment_method" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "revenues_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "revenues_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "revenues_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "revenues_tip_amount_check" CHECK (("tip_amount" >= (0)::numeric))
);


ALTER TABLE "public"."revenues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "public"."service_category" NOT NULL,
    "name" "text" NOT NULL,
    "default_duration" integer NOT NULL,
    "default_price" numeric(10,2) DEFAULT 0,
    "color_hex" "text" DEFAULT '#8B5CF6'::"text",
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_templates_default_duration_check" CHECK (("default_duration" > 0)),
    CONSTRAINT "service_templates_default_price_check" CHECK (("default_price" >= (0)::numeric))
);


ALTER TABLE "public"."service_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."service_category" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration_minutes" integer NOT NULL,
    "color_hex" "text" DEFAULT '#C8A96A'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    CONSTRAINT "services_duration_minutes_check" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "services_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color_hex" "text" DEFAULT '#C8A96A'::"text"
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "staff_id" "uuid",
    "visit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "summary_notes" "text",
    "formula_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "products_used" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_settings" (
    "workspace_id" "uuid" NOT NULL,
    "theme_config" "jsonb" DEFAULT '{"theme": "light"}'::"jsonb" NOT NULL,
    "business_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "booking_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notification_triggers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "billing_meta" "jsonb" DEFAULT '{"vat_pct": 0}'::"jsonb" NOT NULL,
    "social_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspace_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "base_commission_pct" numeric(5,2) DEFAULT 0.00,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_staff_base_commission_pct_check" CHECK ((("base_commission_pct" >= 0.00) AND ("base_commission_pct" <= 100.00)))
);


ALTER TABLE "public"."workspace_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_brand" "text" NOT NULL,
    "plan_tier" "public"."plan_tier" DEFAULT 'Starter'::"public"."plan_tier" NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Riyadh'::"text" NOT NULL,
    "currency" "text" DEFAULT 'SAR'::"text" NOT NULL,
    "locale" "text" DEFAULT 'en-SA'::"text" NOT NULL,
    "city" "text",
    "district" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_type" "text",
    "trial_started_at" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "subscription_status" "text" DEFAULT 'trial'::"text" NOT NULL,
    CONSTRAINT "workspaces_business_type_check" CHECK (("business_type" = ANY (ARRAY['freelancer'::"text", 'salon'::"text"]))),
    CONSTRAINT "workspaces_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'past_due'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_history"
    ADD CONSTRAINT "ai_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_appointment_id_service_id_key" UNIQUE ("appointment_id", "service_id");



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_tags"
    ADD CONSTRAINT "client_tags_pkey" PRIMARY KEY ("client_id", "tag_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenues"
    ADD CONSTRAINT "revenues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_templates"
    ADD CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_name_key" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id");



ALTER TABLE ONLY "public"."workspace_staff"
    ADD CONSTRAINT "workspace_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_staff"
    ADD CONSTRAINT "workspace_staff_workspace_id_profile_id_key" UNIQUE ("workspace_id", "profile_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_slug_key" UNIQUE ("slug");



CREATE INDEX "idx_appointments_time_window" ON "public"."appointments" USING "btree" ("workspace_id", "start_time", "end_time");



CREATE INDEX "idx_audit_logs_forensics" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_clients_workspace_search" ON "public"."clients" USING "btree" ("workspace_id", "last_visit_at", "next_appointment_at");



CREATE INDEX "idx_files_polymorphic" ON "public"."files" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_revenues_reporting_period" ON "public"."revenues" USING "btree" ("workspace_id", "processed_at" DESC);



CREATE INDEX "idx_service_templates_active" ON "public"."service_templates" USING "btree" ("is_active");



CREATE INDEX "idx_service_templates_category" ON "public"."service_templates" USING "btree" ("category");



CREATE INDEX "idx_visits_passport_lookup" ON "public"."visits" USING "btree" ("client_id", "visit_date" DESC);



CREATE INDEX "idx_workspaces_slug" ON "public"."workspaces" USING "btree" ("slug");



CREATE OR REPLACE TRIGGER "trg_appointments_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clients_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_services_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_visits_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."visits" FOR EACH ROW EXECUTE FUNCTION "public"."audit_trigger"();



CREATE OR REPLACE TRIGGER "trg_workspace_settings_updated_at" BEFORE UPDATE ON "public"."workspace_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."ai_history"
    ADD CONSTRAINT "ai_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_history"
    ADD CONSTRAINT "ai_history_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_tags"
    ADD CONSTRAINT "client_tags_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_tags"
    ADD CONSTRAINT "client_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_receipt_file_id_fkey" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_profile_id_fkey" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revenues"
    ADD CONSTRAINT "revenues_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."revenues"
    ADD CONSTRAINT "revenues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_staff"
    ADD CONSTRAINT "workspace_staff_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_staff"
    ADD CONSTRAINT "workspace_staff_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."ai_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_history_access" ON "public"."ai_history" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."appointment_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_services_access" ON "public"."appointment_services" USING ((EXISTS ( SELECT 1
   FROM "public"."appointments" "a"
  WHERE (("a"."id" = "appointment_services"."appointment_id") AND "public"."is_workspace_member"("a"."workspace_id")))));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_access" ON "public"."appointments" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_access" ON "public"."audit_logs" FOR SELECT USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."client_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_tags_access" ON "public"."client_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_tags"."client_id") AND "public"."is_workspace_member"("c"."workspace_id")))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_access" ON "public"."clients" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_access" ON "public"."expenses" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "files_access" ON "public"."files" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_access" ON "public"."notifications" USING (("recipient_profile_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revenues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "revenues_access" ON "public"."revenues" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."service_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_templates_read" ON "public"."service_templates" FOR SELECT USING (true);



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_access" ON "public"."services" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_access" ON "public"."tags" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visits_access" ON "public"."visits" USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "workspace_access" ON "public"."workspaces" USING ("public"."is_workspace_member"("id"));



ALTER TABLE "public"."workspace_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_settings_access" ON "public"."workspace_settings" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."workspace_staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_staff_access" ON "public"."workspace_staff" USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_professional_workspace"("p_business_name" "text", "p_business_type" "text", "p_city" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("workspace" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."ai_history" TO "anon";
GRANT ALL ON TABLE "public"."ai_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_history" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_services" TO "anon";
GRANT ALL ON TABLE "public"."appointment_services" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_services" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."client_tags" TO "anon";
GRANT ALL ON TABLE "public"."client_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."client_tags" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."revenues" TO "anon";
GRANT ALL ON TABLE "public"."revenues" TO "authenticated";
GRANT ALL ON TABLE "public"."revenues" TO "service_role";



GRANT ALL ON TABLE "public"."service_templates" TO "anon";
GRANT ALL ON TABLE "public"."service_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."service_templates" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."visits" TO "anon";
GRANT ALL ON TABLE "public"."visits" TO "authenticated";
GRANT ALL ON TABLE "public"."visits" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_settings" TO "anon";
GRANT ALL ON TABLE "public"."workspace_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_settings" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_staff" TO "anon";
GRANT ALL ON TABLE "public"."workspace_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_staff" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







