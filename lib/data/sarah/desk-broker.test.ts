import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({ from, rpc }),
}))

function personQuery(row: { assigned_broker: string | null } | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error: null }),
      }),
    }),
  }
}

function mapQuery(row: { crm_person_id: number | null } | null) {
  const maybeSingle = async () => ({ data: row, error: null })
  return {
    select: () => ({
      eq: () => ({
        not: () => ({
          limit: () => ({ maybeSingle }),
        }),
        maybeSingle,
      }),
    }),
  }
}

describe('lookupSarahAssignedBroker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    rpc.mockResolvedValue({ data: [], error: null })
    from.mockImplementation((table: string) => {
      if (table === 'crm_people') return personQuery(null)
      if (table === 'visitor_identity_map') return mapQuery(null)
      throw new Error(table)
    })
  })

  it('returns the assignment for a signed-in email match', async () => {
    rpc.mockResolvedValue({ data: [41], error: null })
    from.mockImplementation((table: string) => {
      if (table === 'crm_people') return personQuery({ assigned_broker: 'rebecca' })
      if (table === 'visitor_identity_map') return mapQuery({ crm_person_id: 99 })
      throw new Error(table)
    })
    const { lookupSarahAssignedBroker } = await import('./desk-broker')
    await expect(
      lookupSarahAssignedBroker({ authEmail: 'lead@example.com', rrVid: 'vid-other' }),
    ).resolves.toBe('rebecca')
    expect(from).not.toHaveBeenCalledWith('visitor_identity_map')
  })

  it('returns null when the person exists but has no assigned broker', async () => {
    rpc.mockResolvedValue({ data: [41], error: null })
    from.mockImplementation((table: string) => {
      if (table === 'crm_people') return personQuery({ assigned_broker: null })
      throw new Error(table)
    })
    const { lookupSarahAssignedBroker } = await import('./desk-broker')
    await expect(
      lookupSarahAssignedBroker({ authEmail: 'lead@example.com' }),
    ).resolves.toBeNull()
  })

  it('returns null so the caller falls back to Matt when nobody is identified', async () => {
    const { lookupSarahAssignedBroker } = await import('./desk-broker')
    await expect(lookupSarahAssignedBroker({ rrVid: 'anon' })).resolves.toBeNull()
  })

  it('reads assigned_broker from the identity-map person for an rr_vid', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'visitor_identity_map') return mapQuery({ crm_person_id: 7 })
      if (table === 'crm_people') return personQuery({ assigned_broker: 'paul' })
      throw new Error(table)
    })
    const { lookupSarahAssignedBroker } = await import('./desk-broker')
    await expect(lookupSarahAssignedBroker({ rrVid: 'vid-7' })).resolves.toBe('paul')
  })
})
