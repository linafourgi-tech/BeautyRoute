import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

import {
  AiUnavailableError,
  sendAssistantMessage,
  generateClientSummary,
  generateNextVisitRecommendation,
  generateAftercareInstructions,
} from "./ai";

function fakeErrorContext(payload: unknown) {
  return {
    clone: () => ({ json: async () => payload }),
  };
}

describe("AI service layer (mocked ai-assistant Edge Function boundary)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invokeMock.mockReset();
    // The whole point of this service layer is that the frontend never talks
    // to Anthropic (or anything else) directly -- assert that guarantee by
    // failing hard if fetch is ever touched from this test.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("ai.ts must never make a real network request directly -- it must go through supabase.functions.invoke");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("request payloads -- every action calls the Edge Function with the exact expected shape", () => {
    beforeEach(() => {
      invokeMock.mockResolvedValue({ data: { ok: true, text: "ok" }, error: null });
    });

    it("sendAssistantMessage sends action=chat with workspaceId, message, and history", async () => {
      await sendAssistantMessage("ws-1", "How's my week looking?", [{ role: "user", text: "hi" }]);
      expect(invokeMock).toHaveBeenCalledWith("ai-assistant", {
        body: { action: "chat", workspaceId: "ws-1", message: "How's my week looking?", history: [{ role: "user", text: "hi" }] },
      });
    });

    it("sendAssistantMessage defaults history to an empty array when omitted", async () => {
      await sendAssistantMessage("ws-1", "hi");
      expect(invokeMock).toHaveBeenCalledWith("ai-assistant", {
        body: { action: "chat", workspaceId: "ws-1", message: "hi", history: [] },
      });
    });

    it("generateClientSummary sends action=client_summary with workspaceId and clientId", async () => {
      await generateClientSummary("ws-1", "client-9");
      expect(invokeMock).toHaveBeenCalledWith("ai-assistant", {
        body: { action: "client_summary", workspaceId: "ws-1", clientId: "client-9" },
      });
    });

    it("generateNextVisitRecommendation sends action=next_visit with workspaceId and clientId", async () => {
      await generateNextVisitRecommendation("ws-1", "client-9");
      expect(invokeMock).toHaveBeenCalledWith("ai-assistant", {
        body: { action: "next_visit", workspaceId: "ws-1", clientId: "client-9" },
      });
    });

    it("generateAftercareInstructions sends action=aftercare with workspaceId and visitId", async () => {
      await generateAftercareInstructions("ws-1", "visit-4");
      expect(invokeMock).toHaveBeenCalledWith("ai-assistant", {
        body: { action: "aftercare", workspaceId: "ws-1", visitId: "visit-4" },
      });
    });
  });

  describe("success response shaping", () => {
    it("returns { text, workspaceName } from a successful response", async () => {
      invokeMock.mockResolvedValue({ data: { ok: true, text: "Here's the summary.", workspaceName: "Jane's Salon" }, error: null });
      const result = await sendAssistantMessage("ws-1", "hi");
      expect(result).toEqual({ text: "Here's the summary.", workspaceName: "Jane's Salon" });
    });
  });

  describe("error propagation", () => {
    it("throws AiUnavailableError with the code/message from a parseable error context", async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { context: fakeErrorContext({ ok: false, code: "feature_not_available", error: "AI Assistant is not available on this workspace plan." }) },
      });

      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toMatchObject({
        code: "feature_not_available",
        message: "AI Assistant is not available on this workspace plan.",
      });
      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toBeInstanceOf(AiUnavailableError);
    });

    it("throws a generic AiUnavailableError when the error has no context to parse", async () => {
      invokeMock.mockResolvedValue({ data: null, error: {} });
      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toMatchObject({
        code: "unknown",
        message: "The AI assistant is unavailable right now.",
      });
    });

    it("throws a generic AiUnavailableError when the error context's body isn't valid JSON", async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { context: { clone: () => ({ json: async () => { throw new Error("not json"); } }) } },
      });
      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toMatchObject({ code: "unknown" });
    });

    it("throws AiUnavailableError using data.code/data.error when invoke resolves without error but data.ok is false", async () => {
      invokeMock.mockResolvedValue({ data: { ok: false, code: "rate_limited", error: "Too many requests, try again shortly." }, error: null });
      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toMatchObject({
        code: "rate_limited",
        message: "Too many requests, try again shortly.",
      });
    });

    it("falls back to a generic message when data is missing entirely", async () => {
      invokeMock.mockResolvedValue({ data: null, error: null });
      await expect(sendAssistantMessage("ws-1", "hi")).rejects.toMatchObject({
        code: "unknown",
        message: "The AI assistant is unavailable right now.",
      });
    });
  });
});
