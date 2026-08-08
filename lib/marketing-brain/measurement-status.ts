/**
 * CAP-015 class fix: flip marketing_brain_actions.status to `measured` when
 * content_performance has metrics. Status vocabulary included `measured` but
 * no writer set it (Sense always showed measured=0).
 *
 * Kept out of measurement-loop.ts to honor ci:file-size-budget.
 */

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Flip status to `measured` once content_performance has at least one row
 * for the action.
 */
export async function markActionMeasuredIfReady(actionId: string): Promise<void> {
  const supabase = createServiceClient()
  const { count, error: cErr } = await supabase
    .from('content_performance')
    .select('id', { count: 'planned', head: true })
    .eq('action_id', actionId)
  if (cErr) {
    console.error('markActionMeasuredIfReady count:', cErr.message)
    return
  }
  if ((count ?? 0) < 1) return
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
    .select('action_id')
    .not('action_id', 'is', null)
    .limit(500)
  if (pErr) {
    console.error('reconcileExecutedWithPerformance:', pErr.message)
    return
  }
  const ids = [
    ...new Set(
      (perfRows ?? [])
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
