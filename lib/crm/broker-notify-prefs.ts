/**
 * Broker notification preferences — which internal alerts reach a broker, and
 * on which channel (Matt 2026-08-25).
 *
 * THE BUG THIS CLOSES. brokers.notify_new_leads / notify_deal_activity /
 * notify_task_due shipped with the CRM rebuild and are written by
 * /admin/settings/account, but no send path ever read them. Only notify_sms
 * gated queueBrokerAlert, so a broker who switched "New lead assigned" off
 * still got the text. The screen described a rail it did not control.
 *
 * THE SHAPE. A preference governs the CHANNEL, not the record. An alert always
 * lands in the CRM; what a broker tunes is whether it also buzzes their phone:
 *
 *   - category switched OFF  -> no alert queued at all. "Off" means off.
 *   - inside the quiet window -> queued 'push_only'. It is waiting on the
 *     dashboard in the morning; it just does not wake anyone.
 *   - over the daily cap      -> queued 'push_only', same reasoning.
 *   - health / ops alarms     -> never gated, never capped. A broken webhook
 *     is not a notification preference.
 *
 * Downgrading to 'push_only' rather than dropping is deliberate: neither SMS
 * drainer selects that status (see lib/crm/alert-drain-core), so a preference
 * can silence a text but can never lose a lead.
 *
 * Pure and dependency-free so the rules are unit-testable without a database.
 */

/** The alert families that actually fire in production, plus the ungated ops rail. */
export type BrokerAlertCategory =
  | 'new_lead'
  | 'return_visit'
  | 'cma_ready'
  | 'task_due'
  | 'deal_activity'
  | 'health'
  /** An alert kind with no category yet. Deliberately UNGATED — see below. */
  | 'other'

/**
 * Map a queueBrokerAlert `kind` to its preference category.
 *
 * Unknown kinds return 'other', which is never gated. This fails OPEN on
 * purpose: "we cannot miss out on new leads" (Matt 2026-06-10) outranks tidy
 * defaults, so a newly-added alert kind reaches the broker until someone gives
 * it a category on purpose. lib/crm/broker-notify-prefs.test.ts pins the known
 * kinds so 'other' cannot quietly become the dumping ground.
 */
export function categoryForAlertKind(kind: string): BrokerAlertCategory {
  const k = String(kind ?? '').trim().toLowerCase()
  if (!k) return 'other'
  if (k === 'new-lead' || k.startsWith('new-lead:')) return 'new_lead'
  if (k.startsWith('return-visit:') || k.startsWith('looking-at:')) return 'return_visit'
  if (k.startsWith('cma-ready:')) return 'cma_ready'
  if (k.startsWith('task-reminder:') || k.startsWith('task-due:')) return 'task_due'
  if (k.startsWith('deal:')) return 'deal_activity'
  return 'other'
}

export type BrokerNotifyPrefs = {
  smsOptIn: boolean
  newLeads: boolean
  dealActivity: boolean
  taskDue: boolean
  returnVisit: boolean
  cmaReady: boolean
  /** Local-hour quiet window for internal alerts. Both null = no window. */
  quietStartHour: number | null
  quietEndHour: number | null
  /** Max alerts per rolling 24h. null = unlimited. */
  maxPerDay: number | null
}

/** Today's behaviour for a broker with no row / no preferences set. */
export const DEFAULT_BROKER_NOTIFY_PREFS: BrokerNotifyPrefs = {
  smsOptIn: false,
  newLeads: true,
  dealActivity: true,
  taskDue: true,
  returnVisit: true,
  cmaReady: true,
  quietStartHour: null,
  quietEndHour: null,
  maxPerDay: null,
}

/** Is this category switched on for the broker? 'health'/'other' are ungated. */
export function categoryEnabled(category: BrokerAlertCategory, prefs: BrokerNotifyPrefs): boolean {
  switch (category) {
    case 'new_lead': return prefs.newLeads
    case 'deal_activity': return prefs.dealActivity
    case 'task_due': return prefs.taskDue
    case 'return_visit': return prefs.returnVisit
    case 'cma_ready': return prefs.cmaReady
    case 'health':
    case 'other':
      return true
  }
}

/**
 * Is `hour` inside the broker's personal quiet window? Handles a window that
 * wraps midnight (e.g. 21 -> 7). A half-configured window (one bound null) is
 * treated as no window rather than guessing the missing edge.
 */
export function inBrokerQuietWindow(hour: number, prefs: BrokerNotifyPrefs): boolean {
  const start = prefs.quietStartHour
  const end = prefs.quietEndHour
  if (start == null || end == null) return false
  if (start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

export type BrokerAlertDecision =
  | { queue: false; reason: 'category_off' }
  | { queue: true; status: 'pending' | 'push_only'; reason: 'ok' | 'no_sms_opt_in' | 'quiet_window' | 'daily_cap' }

/**
 * Decide whether an alert queues, and on which channel.
 *
 * `hasPushDevice` matters only when the alert cannot text: without SMS and
 * without a push device there is nothing to deliver, so the caller skips the
 * row rather than parking an undeliverable one (W5.5 leg b).
 */
export function decideBrokerAlert(args: {
  category: BrokerAlertCategory
  prefs: BrokerNotifyPrefs
  /** Local hour 0-23 in the broker's market timezone. */
  hour: number
  /** Alerts already queued for this broker in the trailing 24h. */
  sentLast24h: number
  hasPushDevice: boolean
}): BrokerAlertDecision {
  const { category, prefs } = args

  // Ops alarms bypass every preference. A broken vital is not a notification.
  if (category === 'health') {
    return { queue: true, status: prefs.smsOptIn ? 'pending' : 'push_only', reason: 'ok' }
  }

  if (!categoryEnabled(category, prefs)) return { queue: false, reason: 'category_off' }

  const softMuted =
    inBrokerQuietWindow(args.hour, prefs) ||
    (prefs.maxPerDay != null && args.sentLast24h >= prefs.maxPerDay)

  if (!prefs.smsOptIn) {
    return args.hasPushDevice
      ? { queue: true, status: 'push_only', reason: 'no_sms_opt_in' }
      : { queue: false, reason: 'category_off' }
  }

  if (softMuted) {
    const reason = inBrokerQuietWindow(args.hour, prefs) ? 'quiet_window' : 'daily_cap'
    return { queue: true, status: 'push_only', reason }
  }

  return { queue: true, status: 'pending', reason: 'ok' }
}
