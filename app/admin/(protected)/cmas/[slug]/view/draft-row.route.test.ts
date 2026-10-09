/**
 * Open report is GET /admin/cmas/[slug]/view. A draft row must come back as
 * the rendered letter for an admin, including when the live closed-sales
 * read never returns — that hang was the blank tab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAdminContext = vi.fn()
const getCmaServeHead = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const getCmaRenderSourceBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn()
const renderImmersiveCmaHtml = vi.fn(() => '<html><body>3711 Purcell draft report</body></html>')
const getCmaCityClosedDuring = vi.fn(async () => [] as unknown[])
const getLikeHomeSales = vi.fn(async () => [] as unknown[])

vi.mock('@/lib/auth/guards', () => ({
  getAdminContext: (...args: unknown[]) => getAdminContext(...args),
}))

vi.mock('@/lib/data', () => ({
  getCmaServeHead: (...args: unknown[]) => getCmaServeHead(...args),
  getCmaStoredHtmlBySlug: (...args: unknown[]) => getCmaStoredHtmlBySlug(...args),
  getCmaRenderSourceBySlug: (...args: unknown[]) => getCmaRenderSourceBySlug(...args),
  getCmaAccessIdentity: (...args: unknown[]) => getCmaAccessIdentity(...args),
  findCrmPersonIdByEmail: async () => null,
}))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaCityClosedDuring: () => getCmaCityClosedDuring(),
  getLikeHomeSales: () => getLikeHomeSales(),
  getCmaBrokerBySlugOrEmail: vi.fn(async () => ({
    id: 'broker-1',
    slug: 'matthew-ryan',
    display_name: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    license_number: '201212345',
    email: 'matt@ryan-realty.com',
    twilio_number: '5415550100',
    photo_url: null,
  })),
}))

vi.mock('@/lib/cma/immersive', () => ({
  renderImmersiveCmaHtml: (...args: unknown[]) =>
    (renderImmersiveCmaHtml as (...inner: unknown[]) => string)(...args),
}))

vi.mock('@/lib/cma/map', () => ({
  buildCmaMapDataUri: vi.fn(async () => null),
  cmaMapOptionsFromArgs: () => ({}),
}))

vi.mock('@/lib/cma/market-area-hydrate', () => ({
  hydrateCmaMarketArea: vi.fn(async (args: unknown) => args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

import { GET } from './route'

const SLUG = 'cma-3711-purcell'

const draftHead = {
  html_path: 'db:cmas.html_content:cma-3711-purcell',
  status: 'draft',
  broker_slug: 'matthew-ryan',
}

const draftSource = {
  ...draftHead,
  build_summary: null,
  render_args: {
    comps: [{ address: '3700 Purcell' }],
    subject: {
      streetAddress: '3711 Purcell',
      city: 'Bend',
      subdivision: 'Northwest Crossing',
      sqft: 1800,
      yearBuilt: 2004,
      latitude: 44.06,
      longitude: -121.3,
    },
    expiredAudit: { finalCycle: { listDate: '2025-01-15', offMarketDate: '2025-06-01' } },
    generatedAtIso: '2025-06-02T00:00:00.000Z',
  },
}

function admin() {
  getAdminContext.mockResolvedValue({
    email: 'matt@ryan-realty.com',
    role: 'superuser',
    brokerId: 'b1',
  })
}

describe('GET /admin/cmas/[slug]/view draft row', () => {
  beforeEach(() => {
    getAdminContext.mockReset()
    getCmaServeHead.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    renderImmersiveCmaHtml.mockReset()
    renderImmersiveCmaHtml.mockImplementation(() => '<html><body>3711 Purcell draft report</body></html>')
    getCmaCityClosedDuring.mockReset()
    getCmaCityClosedDuring.mockResolvedValue([])
    getLikeHomeSales.mockReset()
    getLikeHomeSales.mockResolvedValue([])
    getCmaServeHead.mockResolvedValue(draftHead)
    getCmaRenderSourceBySlug.mockResolvedValue(draftSource)
    getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>stored purcell letter</body></html>')
    getCmaAccessIdentity.mockResolvedValue(null)
    admin()
  })

  it('returns the rendered draft, not CMA not found', async () => {
    const res = await GET(new Request(`https://ryan-realty.com/admin/cmas/${SLUG}/view`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('3711 Purcell draft report')
    expect(html).not.toContain('CMA not found')
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(getCmaRenderSourceBySlug).toHaveBeenCalledTimes(1)
  })

  it('still returns HTML when the live market read hangs', async () => {
    vi.useFakeTimers()
    try {
      getCmaCityClosedDuring.mockImplementation(() => new Promise(() => {}))
      getLikeHomeSales.mockImplementation(() => new Promise(() => {}))
      const pending = GET(new Request(`https://ryan-realty.com/admin/cmas/${SLUG}/view`), {
        params: Promise.resolve({ slug: SLUG }),
      })
      await vi.advanceTimersByTimeAsync(4_000)
      const res = await pending
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('3711 Purcell draft report')
      expect(html).not.toContain('CMA not found')
    } finally {
      vi.useRealTimers()
    }
  })
})
