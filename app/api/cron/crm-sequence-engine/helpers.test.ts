import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'

/**
 * C1 from the 2026-09-20 deep audit: the sequence engine kept a 9pm quiet-hours
 * fork while Oregon (ORS 646.563 after HB 3865) is 8pm. This file is the
 * ratchet so the copy cannot return.
 */
const helpers = readFileSync(
  new URL('./helpers.ts', import.meta.url),
  'utf8',
)

describe('sequence-engine SMS quiet hours', () => {
  it('does not keep a 9pm fork — Oregon is 8pm', () => {
    expect(helpers).not.toMatch(/h\s*>=\s*21/)
    expect(helpers).not.toMatch(/9 PM/)
    expect(helpers).toContain("@/lib/crm/quiet-hours")
  })

  it('shares the canonical 8pm window (8pm PDT is quiet)', () => {
    expect(inSmsQuietHours(new Date('2026-06-25T03:00:00Z'))).toBe(true)
  })

  it('asks again at the Twilio POST and gives the claim back when 8pm has passed', () => {
    // The first check sits several awaits ahead of the send (the broker's line,
    // the step claim, the link rewrite), and the cron fires at :58, so a 7:59pm
    // pass could POST after 8pm. The late check takes the quiet-hours path:
    // release the claim, reschedule to the next window, no new state.
    const route = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
    const firstCheckAt = route.indexOf('if (inSmsQuietHours()) { await finish({ next_run_at: nextSendWindow().toISOString() }); continue }')
    const claimAt = route.indexOf("const smsClaim = await claimSend('sms')", firstCheckAt)
    const linksAt = route.indexOf('body = await instrumentSmsLinks(', claimAt)
    const postAt = route.indexOf('? await sendSms({ from: seqFrom, to: toPhone, body })', linksAt)
    const lateCheckAt = route.indexOf('if (inSmsQuietHours()) {', linksAt)
    expect(firstCheckAt).toBeGreaterThan(-1)
    expect(claimAt).toBeGreaterThan(firstCheckAt)
    expect(linksAt).toBeGreaterThan(claimAt)
    expect(postAt).toBeGreaterThan(linksAt)
    // Nothing awaited between the late check and the POST but its own branch.
    expect(lateCheckAt).toBeGreaterThan(linksAt)
    const lateEnd = route.indexOf('continue', lateCheckAt) + 'continue'.length
    expect(lateEnd).toBeLessThan(postAt)
    const lateBranch = route.slice(lateCheckAt, lateEnd)
    expect(lateBranch).toContain('await releaseSend()')
    expect(lateBranch).toContain('await finish({ next_run_at: nextSendWindow().toISOString() })')
    expect(lateBranch).not.toContain('status:')
    expect(route.slice(lateEnd, postAt)).not.toContain('await ')
  })
})
