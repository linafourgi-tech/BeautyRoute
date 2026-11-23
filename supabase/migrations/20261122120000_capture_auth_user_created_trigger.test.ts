// Structural CI coverage for the signup-trigger parity migration, in the
// same style as the other *.test.ts files in supabase/migrations.
// The migration's behaviour (trigger absent / matching / differing) was
// verified against a local Postgres in a rehearsal where every case was
// rolled back. This file guards the migration's shape, and that no later
// migration drops, replaces or alters the trigger.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = "20261122120000_capture_auth_user_created_trigger.sql";
const EXPECTED_DEF =
  "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()";

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
const squash = (text: string) => text.replace(/\s+/g, " ").trim();
const sql = stripComments(read(MIGRATION_FILE));

describe("capture_auth_user_created_trigger migration", () => {
  it("creates exactly one trigger, with exactly the production definition", () => {
    // Single-quoted literals (the pinned c_def constant) are removed first,
    // so only real statements are counted.
    const code = squash(sql.replace(/'(?:[^']|'')*'/g, "''"));
    const creates = code.match(/CREATE TRIGGER [^;]+;/gi) ?? [];
    expect(creates).toHaveLength(1);
    expect(creates[0].replace(/;$/, "")).toBe(EXPECTED_DEF);
  });

  it("pins the same definition string it compares against", () => {
    expect(sql).toContain(`'${EXPECTED_DEF}'`);
  });

  it("never replaces, drops, renames, disables or alters a trigger", () => {
    for (const forbidden of [
      /CREATE\s+OR\s+REPLACE\s+TRIGGER/i,
      /DROP\s+TRIGGER/i,
      /ALTER\s+TRIGGER/i,
      /(ENABLE|DISABLE)\s+(ALWAYS\s+|REPLICA\s+)?TRIGGER/i,
      /DROP\s+FUNCTION/i,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION/i,
      /EVENT\s+TRIGGER/i,
      /\bEXECUTE\s+(?!FUNCTION)/i, // no dynamic SQL
    ]) {
      expect(sql).not.toMatch(forbidden);
    }
  });

  it("fails closed on an unexpected definition and on a second trigger", () => {
    expect(sql).toMatch(/exists with an unexpected definition/);
    expect(sql).toMatch(/other trigger\(s\) on auth\.users already call public\.handle_new_user\(\)/);
    expect(sql).toMatch(/post-create verification failed/);
  });

  it("no later migration drops, replaces or alters on_auth_user_created", () => {
    const later = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && f > MIGRATION_FILE);
    for (const file of later) {
      const text = squash(stripComments(read(file)));
      expect(text).not.toMatch(/(DROP|ALTER) TRIGGER (IF EXISTS )?"?on_auth_user_created"?/i);
      expect(text).not.toMatch(/CREATE OR REPLACE TRIGGER "?on_auth_user_created"?/i);
      expect(text).not.toMatch(/(DISABLE|ENABLE) (ALWAYS |REPLICA )?TRIGGER "?on_auth_user_created"?/i);
    }
  });
});
