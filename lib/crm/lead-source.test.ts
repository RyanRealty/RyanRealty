import { describe, expect, it } from 'vitest'
import { isOutreachListOnly, isPaidMedium, isSiteHostSource, resolveLeadSource, resolvePaidAttributionTags, reuseSourcePatch } from './lead-source'

/**
 * FUNNEL-4 (visibility audit 2026-09-22): crm_people.source is the first DOOR a
 * person came through. The reuse path keeps it; the bare site host is not a
 * door and is replaced by the first real one; and a listed owner who later uses
 * one of our forms is recognised by the form's source:<door> tag.
 */

describe('isSiteHostSource', () => {
  it('reads the host every site door used to write', () => {
    for (const s of ['ryan-realty.com', 'www.ryan-realty.com', 'RYAN-REALTY.COM', 'ryanrealty.vercel.app', 'localhost:3000']) {
      expect(isSiteHostSource(s), s).toBe(true)
    }
  })

  it('a door label, a channel or an empty value is not the host', () => {
    for (const s of ['contact-form', 'idx-registration', 'Website booking', 'expired-listing-cron', 'Google', '', null]) {
      expect(isSiteHostSource(s), String(s)).toBe(false)
    }
  })
})

describe('reuseSourcePatch', () => {
  it('lets the first real door replace the bare host', () => {
    expect(reuseSourcePatch('ryan-realty.com', 'contact-form')).toEqual({ source: 'contact-form' })
    expect(reuseSourcePatch('www.ryan-realty.com', 'seller-lp')).toEqual({ source: 'seller-lp' })
  })

  it('never replaces a real door with the host; the host lands as a tag', () => {
    expect(reuseSourcePatch('contact-form', 'ryan-realty.com')).toEqual({ tag: 'source:ryan-realty.com' })
    expect(reuseSourcePatch('ryan-realty.com', 'ryan-realty.com')).toEqual({})
  })

  it('keeps the first door once it is a door (63952: seller-lp then Website booking)', () => {
    expect(reuseSourcePatch('seller-lp', 'Website booking')).toEqual({ tag: 'source:Website booking' })
  })
})

describe('isOutreachListOnly', () => {
  it('a skip-traced or imported row with no form tag is outreach only', () => {
    expect(isOutreachListOnly('expired-listing-cron', ['intent:expired-listing'])).toBe(true)
    expect(isOutreachListOnly('fsbo-cron', [])).toBe(true)
    expect(isOutreachListOnly('Farm', null)).toBe(true)
  })

  it('the same owner who then filled in one of our forms is an inbound lead', () => {
    expect(isOutreachListOnly('expired-listing-cron', ['intent:expired-listing', 'source:seller-lp'])).toBe(false)
    expect(isOutreachListOnly('expired-listing-cron', ['Source:Expired-LP'])).toBe(false)
  })

  it('an inbound source is never outreach, tags or not', () => {
    expect(isOutreachListOnly('contact-form', [])).toBe(false)
    expect(isOutreachListOnly('expired-lp', [])).toBe(false)
    expect(isOutreachListOnly(null, [])).toBe(false)
  })
})

describe('resolveLeadSource', () => {
  it('names the paid channel when there is one, else the door', () => {
    expect(resolveLeadSource('fb', 'seller-lp')).toBe('Facebook')
    expect(resolveLeadSource(undefined, 'seller-lp')).toBe('seller-lp')
  })
})

describe('resolvePaidAttributionTags: -ads only for a click from an ad', () => {
  it('our own ad links (paid_social, cpc) and hand-built ones (paid, ppc, cpm) are ads', () => {
    expect(resolvePaidAttributionTags({ utmSource: 'facebook', utmMedium: 'paid_social', utmCampaign: 'listing-launch', utmContent: 't1-offer-card' }))
      .toEqual(['channel:fb-ads', 'campaign:listing-launch', 'ad-content:t1-offer-card'])
    expect(resolvePaidAttributionTags({ utmSource: 'google', utmMedium: 'cpc' })).toEqual(['channel:google-ads'])
    for (const m of ['paid', 'PPC', 'cpm', 'display', 'retargeting', 'paidsocial']) expect(isPaidMedium(m)).toBe(true)
  })

  it('an organic post keeps its post id but is named for its platform, not as an ad', () => {
    expect(resolvePaidAttributionTags({ utmSource: 'instagram', utmMedium: 'social', utmCampaign: 'social-post', utmContent: 'act_42' }))
      .toEqual(['channel:instagram', 'campaign:social-post', 'ad-content:act-42'])
    expect(resolvePaidAttributionTags({ utmSource: 'fb', utmMedium: 'social' })).toEqual(['channel:facebook'])
  })

  it('the Google Business Profile link, the newsletter and a CRM email are not ads (the 2026-10-09 gbp-ads mislabel)', () => {
    expect(resolvePaidAttributionTags({ utmSource: 'gbp', utmMedium: 'organic', utmCampaign: 'gbp-profile' })).toEqual(['channel:gbp', 'campaign:gbp-profile'])
    expect(resolvePaidAttributionTags({ utmSource: 'newsletter', utmMedium: 'email', utmCampaign: 'newsletter' })).toEqual(['channel:newsletter', 'campaign:newsletter'])
    expect(resolvePaidAttributionTags({ utmSource: 'crm', utmMedium: 'email', utmContent: 'agent-matt' })).toEqual(['channel:crm', 'ad-content:agent-matt'])
  })

  it('no medium is not an ad (GA4 reads it as organic); no source is no tags', () => {
    expect(isPaidMedium(undefined)).toBe(false)
    expect(isPaidMedium('')).toBe(false)
    expect(resolvePaidAttributionTags({ utmSource: 'facebook' })).toEqual(['channel:facebook'])
    expect(resolvePaidAttributionTags({ utmMedium: 'paid_social' })).toEqual([])
  })
})
