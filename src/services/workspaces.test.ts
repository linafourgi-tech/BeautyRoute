import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { deleteWorkspace, getWorkspaceById, updateWorkspace, updateWorkspaceSettings } from "./workspaces";

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_WORKSPACE_ID = "22222222-2222-2222-2222-222222222222";

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

describe("deleteWorkspace (service-layer, mocked Supabase boundary)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls the delete_workspace RPC scoped to exactly the given workspace id -- workspace isolation", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await deleteWorkspace(WORKSPACE_ID);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("delete_workspace", { p_workspace_id: WORKSPACE_ID });
  });

  it("never sends any other workspace's id alongside the requested one", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await deleteWorkspace(OTHER_WORKSPACE_ID);

    const [, params] = rpcMock.mock.calls[0];
    expect(params).toEqual({ p_workspace_id: OTHER_WORKSPACE_ID });
  });

  it("REGRESSION: propagates the database's unauthorized-deletion error instead of swallowing it", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Only the workspace owner can delete this workspace"),
    });

    await expect(deleteWorkspace(WORKSPACE_ID)).rejects.toThrow("Only the workspace owner can delete this workspace");
  });

  it("REGRESSION: propagates a mid-transaction failure instead of reporting false success (no silent partial deletion)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("insert or update on table \"audit_logs\" violates foreign key constraint"),
    });

    await expect(deleteWorkspace(WORKSPACE_ID)).rejects.toThrow(/foreign key constraint/);
  });

  it("resolves with no error on a successful deletion", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(deleteWorkspace(WORKSPACE_ID)).resolves.toBeUndefined();
  });

  it("REGRESSION: rejects a non-UUID workspace id before ever calling the RPC", async () => {
    await expect(deleteWorkspace("not-a-uuid")).rejects.toThrow("Workspace id must be a valid id.");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("getWorkspaceById", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: rejects a non-UUID id before querying", async () => {
    await expect(getWorkspaceById("not-a-uuid")).rejects.toThrow("Workspace id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("queries by a valid id", async () => {
    const chain = buildSelectChain({ data: { id: WORKSPACE_ID }, error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getWorkspaceById(WORKSPACE_ID);
    expect(chain.eq).toHaveBeenCalledWith("id", WORKSPACE_ID);
  });
});

describe("updateWorkspace", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: rejects a non-UUID id before updating", async () => {
    await expect(updateWorkspace("not-a-uuid", { name: "Salon" })).rejects.toThrow("Workspace id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updates allowed business-detail fields", async () => {
    const chain = buildUpdateChain({ data: { id: WORKSPACE_ID }, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    await updateWorkspace(WORKSPACE_ID, { name: "New Salon Name", city: "Jeddah" });
    expect(chain.update).toHaveBeenCalledWith({ name: "New Salon Name", city: "Jeddah" });
  });

  it("REGRESSION: rejects plan_tier -- billing/plan fields can never be set through this generic update", async () => {
    await expect(updateWorkspace(WORKSPACE_ID, { plan_tier: "Studio" } as never)).rejects.toThrow(
      "updateWorkspace: field(s) not allowed: plan_tier"
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("REGRESSION: rejects subscription_status and owner_id -- identity/billing fields can never be set through this generic update", async () => {
    await expect(
      updateWorkspace(WORKSPACE_ID, { subscription_status: "active", owner_id: OTHER_WORKSPACE_ID } as never)
    ).rejects.toThrow(/subscription_status/);
  });
});

describe("updateWorkspaceSettings", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: rejects a non-UUID workspace id before updating", async () => {
    await expect(updateWorkspaceSettings("not-a-uuid", { business_hours: {} })).rejects.toThrow(
      "Workspace id must be a valid id."
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("updates business_hours -- the exact field the real Onboarding caller passes -- unchanged from before this hardening", async () => {
    const chain = buildUpdateChain({ data: {}, error: null });
    fromMock.mockReturnValue({ update: chain.update });

    const businessHours = { days: ["mon", "tue"], start: "09:00", end: "17:00" };
    await updateWorkspaceSettings(WORKSPACE_ID, { business_hours: businessHours });
    expect(chain.update).toHaveBeenCalledWith({ business_hours: businessHours });
  });

  it("REGRESSION: rejects an unknown settings field instead of silently forwarding it", async () => {
    await expect(updateWorkspaceSettings(WORKSPACE_ID, { workspace_id: OTHER_WORKSPACE_ID })).rejects.toThrow(
      "updateWorkspaceSettings: field(s) not allowed: workspace_id"
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
