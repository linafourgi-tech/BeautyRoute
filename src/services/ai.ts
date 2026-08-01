import { supabase } from '../lib/supabase'

// Provider-independent AI service. The frontend never talks to an AI
// provider directly -- every call goes through the ai-assistant Edge
// Function (supabase/functions/ai-assistant), which is the only place that
// holds the provider API key. Swapping providers later only touches that
// function; nothing here or in any caller needs to change.

export type AiChatMessage = { role: 'user' | 'assistant'; text: string }

export class AiUnavailableError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function callAssistant(body: Record<string, unknown>): Promise<{ text: string; workspaceName?: string }> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body })

  // supabase.functions.invoke() surfaces non-2xx responses as `error`
  // without giving us the parsed JSON body -- re-fetch the structured
  // { ok, code, error } payload so the UI can distinguish "not configured"
  // from "try again" from "you don't have access".
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new AiUnavailableError(parsed.code || 'unknown', parsed.error || 'The AI assistant is unavailable right now.')
      } catch (parseErr) {
        if (parseErr instanceof AiUnavailableError) throw parseErr
      }
    }
    throw new AiUnavailableError('unknown', 'The AI assistant is unavailable right now.')
  }

  if (!data?.ok) {
    throw new AiUnavailableError(data?.code || 'unknown', data?.error || 'The AI assistant is unavailable right now.')
  }

  return { text: data.text as string, workspaceName: data.workspaceName as string | undefined }
}

// 1. Workspace assistant chat -- answers questions from workspace data only.
export async function sendAssistantMessage(workspaceId: string, message: string, history: AiChatMessage[] = []) {
  return callAssistant({ action: 'chat', workspaceId, message, history })
}

// 2. Client history summary -- known facts vs. observations.
export async function generateClientSummary(workspaceId: string, clientId: string) {
  return callAssistant({ action: 'client_summary', workspaceId, clientId })
}

// 3. Next-visit recommendation grounded in real history.
export async function generateNextVisitRecommendation(workspaceId: string, clientId: string) {
  return callAssistant({ action: 'next_visit', workspaceId, clientId })
}

// 4. Aftercare instructions for a specific completed visit's service(s).
export async function generateAftercareInstructions(workspaceId: string, visitId: string) {
  return callAssistant({ action: 'aftercare', workspaceId, visitId })
}
