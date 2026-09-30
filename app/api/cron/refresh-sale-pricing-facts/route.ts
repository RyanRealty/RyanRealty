import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { stampListingPricingReadsBatch } from '@/lib/pricing/stamp-listing-read'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Comps one run may remove; more means a listings read gone wrong (see the prune below). */
const PRUNE_BUDGET = 50

/**
 * GET /api/cron/refresh-sale-pricing-facts
 *
 * Incremental drain of sale_pricing_facts (all years, Central Oregon closed A),
 * a sweep that drops comps whose listing left the filter
 * (prune_sale_pricing_facts_batch), plus a rebuild of pricing_market_index /
 * pricing_subdivision_cells.
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
  // The refresh above only upserts. A comp whose listing later left the filter
  // (deleted because the MLS removed the sale, back to Pending, re-typed) stays
  // until this sweep drops it; 3 x 20,000 keys a run covers the ~150,000-row
  // table about every 18 hours. A listing the MLS is still changing gets a
  // 48-hour clock first (a status correction can flip back). A run may remove
  // PRUNE_BUDGET comps: a batch that would take it past that removes nothing
  // (a listings read gone wrong, not a normal day, which held 4 in the whole
  // table on 2026-09-30), the owner is texted, and the steps below still run.
  // The sweep holds at a refused batch (migration 20260930190000): the next
  // run reads it again with a whole budget, and a checked cleanup is approved
  // by calling the function once with a larger p_max_delete.
  const pruned = {
    deleted: 0,
    scanned: 0,
    settling: 0,
    keys: [] as string[],
    refused: null as string | null,
    refusedKeys: [] as string[],
    done: false,
  }
  for (let i = 0; i < 3; i++) {
    const { data: prune, error: pruneErr } = await supabase.rpc('prune_sale_pricing_facts_batch', {
      p_limit: 20000,
      p_job: 'sale_pricing_facts_prune',
      p_max_delete: PRUNE_BUDGET - pruned.deleted,
    })
    if (pruneErr) {
      console.error('[refresh-sale-pricing-facts] prune', pruneErr.message)
      return NextResponse.json({ ok: false, error: pruneErr.message, upserted }, { status: 500 })
    }
    pruned.deleted += Number(prune?.deleted ?? 0)
    pruned.scanned += Number(prune?.scanned ?? 0)
    pruned.settling += Number(prune?.settling ?? 0)
    if (Array.isArray(prune?.keys)) pruned.keys.push(...prune.keys.map(String))
    if (prune?.ok === false) {
      pruned.refused = String(prune?.refused ?? 'refused')
      if (Array.isArray(prune?.refused_keys)) pruned.refusedKeys.push(...prune.refused_keys.map(String))
      break
    }
    if (prune?.done) {
      pruned.done = true
      break
    }
  }
  if (pruned.refused) {
    console.error('[refresh-sale-pricing-facts] prune refused', pruned.refused)
    await queueBrokerHealthAlert({
      key: 'comp-prune-refused',
      body: `The CMA comp cleanup refused a batch: ${pruned.refused.slice(0, 150)} (${pruned.deleted} removed earlier this run). The listings read may be incomplete; the cleanup waits on that batch until someone checks it and approves it.`,
      cooldownMinutes: 1440,
    })
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
    const monthlyZip = await supabase.rpc('compute_market_metrics_monthly_zip_shadow', {
      p_months: 36,
    })
    if (monthlyZip.error) {
      console.error(
        '[refresh-sale-pricing-facts] compute_market_metrics_monthly_zip_shadow',
        monthlyZip.error.message,
      )
    }
    const hudWindows = await supabase.rpc('compute_market_metrics_hud_windows_shadow')
    if (hudWindows.error) {
      console.error(
        '[refresh-sale-pricing-facts] compute_market_metrics_hud_windows_shadow',
        hudWindows.error.message,
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
    ok: pruned.refused == null,
    upserted,
    pruned,
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
