import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S2 fix (import_service_templates()
// must only add services to a workspace the caller is an active member of).
// The real behavior -- member allowed, outsider / inactive staff / anon /
// NULL id refused, deduplication and onboarding unchanged -- is proven
// against a real local Postgres by supabase/tests/service_template_import.sql
// (`npm run test:rls:local`), which isn't wired into CI. What this file
// guarantees in CI is the migration's exact shape, and that no later
// migration re-opens the function to anon/PUBLIC or redefines it without
// the membership check.
//
// Known limitation (documented, not hidden): a text scan cannot see grants
// made outside migrations (dashboard / SQL editor) or computed at runtime.
// The post-deploy check scripts/verify-import-service-templates.sql reads
// the live privileges and function body and is the backstop for both.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261013120000_restrict_import_service_templates.sql";
const BASELINE_FILE = "20260722092124_name_of_your_migration.sql";
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const sql = read(MIGRATION_FILE);

const SIGNATURE = '"public"."import_service_templates"("p_workspace_id" "uuid", "p_template_ids" "uuid"[])';
const FUNCTION_DEF = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\."?import_service_templates"?\s*\([^)]*\)([\s\S]*?)\$([A-Za-z_]*)\$([\s\S]*?)\$\2\$\s*;/gi;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Every definition of import_service_templates() in the text: its header
// (between the signature and the body) and its dollar-quoted body.
function definitions(text: string): Array<{ header: string; body: string }> {
  return [...stripComments(text).matchAll(FUNCTION_DEF)].map((m) => ({ header: squash(m[1]), body: m[3] }));
}

// Top-level statements once function definitions are removed.
function otherStatements(text: string): string[] {
  return stripComments(text)
    .replace(FUNCTION_DEF, " ")
    .split(";")
    .map(squash)
    .filter(Boolean);
}

const MEMBERSHIP_CHECK =
  /IF\s+NOT\s+public\.is_workspace_member\(\s*p_workspace_id\s*\)\s+THEN\s+RAISE\s+EXCEPTION\s+'[^']*'\s+USING\s+ERRCODE\s*=\s*'42501'\s*;\s*END\s+IF\s*;/i;

describe("20261013120000_restrict_import_service_templates.sql (structural regression coverage)", () => {
  const defs = definitions(sql);

  it("redefines import_service_templates() exactly once, keeping SECURITY DEFINER and the pinned search_path", () => {
    expect(defs).toHaveLength(1);
    expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${SIGNATURE} RETURNS integer`);
    expect(defs[0].header).toMatch(/LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public' AS/);
  });

  it("checks is_workspace_member(p_workspace_id) and raises 42501 before any services-table access", () => {
    const body = defs[0].body;
    const check = body.search(MEMBERSHIP_CHECK);
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.search(/public\.services/i));
    expect(check).toBeLessThan(body.search(/service_templates/i));
  });

  it("leaves the rest of the body byte-for-byte the original (whitespace-normalized)", () => {
    const original = definitions(read(BASELINE_FILE));
    expect(original).toHaveLength(1);
    expect(squash(defs[0].body.replace(MEMBERSHIP_CHECK, ""))).toBe(squash(original[0].body));
  });

  it("otherwise contains exactly the two reviewed REVOKE EXECUTE statements", () => {
    expect(otherStatements(sql)).toEqual([
      `REVOKE EXECUTE ON FUNCTION ${SIGNATURE} FROM PUBLIC`,
      `REVOKE EXECUTE ON FUNCTION ${SIGNATURE} FROM "anon"`,
    ]);
  });

  it("grants nothing and keeps authenticated / service_role", () => {
    expect(stripComments(sql)).not.toMatch(/\bGRANT\b/i);
    expect(stripComments(sql)).not.toMatch(/FROM\s+"?(authenticated|service_role)"?/i);
  });
});

// A later migration re-opens S2 if it grants EXECUTE on the function to
// anon/PUBLIC, redefines it without the membership check, or DROPs it (a
// re-created function picks up the schema's default privileges, which
// grant EXECUTE to anon -- baseline ALTER DEFAULT PRIVILEGES ... ON FUNCTIONS).
function s2Regressions(text: string): string[] {
  const clean = stripComments(text);
  const problems: string[] = [];
  const flat = squash(clean);
  for (const m of flat.matchAll(/\bGRANT\s+([^;']+?)\s+ON\s+(?:FUNCTION\s+)?([^;']*?import_service_templates[^;']*?)\s+TO\s+([^;']+)/gi)) {
    if (/\b(anon|public)\b/i.test(m[3].split(/\bWITH\b/i)[0].replace(/"public"\./gi, ""))) {
      problems.push(`GRANT ${m[1]} ... TO ${m[3].trim()}`);
    }
  }
  if (/\bGRANT\b[^;']*\bON\s+ALL\s+(FUNCTIONS|ROUTINES)\s+IN\s+SCHEMA\b[^;']*\bpublic\b[^;']*\bTO\b[^;']*\b(anon|PUBLIC)\b/i.test(flat)) {
    problems.push("GRANT ON ALL FUNCTIONS IN SCHEMA public to anon/PUBLIC");
  }
  if (/\bDROP\s+FUNCTION\b[^;]*\bimport_service_templates\b/i.test(flat)) {
    problems.push("DROP FUNCTION import_service_templates");
  }
  for (const def of definitions(text)) {
    if (!MEMBERSHIP_CHECK.test(def.body)) problems.push("redefinition without the membership check");
  }
  return problems;
}

describe("migration-order guard: no later migration re-opens import_service_templates()", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["baseline grant to anon", `GRANT ALL ON FUNCTION ${SIGNATURE} TO "anon";`],
    ["EXECUTE to PUBLIC, unquoted", "GRANT EXECUTE ON FUNCTION public.import_service_templates(uuid, uuid[]) TO PUBLIC;"],
    ["multiple grantees incl. anon", `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO "authenticated", "anon";`],
    ["all functions in schema public to anon", 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" TO "anon";'],
    ["drop and re-create", "DROP FUNCTION public.import_service_templates(uuid, uuid[]);"],
    [
      "redefinition without the check",
      `CREATE OR REPLACE FUNCTION ${SIGNATURE} RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN 0; END; $$;`,
    ],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["grant to authenticated only", `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO "authenticated";`],
    ["grant to service_role only", `GRANT ALL ON FUNCTION ${SIGNATURE} TO "service_role";`],
    ["anon grant on an unrelated function", 'GRANT ALL ON FUNCTION "public"."delete_workspace"("p_workspace_id" "uuid") TO "anon";'],
    ["commented-out grant", `-- GRANT ALL ON FUNCTION ${SIGNATURE} TO "anon";\nSELECT 1;`],
    ["this migration itself", sql],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(s2Regressions(text).length).toBeGreaterThan(0);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(s2Regressions(text)).toEqual([]);
  });

  it("against the real migration corpus: flags exactly the baseline's original definition and grants, and nothing else", () => {
    const hits = files.flatMap((file) => s2Regressions(read(file)).map((p) => `${file}: ${p}`));
    expect(hits).toEqual([
      `${BASELINE_FILE}: GRANT ALL ... TO "anon"`,
      `${BASELINE_FILE}: redefinition without the membership check`,
    ]);
  });

  it("REGRESSION: no migration at or after this one re-opens import_service_templates()", () => {
    for (const file of files.slice(files.indexOf(MIGRATION_FILE))) {
      expect(s2Regressions(read(file)), `${file} reopens S2`).toEqual([]);
    }
  });
});
