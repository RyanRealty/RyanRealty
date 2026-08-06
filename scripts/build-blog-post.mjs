#!/usr/bin/env node
/**
 * Ryan Realty — Blog Post Builder
 *
 * Generates an SEO-optimised market-report blog post (markdown + metadata +
 * JSON-LD) for a given city × month period. Reads live data from Supabase
 * (market_stats_cache, market_pulse_live, listings). Follows the full spec in
 * social_media_skills/blog-post/SKILL.md §3.
 *
 * CLI:
 *   node --env-file=.env.local scripts/build-blog-post.mjs --city bend --period 2026-04
 *
 * Outputs to:
 *   out/blog/market-report/<city>/<YYYY-MM>/post.md
 *   out/blog/market-report/<city>/<YYYY-MM>/metadata.json
 *   out/blog/market-report/<city>/<YYYY-MM>/json-ld.json
 *
 * Every figure in the post is cited in a <!-- citation: ... --> comment at
 * the end of the section it lives in. All numbers carry units. No banned words
 * (grep gate runs before write). Title ≤60 chars. Meta description 150-160.
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — Service role key (read access)
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { search as assetSearch } from '../lib/asset-library.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const VOCAB = require('./brand-voice-vocabulary.cjs')

// ---------------------------------------------------------------------------
// City config — lat/lng for JSON-LD Place, display name, search paths
// ---------------------------------------------------------------------------
const CITY_CONFIG = {
  bend: {
    display: 'Bend',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 44.0582,
    longitude: -121.3153,
    geoSlugs: ['bend', 'central-oregon'],
    searchSlug: 'bend-sfr',
    neighborhoods: ['Petrosa', 'Northwest Crossing', 'Awbrey Butte', 'Old Farm District', 'Southeast Bend'],
  },
  redmond: {
    display: 'Redmond',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 44.2726,
    longitude: -121.1490,
    geoSlugs: ['redmond', 'central-oregon'],
    searchSlug: 'redmond-sfr',
    neighborhoods: ['Dry Canyon', 'Eagle Crest', 'Cascade Valley'],
  },
  sisters: {
    display: 'Sisters',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 44.2904,
    longitude: -121.5491,
    geoSlugs: ['sisters', 'central-oregon'],
    searchSlug: 'sisters-sfr',
    neighborhoods: ['Eagle Ridge', 'Crossings at Sisters', 'Three Winds'],
  },
  'la-pine': {
    display: 'La Pine',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 43.6674,
    longitude: -121.5025,
    geoSlugs: ['la-pine', 'central-oregon'],
    searchSlug: 'la-pine-sfr',
    neighborhoods: ['Holiday Farm', 'Spring River Estates'],
  },
  sunriver: {
    display: 'Sunriver',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 43.8790,
    longitude: -121.4524,
    geoSlugs: ['sunriver', 'central-oregon'],
    searchSlug: 'sunriver-sfr',
    neighborhoods: ['SHARC Area', 'River Village', 'Woodlands'],
  },
  prineville: {
    display: 'Prineville',
    state: 'Oregon',
    abbr: 'OR',
    latitude: 44.2998,
    longitude: -120.8345,
    geoSlugs: ['prineville', 'central-oregon'],
    searchSlug: 'prineville-sfr',
    neighborhoods: [],
  },
}

// ---------------------------------------------------------------------------
// Banned words come from the canon, and only from the canon
// (marketing_brain_skills/brand-voice/VOICE.md via
// scripts/brand-voice-vocabulary.cjs). The blog-specific extras list that used
// to sit here was a second rule set, which is what Matt ordered deleted on
// 2026-08-05. If a phrase should be banned in blog copy, it is banned in the
// canon or it is not banned.
const BANNED_WORDS = [...VOCAB.BANNED_WORD_STRINGS]

function grepBannedWords(text) {
  const hits = []
  const lower = text.toLowerCase()
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) hits.push(word)
  }
  return hits
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    url: url.replace(/\/+$/, ''),
  }
}

async function fetchRow(endpoint) {
  const sb = getSupabase()
  const res = await fetch(`${sb.url}/rest/v1${endpoint}`, { headers: sb.headers })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${endpoint}`)
  const rows = await res.json()
  return rows[0] || null
}

async function fetchRows(endpoint) {
  const sb = getSupabase()
  const res = await fetch(`${sb.url}/rest/v1${endpoint}`, { headers: sb.headers })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${endpoint}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Data pull
// ---------------------------------------------------------------------------

async function pullData(citySlug, period) {
  const periodStart = `${period}-01`
  // Determine period_end (last day of month)
  const [yr, mo] = period.split('-').map(Number)
  const lastDay = new Date(yr, mo, 0).getDate()
  const periodEnd = `${period}-${String(lastDay).padStart(2, '0')}`

  console.log(`\nPulling data for ${citySlug} ${period}...`)

  // 1. market_stats_cache row
  const cacheRow = await fetchRow(
    `/market_stats_cache?geo_slug=eq.${citySlug}&period_type=eq.monthly&period_start=eq.${periodStart}&select=*&limit=1`
  )
  if (!cacheRow) {
    throw new Error(`No market_stats_cache row found for geo_slug=${citySlug}, period_start=${periodStart}. Has the cache been populated for this period?`)
  }

  // 2. market_pulse_live row (current live snapshot — SFR, property_type='A')
  const pulseRow = await fetchRow(
    `/market_pulse_live?geo_slug=eq.${citySlug}&property_type=eq.A&select=*&limit=1`
  )
  if (!pulseRow) {
    console.warn(`  Warning: no market_pulse_live row for ${citySlug} property_type=A — active inventory stats will be limited.`)
  }

  // 3. SFR-only YoY: direct query on listings for current period and prior year
  const sfrCurrentRows = await fetchRows(
    `/listings?"PropertyType"=eq.A&"StandardStatus"=eq.Closed&"CloseDate"=gte.${periodStart}&"CloseDate"=lte.${periodEnd}&select="ClosePrice","CumulativeDaysOnMarket","StreetName"&limit=1000`
  )

  const priorPeriodStart = `${yr - 1}-${String(mo).padStart(2, '0')}-01`
  const priorPeriodEnd   = `${yr - 1}-${String(mo).padStart(2, '0')}-${String(new Date(yr - 1, mo, 0).getDate()).padStart(2, '0')}`
  const sfrPriorRows = await fetchRows(
    `/listings?"PropertyType"=eq.A&"StandardStatus"=eq.Closed&"CloseDate"=gte.${priorPeriodStart}&"CloseDate"=lte.${priorPeriodEnd}&select="ClosePrice","CumulativeDaysOnMarket"&limit=1000`
  )

  // 4. Top neighborhoods (subdivisions with most closed SFR sales this period)
  const neighborhoodRows = await fetchRows(
    `/listings?"PropertyType"=eq.A&"StandardStatus"=eq.Closed&"CloseDate"=gte.${periodStart}&"CloseDate"=lte.${periodEnd}&select="SubdivisionName","ClosePrice"&limit=1000`
  )

  return {
    cache: cacheRow,
    pulse: pulseRow,
    sfrCurrent: sfrCurrentRows,
    sfrPrior: sfrPriorRows,
    neighborhoods: neighborhoodRows,
    period: { start: periodStart, end: periodEnd, label: period, year: yr, month: mo },
  }
}

// ---------------------------------------------------------------------------
// Stat calculations (with source traces)
// ---------------------------------------------------------------------------

function computeMedian(arr) {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function computeStats(data) {
  const { cache, pulse, sfrCurrent, sfrPrior, period } = data

  // Prefer direct SFR-only queries for headline stats. Fall back to cache
  // SFR breakdown if the direct query is too small (< 3 rows).
  const sfrPrices = sfrCurrent.map(r => r['ClosePrice']).filter(Boolean)
  const sfrDoms = sfrCurrent.map(r => r['CumulativeDaysOnMarket']).filter(v => v != null)
  const priorPrices = sfrPrior.map(r => r['ClosePrice']).filter(Boolean)

  const medianSalePrice = sfrPrices.length >= 3
    ? computeMedian(sfrPrices)
    : cache.median_sale_price

  const medianDom = sfrDoms.length >= 3
    ? Math.round(computeMedian(sfrDoms))
    : cache.median_dom

  const medianPriorPrice = priorPrices.length >= 3
    ? computeMedian(priorPrices)
    : null  // no fallback — only show YoY if we have verified data

  const yoyPct = (medianSalePrice && medianPriorPrice)
    ? ((medianSalePrice - medianPriorPrice) / medianPriorPrice) * 100
    : null

  const closedCount = sfrPrices.length || (cache.property_type_breakdown?.A?.count ?? cache.sold_count)

  // Sale-to-list from cache (accurate, pre-computed)
  const saleToList = cache.avg_sale_to_list_ratio
  const stlPct = saleToList != null ? (saleToList * 100) : null

  // Months of supply — use pulse if available; formula: active / (closed_6mo / 6)
  const mos = pulse?.months_of_supply ?? cache.months_of_supply ?? null
  const mosClass = mos == null ? null : mos < 4 ? 'sellers' : mos < 6 ? 'balanced' : 'buyers'

  // Active inventory
  const activeCount = pulse?.active_count ?? null
  const pendingCount = pulse?.pending_count ?? null
  const new30d = pulse?.new_count_30d ?? null

  // Cache extras
  const cashPct = cache.cash_purchase_pct ?? null
  const medianConcessions = cache.median_concessions_amount ?? null
  const momPrice = cache.mom_median_price_change_pct ?? null
  const momInventory = cache.mom_inventory_change_pct ?? null
  const totalVolume = cache.total_volume ?? null
  const marketHealthScore = cache.market_health_score ?? null
  const marketHealthLabel = cache.market_health_label ?? null
  const medianPpsf = cache.median_ppsf ?? null

  return {
    medianSalePrice,
    medianDom,
    medianPriorPrice,
    yoyPct,
    closedCount,
    stlPct,
    mos,
    mosClass,
    activeCount,
    pendingCount,
    new30d,
    cashPct,
    medianConcessions,
    momPrice,
    momInventory,
    totalVolume,
    marketHealthScore,
    marketHealthLabel,
    medianPpsf,
    sourceCounts: {
      sfrCurrentRows: sfrPrices.length,
      sfrPriorRows: priorPrices.length,
    },
  }
}

// ---------------------------------------------------------------------------
// Top neighborhoods
// ---------------------------------------------------------------------------

function topNeighborhoods(rows, limit = 5) {
  const counts = {}
  const prices = {}
  for (const r of rows) {
    const n = r['SubdivisionName']
    if (!n) continue
    counts[n] = (counts[n] || 0) + 1
    if (!prices[n]) prices[n] = []
    if (r['ClosePrice']) prices[n].push(r['ClosePrice'])
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      median: computeMedian(prices[name] || []),
    }))
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']

function fmtMoney(n) {
  if (n == null) return 'N/A'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtMoneyK(n) {
  if (n == null) return 'N/A'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  return '$' + Math.round(n / 1000) + 'K'
}

function fmtPct(n, decimals = 1) {
  if (n == null) return 'N/A'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}%`
}

// ---------------------------------------------------------------------------
// SEO Title + Meta (per skill §3.1, §3.2)
// ---------------------------------------------------------------------------

function buildTitle(cityConfig, period) {
  const [yr, mo] = period.split('-').map(Number)
  const monthLabel = MONTH_NAMES[mo - 1]
  // Pattern: "Bend Oregon Real Estate Market Report — April 2026 | Ryan Realty"
  // Must be ≤60 chars. Abbreviate month if needed.
  const full = `${cityConfig.display} Oregon Real Estate Market — ${monthLabel} ${yr} | Ryan Realty`
  if (full.length <= 60) return full
  const short = `${cityConfig.display} Market Report ${monthLabel} ${yr} | Ryan Realty`
  if (short.length <= 60) return short
  // Final fallback
  return `${cityConfig.display} Market Report ${yr} | Ryan Realty`.slice(0, 60)
}

function buildMetaDescription(cityConfig, period, stats) {
  const [yr, mo] = period.split('-').map(Number)
  const monthLabel = MONTH_NAMES[mo - 1]

  const priceStr = stats.medianSalePrice ? fmtMoneyK(stats.medianSalePrice) : null
  const yoyStr = stats.yoyPct != null ? ` (${fmtPct(stats.yoyPct)} year-over-year)` : ''

  let desc
  if (priceStr) {
    desc = `${cityConfig.display} median home price hit ${priceStr} in ${monthLabel} ${yr}${yoyStr}. Full market data: inventory, days on market, sale-to-list. Read the full report.`
  } else {
    desc = `${cityConfig.display}, Oregon real estate market data for ${monthLabel} ${yr}. Inventory, pricing, days on market — local stats from Ryan Realty.`
  }

  // Enforce 150-160 chars
  if (desc.length > 160) desc = desc.slice(0, 157) + '...'
  return desc
}

// ---------------------------------------------------------------------------
// JSON-LD blocks (per skill §3.5)
// ---------------------------------------------------------------------------

function buildJsonLd(cityConfig, period, stats, meta, heroUrl) {
  const [yr, mo] = period.split('-').map(Number)
  const monthLabel = MONTH_NAMES[mo - 1]
  const isoDate = new Date(`${period}-01`).toISOString()
  const canonical = `https://ryan-realty.com/market-report/${meta.citySlug}/${period}`

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.metaDescription,
    image: heroUrl || `https://ryan-realty.com/wp-content/uploads/market-report-${meta.citySlug}-${period}.jpg`,
    datePublished: isoDate,
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Person',
      name: 'Matt Ryan',
      url: 'https://ryan-realty.com/about/matt-ryan',
    },
    publisher: {
      '@type': 'RealEstateAgent',
      name: 'Ryan Realty',
      logo: {
        '@type': 'ImageObject',
        url: 'https://ryan-realty.com/wp-content/uploads/ryan-realty-logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
  }

  const place = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${cityConfig.display}, ${cityConfig.abbr}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: cityConfig.display,
      addressRegion: cityConfig.abbr,
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: cityConfig.latitude,
      longitude: cityConfig.longitude,
    },
  }

  // Video placeholder — orchestrator fills in the real YouTube URL post-render
  const video = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${cityConfig.display} Real Estate Market Report — ${monthLabel} ${yr}`,
    description: meta.metaDescription,
    thumbnailUrl: heroUrl || `https://ryan-realty.com/wp-content/uploads/market-report-${meta.citySlug}-${period}.jpg`,
    uploadDate: isoDate,
    duration: 'PT2M',  // Placeholder — update after YouTube upload
    contentUrl: '{{YOUTUBE_WATCH_URL}}',   // Orchestrator fills this
    embedUrl: '{{YOUTUBE_EMBED_URL}}',     // Orchestrator fills this
  }

  return [article, place, video]
}

// ---------------------------------------------------------------------------
// Content body builder
// ---------------------------------------------------------------------------

function buildPostMarkdown(cityConfig, period, stats, topNeighborhoodList, meta, heroAsset) {
  const [yr, mo] = period.split('-').map(Number)
  const monthLabel = MONTH_NAMES[mo - 1]
  const prevMonth = mo === 1 ? `${yr - 1}-12` : `${yr}-${String(mo - 1).padStart(2, '0')}`
  const prevMonthLabel = MONTH_NAMES[(mo === 1 ? 11 : mo - 2)]
  const cityName = cityConfig.display
  const citySlug = meta.citySlug

  // Hero image alt text per skill §3.9
  const heroAlt = stats.medianSalePrice
    ? `${cityName} real estate market overview ${monthLabel} ${yr} — median sale price ${fmtMoneyK(stats.medianSalePrice)}`
    : `${cityName} real estate market overview ${monthLabel} ${yr}`
  const heroUrl = heroAsset?.file_url || heroAsset?.source_url || null

  const mosLabel = stats.mosClass === 'sellers' ? "seller's market"
    : stats.mosClass === 'balanced' ? 'balanced market'
    : stats.mosClass === 'buyers' ? "buyer's market"
    : 'undetermined market conditions'

  const lines = []

  // ── Hero image (if available)
  if (heroUrl) {
    lines.push(`![${heroAlt}](${heroUrl})`)
    lines.push('')
  }

  // ── Lede paragraph
  const ledeParts = []
  if (stats.medianSalePrice) ledeParts.push(`the median sale price for a single-family home reached **${fmtMoney(stats.medianSalePrice)}**`)
  if (stats.yoyPct != null) ledeParts.push(`**${fmtPct(stats.yoyPct)} from the same month last year**`)
  if (stats.mos != null) ledeParts.push(`months of supply stood at **${stats.mos.toFixed(1)} months**, placing the market in ${mosLabel} territory`)

  if (ledeParts.length > 0) {
    lines.push(`In ${monthLabel} ${yr}, the ${cityName} single-family residential market showed clear directional data: ${ledeParts.join(', ')}. Here is the full breakdown, sourced directly from live MLS data.`)
  } else {
    lines.push(`This is the Ryan Realty monthly market report for ${cityName}, Oregon — covering ${monthLabel} ${yr}. All figures below come directly from live MLS data.`)
  }
  lines.push('')

  // ── YouTube video placeholder (above fold per skill §3.10)
  lines.push('## Watch the Market Report Video')
  lines.push('')
  lines.push('{{YOUTUBE_EMBED_URL}}')
  lines.push('')
  lines.push(`*Full video walkthrough of the ${cityName} ${monthLabel} ${yr} real estate market. Subscribe to the Ryan Realty YouTube channel for monthly updates.*`)
  lines.push('')

  // ── Median Sale Price
  lines.push('## Median Sale Price')
  lines.push('')
  if (stats.medianSalePrice) {
    const priceChangeStr = stats.yoyPct != null
      ? ` That is ${fmtPct(stats.yoyPct)} compared to ${monthLabel} ${yr - 1}.`
      : ''
    lines.push(`The median sale price for a closed single-family home in ${cityName} in ${monthLabel} ${yr} was **${fmtMoney(stats.medianSalePrice)}**.${priceChangeStr} This figure is based on **${stats.closedCount} closed transactions** during the period.`)
    if (stats.medianPpsf) {
      lines.push(``)
      lines.push(`Median price per square foot closed at **${fmtMoney(stats.medianPpsf)}/sqft**.`)
    }
  } else {
    lines.push(`Median sale price data for ${monthLabel} ${yr} is not yet available in the verified dataset.`)
  }
  lines.push('')
  lines.push(`<!-- citation: median sale price — Supabase listings table, PropertyType='A', StandardStatus='Closed', CloseDate ${meta.period.start}..${meta.period.end}, median(ClosePrice) = ${stats.medianSalePrice} over ${stats.closedCount} rows -->`)
  if (stats.yoyPct != null) {
    lines.push(`<!-- citation: YoY median — same query for ${meta.period.start.slice(0,4)-1}, prior median = ${fmtMoney(stats.medianPriorPrice)}, delta = ${fmtPct(stats.yoyPct)} -->`)
  }
  lines.push('')

  // ── Months of Supply
  lines.push('## Months of Supply')
  lines.push('')
  if (stats.mos != null) {
    const mosThreshold = stats.mosClass === 'sellers'
      ? 'Under 4 months signals a seller\'s market, where demand exceeds supply.'
      : stats.mosClass === 'balanced'
      ? 'Between 4 and 6 months is considered balanced territory.'
      : 'Above 6 months is a buyer\'s market, where supply outpaces demand.'

    lines.push(`Months of supply in ${cityName} was **${stats.mos.toFixed(1)} months** in ${monthLabel} ${yr}. ${mosThreshold} At **${stats.mos.toFixed(1)} months**, the market is classified as a **${mosLabel}**.`)
    lines.push('')
    lines.push(`The months of supply formula: active listings divided by average monthly closings over the prior 6 months. This metric gives the most reliable directional read on supply and demand balance.`)
  } else {
    lines.push(`Months of supply data for ${monthLabel} ${yr} is not yet available.`)
  }
  lines.push('')
  lines.push(`<!-- citation: months of supply — Supabase market_pulse_live, geo_slug=${citySlug}, property_type=A, months_of_supply = ${stats.mos} -->`)
  lines.push('')

  // ── Days on Market
  lines.push('## Days on Market')
  lines.push('')
  if (stats.medianDom != null) {
    lines.push(`The median cumulative days on market for closed SFR sales in ${cityName} was **${stats.medianDom} days** in ${monthLabel} ${yr}. This measures how long listings sat before going under contract.`)
    lines.push('')
    if (stats.stlPct != null) {
      lines.push(`Fast-moving listings that went pending within 7 days are included in this figure. When combined with a sale-to-list ratio of **${stats.stlPct.toFixed(1)}%**, the DOM reading gives a complete picture of negotiation dynamics.`)
    }
  } else {
    lines.push(`Median days on market data is not yet available for this period.`)
  }
  lines.push('')
  lines.push(`<!-- citation: median DOM — Supabase listings table, PropertyType='A', StandardStatus='Closed', CloseDate ${meta.period.start}..${meta.period.end}, median(CumulativeDaysOnMarket) = ${stats.medianDom} over ${stats.closedCount} rows -->`)
  lines.push('')

  // ── Sale-to-List Ratio
  lines.push('## Sale-to-List Ratio')
  lines.push('')
  if (stats.stlPct != null) {
    const stlContext = stats.stlPct >= 99
      ? 'Sellers received at or above asking price on median, leaving no room to negotiate.'
      : stats.stlPct >= 97
      ? 'Sellers received close to asking price. Buyers needed to come in with strong offers.'
      : stats.stlPct >= 95
      ? 'Buyers had limited room to negotiate below asking price.'
      : 'Buyers had meaningful negotiating leverage below the list price.'

    lines.push(`The median sale-to-list ratio in ${cityName} was **${stats.stlPct.toFixed(1)}%** in ${monthLabel} ${yr}. ${stlContext}`)
    lines.push('')
    lines.push(`This ratio compares the final closed price against the original list price for all SFR transactions during the period.`)
  } else {
    lines.push(`Sale-to-list ratio data is not available for this period.`)
  }
  lines.push('')
  lines.push(`<!-- citation: sale-to-list ratio — Supabase market_stats_cache, geo_slug=${citySlug}, period_start=${meta.period.start}, avg_sale_to_list_ratio = ${stats.stlPct != null ? (stats.stlPct / 100).toFixed(4) : 'null'} -->`)
  lines.push('')

  // ── Active Inventory
  lines.push('## Active Inventory')
  lines.push('')
  if (stats.activeCount != null) {
    const pendingStr = stats.pendingCount != null ? ` **${stats.pendingCount} listings** were under contract (pending).` : ''
    const new30dStr = stats.new30d != null ? ` **${stats.new30d} new listings** came to market in the prior 30 days.` : ''
    lines.push(`As of the reporting period, ${cityName} had **${stats.activeCount.toLocaleString()} active single-family listings** on the market.${pendingStr}${new30dStr}`)
    lines.push('')
    lines.push(`Active inventory is a leading indicator. Watch this number alongside pending volume to gauge near-term pricing pressure. See [all active ${cityName} SFR listings](/search/${cityConfig.searchSlug}).`)
  } else {
    lines.push(`Active inventory data is pulled from live MLS. Check back for the latest count at [${cityName} SFR listings](/search/${cityConfig.searchSlug}).`)
  }
  lines.push('')
  lines.push(`<!-- citation: active inventory — Supabase market_pulse_live, geo_slug=${citySlug}, property_type=A, active_count = ${stats.activeCount}, pending_count = ${stats.pendingCount}, new_count_30d = ${stats.new30d} -->`)
  lines.push('')

  // ── Price Segments (from cache price_band_counts)
  if (stats.priceBands) {
    lines.push('## Price Segments')
    lines.push('')
    lines.push(`Here is how closed sales in ${cityName} broke down by price band in ${monthLabel} ${yr}:`)
    lines.push('')
    for (const band of stats.priceBands) {
      lines.push(`- **${band.label}:** ${band.count} sales (${band.pct.toFixed(1)}%)`)
    }
    lines.push('')
    lines.push(`<!-- citation: price segments — Supabase market_stats_cache.price_band_counts, geo_slug=${citySlug}, period_start=${meta.period.start} -->`)
    lines.push('')
  }

  // ── Top Neighborhoods
  if (topNeighborhoodList.length > 0) {
    lines.push('## Top Neighborhoods by Closed Sales')
    lines.push('')
    lines.push(`Which ${cityName} subdivisions saw the most closed SFR transactions in ${monthLabel} ${yr}:`)
    lines.push('')
    for (const n of topNeighborhoodList) {
      const medStr = n.median ? ` — median price ${fmtMoney(n.median)}` : ''
      lines.push(`- **${n.name}**: ${n.count} closed sales${medStr}`)
    }
    lines.push('')
    if (topNeighborhoodList[0]?.name && cityConfig.neighborhoods?.includes(topNeighborhoodList[0].name)) {
      const slug = topNeighborhoodList[0].name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      lines.push(`${topNeighborhoodList[0].name} led ${cityName} in closed sales. See the [${topNeighborhoodList[0].name} neighborhood guide](/neighborhoods/${citySlug}/${slug}) for a deeper look at that area.`)
      lines.push('')
    }
    lines.push(`<!-- citation: top neighborhoods — Supabase listings table, PropertyType='A', StandardStatus='Closed', CloseDate ${meta.period.start}..${meta.period.end}, grouped by SubdivisionName, count per group -->`)
    lines.push('')
  }

  // ── Cash Purchases (if available)
  if (stats.cashPct != null) {
    lines.push('## Cash Purchases')
    lines.push('')
    const cashContext = stats.cashPct >= 35
      ? 'Cash buyers represent a significant share of this market.'
      : stats.cashPct >= 25
      ? 'A meaningful portion of buyers are paying cash.'
      : 'Most buyers are using financing, which is typical for this price range.'
    lines.push(`**${stats.cashPct.toFixed(1)}%** of closed SFR sales in ${cityName} during ${monthLabel} ${yr} were cash transactions. ${cashContext}`)
    lines.push('')
    lines.push(`<!-- citation: cash purchase % — Supabase market_stats_cache.cash_purchase_pct, geo_slug=${citySlug}, period_start=${meta.period.start}, value=${stats.cashPct} -->`)
    lines.push('')
  }

  // ── Seller Concessions (if available and non-zero)
  if (stats.medianConcessions != null && stats.medianConcessions > 0) {
    lines.push('## Seller Concessions')
    lines.push('')
    lines.push(`The median seller concession on closed transactions in ${cityName} was **${fmtMoney(stats.medianConcessions)}** in ${monthLabel} ${yr}. Sellers are providing credits to help buyers cover closing costs or buy down their rate.`)
    lines.push('')
    lines.push(`<!-- citation: seller concessions — Supabase market_stats_cache.median_concessions_amount, geo_slug=${citySlug}, period_start=${meta.period.start}, value=${stats.medianConcessions} -->`)
    lines.push('')
  }

  // ── Month-Over-Month (if available)
  if (stats.momPrice != null || stats.momInventory != null) {
    lines.push('## Month-Over-Month Trends')
    lines.push('')
    lines.push(`Comparing ${monthLabel} ${yr} to ${prevMonthLabel} ${mo === 1 ? yr - 1 : yr}:`)
    lines.push('')
    if (stats.momPrice != null) {
      lines.push(`- **Median price:** ${fmtPct(stats.momPrice)} month-over-month`)
    }
    if (stats.momInventory != null) {
      lines.push(`- **Inventory:** ${fmtPct(stats.momInventory)} month-over-month`)
    }
    lines.push('')
    lines.push(`See [last month's ${cityName} market report](/market-report/${citySlug}/${prevMonth}) for the ${prevMonthLabel} data.`)
    lines.push('')
    lines.push(`<!-- citation: month-over-month — Supabase market_stats_cache.mom_median_price_change_pct / mom_inventory_change_pct, geo_slug=${citySlug}, period_start=${meta.period.start} -->`)
    lines.push('')
  } else {
    // Still include internal link to prior month even without MoM data
    lines.push(`See [last month's ${cityName} market report](/market-report/${citySlug}/${prevMonth}) to compare ${prevMonthLabel} data.`)
    lines.push('')
  }

  // ── Closing paragraph + CTA
  lines.push('## Buyer and Seller Takeaways')
  lines.push('')
  const closingParts = []
  if (stats.mosClass === 'sellers') {
    closingParts.push(`**Buyers** in ${cityName} should expect competition. Come in prepared with pre-approval, a clear budget, and a realistic offer.`)
    closingParts.push(`**Sellers** hold the advantage. Price your home correctly and it will move. Overpricing still costs time.`)
  } else if (stats.mosClass === 'balanced') {
    closingParts.push(`**Buyers** have more options than in a tight seller's market, but well-priced homes are still moving.`)
    closingParts.push(`**Sellers** can expect reasonable offers, but inflated pricing will sit.`)
  } else if (stats.mosClass === 'buyers') {
    closingParts.push(`**Buyers** have negotiating room. Take your time and negotiate.`)
    closingParts.push(`**Sellers** need to price to the market. Overpriced listings are staying on the market longer.`)
  } else {
    closingParts.push(`The ${cityName} market is moving. Whether you are buying or selling, local data is your best tool.`)
  }

  for (const part of closingParts) lines.push(part)
  lines.push('')
  lines.push(`Ryan Realty tracks this market every month. For a personalized read on your home's value or a buyer strategy call, [contact Matt Ryan](https://ryan-realty.com/contact).`)
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2))

if (!args.city || !args.period) {
  console.error('Usage: node --env-file=.env.local scripts/build-blog-post.mjs --city bend --period 2026-04')
  console.error('  --city     City slug (bend, redmond, sisters, la-pine, sunriver, prineville)')
  console.error('  --period   YYYY-MM (e.g. 2026-04)')
  process.exit(1)
}

const citySlug = args.city.toLowerCase()
const period   = args.period

if (!CITY_CONFIG[citySlug]) {
  console.error(`Unknown city: ${citySlug}. Valid options: ${Object.keys(CITY_CONFIG).join(', ')}`)
  process.exit(1)
}

if (!/^\d{4}-\d{2}$/.test(period)) {
  console.error(`Invalid period format: ${period}. Use YYYY-MM (e.g. 2026-04)`)
  process.exit(1)
}

const cityConfig = CITY_CONFIG[citySlug]
const slug = `market-report/${citySlug}/${period}`
const outDir = resolve(ROOT, 'out', 'blog', slug)

console.log(`\nBuilding blog post: ${slug}`)
console.log(`Output: ${outDir}`)

// Pull data
const data = await pullData(citySlug, period)
const stats = computeStats(data)

// Add price bands from cache
const rawPriceBands = data.cache.price_band_counts
if (rawPriceBands) {
  const bandMap = {
    under_300k:   'Under $300K',
    '300k_500k':  '$300K – $500K',
    '500k_750k':  '$500K – $750K',
    '750k_1m':    '$750K – $1M',
    over_1m:      'Over $1M',
  }
  const totalClosed = Object.values(rawPriceBands).reduce((s, n) => s + (Number(n) || 0), 0)
  stats.priceBands = Object.entries(rawPriceBands)
    .filter(([, count]) => Number(count) > 0)
    .map(([key, count]) => ({
      label: bandMap[key] || key,
      count: Number(count),
      pct: totalClosed > 0 ? (Number(count) / totalClosed) * 100 : 0,
    }))
    .sort((a, b) => {
      const order = ['Under $300K', '$300K – $500K', '$500K – $750K', '$750K – $1M', 'Over $1M']
      return order.indexOf(a.label) - order.indexOf(b.label)
    })
}

const [yr, mo] = period.split('-').map(Number)
const monthLabel = MONTH_NAMES[mo - 1]

// Build meta
const title = buildTitle(cityConfig, period)
const metaDescription = buildMetaDescription(cityConfig, period, stats)

const meta = {
  title,
  metaDescription,
  slug,
  citySlug,
  period: data.period,
  categories: ['market-reports'],
  tags: [citySlug, String(yr), 'monthly-report', 'market-data', 'central-oregon'],
  ogType: 'article',
  canonical: `https://ryan-realty.com/${slug}`,
  openGraph: {
    'og:title': title,
    'og:description': metaDescription,
    'og:type': 'article',
    'og:url': `https://ryan-realty.com/${slug}`,
    'twitter:card': 'summary_large_image',
  },
  verificationTrace: {
    medianSalePrice: `Supabase listings, PropertyType='A', StandardStatus='Closed', CloseDate ${data.period.start}..${data.period.end}, median(ClosePrice) = ${stats.medianSalePrice} over ${stats.closedCount} rows`,
    medianDom: `Supabase listings, same filter, median(CumulativeDaysOnMarket) = ${stats.medianDom}`,
    monthsOfSupply: `Supabase market_pulse_live, geo_slug=${citySlug}, property_type=A, months_of_supply = ${stats.mos}`,
    saleToListRatio: `Supabase market_stats_cache, geo_slug=${citySlug}, period_start=${data.period.start}, avg_sale_to_list_ratio = ${stats.stlPct != null ? (stats.stlPct / 100).toFixed(4) : null}`,
    activeInventory: `Supabase market_pulse_live, geo_slug=${citySlug}, property_type=A, active_count = ${stats.activeCount}`,
    cashPurchasePct: stats.cashPct != null ? `Supabase market_stats_cache, geo_slug=${citySlug}, period_start=${data.period.start}, cash_purchase_pct = ${stats.cashPct}` : null,
    queriedAt: new Date().toISOString(),
    sourceRows: stats.sourceCounts,
  },
}

// Hero image from asset library
console.log('\nQuerying asset library for hero image...')
let heroAsset = null
try {
  const heroResults = await assetSearch({
    geo: cityConfig.geoSlugs,
    type: 'photo',
    subject: ['landscape'],
    limit: 1,
  })
  heroAsset = heroResults?.[0] || null
  if (heroAsset) {
    console.log(`  Hero image found: ${heroAsset.id} (${heroAsset.source})`)
  } else {
    console.log('  No hero image found in asset library — using placeholder.')
  }
} catch (e) {
  console.warn(`  Asset library search failed: ${e.message}`)
}

// Image alt text per skill §3.9
const heroAlt = stats.medianSalePrice
  ? `${cityConfig.display} real estate market overview ${monthLabel} ${yr} — median sale price ${fmtMoneyK(stats.medianSalePrice)}`
  : `${cityConfig.display} real estate market overview ${monthLabel} ${yr}`

meta.heroAsset = heroAsset ? {
  id: heroAsset.id,
  url: heroAsset.file_url || heroAsset.source_url || null,
  alt: heroAlt,
  source: heroAsset.source,
} : {
  id: null,
  url: null,
  alt: heroAlt,
  source: 'none — upload manually before publishing',
}

// Top neighborhoods
const topN = topNeighborhoods(data.neighborhoods, 5)

// Build content
const heroUrl = heroAsset?.file_url || heroAsset?.source_url || null
const markdownContent = buildPostMarkdown(cityConfig, period, stats, topN, meta, heroAsset)
const jsonLdBlocks = buildJsonLd(cityConfig, period, stats, meta, heroUrl)

// Banned-word grep (hard gate before write)
const bannedHits = grepBannedWords(markdownContent + ' ' + title + ' ' + metaDescription)
if (bannedHits.length > 0) {
  console.error('\nBANNED WORDS DETECTED — post will NOT be written until cleaned:')
  for (const w of bannedHits) console.error(`  "${w}"`)
  console.error('\nReview the content and remove banned words before proceeding.')
  process.exit(1)
}

// Title length check
if (title.length > 60) {
  console.error(`\nTitle too long: ${title.length} chars (max 60). Title: "${title}"`)
  process.exit(1)
}

// Meta description length check
if (metaDescription.length < 150 || metaDescription.length > 160) {
  console.warn(`\nMeta description length: ${metaDescription.length} chars (target 150-160). Review before publishing.`)
}

// Write outputs
await mkdir(outDir, { recursive: true })
await writeFile(resolve(outDir, 'post.md'), markdownContent)
await writeFile(resolve(outDir, 'metadata.json'), JSON.stringify(meta, null, 2))
await writeFile(resolve(outDir, 'json-ld.json'), JSON.stringify(jsonLdBlocks, null, 2))

console.log(`\nBlog post built successfully:`)
console.log(`  post.md      → ${resolve(outDir, 'post.md')}`)
console.log(`  metadata.json → ${resolve(outDir, 'metadata.json')}`)
console.log(`  json-ld.json  → ${resolve(outDir, 'json-ld.json')}`)
console.log(`\nVerification trace:`)
for (const [k, v] of Object.entries(meta.verificationTrace)) {
  if (v && typeof v === 'string') console.log(`  ${k}: ${v}`)
}
console.log(`\nNext: node --env-file=.env.local scripts/publish-blog.mjs --city ${citySlug} --period ${period}`)
