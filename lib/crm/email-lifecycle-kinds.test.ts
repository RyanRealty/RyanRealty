import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EMAIL_DELIVERED_KIND,
  EMAIL_LIFECYCLE_KINDS,
  isEmailLifecycleKind,
  mergeDeliveredRows,
  postgrestInList,
} from './email-lifecycle-kinds'

/** The kinds the newest crm_timeline_kind_check migration allows. */
function allowedTimelineKinds(): Set<string> {
  const dir = resolve('supabase/migrations')
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /add constraint crm_timeline_kind_check/i.test(readFileSync(resolve(dir, f), 'utf8')))
    .pop()
  if (!latest) throw new Error('no crm_timeline_kind_check migration')
  const sql = readFileSync(resolve(dir, latest), 'utf8')
  const body = /add constraint crm_timeline_kind_check[\s\S]*?array\[([\s\S]*?)\]/i.exec(sql)?.[1] ?? ''
  return new Set([...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!))
}

describe('crm_timeline_kind_check allows every lifecycle kind the code writes', () => {
  const allowed = allowedTimelineKinds()

  it('keeps every kind that was allowed before (20261002011238)', () => {
    for (const kind of [
      'note', 'email_in', 'email_out', 'email_cc', 'email_open', 'email_click',
      'sms_in', 'sms_out', 'sms_click', 'call', 'voicemail', 'web_event',
      'task', 'stage_change', 'system', 'lead_created', 'home_valuation',
      'subscribe_report', 'parsed_intent',
    ]) expect(allowed.has(kind), kind).toBe(true)
  })

  it('allows the four lifecycle kinds', () => {
    for (const kind of EMAIL_LIFECYCLE_KINDS) expect(allowed.has(kind), kind).toBe(true)
  })

  it('allows every kind the Resend webhook maps an event to', () => {
    const src = readFileSync(resolve('app/api/webhooks/resend/route.ts'), 'utf8')
    const map = /const TIMELINE_KIND[^{]*\{([\s\S]*?)\}/.exec(src)?.[1] ?? ''
    const kinds = [...map.matchAll(/:\s*'([a-z_]+)'/g)].map((m) => m[1]!)
    expect(kinds.length).toBe(6)
    for (const kind of kinds) expect(allowed.has(kind), kind).toBe(true)
  })

  it('allows the Gmail bounce row and the listing-alert unsubscribe row', () => {
    expect(readFileSync(resolve('lib/data/crm/gmailBounceWatch.ts'), 'utf8')).toContain("kind: 'email_bounce'")
    expect(readFileSync(resolve('lib/data/leads/listingAlerts.ts'), 'utf8')).toContain("kind: 'email_unsubscribe'")
    expect(allowed.has('email_bounce')).toBe(true)
    expect(allowed.has('email_unsubscribe')).toBe(true)
  })
})

describe('isEmailLifecycleKind', () => {
  it('is true for the four lifecycle kinds only', () => {
    for (const kind of EMAIL_LIFECYCLE_KINDS) expect(isEmailLifecycleKind(kind)).toBe(true)
    for (const kind of ['email_out', 'email_in', 'email_open', 'email_click', 'system', '', null, undefined]) {
      expect(isEmailLifecycleKind(kind)).toBe(false)
    }
  })

  it('names delivered as the high-volume kind', () => {
    expect(EMAIL_DELIVERED_KIND).toBe('email_delivered')
    expect(postgrestInList(['a', 'b'])).toBe('(a,b)')
  })
})

describe('mergeDeliveredRows', () => {
  const row = (id: string, ts: string) => ({ id, ts })

  it('merges newest first when the window is not full', () => {
    const out = mergeDeliveredRows([row('call', '2026-10-10T10:00:00Z')], [row('d1', '2026-10-14T14:00:00Z'), row('d0', '2026-09-01T14:00:00Z')], 100)
    expect(out.map((r) => r.id)).toEqual(['d1', 'call', 'd0'])
  })

  it('drops a delivery older than a full window, so no delivery sits past cut history', () => {
    const window = Array.from({ length: 3 }, (_, i) => row(`w${i}`, `2026-10-1${4 - i}T10:00:00Z`))
    const out = mergeDeliveredRows(window, [row('new', '2026-10-14T15:00:00Z'), row('old', '2026-10-01T10:00:00Z')], 3)
    expect(out.map((r) => r.id)).toEqual(['new', 'w0', 'w1', 'w2'])
  })

  it('returns the window untouched when there is nothing to merge', () => {
    const window = [row('a', '2026-10-14T10:00:00Z')]
    expect(mergeDeliveredRows(window, [], 100)).toBe(window)
  })
})
