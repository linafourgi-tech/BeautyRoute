import { describe, expect, it } from "vitest";
import { t, isRTL, dirFor, intlLocale, translateEnum } from "./i18n";

describe("t()", () => {
  it("returns the English string for an unrecognized/undefined language", () => {
    expect(t("action.cancel", undefined)).toBe("Cancel");
    expect(t("action.cancel", "fr")).toBe("Cancel");
  });

  it("returns the Arabic string when lang is 'ar'", () => {
    expect(t("action.cancel", "ar")).toBe("إلغاء");
  });

  it("returns the raw key, not a crash, for a key that doesn't exist in the dictionary", () => {
    expect(t("this.key.does.not.exist", "en")).toBe("this.key.does.not.exist");
  });

  it("interpolates {placeholder} vars in a plain string entry", () => {
    expect(t("dashboard.lastVisit", "en", { date: "2026-01-01" })).toBe("Last visit 2026-01-01");
  });

  it("resolves a function-valued entry with the vars object, for both languages", () => {
    expect(t("trial.daysLeft", "en", { days: 1 })).toBe("Your free trial ends in 1 day.");
    expect(t("trial.daysLeft", "en", { days: 5 })).toBe("Your free trial ends in 5 days.");
    expect(t("trial.daysLeft", "ar", { days: 1 })).toContain("يوم");
  });

  it("does not throw when a function-valued entry is called with no vars", () => {
    expect(() => t("dashboard.greeting", "en")).not.toThrow();
    expect(t("dashboard.greeting", "en")).toBe("Good to see you");
  });
});

describe("isRTL() / dirFor()", () => {
  it("only treats 'ar' as RTL -- every other value, including undefined, is LTR", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("en")).toBe(false);
    expect(isRTL(undefined)).toBe(false);
    expect(isRTL("fr")).toBe(false);
  });

  it("maps lang to the matching dir attribute value", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
    expect(dirFor(undefined)).toBe("ltr");
  });
});

describe("intlLocale()", () => {
  it("maps 'ar' to ar-SA and everything else to en-GB", () => {
    expect(intlLocale("ar")).toBe("ar-SA");
    expect(intlLocale("en")).toBe("en-GB");
    expect(intlLocale(undefined)).toBe("en-GB");
  });
});

describe("translateEnum()", () => {
  it("translates a known status/category/tier value for display", () => {
    expect(translateEnum("status", "confirmed", "en")).toBe("confirmed");
    expect(translateEnum("status", "confirmed", "ar")).toBe("مؤكد");
    expect(translateEnum("tier", "Gold", "ar")).toBe("ذهبي");
  });

  it("falls back to the raw stored value for an unrecognized value, instead of hiding it", () => {
    expect(translateEnum("status", "some-future-status", "ar")).toBe("some-future-status");
  });

  it("passes through falsy values unchanged (null/undefined/empty string)", () => {
    expect(translateEnum("tier", null, "ar")).toBe(null);
    expect(translateEnum("tier", undefined, "ar")).toBe(undefined);
    expect(translateEnum("tier", "", "ar")).toBe("");
  });
});
