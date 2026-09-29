import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { gmailMessageKey, gmailTimelineDedupeKey } from './gmail-timeline-key'

const RFC = '<cma.62017@ryan-realty.com>'
const HEX = createHash('sha1').update(RFC).digest('hex').slice(0, 24)

describe('gmailTimelineDedupeKey', () => {
  it('hashes the trimmed Message-ID the way the mailbox sync always has', () => {
    expect(gmailTimelineDedupeKey(RFC, 64138)).toBe(`gmail:rfc:${HEX}:p64138`)
    expect(gmailMessageKey(RFC, '18abc')).toBe(`rfc:${HEX}`)
  })

  it('lets the RFC id beat a Gmail id, and does not prefix a bare Gmail id twice', () => {
    expect(gmailTimelineDedupeKey({ rfcMessageId: RFC, gmailId: '18abc' }, 64138)).toBe(`gmail:rfc:${HEX}:p64138`)
    expect(gmailTimelineDedupeKey({ gmailId: '18abc' }, 64138)).toBe('gmail:18abc:p64138')
    expect(gmailTimelineDedupeKey('18abc', 64138)).toBe('gmail:18abc:p64138')
    expect(gmailMessageKey(null, '18abc')).toBe('18abc')
  })

  it('does not lowercase the Message-ID before hashing', () => {
    const mixed = '<CMA.62017@Ryan-Realty.com>'
    const mixedHex = createHash('sha1').update(mixed).digest('hex').slice(0, 24)
    expect(gmailTimelineDedupeKey(mixed, 64138)).toBe(`gmail:rfc:${mixedHex}:p64138`)
    expect(mixedHex).not.toBe(HEX)
  })

  it('returns null without an id or a person', () => {
    expect(gmailTimelineDedupeKey(null, 64138)).toBeNull()
    expect(gmailTimelineDedupeKey({ rfcMessageId: '  ', gmailId: '' }, 64138)).toBeNull()
    expect(gmailTimelineDedupeKey(RFC, 0)).toBeNull()
  })
})
