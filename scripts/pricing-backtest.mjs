#!/usr/bin/env node
/**
 * As-of-sale backtest against closed SFR. Comps-path only: last ask is
 * read for the under-ask report, never passed into estimateClosePrice.
 * Predicted close is est.predictedClose. No method1/method3 fallback.
 * No look-ahead. Prints MAPE and the 15 biggest under-ask residuals.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRuralAcreage } from '../lib/cma/comp-tiers.ts'
import { resolveMarketArea } from '../lib/cma/market-area.ts'
import { classifyStory, citySlug } from '../lib/pricing/classes.ts'
import { walkPricingLadder } from '../lib/pricing/match.ts'
import { estimateClosePrice } from '../lib/pricing/estimate.ts'
import { resolveConcessions, sellerNetFromPrice } from '../lib/pricing/seller-net.ts'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SAMPLE = Number(process.env.PRICING_BACKTEST_N || 200)
const FACT_SELECT =
  'listing_key, list_number, street_number, street_name, city, city_slug, subdivision, subdivision_norm, latitude, longitude, product_class, beds, baths, sqft, year_built, lot_acres, lot_class, story_class, water_class, sewer_class, hoa_class, close_price, close_date, concessions_amount, concessions_yn, original_ask, last_ask, days_to_offer, cdom, drop_count, close_ppsf, photo_url, public_remarks, new_construction_yn, flag_new_construction'

const { count: factsN } = await sb.from('sale_pricing_facts').select('listing_key', { count: 'exact', head: true })
if (!factsN || factsN < 500) {
  console.error('sale_pricing_facts has', factsN, 'rows — backfill first')
  process.exit(2)
}

const { data: subjects, error } = await sb
  .from('sale_pricing_facts')
  .select(FACT_SELECT)
  .eq('product_class', 'detached')
  .gte('close_date', '2024-01-01')
  .lt('close_date', '2026-07-01')
  .gte('sqft', 800)
  .lte('sqft', 4000)
  .gt('close_price', 150000)
  .order('listing_key', { ascending: true })
  .limit(800)
if (error) {
  console.error(error.message)
  process.exit(1)
}

function stride(arr, n) {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

function newConstructionFlag(r) {
  if (r.new_construction_yn === true || r.flag_new_construction === true) return true
  if (r.new_construction_yn === false) return false
  return null
}

const picked = stride(subjects ?? [], SAMPLE)
const errors = []

for (const row of picked) {
  const asOf = String(row.close_date).slice(0, 10)
  const closeAfter = new Date(asOf)
  closeAfter.setMonth(closeAfter.getMonth() - 18)
  const [poolRes, idxRes, cellRes] = await Promise.all([
    sb
      .from('sale_pricing_facts')
      .select(FACT_SELECT)
      .eq('city_slug', row.city_slug)
      .eq('product_class', 'detached')
      .lt('close_date', asOf)
      .gte('close_date', closeAfter.toISOString().slice(0, 10))
      .gte('sqft', Math.round(Number(row.sqft) * 0.6))
      .lte('sqft', Math.round(Number(row.sqft) * 1.4))
      .limit(800),
    sb
      .from('pricing_market_index')
      .select('month, n, median_ppsf, median_sale_to_original, median_days_to_offer')
      .eq('city_slug', row.city_slug)
      .order('month', { ascending: true })
      .limit(400),
    sb
      .from('pricing_subdivision_cells')
      .select('city_slug, subdivision_norm, n, median_ppsf')
      .eq('city_slug', row.city_slug)
      .limit(2000),
  ])
  const toSale = (r) => ({
    listingKey: r.listing_key,
    listNumber: r.list_number,
    address: `${r.street_number ?? ''} ${r.street_name ?? ''}`.trim(),
    city: r.city,
    citySlug: r.city_slug,
    subdivision: r.subdivision,
    subdivisionNorm: r.subdivision_norm,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    beds: r.beds != null ? Number(r.beds) : null,
    baths: r.baths != null ? Number(r.baths) : null,
    sqft: Number(r.sqft),
    lotAcres: r.lot_acres != null ? Number(r.lot_acres) : null,
    yearBuilt: r.year_built != null ? Number(r.year_built) : null,
    storyClass: r.story_class,
    productClass: r.product_class,
    waterClass: r.water_class,
    sewerClass: r.sewer_class,
    hoaClass: r.hoa_class,
    lotClass: r.lot_class,
    closePrice: Number(r.close_price),
    closeDate: String(r.close_date).slice(0, 10),
    concessionsAmount: r.concessions_amount != null ? Number(r.concessions_amount) : null,
    concessionsYn: r.concessions_yn ?? null,
    originalAsk: r.original_ask != null ? Number(r.original_ask) : null,
    lastAsk: r.last_ask != null ? Number(r.last_ask) : null,
    daysToOffer: r.days_to_offer != null ? Number(r.days_to_offer) : null,
    cdom: r.cdom != null ? Number(r.cdom) : null,
    dropCount: Number(r.drop_count ?? 0),
    closePpsf: Number(r.close_ppsf),
    photoUrl: r.photo_url,
    publicRemarks: r.public_remarks,
    newConstruction: newConstructionFlag(r),
  })
  const lat = row.latitude != null ? Number(row.latitude) : null
  const lng = row.longitude != null ? Number(row.longitude) : null
  const marketArea = resolveMarketArea(lat, lng)
  const lotAcres = row.lot_acres != null ? Number(row.lot_acres) : null
  const subject = {
    listingKey: row.listing_key,
    streetAddress: `${row.street_number ?? ''} ${row.street_name ?? ''}`.trim(),
    city: row.city,
    citySlug: row.city_slug,
    subdivision: row.subdivision,
    subdivisionNorm: row.subdivision_norm,
    latitude: lat,
    longitude: lng,
    beds: row.beds != null ? Number(row.beds) : null,
    baths: row.baths != null ? Number(row.baths) : null,
    sqft: Number(row.sqft),
    lotAcres,
    yearBuilt: row.year_built != null ? Number(row.year_built) : null,
    storyClass: row.story_class ?? classifyStory(null),
    productClass: row.product_class,
    waterClass: row.water_class,
    sewerClass: row.sewer_class,
    hoaClass: row.hoa_class,
    lotClass: row.lot_class,
    ruralAcreage: isRuralAcreage({ lotAcres }, marketArea),
    marketArea,
    newConstruction: newConstructionFlag(row),
  }
  const cells = new Map()
  for (const c of cellRes.data ?? []) {
    if (c.subdivision_norm) cells.set(`${c.city_slug}:${c.subdivision_norm}`, { medianPpsf: Number(c.median_ppsf), n: Number(c.n) })
  }
  const match = walkPricingLadder(subject, (poolRes.data ?? []).map(toSale), { asOf, cells })
  const points = (idxRes.data ?? []).map((p) => ({
    month: String(p.month).slice(0, 10),
    ppsf: Number(p.median_ppsf),
    n: Number(p.n),
    saleToOriginal: p.median_sale_to_original != null ? Number(p.median_sale_to_original) : null,
    daysToOffer: p.median_days_to_offer != null ? Number(p.median_days_to_offer) : null,
  }))
  const lastAsk = row.last_ask != null ? Number(row.last_ask) : null
  const cmaSubject = {
    listingKey: row.listing_key,
    mlsNumber: row.list_number,
    streetAddress: subject.streetAddress,
    city: row.city,
    state: 'OR',
    postalCode: null,
    subdivision: row.subdivision,
    latitude: subject.latitude,
    longitude: subject.longitude,
    beds: subject.beds,
    baths: subject.baths,
    sqft: subject.sqft,
    lotAcres: subject.lotAcres,
    propertySubType: 'Single Family Residence',
    yearBuilt: subject.yearBuilt,
    garageSpaces: null,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Closed',
    lastListPrice: null,
    lastListDate: null,
    listingHistoryLine: null,
  }
  const est = estimateClosePrice({
    subject: cmaSubject,
    subjectStory: subject.storyClass,
    comps: match.comps,
    compStories: match.comps.map((c) => c.storyClass),
    points,
    asOf,
    market: null,
  })
  const predicted = est.predictedClose
  const actual = Number(row.close_price)
  const err = predicted != null && actual > 0 ? (predicted - actual) / actual : null
  const vsAsk = predicted != null && lastAsk != null && lastAsk > 0 ? (predicted - lastAsk) / lastAsk : null
  const actualConc = resolveConcessions({
    amount: row.concessions_amount != null ? Number(row.concessions_amount) : null,
    yn: row.concessions_yn,
    closeDate: asOf,
  })
  const actualNet = sellerNetFromPrice(actual, actualConc)
  const predictedNet = est.pricing?.sellerNet?.predictedSellerNet ?? null
  const netErr =
    predictedNet != null && actualNet != null && actualNet > 0 ? (predictedNet - actualNet) / actualNet : null
  errors.push({
    key: row.listing_key,
    city: row.city,
    addr: subject.streetAddress,
    close: asOf,
    lastAsk,
    actual,
    predicted,
    err,
    vsAsk,
    actualNet,
    predictedNet,
    netErr,
    comps: match.comps.length,
    tiers: match.tiersUsed,
    regime: est.regime,
    rural: subject.ruralAcreage,
    marketArea,
  })
}

function score(rows, key) {
  const usable = rows.filter((e) => e[key] != null)
  const abs = usable.map((e) => Math.abs(e[key]))
  const mape = abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : null
  return {
    priced: usable.length,
    mape: mape != null ? +mape.toFixed(4) : null,
    within_2pct: usable.length ? +(abs.filter((n) => n <= 0.02).length / usable.length).toFixed(3) : null,
    within_5pct: usable.length ? +(abs.filter((n) => n <= 0.05).length / usable.length).toFixed(3) : null,
    within_8pct: usable.length ? +(abs.filter((n) => n <= 0.08).length / usable.length).toFixed(3) : null,
    within_10pct: usable.length ? +(abs.filter((n) => n <= 0.1).length / usable.length).toFixed(3) : null,
    median_abs_err: abs.length ? +[...abs].sort((a, b) => a - b)[Math.floor(abs.length / 2)].toFixed(4) : null,
  }
}

const close = score(errors, 'err')
const net = score(errors, 'netErr')
const starved = errors.filter((e) => e.comps < 3).length
const refused = errors.filter((e) => e.predicted == null).length
const underAsk = [...errors]
  .filter((e) => e.vsAsk != null)
  .sort((a, b) => a.vsAsk - b.vsAsk)
  .slice(0, 15)
  .map((e) => ({
    addr: e.addr,
    city: e.city,
    lastAsk: e.lastAsk,
    predicted: e.predicted,
    actual: e.actual,
    vsAsk: +e.vsAsk.toFixed(4),
    err: e.err != null ? +e.err.toFixed(4) : null,
    comps: e.comps,
    tiers: e.tiers,
    rural: e.rural,
    marketArea: e.marketArea,
  }))

console.log(
  JSON.stringify(
    {
      cite: 'docs/DATABASE_FOR_AI_AGENTS.md §2b sale_pricing_facts; comps-path only; predictedClose; last_ask is report-only',
      fetched_at: new Date().toISOString(),
      facts: factsN,
      sample: errors.length,
      starved,
      refused,
      close,
      seller_net: net,
      under_ask_15: underAsk,
    },
    null,
    2,
  ),
)
void citySlug
