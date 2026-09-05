/**
 * CAP-015 class fix: flip marketing_brain_actions.status to `measured` when
 * content_performance has metrics. Status vocabulary included `measured` but
 * no writer set it (Sense always showed measured=0).
 *
 * Kept out of measurement-loop.ts to honor ci:file-size-budget.
 */

import { createServiceClient } from '@/lib/supabase/service'

/** A sweep seed row (posted_at only) is not a measurement. */
export function contentPerformanceHasMetrics(row: {
  metrics_48h?: unknown
  metrics_7d?: unknown
  metrics_30d?: unknown
}): boolean {
  return row.metrics_48h != null || row.metrics_7d != null || row.metrics_30d != null
}

/**
 * Flip status to `measured` once content_performance has real window metrics.
 */
export async function markActionMeasuredIfReady(actionId: string): Promise<void> {
  const supabase = createServiceClient()
  const { data, error: cErr } = await supabase
    .from('content_performance')
    .select('metrics_48h,metrics_7d,metrics_30d')
    .eq('action_id', actionId)
    .limit(20)
  if (cErr) {
    console.error('markActionMeasuredIfReady count:', cErr.message)
    return
  }
  if (!(data ?? []).some((row) => contentPerformanceHasMetrics(row))) return
  const { error } = await supabase
    .from('marketing_brain_actions')
    .update({ status: 'measured' })
    .eq('id', actionId)
    .eq('status', 'executed')
  if (error) {
    console.error('markActionMeasuredIfReady update:', error.message)
  }
}

/** Historical reconcile: executed actions with content_performance → measured. */
export async function reconcileExecutedWithPerformance(): Promise<void> {
  const supabase = createServiceClient()
  const { data: perfRows, error: pErr } = await supabase
    .from('content_performance')
    .select('action_id,metrics_48h,metrics_7d,metrics_30d')
    .not('action_id', 'is', null)
    .limit(500)
  if (pErr) {
    console.error('reconcileExecutedWithPerformance:', pErr.message)
    return
  }
  const ids = [
    ...new Set(
      (perfRows ?? [])
        .filter((r) => contentPerformanceHasMetrics(r))
        .map((r: { action_id: string }) => r.action_id)
        .filter(Boolean),
    ),
  ]
  if (ids.length === 0) return
  const { error } = await supabase
    .from('marketing_brain_actions')
    .update({ status: 'measured' })
    .in('id', ids)
    .eq('status', 'executed')
  if (error) {
    console.error('reconcileExecutedWithPerformance update:', error.message)
  }
}
