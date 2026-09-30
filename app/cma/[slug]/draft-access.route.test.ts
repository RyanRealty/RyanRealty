/**
 * Same draft row, two callers.
 *
 * {"error":"CMA not found"} is serveCmaDocument when the row exists but the
 * caller is not an admin (canBrokerReviewCma). The review page's email preview
 * is a sandboxed iframe; a click that stays inside that frame does not send
 * the admin cookie, so /cma/[slug] looks anonymous and a draft 404s as JSON.
 * An authenticated admin on the same URL gets the rendered letter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAdminContext = vi.fn()
const getCmaServeHead = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const getCmaRenderSourceBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn()
const renderImmersiveCmaHtml = vi.fn(() => '<html><body>3711 Purcell draft report</body></html>')

// Matt's 80% line (lib/cma/send-floor.ts) reads the CMA row; not held unless a test says so.
const floorMock = vi.hoisted(() => ({
  getCmaSendFloorBySlug: vi.fn(async (_slug: string, _ctx?: unknown) => ({
    held: false as boolean,
    ratio: null as number | null,
    reason: null as string | null,
    unreadable: undefined as true | undefined,
  })),
}))
vi.mock('@/lib/data/cma/send-floor', () => floorMock)

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
  getCmaCityClosedDuring: vi.fn(async () => []),
  getLikeHomeSales: vi.fn(async () => []),
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

describe('GET /cma/[slug] draft row', () => {
  beforeEach(() => {
    getAdminContext.mockReset()
    getCmaServeHead.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    renderImmersiveCmaHtml.mockClear()
    getCmaServeHead.mockResolvedValue(draftHead)
    getCmaRenderSourceBySlug.mockResolvedValue({
      ...draftHead,
      render_args: { comps: [], subject: { streetAddress: '3711 Purcell', city: 'Bend' } },
      build_summary: null,
    })
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaAccessIdentity.mockResolvedValue(null)
  })

  it('returns CMA not found JSON when the caller is not an admin, even though the draft row exists', async () => {
    getAdminContext.mockResolvedValue(null)
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'CMA not found' })
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })

  it('renders the draft for an authenticated admin', async () => {
    getAdminContext.mockResolvedValue({
      email: 'matt@ryan-realty.com',
      role: 'superuser',
      brokerId: 'b1',
    })
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('3711 Purcell draft report')
    expect(html).not.toContain('CMA not found')
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
  })
})

describe('GET /cma/[slug] archived row (a report pulled back after it went out, Matt 2026-09-30)', () => {
  const archivedHead = { ...draftHead, status: 'archived' }
  beforeEach(() => {
    getAdminContext.mockReset()
    getCmaServeHead.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    renderImmersiveCmaHtml.mockClear()
    getCmaServeHead.mockResolvedValue(archivedHead)
    getCmaRenderSourceBySlug.mockResolvedValue({
      ...archivedHead,
      render_args: { comps: [], subject: { streetAddress: '3711 Purcell', city: 'Bend' } },
      build_summary: null,
    })
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaAccessIdentity.mockResolvedValue(null)
  })

  it('tells the owner the report is being updated and never renders the pulled document', async () => {
    getAdminContext.mockResolvedValue(null)
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('This report is being updated')
    expect(html).not.toContain('3711 Purcell draft report')
    expect(html).not.toContain('—')
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/)
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })

  it('still opens the archived document for an authenticated admin', async () => {
    getAdminContext.mockResolvedValue({ email: 'matt@ryan-realty.com', role: 'superuser', brokerId: 'b1' })
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('3711 Purcell draft report')
    expect(html).not.toContain('This report is being updated')
  })
})

describe('GET /cma/[slug] pulled or held for the public (Matt 2026-09-30)', () => {
  const HELD = {
    held: true,
    ratio: 0.727,
    reason: 'Held for Matt: priced at $618,000, 72.7% of the last list of $849,000.',
    unreadable: undefined,
  }
  beforeEach(() => {
    getAdminContext.mockReset()
    getCmaServeHead.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    renderImmersiveCmaHtml.mockClear()
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaAccessIdentity.mockResolvedValue(null)
    getAdminContext.mockResolvedValue(null)
    floorMock.getCmaSendFloorBySlug.mockResolvedValue({ held: false, ratio: 0.94, reason: null, unreadable: undefined })
  })

  const served = async () => {
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), { params: Promise.resolve({ slug: SLUG }) })
    return { res, html: await res.text() }
  }

  it('a delivered expired CMA under the line shows the notice, not the report', async () => {
    getCmaServeHead.mockResolvedValue({ ...draftHead, status: 'delivered' })
    floorMock.getCmaSendFloorBySlug.mockResolvedValue(HELD)
    const { res, html } = await served()
    expect(res.status).toBe(200)
    expect(html).toContain('This report is being updated')
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })

  it('a row pulled by stamp only (archived_at, status still delivered) shows the notice', async () => {
    getCmaServeHead.mockResolvedValue({ ...draftHead, status: 'delivered', archived_at: '2026-09-30T22:48:59Z' })
    const { html } = await served()
    expect(html).toContain('This report is being updated')
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })

  it('a delivered report rebuilt back to draft shows the notice, not a JSON 404', async () => {
    getCmaServeHead.mockResolvedValue({ ...draftHead, status: 'draft', delivered_at: '2026-09-30T21:42:56Z' })
    const { html } = await served()
    expect(html).toContain('This report is being updated')
  })
})
