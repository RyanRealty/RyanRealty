import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const cookiesGet = vi.fn()
const lookupSarahAssignedBroker = vi.fn()

vi.mock('@/app/actions/auth', () => ({
  getSession: (...a: unknown[]) => getSession(...a),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookiesGet }),
}))
vi.mock('@/lib/data/sarah/desk-broker', () => ({
  lookupSarahAssignedBroker: (...a: unknown[]) => lookupSarahAssignedBroker(...a),
}))

describe('getSarahDeskBroker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSession.mockResolvedValue(null)
    cookiesGet.mockReturnValue(undefined)
    lookupSarahAssignedBroker.mockResolvedValue(null)
  })

  it('returns Matt when the visitor is unknown', async () => {
    const { getSarahDeskBroker } = await import('./sarah-desk')
    const got = await getSarahDeskBroker()
    expect(got.error).toBeNull()
    expect(got.data.slug).toBe('matt')
    expect(got.data.firstName).toBe('Matt')
    expect(lookupSarahAssignedBroker).toHaveBeenCalledWith({
      authEmail: null,
      authUserId: null,
      rrVid: null,
    })
  })

  it('returns the assigned broker for a logged-in person', async () => {
    getSession.mockResolvedValue({ user: { id: 'auth-1', email: 'lead@example.com' } })
    lookupSarahAssignedBroker.mockResolvedValue('rebecca')
    const { getSarahDeskBroker } = await import('./sarah-desk')
    const got = await getSarahDeskBroker()
    expect(got.data.slug).toBe('rebecca')
    expect(got.data.firstName).toBe('Rebecca')
    expect(lookupSarahAssignedBroker).toHaveBeenCalledWith({
      authEmail: 'lead@example.com',
      authUserId: 'auth-1',
      rrVid: null,
    })
  })

  it('passes rr_vid for an identified browser and still falls back to Matt on a blank assignment', async () => {
    cookiesGet.mockImplementation((name: string) => (name === 'rr_vid' ? { value: 'vid-9' } : undefined))
    lookupSarahAssignedBroker.mockResolvedValue(null)
    const { getSarahDeskBroker } = await import('./sarah-desk')
    const got = await getSarahDeskBroker()
    expect(lookupSarahAssignedBroker).toHaveBeenCalledWith({
      authEmail: null,
      authUserId: null,
      rrVid: 'vid-9',
    })
    expect(got.data.slug).toBe('matt')
  })
})
