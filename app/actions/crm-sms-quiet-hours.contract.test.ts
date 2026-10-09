import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The CRM composer checks Pacific quiet hours once, at the top of
 * sendCrmSmsAction. The contacts' 1:1 and group sends ask again inside
 * lib/comms; the raw group-reply numbers (no contact record) are sent straight
 * from the action and come LAST, after the group attempt and every 1:1 send.
 * A 7:59pm click could text them after 8pm, and each number's own zone
 * (Matt 2026-10-04, "Both zones") is only known here. Each raw send also hands
 * Twilio the earliest 8pm close as its ValidityPeriod bound.
 */
const src = readFileSync(new URL('./crm.ts', import.meta.url), 'utf8')

describe('sendCrmSmsAction raw group-reply numbers', () => {
  it('asks quiet hours again before each raw send unless the broker overrode', () => {
    const loopAt = src.indexOf('for (const e164 of rawPhones) {')
    const postAt = src.indexOf('? await sendSms({ from: rawFrom, to: e164, body, mediaUrls, validUntil })', loopAt)
    expect(loopAt).toBeGreaterThan(-1)
    expect(postAt).toBeGreaterThan(loopAt)
    const beforePost = src.slice(loopAt, postAt)
    expect(beforePost).toContain('const quiet = override ? null : quietHoursRefusal(e164)')
    expect(beforePost).toMatch(/if \(quiet\) \{ lastError = quiet; failedCount\+\+; continue \}/)
    expect(beforePost).toContain('const validUntil = override ? undefined : smsWindowCloseAtFor(e164)')
    expect(src).toContain(': await sendSmsViaMessagingService({ to: e164, body, mediaUrls, validUntil })')
  })
})
