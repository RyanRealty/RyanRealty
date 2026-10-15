import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

describe('the server Supabase clients use the build-tolerant fetch', () => {
  beforeEach(() => {
    vi.resetModules()
    createClient.mockClear()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-test-key')
  })

  it('the service-role client', async () => {
    const { buildTolerantFetch } = await import('@/lib/supabase/build-tolerant-fetch')
    const { createServiceClient } = await import('@/lib/supabase/service')
    createServiceClient()
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-test-key', {
      global: { fetch: buildTolerantFetch },
    })
  })

  it('the anon DAL client', async () => {
    const { buildTolerantFetch } = await import('@/lib/supabase/build-tolerant-fetch')
    const { supabaseAnon } = await import('@/lib/data/client')
    supabaseAnon()
    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-test-key', {
      global: { fetch: buildTolerantFetch },
    })
  })
})
