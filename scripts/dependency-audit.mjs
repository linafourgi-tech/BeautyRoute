#!/usr/bin/env node
// npm audit gate with a documented, narrow exception mechanism.
//
// A blanket `npm audit --audit-level=high` can't distinguish "reviewed and
// confirmed non-applicable" from "new and unreviewed" -- it either fails
// the build on every high/critical finding (including ones already
// investigated and found not to apply) or gets disabled outright (missing
// genuinely new advisories). This script runs the real audit against the
// lockfile, then ignores ONLY the specific advisory ids explicitly listed
// below -- any other high/critical finding still fails the build.
import { execSync } from "node:child_process";

// Every entry here is a specific advisory id with its own reasoning and a
// concrete revisit condition -- never a wildcard, never "all high-severity
// findings", and never a permanent suppression.
const ALLOWED_ADVISORIES = {
  "GHSA-qwww-vcr4-c8h2": {
    package: "react-router",
    reason:
      "React Router \"RSC Mode CSRF Bypass\" (CWE-352). Confirmed during the Phase 12 Security Review (Step 4) that the vulnerable surface -- React Router's unstable RSC APIs -- is not used anywhere in this codebase (plain BrowserRouter/Routes/Route, no data loaders/actions/RSC/framework mode).",
    revisitIf:
      "RSC or data-router APIs (createBrowserRouter/loaders/actions) are adopted, or during a planned React Router v8 migration.",
  },
};

function runAudit() {
  try {
    const raw = execSync("npm audit --json", { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(raw);
  } catch (err) {
    // npm audit exits non-zero whenever ANY vulnerability exists at all,
    // including ones this script is about to correctly allow -- so a
    // non-zero exit here is expected and not itself a failure. Only a
    // genuinely unparsable result (no JSON on stdout) is a real error.
    const raw = err.stdout?.toString?.() ?? "";
    if (!raw) {
      console.error("npm audit produced no output to parse:", err.message);
      process.exit(1);
    }
    return JSON.parse(raw);
  }
}

const report = runAudit();
const unreviewed = [];

for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object") continue; // a plain string entry is just a dependency-name reference, not its own advisory
    const severity = via.severity;
    if (severity !== "high" && severity !== "critical") continue;
    const id = (via.url ?? "").split("/").pop();
    if (id && ALLOWED_ADVISORIES[id]) continue;
    unreviewed.push({ id: id || "(unknown)", severity, title: via.title, package: via.name });
  }
}

const allowedIds = Object.keys(ALLOWED_ADVISORIES);
console.log(`Reviewed/allowed advisories: ${allowedIds.length ? allowedIds.join(", ") : "(none)"}`);

if (unreviewed.length > 0) {
  console.error("New or unreviewed high/critical advisories found:");
  for (const f of unreviewed) {
    console.error(`  - ${f.id} (${f.severity}) -- ${f.package}: ${f.title}`);
  }
  console.error(
    "Add a reviewed entry to ALLOWED_ADVISORIES in scripts/dependency-audit.mjs only after confirming it does not apply to this repository's actual usage, or fix/upgrade the dependency instead."
  );
  process.exit(1);
}

console.log("Dependency audit gate passed -- no new unreviewed high/critical advisories.");
