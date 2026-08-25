import { describe, it, expect } from 'vitest'
import {
  categoryForAlertKind,
  decideBrokerAlert,
  inBrokerQuietWindow,
  DEFAULT_BROKER_NOTIFY_PREFS,
  type BrokerNotifyPrefs,
} from './broker-notify-prefs'

const prefs = (over: Partial<BrokerNotifyPrefs> = {}): BrokerNotifyPrefs => ({
  ...DEFAULT_BROKER_NOTIFY_PREFS,
  smsOptIn: true,
  ...over,
})

const decide = (over: Partial<Parameters<typeof decideBrokerAlert>[0]> = {}) =>
  decideBrokerAlert({
    category: 'new_lead',
    prefs: prefs(),
    hour: 12,
    sentLast24h: 0,
    hasPushDevice: false,
    ...over,
  })

describe('categoryForAlertKind', () => {
  // Pins the kinds that actually fire in production (crm_timeline,
  // source='broker-alert'). A new kind landing in 'other' is UNGATED, so this
  // table is the guard against 'other' quietly becoming the dumping ground.
  it.each([
    ['new-lead', 'new_lead'],
    ['return-visit:2026-08-03', 'return_visit'],
    ['looking-at:sess:220227617', 'return_visit'],
    ['cma-ready:some-slug', 'cma_ready'],
    ['task-reminder:2026-08-25', 'task_due'],
    ['deal:stage-change', 'deal_activity'],
  ] as const)('maps %s -> %s', (kind, expected) => {
    expect(categoryForAlertKind(kind)).toBe(expected)
  })

  it('is case- and whitespace-insensitive', () => {
    expect(categoryForAlertKind('  NEW-LEAD  ')).toBe('new_lead')
  })

  it('falls open to "other" for an unknown kind', () => {
    expect(categoryForAlertKind('something-new')).toBe('other')
    expect(categoryForAlertKind('')).toBe('other')
  })
})

describe('inBrokerQuietWindow', () => {
  it('is false when no window is configured', () => {
    expect(inBrokerQuietWindow(3, prefs())).toBe(false)
  })

  it('handles a same-day window', () => {
    const p = prefs({ quietStartHour: 12, quietEndHour: 14 })
    expect(inBrokerQuietWindow(11, p)).toBe(false)
    expect(inBrokerQuietWindow(12, p)).toBe(true)
    expect(inBrokerQuietWindow(13, p)).toBe(true)
    expect(inBrokerQuietWindow(14, p)).toBe(false) // end is exclusive
  })

  it('handles a window that wraps midnight', () => {
    const p = prefs({ quietStartHour: 21, quietEndHour: 7 })
    expect(inBrokerQuietWindow(22, p)).toBe(true)
    expect(inBrokerQuietWindow(3, p)).toBe(true)
    expect(inBrokerQuietWindow(7, p)).toBe(false)
    expect(inBrokerQuietWindow(12, p)).toBe(false)
  })

  it('treats a half-configured window as no window', () => {
    expect(inBrokerQuietWindow(3, prefs({ quietStartHour: 21 }))).toBe(false)
    expect(inBrokerQuietWindow(3, prefs({ quietEndHour: 7 }))).toBe(false)
  })
})

describe('decideBrokerAlert', () => {
  it('texts an opted-in broker for an enabled category', () => {
    expect(decide()).toEqual({ queue: true, status: 'pending', reason: 'ok' })
  })

  it('drops the alert when the category is switched off', () => {
    // THE REGRESSION THIS FILE EXISTS FOR: before 2026-08-25 this returned a
    // text regardless, because no send path read notify_new_leads.
    expect(decide({ prefs: prefs({ newLeads: false }) })).toEqual({
      queue: false,
      reason: 'category_off',
    })
  })

  it.each([
    ['return_visit', 'returnVisit'],
    ['cma_ready', 'cmaReady'],
    ['task_due', 'taskDue'],
    ['deal_activity', 'dealActivity'],
  ] as const)('honours the %s switch', (category, key) => {
    expect(decide({ category, prefs: prefs({ [key]: false }) }).queue).toBe(false)
    expect(decide({ category, prefs: prefs({ [key]: true }) }).queue).toBe(true)
  })

  it('never gates an ops health alarm', () => {
    const silenced = prefs({
      newLeads: false,
      quietStartHour: 0,
      quietEndHour: 23,
      maxPerDay: 1,
    })
    expect(decide({ category: 'health', prefs: silenced, hour: 3, sentLast24h: 99 })).toEqual({
      queue: true,
      status: 'pending',
      reason: 'ok',
    })
  })

  it('never gates an uncategorised kind', () => {
    expect(decide({ category: 'other', prefs: prefs({ newLeads: false }) }).queue).toBe(true)
  })

  it('downgrades to push inside the quiet window rather than dropping', () => {
    // A preference may silence a text. It may never lose a lead.
    expect(
      decide({ prefs: prefs({ quietStartHour: 21, quietEndHour: 7 }), hour: 23 }),
    ).toEqual({ queue: true, status: 'push_only', reason: 'quiet_window' })
  })

  it('downgrades to push once the daily cap is reached', () => {
    expect(decide({ prefs: prefs({ maxPerDay: 5 }), sentLast24h: 5 })).toEqual({
      queue: true,
      status: 'push_only',
      reason: 'daily_cap',
    })
    const underCap = decide({ prefs: prefs({ maxPerDay: 5 }), sentLast24h: 4 })
    expect(underCap).toEqual({ queue: true, status: 'pending', reason: 'ok' })
  })

  it('parks a push-capable broker who has not opted into SMS', () => {
    expect(decide({ prefs: prefs({ smsOptIn: false }), hasPushDevice: true })).toEqual({
      queue: true,
      status: 'push_only',
      reason: 'no_sms_opt_in',
    })
  })

  it('skips a broker with neither SMS nor a push device', () => {
    expect(decide({ prefs: prefs({ smsOptIn: false }), hasPushDevice: false }).queue).toBe(false)
  })
})
