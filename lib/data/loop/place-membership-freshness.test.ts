import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PLACE_MEMBERSHIP_STALE_HOURS,
  classifyPlaceMembershipFreshness,
  formatPlaceMembershipLine,
  readPlaceMembershipFreshness,
  type PlaceMembershipFreshness,
} from './place-membership-freshness'

const NOW = new Date('2026-09-23T01:00:00.000Z')

type Result = { data: unknown; error: { message: string } | null }

/** Minimal chainable stub: each table resolves to a fixed result. */
function stubClient(results: Record<string, Result>): SupabaseClient {
  const builder = (table: string) => {
    const result = results[table] ?? { data: null, error: { message: `no stub for ${table}` } }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) chain[m] = () => chain
    chain.limit = () => Promise.resolve(result)
    chain.maybeSingle = () => Promise.resolve(result)
    return chain
  }
  return { from: builder } as unknown as SupabaseClient
}

describe('classifyPlaceMembershipFreshness', () => {
  it('is fresh inside 48 hours and stale past it', () => {
    expect(PLACE_MEMBERSHIP_STALE_HOURS).toBe(48)
    expect(classifyPlaceMembershipFreshness('2026-09-22T01:00:00.000Z', NOW)).toEqual({ freshness: 'fresh', ageHours: 24 })
    expect(classifyPlaceMembershipFreshness('2026-09-21T01:00:00.000Z', NOW).freshness).toBe('fresh')
    expect(classifyPlaceMembershipFreshness('2026-09-21T00:59:00.000Z', NOW).freshness).toBe('stale')
  })

  it('reads the 2026-08-23 freeze as stale', () => {
    // The newest row the table held on 2026-09-23 before the P9 backfill.
    const c = classifyPlaceMembershipFreshness('2026-08-23T21:32:49.443259+00:00', NOW)
    expect(c.freshness).toBe('stale')
    expect(c.ageHours).toBeGreaterThan(24 * 29)
  })

  it('is unknown, not fresh, when there is no timestamp', () => {
    expect(classifyPlaceMembershipFreshness(null, NOW)).toEqual({ freshness: 'unknown', ageHours: null })
    expect(classifyPlaceMembershipFreshness('not a date', NOW)).toEqual({ freshness: 'unknown', ageHours: null })
  })
})

describe('readPlaceMembershipFreshness', () => {
  it('prefers the mv_refresh_state stamp the pg_cron job writes', async () => {
    const sb = stubClient({
      mv_refresh_state: { data: { refreshed_at: '2026-09-23T00:54:00.000Z' }, error: null },
      place_membership: { data: [{ computed_at: '2026-08-23T21:32:49Z' }], error: null },
    })
    const r = await readPlaceMembershipFreshness(sb, NOW)
    expect(r.status).toBe('ok')
    expect(r.freshness).toBe('fresh')
    expect(r.newestAt).toBe('2026-09-23T00:54:00.000Z')
    expect(r.source).toContain('mv_refresh_state')
  })

  it('falls back to the newest membership row when no stamp exists', async () => {
    const sb = stubClient({
      mv_refresh_state: { data: null, error: null },
      place_membership: { data: [{ computed_at: '2026-08-23T21:32:49Z' }], error: null },
    })
    const r = await readPlaceMembershipFreshness(sb, NOW)
    expect(r.freshness).toBe('stale')
    expect(r.newestAt).toBe('2026-08-23T21:32:49Z')
    expect(r.source).toContain('place_membership')
  })

  it('reports unreadable, never fresh, when the table cannot be read', async () => {
    const sb = stubClient({
      mv_refresh_state: { data: null, error: null },
      place_membership: { data: null, error: { message: 'timeout' } },
    })
    const r = await readPlaceMembershipFreshness(sb, NOW)
    expect(r.status).toBe('unreadable')
    expect(r.freshness).toBe('unknown')
  })
})

describe('formatPlaceMembershipLine — the SCOREBOARD HEADLINE line (WP5 item f)', () => {
  const base: PlaceMembershipFreshness = {
    status: 'ok',
    freshness: 'fresh',
    newestAt: '2026-09-23T00:54:00.000Z',
    ageHours: 0.1,
    source: "mv_refresh_state mv_name='place_membership' (refresh_place_membership_changed)",
  }

  it('reads fresh plainly, with the real age', () => {
    expect(formatPlaceMembershipLine(base)).toBe(
      "fresh 0.1h old (refreshed 2026-09-23T00:54:00.000Z)",
    )
  })

  it('reads STALE, capitalized, with the age and the 48h limit — never silently fresh', () => {
    const stale: PlaceMembershipFreshness = { ...base, freshness: 'stale', ageHours: 74.2 }
    expect(formatPlaceMembershipLine(stale)).toBe(
      `STALE 74.2h old, limit ${PLACE_MEMBERSHIP_STALE_HOURS}h (refreshed 2026-09-23T00:54:00.000Z)`,
    )
  })

  it('reads UNKNOWN, never 0h and never fresh, when there is no timestamp to classify', () => {
    const unknown: PlaceMembershipFreshness = {
      status: 'ok',
      freshness: 'unknown',
      newestAt: null,
      ageHours: null,
      source: 'place_membership max(computed_at) by row read (no mv_refresh_state stamp yet)',
    }
    const line = formatPlaceMembershipLine(unknown)
    expect(line).toBe('UNKNOWN (place_membership max(computed_at) by row read (no mv_refresh_state stamp yet))')
    expect(line).not.toContain('0h')
    // Not "startsWith('fresh')" — the source text legitimately says
    // "mv_refresh_state" / "refreshed", it must just never be reported AS fresh.
    expect(line.startsWith('fresh')).toBe(false)
    expect(line.startsWith('UNKNOWN')).toBe(true)
  })

  it('reads UNKNOWN, not unreadable-as-fresh, when the table cannot be read at all', () => {
    const unreadable: PlaceMembershipFreshness = {
      status: 'unreadable',
      freshness: 'unknown',
      newestAt: null,
      ageHours: null,
      source: 'place_membership.computed_at unreadable: timeout',
    }
    expect(formatPlaceMembershipLine(unreadable)).toBe('UNKNOWN (place_membership.computed_at unreadable: timeout)')
  })
})
