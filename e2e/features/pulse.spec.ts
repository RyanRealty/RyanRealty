import { test, expect } from '@playwright/test'

/**
 * E-CUT: /pulse folded into /activity, and /activity folded into
 * /housing-market (UXLIVE-8, 2026-09-23). All three land on the market page in
 * ONE hop; /pulse must not chain through /activity.
 */
test.describe('Pulse and activity routes retired', () => {
  for (const path of ['/pulse', '/activity']) {
    test(`${path} permanently redirects to /housing-market in one hop`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect([301, 308]).toContain(res.status())
      const loc = res.headers()['location'] ?? ''
      expect(loc, 'Location should land on /housing-market').toMatch(/\/housing-market(?:\?|$)/)
    })
  }

  test('/buy permanently redirects to /homes-for-sale in one hop', async ({ request }) => {
    const res = await request.get('/buy', { maxRedirects: 0 })
    expect([301, 308]).toContain(res.status())
    const loc = res.headers()['location'] ?? ''
    expect(loc, 'Location should land on /homes-for-sale').toMatch(/\/homes-for-sale(?:\?|$)/)
  })
})
