import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const signInUserMock = vi.fn();
const getCurrentUserMock = vi.fn();
const getProfileMock = vi.fn();

vi.mock("../services/auth", () => ({
  signInUser: (...args) => signInUserMock(...args),
  getCurrentUser: () => getCurrentUserMock(),
}));
vi.mock("../services/profiles", () => ({
  getProfile: (id) => getProfileMock(id),
}));

import Login from "./Login";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/onboarding" element={<div>Onboarding page</div>} />
        <Route path="/signup" element={<div>Signup page</div>} />
        <Route path="/forgot-password" element={<div>Forgot password page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login page", () => {
  beforeEach(() => {
    signInUserMock.mockReset();
    getCurrentUserMock.mockReset();
    getProfileMock.mockReset();
  });

  it("renders the sign-in form", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("links to the forgot-password flow", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("link", { name: "Forgot password?" }));
    expect(await screen.findByText("Forgot password page")).toBeInTheDocument();
  });

  it("shows validation errors and does not call signInUser when submitted empty", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signInUserMock).not.toHaveBeenCalled();
  });

  it("shows the app's own validation error for a malformed email via a real click submit (not native browser validation)", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    // The form has noValidate (Phase 16 Step 3), so this real user click is
    // never intercepted by the browser's native <input type="email">
    // constraint validation -- BeautyRoute's own EMAIL_RE-based message is
    // always what appears, not whichever one the browser happened to show.
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(signInUserMock).not.toHaveBeenCalled();
  });

  it("REGRESSION: exposes the malformed-email error to assistive tech via aria-invalid and aria-describedby", async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText("Email");
    await user.type(emailInput, "not-an-email");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const errorMessage = await screen.findByText("Enter a valid email address.");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", errorMessage.id);
    // role="alert" is what makes an appearing error get announced
    // immediately, not only when a screen reader user happens to tab onto it.
    expect(errorMessage).toHaveAttribute("role", "alert");
  });

  it("signs in and navigates to /dashboard when onboarding is already completed", async () => {
    signInUserMock.mockResolvedValue({});
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ onboarding_completed: true });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(signInUserMock).toHaveBeenCalledWith("jane@example.com", "hunter2");
  });

  it("signs in and navigates to /onboarding when onboarding is not completed", async () => {
    signInUserMock.mockResolvedValue({});
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ onboarding_completed: false });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
  });

  it("shows the server error message and stays on the page when sign-in fails", async () => {
    signInUserMock.mockRejectedValue(new Error("Invalid login credentials"));

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(getCurrentUserMock).not.toHaveBeenCalled();
  });

  it("disables the submit button and shows a loading label while the request is in flight", async () => {
    let resolveSignIn;
    signInUserMock.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getProfileMock.mockResolvedValue({ onboarding_completed: true });

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const pendingButton = await screen.findByRole("button", { name: "Signing in…" });
    expect(pendingButton).toBeDisabled();

    resolveSignIn({});
    await waitFor(() => expect(screen.getByText("Dashboard page")).toBeInTheDocument());
  });
});
