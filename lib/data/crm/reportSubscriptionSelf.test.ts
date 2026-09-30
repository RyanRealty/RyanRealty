import { beforeEach, describe, it, expect, vi } from 'vitest'

/**
 * The self-serve write (review 2026-09-30): it read the row, decided the stop
 * or restart from it, then upserted blind. A stop or a broker change landing
 * in between was overwritten by a write decided from the old state. Now the
 * write matches only the state it was decided from (on/off, the stop stamp,
 * updated_at), and a row that appeared meanwhile is left alone.
 */
const h = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  /** A write that lands between this call's read and its write. */
  race: null as ((row: Record<string, unknown> | null) => void) | null,
  timeline: [] as Record<string, unknown>[],
}))

function subsQuery() {
  const preds: Array<(r: Record<string, unknown>) => boolean> = []
  let patch: Record<string, unknown> | null = null
  const q = {
    select: () => q,
    update: (p: Record<string, unknown>) => ((patch = p), q),
    eq: (col: string, v: unknown) => (preds.push((r) => r[col] === v), q),
    is: (col: string, v: unknown) => (preds.push((r) => (v === null ? r[col] == null : r[col] === v)), q),
    maybeSingle: async () => {
      const out = h.row ? { ...h.row } : null
      if (h.race) {
        const race = h.race
        h.race = null
        race(h.row)
      }
      return { data: out, error: null }
    },
    upsert: async (row: Record<string, unknown>, opts: { ignoreDuplicates?: boolean }) => {
      if (h.row) {
        if (opts?.ignoreDuplicates) return { count: 0, error: null }
        Object.assign(h.row, row)
        return { count: 1, error: null }
      }
      h.row = { id: 1, ...row }
      return { count: 1, error: null }
    },
    then: (resolve: (v: unknown) => void) => {
      const hit = h.row && preds.every((p) => p(h.row!)) ? [h.row] : []
      if (patch) for (const r of hit) Object.assign(r, patch)
      resolve({ data: hit.map((r) => ({ id: r.id })), error: null })
    },
  }
  return q
}

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) =>
      table === 'crm_timeline' ? { insert: async (r: Record<string, unknown>) => (h.timeline.push(r), { error: null }) } : subsQuery(),
  }),
}))
vi.mock('@/lib/data/crm/getContactReportSubscriptions', () => ({
  buildMarketReportAreas: () => [{ slug: 'bend', label: 'Bend' }, { slug: 'redmond', label: 'Redmond' }],
  mapReportSubscriptionRow: (r: unknown) => r,
  normalizeReportFrequency: (f: unknown) => (f === 'weekly' || f === 'quarterly' ? f : 'monthly'),
}))
vi.mock('@/lib/data/crm/getSuppressionSignals', () => ({ getSuppressionSignals: async () => [] }))
vi.mock('@/lib/data/newsletter/perLead', () => ({ canUserResubscribe: () => ({ allowed: true }), getEmailKeyedSuppressionSignals: async () => [] }))

import { sanitizeSelfReportAreas, upsertSelfReportSubscription } from './reportSubscriptionSelf'

beforeEach(() => {
  h.row = null
  h.race = null
  h.timeline = []
})

describe('upsertSelfReportSubscription: a write decided from a stale read is refused (review 2026-09-30)', () => {
  it('turning reports off on a row a broker changed meanwhile writes nothing and asks her to reload', async () => {
    h.row = { id: 1, person_id: 7, is_active: true, stopped_at: null, source: 'self-serve', updated_at: '2026-09-30T10:00:00.000Z', areas: ['bend'] }
    h.race = (row) => Object.assign(row!, { frequency: 'weekly', updated_at: '2026-09-30T10:00:03.000Z' })
    const out = await upsertSelfReportSubscription(7, { areas: ['bend'], frequency: 'monthly', isActive: false })
    expect(out.data).toBeNull()
    expect(out.error).toContain('changed')
    expect(h.row).toMatchObject({ is_active: true, stopped_at: null })
    expect(h.timeline).toHaveLength(0)
  })

  it('a first save does not overwrite a row that appeared meanwhile', async () => {
    h.race = () => {
      h.row = { id: 2, person_id: 7, is_active: false, stopped_at: '2026-09-30T10:00:01.000Z', stopped_via: 'one-click', updated_at: '2026-09-30T10:00:01.000Z' }
    }
    const out = await upsertSelfReportSubscription(7, { areas: ['bend'], frequency: 'monthly', isActive: true })
    expect(out.error).toContain('changed')
    expect(h.row).toMatchObject({ is_active: false, stopped_via: 'one-click' })
  })

  it('a write decided from the row as it still is lands, and is logged', async () => {
    h.row = { id: 1, person_id: 7, is_active: true, stopped_at: null, source: 'self-serve', updated_at: '2026-09-30T10:00:00.000Z', areas: ['bend'] }
    const out = await upsertSelfReportSubscription(7, { areas: ['bend', 'redmond'], frequency: 'weekly', isActive: true })
    expect(out.error).toBeNull()
    expect(h.row).toMatchObject({ is_active: true, frequency: 'weekly', areas: ['bend', 'redmond'] })
    expect(h.timeline).toHaveLength(1)
  })
})

const VALID = new Set(['bend', 'redmond', 'sisters', 'sunriver'])

describe('sanitizeSelfReportAreas', () => {
  it('keeps only slugs present in the valid set', () => {
    expect(sanitizeSelfReportAreas(['bend', 'nowhere', 'redmond'], VALID)).toEqual(['bend', 'redmond'])
  })

  it('de-dupes while preserving first-seen order', () => {
    expect(sanitizeSelfReportAreas(['redmond', 'bend', 'redmond', 'bend'], VALID)).toEqual(['redmond', 'bend'])
  })

  it('trims whitespace before matching', () => {
    expect(sanitizeSelfReportAreas([' bend ', 'sisters'], VALID)).toEqual(['bend', 'sisters'])
  })

  it('drops non-string and empty entries', () => {
    expect(sanitizeSelfReportAreas(['bend', 42, null, undefined, '', '   '], VALID)).toEqual(['bend'])
  })

  it('returns empty for non-array input', () => {
    expect(sanitizeSelfReportAreas('bend', VALID)).toEqual([])
    expect(sanitizeSelfReportAreas(null, VALID)).toEqual([])
    expect(sanitizeSelfReportAreas({ 0: 'bend' }, VALID)).toEqual([])
  })

  it('returns empty when nothing is valid', () => {
    expect(sanitizeSelfReportAreas(['nowhere', 'els ewhere'], VALID)).toEqual([])
  })
})
