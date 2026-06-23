import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service client BEFORE importing the module under test so the reader
// picks up the fake query builder. The pure picker is unaffected by the mock.
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import {
  pickFirstTouch,
  getFirstTouchAttribution,
  type FirstTouchSessionRow,
} from './getFirstTouchAttribution'

describe('pickFirstTouch (pure)', () => {
  it('returns null for an empty input', () => {
    expect(pickFirstTouch([])).toBeNull()
  })

  it('earliest row WITH utm_source wins over a later row with utm', () => {
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'june-blast',
        landing_page: 'https://ryan-realty.com/sell',
        first_seen_at: '2026-03-01T00:00:00Z',
      },
      {
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'seller-lead',
        landing_page: 'https://ryan-realty.com/lp/seller',
        first_seen_at: '2026-01-15T00:00:00Z',
      },
    ]
    const out = pickFirstTouch(sessions)
    expect(out).toEqual({
      source: 'facebook',
      medium: 'cpc',
      campaign: 'seller-lead',
      landingUrl: 'https://ryan-realty.com/lp/seller',
      firstSeenAt: '2026-01-15T00:00:00Z',
    })
  })

  it('earliest-with-utm wins even when an EARLIER row has no utm_source', () => {
    // The very first visit was organic (no utm); a later visit carried the
    // campaign. First-touch attribution surfaces the first utm-bearing visit,
    // not the bare organic landing.
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        landing_page: 'https://ryan-realty.com/',
        first_seen_at: '2026-01-01T00:00:00Z',
      },
      {
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: null,
        landing_page: 'https://ryan-realty.com/listings',
        first_seen_at: '2026-02-01T00:00:00Z',
      },
    ]
    const out = pickFirstTouch(sessions)
    expect(out?.source).toBe('google')
    expect(out?.medium).toBe('organic')
    expect(out?.landingUrl).toBe('https://ryan-realty.com/listings')
    expect(out?.firstSeenAt).toBe('2026-02-01T00:00:00Z')
  })

  it('treats a whitespace-only utm_source as no utm and trims a real one', () => {
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: '   ',
        utm_medium: 'email',
        utm_campaign: 'x',
        landing_page: 'https://ryan-realty.com/a',
        first_seen_at: '2026-01-10T00:00:00Z',
      },
      {
        utm_source: '  facebook  ',
        utm_medium: 'cpc',
        utm_campaign: 'seller',
        landing_page: 'https://ryan-realty.com/b',
        first_seen_at: '2026-01-20T00:00:00Z',
      },
    ]
    const out = pickFirstTouch(sessions)
    expect(out?.source).toBe('facebook')
    expect(out?.firstSeenAt).toBe('2026-01-20T00:00:00Z')
  })

  it('no row has utm: falls back to the EARLIEST landing url, no source', () => {
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        landing_page: 'https://ryan-realty.com/later',
        first_seen_at: '2026-05-01T00:00:00Z',
      },
      {
        utm_source: '',
        utm_medium: null,
        utm_campaign: null,
        landing_page: 'https://ryan-realty.com/first',
        first_seen_at: '2026-04-01T00:00:00Z',
      },
    ]
    const out = pickFirstTouch(sessions)
    expect(out).toEqual({
      source: null,
      medium: null,
      campaign: null,
      landingUrl: 'https://ryan-realty.com/first',
      firstSeenAt: '2026-04-01T00:00:00Z',
    })
  })

  it('is order-independent: unsorted input still picks the earliest utm row', () => {
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'c3',
        landing_page: 'https://ryan-realty.com/3',
        first_seen_at: '2026-03-03T00:00:00Z',
      },
      {
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'c1',
        landing_page: 'https://ryan-realty.com/1',
        first_seen_at: '2026-01-01T00:00:00Z',
      },
      {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'c2',
        landing_page: 'https://ryan-realty.com/2',
        first_seen_at: '2026-02-02T00:00:00Z',
      },
    ]
    expect(pickFirstTouch(sessions)?.source).toBe('facebook')
  })

  it('sorts a null first_seen_at last so it never wins the earliest slot', () => {
    const sessions: FirstTouchSessionRow[] = [
      {
        utm_source: 'nulltime',
        utm_medium: null,
        utm_campaign: null,
        landing_page: 'https://ryan-realty.com/null',
        first_seen_at: null,
      },
      {
        utm_source: 'realtime',
        utm_medium: 'cpc',
        utm_campaign: 'c',
        landing_page: 'https://ryan-realty.com/real',
        first_seen_at: '2026-01-01T00:00:00Z',
      },
    ]
    expect(pickFirstTouch(sessions)?.source).toBe('realtime')
  })
})

// --- Reader against a mocked PostgREST query builder -----------------------

function makeBuilder(rows: { data: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.or = chain
  builder.order = chain
  builder.limit = chain
  // The reader awaits the builder directly after .limit().
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(rows)
  return builder
}

describe('getFirstTouchAttribution reader (mocked client)', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('returns null without touching the DB when the identity has no usable key', async () => {
    const out = await getFirstTouchAttribution({ emails: [], sessionIds: [], fubPersonId: null, rrVid: null })
    expect(out).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('builds an OR filter across all four identity keys and returns the picked first-touch', async () => {
    let capturedOr = ''
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('visitor_sessions')
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.or = (clause: string) => {
        capturedOr = clause
        return builder
      }
      builder.order = chain
      builder.limit = chain
      ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({
          data: [
            {
              utm_source: 'facebook',
              utm_medium: 'cpc',
              utm_campaign: 'seller-lead',
              landing_page: 'https://ryan-realty.com/lp/seller',
              first_seen_at: '2026-01-15T00:00:00Z',
            },
          ],
          error: null,
        })
      return builder
    })

    const out = await getFirstTouchAttribution({
      emails: ['Lead@Example.com'],
      sessionIds: ['sess-1'],
      fubPersonId: 12345,
      rrVid: 'vid-abc',
    })

    expect(capturedOr).toContain('session_id.in.("sess-1")')
    expect(capturedOr).toContain('fub_person_id.eq.12345')
    expect(capturedOr).toContain('rr_vid.eq."vid-abc"')
    // email is lowercased into the filter.
    expect(capturedOr).toContain('identified_email.in.("lead@example.com")')
    expect(out).toEqual({
      source: 'facebook',
      medium: 'cpc',
      campaign: 'seller-lead',
      landingUrl: 'https://ryan-realty.com/lp/seller',
      firstSeenAt: '2026-01-15T00:00:00Z',
    })
  })

  it('returns null when the query errors or yields no rows', async () => {
    mockFrom.mockImplementation(() => makeBuilder({ data: [], error: null }))
    const out = await getFirstTouchAttribution({ fubPersonId: 999 })
    expect(out).toBeNull()
  })
})
