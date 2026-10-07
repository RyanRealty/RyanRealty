import { describe, expect, it } from 'vitest'
import { MIN_COMPS } from '@/lib/cma/comps'
import { recommendationGapHold } from '@/lib/cma/gap-hold'
import type { Ring } from '@/lib/geo/project-svg'
import {
  FLEET_MIN_COMPS_DEFAULT,
  diffAgainstStored,
  diffFleet,
  firstReasonLine,
  fleetExitCode,
  headline,
  median,
  parseDryRunStdout,
  parseFleetArgs,
  ruleThreeHold,
  scoreHome,
  selectHomes,
  storedLine,
  subjectInsideCity,
  type DryRunLike,
  type FleetConfig,
  type FleetRun,
  type HomeScore,
  type QueueRowLike,
  type SelectedHome,
} from '@/lib/cma/fleet-score'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function cfg(over: Partial<FleetConfig> = {}): FleetConfig {
  const parsed = parseFleetArgs([])
  if ('usageError' in parsed) throw new Error(parsed.usageError)
  return { ...parsed.config, ...over }
}

function row(over: Partial<QueueRowLike> & { slug: string }): QueueRowLike {
  return {
    docKind: 'cma',
    docType: 'cma',
    state: 'failed',
    prospectKind: 'expired',
    offMarketAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-02T00:00:00.000Z',
    address: `${over.slug} address`,
    city: 'Bend',
    recommendedList: null,
    compsCount: null,
    buildError: null,
    needsReview: false,
    theirPrice: null,
    ...over,
  }
}

function selected(over: Partial<SelectedHome> & { slug: string }): SelectedHome {
  return {
    address: null,
    city: null,
    stateAtSelection: 'flagged',
    prospectKind: 'expired',
    docType: 'expired-audit',
    offMarketAt: null,
    createdAt: null,
    storedRecommended: null,
    storedCompsCount: null,
    storedBuildError: null,
    storedNeedsReview: null,
    theirPrice: null,
    lat: null,
    lng: null,
    inside: null,
    cityMatch: 'polygon',
    ...over,
  }
}

const completeDry: DryRunLike = {
  slug: 'cma-3037-purcell',
  ok: true,
  stage: 'complete',
  address: '3037 NE Purcell Blvd',
  city: 'Bend',
  pricingSource: 'facts',
  compCount: 6,
  comps: [{ key: 'k3' }, { key: 'k1' }, { key: 'k2' }, { key: 'k5' }, { key: 'k4' }],
  recommended: 538000,
  range: [525000, 549000],
  valueRange: [510000, 560000],
  confidence: 'medium',
  compPpsfCv: 0.08,
  needsReview: true,
  reviewReason: 'wide band',
  hardFailures: [],
  keptCompCount: 5,
  subjectLastAsk: { price: 565000, date: '2026-06-01', historyLine: '120 days on market' },
  queueStateStored: 'flagged',
  queueState: 'flagged',
  error: null,
}

const compsFailDry: DryRunLike = {
  slug: 'cma-1015-4th',
  ok: false,
  stage: 'comps',
  address: '1015 NW 4th St',
  city: 'Bend',
  pricingSource: 'facts',
  compCount: 2,
  comps: [],
  recommended: null,
  range: [null, null],
  valueRange: [null, null],
  confidence: null,
  compPpsfCv: null,
  needsReview: false,
  reviewReason: null,
  hardFailures: [],
  keptCompCount: 0,
  subjectLastAsk: { price: 600000, date: null, historyLine: null },
  queueStateStored: 'failed',
  queueState: 'failed',
  error: 'Only 2 qualifying closed comps found (minimum 3). starved: no plat sales\nmore detail',
}

function score(over: Partial<HomeScore> & { slug: string }): HomeScore {
  const base = scoreHome(selected({ slug: over.slug, stateAtSelection: 'flagged' }), { dry: { ...completeDry, slug: over.slug } }, { ranAt: 'T' })
  return { ...base, ...over }
}

function run(homes: HomeScore[], over: Partial<FleetRun> = {}): FleetRun {
  const build = homes.filter((h) => h.outcome === 'build').length
  const fail = homes.filter((h) => h.outcome === 'fail').length
  const harnessErrors = homes.filter((h) => h.outcome === 'harness-error').length
  return {
    schemaVersion: 1,
    runId: 'r1',
    startedAt: '2026-10-07T10:00:00.000Z',
    finishedAt: '2026-10-07T10:30:00.000Z',
    wallSec: 1800,
    complete: true,
    gitSha: 'aaa',
    gitBranch: 'main',
    gitDirty: false,
    dryRunScriptSha1: 's1',
    nodeVersion: 'v22',
    childArgv: [],
    engine: 'deterministic-half',
    source: 'queue',
    config: cfg(),
    selection: {
      queueRows: 0,
      queueTruncated: false,
      afterDocKind: 0,
      afterKind: 0,
      afterStates: 0,
      afterSince: 0,
      withCoordinates: 0,
      insidePolygon: 0,
      outsidePolygon: 0,
      nameFallback: 0,
      afterLimit: homes.length,
      boundarySource: null,
    },
    totals: {
      homes: homes.length,
      build,
      fail,
      harnessErrors,
      hold: homes.filter((h) => h.hold === true).length,
      flagged: homes.filter((h) => h.flagged).length,
      minCompsFail: 0,
      byStage: { subject: 0, comps: 0, pricing: 0, contract: 0, complete: 0, harness: 0 },
      bySource: {},
    },
    homes,
    vsStored: { compared: 0, nowBuilds: [], nowFails: [], pricesMoved: [], same: 0, medianAbsDeltaPct: null },
    baseline: null,
    diff: null,
    headline: '',
    ...over,
  }
}

const SQUARE: Ring = [
  [-121.4, 44.0],
  [-121.2, 44.0],
  [-121.2, 44.2],
  [-121.4, 44.2],
  [-121.4, 44.0],
]
const INSIDE = { lat: 44.1, lng: -121.3 }
const OUTSIDE = { lat: 44.5, lng: -121.3 }

// ---------------------------------------------------------------------------

describe('parseFleetArgs', () => {
  it('[] gives the defaults', () => {
    const r = parseFleetArgs([])
    if ('usageError' in r) throw new Error(r.usageError)
    expect(r.warnings).toEqual([])
    expect(r.config).toMatchObject({
      city: 'bend',
      states: ['failed', 'flagged', 'ready', 'audit-failed', 'unvetted'],
      includeArchived: false,
      kind: 'expired',
      concurrency: 3,
      timeoutSec: 600,
      retries: 1,
      priceThresholdPct: 1,
      baseline: 'auto',
      raw: true,
      latest: true,
      since: null,
      limit: null,
      slugs: null,
      outDir: 'out/cma-fleet',
      json: false,
      dry: false,
      dryList: false,
      fromJson: null,
    })
  })

  it('--states parses, rejects a bogus token, and archived flips includeArchived', () => {
    const ok = parseFleetArgs(['--states', 'failed,flagged'])
    if ('usageError' in ok) throw new Error(ok.usageError)
    expect(ok.config.states).toEqual(['failed', 'flagged'])
    expect(ok.config.includeArchived).toBe(false)

    const bad = parseFleetArgs(['--states', 'failed,bogus'])
    expect('usageError' in bad && bad.usageError).toContain('bogus')

    const arch = parseFleetArgs(['--states', 'archived,sent'])
    if ('usageError' in arch) throw new Error(arch.usageError)
    expect(arch.config.includeArchived).toBe(true)
  })

  it('--concurrency clamps above 5 with a warning and rejects 0 or text', () => {
    const nine = parseFleetArgs(['--concurrency', '9'])
    if ('usageError' in nine) throw new Error(nine.usageError)
    expect(nine.config.concurrency).toBe(5)
    expect(nine.warnings).toHaveLength(1)
    expect(nine.warnings[0]).toContain('clamped')
    expect('usageError' in parseFleetArgs(['--concurrency', '0'])).toBe(true)
    expect('usageError' in parseFleetArgs(['--concurrency', 'x'])).toBe(true)
  })

  it('--slugs merges, trims, lowercases and dedupes; --city any; --baseline none', () => {
    const r = parseFleetArgs(['--slugs', 'A, b', '--slugs', 'b', '--city', 'any', '--baseline', 'none'])
    if ('usageError' in r) throw new Error(r.usageError)
    expect(r.config.slugs).toEqual(['a', 'b'])
    expect(r.config.city).toBe('any')
    expect(r.config.baseline).toBe('none')
  })

  it('rejects a bad --since, an unknown flag, and a bare token', () => {
    expect('usageError' in parseFleetArgs(['--since', '2026-13-01'])).toBe(true)
    expect('usageError' in parseFleetArgs(['--since', '2026-10-07'])).toBe(false)
    expect('usageError' in parseFleetArgs(['--wat'])).toBe(true)
    expect('usageError' in parseFleetArgs(['cma-foo'])).toBe(true)
    expect('usageError' in parseFleetArgs(['--limit'])).toBe(true)
  })

  it('booleans and the extra flags land on the config', () => {
    const r = parseFleetArgs(['--no-raw', '--no-latest', '--allow-regressions', '--json', '--dry', '--dry-list', '--from-json', 'out/x', '--retries', '0'])
    if ('usageError' in r) throw new Error(r.usageError)
    expect(r.config).toMatchObject({ raw: false, latest: false, allowRegressions: true, json: true, dry: true, dryList: true, fromJson: 'out/x', retries: 0 })
  })
})

describe('parseDryRunStdout', () => {
  const pretty = (v: unknown) => JSON.stringify(v, null, 2)

  it('parses the trailing array and keeps the lines before it as notes', () => {
    const stdout = `   actives settle · recommended $1 → $2\nlib log line\n${pretty([completeDry])}\n`
    const r = parseDryRunStdout(stdout, 'cma-3037-purcell')
    if (!('dry' in r)) throw new Error(r.harnessReason)
    expect(r.dry.slug).toBe('cma-3037-purcell')
    expect(r.dry.recommended).toBe(538000)
    expect(r.notes).toEqual(['actives settle · recommended $1 → $2', 'lib log line'])
  })

  it('nested brackets inside comps do not confuse the scan; trailing blank lines are tolerated', () => {
    const stdout = `${pretty([{ ...completeDry, comps: [{ key: 'a' }, { key: 'b' }], hardFailures: [] }])}\n\n\n`
    const r = parseDryRunStdout(stdout, 'cma-3037-purcell')
    if (!('dry' in r)) throw new Error(r.harnessReason)
    expect(r.dry.comps).toHaveLength(2)
    expect(r.notes).toEqual([])
  })

  it('names the harness reason', () => {
    expect(parseDryRunStdout('', 'x')).toEqual({ harnessReason: 'no-json' })
    expect(parseDryRunStdout('[\n  {\n    "slug": "x",\n]\n', 'x')).toEqual({ harnessReason: 'bad-json' })
    expect(parseDryRunStdout(pretty({ a: 1 }), 'x')).toEqual({ harnessReason: 'not-array' })
    expect(parseDryRunStdout(pretty([{ slug: 'y', ok: true }]), 'x')).toEqual({ harnessReason: 'slug-mismatch' })
    expect(parseDryRunStdout('── x — addr\n   WOULD FAIL at comps · ...\n   ✖ no\n', 'x')).toEqual({ harnessReason: 'no-json' })
  })
})

describe('firstReasonLine', () => {
  it('contract stage takes the first hard failure', () => {
    expect(firstReasonLine({ slug: 'x', ok: false, stage: 'contract', hardFailures: ['a: x', 'b: y'], error: 'Accuracy contract failed: a: x | b: y' })).toBe('a: x')
  })
  it('otherwise the error, first line, before the first " | ", capped at 200', () => {
    expect(firstReasonLine(compsFailDry)).toBe('Only 2 qualifying closed comps found (minimum 3). starved: no plat sales')
    expect(firstReasonLine({ slug: 'x', ok: false, stage: 'pricing', error: 'X | Y' })).toBe('X')
    expect(firstReasonLine({ slug: 'x', ok: false, error: 'z'.repeat(250) })).toHaveLength(200)
    expect(firstReasonLine({ slug: 'x', ok: false, error: null })).toBeNull()
    expect(firstReasonLine({ slug: 'x', ok: false, error: '' })).toBeNull()
    expect(firstReasonLine(completeDry)).toBeNull()
  })
})

describe('ruleThreeHold', () => {
  it('ask 500000: exactly 15% under is not a hold; a dollar more is; any amount over is', () => {
    expect(ruleThreeHold(425000, 500000)).toEqual({ hold: false, holdReason: null })
    expect(ruleThreeHold(424999, 500000)).toEqual({ hold: true, holdReason: 'under-ask-15' })
    expect(ruleThreeHold(500001, 500000)).toEqual({ hold: true, holdReason: 'over-ask' })
    expect(ruleThreeHold(500000, 500000)).toEqual({ hold: false, holdReason: null })
  })
  it('ask 333333: whole-dollar math, no float drift at the line', () => {
    // 15% of 333,333 is 49,999.95: 283,334 is inside the band, 283,333 is past it.
    expect(ruleThreeHold(283334, 333333).hold).toBe(false)
    expect(ruleThreeHold(283333, 333333).hold).toBe(true)
  })
  it('missing or non-price inputs are null, never a hold', () => {
    expect(ruleThreeHold(425000, null).hold).toBeNull()
    expect(ruleThreeHold(425000, 0).hold).toBeNull()
    expect(ruleThreeHold(null, 500000).hold).toBeNull()
  })
  it('agrees with lib/cma/gap-hold.ts (the engine) around both lines, for every whole-dollar ask in a band', () => {
    const mismatches: string[] = []
    for (let ask = 333000; ask <= 334000; ask += 1) {
      const line = Math.round(ask * 0.85)
      const recs = [line - 2, line - 1, line, line + 1, line + 2, ask - 1, ask, ask + 1]
      for (const rec of recs) {
        if (ruleThreeHold(rec, ask).hold !== recommendationGapHold(rec, ask).hold) mismatches.push(`rec ${rec} ask ${ask}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('scoreHome', () => {
  it('maps a complete dry run', () => {
    const s = scoreHome(selected({ slug: 'cma-3037-purcell', stateAtSelection: 'flagged' }), { dry: completeDry, notes: ['n'], rawPath: 'raw/r/cma-3037-purcell.json', durationMs: 82000 }, { ranAt: 'T' })
    expect(s).toMatchObject({
      outcome: 'build',
      stage: 'complete',
      reason: null,
      comps: 5,
      compsFound: 6,
      compKeys: ['k1', 'k2', 'k3', 'k4', 'k5'],
      minCompsOk: true,
      recommended: 538000,
      conservative: 525000,
      highEnd: 549000,
      valueLow: 510000,
      valueHigh: 560000,
      lastAsk: 565000,
      askSource: 'dry-run',
      askDate: '2026-06-01',
      pctVsAsk: -4.8,
      hold: false,
      holdReason: null,
      flagged: true,
      reviewReason: 'wide band',
      queueStateStored: 'flagged',
      queueStateAfter: 'flagged',
      storedBuilt: true,
      verdictVsStored: 'same',
      dryRunNotes: ['n'],
      rawPath: 'raw/r/cma-3037-purcell.json',
      ranAt: 'T',
      address: '3037 NE Purcell Blvd',
      city: 'Bend',
      durationMs: 82000,
    })
  })

  it('a comps-stage failure with 2 found is a fail under rule 8 with the first reason line', () => {
    const s = scoreHome(selected({ slug: 'cma-1015-4th', stateAtSelection: 'failed' }), { dry: compsFailDry })
    expect(s).toMatchObject({ outcome: 'fail', stage: 'comps', comps: 0, compsFound: 2, minCompsOk: false, storedBuilt: false, verdictVsStored: 'same' })
    expect(s.reason).toBe('Only 2 qualifying closed comps found (minimum 3). starved: no plat sales')
  })

  it('falls back to the queue ask when the dry run has none', () => {
    const s = scoreHome(selected({ slug: 'x', theirPrice: 600000 }), { dry: { ...completeDry, slug: 'x', subjectLastAsk: { price: null, date: null, historyLine: null } } })
    expect(s.lastAsk).toBe(600000)
    expect(s.askSource).toBe('queue')
    expect(s.pctVsAsk).toBe(-10.3)
  })

  it('a harness error carries the cause and nothing priced', () => {
    const s = scoreHome(selected({ slug: 'x', address: 'A', city: 'Bend' }), { harnessReason: 'timeout', exitCode: null, signal: 'SIGKILL', stderr: '\n  boom here\nmore', rawPath: 'raw/r/x.json', attempts: 2 })
    expect(s.outcome).toBe('harness-error')
    expect(s.stage).toBe('harness')
    expect(s.reason).toContain('timeout')
    expect(s.reason).toContain('SIGKILL')
    expect(s.reason).toContain('boom here')
    expect(s.hold).toBeNull()
    expect(s.rawPath).toBeNull()
    expect(s.attempts).toBe(2)
    expect(s.verdictVsStored).toBe('n/a')
    expect(s.address).toBe('A')
  })

  it('storedBuilt follows the queue state and verdictVsStored takes each of the five values', () => {
    const built = { dry: completeDry }
    const failed = { dry: compsFailDry }
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: 'failed' }), built).storedBuilt).toBe(false)
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: 'flagged' }), built).storedBuilt).toBe(true)
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: null }), built).storedBuilt).toBeNull()

    expect(scoreHome(selected({ slug: 'a', stateAtSelection: 'failed' }), built).verdictVsStored).toBe('now-builds')
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: 'ready' }), failed).verdictVsStored).toBe('now-fails')
    const moved = scoreHome(selected({ slug: 'a', stateAtSelection: 'ready', storedRecommended: 500000 }), built)
    expect(moved.verdictVsStored).toBe('price-moved')
    expect(moved.storedDeltaPct).toBe(7.6)
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: 'ready', storedRecommended: 538000 }), built).verdictVsStored).toBe('same')
    expect(scoreHome(selected({ slug: 'a', stateAtSelection: null }), built).verdictVsStored).toBe('n/a')
  })
})

describe('selectHomes', () => {
  const coords = new Map([
    ['cma-in', INSIDE],
    ['cma-out', OUTSIDE],
  ])
  const base = (config: FleetConfig, rows: QueueRowLike[], c = coords) => selectHomes(rows, { config, rings: [SQUARE], coordsBySlug: c, queueTruncated: false })

  it('drops bpo rows, applies kind, states and since', () => {
    const rows = [
      row({ slug: 'cma-in' }),
      row({ slug: 'bpo-1', docKind: 'bpo', docType: 'bpo' }),
      row({ slug: 'cma-audit', prospectKind: null, docType: 'expired-audit', city: 'Bend' }),
      row({ slug: 'cma-fsbo', prospectKind: 'fsbo' }),
      row({ slug: 'cma-sent', state: 'sent' }),
      row({ slug: 'cma-old', offMarketAt: '2026-01-01T00:00:00.000Z' }),
      row({ slug: 'cma-created', offMarketAt: null, createdAt: '2026-09-15T00:00:00.000Z' }),
    ]
    const r = base(cfg({ since: '2026-08-01' }), rows)
    expect(r.homes.map((h) => h.slug)).toEqual(['cma-audit', 'cma-created', 'cma-in'])
    expect(r.counts).toEqual({
      queueRows: 7,
      queueTruncated: false,
      afterDocKind: 6,
      afterKind: 5,
      afterStates: 4,
      afterSince: 3,
      withCoordinates: 1,
      insidePolygon: 1,
      outsidePolygon: 0,
      nameFallback: 2,
      afterLimit: 3,
      boundarySource: { geoType: 'city', geoSlug: 'bend', rings: 1 },
    })
    expect(base(cfg({ kind: 'fsbo' }), rows).homes.map((h) => h.slug)).toEqual(['cma-fsbo'])
    expect(base(cfg({ kind: 'all', states: ['sent'] }), rows).homes.map((h) => h.slug)).toEqual(['cma-sent'])
  })

  it('polygon keeps inside, drops outside, and falls back to the city name without coordinates', () => {
    const rows = [row({ slug: 'cma-in' }), row({ slug: 'cma-out' }), row({ slug: 'cma-name', city: 'Bend' }), row({ slug: 'cma-redmond', city: 'Redmond' })]
    const r = base(cfg(), rows)
    expect(r.homes.map((h) => [h.slug, h.cityMatch, h.inside])).toEqual([
      ['cma-in', 'polygon', true],
      ['cma-name', 'name-fallback', null],
    ])
    expect(r.counts).toMatchObject({ withCoordinates: 2, insidePolygon: 1, outsidePolygon: 1, nameFallback: 1, afterLimit: 2 })
    const any = base(cfg({ city: 'any' }), rows)
    expect(any.homes.map((h) => h.cityMatch)).toEqual(['skipped', 'skipped', 'skipped', 'skipped'])
    expect(any.counts.boundarySource).toBeNull()
  })

  it('--slugs records the city test but never drops; a slug with no row still runs', () => {
    const rows = [row({ slug: 'cma-out', state: 'sent' }), row({ slug: 'cma-name', city: 'Redmond' })]
    const r = base(cfg({ slugs: ['cma-out', 'cma-name', 'cma-ghost'] }), rows)
    expect(r.homes.map((h) => [h.slug, h.cityMatch, h.inside, h.stateAtSelection])).toEqual([
      ['cma-ghost', 'skipped', null, null],
      ['cma-name', 'name-fallback', null, 'failed'],
      ['cma-out', 'polygon', false, 'sent'],
    ])
    expect(r.counts).toMatchObject({ afterDocKind: 3, afterStates: 3, outsidePolygon: 1, nameFallback: 0, afterLimit: 3 })
  })

  it('sorts by slug then applies the limit; the home carries the stored fields', () => {
    const rows = [row({ slug: 'cma-z', recommendedList: 1, compsCount: 4, buildError: 'e', needsReview: true, theirPrice: 9 }), row({ slug: 'cma-a' })]
    const r = base(cfg({ limit: 1 }), rows)
    expect(r.homes.map((h) => h.slug)).toEqual(['cma-a'])
    expect(r.counts.afterLimit).toBe(1)
    const all = base(cfg(), rows)
    expect(all.homes[1]).toMatchObject({ slug: 'cma-z', storedRecommended: 1, storedCompsCount: 4, storedBuildError: 'e', storedNeedsReview: true, theirPrice: 9 })
  })
})

describe('subjectInsideCity', () => {
  const poly: GeoJSON.Polygon = { type: 'Polygon', coordinates: [SQUARE.map(([lon, lat]) => [lon, lat])] }
  const second: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-122.0, 45.0],
          [-121.9, 45.0],
          [-121.9, 45.1],
          [-122.0, 45.1],
          [-122.0, 45.0],
        ],
      ],
      [SQUARE.map(([lon, lat]) => [lon, lat])],
    ],
  }
  it('Polygon inside and outside', () => {
    expect(subjectInsideCity(INSIDE.lng, INSIDE.lat, poly)).toBe(true)
    expect(subjectInsideCity(OUTSIDE.lng, OUTSIDE.lat, poly)).toBe(false)
  })
  it('MultiPolygon: the point in the second polygon counts, a point outside both does not', () => {
    expect(subjectInsideCity(INSIDE.lng, INSIDE.lat, second)).toBe(true)
    expect(subjectInsideCity(-121.95, 45.05, second)).toBe(true)
    expect(subjectInsideCity(OUTSIDE.lng, OUTSIDE.lat, second)).toBe(false)
    expect(subjectInsideCity(0, 0, null)).toBe(false)
  })
})

describe('diffFleet', () => {
  const t = { priceThresholdPct: 1 }
  const built = (slug: string, over: Partial<HomeScore> = {}) => score({ slug, ...over })
  const failed = (slug: string, over: Partial<HomeScore> = {}) =>
    score({ slug, outcome: 'fail', stage: 'comps', reason: 'two comps', recommended: null, hold: null, holdReason: null, comps: 0, compKeys: [], ...over })

  it('newlyBuilding and newlyFailing, and the summary counts builds over the common set only', () => {
    const d = diffFleet(run([failed('a'), built('b'), built('only-base')]), run([built('a'), failed('b', { stage: 'pricing', reason: 'no price' }), built('only-cur')]), t)
    expect(d.newlyBuilding.map((e) => e.slug)).toEqual(['a'])
    expect(d.newlyFailing.map((e) => e.slug)).toEqual(['b'])
    expect(d.newlyFailing[0]!.after).toMatchObject({ stage: 'pricing', reason: 'no price' })
    expect(d.newlyFailing[0]!.before).toMatchObject({ recommended: 538000 })
    expect(d.summary).toMatchObject({ total: 2, builtNow: 1, builtBefore: 1, added: 1, dropped: 1, harness: 0 })
    expect(d.added.map((e) => e.slug)).toEqual(['only-cur'])
    expect(d.dropped.map((e) => e.slug)).toEqual(['only-base'])
    expect(d.unchanged).toBe(0)
    expect(d.hasRegressions).toBe(true)
  })

  it('pricesMoved is strict at the threshold and flags data drift only when comp keys differ', () => {
    const b = run([built('a', { recommended: 100000 }), built('b', { recommended: 100000 }), built('c', { recommended: 100000 })])
    const c = run([
      built('a', { recommended: 101000 }),
      built('b', { recommended: 101010 }),
      built('c', { recommended: 98000, compKeys: ['k1', 'k2', 'k3', 'k4', 'k9'] }),
    ])
    const d = diffFleet(b, c, t)
    expect(d.pricesMoved.map((e) => [e.slug, e.deltaPct, e.dataDriftSuspected])).toEqual([
      ['c', -2, true],
      ['b', 1, false],
    ])
    expect(d.pricesMoved[0]!.delta).toBe(-2000)
    expect(d.summary.medianAbsDeltaPct).toBe(1.5)
    expect(d.compsChanged.map((e) => [e.slug, e.keysAdded, e.keysRemoved])).toEqual([['c', ['k9'], ['k5']]])
    expect(d.unchanged).toBe(1)
    expect(d.hasRegressions).toBe(false)
  })

  it('newlyHolding, holdCleared, flaggedChanged, sourceChanged', () => {
    const b = run([
      built('h', { hold: false, holdReason: null, recommended: 500000, lastAsk: 520000 }),
      built('c', { hold: true, holdReason: 'over-ask' }),
      built('f', { flagged: false, reviewReason: null }),
      built('s', { pricingSource: 'facts' }),
    ])
    const c = run([
      built('h', { hold: true, holdReason: 'over-ask', recommended: 530000, lastAsk: 520000 }),
      built('c', { hold: false, holdReason: null }),
      built('f', { flagged: true, reviewReason: 'wide' }),
      built('s', { pricingSource: 'ladder' }),
    ])
    const d = diffFleet(b, c, t)
    expect(d.newlyHolding.map((e) => e.slug)).toEqual(['h'])
    expect(d.newlyHolding[0]!.after).toEqual({ hold: true, holdReason: 'over-ask', ask: 520000, rec: 530000 })
    expect(d.holdCleared.map((e) => e.slug)).toEqual(['c'])
    expect(d.flaggedChanged.map((e) => e.slug)).toEqual(['f'])
    expect(d.flaggedChanged[0]!.after).toEqual({ flagged: true, reviewReason: 'wide' })
    expect(d.sourceChanged.map((e) => e.slug)).toEqual(['s'])
    expect(d.hasRegressions).toBe(true)
  })

  it('failureMoved on a stage change and on a reason change; same failure is unchanged', () => {
    const b = run([failed('x', { stage: 'comps' }), failed('y', { reason: 'r1' }), failed('z')])
    const c = run([failed('x', { stage: 'pricing' }), failed('y', { reason: 'r2' }), failed('z')])
    const d = diffFleet(b, c, t)
    expect(d.failureMoved.map((e) => e.slug)).toEqual(['x', 'y'])
    expect(d.unchanged).toBe(1)
  })

  it('a harness error on either side is excluded from every bucket and counted', () => {
    const h = (slug: string) => score({ slug, outcome: 'harness-error', stage: 'harness', reason: 'timeout', recommended: null, hold: null })
    const d = diffFleet(run([h('a'), built('b')]), run([built('a'), h('b')]), t)
    expect(d.harness).toEqual([
      { slug: 'a', side: 'baseline', reason: 'timeout' },
      { slug: 'b', side: 'current', reason: 'timeout' },
    ])
    expect(d.newlyBuilding).toEqual([])
    expect(d.newlyFailing).toEqual([])
    expect(d.unchanged).toBe(0)
    expect(d.summary.harness).toBe(2)
    expect(d.summary.medianAbsDeltaPct).toBeNull()
  })

  it('warnings: harness sha1 change, a 24 h gap, the same gitSha, a changed selection', () => {
    const b = run([built('a')], { gitSha: 'aaa', dryRunScriptSha1: 's1', startedAt: '2026-10-05T10:00:00.000Z' })
    const same = diffFleet(b, run([built('a')], { gitSha: 'aaa', dryRunScriptSha1: 's1', startedAt: '2026-10-05T11:00:00.000Z' }), t)
    expect(same.warnings).toEqual(['same commit: every move is data drift or nondeterminism'])
    const changed = diffFleet(b, run([built('a')], { gitSha: 'bbb', dryRunScriptSha1: 's2', startedAt: '2026-10-07T10:00:00.000Z', config: cfg({ states: ['failed'] }) }), t)
    expect(changed.warnings).toHaveLength(3)
    expect(changed.warnings[0]).toBe('the dry-run harness itself changed between runs')
    expect(changed.warnings[1]).toContain('runs are 48 h apart')
    expect(changed.warnings[2]).toBe('selection changed; compare only the common set')
  })
})

describe('diffAgainstStored', () => {
  it('buckets by verdict and leaves n/a out of compared', () => {
    const homes = [
      score({ slug: 'nb', stateAtSelection: 'failed', storedBuilt: false, outcome: 'build' }),
      score({ slug: 'nf', stateAtSelection: 'ready', storedBuilt: true, outcome: 'fail', recommended: null }),
      score({ slug: 'pm', storedBuilt: true, storedRecommended: 500000, recommended: 538000 }),
      score({ slug: 'at', storedBuilt: true, storedRecommended: 100000, recommended: 101000 }),
      score({ slug: 'na', stateAtSelection: null, storedBuilt: null }),
      score({ slug: 'he', storedBuilt: true, outcome: 'harness-error' }),
    ]
    const d = diffAgainstStored({ homes }, { priceThresholdPct: 1 })
    expect(d).toEqual({
      compared: 4,
      nowBuilds: ['nb'],
      nowFails: ['nf'],
      pricesMoved: [{ slug: 'pm', stored: 500000, now: 538000, deltaPct: 7.6 }],
      same: 1,
      medianAbsDeltaPct: 7.6,
    })
  })
})

describe('headline and storedLine', () => {
  const built = (slug: string, over: Partial<HomeScore> = {}) => score({ slug, ...over })
  const failed = (slug: string) => score({ slug, outcome: 'fail', stage: 'comps', recommended: null, hold: null })

  it('with a baseline: exact format', () => {
    const b = run([failed('a'), failed('b'), built('c'), built('d'), built('e', { recommended: 100000 }), built('f', { recommended: 100000 }), failed('g'), failed('h'), failed('i'), failed('j')])
    const c = run([built('a'), built('b'), failed('c'), failed('d'), built('e', { recommended: 102000 }), built('f', { recommended: 103000 }), failed('g'), failed('h'), failed('i'), failed('j')])
    // was 4 built; now a,b,e,f build = 4; +2 build, -2 fail; two moves of 2% and 3%.
    const d = diffFleet(b, c, { priceThresholdPct: 1 })
    expect(headline(d, c)).toBe('4 of 10 build (was 4); +2 build, -2 fail; 2 prices moved, median |delta| 2.5%')
  })

  it('with a baseline: the spec example and the suffixes in order', () => {
    const d = diffFleet(run([]), run([]), { priceThresholdPct: 1 })
    d.summary = { total: 10, builtNow: 3, builtBefore: 2, added: 0, dropped: 0, harness: 0, medianAbsDeltaPct: 2.5 }
    d.newlyBuilding = [{ slug: 'a', address: null, before: {}, after: {} }, { slug: 'b', address: null, before: {}, after: {} }]
    d.newlyFailing = [{ slug: 'c', address: null, before: {}, after: {} }]
    d.pricesMoved = [
      { slug: 'd', address: null, before: {}, after: {}, delta: 1, deltaPct: 2, compKeysChanged: false, dataDriftSuspected: false },
      { slug: 'e', address: null, before: {}, after: {}, delta: 1, deltaPct: 3, compKeysChanged: false, dataDriftSuspected: false },
    ]
    const cur = run([])
    expect(headline(d, cur)).toBe('3 of 10 build (was 2); +2 build, -1 fail; 2 prices moved, median |delta| 2.5%')
    d.newlyHolding = [{ slug: 'f', address: null, before: {}, after: {} }]
    d.summary.added = 1
    d.summary.dropped = 2
    cur.totals.harnessErrors = 1
    expect(headline(d, cur)).toBe(
      '3 of 10 build (was 2); +2 build, -1 fail; 2 prices moved, median |delta| 2.5% · 1 newly on hold · set changed +1/-2 · 1 harness errors (unscored)',
    )
    d.pricesMoved = []
    d.summary.medianAbsDeltaPct = null
    expect(headline(d, run([]))).toBe('3 of 10 build (was 2); +2 build, -1 fail; 0 prices moved · 1 newly on hold · set changed +1/-2')
  })

  it('without a baseline', () => {
    const cur = run([built('a'), built('b'), built('c'), built('d'), built('e'), built('f'), built('g'), failed('h'), failed('i')])
    expect(headline(null, cur)).toBe('7 of 9 build (no baseline)')
    cur.totals.harnessErrors = 2
    cur.totals.homes = 11
    expect(headline(null, cur)).toBe('7 of 9 build (no baseline) · 2 harness errors (unscored)')
  })

  it('storedLine', () => {
    expect(storedLine({ compared: 4, nowBuilds: ['a', 'b'], nowFails: ['c'], pricesMoved: [{ slug: 'd', stored: 1, now: 2, deltaPct: 4.5 }], same: 0, medianAbsDeltaPct: 4.5 })).toBe(
      'vs stored rows: +2 now build (were failed), -1 now fail (were built), 1 prices moved vs stored, median |delta| 4.5%',
    )
    expect(storedLine({ compared: 0, nowBuilds: [], nowFails: [], pricesMoved: [], same: 0, medianAbsDeltaPct: null })).toBe(
      'vs stored rows: +0 now build (were failed), -0 now fail (were built), 0 prices moved vs stored, median |delta| n/a',
    )
  })
})

describe('median', () => {
  it('handles empty, one, and an even count', () => {
    expect(median([])).toBeNull()
    expect(median([3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('fleetExitCode', () => {
  const regressing = diffFleet(run([score({ slug: 'a' })]), run([score({ slug: 'a', outcome: 'fail', stage: 'comps', recommended: null, hold: null })]), { priceThresholdPct: 1 })
  it('maps the outcomes', () => {
    expect(regressing.hasRegressions).toBe(true)
    expect(fleetExitCode({ dry: true })).toBe(0)
    expect(fleetExitCode({ usageError: 'x' })).toBe(2)
    expect(fleetExitCode({ unusable: true })).toBe(2)
    expect(fleetExitCode({ harnessErrors: 1, diff: regressing })).toBe(3)
    expect(fleetExitCode({ harnessErrors: 0, diff: regressing })).toBe(1)
    expect(fleetExitCode({ harnessErrors: 0, diff: regressing, allowRegressions: true })).toBe(0)
    expect(fleetExitCode({ harnessErrors: 0, diff: null })).toBe(0)
  })
})

describe('FLEET_MIN_COMPS_DEFAULT', () => {
  it('is rule 8, and equals the engine MIN_COMPS', () => {
    expect(FLEET_MIN_COMPS_DEFAULT).toBe(5)
    expect(FLEET_MIN_COMPS_DEFAULT).toBe(MIN_COMPS)
  })
})
