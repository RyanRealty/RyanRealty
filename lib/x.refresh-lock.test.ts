/**
 * getXAccessToken() must never let two concurrent callers refresh with the same
 * rotating refresh token. X revokes the grant on replay; that is how the
 * connection died on 2026-08-28 when token-heartbeat and snapshot-channels both
 * fired at 12:00 UTC. This test runs two callers against one stale row and
 * asserts a single token-endpoint call, one persisted rotation, and the same
 * access token handed to both.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { access_token: string; refresh_token: string | null; expires_at: string }
const state: { row: Row | null; locks: Map<string, string> } = { row: null, locks: new Map() }

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async set(key: string, value: string, opts?: { nx?: boolean; ex?: number }) {
      if (opts?.nx && state.locks.has(key)) return null
      state.locks.set(key, value)
      return 'OK'
    }
    async del(key: string) {
      return state.locks.delete(key) ? 1 : 0
    }
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    let pendingUpdate: Partial<Row> | null = null
    const builder: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq']) builder[m] = () => builder
    builder.update = (payload: Partial<Row>) => {
      pendingUpdate = payload
      return builder
    }
    builder.maybeSingle = async () => ({ data: state.row ? { ...state.row } : null, error: null })
    // `await supabase.from().update().eq()` resolves here and applies the write.
    builder.then = (resolve: (v: { error: null }) => void) => {
      if (pendingUpdate && state.row) state.row = { ...state.row, ...pendingUpdate }
      pendingUpdate = null
      resolve({ error: null })
    }
    return builder
  },
}))

const tokenCalls: string[] = []

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'redis-token')
  vi.stubEnv('X_CLIENT_ID', 'client')
  vi.stubEnv('X_CLIENT_SECRET', 'secret')
  vi.stubEnv('X_REDIRECT_URI', 'https://example.test/api/x/callback')
  state.locks.clear()
  tokenCalls.length = 0
  let n = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/2/oauth2/token')) {
        n += 1
        tokenCalls.push(new URLSearchParams(String(init?.body)).get('refresh_token') ?? '')
        return new Response(
          JSON.stringify({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 7200 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error(`unexpected fetch ${url}`)
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('getXAccessToken refresh serialization', () => {
  it('returns the stored token without touching X while it is fresh', async () => {
    state.row = { access_token: 'fresh', refresh_token: 'r0', expires_at: new Date(Date.now() + 2 * 3600e3).toISOString() }
    const { getXAccessToken } = await import('./x')
    expect(await getXAccessToken()).toBe('fresh')
    expect(tokenCalls).toHaveLength(0)
  })

  it('two concurrent callers on a stale row produce one refresh and share the result', async () => {
    state.row = { access_token: 'stale', refresh_token: 'r0', expires_at: new Date(Date.now() + 60e3).toISOString() }
    const { getXAccessToken } = await import('./x')
    const [a, b] = await Promise.all([getXAccessToken(), getXAccessToken()])
    expect(tokenCalls).toEqual(['r0'])
    expect(a).toBe('access-1')
    expect(b).toBe('access-1')
    expect(state.row?.refresh_token).toBe('refresh-1')
    expect(state.locks.size).toBe(0)
  })

  it('a caller that reads a stale row but finds a fresh one after taking the lock does not refresh', async () => {
    state.row = { access_token: 'stale', refresh_token: 'r0', expires_at: new Date(Date.now() + 60e3).toISOString() }
    const { getXAccessToken } = await import('./x')
    const first = getXAccessToken()
    // Simulate a sibling process that already rotated the row before we locked.
    state.row = { access_token: 'sibling', refresh_token: 'r1', expires_at: new Date(Date.now() + 2 * 3600e3).toISOString() }
    expect(await first).toBe('sibling')
    expect(tokenCalls).toHaveLength(0)
  })
})
