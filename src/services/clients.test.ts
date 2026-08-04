import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getClients } from "./clients";

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, order };
}

// Every field each real current consumer reads off a client row -- see
// Clients.jsx (list + edit form), StylistDashboard.jsx (toClientViewModel),
// BeautyPassport.jsx (header/detail fields), and Appointments.jsx's client
// picker (id, full_name only). Kept in sync manually with the Phase 13
// Step 4 audit; a missing field here would mean a real page can no longer
// render something it used to.
const REQUIRED_CLIENT_FIELDS = [
  "id",
  "workspace_id",
  "full_name",
  "phone",
  "email",
  "tier",
  "allergies",
  "internal_notes",
  "last_visit_at",
  "created_at",
];

describe("getClients (Phase 13 Step 4: narrowed select)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: requests every column current consumers actually read -- narrowing never dropped a field a real page needs", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getClients("ws-1");

    expect(chain.select).toHaveBeenCalledTimes(1);
    const [selectArg] = chain.select.mock.calls[0];
    const requestedColumns = String(selectArg)
      .split(",")
      .map((c) => c.trim());
    for (const field of REQUIRED_CLIENT_FIELDS) {
      expect(requestedColumns, `missing required field: ${field}`).toContain(field);
    }
  });

  it("REGRESSION: no longer requests select('*') -- the whole point of this narrowing", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getClients("ws-1");
    const [selectArg] = chain.select.mock.calls[0];
    expect(selectArg).not.toBe("*");
  });

  it("still scopes by workspace_id and orders by full_name -- unchanged query behavior", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getClients("ws-1");
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(chain.order).toHaveBeenCalledWith("full_name", { ascending: true });
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildSelectChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getClients("ws-1")).rejects.toThrow("connection lost");
  });
});
