import { describe, it, expect, vi, beforeEach } from 'vitest'

const personIdsByEmailCi = vi.fn()
vi.mock('@/lib/data/crm/personByEmailCi', () => ({
  personIdsByEmailCi: (...a: unknown[]) => personIdsByEmailCi(...(a as [])),
}))

const mergePeopleCore = vi.fn()
vi.mock('@/lib/crm/merge-people', () => ({
  mergePeopleCore: (...a: unknown[]) => mergePeopleCore(...(a as [])),
}))

import { absorbGuestCaptureOnSignIn } from '@/lib/crm/absorb-guest-capture'

const NOW = Date.now()
const fresh = new Date(NOW - 5 * 60 * 1000).toISOString()
const stale = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()

function sbMock(handlers: {
  identityRow?: Record<string, unknown> | null
  guestRow?: Record<string, unknown> | null
  accountRow?: Record<string, unknown> | null
}) {
  return {
    from: (table: string) => {
      if (table === 'visitor_identity_map') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: handlers.identityRow ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'crm_people') {
        return {
          select: () => ({
            eq: (_col: string, id: number) => ({
              maybeSingle: async () => ({
                data: id === 77 ? (handlers.guestRow ?? null) : (handlers.accountRow ?? null),
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: () => ({}) }
    },
  } as never
}

const goodIdentity = {
  email: 'guest@x.com',
  crm_person_id: 77,
  identify_source: 'form_submit',
  identified_at: fresh,
}
const goodGuest = {
  id: 77,
  name: 'Guest Person',
  first_name: 'Guest',
  last_name: 'Person',
  emails: [{ value: 'guest@x.com' }],
  tags: ['source:idx-registration', 'audience:buyer'],
  custom: {},
  deleted: false,
  stage: 'Lead',
  created_at: fresh,
}
const goodAccount = { id: 42, deleted: false, stage: 'Lead' }
const goodInput = { rrVid: 'v_abc', accountEmail: 'account@y.com', accountPersonId: 42 }

describe('absorbGuestCaptureOnSignIn', () => {
  beforeEach(() => {
    personIdsByEmailCi.mockReset()
    mergePeopleCore.mockReset()
  })

  it('merges the fresh guest capture into the account person', async () => {
    personIdsByEmailCi.mockResolvedValue([77])
    mergePeopleCore.mockResolvedValue({ survivorId: 42, mergedId: 77 })
    const r = await absorbGuestCaptureOnSignIn(
      sbMock({ identityRow: goodIdentity, guestRow: goodGuest, accountRow: goodAccount }),
      goodInput,
    )
    expect(r).toEqual({ merged: true, survivorId: 42, mergedId: 77 })
    expect(mergePeopleCore).toHaveBeenCalledWith(expect.anything(), {
      survivorId: 42,
      mergedId: 77,
      mergedName: 'Guest Person',
      actor: { email: 'guest-save-absorb@system', brokerSlug: null },
    })
  })

  it('refuses without an rr_vid or account person', async () => {
    expect(await absorbGuestCaptureOnSignIn(sbMock({}), { ...goodInput, rrVid: null })).toEqual({
      merged: false,
      reason: 'no_rr_vid',
    })
    expect(
      await absorbGuestCaptureOnSignIn(sbMock({}), { ...goodInput, accountPersonId: null }),
    ).toEqual({ merged: false, reason: 'no_account_person' })
    expect(mergePeopleCore).not.toHaveBeenCalled()
  })

  it('refuses when the prior stitch is the same email (claim path owns it)', async () => {
    const r = await absorbGuestCaptureOnSignIn(
      sbMock({ identityRow: { ...goodIdentity, email: 'account@y.com' } }),
      goodInput,
    )
    expect(r).toEqual({ merged: false, reason: 'same_email' })
  })

  it('refuses a stale stitch and a non-form_submit stitch', async () => {
    expect(
      await absorbGuestCaptureOnSignIn(
        sbMock({ identityRow: { ...goodIdentity, identified_at: stale } }),
        goodInput,
      ),
    ).toEqual({ merged: false, reason: 'prior_stitch_stale' })
    expect(
      await absorbGuestCaptureOnSignIn(
        sbMock({ identityRow: { ...goodIdentity, identify_source: 'auth_oauth' } }),
        goodInput,
      ),
    ).toEqual({ merged: false, reason: 'prior_stitch_not_form_submit' })
  })

  it('refuses when the guest email maps to zero or many people', async () => {
    personIdsByEmailCi.mockResolvedValue([])
    expect(
      await absorbGuestCaptureOnSignIn(sbMock({ identityRow: goodIdentity }), goodInput),
    ).toEqual({ merged: false, reason: 'guest_email_not_unique:0' })
    personIdsByEmailCi.mockResolvedValue([77, 88])
    expect(
      await absorbGuestCaptureOnSignIn(sbMock({ identityRow: goodIdentity }), goodInput),
    ).toEqual({ merged: false, reason: 'guest_email_not_unique:2' })
  })

  it('refuses an aged guest row, extra emails, protected tags, missing idx tag', async () => {
    personIdsByEmailCi.mockResolvedValue([77])
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...goodGuest, created_at: stale }, 'guest_not_fresh'],
      [
        { ...goodGuest, emails: [{ value: 'guest@x.com' }, { value: 'other@z.com' }] },
        'guest_has_other_emails',
      ],
      [{ ...goodGuest, tags: ['source:idx-registration', 'contact:do-not-text'] }, 'guest_protected_tags'],
      [{ ...goodGuest, tags: ['audience:buyer'] }, 'guest_not_idx_capture'],
      [{ ...goodGuest, custom: { merged_into: 99 } }, 'guest_already_merged'],
      [{ ...goodGuest, deleted: true }, 'guest_deleted'],
    ]
    for (const [guestRow, reason] of cases) {
      const r = await absorbGuestCaptureOnSignIn(
        sbMock({ identityRow: goodIdentity, guestRow, accountRow: goodAccount }),
        goodInput,
      )
      expect(r).toEqual({ merged: false, reason })
    }
    expect(mergePeopleCore).not.toHaveBeenCalled()
  })

  it('refuses when the stitched person id disagrees with the email lookup', async () => {
    personIdsByEmailCi.mockResolvedValue([88])
    const r = await absorbGuestCaptureOnSignIn(
      sbMock({ identityRow: goodIdentity }),
      goodInput,
    )
    expect(r).toEqual({ merged: false, reason: 'stitched_person_mismatch' })
  })
})
