/**
 * Consumer alert-preference action tests (app/actions/alert-preferences.ts):
 * authz chokepoint (anon vs owner vs another user's row), schedule_days
 * validation bounds, and the recipients add/remove round-trip — all against a
 * mocked DAL, so these lock the ACTION contract, not Supabase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Session double: null = anon; otherwise the signed-in user.
let session: { user: { id: string; email: string } } | null = null
vi.mock('@/app/actions/auth', () => ({
  getSession: () => Promise.resolve(session),
}))

// DAL double. getListingAlertForUser is the owner-checked read (null for a row
// the caller does not own); the two writes record their arguments.
const getListingAlertForUser = vi.fn()
const updateListingAlertEventSettingsForUser = vi.fn()
const updateListingAlertRecipientsForUser = vi.fn()
vi.mock('@/lib/data/leads/listingAlerts', () => ({
  getListingAlertForUser: (...args: unknown[]) => getListingAlertForUser(...args),
  updateListingAlertEventSettingsForUser: (...args: unknown[]) =>
    updateListingAlertEventSettingsForUser(...args),
  updateListingAlertRecipientsForUser: (...args: unknown[]) =>
    updateListingAlertRecipientsForUser(...args),
}))

import {
  setAlertEventsAction,
  setAlertScheduleDaysAction,
  addAlertRecipientAction,
  removeAlertRecipientAction,
} from '@/app/actions/alert-preferences'

const OWNER = { user: { id: 'user-1', email: 'owner@example.com' } }
const ALL_ON = {
  new: true,
  price_change: true,
  status_change: true,
  back_on_market: true,
  sold: true,
  open_house: true,
}

function ownedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    user_id: 'user-1',
    email: 'owner@example.com',
    recipients: null,
    ...overrides,
  }
}

beforeEach(() => {
  session = { ...OWNER }
  getListingAlertForUser.mockReset().mockResolvedValue(ownedRow())
  updateListingAlertEventSettingsForUser.mockReset().mockResolvedValue({ ok: true })
  updateListingAlertRecipientsForUser.mockReset().mockResolvedValue({ ok: true })
})

describe('authz', () => {
  it('anon: every action refuses before touching the DAL', async () => {
    session = null
    expect((await setAlertEventsAction('alert-1', ALL_ON)).error).toBe('Not signed in')
    expect((await setAlertScheduleDaysAction('alert-1', [1])).error).toBe('Not signed in')
    expect((await addAlertRecipientAction('alert-1', 'kid@example.com')).error).toBe('Not signed in')
    expect((await removeAlertRecipientAction('alert-1', 'kid@example.com')).error).toBe('Not signed in')
    expect(updateListingAlertEventSettingsForUser).not.toHaveBeenCalled()
    expect(updateListingAlertRecipientsForUser).not.toHaveBeenCalled()
    expect(getListingAlertForUser).not.toHaveBeenCalled()
  })

  it('owner: writes carry BOTH the row id AND the session user id', async () => {
    const result = await setAlertEventsAction('alert-1', ALL_ON)
    expect(result.error).toBeNull()
    expect(updateListingAlertEventSettingsForUser).toHaveBeenCalledWith('alert-1', 'user-1', {
      events: ALL_ON,
    })
  })

  it("another user's row: the owner-checked read returns null and nothing is written", async () => {
    session = { user: { id: 'user-2', email: 'other@example.com' } }
    getListingAlertForUser.mockResolvedValue(null) // DAL scopes by user_id
    const result = await addAlertRecipientAction('alert-1', 'kid@example.com')
    expect(result.error).toBe('Search not found')
    expect(getListingAlertForUser).toHaveBeenCalledWith('alert-1', 'user-2')
    expect(updateListingAlertRecipientsForUser).not.toHaveBeenCalled()
  })

  it('event toggles reject a payload with unknown or non-boolean keys', async () => {
    expect((await setAlertEventsAction('alert-1', { ...ALL_ON, bogus: true })).error).toBeTruthy()
    expect((await setAlertEventsAction('alert-1', { ...ALL_ON, sold: 'yes' })).error).toBeTruthy()
    expect((await setAlertEventsAction('alert-1', { new: true })).error).toBeTruthy() // partial map
    expect(updateListingAlertEventSettingsForUser).not.toHaveBeenCalled()
  })
})

describe('schedule_days validation', () => {
  it('accepts in-bounds days, deduped and sorted', async () => {
    const result = await setAlertScheduleDaysAction('alert-1', [6, 1, 1, 0])
    expect(result.error).toBeNull()
    expect(updateListingAlertEventSettingsForUser).toHaveBeenCalledWith('alert-1', 'user-1', {
      scheduleDays: [0, 1, 6],
    })
  })

  it('an empty selection clears the restriction (null)', async () => {
    const result = await setAlertScheduleDaysAction('alert-1', [])
    expect(result.error).toBeNull()
    expect(updateListingAlertEventSettingsForUser).toHaveBeenCalledWith('alert-1', 'user-1', {
      scheduleDays: null,
    })
  })

  it.each([[[7]], [[-1]], [[1.5]], [['1']], ['monday'], [[0, 1, 2, 3, 4, 5, 6, 0]]])(
    'rejects out-of-bounds or malformed input %j',
    async (bad) => {
      const result = await setAlertScheduleDaysAction('alert-1', bad)
      expect(result.error).toBe('Pick valid days of the week.')
      expect(updateListingAlertEventSettingsForUser).not.toHaveBeenCalled()
    },
  )
})

describe('recipients round-trip', () => {
  it('add: appends a normalized entry born with its own unsubscribe token', async () => {
    const result = await addAlertRecipientAction('alert-1', '  Kid@Example.COM ')
    expect(result.error).toBeNull()
    const [id, userId, recipients] = updateListingAlertRecipientsForUser.mock.calls[0]
    expect(id).toBe('alert-1')
    expect(userId).toBe('user-1')
    expect(recipients).toHaveLength(1)
    expect(recipients[0].email).toBe('kid@example.com')
    expect(recipients[0].name).toBeNull()
    expect(recipients[0].unsubscribe_token).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('add then remove restores an empty (null) recipients array', async () => {
    // Round trip: the row now holds the entry the add wrote.
    getListingAlertForUser.mockResolvedValue(
      ownedRow({ recipients: [{ email: 'kid@example.com', name: null, unsubscribe_token: 't-1' }] }),
    )
    const result = await removeAlertRecipientAction('alert-1', 'kid@example.com')
    expect(result.error).toBeNull()
    expect(updateListingAlertRecipientsForUser).toHaveBeenCalledWith('alert-1', 'user-1', null)
  })

  it('remove keeps the other household entries', async () => {
    getListingAlertForUser.mockResolvedValue(
      ownedRow({
        recipients: [
          { email: 'a@example.com', name: null, unsubscribe_token: 't-a' },
          { email: 'b@example.com', name: 'B', unsubscribe_token: 't-b' },
        ],
      }),
    )
    const result = await removeAlertRecipientAction('alert-1', 'a@example.com')
    expect(result.error).toBeNull()
    expect(updateListingAlertRecipientsForUser).toHaveBeenCalledWith('alert-1', 'user-1', [
      { email: 'b@example.com', name: 'B', unsubscribe_token: 't-b' },
    ])
  })

  it('rejects an invalid email before any read or write', async () => {
    const result = await addAlertRecipientAction('alert-1', 'not-an-email')
    expect(result.error).toBe('Enter a valid email address.')
    expect(getListingAlertForUser).not.toHaveBeenCalled()
  })

  it('rejects a duplicate of the primary or an existing recipient', async () => {
    getListingAlertForUser.mockResolvedValue(
      ownedRow({ recipients: [{ email: 'kid@example.com', name: null, unsubscribe_token: 't' }] }),
    )
    expect((await addAlertRecipientAction('alert-1', 'owner@example.com')).error).toBe(
      'That address already gets this alert.',
    )
    expect((await addAlertRecipientAction('alert-1', 'KID@example.com')).error).toBe(
      'That address already gets this alert.',
    )
    expect(updateListingAlertRecipientsForUser).not.toHaveBeenCalled()
  })

  it('caps household recipients at 5', async () => {
    getListingAlertForUser.mockResolvedValue(
      ownedRow({
        recipients: Array.from({ length: 5 }, (_, i) => ({
          email: `r${i}@example.com`,
          name: null,
          unsubscribe_token: `t-${i}`,
        })),
      }),
    )
    const result = await addAlertRecipientAction('alert-1', 'one-more@example.com')
    expect(result.error).toBe('You can share this alert with up to 5 people.')
    expect(updateListingAlertRecipientsForUser).not.toHaveBeenCalled()
  })

  it('removing an unknown recipient reports it without writing', async () => {
    const result = await removeAlertRecipientAction('alert-1', 'ghost@example.com')
    expect(result.error).toBe('Recipient not found')
    expect(updateListingAlertRecipientsForUser).not.toHaveBeenCalled()
  })
})
