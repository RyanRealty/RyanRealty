import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service client before importing the module under test so the writer
// picks up a fake upsert builder.
const mockUpsert = vi.fn()
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { insertEmailEvent, type EmailEventInsertRow } from './insertEmailEvent'

const row: EmailEventInsertRow = {
  message_id: 'm1',
  recipient_email: 'a@b.com',
  person_id: 7,
  broker: 'matthew-ryan',
  send_type: 'newsletter',
  event: 'open',
  email_key: null,
  subject: 'Hi',
  occurred_at: '2026-06-25T00:00:00.000Z',
  meta: {},
  dedupe_key: 'm1:open:a@b.com',
}

describe('insertEmailEvent', () => {
  beforeEach(() => {
    mockUpsert.mockReset()
    mockFrom.mockClear()
  })

  it('upserts with ignoreDuplicates on dedupe_key (the ON CONFLICT DO NOTHING path)', async () => {
    mockUpsert.mockResolvedValue({ count: 1, error: null })
    const res = await insertEmailEvent(row)
    expect(res).toEqual({ ok: true, inserted: true })
    expect(mockFrom).toHaveBeenCalledWith('email_events')
    expect(mockUpsert).toHaveBeenCalledWith(
      row,
      { onConflict: 'dedupe_key', ignoreDuplicates: true, count: 'exact' },
    )
  })

  it('reports inserted=false when the dedupe_key already existed (count 0)', async () => {
    mockUpsert.mockResolvedValue({ count: 0, error: null })
    expect(await insertEmailEvent(row)).toEqual({ ok: true, inserted: false })
  })

  it('returns a result flag on a DB error (never throws)', async () => {
    mockUpsert.mockResolvedValue({ count: null, error: { message: 'boom' } })
    expect(await insertEmailEvent(row)).toEqual({ ok: false, error: 'boom' })
  })

  it('swallows a thrown client error into a result flag', async () => {
    mockUpsert.mockRejectedValue(new Error('connection reset'))
    expect(await insertEmailEvent(row)).toEqual({ ok: false, error: 'connection reset' })
  })
})
