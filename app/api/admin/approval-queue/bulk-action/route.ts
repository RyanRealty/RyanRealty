import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminRoute } from '@/lib/admin/require-admin'

/**
 * POST /api/admin/approval-queue/bulk-action  (W10.4)
 *
 * Bulk approve or bulk reject the marketing-brain approval queue. The single-row
 * verbs live at /api/admin/approval-queue/[id]/action; this batches the two that
 * make sense to run across a selection — approve_now and reject.
 *
 * Guard: requireAdminRoute('approvals.act') — the SAME superuser publish gate the
 * single route enforces. Bulk approve for public auto-publish is the exact HIGH-
 * audit risk the single route calls out, so the guard is non-negotiable here.
 * ci:bulk-approval-wired (scripts/check-bulk-approval-wired.mjs) fails if this
 * call is ever dropped or downgraded.
 *
 * Status scope: every mutation is `.in('status', ['ready','needs_changes'])`, so a
 * stale client that submits an id already approved/killed/pending cannot re-flip
 * it. `affected` reports how many rows actually changed (may be < ids.length).
 */

const MAX_BULK = 100 // matches the page's .limit(100) fetch
const MUTABLE_STATUSES = ['ready', 'needs_changes'] as const

type BulkBody =
  | { action: 'approve_now'; ids: string[] }
  | { action: 'reject'; ids: string[]; killed_reason: string }

function parseIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const ids = raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  if (ids.length === 0) return null
  if (ids.length > MAX_BULK) return null
  // de-dupe
  return [...new Set(ids)]
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdminRoute('approvals.act')
    if (ctx instanceof Response) return ctx
    const user = { email: ctx.email }

    const body = (await request.json().catch(() => null)) as BulkBody | null
    if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

    const ids = parseIds((body as { ids?: unknown }).ids)
    if (!ids) {
      return NextResponse.json(
        { error: `ids must be a non-empty array of at most ${MAX_BULK} row ids` },
        { status: 400 },
      )
    }

    const service = createServiceClient()

    switch (body.action) {
      case 'approve_now': {
        const { data, error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: user.email,
          })
          .in('id', ids)
          .in('status', MUTABLE_STATUSES)
          .select('id')
        if (error) throw error
        void import('@/app/actions/log-admin-action')
          .then(({ logAdminAction }) =>
            logAdminAction({
              adminEmail: user.email,
              role: ctx.role,
              actionType: 'approval_queue_bulk_approve',
              resourceType: 'marketing_brain_action',
              resourceId: ids[0] ?? null,
              details: { affected: (data ?? []).length, ids },
            }),
          )
          .catch(() => {})
        return NextResponse.json({ ok: true, status: 'approved', affected: (data ?? []).length })
      }

      case 'reject': {
        if (!body.killed_reason?.trim()) {
          return NextResponse.json({ error: 'killed_reason is required' }, { status: 400 })
        }
        const { data, error } = await service
          .from('marketing_brain_actions')
          .update({
            status: 'killed',
            killed_reason: body.killed_reason.trim(),
          })
          .in('id', ids)
          .in('status', MUTABLE_STATUSES)
          .select('id')
        if (error) throw error
        void import('@/app/actions/log-admin-action')
          .then(({ logAdminAction }) =>
            logAdminAction({
              adminEmail: user.email,
              role: ctx.role,
              actionType: 'approval_queue_bulk_reject',
              resourceType: 'marketing_brain_action',
              resourceId: ids[0] ?? null,
              details: {
                affected: (data ?? []).length,
                ids,
                killed_reason: body.killed_reason.trim(),
              },
            }),
          )
          .catch(() => {})
        return NextResponse.json({ ok: true, status: 'killed', affected: (data ?? []).length })
      }

      default:
        return NextResponse.json({ error: 'Unknown bulk action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[approval-queue/bulk-action] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
