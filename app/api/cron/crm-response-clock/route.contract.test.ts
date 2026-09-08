import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { askOf, untouchedAlertBody, RESPONSE_CLOCK_WINDOW_HOURS } from '@/lib/crm/response-clock-run'
import { STALE_HOURS } from '@/lib/crm/response-clock'

/**
 * The wiring invariants for the response clock. The DECISIONS are unit-tested in
 * lib/crm/response-clock.test.ts; what can only be checked here is that the
 * route is authenticated, that it is actually scheduled, and that the body a
 * broker reads is the two-line shape Matt set on 2026-08-25.
 */

const route = readFileSync('app/api/cron/crm-response-clock/route.ts', 'utf8')

describe('the route', () => {
  it('is behind requireCronAuth, like every other cron', () => {
    expect(route).toContain("from '@/lib/auth/cron-auth'")
    expect(route).toContain('requireCronAuth(request)')
    // The guard returns early — an unauthenticated request must not reach the run.
    expect(route.indexOf('requireCronAuth')).toBeLessThan(route.indexOf('runResponseClock('))
  })

  it('supports ?dry=1, so a live run can be verified without waking a broker', () => {
    expect(route).toContain("get('dry') === '1'")
    expect(route).toContain('runResponseClock({ dry })')
  })

  it('is registered in vercel.json on the five-minute schedule', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }
    const cron = vercel.crons.find((c) => c.path === '/api/cron/crm-response-clock')
    expect(cron).toBeDefined()
    expect(cron?.schedule).toBe('*/5 * * * *')
  })

  it('looks back further than the 24-hour rule, so nothing ages out unflagged', () => {
    expect(RESPONSE_CLOCK_WINDOW_HOURS).toBeGreaterThan(STALE_HOURS)
  })
})

describe('the broker alert body', () => {
  it('is two lines: what happened, then the labelled link (Matt 2026-08-25)', () => {
    const body = untouchedAlertBody({ name: 'Dana Reed', ask: 'a valuation', personId: 4242, ageMinutes: 7 })
    const lines = body.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Untouched 7 min: Dana Reed asked for a valuation')
    expect(lines[1]).toBe('View lead: https://ryan-realty.com/admin/people/4242')
  })

  it('names an unknown lead rather than printing null', () => {
    expect(untouchedAlertBody({ name: null, ask: 'listing alerts', personId: 1, ageMinutes: 90 })).toContain(
      'Untouched 1 hr 30 min: Someone asked for listing alerts',
    )
  })

  it('uses the canonical host — the vercel alias strips auth cookies', () => {
    expect(untouchedAlertBody({ name: 'X', ask: 'a valuation', personId: 1, ageMinutes: 6 })).toContain(
      'https://ryan-realty.com/admin/people/1',
    )
  })
})

describe('askOf — what the broker is being woken for', () => {
  it('names the address on a seller valuation', () => {
    expect(askOf({ source: 'seller-lp', tags: ['audience:seller'], custom: { sellerPropertyAddress: '123 NW Franklin Ave' } })).toBe(
      'what 123 NW Franklin Ave is worth',
    )
  })

  it('falls back to the plain word when intake stamped no address', () => {
    expect(askOf({ source: 'place-page', tags: ['audience:seller'] })).toBe('a valuation')
    expect(askOf({ source: 'seller-lp', tags: [], custom: { sellerPropertyAddress: 'unspecified' } })).toBe('a valuation')
  })

  it('calls an expired listing what it is', () => {
    expect(askOf({ source: 'expired-lp', tags: ['intent:expired-listing', 'audience:seller'] })).toBe(
      'help with an expired listing',
    )
    expect(
      askOf({ source: 'expired-lp', tags: ['intent:expired-listing'], custom: { sellerPropertyAddress: '9 Pine St' } }),
    ).toBe('help with 9 Pine St, an expired listing')
  })

  it('separates alerts, bookings and plain questions', () => {
    expect(askOf({ source: 'idx-registration', tags: ['audience:buyer'] })).toBe('listing alerts')
    expect(askOf({ source: 'website-booking' })).toBe('a time on the calendar')
    expect(askOf({ source: 'contact-form', tags: ['audience:buyer'] })).toBe('to talk to a broker')
  })

  it('reads a source:* tag when the source column is the bare site domain', () => {
    expect(askOf({ source: 'ryan-realty.com', tags: ['source:idx-registration'] })).toBe('listing alerts')
  })
})
