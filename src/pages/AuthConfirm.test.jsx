import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const verifyAuthOtpMock = vi.fn();
const exchangeAuthCodeMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("../services/auth", () => ({
  verifyAuthOtp: (...args) => verifyAuthOtpMock(...args),
  exchangeAuthCode: (...args) => exchangeAuthCodeMock(...args),
  getSession: () => getSessionMock(),
}));

import AuthConfirm from "./AuthConfirm";

function renderAuthConfirm(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/auth/confirm${search}`]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/reset-password" element={<div>Reset password page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forgot-password" element={<div>Forgot password page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthConfirm page", () => {
  beforeEach(() => {
    verifyAuthOtpMock.mockReset();
    exchangeAuthCodeMock.mockReset();
    getSessionMock.mockReset();
  });

  it("shows a loading state while the link is being confirmed", () => {
    verifyAuthOtpMock.mockReturnValue(new Promise(() => {}));
    renderAuthConfirm("?token_hash=abc123&type=magiclink");
    expect(screen.getByText("Confirming your link…")).toBeInTheDocument();
  });

  it("valid token_hash + type: calls verifyAuthOtp and redirects to / by default", async () => {
    verifyAuthOtpMock.mockResolvedValue({ session: {} });
    renderAuthConfirm("?token_hash=abc123&type=magiclink");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(verifyAuthOtpMock).toHaveBeenCalledWith("abc123", "magiclink");
    expect(exchangeAuthCodeMock).not.toHaveBeenCalled();
  });

  it("valid code: calls exchangeAuthCode and redirects to / by default", async () => {
    exchangeAuthCodeMock.mockResolvedValue({ session: {} });
    renderAuthConfirm("?code=pkce-code-123");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(exchangeAuthCodeMock).toHaveBeenCalledWith("pkce-code-123");
    expect(verifyAuthOtpMock).not.toHaveBeenCalled();
  });

  it("already-established session fallback: no token_hash/code in the URL, but a session already exists -- continues instead of failing", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" } });
    renderAuthConfirm("");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(verifyAuthOtpMock).not.toHaveBeenCalled();
    expect(exchangeAuthCodeMock).not.toHaveBeenCalled();
  });

  it("missing params and no existing session: shows the invalid-link state, not a crash", async () => {
    getSessionMock.mockResolvedValue(null);
    renderAuthConfirm("");

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("verifyOtp failure: shows the invalid-link state without leaking the raw Supabase error", async () => {
    verifyAuthOtpMock.mockRejectedValue(new Error("Token has expired or is invalid"));
    renderAuthConfirm("?token_hash=expired&type=recovery");

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(screen.queryByText(/Token has expired or is invalid/)).not.toBeInTheDocument();
  });

  it("exchangeCodeForSession failure: shows the invalid-link state without leaking the raw Supabase error", async () => {
    exchangeAuthCodeMock.mockRejectedValue(new Error("invalid request: code verifier mismatch"));
    renderAuthConfirm("?code=bad-code");

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(screen.queryByText(/code verifier mismatch/)).not.toBeInTheDocument();
  });

  it("safe next=/reset-password: redirects there instead of / after a successful recovery confirmation", async () => {
    verifyAuthOtpMock.mockResolvedValue({ session: {} });
    renderAuthConfirm("?token_hash=abc123&type=recovery&next=%2Freset-password");

    expect(await screen.findByText("Reset password page")).toBeInTheDocument();
  });

  it("unsafe/external next value is rejected -- falls back to / instead of an open redirect", async () => {
    verifyAuthOtpMock.mockResolvedValue({ session: {} });
    renderAuthConfirm("?token_hash=abc123&type=magiclink&next=https%3A%2F%2Fevil.com");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("protocol-relative next value is also rejected -- falls back to /", async () => {
    verifyAuthOtpMock.mockResolvedValue({ session: {} });
    renderAuthConfirm("?token_hash=abc123&type=magiclink&next=%2F%2Fevil.com");

    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("unrecognized type value is treated the same as a missing token_hash -- falls through to the session check", async () => {
    getSessionMock.mockResolvedValue(null);
    renderAuthConfirm("?token_hash=abc123&type=not-a-real-type");

    expect(await screen.findByText("This link is invalid or has expired")).toBeInTheDocument();
    expect(verifyAuthOtpMock).not.toHaveBeenCalled();
  });
});
