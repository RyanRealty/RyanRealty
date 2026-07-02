import { describe, it, expect } from 'vitest'
import { mapCrmBrokerRow, mapCrmBrokerRows, type CrmBroker } from './getCrmBrokers'

describe('mapCrmBrokerRow', () => {
  it('maps a full DB row to the CRM shape', () => {
    const b = mapCrmBrokerRow({
      crm_slug: 'matt',
      display_name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      crm_active: true,
      routing_eligible: true,
    })
    expect(b).toEqual({
      slug: 'matt',
      name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      phone: null,
      title: null,
      crmActive: true,
      routingEligible: true,
    } satisfies CrmBroker)
  })

  it('maps phone + title for the merge-field party fields', () => {
    const b = mapCrmBrokerRow({
      crm_slug: 'matt',
      display_name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      phone: '541.213.6706',
      title: 'Principal Broker',
      crm_active: true,
      routing_eligible: true,
    })
    expect(b?.phone).toBe('541.213.6706')
    expect(b?.title).toBe('Principal Broker')
  })

  it('coerces a blank title to null', () => {
    const b = mapCrmBrokerRow({
      crm_slug: 'matt',
      display_name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      title: '   ',
      crm_active: true,
      routing_eligible: true,
    })
    expect(b?.title).toBeNull()
  })

  it('returns null for a row with no crm_slug (a non-CRM broker)', () => {
    expect(
      mapCrmBrokerRow({
        crm_slug: null,
        display_name: 'Web Only',
        email: 'web@ryan-realty.com',
        crm_active: true,
        routing_eligible: true,
      }),
    ).toBeNull()
  })

  it('returns null for a blank/whitespace crm_slug', () => {
    expect(
      mapCrmBrokerRow({
        crm_slug: '   ',
        display_name: 'X',
        email: null,
        crm_active: true,
        routing_eligible: true,
      }),
    ).toBeNull()
  })

  it('trims the slug and name, preserves null email', () => {
    const b = mapCrmBrokerRow({
      crm_slug: '  rebecca  ',
      display_name: '  Rebecca Peterson  ',
      email: null,
      crm_active: false,
      routing_eligible: false,
    })
    expect(b).toEqual({
      slug: 'rebecca',
      name: 'Rebecca Peterson',
      email: null,
      phone: null,
      title: null,
      crmActive: false,
      routingEligible: false,
    } satisfies CrmBroker)
  })

  it('coerces null active/routing flags to false (fail-closed)', () => {
    const b = mapCrmBrokerRow({
      crm_slug: 'paul',
      display_name: 'Paul Stevenson',
      email: 'paul@ryan-realty.com',
      crm_active: null,
      routing_eligible: null,
    })
    expect(b?.crmActive).toBe(false)
    expect(b?.routingEligible).toBe(false)
  })

  it('coerces a missing display_name to an empty string', () => {
    const b = mapCrmBrokerRow({
      crm_slug: 'matt',
      display_name: null,
      email: 'matt@ryan-realty.com',
      crm_active: true,
      routing_eligible: true,
    })
    expect(b?.name).toBe('')
  })
})

describe('mapCrmBrokerRows', () => {
  const fullSet = [
    {
      crm_slug: 'matt',
      display_name: 'Matt Ryan',
      email: 'matt@ryan-realty.com',
      crm_active: true,
      routing_eligible: true,
    },
    {
      crm_slug: 'rebecca',
      display_name: 'Rebecca Peterson',
      email: 'rebeccapeterson@ryan-realty.com',
      crm_active: true,
      routing_eligible: false,
    },
    {
      crm_slug: 'paul',
      display_name: 'Paul Stevenson',
      email: 'paul@ryan-realty.com',
      crm_active: false,
      routing_eligible: true,
    },
  ]

  it('maps every CRM broker row, preserving input order', () => {
    const out = mapCrmBrokerRows(fullSet)
    expect(out.map((b) => b.slug)).toEqual(['matt', 'rebecca', 'paul'])
  })

  it('resolves the short CRM slug for each broker', () => {
    const out = mapCrmBrokerRows(fullSet)
    expect(out.find((b) => b.email === 'matt@ryan-realty.com')?.slug).toBe('matt')
    expect(out.find((b) => b.email === 'rebeccapeterson@ryan-realty.com')?.slug).toBe('rebecca')
    expect(out.find((b) => b.email === 'paul@ryan-realty.com')?.slug).toBe('paul')
  })

  it('drops rows without a crm_slug (web-only broker profiles)', () => {
    const out = mapCrmBrokerRows([
      ...fullSet,
      {
        crm_slug: null,
        display_name: 'Web Only',
        email: 'web@ryan-realty.com',
        crm_active: true,
        routing_eligible: true,
      },
    ])
    expect(out).toHaveLength(3)
    expect(out.some((b) => b.email === 'web@ryan-realty.com')).toBe(false)
  })

  it('carries the crm_active flag so callers can filter active brokers', () => {
    const out = mapCrmBrokerRows(fullSet)
    const active = out.filter((b) => b.crmActive)
    expect(active.map((b) => b.slug)).toEqual(['matt', 'rebecca'])
  })

  it('carries routing_eligible so routing can exclude an ineligible broker', () => {
    const out = mapCrmBrokerRows(fullSet)
    const routable = out.filter((b) => b.routingEligible)
    expect(routable.map((b) => b.slug)).toEqual(['matt', 'paul'])
  })

  it('returns [] for an empty result set', () => {
    expect(mapCrmBrokerRows([])).toEqual([])
  })
})
