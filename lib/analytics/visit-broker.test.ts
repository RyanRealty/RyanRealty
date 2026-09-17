import { describe, expect, it } from 'vitest'
import {
  AGENT_UTM_PREFIX,
  CRM_OUTBOUND_UTM_MEDIUM,
  CRM_OUTBOUND_UTM_SOURCE,
  agentUtmTag,
  brokerSlugFromAgentUtm,
  resolveVisitBrokerSlug,
  stampCrmOutboundUtms,
  visitBrokerGa4Fields,
} from './visit-broker'

describe('CRM outbound UTMs (attributeSiteLinks / attributeOutbound)', () => {
  it('adds crm/email + agent-<slug> content when the destination has no UTMs', () => {
    const out = stampCrmOutboundUtms('https://ryan-realty.com/homes-for-sale', 'matt-ryan')
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe(CRM_OUTBOUND_UTM_SOURCE)
    expect(u.searchParams.get('utm_medium')).toBe(CRM_OUTBOUND_UTM_MEDIUM)
    expect(u.searchParams.get('utm_content')).toBe('agent-matt-ryan')
    expect(u.searchParams.get('utm_campaign')).toBeNull()
  })

  it('preserves pre-existing channel UTMs (listing-alerts / market-report / CMA)', () => {
    const existing =
      'https://ryan-realty.com/housing-market/bend?utm_source=crm&utm_medium=email&utm_campaign=market-report'
    const out = stampCrmOutboundUtms(existing, 'rebecca')
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('crm')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_campaign')).toBe('market-report')
    expect(u.searchParams.get('utm_content')).toBe('agent-rebecca')
  })

  it('does not overwrite a CMA document utm_source / utm_medium / utm_campaign', () => {
    const existing =
      'https://ryan-realty.com/homes-for-sale/bend/x-220000001?utm_source=cma&utm_medium=document&utm_campaign=cma-101-main'
    const out = stampCrmOutboundUtms(existing, 'matt')
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('cma')
    expect(u.searchParams.get('utm_medium')).toBe('document')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-101-main')
    expect(u.searchParams.get('utm_content')).toBe('agent-matt')
  })

  it('puts the broker in utm_term when utm_content already names a creative', () => {
    const existing =
      'https://ryan-realty.com/?utm_source=email&utm_medium=newsletter&utm_content=hero-video-30s'
    const out = stampCrmOutboundUtms(existing, 'paul-stevenson')
    const u = new URL(out)
    expect(u.searchParams.get('utm_content')).toBe('hero-video-30s')
    expect(u.searchParams.get('utm_term')).toBe('agent-paul-stevenson')
  })

  it('does not invent a broker UTM when there is no slug (channel defaults still apply)', () => {
    const out = stampCrmOutboundUtms('https://ryan-realty.com/search', '')
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('crm')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_content')).toBeNull()
    expect(u.searchParams.get('utm_term')).toBeNull()
  })

  it('is idempotent — a second pass does not double-stamp', () => {
    const once = stampCrmOutboundUtms('https://ryan-realty.com/search', 'matt')
    expect(stampCrmOutboundUtms(once, 'matt')).toBe(once)
    expect([...once.matchAll(/utm_content=/g)]).toHaveLength(1)
  })
})

describe('visit/page_view broker GA fields', () => {
  it('sets assigned_broker (USER) and broker_slug (EVENT) when ?agent= is known', () => {
    const slug = resolveVisitBrokerSlug({
      pageUrl: 'https://ryan-realty.com/homes-for-sale?agent=rebecca-peterson',
    })
    expect(slug).toBe('rebecca')
    expect(visitBrokerGa4Fields(slug)).toEqual({
      eventParams: { broker_slug: 'rebecca' },
      userProperties: { assigned_broker: 'rebecca' },
    })
  })

  it('reads the attribution cookie when the URL no longer carries ?agent=', () => {
    const cookie = encodeURIComponent(JSON.stringify({ slug: 'paul', capturedAt: '2026-09-17' }))
    expect(resolveVisitBrokerSlug({ cookieValue: cookie })).toBe('paul')
  })

  it('accepts agent-<slug> from utm_content / utm_term when agent param is absent', () => {
    expect(resolveVisitBrokerSlug({ utmContent: 'agent-matt-ryan' })).toBe('matt')
    expect(resolveVisitBrokerSlug({ utmTerm: 'agent-paul' })).toBe('paul')
    expect(brokerSlugFromAgentUtm(`${AGENT_UTM_PREFIX}rebecca`)).toBe('rebecca')
  })

  it('prefers ?agent= over cookie / UTM leftovers', () => {
    const cookie = encodeURIComponent(JSON.stringify({ slug: 'matt' }))
    expect(
      resolveVisitBrokerSlug({
        agentParam: 'paul',
        cookieValue: cookie,
        utmContent: 'agent-rebecca',
      }),
    ).toBe('paul')
  })

  it('returns null — no assigned_broker / broker_slug — when the agent is unknown', () => {
    expect(resolveVisitBrokerSlug({ agentParam: 'nobody', utmContent: 'hero-video-30s' })).toBeNull()
    expect(visitBrokerGa4Fields(null)).toBeNull()
    expect(agentUtmTag('Matt-Ryan')).toBe('agent-matt-ryan')
  })
})
