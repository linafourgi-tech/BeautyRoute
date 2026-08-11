#!/usr/bin/env bash
# Real local-Postgres RLS integration test runner. LOCAL ONLY.
#
# Runs supabase/tests/rls_workspace_isolation.sql against the local
# Supabase Postgres container by name, via `docker exec`. This is a
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
SQL_FILE="$SCRIPT_DIR/../supabase/tests/rls_workspace_isolation.sql"

RUNNING="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)"
if [ "$RUNNING" != "true" ]; then
  echo "REFUSING TO RUN: local Supabase container '$CONTAINER' is not running." >&2
  echo "This test only runs against a real local Postgres instance -- see supabase/tests/README.md." >&2
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "REFUSING TO RUN: $SQL_FILE not found." >&2
  exit 1
fi

echo "Running real-RLS workspace-isolation test inside local container: $CONTAINER"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
echo "PASS -- RLS workspace isolation holds (real local Postgres, real RLS policies, no mocking)."
