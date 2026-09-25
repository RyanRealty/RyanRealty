import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every Gmail call in lib/gmail-draft.ts ends on a deadline, and a send Gmail
 * never confirmed is reported as unconfirmed, not failed: the callers' Resend
 * fallback would otherwise deliver it a second time.
 *
 * This runs the REAL googleapis / google-auth-library / gaxios stack with only
 * the network swapped for a fake fetch, so nothing leaves the process and no
 * mail is sent. Real on purpose: the fix leans on library behavior a hand mock
 * would only restate. The token request takes the JWT's transporter timeout, a
 * timed-out send carries no HTTP response, and gaxios never re-sends a POST.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const net = vi.hoisted(() => ({
  respond: null as null | ((url: string, init: RequestInit | undefined) => Promise<Response>),
  calls: [] as Array<{ url: string; method: string }>,
  /** Requests the library aborted (its own timeout fired). */
  dropped: 0,
}))

vi.mock('googleapis', async (importOriginal) => {
  const real = await importOriginal<typeof import('googleapis')>()
  const fetchImplementation: typeof fetch = async (url, init) => {
    const href = String(url)
    net.calls.push({ url: href, method: (init?.method ?? 'GET').toUpperCase() })
    if (!net.respond) throw new Error(`no network in unit tests: ${href}`)
    return net.respond(href, init)
  }
  const RealJWT = real.google.auth.JWT
  class OfflineJWT extends RealJWT {
    constructor(opts: ConstructorParameters<typeof RealJWT>[0] = {}) {
      super({ ...opts, transporterOptions: { ...opts.transporterOptions, fetchImplementation } })
    }
  }
  const auth = Object.assign(Object.create(real.google.auth), { JWT: OfflineJWT })
  return { ...real, google: Object.assign(Object.create(real.google), { auth }) }
})

vi.mock('@/lib/email/auto-track', () => ({
  instrumentLeadHtml: vi.fn(async (html: string) => html),
}))

import { createGmailDraft, GMAIL_AUTH_TIMEOUT_MS, GMAIL_REQUEST_TIMEOUT_MS, sendGmailMessage } from '@/lib/gmail-draft'
import { instrumentLeadHtml } from '@/lib/email/auto-track'

const MESSAGE = {
  to: 'lead@example.com',
  subject: 'Your home value for 123 Main St',
  bodyHtml: '<p>Hello</p>',
  bodyText: 'Hello',
  impersonateAs: 'matt@ryan-realty.com',
  attachments: [{ filename: 'cma.pdf', content: Buffer.from('%PDF-1.7'), mimeType: 'application/pdf' }],
}

function json(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  )
}

const tokenOk = () => json(200, { access_token: 'ya29.test', expires_in: 3600, token_type: 'Bearer' })

/** A request nobody answers. It rejects the way node-fetch does once gaxios aborts it. */
function hang(init: RequestInit | undefined, started: () => void): Promise<Response> {
  started()
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => {
      net.dropped += 1
      const e = new Error('The operation was aborted.')
      e.name = 'AbortError'
      reject(e)
    })
  })
}

function latch() {
  let open!: () => void
  const opened = new Promise<void>((resolve) => (open = resolve))
  return { open, opened }
}

/** Watch a promise without awaiting it, so a test can ask "settled yet?" between clock steps. */
function watch<T>(p: Promise<T>) {
  const s: { settled: boolean; value?: T } = { settled: false }
  void p.then((value) => Object.assign(s, { settled: true, value }))
  return s
}

const calls = (fragment: string) => net.calls.filter((c) => c.url.includes(fragment))

let abortTimeouts: ReturnType<typeof vi.spyOn>

beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL', 'viewer@ryanrealty.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', privateKey)
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  // gaxios turns a request timeout into AbortSignal.timeout, whose timer the
  // fake clock cannot reach. Rebuild it on the faked setTimeout.
  abortTimeouts = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    const c = new AbortController()
    setTimeout(() => c.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms)
    return c.signal
  })
})

afterEach(() => {
  vi.useRealTimers()
  abortTimeouts.mockRestore()
  vi.mocked(instrumentLeadHtml).mockClear()
  net.respond = null
  net.calls.length = 0
  net.dropped = 0
})

describe('sendGmailMessage', () => {
  it('sends once and returns the Gmail ids, leaving no deadline timer behind', async () => {
    net.respond = (url) =>
      url.startsWith(TOKEN_URL) ? tokenOk() : json(200, { id: 'msg-1', threadId: 'thr-1' })

    const res = await sendGmailMessage(MESSAGE)

    expect(res).toEqual({ ok: true, messageId: 'msg-1', threadId: 'thr-1' })
    expect(calls(TOKEN_URL)).toHaveLength(1)
    expect(calls('/gmail/v1/users/me/messages/send')).toEqual([
      expect.objectContaining({ method: 'POST' }),
    ])
    // Each request's own AbortSignal.timeout timer is the library's (unref'd in
    // Node). Nothing else may still be ticking: the auth deadline was cleared.
    expect(vi.getTimerCount()).toBe(abortTimeouts.mock.calls.length)
  })

  it('gives up on a stalled token exchange at GMAIL_AUTH_TIMEOUT_MS, a plain failure the caller may fall back from', async () => {
    const tokenAsked = latch()
    net.respond = (url, init) => {
      if (url.startsWith(TOKEN_URL)) return hang(init, tokenAsked.open)
      throw new Error(`nothing but the token request should go out: ${url}`)
    }

    const res = watch(sendGmailMessage(MESSAGE))
    await tokenAsked.opened
    await vi.advanceTimersByTimeAsync(GMAIL_AUTH_TIMEOUT_MS - 1)
    expect(res.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(res.settled).toBe(true)
    expect(res.value).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/i) })
    expect(res.value?.unconfirmed).toBeFalsy()
    expect(calls('/messages/send')).toHaveLength(0)
    // The stalled token request itself was dropped, not left open.
    expect(net.dropped).toBe(1)
  })

  it('reports a send Gmail never answered as unconfirmed, and never sends it twice', async () => {
    const sendLeft = latch()
    net.respond = (url, init) => (url.startsWith(TOKEN_URL) ? tokenOk() : hang(init, sendLeft.open))

    const res = watch(sendGmailMessage(MESSAGE))
    await sendLeft.opened
    await vi.advanceTimersByTimeAsync(GMAIL_REQUEST_TIMEOUT_MS - 1)
    expect(res.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(res.settled).toBe(true)
    expect(res.value).toMatchObject({
      ok: false,
      unconfirmed: true,
      error: expect.stringMatching(/may have gone out.*Sent/i),
    })
    expect(calls('/messages/send')).toHaveLength(1)
  })

  it('reports a send Gmail refused as a plain failure, without a retry', async () => {
    net.respond = (url) =>
      url.startsWith(TOKEN_URL)
        ? tokenOk()
        : json(503, { error: { code: 503, message: 'Backend Error', status: 'UNAVAILABLE' } })

    const res = await sendGmailMessage(MESSAGE)

    expect(res).toMatchObject({ ok: false, error: 'Backend Error' })
    expect(res.unconfirmed).toBeFalsy()
    expect(calls('/messages/send')).toHaveLength(1)
  })

  it('keeps the scope hint when Gmail answers 403', async () => {
    net.respond = (url) =>
      url.startsWith(TOKEN_URL)
        ? tokenOk()
        : json(403, { error: { code: 403, message: 'Request had insufficient authentication scopes.' } })

    const res = await sendGmailMessage(MESSAGE)

    expect(res).toMatchObject({ ok: false, hint: expect.stringContaining('gmail.send') })
    expect(res.unconfirmed).toBeFalsy()
  })

  it('reports a failure while building the message as a plain failure, before anything is sent', async () => {
    vi.mocked(instrumentLeadHtml).mockRejectedValueOnce(new Error('tracking lookup failed'))
    net.respond = (url) => (url.startsWith(TOKEN_URL) ? tokenOk() : json(200, { id: 'msg-1' }))

    const res = await sendGmailMessage(MESSAGE)

    expect(res).toMatchObject({ ok: false, error: 'tracking lookup failed' })
    expect(res.unconfirmed).toBeFalsy()
    expect(calls('/messages/send')).toHaveLength(0)
  })
})

describe('createGmailDraft', () => {
  it('creates the draft and returns its ids', async () => {
    net.respond = (url) =>
      url.startsWith(TOKEN_URL) ? tokenOk() : json(200, { id: 'draft-1', message: { id: 'msg-1' } })

    const res = await createGmailDraft(MESSAGE)

    expect(res).toEqual({ ok: true, draftId: 'draft-1', messageId: 'msg-1' })
    expect(calls('/gmail/v1/users/me/drafts')).toHaveLength(1)
  })

  it('gives up on a stalled token exchange at GMAIL_AUTH_TIMEOUT_MS', async () => {
    const tokenAsked = latch()
    net.respond = (url, init) => {
      if (url.startsWith(TOKEN_URL)) return hang(init, tokenAsked.open)
      throw new Error(`nothing but the token request should go out: ${url}`)
    }

    const res = watch(createGmailDraft(MESSAGE))
    await tokenAsked.opened
    await vi.advanceTimersByTimeAsync(GMAIL_AUTH_TIMEOUT_MS)

    expect(res.settled).toBe(true)
    expect(res.value).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/i) })
  })

  it('gives up on a stalled drafts.create at GMAIL_REQUEST_TIMEOUT_MS', async () => {
    const draftLeft = latch()
    net.respond = (url, init) => (url.startsWith(TOKEN_URL) ? tokenOk() : hang(init, draftLeft.open))

    const res = watch(createGmailDraft(MESSAGE))
    await draftLeft.opened
    await vi.advanceTimersByTimeAsync(GMAIL_REQUEST_TIMEOUT_MS - 1)
    expect(res.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(res.settled).toBe(true)
    expect(res.value).toMatchObject({ ok: false })
  })
})
