/**
 * FSBO detection cron — thin route over lib/fsbo-processor.ts (the native
 * pipeline; the pre-cutover FUB body this route used to carry silently
 * no-op'd after 2026-06-24 and was replaced 2026-07-14).
 *
 * Detect Zillow FSBOs in the service area (Apify) → skip-trace the owner
 * (county records + BatchData, compliance-tagged) → native crm_people record
 * (no placeholders without real contact) → 60-min Call task → auto-CMA →
 * Matt alert → fsbo_listings audit row. NO auto-texting: outreach is manual
 * approve-and-send from /admin/fsbos.
 *
 * Registered in vercel.json: daily 09:35 UTC. Manual fire:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://ryan-realty.com/api/cron/detect-fsbo-listings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { processNewFsboListings, FSBO_SERVICE_AREA_CITIES, FSBO_MIN_LIST_PRICE, FSBO_MAX_PER_RUN } from '@/lib/fsbo-processor'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabase()
  const stats = await processNewFsboListings(supabase)
  return NextResponse.json({
    ...stats,
    config: {
      cities: FSBO_SERVICE_AREA_CITIES,
      min_list_price: FSBO_MIN_LIST_PRICE,
      max_per_run: FSBO_MAX_PER_RUN,
    },
  })
}
