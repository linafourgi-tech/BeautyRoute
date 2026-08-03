import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const updatePasswordMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("../services/auth", () => ({
  updatePassword: (...args) => updatePasswordMock(...args),
  onAuthStateChange: (...args) => onAuthStateChangeMock(...args),
  getSession: () => getSessionMock(),
}));

import ResetPassword from "./ResetPassword";

function renderResetPassword() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forgot-password" element={<div>Forgot password page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResetPassword page", () => {
  beforeEach(() => {
    window.location.hash = "";
    updatePasswordMock.mockReset();
    onAuthStateChangeMock.mockReset();
    getSessionMock.mockReset();
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
    // Default: no session found, no PASSWORD_RECOVERY event fired -- the
    // "direct visit / no recovery in progress" case, covered explicitly below.
    getSessionMock.mockResolvedValue(null);
  });

  it("shows a loading state while the reset link is being checked", () => {
    renderResetPassword();
    expect(screen.getByText("Checking your reset link…")).toBeInTheDocument();
  });

  it("shows an invalid-link message when the URL carries a recovery error (expired/invalid link)", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    renderResetPassword();

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("REGRESSION: treats a direct visit with no recovery session and no error as an invalid link", async () => {
    renderResetPassword();
    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
  });

  it("shows the new-password form once PASSWORD_RECOVERY fires", async () => {
    let capturedCallback;
    onAuthStateChangeMock.mockImplementation((cb) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    renderResetPassword();
    expect(screen.getByText("Checking your reset link…")).toBeInTheDocument();

    act(() => {
      capturedCallback("PASSWORD_RECOVERY");
    });

    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("shows the new-password form via the getSession fallback (event already fired before the listener attached)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    renderResetPassword();
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });

  it("validates password length and confirmation match before calling updatePassword", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const user = userEvent.setup();
    renderResetPassword();
    await screen.findByLabelText("New password");

    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Password is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("New password"), "abc");
    await user.type(screen.getByLabelText("Confirm password"), "xyz");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("At least 6 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("updates the password and shows a success state that can navigate to sign in", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    updatePasswordMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderResetPassword();
    await screen.findByLabelText("New password");
    await user.type(screen.getByLabelText("New password"), "newpass1");
    await user.type(screen.getByLabelText("Confirm password"), "newpass1");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(updatePasswordMock).toHaveBeenCalledWith("newpass1");

    await user.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("shows a server error message when updatePassword fails (e.g. a session that expired mid-flow)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    updatePasswordMock.mockRejectedValue(new Error("Auth session missing."));
    const user = userEvent.setup();
    renderResetPassword();
    await screen.findByLabelText("New password");
    await user.type(screen.getByLabelText("New password"), "newpass1");
    await user.type(screen.getByLabelText("Confirm password"), "newpass1");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Auth session missing.")).toBeInTheDocument();
  });
});
