import { describe, expect, it } from 'vitest'
import {
  buildNationalRows,
  buildPulseSnapshotRows,
  NATIONAL_GEO,
  NATIONAL_METRICS,
  PULSE_METRICS,
  UPSERT_ON_CONFLICT,
  weekStartUtc,
  type PulseSnapshotSource,
} from './build-rows'
import { parseFredObservations, parsePmmsHistoryCsv } from '@/lib/market-national-series'

/** Fixture mirroring a real market_pulse_live city row (Bend-shaped values). */
const bendPulse: PulseSnapshotSource = {
  geo_type: 'city',
  geo_slug: 'bend',
  active_count: 788,
  new_count_7d: 54,
  pending_count: 231,
  price_reduction_share: 0.312,
  months_of_supply: 4.3,
  median_list_price: 849000,
  updated_at: '2026-07-20T12:48:11.204+00:00',
}

describe('weekStartUtc', () => {
  it('returns the same date for a Monday', () => {
    // 2026-07-20 is a Monday.
    expect(weekStartUtc(new Date('2026-07-20T13:00:00Z'))).toBe('2026-07-20')
  })

  it('maps every day of the week back to its Monday (Sunday included)', () => {
    expect(weekStartUtc(new Date('2026-07-21T00:00:00Z'))).toBe('2026-07-20') // Tue
    expect(weekStartUtc(new Date('2026-07-25T23:59:59Z'))).toBe('2026-07-20') // Sat
    expect(weekStartUtc(new Date('2026-07-26T12:00:00Z'))).toBe('2026-07-20') // Sun
    expect(weekStartUtc(new Date('2026-07-27T00:00:00Z'))).toBe('2026-07-27') // next Mon
  })

  it('crosses month boundaries correctly', () => {
    // 2026-08-01 is a Saturday -> its Monday is 2026-07-27.
    expect(weekStartUtc(new Date('2026-08-01T09:00:00Z'))).toBe('2026-07-27')
  })
})

describe('buildPulseSnapshotRows', () => {
  it('extracts one row per metric from a full pulse row', () => {
    const rows = buildPulseSnapshotRows('2026-07-20', [bendPulse])
    expect(rows).toHaveLength(PULSE_METRICS.length)
    const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r]))
    expect(byMetric.active_count.value).toBe(788)
    expect(byMetric.new_count_7d.value).toBe(54)
    expect(byMetric.pending_count.value).toBe(231)
    expect(byMetric.price_reduction_share.value).toBe(0.312)
    expect(byMetric.months_of_supply.value).toBe(4.3)
    expect(byMetric.median_list_price.value).toBe(849000)
    for (const r of rows) {
      expect(r.week_start).toBe('2026-07-20')
      expect(r.geo_type).toBe('city')
      expect(r.geo_slug).toBe('bend')
      expect(r.source).toBe('market_pulse_live')
      // Vintage is the pulse row's own refresh timestamp, not the run date.
      expect(r.observation_date).toBe('2026-07-20')
    }
  })

  it('leaves observation_date null when the pulse row has no usable updated_at', () => {
    const undated = buildPulseSnapshotRows('2026-07-20', [{ ...bendPulse, updated_at: null }])
    const garbage = buildPulseSnapshotRows('2026-07-20', [{ ...bendPulse, updated_at: 'not-a-date' }])
    // Never substitutes week_start or today — an invented vintage is worse
    // than an absent one (§0).
    for (const r of [...undated, ...garbage]) expect(r.observation_date).toBeNull()
    expect(undated).toHaveLength(PULSE_METRICS.length)
  })

  it('skips null metrics instead of zero-filling them', () => {
    const sparse: PulseSnapshotSource = {
      ...bendPulse,
      months_of_supply: null,
      median_list_price: null,
    }
    const rows = buildPulseSnapshotRows('2026-07-20', [sparse])
    const metrics = rows.map((r) => r.metric)
    expect(metrics).not.toContain('months_of_supply')
    expect(metrics).not.toContain('median_list_price')
    expect(rows).toHaveLength(PULSE_METRICS.length - 2)
  })

  it('coerces numeric-string values (Postgres numeric over the wire)', () => {
    const stringy = {
      ...bendPulse,
      months_of_supply: '4.3' as unknown as number,
    }
    const rows = buildPulseSnapshotRows('2026-07-20', [stringy])
    expect(rows.find((r) => r.metric === 'months_of_supply')?.value).toBe(4.3)
  })

  it('produces WoW-safe upsert keys: unique within a week, stable across reruns, distinct across weeks', () => {
    const geos: PulseSnapshotSource[] = [
      bendPulse,
      { ...bendPulse, geo_slug: 'redmond' },
      { ...bendPulse, geo_type: 'region', geo_slug: 'central-oregon' },
    ]
    const key = (r: { week_start: string; geo_type: string; geo_slug: string; metric: string }) =>
      `${r.week_start}|${r.geo_type}|${r.geo_slug}|${r.metric}`

    const run1 = buildPulseSnapshotRows('2026-07-20', geos)
    const keys1 = run1.map(key)
    // No duplicate conflict keys inside one run — one upsert batch never
    // collides with itself.
    expect(new Set(keys1).size).toBe(keys1.length)

    // A rerun in the same week regenerates the exact same key set (idempotent
    // overwrite, no appends).
    const run2 = buildPulseSnapshotRows('2026-07-20', geos)
    expect(run2.map(key)).toEqual(keys1)

    // The next week's run shares zero keys (append, never overwrite history).
    const run3 = buildPulseSnapshotRows('2026-07-27', geos)
    const keys3 = new Set(run3.map(key))
    expect(keys1.some((k) => keys3.has(k))).toBe(false)
  })

  it('conflict target matches the key columns used above', () => {
    expect(UPSERT_ON_CONFLICT).toBe('week_start,geo_type,geo_slug,metric')
  })
})

describe('buildNationalRows', () => {
  const mortgage = { value: 6.78, observationDate: '2026-07-16', source: 'fred:MORTGAGE30US' }
  const treasury = { value: 4.42, observationDate: '2026-07-17', source: 'fred:DGS10' }

  it('emits all three rows (spread computed and rounded) when both series exist', () => {
    const rows = buildNationalRows('2026-07-20', mortgage, treasury)
    expect(rows).toHaveLength(3)
    const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r]))
    expect(byMetric[NATIONAL_METRICS.mortgage30].value).toBe(6.78)
    expect(byMetric[NATIONAL_METRICS.treasury10].value).toBe(4.42)
    expect(byMetric[NATIONAL_METRICS.spread].value).toBe(2.36) // no float dust
    expect(byMetric[NATIONAL_METRICS.spread].source).toBe('computed:mortgage30-dgs10')
    for (const r of rows) {
      expect(r.geo_type).toBe(NATIONAL_GEO.geo_type)
      expect(r.geo_slug).toBe(NATIONAL_GEO.geo_slug)
    }
  })

  it('degrades per series: mortgage without treasury yields no spread', () => {
    const rows = buildNationalRows('2026-07-20', mortgage, null)
    expect(rows.map((r) => r.metric)).toEqual([NATIONAL_METRICS.mortgage30])
  })

  it('returns nothing when both series degraded', () => {
    expect(buildNationalRows('2026-07-20', null, null)).toEqual([])
  })

  it("keeps each provider's own observation date instead of the run's week_start", () => {
    const rows = buildNationalRows('2026-07-20', mortgage, treasury)
    const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r]))
    // week_start is the Monday the cron ran; the rate was observed the prior
    // Thursday. Publishing 2026-07-20 as the rate's date would overstate it.
    expect(byMetric[NATIONAL_METRICS.mortgage30].observation_date).toBe('2026-07-16')
    expect(byMetric[NATIONAL_METRICS.treasury10].observation_date).toBe('2026-07-17')
  })

  it('dates the spread to the OLDER of its two legs', () => {
    const rows = buildNationalRows('2026-07-20', mortgage, treasury)
    const spread = rows.find((r) => r.metric === NATIONAL_METRICS.spread)
    // A composite is only as current as its oldest input (mortgage 07-16).
    expect(spread?.observation_date).toBe('2026-07-16')

    // Order of freshness reversed — still the older leg, now the treasury.
    const staleTreasury = buildNationalRows('2026-07-20', mortgage, { ...treasury, observationDate: '2026-07-10' })
    expect(staleTreasury.find((r) => r.metric === NATIONAL_METRICS.spread)?.observation_date).toBe('2026-07-10')
  })

  it('nulls the spread vintage when either leg has no usable date', () => {
    const rows = buildNationalRows('2026-07-20', { ...mortgage, observationDate: '' }, treasury)
    const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r]))
    expect(byMetric[NATIONAL_METRICS.mortgage30].observation_date).toBeNull()
    // A half-known vintage is not a vintage — never fall back to the good leg.
    expect(byMetric[NATIONAL_METRICS.spread].observation_date).toBeNull()
    // The value itself still lands.
    expect(byMetric[NATIONAL_METRICS.spread].value).toBe(2.36)
  })
})

describe('parseFredObservations', () => {
  it('picks the newest valid observation and skips FRED "." missing markers', () => {
    const payload = {
      observations: [
        { date: '2026-07-17', value: '.' },
        { date: '2026-07-16', value: '6.78' },
        { date: '2026-07-09', value: '6.81' },
      ],
    }
    expect(parseFredObservations(payload)).toEqual({ date: '2026-07-16', value: 6.78 })
  })

  it('returns null on malformed payloads', () => {
    expect(parseFredObservations(null)).toBeNull()
    expect(parseFredObservations({})).toBeNull()
    expect(parseFredObservations({ observations: [{ date: '2026-07-16', value: '.' }] })).toBeNull()
  })
})

describe('parsePmmsHistoryCsv', () => {
  it('reads the last parseable pmms30 row and normalizes the date', () => {
    const csv = [
      'date,pmms30,pmms30p,pmms15,pmms15p,pmms51,pmms51p,pmms51m,pmms51spread',
      '7/9/2026,6.81, ,6.02, ,,,,',
      '7/16/2026,6.78, ,5.99, ,,,,',
      '7/23/2026,, ,, ,,,,', // future placeholder row with no rate yet
    ].join('\n')
    expect(parsePmmsHistoryCsv(csv)).toEqual({ date: '2026-07-16', value: 6.78 })
  })

  it('returns null when the header or data is unusable', () => {
    expect(parsePmmsHistoryCsv('')).toBeNull()
    expect(parsePmmsHistoryCsv('foo,bar\n1,2')).toBeNull()
  })
})
