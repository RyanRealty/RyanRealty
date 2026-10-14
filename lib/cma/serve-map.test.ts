/**
 * The live letter still draws the comps map when the boundary and tile read
 * is slower than the old 4 second optional-read budget (rule 31, 2745 Aldrich
 * timed out at 4000ms). The row is the stored Pinnacle letter: asked $585,000,
 * canceled after 90 days, competition band $483,000 to $591,000. The map
 * builder is stubbed. These coordinates are not that home's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CmaRenderSource } from '@/lib/data/cma/documents'
import type { CmaSubject } from '@/lib/cma/types'

const state = vi.hoisted(() => ({ delayMs: 6_000 }))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaBrokerBySlugOrEmail: async () => ({
    id: 'broker-1',
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    license_number: null,
    email: null,
    phone: null,
    photo_url: null,
  }),
}))

vi.mock('@/lib/cma/listing-window-load', () => ({
  listingMarketForDocument: async () => null,
}))

vi.mock('@/lib/cma/like-home-credits-load', () => ({
  likeHomeCreditsForDocument: async () => null,
}))

vi.mock('@/lib/cma/print-html', () => ({
  resolveDocLinkCtx: async () => ({ brokerSlug: 'matthew-ryan', personId: null, cmaSlug: 'cma-2902-pinnacle' }),
  resolveCmaPrintHtml: async () => null,
}))

vi.mock('@/lib/cma/market-area-hydrate', () => ({
  hydrateCmaMarketArea: async (args: unknown) => args,
}))

vi.mock('@/lib/cma/immersive', () => ({
  renderImmersiveCmaHtml: (args: { mapDataUri?: string | null }) =>
    args.mapDataUri
      ? `<img class="pin-map" src="${args.mapDataUri}" alt="Map of your home and the sales" />`
      : '<section id="what-its-worth"><p>No map</p></section>',
}))

vi.mock('@/lib/cma/map', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cma/map')>('@/lib/cma/map')
  return {
    ...actual,
    buildCmaMapDataUri: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            dataUri: 'data:image/png;base64,PINNACLE',
            pointCount: 1,
            view: { centerLat: 44.05, centerLng: -121.3, zoom: 14, width: 640, height: 360 },
            pins: [],
            boundaryShown: false,
            parentShown: false,
            radiusShown: false,
            outlineRings: [],
            streetPlaceShown: null,
          })
        }, state.delayMs)
      }),
  }
})

import { CMA_MAP_MS, immersiveFromRow } from '@/lib/cma/serve-document'
import { mapSubsectionHtml } from '@/lib/cma/render-pricing-page'

const pinnacle = {
  status: 'draft',
  broker_slug: 'matthew-ryan',
  build_summary: null,
  render_args: {
    subject: {
      streetAddress: '2902 Pinnacle',
      city: 'Bend',
      state: 'OR',
      postalCode: '97701',
      lastListPrice: 585_000,
      standardStatus: 'Canceled',
    },
    comps: [],
    compArea: {
      kind: 'subdivisions',
      names: ['Eaglenest', 'Mtn Peaks', 'Madison Park', 'Oakview', 'Obsidian Ridge'],
    },
  },
} as unknown as CmaRenderSource

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('immersiveFromRow draws the map inside its own budget', () => {
  it('renders the map when the read takes 6 seconds, past the old 4 second budget', async () => {
    expect(CMA_MAP_MS).toBeGreaterThan(6_000)
    state.delayMs = 6_000
    vi.useFakeTimers()
    const pending = immersiveFromRow(pinnacle, 'https://ryan-realty.com', false, 'cma-2902-pinnacle')
    await vi.advanceTimersByTimeAsync(6_000)
    const html = await pending
    expect(html).toContain('<img class="pin-map"')
    expect(html).toContain('data:image/png;base64,PINNACLE')
  })

  it('drops the map, and the letter does not talk about one, when the read outlasts the map budget', async () => {
    state.delayMs = CMA_MAP_MS + 1_000
    vi.useFakeTimers()
    const pending = immersiveFromRow(pinnacle, 'https://ryan-realty.com', false, 'cma-2902-pinnacle-slow')
    await vi.advanceTimersByTimeAsync(CMA_MAP_MS)
    const html = await pending
    expect(html).not.toContain('<img class="pin-map"')
    const caption = mapSubsectionHtml({
      subject: {
        streetAddress: '2902 Pinnacle',
        city: 'Bend',
        state: 'OR',
        postalCode: '97701',
        lastListPrice: 585_000,
      } as CmaSubject,
      facts: [
        {
          key: '1',
          family: 'closed',
          address: '1 Eaglenest',
          outcome: 'sold',
          domDays: 90,
          priceChanges: 0,
        },
      ],
      mapDataUri: null,
      areaSentence: 'Eaglenest, Mtn Peaks, Madison Park, Oakview, Obsidian Ridge.',
    })
    expect(caption).toBe('')
    expect(caption).not.toContain('Every pin above')
    expect(caption).not.toContain('pin-legend')
    expect(caption).not.toContain('Comparable homes near you')
  })
})
