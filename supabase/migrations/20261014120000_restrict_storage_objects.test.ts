import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Structural regression coverage for the S3 Phase 1 fix (no always-true
// client policies on storage.objects). The real behavior -- authenticated
// and anon denied every operation on every bucket, service_role unchanged
// -- is proven against a real local Postgres by
// supabase/tests/storage_objects_access.sql (`npm run test:rls:local`),
// which isn't wired into CI. What this file guarantees in CI is the
// migration's exact shape, and that no later migration re-creates (or
// alters into) an always-true storage.objects policy for a client role, or
// disables row level security on storage.objects.
//
// Known limitation (documented, not hidden): the four original policies were
// created outside the migrations, and a text scan cannot see policies made
// in the dashboard / SQL editor or computed at runtime. The post-deploy
// check scripts/verify-storage-objects-policies.sql reads the live policies
// and is the backstop for both.
const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261014120000_restrict_storage_objects.sql";
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const sql = read(MIGRATION_FILE);

// PUBLIC is the pseudo-role every role inherits from; a policy with no TO
// clause applies to PUBLIC.
const CLIENT_ROLES = new Set(["authenticated", "anon", "public"]);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
}

function statements(text: string): string[] {
  return stripComments(text)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unquote(identifier: string): string {
  return identifier.trim().replace(/"/g, "").toLowerCase();
}

// storage.objects, quoted or not; an unqualified `objects` is treated as
// storage.objects too (no other schema in this project has that table).
const OBJECTS_TABLE = String.raw`(?:"?storage"?\s*\.\s*)?"?objects"?`;

// An expression that is always true: true, (true), TRUE, 'true'::boolean,
// true::bool, 1 = 1.
function alwaysTrue(expression: string): boolean {
  const e = expression.replace(/[\s()]/g, "").toLowerCase();
  return ["true", "'true'::boolean", "'true'::bool", "true::boolean", "true::bool", "1=1"].includes(e);
}

// The parenthesized expression following `keyword` in a policy clause.
function clauseExpression(clause: string, keyword: RegExp): string | null {
  const m = keyword.exec(clause);
  if (!m) return null;
  let depth = 0;
  const start = m.index + m[0].length;
  for (let i = start; i < clause.length; i++) {
    if (clause[i] === "(") depth++;
    if (clause[i] === ")" && --depth === 0) return clause.slice(start, i + 1);
  }
  return clause.slice(start);
}

function clientRoles(clause: string, defaultPublic: boolean): boolean {
  const to = /\bTO\s+(.+?)(?=\bUSING\b|\bWITH\s+CHECK\b|$)/i.exec(clause);
  if (!to) return defaultPublic;
  return to[1].split(",").map(unquote).some((role) => CLIENT_ROLES.has(role));
}

// Every always-true client policy on storage.objects created or altered in
// the text, plus any statement disabling row level security on it.
function alwaysTrueClientPolicies(text: string): string[] {
  const problems: string[] = [];
  for (const statement of statements(text)) {
    const create = new RegExp(String.raw`^CREATE\s+POLICY\s+("[^"]+"|\S+)\s+ON\s+${OBJECTS_TABLE}\b(.*)$`, "i").exec(statement);
    const alter = new RegExp(String.raw`^ALTER\s+POLICY\s+("[^"]+"|\S+)\s+ON\s+${OBJECTS_TABLE}\b(.*)$`, "i").exec(statement);
    const match = create ?? alter;
    if (match) {
      const clause = match[2];
      const using = clauseExpression(clause, /\bUSING\s*/i);
      const check = clauseExpression(clause, /\bWITH\s+CHECK\s*/i);
      // CREATE POLICY without TO applies to PUBLIC; ALTER POLICY without TO keeps its roles (treated as client, conservatively).
      if (clientRoles(clause, true) && ((using !== null && alwaysTrue(using)) || (check !== null && alwaysTrue(check)))) {
        problems.push(`${create ? "CREATE" : "ALTER"} POLICY ${unquote(match[1])}`);
      }
    }
    if (new RegExp(String.raw`^ALTER\s+TABLE\s+(?:ONLY\s+)?${OBJECTS_TABLE}\s+(?:DISABLE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY`, "i").test(statement)) {
      problems.push("storage.objects row level security disabled");
    }
  }
  return problems;
}

describe("20261014120000_restrict_storage_objects.sql (structural regression coverage)", () => {
  it("contains exactly the four reviewed DROP POLICY statements and nothing else", () => {
    expect(statements(sql)).toEqual([
      'DROP POLICY IF EXISTS "Authenticated users can view files" ON "storage"."objects"',
      'DROP POLICY IF EXISTS "Authenticated users can upload files" ON "storage"."objects"',
      'DROP POLICY IF EXISTS "Authenticated users can update files" ON "storage"."objects"',
      'DROP POLICY IF EXISTS "Authenticated users can delete files" ON "storage"."objects"',
    ]);
  });

  it("changes nothing else -- no CREATE/ALTER, GRANT/REVOKE, bucket, or row-level-security statements", () => {
    for (const statement of statements(sql)) {
      // Policy names are quoted identifiers ("...can update files"); only the keywords outside them matter.
      expect(statement.replace(/"[^"]*"/g, '""')).not.toMatch(/\bCREATE\b|\bALTER\b|\bGRANT\b|\bREVOKE\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bbuckets\b|ROW LEVEL SECURITY/i);
    }
  });
});

describe("migration-order guard: no migration re-creates an always-true client policy on storage.objects", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("this migration is present in the ordered migration list", () => {
    expect(files).toContain(MIGRATION_FILE);
  });

  const MUST_FLAG: Array<[string, string]> = [
    ["original SELECT policy", 'CREATE POLICY "Authenticated users can view files" ON storage.objects FOR SELECT TO authenticated USING (true);'],
    ["original INSERT policy", 'CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);'],
    ["original UPDATE policy", 'CREATE POLICY "Authenticated users can update files" ON storage.objects FOR UPDATE TO authenticated USING (true);'],
    ["original DELETE policy", 'CREATE POLICY "Authenticated users can delete files" ON storage.objects FOR DELETE TO authenticated USING (true);'],
    ["quoted table, anon, multi-line", 'create policy "x"\n  on "storage"."objects"\n  for all to "anon"\n  using ( true );'],
    ["no TO clause (applies to PUBLIC)", "CREATE POLICY p ON storage.objects FOR SELECT USING (TRUE);"],
    ["TO public among other roles", "CREATE POLICY p ON storage.objects FOR INSERT TO service_role, public WITH CHECK ('true'::boolean);"],
    ["scoped USING but always-true WITH CHECK", "CREATE POLICY p ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (true);"],
    ["1 = 1", "CREATE POLICY p ON storage.objects FOR DELETE TO authenticated USING (1 = 1);"],
    ["ALTER POLICY back to true", "ALTER POLICY p ON storage.objects USING (true);"],
    ["disable row level security", "ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;"],
  ];

  const MUST_NOT_FLAG: Array<[string, string]> = [
    ["this migration itself", sql],
    ["service_role-only always-true policy", "CREATE POLICY p ON storage.objects FOR ALL TO service_role USING (true);"],
    ["scoped client policy", "CREATE POLICY p ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text);"],
    ["always-true policy on another table", 'CREATE POLICY "service_templates_read" ON "public"."service_templates" FOR SELECT USING (true);'],
    ["always-true policy on storage.buckets", "CREATE POLICY p ON storage.buckets FOR SELECT TO authenticated USING (true);"],
    ["commented-out policy", "-- CREATE POLICY p ON storage.objects FOR SELECT TO authenticated USING (true);\nSELECT 1;"],
    ["enable row level security", "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;"],
  ];

  it.each(MUST_FLAG)("flags: %s", (_label, text) => {
    expect(alwaysTrueClientPolicies(text).length).toBeGreaterThan(0);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (_label, text) => {
    expect(alwaysTrueClientPolicies(text)).toEqual([]);
  });

  it("REGRESSION: no migration in the corpus creates or alters an always-true client policy on storage.objects", () => {
    for (const file of files) {
      expect(alwaysTrueClientPolicies(read(file)), `${file} reopens S3 (always-true client policy on storage.objects)`).toEqual([]);
    }
  });
});
