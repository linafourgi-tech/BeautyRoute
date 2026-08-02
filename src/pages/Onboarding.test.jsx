import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const useSessionMock = vi.fn();
const updateProfileMock = vi.fn();
const bootstrapWorkspaceMock = vi.fn();
const updateWorkspaceSettingsMock = vi.fn();
const getServiceTemplatesMock = vi.fn();
const getServicesMock = vi.fn();
const importServiceTemplatesMock = vi.fn();
const updateServiceMock = vi.fn();

vi.mock("../hooks/useSession", () => ({ useSession: () => useSessionMock() }));
vi.mock("../services/profiles", () => ({ updateProfile: (...args) => updateProfileMock(...args) }));
vi.mock("../services/workspaces", () => ({
  bootstrapWorkspace: (...args) => bootstrapWorkspaceMock(...args),
  updateWorkspaceSettings: (...args) => updateWorkspaceSettingsMock(...args),
}));
vi.mock("../services/services", () => ({
  getServices: (...args) => getServicesMock(...args),
  importServiceTemplates: (...args) => importServiceTemplatesMock(...args),
  updateService: (...args) => updateServiceMock(...args),
}));
vi.mock("../services/serviceTemplates", () => ({
  getServiceTemplates: () => getServiceTemplatesMock(),
}));

import Onboarding from "./Onboarding";

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillBusinessStep(user) {
  await user.type(screen.getByLabelText("Full name"), "Sara Al-Otaibi");
  await user.type(screen.getByLabelText("Business name"), "Sara's Beauty Studio");
  await user.type(screen.getByLabelText("City"), "Riyadh");
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function walkToReadyStep(user) {
  await user.click(screen.getByRole("button", { name: "Get started" }));
  await fillBusinessStep(user);
  await screen.findByText("Set up your services");
  await user.click(screen.getByRole("button", { name: "Continue" })); // skip services
  await screen.findByText("When are you available?");
  await user.click(screen.getByRole("button", { name: "Continue" })); // accept default availability
  await screen.findByText("You're all set");
}

describe("Onboarding page (step progression + final submission)", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
    updateProfileMock.mockReset();
    bootstrapWorkspaceMock.mockReset();
    updateWorkspaceSettingsMock.mockReset();
    getServiceTemplatesMock.mockReset();
    getServicesMock.mockReset();
    importServiceTemplatesMock.mockReset();
    updateServiceMock.mockReset();

    useSessionMock.mockReturnValue({ user: { id: "user-1" }, profile: null, loading: false });
    getServiceTemplatesMock.mockResolvedValue([]);
  });

  it("renders nothing while the session is still resolving", () => {
    useSessionMock.mockReturnValue({ user: null, profile: null, loading: true });
    const { container } = renderOnboarding();
    expect(container).toBeEmptyDOMElement();
  });

  it("starts at the Welcome step", () => {
    renderOnboarding();
    expect(screen.getByText("Welcome to BeautyRoute")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument(); // OnboardingProgress label
  });

  it("progresses through Welcome -> Business -> Services -> Availability -> Ready as each step completes", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(await screen.findByText("Tell us about your business")).toBeInTheDocument();

    await fillBusinessStep(user);
    expect(await screen.findByText("Set up your services")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("When are you available?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("You're all set")).toBeInTheDocument();
  });

  it("prefills full name and phone from an existing profile", async () => {
    useSessionMock.mockReturnValue({
      user: { id: "user-1" },
      profile: { full_name: "Sara Al-Otaibi", phone: "+966500000000" },
      loading: false,
    });
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Get started" }));

    expect(await screen.findByDisplayValue("Sara Al-Otaibi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+966500000000")).toBeInTheDocument();
  });

  it("on Finish: bootstraps the workspace, updates the profile, sets availability, and navigates to /dashboard (services skipped when none were selected)", async () => {
    bootstrapWorkspaceMock.mockResolvedValue("ws-new-1");
    updateProfileMock.mockResolvedValue({});
    updateWorkspaceSettingsMock.mockResolvedValue({});

    const user = userEvent.setup();
    renderOnboarding();
    await walkToReadyStep(user);

    await user.click(screen.getByRole("button", { name: "Go to my dashboard" }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(bootstrapWorkspaceMock).toHaveBeenCalledWith("Sara's Beauty Studio", "freelancer", "Riyadh");
    expect(updateProfileMock).toHaveBeenCalledWith("user-1", { full_name: "Sara Al-Otaibi", phone: null });
    expect(importServiceTemplatesMock).not.toHaveBeenCalled();
    expect(updateWorkspaceSettingsMock).toHaveBeenCalledWith("ws-new-1", {
      business_hours: { days: ["mon", "tue", "wed", "thu", "fri"], start: "09:00", end: "18:00" },
    });
  });

  it("shows the error and re-enables Finish when bootstrapping the workspace fails, without navigating away", async () => {
    bootstrapWorkspaceMock.mockRejectedValue(new Error("Could not create your workspace right now."));

    const user = userEvent.setup();
    renderOnboarding();
    await walkToReadyStep(user);

    await user.click(screen.getByRole("button", { name: "Go to my dashboard" }));

    expect(await screen.findByText("Could not create your workspace right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to my dashboard" })).not.toBeDisabled();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});
