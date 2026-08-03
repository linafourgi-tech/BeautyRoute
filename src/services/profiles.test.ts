import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getProfile, updateProfile } from "./profiles";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

function buildUpdateChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq, select, single };
}

describe("getProfile", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: rejects a non-UUID id before ever querying Supabase", async () => {
    await expect(getProfile("not-a-uuid")).rejects.toThrow("Profile id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("queries by a valid id", async () => {
    const chain = buildSelectChain({ data: { id: VALID_ID, full_name: "Sara" }, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    const result = await getProfile(VALID_ID);
    expect(chain.eq).toHaveBeenCalledWith("id", VALID_ID);
    expect(result).toEqual({ id: VALID_ID, full_name: "Sara" });
  });
});

describe("updateProfile", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: rejects a non-UUID id before ever touching Supabase", async () => {
    await expect(updateProfile("not-a-uuid", { full_name: "Sara" })).rejects.toThrow("Profile id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updates full_name and phone -- the exact fields the real Onboarding caller passes -- unchanged from before this hardening", async () => {
    const chain = buildUpdateChain({ data: { id: VALID_ID, full_name: "Sara", phone: "0500000000" }, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    const result = await updateProfile(VALID_ID, { full_name: "Sara", phone: "0500000000" });
    expect(chain.update).toHaveBeenCalledWith({ full_name: "Sara", phone: "0500000000" });
    expect(result).toEqual({ id: VALID_ID, full_name: "Sara", phone: "0500000000" });
  });

  it("trims full_name and phone before sending them", async () => {
    const chain = buildUpdateChain({ data: {}, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    await updateProfile(VALID_ID, { full_name: "  Sara Al-Otaibi  ", phone: "  0500000000  " });
    expect(chain.update).toHaveBeenCalledWith({ full_name: "Sara Al-Otaibi", phone: "0500000000" });
  });

  it("accepts a valid http(s) avatar_url", async () => {
    const chain = buildUpdateChain({ data: {}, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    await updateProfile(VALID_ID, { avatar_url: "https://example.com/avatar.jpg" });
    expect(chain.update).toHaveBeenCalledWith({ avatar_url: "https://example.com/avatar.jpg" });
  });

  it("REGRESSION: rejects a non-URL avatar_url instead of silently persisting it", async () => {
    await expect(updateProfile(VALID_ID, { avatar_url: "javascript:alert(1)" })).rejects.toThrow(
      "avatar_url must be a valid http(s) URL."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows explicitly clearing avatar_url to null", async () => {
    const chain = buildUpdateChain({ data: {}, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    await updateProfile(VALID_ID, { avatar_url: null });
    expect(chain.update).toHaveBeenCalledWith({ avatar_url: null });
  });

  it("REGRESSION: rejects an unknown field (e.g. role) instead of silently forwarding it -- no mass-assignment", async () => {
    await expect(updateProfile(VALID_ID, { full_name: "Sara", role: "admin" })).rejects.toThrow(
      "updateProfile: field(s) not allowed: role"
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
