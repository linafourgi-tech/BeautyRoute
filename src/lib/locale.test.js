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

  it("defaults to 'en' when there is no workspace at all yet (still loading, or signed out)", () => {
    expect(resolveWorkspaceLang(null)).toBe("en");
    expect(resolveWorkspaceLang(undefined)).toBe("en");
  });
});
