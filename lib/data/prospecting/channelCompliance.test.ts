/**
 * Per-channel compliance contract (Brain Dump 2, 2026-07-28).
 *
 * The regression this locks: `contact:do-not-call` sat on 54 of 75
 * expired-listing owners (BatchData DNC read). The old single-boolean model
 * turned that into "Compliance hold + Suppressed" on every row and removed the
 * send action entirely — for leads that were legally emailable the whole time.
 *
 * TCPA treats a text as a call, so do-not-call MUST block sms + call. It must
 * NOT block email. Both halves are asserted here; loosening either one is a
 * compliance regression, not a UI change.
 */

import { describe, expect, it } from 'vitest'
import { TAG_CHANNEL } from '@/lib/crm/suppressions'
import { blockAllChannels, openChannels, PROSPECT_CHANNELS, type ProspectChannel } from './types'

/** The same derivation batch.ts uses — asserted against the ONE mapping (M9). */
function tagsBlocking(channel: ProspectChannel): Set<string> {
  return new Set(
    TAG_CHANNEL.filter((m) => m.channels.includes('all') || m.channels.includes(channel)).map((m) =>
      m.tag.toLowerCase(),
    ),
  )
}

describe('per-channel tag derivation', () => {
  it('blocks sms and call for contact:do-not-call, and leaves email open', () => {
    expect(tagsBlocking('sms').has('contact:do-not-call')).toBe(true)
    expect(tagsBlocking('call').has('contact:do-not-call')).toBe(true)
    expect(tagsBlocking('email').has('contact:do-not-call')).toBe(false)
  })

  it('blocks every channel for compliance:hard-stop', () => {
    for (const c of PROSPECT_CHANNELS) {
      expect(tagsBlocking(c).has('compliance:hard-stop')).toBe(true)
    }
  })

  it('blocks only email for an email-scoped opt-out', () => {
    for (const tag of ['do_not_email', 'unsubscribed', 'bounced', 'complained']) {
      expect(tagsBlocking('email').has(tag)).toBe(true)
      expect(tagsBlocking('sms').has(tag)).toBe(false)
      expect(tagsBlocking('call').has(tag)).toBe(false)
    }
  })

  it('blocks only sms for contact:do-not-text', () => {
    expect(tagsBlocking('sms').has('contact:do-not-text')).toBe(true)
    expect(tagsBlocking('email').has('contact:do-not-text')).toBe(false)
    expect(tagsBlocking('call').has('contact:do-not-text')).toBe(false)
  })
})

describe('openChannels', () => {
  it('surfaces email as the first open channel for a do-not-call contact', () => {
    const compliance = {
      channels: {
        sms: { blocked: true, reason: 'On the do-not-call registry' },
        call: { blocked: true, reason: 'On the do-not-call registry' },
        email: { blocked: false, reason: null },
      },
    }
    expect(openChannels(compliance)).toEqual(['email'])
  })

  it('returns nothing when the fail-closed default is in play', () => {
    expect(openChannels({ channels: blockAllChannels('Compliance unresolved') })).toEqual([])
  })

  it('prefers email, then sms, then call when everything is open', () => {
    const allOpen = Object.fromEntries(
      PROSPECT_CHANNELS.map((c) => [c, { blocked: false, reason: null }]),
    ) as Record<ProspectChannel, { blocked: boolean; reason: string | null }>
    expect(openChannels({ channels: allOpen })).toEqual(['email', 'sms', 'call'])
  })
})

describe('blockAllChannels', () => {
  it('is total — every channel blocked and carrying the reason', () => {
    const blocks = blockAllChannels('Compliance check unavailable')
    for (const c of PROSPECT_CHANNELS) {
      expect(blocks[c].blocked).toBe(true)
      expect(blocks[c].reason).toBe('Compliance check unavailable')
    }
  })
})
