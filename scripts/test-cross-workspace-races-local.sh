#!/usr/bin/env bash
# Two-session concurrency test for the S5 fix
# (supabase/migrations/20261026120000_prevent_cross_workspace_references.sql).
# LOCAL ONLY.
#
# The single-transaction SQL tests cannot exercise races, so this runner
# opens two real sessions against the local Supabase Postgres container (via
# `docker exec`, exactly like scripts/test-rls-local.sh -- it can never reach
# a shared or production project) and races a reference write against a
# workspace move of the referenced row, for every reference between a
# referencing table and a movable table (10 relationships) in both directions
# (20 pairs):
#
#   HOLDER     does its write, waits 3.5s, then COMMITs or ROLLBACKs.
#   CONTENDER  starts 1s later, first proves the holder has written and is
#              still inside its open transaction (OVERLAP -- a scenario whose
#              sessions did not overlap proves nothing, so it is retried, up
#              to 3 attempts, and otherwise fails), does the conflicting write
#              (timed), waits past the holder's end, counts the cross-workspace references
#              visible in its own transaction, then COMMITs (or ROLLBACKs in
#              the control mode).
#
# Modes (all run by default; pass a subset as arguments):
#   control      the 13 S5 triggers are temporarily DISABLED (policies only):
#                every pair must REPRODUCE the race -- the contender is not
#                blocked and sees one cross-workspace reference. Proves the
#                test detects the race.
#   r1_commit    triggers enabled, holder COMMITs: the contender must WAIT
#                for the holder, then be REFUSED (42501); nothing invalid is
#                committed.
#   r1_rollback  triggers enabled, holder ROLLBACKs: the contender must WAIT,
#                then SUCCEED (it re-checks the committed state instead of
#                refusing because of contention); nothing invalid committed.
#   deadlock     two sessions each reference one client and move the other's:
#                Postgres must abort one (40P01) and nothing invalid commits.
#
# Disposable fixtures (users, two workspaces, records; ids ...-000000000eXX)
# are committed for the run and removed afterwards; the triggers are
# re-enabled. Both happen in an EXIT trap, so they also run when a scenario
# fails or the script is interrupted.
set -uo pipefail

PROJECT_ID="platform_salma"
CONTAINER="supabase_db_${PROJECT_ID}"
RUNNING="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)"
if [ "$RUNNING" != "true" ]; then
  echo "REFUSING TO RUN: local Supabase container '$CONTAINER' is not running." >&2
  exit 1
fi
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -d postgres -At -q)

A='00000000-0000-0000-0000-000000000eaa'; B='00000000-0000-0000-0000-000000000ebb'
MEMBER_A='00000000-0000-0000-0000-000000000e0a'; MEMBER_AB='00000000-0000-0000-0000-000000000e0c'
X='00000000-0000-0000-0000-000000000ec1'; A2='00000000-0000-0000-0000-000000000ec2'
CB='00000000-0000-0000-0000-000000000ec3'; Y='00000000-0000-0000-0000-000000000ec4'
TAG='00000000-0000-0000-0000-000000000e81'; SERVICE='00000000-0000-0000-0000-000000000ed1'
APPT='00000000-0000-0000-0000-000000000ea1'; VISIT='00000000-0000-0000-0000-000000000ef1'
FILE='00000000-0000-0000-0000-000000000e61'

TRIGGERS=(
  "appointments trg_appointments_same_workspace_refs" "visits trg_visits_same_workspace_refs"
  "appointment_services trg_appointment_services_same_workspace_refs" "client_tags trg_client_tags_same_workspace_refs"
  "ai_history trg_ai_history_same_workspace_refs" "revenues trg_revenues_same_workspace_refs"
  "expenses trg_expenses_same_workspace_refs" "clients trg_clients_same_workspace_move"
  "services trg_services_same_workspace_move" "tags trg_tags_same_workspace_move"
  "appointments trg_appointments_same_workspace_move" "visits trg_visits_same_workspace_move"
  "files trg_files_same_workspace_move"
)

set_triggers() { # ENABLE | DISABLE (only triggers that exist)
  for entry in "${TRIGGERS[@]}"; do
    set -- $entry
    echo "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '$2') THEN EXECUTE 'ALTER TABLE public.$1 $MODE_TRIGGERS TRIGGER $2'; END IF; END \$\$;"
  done | "${PSQL[@]}" > /dev/null
}
enable_triggers() { MODE_TRIGGERS=ENABLE set_triggers; }
disable_triggers() { MODE_TRIGGERS=DISABLE set_triggers; }

fixtures_down() {
  "${PSQL[@]}" > /dev/null 2>&1 <<SQL
BEGIN;
DELETE FROM public.appointment_services WHERE appointment_id IN (SELECT id FROM public.appointments WHERE workspace_id IN ('$A','$B'))
   OR service_id IN (SELECT id FROM public.services WHERE workspace_id IN ('$A','$B'));
DELETE FROM public.client_tags WHERE client_id IN (SELECT id FROM public.clients WHERE workspace_id IN ('$A','$B'))
   OR tag_id IN (SELECT id FROM public.tags WHERE workspace_id IN ('$A','$B'));
DELETE FROM public.revenues WHERE workspace_id IN ('$A','$B');
DELETE FROM public.expenses WHERE workspace_id IN ('$A','$B');
DELETE FROM public.ai_history WHERE workspace_id IN ('$A','$B');
DELETE FROM public.visits WHERE workspace_id IN ('$A','$B');
DELETE FROM public.appointments WHERE workspace_id IN ('$A','$B');
DELETE FROM public.services WHERE workspace_id IN ('$A','$B');
DELETE FROM public.clients WHERE workspace_id IN ('$A','$B');
DELETE FROM public.tags WHERE workspace_id IN ('$A','$B');
DELETE FROM public.files WHERE workspace_id IN ('$A','$B');
DELETE FROM public.audit_logs WHERE workspace_id IN ('$A','$B') OR (workspace_id IS NULL AND record_id::text LIKE '00000000-0000-0000-0000-000000000e%');
DELETE FROM public.workspaces WHERE id IN ('$A','$B');
DELETE FROM auth.users WHERE id IN ('$MEMBER_A','$MEMBER_AB');
COMMIT;
SQL
}

fixtures_up() {
  "${PSQL[@]}" > /dev/null <<SQL
BEGIN;
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role) VALUES
 ('$MEMBER_A','race-member-a@example.invalid','',now(),'{}','authenticated','authenticated'),
 ('$MEMBER_AB','race-member-ab@example.invalid','',now(),'{}','authenticated','authenticated');
INSERT INTO public.profiles (id, full_name) VALUES ('$MEMBER_A','Race A'),('$MEMBER_AB','Race AB') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.workspaces (id, owner_id, name, slug, display_brand) VALUES
 ('$A','$MEMBER_A','Race A','race-test-a','Race A'), ('$B','$MEMBER_AB','Race B','race-test-b','Race B');
INSERT INTO public.workspace_staff (workspace_id, profile_id, is_active) VALUES
 ('$A','$MEMBER_A',true), ('$A','$MEMBER_AB',true), ('$B','$MEMBER_AB',true);
INSERT INTO public.clients (id, workspace_id, full_name) VALUES
 ('$X','$A','Race client X'), ('$A2','$A','Race client A2'), ('$Y','$A','Race client Y'), ('$CB','$B','Race client B');
INSERT INTO public.tags (id, workspace_id, name) VALUES ('$TAG','$A','Race tag');
INSERT INTO public.services (id, workspace_id, name, category, price, duration_minutes) VALUES ('$SERVICE','$A','Race service','haircut',10,10);
INSERT INTO public.appointments (id, workspace_id, client_id, start_time, end_time) VALUES ('$APPT','$A','$A2','2026-10-27T09:00:00Z','2026-10-27T10:00:00Z');
INSERT INTO public.visits (id, workspace_id, client_id) VALUES ('$VISIT','$A','$A2');
INSERT INTO public.files (id, workspace_id, entity_type, entity_id, file_url, file_type, file_purpose)
 VALUES ('$FILE','$A','expense','$FILE','https://example.invalid/race.pdf','application/pdf','receipt');
COMMIT;
SQL
}

cleanup() { enable_triggers; fixtures_down; }
# Cleanup runs exactly once, from the EXIT trap. An interrupt must stop the
# run (a bare INT/TERM trap would return to the script and keep going).
trap cleanup EXIT
trap 'echo "INTERRUPTED -- cleaning up" >&2; exit 130' INT TERM

# relationship -> reference write (member of A) | move of the referenced row (member of A and B)
RELS=(appointments.client_id visits.client_id visits.appointment_id appointment_services.service_id
      appointment_services.appointment_id client_tags.client_id client_tags.tag_id ai_history.client_id
      revenues.visit_id expenses.receipt_file_id)
declare -A REF MOVE
MOVE_CLIENT="UPDATE public.clients SET workspace_id = '$B' WHERE id = '$X';"
MOVE_APPT="UPDATE public.appointments SET workspace_id = '$B', client_id = '$CB' WHERE id = '$APPT';"
REF[appointments.client_id]="INSERT INTO public.appointments (workspace_id, client_id, start_time, end_time) VALUES ('$A','$X','2026-10-28T09:00:00Z','2026-10-28T10:00:00Z');"
MOVE[appointments.client_id]="$MOVE_CLIENT"
REF[visits.client_id]="INSERT INTO public.visits (workspace_id, client_id) VALUES ('$A','$X');"
MOVE[visits.client_id]="$MOVE_CLIENT"
REF[visits.appointment_id]="INSERT INTO public.visits (workspace_id, client_id, appointment_id) VALUES ('$A','$A2','$APPT');"
MOVE[visits.appointment_id]="$MOVE_APPT"
REF[appointment_services.service_id]="INSERT INTO public.appointment_services (appointment_id, service_id) VALUES ('$APPT','$SERVICE');"
MOVE[appointment_services.service_id]="UPDATE public.services SET workspace_id = '$B' WHERE id = '$SERVICE';"
REF[appointment_services.appointment_id]="INSERT INTO public.appointment_services (appointment_id, service_id) VALUES ('$APPT','$SERVICE');"
MOVE[appointment_services.appointment_id]="$MOVE_APPT"
REF[client_tags.client_id]="INSERT INTO public.client_tags (client_id, tag_id) VALUES ('$X','$TAG');"
MOVE[client_tags.client_id]="$MOVE_CLIENT"
REF[client_tags.tag_id]="INSERT INTO public.client_tags (client_id, tag_id) VALUES ('$A2','$TAG');"
MOVE[client_tags.tag_id]="UPDATE public.tags SET workspace_id = '$B' WHERE id = '$TAG';"
REF[ai_history.client_id]="INSERT INTO public.ai_history (workspace_id, client_id, insight_type, input_context, ai_response, model_name) VALUES ('$A','$X','test','{}','{}','test-model');"
MOVE[ai_history.client_id]="$MOVE_CLIENT"
REF[revenues.visit_id]="INSERT INTO public.revenues (workspace_id, visit_id, gross_amount, payment_method) VALUES ('$A','$VISIT',10,'cash');"
MOVE[revenues.visit_id]="UPDATE public.visits SET workspace_id = '$B', client_id = '$CB' WHERE id = '$VISIT';"
REF[expenses.receipt_file_id]="INSERT INTO public.expenses (workspace_id, receipt_file_id, amount, category) VALUES ('$A','$FILE',5,'supplies');"
MOVE[expenses.receipt_file_id]="UPDATE public.files SET workspace_id = '$B' WHERE id = '$FILE';"

CROSS_SQL="((SELECT count(*) FROM public.appointments x JOIN public.clients c ON c.id = x.client_id WHERE x.workspace_id IN ('$A','$B') AND c.workspace_id <> x.workspace_id)
 + (SELECT count(*) FROM public.visits x JOIN public.clients c ON c.id = x.client_id WHERE x.workspace_id IN ('$A','$B') AND c.workspace_id <> x.workspace_id)
 + (SELECT count(*) FROM public.visits x JOIN public.appointments a ON a.id = x.appointment_id WHERE x.workspace_id IN ('$A','$B') AND a.workspace_id <> x.workspace_id)
 + (SELECT count(*) FROM public.appointment_services x JOIN public.appointments a ON a.id = x.appointment_id JOIN public.services s ON s.id = x.service_id WHERE a.workspace_id IN ('$A','$B') AND s.workspace_id <> a.workspace_id)
 + (SELECT count(*) FROM public.client_tags x JOIN public.clients c ON c.id = x.client_id JOIN public.tags t ON t.id = x.tag_id WHERE c.workspace_id IN ('$A','$B') AND t.workspace_id <> c.workspace_id)
 + (SELECT count(*) FROM public.ai_history x JOIN public.clients c ON c.id = x.client_id WHERE x.workspace_id IN ('$A','$B') AND c.workspace_id <> x.workspace_id)
 + (SELECT count(*) FROM public.revenues x JOIN public.visits v ON v.id = x.visit_id WHERE x.workspace_id IN ('$A','$B') AND v.workspace_id <> x.workspace_id)
 + (SELECT count(*) FROM public.expenses x JOIN public.files f ON f.id = x.receipt_file_id WHERE x.workspace_id IN ('$A','$B') AND f.workspace_id <> x.workspace_id))"

as_user() { echo "SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', json_build_object('sub','$1','role','authenticated')::text, true) \\g /dev/null"; }

holder() { # user write end
  { echo "SET application_name = 'race_holder';"; echo "BEGIN;"; as_user "$1"; echo "$2"; echo "SELECT 'HOLDER wrote';"
    echo "SELECT pg_sleep(3.5) \\g /dev/null"; echo "$3;"; } | "${PSQL[@]}" 2>&1
}
contender() { # user write end
  {
    # Overlap proof, taken (as the setup role) immediately before the write:
    # the holder must already have written and still be inside its open
    # transaction (sleeping before its COMMIT/ROLLBACK).
    echo "SELECT 'OVERLAP ' || EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'race_holder' AND xact_start IS NOT NULL AND query LIKE 'SELECT pg_sleep(%')::text;"
    echo "BEGIN;"; as_user "$1"
    echo "DO \$\$ DECLARE t0 timestamptz := clock_timestamp(); BEGIN"
    echo "  BEGIN $2 RAISE NOTICE 'OUTCOME ok %', round(extract(epoch FROM clock_timestamp() - t0) * 1000);"
    echo "  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'OUTCOME err % %', SQLSTATE, round(extract(epoch FROM clock_timestamp() - t0) * 1000); END;"
    echo "END \$\$;"
    echo "SELECT pg_sleep(3.5) \\g /dev/null"
    echo "RESET ROLE;"
    echo "SELECT 'CROSSVIEW ' || $CROSS_SQL;"
    echo "$3;"
  } | "${PSQL[@]}" 2>&1
}

FAILS=0; PASSES=0
run_pair() { # mode rel direction -- retried (up to 3 attempts) only when the sessions did not overlap
  local mode="$1" rel="$2" dir="$3" hu hw cu cw hend cend attempt
  if [ "$dir" = reference_first ]; then hu=$MEMBER_A; hw="${REF[$rel]}"; cu=$MEMBER_AB; cw="${MOVE[$rel]}"
  else hu=$MEMBER_AB; hw="${MOVE[$rel]}"; cu=$MEMBER_A; cw="${REF[$rel]}"; fi
  case "$mode" in control) hend=COMMIT; cend=ROLLBACK ;; r1_commit) hend=COMMIT; cend=COMMIT ;; r1_rollback) hend=ROLLBACK; cend=COMMIT ;; esac
  for attempt in 1 2 3; do
    fixtures_down; fixtures_up
    local hout cout
    hout="$(mktemp)"; cout="$(mktemp)"
    holder "$hu" "$hw" "$hend" > "$hout" &
    sleep 1
    contender "$cu" "$cw" "$cend" > "$cout"
    wait
    local committed outcome state ms view overlap verdict ok=1
    committed="$("${PSQL[@]}" -c "SELECT $CROSS_SQL;")"
    overlap="$(grep -o 'OVERLAP [a-z]*' "$cout" | awk '{print $2}')"
    outcome="$(grep -o 'OUTCOME .*' "$cout" | head -1)"; view="$(grep -o 'CROSSVIEW [0-9]*' "$cout" | awk '{print $2}')"
    state="$(echo "$outcome" | awk '{print $2=="ok" ? "ok" : $3}')"; ms="$(echo "$outcome" | awk '{print $NF}')"
    if [ "$overlap" != true ] && [ "$attempt" -lt 3 ]; then
      echo "     (attempt $attempt of $mode $rel $dir: the sessions did not overlap -- retrying)"
      rm -f "$hout" "$cout"; continue
    fi
    [ "$overlap" = true ] || ok=0
    grep -q 'HOLDER wrote' "$hout" || ok=0
    case "$mode" in
      # Control: the race must reproduce (the contender's write succeeds and an
      # invalid reference is visible). Waiting is reported, not required: a
      # tag move changes a column of tags' UNIQUE (workspace_id, name) key, so
      # Postgres already serializes it against the foreign key's lock -- but
      # without the triggers nothing re-checks after the wait.
      control)     [ "$state" = ok ] && [ "$view" = 1 ] || ok=0 ;;
      r1_commit)   [ "$state" = 42501 ] && [ "${ms:-0}" -ge 800 ] && [ "$view" = 0 ] && [ "$committed" = 0 ] || ok=0 ;;
      r1_rollback) [ "$state" = ok ] && [ "${ms:-0}" -ge 800 ] && [ "$view" = 0 ] && [ "$committed" = 0 ] || ok=0 ;;
    esac
    if [ "$ok" = 1 ]; then verdict=PASS; PASSES=$((PASSES + 1)); else verdict=FAIL; FAILS=$((FAILS + 1)); fi
    printf '%-4s %-11s %-38s %-16s overlap=%-5s contender=%-6s waited=%5sms cross_in_view=%s cross_committed=%s\n' \
      "$verdict" "$mode" "$rel" "$dir" "$overlap" "$state" "$ms" "$view" "$committed"
    if [ "$ok" != 1 ]; then sed 's/^/       holder: /' "$hout"; sed 's/^/       contender: /' "$cout"; fi
    rm -f "$hout" "$cout"
    return
  done
}

run_deadlock() {
  fixtures_down; fixtures_up
  local t1 t2 committed
  t1="$(mktemp)"; t2="$(mktemp)"
  { echo "BEGIN;"; as_user "$MEMBER_AB"
    echo "INSERT INTO public.appointments (workspace_id, client_id, start_time, end_time) VALUES ('$A','$X','2026-10-29T09:00:00Z','2026-10-29T10:00:00Z');"
    echo "SELECT pg_sleep(1) \\g /dev/null"; echo "UPDATE public.clients SET workspace_id = '$B' WHERE id = '$Y';"; echo "COMMIT;"; } | "${PSQL[@]}" > "$t1" 2>&1 &
  sleep 0.3
  { echo "BEGIN;"; as_user "$MEMBER_AB"
    echo "INSERT INTO public.appointments (workspace_id, client_id, start_time, end_time) VALUES ('$A','$Y','2026-10-29T11:00:00Z','2026-10-29T12:00:00Z');"
    echo "SELECT pg_sleep(1) \\g /dev/null"; echo "UPDATE public.clients SET workspace_id = '$B' WHERE id = '$X';"; echo "COMMIT;"; } | "${PSQL[@]}" > "$t2" 2>&1
  wait
  committed="$("${PSQL[@]}" -c "SELECT $CROSS_SQL;")"
  local deadlocks; deadlocks="$(cat "$t1" "$t2" | grep -c 'deadlock detected')"
  if [ "$deadlocks" = 1 ] && [ "$committed" = 0 ]; then
    echo "PASS deadlock    one transaction aborted with 40P01 (deadlock detected); cross_committed=$committed"; PASSES=$((PASSES + 1))
  else
    echo "FAIL deadlock    deadlocks=$deadlocks cross_committed=$committed"; sed 's/^/       T1: /' "$t1"; sed 's/^/       T2: /' "$t2"; FAILS=$((FAILS + 1))
  fi
  rm -f "$t1" "$t2"
}

MODES=("$@"); [ ${#MODES[@]} -eq 0 ] && MODES=(control r1_commit r1_rollback deadlock)
for mode in "${MODES[@]}"; do
  echo "== $mode"
  if [ "$mode" = control ]; then disable_triggers; else enable_triggers; fi
  if [ "$mode" = deadlock ]; then run_deadlock; continue; fi
  for rel in "${RELS[@]}"; do
    for dir in reference_first move_first; do run_pair "$mode" "$rel" "$dir"; done
  done
done
enable_triggers
echo "RESULT: $PASSES passed, $FAILS failed"
[ "$FAILS" = 0 ]
