// cron: manual-only operator backfill (unused HTTP; do not schedule — work lives in sync-delta)
/**
 * TOMBSTONE — unused HTTP shell. Detection runs inside `/api/cron/sync-delta`
 * via `processNewExpiredListings`. Not in vercel.json. No admin UI caller.
 * Kept as a CRON_SECRET-guarded backfill curl only. Do not register it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { processNewExpiredListings } from '@/lib/expired-listing-processor'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const maxPerRunParam = url.searchParams.get('maxPerRun')
  const lookbackHoursParam = url.searchParams.get('lookbackHours')

  const supabase = getSupabase()
  const stats = await processNewExpiredListings(supabase, {
    maxPerRun: maxPerRunParam ? Math.max(1, Math.min(100, parseInt(maxPerRunParam, 10) || 30)) : 30,
    lookbackHours: lookbackHoursParam
      ? Math.max(1, Math.min(168, parseInt(lookbackHoursParam, 10) || 24))
      : 24,
  })

  return NextResponse.json(stats)
}
