import { describe, expect, it } from 'vitest'
import { fetchWithTransportRetry } from '../lib/transport-retry.mjs'

describe('fetchWithTransportRetry', () => {
  it('retries once when the first call throws, and returns the second answer', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      if (calls === 1) throw new TypeError('fetch failed')
      return new Response('ok', { status: 200 })
    }
    const res = await fetchWithTransportRetry('https://api.vercel.com/x', {}, { fetchImpl, retryDelayMs: 0 })
    expect(calls).toBe(2)
    expect(res.status).toBe(200)
  })

  it('throws the last error after the retry also fails', async () => {
    let calls = 0
    const fetchImpl = async () => {
      calls++
      throw new TypeError('fetch failed')
    }
    await expect(
      fetchWithTransportRetry('https://api.vercel.com/x', {}, { fetchImpl, retryDelayMs: 0 }),
    ).rejects.toThrow('fetch failed')
    expect(calls).toBe(2)
  })

  it('never retries an HTTP status, including 403 and 504', async () => {
    for (const status of [403, 504]) {
      let calls = 0
      const fetchImpl = async () => {
        calls++
        return new Response('', { status })
      }
      const res = await fetchWithTransportRetry('https://ryan-realty.com/', {}, { fetchImpl, retryDelayMs: 0 })
      expect(calls).toBe(1)
      expect(res.status).toBe(status)
    }
  })
})
