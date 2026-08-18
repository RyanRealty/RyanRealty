/**
 * Admin "Run ingest now" must invoke the live delta core, not Inngest.
 * runDeltaSync is mocked — this test must never touch Spark or production.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecuteRunResult } from '@/lib/sync/deltaSync'

const getUser = vi.fn()
const runDeltaSync = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServerClient: async () => ({
    auth: { getUser },
  }),
}))

vi.mock('@/lib/sync/deltaSync', () => ({
  runDeltaSync: (...args: unknown[]) => runDeltaSync(...args),
}))

import { POST } from './route'

const ROUTE_SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'route.ts'), 'utf8')

function executeResult(over: Partial<ExecuteRunResult> = {}): ExecuteRunResult {
  return {
    ok: true,
    partial: false,
    sinceIso: '2026-08-18T00:00:00.000Z',
    pages: 1,
    truncated: false,
    maxProcessedTs: '2026-08-18T12:00:00.000Z',
    totalFetched: 3,
    totalUpserted: 3,
    newListings: 1,
    priceChanges: 1,
    statusChanges: 0,
    eventsEmitted: 2,
    listingsFinalized: 0,
    historyRowsInserted: 0,
    photosFixed: 0,
    skippedFinalized: 0,
    expired: null,
    ...over,
  }
}

describe('POST /api/admin/sync/delta', () => {
  const originalSpark = process.env.SPARK_API_KEY

  beforeEach(() => {
    getUser.mockReset()
    runDeltaSync.mockReset()
    process.env.SPARK_API_KEY = 'test-spark-key'
  })

  afterEach(() => {
    if (originalSpark === undefined) delete process.env.SPARK_API_KEY
    else process.env.SPARK_API_KEY = originalSpark
  })

  it('does not import the send-only client', () => {
    expect(ROUTE_SRC).not.toMatch(/from ['"]@\/lib\/inngest['"]/)
    expect(ROUTE_SRC).not.toMatch(/inngest\.send/)
    expect(ROUTE_SRC).toMatch(/runDeltaSync\(\{\s*mode:\s*'execute'\s*\}\)/)
  })

  it('returns 401 and does not run delta when there is no session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST()
    expect(res.status).toBe(401)
    expect(runDeltaSync).not.toHaveBeenCalled()
  })

  it('returns 403 and does not run delta for a non-superuser', async () => {
    getUser.mockResolvedValue({ data: { user: { email: 'rebecca@ryan-realty.com' } } })
    const res = await POST()
    expect(res.status).toBe(403)
    expect(runDeltaSync).not.toHaveBeenCalled()
  })

  it('returns 503 and does not run delta when SPARK_API_KEY is missing', async () => {
    delete process.env.SPARK_API_KEY
    getUser.mockResolvedValue({ data: { user: { email: 'matt@ryan-realty.com' } } })
    const res = await POST()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/SPARK_API_KEY/)
    expect(runDeltaSync).not.toHaveBeenCalled()
  })

  it('runs the live execute core and returns the cron-shaped summary', async () => {
    getUser.mockResolvedValue({ data: { user: { email: 'matt@ryan-realty.com' } } })
    runDeltaSync.mockResolvedValue(executeResult())
    const res = await POST()
    expect(res.status).toBe(200)
    expect(runDeltaSync).toHaveBeenCalledTimes(1)
    expect(runDeltaSync).toHaveBeenCalledWith({ mode: 'execute' })
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.message).toBe('Delta sync completed')
    expect(body.summary).toContain('3 listings synced')
    expect(body.summary).toContain('1 new')
    expect(body.summary).toContain('1 price changes')
    expect(body.totalUpserted).toBe(3)
    expect(body.sinceIso).toBe('2026-08-18T00:00:00.000Z')
  })

  it('returns 500 when the live core throws', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    getUser.mockResolvedValue({ data: { user: { email: 'matt@ryan-realty.com' } } })
    runDeltaSync.mockRejectedValue(new Error('spark timeout'))
    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('spark timeout')
    err.mockRestore()
  })
})
