import { describe, expect, it } from "vitest";
import { resolveWorkspaceLang } from "./locale";

describe("resolveWorkspaceLang()", () => {
  it("returns 'ar' when the workspace's locale column is exactly 'ar'", () => {
    expect(resolveWorkspaceLang({ locale: "ar" })).toBe("ar");
  });

  it("defaults to 'en' when locale is unset, null, or any other value", () => {
    expect(resolveWorkspaceLang({ locale: "en" })).toBe("en");
    expect(resolveWorkspaceLang({ locale: null })).toBe("en");
    expect(resolveWorkspaceLang({})).toBe("en");
    expect(resolveWorkspaceLang({ locale: "fr" })).toBe("en");
  });

  it("returns 'ar' for regional Arabic tags (case-insensitive, trimmed), matching the AI Assistant's resolver", () => {
    expect(resolveWorkspaceLang({ locale: "ar-SA" })).toBe("ar");
    expect(resolveWorkspaceLang({ locale: "ar-AE" })).toBe("ar");
    expect(resolveWorkspaceLang({ locale: "AR-sa" })).toBe("ar");
    expect(resolveWorkspaceLang({ locale: " ar " })).toBe("ar");
  });

  it("keeps the English fallback for the column default, near-misses, and non-string values", () => {
    expect(resolveWorkspaceLang({ locale: "en-SA" })).toBe("en");
    expect(resolveWorkspaceLang({ locale: "arabic" })).toBe("en");
    expect(resolveWorkspaceLang({ locale: "art" })).toBe("en");
    expect(resolveWorkspaceLang({ locale: "" })).toBe("en");
    expect(resolveWorkspaceLang({ locale: 42 })).toBe("en");
  });

  it("defaults to 'en' when there is no workspace at all yet (still loading, or signed out)", () => {
    expect(resolveWorkspaceLang(null)).toBe("en");
    expect(resolveWorkspaceLang(undefined)).toBe("en");
  });
});
