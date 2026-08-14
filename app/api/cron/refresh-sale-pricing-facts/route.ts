import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/refresh-sale-pricing-facts
 *
 * Incremental drain of sale_pricing_facts (all years, Central Oregon closed A)
 * plus a rebuild of pricing_market_index / pricing_subdivision_cells.
 * Schedule: every 6 hours via vercel.json.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    console.error('[refresh-sale-pricing-facts] init', err)
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 })
  }

  const started = Date.now()
  let upserted = 0
  let done = false
  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase.rpc('refresh_sale_pricing_facts_batch', {
      p_limit: 200,
      p_job: 'sale_pricing_facts',
    })
    if (error) {
      console.error('[refresh-sale-pricing-facts]', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    upserted += Number(data?.upserted ?? 0)
    if (data?.done) {
      done = true
      break
    }
  }
  let concessionsUpdated = 0
  for (let i = 0; i < 8; i++) {
    const { data: conc, error: concErr } = await supabase.rpc('backfill_sale_pricing_concessions_yn', {
      p_limit: 400,
    })
    if (concErr) {
      console.error('[refresh-sale-pricing-facts] concessions', concErr.message)
      return NextResponse.json({ ok: false, error: concErr.message, upserted }, { status: 500 })
    }
    concessionsUpdated += Number(conc?.updated ?? 0)
    if (conc?.done) break
  }
  const { data: idx, error: idxErr } = await supabase.rpc('refresh_pricing_indexes')
  if (idxErr) {
    console.error('[refresh-sale-pricing-facts] index', idxErr.message)
    return NextResponse.json({ ok: false, error: idxErr.message, upserted }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    upserted,
    concessionsUpdated,
    done,
    indexes: idx,
    duration_ms: Date.now() - started,
  })
}
