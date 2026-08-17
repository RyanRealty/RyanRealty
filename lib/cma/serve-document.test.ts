import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCmaHtmlBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn()
const renderImmersiveCmaHtml = vi.fn(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')

vi.mock('@/lib/data', () => ({
  getCmaHtmlBySlug: (...args: unknown[]) =>
    (getCmaHtmlBySlug as (...inner: unknown[]) => unknown)(...args),
  getCmaAccessIdentity: (...args: unknown[]) =>
    (getCmaAccessIdentity as (...inner: unknown[]) => unknown)(...args),
}))

vi.mock('@/lib/data/cma/builderReads', () => ({
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
    (renderImmersiveCmaHtml as (...inner: unknown[]) => unknown)(...args),
}))

vi.mock('@/lib/cma/market-area-hydrate', () => ({
  hydrateCmaMarketArea: vi.fn(async (args: unknown) => args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

import { serveCmaDocument } from './serve-document'

const DRAFT_SLUG = 'cma-850-quince-redmond-97756'

const draftFromRenderArgs = {
  html_content: null,
  html_path: null,
  status: 'draft',
  render_args: { comps: [], subject: { address: '850 Quince Ave' } },
  broker_slug: 'matthew-ryan',
  build_summary: null,
}

describe('serveCmaDocument', () => {
  beforeEach(() => {
    getCmaHtmlBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    renderImmersiveCmaHtml.mockClear()
  })

  it('lets a broker GET a draft from render_args when html_content is missing', async () => {
    getCmaHtmlBySlug.mockResolvedValue(draftFromRenderArgs)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/admin/cmas/${DRAFT_SLUG}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.status).toBe(200)
    expect(result.html).toContain('DRAFT CMA FROM RENDER_ARGS')
    expect(renderImmersiveCmaHtml).toHaveBeenCalled()
  })

  it('keeps anonymous /cma/{draft} as 404', async () => {
    getCmaHtmlBySlug.mockResolvedValue(draftFromRenderArgs)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/cma/${DRAFT_SLUG}`,
      isAdmin: false,
      viewerEmail: null,
    })
    expect(result).toEqual({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
  })
})
