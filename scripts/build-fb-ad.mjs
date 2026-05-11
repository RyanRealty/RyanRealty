#!/usr/bin/env node
/**
 * Build a Facebook Lead-Gen ad spec from market cache data.
 *
 * Reads city + period data from Supabase market_stats_cache, generates
 * ad copy per SKILL.md §4.3 specs, runs a banned-word grep, and writes
 * the ad spec to out/fb-ad/<slug>/<period>/ad-spec.json.
 *
 * Usage:
 *   node --env-file=.env.local scripts/build-fb-ad.mjs --city bend --period 2026-04
 *   node --env-file=.env.local scripts/build-fb-ad.mjs --city bend --period 2026-04 --budget 50
 *
 * Options:
 *   --city    <city>      City slug (e.g. bend, redmond, sisters) [required]
 *   --period  <YYYY-MM>   Report period [required]
 *   --budget  <dollars>   Daily budget in dollars (default: 30)
 *   --radius  <miles>     Geo radius around city center (default: 25)
 *   --days    <n>         Campaign run length in days (default: 14)
 *   --dry-run             Print ad spec without writing to disk
 *
 * Output:
 *   out/fb-ad/<city>/<period>/ad-spec.json
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (Meta/FUB env vars are checked at ad creation time, not here)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) {
        out[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          out[a.slice(2)] = next
          i++
        } else {
          out[a.slice(2)] = true
        }
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const city = args.city?.toString().toLowerCase().trim()
const period = args.period?.toString().trim() // YYYY-MM
const dailyBudgetDollars = Number(args.budget ?? 30)
const geoRadius = Number(args.radius ?? 25)
const runDays = Number(args.days ?? 14)
const dryRun = !!args['dry-run']

if (!city) {
  console.error('Error: --city is required (e.g. --city bend)')
  process.exit(1)
}
if (!period || !/^\d{4}-\d{2}$/.test(period)) {
  console.error('Error: --period is required in YYYY-MM format (e.g. --period 2026-04)')
  process.exit(1)
}
if (isNaN(dailyBudgetDollars) || dailyBudgetDollars < 1) {
  console.error('Error: --budget must be a positive number')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Banned words (per CLAUDE.md + SKILL.md)
// ---------------------------------------------------------------------------

const BANNED_WORDS = [
  'stunning', 'nestled', 'boasts', 'charming', 'pristine', 'gorgeous',
  'breathtaking', 'must-see', 'dream home', 'meticulously maintained',
  "entertainer's dream", 'tucked away', 'hidden gem', 'truly', 'spacious',
  'cozy', 'luxurious', 'updated throughout', 'approximately', 'roughly',
  'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless',
  'comprehensive', 'elevate', 'unlock',
]

function bannedWordCheck(text, label) {
  const lower = text.toLowerCase()
  const hits = BANNED_WORDS.filter(w => lower.includes(w.toLowerCase()))
  if (hits.length > 0) {
    console.error(`\nBANNED WORD FAIL in ${label}: ${hits.join(', ')}`)
    console.error(`  Text: "${text}"`)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// City metadata (display name, lat/lng for geo targeting)
// ---------------------------------------------------------------------------

const CITY_META = {
  bend: { displayName: 'Bend', state: 'OR', lat: 44.0582, lng: -121.3153 },
  redmond: { displayName: 'Redmond', state: 'OR', lat: 44.2726, lng: -121.1490 },
  sisters: { displayName: 'Sisters', state: 'OR', lat: 44.2901, lng: -121.5490 },
  sunriver: { displayName: 'Sunriver', state: 'OR', lat: 43.8788, lng: -121.4354 },
  prineville: { displayName: 'Prineville', state: 'OR', lat: 44.2993, lng: -120.8340 },
  la_pines: { displayName: 'La Pine', state: 'OR', lat: 43.6679, lng: -121.5029 },
  'la-pine': { displayName: 'La Pine', state: 'OR', lat: 43.6679, lng: -121.5029 },
  tumalo: { displayName: 'Tumalo', state: 'OR', lat: 44.1626, lng: -121.3059 },
}

function getCityMeta(slug) {
  const meta = CITY_META[slug]
  if (!meta) {
    // Fallback: title-case the slug
    return {
      displayName: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      state: 'OR',
      lat: 44.0582,
      lng: -121.3153,
    }
  }
  return meta
}

// ---------------------------------------------------------------------------
// Period formatting
// ---------------------------------------------------------------------------

function formatPeriodDisplay(period) {
  // "2026-04" → "April 2026"
  const [year, month] = period.split('-')
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function formatHeadlinePeriod(period) {
  // "2026-04" → "Apr 2026" (fits within 27 char headline limit when prefixed with city)
  const [year, month] = period.split('-')
  const abbr = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec']
  return `${abbr[parseInt(month, 10) - 1]} ${year}`
}

// ---------------------------------------------------------------------------
// Supabase client (minimal — no createClient dep for a script)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }
  return { url: url.replace(/\/+$/, ''), key }
}

const CACHE_SELECT = [
  'geo_type',
  'geo_slug',
  'geo_label',
  'period_type',
  'period_start',
  'period_end',
  'sold_count',
  'median_sale_price',
  'median_dom',
  'avg_sale_to_list_ratio',
  'market_health_label',
  'yoy_median_price_delta_pct',
].join(',')

/** Map cache + pulse rows to fields expected by copy + verification_trace */
function normalizeMarketStat(row, pulseRow) {
  const activeListings = pulseRow?.active_count ?? null
  return {
    ...row,
    median_sale_price_yoy_pct: row.yoy_median_price_delta_pct,
    avg_days_on_market: row.median_dom,
    closed_count: row.sold_count,
    active_listings: activeListings,
    months_of_supply: null,
    market_condition: row.market_health_label,
    period_label: row.period_start,
    list_to_sale_ratio: row.avg_sale_to_list_ratio,
  }
}

async function fetchPulseActive(url, key, citySlug) {
  const qs = new URLSearchParams({
    select: 'active_count',
    geo_type: 'eq.city',
    geo_slug: `eq.${citySlug}`,
    property_type: 'eq.A',
    limit: '1',
  })
  const res = await fetch(`${url}/rest/v1/market_pulse_live?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const rows = await res.json().catch(() => [])
  return rows[0] ?? null
}

async function fetchMarketStats(citySlug, period) {
  const { url, key } = getSupabase()

  const [year, month] = period.split('-').map(Number)
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`

  const params = new URLSearchParams({
    select: CACHE_SELECT,
    geo_type: 'eq.city',
    geo_slug: `eq.${citySlug}`,
    period_type: 'eq.monthly',
    period_start: `eq.${periodStart}`,
    limit: '1',
  })

  const res = await fetch(`${url}/rest/v1/market_stats_cache?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => 'no body')
    throw new Error(`market_stats_cache query failed (HTTP ${res.status}): ${body}`)
  }

  let rows = await res.json()
  let row = rows[0]

  if (!row) {
    console.warn(`[build-fb-ad] No monthly row for ${citySlug} at ${periodStart}. Trying latest monthly...`)
    const fallbackParams = new URLSearchParams({
      select: CACHE_SELECT,
      geo_type: 'eq.city',
      geo_slug: `eq.${citySlug}`,
      period_type: 'eq.monthly',
      order: 'period_start.desc',
      limit: '1',
    })
    const fallback = await fetch(`${url}/rest/v1/market_stats_cache?${fallbackParams}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    })
    if (!fallback.ok) {
      const body = await fallback.text().catch(() => '')
      throw new Error(`market_stats_cache fallback failed (HTTP ${fallback.status}): ${body}`)
    }
    rows = await fallback.json()
    row = rows[0]
    if (!row) {
      throw new Error(
        `No market_stats_cache monthly data for city slug="${citySlug}". ` +
          `Refresh reporting cache first.`
      )
    }
    console.warn(`[build-fb-ad] Using latest cache row: period_start=${row.period_start}`)
  }

  const pulse = await fetchPulseActive(url, key, citySlug)
  return normalizeMarketStat(row, pulse)
}

// ---------------------------------------------------------------------------
// Ad copy generation
// ---------------------------------------------------------------------------

/**
 * Generate ad copy from market stats.
 * All numbers must come from the stat object — never hard-coded.
 *
 * Primary text: ≤125 chars
 * Headline: ≤27 chars
 * Description: ≤40 chars
 */
function generateAdCopy(stat, cityMeta, periodDisplay, headlinePeriod) {
  const city = cityMeta.displayName
  const price = stat.median_sale_price
  const yoy = stat.median_sale_price_yoy_pct

  if (!price) {
    throw new Error('Cannot generate ad copy: median_sale_price is null. Stat must be verified before ad build.')
  }

  // Format price: $699,000 → "$699K"
  const priceFormatted = formatPriceK(price)

  // Format YoY: positive = up, negative = down
  let yoyStr = ''
  if (yoy !== null && yoy !== undefined) {
    const abs = Math.abs(yoy).toFixed(1)
    yoyStr = yoy < 0 ? `down ${abs}% from last year` : `up ${abs}% from last year`
  }

  // Build primary text (≤125 chars for in-feed)
  // Example: "Bend's median home price hit $699K in April, down 13.4% from last year. Get the full breakdown — neighborhoods, days on market, and what it means for you."
  let primaryText
  if (yoyStr) {
    primaryText = `${city}'s median home price hit ${priceFormatted} in ${periodDisplay.split(' ')[0]}, ${yoyStr}. Get the full market breakdown: days on market, inventory, and what it means for buyers and sellers.`
  } else {
    primaryText = `${city}'s median home price was ${priceFormatted} in ${periodDisplay.split(' ')[0]}. Get the full market breakdown: days on market, inventory, and what it means for buyers and sellers.`
  }

  // Truncate if over 125 chars (soft boundary — Meta allows more but truncates display)
  if (primaryText.length > 125) {
    primaryText = `${city}'s median home price hit ${priceFormatted} in ${periodDisplay.split(' ')[0]}${yoyStr ? `, ${yoyStr}` : ''}. Free monthly market report inside.`
  }

  // Headline: ≤27 chars
  let headline = `${city} Market Report - ${headlinePeriod}`
  if (headline.length > 27) {
    headline = `${city} Market - ${headlinePeriod}`
    if (headline.length > 27) {
      headline = `${city} - ${headlinePeriod} Report`
      if (headline.length > 27) headline = headline.slice(0, 27)
    }
  }

  // Description: ≤40 chars
  const description = 'Free monthly market report'

  return { primaryText, headline, description }
}

function formatPriceK(price) {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`
  return `$${price.toLocaleString()}`
}

// ---------------------------------------------------------------------------
// Targeting spec (per SKILL.md §4.2)
// ---------------------------------------------------------------------------

function buildTargeting(cityMeta, geoRadius) {
  return {
    // Housing special ad category restricts zip/age/gender hyper-targeting,
    // but geo radius targeting is allowed.
    geo_locations: {
      custom_locations: [
        {
          latitude: cityMeta.lat,
          longitude: cityMeta.lng,
          radius: geoRadius,
          distance_unit: 'mile',
        },
      ],
    },
    age_min: 25,
    age_max: 65,
    // Gender: all (0 = all, 1 = male, 2 = female) — Housing requires all
    genders: [],
    // Flexible targeting: interests in real estate
    flexible_spec: [
      {
        interests: [
          { id: '6003107902433', name: 'Real estate' },
          { id: '6003397425735', name: 'Home buying' },
          { id: '6003107902459', name: 'Mortgage loan' },
          { id: '6003392810781', name: 'Real estate investing' },
        ],
      },
    ],
    // Exclusions: people with job title/interest in real estate agent/broker
    exclusions: {
      interests: [
        { id: '6003013946421', name: 'Real estate agent' },
        { id: '6003013944567', name: 'Real estate broker' },
      ],
    },
    // Device targeting: all devices
    device_platforms: ['mobile', 'desktop'],
    // Publisher platforms: Facebook + Instagram (placement-agnostic within HOUSING rules)
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed', 'video_feeds', 'story', 'reels'],
    instagram_positions: ['stream', 'story', 'reels'],
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Build FB Lead-Gen Ad Spec ===`)
  console.log(`City: ${city} | Period: ${period} | Budget: $${dailyBudgetDollars}/day | Radius: ${geoRadius}mi | Run: ${runDays} days`)
  if (dryRun) console.log('(dry-run — will not write to disk)')
  console.log()

  // 1. Pull market stats from Supabase
  console.log('[1/4] Fetching market stats from Supabase...')
  const stat = await fetchMarketStats(city, period)
  console.log(
    `      Found: ${stat.period_label || period} | median=$${stat.median_sale_price?.toLocaleString() ?? 'n/a'} yoy=${stat.median_sale_price_yoy_pct ?? 'n/a'}% active=${stat.active_listings ?? 'n/a'} dom=${stat.avg_days_on_market ?? 'n/a'}d`
  )

  const cityMeta = getCityMeta(city)
  const periodDisplay = formatPeriodDisplay(period)
  const headlinePeriod = formatHeadlinePeriod(period)

  // 2. Generate ad copy
  console.log('[2/4] Generating ad copy...')
  const copy = generateAdCopy(stat, cityMeta, periodDisplay, headlinePeriod)
  console.log(`      Primary text (${copy.primaryText.length} chars): "${copy.primaryText}"`)
  console.log(`      Headline (${copy.headline.length} chars): "${copy.headline}"`)
  console.log(`      Description (${copy.description.length} chars): "${copy.description}"`)

  // 3. Banned-word grep
  console.log('[3/4] Running banned-word check...')
  const allCopyClean = [
    bannedWordCheck(copy.primaryText, 'primary_text'),
    bannedWordCheck(copy.headline, 'headline'),
    bannedWordCheck(copy.description, 'description'),
  ].every(Boolean)

  if (!allCopyClean) {
    console.error('\nBanned word check FAILED. Fix copy before proceeding.')
    process.exit(1)
  }
  console.log('      Clean.')

  // 4. Build targeting
  const targeting = buildTargeting(cityMeta, geoRadius)

  // 5. Schedule: start_time = now (or launch time), end_time = +runDays
  const now = new Date()
  const endDate = new Date(now.getTime() + runDays * 24 * 60 * 60 * 1000)

  // 6. Assemble ad spec
  const slug = city.replace(/\s+/g, '-').toLowerCase()
  const campaignName = `RR Market Report - ${cityMeta.displayName} ${periodDisplay} Lead Gen`

  const adSpec = {
    version: 1,
    generated_at: now.toISOString(),
    city,
    city_display: cityMeta.displayName,
    period,
    period_display: periodDisplay,
    slug,
    campaign: {
      name: campaignName,
      objective: 'LEAD_GENERATION',
      special_ad_categories: ['HOUSING'],
      buying_type: 'AUCTION',
      status: 'PAUSED',
    },
    ad_set: {
      name: `${campaignName} - Ad Set`,
      optimization_goal: 'LEAD_GENERATION',
      billing_event: 'IMPRESSIONS',
      daily_budget_dollars: dailyBudgetDollars,
      daily_budget_cents: dailyBudgetDollars * 100,
      run_days: runDays,
      start_time: now.toISOString(),
      end_time: endDate.toISOString(),
      targeting,
    },
    creative: {
      primary_text: copy.primaryText,
      headline: copy.headline,
      description: copy.description,
      call_to_action_type: 'SIGN_UP',
    },
    ad: {
      name: `${campaignName} - Ad`,
      status: 'PAUSED',
    },
    // Data verification trace (per CLAUDE.md data accuracy rules)
    verification_trace: {
      source: 'Supabase market_stats_cache + market_pulse_live',
      tables: ['market_stats_cache', 'market_pulse_live'],
      filters: {
        geo_type: 'city',
        geo_slug: city,
        period_type: 'monthly',
        period_requested: period,
        period_row: stat.period_start,
      },
      values: {
        median_sale_price: stat.median_sale_price,
        median_sale_price_yoy_pct: stat.median_sale_price_yoy_pct,
        avg_days_on_market: stat.avg_days_on_market,
        active_listings: stat.active_listings,
        closed_count: stat.closed_count,
        market_condition: stat.market_condition,
      },
      fetched_at: now.toISOString(),
    },
    asset_library_search: {
      // Hints for create-fb-ad.mjs to find the rendered video
      type: 'render',
      geo: [slug, 'central-oregon'],
      subject: ['market-report', 'short-form'],
    },
  }

  // 7. Write output
  if (!dryRun) {
    const outDir = resolve(ROOT, 'out', 'fb-ad', slug, period)
    await mkdir(outDir, { recursive: true })
    const outPath = resolve(outDir, 'ad-spec.json')
    await writeFile(outPath, JSON.stringify(adSpec, null, 2))
    console.log(`\n[4/4] Ad spec written to: ${outPath}`)
    console.log('\nNext step:')
    console.log(`  node --env-file=.env.local scripts/create-fb-ad.mjs --city ${city} --period ${period}`)
    console.log(`  # Add --launch to flip to ACTIVE after creation`)
  } else {
    console.log('\n[4/4] Dry run — spec not written. Full spec:')
    console.log(JSON.stringify(adSpec, null, 2))
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('\n[build-fb-ad] Fatal error:', err.message || err)
  process.exit(1)
})
