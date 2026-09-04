/**
 * Schedule lock for the prospecting first-touch drip:
 * weekday 08:00 PT open, HARDCODE 5m spacing, one-at-a-time (spacing gate).
 */
import { describe, expect, it } from 'vitest'
import {
  DRIP_SPACING_MINUTES,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
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

describe('drip-schedule — weekday 8am PT window', () => {
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

describe('drip-schedule — spacing / one-at-a-time', () => {
  it('exposes LOCKED spacing constant (HARDCODE 5 minutes)', () => {
    expect(DRIP_TIMEZONE).toBe('America/Los_Angeles')
    expect(DRIP_WEEKDAY_START_MINUTES).toBe(8 * 60)
    expect(typeof DRIP_SPACING_MINUTES).toBe('number')
    expect(DRIP_SPACING_MINUTES).toBeGreaterThan(0)
    // LOCKED (Matt 2026-09-03): every 5 minutes.
    expect(DRIP_SPACING_MINUTES).toBe(5)
  })

  it('blocks a second send inside the spacing window', () => {
    const fourMinutesLater = new Date(THU_8AM_PT.getTime() + 4 * 60_000)
    const decision = canSendDripNow({
      now: fourMinutesLater,
      lastDripSentAt: THU_8AM_PT,
      spacingMinutes: 5,
    })
    expect(decision).toEqual({ ok: false, reason: 'spacing' })
  })

  it('allows the next send once spacing has elapsed (one-at-a-time)', () => {
    // At T+0 send, next allowed at T+spacing (elapsed >= spacing minutes).
    const justBefore = canSendDripNow({
      now: new Date(THU_8AM_PT.getTime() + 5 * 60_000 - 1),
      lastDripSentAt: THU_8AM_PT,
      spacingMinutes: 5,
    })
    expect(justBefore).toEqual({ ok: false, reason: 'spacing' })
    const atSpacing = canSendDripNow({
      now: THU_8_05_PT, // exactly +5m
      lastDripSentAt: THU_8AM_PT,
      spacingMinutes: 5,
    })
    expect(atSpacing).toEqual({ ok: true })
  })

  it('allows the first send of the day when never sent before', () => {
    expect(canSendDripNow({ now: THU_NOON_PT, lastDripSentAt: null })).toEqual({ ok: true })
  })

  it('honors an override spacing without changing the constant', () => {
    const blocked = canSendDripNow({
      now: new Date(THU_8AM_PT.getTime() + 3 * 60_000),
      lastDripSentAt: THU_8AM_PT,
      spacingMinutes: 10,
    })
    expect(blocked).toEqual({ ok: false, reason: 'spacing' })
    const open = canSendDripNow({
      now: new Date(THU_8AM_PT.getTime() + 10 * 60_000),
      lastDripSentAt: THU_8AM_PT,
      spacingMinutes: 10,
    })
    expect(open).toEqual({ ok: true })
  })
})
