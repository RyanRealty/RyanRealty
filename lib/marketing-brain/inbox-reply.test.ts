import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * sendInboxReply's Gmail client must carry a per-request deadline
 * (MARKETING_INBOX_REQUEST_TIMEOUT_MS): app/api/cron/marketing-inbox-poll loops
 * over up to 50 messages inside its 60 s route, so one stalled send must fail
 * fast rather than hang the whole tick. A send Gmail never answered (no HTTP
 * status back) must read as "may have gone out", not a confirmed failure:
 * there is no second channel here to wrongly duplicate it onto, but the row
 * must not lie about what happened either.
 */

const h = vi.hoisted(() => ({
  send: vi.fn(),
  gmailCtor: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    gmail: (opts: unknown) => {
      h.gmailCtor(opts)
      return { users: { messages: { send: h.send } } }
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ update: () => ({ eq: h.eq }) }),
  }),
}))

import { sendInboxReply, MARKETING_INBOX_REQUEST_TIMEOUT_MS, type ReplyContext } from './inbox-reply'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FAKE_JWT = {} as any

const CTX: ReplyContext = {
  to_email: 'lead@example.com',
  to_name: 'Pat Lead',
  original_subject: 'Can you build me a flyer?',
  thread_id: 'thread-1',
  in_reply_to_message_id: '<abc@mail.gmail.com>',
  inbox_event_id: 'event-1',
  kind: { kind: 'unknown_triage', action_row_id: 'row-1', triage_reason: 'low confidence' },
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  h.eq.mockResolvedValue({ data: null, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('sendInboxReply', () => {
  it('builds the Gmail client with the per-request deadline', async () => {
    h.send.mockResolvedValue({ data: { id: 'msg-1' } })

    await sendInboxReply(FAKE_JWT, CTX)

    expect(h.gmailCtor).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v1', auth: FAKE_JWT, timeout: MARKETING_INBOX_REQUEST_TIMEOUT_MS }),
    )
  })

  it('reports a send Gmail never answered as unconfirmed, not a plain failure', async () => {
    // What gaxios throws when the request timed out or the connection dropped: no HTTP response.
    h.send.mockRejectedValue(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))

    const res = await sendInboxReply(FAKE_JWT, CTX)

    expect(res.status).toBe('failed')
    expect(res.error).toMatch(/did not confirm.*may have gone out.*check Sent/i)
  })

  it('reports a plain Gmail refusal without the unconfirmed wording', async () => {
    h.send.mockRejectedValue(Object.assign(new Error('Invalid To header'), { response: { status: 400 } }))

    const res = await sendInboxReply(FAKE_JWT, CTX)

    expect(res.status).toBe('failed')
    expect(res.error).toBe('Invalid To header')
  })
})
