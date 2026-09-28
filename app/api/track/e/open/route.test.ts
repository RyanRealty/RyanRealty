import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { signEmailToken } from '@/lib/email-tracking'

const mockRecord = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
    }),
  }),
}))

vi.mock('@/lib/crm/email-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/email-events')>()
  return {
    ...actual,
    recordEmailEvent: (...args: unknown[]) => mockRecord(...args),
  }
})

vi.mock('@/lib/newsletter/track-ledger', () => ({
  recordNewsletterEngagement: vi.fn(async () => undefined),
}))

vi.mock('@/lib/crm/cma-engagement', () => ({
  cmaSlugFromEmailKey: () => null,
  queueCmaOpenedAlert: vi.fn(async () => undefined),
}))

import { GET } from './route'

describe('track/e/open — inferred delivery', () => {
  beforeEach(() => {
    mockRecord.mockReset()
    mockRecord.mockResolvedValue({ ok: true, inserted: true })
  })

  it('records an open and an inferred-opened delivered event for the same send', async () => {
    const tok = signEmailToken({
      personId: 7,
      emailKey: 'cma:cma-deer',
      label: 'A market analysis',
      broker: 'matt',
    })
    const res = await GET(new NextRequest(`https://ryan-realty.com/api/track/e/open?t=${encodeURIComponent(tok)}`))
    expect(res.status).toBe(200)
    expect(mockRecord).toHaveBeenCalledTimes(2)
    expect(mockRecord.mock.calls[0][0]).toMatchObject({
      personId: 7,
      event: 'open',
      emailKey: 'cma:cma-deer',
    })
    expect(mockRecord.mock.calls[1][0]).toMatchObject({
      personId: 7,
      event: 'delivered',
      emailKey: 'cma:cma-deer',
      meta: { inferred: 'opened' },
    })
  })
})
