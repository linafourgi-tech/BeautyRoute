import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const useCurrentWorkspaceMock = vi.fn();
vi.mock("./useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));

import { useAppLang } from "./useAppLang";

describe("useAppLang", () => {
  beforeEach(() => {
    useCurrentWorkspaceMock.mockReset();
  });

  it("returns { lang: 'en', dir: 'ltr' } when the workspace has no locale set (default)", () => {
    useCurrentWorkspaceMock.mockReturnValue({ workspace: { id: "ws-1" } });
    const { result } = renderHook(() => useAppLang());
    expect(result.current).toEqual({ lang: "en", dir: "ltr" });
  });

  it("returns { lang: 'ar', dir: 'rtl' } when the workspace's locale is 'ar'", () => {
    useCurrentWorkspaceMock.mockReturnValue({ workspace: { id: "ws-1", locale: "ar" } });
    const { result } = renderHook(() => useAppLang());
    expect(result.current).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("defaults safely to English when there is no workspace yet (still loading, or signed out)", () => {
    useCurrentWorkspaceMock.mockReturnValue({ workspace: null });
    const { result } = renderHook(() => useAppLang());
    expect(result.current).toEqual({ lang: "en", dir: "ltr" });
  });

  it("makes no fetch of its own -- it only reads the already-shared workspace value from useCurrentWorkspace()", () => {
    useCurrentWorkspaceMock.mockReturnValue({ workspace: { id: "ws-1" } });
    renderHook(() => useAppLang());
    expect(useCurrentWorkspaceMock).toHaveBeenCalledTimes(1);
  });
});
