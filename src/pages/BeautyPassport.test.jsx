import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const useSessionMock = vi.fn();
const useWorkspaceContextMock = vi.fn();
const useCurrentWorkspaceMock = vi.fn();
const useSubscriptionMock = vi.fn();
const getClientsMock = vi.fn();
const getAppointmentsByClientMock = vi.fn();
const getClientVisitHistoryMock = vi.fn();
const createVisitLogMock = vi.fn();
const updateVisitLogMock = vi.fn();
const getFilesForEntityMock = vi.fn();
const createFileMock = vi.fn();
const generateClientSummaryMock = vi.fn();
const generateNextVisitRecommendationMock = vi.fn();
const generateAftercareInstructionsMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../contexts/useWorkspaceContext", () => ({ useWorkspaceContext: () => useWorkspaceContextMock() }));
vi.mock("../hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => useCurrentWorkspaceMock() }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => useSubscriptionMock() }));
vi.mock("../services/clients", () => ({ getClients: (...a) => getClientsMock(...a) }));
vi.mock("../services/appointments", () => ({ getAppointmentsByClient: (...a) => getAppointmentsByClientMock(...a) }));
vi.mock("../services/visits", () => ({
  getClientVisitHistory: (...a) => getClientVisitHistoryMock(...a),
  createVisitLog: (...a) => createVisitLogMock(...a),
  updateVisitLog: (...a) => updateVisitLogMock(...a),
}));
vi.mock("../services/files", () => ({
  getFilesForEntity: (...a) => getFilesForEntityMock(...a),
  createFile: (...a) => createFileMock(...a),
}));
// This is the boundary under test for "AI actions use src/services/ai.ts
// only" -- mocking the whole module and asserting these specific exports
// are called (never supabase.functions.invoke or fetch) proves the
// component only ever goes through this service layer.
vi.mock("../services/ai", async () => {
  const actual = await vi.importActual("../services/ai");
  return {
    ...actual,
    generateClientSummary: (...a) => generateClientSummaryMock(...a),
    generateNextVisitRecommendation: (...a) => generateNextVisitRecommendationMock(...a),
    generateAftercareInstructions: (...a) => generateAftercareInstructionsMock(...a),
  };
});

import BeautyPassport from "./BeautyPassport";

const CLIENTS = [
  { id: "c1", full_name: "Amira Al-Fahad", phone: "+966500000001", email: "amira@example.com", tier: "Gold", allergies: [], internal_notes: "", created_at: "2026-01-01T00:00:00.000Z", last_visit_at: null },
];

// Design migration (full-product-design-migration): the visit-log form now
// uses the shared Input/Select components, which give every field a real
// <label htmlFor> association -- getByLabelText works directly. Still
// scoped to the visit-log <form> specifically: the passport cover's
// "Notes" InfoCard (client.internal_notes) uses the word "Notes" too, and
// is always rendered behind the form while it's open.
function fieldInput(labelText) {
  const form = document.querySelector("form");
  return within(form).getByLabelText(labelText);
}

function renderPassport(initialEntry = "/passport?client=c1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BeautyPassport />
    </MemoryRouter>
  );
}

describe("BeautyPassport page", () => {
  let fetchSpy;

  beforeEach(() => {
    useSessionMock.mockReset();
    useWorkspaceContextMock.mockReset();
    useCurrentWorkspaceMock.mockReset();
    useSubscriptionMock.mockReset();
    getClientsMock.mockReset();
    getAppointmentsByClientMock.mockReset();
    getClientVisitHistoryMock.mockReset();
    createVisitLogMock.mockReset();
    updateVisitLogMock.mockReset();
    getFilesForEntityMock.mockReset();
    createFileMock.mockReset();
    generateClientSummaryMock.mockReset();
    generateNextVisitRecommendationMock.mockReset();
    generateAftercareInstructionsMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "u1" }, profile: { full_name: "Sara" }, loading: false });
    useWorkspaceContextMock.mockReturnValue({ workspaces: [], workspace: null, workspaceId: "ws-1", selectWorkspace: vi.fn(), loading: false, error: null });
    useCurrentWorkspaceMock.mockReturnValue({ workspaceId: "ws-1", loading: false });
    useSubscriptionMock.mockReturnValue({ subscription: { plan_tier: "Pro", subscription_status: "active" } });
    getClientsMock.mockResolvedValue(CLIENTS);
    getAppointmentsByClientMock.mockResolvedValue([]);
    getClientVisitHistoryMock.mockResolvedValue([]);
    getFilesForEntityMock.mockResolvedValue([]);

    // Guards every test against an accidental direct network call from any
    // untested code path (e.g. a component reaching for fetch/Anthropic/
    // Mapbox directly instead of the mocked service layer above).
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("BeautyPassport must never make a real network request -- only mocked service functions");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("selects the client from the URL and renders their passport", async () => {
    renderPassport();
    expect(await screen.findByRole("heading", { name: "Amira Al-Fahad" })).toBeInTheDocument();
    // Client also appears in the sidebar client-list entry -- two matches is
    // expected, not a bug (see the heading-scoped query above).
    expect(screen.getAllByText("Amira Al-Fahad")).toHaveLength(2);
  });

  it("renders the visit timeline once visits load, with services/duration/notes", async () => {
    getClientVisitHistoryMock.mockResolvedValue([
      {
        id: "v1",
        visit_date: "2026-07-20",
        summary_notes: "Loves a warm gloss.",
        products_used: ["Olaplex No.3"],
        formula_data: { mix: "7.3 + 20vol", recommendation: "Gloss refresh in 6 weeks" },
        staff_id: "u1",
        appointments: { id: "a1", start_time: "2026-07-20T10:00:00.000Z", end_time: "2026-07-20T10:45:00.000Z", appointment_services: [{ services: { name: "Haircut" } }] },
      },
    ]);
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    expect(await screen.findByText(/20 July 2026/)).toBeInTheDocument();
    await user.click(screen.getByText(/20 July 2026/));

    expect(await screen.findByText("Loves a warm gloss.")).toBeInTheDocument();
    expect(screen.getByText("7.3 + 20vol")).toBeInTheDocument();
    expect(screen.getByText("Gloss refresh in 6 weeks")).toBeInTheDocument();
    expect(screen.getByText("Olaplex No.3")).toBeInTheDocument();
    // Duration renders inline as part of the collapsed summary line (e.g.
    // "Haircut · 45 min"), not as its own isolated text node -- restrict the
    // custom matcher to leaf elements so it doesn't also match every
    // ancestor whose concatenated textContent happens to include it too.
    expect(screen.getByText((_, node) => node?.children.length === 0 && Boolean(node.textContent?.includes("45 min")))).toBeInTheDocument();
  });

  it("shows a placeholder when there are no visits logged yet", async () => {
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });
    expect(await screen.findByText("No visits logged yet — log the first one above.")).toBeInTheDocument();
  });

  it("logs a new visit via the Log a visit form", async () => {
    createVisitLogMock.mockResolvedValue({ id: "v-new" });
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Log a visit/ }));
    await user.type(fieldInput(/Notes/), "First visit, great chat.");
    await user.click(screen.getByRole("button", { name: "Log visit" }));

    await waitFor(() => expect(createVisitLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: "ws-1", client_id: "c1", staff_id: "u1", summary_notes: "First visit, great chat." })
    ));
  });

  it("requires a visit date before saving a visit log", async () => {
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Log a visit/ }));
    await user.clear(fieldInput(/Visit date/));
    await user.click(screen.getByRole("button", { name: "Log visit" }));

    expect(await screen.findByText("Pick a visit date.")).toBeInTheDocument();
    expect(createVisitLogMock).not.toHaveBeenCalled();
  });

  it("attaches before/after photo URLs as separate file records when provided", async () => {
    // Two long URLs typed character-by-character push this past the default
    // 5s timeout under coverage instrumentation overhead -- not a logic
    // issue, just slower per-keystroke re-renders while instrumented.
    createVisitLogMock.mockResolvedValue({ id: "v-new" });
    createFileMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Log a visit/ }));
    await user.type(fieldInput(/Before photo URL/), "https://example.com/before.jpg");
    await user.type(fieldInput(/After photo URL/), "https://example.com/after.jpg");
    await user.click(screen.getByRole("button", { name: "Log visit" }));

    await waitFor(() => expect(createFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_url: "https://example.com/before.jpg", file_purpose: "before", entity_id: "v-new" })
    ));
    expect(createFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_url: "https://example.com/after.jpg", file_purpose: "after", entity_id: "v-new" })
    );
  }, 15000);

  it("does not attach any file record when no photo URL is provided (missing optional data handled gracefully)", async () => {
    createVisitLogMock.mockResolvedValue({ id: "v-new" });
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Log a visit/ }));
    await user.click(screen.getByRole("button", { name: "Log visit" }));

    await waitFor(() => expect(createVisitLogMock).toHaveBeenCalled());
    expect(createFileMock).not.toHaveBeenCalled();
  });

  it("shows the AI summary/next-visit buttons only when the plan includes the ai feature", async () => {
    useSubscriptionMock.mockReturnValue({ subscription: { plan_tier: "Starter", subscription_status: "active" } });
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });
    expect(screen.queryByRole("button", { name: /Generate summary/ })).not.toBeInTheDocument();
  });

  it("generates an AI client summary via services/ai.ts, showing loading then the result", async () => {
    let resolveSummary;
    generateClientSummaryMock.mockReturnValue(new Promise((resolve) => { resolveSummary = resolve; }));
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Generate summary/ }));
    expect(await screen.findByText("Generating…")).toBeInTheDocument();

    resolveSummary({ text: "Amira prefers warm tones and gloss treatments." });
    expect(await screen.findByText("Amira prefers warm tones and gloss treatments.")).toBeInTheDocument();
    expect(generateClientSummaryMock).toHaveBeenCalledWith("ws-1", "c1");
  });

  it("shows an AI error state distinctly from a successful result", async () => {
    generateNextVisitRecommendationMock.mockRejectedValue(new Error("Something went wrong. Please try again."));
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(screen.getByRole("button", { name: /Suggest next visit/ }));
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  it("never calls fetch/Anthropic/Mapbox directly -- every AI action goes through the mocked services/ai.ts boundary", async () => {
    generateClientSummaryMock.mockResolvedValue({ text: "ok" });
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });
    await user.click(screen.getByRole("button", { name: /Generate summary/ }));
    await screen.findByText("ok");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("REGRESSION (Phase 13 Step 4): before/after photos still render at the same src, with the new width/height/loading attributes added for CLS/lazy-load", async () => {
    getClientVisitHistoryMock.mockResolvedValue([
      { id: "v1", visit_date: "2026-01-15", summary_notes: "Great cut", formula_data: {}, products_used: [], appointments: null },
    ]);
    getFilesForEntityMock.mockResolvedValue([
      { id: "f1", file_purpose: "before", file_url: "https://example.com/before.jpg" },
      { id: "f2", file_purpose: "after", file_url: "https://example.com/after.jpg" },
    ]);
    const user = userEvent.setup();
    renderPassport();
    await screen.findByRole("heading", { name: "Amira Al-Fahad" });

    await user.click(await screen.findByText("15 January 2026"));

    const beforeImg = await screen.findByAltText("Before");
    const afterImg = await screen.findByAltText("After");

    // Unchanged: same URLs, same visual size (CSS class untouched).
    expect(beforeImg).toHaveAttribute("src", "https://example.com/before.jpg");
    expect(afterImg).toHaveAttribute("src", "https://example.com/after.jpg");
    expect(beforeImg.className).toContain("h-24 w-24");

    // New: explicit dimensions (matching the CSS size exactly, so layout is
    // unaffected) and lazy loading.
    expect(beforeImg).toHaveAttribute("width", "96");
    expect(beforeImg).toHaveAttribute("height", "96");
    expect(beforeImg).toHaveAttribute("loading", "lazy");
    expect(afterImg).toHaveAttribute("width", "96");
    expect(afterImg).toHaveAttribute("height", "96");
    expect(afterImg).toHaveAttribute("loading", "lazy");
  });
});
