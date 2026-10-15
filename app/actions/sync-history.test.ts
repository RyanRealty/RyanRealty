import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * recordSyncRun is called best-effort by the 15-minute delta sync, which
 * ignores the result. While the live sync_history_run_type_check lacked
 * 'delta', 94 inserts a day were refused and nothing in the app said so.
 * What is pinned: a refused insert logs the table, column and run_type once,
 * still reports { ok: false } to the caller, and a good insert logs nothing.
 */
const insert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => ({ insert }) }),
}))

import { recordSyncRun } from './sync-history'

const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key'
  insert.mockReset()
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.url
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.key
})

const run = { runType: 'delta' as const, startedAt: 1_000, completedAt: 11_000, listingsUpserted: 4 }

describe('recordSyncRun', () => {
  it('logs the table, column and refused run_type when the CHECK rejects it', async () => {
    insert.mockResolvedValue({
      error: {
        code: '23514',
        message: 'new row for relation "sync_history" violates check constraint "sync_history_run_type_check"',
        details: 'Failing row contains (146a59bd, delta, 2026-10-15 00:48:15+00)',
      },
    })
    const res = await recordSyncRun(run)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('sync_history_run_type_check')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = String(errorSpy.mock.calls[0][0])
    expect(line).toContain('table=sync_history')
    expect(line).toContain('column=run_type')
    expect(line).toContain('value=delta')
    expect(line).toContain('code=23514')
    expect(line).not.toContain('Failing row')
  })

  it('writes the row it was given and logs nothing on success', async () => {
    insert.mockResolvedValue({ error: null })
    const res = await recordSyncRun(run)
    expect(res).toEqual({ ok: true })
    expect(errorSpy).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ run_type: 'delta', duration_seconds: 10, listings_upserted: 4, error: null }),
    )
  })

  it('does not touch the database when Supabase is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await recordSyncRun(run)
    expect(res).toEqual({ ok: false, error: 'Supabase not configured' })
    expect(insert).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
