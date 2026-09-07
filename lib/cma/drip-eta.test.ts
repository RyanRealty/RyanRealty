/**
 * Drip ETA: FIFO position + weekday 08:00 PT window + 5m spacing.
 */
import { describe, expect, it } from 'vitest'
import {
  advanceIntoDripWindow,
  dripEtaFor,
  earliestDripSendAt,
  nextDripSendAfter,
} from './drip-eta'
import { DRIP_SPACING_MINUTES } from '@/lib/data/prospecting/drip-schedule'

// 2026-09-03 Thursday. 15:00 UTC = 08:00 PDT.
const THU_8AM_PT = new Date('2026-09-03T15:00:00.000Z')
const THU_7_59_PT = new Date('2026-09-03T14:59:00.000Z')
const THU_8_05_PT = new Date('2026-09-03T15:05:00.000Z')
const THU_NOON_PT = new Date('2026-09-03T19:00:00.000Z')
const FRI_5PM_PT = new Date('2026-09-04T00:00:00.000Z') // Fri 5pm? Wait: Sep 4 00:00 UTC = Thu 5pm PDT
// Fix: Friday Sep 4 2026 17:00 PDT = Sep 5 00:00 UTC
const FRI_5PM = new Date('2026-09-05T00:00:00.000Z')
const SAT_10AM_PT = new Date('2026-09-05T17:00:00.000Z')
const SUN_10AM_PT = new Date('2026-09-06T17:00:00.000Z')

const queue2 = [
  { kind: 'expired' as const, id: 'A' },
  { kind: 'fsbo' as const, id: 'B' },
]

describe('advanceIntoDripWindow', () => {
  it('leaves a weekday-after-8am instant alone', () => {
    expect(advanceIntoDripWindow(THU_8AM_PT).getTime()).toBe(THU_8AM_PT.getTime())
    expect(advanceIntoDripWindow(THU_NOON_PT).getTime()).toBe(THU_NOON_PT.getTime())
  })

  it('jumps before-window to the same weekday 08:00 PT', () => {
    const eta = advanceIntoDripWindow(THU_7_59_PT)
    expect(eta.getTime()).toBe(THU_8AM_PT.getTime())
  })

  it('jumps Saturday/Sunday to next Monday 08:00 PT', () => {
    // 2026-09-07 is Monday. 15:00 UTC = 08:00 PDT.
    const MON_8AM = new Date('2026-09-07T15:00:00.000Z')
    expect(advanceIntoDripWindow(SAT_10AM_PT).getTime()).toBe(MON_8AM.getTime())
    expect(advanceIntoDripWindow(SUN_10AM_PT).getTime()).toBe(MON_8AM.getTime())
  })
})

describe('earliestDripSendAt / nextDripSendAfter', () => {
  it('uses now when never sent and window is open', () => {
    expect(earliestDripSendAt({ now: THU_NOON_PT, lastDripSentAt: null }).getTime()).toBe(
      THU_NOON_PT.getTime(),
    )
  })

  it('honors spacing from last send', () => {
    expect(
      earliestDripSendAt({ now: THU_8_05_PT, lastDripSentAt: THU_8AM_PT }).getTime(),
    ).toBe(THU_8_05_PT.getTime())
    // Inside spacing: still waits until last+5m even if now is earlier... wait,
    // earliest clamps up to now, so if now is between last and last+5, result is last+5.
    const thu_8_02 = new Date('2026-09-03T15:02:00.000Z')
    expect(
      earliestDripSendAt({ now: thu_8_02, lastDripSentAt: THU_8AM_PT }).getTime(),
    ).toBe(THU_8_05_PT.getTime())
  })

  it('next slot after a Friday evening send lands Monday 08:00 when weekend intervenes', () => {
    // Fri 5pm + 5m = Fri 5:05pm — still weekday window, so stays Friday.
    const fri505 = nextDripSendAfter(FRI_5PM)
    expect(fri505.getTime()).toBe(FRI_5PM.getTime() + DRIP_SPACING_MINUTES * 60_000)

    // Sat morning last send → Monday 8am
    const mon8 = new Date('2026-09-07T15:00:00.000Z')
    expect(nextDripSendAfter(SAT_10AM_PT).getTime()).toBe(mon8.getTime())
  })
})

describe('dripEtaFor', () => {
  it('returns null when target is not in the queue', () => {
    expect(
      dripEtaFor({
        queued: queue2,
        lastDripSentAt: null,
        now: THU_NOON_PT,
        target: { kind: 'expired', id: 'Z' },
      }),
    ).toBeNull()
  })

  it('labels head-of-queue as #1 of N at earliest send', () => {
    const eta = dripEtaFor({
      queued: queue2,
      lastDripSentAt: null,
      now: THU_NOON_PT,
      target: { kind: 'expired', id: 'A' },
    })
    expect(eta).not.toBeNull()
    expect(eta!.position).toBe(1)
    expect(eta!.queueDepth).toBe(2)
    expect(eta!.etaAt.getTime()).toBe(THU_NOON_PT.getTime())
    expect(eta!.label).toBe('#1 of 2 · next ~Thu 12:00pm PT')
    expect(eta!.cadence).toMatch(/Weekday drip/)
  })

  it('spaces the second slot five minutes after the first', () => {
    const eta = dripEtaFor({
      queued: queue2,
      lastDripSentAt: null,
      now: THU_8AM_PT,
      target: { kind: 'fsbo', id: 'B' },
    })
    expect(eta).not.toBeNull()
    expect(eta!.position).toBe(2)
    expect(eta!.queueDepth).toBe(2)
    expect(eta!.etaAt.getTime()).toBe(THU_8_05_PT.getTime())
    expect(eta!.label).toBe('#2 of 2 · next ~Thu 8:05am PT')
  })

  it('advances ETA across a weekend when the runway spills past Friday', () => {
    // Last send Friday late; three queued → positions land Mon morning.
    // Fri Sep 4 2026 11:50pm PDT = Sat Sep 5 06:50 UTC
    const friAlmostMidnight = new Date('2026-09-05T06:50:00.000Z')
    const queued = [
      { kind: 'expired' as const, id: '1' },
      { kind: 'expired' as const, id: '2' },
      { kind: 'fsbo' as const, id: '3' },
    ]
    // now = Saturday — window closed; earliest = Mon 8am
    const mon8 = new Date('2026-09-07T15:00:00.000Z')
    const mon805 = new Date('2026-09-07T15:05:00.000Z')
    const mon810 = new Date('2026-09-07T15:10:00.000Z')

    const a = dripEtaFor({
      queued,
      lastDripSentAt: friAlmostMidnight,
      now: SAT_10AM_PT,
      target: { kind: 'expired', id: '1' },
    })
    const b = dripEtaFor({
      queued,
      lastDripSentAt: friAlmostMidnight,
      now: SAT_10AM_PT,
      target: { kind: 'expired', id: '2' },
    })
    const c = dripEtaFor({
      queued,
      lastDripSentAt: friAlmostMidnight,
      now: SAT_10AM_PT,
      target: { kind: 'fsbo', id: '3' },
    })
    expect(a!.etaAt.getTime()).toBe(mon8.getTime())
    expect(b!.etaAt.getTime()).toBe(mon805.getTime())
    expect(c!.etaAt.getTime()).toBe(mon810.getTime())
    expect(c!.label).toBe('#3 of 3 · next ~Mon 8:10am PT')
  })

  it('uses lastDripSentAt spacing when still inside the weekday window', () => {
    // Last drip at Thu 8:00; now Thu 8:02 → head waits until 8:05
    const eta = dripEtaFor({
      queued: [{ kind: 'expired', id: 'A' }],
      lastDripSentAt: THU_8AM_PT,
      now: new Date('2026-09-03T15:02:00.000Z'),
      target: { kind: 'expired', id: 'A' },
    })
    expect(eta!.etaAt.getTime()).toBe(THU_8_05_PT.getTime())
    expect(eta!.label).toMatch(/^#1 of 1 · next ~Thu 8:05am PT$/)
  })
})
