/**
 * Fixtures for the deterministic narrative-fabrication check.
 *
 * Every "clean" case here is a real shape lifted from the live corpus that an
 * earlier, looser draft of this check FALSE-POSITIVED on. They are the point of
 * the file: a check that wrongly blocks a defensible document is its own §0
 * failure, so the near-misses are tested as hard as the fabrications.
 */
import { describe, expect, it } from 'vitest'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import { computeAuditVerdict } from '@/lib/cma/audit'
import type { CmaAdjustedComp } from '@/lib/cma/types'

const comp = (address: string, closePrice: number, subdivision: string | null = null): CmaAdjustedComp =>
  ({ listingKey: address, address, closePrice, subdivision, city: 'Bend' }) as unknown as CmaAdjustedComp

const subject = { streetAddress: '3415 Marys Grace', city: 'Bend', subdivision: 'Woodward Highlands' }

const run = (narrative: string, comps: CmaAdjustedComp[], excluded: Array<{ listingKey: string; reason: string }> = []) =>
  checkNarrativeIntegrity({ narrative, comps, excluded, subject, market: null })

const SET = [
  comp('62719 Hawkview', 610000, 'Oakview'),
  comp('21336 Evelyn', 604500, 'Mirada'),
  comp('2713 Black Oak', 570000, 'Oakview'),
  comp('653 Providence', 590000, 'Crosswinds'),
]

describe('checkNarrativeIntegrity — cited comps that do not exist', () => {
  it('flags a comp cited with a price that matches no priced comp', () => {
    const out = run(
      'The strongest comps sold between $290 to $312/sqft: Hawkview at $303/sqft, Brooklyn in Mirada at $309/sqft, ' +
        'Providence in Crosswinds at $312/sqft, Black Oak in Oakview at $294/sqft, and Evelyn in Mirada at $290/sqft.',
      SET,
    )
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('critical')
    expect(out[0].category).toBe('data-integrity')
    expect(out[0].claim).toContain('Brooklyn')
  })

  it('flags a comp named in an "on <street>" comp list', () => {
    const out = run(
      'Four strong comps on Star Ridge, De Haviland, Jonahs, and Lupine sold between $368 to $394/sqft.',
      [comp('20235 Star Ridge', 600000), comp('3279 Jonahs', 590000), comp('20970 Lupine', 579900)],
    )
    expect(out.map((o) => o.claim).join(' ')).toContain('De Haviland')
    expect(out[0].severity).toBe('critical')
  })

  it('flags a comp named in a bare parenthesised list', () => {
    const out = run(
      'Five comparable sales range from $314/sqft to $344/sqft (Stage Stop, Wood Duck, Canvasback, Snow Goose, and Gross).',
      [comp('55918 Snow Goose', 640000), comp('16795 Stage Stop', 620000), comp('17385 Canvasback', 610000), comp('55371 Gross', 600000)],
    )
    expect(out.map((o) => o.claim).join(' ')).toContain('Wood Duck')
  })

  it('flags "the <Name> property" when that property is not priced', () => {
    const out = run(
      'Only two strong comparables remain: the Obernolte property (2440 sqft, sold $1,125,000 at $461/sqft) and the ' +
        'Ward property (2162 sqft, sold $1,620,000 at $749/sqft).',
      [comp('63940 Quail Haven', 1100000), comp('67000 Fryrear', 900000), comp('61212 Obernolte', 1125000)],
    )
    expect(out.map((o) => o.claim).join(' ')).toContain('Ward')
  })

  it('reports every phantom name in one finding (cma-57522-tamarack, verbatim)', () => {
    const out = run(
      'One comp on your same street (Tamarack) sold in March for $690,000 at $464/sqft in immaculate condition, ' +
        'while updated and newer-vintage homes on Lupine and Sandhill reached $467 to $528/sqft but represent a ' +
        'higher quality tier.',
      [comp('17839 Lava Butte', 640000), comp('18075 Juniper', 475000), comp('57532 Tamarack', 690000)],
    )
    expect(out).toHaveLength(1)
    expect(out[0].claim).toContain('Lupine')
    expect(out[0].claim).toContain('Sandhill')
    // "a higher quality tier" is a comparability remark, NOT a statement that
    // the sale was left out — the report never says these are absent.
    expect(out[0].claim).not.toContain('Tamarack')
  })
})

describe('checkNarrativeIntegrity — near misses that must NOT flag', () => {
  it('passes a narrative whose every citation is in the set', () => {
    expect(
      run('Hawkview at $303/sqft, Providence at $312/sqft, Black Oak at $294/sqft, and Evelyn at $290/sqft.', SET),
    ).toEqual([])
  })

  it('ignores a comp the report says it EXCLUDED (the excluded list carries no address)', () => {
    expect(run('One pre-2000 comp (Faith, 1998) was excluded for vintage and size mismatch.', SET)).toEqual([])
    expect(run('Cherrywood was excluded at $556/sqft for extensive 2022 updates.', SET)).toEqual([])
    expect(run('Two river-view sales on Siskin ($561/sqft) and Goldfinch ($606/sqft) were excluded.', SET)).toEqual([])
    expect(run('The Taos sale at $1.025M is excluded as a different luxury tier.', SET)).toEqual([])
  })

  it('carries a BULK exclusion into the sentence that enumerates it', () => {
    expect(
      run(
        'All six candidate comps were excluded because none are comparable to a 2024 new-construction home. ' +
          'Two comps are manufactured homes (Blue Eagle at $267/sqft, Sun Country at $260/sqft), and the three ' +
          'remaining stick-builts are 34% smaller.',
        SET,
      ),
    ).toEqual([])
  })

  it('still flags a retained comp inside a sentence that opens with an exclusion', () => {
    const out = run(
      'After excluding the property on Sheila ($207/sqft), six strong comps remain: Judd, Green Heart, Wildriver, ' +
        'Bridge, and Sugar Pine sold between $770k and $1.2M.',
      [comp('14400 Judd', 875000), comp('15032 Green Heart', 770000), comp('14717 Sugar Pine', 870000)],
    )
    const text = out.map((o) => o.claim).join(' ')
    expect(text).toContain('Wildriver')
    expect(text).toContain('Bridge')
    expect(text).not.toContain('Sheila')
  })

  it('does not treat the subject’s own street as a comp citation', () => {
    expect(
      run(
        'The subject is a compound of two detached residences on Whychus Creek frontage. All five candidate comps ' +
          'are standard single-family homes ranging from $641 to $746/sqft.',
        [comp('601 Seedling', 900000), comp('363 Aspenwood', 910000), comp('187 Jefferson', 920000), comp('572 Sisters Woodlands', 930000), comp('506 Sapling', 940000)],
      ),
    ).toEqual([])
  })

  it('does not flag builders, styles, certifications or regional geography', () => {
    expect(run('Six strong Petrosa comps by Pahlisch Homes sold between $335/sqft and $344/sqft.', SET)).toEqual([])
    expect(run('Coyote Springs (2,898 sqft, built 2001, Craftsman, $303/sqft) backs to National Forest.', SET)).toEqual([])
    expect(run('Identical 2019 build and Earth Advantage certification ($382/sqft).', SET)).toEqual([])
    expect(run('The property competes in the $326 to $524/sqft band of rural Tumalo estates at $400/sqft.', SET)).toEqual([])
  })

  it('resolves a short street name and a shortened or re-spaced form', () => {
    expect(run('The Elm Avenue sale at $269/sqft is kept as a weak comp.', [comp('2822 Elm', 420000), ...SET])).toEqual([])
    expect(run('Wildriver at $1,215,000 anchors the top.', [comp('53589 Wild River Loop', 1215000)])).toEqual([])
  })

  it('accepts a name that only appears as a comp subdivision or the market label', () => {
    expect(run('The Mirada sale at $309/sqft is the closest match.', SET)).toEqual([])
    expect(
      checkNarrativeIntegrity({
        narrative: 'The Sunriver comp at $450/sqft brackets the subject.',
        comps: SET,
        excluded: [],
        subject,
        market: { geoLabel: 'Sunriver' } as never,
      }),
    ).toEqual([])
  })

  it('returns nothing when there is no narrative or no comps', () => {
    expect(run('', SET)).toEqual([])
    expect(run('Brooklyn at $309/sqft.', [])).toEqual([])
    expect(checkNarrativeIntegrity({ narrative: null, comps: SET, excluded: [], subject, market: null })).toEqual([])
  })
})

describe('checkNarrativeIntegrity — comp-count claims', () => {
  it('flags a whole-set count higher than the priced set', () => {
    const out = run('All five comps are from the same Redhawk subdivision.', SET)
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('critical')
    expect(out[0].category).toBe('data-integrity')
    expect(out[0].claim).toContain('All five comps')
  })

  it('flags "N comps remain" higher than the priced set', () => {
    expect(run('Five comps remain after excluding three riverfront properties.', SET.slice(0, 3))).toHaveLength(1)
    expect(run('Six strong comps form the core set.', SET.slice(0, 3))).toHaveLength(1)
  })

  it('does not flag a count that matches, or one that UNDER-states the set', () => {
    expect(run('All four comps are from the same subdivision.', SET)).toEqual([])
    expect(run('Two comps remain strong after exclusions.', SET)).toEqual([])
    expect(run('Only one comp remains directly comparable.', SET)).toEqual([])
  })

  it('does not read a CANDIDATE count as a priced-set count', () => {
    expect(run('All six candidate comps were reviewed before pricing.', SET)).toEqual([])
  })

  it('does not read a subset count as a whole-set count', () => {
    expect(run('One comp on your same street sold in March. Two comps are usable with adjustments.', SET)).toEqual([])
  })
})

describe('checkNarrativeIntegrity — sold-price brackets', () => {
  it('flags a bracket high end no priced comp reaches', () => {
    const out = run(
      'The comps sold between $770k and $1.2M, bracketing the subject.',
      [comp('14400 Judd', 875000), comp('15032 Green Heart', 770000), comp('14717 Sugar Pine', 870000)],
    )
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('critical')
    expect(out[0].category).toBe('data-integrity')
    expect(out[0].evidence).toContain('$875,000')
  })

  it('flags a bracket low end below the set', () => {
    expect(run('The retained set sold between $200,000 and $610,000.', SET)).toHaveLength(1)
  })

  it('does not flag a bracket inside the set, or a $/sqft band', () => {
    expect(run('The comps sold between $570,000 and $610,000.', SET)).toEqual([])
    expect(run('Recent sales sold from $580,000 to $600,000.', SET)).toEqual([])
    expect(run('The comps sold between $290 to $312 per square foot.', SET)).toEqual([])
  })
})

describe('checkNarrativeIntegrity — output contract', () => {
  it('emits findings that computeAuditVerdict turns into a blocking fail', () => {
    const out = run('Brooklyn in Mirada at $309/sqft anchors the set.', SET)
    expect(out).toHaveLength(1)
    expect(computeAuditVerdict(out)).toBe('fail')
  })

  it('emits brand-voice-safe prose (no em dash, en dash, or semicolon)', () => {
    const out = run(
      'Six strong comps remain: Judd, Wildriver, and Bridge sold between $770k and $1.2M.',
      [comp('14400 Judd', 875000), comp('15032 Green Heart', 770000), comp('14717 Sugar Pine', 870000)],
    )
    expect(out.length).toBeGreaterThan(0)
    for (const finding of out) {
      expect(`${finding.claim} ${finding.evidence}`).not.toMatch(/[—–;]/)
    }
  })

  it('never attaches a comp listing key, so buildCma self-repair cannot drop a comp on it', () => {
    for (const finding of run('Brooklyn at $309/sqft.', SET)) expect(finding.compListingKey).toBeNull()
  })
})
