import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const h = vi.hoisted(() => {
  const from = vi.fn()
  return {
    from,
    createServiceClient: vi.fn(() => ({ from })),
  }
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => h.createServiceClient(),
}))

import { snapshotCmaVersion } from '@/lib/data/cma/documents'

function chain(result: { data: unknown; error: { message: string } | null }) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    insert: vi.fn(() => q),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return q
}

describe('cma_versions snapshot', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    h.from.mockReset()
    h.createServiceClient.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
  })

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
  })

  it('skips when there is no live row to overwrite', async () => {
    const cmas = chain({ data: null, error: null })
    h.from.mockImplementation((table: string) => {
      if (table === 'cmas') return cmas
      throw new Error(`unexpected ${table}`)
    })
    const res = await snapshotCmaVersion({ slug: 'cma-19815-nugget', reason: 'rebuild' })
    expect(res).toEqual({ ok: true, skipped: true })
    expect(h.from).not.toHaveBeenCalledWith('cma_versions')
  })

  it('fails the rebuild when the snapshot insert fails', async () => {
    const row = { id: 'cma-1', slug: 'cma-19815-nugget', html_content: '<html>kept</html>', recommended_list: 734000 }
    const comps = [{ cma_id: 'cma-1', comp_listing_key: 'K1', comp_order: 1 }]
    const cmas = chain({ data: row, error: null })
    const compsQ = chain({ data: comps, error: null })
    const versions = chain({ data: null, error: { message: 'insert denied' } })
    h.from.mockImplementation((table: string) => {
      if (table === 'cmas') return cmas
      if (table === 'cma_comps') return compsQ
      if (table === 'cma_versions') return versions
      throw new Error(`unexpected ${table}`)
    })
    const res = await snapshotCmaVersion({ slug: 'cma-19815-nugget', reason: 'rebuild' })
    expect(res).toEqual({ ok: false, error: 'insert denied' })
    expect(versions.insert).toHaveBeenCalledWith({
      cma_id: 'cma-1',
      slug: 'cma-19815-nugget',
      snapshot: { row, comps },
      reason: 'rebuild',
    })
  })

  it('returns the new version id when the snapshot writes', async () => {
    const row = { id: 'cma-1', slug: 'cma-20506-murphy', html_content: '<html>murphy</html>' }
    const cmas = chain({ data: row, error: null })
    const compsQ = chain({ data: [], error: null })
    const versions = chain({ data: { id: 'ver-1' }, error: null })
    h.from.mockImplementation((table: string) => {
      if (table === 'cmas') return cmas
      if (table === 'cma_comps') return compsQ
      if (table === 'cma_versions') return versions
      throw new Error(`unexpected ${table}`)
    })
    const res = await snapshotCmaVersion({ slug: 'cma-20506-murphy', reason: 'rebuild' })
    expect(res).toEqual({ ok: true, id: 'ver-1' })
  })

  it('buildCma snapshots first and the migration file exists', () => {
    const build = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')
    expect(build).toMatch(/await snapshotCmaVersion\(\{ slug, reason: 'rebuild' \}\)/)
    expect(build).toMatch(/Could not snapshot the current CMA before rebuild/)
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260925172200_cma_versions.sql'),
      'utf8',
    )
    expect(migration).toMatch(/create table if not exists public.cma_versions/)
    expect(migration).toMatch(/enable row level security/)
    expect(migration).toMatch(/revoke all on public.cma_versions from anon/)
    expect(migration).toMatch(/revoke all on public.cma_versions from authenticated/)
    expect(migration).toMatch(/add column if not exists build_failed_at/)
  })
})
