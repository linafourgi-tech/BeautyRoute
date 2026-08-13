import { describe, expect, it } from "vitest";
import { assertAllowedFields, assertValidUuid, isEmailOtpType, isSafeInternalPath, isValidHttpUrl, isValidUuid, normalizeEmail, trimIfString } from "./validation";

describe("isValidUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(isValidUuid("11111111-1111-1111-1111-111111111111")).toBe(true);
  });

  it("accepts a UUID regardless of case", () => {
    expect(isValidUuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("11111111111111111111111111111111")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
  });
});

describe("assertValidUuid", () => {
  it("does not throw for a valid UUID", () => {
    expect(() => assertValidUuid("11111111-1111-1111-1111-111111111111", "Workspace id")).not.toThrow();
  });

  it("throws a clear error for an invalid UUID", () => {
    expect(() => assertValidUuid("not-a-uuid", "Workspace id")).toThrow("Workspace id must be a valid id.");
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidHttpUrl("https://example.com/photo.jpg")).toBe(true);
    expect(isValidHttpUrl("http://example.com/photo.jpg")).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects plain text / relative paths / empty values", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("/relative/path.jpg")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("   ")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidHttpUrl(undefined)).toBe(false);
    expect(isValidHttpUrl(null)).toBe(false);
  });
});

describe("assertAllowedFields", () => {
  it("does not throw when every key is allowed", () => {
    expect(() => assertAllowedFields({ full_name: "Sara", phone: "0500000000" }, ["full_name", "phone"], "updateProfile")).not.toThrow();
  });

  it("throws when an unlisted key is present -- rejects instead of silently accepting", () => {
    expect(() => assertAllowedFields({ full_name: "Sara", role: "admin" }, ["full_name"], "updateProfile")).toThrow(
      "updateProfile: field(s) not allowed: role"
    );
  });

  it("lists every disallowed key in the error, not just the first", () => {
    expect(() => assertAllowedFields({ role: "admin", plan_tier: "Studio" }, [], "updateProfile")).toThrow(/role, plan_tier/);
  });

  it("does not throw on an empty updates object", () => {
    expect(() => assertAllowedFields({}, ["full_name"], "updateProfile")).not.toThrow();
  });
});

describe("trimIfString", () => {
  it("trims leading/trailing whitespace from a string", () => {
    expect(trimIfString("  Sara Al-Otaibi  ")).toBe("Sara Al-Otaibi");
  });

  it("leaves already-trimmed strings unchanged", () => {
    expect(trimIfString("Sara")).toBe("Sara");
  });

  it("passes through non-string values unchanged", () => {
    expect(trimIfString(null)).toBe(null);
    expect(trimIfString(undefined)).toBe(undefined);
    expect(trimIfString(42)).toBe(42);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Sara@Example.COM  ")).toBe("sara@example.com");
  });

  it("leaves an already-normalized email unchanged", () => {
    expect(normalizeEmail("sara@example.com")).toBe("sara@example.com");
  });
});

describe("isSafeInternalPath", () => {
  it("accepts a same-app relative path", () => {
    expect(isSafeInternalPath("/reset-password")).toBe(true);
    expect(isSafeInternalPath("/")).toBe(true);
    expect(isSafeInternalPath("/dashboard?tab=today")).toBe(true);
  });

  it("rejects an absolute URL to another host -- open-redirect vector", () => {
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("http://evil.com/phish")).toBe(false);
  });

  it("rejects a protocol-relative URL -- also an open-redirect vector", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
  });

  it("rejects a path that doesn't start with /", () => {
    expect(isSafeInternalPath("reset-password")).toBe(false);
  });

  it("rejects a scheme embedded anywhere in the value", () => {
    expect(isSafeInternalPath("/redirect?to=javascript://alert(1)")).toBe(false);
  });

  it("rejects empty, missing, or non-string values", () => {
    expect(isSafeInternalPath("")).toBe(false);
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath(42)).toBe(false);
  });
});

describe("isEmailOtpType", () => {
  it("accepts every value Supabase's EmailOtpType union allows", () => {
    for (const type of ["signup", "invite", "magiclink", "recovery", "email_change", "email"]) {
      expect(isEmailOtpType(type)).toBe(true);
    }
  });

  it("rejects an unrecognized or attacker-supplied type value", () => {
    expect(isEmailOtpType("sms")).toBe(false);
    expect(isEmailOtpType("phone_change")).toBe(false);
    expect(isEmailOtpType("admin")).toBe(false);
  });

  it("rejects empty, missing, or non-string values", () => {
    expect(isEmailOtpType("")).toBe(false);
    expect(isEmailOtpType(null)).toBe(false);
    expect(isEmailOtpType(undefined)).toBe(false);
  });
});
