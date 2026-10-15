import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INDEXNOW_BATCH_SIZE,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  indexNowEnabled,
  indexNowUrl,
  normalizeIndexNowUrls,
  submitIndexNow,
} from './indexnow'

const PROD = { VERCEL_ENV: 'production' }

function okFetch(status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('', { status }))
}

function bodyOf(fetchImpl: ReturnType<typeof okFetch>, call = 0): { host: string; key: string; keyLocation: string; urlList: string[] } {
  return JSON.parse(String(fetchImpl.mock.calls[call]![1]!.body))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the IndexNow key', () => {
  it('is 32 lowercase hex characters', () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is served from public/<key>.txt, the file holding exactly the key', () => {
    const file = readFileSync(resolve(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`), 'utf8')
    expect(file).toBe(INDEXNOW_KEY)
  })

  it('is located at the site root on the canonical host', () => {
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://ryan-realty.com/${INDEXNOW_KEY}.txt`)
  })
})

describe('indexNowEnabled', () => {
  it('runs in production only, unless a manual run opts in', () => {
    expect(indexNowEnabled({ VERCEL_ENV: 'production' })).toBe(true)
    expect(indexNowEnabled({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(indexNowEnabled({})).toBe(false)
    expect(indexNowEnabled({ INDEXNOW_OPT_IN: '1' })).toBe(true)
    expect(indexNowEnabled({ INDEXNOW_OPT_IN: 'true' })).toBe(false)
  })

  it('the kill switch wins over production', () => {
    expect(indexNowEnabled({ VERCEL_ENV: 'production', INDEXNOW_DISABLED: '1' })).toBe(false)
  })
})

describe('normalizeIndexNowUrls', () => {
  it('keeps only absolute https URLs on ryan-realty.com, deduplicated, without fragments', () => {
    const { kept, dropped } = normalizeIndexNowUrls([
      'https://ryan-realty.com/blog/a',
      'https://ryan-realty.com/blog/a',
      'https://ryan-realty.com/blog/a#top',
      'http://ryan-realty.com/blog/b',
      'https://www.ryan-realty.com/blog/c',
      'https://ryanrealty.vercel.app/blog/d', // staging-host-ok: proves the alias is dropped
      'https://ryan-realty.com:8443/blog/e',
      'https://evil.example/https://ryan-realty.com/x',
      '/blog/relative',
      'not a url',
      '',
      null,
      undefined,
      'https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220000001',
    ])
    expect(kept).toEqual([
      'https://ryan-realty.com/blog/a',
      'https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220000001',
    ])
    expect(dropped).toBe(10)
  })

  it('indexNowUrl builds on the canonical origin', () => {
    expect(indexNowUrl('/blog/x')).toBe('https://ryan-realty.com/blog/x')
    expect(indexNowUrl('blog/x')).toBe('https://ryan-realty.com/blog/x')
  })
})

describe('submitIndexNow', () => {
  it('does nothing outside production', async () => {
    const fetchImpl = okFetch()
    const r = await submitIndexNow(['https://ryan-realty.com/blog/a'], { env: { VERCEL_ENV: 'preview' }, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, skipped: 'disabled', submitted: 0 })
  })

  it('sends nothing when no URL survives', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = okFetch()
    const r = await submitIndexNow(['https://example.com/x', ''], { env: PROD, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toMatchObject({ ok: true, skipped: 'empty', dropped: 2 })
  })

  it('POSTs host, key, keyLocation and urlList as JSON to api.indexnow.org', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchImpl = okFetch(200)
    const r = await submitIndexNow(['https://ryan-realty.com/blog/a', 'https://ryan-realty.com/blog/a'], { env: PROD, fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(INDEXNOW_ENDPOINT)
    expect(INDEXNOW_ENDPOINT).toBe('https://api.indexnow.org/indexnow')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toMatch(/^application\/json/)
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(bodyOf(fetchImpl)).toEqual({
      host: 'ryan-realty.com',
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: ['https://ryan-realty.com/blog/a'],
    })
    expect(r).toMatchObject({ ok: true, skipped: null, submitted: 1, dropped: 0 })
  })

  it('treats 202 as accepted', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const r = await submitIndexNow(['https://ryan-realty.com/a'], { env: PROD, fetchImpl: okFetch(202) })
    expect(r).toMatchObject({ ok: true, submitted: 1 })
    expect(r.batches[0]).toMatchObject({ status: 202, ok: true })
  })

  it('splits at 10,000 URLs per request', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const urls = Array.from({ length: INDEXNOW_BATCH_SIZE + 1 }, (_, i) => `https://ryan-realty.com/p/${i}`)
    const fetchImpl = okFetch(200)
    const r = await submitIndexNow(urls, { env: PROD, fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(bodyOf(fetchImpl, 0).urlList).toHaveLength(10_000)
    expect(bodyOf(fetchImpl, 1).urlList).toEqual([`https://ryan-realty.com/p/${INDEXNOW_BATCH_SIZE}`])
    expect(r.submitted).toBe(INDEXNOW_BATCH_SIZE + 1)
  })

  it.each([
    [422, /do not belong to the host/],
    [403, /key not valid/],
    [429, /too many requests/],
    [400, /bad request/],
    [500, /unexpected response/],
  ])('logs HTTP %i as a failure and does not throw', async (status, meaning) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await submitIndexNow(['https://ryan-realty.com/a'], { env: PROD, fetchImpl: okFetch(status) })
    expect(r.ok).toBe(false)
    expect(r.submitted).toBe(0)
    expect(r.batches[0]).toMatchObject({ status, ok: false })
    expect(r.batches[0]!.error).toMatch(meaning)
    expect(error).toHaveBeenCalledWith(expect.stringContaining(`HTTP ${status}`))
  })

  it('a network error is a logged failure, never a throw', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const r = await submitIndexNow(['https://ryan-realty.com/a'], { env: PROD, fetchImpl })
    expect(r).toMatchObject({ ok: false, submitted: 0 })
    expect(r.batches[0]).toMatchObject({ status: null, ok: false })
  })

  it('gives up on a slow engine at the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
        }),
    )
    const started = Date.now()
    const r = await submitIndexNow(['https://ryan-realty.com/a'], { env: PROD, fetchImpl, timeoutMs: 30 })
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(r.ok).toBe(false)
    expect(r.batches[0]!.error).toMatch(/TimeoutError|abort/i)
  })
})
