import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const verifyOtpMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
    },
  },
}));

import { exchangeAuthCode, requestPasswordReset, signInUser, signUpUser, verifyAuthOtp } from "./auth";

describe("email normalization (service-layer, mocked Supabase boundary)", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signInWithPasswordMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    verifyOtpMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    signUpMock.mockResolvedValue({ data: {}, error: null });
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: null });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    verifyOtpMock.mockResolvedValue({ data: {}, error: null });
    exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: null });
  });

  it("signUpUser trims and lowercases the email before calling Supabase", async () => {
    await signUpUser("  Sara@Example.COM  ", "hunter2");
    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({ email: "sara@example.com" }));
  });

  it("signInUser trims and lowercases the email before calling Supabase", async () => {
    await signInUser("  Sara@Example.COM  ", "hunter2");
    expect(signInWithPasswordMock).toHaveBeenCalledWith(expect.objectContaining({ email: "sara@example.com" }));
  });

  it("requestPasswordReset trims and lowercases the email before calling Supabase", async () => {
    await requestPasswordReset("  Sara@Example.COM  ");
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("sara@example.com", expect.any(Object));
  });

  it("requestPasswordReset routes the recovery link through the shared /auth/confirm callback, not directly to /reset-password", async () => {
    await requestPasswordReset("sara@example.com");
    const [, options] = resetPasswordForEmailMock.mock.calls[0];
    expect(options.redirectTo).toContain("/auth/confirm?next=");
    expect(options.redirectTo).toContain(encodeURIComponent("/reset-password"));
  });

  it("does not change an already-normalized email -- no behavior change for a well-formed request", async () => {
    await signUpUser("sara@example.com", "hunter2");
    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({ email: "sara@example.com" }));
  });

  it("still passes the password through untouched", async () => {
    await signInUser("sara@example.com", "  not-trimmed-on-purpose  ");
    expect(signInWithPasswordMock).toHaveBeenCalledWith(expect.objectContaining({ password: "  not-trimmed-on-purpose  " }));
  });
});

describe("verifyAuthOtp / exchangeAuthCode (mocked Supabase boundary)", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
  });

  it("verifyAuthOtp calls supabase.auth.verifyOtp with token_hash + type and returns its data", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const result = await verifyAuthOtp("hash123", "magiclink");
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash123", type: "magiclink" });
    expect(result).toEqual({ session: { access_token: "t" } });
  });

  it("verifyAuthOtp throws the Supabase error instead of swallowing it", async () => {
    verifyOtpMock.mockResolvedValue({ data: null, error: new Error("Token has expired or is invalid") });
    await expect(verifyAuthOtp("hash123", "recovery")).rejects.toThrow("Token has expired or is invalid");
  });

  it("exchangeAuthCode calls supabase.auth.exchangeCodeForSession with the code and returns its data", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const result = await exchangeAuthCode("code123");
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("code123");
    expect(result).toEqual({ session: { access_token: "t" } });
  });

  it("exchangeAuthCode throws the Supabase error instead of swallowing it", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: null, error: new Error("invalid request: both auth code and code verifier should be non-empty") });
    await expect(exchangeAuthCode("bad-code")).rejects.toThrow("invalid request");
  });
});
