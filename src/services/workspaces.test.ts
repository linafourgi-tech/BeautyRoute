import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { deleteWorkspace } from "./workspaces";

describe("deleteWorkspace (service-layer, mocked Supabase boundary)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls the delete_workspace RPC scoped to exactly the given workspace id -- workspace isolation", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await deleteWorkspace("ws-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("delete_workspace", { p_workspace_id: "ws-1" });
  });

  it("never sends any other workspace's id alongside the requested one", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await deleteWorkspace("ws-2");

    const [, params] = rpcMock.mock.calls[0];
    expect(params).toEqual({ p_workspace_id: "ws-2" });
  });

  it("REGRESSION: propagates the database's unauthorized-deletion error instead of swallowing it", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Only the workspace owner can delete this workspace"),
    });

    await expect(deleteWorkspace("ws-1")).rejects.toThrow("Only the workspace owner can delete this workspace");
  });

  it("REGRESSION: propagates a mid-transaction failure instead of reporting false success (no silent partial deletion)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("insert or update on table \"audit_logs\" violates foreign key constraint"),
    });

    await expect(deleteWorkspace("ws-1")).rejects.toThrow(/foreign key constraint/);
  });

  it("resolves with no error on a successful deletion", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(deleteWorkspace("ws-1")).resolves.toBeUndefined();
  });
});
