-- Phase 12 Step 6: durable, shared rate limiting for Edge Functions.
--
-- Both ai-assistant and route-planner previously rate-limited with a
-- per-isolate in-memory Map (see their own source comments, which already
-- documented this as a known, non-durable limitation -- Edge Function
-- isolates are ephemeral and can run in more than one region, so an
-- attacker fanning requests across enough cold isolates could exceed the
-- intended cap). This migration replaces that with a shared Postgres-
-- backed counter, since Postgres is already the one durable store this
-- project relies on everywhere else.
--
-- Design: a sliding-window request log (one row per accepted request,
-- scoped by (user_id, function_name)), not a fixed-bucket counter --
-- this preserves the EXACT existing policy semantics (20 requests in any
-- trailing 10-minute window per user per function), rather than
-- introducing calendar-aligned buckets that would behave subtly
-- differently at window boundaries.
CREATE TABLE IF NOT EXISTS "public"."rate_limit_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "user_id" "uuid" NOT NULL,
    "function_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."rate_limit_events" OWNER TO "postgres";

-- Composite index matching exactly how check_rate_limit() below queries
-- this table: filter by (user_id, function_name), then by created_at for
-- the window cutoff.
CREATE INDEX IF NOT EXISTS "idx_rate_limit_events_user_function_time"
    ON "public"."rate_limit_events" USING "btree" ("user_id", "function_name", "created_at");

-- RLS is enabled with ZERO policies granted to anon/authenticated -- by
-- design, not an oversight. The only sanctioned way to read or write this
-- table at all is through check_rate_limit() below, which runs as
-- SECURITY DEFINER and scopes every operation to auth.uid() internally.
-- With RLS enabled and no policy, Postgres denies every direct row to
-- anon/authenticated, so no user can read or alter another user's --
-- or even their own -- rate-limit rows except through that function's own
-- logic, which never accepts a caller-supplied user id.
ALTER TABLE "public"."rate_limit_events" ENABLE ROW LEVEL SECURITY;

-- Atomically checks and records one rate-limited request for the CALLING
-- user (auth.uid() -- never a parameter, so no caller can check or consume
-- another user's quota) against a named function's sliding window.
--
-- function_name is a required, explicit parameter (not inferred) so two
-- different Edge Functions can never collide on the same counter even if
-- they happened to be called by the same user at the same moment --
-- ai-assistant and route-planner each pass their own literal name.
--
-- Atomicity: pg_advisory_xact_lock serializes concurrent calls for the
-- exact same (user_id, function_name) pair for the duration of this
-- transaction (released automatically at commit/rollback -- there is no
-- unlock call because none is needed). Concurrent calls for different
-- users, or the same user's different functions, never block each other.
-- This closes the check-then-act race a plain "count, then maybe insert"
-- would otherwise have under concurrent requests.
--
-- Expiry/cleanup: every call opportunistically deletes this user+
-- function's own rows older than the window before counting, so a user's
-- row count for one function never exceeds p_max_requests at rest. A user
-- who stops calling entirely leaves at most p_max_requests stale rows
-- behind forever (bounded per abandoned user, not unbounded growth) --
-- a deliberate trade-off against adding a separate scheduled sweep job,
-- documented in the Phase 12 Security Review Step 6 report.
CREATE OR REPLACE FUNCTION "public"."check_rate_limit"(
    "p_function_name" "text",
    "p_window_seconds" integer,
    "p_max_requests" integer
) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_function_name, 0));

  DELETE FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND function_name = p_function_name
    AND created_at < now() - (p_window_seconds || ' seconds')::interval;

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE user_id = v_user_id
    AND function_name = p_function_name;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events (user_id, function_name) VALUES (v_user_id, p_function_name);
  RETURN true;
END;
$$;

ALTER FUNCTION "public"."check_rate_limit"("p_function_name" "text", "p_window_seconds" integer, "p_max_requests" integer) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_function_name" "text", "p_window_seconds" integer, "p_max_requests" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_function_name" "text", "p_window_seconds" integer, "p_max_requests" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_function_name" "text", "p_window_seconds" integer, "p_max_requests" integer) TO "service_role";

GRANT ALL ON TABLE "public"."rate_limit_events" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_events" TO "service_role";
