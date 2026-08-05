import { supabase } from '../lib/supabase'
import { buildMonthlySeries } from '../lib/monthSeries'

export type MonthlyRevenueSummary = {
  totalNet: number
  currency: 'SAR'
  periodStart: string
  periodEnd: string
}

export type RevenueMonthPoint = {
  monthKey: string
  label: string
  total: number
}

const REVENUE_SERIES_MONTHS = 6

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

// 2. Get a rolling N-month revenue series (default 6, ending at
// referenceDate's month, inclusive) -- powers the Business Engine's
// revenue-vs-expenses chart, replacing the static `revenueByMonth` mock
// array it used to import from data/mockData.js. One bounded query across
// the whole window (not one round-trip per month), grouped client-side by
// processed_at's UTC year-month via the shared lib/monthSeries.js bucketer
// -- mirrors the bounded-window query pattern already used by
// getAppointments()/getTodaysAppointments() (Phase 13 Step 3).
export async function getRevenueSeries(
  workspaceId: string,
  months: number = REVENUE_SERIES_MONTHS,
  referenceDate: Date = new Date()
): Promise<RevenueMonthPoint[]> {
  const endYear = referenceDate.getUTCFullYear()
  const endMonth = referenceDate.getUTCMonth()
  const windowStart = new Date(Date.UTC(endYear, endMonth - months + 1, 1)).toISOString()
  const windowEnd = new Date(Date.UTC(endYear, endMonth + 1, 1)).toISOString()

  const { data, error } = await supabase
    .from('revenues')
    .select('net_total, processed_at')
    .eq('workspace_id', workspaceId)
    .gte('processed_at', windowStart)
    .lt('processed_at', windowEnd)

  if (error) throw error

  return buildMonthlySeries(data ?? [], {
    dateField: 'processed_at',
    valueField: 'net_total',
    months,
    referenceDate,
  })
}
