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
  /** CRM_MIRROR_ENABLED kill switch — true when leads are mirroring into crm_*. */
  mirrorEnabled: boolean
  /** True when "now" (Pacific) is inside business hours; the route computes this. */
  businessHours: boolean
  /** Hours since the most recent inbound sms_in/call timeline row; null = none ever seen in window. */
  hoursSinceLastInbound: number | null
  /** Twilio A2P campaign status. 'VERIFIED' is the only sending-allowed state. */
  a2pStatus: 'VERIFIED' | 'IN_PROGRESS' | 'FAILED' | 'PENDING' | 'NONE' | null
  /** Outbound SMS send attempts in the trailing window (sms_out timeline rows). */
  smsSendAttempts24h: number
  /** Minutes since the last CLEAN fub-delta run finished; null = no clean run on record. */
  minutesSinceCleanDelta: number | null
  /** New crm_people leads created in the trailing 24h (across every source). */
  newLeads24h: number
}

/** Inbound webhook is "stale" after this many hours of business-hours silence. */
export const INBOUND_STALE_HOURS = 6
/** Delta sync is "stale" after this many minutes without a clean finish. */
export const DELTA_STALE_MINUTES = 90

/**
 * Evaluate every CRM health rule against a snapshot. Returns the alarms that are
 * currently firing — an empty list means every vital is healthy. Pure and total.
 */
export function evaluateHealthRules(signals: HealthSignals): { alarms: HealthAlarm[] } {
  const alarms: HealthAlarm[] = []

  // Rule 1: the mirror kill switch.
  // CRM_MIRROR_ENABLED=false silently stops every mirror-path crm_people write.
  // A disabled mirror is never an acceptable steady state, so it is critical and
  // has no grace window.
  if (!signals.mirrorEnabled) {
    alarms.push({
      key: 'mirror-disabled',
      severity: 'critical',
      message:
        'CRM mirror is disabled. FUB leads are not flowing into crm_*. Re-enable CRM_MIRROR_ENABLED to restore lead capture.',
    })
  }

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

  // Rule 4: delta sync stale.
  // The fub-delta cron is the parallel-run safety net. A clean run that has not
  // finished in well over its interval means delta sync silently stopped and the
  // crm_* mirror is drifting from FUB. A null (no clean run on record) is stale.
  const deltaStale =
    signals.minutesSinceCleanDelta === null ||
    signals.minutesSinceCleanDelta >= DELTA_STALE_MINUTES
  if (deltaStale) {
    const detail =
      signals.minutesSinceCleanDelta === null
        ? 'no clean delta run on record'
        : `last clean delta finished ${formatMinutes(signals.minutesSinceCleanDelta)} ago`
    alarms.push({
      key: 'delta-stale',
      severity: 'warning',
      message: `FUB delta sync looks stale (${detail}). The crm_* mirror may be drifting from FUB.`,
    })
  }

  // Rule 5: lead volume cratered.
  // Zero new leads in a full day, across every source, is a strong signal that
  // capture broke upstream (LP form, webhook, mirror) rather than a quiet day.
  if (signals.newLeads24h <= 0) {
    alarms.push({
      key: 'lead-volume-cratered',
      severity: 'warning',
      message:
        'No new leads in the last 24 hours from any source. Lead capture may be broken upstream (landing-page forms, FUB webhook, or the mirror).',
    })
  }

  return { alarms }
}

/** Format an hours value for an alarm message: "5.5 hours" / "1 hour". */
function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}

/** Format a minutes value for an alarm message: "92 minutes" / "1 minute". */
function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  return `${rounded} ${rounded === 1 ? 'minute' : 'minutes'}`
}
