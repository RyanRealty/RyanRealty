/**
 * CRM health rules — the pure alarm evaluator behind the crm-health-check cron
 * (Contact-360 Phase 9.6).
 *
 * The cron (app/api/cron/crm-health-check/route.ts) gathers a snapshot of the
 * CRM vitals — the same vitals the 9.5 health board shows — and hands them to
 * this PURE function. evaluateHealthRules reads ONLY its `signals` argument:
 * no env, no DB, no network, no Date.now(). That keeps every threshold decision
 * deterministic and exhaustively unit-testable, so a rule that should fire (or
 * clear) cannot silently regress.
 *
 * Each rule maps one vital to at most one alarm. The route writes a deduped
 * crm_broker_alert per returned alarm so a persistently-broken vital pages the
 * broker once per cooldown window, not on every 30-minute run.
 *
 * Thresholds (FLAGGED — chosen to match the 9.5 board + plan section 9.6):
 *  - mirror disabled .................. immediate (a kill switch is never ok)
 *  - inbound webhook stale ............ no sms_in/call for >= 6h DURING business
 *                                       hours only (overnight silence is normal)
 *  - A2P not VERIFIED with sends ....... any send attempt while A2P != VERIFIED
 *  - delta sync stale ................. last clean delta finished > 90 min ago
 *                                       (the delta cron runs at :07/:37, so two
 *                                       consecutive misses is about 90 min)
 *  - lead volume cratered ............. 0 new leads in the trailing 24h
 */

export type HealthSeverity = 'warning' | 'critical'

/** One alarm. `key` is the stable dedupe handle the route keys its alert off. */
export interface HealthAlarm {
  key: string
  severity: HealthSeverity
  message: string
}

/**
 * The snapshot the route computes and hands to the evaluator. Every field is a
 * plain value the route derived from a vital — no objects with behavior, so the
 * evaluator stays trivially testable.
 */
export interface HealthSignals {
  /** True when "now" (Pacific) is inside business hours; the route computes this. */
  businessHours: boolean
  /** Hours since the most recent inbound sms_in/call timeline row; null = none ever seen in window. */
  hoursSinceLastInbound: number | null
  /** Twilio A2P campaign status. 'VERIFIED' is the only sending-allowed state. */
  a2pStatus: 'VERIFIED' | 'IN_PROGRESS' | 'FAILED' | 'PENDING' | 'NONE' | null
  /** Outbound SMS send attempts in the trailing window (sms_out timeline rows). */
  smsSendAttempts24h: number
  /** New crm_people leads created in the trailing 24h (across every source). */
  newLeads24h: number
  /** Twilio API reachability with the configured creds. false = creds present
   *  but the account call failed (rotated/invalid token → all inbound webhooks
   *  403 + all outbound blocked). null = creds not configured (skip the rule). */
  twilioReachable: boolean | null
  /** Saved views carrying an exact geographic condition (subdivision eq /
   *  neighborhood), annotated with live counts: `exactCount` = what the list
   *  matches today; `signalCount` = what a subdivision-contains probe of the
   *  same term matches. The route computes both through the one compiler /
   *  the same ilike the compiler emits, so the numbers equal what the CRM UI
   *  shows. Empty array = no geographic lists (rule skips). */
  geoSmartLists: Array<{ id: number; name: string; exactCount: number; signalCount: number }>
}

/** A geographic list is "undercounting" when the contains-signal is at least
 *  this many contacts AND at least this multiple of the list's own count.
 *  Calibrated on the 593f5fe4 incident: "Northwest Crossing Homeowners"
 *  matched 26 while the subdivision signal held 1,035 (~40×). A district
 *  list (903 exact, ~0 signal) never trips. */
export const LIST_UNDERCOUNT_SIGNAL_MIN = 25
export const LIST_UNDERCOUNT_FACTOR = 10

/** Inbound webhook is "stale" after this many hours of business-hours silence. */
export const INBOUND_STALE_HOURS = 6

/**
 * Evaluate every CRM health rule against a snapshot. Returns the alarms that are
 * currently firing — an empty list means every vital is healthy. Pure and total.
 *
 * (FUB mirror + delta-sync rules retired at the cutover 2026-06-24 — the in-house
 * CRM is now the lead system of record; there is no FUB sync to monitor.)
 */
export function evaluateHealthRules(signals: HealthSignals): { alarms: HealthAlarm[] } {
  const alarms: HealthAlarm[] = []

  // Rule 2: inbound webhook stale (business hours only).
  // No inbound sms_in or call for a long stretch during business hours means the
  // Twilio inbound webhook (or the relay) probably stopped delivering. Overnight
  // silence is normal, so the rule only fires inside business hours. A null
  // "hours since" (nothing inbound at all in the lookback) counts as stale.
  if (signals.businessHours) {
    const stale =
      signals.hoursSinceLastInbound === null || signals.hoursSinceLastInbound >= INBOUND_STALE_HOURS
    if (stale) {
      const detail =
        signals.hoursSinceLastInbound === null
          ? 'no inbound text or call on record in the lookback window'
          : `last inbound text or call was ${formatHours(signals.hoursSinceLastInbound)} ago`
      alarms.push({
        key: 'inbound-webhook-stale',
        severity: 'warning',
        message: `No inbound contact during business hours (${detail}). Check the Twilio inbound webhook and the relay heartbeat.`,
      })
    }
  }

  // Rule 3: A2P not VERIFIED while sends are attempted.
  // Outbound SMS is carrier-blocked (error 30034) until the A2P campaign is
  // VERIFIED. If the campaign regresses out of VERIFIED while the CRM is still
  // attempting sends, every text is silently dropped — alarm. No send attempts
  // means a non-verified campaign is merely pre-launch, not a regression.
  if (
    signals.a2pStatus !== null &&
    signals.a2pStatus !== 'VERIFIED' &&
    signals.smsSendAttempts24h > 0
  ) {
    alarms.push({
      key: 'a2p-not-verified',
      severity: 'critical',
      message: `A2P campaign is ${signals.a2pStatus} while ${signals.smsSendAttempts24h} outbound text${
        signals.smsSendAttempts24h === 1 ? ' was' : 's were'
      } attempted in the last 24 hours. Carriers are blocking every text until the campaign is VERIFIED.`,
    })
  }

  // Rule 5: lead volume cratered.
  // Zero new leads in a full day, across every source, is a strong signal that
  // capture broke upstream (LP form, webhook, native capture) rather than a quiet day.
  if (signals.newLeads24h <= 0) {
    alarms.push({
      key: 'lead-volume-cratered',
      severity: 'warning',
      message:
        'No new leads in the last 24 hours from any source. Lead capture may be broken upstream (landing-page forms, webhooks, or native capture).',
    })
  }

  // Rule 6: Twilio unreachable with the configured creds.
  // A rotated/revoked TWILIO_AUTH_TOKEN makes every inbound webhook signature
  // check fail (403) and blocks every outbound send — silently, until someone
  // notices no texts/calls. A single account-ping catches it within one cron
  // cycle instead of the 6h inbound-stale window. null = creds not configured.
  if (signals.twilioReachable === false) {
    alarms.push({
      key: 'twilio-unreachable',
      severity: 'critical',
      message:
        'Twilio is unreachable with the configured credentials. Every inbound call/text webhook will 403 and every outbound send is blocked. Check TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN (likely rotated).',
    })
  }

  // Rule 7: community smart list undercounting its geographic signal.
  // The 593f5fe4 class: a list filters an exact canonical value (neighborhood
  // slug or subdivision eq) for a master-planned community whose contacts
  // actually carry dozens of MLS subdivision variants — the list quietly shows
  // a fraction of the real audience and every send/audience built from it
  // under-reaches. Fires while the mismatch persists so a badly-defined list
  // is caught within one cron cycle of being created, not months later.
  for (const list of signals.geoSmartLists) {
    if (
      list.signalCount >= LIST_UNDERCOUNT_SIGNAL_MIN &&
      list.signalCount >= LIST_UNDERCOUNT_FACTOR * Math.max(list.exactCount, 1)
    ) {
      alarms.push({
        key: `community-list-undercount-${list.id}`,
        severity: 'warning',
        message: `Smart list "${list.name}" matches ${list.exactCount} contact${
          list.exactCount === 1 ? '' : 's'
        } but its community's subdivision signal holds ${list.signalCount}. The filter likely uses an exact match where subdivision-contains is needed (see the Northwest Crossing fix, 593f5fe4).`,
      })
    }
  }

  return { alarms }
}

/** Format an hours value for an alarm message: "5.5 hours" / "1 hour". */
function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}
// (formatMinutes + the delta-stale/mirror rules removed at the FUB cutover 2026-06-24.)
