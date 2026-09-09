/**
 * THE SEARCH STORY MUST BE DERIVABLE FROM THE SEARCH (round four, class E).
 *
 * cma-2465-7th-redmond-97756 told the reader "There were not enough recent
 * sales inside Diamond Bar Ranch, so we opened to 1 mile" while three of the
 * five sales the document printed ARE Diamond Bar Ranch, and six of the eight
 * candidates the ladder held came from in-subdivision rungs. The old sentence
 * was written from the tier NAMES alone — the moment the ladder stepped past
 * the subdivision it claimed a shortage, whatever the subdivision had actually
 * produced. Every claim here comes off a count, and no claim survives a count
 * that contradicts it.
 */
import { describe, expect, it } from 'vitest'
import { rungLabel } from '@/lib/pricing/comp-search'
import { buildCompSearch, usableSubdivision, type CompSearchRungInput } from './comp-search'

const rung = (over: Partial<CompSearchRungInput>): CompSearchRungInput => ({
  tier: 'subdivision-3mo',
  ran: true,
  monthsBack: 3,
  compsAdded: 0,
  ...over,
})

/** The 2465 7th trace: six of eight candidates from in-subdivision rungs. */
const diamondBarLadder: CompSearchRungInput[] = [
  rung({ tier: 'subdivision-3mo', monthsBack: 3, compsAdded: 2 }),
  rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 3 }),
  rung({ tier: 'subdivision-9mo', monthsBack: 9, compsAdded: 1 }),
  rung({ tier: 'subdivision-3mo-wide', monthsBack: 3, compsAdded: 0 }),
  rung({ tier: 'nearby-1mi-3mo', monthsBack: 3, compsAdded: 2 }),
  rung({ tier: 'nearby-1mi-6mo', monthsBack: 6, ran: false, compsAdded: 0 }),
]

const dbr = (n: number) => Array.from({ length: n }, () => ({ subdivision: 'Diamond Bar Ranch' }))
const other = (n: number, name: string | null = 'Redmond Heights') =>
  Array.from({ length: n }, () => ({ subdivision: name }))

describe('buildCompSearch — the rungs, the counts, the sentence', () => {
  it('never claims a shortage the counts contradict (2465 7th)', () => {
    const s = buildCompSearch({
      subdivision: 'Diamond Bar Ranch',
      ladder: diamondBarLadder,
      keptComps: [...dbr(3), ...other(2)],
    })
    expect(s).not.toBeNull()
    expect(s!.sentence).not.toMatch(/not enough|too few|no recent sale/i)
    expect(s!.sentence).toContain('Three of the five sales are in Diamond Bar Ranch')
    expect(s!.sentence).toContain('Two more')
    expect(s!.sentence).toContain('within a mile at your size')
  })

  it('counts the kept sales by subdivision, by name', () => {
    const s = buildCompSearch({
      subdivision: 'Diamond Bar Ranch',
      ladder: diamondBarLadder,
      keptComps: [...dbr(3), ...other(2)],
    })
    expect(s!.keptBySubdivision).toEqual({ 'Diamond Bar Ranch': 3, 'Redmond Heights': 2 })
    expect(s!.subdivision).toBe('Diamond Bar Ranch')
  })

  it('reports every rung that ran, with what it added and what survived', () => {
    const s = buildCompSearch({
      subdivision: 'Diamond Bar Ranch',
      ladder: diamondBarLadder,
      keptComps: [
        { subdivision: 'Diamond Bar Ranch', selectionTier: 'subdivision-3mo' },
        { subdivision: 'Diamond Bar Ranch', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Diamond Bar Ranch', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Redmond Heights', selectionTier: 'nearby-1mi-3mo' },
        { subdivision: 'Redmond Heights', selectionTier: 'nearby-1mi-3mo' },
      ],
    })
    // Only rungs that ran are reported; a skipped rung is not a search step a
    // reader can be shown.
    expect(s!.rungs.map((r) => r.key)).toEqual([
      'subdivision-3mo',
      'subdivision-6mo',
      'subdivision-9mo',
      'subdivision-3mo-wide',
      'nearby-1mi-3mo',
    ])
    expect(s!.rungs[0]).toMatchObject({
      key: 'subdivision-3mo',
      label: 'inside Diamond Bar Ranch',
      window: 'the last 3 months',
      added: 2,
      kept: 1,
    })
    expect(s!.rungs.find((r) => r.key === 'subdivision-6mo')!.kept).toBe(2)
    expect(s!.rungs.find((r) => r.key === 'nearby-1mi-3mo')).toMatchObject({
      label: 'within a mile at your size',
      added: 2,
      kept: 2,
    })
    // Every kept comp is attributed to exactly one rung.
    expect(s!.rungs.reduce((a, r) => a + r.kept, 0)).toBe(5)
  })

  it('says the subdivision produced nothing ONLY when it produced nothing', () => {
    const s = buildCompSearch({
      subdivision: 'Diamond Bar Ranch',
      ladder: [
        rung({ tier: 'subdivision-3mo', compsAdded: 0 }),
        rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 0 }),
        rung({ tier: 'nearby-1mi-6mo', monthsBack: 6, compsAdded: 5 }),
      ],
      keptComps: other(5),
    })
    expect(s!.keptBySubdivision['Diamond Bar Ranch']).toBeUndefined()
    expect(s!.sentence).toMatch(/No recent sale inside Diamond Bar Ranch/)
    expect(s!.sentence).toContain('within a mile at your size')
  })

  it('says so plainly when every sale is in the subdivision', () => {
    const s = buildCompSearch({
      subdivision: 'Kenwood',
      ladder: [rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 6 })],
      keptComps: dbr(0).concat(Array.from({ length: 6 }, () => ({ subdivision: 'Kenwood' }))),
    })
    expect(s!.sentence).toContain('All six sales are in Kenwood')
    expect(s!.sentence).not.toMatch(/more were added|opened/i)
  })

  it('names two outside rungs separately, and folds three or more', () => {
    const two = buildCompSearch({
      subdivision: 'Kenwood',
      ladder: [
        rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 2 }),
        rung({ tier: 'nearby-1mi-6mo', monthsBack: 6, compsAdded: 2 }),
        rung({ tier: 'similar-sub-9mo', monthsBack: 9, compsAdded: 1 }),
      ],
      keptComps: [
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Awbrey', selectionTier: 'nearby-1mi-6mo' },
        { subdivision: 'Awbrey', selectionTier: 'nearby-1mi-6mo' },
        { subdivision: 'River West', selectionTier: 'similar-sub-9mo' },
      ],
    })
    expect(two!.sentence).toContain('Two of the five sales are in Kenwood')
    expect(two!.sentence).toContain('within a mile at your size')
    expect(two!.sentence).toContain('subdivisions that price like yours')
  })

  it('has no subdivision to name, and says what it searched instead', () => {
    const s = buildCompSearch({
      subdivision: null,
      ladder: [rung({ tier: 'nearby-2mi-6mo', monthsBack: 6, compsAdded: 5 })],
      keptComps: other(5, null),
    })
    expect(s!.sentence).toContain('within 2 miles')
    expect(s!.sentence).not.toContain('undefined')
    expect(s!.keptBySubdivision).toEqual({})
  })

  /**
   * Both of these came off the live dry run of the four round-four exemplars,
   * after the first cut of this module shipped. They are the reason it counts
   * the sales rather than the tiers.
   */
  it('an MLS placeholder is not a place (cma-65365-concorde)', () => {
    const s = buildCompSearch({
      subdivision: 'N/A',
      ladder: [
        rung({ tier: 'similar-sub-3mo', monthsBack: 3, compsAdded: 1 }),
        rung({ tier: 'rural-10mi-9mo', monthsBack: 9, compsAdded: 1 }),
        rung({ tier: 'rural-15mi-18mo', monthsBack: 18, compsAdded: 4 }),
      ],
      keptComps: [
        { subdivision: 'N/A', selectionTier: 'similar-sub-3mo' },
        { subdivision: 'N/A', selectionTier: 'rural-10mi-9mo' },
        { subdivision: 'N/A', selectionTier: 'rural-15mi-18mo' },
        { subdivision: 'N/A', selectionTier: 'rural-15mi-18mo' },
        { subdivision: 'N/A', selectionTier: 'rural-15mi-18mo' },
        { subdivision: 'CLAS', selectionTier: 'rural-15mi-18mo' },
      ],
    })
    expect(s!.subdivision).toBeNull()
    expect(s!.sentence).not.toContain('N/A')
    expect(s!.keptBySubdivision['N/A']).toBeUndefined()
    expect(s!.keptBySubdivision).toEqual({ CLAS: 1 })
    expect(s!.sentence).toContain('The six sales come from')
  })

  it('every placeholder the pricing normalizer drops, this drops too', () => {
    for (const v of ['N/A', 'n/a', 'NA', 'None', 'null', 'Other', 'Unknown', 'TBD', '--', 'not in a subdivision']) {
      expect(usableSubdivision(v)).toBeNull()
    }
    expect(usableSubdivision('Diamond Bar Ranch')).toBe('Diamond Bar Ranch')
    expect(usableSubdivision('Northwest Crossing')).toBe('Northwest Crossing')
  })

  it('names only the rungs the outside sales actually came from', () => {
    // Three rungs contributed candidates but only ONE sale outside the
    // subdivision survived. The sentence may name that sale's rung and no
    // other, or the count and the list disagree in one line.
    const s = buildCompSearch({
      subdivision: 'Kenwood',
      ladder: [
        rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 4 }),
        rung({ tier: 'nearby-1mi-6mo', monthsBack: 6, compsAdded: 3 }),
        rung({ tier: 'similar-sub-9mo', monthsBack: 9, compsAdded: 2 }),
        rung({ tier: 'city-5mi-9mo', monthsBack: 9, compsAdded: 2 }),
      ],
      keptComps: [
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Awbrey', selectionTier: 'nearby-1mi-6mo' },
      ],
    })
    expect(s!.sentence).toBe(
      'Three of the four sales are in Kenwood. One more was added from within a mile at your size.',
    )
    expect(s!.sentence).not.toContain('subdivisions that price like yours')
    expect(s!.sentence).not.toContain('the wider city')
  })

  it('speaks the listings ladder in the same language (1617 NW 8th)', () => {
    const s = buildCompSearch({
      subdivision: 'Kenwood',
      ladder: [
        rung({ tier: 'subdivision-6mo', monthsBack: 6, compsAdded: 2 }),
        rung({ tier: 'neighborhood-6mo', monthsBack: 6, compsAdded: 3 }),
      ],
      keptComps: [
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Kenwood', selectionTier: 'subdivision-6mo' },
        { subdivision: 'Awbrey Butte', selectionTier: 'neighborhood-6mo' },
        { subdivision: 'Awbrey Butte', selectionTier: 'neighborhood-6mo' },
        { subdivision: 'River West', selectionTier: 'neighborhood-6mo' },
      ],
    })
    expect(s!.sentence).toContain('the neighborhood around your home')
    // No tier name ever reaches a seller.
    expect(s!.sentence).not.toMatch(/neighborhood-6mo|subdivision-6mo|-\d+mo/)
    for (const r of s!.rungs) expect(r.label).not.toBe(r.key)
  })

  it('is null when no rung ran at all', () => {
    expect(buildCompSearch({ subdivision: 'Kenwood', ladder: [], keptComps: [] })).toBeNull()
  })

  it('a broker-curated set says the broker chose the sales', () => {
    const s = buildCompSearch({
      subdivision: 'Kenwood',
      ladder: [rung({ tier: 'broker-selected', monthsBack: 0, compsAdded: 4 })],
      keptComps: Array.from({ length: 4 }, () => ({ subdivision: 'Kenwood' })),
    })
    expect(s!.sentence).toContain('chosen by your broker')
  })
})

describe('rungLabel — the containment rungs in seller language', () => {
  it('names the touching plats and the boundary exit, never the tier name', () => {
    expect(rungLabel('adjacent-sub-6mo', 'Kenwood')).toBe('the subdivisions next to yours')
    expect(rungLabel('adjacent-subdivision-12mo', null)).toBe('the subdivisions next to yours')
    expect(rungLabel('beyond-2mi-12mo', null)).toBe('outside your neighborhood, within 2 miles')
  })
})

describe('buildCompSearch — on acreage the record carries the split sentence', () => {
  it('names the splits, and leaves the base sentence alone', () => {
    const s = buildCompSearch({
      subdivision: 'Diamond Bar Ranch',
      ladder: diamondBarLadder,
      keptComps: [...dbr(3), ...other(2)],
      rural: { subjectZone: 'EFUTRB', counts: { zoning_class: 61, acreage_infrastructure: 70, outbuildings: 34, terrain: 0 } },
    })
    expect(s!.sentence).toContain('Three of the five sales are in Diamond Bar Ranch')
    expect(s!.ruralSentence).toContain('61 sales on rural residential land')
    const town = buildCompSearch({ subdivision: 'Diamond Bar Ranch', ladder: diamondBarLadder, keptComps: [...dbr(3), ...other(2)] })
    expect(town!.ruralSentence).toBeNull()
  })
})
