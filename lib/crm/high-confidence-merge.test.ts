import { describe, it, expect, vi, beforeEach } from 'vitest'

const personIdsByEmailCi = vi.fn()
vi.mock('@/lib/data/crm/personByEmailCi', () => ({
  personIdsByEmailCi: (...a: unknown[]) => personIdsByEmailCi(...(a as [])),
}))

const mergePeopleCore = vi.fn()
vi.mock('@/lib/crm/merge-people', () => ({
  mergePeopleCore: (...a: unknown[]) => mergePeopleCore(...(a as [])),
}))

import { maybeAutoMergeEmailPhoneConflict } from '@/lib/crm/high-confidence-merge'

function sbMock(handlers: {
  contactPoints?: Array<{ person_id: number }>
  people?: Array<Record<string, unknown>>
}) {
  return {
    from: (table: string) => {
      if (table === 'crm_contact_points') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: handlers.contactPoints ?? [], error: null }),
            }),
          }),
        }
      }
      if (table === 'crm_people') {
        return {
          select: () => ({
            in: async () => ({ data: handlers.people ?? [], error: null }),
            eq: () => ({
              filter: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return { select: () => ({}) }
    },
  } as never
}

describe('maybeAutoMergeEmailPhoneConflict', () => {
  beforeEach(() => {
    personIdsByEmailCi.mockReset()
    mergePeopleCore.mockReset()
  })

  it('refuses without both email and phone', async () => {
    const r = await maybeAutoMergeEmailPhoneConflict(sbMock({}), { email: 'a@b.com' })
    expect(r).toEqual({ merged: false, reason: 'need_both_email_and_phone' })
  })

  it('merges when email and phone uniquely map to different clean people', async () => {
    personIdsByEmailCi.mockResolvedValue([10])
    mergePeopleCore.mockResolvedValue({})
    const r = await maybeAutoMergeEmailPhoneConflict(
      sbMock({
        contactPoints: [{ person_id: 20 }],
        people: [
          { id: 10, deleted: false, stage: 'Lead', tags: [], custom: {}, assigned_broker: 'matt' },
          { id: 20, deleted: false, stage: 'Lead', tags: [], custom: {}, assigned_broker: 'matt' },
        ],
      }),
      { email: 'a@b.com', phone: '5415551212' },
    )
    expect(r).toEqual({ merged: true, survivorId: 10, mergedId: 20 })
    expect(mergePeopleCore).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        survivorId: 10,
        mergedId: 20,
        actor: expect.objectContaining({ email: 'system:high-confidence-merge' }),
      }),
    )
  })

  it('refuses when a person has hard-stop', async () => {
    personIdsByEmailCi.mockResolvedValue([10])
    const r = await maybeAutoMergeEmailPhoneConflict(
      sbMock({
        contactPoints: [{ person_id: 20 }],
        people: [
          { id: 10, deleted: false, stage: 'Lead', tags: ['compliance:hard-stop'], custom: {}, assigned_broker: 'matt' },
          { id: 20, deleted: false, stage: 'Lead', tags: [], custom: {}, assigned_broker: 'matt' },
        ],
      }),
      { email: 'a@b.com', phone: '5415551212' },
    )
    expect(r.merged).toBe(false)
    expect(mergePeopleCore).not.toHaveBeenCalled()
  })
})
