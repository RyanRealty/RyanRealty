import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import { honestComparabilityLine } from '@/lib/cma/judge-consistency'
import { comparabilityNarrativeGate, finalComparabilityNarrative } from '@/lib/cma/narrative-final'
import type { CmaAdjustedComp, CmaComp } from '@/lib/cma/types'

// Review of da8dce6 (2026-09-30): the BPO fell back to the honest line only on
// an empty narrative, and the CMA's repair acceptance compared a raw rewrite
// with an already-cleaned narrative. Both now pass through this one gate.

function sale(listingKey: string, address: string, closePrice: number, sqft = 2000): CmaAdjustedComp {
  return {
    listingKey,
    mlsNumber: listingKey,
    address,
    city: 'Bend',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft,
    lotAcres: 0.2,
    yearBuilt: 2005,
    propertySubType: 'Single Family Residence',
    closePrice,
    listPrice: closePrice,
    closeDate: '2026-03-01',
    weight: 1,
    adjustedPrice: closePrice,
  } as unknown as CmaAdjustedComp
}

const priced = [
  sale('A', '1 Oak Ln', 500000),
  sale('B', '2 Pine Ln', 520000),
  sale('C', '3 Elm Ln', 540000),
  sale('D', '4 Ash Ln', 560000),
]
const excludedSale = sale('R1', '10 Fir Ln', 900000)
const candidates: CmaComp[] = [...priced, excludedSale]
const tierByKey = new Map<string, string>([...priced.map((c) => [c.listingKey, 'strong'] as const), ['R1', 'exclude']])
const base = {
  priced,
  candidates,
  excluded: [{ listingKey: 'R1', reason: 'A larger home on a bigger lot.' }],
  subject: { streetAddress: '100 Main St', city: 'Bend', subdivision: null, lotAcres: 0.2 },
  market: null,
  tierByKey,
  breakdown: { reviewExcluded: 1, differentProduct: 0, auditRemoved: 0 },
}

describe('finalComparabilityNarrative', () => {
  it('prints the honest line when a finding the strip cannot remove is left (the BPO printed it)', () => {
    // A sale that is not in the report: no claim check names it, so the strip
    // leaves it; the integrity check the audit gates on does not.
    const narrative = 'The 55 Juniper Way sale anchors the range at the top.'
    const integrity = checkNarrativeIntegrity({ narrative, comps: priced, excluded: base.excluded, subject: base.subject, market: null, candidates, tierByKey })
    expect(integrity.length).toBeGreaterThan(0)
    const out = finalComparabilityNarrative({ ...base, narrative })
    expect(out.fellBack).toBe(true)
    expect(out.integrity.length).toBeGreaterThan(0)
    expect(out.narrative).toBe(
      'Four closed sales were retained. One candidate sale was excluded by the comparability review.',
    )
  })

  it('keeps the true sentences and takes out the refuted ones', () => {
    const out = finalComparabilityNarrative({
      ...base,
      narrative: 'Four closed sales were retained. Three closed sales were retained at full weight.',
    })
    expect(out.fellBack).toBe(false)
    expect(out.narrative).toBe('Four closed sales were retained.')
    expect(out.removed.map((f) => f.kind)).toEqual(['count'])
  })

  it('judges a repair rewrite after its refuted sentences come out, not raw (build.ts narrative repair)', () => {
    const rewrite = 'Five closed sales were retained. The priced sales closed between $500,000 and $560,000.'
    // The old acceptance compared THIS count against a cleaned narrative's zero
    // and rejected a rewrite whose only fault the gate removes anyway.
    expect(
      checkNarrativeIntegrity({ narrative: rewrite, comps: priced, excluded: base.excluded, subject: base.subject, market: null, candidates, tierByKey })
        .length,
    ).toBeGreaterThan(0)
    const out = finalComparabilityNarrative({ ...base, narrative: rewrite })
    expect(out.fellBack).toBe(false)
    expect(out.narrative).toBe('The priced sales closed between $500,000 and $560,000.')
  })

  it('falls back on an empty narrative with the count split by reason', () => {
    const out = finalComparabilityNarrative({
      ...base,
      narrative: '',
      breakdown: { reviewExcluded: 1, differentProduct: 2, auditRemoved: 1 },
    })
    expect(out.fellBack).toBe(true)
    expect(out.narrative).toBe(
      honestComparabilityLine({ keptCount: 4, reviewExcluded: 1, differentProduct: 2, auditRemoved: 1 }),
    )
  })

  it("re-gates the model's own text on each set, which an earlier gate's output cannot stand in for", () => {
    // Round one prices five, round two four after the audit removes E. Gated
    // from the model's text, round two prints a whole count line. Gated from
    // round one's count line, it would print a fragment of it.
    const five = [...priced, sale('E', '5 Birch Ln', 530000)]
    const withE: CmaComp[] = [...five, excludedSale]
    const tiers = new Map(tierByKey).set('E', 'strong')
    const narrative = 'The 55 Juniper Way sale anchors the range at the top.'
    const one = finalComparabilityNarrative({ ...base, priced: five, candidates: withE, tierByKey: tiers, narrative })
    expect(one.narrative).toBe('Five closed sales were retained. One candidate sale was excluded by the comparability review.')
    const round2 = { ...base, candidates: withE, tierByKey: tiers, breakdown: { reviewExcluded: 1, differentProduct: 0, auditRemoved: 1 } }
    expect(finalComparabilityNarrative({ ...round2, narrative }).narrative).toBe(
      "Four closed sales were retained. One candidate sale was excluded by the comparability review. One sale was removed on the independent audit's findings.",
    )
    expect(finalComparabilityNarrative({ ...round2, narrative: one.narrative }).narrative).toBe(
      'One candidate sale was excluded by the comparability review.',
    )
  })
})

describe('every pass gates the judge\'s own narrative, not the pass before it (second review of da8dce6, item A)', () => {
  // Eight candidates: five the review kept (A to E), three it excluded. The
  // audit repair later removes E.
  const five = [...priced, sale('E', '5 Birch Ln', 600000)]
  const eight: CmaComp[] = [...five, excludedSale, sale('R2', '11 Cedar Ln', 900000), sale('R3', '12 Alder Ln', 900000)]
  const tiers = new Map<string, string>([
    ...five.map((c) => [c.listingKey, 'strong'] as const),
    ['R1', 'exclude'],
    ['R2', 'exclude'],
    ['R3', 'exclude'],
  ])
  const ctx = {
    candidates: eight,
    excluded: [
      { listingKey: 'R1', reason: 'Larger home.' },
      { listingKey: 'R2', reason: 'Larger home.' },
      { listingKey: 'R3', reason: 'Larger home.' },
    ],
    subject: base.subject,
    market: null,
    tierByKey: tiers,
    gatedKeys: new Set(five.map((c) => c.listingKey)),
    differentProduct: 0,
  }

  it('a repair drop keeps the exclusion disclosure, with the corrected count', () => {
    // Nothing true in the judge's text on either set: the count line prints.
    const gate = comparabilityNarrativeGate('The 55 Juniper Way sale anchors the range at the top.', ctx)
    const first = gate.gate(five)
    expect(first.narrative).toBe('Five closed sales were retained. Three candidate sales were excluded by the comparability review.')
    const second = gate.gate(priced)
    expect(second.narrative).toBe(
      "Four closed sales were retained. Three candidate sales were excluded by the comparability review. One sale was removed on the independent audit's findings.",
    )
    // What the old wiring shipped: pass 2 gated pass 1's count line, lost the
    // retained count and kept no complete disclosure.
    expect(finalComparabilityNarrative({ ...base, candidates: eight, tierByKey: tiers, excluded: ctx.excluded, narrative: first.narrative, breakdown: gate.breakdown(priced) }).narrative).toBe(
      'Three candidate sales were excluded by the comparability review.',
    )
  })

  it('restores a judge sentence the first set refuted and the repaired set bears out', () => {
    // A to D run $250 to $280 per square foot; E at $300 is the one the audit removes.
    const judge = 'Four closed sales were kept, from $250 to $280 per square foot. Three candidate sales were excluded as a different price tier.'
    const gate = comparabilityNarrativeGate(judge, ctx)
    const first = gate.gate(five)
    expect(first.narrative).toBe('Three candidate sales were excluded as a different price tier.')
    expect(first.removed.map((f) => f.kind).sort()).toEqual(['band', 'count'])
    const second = gate.gate(priced)
    expect(second.narrative).toBe(judge)
    expect(second.removed).toEqual([])
    expect(gate.source).toBe(judge)
  })

  it('adopts a rewrite only when true prose survives, and puts the judge\'s text back on revert', () => {
    const gate = comparabilityNarrativeGate('The 55 Juniper Way sale anchors the range at the top.', ctx)
    const refuted = gate.adopt('Nine closed sales were kept.', priced)
    expect(refuted.adopted).toBe(false)
    expect(gate.source).toBe('The 55 Juniper Way sale anchors the range at the top.')
    const good = gate.adopt('Four closed sales were kept, from $250 to $280 per square foot.', priced)
    expect(good.adopted).toBe(true)
    expect(gate.gate(priced).narrative).toBe('Four closed sales were kept, from $250 to $280 per square foot.')
    gate.revert()
    expect(gate.source).toBe('The 55 Juniper Way sale anchors the range at the top.')
  })
})

describe('both builders print the narrative through the one gate (source lock)', () => {
  const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')
  for (const rel of ['lib/cma/build.ts', 'lib/bpo/build.ts']) {
    it(`${rel} gates the judge's narrative through comparabilityNarrativeGate and nothing else`, () => {
      const src = read(rel)
      expect(src).toMatch(/comparabilityNarrativeGate\(judgment\?\.narrative,/)
      expect(src).toMatch(/narrativeGate\.gate\(/)
      // Created once, from the judge's text; a pass never reads what a pass printed.
      expect(src.match(/comparabilityNarrativeGate\(/g)).toHaveLength(1)
      expect(src).not.toMatch(/\.(?:gate|adopt)\([^)]*judgment/)
      expect(src).not.toMatch(/alignNarrativeToFinalSet\(|honestComparabilityLine\(|checkNarrativeIntegrity\(|finalComparabilityNarrative\(/)
    })
  }
})
