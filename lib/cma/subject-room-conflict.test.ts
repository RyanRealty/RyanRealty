import { describe, expect, it } from 'vitest'
import {
  ROOM_HISTORY_MAX_AGE_YEARS,
  mostRecentClosedRecord,
  reconcileSubjectRoomCounts,
} from '@/lib/cma/subject-room-conflict'

const asOf = '2026-09-10'

function rec(over: Partial<Parameters<typeof mostRecentClosedRecord>[1][number]> = {}) {
  return { beds: 4, baths: 3, sqft: 2080, closeDate: '2022-05-01', status: 'Closed', ...over }
}

describe('mostRecentClosedRecord', () => {
  it('takes the newest closed sale at the same size', () => {
    const r = mostRecentClosedRecord(2080, [
      rec({ closeDate: '2018-01-01', baths: 2 }),
      rec({ closeDate: '2022-05-01', baths: 3 }),
    ])
    expect(r?.closeDate).toBe('2022-05-01')
  })

  it('ignores a cancellation — nothing closed, so nobody checked the sheet', () => {
    expect(mostRecentClosedRecord(2080, [rec({ status: 'Canceled', closeDate: '2024-01-01' })])).toBeNull()
  })

  it('ignores a record at a different size — the house was added onto', () => {
    expect(mostRecentClosedRecord(2080, [rec({ sqft: 1600 })])).toBeNull()
  })

  it('returns null when the subject has no size to compare against', () => {
    expect(mostRecentClosedRecord(null, [rec()])).toBeNull()
  })
})

describe('reconcileSubjectRoomCounts — flag it, use the history', () => {
  it('prices off the record and flags it when the listing disagrees', () => {
    const out = reconcileSubjectRoomCounts(
      { beds: 5, baths: 4, sqft: 2080 },
      [rec({ beds: 4, baths: 3, closeDate: '2022-05-01' })],
      { asOf },
    )
    expect(out.beds).toBe(4)
    expect(out.baths).toBe(3)
    expect(out.conflicts).toHaveLength(2)
    expect(out.conflicts.every((c) => c.usedHistory)).toBe(true)
    expect(out.conflicts[0]!.note).toContain('sale record was used')
  })

  it('flags a stale record but does NOT let it price the house', () => {
    const out = reconcileSubjectRoomCounts(
      { beds: 5, baths: 4, sqft: 2080 },
      [rec({ beds: 4, baths: 3, closeDate: '2010-07-23' })],
      { asOf },
    )
    expect(out.beds).toBe(5)
    expect(out.baths).toBe(4)
    expect(out.conflicts).toHaveLength(2)
    expect(out.conflicts.every((c) => c.usedHistory)).toBe(false)
    expect(out.conflicts[0]!.note).toContain('years old')
  })

  it('says nothing when the listing and the record agree', () => {
    const out = reconcileSubjectRoomCounts({ beds: 4, baths: 3, sqft: 2080 }, [rec()], { asOf })
    expect(out.conflicts).toEqual([])
    expect(out.beds).toBe(4)
  })

  it('ignores a half-bath difference — the whole count is what decides comps', () => {
    const out = reconcileSubjectRoomCounts({ beds: 4, baths: 3.5, sqft: 2080 }, [rec({ baths: 3 })], { asOf })
    expect(out.conflicts).toEqual([])
    expect(out.baths).toBe(3.5)
  })

  it('flags only the room that actually differs', () => {
    const out = reconcileSubjectRoomCounts({ beds: 4, baths: 4, sqft: 2080 }, [rec({ beds: 4, baths: 3 })], { asOf })
    expect(out.conflicts.map((c) => c.field)).toEqual(['baths'])
    expect(out.beds).toBe(4)
    expect(out.baths).toBe(3)
  })

  it('leaves the subject alone when it has no closed record', () => {
    const out = reconcileSubjectRoomCounts({ beds: 5, baths: 4, sqft: 2080 }, [], { asOf })
    expect(out).toEqual({ beds: 5, baths: 4, conflicts: [] })
  })

  it('holds the staleness bound at ten years', () => {
    expect(ROOM_HISTORY_MAX_AGE_YEARS).toBe(10)
  })
})
