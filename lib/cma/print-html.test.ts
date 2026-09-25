import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCmaRenderSourceBySlug = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn(async (_slug?: string) => null as unknown)
const renderCmaHtml = vi.fn((_args?: unknown) => ({
  html: '<html><body>fresh print</body></html>',
  pageCount: 19,
}))
const buildCmaMapDataUri = vi.fn(async (_subject?: unknown, _comps?: unknown) => null)
const buildSubjectLocationMapDataUri = vi.fn(async (_subject?: unknown) => null)
const buildCma = vi.fn()
const selectComps = vi.fn()

vi.mock('@/lib/data', () => ({
  getCmaRenderSourceBySlug: (...args: unknown[]) => getCmaRenderSourceBySlug(...args),
  getCmaStoredHtmlBySlug: (...args: unknown[]) => getCmaStoredHtmlBySlug(...args),
  getCmaAccessIdentity: (slug?: string) => getCmaAccessIdentity(slug),
  findCrmPersonIdByEmail: vi.fn(async () => null),
}))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaCityClosedDuring: vi.fn(async () => []),
  getCmaBrokerBySlugOrEmail: vi.fn(async () => ({
    id: 'b1',
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner',
    license_number: null,
    email: 'matt@ryan-realty.com',
    twilio_number: null,
    photo_url: null,
  })),
}))

vi.mock('@/lib/cma/render', () => ({
  renderCmaHtml: (args: unknown) => renderCmaHtml(args),
}))

vi.mock('@/lib/cma/map', () => ({
  buildCmaMapDataUri: (subject: unknown, comps: unknown) => buildCmaMapDataUri(subject, comps),
  buildSubjectLocationMapDataUri: (subject: unknown) => buildSubjectLocationMapDataUri(subject),
}))

vi.mock('@/lib/cma/listing-window-load', () => ({
  listingMarketForDocument: vi.fn(async () => null),
}))

vi.mock('@/lib/cma/like-home-credits-load', () => ({
  likeHomeCreditsForDocument: vi.fn(async () => null),
}))

vi.mock('@/lib/cma/build', () => ({
  buildCma: (...args: unknown[]) => buildCma(...args),
}))

vi.mock('@/lib/cma/comps', () => ({
  selectComps: (...args: unknown[]) => selectComps(...args),
}))

import { resolveCmaPrintHtml } from './print-html'
import { proximityLabel } from '@/lib/cma/market-area'
import { pricingIdentity } from '@/lib/cma/print-overlay'

describe('resolveCmaPrintHtml', () => {
  beforeEach(() => {
    getCmaRenderSourceBySlug.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    getCmaAccessIdentity.mockResolvedValue(null)
    renderCmaHtml.mockClear()
    renderCmaHtml.mockImplementation(() => ({
      html: '<html><body>fresh print</body></html>',
      pageCount: 19,
    }))
    buildCmaMapDataUri.mockClear()
    buildSubjectLocationMapDataUri.mockClear()
    buildCma.mockClear()
    selectComps.mockClear()
  })

  it('renders from render_args so current CSS ships on Open PDF', async () => {
    getCmaRenderSourceBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      render_args: {
        subject: { streetAddress: '648 SE Douglas', city: 'Bend' },
        comps: [],
      },
      broker_slug: 'matthew-ryan',
      build_summary: null,
    })
    const out = await resolveCmaPrintHtml('cma-648-se-douglas')
    expect(out).toEqual({ html: '<html><body>fresh print</body></html>', status: 'draft' })
    expect(renderCmaHtml).toHaveBeenCalled()
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
    expect(buildSubjectLocationMapDataUri).not.toHaveBeenCalled()
    const renderArg = renderCmaHtml.mock.calls[0]?.[0] as { subjectMapDataUri?: unknown }
    expect(renderArg.subjectMapDataUri).toBeNull()
  })

  it('never calls buildCma or the comp picker; rec, band, and comps stay byte-identical', async () => {
    const comps = [
      {
        listingKey: 'C1',
        address: '1 Closed Sale',
        closePrice: 700000,
        adjustedPrice: 700000,
        weight: 0.6,
        proximity: '0.20 miles NW',
      },
    ]
    const pricing = {
      recommended: 716000,
      conservative: 693000,
      highEnd: 735000,
      valueLow: 693000,
      valueHigh: 735000,
    }
    const extras = {
      seasonality: null,
      band: {
        lo: 693000,
        hi: 735000,
        activeCount: 1,
        pendingCount: 0,
        activeMedianAsk: null,
        activeMedianDom: null,
        source: 'test',
        rivals: [
          {
            listingKey: 'A1',
            address: '200 Test',
            listPrice: 710000,
            status: 'Active' as const,
            daysOnMarket: 12,
            photoUrl: null,
            latitude: 44.07,
            longitude: -121.3,
          },
        ],
      },
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
    }
    const render_args = {
      subject: {
        streetAddress: '20506 Murphy',
        city: 'Bend',
        latitude: 44.058,
        longitude: -121.315,
      },
      comps,
      pricing,
      extras,
      generatedAtIso: '2026-09-25T12:00:00.000Z',
      client: { name: 'Jordan Murphy' },
    }
    const compsBefore = JSON.stringify(render_args.comps)
    const recBefore = JSON.stringify(render_args.pricing.recommended)
    const bandBefore = JSON.stringify(pricingIdentity(render_args.pricing))
    const extrasBandBefore = JSON.stringify({ lo: extras.band.lo, hi: extras.band.hi })

    renderCmaHtml.mockImplementation((args: unknown) => {
      const a = args as {
        extras?: { band?: { rivals?: Array<{ proximity?: string | null }> } }
        pricing?: typeof pricing
        comps?: typeof comps
      }
      return {
        html: [
          '<p class="cover-presented">Prepared for Jordan Murphy by Matt Ryan, Ryan Realty · Sep 25, 2026</p>',
          '<p class="fine">Prepared Sep 25, 2026 for Jordan Murphy. This is a comparative market analysis. It is not an appraisal.</p>',
          `<p>rec=${a.pricing?.recommended}</p>`,
        ].join(''),
        pageCount: 12,
      }
    })

    getCmaRenderSourceBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-20506-murphy',
      status: 'draft',
      render_args,
      broker_slug: 'matthew-ryan',
      build_summary: null,
    })

    const out = await resolveCmaPrintHtml('cma-20506-murphy')

    expect(buildCma).not.toHaveBeenCalled()
    expect(selectComps).not.toHaveBeenCalled()
    expect(JSON.stringify(render_args.comps)).toBe(compsBefore)
    expect(JSON.stringify(render_args.pricing.recommended)).toBe(recBefore)
    expect(JSON.stringify(pricingIdentity(render_args.pricing))).toBe(bandBefore)
    expect(JSON.stringify({ lo: extras.band.lo, hi: extras.band.hi })).toBe(extrasBandBefore)
    expect(extras.band.rivals[0]).not.toHaveProperty('proximity')

    const passed = renderCmaHtml.mock.calls[0]?.[0] as {
      extras?: { band?: { rivals?: Array<{ proximity?: string | null; latitude?: number; longitude?: number }> } }
      comps?: unknown
      pricing?: unknown
    }
    expect(JSON.stringify(passed.comps)).toBe(compsBefore)
    expect(JSON.stringify(pricingIdentity(passed.pricing as typeof pricing))).toBe(bandBefore)
    const expected = proximityLabel(
      { lat: 44.058, lng: -121.315 },
      { lat: 44.07, lng: -121.3 },
    )
    expect(passed.extras?.band?.rivals?.[0]?.proximity).toBe(expected)
    expect(passed.extras?.band?.rivals?.[0]?.proximity).toMatch(/miles/)

    expect(out?.html).toContain(
      'Prepared for the owners of 20506 Murphy by Matt Ryan, Ryan Realty · Sep 25, 2026',
    )
    expect(out?.html).toContain(
      'Prepared Sep 25, 2026 for the owners of 20506 Murphy. This is a comparative market analysis. It is not an appraisal.',
    )
    expect(out?.html).not.toContain('Prepared for Jordan Murphy')
    expect(out?.html).toContain('rec=716000')
  })

  it('rewrites stored html_content prepared lines with no render_args and no rebuild', async () => {
    getCmaRenderSourceBySlug.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-21163-clairaway',
      status: 'draft',
      render_args: null,
      broker_slug: 'matthew-ryan',
      build_summary: null,
    })
    getCmaStoredHtmlBySlug.mockResolvedValue(
      [
        '<h1 class="cover-title">21163 Clairaway</h1>',
        '<p class="cover-presented">Prepared for Alex Clairaway by Matt Ryan, Ryan Realty · September 1, 2026</p>',
        '<p class="fine">Prepared September 1, 2026 for Alex Clairaway. This is a comparative market analysis. It is not an appraisal.</p>',
      ].join(''),
    )
    getCmaAccessIdentity.mockResolvedValue({
      personId: 1,
      clientEmail: null,
      clientName: 'Alex Clairaway',
      subjectAddress: '21163 Clairaway',
      personEmails: [],
      claimedBy: null,
      consentRecorded: false,
    })

    const out = await resolveCmaPrintHtml('cma-21163-clairaway')
    expect(buildCma).not.toHaveBeenCalled()
    expect(selectComps).not.toHaveBeenCalled()
    expect(renderCmaHtml).not.toHaveBeenCalled()
    expect(out?.html).toContain(
      'Prepared for the owners of 21163 Clairaway by Matt Ryan, Ryan Realty · September 1, 2026',
    )
    expect(out?.html).not.toContain('Prepared for Alex Clairaway')
  })
})
