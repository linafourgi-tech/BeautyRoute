-- Records the production signup trigger auth.users.on_auth_user_created in
-- the migration history, so that a database built from migrations (local
-- and CI) creates the public.profiles row at signup, as production does.
-- The existing production trigger is preserved unchanged.
--
-- Why it's missing: the baseline 20260722092124 came from `supabase db
-- dump`, which captures the public schema only. That dump includes the
-- function public.handle_new_user() but not the trigger on auth.users that
-- calls it. public.profiles has no INSERT policy, so this trigger is the
-- only way a profile row gets created.
--
-- Behaviour: fails closed and never overwrites anything.
--   * trigger absent: create it exactly as production has it, then
--     re-read it and verify;
--   * trigger present with exactly the expected definition: change nothing
--     and raise a NOTICE;
--   * trigger present with any other definition, for example a different
--     timing, event, level, function, WHEN clause, column list, arguments,
--     enabled state, or constraint, deferral, transition-table or partition
--     options: raise an ERROR. The migration aborts and nothing changes;
--   * another trigger on auth.users already calls handle_new_user(): ERROR,
--     because a second trigger would insert a duplicate profile;
--   * auth.users or public.handle_new_user() is missing, or the function's
--     owner, security mode, language, search_path or return type is
--     unexpected: ERROR.
-- The file contains no DROP, no CREATE OR REPLACE, and no ALTER of an
-- existing trigger.
--
-- Expected definition (read-only production catalog check, 2026-11-20):
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()    -- enabled 'O'
--
-- The function body itself isn't compared here. Production's text differs
-- from the repository only in line endings (CRLF); that difference was
-- reviewed and accepted separately.
--
-- On production, where the trigger already exists with the expected
-- definition, the only effect is the NOTICE plus the migration-history row
-- that the CLI records. Deploying this file to production needs separate
-- authorization.
--
-- search_path and lock_timeout are changed transaction-locally, and
-- restored before the block ends on every success path. On an error the
-- whole transaction is aborted.

DO $capture$
DECLARE
  c_trigger  constant name := 'on_auth_user_created';
  -- pg_trigger.tgtype bits: ROW = 1, BEFORE = 2, INSERT = 4, DELETE = 8,
  -- UPDATE = 16, TRUNCATE = 32, INSTEAD = 64. AFTER INSERT FOR EACH ROW = 5.
  c_tgtype   constant int2 := 5;
  c_def      constant text :=
    'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
  v_saved_sp text := pg_catalog.current_setting('search_path');
  v_saved_lt text := pg_catalog.current_setting('lock_timeout');
  v_users    oid;
  v_fn       oid;
  v_others   text;
  v_def      text;
  t          record;
BEGIN
  -- Pin name resolution, so pg_get_triggerdef() always schema-qualifies.
  PERFORM pg_catalog.set_config('search_path', 'pg_catalog', true);
  -- Never queue behind Auth traffic on auth.users for long.
  PERFORM pg_catalog.set_config('lock_timeout', '5s', true);

  v_users := pg_catalog.to_regclass('auth.users');
  IF v_users IS NULL THEN
    RAISE EXCEPTION 'capture_auth_user_created_trigger: auth.users does not exist'
      USING HINT = 'Nothing was changed.';
  END IF;

  v_fn := pg_catalog.to_regprocedure('public.handle_new_user()');
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'capture_auth_user_created_trigger: public.handle_new_user() does not exist'
      USING HINT = 'Nothing was changed.';
  END IF;

  PERFORM 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
   WHERE p.oid = v_fn
     AND p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
     AND p.prosecdef
     AND l.lanname = 'plpgsql'
     AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
     AND p.proconfig = ARRAY['search_path=public']::text[];
  IF NOT FOUND THEN
    RAISE EXCEPTION 'capture_auth_user_created_trigger: public.handle_new_user() has an unexpected owner, security mode, language, search_path or return type'
      USING HINT = 'Manual review required. Nothing was changed.';
  END IF;

  SELECT pg_catalog.string_agg(pg_catalog.quote_ident(tg.tgname), ', ' ORDER BY tg.tgname)
    INTO v_others
    FROM pg_catalog.pg_trigger tg
   WHERE tg.tgrelid = v_users
     AND tg.tgfoid = v_fn
     AND NOT tg.tgisinternal
     AND tg.tgname <> c_trigger;
  IF v_others IS NOT NULL THEN
    RAISE EXCEPTION 'capture_auth_user_created_trigger: other trigger(s) on auth.users already call public.handle_new_user(): %', v_others
      USING HINT = 'A second trigger would insert duplicate profiles. Manual review required. Nothing was changed.';
  END IF;

  SELECT tg.* INTO t
    FROM pg_catalog.pg_trigger tg
   WHERE tg.tgrelid = v_users
     AND tg.tgname = c_trigger;

  IF FOUND THEN
    v_def := pg_catalog.pg_get_triggerdef(t.oid);
    IF t.tgfoid = v_fn
       AND t.tgtype = c_tgtype
       AND t.tgenabled = 'O'
       AND NOT t.tgisinternal
       AND t.tgconstraint = 0
       AND NOT t.tgdeferrable
       AND NOT t.tginitdeferred
       AND t.tgparentid = 0
       AND t.tgnargs = 0
       AND t.tgattr::text = ''
       AND t.tgqual IS NULL
       AND t.tgoldtable IS NULL
       AND t.tgnewtable IS NULL
       AND v_def = c_def
    THEN
      RAISE NOTICE 'capture_auth_user_created_trigger: % already present with the expected definition; no change made', c_trigger;
    ELSE
      RAISE EXCEPTION 'capture_auth_user_created_trigger: % exists with an unexpected definition: % (enabled=%)', c_trigger, v_def, t.tgenabled
        USING HINT = 'Not overwritten. Manual review required. Nothing was changed.';
    END IF;
  ELSE
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    SELECT tg.* INTO t
      FROM pg_catalog.pg_trigger tg
     WHERE tg.tgrelid = v_users
       AND tg.tgname = c_trigger;
    IF NOT FOUND
       OR pg_catalog.pg_get_triggerdef(t.oid) <> c_def
       OR t.tgtype <> c_tgtype
       OR t.tgenabled <> 'O' THEN
      RAISE EXCEPTION 'capture_auth_user_created_trigger: post-create verification failed'
        USING HINT = 'The transaction is aborted; nothing was changed.';
    END IF;
    RAISE NOTICE 'capture_auth_user_created_trigger: % created', c_trigger;
  END IF;

  PERFORM pg_catalog.set_config('lock_timeout', v_saved_lt, true);
  PERFORM pg_catalog.set_config('search_path', v_saved_sp, true);
END
$capture$;
