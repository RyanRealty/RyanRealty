import { describe, it, expect } from 'vitest'
import { sendEventCalls, topLevelSource, isHostDerivedSource } from '../check-crm-lead-integrity.mjs'

// FUNNEL-4 (2026-09-23): the gate must find the sendEvent object's OWN `source:`
// (not campaign.source) and tell a door label from the site host.
describe('check-crm-lead-integrity door-source parsing', () => {
  const src = `
    const res = await sendEvent({
      type: 'General Inquiry',
      person: { emails: [{ value: email }] },
      source: isJoinInquiry(inquiryType) ? 'join' : 'contact-form',
      campaign: originUtmSource ? { source: originUtmSource, medium: 'x' } : undefined,
    })
    await sendEvent({ type: 'Saved Property', source: base.replace(/^https?:\\/\\//, '').toLowerCase() || 'ryan-realty.com' })
  `

  it('extracts every call and its top-level source expression', () => {
    const calls = sendEventCalls(src)
    expect(calls).toHaveLength(2)
    expect(topLevelSource(calls[0])).toBe("isJoinInquiry(inquiryType) ? 'join' : 'contact-form'")
    expect(topLevelSource(calls[1])).toContain('base.replace(')
  })

  it('ignores a nested campaign.source', () => {
    const call = sendEventCalls(`sendEvent({ campaign: { source: 'fb' }, source: door })`)[0]
    expect(topLevelSource(call)).toBe('door')
  })

  it('flags a host-derived source and passes a door label', () => {
    expect(isHostDerivedSource("base.replace(/^https?:\\/\\//, '').toLowerCase() || 'ryan-realty.com'")).toBe(true)
    expect(isHostDerivedSource('source')).toBe(true)
    expect(isHostDerivedSource("resolveLeadSource(originUtmSource, siteUrl)")).toBe(true)
    expect(isHostDerivedSource("'idx-registration'")).toBe(false)
    expect(isHostDerivedSource('ALERTS_DOOR')).toBe(false)
    expect(isHostDerivedSource('resolveLeadSource(originUtmSource, lpSource)')).toBe(false)
    expect(isHostDerivedSource("isJoinInquiry(inquiryType) ? 'join' : 'contact-form'")).toBe(false)
  })
})
