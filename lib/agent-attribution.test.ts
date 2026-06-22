import { describe, it, expect } from 'vitest'
import {
  normalizeAgentSlug,
  parseAgentAttributionCookie,
  FUB_USER_ID_BY_BROKER,
  BROKER_EMAIL_BY_SLUG,
} from './agent-attribution'

// Lead routing depends on resolving the ?agent= slug to a canonical broker.
// Wrong mapping → a lead lands on the wrong broker. Audit p3.2.
describe('agent attribution (lead routing)', () => {
  describe('normalizeAgentSlug', () => {
    it('maps every variant to the canonical short slug', () => {
      expect(normalizeAgentSlug('matt')).toBe('matt')
      expect(normalizeAgentSlug('matt-ryan')).toBe('matt')
      expect(normalizeAgentSlug('rebecca-peterson')).toBe('rebecca')
      expect(normalizeAgentSlug('paul-stevenson')).toBe('paul')
    })
    it('is case-insensitive and trims', () => {
      expect(normalizeAgentSlug('REBECCA')).toBe('rebecca')
      expect(normalizeAgentSlug('  paul  ')).toBe('paul')
    })
    it('returns null for unknown/empty', () => {
      expect(normalizeAgentSlug('nobody')).toBeNull()
      expect(normalizeAgentSlug(null)).toBeNull()
      expect(normalizeAgentSlug('')).toBeNull()
    })
  })

  describe('parseAgentAttributionCookie', () => {
    it('parses the JSON payload AgentAttributionBridge writes', () => {
      const cookie = encodeURIComponent(JSON.stringify({ slug: 'rebecca', capturedAt: '2026-06-22' }))
      expect(parseAgentAttributionCookie(cookie)).toBe('rebecca')
    })
    it('falls back to a plain-slug cookie (older format)', () => {
      expect(parseAgentAttributionCookie('paul-stevenson')).toBe('paul')
    })
    it('returns null for undefined', () => {
      expect(parseAgentAttributionCookie(undefined)).toBeNull()
    })
  })

  it('FUB user-id + email maps are correct', () => {
    expect(FUB_USER_ID_BY_BROKER).toEqual({ matt: 1, rebecca: 2, paul: 3 })
    expect(BROKER_EMAIL_BY_SLUG.matt).toBe('matt@ryan-realty.com')
    expect(BROKER_EMAIL_BY_SLUG.rebecca).toBe('rebeccapeterson@ryan-realty.com')
    expect(BROKER_EMAIL_BY_SLUG.paul).toBe('paul@ryan-realty.com')
  })
})
