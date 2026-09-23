import { describe, expect, it } from 'vitest'
import { campaignDetailsParams, ga4SessionParams, parseVisit } from './ga4-visit'

const NOW = Date.UTC(2026, 8, 23, 18, 0, 0)
const NOW_S = Math.floor(NOW / 1000)

describe('parseVisit (TRACK-1)', () => {
  it('accepts a sane visit and keeps the start flag', () => {
    expect(parseVisit({ id: NOW_S - 60, number: 3, start: true }, NOW)).toEqual({ id: NOW_S - 60, number: 3, start: true })
    expect(parseVisit({ id: NOW_S, number: 1 }, NOW)).toEqual({ id: NOW_S, number: 1, start: false })
  })

  it('refuses future, week-old, non-integer or missing visits', () => {
    expect(parseVisit({ id: NOW_S + 3600, number: 1 }, NOW)).toBeNull()
    expect(parseVisit({ id: NOW_S - 8 * 86400, number: 1 }, NOW)).toBeNull()
    expect(parseVisit({ id: 1.5, number: 1 }, NOW)).toBeNull()
    expect(parseVisit({ id: NOW_S, number: 0 }, NOW)).toBeNull()
    expect(parseVisit(null, NOW)).toBeNull()
    expect(parseVisit('x', NOW)).toBeNull()
  })
})

describe('ga4SessionParams', () => {
  it('sends a numeric per-visit session id and the visit number', () => {
    expect(ga4SessionParams({ id: NOW_S, number: 4, start: false }, 'uuid')).toEqual({ session_id: NOW_S, session_number: 4 })
  })

  it('falls back to the old browser session id for cached clients', () => {
    expect(ga4SessionParams(null, '0f8fad5b-d9cb-469f-a165-70867728950e')).toEqual({
      session_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    })
  })
})

describe('campaignDetailsParams', () => {
  it('carries source / medium / campaign / content / term', () => {
    expect(
      campaignDetailsParams({ source: 'crm', medium: 'email', campaign: 'listing-alerts', content: 'agent-matt', term: 'x' }),
    ).toEqual({ source: 'crm', medium: 'email', campaign: 'listing-alerts', campaign_id: 'listing-alerts', content: 'agent-matt', term: 'x' })
  })

  it("maps the tracker's direct / none to GA4's (direct) / (none)", () => {
    expect(campaignDetailsParams({ source: 'direct', medium: 'none' })).toEqual({ source: '(direct)', medium: '(none)' })
  })

  it('returns null with nothing to attribute', () => {
    expect(campaignDetailsParams(undefined)).toBeNull()
    expect(campaignDetailsParams({ medium: 'email' })).toBeNull()
  })
})
