/**
 * /api/social/publish refuses LinkedIn and Threads by name (Matt 2026-10-14:
 * "Just remove LinkedIn and Threads."). The refusal comes before any approval
 * lookup or platform call, so nothing is posted and no DB row is read.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createClient = vi.fn(() => {
  throw new Error('the refusal must not touch the database')
})
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => createClient(...(a as [])) }))

const linkedinCalls = vi.fn()
const threadsCalls = vi.fn()
vi.mock('@/lib/linkedin', () => ({
  getLinkedInAccessToken: (...a: unknown[]) => linkedinCalls(...a),
  publishLinkedInVideoFromUrl: (...a: unknown[]) => linkedinCalls(...a),
}))
vi.mock('@/lib/threads', () => ({
  getThreadsAccessToken: (...a: unknown[]) => threadsCalls(...a),
  publishThreadsVideo: (...a: unknown[]) => threadsCalls(...a),
}))

// The route reads CRON_SECRET at module load.
beforeAll(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
})
afterEach(() => {
  createClient.mockClear()
})

const post = (body: unknown) =>
  new NextRequest('https://ryan-realty.com/api/social/publish', {
    method: 'POST',
    headers: { 'x-cron-secret': 'test-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const base = {
  approved: true,
  // An image, so the removed-platform refusal is what answers. A video body is
  // refused earlier by the video freeze (423) once that branch is merged.
  mediaType: 'image',
  mediaUrl: 'https://example.com/a.jpg',
  caption: 'Test',
  approvalRef: { actionId: '00000000-0000-0000-0000-000000000000' },
}

describe('/api/social/publish removed platforms', () => {
  for (const platforms of [['linkedin'], ['threads'], ['instagram', 'linkedin'], ['threads', 'facebook', 'linkedin']]) {
    it(`refuses ${platforms.join(' + ')} with a clear 400 and touches nothing`, async () => {
      const { POST } = await import('./route')
      const res = await POST(post({ ...base, platforms }))
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string; removedPlatforms: string[] }
      expect(json.error).toBe('LinkedIn and Threads were removed as platforms (Matt 2026-10-14)')
      expect(json.removedPlatforms).toEqual(platforms.filter((p) => p === 'linkedin' || p === 'threads'))
      expect(createClient).not.toHaveBeenCalled()
      expect(linkedinCalls).not.toHaveBeenCalled()
      expect(threadsCalls).not.toHaveBeenCalled()
    })
  }

  it('still refuses an unauthenticated request first', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      new NextRequest('https://ryan-realty.com/api/social/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...base, platforms: ['linkedin'] }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('a door platform does not get the removed-platform refusal', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ ...base, approved: false, platforms: ['instagram'] }))
    const json = (await res.json()) as { error: string }
    expect(json.error).not.toContain('removed as platforms')
  })
})
