import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const signUpUserMock = vi.fn();
vi.mock("../services/auth", () => ({
  signUpUser: (...args) => signUpUserMock(...args),
}));

import Signup from "./Signup";

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<div>Onboarding page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillValidForm(user) {
  await user.type(screen.getByLabelText("Full name"), "Sara Al-Otaibi");
  await user.type(screen.getByLabelText("Email"), "sara@example.com");
  await user.type(screen.getByLabelText("Password"), "hunter2!");
}

describe("Signup page", () => {
  beforeEach(() => {
    signUpUserMock.mockReset();
  });

  it("renders the sign-up form", () => {
    renderSignup();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("shows validation errors and does not call signUpUser when submitted empty", async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signUpUserMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than the minimum length", async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByLabelText("Full name"), "Sara Al-Otaibi");
    await user.type(screen.getByLabelText("Email"), "sara@example.com");
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("At least 6 characters.")).toBeInTheDocument();
    expect(signUpUserMock).not.toHaveBeenCalled();
  });

  it("submits the full_name metadata and navigates to /onboarding when a session is issued immediately", async () => {
    signUpUserMock.mockResolvedValue({ session: { access_token: "t" }, user: { id: "u1" } });

    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
    expect(signUpUserMock).toHaveBeenCalledWith("sara@example.com", "hunter2!", { full_name: "Sara Al-Otaibi" });
  });

  it("shows an 'already exists' error for Supabase's anti-enumeration response (no session, empty identities)", async () => {
    signUpUserMock.mockResolvedValue({ session: null, user: { id: "u1", identities: [] } });

    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account with this email already exists. Try signing in instead.")).toBeInTheDocument();
  });

  it("shows an email-confirmation notice when a new account requires confirmation", async () => {
    signUpUserMock.mockResolvedValue({ session: null, user: { id: "u1", identities: [{ id: "identity-1" }] } });

    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Account created — check your email to confirm before signing in.")).toBeInTheDocument();
  });

  it("shows the server error message when sign-up throws", async () => {
    signUpUserMock.mockRejectedValue(new Error("Password is too weak."));

    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Password is too weak.")).toBeInTheDocument();
  });
});
