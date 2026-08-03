// BeautyRoute AI Assistant -- secure server-side layer.
//
// This is the ONLY place that talks to the Anthropic API. The browser never
// sees ANTHROPIC_API_KEY (it is an Edge Function secret, set via
// `supabase secrets set`, never a VITE_-prefixed var). The frontend calls
// this function through supabase.functions.invoke('ai-assistant', ...).
//
// Security model: every data query in this function runs through a Supabase
// client built from the CALLER's forwarded JWT (anon key + Authorization
// header), not the service-role key. That means the project's existing RLS
// policies (is_workspace_member()-gated) are the real access boundary --
// this function cannot read anything the signed-in user couldn't already
// read directly. workspace_id/client_id/visit_id are re-validated against
// that scoped client on every request as defense in depth; a client-supplied
// id is never trusted on its own.
//
// This function never writes business data. It only ever SELECTs.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { hasFeature } from "../_shared/planRules.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const FUNCTION_NAME = "ai-assistant";

const MODEL = "claude-opus-4-8";
const MAX_OUTPUT_TOKENS = 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 20;
const MAX_TOOL_ITERATIONS = 4;
const ANTHROPIC_TIMEOUT_MS = 25_000;
const FUNCTION_DEADLINE_MS = 45_000;
const RECENT_APPOINTMENTS_LIMIT = 15;
const RECENT_VISITS_LIMIT = 10;

// Durable, shared rate limit -- see supabase/functions/_shared/rateLimit.ts
// and supabase/migrations/20260803140000_durable_rate_limiting.sql. Same
// policy (20 requests / 10 minutes / user) as the previous per-isolate
// in-memory limiter this replaces, now enforced against a shared Postgres
// counter rather than a Map that reset on every cold isolate.
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_REQUESTS = 20;

const SYSTEM_PROMPT = `You are the BeautyRoute AI Assistant, a professional assistant for independent beauty professionals and salons using the BeautyRoute app.

Hard rules -- follow all of them:
1. Rely ONLY on the structured context and tool results you are given in this request. Never use outside knowledge about a specific client, appointment, or business.
2. Never invent facts: do not state or imply an allergy, medical condition, product, formula, previous service, or appointment that was not explicitly present in the supplied data.
3. If the supplied data is missing or insufficient to answer confidently, say so plainly instead of guessing.
4. Clearly distinguish established facts (from the data) from your own suggestions or observations. Label suggestions/observations as such.
5. You are not a medical professional. Never diagnose a skin, hair, scalp, or other health condition, and never recommend a medical treatment. Aftercare guidance must stay general and practical.
6. Never state that a recommendation or outcome is guaranteed. Use language like "may help" or "consider," not "will."
7. You cannot create, update, cancel, or delete any appointment, client, service, visit, or formula, and you cannot send messages on the professional's behalf. If asked to do one of these, say you can't perform actions -- only look up and summarize information.
8. Respond in English only.
9. Keep responses practical, concise, and professional -- this is a business tool, not a casual chatbot.
10. Do not analyze, describe, or reference any photos -- photo analysis is not available.`;

const ACTION_INSTRUCTIONS: Record<string, string> = {
  client_summary:
    "Task: summarize this client's history for the professional using the supplied context. Structure your answer under two headings: \"Known facts\" (drawn only from the provided data -- profile details, appointment/visit counts, services performed, notes on file) and \"Observations\" (patterns you notice, e.g. approximate visit cadence, explicitly labeled as your inference, not fact). Omit the Observations heading entirely if there isn't enough data to support one -- say briefly that there isn't enough history for observations instead.",
  next_visit:
    "Task: suggest what the client's next visit might involve, based only on the supplied appointment/visit/service history. Explain your reasoning in one or two sentences, citing the specific history you're basing it on. If there is not enough history to base a suggestion on (e.g. no completed visits), say so plainly instead of guessing -- do not produce a recommendation in that case. Frame the output as a suggestion, never as a certainty.",
  aftercare:
    "Task: write aftercare guidance for the client based on the specific service(s) and visit notes supplied. This is general aftercare guidance only, not medical advice -- do not diagnose any condition or recommend medical treatment. Keep it short, practical, and easy for a client to follow (a few bullet points is fine).",
  chat:
    "Task: answer the professional's question about their own workspace. You have tools to look up today's appointments, clients who haven't returned recently, inactive services, and a specific client's profile/history. Use a tool whenever the question needs current data -- do not answer from memory. If the question can't be answered with the tools available (e.g. it asks about revenue, marketing, staff pay, or anything BeautyRoute doesn't track here, or asks you to take an action), say clearly that you don't have access to that rather than guessing.",
};

type Json = Record<string, unknown>;

// CORS headers now depend on the caller's own Origin (see
// supabase/functions/_shared/cors.ts), so these take `cors` explicitly
// rather than spreading a static module-level constant. The handler below
// shadows both names with request-scoped closures over its own computed
// `cors` value, so every call site further down is unchanged.
function buildJsonResponse(body: Json, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function buildSafeError(status: number, code: string, message: string, cors: Record<string, string>) {
  return buildJsonResponse({ ok: false, code, error: message }, status, cors);
}

function log(fields: Record<string, unknown>) {
  // Operational metadata only -- never log prompt text, context payloads,
  // or model responses here.
  console.log(JSON.stringify({ scope: "ai-assistant", ...fields }));
}

// ---- Context formatting helpers -------------------------------------------------

function formatClientProfile(client: Record<string, unknown>): string {
  const allergies = (client.allergies as string[] | null) ?? [];
  return [
    "Client profile:",
    `- Name: ${client.full_name}`,
    `- Tier: ${client.tier ?? "unspecified"}`,
    `- Allergies on file: ${allergies.length ? allergies.join(", ") : "none on file"}`,
    `- Internal notes: ${client.internal_notes ? String(client.internal_notes) : "none on file"}`,
    `- Client since: ${client.created_at ? String(client.created_at).slice(0, 10) : "unknown"}`,
  ].join("\n");
}

function formatAppointmentHistory(appointments: Record<string, unknown>[]): string {
  if (appointments.length === 0) return "Appointment history: 0 records found -- no appointments on file for this client.";
  const lines = appointments.slice(0, RECENT_APPOINTMENTS_LIMIT).map((a) => {
    const services = ((a.appointment_services as Record<string, unknown>[] | undefined) ?? [])
      .map((l) => (l.services as Record<string, unknown> | null)?.name)
      .filter(Boolean)
      .join(", ") || "no services on file";
    return `- ${String(a.start_time).slice(0, 10)} · status: ${a.status} · services: ${services}${a.notes ? ` · notes: ${a.notes}` : ""}`;
  });
  return [`Appointment history (${appointments.length} total, showing up to ${RECENT_APPOINTMENTS_LIMIT} most recent):`, ...lines].join("\n");
}

function formatVisitHistory(visits: Record<string, unknown>[]): string {
  if (visits.length === 0) return "Visit history: 0 records found -- no logged visits for this client.";
  const lines = visits.slice(0, RECENT_VISITS_LIMIT).map((v) => {
    const services = ((v.appointments as Record<string, unknown> | null)?.appointment_services as Record<string, unknown>[] | undefined ?? [])
      .map((l) => (l.services as Record<string, unknown> | null)?.name)
      .filter(Boolean)
      .join(", ") || "no linked services";
    const formula = v.formula_data as Record<string, unknown> | null;
    const products = (v.products_used as string[] | null) ?? [];
    return [
      `- ${String(v.visit_date).slice(0, 10)}`,
      `  services: ${services}`,
      `  notes: ${v.summary_notes ? String(v.summary_notes) : "none on file"}`,
      `  formula: ${formula?.mix ? String(formula.mix) : "none on file"}`,
      `  prior next-visit note (written by the professional at the time): ${formula?.recommendation ? String(formula.recommendation) : "none on file"}`,
      `  products used: ${products.length ? products.join(", ") : "none on file"}`,
    ].join("\n");
  });
  return [`Visit history (${visits.length} total, showing up to ${RECENT_VISITS_LIMIT} most recent):`, ...lines].join("\n");
}

// ---- Supabase client + auth -------------------------------------------------

function buildScopedClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- Tool implementations (workspace assistant chat) -------------------------------------------------

const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_todays_appointments",
    description: "List appointments scheduled for today in this workspace. Use for questions like 'what's on the schedule today'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_clients_not_returned_since",
    description: "List clients whose last visit was more than N days ago (or who have never visited). Use for questions about clients who haven't returned recently. Pick a reasonable N (e.g. 60) if the professional didn't specify one.",
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "Number of days since last visit to consider 'not returned'.", minimum: 1, maximum: 365 } },
      required: ["days"],
      additionalProperties: false,
    },
  },
  {
    name: "get_inactive_services",
    description: "List services on the workspace's menu that are currently marked inactive.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_client",
    description: "Search for a client by (partial) name within this workspace. Returns matching clients so you can identify the right one before fetching details. Use this before get_client_details.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Full or partial client name to search for." } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_client_details",
    description: "Get a specific client's profile, appointment history, and visit history by their client ID (from find_client). Use this to summarize a client's history or describe their latest visit.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string", description: "The client's ID, from find_client results." } },
      required: ["client_id"],
      additionalProperties: false,
    },
  },
];

async function runTool(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  workspaceTimezone: string,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === "get_todays_appointments") {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: workspaceTimezone || "UTC" }).format(now); // YYYY-MM-DD
    const startOfDay = `${todayStr}T00:00:00`;
    const endOfDay = `${todayStr}T23:59:59`;
    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_time, status, clients(full_name), appointment_services(services(name))")
      .eq("workspace_id", workspaceId)
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay)
      .order("start_time", { ascending: true })
      .limit(30);
    if (error) return `Error retrieving today's appointments: ${error.message}`;
    if (!data || data.length === 0) return "No appointments scheduled today.";
    return data
      .map((a: Record<string, unknown>) => {
        const services = ((a.appointment_services as Record<string, unknown>[] | undefined) ?? [])
          .map((l) => (l.services as Record<string, unknown> | null)?.name)
          .filter(Boolean)
          .join(", ") || "no services on file";
        const clientName = (a.clients as Record<string, unknown> | null)?.full_name ?? "unknown client";
        return `${String(a.start_time).slice(11, 16)} — ${clientName} — ${services} — status: ${a.status}`;
      })
      .join("\n");
  }

  if (name === "get_clients_not_returned_since") {
    const days = Math.min(365, Math.max(1, Number(input.days) || 60));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("clients")
      .select("full_name, tier, last_visit_at")
      .eq("workspace_id", workspaceId)
      .or(`last_visit_at.is.null,last_visit_at.lt.${cutoff}`)
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(20);
    if (error) return `Error retrieving clients: ${error.message}`;
    if (!data || data.length === 0) return `No clients found who haven't returned in more than ${days} days.`;
    return data
      .map((c: Record<string, unknown>) => `${c.full_name} — tier: ${c.tier} — last visit: ${c.last_visit_at ? String(c.last_visit_at).slice(0, 10) : "never"}`)
      .join("\n");
  }

  if (name === "get_inactive_services") {
    const { data, error } = await supabase
      .from("services")
      .select("name, category, price")
      .eq("workspace_id", workspaceId)
      .eq("is_active", false)
      .order("name", { ascending: true });
    if (error) return `Error retrieving services: ${error.message}`;
    if (!data || data.length === 0) return "No inactive services -- every service on the menu is currently active.";
    return data.map((s: Record<string, unknown>) => `${s.name} (${s.category}) — SAR ${s.price} — inactive`).join("\n");
  }

  if (name === "find_client") {
    const name_ = String(input.name ?? "").trim();
    if (!name_) return "No name provided to search for.";
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, tier, last_visit_at")
      .eq("workspace_id", workspaceId)
      .ilike("full_name", `%${name_}%`)
      .limit(10);
    if (error) return `Error searching clients: ${error.message}`;
    if (!data || data.length === 0) return `No client found matching "${name_}".`;
    return data.map((c: Record<string, unknown>) => `id: ${c.id} — name: ${c.full_name} — tier: ${c.tier} — last visit: ${c.last_visit_at ? String(c.last_visit_at).slice(0, 10) : "never"}`).join("\n");
  }

  if (name === "get_client_details") {
    const clientId = String(input.client_id ?? "");
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, tier, allergies, internal_notes, created_at, workspace_id")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (clientError) return `Error retrieving client: ${clientError.message}`;
    if (!client) return "No client found with that ID in this workspace.";

    const [{ data: appointments }, { data: visits }] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_time, status, notes, appointment_services(services(name))")
        .eq("client_id", clientId)
        .order("start_time", { ascending: false })
        .limit(RECENT_APPOINTMENTS_LIMIT),
      supabase
        .from("visits")
        .select("visit_date, summary_notes, formula_data, products_used, appointments(appointment_services(services(name)))")
        .eq("client_id", clientId)
        .order("visit_date", { ascending: false })
        .limit(RECENT_VISITS_LIMIT),
    ]);

    return [
      formatClientProfile(client as Record<string, unknown>),
      "",
      formatAppointmentHistory((appointments as Record<string, unknown>[]) ?? []),
      "",
      formatVisitHistory((visits as Record<string, unknown>[]) ?? []),
    ].join("\n");
  }

  return `Unknown tool: ${name}`;
}

// ---- Main handler -------------------------------------------------

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const cors = corsHeadersFor(req.headers.get("Origin"));
  const jsonResponse = (body: Json, status: number) => buildJsonResponse(body, status, cors);
  const safeError = (status: number, code: string, message: string) => buildSafeError(status, code, message, cors);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return safeError(405, "method_not_allowed", "Only POST is supported.");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return safeError(401, "unauthenticated", "Sign in to use the AI assistant.");
  }

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return safeError(400, "invalid_body", "Request body must be valid JSON.");
  }

  const action = String(body.action ?? "");
  const workspaceId = String(body.workspaceId ?? "");
  if (!["chat", "client_summary", "next_visit", "aftercare"].includes(action)) {
    return safeError(400, "invalid_action", "Unsupported action.");
  }
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return safeError(400, "invalid_workspace", "A valid workspace is required.");
  }

  const supabase = buildScopedClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return safeError(401, "unauthenticated", "Your session has expired. Please sign in again.");
  }
  const userId = userData.user.id;

  const rateLimit = await checkRateLimit(supabase, FUNCTION_NAME, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_REQUESTS);
  if (rateLimit.failedOpen) {
    log({ requestId, userId, action, status: "rate_limit_check_failed_open" });
  }
  if (!rateLimit.allowed) {
    return safeError(429, "rate_limited", "Too many AI requests in a short time. Please wait a moment and try again.");
  }

  // Workspace access is enforced by RLS on this select -- if the caller
  // isn't an active member, this returns no row rather than the workspace.
  // plan_tier/subscription_status/trial_ends_at are read here too, straight
  // from the row the caller is RLS-permitted to see -- never from the
  // request body -- so the plan check below can't be spoofed by the browser.
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name, display_brand, timezone, plan_tier, subscription_status, trial_ends_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError || !workspace) {
    log({ requestId, userId, workspaceId, action, status: "workspace_forbidden" });
    return safeError(403, "workspace_forbidden", "You don't have access to this workspace.");
  }

  // Server-side plan gate. The frontend's FeatureGate/hasFeature() already
  // hides this UI for Starter-plan workspaces, but that's a UI convenience,
  // not an authorization boundary -- a signed-in member of a Starter-plan
  // workspace could otherwise call this function directly and get a real
  // answer. Mirrors src/services/subscription.ts's hasFeature(sub, "ai")
  // exactly (see supabase/functions/_shared/planRules.ts for why it's a
  // mirror rather than a shared import).
  if (!hasFeature(workspace as { plan_tier: string | null; subscription_status: string | null; trial_ends_at: string | null }, "ai")) {
    log({ requestId, userId, workspaceId, action, status: "feature_not_available" });
    return safeError(403, "feature_not_available", "AI Assistant is not available on this workspace plan.");
  }

  try {
    let contextText = "";
    let userTurn = "";

    if (action === "client_summary" || action === "next_visit") {
      const clientId = String(body.clientId ?? "");
      if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
        return safeError(400, "invalid_client", "A valid client is required.");
      }
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, tier, allergies, internal_notes, created_at, workspace_id")
        .eq("id", clientId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (clientError || !client) {
        log({ requestId, userId, workspaceId, action, status: "client_forbidden" });
        return safeError(403, "client_forbidden", "That client isn't in this workspace.");
      }
      const [{ data: appointments }, { data: visits }] = await Promise.all([
        supabase
          .from("appointments")
          .select("start_time, status, notes, appointment_services(services(name))")
          .eq("client_id", clientId)
          .order("start_time", { ascending: false })
          .limit(RECENT_APPOINTMENTS_LIMIT),
        supabase
          .from("visits")
          .select("visit_date, summary_notes, formula_data, products_used, appointments(appointment_services(services(name)))")
          .eq("client_id", clientId)
          .order("visit_date", { ascending: false })
          .limit(RECENT_VISITS_LIMIT),
      ]);
      contextText = [
        formatClientProfile(client as Record<string, unknown>),
        "",
        formatAppointmentHistory((appointments as Record<string, unknown>[]) ?? []),
        "",
        formatVisitHistory((visits as Record<string, unknown>[]) ?? []),
      ].join("\n");
      userTurn = `${ACTION_INSTRUCTIONS[action]}\n\n${contextText}`;
    } else if (action === "aftercare") {
      const visitId = String(body.visitId ?? "");
      if (!visitId || !/^[0-9a-f-]{36}$/i.test(visitId)) {
        return safeError(400, "invalid_visit", "A valid visit is required.");
      }
      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .select("id, visit_date, summary_notes, formula_data, products_used, workspace_id, appointments(appointment_services(services(name, category)))")
        .eq("id", visitId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (visitError || !visit) {
        log({ requestId, userId, workspaceId, action, status: "visit_forbidden" });
        return safeError(403, "visit_forbidden", "That visit isn't in this workspace.");
      }
      const services = ((visit.appointments as Record<string, unknown> | null)?.appointment_services as Record<string, unknown>[] | undefined ?? [])
        .map((l) => (l.services as Record<string, unknown> | null)?.name)
        .filter(Boolean);
      if (services.length === 0) {
        return safeError(400, "no_service", "This visit has no linked service to base aftercare guidance on.");
      }
      const formula = visit.formula_data as Record<string, unknown> | null;
      contextText = [
        `Service(s) performed: ${services.join(", ")}`,
        `Visit date: ${String(visit.visit_date).slice(0, 10)}`,
        `Visit notes: ${visit.summary_notes ? String(visit.summary_notes) : "none on file"}`,
        `Formula/technical notes: ${formula?.mix ? String(formula.mix) : "none on file"}`,
        `Products used: ${(visit.products_used as string[] | null)?.length ? (visit.products_used as string[]).join(", ") : "none on file"}`,
      ].join("\n");
      userTurn = `${ACTION_INSTRUCTIONS[action]}\n\n${contextText}`;
    } else {
      // chat
      const message = String(body.message ?? "").trim();
      if (!message) return safeError(400, "empty_message", "Enter a question first.");
      if (message.length > MAX_MESSAGE_LENGTH) {
        return safeError(400, "message_too_long", `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      }
      userTurn = message;
    }

    // Every input/ownership check above runs regardless of provider config,
    // so validation errors are always reported accurately. Only once we're
    // about to actually call the model do we check it's configured at all.
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      log({ requestId, userId, workspaceId, action, status: "provider_unconfigured" });
      return safeError(503, "provider_unconfigured", "The AI assistant isn't configured yet. Ask your workspace owner to set up the AI provider.");
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    if (action !== "chat") {
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          messages: [{ role: "user", content: userTurn }],
        },
        { timeout: ANTHROPIC_TIMEOUT_MS },
      );
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
      log({ requestId, userId, workspaceId, action, status: "ok", latencyMs: Date.now() - startedAt });
      return jsonResponse({ ok: true, text, workspaceName: workspace.display_brand ?? workspace.name }, 200);
    }

    // Chat: bounded manual tool-use loop.
    const rawHistory = Array.isArray(body.history) ? (body.history as { role: string; text: string }[]) : [];
    const trimmedHistory = rawHistory.slice(-MAX_HISTORY_TURNS).map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(h.text ?? "").slice(0, MAX_MESSAGE_LENGTH),
    }));
    const messages: Anthropic.MessageParam[] = [...trimmedHistory, { role: "user", content: `${ACTION_INSTRUCTIONS.chat}\n\nProfessional's question: ${userTurn}` }];

    let finalText = "";
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      if (Date.now() - startedAt > FUNCTION_DEADLINE_MS) {
        return safeError(504, "timeout", "The AI assistant took too long to respond. Please try again.");
      }
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          tools: CHAT_TOOLS,
          messages,
        },
        { timeout: ANTHROPIC_TIMEOUT_MS },
      );

      if (response.stop_reason !== "tool_use") {
        finalText = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result = await runTool(supabase, workspaceId, (workspace.timezone as string) ?? "UTC", toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });

      if (i === MAX_TOOL_ITERATIONS - 1) {
        finalText = "I looked into that but couldn't finish gathering the information in time. Please try asking again, or ask a more specific question.";
      }
    }

    log({ requestId, userId, workspaceId, action, status: "ok", latencyMs: Date.now() - startedAt });
    return jsonResponse({ ok: true, text: finalText, workspaceName: workspace.display_brand ?? workspace.name }, 200);
  } catch (err) {
    let category = "unknown";
    let status = 502;
    let message = "The AI assistant is temporarily unavailable. Please try again in a moment.";

    if (err instanceof Anthropic.RateLimitError) {
      category = "provider_rate_limited";
      status = 429;
      message = "The AI assistant is receiving too many requests right now. Please try again shortly.";
    } else if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      category = "provider_auth";
      status = 503;
      message = "The AI assistant isn't configured correctly. Ask your workspace owner to check the setup.";
    } else if (err instanceof Anthropic.APIConnectionError) {
      category = "provider_connection";
      status = 502;
      message = "Couldn't reach the AI provider. Please try again.";
    } else if (err instanceof Anthropic.APIStatusError) {
      category = `provider_${err.status}`;
      status = 502;
      message = "The AI assistant hit an error. Please try again.";
    } else if (err instanceof DOMException && err.name === "TimeoutError") {
      category = "timeout";
      status = 504;
      message = "The AI assistant took too long to respond. Please try again.";
    }

    log({ requestId, userId, workspaceId, action, status: "error", providerErrorCategory: category, latencyMs: Date.now() - startedAt });
    return safeError(status, category, message);
  }
});
