import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TZ,
  SITE_SUBMIT_SOURCES,
  SITE_SUBMIT_TAGS,
  classify,
  formatAge,
  inBusinessHours,
  isHumanTouch,
  isSiteSubmit,
  leadCreatedAt,
  hasProvenanceStamp,
  medianOf,
  responseClockStats,
  responseDueAt,
  wallPartsInMarket,
} from './response-clock'

/**
 * The predicate and the clock. Every case below is drawn from the live 28-day
 * crm_timeline taxonomy (read 2026-09-08) so the rule is tested against the rows
 * that actually exist, not invented ones.
 */

describe('isHumanTouch — against the live taxonomy', () => {
  it('counts a Gmail-synced email Matt actually wrote', () => {
    expect(
      isHumanTouch({ kind: 'email_out', source: 'gmail', broker: 'matt', payload: { gmailId: 'g1' } }),
    ).toBe(true)
  })

  it('counts a broker text sent from the CRM composer', () => {
    expect(isHumanTouch({ kind: 'sms_out', source: 'app', broker: 'matt', payload: { twilioSid: 'SM1' } })).toBe(true)
  })

  it('counts a logged call', () => {
    expect(isHumanTouch({ kind: 'call', source: 'twilio', broker: 'rebecca', payload: {} })).toBe(true)
  })

  it('rejects a drip email (source sequence)', () => {
    expect(isHumanTouch({ kind: 'email_out', source: 'sequence', broker: 'matt', payload: {} })).toBe(false)
  })

  it('rejects the Resend automation rail', () => {
    expect(isHumanTouch({ kind: 'email_out', source: 'automation', broker: 'matt', payload: {} })).toBe(false)
  })

  it('rejects a place-page confirmation even though the Gmail rail stamped source app + a broker', () => {
    expect(
      isHumanTouch({
        kind: 'email_out',
        source: 'app',
        broker: 'matt',
        payload: { purpose: 'place-page:valuation-confirmation', initiator: 'system' },
      }),
    ).toBe(false)
  })

  it('rejects a contact confirmation by purpose alone (initiator missing on an older row)', () => {
    expect(
      isHumanTouch({ kind: 'email_out', source: 'app', broker: 'matt', payload: { purpose: 'contact:confirmation' } }),
    ).toBe(false)
  })

  it('rejects the system initiator stamp even with an unknown purpose', () => {
    expect(
      isHumanTouch({ kind: 'sms_out', source: 'app', broker: 'matt', payload: { initiator: 'system' } }),
    ).toBe(false)
  })

  it('rejects an unattributed outbound row', () => {
    expect(isHumanTouch({ kind: 'email_out', source: 'gmail', broker: null, payload: {} })).toBe(false)
  })

  it('rejects lead-side and record-keeping kinds', () => {
    for (const kind of ['email_open', 'email_click', 'email_in', 'sms_in', 'note', 'lead_created', 'system', 'stage_change']) {
      expect(isHumanTouch({ kind, source: 'gmail', broker: 'matt', payload: {} })).toBe(false)
    }
  })

  it('rejects the broker-alert rail (a text to US, not to the lead)', () => {
    expect(isHumanTouch({ kind: 'email_out', source: 'broker-alert', broker: 'matt', payload: {} })).toBe(false)
  })

  it('rejects its own rows', () => {
    expect(isHumanTouch({ kind: 'email_out', source: 'response-clock', broker: 'matt', payload: {} })).toBe(false)
  })

  it('survives a non-object payload', () => {
    expect(isHumanTouch({ kind: 'call', source: 'twilio', broker: 'matt', payload: null })).toBe(true)
    expect(isHumanTouch({ kind: 'call', source: 'twilio', broker: 'matt', payload: 'nope' })).toBe(true)
  })
})

describe('SITE_SUBMIT_SOURCES — pinned against the action files', () => {
  // A mechanical lock, not a new gate script: rename a source string in one of
  // these actions and this test fails until the constant follows.
  const read = (p: string) => readFileSync(p, 'utf8')

  it.each([
    ['app/contact/actions.ts', "source: 'contact-form'"],
    ['app/actions/search-alert-capture.ts', "source: 'idx-registration'"],
    ['app/lp/expired-listing/actions.ts', "source: 'expired-lp'"],
    ['app/communities/[slug]/_v3/place-value-actions.ts', "source: 'place-page'"],
    ['app/actions/book-appointment.ts', 'website-booking'],
  ])('%s still writes %s', (file, literal) => {
    expect(read(file)).toContain(literal)
  })

  it('the seller LP still writes one of the two seller sources this list holds', () => {
    const src = read('app/lp/seller-home-value/actions.ts')
    expect(src).toContain("'seller-lp' | 'list-now-lp'")
    expect(SITE_SUBMIT_SOURCES).toContain('seller-lp')
    expect(SITE_SUBMIT_SOURCES).toContain('list-now-lp')
  })

  it('the buyer LP still writes source:buyer-lp', () => {
    expect(read('app/lp/buyer-listing-alerts/actions.ts')).toContain('buyer-lp')
  })

  it('does NOT include the bare site domain (a website sign-in asked us for nothing)', () => {
    expect(SITE_SUBMIT_SOURCES as readonly string[]).not.toContain('ryan-realty.com')
  })

  it('matches a person by source column or by source:* tag', () => {
    expect(isSiteSubmit({ personId: 1, source: 'contact-form' })).toBe(true)
    expect(isSiteSubmit({ personId: 1, source: 'ryan-realty.com', tags: ['audience:buyer', 'source:contact-form'] })).toBe(true)
    expect(isSiteSubmit({ personId: 1, source: 'ryan-realty.com', tags: ['audience:buyer'] })).toBe(false)
    expect(isSiteSubmit({ personId: 1, source: 'expired-listing-cron' })).toBe(false)
    expect(isSiteSubmit({ personId: 1, source: 'inbound-call' })).toBe(false)
  })

  it('every source has its matching tag', () => {
    expect(SITE_SUBMIT_TAGS).toEqual(SITE_SUBMIT_SOURCES.map((s) => `source:${s}`))
  })
})

describe('responseDueAt — 8am to 8pm Pacific', () => {
  it('uses the market clock, not the runner box', () => {
    expect(BUSINESS_TZ).toBe('America/Los_Angeles')
  })

  it('inside business hours: five minutes', () => {
    // 2026-09-08 10:00 PDT = 17:00Z
    const created = new Date('2026-09-08T17:00:00Z')
    expect(inBusinessHours(created)).toBe(true)
    expect(responseDueAt(created).toISOString()).toBe('2026-09-08T17:05:00.000Z')
  })

  it('19:59 Pacific is still inside; 20:00 is not', () => {
    expect(inBusinessHours(new Date('2026-09-09T02:59:00Z'))).toBe(true) // 19:59 PDT
    expect(inBusinessHours(new Date('2026-09-09T03:00:00Z'))).toBe(false) // 20:00 PDT
  })

  it('after 8pm: the next morning at 08:05 Pacific', () => {
    const created = new Date('2026-09-09T04:30:00Z') // 21:30 PDT on the 8th
    const due = responseDueAt(created)
    const p = wallPartsInMarket(due)
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 9, 9, 8, 5])
  })

  it('before 8am: the same morning at 08:05 Pacific', () => {
    const created = new Date('2026-09-08T13:30:00Z') // 06:30 PDT
    const p = wallPartsInMarket(responseDueAt(created))
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 9, 8, 8, 5])
  })

  it('crosses a month boundary at night', () => {
    const created = new Date('2026-10-01T05:00:00Z') // 22:00 PDT on Sep 30
    const p = wallPartsInMarket(responseDueAt(created))
    expect([p.month, p.day, p.hour]).toEqual([10, 1, 8])
  })

  it('spring forward: a 3am PST submit still resolves to 08:05 PDT the same day', () => {
    // 2026-03-08 is the US DST change. 11:00Z = 03:00 PST, before the 2am jump
    // has finished mattering for the 8am target.
    const p = wallPartsInMarket(responseDueAt(new Date('2026-03-08T11:00:00Z')))
    expect([p.month, p.day, p.hour, p.minute]).toEqual([3, 8, 8, 5])
  })

  it('fall back: a 10pm PDT submit on the changeover eve resolves to 08:05 PST', () => {
    // 2026-11-01 is the fall-back date; 2026-11-01T05:00:00Z = 22:00 PDT Oct 31.
    const due = responseDueAt(new Date('2026-11-01T05:00:00Z'))
    const p = wallPartsInMarket(due)
    expect([p.month, p.day, p.hour, p.minute]).toEqual([11, 1, 8, 5])
    // 08:05 PST is 16:05Z.
    expect(due.toISOString()).toBe('2026-11-01T16:05:00.000Z')
  })
})

describe('classify', () => {
  const created = '2026-09-08T17:00:00Z' // 10:00 PDT

  it('waiting inside the five-minute window', () => {
    const d = classify({ createdAt: created, now: '2026-09-08T17:02:00Z' })
    expect(d.state).toBe('waiting')
    expect(d.ageMinutes).toBe(2)
  })

  it('flag5m once the mark passes', () => {
    expect(classify({ createdAt: created, now: '2026-09-08T17:06:00Z' }).state).toBe('flag5m')
  })

  it('already-flagged when the 5m flag is on the record', () => {
    const d = classify({
      createdAt: created,
      now: '2026-09-08T17:30:00Z',
      flags: { flag5mAt: '2026-09-08T17:06:00Z' },
    })
    expect(d.state).toBe('already-flagged')
  })

  it('flag24h outranks the 5m flag once a day has passed', () => {
    const d = classify({
      createdAt: created,
      now: '2026-09-09T18:00:00Z',
      flags: { flag5mAt: '2026-09-08T17:06:00Z' },
    })
    expect(d.state).toBe('flag24h')
  })

  it('already-flagged once the 24h flag is on the record', () => {
    const d = classify({
      createdAt: created,
      now: '2026-09-09T20:00:00Z',
      flags: { flag5mAt: '2026-09-08T17:06:00Z', flag24hAt: '2026-09-09T18:00:00Z' },
    })
    expect(d.state).toBe('already-flagged')
  })

  it('touched outranks every flag state', () => {
    const d = classify({
      createdAt: created,
      now: '2026-09-10T20:00:00Z',
      firstHumanTouchAt: '2026-09-08T17:03:00Z',
      flags: { flag5mAt: '2026-09-08T17:06:00Z' },
    })
    expect(d.state).toBe('touched')
    expect(d.reason).toContain('2026-09-08T17:03:00Z')
  })

  it('an overnight submit is not flagged at 2am — the clock starts at 8am', () => {
    const night = '2026-09-09T06:00:00Z' // 23:00 PDT on the 8th
    expect(classify({ createdAt: night, now: '2026-09-09T06:30:00Z' }).state).toBe('waiting')
    // 08:06 PDT the next morning = 15:06Z
    expect(classify({ createdAt: night, now: '2026-09-09T15:06:00Z' }).state).toBe('flag5m')
  })
})

describe('responseClockStats', () => {
  const inHours = (iso: string) => ({ personId: 0, createdAt: iso })

  it('counts only leads created inside business hours in the median', () => {
    const leads = [
      { personId: 1, source: 'contact-form', createdAt: '2026-09-08T17:00:00Z' }, // 10:00 PDT
      { personId: 2, source: 'contact-form', createdAt: '2026-09-08T18:00:00Z' }, // 11:00 PDT
      { personId: 3, source: 'contact-form', createdAt: '2026-09-09T06:00:00Z' }, // 23:00 PDT — excluded
    ]
    const touches = new Map<number, string | null>([
      [1, '2026-09-08T17:02:00Z'], // 120s
      [2, '2026-09-08T18:10:00Z'], // 600s
      [3, '2026-09-09T06:00:30Z'], // 30s, out of hours: must not pull the median down
    ])
    const s = responseClockStats(leads, touches, '2026-09-09T20:00:00Z')
    expect(s.leads).toBe(2)
    expect(s.leadsAllHours).toBe(3)
    expect(s.contacted).toBe(2)
    expect(s.medianSeconds).toBe(360) // (120 + 600) / 2
  })

  it('counts an untouched lead older than 24 hours whatever hour it arrived', () => {
    const leads = [
      { personId: 1, source: 'seller-lp', createdAt: '2026-09-06T06:00:00Z' }, // out of hours
      { personId: 2, source: 'seller-lp', createdAt: '2026-09-08T17:00:00Z' },
    ]
    const s = responseClockStats(leads, new Map(), '2026-09-09T20:00:00Z')
    expect(s.untouchedOver24h).toBe(2)
    expect(s.medianSeconds).toBeNull()
    expect(s.contacted).toBe(0)
  })

  it('breaks down by source, biggest first', () => {
    const leads = [
      { personId: 1, source: 'contact-form', createdAt: '2026-09-08T17:00:00Z' },
      { personId: 2, source: 'contact-form', createdAt: '2026-09-08T18:00:00Z' },
      { personId: 3, source: 'place-page', createdAt: '2026-09-08T19:00:00Z' },
    ]
    const s = responseClockStats(leads, new Map([[1, '2026-09-08T17:01:00Z']]), '2026-09-08T20:00:00Z')
    expect(s.bySource.map((r) => [r.source, r.leads, r.contacted])).toEqual([
      ['contact-form', 2, 1],
      ['place-page', 1, 0],
    ])
    expect(s.bySource[0].medianSeconds).toBe(60)
    expect(s.bySource[1].medianSeconds).toBeNull()
  })

  it('reports how much of the median rests on unstamped rows', () => {
    // The /book appointment invite is the founding case: a system confirmation
    // on kind email_out, source 'app', broker 'matt', written before the rails
    // stamped provenance. It produced a 2-second "human touch" on 2026-08-26.
    const leads = [
      { personId: 1, source: 'website-booking', createdAt: '2026-09-08T17:00:00Z' },
      { personId: 2, source: 'contact-form', createdAt: '2026-09-08T18:00:00Z' },
    ]
    const s = responseClockStats(
      leads,
      new Map([
        [1, { ts: '2026-09-08T17:00:02Z', stamped: false }],
        [2, { ts: '2026-09-08T18:04:00Z', stamped: true }],
      ]),
      '2026-09-08T20:00:00Z',
    )
    expect(s.contacted).toBe(2)
    expect(s.unstampedTouches).toBe(1)
  })

  it('accepts a bare timestamp and treats it as unstamped, never as proven', () => {
    const s = responseClockStats(
      [{ personId: 1, source: 'contact-form', createdAt: '2026-09-08T17:00:00Z' }],
      new Map([[1, '2026-09-08T17:00:02Z']]),
      '2026-09-08T20:00:00Z',
    )
    expect(s.unstampedTouches).toBe(1)
  })

  it('labels a null source rather than dropping the lead', () => {
    const s = responseClockStats([{ personId: 1, source: null, createdAt: '2026-09-08T17:00:00Z' }], new Map(), '2026-09-08T18:00:00Z')
    expect(s.bySource[0].source).toBe('unspecified')
  })

  it('skips a lead with no parseable timestamp instead of counting it as instant', () => {
    const s = responseClockStats([{ personId: 1, createdAt: null, fubCreatedAt: null }], new Map(), '2026-09-08T18:00:00Z')
    expect(s.leadsAllHours).toBe(0)
  })

  it('falls back to fub_created_at', () => {
    expect(leadCreatedAt({ personId: 1, createdAt: null, fubCreatedAt: '2026-09-08T17:00:00Z' })?.toISOString()).toBe(
      '2026-09-08T17:00:00.000Z',
    )
    expect(responseClockStats([{ personId: 1, fubCreatedAt: '2026-09-08T17:00:00Z' }], new Map(), '2026-09-08T18:00:00Z').leads).toBe(1)
    expect(inHours('2026-09-08T17:00:00Z').createdAt).toBe('2026-09-08T17:00:00Z')
  })
})

describe('hasProvenanceStamp', () => {
  it('is true only when the rails wrote payload.initiator', () => {
    expect(hasProvenanceStamp({ payload: { initiator: 'broker' } })).toBe(true)
    expect(hasProvenanceStamp({ payload: { initiator: 'system' } })).toBe(true)
    expect(hasProvenanceStamp({ payload: { purpose: 'crm:manual-email' } })).toBe(false)
    expect(hasProvenanceStamp({ payload: null })).toBe(false)
    expect(hasProvenanceStamp({})).toBe(false)
  })
})

describe('medianOf / formatAge', () => {
  it('median is null on empty, exact on odd, rounded mean on even', () => {
    expect(medianOf([])).toBeNull()
    expect(medianOf([5, 1, 3])).toBe(3)
    expect(medianOf([1, 2, 3, 4])).toBe(3) // round((2+3)/2)
  })

  it('formats an age a broker can read', () => {
    expect(formatAge(7)).toBe('7 min')
    expect(formatAge(64)).toBe('1 hr 4 min')
    expect(formatAge(120)).toBe('2 hr')
    expect(formatAge(2880)).toBe('2 days')
  })
})
