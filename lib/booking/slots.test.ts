import { describe, it, expect } from 'vitest'
import {
  generateDaySlots,
  upcomingDateKeys,
  officeDayForDateKey,
  overlaps,
  DEFAULT_SLOT_POLICY,
  type BusyInterval,
} from './slots'

const TZ = 'America/Los_Angeles'
// 2026-09-14 is a Monday. 8am PDT = 15:00Z.
const MON = '2026-09-14'
const blocks = [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start_time: '09:00', end_time: '12:00' }]
// Well before the day, so lead time never trims it.
const NOW = new Date('2026-09-10T12:00:00Z')

const gen = (over: Partial<Parameters<typeof generateDaySlots>[0]> = {}) =>
  generateDaySlots({ dateKey: MON, blocks, timeZone: TZ, busy: [], now: NOW, ...over })

describe('officeDayForDateKey', () => {
  it('reads the local weekday', () => {
    expect(officeDayForDateKey(MON, TZ)).toBe('Mon')
    expect(officeDayForDateKey('2026-09-19', TZ)).toBe('Sat')
  })
  it('rejects a malformed key', () => {
    expect(officeDayForDateKey('nope', TZ)).toBeNull()
  })
})

describe('overlaps', () => {
  it('is half-open — touching intervals do not overlap', () => {
    expect(overlaps(0, 10, 10, 20)).toBe(false)
    expect(overlaps(0, 10, 9, 20)).toBe(true)
  })
})

describe('generateDaySlots', () => {
  it('fills the block at the slot length', () => {
    const slots = gen()
    expect(slots).toHaveLength(6) // 9:00-12:00 at 30min
    expect(slots[0].label).toBe('9am')
    expect(slots[5].label).toBe('11:30am')
  })

  it('emits real UTC instants for the local wall time', () => {
    // 9:00 AM PDT on 2026-09-14 is 16:00Z.
    expect(gen()[0].startIso).toBe('2026-09-14T16:00:00.000Z')
  })

  it('offers nothing on a day outside the blocks', () => {
    expect(gen({ dateKey: '2026-09-19' })).toEqual([]) // Saturday
  })

  it('offers nothing when no hours are configured', () => {
    // Deliberately the OPPOSITE of isWithinOfficeHours: empty means closed here,
    // because failing open would publish a calendar nobody agreed to.
    expect(gen({ blocks: [] })).toEqual([])
    expect(gen({ blocks: null })).toEqual([])
  })

  it('skips a malformed or inverted block instead of trusting it', () => {
    expect(gen({ blocks: [{ days: ['Mon'], start_time: '25:00', end_time: '26:00' }] })).toEqual([])
    expect(gen({ blocks: [{ days: ['Mon'], start_time: '12:00', end_time: '09:00' }] })).toEqual([])
  })

  it('never offers a partial slot that would run past closing', () => {
    const slots = gen({ blocks: [{ days: ['Mon'], start_time: '09:00', end_time: '10:20' }] })
    expect(slots.map((s) => s.label)).toEqual(['9am', '9:30am'])
  })

  it('honours the minimum lead time', () => {
    // "Now" is 9:05 AM PDT on the day itself; 120min lead pushes past 11:05.
    const slots = gen({ now: new Date('2026-09-14T16:05:00Z') })
    expect(slots.map((s) => s.label)).toEqual(['11:30am'])
  })

  it('drops slots at or beyond the horizon', () => {
    const slots = gen({ horizon: new Date('2026-09-14T17:00:00Z') }) // 10:00 AM PDT
    expect(slots.map((s) => s.label)).toEqual(['9am', '9:30am'])
  })

  it('removes slots colliding with a busy interval, buffer included', () => {
    // Busy 10:00-10:30 PDT. With a 15min buffer that also kills 9:30 and 10:30.
    const busy: BusyInterval[] = [{
      startMs: Date.parse('2026-09-14T17:00:00Z'),
      endMs: Date.parse('2026-09-14T17:30:00Z'),
    }]
    expect(gen({ busy }).map((s) => s.label)).toEqual(['9am', '11am', '11:30am'])
  })

  it('does not dedupe away distinct slots when blocks overlap', () => {
    const slots = gen({ blocks: [
      { days: ['Mon'], start_time: '09:00', end_time: '10:00' },
      { days: ['Mon'], start_time: '09:30', end_time: '10:30' },
    ] })
    expect(slots.map((s) => s.label)).toEqual(['9am', '9:30am', '10am'])
  })

  it('uses the documented default policy', () => {
    expect(DEFAULT_SLOT_POLICY.slotMinutes).toBe(30)
    expect(DEFAULT_SLOT_POLICY.minLeadMinutes).toBe(120)
  })
})

describe('upcomingDateKeys', () => {
  it('walks forward in local days', () => {
    expect(upcomingDateKeys(new Date('2026-09-14T20:00:00Z'), 3, TZ))
      .toEqual(['2026-09-14', '2026-09-15', '2026-09-16'])
  })

  it('uses the LOCAL day, not the UTC one', () => {
    // 2026-09-15T02:00Z is still Sep 14 in Pacific.
    expect(upcomingDateKeys(new Date('2026-09-15T02:00:00Z'), 1, TZ)).toEqual(['2026-09-14'])
  })
})
