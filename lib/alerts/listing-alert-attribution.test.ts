import { describe, expect, it } from 'vitest'
import {
  appendListingAlertAttribution,
  listingAlertAttributionFromContext,
  listingAlertCampaign,
  mergeLeadAttribution,
  mergeListingAlertAttribution,
} from './listing-alert-attribution'

describe('listing-alert attribution', () => {
  it('maps client lpContext onto LeadAttributionParams', () => {
    expect(
      listingAlertAttributionFromContext({
        lp_variant: 'buy-alerts',
        lp_source: 'facebook',
        lp_medium: 'paid_social',
        lp_campaign: 'buyer-price-drops',
        lp_content: 'reloc-h3-v1',
        gclid: 'G1',
        fbclid: 'F1',
      }),
    ).toEqual({
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      lp_campaign: 'buyer-price-drops',
      lp_content: 'reloc-h3-v1',
      gclid: 'G1',
      fbclid: 'F1',
    })
  })

  it('lets the client win and fills missing keys from the referer', () => {
    const merged = mergeListingAlertAttribution(
      { lp_source: 'facebook', gclid: 'G1' },
      'https://ryan-realty.com/buy/alerts?utm_source=google&utm_medium=cpc&utm_campaign=spring&fbclid=F1',
    )
    expect(merged).toEqual({
      lp_source: 'facebook',
      lp_medium: 'cpc',
      lp_campaign: 'spring',
      gclid: 'G1',
      fbclid: 'F1',
    })
  })

  it('mergeLeadAttribution prefers the primary object', () => {
    expect(
      mergeLeadAttribution({ lp_source: 'facebook' }, { lp_source: 'google', lp_medium: 'cpc' }),
    ).toEqual({ lp_source: 'facebook', lp_medium: 'cpc' })
  })

  it('appends allowlisted query keys onto a source URL', () => {
    const url = appendListingAlertAttribution('https://ryan-realty.com/homes-for-sale/bend', {
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      lp_campaign: 'buyer-price-drops',
      lp_content: 't1',
      gclid: 'G1',
      fbclid: 'F1',
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('utm_source')).toBe('facebook')
    expect(parsed.searchParams.get('utm_medium')).toBe('paid_social')
    expect(parsed.searchParams.get('utm_campaign')).toBe('buyer-price-drops')
    expect(parsed.searchParams.get('utm_content')).toBe('t1')
    expect(parsed.searchParams.get('gclid')).toBe('G1')
    expect(parsed.searchParams.get('fbclid')).toBe('F1')
  })

  it('omits an empty campaign object', () => {
    expect(listingAlertCampaign({})).toBeUndefined()
    expect(listingAlertCampaign({ lp_source: 'facebook' })).toEqual({ source: 'facebook' })
  })
})
