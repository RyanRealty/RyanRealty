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
import type { CmaSendOverride } from '@/lib/cma/send'
import { saveCmaFirstContactOverride } from '@/lib/cma/first-contact-override'

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
export async function approveAndDeliverCma(
  slug: string,
  override?: CmaSendOverride,
  opts?: { delivery?: 'now' | 'drip' },
): Promise<ApproveAndDeliverResult> {
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
    // Send-now from an already-queued drip row is allowed (pulls it out of the
    // weekday queue and delivers via sendCmaToLead). Everything else still
    // requires a sendable Ready state.
    const forceNow = opts?.delivery === 'now'
    const alreadyQueued = row.state === 'queued'
    if (!(forceNow && alreadyQueued) && !isSendableQueueState(row.state)) {
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
    if (!alreadyQueued) {
      const approved = await approveCmaAction(slug)
      if (approved.error) return { ok: false, error: approved.error }
    }

    // 3. Deliver on the lane the origin dictates (Review may force now/drip).
    const delivery: 'now' | 'drip' | 'manual' =
      opts?.delivery ?? (row.sendMode === 'manual' ? 'manual' : row.sendMode)

    if (delivery === 'manual') {
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

    if (delivery === 'now') {
      const sent = await sendCmaToLeadAction(slug, override)
      if (sent.error) {
        return {
          ok: false,
          error: alreadyQueued ? `Send failed: ${sent.error}` : `Approved, but the send failed: ${sent.error}`,
        }
      }
      // Pull out of the drip so the weekday drain cannot double-send.
      if (row.prospectKind && row.prospectId) {
        const { hardSkipQueuedFirstTouch } = await import('@/lib/data/prospecting/drip-queue')
        await hardSkipQueuedFirstTouch(row.prospectKind, row.prospectId, 'manual-send-now')
      }
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
    // Carry Review email edits into the drip drain via build_summary.
    if (override?.subject?.trim() || override?.bodyText?.trim()) {
      const saved = await saveCmaFirstContactOverride(slug, {
        subject: override.subject?.trim() ?? '',
        bodyText: override.bodyText?.trim() ?? '',
      })
      if (!saved.ok) return { ok: false, error: `Approved, but email edits could not be saved: ${saved.error}` }
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


async function prospectForSlug(slug: string): Promise<{ kind: 'expired' | 'fsbo'; id: string } | null> {
  const row = await findQueueRow(slug)
  if (row?.prospectKind && row.prospectId) return { kind: row.prospectKind, id: row.prospectId }
  const { findProspectForCmaSlug } = await import('@/lib/data/prospecting/drip-queue')
  return findProspectForCmaSlug(slug)
}

/** Broker Hold on an In-drip card — defer to the back of the FIFO queue. */
export async function holdCmaInDripAction(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = await checkAdminAction('prospecting.view')
    if (!auth.ok) return { ok: false, error: auth.error }
    const prospect = await prospectForSlug(slug)
    if (!prospect) return { ok: false, error: 'Not linked to a prospecting row.' }
    const { holdQueuedFirstTouch } = await import('@/lib/data/prospecting/drip-queue')
    const res = await holdQueuedFirstTouch(prospect.kind, prospect.id)
    if (!res.ok) return res
    revalidatePath('/admin/cmas')
    revalidatePath(`/admin/cmas/${slug.trim().toLowerCase()}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hold failed.' }
  }
}

/** Broker Remove from drip — leave the queue without sending. */
export async function removeCmaFromDripAction(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = await checkAdminAction('prospecting.view')
    if (!auth.ok) return { ok: false, error: auth.error }
    const prospect = await prospectForSlug(slug)
    if (!prospect) return { ok: false, error: 'Not linked to a prospecting row.' }
    const { removeQueuedFirstTouch } = await import('@/lib/data/prospecting/drip-queue')
    const res = await removeQueuedFirstTouch(prospect.kind, prospect.id)
    if (!res.ok) return res
    revalidatePath('/admin/cmas')
    revalidatePath(`/admin/cmas/${slug.trim().toLowerCase()}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Remove failed.' }
  }
}
