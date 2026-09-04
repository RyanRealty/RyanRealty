'use server'

/**
 * The ONE approve-and-deliver path for the unified CMA queue (Matt 2026-09-04).
 *
 * Replaces the four-screen, five-button spread: whatever a CMA's origin, the
 * queue calls this and it does the right thing. Origin decides only the
 * delivery lane — a valuation somebody asked for goes out now, cold expired /
 * FSBO outreach is stamped into the weekday drip so sends stay spaced.
 *
 * The gate that matters: a CMA whose adversarial audit FAILED can never be
 * delivered from here, no matter who clicks. On 2026-09-04 that was 210 of 418
 * live rows — the audit catches fabricated comp counts and recommendations the
 * adjusted values do not support, and mailing one of those to a homeowner is
 * exactly the §0 accuracy breach the audit exists to prevent. Rebuild it or
 * fix it; there is no "send anyway" here by design.
 */

import { checkAdminAction } from '@/lib/admin/require-admin'
import { revalidatePath } from 'next/cache'
import { listCmaQueue, isSendableQueueState, type CmaQueueRow } from '@/lib/data'
import { approveCmaAction, sendCmaToLeadAction } from '@/app/actions/cma-admin'

export type ApproveAndDeliverResult =
  | { ok: true; outcome: 'sent'; transport: 'gmail' | 'resend' | null }
  | { ok: true; outcome: 'queued'; position: number }
  | { ok: true; outcome: 'approved-only'; reason: string }
  | { ok: false; error: string; blocked?: 'audit' | 'state' | 'contact' }

async function findQueueRow(slug: string): Promise<CmaQueueRow | null> {
  const safe = slug.trim().toLowerCase()
  const { rows } = await listCmaQueue({ limit: 500, includeArchived: true })
  return rows.find((r) => r.slug.toLowerCase() === safe) ?? null
}

/**
 * Approve a CMA and put it on the right delivery lane.
 *
 * Returns which lane it took so the caller can say so plainly — "sent" and
 * "queued behind 11 others" are different things to a broker working a list.
 */
export async function approveAndDeliverCma(slug: string): Promise<ApproveAndDeliverResult> {
  try {
    const auth = await checkAdminAction('prospecting.view')
    if (!auth.ok) return { ok: false, error: auth.error }

    const row = await findQueueRow(slug)
    if (!row) return { ok: false, error: 'CMA not found.' }

    // 1. The accuracy gate, before anything is finalized.
    if (row.state === 'audit-failed') {
      const detail = row.auditCriticalCount > 0 ? ` ${row.auditCriticalCount} critical finding${row.auditCriticalCount === 1 ? '' : 's'}.` : ''
      return {
        ok: false,
        blocked: 'audit',
        error: `This CMA failed its adversarial audit.${detail} Rebuild it before sending — a failed audit means the numbers or the narrative do not hold up.`,
      }
    }
    if (!isSendableQueueState(row.state)) {
      const why: Record<string, string> = {
        failed: 'The build failed. Rebuild it first.',
        building: 'It has no document yet. Wait for the build to finish.',
        unvetted: 'The adversarial audit could not run on this one, so nothing has checked it. Read it, then approve from the report itself.',
        flagged: 'It is flagged for review. Open it and clear the flag before sending.',
        queued: 'Already approved and waiting in the drip.',
        sent: 'Already delivered.',
        archived: 'This CMA is archived.',
      }
      return { ok: false, blocked: 'state', error: why[row.state] ?? `Not sendable from state "${row.state}".` }
    }

    // 2. Finalize — the document link must be client-ready before any email
    // points at it, otherwise the recipient gets a 404 on a draft.
    const approved = await approveCmaAction(slug)
    if (approved.error) return { ok: false, error: approved.error }

    // 3. Deliver on the lane the origin dictates.
    if (row.sendMode === 'manual') {
      return {
        ok: true,
        outcome: 'approved-only',
        reason:
          row.origin === 'unknown'
            ? 'Approved. Origin was never recorded on this row, so it is not on a send lane — send it from the report if you know who it is for.'
            : 'Approved. Internal builds do not go out on a lane.',
      }
    }

    if (!row.contactEmail) {
      return { ok: false, blocked: 'contact', error: 'Approved, but there is no email on file for this owner. Nothing was sent.' }
    }

    if (row.sendMode === 'now') {
      const sent = await sendCmaToLeadAction(slug)
      if (sent.error) return { ok: false, error: `Approved, but the send failed: ${sent.error}` }
      revalidatePath('/admin/cmas')
      return { ok: true, outcome: 'sent', transport: sent.data?.transport ?? null }
    }

    // Cold: stamp into the weekday drip. The drain re-verifies live status and
    // runs the whole compliance chain again right before it sends, so nothing
    // here is a substitute for that — this only takes a number.
    const { enqueueProspectFirstTouchEmail, listQueuedFirstTouch } = await import(
      '@/lib/data/prospecting/drip-queue'
    )
    if (!row.prospectKind || !row.prospectId) {
      return { ok: false, error: 'Approved, but this CMA is not linked to a prospect row, so it cannot enter the drip.' }
    }
    const queued = await enqueueProspectFirstTouchEmail(row.prospectKind, row.prospectId)
    if (!queued.ok) return { ok: false, error: `Approved, but the drip queue refused it: ${queued.error}` }

    const waiting = await listQueuedFirstTouch(500)
    revalidatePath('/admin/cmas')
    return { ok: true, outcome: 'queued', position: waiting.length }
  } catch (e) {
    console.error('[approveAndDeliverCma]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Approve failed unexpectedly.' }
  }
}
