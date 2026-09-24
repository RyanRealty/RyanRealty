import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getGmailFor hands back a client whose service-account token is fetched lazily,
 * inside the first Gmail call and before that call's own timeout starts. That
 * token exchange needs a deadline of its own, or a stalled token endpoint hangs
 * the call (and the cron around it) for good.
 *
 * Runs the REAL googleapis / google-auth-library / gaxios stack with only the
 * network swapped for a fake fetch, so nothing leaves the process. A hand mock
 * could not show where the library applies which timeout.
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

import { getGmailFor, GMAIL_TIMEOUT_MS } from '@/lib/crm/gmail'
import { GMAIL_AUTH_TIMEOUT_MS } from '@/lib/gmail-draft'

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']

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
function watch(p: Promise<unknown>) {
  const s: { settled: boolean; error?: unknown } = { settled: false }
  void p.then(
    () => (s.settled = true),
    (error: unknown) => Object.assign(s, { settled: true, error }),
  )
  return s
}

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
  net.respond = null
  net.calls.length = 0
  net.dropped = 0
})

describe('getGmailFor', () => {
  it('fails a Gmail call whose token exchange stalls, at GMAIL_AUTH_TIMEOUT_MS, instead of hanging it', async () => {
    const tokenAsked = latch()
    net.respond = (url, init) => {
      if (url.startsWith(TOKEN_URL)) return hang(init, tokenAsked.open)
      throw new Error(`nothing but the token request should go out: ${url}`)
    }

    const call = watch(getGmailFor('matt@ryan-realty.com', READONLY)!.users.labels.list({ userId: 'me' }))
    await tokenAsked.opened
    await vi.advanceTimersByTimeAsync(GMAIL_AUTH_TIMEOUT_MS - 1)
    expect(call.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(call.settled).toBe(true)
    expect(call.error).toBeInstanceOf(Error)
    expect(net.dropped).toBe(1)
    expect(net.calls.filter((c) => c.url.includes('/gmail/v1/'))).toHaveLength(0)
  })

  it('leaves every Gmail request its own GMAIL_TIMEOUT_MS deadline', async () => {
    const listLeft = latch()
    net.respond = (url, init) => (url.startsWith(TOKEN_URL) ? tokenOk() : hang(init, listLeft.open))

    const call = watch(getGmailFor('matt@ryan-realty.com', READONLY)!.users.labels.list({ userId: 'me' }))
    await listLeft.opened
    // The token deadline is a transporter default: it must not clamp the call itself.
    await vi.advanceTimersByTimeAsync(GMAIL_AUTH_TIMEOUT_MS)
    expect(call.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(GMAIL_TIMEOUT_MS - GMAIL_AUTH_TIMEOUT_MS)

    expect(call.settled).toBe(true)
    expect(call.error).toBeInstanceOf(Error)
  })
})
