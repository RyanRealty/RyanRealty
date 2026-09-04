/**
 * Schedule lock for the prospecting first-touch drip:
 * weekday 08:00 PT open, HARDCODED 5m spacing, one-at-a-time (spacing gate).
 */
import { describe, expect, it } from 'vitest'
import {
  DRIP_SPACING_MINUTES,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
  canSendDripNow,
  isDripWeekday,
  isDripWindowOpen,
} from './drip-schedule'

// 2026-09-03 is a Thursday. 15:00 UTC = 08:00 PDT (UTC-7).
const THU_8AM_PT = new Date('2026-09-03T15:00:00.000Z')
const THU_7_59_PT = new Date('2026-09-03T14:59:00.000Z')
const THU_8_05_PT = new Date('2026-09-03T15:05:00.000Z')
const THU_NOON_PT = new Date('2026-09-03T19:00:00.000Z')
const SAT_10AM_PT = new Date('2026-09-05T17:00:00.000Z')
const SUN_10AM_PT = new Date('2026-09-06T17:00:00.000Z')

describe('drip-schedule — locked weekday 8am PT window', () => {
  it('hardcodes 08:00 America/Los_Angeles and 5-minute spacing', () => {
    expect(DRIP_TIMEZONE).toBe('America/Los_Angeles')
    expect(DRIP_WEEKDAY_START_MINUTES).toBe(8 * 60)
    expect(DRIP_SPACING_MINUTES).toBe(5)
  })

  it('opens at 08:00 America/Los_Angeles on a weekday', () => {
    expect(isDripWeekday(THU_8AM_PT)).toBe(true)
    expect(isDripWindowOpen(THU_8AM_PT)).toBe(true)
    expect(canSendDripNow({ now: THU_8AM_PT, lastDripSentAt: null })).toEqual({ ok: true })
  })

  it('stays closed one minute before 08:00 PT on a weekday', () => {
    expect(isDripWindowOpen(THU_7_59_PT)).toBe(false)
    expect(canSendDripNow({ now: THU_7_59_PT, lastDripSentAt: null })).toEqual({
      ok: false,
      reason: 'before-window',
    })
  })

  it('refuses Saturday and Sunday even after 08:00 PT', () => {
    expect(isDripWeekday(SAT_10AM_PT)).toBe(false)
    expect(isDripWeekday(SUN_10AM_PT)).toBe(false)
    expect(canSendDripNow({ now: SAT_10AM_PT, lastDripSentAt: null })).toEqual({
      ok: false,
      reason: 'weekend',
    })
    expect(canSendDripNow({ now: SUN_10AM_PT, lastDripSentAt: null })).toEqual({
      ok: false,
      reason: 'weekend',
    })
  })
})

describe('drip-schedule — 5m spacing / one-at-a-time', () => {
  it('blocks a second send inside the 5-minute spacing window', () => {
    const decision = canSendDripNow({
      now: THU_8_05_PT,
      lastDripSentAt: THU_8AM_PT,
    })
    // 8:00 → 8:05 is exactly 5 minutes → ok at boundary; 4:59 still blocked
    expect(
      canSendDripNow({
        now: new Date(THU_8AM_PT.getTime() + 5 * 60_000 - 1),
        lastDripSentAt: THU_8AM_PT,
      }),
    ).toEqual({ ok: false, reason: 'spacing' })
    expect(decision).toEqual({ ok: true })
  })

  it('allows the next send once 5 minutes have elapsed (one-at-a-time cadence)', () => {
    const justAfter = canSendDripNow({
      now: new Date(THU_8AM_PT.getTime() + 5 * 60_000),
      lastDripSentAt: THU_8AM_PT,
    })
    expect(justAfter).toEqual({ ok: true })
  })

  it('allows the first send of the day when never sent before', () => {
    expect(canSendDripNow({ now: THU_NOON_PT, lastDripSentAt: null })).toEqual({ ok: true })
  })

  it('never opens two sends without spacing even late in the day', () => {
    const noon = THU_NOON_PT
    const fourMinLater = new Date(noon.getTime() + 4 * 60_000)
    expect(canSendDripNow({ now: fourMinLater, lastDripSentAt: noon })).toEqual({
      ok: false,
      reason: 'spacing',
    })
  })
})
