/**
 * Soft-404 found 2026-10-13: /buy/<unknown slug> served HTTP 200 + noindex
 * because app/buy/[intent] notFound() runs under app/buy/loading.tsx.
 * middleware.ts answers a real 404 from the public-slug allowlist. Bare /buy
 * and live intent pages pass through.
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const UAS = {
  browser: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  googlebot:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

function req(path: string, ua: string) {
  return new NextRequest(new URL(path, 'https://ryan-realty.com'), {
    headers: { 'user-agent': ua, host: 'ryan-realty.com' },
  })
}

describe('middleware /buy/<slug> 404', () => {
  for (const [name, ua] of Object.entries(UAS)) {
    it(`an unknown one-segment path is a real 404 (${name})`, async () => {
      const res = await middleware(req('/buy/first-time', ua))
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      const html = await res.text()
      expect(html).toContain('<meta name="robots" content="noindex">')
      expect(html).toContain('Page not found')
      expect(html).toContain('/homes-for-sale')
    })

    it(`live buyer pages pass through (${name})`, async () => {
      for (const path of [
        '/buy/leverage',
        '/buy/alerts',
        '/buy/concessions',
        '/buy/first-time-home-buyer',
        '/buy/relocation',
        '/buy/investment',
      ]) {
        const res = await middleware(req(path, ua))
        expect(res.status).toBe(200)
        expect(res.headers.get('x-middleware-next')).toBe('1')
      }
    })

    it(`bare /buy passes through so next.config can 301 it (${name})`, async () => {
      const res = await middleware(req('/buy', ua))
      expect(res.status).toBe(200)
      expect(res.headers.get('x-middleware-next')).toBe('1')
    })
  }

  it('does not 301 /buy/first-time and does not invent /relocate-to-bend', async () => {
    const first = await middleware(req('/buy/first-time', UAS.browser))
    expect(first.status).toBe(404)
    expect(first.headers.get('location')).toBeNull()
    const relocate = await middleware(req('/relocate-to-bend', UAS.browser))
    expect(relocate.status).not.toBe(301)
    expect(relocate.status).not.toBe(308)
  })
})
