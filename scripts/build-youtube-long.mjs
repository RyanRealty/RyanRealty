#!/usr/bin/env node
/**
 * build-youtube-long.mjs
 *
 * Builds props.json + script.json + citations.json for the YouTube long-form
 * market report (1920x1080, 8-12 min). Pulls data the same way build-cities.mjs
 * does (cache + extras + history), generates a 10-chapter narrative arc per
 * youtube-long-form-market-report/SKILL.md §3.
 *
 * Usage:
 *   node --env-file=/Users/matthewryan/RyanRealty/.env.local scripts/build-youtube-long.mjs \
 *     --city bend [--period 2026-04]
 *
 * Output:
 *   out/yt-long/<slug>/props.json     — Remotion composition props
 *   out/yt-long/<slug>/script.json    — { fullText, beatSentences }
 *   out/yt-long/<slug>/citations.json — per-figure source trace
 *
 * Chapter structure (per skill spec §3):
 *   Ch 1  0:45   Cold open + hook
 *   Ch 2  1:15   Median price + 4-year history
 *   Ch 3  1:15   Price segments histogram
 *   Ch 4  1:00   Months of supply + market verdict
 *   Ch 5  1:15   Days on market distribution
 *   Ch 6  1:00   Sale-to-list + concessions
 *   Ch 7  1:15   Cash buyers + affordability
 *   Ch 8  1:15   Top neighborhoods leaderboard
 *   Ch 9  1:30   Agent commentary
 *   Ch 10 0:45   CTA + closing
 *   Total ~11:15 (adjusts to VO timing after synth)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA = resolve(ROOT, 'video/market-report/data')
const OUT = resolve(ROOT, 'out/yt-long')

// ─── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1)
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i]
      else out[a.slice(2)] = true
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const cityArg = args.city
if (!cityArg) {
  console.error('Usage: build-youtube-long.mjs --city <slug> [--period YYYY-MM]')
  process.exit(1)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoneyShort = (n) => {
  if (n == null) return '—'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1000) + 'K'
  return '$' + Math.round(n).toLocaleString()
}

const monthName = (iso) => {
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return m[new Date(iso + 'T12:00:00').getMonth()]
}

const PRONOUNCE = {
  'Deschutes': 'duh-shoots',
  'La Pine': 'La Pine',
  'Sunriver': 'Sun River',
  'Sisters': 'Sisters',
  'Prineville': 'Prineville',
  'Redmond': 'Redmond',
  'Bend': 'Bend',
  'Tumalo': 'TUM-uh-low',
}

async function loadJsonOrNull(path) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch { return null }
}

async function loadCacheRow(slug, reportPeriod) {
  const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL_BASE || !KEY) return null
  const periodStart = reportPeriod ? `${reportPeriod}-01` : (() => {
    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
  })()
  const url = `${URL_BASE}/rest/v1/market_stats_cache?geo_slug=eq.${encodeURIComponent(slug)}&period_type=eq.monthly&period_start=eq.${periodStart}&select=*&limit=1`
  try {
    const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } })
    if (!res.ok) { console.warn(`  loadCacheRow(${slug}, ${periodStart}): ${res.status}`); return null }
    const rows = await res.json()
    return rows[0] || null
  } catch (e) { console.warn(`  loadCacheRow failed: ${e.message}`); return null }
}

// ─── VO script helpers (match build-cities.mjs pattern) ────────────────────────

const moneyToSpoken = (n) => {
  if (!n) return 'zero'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} million`
  const k = Math.round(n / 1000)
  const ones = ['','one','two','three','four','five','six','seven','eight','nine']
  const teens = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
  if (k < 10) return `${k} thousand`
  const hundreds = Math.floor(k / 100)
  const rest = k % 100
  let result = hundreds ? `${ones[hundreds]} hundred` : ''
  if (rest === 0) return `${result} thousand`
  if (rest < 10) return `${result} ${ones[rest]} thousand`
  if (rest < 20) return `${result} ${teens[rest - 10]} thousand`
  const t = Math.floor(rest / 10); const o = rest % 10
  return `${result} ${tens[t]}${o ? '-' + ones[o] : ''} thousand`
}

const pctSpoken = (p) => {
  const abs = Math.abs(p)
  const r = Math.round(abs * 10) / 10
  const whole = Math.floor(r); const tenth = Math.round((r - whole) * 10)
  return tenth === 0 ? `${whole} percent` : `${whole} point ${tenth} percent`
}

// ─── Main plan function ────────────────────────────────────────────────────────

function planLongForm(data) {
  const city = data.city
  const cityVo = PRONOUNCE[city] || city
  const pulse = data.pulse

  const cur = data._history?.windows?.[0]
  const yr1 = data._history?.windows?.[1]
  const yr2 = data._history?.windows?.[2]
  const baseline = data._history?.windows?.[3]

  const medianSale = cur ? cur.median_sale_price : data.ytd_2026?.medianSalePrice
  const closedCount = cur ? cur.closed_count : data.ytd_2026?.count
  const dom = cur ? cur.median_dom : Math.round(data.ytd_2026?.medianDOM || 0)
  const slRatio = cur ? cur.median_sale_to_list_ratio : (data.ytd_2026?.medianSaleToOriginalListRatio || 0.97)
  const slPct = slRatio * 100

  const yr1Sale = yr1 ? yr1.median_sale_price : data.ytd_2025?.medianSalePrice
  const yoy = yr1Sale ? (medianSale - yr1Sale) / yr1Sale : 0
  const yoyDir = yoy > 0.005 ? 'up' : yoy < -0.005 ? 'down' : 'flat'
  const yr1Dom = yr1 ? yr1.median_dom : Math.round(data.ytd_2025?.medianDOM || 0)
  const domDelta = dom - yr1Dom

  const active = pulse.active_count
  const pending = pulse.pending_count
  const new30d = pulse.new_count_30d
  const mos = pulse.months_of_supply
  const klass = mos < 4 ? 'sellers' : mos < 6 ? 'balanced' : 'buyers'
  const klassPill = klass === 'sellers' ? "SELLER'S MARKET" : klass === 'balanced' ? 'BALANCED MARKET' : "BUYER'S MARKET"

  const introMonth = monthName(data.period?.ytd_end || new Date().toISOString().slice(0, 10))
  const introYear = (data.period?.ytd_end || new Date().toISOString().slice(0, 10)).slice(0, 4)

  const appreciation = baseline ? Math.round(((medianSale - baseline.median_sale_price) / baseline.median_sale_price) * 100) : null
  const yearsSpan = baseline ? parseInt(introYear) - parseInt(baseline.period_start.slice(0, 4)) : null

  // ── YEAR COLORS (same as short-form canonical) ────────────────────────────
  const YEAR_COLORS = { baseline: '#5BA8D4', yr2: '#7BC5A8', yr1: '#C8A864', current: '#D4AF37' }
  const series = baseline && yr2 && yr1 && cur ? [
    { month: baseline.period_label, value: baseline.median_sale_price, color: YEAR_COLORS.baseline, yearLabel: baseline.period_start.slice(0, 4) },
    { month: yr2.period_label,      value: yr2.median_sale_price,      color: YEAR_COLORS.yr2,      yearLabel: yr2.period_start.slice(0, 4) },
    { month: yr1.period_label,      value: yr1.median_sale_price,      color: YEAR_COLORS.yr1,      yearLabel: yr1.period_start.slice(0, 4) },
    { month: cur.period_label,      value: cur.median_sale_price,      color: YEAR_COLORS.current,  yearLabel: cur.period_start.slice(0, 4) },
  ] : null

  // ── VO SCRIPT (10 chapters, ~1500 words, narrative-only per §17) ──────────
  // Long-form gets 2-3 sentences per chapter vs 1 in short-form — per skill §5.
  // Numbers are on screen; VO delivers analyst interpretation, not recitation.

  const ch1 = klass === 'sellers'
    ? `${cityVo}, single family homes, ${introMonth.toLowerCase()} ${introYear}. Let's go through all the data. Inventory is tight. Sellers still have the edge.`
    : klass === 'balanced'
    ? `${cityVo}, single family homes, ${introMonth.toLowerCase()} ${introYear}. Let's go through all the data. The pendulum has swung to center. Neither side has a clear advantage right now.`
    : `${cityVo}, single family homes, ${introMonth.toLowerCase()} ${introYear}. Let's go through all the data. Buyers hold the cards today. Sellers need to price aggressively to move.`

  const ch2 = baseline
    ? yoyDir === 'down'
      ? `Median prices cooled this year. If you zoom out, though, the appreciation since ${baseline.period_start.slice(0, 4)} is still remarkable. The market is correcting, not collapsing. Buyers who waited for a crash are finding a dip, not a reset.`
      : yoyDir === 'up'
      ? `Prices kept climbing this year. The multi-year run since ${baseline.period_start.slice(0, 4)} has been steady. There is no evidence of a ceiling yet, and buyers are still paying for access to this market.`
      : `Prices held flat this year. After years of appreciation since ${baseline.period_start.slice(0, 4)}, the market is digesting. A flat year after a long run is not bearish. It's a pause, not a reversal.`
    : `Median prices ${yoyDir === 'up' ? 'climbed' : yoyDir === 'down' ? 'dipped' : 'held flat'} compared to last year. Track the multi-year trend, not the single-period snapshot.`

  const ch3 = (() => {
    if (!data._extras?.price_segments) {
      return `Price distribution tells you where the real action is. The mid-market is always the bellwether. When the middle moves, the whole market follows.`
    }
    const bns = data._extras.price_segments.bins
    let topIdx = 0
    for (let i = 1; i < bns.length; i++) if (bns[i].count > bns[topIdx].count) topIdx = i
    const top = bns[topIdx]
    if (topIdx === 0) return `Entry-level led the market this month. The bottom of the range has the most volume. Affordability is driving decisions.`
    if (topIdx === bns.length - 1) return `The high end was where the volume showed up this month. Luxury is moving faster than the entry tier, which is unusual. Equity-backed buyers are active.`
    return `The middle of the market did the heavy lifting this month. ${top.label} carried the bulk of closed volume. That's the sweet spot right now for both buyers and sellers.`
  })()

  const ch4 = klass === 'sellers'
    ? `Supply is constrained. At this level, listings move before the ink dries. Buyers who hesitate are watching properties go under contract without them. Acting quickly matters.`
    : klass === 'balanced'
    ? `Supply is healthy. Buyers can shop without panic and sellers can still command their price. This is what a functional market looks like. Both sides have leverage and neither side is dominant.`
    : `Supply is heavy. Buyers are in the driver's seat for the first time in years. Sellers who priced for the peak are watching days stack up. The data is telling them to adjust.`

  const ch5 = domDelta < -5
    ? `Listings are moving faster than this time last year. The pace has accelerated. If a home is priced right, it's not sitting long.`
    : domDelta > 5
    ? `Listings are sitting longer than last year. Pace has cooled noticeably. That's not necessarily bad news — it means buyers have time to be deliberate and negotiate.`
    : `Pace is steady, consistent with last year. No significant shift on time-to-contract. Well-priced listings are moving; overpriced listings are sitting. Same as always.`

  const ch6 = slPct >= 99
    ? `Sellers are getting full ask. Negotiation room is gone at this ratio. If you are a buyer, you come in at list or you lose. If you are a seller, now is the time to test the top of the range.`
    : slPct >= 97
    ? `Sellers are still getting close to asking price. Buyers can probe, but significant discounts are not materializing. The data supports pricing at or slightly above recent comps.`
    : slPct >= 95
    ? `Buyers have a little room to negotiate. Not a lot, but some. Coming in slightly under list with a clean offer is working more often than it was six months ago.`
    : `Buyers have real leverage on price. The gap between list and close is widening. Expect continued concessions.`

  const ch7 = data._cache?.cash_purchase_pct != null
    ? data._cache.cash_purchase_pct >= 35
      ? `Cash is a major force in this market. When a third or more of buyers are paying cash, wealth is concentrating at the top. Financing-dependent buyers face less competition than the headline inventory number suggests.`
      : data._cache.cash_purchase_pct >= 25
      ? `A meaningful share of buyers paid cash this period. That's above the national average and it reflects the equity wealth that Central Oregon homeowners have accumulated. The high end is transacting without financing friction.`
      : `Most buyers are using financing. Standard mortgage market dynamics apply. Rate sensitivity is real, and the pool of qualified buyers shifts every time rates move. Watch the Fed, not just the MLS.`
    : `Cash purchase data is not available for this period. Most buyers in this range are financed. Rate environment matters more than list price to this buyer pool.`

  const ch8 = (() => {
    if (!data._extras?.top_neighborhoods?.rows?.length) {
      return `Neighborhood performance varies significantly within the city. The top subdivisions outperform the median consistently. Location premium is real and it compounds over time.`
    }
    const top = data._extras.top_neighborhoods.rows[0]
    const bot = data._extras.top_neighborhoods.rows[data._extras.top_neighborhoods.rows.length - 1]
    return `${top.name} led the city in closed volume and commanded a premium over the city median. The gap between the top and bottom neighborhoods is wide and has been widening. Location alpha is compounding.`
  })()

  const ch9 = klass === 'sellers'
    ? `The big picture is clear. Supply is tight, pace is brisk, and prices are holding. For buyers, this is not the moment to wait for a dip that is not coming. For sellers, the market rewards preparation. If you are thinking of listing, the window is favorable.`
    : klass === 'balanced'
    ? `The market is balanced, which means strategy matters more than market timing. Buyers should focus on the property, not the macro. Sellers should price to comp, not to aspiration. Both sides have room to win right now.`
    : `Buyers have the advantage and it is not going away quickly at this supply level. The playbook is patient, deliberate negotiation. For sellers, price reduction is no longer optional. The market is telling you where the value is.`

  const ch10 = `Get the full written report at ryan-realty.com. Subscribe for monthly Central Oregon market updates. Drop a comment with your prediction for next month.`

  const beatSentences = [
    { id: 'ch1',  sentence: ch1 },
    { id: 'ch2',  sentence: ch2 },
    { id: 'ch3',  sentence: ch3 },
    { id: 'ch4',  sentence: ch4 },
    { id: 'ch5',  sentence: ch5 },
    { id: 'ch6',  sentence: ch6 },
    { id: 'ch7',  sentence: ch7 },
    { id: 'ch8',  sentence: ch8 },
    { id: 'ch9',  sentence: ch9 },
    { id: 'ch10', sentence: ch10 },
  ]
  const fullText = beatSentences.map(b => b.sentence).join(' ')

  // ── CHAPTERS array (Ch 2-9 map to chapters[0..7]) ─────────────────────────

  const slBarPct = Math.max(0.05, Math.min(1, (slPct - 80) / 20))
  const yoyText = yoyDir === 'flat' ? 'flat vs last year' : `${yoyDir === 'up' ? '+' : ''}${(yoy * 100).toFixed(1)}% vs last year`

  const chapters = [
    // Ch 2 — Median Sale Price → line_chart
    {
      label: 'Median Sale Price',
      value: fmtMoneyShort(medianSale),
      layout: series ? 'line_chart' : 'hero',
      bgVariant: 'navy',
      changeText: yoyText,
      changeDir: yoyDir,
      context: appreciation
        ? `${appreciation > 0 ? '+' : ''}${appreciation}% appreciation over ${yearsSpan} years`
        : `${closedCount} closed homes — ${introMonth} ${introYear}`,
      series,
      chapterTitle: 'Median Sale Price + 4-Year Trend',
    },
    // Ch 3 — Price Segments → histogram
    (() => {
      const extras = data._extras?.price_segments
      return {
        label: 'Price Segments',
        value: extras ? `${extras.total}` : `${closedCount}`,
        layout: 'histogram',
        bgVariant: 'navy-rich',
        bins: extras?.bins?.map(b => ({ label: b.label, count: b.count, pct: b.pct })) || [
          { label: '<$400K',   count: 0, pct: 20 },
          { label: '$400-600K', count: 0, pct: 30 },
          { label: '$600-800K', count: 0, pct: 25 },
          { label: '$800K-1M', count: 0, pct: 15 },
          { label: '$1M+',     count: 0, pct: 10 },
        ],
        annotations: extras?.annotations || ['Price distribution — April closed sales'],
        context: `${extras?.total || closedCount} closed sales by price band — ${introMonth} ${introYear}`,
        chapterTitle: 'Where the Action Is — Price Segments',
      }
    })(),
    // Ch 4 — Months of Supply → gauge
    {
      label: 'Months of Supply',
      value: mos.toFixed(1),
      unit: 'mo',
      layout: 'gauge',
      bgVariant: 'navy',
      gaugeValue: mos,
      gaugeMin: 0,
      gaugeMax: 10,
      verdict: klass,
      verdictText: klassPill,
      context: klass === 'sellers' ? 'Inventory is tight. Listings move fast.'
        : klass === 'balanced' ? 'Buyers have options without forcing the market.'
        : 'Buyers hold the cards. Sellers should price to move.',
      chapterTitle: 'Months of Supply + Market Verdict',
    },
    // Ch 5 — Days on Market → histogram (distribution)
    {
      label: 'Days on Market',
      value: `${dom}d`,
      layout: 'histogram',
      bgVariant: 'gold-tint',
      bins: data._extras?.dom_distribution?.bins || [
        { label: '0-7d',  count: 0, pct: 12 },
        { label: '8-14d', count: 0, pct: 16 },
        { label: '15-30d', count: 0, pct: 24 },
        { label: '31-60d', count: 0, pct: 28 },
        { label: '61-90d', count: 0, pct: 12 },
        { label: '90d+',  count: 0, pct: 8 },
      ],
      annotations: [
        `Median DOM: ${dom} days`,
        domDelta === 0 ? 'Flat vs last year' : domDelta > 0 ? `+${domDelta} days vs last year` : `${domDelta} days faster than last year`,
      ],
      context: `Speed distribution — ${introMonth} ${introYear} SFR ${city}`,
      chapterTitle: 'Days on Market — Distribution',
    },
    // Ch 6 — Sale-to-List → bar, then concessions if available
    {
      label: 'Sale-to-List Ratio',
      value: slPct.toFixed(1).replace(/\.0$/, ''),
      unit: '%',
      layout: 'bar',
      bgVariant: 'cream',
      barPct: slBarPct,
      context: slPct >= 99 ? 'Sellers getting full ask — no room to negotiate.'
        : slPct >= 97 ? 'Pricing held firm. Buyers must come in tight.'
        : slPct >= 95 ? 'Room to negotiate. Sellers open to offers.'
        : 'Buyers have real leverage. Sellers should expect to come off ask.',
      chapterTitle: 'Sale-to-List + Seller Concessions',
    },
    // Ch 7 — Cash buyers → donut
    {
      label: 'Cash Purchases',
      value: data._cache?.cash_purchase_pct != null
        ? `${Math.round(data._cache.cash_purchase_pct)}%`
        : '—',
      layout: 'donut',
      bgVariant: 'navy-rich',
      donutPct: data._cache?.cash_purchase_pct ?? 0,
      donutLabel: 'CASH',
      context: data._cache?.affordability_monthly_piti
        ? `Est. monthly PITI at current rates: ${fmtMoneyShort(data._cache.affordability_monthly_piti)} — based on 20% down, 30yr fixed`
        : 'Cash share reflects equity wealth concentrated in Central Oregon.',
      chapterTitle: 'Cash Buyers + Affordability',
    },
    // Ch 8 — Top neighborhoods → leaderboard
    {
      label: 'Top Neighborhoods',
      value: '',
      layout: 'leaderboard',
      bgVariant: 'navy',
      rows: data._extras?.top_neighborhoods?.rows?.map((r, i) => ({
        name: r.name,
        median: r.median,
        dom: r.dom ? `${r.dom}d` : undefined,
        yoy: r.yoy,
        highlight: i === 0,
      })) || [],
      context: `Top 5 subdivisions by closed volume — ${introMonth} ${introYear}`,
      chapterTitle: 'Top Neighborhoods',
    },
    // Ch 9 — Agent commentary → takeaway
    {
      label: "Buyer + Seller Takeaways",
      value: '',
      layout: 'takeaway',
      bgVariant: 'navy-radial',
      buyer: klass === 'sellers'
        ? [
          'Act quickly — well-priced listings go fast',
          'Bring your strongest offer or lose the house',
          'Rate lock now before supply tightens further',
        ]
        : klass === 'balanced'
        ? [
          `${mos.toFixed(1)} months of supply gives you options — use them`,
          'Focus on longer-DOM listings for leverage',
          'Finance pre-approval before you shop, not after',
        ]
        : [
          'Negotiate price and concessions simultaneously',
          'Target listings with 45+ DOM for biggest savings',
          'Inspection contingencies are back — use them',
        ],
      seller: klass === 'sellers'
        ? [
          'Price to current comps — buyers will compete',
          'Presentation quality still separates fast sales from long DOM',
          'Consider pre-listing inspection to eliminate contingencies',
        ]
        : klass === 'balanced'
        ? [
          'Price precisely to April comps, not February optimism',
          'Professional photography and staging are non-negotiable',
          'Concessions are the new price reduction — offer them early',
        ]
        : [
          'Reduce to market now — days on market multiply fast',
          'Credits to buyers beat price cuts in negotiations',
          'If DOM exceeds 60 days, re-evaluate pricing strategy',
        ],
      chapterTitle: 'Buyer + Seller Takeaways',
    },
  ]

  // ── CHAPTER DURATIONS (defaults — overridden by synth-vo-long after VO) ───
  const chapterDurations = [45, 75, 75, 60, 75, 60, 75, 75, 90, 45]

  // ── CITATIONS ─────────────────────────────────────────────────────────────
  const citations = {
    deliverable: `${city} YouTube Long-Form Market Report — ${introMonth} ${introYear}`,
    rendered_at: new Date().toISOString(),
    verified_at: data.verified_at,
    source_primary: data.sources?.live || 'Supabase market_pulse_live',
    sfr_filter: data.sfr_filter || "PropertyType='A'",
    period: data.period,
    figures: [
      { stat: `Median Sale Price`, on_screen: fmtMoneyShort(medianSale), exact: medianSale,
        query: cur ? `bend-history windows[0] median_sale_price n=${cur.closed_count}` : `listings YTD ${introYear} SFR median(ClosePrice)` },
      { stat: 'YoY Direction', on_screen: yoyText, exact: yoy, query: `(${medianSale} - ${yr1Sale}) / ${yr1Sale}` },
      { stat: 'Active Listings', on_screen: String(active), exact: active, query: `market_pulse_live active_count geo_slug='${city.toLowerCase()}'` },
      { stat: 'Months of Supply', on_screen: mos.toFixed(1), exact: mos, query: 'market_pulse_live months_of_supply' },
      { stat: 'Market Classification', on_screen: klassPill, exact: klass, query: `MoS ${mos.toFixed(2)} < 4 → sellers | 4-6 → balanced | ≥6 → buyers` },
      { stat: 'Median DOM', on_screen: `${dom} days`, exact: dom, query: cur ? 'bend-history windows[0] median_dom' : 'listings YTD median(DOM)' },
      { stat: 'Sale-to-List Ratio', on_screen: `${slPct.toFixed(1)}%`, exact: slRatio, query: cur ? 'bend-history windows[0] median_sale_to_list_ratio' : 'listings YTD median(ClosePrice/OriginalListPrice)' },
      ...(data._cache?.cash_purchase_pct != null ? [{ stat: 'Cash Purchase %', on_screen: `${Math.round(data._cache.cash_purchase_pct)}%`, exact: data._cache.cash_purchase_pct, query: 'market_stats_cache cash_purchase_pct_sfr' }] : []),
    ],
  }

  const slug = city.toLowerCase().replace(/\s+/g, '-')
  const props = {
    city,
    citySlug: slug,
    period: args.period || `${introYear}-${String(new Date().getMonth()).padStart(2, '0')}`,
    subhead: `Single-Family Market · ${introMonth} ${introYear} · ${city === 'Bend' ? 'Deschutes County' : 'Central Oregon'}`,
    eyebrow: 'Ryan Realty Market Report',
    marketHealthLabel: klassPill,
    medianPriceDisplay: fmtMoneyShort(medianSale),
    voPath: 'voiceover.mp3',
    captionWords: [],
    chapterDurations,
    chapters,
    imageCount: 15,
  }

  return { props, fullText, beatSentences, citations }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const slug = cityArg
// City file names use spaces (e.g. "la pine.json"), slugs use hyphens
const dataFileName = slug.replace(/-/g, ' ')
const dataPath = resolve(DATA, `${dataFileName}.json`)

let raw
try {
  raw = JSON.parse(await readFile(dataPath, 'utf8'))
} catch {
  console.error(`City data not found: ${dataPath}`)
  process.exit(1)
}

const reportPeriod = args.period || (() => {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
})()

raw._history = await loadJsonOrNull(resolve(DATA, `${slug}-history.json`))
raw._extras  = await loadJsonOrNull(resolve(DATA, `${slug}-extras.json`))
raw._cache   = await loadCacheRow(slug, reportPeriod)

const { props, fullText, beatSentences, citations } = planLongForm(raw)

const cityOut = resolve(OUT, slug)
await mkdir(cityOut, { recursive: true })
await writeFile(resolve(cityOut, 'props.json'), JSON.stringify(props, null, 2))
await writeFile(resolve(cityOut, 'script.json'), JSON.stringify({ city: raw.city, fullText, beatSentences }, null, 2))
await writeFile(resolve(cityOut, 'citations.json'), JSON.stringify(citations, null, 2))

console.log(`Built ${slug} YouTube long-form:`)
console.log(`  Script: ${fullText.length} chars, ${beatSentences.length} chapters`)
console.log(`  Default duration: ${props.chapterDurations.reduce((s, d) => s + d, 0)}s = ${Math.floor(props.chapterDurations.reduce((s, d) => s + d, 0) / 60)}:${String(props.chapterDurations.reduce((s, d) => s + d, 0) % 60).padStart(2, '0')}`)
console.log(`  Output: ${cityOut}/`)
console.log('\nNext: node scripts/synth-vo-long.mjs --city', slug)
