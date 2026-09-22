/**
 * GET /api/cron/snapshot-active-inventory
 * H8: write durable active inventory counts by CO city for as_of = today (UTC).
 *
 * The writer is imported. Spawning scripts/analytics/snapshot-active-inventory.mjs
 * failed on Vercel (the file is not traced) and the route still returned 200.
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import {
  inventorySnapshotHttpStatus,
  snapshotActiveInventory,
} from '@/lib/data/analytics/snapshotActiveInventory'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const start = Date.now()
  try {
    let client: SupabaseClient | null = null
    try {
      client = createServiceClient()
    } catch {
      client = null
    }
    const result = await snapshotActiveInventory({ client })
    const status = inventorySnapshotHttpStatus(result)
    return NextResponse.json(
      {
        ok: status === 200,
        as_of: result.as_of,
        computedAt: result.computedAt,
        written: result.written,
        attempted: result.attempted,
        totalActive: result.totalActive,
        errors: result.errors,
        error: result.error,
        byCity: result.byCity,
        duration_ms: Date.now() - start,
      },
      { status },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), written: 0 },
      { status: 500 },
    )
  }
}
