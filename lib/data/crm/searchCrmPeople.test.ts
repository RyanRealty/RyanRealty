import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    throw new Error('supabase unavailable')
  },
}))

import { searchCrmPeople } from './searchCrmPeople'

afterEach(() => vi.clearAllMocks())

describe('searchCrmPeople', () => {
  it('returns an empty list instead of throwing when the read fails', async () => {
    await expect(searchCrmPeople({ q: null, brokerScope: null })).resolves.toEqual([])
  })
})
