import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateCmaRowFieldsBySlug = vi.fn()
vi.mock('@/lib/data', () => ({
  updateCmaRowFieldsBySlug: (...args: unknown[]) => updateCmaRowFieldsBySlug(...args),
}))

const getPersonForCmaKickoff = vi.fn()
vi.mock('@/lib/data/crm/cmaKickoff', () => ({
  getPersonForCmaKickoff: (...args: unknown[]) => getPersonForCmaKickoff(...args),
}))

import { resolveSendableClientEmail } from './send-client-email'

beforeEach(() => {
  updateCmaRowFieldsBySlug.mockReset().mockResolvedValue({ ok: true })
  getPersonForCmaKickoff.mockReset()
})

describe('resolveSendableClientEmail', () => {
  it('uses the column when it is already sendable', async () => {
    const email = await resolveSendableClientEmail({
      slug: 'cma-test',
      columnEmail: ' Owner@Example.com ',
      personId: 1,
    })
    expect(email).toBe('owner@example.com')
    expect(getPersonForCmaKickoff).not.toHaveBeenCalled()
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })

  it('persists the linked person primary email when the column is blank', async () => {
    getPersonForCmaKickoff.mockResolvedValue({ primaryEmail: 'Person@Example.com' })
    const email = await resolveSendableClientEmail({
      slug: 'cma-61404-skene',
      columnEmail: null,
      personId: '63986',
    })
    expect(email).toBe('person@example.com')
    expect(getPersonForCmaKickoff).toHaveBeenCalledWith(63986)
    expect(updateCmaRowFieldsBySlug).toHaveBeenCalledWith('cma-61404-skene', {
      client_email: 'person@example.com',
    })
  })

  it('returns null when neither the column nor the person has a sendable email', async () => {
    getPersonForCmaKickoff.mockResolvedValue({ primaryEmail: null })
    const email = await resolveSendableClientEmail({
      slug: 'cma-test',
      columnEmail: '',
      personId: 12,
    })
    expect(email).toBeNull()
    expect(updateCmaRowFieldsBySlug).not.toHaveBeenCalled()
  })
})
