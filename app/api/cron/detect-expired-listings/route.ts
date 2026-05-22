/**
 * Expired-listings detection route — manual / ad-hoc invocation.
 *
 * History note (2026-05-22, Matt directive):
 *   The Vercel cron registration on this route has been removed. The
 *   canonical trigger is now `/api/cron/sync-delta`, which runs every
 *   10 minutes against the Spark MLS deltas and calls the same
 *   `processNewExpiredListings` lib at the end of each run.
 *
 *   This route stays callable on demand for backfills, one-off triage,
 *   or manual re-runs from the admin UI. It still requires the
 *   Authorization: Bearer $CRON_SECRET header.
 *
 * The full pipeline (owner lookup, FUB person creation, Resend alert,
 * audit-trail upsert into `public.expired_listings`) lives in
 * `lib/expired-listing-processor.ts` so both callers share the same
 * code path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
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
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
