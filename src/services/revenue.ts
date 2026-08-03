import { supabase } from '../lib/supabase'

export type MonthlyRevenueSummary = {
  totalNet: number
  currency: 'SAR'
  periodStart: string
  periodEnd: string
}

// 1. Sum this workspace's recorded revenue for the calendar month containing
// `referenceDate` (defaults to now). Workspace-scoped via an explicit
// .eq('workspace_id', ...) -- RLS (revenues_access, is_workspace_member())
// enforces this as the real access boundary regardless.
//
// Revenue rows are only ever created against a completed, invoiced visit
// (revenues.visit_id -> visits.id) -- there is no separate cancelled/void
// flag to filter here, because a cancelled appointment never produces a
// visit, and therefore never produces a revenue row, in the first place.
// net_total is a generated column (gross + tip - discount + tax), so this
// sums the actual amount the professional was paid, not just gross price.
export async function getMonthlyRevenue(workspaceId: string, referenceDate: Date = new Date()): Promise<MonthlyRevenueSummary> {
  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()
  const periodStart = new Date(Date.UTC(year, month, 1)).toISOString()
  const periodEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString()

  const { data, error } = await supabase
    .from('revenues')
    .select('net_total')
    .eq('workspace_id', workspaceId)
    .gte('processed_at', periodStart)
    .lt('processed_at', periodEnd)

  if (error) throw error

  const totalNet = (data ?? []).reduce((sum, row) => sum + (Number(row.net_total) || 0), 0)
  return { totalNet, currency: 'SAR', periodStart, periodEnd }
}
