import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { stampListingPricingReadsBatch } from '@/lib/pricing/stamp-listing-read'

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
  let newConstructionStamped = 0
  const { data: ynStamp, error: ynErr } = await supabase.rpc('stamp_sale_pricing_new_construction')
  if (ynErr) {
    console.error('[refresh-sale-pricing-facts] new_construction', ynErr.message)
    return NextResponse.json({ ok: false, error: ynErr.message, upserted }, { status: 500 })
  }
  newConstructionStamped = Number(ynStamp ?? 0)
  let waterReclassUpdated = 0
  for (let i = 0; i < 8; i++) {
    const { data: water, error: waterErr } = await supabase.rpc('backfill_sale_pricing_water_reclass', {
      p_limit: 400,
    })
    if (waterErr) {
      console.error('[refresh-sale-pricing-facts] water_reclass', waterErr.message)
      return NextResponse.json({ ok: false, error: waterErr.message, upserted }, { status: 500 })
    }
    waterReclassUpdated += Number(water?.updated ?? 0)
    if (water?.done) break
  }
  let newConstructionBackfilled = 0
  for (let i = 0; i < 8; i++) {
    const { data: yn, error: ynFillErr } = await supabase.rpc('backfill_sale_pricing_new_construction_yn', {
      p_limit: 800,
    })
    if (ynFillErr) {
      console.error('[refresh-sale-pricing-facts] new_construction_yn', ynFillErr.message)
      return NextResponse.json({ ok: false, error: ynFillErr.message, upserted }, { status: 500 })
    }
    newConstructionBackfilled += Number(yn?.updated ?? 0)
    if (yn?.done) break
  }
  const { data: idx, error: idxErr } = await supabase.rpc('refresh_pricing_indexes')
  if (idxErr) {
    console.error('[refresh-sale-pricing-facts] index', idxErr.message)
    return NextResponse.json({ ok: false, error: idxErr.message, upserted }, { status: 500 })
  }
  // Market Truth recency lane (last 90 days). Full-history is a separate
  // invocation of refresh_market_fact_sale(null). Fail closed so a stall is
  // visible; pricing rows above already committed.
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 90)
  const sinceIso = since.toISOString().slice(0, 10)
  const { data: factSale, error: factSaleErr } = await supabase.rpc('refresh_market_fact_sale', {
    p_since: sinceIso,
  })
  if (factSaleErr) {
    console.error('[refresh-sale-pricing-facts] market_fact_sale', factSaleErr.message)
    return NextResponse.json(
      { ok: false, error: factSaleErr.message, upserted, indexes: idx },
      { status: 500 },
    )
  }
  const marketFactSpan = { upserted: 0, batches: 0, done: false, last_key: '' as string }
  let spanAfter = ''
  for (let i = 0; i < 8; i++) {
    const { data: span, error: spanErr } = await supabase.rpc('refresh_market_fact_listing_span', {
      p_after: spanAfter,
      p_limit: 2000,
      p_modified_since: sinceIso,
    })
    if (spanErr) {
      console.error('[refresh-sale-pricing-facts] market_fact_listing_span', spanErr.message)
      return NextResponse.json(
        { ok: false, error: spanErr.message, upserted, indexes: idx, marketFactSale: factSale },
        { status: 500 },
      )
    }
    marketFactSpan.upserted += Number(span?.upserted ?? 0)
    marketFactSpan.batches += 1
    marketFactSpan.last_key = String(span?.last_key ?? '')
    marketFactSpan.done = Boolean(span?.done)
    spanAfter = marketFactSpan.last_key
    if (span?.done) break
  }
  const marketFactBound = { upserted: 0, batches: 0, done: false, last_key: '' as string }
  let boundAfter = ''
  const boundSince = new Date()
  boundSince.setUTCDate(boundSince.getUTCDate() - 90)
  const boundSinceIso = boundSince.toISOString().slice(0, 10)
  for (let i = 0; i < 3; i++) {
    const { data: bound, error: boundErr } = await supabase.rpc('refresh_listing_boundary_tags', {
      p_after: boundAfter,
      p_limit: 400,
      p_on_or_after: boundSinceIso,
    })
    if (boundErr) {
      console.error('[refresh-sale-pricing-facts] listing_boundary_tags', boundErr.message)
      return NextResponse.json(
        { ok: false, error: boundErr.message, upserted, indexes: idx, marketFactSale: factSale, marketFactSpan },
        { status: 500 },
      )
    }
    marketFactBound.upserted += Number(bound?.upserted ?? 0)
    marketFactBound.batches += 1
    marketFactBound.last_key = String(bound?.last_key ?? '')
    marketFactBound.done = Boolean(bound?.done)
    boundAfter = marketFactBound.last_key
    if (bound?.done) break
  }
  const { data: shadow, error: shadowErr } = await supabase.rpc('compute_market_metrics_shadow')
  let monthlyShadow: unknown = null
  if (!shadowErr) {
    const monthly = await supabase.rpc('compute_market_metrics_monthly_shadow', { p_months: 36 })
    if (monthly.error) {
      console.error('[refresh-sale-pricing-facts] compute_market_metrics_monthly_shadow', monthly.error.message)
    } else {
      monthlyShadow = monthly.data
    }
    const monthlyNbh = await supabase.rpc('compute_market_metrics_monthly_neighborhood_shadow', {
      p_months: 36,
    })
    if (monthlyNbh.error) {
      console.error(
        '[refresh-sale-pricing-facts] compute_market_metrics_monthly_neighborhood_shadow',
        monthlyNbh.error.message,
      )
    }
  }
  if (shadowErr) {
    console.error('[refresh-sale-pricing-facts] compute_market_metrics_shadow', shadowErr.message)
    return NextResponse.json(
      {
        ok: false,
        error: shadowErr.message,
        upserted,
        indexes: idx,
        marketFactSale: factSale,
        marketFactSpan,
        marketFactBound,
      },
      { status: 500 },
    )
  }
  let listingReads = { stamped: 0, skipped: 0, due: 0 }
  try {
    listingReads = await stampListingPricingReadsBatch(done ? 24 : 6)
  } catch (err) {
    console.error('[refresh-sale-pricing-facts] listing_reads', err)
  }
  return NextResponse.json({
    ok: true,
    upserted,
    concessionsUpdated,
    newConstructionStamped,
    waterReclassUpdated,
    newConstructionBackfilled,
    listingReads,
    marketFactSale: factSale,
    marketFactSpan,
    marketFactBound,
    marketMetricShadow: shadow,
    marketMetricMonthly: monthlyShadow,
    done,
    indexes: idx,
    duration_ms: Date.now() - started,
  })
}
