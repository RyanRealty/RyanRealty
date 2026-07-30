/**
 * Alert delivery planning — PURE decisions for the listing-alert engine
 * (app/actions/saved-search-alerts.ts): who receives an alert email, and
 * whether the detected events send now or queue for broker approval.
 *
 * The engine performs the I/O (compliance lookups, queue writes, Resend
 * sends); this module owns the branching so the Phase 3 contract test
 * (lib/alerts/*.test.ts) can pin the behavior without mocks:
 *   - event toggles filter which detected events fire,
 *   - preview_mode queues instead of sending,
 *   - multi-recipient fan-out with per-recipient unsubscribe tokens,
 *   - compliance stops (hard-stop / suppression) remove ONLY the stopped
 *     recipient, never the whole alert.
 */

import {
  filterEventsByToggles,
  type AlertEventToggles,
  type ListingEvent,
} from '@/lib/alerts/event-detection'

// ── Recipients ────────────────────────────────────────────────────────────────

export type AlertRecipient = {
  email: string
  name: string | null
  /** Per-recipient unsubscribe token. Empty string = missing (the engine
   *  backfills + persists a fresh token before sending). */
  unsubscribeToken: string
  kind: 'primary' | 'additional'
}

/**
 * Normalize an alert row's recipient set: the primary (email +
 * unsubscribe_token columns) plus every valid entry of the recipients jsonb
 * ([{email, name?, unsubscribe_token}]). Emails are lowercased/trimmed and
 * deduped (first occurrence wins — the primary always wins its own address).
 */
export function normalizeRecipients(row: {
  email: string
  unsubscribe_token: string
  recipients?: unknown
}): AlertRecipient[] {
  const out: AlertRecipient[] = []
  const seen = new Set<string>()

  const primary = (row.email ?? '').trim().toLowerCase()
  if (primary) {
    out.push({ email: primary, name: null, unsubscribeToken: row.unsubscribe_token ?? '', kind: 'primary' })
    seen.add(primary)
  }

  if (Array.isArray(row.recipients)) {
    for (const item of row.recipients) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const obj = item as Record<string, unknown>
      const email = typeof obj.email === 'string' ? obj.email.trim().toLowerCase() : ''
      if (!email || !email.includes('@') || seen.has(email)) continue
      seen.add(email)
      out.push({
        email,
        name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : null,
        unsubscribeToken:
          typeof obj.unsubscribe_token === 'string' ? obj.unsubscribe_token.trim() : '',
        kind: 'additional',
      })
    }
  }

  return out
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export type RecipientCompliance = {
  /** isHardStopped(personId) — do_not_email / unsubscribed / bounced / realtor. */
  hardStopped: boolean
  /** isSuppressedByEmail(email, 'email').suppressed — fails closed upstream. */
  suppressed: boolean
}

export type AlertDeliveryPlan =
  | { action: 'skip'; reason: 'no_events' | 'all_recipients_stopped'; events: ListingEvent[] }
  | { action: 'queue'; events: ListingEvent[] }
  | { action: 'send'; events: ListingEvent[]; deliverTo: AlertRecipient[] }

/**
 * Decide what the engine does with one alert row's detected events.
 *
 * Order matters: toggles first (an alert with nothing to say neither sends
 * nor queues), then preview_mode (queued events are held BEFORE any recipient
 * fan-out — compliance re-runs at release time so a stop that lands while the
 * item waits in the queue still blocks the send), then per-recipient
 * compliance (a stopped recipient is dropped; the rest still receive).
 */
export function planAlertDelivery(args: {
  events: ListingEvent[]
  toggles: AlertEventToggles
  previewMode: boolean
  recipients: AlertRecipient[]
  /** Keyed by lowercased email. A missing entry FAILS CLOSED (recipient dropped). */
  compliance: Map<string, RecipientCompliance>
  /**
   * True only for a registered (signed-in) subscriber. Sold events are VOW-only
   * under the ODS rules and are dropped for guest rows. Omitted = false.
   */
  vowEligible?: boolean
}): AlertDeliveryPlan {
  const events = filterEventsByToggles(args.events, args.toggles, {
    vowEligible: args.vowEligible === true,
  })
  if (events.length === 0) return { action: 'skip', reason: 'no_events', events }

  if (args.previewMode) return { action: 'queue', events }

  const deliverTo = args.recipients.filter((r) => {
    const c = args.compliance.get(r.email)
    if (!c) return false
    return !c.hardStopped && !c.suppressed
  })
  if (deliverTo.length === 0) return { action: 'skip', reason: 'all_recipients_stopped', events }

  return { action: 'send', events, deliverTo }
}
