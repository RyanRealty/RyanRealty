/**
 * Auto-send: what happens after a build when the lane's switch is ON.
 *
 * Matt, 2026-09-07: "i want expired and fsbos automated ASAP." Matt, standing
 * 2026-07-30: outreach is manual FOR NOW. Both are answered by the same build —
 * the real control exists, it ships OFF (public.cma_lane_settings, every row
 * false), and only a broker flipping the switch at /admin/cmas arms a lane.
 * Nothing here ever turns one on.
 *
 * WHY THIS IS NOT app/actions/cma-queue.ts. `approveAndDeliverCma` is a server
 * ACTION: it opens with `checkAdminAction('prospecting.view')`, and so do
 * `approveCmaAction` and `sendCmaToLeadAction` underneath it. The build worker
 * runs on a cron with no session, so it cannot call any of them — and exporting
 * an unauthenticated twin from a 'use server' file would publish a send
 * endpoint nobody has to sign in for. So the decision lives here, in a module,
 * and it reaches the SAME functions the broker's button reaches:
 *
 *   - the state comes from `listCmaQueue`, the read /admin/cmas renders, so the
 *     pill on the screen and the decision here cannot disagree;
 *   - `isSendableQueueState` is the one sendability rule, shared verbatim;
 *   - `sendModeForOrigin` decides the lane, the same as the button;
 *   - delivery is `enqueueProspectFirstTouchEmail` (cold) or `sendCmaToLead`
 *     (asked) — the same primitives `approveAndDeliverCma` calls, minus its
 *     auth wrapper.
 *
 * The drip drain re-verifies live listing status and re-runs the entire
 * compliance chain immediately before it sends, so nothing here shortcuts a
 * suppression, a relist check, or a merge-token failure.
 */

import { isSendableQueueState, type CmaQueueRow, type CmaQueueState } from '@/lib/data/cma/unified-queue'
import type { CmaOrigin } from '@/lib/cma/origin'
import type { LaneSettings } from '@/lib/data/cma/lane-settings'
import { isAutoSendLane } from '@/lib/data/cma/lane-settings'

export type AutoSendOutcome =
  | 'not-found'
  | 'not-a-cma'
  | 'lane-off'
  | 'not-ready'
  | 'no-contact'
  | 'no-prospect'
  | 'queued'
  | 'sent'
  | 'error'

export type AutoSendDecision = {
  outcome: AutoSendOutcome
  /** One line, plain, for the worker's executor_response and the log. */
  reason: string
  lane: CmaOrigin | null
  state: CmaQueueState | null
}

/**
 * Injected so the decision is testable without a database or a mail provider.
 * The defaults are the real thing.
 */
export type AutoSendDeps = {
  findRow: (slug: string) => Promise<CmaQueueRow | null>
  readLaneSettings: () => Promise<LaneSettings>
  finalize: (slug: string) => Promise<{ ok: true } | { ok: false; error: string }>
  sendNow: (slug: string) => Promise<{ ok: true; transport: string | null } | { ok: false; error: string }>
  enqueueDrip: (kind: 'expired' | 'fsbo', id: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

async function defaultDeps(): Promise<AutoSendDeps> {
  const [{ listCmaQueue }, { getLaneSettings }, { updateCmaRowFieldsBySlug }] = await Promise.all([
    import('@/lib/data/cma/unified-queue'),
    import('@/lib/data/cma/lane-settings'),
    import('@/lib/data'),
  ])
  return {
    findRow: async (slug) => {
      const safe = slug.trim().toLowerCase()
      const { rows } = await listCmaQueue({ limit: 1000, includeArchived: true })
      return rows.find((r) => r.docKind === 'cma' && r.slug.toLowerCase() === safe) ?? null
    },
    readLaneSettings: getLaneSettings,
    // The same two fields approveCmaAction writes. Its other work — the
    // has-a-document check and the needs_review acknowledgement — is already
    // covered here: neither a document-less nor a flagged row reaches `ready`.
    finalize: async (slug) => {
      const res = await updateCmaRowFieldsBySlug(slug, {
        status: 'finalized',
        finalized_at: new Date().toISOString(),
      })
      return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Finalize failed.' }
    },
    sendNow: async (slug) => {
      const { sendCmaToLead } = await import('@/lib/cma/send')
      const res = await sendCmaToLead(slug)
      return res.ok ? { ok: true, transport: res.transport ?? null } : { ok: false, error: res.error ?? 'Send failed.' }
    },
    enqueueDrip: async (kind, id) => {
      const { enqueueProspectFirstTouchEmail } = await import('@/lib/data/prospecting/drip-queue')
      return enqueueProspectFirstTouchEmail(kind, id)
    },
  }
}

/**
 * Decide and act for one freshly built CMA. Never throws — a failure here must
 * not fail the build that produced the document.
 */
export async function autoSendBuiltCma(slug: string, injected?: AutoSendDeps): Promise<AutoSendDecision> {
  const d = injected ?? (await defaultDeps())
  try {
    const row = await d.findRow(slug)
    if (!row) return { outcome: 'not-found', reason: 'No queue row for this slug.', lane: null, state: null }

    // A BPO is the brokerage's own opinion of value, read by a broker, and its
    // send path (lib/bpo/send.ts) needs a linked CRM person. It has a settings
    // row for vocabulary completeness and no auto-send behind it.
    if (row.docKind !== 'cma') {
      return { outcome: 'not-a-cma', reason: 'Only CMAs auto-send. A BPO is sent from its own page.', lane: row.origin, state: row.state }
    }

    if (!isAutoSendLane(row.origin)) {
      return {
        outcome: 'lane-off',
        reason: `The ${row.origin} lane has no auto-send switch — it sends only from the row.`,
        lane: row.origin,
        state: row.state,
      }
    }

    const settings = await d.readLaneSettings()
    if (!settings[row.origin].autoSend) {
      return { outcome: 'lane-off', reason: `Auto-send is off for the ${row.origin} lane.`, lane: row.origin, state: row.state }
    }

    // The solicitation screen, before the readiness gate: a relisted or sold
    // prospect never auto-sends, whatever the lane switch says.
    if (row.origin === 'expired' || row.origin === 'fsbo') {
      const { screenAddressForSolicitation } = await import('@/lib/cma/solicit-screen')
      const screen = await screenAddressForSolicitation({ address: row.address, city: row.city ?? null })
      if (!screen.ok) {
        return {
          outcome: 'not-ready',
          reason: `Not sent: ${screen.detail}`,
          lane: row.origin,
          state: row.state,
        }
      }
    }

    // THE gate. One function, shared with the queue and the approve action.
    if (!isSendableQueueState(row.state)) {
      return {
        outcome: 'not-ready',
        reason: `Not sent: the row is ${row.state}, and only a ready row auto-sends.`,
        lane: row.origin,
        state: row.state,
      }
    }

    if (!row.contactEmail) {
      return { outcome: 'no-contact', reason: 'Ready, but there is no email on file for this owner.', lane: row.origin, state: row.state }
    }

    const cold = row.sendMode === 'drip'
    if (cold && !(row.prospectKind && row.prospectId)) {
      return {
        outcome: 'no-prospect',
        reason: 'Ready, but the row is not linked to a prospect, so it cannot enter the drip.',
        lane: row.origin,
        state: row.state,
      }
    }
    if (row.sendMode === 'manual') {
      return { outcome: 'lane-off', reason: 'This origin has no send lane.', lane: row.origin, state: row.state }
    }

    // Finalize BEFORE anything points at the document — an un-finalized CMA
    // 404s the link in the email.
    const fin = await d.finalize(slug)
    if (!fin.ok) return { outcome: 'error', reason: `Could not finalize: ${fin.error}`, lane: row.origin, state: row.state }

    if (cold) {
      const queued = await d.enqueueDrip(row.prospectKind!, row.prospectId!)
      if (!queued.ok) {
        return { outcome: 'error', reason: `Approved, but the drip queue refused it: ${queued.error}`, lane: row.origin, state: row.state }
      }
      return {
        outcome: 'queued',
        reason: `Auto-send is on for the ${row.origin} lane: approved and placed in the weekday drip.`,
        lane: row.origin,
        state: row.state,
      }
    }

    const sent = await d.sendNow(slug)
    if (!sent.ok) return { outcome: 'error', reason: `Approved, but the send failed: ${sent.error}`, lane: row.origin, state: row.state }
    return {
      outcome: 'sent',
      reason: `Auto-send is on for the ${row.origin} lane: approved and sent.`,
      lane: row.origin,
      state: row.state,
    }
  } catch (e) {
    return {
      outcome: 'error',
      reason: e instanceof Error ? e.message : 'Auto-send failed unexpectedly.',
      lane: null,
      state: null,
    }
  }
}
