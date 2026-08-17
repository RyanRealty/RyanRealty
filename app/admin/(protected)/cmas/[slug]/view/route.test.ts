import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAdminContext = vi.fn()
const serveCmaDocument = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  getAdminContext: (...args: unknown[]) => getAdminContext(...args),
}))

vi.mock('@/lib/cma/serve-document', () => ({
  CMA_DOC_HEADERS: {
    'Content-Type': 'text/html',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'private, no-store',
    'X-Frame-Options': 'SAMEORIGIN',
  },
  serveCmaDocument: (...args: unknown[]) => serveCmaDocument(...args),
}))

import { GET } from './route'

const SLUG = 'cma-850-quince-redmond-97756'

function req(): Request {
  return new Request(`https://ryan-realty.com/admin/cmas/${SLUG}/view`)
}

describe('GET /admin/cmas/[slug]/view', () => {
  beforeEach(() => {
    getAdminContext.mockReset()
    serveCmaDocument.mockReset()
  })

  it('returns 200 HTML for a broker reviewing a draft', async () => {
    getAdminContext.mockResolvedValue({
      email: 'matt@ryan-realty.com',
      role: 'superuser',
      brokerId: 'b1',
    })
    serveCmaDocument.mockResolvedValue({
      kind: 'html',
      status: 200,
      html: '<html><body>850 Quince draft</body></html>',
    })

    const res = await GET(req(), { params: Promise.resolve({ slug: SLUG }) })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('850 Quince draft')
    expect(serveCmaDocument).toHaveBeenCalledWith({
      slug: SLUG,
      requestUrl: `https://ryan-realty.com/admin/cmas/${SLUG}/view`,
      isAdmin: true,
      viewerEmail: 'matt@ryan-realty.com',
      skipRegisterGate: true,
    })
  })

  it('does not send or approve — unauthenticated stays 401', async () => {
    getAdminContext.mockResolvedValue(null)
    const res = await GET(req(), { params: Promise.resolve({ slug: SLUG }) })
    expect(res.status).toBe(401)
    expect(serveCmaDocument).not.toHaveBeenCalled()
  })
})
