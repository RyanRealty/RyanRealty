import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTrackedUrl,
  CMA_DOC_PARAM,
  isCmaDocumentSlug,
  isUtmCampaign,
  isUtmMedium,
  isUtmSource,
  marketReportCampaign,
  platformUtmSource,
  prospectCampaign,
  utmValueLooksLikeAddress,
  utmValueLooksLikePersonName,
  validateUtm,
} from './utm'

const BASE = 'https://ryan-realty.com/homes-for-sale/bend'

describe('validateUtm — lowercase and vocab', () => {
  it('lowercases and accepts the closed source / medium / campaign lists', () => {
    const r = validateUtm({ source: 'CRM', medium: 'Email', campaign: 'CMA-Letter' })
    expect(r).toEqual({
      ok: true,
      value: { source: 'crm', medium: 'email', campaign: 'cma-letter' },
    })
  })

  it('accepts referral-<domain> sources', () => {
    expect(validateUtm({ source: 'referral-tiktok.com', medium: 'social', campaign: 'social-post' }).ok).toBe(true)
    expect(isUtmSource('referral-linkedin.com')).toBe(true)
    expect(isUtmSource('referral-')).toBe(false)
    expect(isUtmSource('tiktok')).toBe(false)
  })

  it('accepts market-report-YYYY-MM and rejects a bare or malformed month', () => {
    expect(isUtmCampaign('market-report-2026-10')).toBe(true)
    expect(validateUtm({ source: 'crm', medium: 'email', campaign: 'market-report-2026-10' }).ok).toBe(true)
    expect(isUtmCampaign('market-report')).toBe(false)
    expect(isUtmCampaign('market-report-2026-13')).toBe(false)
    expect(marketReportCampaign('2026-10-01')).toBe('market-report-2026-10')
  })

  it('remaps the legacy bare market-report campaign to the current month', () => {
    const r = validateUtm({ source: 'crm', medium: 'email', campaign: 'market-report' }, new Date('2026-10-08T12:00:00Z'))
    expect(r.ok && r.value.campaign).toBe('market-report-2026-10')
  })

  it('accepts listing-<key> content and agent-<slug> content', () => {
    const listing = validateUtm({
      source: 'cma',
      medium: 'document',
      campaign: 'cma-letter',
      content: 'listing-20260714190234066850000000',
    })
    expect(listing.ok && listing.value.content).toBe('listing-20260714190234066850000000')
    const agent = validateUtm({ source: 'crm', medium: 'email', campaign: 'listing-alerts', content: 'agent-matt-ryan' })
    expect(agent.ok && agent.value.content).toBe('agent-matt-ryan')
  })

  it('rejects off-vocabulary source and medium', () => {
    expect(validateUtm({ source: 'email-click', medium: 'email', campaign: 'cma-letter' }).ok).toBe(true) // alias → crm
    expect(validateUtm({ source: 'meta', medium: 'email', campaign: 'cma-letter' }).ok).toBe(false)
    expect(validateUtm({ source: 'crm', medium: 'doc', campaign: 'cma-letter' }).ok).toBe(true) // alias → document
    expect(validateUtm({ source: 'crm', medium: 'broadcast', campaign: 'cma-letter' }).ok).toBe(false)
    expect(isUtmMedium('document')).toBe(true)
    expect(isUtmMedium('doc')).toBe(false)
  })

  it('maps email-click to crm and ryan-realty to crm', () => {
    const click = validateUtm({ source: 'email-click', medium: 'email', campaign: 'listing-alerts' })
    expect(click.ok && click.value.source).toBe('crm')
    const alerts = validateUtm({ source: 'ryan-realty', medium: 'email', campaign: 'listing-alerts' })
    expect(alerts.ok && alerts.value.source).toBe('crm')
  })
})

describe('address and name rejection', () => {
  it('rejects per-property CMA slugs and street-like tokens in any UTM field', () => {
    expect(utmValueLooksLikeAddress('cma-2465-ne-7th-redmond-97756--v2')).toBe(true)
    expect(utmValueLooksLikeAddress('61234-sunny-ln')).toBe(true)
    expect(utmValueLooksLikeAddress('cma-letter')).toBe(false)
    expect(utmValueLooksLikeAddress('listing-220225388')).toBe(false)

    expect(validateUtm({ source: 'cma', medium: 'email', campaign: '61234-sunny-ln' }).ok).toBe(false)
    expect(validateUtm({ source: 'cma', medium: 'email', campaign: 'cma-letter', content: 'cma-2465-ne-7th-redmond-97756--v2' }).ok).toBe(
      false,
    )
  })

  it('remaps a legacy per-property campaign slug to cma-letter so the address never ships as a UTM', () => {
    const r = validateUtm({
      source: 'cma',
      medium: 'document',
      campaign: 'cma-2465-ne-7th-redmond-97756--v2',
    })
    expect(r.ok && r.value.campaign).toBe('cma-letter')
  })

  it('rejects obvious first-last name pairs and allows program two-token slugs', () => {
    expect(utmValueLooksLikePersonName('john-smith')).toBe(true)
    expect(utmValueLooksLikePersonName('jane-doe')).toBe(true)
    expect(utmValueLooksLikePersonName('cma-letter')).toBe(false)
    expect(utmValueLooksLikePersonName('cta-top')).toBe(false)
    expect(validateUtm({ source: 'crm', medium: 'email', campaign: 'john-smith' }).ok).toBe(false)
    expect(validateUtm({ source: 'cma', medium: 'email', campaign: 'cma-letter', content: 'cta-top' }).ok).toBe(true)
  })
})

describe('buildTrackedUrl', () => {
  it('writes one lowercase UTM set', () => {
    const out = buildTrackedUrl(BASE, { source: 'CMA', medium: 'Document', campaign: 'CMA-Letter', content: 'V2' })
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('cma')
    expect(u.searchParams.get('utm_medium')).toBe('document')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-letter')
    expect(u.searchParams.get('utm_content')).toBe('v2')
    expect(u.searchParams.getAll('utm_source')).toEqual(['cma'])
  })

  it('replaces an existing set (email-click + stale campaign) and keeps non-UTM params and hash', () => {
    const input = 'https://ryan-realty.com/sell?utm_source=email-click&utm_campaign=x&foo=1&bar=keep#section'
    const out = buildTrackedUrl(input, { source: 'crm', medium: 'email', campaign: 'cma-letter' })
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('crm')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-letter')
    expect(u.searchParams.get('foo')).toBe('1')
    expect(u.searchParams.get('bar')).toBe('keep')
    expect(u.hash).toBe('#section')
    expect(out).not.toContain('email-click')
    expect(u.searchParams.getAll('utm_source')).toEqual(['crm'])
    expect(u.searchParams.getAll('utm_campaign')).toEqual(['cma-letter'])
  })

  it('preserves path, existing non-UTM params, and HTML &amp; separators', () => {
    const input = 'https://ryan-realty.com/reviews?agent=matt&amp;view=list#top'
    const out = buildTrackedUrl(input, { source: 'cma', medium: 'email', campaign: 'cma-letter' })
    expect(out).toContain('&amp;')
    expect(out).toContain('#top')
    expect(out).toContain('/reviews')
    const u = new URL(out.replace(/&amp;/g, '&'))
    expect(u.searchParams.get('agent')).toBe('matt')
    expect(u.searchParams.get('view')).toBe('list')
    expect(u.searchParams.get('utm_source')).toBe('cma')
  })

  it('rewrites campaign to test-* when test: true', () => {
    const out = buildTrackedUrl(BASE, { source: 'crm', medium: 'sms', campaign: 'expired-outreach', test: true })
    expect(new URL(out).searchParams.get('utm_campaign')).toBe('test-expired-outreach')
    expect(isUtmCampaign('test-expired-outreach')).toBe(true)
  })

  it('does not double-prefix test- on an already-test campaign', () => {
    const out = buildTrackedUrl(BASE, { source: 'crm', medium: 'email', campaign: 'test-newsletter', test: true })
    expect(new URL(out).searchParams.get('utm_campaign')).toBe('test-newsletter')
  })

  it('allows utm_term only for paid mediums', () => {
    const paid = buildTrackedUrl(BASE, {
      source: 'facebook',
      medium: 'paid_social',
      campaign: 'listing-launch',
      term: 'bend-sellers',
    })
    expect(new URL(paid).searchParams.get('utm_term')).toBe('bend-sellers')
    expect(() =>
      buildTrackedUrl(BASE, { source: 'crm', medium: 'email', campaign: 'listing-alerts', term: 'bend-sellers' }),
    ).toThrow(/utm_term is only allowed/)
  })

  it('throws in test/dev for an off-vocab value that is not a known alias', () => {
    expect(() => buildTrackedUrl(BASE, { source: 'meta', medium: 'email', campaign: 'cma-letter' })).toThrow(
      /utm_source "meta"/,
    )
  })

  it('falls back in production instead of throwing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const out = buildTrackedUrl(BASE, { source: 'meta', medium: 'email', campaign: 'cma-letter' })
      const u = new URL(out)
      expect(u.searchParams.get('utm_source')).toBe('crm')
      expect(u.searchParams.get('utm_medium')).toBe('email')
      expect(u.searchParams.get('utm_campaign')).toBe('cma-letter')
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  it('stamps extraParams such as rr_doc without putting them in a UTM', () => {
    const out = buildTrackedUrl(BASE, {
      source: 'cma',
      medium: 'document',
      campaign: 'cma-letter',
      extraParams: { [CMA_DOC_PARAM]: 'cma-1975-harriman' },
    })
    const u = new URL(out)
    expect(u.searchParams.get('utm_campaign')).toBe('cma-letter')
    expect(u.searchParams.get(CMA_DOC_PARAM)).toBe('cma-1975-harriman')
    expect(out).not.toContain('utm_campaign=cma-1975-harriman')
  })
})

describe('helpers', () => {
  it('maps prospect kind and social platforms onto vocab', () => {
    expect(prospectCampaign('expired')).toBe('expired-outreach')
    expect(prospectCampaign('fsbo')).toBe('fsbo-outreach')
    expect(platformUtmSource('instagram')).toBe('instagram')
    expect(platformUtmSource('google_business_profile')).toBe('gbp')
    expect(platformUtmSource('tiktok')).toBe('referral-tiktok.com')
  })

  it('recognizes a CMA document slug and not the program slug cma-letter', () => {
    expect(isCmaDocumentSlug('cma-1975-harriman')).toBe(true)
    expect(isCmaDocumentSlug('cma-letter')).toBe(false)
    expect(isCmaDocumentSlug('spring-sale')).toBe(false)
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})
