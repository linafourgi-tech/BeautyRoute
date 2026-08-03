import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const requestPasswordResetMock = vi.fn();
vi.mock("../services/auth", () => ({
  requestPasswordReset: (...args) => requestPasswordResetMock(...args),
}));

import ForgotPassword from "./ForgotPassword";

function renderForgotPassword() {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ForgotPassword page", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it("renders the request form", () => {
    renderForgotPassword();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
  });

  it("shows a validation error and does not call requestPasswordReset when submitted empty", async () => {
    const user = userEvent.setup();
    renderForgotPassword();
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    renderForgotPassword();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("shows a generic confirmation after requesting a reset for a registered email", async () => {
    requestPasswordResetMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForgotPassword();
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(
      screen.getByText("If an account exists for that email, we've sent a link to reset your password.")
    ).toBeInTheDocument();
    expect(requestPasswordResetMock).toHaveBeenCalledWith("existing@example.com");
  });

  it("REGRESSION: shows the identical confirmation for an email with no account on file -- never reveals existence", async () => {
    requestPasswordResetMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForgotPassword();
    await user.type(screen.getByLabelText("Email"), "never-registered@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(
      screen.getByText("If an account exists for that email, we've sent a link to reset your password.")
    ).toBeInTheDocument();
  });

  it("shows a server error message when the reset request itself fails", async () => {
    requestPasswordResetMock.mockRejectedValue(new Error("Too many requests. Try again later."));
    const user = userEvent.setup();
    renderForgotPassword();
    await user.type(screen.getByLabelText("Email"), "sara@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Too many requests. Try again later.")).toBeInTheDocument();
  });

  it("links back to sign in", async () => {
    const user = userEvent.setup();
    renderForgotPassword();
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });
});
