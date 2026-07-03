import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  instrumentEmailHtml,
  isComplianceLink,
  signEmailToken,
  verifyEmailToken,
} from './email-tracking'

const CTX = { personId: 42, emailKey: 'manual:42:123', label: 'Hello' }

describe('signEmailToken / verifyEmailToken', () => {
  it('round-trips the full context', () => {
    const tok = signEmailToken({ ...CTX, url: 'https://ryan-realty.com/listings' })
    const out = verifyEmailToken(tok)
    expect(out).toEqual({
      personId: 42,
      emailKey: 'manual:42:123',
      label: 'Hello',
      url: 'https://ryan-realty.com/listings',
    })
  })

  it('rejects a tampered token', () => {
    const tok = signEmailToken(CTX)
    const [payload] = tok.split('.')
    const forged = Buffer.from(
      JSON.stringify({ p: 999, k: 'evil', l: '', u: 'https://evil.example' }),
    ).toString('base64url')
    expect(verifyEmailToken(`${forged}.${tok.split('.')[1]}`)).toBeNull()
    expect(verifyEmailToken(`${payload}.AAAA`)).toBeNull()
    expect(verifyEmailToken('garbage')).toBeNull()
    expect(verifyEmailToken(null)).toBeNull()
  })
})

describe('token TTL + broker (Phase 2 hardening)', () => {
  afterEach(() => vi.useRealTimers())

  it('stamps and round-trips the broker slug', () => {
    const ctx = verifyEmailToken(signEmailToken({ ...CTX, broker: 'rebecca' }))
    expect(ctx?.broker).toBe('rebecca')
  })

  it('omits broker when not provided', () => {
    const ctx = verifyEmailToken(signEmailToken(CTX))
    expect(ctx?.broker).toBeUndefined()
  })

  it('rejects a token whose TTL has expired, accepts one still live', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'))
    const tok = signEmailToken({ ...CTX, ttlSeconds: 3600 })
    expect(verifyEmailToken(tok)).not.toBeNull() // within the hour
    vi.setSystemTime(new Date('2026-07-03T02:00:00Z')) // +2h > 1h TTL
    expect(verifyEmailToken(tok)).toBeNull()
  })

  it('a token without a TTL never expires (backward compatible with sent mail)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'))
    const tok = signEmailToken(CTX)
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    expect(verifyEmailToken(tok)).not.toBeNull()
  })
})

describe('isComplianceLink', () => {
  it('matches every unsubscribe rail in the codebase', () => {
    expect(isComplianceLink('https://ryan-realty.com/newsletter/unsubscribe?token=x')).toBe(true)
    expect(isComplianceLink('https://ryan-realty.com/alerts/unsubscribe?token=x')).toBe(true)
    expect(isComplianceLink('https://ryan-realty.com/api/alerts/unsubscribe?token=x')).toBe(true)
    expect(isComplianceLink('https://ryan-realty.com/api/email/unsubscribe?t=x')).toBe(true)
    expect(isComplianceLink('https://example.com/?optout=1')).toBe(true)
    expect(isComplianceLink('https://ryan-realty.com/docs/oregon-initial-agency-disclosure-pamphlet.pdf')).toBe(true)
  })

  it('does not match ordinary links', () => {
    expect(isComplianceLink('https://ryan-realty.com/listings/123')).toBe(false)
    expect(isComplianceLink('https://ryan-realty.com/market-report')).toBe(false)
  })
})

describe('instrumentEmailHtml', () => {
  it('wraps ordinary links through the click tracker and appends the pixel', () => {
    const html = '<body><a href="https://ryan-realty.com/listings/123">See it</a></body>'
    const out = instrumentEmailHtml(html, CTX)
    expect(out).toContain('/api/track/e/click?t=')
    expect(out).not.toContain('href="https://ryan-realty.com/listings/123"')
    expect(out).toContain('/api/track/e/open?t=')
    // Pixel lands inside </body>.
    expect(out).toMatch(/<img [^>]*\/api\/track\/e\/open[^>]*\/>\s*<\/body>/)
    // The signed token still carries the original destination.
    const tokMatch = out.match(/click\?t=([^"]+)"/)
    const ctx = verifyEmailToken(decodeURIComponent(tokMatch![1]))
    expect(ctx?.url).toBe('https://ryan-realty.com/listings/123')
    expect(ctx?.personId).toBe(42)
  })

  it('NEVER wraps unsubscribe/compliance links (they stay plain)', () => {
    const unsub = 'https://ryan-realty.com/newsletter/unsubscribe?token=abc'
    const html = `<body><a href="https://ryan-realty.com/sell">Sell</a><a href="${unsub}">Unsubscribe</a></body>`
    const out = instrumentEmailHtml(html, CTX)
    expect(out).toContain(`href="${unsub}"`)
    expect(out).not.toContain('href="https://ryan-realty.com/sell"')
  })

  it('is idempotent — already-wrapped links are not double-wrapped', () => {
    const html = '<body><a href="https://ryan-realty.com/sell">Sell</a></body>'
    const once = instrumentEmailHtml(html, CTX)
    const twice = instrumentEmailHtml(once, CTX)
    const clicks = twice.match(/\/api\/track\/e\/click/g) ?? []
    expect(clicks.length).toBe(1)
  })

  it('appends the pixel even without a </body> tag', () => {
    const out = instrumentEmailHtml('<p>hi</p>', CTX)
    expect(out).toContain('/api/track/e/open?t=')
  })
})
