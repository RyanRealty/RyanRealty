import { beforeEach, describe, expect, it, vi } from 'vitest'

const isAuthorizedAdminOrCron = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  isAuthorizedAdminOrCron: (...args: unknown[]) => isAuthorizedAdminOrCron(...args),
}))

vi.mock('@/lib/cma-pdf', () => ({
  renderCmaPdfBuffer: vi.fn(),
  CmaNotFoundError: class CmaNotFoundError extends Error {},
}))

import { GET } from './route'

const SLUG = 'cma-648-se-douglas'

function browserReq(path = `/api/cma/${SLUG}/pdf`): Request {
  return new Request(`https://ryan-realty.com${path}`, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  })
}

function machineReq(): Request {
  return new Request(`https://ryan-realty.com/api/cma/${SLUG}/pdf`, {
    headers: { authorization: 'Bearer not-the-secret' },
  })
}

describe('GET /api/cma/[slug]/pdf', () => {
  beforeEach(() => {
    isAuthorizedAdminOrCron.mockReset()
  })

  it('sends an unauthenticated browser tap to login, not JSON 401', async () => {
    isAuthorizedAdminOrCron.mockResolvedValue(false)
    const res = await GET(browserReq(), { params: Promise.resolve({ slug: SLUG }) })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      `https://ryan-realty.com/admin/login?next=${encodeURIComponent(`/admin/cmas/${SLUG}/view`)}`,
    )
    expect(res.headers.get('content-type') ?? '').not.toMatch(/json/)
  })

  it('keeps JSON 401 for a machine caller with a bad secret', async () => {
    isAuthorizedAdminOrCron.mockResolvedValue(false)
    const res = await GET(machineReq(), { params: Promise.resolve({ slug: SLUG }) })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})
