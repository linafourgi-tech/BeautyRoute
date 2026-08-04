import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { getServiceTemplates } from "./serviceTemplates";

function buildSelectChain(result: { data: unknown; error: unknown }) {
  const order2 = vi.fn().mockResolvedValue(result);
  const order1 = vi.fn(() => ({ order: order2 }));
  const select = vi.fn(() => ({ order: order1 }));
  return { select, order1, order2 };
}

// Every field both real current consumers read off a service_templates row
// -- onboarding/steps/ServicesStep.jsx and Services.jsx's "Import
// templates" flow. display_order is used only as an ORDER BY key, which
// doesn't require it to be in the SELECT list.
const REQUIRED_TEMPLATE_FIELDS = ["id", "name", "category", "default_duration", "default_price"];

describe("getServiceTemplates (Phase 13 Step 4: narrowed select)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("REGRESSION: requests every column current consumers actually read", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getServiceTemplates();

    const [selectArg] = chain.select.mock.calls[0];
    const requestedColumns = String(selectArg)
      .split(",")
      .map((c) => c.trim());
    for (const field of REQUIRED_TEMPLATE_FIELDS) {
      expect(requestedColumns, `missing required field: ${field}`).toContain(field);
    }
  });

  it("REGRESSION: no longer requests select('*')", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getServiceTemplates();
    const [selectArg] = chain.select.mock.calls[0];
    expect(selectArg).not.toBe("*");
  });

  it("still orders by category then display_order -- unchanged query behavior", async () => {
    const chain = buildSelectChain({ data: [], error: null });
    fromMock.mockReturnValue({ select: chain.select });

    await getServiceTemplates();
    expect(chain.order1).toHaveBeenCalledWith("category");
    expect(chain.order2).toHaveBeenCalledWith("display_order");
  });

  it("propagates a Supabase error instead of swallowing it", async () => {
    const chain = buildSelectChain({ data: null, error: new Error("connection lost") });
    fromMock.mockReturnValue({ select: chain.select });

    await expect(getServiceTemplates()).rejects.toThrow("connection lost");
  });
});
