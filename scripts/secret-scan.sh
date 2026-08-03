#!/usr/bin/env bash
# Deterministic, self-contained secret scan -- no third-party service, no
# external upload of repository contents (everything here runs against the
# local git checkout only). Scans tracked file contents and, where
# practical, full git history for real-credential-shaped patterns.
#
# Deliberately narrow, format-specific regexes (not generic high-entropy
# heuristics) so this never needs an allowlist for this repo's own
# documented placeholders (ci-placeholder-*, empty .env.example values,
# fake-*/test-* tokens used in Deno tests) -- none of those match a real
# secret's actual format in the first place.
#
# On a match, only the file path (or, for history, a note to check
# locally) is printed -- never the matched text itself -- so a true
# positive doesn't get re-exposed in CI logs while still failing the build.
set -euo pipefail

PATTERN='sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|postgresql://[^:/@[:space:]]+:[^@[:space:]]+@|xox[baprs]-[A-Za-z0-9-]{10,}'

# This script's own source necessarily contains these patterns as literal
# detection strings, not real secrets -- excluded from both scans below so
# the gate doesn't permanently and falsely fail on its own diff/content
# forever after this file is committed.
SELF_PATH="scripts/secret-scan.sh"

found=0

echo "Scanning tracked files for credential-shaped patterns..."
while IFS= read -r file; do
  if [ "$file" = "$SELF_PATH" ]; then continue; fi
  if grep -qIE "$PATTERN" -- "$file" 2>/dev/null; then
    echo "Potential credential pattern found in tracked file: $file"
    found=1
  fi
done < <(git ls-files)

echo "Scanning git history (all branches, patch content) where practical..."
if git log --all -p -- . ":(exclude)$SELF_PATH" 2>/dev/null | grep -qE "$PATTERN"; then
  echo "Potential credential pattern found somewhere in git history."
  echo "Not printed here to avoid echoing the match itself -- locate it locally with:"
  echo "  git log --all -p | grep -nE '<pattern>'"
  found=1
fi

if [ "$found" -eq 1 ]; then
  echo "Secret scan FAILED."
  exit 1
fi

echo "Secret scan passed -- no credential-shaped patterns found."
