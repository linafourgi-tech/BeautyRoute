import { supabase } from '../lib/supabase'

// Provider-independent route-planning service. The frontend never talks to
// Mapbox (or any map provider) directly for geocoding/matrix/directions --
// every call goes through the route-planner Edge Function
// (supabase/functions/route-planner), the only place holding the provider
// secret token. Swapping providers later only touches that function.

export class RouteUnavailableError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export type RouteableStop = {
  id: string
  clientName: string
  address: string
  startTimeMs: number
  durationMinutes: number
  status: string
  lat: number
  lng: number
}

export type MissingAddressStop = { id: string; clientName: string; startTimeMs: number; status: string }
export type UnresolvedStop = { id: string; clientName: string; address: string; startTimeMs: number; status: string }
export type RouteConflict = { appointmentId: string; lateByMinutes: number; message: string }
export type RouteEndpoint = { location: string; lat: number; lng: number } | null

export type RouteMatrix = { durations: number[][]; distances: number[][] } | null

export type RouteLeg = {
  order: string[]
  geometry: unknown
  totalDistanceMeters: number
  totalDurationSeconds: number
  conflicts: RouteConflict[]
} | null

export type PlanRouteResult = {
  workspaceName: string
  routeable: RouteableStop[]
  missingAddress: MissingAddressStop[]
  unresolved: UnresolvedStop[]
  start: RouteEndpoint
  startUnresolved: boolean
  end: RouteEndpoint
  endUnresolved: boolean
  matrix: RouteMatrix
  chronological: RouteLeg
}

export type RerouteResult = {
  order: string[]
  geometry: unknown
  totalDistanceMeters: number
  totalDurationSeconds: number
  conflicts: RouteConflict[]
}

async function callRoutePlanner<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('route-planner', { body })

  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new RouteUnavailableError(parsed.code || 'unknown', parsed.error || 'The route planner is unavailable right now.')
      } catch (parseErr) {
        if (parseErr instanceof RouteUnavailableError) throw parseErr
      }
    }
    throw new RouteUnavailableError('unknown', 'The route planner is unavailable right now.')
  }

  if (!data?.ok) {
    throw new RouteUnavailableError(data?.code || 'unknown', data?.error || 'The route planner is unavailable right now.')
  }

  return data as T
}

// 1. Load a date's routeable appointments, geocode them, and get the
// chronological-order route (initial display).
export async function planRoute(workspaceId: string, date: string, startLocation?: string, endLocation?: string) {
  return callRoutePlanner<PlanRouteResult>({ action: 'plan', workspaceId, date, startLocation, endLocation })
}

// 2. Get the authoritative distance/time + map geometry + feasibility
// warnings for a specific stop order (after Optimize or manual reorder).
export async function rerouteRoute(workspaceId: string, date: string, order: string[], startLocation?: string, endLocation?: string) {
  return callRoutePlanner<RerouteResult>({ action: 'reroute', workspaceId, date, order, startLocation, endLocation })
}
