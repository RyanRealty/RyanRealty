// W5.3/W6.4 — the suggested-reply deep-link PRODUCER↔CONSUMER contract. The
// inbound-SMS alert email builds a conversation link via buildSuggestedReplyLink;
// the composer reads it via parseSuggestedReply. This round-trips the two so a
// drift in either (param name, channel default, ordering, the #comms fragment)
// fails CI — the producer emits exactly what the consumer parses.
import { describe, it, expect } from 'vitest'
import { buildSuggestedReplyLink, parseSuggestedReply } from './composer-preload'

const BASE = 'https://ryan-realty.com/admin/crm/123'

function search(url: string): string {
  return new URL(url).search
}

describe('suggested-reply deep link — producer↔consumer round-trip', () => {
  it('SMS reply round-trips: build → parse yields the same body + sms channel', () => {
    const link = buildSuggestedReplyLink(BASE, { channel: 'sms', body: 'Thanks for reaching out, happy to help.' })
    expect(link).toContain('?reply=')
    expect(link.endsWith('#comms')).toBe(true)
    // query is BEFORE the fragment (parser reads location.search, not the hash)
    expect(link.indexOf('?')).toBeLessThan(link.indexOf('#'))
    const parsed = parseSuggestedReply(search(link))
    expect(parsed).toEqual({ channel: 'sms', body: 'Thanks for reaching out, happy to help.', subject: null })
  })

  it('email reply round-trips with channel + subject', () => {
    const link = buildSuggestedReplyLink(BASE, { channel: 'email', body: 'See attached.', subject: 'Re: your question' })
    const parsed = parseSuggestedReply(search(link))
    expect(parsed).toEqual({ channel: 'email', body: 'See attached.', subject: 'Re: your question' })
  })

  it('no reply → a plain #comms link with no reply params (byte-identical to the pre-wiring link)', () => {
    expect(buildSuggestedReplyLink(BASE, null)).toBe(`${BASE}#comms`)
    expect(buildSuggestedReplyLink(BASE, { channel: 'sms', body: '   ' })).toBe(`${BASE}#comms`)
    expect(parseSuggestedReply(search(buildSuggestedReplyLink(BASE, null) + '?'))).toBeNull()
  })

  it('encodes reply bodies with URL-hostile characters, and they survive the round-trip', () => {
    const body = 'Hi! Are you free 3–4pm? reply "yes" & we\'ll book it. #showing'
    const parsed = parseSuggestedReply(search(buildSuggestedReplyLink(BASE, { channel: 'sms', body })))
    expect(parsed?.body).toBe(body)
  })
})
