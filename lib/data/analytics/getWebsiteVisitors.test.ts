import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase, type Chain } from '@/test/fake-supabase-chain'
import type { WebsiteSessionRow } from './getWebsiteVisitors'

let answer: (chain: Chain) => unknown = () => ({ data: [], error: null })
const fake = fakeSupabase((c) => answer(c))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => fake.client }))
vi.mock('@/lib/data/cache/next-cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { getWebsiteVisitors, summarizeAudience, summarizePeriod } = await import('./getWebsiteVisitors')

function row(p: Partial<WebsiteSessionRow>): WebsiteSessionRow {
  return {
    session_id: p.session_id ?? Math.random().toString(36).slice(2),
    rr_vid: p.rr_vid === undefined ? `vid-${Math.random()}` : p.rr_vid,
    first_seen_at: p.first_seen_at ?? '2026-10-08T12:00:00.000Z',
    is_automated: p.is_automated ?? false,
    ip_country: p.ip_country ?? null,
    ip_region: p.ip_region ?? null,
    ip_city: p.ip_city ?? null,
    intent_tags: p.intent_tags ?? [],
    engagement_score: p.engagement_score ?? 0,
  }
}

describe('summarizePeriod', () => {
  it('counts visits, browsers, return visitors and engaged visits; automation stays out', () => {
    const p = summarizePeriod([
      row({ rr_vid: 'a', engagement_score: 25 }),
      row({ rr_vid: 'a', engagement_score: 3 }),
      row({ rr_vid: 'b', engagement_score: 20 }),
      row({ rr_vid: null }),
      row({ rr_vid: 'bot', is_automated: true, engagement_score: 99 }),
    ])
    expect(p).toEqual({ visits: 4, engagedVisits: 2, visitors: 3, cameBack: 1, automatedLeftOut: 1, withoutBrowserId: 1 })
  })
})

describe('summarizeAudience', () => {
  it('buckets places and intent, with engaged counts beside visits', () => {
    const a = summarizeAudience([
      row({ ip_country: 'US', ip_region: 'OR', ip_city: 'Bend', engagement_score: 30, intent_tags: ['seller_intent'] }),
      row({ ip_country: 'US', ip_region: 'OR', ip_city: 'Bend', intent_tags: ['listing_viewer'] }),
      row({ ip_country: 'US', ip_region: 'OR', ip_city: 'Portland' }),
      row({ ip_country: 'US', ip_region: 'CA', ip_city: 'Santa Clara' }),
      row({ ip_country: 'MX', ip_city: 'Mexico City' }),
      row({}),
      row({ ip_country: 'US', ip_region: 'OR', ip_city: 'Bend', is_automated: true }),
    ])
    const b = Object.fromEntries(a.geo.buckets.map((x) => [x.bucket, [x.visits, x.engaged]]))
    expect(b).toEqual({
      central_oregon: [2, 1],
      rest_of_oregon: [1, 0],
      other_states: [1, 0],
      other_countries: [1, 0],
      unknown: [1, 0],
    })
    expect(a.geo.located).toBe(5)
    expect(a.geo.topCities[0]).toMatchObject({ label: 'Bend, OR', visits: 2, engaged: 1, bucket: 'central_oregon' })
    expect(a.geo.topStates.map((s) => [s.label, s.visits])).toEqual([
      ['Oregon', 3],
      ['California', 1],
    ])
    expect(a.geo.topCountries.map((c) => c.label)).toEqual(['Mexico'])
    const intent = Object.fromEntries(a.intent.map((i) => [i.intent, i.visits]))
    expect(intent).toEqual({ buyer: 0, seller: 1, both: 0, browsing: 1, unknown: 4 })
  })
})

describe('getWebsiteVisitors — the read', () => {
  const current = { startIso: '2026-10-07T00:00:00.000Z', endIso: '2026-10-13T23:59:59.999Z' }
  const previous = { startIso: '2026-09-30T00:00:00.000Z', endIso: '2026-10-06T23:59:59.999Z' }

  beforeEach(() => {
    fake.chains.length = 0
  })

  it('fetches people only, counts automation without fetching it, and splits the two windows', async () => {
    const people = [
      row({ first_seen_at: '2026-10-08T01:00:00.000Z', rr_vid: 'x' }),
      row({ first_seen_at: '2026-10-09T01:00:00.000Z', rr_vid: 'x' }),
      row({ first_seen_at: '2026-10-02T01:00:00.000Z', rr_vid: 'y' }),
    ]
    answer = (c) => {
      const head = c.calls.find((k) => k.method === 'select')?.args[1] as { head?: boolean } | undefined
      const automated = c.calls.find((k) => k.method === 'eq' && k.args[0] === 'is_automated')?.args[1]
      if (head?.head) {
        if (automated === false) return { count: people.length, error: null }
        const since = c.calls.find((k) => k.method === 'gte')?.args[1]
        return { count: since === current.startIso ? 40 : 70, error: null }
      }
      return { data: people, error: null }
    }
    const v = await getWebsiteVisitors({ current, previous })
    expect(v.unreadable).toBe(false)
    expect(v.current).toMatchObject({ visits: 2, visitors: 1, cameBack: 1, automatedLeftOut: 40 })
    expect(v.previous).toMatchObject({ visits: 1, automatedLeftOut: 70 })
    // The row read asks for people only, over both windows, in a total order.
    const rowRead = fake.chains.find((c) => !c.calls.some((k) => k.method === 'select' && (k.args[1] as { head?: boolean })?.head))!
    expect(rowRead.table).toBe('visitor_sessions')
    expect(rowRead.calls).toContainEqual({ method: 'eq', args: ['is_automated', false] })
    expect(rowRead.calls).toContainEqual({ method: 'gte', args: ['first_seen_at', previous.startIso] })
    expect(rowRead.calls).toContainEqual({ method: 'lte', args: ['first_seen_at', current.endIso] })
    expect(rowRead.calls.filter((k) => k.method === 'order').map((k) => k.args[0])).toEqual(['first_seen_at', 'session_id'])
  })

  it('says it could not read instead of returning zeros', async () => {
    answer = () => ({ data: null, count: null, error: { message: 'timeout' } })
    const v = await getWebsiteVisitors({ current, previous })
    expect(v.unreadable).toBe(true)
    expect(v.errorMessage).toMatch(/timeout/)
  })
})
