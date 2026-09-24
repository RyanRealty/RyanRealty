import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * sendProspectingIntro checks quiet hours at step 8, then upserts the lead,
 * composes, rewrites links and claims the send before the Twilio POST. A
 * 7:59pm pass could text a cold prospect after 8pm (ORS 646.563(1)(b)), so it
 * asks again beside the last-moment suppression re-check and releases the claim.
 */
const src = readFileSync(new URL('./prospecting.ts', import.meta.url), 'utf8')

describe('sendProspectingIntro quiet hours at the POST', () => {
  it('asks quiet hours again after the suppression re-check and before the send', () => {
    const recheckAt = src.indexOf('const supNow = await isSuppressed(lead.personId')
    const postAt = src.indexOf('const sent = await sendSmsViaMessagingService({ to, body })', recheckAt)
    expect(recheckAt).toBeGreaterThan(-1)
    expect(postAt).toBeGreaterThan(recheckAt)
    const beforePost = src.slice(recheckAt, postAt)
    expect(beforePost).toMatch(/if \(inSmsQuietHours\(\)\) \{\s*await releaseProspectSend\(kind, id\)/)
  })
})
