/**
 * market-report-preferences — the WRITE side of the no-login preferences page
 * and the one-click endpoint, behind a signed link (Matt's decisions
 * 2026-09-29). The read side (what the page shows) is
 * lib/data/crm/reportPreferences.ts.
 *
 * From her report's link she can switch weekly / monthly / quarterly, add and
 * remove areas, pause and resume, stop these reports, and, separately and
 * behind a confirmation, stop all Ryan Realty email.
 *
 *   - A report stop (the page's button, or the RFC 8058 one-click POST) turns
 *     the market report off and nothing else: is_active false, stopped_at,
 *     stopped_via, an email_events 'unsubscribe' row against the report's
 *     email_key, and a crm_timeline row. Other email keeps working.
 *   - "Stop all Ryan Realty email" writes the existing global suppression
 *     (channel email, reason unsubscribe) through lib/crm/suppressions.
 *   - "Start receiving Ryan Realty email again" is her own consent, and it
 *     lifts only her own soft `unsubscribe` suppression (her person row and
 *     her address), never a bounce, a complaint, a do-not-email tag or a
 *     compliance hard stop. Those stay, and the page says so.
 *   - Every change writes a crm_timeline row saying it came from the report's
 *     email link.
 *   - A broker PREVIEW link reaches the same page, and nothing it posts
 *     changes anything.
 *   - A link whose contact record was DELETED (review 2026-09-30) still
 *     stops: "Stop these reports", the one-click POST and "Stop all Ryan
 *     Realty email" act on that record. Nothing else does (there is no report
 *     to reschedule on a deleted record), and the answer is a code the page
 *     words.
 *   - Her stop always lands: on a report a broker had already stopped, it
 *     replaces the broker's stop with hers and records the unsubscribe
 *     (lib/crm/market-report-subscription-control.ts).
 *
 * Results are CODES, not sentences: the page maps a code to fixed copy, so a
 * crafted URL can never put words on our domain.
 *
 * Server-only. Reads and writes go through lib/data (DAL boundary).
 */
import 'server-only'

import {
  applyReportSubscriptionPatch,
  createReportSubscription,
  logReportTimeline,
} from '@/lib/data/crm/marketReportSubscription'
import { getMarketReportSendByEmailKey, listMarketReportSendsForPerson } from '@/lib/data/crm/marketReportSends'
import {
  readEmailSignals,
  resolveReportLink,
  type ResolvedReportLink,
} from '@/lib/data/crm/reportPreferences'
import { canUserResubscribe, removeSoftEmailUnsubscribeByEmailValue } from '@/lib/data/newsletter/perLead'
import type { ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import { addSuppression, removeSuppression } from '@/lib/crm/suppressions'
import { recordEmailEvent } from '@/lib/crm/email-events'
import {
  describeVia,
  planReportChange,
  reportSubscriptionState,
  type ReportChange,
  type ReportSubscriptionState,
} from '@/lib/crm/market-report-subscription-control'
import { reportAreaLabel, reportAreaOptions } from '@/lib/crm/market-report-areas'
import { BROKER_ALERT_ORIGIN, queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'

/** One choice from the page or the one-click header. */
export type PreferenceAction =
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'stop' }
  | { kind: 'frequency'; frequency: ReportFrequency }
  | { kind: 'add-area'; slug: string }
  | { kind: 'remove-area'; slug: string }
  | { kind: 'stop-all-email' }
  | { kind: 'restart-all-email' }

/** What is true after the choice (the page words it). */
export type PreferenceDone =
  | 'on'
  | 'paused'
  | 'stopped'
  | 'frequency'
  | 'areas'
  | 'all-email-off'
  | 'all-email-on'
  | 'preview'

/** Why the choice did not land (the page words it). */
export type PreferenceError =
  | 'link'
  | 'unavailable'
  | 'save'
  | 'last-area'
  | 'no-areas'
  | 'unknown-area'
  | 'restart-blocked'
  | 'no-subscription'
  /** The contact record behind the link was deleted: only the stops apply. */
  | 'closed'
  /**
   * "Stop all Ryan Realty email" did not verifiably land: the suppression did
   * not save, or a re-read did not show email off. Email is still on, and Matt
   * was paged (review 2026-09-30).
   */
  | 'stop-all-failed'
  /** The report changed after the page was read (her other door, or a broker): nothing was overwritten. */
  | 'changed'

export type PreferenceResult =
  | { ok: true; changed: boolean; done: PreferenceDone }
  | { ok: false; error: PreferenceError }

/** The email_key an unsubscribe is recorded against: the link's report, else her latest. */
async function unsubscribeKey(link: ResolvedReportLink): Promise<string | null> {
  if (link.token.emailKey) return link.token.emailKey
  const [latest] = await listMarketReportSendsForPerson(link.contact.personId, {
    kinds: ['scheduled', 'manual'],
    statuses: ['sent'],
    limit: 1,
  })
  return latest?.emailKey ?? null
}

async function recordUnsubscribeEvent(link: ResolvedReportLink, via: 'email-link' | 'one-click', scope: 'market-report' | 'all') {
  const emailKey = await unsubscribeKey(link)
  await recordEmailEvent({
    recipientEmail: link.contact.primaryEmail,
    personId: link.contact.personId,
    broker: link.contact.assignedBroker,
    sendType: 'market-report',
    event: 'unsubscribe',
    emailKey,
    meta: { via, scope },
  })
}

/**
 * The reasons readEmailSignals' readers use as fail-closed stand-ins when a
 * read FAILS (lib/data/crm/getSuppressionSignals.ts, getEmailKeyedSuppressionSignals).
 * They make the page show email as off, which is the safe display, but they
 * are not an opt-out on record, so they never prove that "Stop all" landed
 * and never make it a no-op.
 */
const FAIL_CLOSED_SIGNAL_REASONS: ReadonlySet<string> = new Set(['suppression-check-failed', 'invalid-person', 'no-email'])

/** Email is off by a real row or tag on her record or address, not a read that failed. Pure. */
export function emailOffOnRecord(signals: ReadonlyArray<{ channel: string; reason: string }>): boolean {
  return signals.some((s) => (s.channel === 'email' || s.channel === 'all') && !FAIL_CLOSED_SIGNAL_REASONS.has(s.reason))
}

/** The state word for a report change that turned out to be a no-op. */
function stateDone(state: ReportSubscriptionState): PreferenceDone {
  return state === 'on' ? 'on' : state === 'paused' ? 'paused' : 'stopped'
}

/**
 * Apply one choice from the page (via 'email-link', a manage link) or the
 * one-click header (via 'one-click', a stop link). A preview link changes
 * nothing. Never throws on a bad link; returns a code the page can word.
 */
export async function applyReportPreference(
  tokenStr: string | null | undefined,
  action: PreferenceAction,
  via: 'email-link' | 'one-click',
  now: Date = new Date(),
): Promise<PreferenceResult> {
  const res = await resolveReportLink(tokenStr, via === 'one-click' ? 'stop' : 'manage')
  if (!res.ok) return { ok: false, error: res.reason === 'unavailable' ? 'unavailable' : 'link' }
  const link = res.link
  if (link.token.preview) return { ok: true, changed: false, done: 'preview' }
  const { contact } = link
  const broker = contact.assignedBroker
  const actor = { via } as const
  if (contact.deleted && action.kind !== 'stop' && action.kind !== 'stop-all-email') {
    return { ok: false, error: 'closed' }
  }

  try {
    if (action.kind === 'stop-all-email') {
      const before = await readEmailSignals(contact)
      if (emailOffOnRecord(before.all)) return { ok: true, changed: false, done: 'all-email-off' }
      // Keyed to her record AND her address (the newsletter unsubscribe does
      // the same), so an address-keyed check honors it too: a deleted record,
      // or a second record with the same address, still reads as opted out.
      // A write that throws is a write that failed: it goes to the same
      // verify-then-page path, never to the generic error.
      const written = await addSuppression({
        personId: contact.personId,
        channel: 'email',
        reason: 'unsubscribe',
        source: via === 'one-click' ? 'report-one-click' : 'report-email-link',
        value: contact.primaryEmail ? contact.primaryEmail.trim().toLowerCase() : null,
      }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }))
      // "All email is off" is said only after a re-read SEES it off on her
      // record (review 2026-09-30). Anything less is a real failure: the page
      // says email is still on, and Matt is paged to turn it off by hand.
      const after = await readEmailSignals(contact)
      if (!emailOffOnRecord(after.all)) {
        const why = written.ok ? 'the suppression saved but a re-read does not show email off' : written.error
        try {
          await queueBrokerHealthAlert({
            key: `report-stop-all-failed:p${contact.personId}`,
            cooldownMinutes: 60,
            body: [
              `${contact.name ?? `Contact ${contact.personId}`} asked to stop ALL Ryan Realty email from a market report link, and it did not save (${why.slice(0, 200)}).`,
              'Email to them is still on. Turn it off by hand:',
              `${BROKER_ALERT_ORIGIN}/admin/people/${contact.personId}`,
            ].join(' '),
          })
        } catch {
          // best-effort: the page already tells her email is still on
        }
        return { ok: false, error: 'stop-all-failed' }
      }
      await logReportTimeline(contact.personId, {
        title: `All Ryan Realty email turned off ${describeVia(actor)}`,
        payload: { via, change: 'stop-all-email' },
        broker,
        source: via,
      })
      await recordUnsubscribeEvent(link, via, 'all')
      return { ok: true, changed: true, done: 'all-email-off' }
    }

    if (action.kind === 'restart-all-email') {
      const { all, off } = await readEmailSignals(contact)
      if (!off) return { ok: true, changed: false, done: 'all-email-on' }
      if (!canUserResubscribe(all, null).allowed) return { ok: false, error: 'restart-blocked' }
      await removeSuppression({ personId: contact.personId, channel: 'email', reason: 'unsubscribe' })
      if (contact.primaryEmail) await removeSoftEmailUnsubscribeByEmailValue(contact.primaryEmail)
      await logReportTimeline(contact.personId, {
        title: `Email turned back on ${describeVia(actor)} (the contact's own request)`,
        payload: { via, change: 'restart-all-email' },
        broker,
        source: via,
      })
      return { ok: true, changed: true, done: 'all-email-on' }
    }

    // A report-scoped change. A one-off report with no subscription can only
    // be stopped: the stop is kept as a stopped row, so her choice is on
    // record and a later "subscribe" by a broker cannot silently undo it.
    let subscription = link.subscription
    if (!subscription) {
      if (action.kind !== 'stop') return { ok: false, error: 'no-subscription' }
      const sent = link.token.emailKey ? await getMarketReportSendByEmailKey(link.token.emailKey) : null
      const created = await createReportSubscription(
        contact.personId,
        {
          areas: sent?.areas ?? [],
          frequency: 'monthly',
          isActive: false,
          stoppedAt: now.toISOString(),
          stoppedVia: via,
        },
        {
          title: `Market report stopped ${describeVia(actor)}`,
          payload: { via, change: 'stop' },
          broker,
          source: via,
        },
      )
      if (!created.ok) return { ok: false, error: 'save' }
      if (created.created) {
        await recordUnsubscribeEvent(link, via, 'market-report')
        return { ok: true, changed: true, done: 'stopped' }
      }
      // A row appeared since the link was read (a broker set one up): the
      // insert left it alone, so the stop is applied to that row below.
      subscription = created.record
    }

    let change: ReportChange
    let done: PreferenceDone
    switch (action.kind) {
      case 'pause':
      case 'resume':
      case 'stop':
        change = { kind: action.kind }
        done = action.kind === 'pause' ? 'paused' : action.kind === 'resume' ? 'on' : 'stopped'
        break
      case 'frequency':
        change = { kind: 'frequency', frequency: action.frequency }
        done = 'frequency'
        break
      case 'add-area': {
        // Validated against the live registry, server side: the page's select
        // is a convenience, never the authority.
        const known = reportAreaOptions().some((a) => a.slug === action.slug)
        if (!known) return { ok: false, error: 'unknown-area' }
        const areas = subscription.areas.includes(action.slug) ? subscription.areas : [...subscription.areas, action.slug]
        change = { kind: 'areas', areas, labels: areas.map(reportAreaLabel) }
        done = 'areas'
        break
      }
      case 'remove-area': {
        if (!subscription.areas.includes(action.slug)) return { ok: false, error: 'unknown-area' }
        const areas = subscription.areas.filter((s) => s !== action.slug)
        change = { kind: 'areas', areas, labels: areas.map(reportAreaLabel) }
        done = 'areas'
        break
      }
    }

    const plan = planReportChange(subscription, change, actor, now)
    if (!plan.ok) return { ok: false, error: plan.code === 'last-area' ? 'last-area' : plan.code === 'no-areas' ? 'no-areas' : 'save' }
    if (plan.noop) {
      // Already so. Word what IS true (a pause of a stopped report is "stopped").
      const state = reportSubscriptionState(subscription)
      return { ok: true, changed: false, done: change.kind === 'frequency' || change.kind === 'areas' ? done : stateDone(state) }
    }
    const applied = await applyReportSubscriptionPatch(subscription, plan.patch, {
      title: plan.title,
      payload: { via, change: action.kind },
      broker,
      source: via,
    })
    if (!applied.ok) return { ok: false, error: applied.error === 'changed' ? 'changed' : 'save' }
    if (change.kind === 'stop') await recordUnsubscribeEvent(link, via, 'market-report')
    return { ok: true, changed: true, done }
  } catch (e) {
    console.error('[applyReportPreference]', action.kind, e instanceof Error ? e.message : e)
    return { ok: false, error: 'save' }
  }
}
