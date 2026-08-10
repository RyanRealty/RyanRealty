import { describe, expect, it } from 'vitest'
import {
  buildGuestWatchFromFilters,
  buildGuestWatchFromPlace,
  GUEST_WATCH_TTL_MS,
  parseGuestWatch,
  serializeGuestWatch,
} from './guest-watch-residual'

describe('parseGuestWatch', () => {
  const now = 1_700_000_000_000

  it('accepts a safe residual', () => {
    const raw = serializeGuestWatch({
      label: 'Bend homes',
      href: '/homes-for-sale/bend',
      setAt: now - 1000,
    })
    expect(parseGuestWatch(raw, now)).toEqual({
      label: 'Bend homes',
      href: '/homes-for-sale/bend',
      setAt: now - 1000,
    })
  })

  it('rejects expired residual', () => {
    const raw = serializeGuestWatch({
      label: 'Bend homes',
      href: '/homes-for-sale/bend',
      setAt: now - GUEST_WATCH_TTL_MS - 1,
    })
    expect(parseGuestWatch(raw, now)).toBeNull()
  })

  it('rejects protocol-relative and absolute hrefs', () => {
    expect(
      parseGuestWatch(
        JSON.stringify({ label: 'x', href: '//evil.com', setAt: now }),
        now,
      ),
    ).toBeNull()
    expect(
      parseGuestWatch(
        JSON.stringify({ label: 'x', href: 'https://evil.com', setAt: now }),
        now,
      ),
    ).toBeNull()
    expect(
      parseGuestWatch(
        JSON.stringify({ label: 'x', href: 'javascript:alert(1)', setAt: now }),
        now,
      ),
    ).toBeNull()
  })

  it('rejects missing fields and junk JSON', () => {
    expect(parseGuestWatch('not-json', now)).toBeNull()
    expect(parseGuestWatch(JSON.stringify({ href: '/search', setAt: now }), now)).toBeNull()
    expect(parseGuestWatch(null, now)).toBeNull()
  })

  it('truncates long labels', () => {
    const long = 'A'.repeat(200)
    const parsed = parseGuestWatch(
      JSON.stringify({ label: long, href: '/search', setAt: now }),
      now,
    )
    expect(parsed?.label.length).toBeLessThanOrEqual(80)
    expect(parsed?.label.endsWith('…')).toBe(true)
  })
})

describe('buildGuestWatchFromFilters', () => {
  it('builds a city label and homes-for-sale href', () => {
    const r = buildGuestWatchFromFilters({ city: 'Bend' }, 1_700_000_000_000)
    expect(r.label.toLowerCase()).toContain('bend')
    expect(r.href).toMatch(/^\/homes-for-sale\//)
    expect(r.setAt).toBe(1_700_000_000_000)
  })
})

describe('buildGuestWatchFromPlace', () => {
  it('uses city + community when provided', () => {
    const r = buildGuestWatchFromPlace({
      communityName: 'Tetherow',
      city: 'Bend',
      subdivision: 'Tetherow',
      now: 1_700_000_000_000,
    })
    expect(r.label.length).toBeGreaterThan(0)
    expect(r.href.startsWith('/')).toBe(true)
    expect(r.href.startsWith('//')).toBe(false)
  })
})
