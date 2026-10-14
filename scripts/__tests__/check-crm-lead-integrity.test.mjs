import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { sendEventCalls, topLevelSource, isHostDerivedSource, sourceDerivesHost, HOST_SOURCE_ALLOWED } from '../check-crm-lead-integrity.mjs'

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

  it('reads a shorthand source as the unverifiable `source`', () => {
    expect(topLevelSource(sendEventCalls(`sendEvent({ type: 'Visited Website', source, sourceUrl: url })`)[0])).toBe('source')
    expect(topLevelSource(sendEventCalls(`sendEvent({ type: 'x', sourceUrl: url, source })`)[0])).toBe('source')
    expect(topLevelSource(sendEventCalls(`sendEvent({ type: 'x', sourceUrl: url })`)[0])).toBe(null)
  })

  it('resolves a source passed by name to what the file assigns it', () => {
    expect(sourceDerivesHost('source', 'const source = siteHost()')).toBe(true)
    expect(sourceDerivesHost('source', "const source = siteUrl.replace(/^https?:\\/\\//, '')")).toBe(true)
    expect(sourceDerivesHost('source', 'const source = lead.campaignName')).toBe(false)
    expect(sourceDerivesHost('source', 'function f(source: string) {}')).toBe(true)
    expect(sourceDerivesHost("'cma-request'", '')).toBe(false)
  })

  it('ignores a nested campaign.source', () => {
    const call = sendEventCalls(`sendEvent({ campaign: { source: 'fb' }, source: door })`)[0]
    expect(topLevelSource(call)).toBe('door')
  })

  it('flags a host-derived source and passes a door label', () => {
    expect(isHostDerivedSource("base.replace(/^https?:\\/\\//, '').toLowerCase() || 'ryan-realty.com'")).toBe(true)
    expect(isHostDerivedSource('source')).toBe(true)
    expect(isHostDerivedSource("resolveLeadSource(originUtmSource, siteUrl)")).toBe(true)
    expect(isHostDerivedSource('siteHost()')).toBe(true)
    expect(isHostDerivedSource('websiteSource()')).toBe(true)
    expect(isHostDerivedSource("new URL(siteOrigin()).host")).toBe(true)
    expect(isHostDerivedSource("'idx-registration'")).toBe(false)
    expect(isHostDerivedSource('ALERTS_DOOR')).toBe(false)
    expect(isHostDerivedSource('resolveLeadSource(originUtmSource, lpSource)')).toBe(false)
    expect(isHostDerivedSource("isJoinInquiry(inquiryType) ? 'join' : 'contact-form'")).toBe(false)
  })
})

// FUNNEL-4 leftovers (2026-10-14): the check named four door files, and nine
// more doors still wrote the host. It now reads every sendEvent in app/ and lib/.
describe('every sendEvent in the tree writes a door label', () => {
  function tsFiles(dir) {
    const out = []
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) out.push(...tsFiles(p))
      else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(p)
    }
    return out
  }
  const sources = new Map()
  const texts = new Map()
  for (const rel of [...tsFiles('app'), ...tsFiles('lib')]) {
    const src = readFileSync(rel, 'utf8')
    if (!src.includes('sendEvent(')) continue
    texts.set(rel, src)
    sources.set(rel, sendEventCalls(src).map(topLevelSource).filter((e) => e !== null))
  }

  it('no caller outside HOST_SOURCE_ALLOWED derives the host', () => {
    const offenders = [...sources].flatMap(([rel, exprs]) =>
      HOST_SOURCE_ALLOWED[rel] ? [] : exprs.filter((e) => sourceDerivesHost(e, texts.get(rel))).map((e) => `${rel}: ${e}`),
    )
    expect(offenders).toEqual([])
  })

  it('the doors that wrote the host until 2026-10-14 write their own label', () => {
    expect(sources.get('app/actions/cma-download.ts')).toEqual(["'published-cma'", "'listing-pricing-read'"])
    expect(sources.get('app/actions/saved-searches.ts')).toEqual(["'idx-registration'"])
    expect(sources.get('app/actions/listing-payment-email.ts')).toEqual(["'listing-payment-email'"])
    expect(sources.get('app/api/pdf/cma/route.ts')).toEqual(["'cma-request'"])
    expect(sources.get('app/actions/lead-landing.ts')).toEqual(['leadDoor'])
    expect(sources.get('app/actions/lead-capture.ts')).toEqual([
      'pageCtaDoor',
      "'rental-calculator'",
      "isSeller ? 'seller-lp' : 'buyer-lp'",
    ])
  })

  it('every allowed host writer still exists and still needs the allowance', () => {
    for (const rel of Object.keys(HOST_SOURCE_ALLOWED)) {
      expect(sources.get(rel)?.some((e) => sourceDerivesHost(e, texts.get(rel)))).toBe(true)
    }
  })
})
