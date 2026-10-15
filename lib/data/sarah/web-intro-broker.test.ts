import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupSarahWebIntroBroker } from './web-intro-broker'

const from = vi.fn()
vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({ from }),
}))
vi.mock('@/lib/data/crm/personByEmailCi', () => ({
  personIdsByEmailCi: vi.fn(),
}))

import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'

function query(data: unknown) {
  const self: Record<string, unknown> = {}
  const next = () => self
  self.select = next
  self.eq = next
  self.in = next
  self.not = next
  self.limit = next
  self.maybeSingle = async () => ({ data, error: null })
  return self
}

describe('lookupSarahWebIntroBroker', () => {
  beforeEach(() => {
    from.mockReset()
    vi.mocked(personIdsByEmailCi).mockReset()
  })

  it('uses the session email person and does not fall through to identity map', async () => {
    vi.mocked(personIdsByEmailCi).mockResolvedValue([41])
    from.mockImplementation((table: string) => {
      if (table === 'crm_people') return query({ assigned_broker: 'rebecca' })
      throw new Error(`unexpected table ${table}`)
    })
    await expect(
      lookupSarahWebIntroBroker({
        authEmail: 'lead@example.com',
        authUserId: 'user-1',
        rrVid: 'vid-1',
      }),
    ).resolves.toBe('rebecca')
    expect(from).not.toHaveBeenCalledWith('visitor_identity_map')
  })

  it('returns null when the person has a blank assignment', async () => {
    vi.mocked(personIdsByEmailCi).mockResolvedValue([41])
    from.mockImplementation((table: string) => {
      if (table === 'crm_people') return query({ assigned_broker: null })
      throw new Error(`unexpected table ${table}`)
    })
    await expect(lookupSarahWebIntroBroker({ authEmail: 'lead@example.com' })).resolves.toBeNull()
  })

  it('reads assigned_broker from the identity-map person for an rr_vid', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'visitor_identity_map') return query({ crm_person_id: 88 })
      if (table === 'crm_people') return query({ assigned_broker: 'paul' })
      throw new Error(`unexpected table ${table}`)
    })
    await expect(lookupSarahWebIntroBroker({ rrVid: 'vid-88' })).resolves.toBe('paul')
  })
})
