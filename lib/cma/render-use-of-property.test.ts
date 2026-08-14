import { describe, expect, it } from 'vitest'
import { useOfPropertyPage } from '@/lib/cma/render-use-of-property'
import type { DevelopmentOpportunities } from '@/lib/cma/development'
import type { RentalPotential } from '@/lib/cma/rental-potential'

const development: DevelopmentOpportunities = {
  jurisdiction: 'City of Redmond',
  zone: 'R-2',
  verifiedAsOf: '2026-07-30',
  zoningExplainer: {
    zone: 'R-2',
    zoneName: 'Limited Residential',
    purpose: 'Redmond R-2 holds single-unit homes at a limited density.',
    permittedOutright: ['Single-unit dwelling', 'Accessory dwelling'],
    conditional: ['Day care'],
    dimensional: [{ label: 'Minimum lot', value: '6,000 sqft' }],
    citation: 'RDC 8.135',
    url: 'https://www.codepublishing.com/OR/Redmond/',
  },
  items: [
    {
      topic: 'ADU',
      verdict: 'yes',
      headline: 'An accessory dwelling is allowed on this lot.',
      detail: 'Redmond permits an ADU with the primary dwelling when the lot meets the size test. This lot does.',
      citation: 'RDC 8.141',
      url: 'https://www.codepublishing.com/OR/Redmond/',
    },
    {
      topic: 'Subdivide or partition',
      verdict: 'no',
      headline: 'This lot is too small to partition.',
      detail: 'The zone minimum is larger than the recorded acreage, so a partition is not available on the current lot.',
      citation: 'RDC 8.135',
      url: 'https://www.codepublishing.com/OR/Redmond/',
    },
    {
      topic: 'Short-term rental',
      verdict: 'conditional',
      headline: 'A stay under 30 days needs a city permit.',
      detail: 'This land-use line is shown under Rent, not Build.',
      citation: 'RCC 7.134',
      url: 'https://www.codepublishing.com/OR/Redmond/',
    },
  ],
  buyerOptions: [],
  hoa: { hasAssociation: true, feeLabel: '$45 / month', resortAssociation: null, ccrGuidance: 'Read the recorded CC&Rs before acting on any of the above.' },
  marketingHighlights: [],
  disclaimer: 'This is a preliminary read of published code, not a land-use decision.',
  resources: [],
}

const rental: RentalPotential = {
  jurisdiction: 'City of Redmond',
  tenures: [
    {
      tenure: 'Long-term',
      verdict: 'yes',
      headline: 'A 12-month lease is open.',
      detail: 'Oregon chapter 90 governs a long-term tenancy at this address.',
      requirements: ['Use a written rental agreement.', 'Follow the state notice periods.'],
      citation: 'ORS chapter 90',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
    },
    {
      tenure: 'Mid-term',
      verdict: 'yes',
      headline: 'A stay of 30 days or more is a residential tenancy.',
      detail: 'Oregon has no mid-term category. The local short-term test and ORS 90 decide it.',
      requirements: ['Use a written rental agreement.'],
      citation: 'ORS 90.100',
      url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
    },
    {
      tenure: 'Short-term',
      verdict: 'conditional',
      headline: 'Nightly rental needs a city permit.',
      detail: 'Redmond treats a stay under 30 days as a short-term rental.',
      requirements: ['Apply for the city short-term rental permit.'],
      citation: 'RCC 7.134',
      url: 'https://www.codepublishing.com/OR/Redmond/',
    },
  ],
  income: [{ label: 'State lodging tax', value: '1.5%', basis: 'ORS 320.305' }],
  marketingHighlights: [],
  economicsNote: 'Model income from real quotes. This report does not invent a nightly rate.',
  verifiedAsOf: '2026-07-30',
  disclaimer: 'Not legal or tax advice.',
}

describe('useOfPropertyPage', () => {
  it('returns null when there is nothing to say', () => {
    expect(useOfPropertyPage({ streetAddress: '1 Main', development: null, rental: null })).toBeNull()
  })

  it('prints the zone, both boards, and the detail under each headline', () => {
    const page = useOfPropertyPage({ streetAddress: '3480 SW 45th', development, rental })
    expect(page).not.toBeNull()
    const html = page!.body
    expect(html).toContain('What this property can do')
    expect(html).toContain('class="zm-code">R-2')
    expect(html).toContain('Limited Residential')
    expect(html).toContain('Add a unit')
    expect(html).toContain('Split the lot')
    expect(html).toContain('Long-term rent')
    expect(html).toContain('Mid-term rent')
    expect(html).toContain('Short-term rent')
    expect(html).toContain('Build')
    expect(html).toContain('Rent')
    expect(html).toContain('An accessory dwelling is allowed on this lot.')
    expect(html).toContain('This lot does.')
    expect(html).toContain('A 12-month lease is open.')
    expect(html).toContain('Oregon chapter 90')
    expect(html).toContain('Nightly rental needs a city permit.')
    expect(html).toContain('Cited income figures')
    expect(html).toContain('ORS 320.305')
    expect(html).not.toContain('This land-use line is shown under Rent, not Build.')
    expect(html.replace(/&[a-zA-Z]+;/g, '')).not.toMatch(/[—;]/)
  })
})
