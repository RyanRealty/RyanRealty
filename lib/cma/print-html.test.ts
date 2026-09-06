import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCmaRenderSourceBySlug = vi.fn()
const getCmaStoredHtmlBySlug = vi.fn()
const renderCmaHtml = vi.fn((_args?: unknown) => ({
  html: '<html><body>fresh print</body></html>',
  pageCount: 19,
}))
const buildCmaMapDataUri = vi.fn(async (_subject?: unknown, _comps?: unknown) => null)
const buildSubjectLocationMapDataUri = vi.fn(async (_subject?: unknown) => null)

vi.mock('@/lib/data', () => ({
  getCmaRenderSourceBySlug: (...args: unknown[]) => getCmaRenderSourceBySlug(...args),
  getCmaStoredHtmlBySlug: (...args: unknown[]) => getCmaStoredHtmlBySlug(...args),
}))

vi.mock('@/lib/data/cma/builderReads', () => ({
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

import { resolveCmaPrintHtml } from './print-html'

describe('resolveCmaPrintHtml', () => {
  beforeEach(() => {
    getCmaRenderSourceBySlug.mockReset()
    getCmaStoredHtmlBySlug.mockReset()
    renderCmaHtml.mockClear()
    buildCmaMapDataUri.mockClear()
    buildSubjectLocationMapDataUri.mockClear()
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
  })
})
