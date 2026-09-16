import { afterEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const getAdminRoleForEmail = vi.fn()
const resolveCrmSlugForAccess = vi.fn()

vi.mock('@/app/actions/auth', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}))
vi.mock('@/app/actions/admin-roles', () => ({
  getAdminRoleForEmail: (...args: unknown[]) => getAdminRoleForEmail(...args),
}))
vi.mock('@/lib/data/brokers/resolveCrmSlug', () => ({
  resolveCrmSlugForAccess: (...args: unknown[]) => resolveCrmSlugForAccess(...args),
}))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

import { getCrmAccess } from './getCrmAccess'

afterEach(() => {
  getSession.mockReset()
  getAdminRoleForEmail.mockReset()
  resolveCrmSlugForAccess.mockReset()
})

describe('getCrmAccess', () => {
  it('returns null when there is no session email', async () => {
    getSession.mockResolvedValue(null)
    getAdminRoleForEmail.mockResolvedValue({ role: 'superuser', brokerId: null })
    await expect(getCrmAccess()).resolves.toBeNull()
    expect(resolveCrmSlugForAccess).not.toHaveBeenCalled()
  })

  it('returns null when the email has no admin role', async () => {
    getSession.mockResolvedValue({ user: { email: 'nobody@example.com' } })
    getAdminRoleForEmail.mockResolvedValue(null)
    await expect(getCrmAccess()).resolves.toBeNull()
    expect(resolveCrmSlugForAccess).not.toHaveBeenCalled()
  })

  it('lowercases the email and returns role + slug', async () => {
    getSession.mockResolvedValue({ user: { email: '  Matt@Ryan-Realty.com ' } })
    getAdminRoleForEmail.mockResolvedValue({ role: 'superuser', brokerId: 'b1' })
    resolveCrmSlugForAccess.mockResolvedValue('matt')
    await expect(getCrmAccess()).resolves.toEqual({
      email: 'matt@ryan-realty.com',
      role: 'superuser',
      brokerSlug: 'matt',
    })
    expect(resolveCrmSlugForAccess).toHaveBeenCalledWith({
      email: 'matt@ryan-realty.com',
      brokerId: 'b1',
    })
  })
})
