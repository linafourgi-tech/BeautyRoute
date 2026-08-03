import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
    },
  },
}));

import { requestPasswordReset, signInUser, signUpUser } from "./auth";

describe("email normalization (service-layer, mocked Supabase boundary)", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signInWithPasswordMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    signUpMock.mockResolvedValue({ data: {}, error: null });
    signInWithPasswordMock.mockResolvedValue({ data: {}, error: null });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
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

  it("does not change an already-normalized email -- no behavior change for a well-formed request", async () => {
    await signUpUser("sara@example.com", "hunter2");
    expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({ email: "sara@example.com" }));
  });

  it("still passes the password through untouched", async () => {
    await signInUser("sara@example.com", "  not-trimmed-on-purpose  ");
    expect(signInWithPasswordMock).toHaveBeenCalledWith(expect.objectContaining({ password: "  not-trimmed-on-purpose  " }));
  });
});
