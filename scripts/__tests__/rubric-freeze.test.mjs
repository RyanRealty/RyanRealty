import { describe, expect, it } from 'vitest'
import {
  coverageProblems,
  driftProblems,
  manifestProblems,
  rubricFreezeProblems,
  strayRubricProblems,
} from '../lib/rubric-freeze.mjs'

const MANIFEST = {
  frozenAt: '2026-09-12',
  rubricVersion: 'v1-2026-09-12',
  rubricPath: 'design_system/public/taste-evaluator.v1-2026-09-12.md',
  finishLine: 70,
  riseFloor: 6,
  riseFloorFrom: '2026-09-13',
  riseFloorBasis: {
    method: 'bootstrap: pooled residuals; difference of two medians-of-3 under no change; one-sided q95',
    command: 'node scripts/taste-rise-floor.mjs --json',
    table: 'design_system/public/taste-table.json',
    q95: 6,
  },
  tableRowsBindFrom: '2026-09-13',
  primaryEvaluator: 'grok-4.6',
  allowedEvaluators: ['grok-4.6', 'claude-sonnet-5', 'claude-opus-5'],
  receiptV2From: '2026-09-08',
  demoMatchRuleFrom: '2026-09-12',
  competitiveBriefRuleFrom: '2026-09-12',
  coverageExceptions: {},
}

const LIVE = {
  rubricVersion: 'v1-2026-09-12',
  rubricPath: 'design_system/public/taste-evaluator.v1-2026-09-12.md',
  finishLine: 70,
  tableFinishLine: 70,
  primaryEvaluator: 'grok-4.6',
  allowedEvaluators: ['grok-4.6', 'claude-sonnet-5', 'claude-opus-5'],
  receiptV2From: '2026-09-08',
  demoMatchRuleFrom: '2026-09-12',
  demoMatchRubric: 'v1-2026-09-12',
  competitiveBriefRuleFrom: '2026-09-12',
  riseFloor: 6,
  riseFloorFrom: '2026-09-13',
}

const REGISTRY = [{ key: 'about' }, { key: 'team' }]

describe('rubric-freeze — manifest shape', () => {
  it('accepts the frozen manifest', () => {
    expect(manifestProblems(MANIFEST)).toEqual([])
  })
  it('refuses a primary judge missing from the allowed list', () => {
    const p = manifestProblems({ ...MANIFEST, allowedEvaluators: ['claude-sonnet-5'] })
    expect(p.join('\n')).toMatch(/must include manifest.primaryEvaluator/)
  })
  it('a rise floor is a number: it needs a basis, and the basis must agree with it', () => {
    expect(manifestProblems({ ...MANIFEST, riseFloorBasis: undefined }).join('\n')).toMatch(/riseFloorBasis must record/)
    expect(manifestProblems({ ...MANIFEST, riseFloor: 8 }).join('\n')).toMatch(/riseFloor 8 does not equal riseFloorBasis.q95 6/)
    expect(manifestProblems({ ...MANIFEST, riseFloor: 0 }).join('\n')).toMatch(/riseFloor must be an integer/)
    expect(manifestProblems({ ...MANIFEST, riseFloorFrom: 'soon' }).join('\n')).toMatch(/riseFloorFrom must be a YYYY-MM-DD date/)
  })
})

describe('rubric-freeze — drift', () => {
  it('is silent when code equals the freeze', () => {
    expect(driftProblems(MANIFEST, LIVE)).toEqual([])
  })
  it('names a rubric bump that skipped the manifest', () => {
    const p = driftProblems(MANIFEST, { ...LIVE, rubricVersion: 'v1-2026-09-13', demoMatchRubric: 'v1-2026-09-13' })
    expect(p.join('\n')).toMatch(/rubricVersion .* drifted/)
    expect(p.join('\n')).toMatch(/demoMatchRubric/)
  })
  it('names a finish line moved in one file only', () => {
    const p = driftProblems(MANIFEST, { ...LIVE, tableFinishLine: 75 })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/taste-table-core/)
  })
  it('names a judge added to the chain without the freeze', () => {
    const p = driftProblems(MANIFEST, { ...LIVE, allowedEvaluators: [...LIVE.allowedEvaluators, 'grok-4.5'] })
    expect(p.join('\n')).toMatch(/allowedEvaluators/)
  })
  it('names a rise floor moved in code without re-measuring', () => {
    const p = driftProblems(MANIFEST, { ...LIVE, riseFloor: 1 })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/riseFloor .*RISE_FLOOR.* drifted: code says 1, the freeze says 6/)
  })
})

describe('rubric-freeze — stray rubric files', () => {
  it('ignores the frozen and older rubric files', () => {
    expect(
      strayRubricProblems(MANIFEST, [
        'taste-evaluator.v1-2026-09-08.md',
        'taste-evaluator.v1-2026-09-10.md',
        'taste-evaluator.v1-2026-09-12.md',
        'TASTE.md',
      ]),
    ).toEqual([])
  })
  it('refuses a newer rubric file the manifest does not name', () => {
    const p = strayRubricProblems(MANIFEST, ['taste-evaluator.v1-2026-09-14.md'])
    expect(p.join('\n')).toMatch(/newer than the frozen rubric/)
  })
})

describe('rubric-freeze — coverage', () => {
  const good = (key, extra = {}) => ({ key, median: 55, rubricVersion: 'v1-2026-09-12', evaluatorModel: 'claude-sonnet-5', ...extra })

  it('passes when every class is on the frozen rubric from the chain', () => {
    expect(coverageProblems(MANIFEST, REGISTRY, { rows: [good('about'), good('team')] })).toEqual([])
  })
  it('reads rubric and judge off the instrument when rows do not carry them', () => {
    const table = {
      instrument: { rubricVersion: 'v1-2026-09-12', evaluatorModel: 'grok-4.6' },
      rows: [{ key: 'about', median: 40 }, { key: 'team', median: 41 }],
    }
    expect(coverageProblems(MANIFEST, REGISTRY, table)).toEqual([])
  })
  it('names a class still on the old rubric — the 2026-09-08 table', () => {
    const table = {
      instrument: { rubricVersion: 'v1-2026-09-08', evaluatorModel: 'claude-sonnet-5' },
      rows: [{ key: 'about', median: 31 }, { key: 'team', median: 39 }],
    }
    const p = coverageProblems(MANIFEST, REGISTRY, table)
    expect(p).toHaveLength(2)
    expect(p[0]).toMatch(/about: scored on v1-2026-09-08/)
  })
  it('names a missing class and an invalid row', () => {
    const p = coverageProblems(MANIFEST, REGISTRY, { rows: [good('about', { median: null, invalid: 'scores must be three integers' })] })
    expect(p.join('\n')).toMatch(/about: no integer median/)
    expect(p.join('\n')).toMatch(/team: no row/)
  })
  it('refuses a builder model as the judge', () => {
    const p = coverageProblems(MANIFEST, REGISTRY, { rows: [good('about', { evaluatorModel: 'grok-4.5' }), good('team')] })
    expect(p.join('\n')).toMatch(/about: scored by grok-4.5/)
  })
  it('honours a dated coverage exception with a reason', () => {
    const m = { ...MANIFEST, coverageExceptions: { team: '2026-09-12: /team capture fails on production, SITE-74 owner to fix' } }
    expect(coverageProblems(m, REGISTRY, { rows: [good('about')] })).toEqual([])
  })
  it('a table scored from tableRowsBindFrom owes demoMatch and shotsHash on every row', () => {
    const hash = `sha256:${'a'.repeat(64)}`
    const bound = (key, extra = {}) => good(key, { demoMatch: false, demoMatchVotes: [false, false, true], shotsHash: hash, ...extra })
    expect(coverageProblems(MANIFEST, REGISTRY, { evaluatedAt: '2026-09-13', rows: [bound('about'), bound('team')] })).toEqual([])
    const p = coverageProblems(MANIFEST, REGISTRY, { evaluatedAt: '2026-09-13', rows: [good('about'), bound('team', { demoMatch: null })] })
    expect(p.join('\n')).toMatch(/about: no demoMatch verdict/)
    expect(p.join('\n')).toMatch(/about: no shotsHash/)
    expect(p.join('\n')).toMatch(/team: no demoMatch verdict on the row \(\[false,false,true\]\)/)
    expect(p.join('\n')).not.toMatch(/team: no shotsHash/)
  })
  it('a table scored before tableRowsBindFrom is held to the older shape', () => {
    expect(coverageProblems(MANIFEST, REGISTRY, { evaluatedAt: '2026-09-12', rows: [good('about'), good('team')] })).toEqual([])
  })
})

describe('rubric-freeze — the gate call', () => {
  it('stops at shape problems before checking anything else', () => {
    const r = rubricFreezeProblems({ manifest: { rubricVersion: 'nope' }, live: LIVE, rubricFiles: [], registryClasses: REGISTRY, table: null })
    expect(r.shape.length).toBeGreaterThan(0)
    expect(r.drift).toEqual([])
  })
  it('returns the four groups on a good manifest', () => {
    const r = rubricFreezeProblems({
      manifest: MANIFEST,
      live: LIVE,
      rubricFiles: ['taste-evaluator.v1-2026-09-12.md'],
      registryClasses: REGISTRY,
      table: { rows: [{ key: 'about', median: 1, rubricVersion: 'v1-2026-09-12', evaluatorModel: 'grok-4.6' }] },
    })
    expect(r.shape).toEqual([])
    expect(r.drift).toEqual([])
    expect(r.stray).toEqual([])
    expect(r.coverage).toEqual(['team: no row in the table.'])
  })
})
