import { describe, expect, it } from 'vitest'
import { listingAliasPlatLadder } from './listing-alias-plat-trail'

describe('listingAliasPlatLadder', () => {
  it('climbs Stevens Ranch parent to a recorded phase plat', () => {
    const ladder = listingAliasPlatLadder({
      mlsSubdivisionName: 'Stevens Ranch',
      boundarySubdivision: 'STEVENS RANCH PHASE RS-1',
    })
    expect(ladder.parent).toEqual({ label: 'Stevens Ranch', slug: 'stevens-ranch' })
    expect(ladder.plat?.slug).toBe('stevens-ranch-phase-rs-1-plld20211070')
    expect(ladder.plat?.label.toLowerCase()).toMatch(/stevens ranch phase rs-1/i)
  })

  it('withholds when MLS and boundary are the same alias label', () => {
    expect(
      listingAliasPlatLadder({
        mlsSubdivisionName: 'Stevens Ranch',
        boundarySubdivision: 'Stevens Ranch',
      }),
    ).toEqual({ parent: null, plat: null })
  })

  it('withholds when there is no alias entry', () => {
    expect(
      listingAliasPlatLadder({
        mlsSubdivisionName: 'Nowhere Estates',
        boundarySubdivision: 'Nowhere Estates Phase 1',
      }),
    ).toEqual({ parent: null, plat: null })
  })
})
