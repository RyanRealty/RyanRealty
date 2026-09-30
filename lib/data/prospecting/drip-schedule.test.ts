/**
 * Schedule lock for the prospecting first-touch drip:
 * weekday 08:00 PT open, HARDCODE 5m spacing, one-at-a-time (spacing gate).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DRIP_BUSY_WINDOW_MS,
  DRIP_ROUTE_MAX_DURATION_S,
  DRIP_SPACING_MINUTES,
  DRIP_STUCK_SEND_STALE_MS,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
  canSendDripNow,
  dripBusyCutoff,
  dripStaleCutoff,
  firstTouchClaimAgeMs,
  isDripWeekday,
  isDripWindowOpen,
  isFirstTouchClaimInFlight,
  isFirstTouchClaimStale,
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

describe('drip-schedule — claim windows (busy guard + stuck-send recovery)', () => {
  // The 2026-09-29 incident claim: 22:55:27.279426Z (Postgres keeps microseconds).
  const CLAIM = '2026-09-29T22:55:27.279426+00:00'
  const claimMs = Date.parse(CLAIM)
  const at = (offsetMs: number) => new Date(claimMs + offsetMs)

  it('derives both windows from the route limit, with the documented margins', () => {
    expect(DRIP_ROUTE_MAX_DURATION_S).toBe(300)
    // maxDuration + one cron tick.
    expect(DRIP_BUSY_WINDOW_MS).toBe((300 + 60) * 1000)
    // maxDuration + five minutes (the floor the recovery must respect).
    expect(DRIP_STUCK_SEND_STALE_MS).toBe((300 + 5 * 60) * 1000)
    expect(DRIP_STUCK_SEND_STALE_MS).toBeGreaterThanOrEqual(DRIP_ROUTE_MAX_DURATION_S * 1000 + 5 * 60_000)
    // A claim can never be both in flight and stale.
    expect(DRIP_STUCK_SEND_STALE_MS).toBeGreaterThan(DRIP_BUSY_WINDOW_MS)
  })

  it('treats a claim as in flight strictly inside the busy window', () => {
    expect(isFirstTouchClaimInFlight(CLAIM, at(0))).toBe(true)
    expect(isFirstTouchClaimInFlight(CLAIM, at(DRIP_BUSY_WINDOW_MS - 1))).toBe(true)
    expect(isFirstTouchClaimInFlight(CLAIM, at(DRIP_BUSY_WINDOW_MS))).toBe(false)
    expect(isFirstTouchClaimInFlight(CLAIM, at(DRIP_BUSY_WINDOW_MS + 1))).toBe(false)
  })

  it('treats a claim as stale only once it is strictly older than the threshold', () => {
    // A claimer that ran to its full limit is not stale yet.
    expect(isFirstTouchClaimStale(CLAIM, at(DRIP_ROUTE_MAX_DURATION_S * 1000))).toBe(false)
    expect(isFirstTouchClaimStale(CLAIM, at(DRIP_STUCK_SEND_STALE_MS - 1))).toBe(false)
    expect(isFirstTouchClaimStale(CLAIM, at(DRIP_STUCK_SEND_STALE_MS))).toBe(false)
    expect(isFirstTouchClaimStale(CLAIM, at(DRIP_STUCK_SEND_STALE_MS + 1))).toBe(true)
  })

  it('reads the microsecond stamp Postgres returns; a missing or bad stamp is neither', () => {
    expect(firstTouchClaimAgeMs(CLAIM, at(1234))).toBe(1234)
    for (const bad of [null, undefined, '', 'not a time']) {
      expect(firstTouchClaimAgeMs(bad, at(0))).toBeNull()
      expect(isFirstTouchClaimInFlight(bad, at(0))).toBe(false)
      expect(isFirstTouchClaimStale(bad, at(DRIP_STUCK_SEND_STALE_MS * 10))).toBe(false)
    }
  })

  it('gives the DAL cutoffs that match the predicates', () => {
    const now = new Date('2026-09-30T15:00:00.000Z')
    expect(dripBusyCutoff(now).toISOString()).toBe('2026-09-30T14:54:00.000Z')
    expect(dripStaleCutoff(now).toISOString()).toBe('2026-09-30T14:50:00.000Z')
  })

  it('keeps the email claim RPC holding a claim past the stuck-send threshold', () => {
    // The newest migration that defines prospect_email_send_claim decides how
    // long a 'sending' claim refuses a second claimer. It must outlive every
    // claimer (maxDuration) and the recovery's threshold plus a few drain ticks,
    // or a manual Send can take a claim from a live drip send, or beat the
    // recovery to a claim whose email already left.
    const dir = join(process.cwd(), 'supabase/migrations')
    const defining = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => /create or replace function public\.prospect_email_send_claim\(/i.test(readFileSync(join(dir, f), 'utf8')))
    const newest = defining[defining.length - 1]
    expect(newest).toBeDefined()
    const sql = readFileSync(join(dir, newest!), 'utf8')
    const m = /v_status = 'sending' and v_claim_at is not null and v_claim_at > now\(\) - interval '(\d+) minutes'/.exec(sql)
    expect(m, `${newest} states the claim window in minutes`).not.toBeNull()
    const holdMs = Number(m![1]) * 60_000
    expect(holdMs).toBeGreaterThan(DRIP_ROUTE_MAX_DURATION_S * 1000)
    expect(holdMs).toBeGreaterThanOrEqual(DRIP_STUCK_SEND_STALE_MS + 3 * 60_000)
  })
})
