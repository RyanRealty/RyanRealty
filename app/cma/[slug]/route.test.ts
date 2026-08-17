import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAdminContext = vi.fn()
const serveCmaDocument = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  getAdminContext: (...args: unknown[]) => getAdminContext(...args),
}))

vi.mock('@/lib/cma/serve-document', () => ({
  CMA_DOC_HEADERS: { 'Content-Type': 'text/html' },
  serveCmaDocument: (...args: unknown[]) => serveCmaDocument(...args),
}))

import { GET } from './route'

const SLUG = 'cma-850-quince-redmond-97756'

describe('GET /cma/[slug]', () => {
  beforeEach(() => {
    getAdminContext.mockReset()
    serveCmaDocument.mockReset()
  })

  it('returns 404 for an anonymous draft', async () => {
    getAdminContext.mockResolvedValue(null)
    serveCmaDocument.mockResolvedValue({
      kind: 'json',
      status: 404,
      body: { error: 'CMA not found' },
    })
    const res = await GET(new Request(`https://ryan-realty.com/cma/${SLUG}`), {
      params: Promise.resolve({ slug: SLUG }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'CMA not found' })
    expect(serveCmaDocument).toHaveBeenCalledWith({
      slug: SLUG,
      requestUrl: `https://ryan-realty.com/cma/${SLUG}`,
      isAdmin: false,
      viewerEmail: null,
    })
  })
})
