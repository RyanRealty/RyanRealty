import { test, expect } from '@playwright/test'

/**
 * E-CUT: /pulse folds into /activity. The pulse feed UI is gone.
 */
test.describe('Pulse route retired', () => {
  test('/pulse permanently redirects to /activity', async ({ request }) => {
    const res = await request.get('/pulse', { maxRedirects: 0 })
    expect([301, 308]).toContain(res.status())
    const loc = res.headers()['location'] ?? ''
    expect(loc, 'Location should land on /activity').toMatch(/\/activity(?:\?|$)/)
  })
})
