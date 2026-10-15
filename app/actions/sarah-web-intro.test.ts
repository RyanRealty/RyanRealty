import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(async () => null),
}))
vi.mock('@/lib/data/sarah/web-intro-broker', () => ({
  lookupSarahWebIntroBroker: vi.fn(),
}))

import { getSession } from '@/app/actions/auth'
import { lookupSarahWebIntroBroker } from '@/lib/data/sarah/web-intro-broker'
import { getSarahWebIntroBrokerFirstName } from './sarah-web-intro'

describe('getSarahWebIntroBrokerFirstName', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(lookupSarahWebIntroBroker).mockReset()
  })

  it('falls back to Matt when lookup returns null', async () => {
    vi.mocked(lookupSarahWebIntroBroker).mockResolvedValue(null)
    await expect(getSarahWebIntroBrokerFirstName()).resolves.toEqual({ data: 'Matt', error: null })
  })

  it('returns Rebecca when the CRM assignment is rebecca', async () => {
    vi.mocked(lookupSarahWebIntroBroker).mockResolvedValue('rebecca')
    await expect(getSarahWebIntroBrokerFirstName()).resolves.toEqual({ data: 'Rebecca', error: null })
  })

  it('returns Matt when lookup throws', async () => {
    vi.mocked(lookupSarahWebIntroBroker).mockRejectedValue(new Error('db down'))
    await expect(getSarahWebIntroBrokerFirstName()).resolves.toEqual({ data: 'Matt', error: null })
  })
})
