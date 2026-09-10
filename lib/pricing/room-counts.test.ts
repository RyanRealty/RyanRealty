import { describe, expect, it } from 'vitest'
import {
  ROOM_GAP_LOCAL_MAX,
  roomCountVerdict,
  roomCountsUsable,
  roomDifferenceSentence,
} from '@/lib/pricing/room-counts'

describe('roomCountVerdict — adjust inside, wall outside', () => {
  it('lets the same whole count travel anywhere', () => {
    expect(roomCountVerdict(3, 3, { local: false })).toBe('match')
    expect(roomCountVerdict(3, 3, { local: true })).toBe('match')
  })

  it('ignores a half bath on either side', () => {
    expect(roomCountVerdict(3, 3.5, { local: false })).toBe('match')
    expect(roomCountVerdict(3.5, 3, { local: false })).toBe('match')
  })

  it('uses one room apart only on the home’s own ground, and says so', () => {
    expect(roomCountVerdict(4, 3, { local: true })).toBe('noted')
    expect(roomCountVerdict(4, 3, { local: false })).toBe('refuse')
  })

  it('refuses two rooms apart even next door', () => {
    expect(roomCountVerdict(4, 2, { local: true })).toBe('refuse')
    expect(roomCountVerdict(2, 4, { local: true })).toBe('refuse')
  })

  it('refuses a bath and a half apart anywhere — 4 against 2.5 is two whole baths', () => {
    expect(roomCountVerdict(4, 2.5, { local: true })).toBe('refuse')
  })

  it('treats an unknown count as a data gap, not a mismatch', () => {
    expect(roomCountVerdict(null, 3, { local: false })).toBe('match')
    expect(roomCountVerdict(3, null, { local: false })).toBe('match')
    expect(roomCountVerdict(3, 0, { local: false })).toBe('match')
  })

  it('holds the local gap at one room', () => {
    expect(ROOM_GAP_LOCAL_MAX).toBe(1)
  })
})

describe('roomCountsUsable — both counts at once', () => {
  it('passes a twin next door that has one bedroom fewer, and names it', () => {
    const r = roomCountsUsable({ beds: 5, baths: 4 }, { beds: 4, baths: 4 }, { local: true })
    expect(r.ok).toBe(true)
    expect(r.notes).toEqual(['beds'])
  })

  it('names both rooms when both differ', () => {
    const r = roomCountsUsable({ beds: 4, baths: 3 }, { beds: 3, baths: 2 }, { local: true })
    expect(r.ok).toBe(true)
    expect(r.notes).toEqual(['beds', 'baths'])
  })

  it('refuses the same sale from across town', () => {
    expect(roomCountsUsable({ beds: 5, baths: 4 }, { beds: 4, baths: 4 }, { local: false }).ok).toBe(false)
  })

  it('carries no note when everything matches', () => {
    const r = roomCountsUsable({ beds: 4, baths: 3 }, { beds: 4, baths: 3.5 }, { local: false })
    expect(r.ok).toBe(true)
    expect(r.notes).toEqual([])
  })

  it('refuses on either room, not just baths', () => {
    expect(roomCountsUsable({ beds: 5, baths: 3 }, { beds: 3, baths: 3 }, { local: true }).ok).toBe(false)
  })
})

describe('roomDifferenceSentence', () => {
  it('says nothing when there is nothing to say', () => {
    expect(roomDifferenceSentence([])).toBeNull()
    expect(roomDifferenceSentence(null)).toBeNull()
  })

  it('names the room and refuses to invent a dollar value', () => {
    const s = roomDifferenceSentence(['baths'])!
    expect(s).toContain('bathroom')
    expect(s).toContain('no dollar value')
  })
})
