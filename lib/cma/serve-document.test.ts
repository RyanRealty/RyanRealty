import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCmaServeHead = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const getCmaRenderSourceBySlug = vi.fn()
const getCmaAccessIdentity = vi.fn()
const renderImmersiveCmaHtml = vi.fn(() => '<html><body>DRAFT CMA FROM RENDER_ARGS</body></html>')

vi.mock('@/lib/data', () => ({
  getCmaServeHead: (...args: unknown[]) => getCmaServeHead(...args),
  getCmaStoredHtmlBySlug: (...args: unknown[]) => getCmaStoredHtmlBySlug(...args),
  getCmaRenderSourceBySlug: (...args: unknown[]) => getCmaRenderSourceBySlug(...args),
  getCmaAccessIdentity: (...args: unknown[]) => getCmaAccessIdentity(...args),
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
    (renderImmersiveCmaHtml as (...inner: unknown[]) => string)(...args),
}))

vi.mock('@/lib/cma/market-area-hydrate', () => ({
  hydrateCmaMarketArea: vi.fn(async (args: unknown) => args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

import { serveCmaDocument } from './serve-document'

const DRAFT_SLUG = 'cma-850-quince-redmond-97756'

const draftHead = {
  html_path: 'pending:cma-850-quince-redmond-97756',
  status: 'draft',
  broker_slug: 'matthew-ryan',
}

const draftFromRenderArgs = {
  html_path: 'pending:cma-850-quince-redmond-97756',
  status: 'draft',
  render_args: { comps: [], subject: { address: '850 Quince Ave' } },
  broker_slug: 'matthew-ryan',
  build_summary: null,
}

describe('serveCmaDocument', () => {
  beforeEach(() => {
    getCmaServeHead.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    getCmaRenderSourceBySlug.mockReset()
    getCmaAccessIdentity.mockReset()
    renderImmersiveCmaHtml.mockClear()
  })

  it('lets a broker GET a draft from render_args when html_content is missing', async () => {
    getCmaServeHead.mockResolvedValue(draftHead)
    getCmaStoredHtmlBySlug.mockResolvedValue(null)
    getCmaRenderSourceBySlug.mockResolvedValue(draftFromRenderArgs)
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

  it('serves stored HTML for a broker without an immersive rebuild', async () => {
    getCmaServeHead.mockResolvedValue({
      html_path: 'db:cmas.html_content:cma-648-se-douglas',
      status: 'draft',
      broker_slug: 'matthew-ryan',
    })
    getCmaStoredHtmlBySlug.mockResolvedValue('<html><body>648 SE Douglas stored</body></html>')
    const result = await serveCmaDocument({
      slug: 'cma-648-se-douglas',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-648-se-douglas/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result.kind).toBe('html')
    if (result.kind !== 'html') return
    expect(result.html).toContain('648 SE Douglas stored')
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
    expect(getCmaRenderSourceBySlug).not.toHaveBeenCalled()
  })

  it('404s a missing slug without loading blobs', async () => {
    getCmaServeHead.mockResolvedValue(null)
    const result = await serveCmaDocument({
      slug: 'cma-648-douglas',
      requestUrl: 'https://ryan-realty.com/admin/cmas/cma-648-douglas/view',
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
    expect(result).toEqual({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
    expect(getCmaRenderSourceBySlug).not.toHaveBeenCalled()
  })

  it('keeps anonymous /cma/{draft} as 404', async () => {
    getCmaServeHead.mockResolvedValue(draftHead)
    const result = await serveCmaDocument({
      slug: DRAFT_SLUG,
      requestUrl: `https://ryan-realty.com/cma/${DRAFT_SLUG}`,
      isAdmin: false,
      viewerEmail: null,
    })
    expect(result).toEqual({ kind: 'json', status: 404, body: { error: 'CMA not found' } })
    expect(renderImmersiveCmaHtml).not.toHaveBeenCalled()
    expect(getCmaStoredHtmlBySlug).not.toHaveBeenCalled()
  })
})
