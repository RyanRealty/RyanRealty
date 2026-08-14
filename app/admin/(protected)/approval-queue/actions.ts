'use server'

/**
 * Approval-queue stamp. Same fields as POST .../action approve_now:
 * status=approved, approved_at=now, approved_by=session email.
 * Does not publish. The ≤7-day freshness rule is checked at publish time.
 */
import { logAdminAction } from '@/app/actions/log-admin-action'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { approveAction } from '@/lib/data/agent/actions'

export async function approveNowAction(actionId: string): Promise<{ error: string | null }> {
  const auth = await checkAdminAction('approvals.act')
  if (!auth.ok) return { error: auth.error }
  const id = actionId.trim()
  if (!id) return { error: 'A draft is required.' }
  try {
    const result = await approveAction(id, { approvedBy: auth.ctx.email })
    if (!result.ok) return { error: result.error }
    const logged = await logAdminAction({
      adminEmail: auth.ctx.email,
      role: auth.ctx.role,
      actionType: 'approval_queue_approve',
      resourceType: 'marketing_brain_action',
      resourceId: id,
      details: { verb: 'approve_now' },
    })
    if (!logged.ok) {
      console.error('[approveNowAction]', logged.error)
    }
    return { error: null }
  } catch (err) {
    console.error('[approveNowAction]', err)
    return { error: 'Could not approve the draft.' }
  }
}
