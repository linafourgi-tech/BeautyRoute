import { supabase } from '../lib/supabase'
import { buildMonthlySeries } from '../lib/monthSeries'

export type ExpenseMonthPoint = {
  monthKey: string
  label: string
  total: number
}

const EXPENSE_SERIES_MONTHS = 6

// Get a rolling N-month expense series (default 6, ending at referenceDate's
// month, inclusive) -- powers the Business Engine's revenue-vs-expenses
// chart, replacing the `expenses` half of the static `revenueByMonth` mock
// array it used to import from data/mockData.js. The `expenses` table
// itself already existed in the schema with RLS enabled (expenses_access,
// is_workspace_member()) but had no service-layer function reading it yet
// -- this is the first one, following the same one-table-per-file
// convention as every other services/*.ts module.
//
// incurred_at is a plain `date` column (not timestamptz, unlike revenues'
// processed_at), so the window bounds below are passed as YYYY-MM-DD
// strings rather than full ISO timestamps.
export async function getExpensesSeries(
  workspaceId: string,
  months: number = EXPENSE_SERIES_MONTHS,
  referenceDate: Date = new Date()
): Promise<ExpenseMonthPoint[]> {
  const endYear = referenceDate.getUTCFullYear()
  const endMonth = referenceDate.getUTCMonth()
  const windowStart = dateOnly(new Date(Date.UTC(endYear, endMonth - months + 1, 1)))
  const windowEnd = dateOnly(new Date(Date.UTC(endYear, endMonth + 1, 1)))

  const { data, error } = await supabase
    .from('expenses')
    .select('amount, incurred_at')
    .eq('workspace_id', workspaceId)
    .gte('incurred_at', windowStart)
    .lt('incurred_at', windowEnd)

  if (error) throw error

  return buildMonthlySeries(data ?? [], {
    dateField: 'incurred_at',
    valueField: 'amount',
    months,
    referenceDate,
  })
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}
