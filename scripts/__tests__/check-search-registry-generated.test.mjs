import { describe, it, expect } from 'vitest'
import { buildComparison, canonicalJson } from '../generate-search-registry.mjs'

// Regression suite for the registry↔metadata comparison behind
// ci:search-registry-generated (scripts/check-search-registry-generated.mjs).
// buildComparison is pure: {snapshot, curation, registryFields} → {report, problems}.
// Conditions under test map to the gate doc block: (a) unmapped field,
// (b) unexplained option / viaValue, (c) mask-dead exclusion resurrection,
// plus allowlist acceptance, derived-reason enforcement, and determinism.

const snapshot = {
  _meta: { sourcePulledAt: '2026-07-30' },
  anomalies: [],
  concepts: {
    LotFeatures: {
      conceptKind: 'standard',
      sparkName: 'LotFeatures',
      group: null,
      label: 'Lot Features',
      type: 'Boolean',
      searchable: true,
      hasList: true,
      multiSelect: true,
      classes: ['A', 'D'],
      payloads: ['IDX'],
      values: ['Fenced', 'Level', 'Wooded'],
      valueClassesHint: { Fenced: ['A'], Level: ['A', 'D'], Wooded: ['D'] },
    },
    StoriesTotal: {
      conceptKind: 'standard',
      sparkName: 'StoriesTotal',
      group: null,
      label: 'Stories Total',
      type: 'Integer',
      searchable: false,
      hasList: false,
      multiSelect: false,
      classes: ['A'],
      payloads: ['IDX'],
      values: null,
      valueClassesHint: null,
    },
    'cf:Walkability': {
      conceptKind: 'custom',
      sparkName: 'Walkability',
      group: 'General Property Information',
      label: 'Walkability',
      type: 'Character',
      searchable: true,
      hasList: false,
      multiSelect: false,
      classes: ['A'],
      payloads: null,
      values: null,
      valueClassesHint: null,
    },
  },
}

const exclusions = {
  storiesTotal: {
    concepts: ['StoriesTotal'],
    mvColumns: ['stories_total'],
    removed: '2026-07-30',
    reason: 'masked at feed level',
  },
}

const lotField = { key: 'lotFeatures', kind: 'multi', mv: 'lot_features_arr', options: ['Fenced', 'Level'] }

describe('(a) every registry field maps to metadata or a reasoned curation entry', () => {
  it('passes a field auto-resolved by mechanical name identity', () => {
    const { report, problems } = buildComparison({
      snapshot,
      curation: { exclusions },
      registryFields: [lotField],
    })
    expect(problems).toEqual([])
    expect(report.fields.lotFeatures.sparkSource).toBe('LotFeatures')
    expect(report.fields.lotFeatures.resolution).toBe('auto:key')
  })

  it('auto-resolves via the mv column when the key does not match', () => {
    const { report, problems } = buildComparison({
      snapshot,
      curation: { exclusions },
      registryFields: [{ ...lotField, key: 'lotExtras' }],
    })
    expect(problems).toEqual([])
    expect(report.fields.lotExtras.sparkSource).toBe('LotFeatures')
    expect(report.fields.lotExtras.resolution).toBe('auto:mv')
  })

  it('FAILS an unmapped field', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: { exclusions },
      registryFields: [{ key: 'mystery', kind: 'boolean', mv: 'mystery_yn' }],
    })
    expect(problems.some((p) => p.startsWith("unmapped: registry field 'mystery'"))).toBe(true)
  })

  it('FAILS a derived declaration without a reason, passes one with a reason', () => {
    const field = { key: 'monthlyPayment', kind: 'range', mv: 'estimated_monthly_piti' }
    const bad = buildComparison({
      snapshot,
      curation: { sources: { monthlyPayment: { derived: true } }, exclusions },
      registryFields: [field],
    })
    expect(bad.problems.some((p) => p.startsWith('derived without reason'))).toBe(true)
    const good = buildComparison({
      snapshot,
      curation: { sources: { monthlyPayment: { derived: true, reason: 'computed PITI' } }, exclusions },
      registryFields: [field],
    })
    expect(good.problems).toEqual([])
  })

  it('FAILS a curation mapping that names a concept absent from the snapshot', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: { sources: { x: { concept: 'NoSuchConcept', reason: 'typo' } }, exclusions },
      registryFields: [{ key: 'x', kind: 'boolean', mv: 'x_yn' }],
    })
    expect(problems.some((p) => p.startsWith('bad curation'))).toBe(true)
  })
})

describe('(b) options must exist in metadata or the curation allowlist', () => {
  it('FAILS an option absent from both', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: { exclusions },
      registryFields: [{ ...lotField, options: ['Fenced', 'Moat'] }],
    })
    expect(problems.some((p) => p.includes("'lotFeatures' option 'Moat'"))).toBe(true)
  })

  it('passes the same option once allowlisted with a reason', () => {
    const { report, problems } = buildComparison({
      snapshot,
      curation: {
        optionAllowlist: { lotFeatures: [{ option: 'Moat', reason: 'harvested from live rows' }] },
        exclusions,
      },
      registryFields: [{ ...lotField, options: ['Fenced', 'Moat'] }],
    })
    expect(problems).toEqual([])
    // still surfaced as a curation addition, never silently absorbed
    expect(report.fields.lotFeatures.curationAdditions).toEqual(['Moat'])
  })

  it('reports metadata values missing from the registry as candidate gaps (no failure)', () => {
    const { report, problems } = buildComparison({
      snapshot,
      curation: { exclusions },
      registryFields: [lotField],
    })
    expect(problems).toEqual([])
    expect(report.fields.lotFeatures.candidateGaps).toEqual(['Wooded'])
  })

  it('FAILS a boolean viaValue that the metadata does not list', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: {
        sources: { fencedYard: { concept: 'LotFeatures', viaValue: 'Fenced Yard', reason: 'wrong label' } },
        exclusions,
      },
      registryFields: [{ key: 'fencedYard', kind: 'boolean', mv: 'lot_features_arr' }],
    })
    expect(problems.some((p) => p.startsWith("viaValue not in metadata: 'fencedYard'"))).toBe(true)
  })
})

describe('(c) the mask-dead exclusion set stays dead', () => {
  it('FAILS on a resurrected registry key', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: { sources: { storiesTotal: { concept: 'StoriesTotal', reason: 'x' } }, exclusions },
      registryFields: [{ key: 'storiesTotal', kind: 'range', mv: 'stories_total' }],
    })
    expect(problems.some((p) => p.includes("registry key 'storiesTotal' is on the mask-dead exclusion list"))).toBe(true)
  })

  it('FAILS on an excluded concept reached under a NEW key, and on the dead MV column', () => {
    const { problems } = buildComparison({
      snapshot,
      curation: { sources: { stories: { concept: 'StoriesTotal', reason: 'renamed to dodge the list' } }, exclusions },
      registryFields: [{ key: 'stories', kind: 'range', mv: 'stories_total' }],
    })
    expect(problems.some((p) => p.includes("maps to excluded concept 'StoriesTotal'"))).toBe(true)
    expect(problems.some((p) => p.includes("mask-dead MV column 'stories_total'"))).toBe(true)
  })

  it('keeps excluded concepts out of the long-tail backlog', () => {
    const { report } = buildComparison({ snapshot, curation: { exclusions }, registryFields: [lotField] })
    const tail = report.longTail.standardSearchableIdxUnregistered.concepts
    expect(tail).not.toContain('StoriesTotal')
    // cf:Walkability is searchable custom → custom tail
    expect(report.longTail.customSearchableUnregistered.concepts).toContain('cf:Walkability')
  })
})

describe('determinism', () => {
  it('produces byte-identical canonical output across runs and key orderings', () => {
    const a = buildComparison({ snapshot, curation: { exclusions }, registryFields: [lotField] })
    const reordered = JSON.parse(JSON.stringify(snapshot))
    reordered.concepts = Object.fromEntries(Object.entries(snapshot.concepts).reverse())
    const b = buildComparison({ snapshot: reordered, curation: { exclusions }, registryFields: [lotField] })
    expect(canonicalJson(a.report)).toBe(canonicalJson(b.report))
  })
})
