import { describe, expect, it } from 'vitest'
import { carriedRoomDecision, roomCountsDecision } from '@/lib/pricing/room-ground'

/**
 * cma-1117-milwaukee, 2026-10-08. listings rows read 2026-10-08:
 * 1117 Milwaukee (Boulevard): 2 bed, BathroomsTotal 1, baths_full 1, baths_half 0.
 * 852 Columbia (Boulevard):   2 bed, BathroomsTotal 3, baths_full 2, baths_half 1.
 */
const MILWAUKEE = { beds: 2, baths: 1, bathsFull: 1, bathsHalf: 0, subdivision: 'Boulevard' }
const COLUMBIA = {
  address: '852 Columbia',
  beds: 2,
  baths: 3,
  bathsFull: 2,
  bathsHalf: 1,
  subdivision: 'Boulevard',
  ownPlat: true,
}

describe('roomCountsDecision records what it compared', () => {
  it('compares full baths when both homes carry the split, and keeps one apart on the own plat', () => {
    const d = roomCountsDecision(MILWAUKEE, COLUMBIA)
    expect(d.ok).toBe(true)
    expect(d.notes).toEqual(['baths'])
    expect(d.compared).toEqual({
      subjectBeds: 2,
      saleBeds: 2,
      subjectBaths: 1,
      saleBaths: 2,
      bathBasis: 'full',
      local: true,
      phaseFamily: false,
    })
  })

  it('compares the totals when either side has no split, and a two-bath gap stays', () => {
    const d = roomCountsDecision({ ...MILWAUKEE, bathsFull: null, bathsHalf: null }, COLUMBIA)
    expect(d.ok).toBe(true)
    expect(d.notes).toEqual(['baths'])
    expect(d.gap.baths).toBe(2)
    expect(d.compared.bathBasis).toBe('total')
    expect(d.compared.subjectBaths).toBe(1)
    expect(d.compared.saleBaths).toBe(3)
  })
})

describe('carriedRoomDecision reads the picker stamp', () => {
  it('re-runs the rule on the counts the picker compared when the split did not travel', () => {
    const stamp = roomCountsDecision(MILWAUKEE, COLUMBIA)
    // The subject reaches this check with its total only, and the sale lost
    // its split too. Totals three or more apart refuse. The stamp re-runs the
    // full-bath counts the picker compared, which are one apart.
    const bare = { beds: 2, baths: 1 }
    const stripped = { ...COLUMBIA, baths: 5, bathsFull: null, bathsHalf: null }
    expect(carriedRoomDecision(bare, stripped).ok).toBe(false)
    const carried = carriedRoomDecision(bare, { ...stripped, roomDecision: stamp })
    expect(carried.ok).toBe(true)
    expect(carried.notes).toEqual(['baths'])
    expect(carried.compared).toEqual(stamp.compared)
  })

  it('carries a refusal too: a stamp the picker would have refused still refuses', () => {
    // Three whole baths apart is still a refusal, on or off the plat. Two apart is not.
    const twoApart = {
      ...COLUMBIA,
      baths: 4,
      bathsFull: 4,
      bathsHalf: 0,
      subdivision: 'Highland',
      ownPlat: false,
    }
    const offGround = roomCountsDecision(MILWAUKEE, twoApart)
    expect(offGround.ok).toBe(false)
    expect(carriedRoomDecision(MILWAUKEE, { ...twoApart, roomDecision: offGround }).ok).toBe(false)
  })

  it('decides from the sale itself when no picker stamped it', () => {
    expect(carriedRoomDecision(MILWAUKEE, COLUMBIA)).toEqual(roomCountsDecision(MILWAUKEE, COLUMBIA))
  })
})
