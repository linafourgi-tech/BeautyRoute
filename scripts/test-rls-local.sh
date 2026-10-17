#!/usr/bin/env bash
# Real local-Postgres RLS integration test runner. LOCAL ONLY.
#
# Runs every real-Postgres test in supabase/tests/ listed in SQL_FILES below
# against the local Supabase Postgres container by name, via
# `docker exec`. This is a
# deliberate safety choice, not just a convenience: `docker exec` can only
# ever reach a container already running on this machine -- there is no
# connection string, host, or env var here that could be misconfigured or
# inherited to point this at a shared/production project. If the named
# local container isn't running, this script refuses to run at all.
#
# See supabase/tests/README.md for prerequisites and exactly how to bring
# the local container up before running this.
set -euo pipefail

# Must match supabase/config.toml's project_id -- this is how the
# Supabase CLI names the local Postgres container.
PROJECT_ID="platform_salma"
CONTAINER="supabase_db_${PROJECT_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILES=(
  "$SCRIPT_DIR/../supabase/tests/rls_workspace_isolation.sql"
  "$SCRIPT_DIR/../supabase/tests/workspace_protected_columns.sql"
  "$SCRIPT_DIR/../supabase/tests/workspace_direct_delete.sql"
  "$SCRIPT_DIR/../supabase/tests/workspace_deletion_flow.sql"
  "$SCRIPT_DIR/../supabase/tests/service_template_import.sql"
  "$SCRIPT_DIR/../supabase/tests/storage_objects_access.sql"
  "$SCRIPT_DIR/../supabase/tests/workspace_staff_management.sql"
)

RUNNING="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)"
if [ "$RUNNING" != "true" ]; then
  echo "REFUSING TO RUN: local Supabase container '$CONTAINER' is not running." >&2
  echo "This test only runs against a real local Postgres instance -- see supabase/tests/README.md." >&2
  exit 1
fi

for SQL_FILE in "${SQL_FILES[@]}"; do
  if [ ! -f "$SQL_FILE" ]; then
    echo "REFUSING TO RUN: $SQL_FILE not found." >&2
    exit 1
  fi
done

for SQL_FILE in "${SQL_FILES[@]}"; do
  echo "Running $(basename "$SQL_FILE") inside local container: $CONTAINER"
  # beautyroute.local_rls_test=on is the session setting local-only test
  # files check before doing anything (see workspace_deletion_flow.sql).
  docker exec -i -e PGOPTIONS='-c beautyroute.local_rls_test=on' "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
done
echo "PASS -- workspace isolation, protected workspace columns, direct-delete restrictions, the authorized deletion flow, service-template import authorization, Storage object access, and owner-only staff management hold (real local Postgres, real grants and RLS policies, no mocking)."
