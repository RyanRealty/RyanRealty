import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * hardSkipQueuedFirstTouch after Send now.
 *
 * approveAndDeliverCma calls it after every successful Send now, to pull the
 * row out of the weekday drip. Send now now finalizes the owner's row itself
 * (status 'sent'), and this call must be a harmless no-op on that row: it only
 * ever matches status = 'queued'. Run against an in-memory table, so the filter
 * is exercised for real and not just asserted as a string.
 */

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  tables: {
    expired_listings: [] as Array<Record<string, unknown>>,
    fsbo_listings: [] as Array<Record<string, unknown>>,
  },
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from(table: 'expired_listings' | 'fsbo_listings') {
      let patch: Row = {}
      const eqs: Array<[string, unknown]> = []
      const q = {
        update(p: Row) {
          patch = p
          return q
        },
        eq(col: string, v: unknown) {
          eqs.push([col, v])
          return q
        },
        then(resolve: (v: { error: null }) => unknown, reject: (e: unknown) => unknown) {
          for (const row of h.tables[table]) {
            if (eqs.every(([c, v]) => row[c] === v)) Object.assign(row, patch)
          }
          return Promise.resolve({ error: null }).then(resolve, reject)
        },
      }
      return q
    },
  }),
}))

import { hardSkipQueuedFirstTouch } from '@/lib/data/prospecting/drip-queue'

const QUEUED_AT = '2026-09-28T15:00:00.000Z'

beforeEach(() => {
  h.tables.expired_listings = []
  h.tables.fsbo_listings = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('hardSkipQueuedFirstTouch', () => {
  it('is a no-op on a row Send now already finalized (status sent), queued_at and all', async () => {
    h.tables.expired_listings = [
      {
        listing_key: 'LK-SENT',
        outreach_email_status: 'sent',
        outreach_email_queued_at: QUEUED_AT,
        outreach_email_sent_at: '2026-09-29T17:00:00.000Z',
        outreach_email_message_id: 'msg-1',
      },
    ]
    await hardSkipQueuedFirstTouch('expired', 'LK-SENT', 'manual-send-now')
    expect(h.tables.expired_listings[0]).toEqual({
      listing_key: 'LK-SENT',
      outreach_email_status: 'sent',
      outreach_email_queued_at: QUEUED_AT,
      outreach_email_sent_at: '2026-09-29T17:00:00.000Z',
      outreach_email_message_id: 'msg-1',
    })
  })

  it('leaves a row mid-send (status sending) alone', async () => {
    h.tables.expired_listings = [
      { listing_key: 'LK-SENDING', outreach_email_status: 'sending', outreach_email_queued_at: QUEUED_AT },
    ]
    await hardSkipQueuedFirstTouch('expired', 'LK-SENDING', 'manual-send-now')
    expect(h.tables.expired_listings[0]).toMatchObject({
      outreach_email_status: 'sending',
      outreach_email_queued_at: QUEUED_AT,
    })
  })

  it('still dequeues a row that is genuinely queued (the live-status hard skip)', async () => {
    h.tables.expired_listings = [
      { listing_key: 'LK-Q', outreach_email_status: 'queued', outreach_email_queued_at: QUEUED_AT },
      { listing_key: 'LK-OTHER', outreach_email_status: 'queued', outreach_email_queued_at: QUEUED_AT },
    ]
    await hardSkipQueuedFirstTouch('expired', 'LK-Q', 'relisted')
    expect(h.tables.expired_listings[0]).toMatchObject({ outreach_email_status: null, outreach_email_queued_at: null })
    expect(h.tables.expired_listings[1]).toMatchObject({ outreach_email_status: 'queued' })
  })

  it('is the same for an FSBO row, keyed on fsbo_url', async () => {
    h.tables.fsbo_listings = [
      { fsbo_url: 'https://fsbo.example.com/1', outreach_email_status: 'sent', outreach_email_queued_at: QUEUED_AT },
      { fsbo_url: 'https://fsbo.example.com/2', outreach_email_status: 'queued', outreach_email_queued_at: QUEUED_AT },
    ]
    await hardSkipQueuedFirstTouch('fsbo', 'https://fsbo.example.com/1', 'manual-send-now')
    await hardSkipQueuedFirstTouch('fsbo', 'https://fsbo.example.com/2', 'manual-send-now')
    expect(h.tables.fsbo_listings[0]).toMatchObject({ outreach_email_status: 'sent', outreach_email_queued_at: QUEUED_AT })
    expect(h.tables.fsbo_listings[1]).toMatchObject({ outreach_email_status: null, outreach_email_queued_at: null })
  })
})
