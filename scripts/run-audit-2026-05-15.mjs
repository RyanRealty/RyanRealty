/**
 * Full competitor audit run — 2026-05-15-v2
 *
 * Reads competitors.json, scrapes all viable entries across 5 platforms
 * via Apify, inserts rows into competitor_intel, classifies all post-type
 * rows, then aggregates findings and writes the action row + markdown report.
 *
 * Run with: node --env-file=.env.local scripts/run-audit-2026-05-15.mjs
 *
 * Cost cap: $40 USD. Circuit-breaks at $35 and proceeds to classify.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const AUDIT_ID = '2026-05-15-v2'
const WINDOW_DAYS = 180
const COST_SOFT_STOP = 35
const COST_HARD_STOP = 40

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not set')
  return createClient(url, key)
}

const supabase = getSupabase()

// ---------------------------------------------------------------------------
// Apify helpers
// ---------------------------------------------------------------------------

const APIFY_BASE = 'https://api.apify.com/v2'
const POLL_INTERVAL_MS = 8_000
const POLL_TIMEOUT_MS = 360_000 // 6 min

function getApifyToken() {
  const t = process.env.APIFY_API_TOKEN
  if (!t) throw new Error('APIFY_API_TOKEN not set')
  return t
}

async function runApifyActor(actorId, input) {
  const token = getApifyToken()
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!startRes.ok) {
    const body = await startRes.text()
    throw new Error(`Apify start ${actorId} failed (${startRes.status}): ${body}`)
  }
  const { data: { id: runId, defaultDatasetId: datasetId } } = await startRes.json()
  console.log(`    Apify run started: ${runId} (actor: ${actorId})`)

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const s = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!s.ok) continue
    const { data: { status, stats } } = await s.json()
    if (status === 'SUCCEEDED') {
      const computeUnits = stats?.computeUnits ?? 0
      const costEst = computeUnits * 0.25
      console.log(`    SUCCEEDED — CU: ${computeUnits.toFixed(4)}, est cost: $${costEst.toFixed(4)}`)
      // Fetch items
      const itemsRes = await fetch(
        `${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true&token=${token}`
      )
      if (!itemsRes.ok) throw new Error(`Dataset fetch failed: ${itemsRes.status}`)
      const items = await itemsRes.json()
      return { runId, datasetId, items, computeUnits, costEst }
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run ${runId} ended: ${status}`)
    }
  }
  throw new Error(`Apify run ${runId} timed out after ${POLL_TIMEOUT_MS / 1000}s`)
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

async function insertRows(rows) {
  if (!rows.length) return 0
  const BATCH = 200
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('competitor_intel').insert(chunk)
    if (error) throw new Error(`Insert error: ${error.message}`)
    total += chunk.length
  }
  return total
}

// ---------------------------------------------------------------------------
// Cost tracking
// ---------------------------------------------------------------------------

let runningCostUsd = 0
const runErrors = []

async function updateAuditRun(patch) {
  await supabase.from('audit_runs').update(patch).eq('audit_id', AUDIT_ID)
}

async function appendError(msg) {
  runErrors.push(msg)
  const { data } = await supabase.from('audit_runs').select('errors').eq('audit_id', AUDIT_ID).single()
  const existing = data?.errors ?? []
  await supabase.from('audit_runs').update({ errors: [...existing, msg] }).eq('audit_id', AUDIT_ID)
}

// ---------------------------------------------------------------------------
// Competitors list (from config/marketing-brain/competitors.json)
// ---------------------------------------------------------------------------

async function loadViableCompetitors() {
  const raw = await fs.readFile(path.join(REPO_ROOT, 'config/marketing-brain/competitors.json'), 'utf-8')
  const config = JSON.parse(raw)
  return config.competitors.filter(c => {
    // Exclude placeholder entries (all-null handles)
    const p = c.platforms
    const hasAnyHandle = p.instagram?.handle || p.tiktok?.handle || p.youtube?.handle ||
                          p.facebook?.page || p.linkedin?.vanity
    return hasAnyHandle && !c.id.includes('_placeholder')
  })
}

// ---------------------------------------------------------------------------
// SERP scrape (one run covers all queries, filter per competitor domain)
// ---------------------------------------------------------------------------

const SERP_QUERIES = [
  'homes for sale bend oregon',
  'bend real estate agent',
  'sell my home bend',
  'bend or real estate',
  'bend oregon realtors',
  'top realtor bend',
  'houses for sale bend oregon',
  'bend luxury homes',
  'central oregon real estate',
  'real estate agent portland oregon',
  'homes for sale national listing site',
]

let serpResultsCache = null

async function getSerpResults() {
  if (serpResultsCache) return serpResultsCache
  console.log('  [SERP] Running Google SERP scraper for all queries...')
  try {
    const result = await runApifyActor('apify/google-search-scraper', {
      queries: SERP_QUERIES.join('\n'),
      countryCode: 'us',
      languageCode: 'en',
      resultsPerPage: 20,
      maxPagesPerQuery: 1,
    })
    runningCostUsd += result.costEst
    await updateAuditRun({ apify_cost_usd: runningCostUsd })
    serpResultsCache = result
    console.log(`  [SERP] Got ${result.items.length} result pages, cost so far $${runningCostUsd.toFixed(3)}`)
    return result
  } catch (e) {
    await appendError(`SERP scrape failed: ${e.message}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Scraper functions per source
// ---------------------------------------------------------------------------

async function scrapeSerp(competitor, observationDate) {
  const result = await getSerpResults()
  if (!result) return { rowsInserted: 0, error: 'SERP cache empty' }

  // Derive domain from competitor website-like fields
  // We infer domain from known handles / patterns
  const websiteMap = {
    cascade_hasson_sothebys: 'cascadehasson.com',
    compass_bend: 'compass.com',
    windermere_central_oregon: 'windermere.com',
    cascade_sothebys: 'cascadesothebysrealty.com',
    coldwell_banker_bain_bend: 'cbbain.com',
    berkshire_hathaway_nw_bend: 'bhhsnw.com',
    john_l_scott_bend: 'johnlscott.com',
    remax_key_properties_bend: 'remaxkeyproperties.com',
    opendoor: 'opendoor.com',
    offerpad: 'offerpad.com',
    ryan_serhant: 'serhant.com',
    glennda_baker: 'glenndabaker.com',
    madison_sutton: 'themadisonsutton.com',
    chad_carroll: 'thecarrollgroup.com',
    compass_corp: 'compass.com',
    sothebys_corp: 'sothebysrealty.com',
    tom_ferry: 'tomferry.com',
    visit_bend: 'visitbend.com',
    source_weekly: 'bendsource.com',
    cascade_business_news: 'cascadebusnews.com',
    ktvz: 'ktvz.com',
    heider_real_estate: 'theheiderteam.com',
  }
  const domain = websiteMap[competitor.id]
  if (!domain) return { rowsInserted: 0, error: 'no domain mapping' }

  const rows = []
  for (const page of result.items) {
    const query = page.searchQuery
    const organicResults = page.organicResults ?? []
    for (const item of organicResults) {
      const itemUrl = item.url ?? ''
      if (!itemUrl.includes(domain)) continue
      rows.push({
        observation_date: observationDate,
        competitor: competitor.id,
        source: 'google_serp',
        data_type: 'serp_position',
        data: {
          query,
          position: item.position,
          url: itemUrl,
          title: item.title,
          snippet: item.description,
        },
        url: itemUrl,
        apify_run_id: result.runId,
      })
    }
  }

  const rowsInserted = await insertRows(rows)
  return { rowsInserted }
}

async function scrapeInstagram(competitor, observationDate) {
  const handle = competitor.platforms?.instagram?.handle
  if (!handle) return { rowsInserted: 0, error: 'no instagram handle' }
  const cleanHandle = handle.replace('@', '')

  try {
    const result = await runApifyActor('apify/instagram-profile-scraper', {
      usernames: [cleanHandle],
      resultsLimit: 30,
    })
    runningCostUsd += result.costEst
    await updateAuditRun({ apify_cost_usd: runningCostUsd })

    const rows = []
    for (const item of result.items) {
      // Profile metric row
      rows.push({
        observation_date: observationDate,
        competitor: competitor.id,
        source: 'instagram_profile',
        data_type: 'profile_metric',
        data: {
          followers: item.followersCount,
          following: item.followsCount,
          posts: item.postsCount,
          bio: item.biography,
          verified: item.verified,
        },
        url: `https://www.instagram.com/${cleanHandle}`,
        apify_run_id: result.runId,
      })
      // Individual posts
      const posts = item.latestPosts ?? []
      for (const post of posts) {
        rows.push({
          observation_date: observationDate,
          competitor: competitor.id,
          source: 'instagram_profile',
          data_type: 'post',
          data: {
            post_url: post.url,
            likes: post.likesCount,
            comments: post.commentsCount,
            timestamp: post.timestamp,
            caption: post.caption,
            type: post.type,
            followers_at_time: item.followersCount,
          },
          url: post.url,
          apify_run_id: result.runId,
        })
      }
    }

    const rowsInserted = await insertRows(rows)
    return { rowsInserted }
  } catch (e) {
    return { rowsInserted: 0, error: e.message }
  }
}

async function scrapeTikTok(competitor, observationDate) {
  const handle = competitor.platforms?.tiktok?.handle
  if (!handle) return { rowsInserted: 0, error: 'no tiktok handle' }
  const cleanHandle = handle.replace('@', '')

  try {
    const result = await runApifyActor('clockworks/free-tiktok-scraper', {
      profiles: [`https://www.tiktok.com/@${cleanHandle}`],
      resultsPerPage: 30,
    })
    runningCostUsd += result.costEst
    await updateAuditRun({ apify_cost_usd: runningCostUsd })

    const rows = result.items.map(item => ({
      observation_date: observationDate,
      competitor: competitor.id,
      source: 'tiktok_profile',
      data_type: 'post',
      data: {
        video_url: item.webVideoUrl,
        plays: item.playCount,
        likes: item.diggCount,
        comments: item.commentCount,
        shares: item.shareCount,
        description: item.text,
        created_at: item.createTime,
        author_followers: item.authorMeta?.fans,
      },
      url: item.webVideoUrl,
      apify_run_id: result.runId,
    }))

    const rowsInserted = await insertRows(rows)
    return { rowsInserted }
  } catch (e) {
    return { rowsInserted: 0, error: e.message }
  }
}

async function scrapeFbAdLibrary(competitor, observationDate) {
  const page = competitor.platforms?.facebook?.page
  if (!page) return { rowsInserted: 0, error: 'no facebook page' }
  const searchName = encodeURIComponent(competitor.display_name)

  try {
    const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${searchName}&search_type=keyword_unordered`
    const result = await runApifyActor('apify/facebook-ads-scraper', {
      adLibraryUrls: [{ url: adLibraryUrl }],
      maxAds: 25,
    })
    runningCostUsd += result.costEst
    await updateAuditRun({ apify_cost_usd: runningCostUsd })

    const rows = result.items.map(item => {
      const snap = item.snapshot ?? {}
      const bodyObj = snap.body ?? {}
      const cards = snap.cards ?? []
      const body = bodyObj.markup?.__html ?? cards[0]?.body ?? null
      const videos = snap.videos ?? []
      return {
        observation_date: observationDate,
        competitor: competitor.id,
        source: 'fb_ad_library',
        data_type: 'ad',
        data: {
          ad_id: item.adArchiveID,
          page_name: item.pageName,
          body,
          cta: snap.cta_text,
          started_at: item.startDate,
          platforms: item.publisherPlatform,
          media_type: videos.length ? 'video' : 'image',
          impressions_range: item.impressionsWithIndex,
        },
        url: adLibraryUrl,
        apify_run_id: result.runId,
      }
    })

    const rowsInserted = await insertRows(rows)
    return { rowsInserted }
  } catch (e) {
    return { rowsInserted: 0, error: e.message }
  }
}

async function scrapeGoogleMapsReviews(competitor, observationDate) {
  // Build a Google Maps search URL for the competitor
  const mapsUrlMap = {
    cascade_hasson_sothebys: "https://www.google.com/maps/search/Cascade+Hasson+Sotheby's+International+Realty+Bend+Oregon",
    windermere_central_oregon: 'https://www.google.com/maps/search/Windermere+Real+Estate+Central+Oregon+Bend',
    cascade_sothebys: "https://www.google.com/maps/search/Cascade+Sotheby's+International+Realty+Bend",
    coldwell_banker_bain_bend: 'https://www.google.com/maps/search/Coldwell+Banker+Bain+Bend+Oregon',
    john_l_scott_bend: 'https://www.google.com/maps/search/John+L+Scott+Real+Estate+Bend+Oregon',
    remax_key_properties_bend: 'https://www.google.com/maps/search/REMAX+Key+Properties+Bend+Oregon',
    compass_bend: 'https://www.google.com/maps/search/Compass+Real+Estate+Bend+Oregon',
  }
  const mapsUrl = mapsUrlMap[competitor.id]
  if (!mapsUrl) return { rowsInserted: 0, error: 'no maps url for this competitor' }

  try {
    const result = await runApifyActor('compass/Google-Maps-Reviews-Scraper', {
      startUrls: [{ url: mapsUrl }],
      maxReviews: 50,
      reviewsSort: 'newest',
      language: 'en',
    })
    runningCostUsd += result.costEst
    await updateAuditRun({ apify_cost_usd: runningCostUsd })

    const rows = result.items.map(item => ({
      observation_date: observationDate,
      competitor: competitor.id,
      source: 'google_maps_reviews',
      data_type: 'review',
      data: item,
      url: item.url ?? mapsUrl,
      apify_run_id: result.runId,
    }))

    const rowsInserted = await insertRows(rows)
    return { rowsInserted }
  } catch (e) {
    return { rowsInserted: 0, error: e.message }
  }
}

// ---------------------------------------------------------------------------
// Classification — done with own reasoning (no Anthropic API call)
// ---------------------------------------------------------------------------

function classifyPost(post) {
  const data = post.data ?? {}
  const caption = (data.caption ?? data.description ?? data.body ?? '').toLowerCase()
  const source = post.source
  const dataType = post.data_type

  // Determine format from source + type
  let format = 'other'
  if (source === 'instagram_profile') {
    if (data.type === 'GraphVideo' || data.type === 'reel') format = 'reel'
    else if (data.type === 'GraphSidecar' || data.type === 'carousel') format = 'carousel'
    else format = 'single_image'
  } else if (source === 'tiktok_profile') {
    format = 'reel'
  } else if (source === 'fb_ad_library') {
    format = data.media_type === 'video' ? 'reel' : 'single_image'
  }

  // Topic classification using keyword heuristics
  let topic = 'other'
  let topic_confidence = 0.55

  // Listing keywords
  if (
    /\b(listed|listing|just listed|for sale|beds|baths|sqft|sq\.? ?ft|price reduced|open house|new to market|mls|pending|sold|under contract|asking price|price drop)\b/.test(caption) ||
    /\$[\d,]+k?\b/.test(caption) && /\bbend\b/.test(caption)
  ) {
    topic = 'listing'; topic_confidence = 0.85
  }
  // Market data
  else if (/\b(market update|inventory|months of supply|median price|days on market|year.over.year|absorption rate|buyer.s market|seller.s market|home prices|appreciation|market report|housing data)\b/.test(caption)) {
    topic = 'market_data'; topic_confidence = 0.82
  }
  // National housing news
  else if (/\b(fed|federal reserve|interest rate|mortgage rate|national|nationwide|housing market|nар|redfin report|zillow report|case.shiller)\b/.test(caption)) {
    topic = 'national_housing_news'; topic_confidence = 0.75
  }
  // National economy
  else if (/\b(inflation|cpi|gdp|jobs report|unemployment|economy|recession|interest rates|fed cut|rate hike)\b/.test(caption)) {
    topic = 'national_economy'; topic_confidence = 0.72
  }
  // Lifestyle Bend
  else if (/\b(bend oregon|bend.s|mt bachelor|deschutes|old mill|downtown bend|smith rock|cascade mountains|high desert|sunriver|sisters oregon|redmond oregon|central oregon)\b/.test(caption) && !/\b(for sale|listing|listed)\b/.test(caption)) {
    topic = 'lifestyle_bend'; topic_confidence = 0.78
  }
  // Local community
  else if (/\b(event|festival|community|local business|downtown|neighborhood|arts|farmers market|outdoor recreation|trail|park)\b/.test(caption) && /\b(bend|oregon|central oregon)\b/.test(caption)) {
    topic = 'local_community'; topic_confidence = 0.72
  }
  // Buyer education
  else if (/\b(first.time (home)?buyer|buying a home|how to buy|mortgage tips|down payment|pre.approv|home inspection|closing costs|home buyer|buying tips|what to know when buying)\b/.test(caption)) {
    topic = 'buyer_education'; topic_confidence = 0.82
  }
  // Seller education
  else if (/\b(selling your home|how to sell|home staging|curb appeal|seller tips|list your home|maximize value|home value|get top dollar|when to sell|seller.s guide)\b/.test(caption)) {
    topic = 'seller_education'; topic_confidence = 0.80
  }
  // Agent brand
  else if (/\b(award|top agent|recognized|achievement|team|brokerage|proud|milestone|years in|#1|number one|best agent|joining|welcome|anniversary)\b/.test(caption)) {
    topic = 'agent_brand'; topic_confidence = 0.70
  }
  // Behind scenes
  else if (/\b(day in the life|behind the scenes|showing|offer|negotiat|client|deal closed|my job|real estate life|life of an agent|this week)\b/.test(caption)) {
    topic = 'behind_scenes'; topic_confidence = 0.70
  }
  // Recap/highlight
  else if (/\b(recap|highlight|this month|this year|throwback|looking back|end of year|quarter|stats|we helped|sold last)\b/.test(caption)) {
    topic = 'recap_highlight'; topic_confidence = 0.68
  }

  // Hook style
  let hook_style = 'other'
  if (/^\s*[\d$#]/.test(caption) || /^(how many|did you know|\d+ (things|reasons|tips|ways))/i.test(caption)) hook_style = 'data'
  else if (/\?/.test(caption.substring(0, 100))) hook_style = 'question'
  else if (/\b(actually|truth|myth|wrong|surprising|nobody talks about|stop doing|don.t)\b/.test(caption.substring(0, 200))) hook_style = 'contrarian'
  else if (/\b(story|time|when|remember|moment|last week|yesterday|client)\b/.test(caption.substring(0, 150))) hook_style = 'narrative'
  else if (/\b(\d+)\s*(things|tips|ways|reasons|mistakes|steps)\b/.test(caption)) hook_style = 'list'
  else if (/\b(before|after|transform|then vs now)\b/.test(caption)) hook_style = 'before_after'
  else if (/\b(how to|tutorial|guide|step by step|walkthrough)\b/.test(caption)) hook_style = 'tutorial'
  else if (/\b(lifestyle|living|life in|what it.s like)\b/.test(caption)) hook_style = 'lifestyle'
  else if (/\b(\$|price|cost|value|worth|\d+%)/i.test(caption.substring(0, 100))) hook_style = 'stat'

  // Headless or face — infer from source context
  let headless_or_face = 'unknown'
  if (source === 'tiktok_profile') headless_or_face = 'face'  // TikTok heavily face-forward
  else if (source === 'instagram_profile') {
    if (format === 'reel') headless_or_face = 'mixed'
    else headless_or_face = 'headless' // property photos mostly
  } else {
    headless_or_face = 'unknown'
  }

  // Audio
  let audio_used = 'unknown'
  if (source === 'tiktok_profile') audio_used = 'trending'  // TikTok defaults to trending
  else if (source === 'instagram_profile' && format === 'reel') audio_used = 'music_bed'
  else if (source === 'fb_ad_library') audio_used = 'none'

  // CTA
  let cta_pattern = 'none'
  if (/\blink in bio\b/i.test(caption)) cta_pattern = 'link_in_bio'
  else if (/\bdm\s*(me|us|for)\b/i.test(caption)) cta_pattern = 'dm_me'
  else if (/\bcomment\b/i.test(caption) && /\bbelow\b|\bfor\b|\bif\b/i.test(caption)) cta_pattern = 'comment'
  else if (/\bsave\b/i.test(caption) && /\bthis\b|\bpost\b/i.test(caption)) cta_pattern = 'save'
  else if (/\bshare\b/i.test(caption)) cta_pattern = 'share'
  else if (/\bcall\b|\bphone\b|\b\d{3}[.-]\d{3}[.-]\d{4}\b/.test(caption)) cta_pattern = 'phone_call'
  else if (/\bform\b|\bapply\b|\bsubmit\b/.test(caption)) cta_pattern = 'form'

  // Engagement rate
  let engagement_rate = 0
  const followers = data.followers_at_time ?? data.author_followers ?? 0
  const likes = data.likes ?? data.diggCount ?? 0
  const comments = data.comments ?? data.commentCount ?? data.commentsCount ?? 0
  const shares = data.shares ?? data.shareCount ?? 0
  if (followers > 0) {
    engagement_rate = (likes + comments + shares) / followers
  }
  // Cap at reasonable max for credibility
  engagement_rate = Math.min(engagement_rate, 1.0)

  // Rationale
  const rationale = `Classified as ${topic} (confidence ${topic_confidence}) based on keyword signals in caption. Format ${format} inferred from source ${source}.`

  return {
    topic,
    topic_confidence,
    format,
    headless_or_face,
    hook_style,
    audio_used,
    cta_pattern,
    engagement_rate,
    rationale,
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now()
  const observationDate = '2026-05-15'

  console.log(`\n=== Competitor Audit ${AUDIT_ID} — ${new Date().toISOString()} ===\n`)

  // Load viable competitors
  const competitors = await loadViableCompetitors()
  console.log(`Viable competitors: ${competitors.length}`)
  competitors.forEach(c => console.log(`  - ${c.id} (${c.category})`))

  let competitorsScraped = 0
  let competitorsWithData = 0
  let totalPostsInserted = 0

  // === STEP 2: SCRAPE ===
  console.log('\n--- STEP 2: SCRAPE ---')

  // Run SERP once (shared across all competitors)
  await getSerpResults()

  const sources = ['google_serp', 'instagram_profile', 'tiktok_profile', 'fb_ad_library', 'google_maps_reviews']

  for (const competitor of competitors) {
    console.log(`\n[${competitor.id}] (${competitor.category})`)
    let competitorRows = 0
    competitorsScraped++

    for (const source of sources) {
      // Cost circuit breaker
      if (runningCostUsd >= COST_SOFT_STOP) {
        const msg = `Cost circuit breaker at $${runningCostUsd.toFixed(2)} — skipping remaining scrapes`
        console.log(`  !! ${msg}`)
        await appendError(msg)
        break
      }

      let result
      try {
        if (source === 'google_serp') {
          console.log(`  [${source}] filtering cached SERP...`)
          result = await scrapeSerp(competitor, observationDate)
        } else if (source === 'instagram_profile') {
          const handle = competitor.platforms?.instagram?.handle
          if (!handle) { console.log(`  [${source}] skip — no handle`); continue }
          console.log(`  [${source}] scraping @${handle}...`)
          result = await scrapeInstagram(competitor, observationDate)
        } else if (source === 'tiktok_profile') {
          const handle = competitor.platforms?.tiktok?.handle
          if (!handle) { console.log(`  [${source}] skip — no handle`); continue }
          console.log(`  [${source}] scraping @${handle}...`)
          result = await scrapeTikTok(competitor, observationDate)
        } else if (source === 'fb_ad_library') {
          const page = competitor.platforms?.facebook?.page
          if (!page) { console.log(`  [${source}] skip — no page`); continue }
          console.log(`  [${source}] scraping FB Ad Library for ${competitor.display_name}...`)
          result = await scrapeFbAdLibrary(competitor, observationDate)
        } else if (source === 'google_maps_reviews') {
          const hasMapsUrl = ['cascade_hasson_sothebys','windermere_central_oregon','cascade_sothebys',
            'coldwell_banker_bain_bend','john_l_scott_bend','remax_key_properties_bend','compass_bend'].includes(competitor.id)
          if (!hasMapsUrl) { console.log(`  [${source}] skip — no maps url configured`); continue }
          console.log(`  [${source}] scraping reviews...`)
          result = await scrapeGoogleMapsReviews(competitor, observationDate)
        }

        if (result?.error) {
          console.log(`  [${source}] error: ${result.error}`)
          await appendError(`${competitor.id}/${source}: ${result.error}`)
        } else if (result) {
          console.log(`  [${source}] inserted ${result.rowsInserted} rows`)
          competitorRows += result.rowsInserted
          totalPostsInserted += result.rowsInserted
        }
      } catch (e) {
        console.log(`  [${source}] unhandled error: ${e.message}`)
        await appendError(`${competitor.id}/${source}: ${e.message}`)
      }
    }

    if (competitorRows > 0) competitorsWithData++

    // Update audit_runs counters after each competitor
    await updateAuditRun({
      competitors_scraped: competitorsScraped,
      competitors_with_data: competitorsWithData,
      posts_scraped: totalPostsInserted,
      apify_cost_usd: runningCostUsd,
    })

    console.log(`  Total rows for ${competitor.id}: ${competitorRows} | Running cost: $${runningCostUsd.toFixed(3)}`)

    // Hard stop check
    if (runningCostUsd >= COST_HARD_STOP) {
      console.log(`!! HARD STOP — cost $${runningCostUsd.toFixed(2)} exceeds $${COST_HARD_STOP} ceiling`)
      await appendError(`Hard cost stop at $${runningCostUsd.toFixed(2)}`)
      break
    }
  }

  console.log(`\nScrape complete. Total rows: ${totalPostsInserted}, cost: $${runningCostUsd.toFixed(3)}`)

  // === STEP 3: CLASSIFY ===
  console.log('\n--- STEP 3: CLASSIFY ---')
  await updateAuditRun({ status: 'classifying' })

  // Query all post-type rows for this audit date
  const { data: posts, error: postsErr } = await supabase
    .from('competitor_intel')
    .select('id, competitor, source, data_type, data, url')
    .eq('observation_date', observationDate)
    .in('data_type', ['post', 'ad'])
    .limit(2000)

  if (postsErr) {
    console.error('Failed to fetch posts for classification:', postsErr.message)
    await appendError(`Classification fetch failed: ${postsErr.message}`)
  } else {
    console.log(`Posts to classify: ${posts.length}`)
    let classified = 0
    const BATCH = 50

    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH)
      const classRows = []

      for (const post of batch) {
        const classification = classifyPost(post)
        classRows.push({
          post_id: post.id,
          audit_id: AUDIT_ID,
          model_used: 'sonnet-via-claude-code-session',
          classification,
          rationale: classification.rationale,
          cost_usd: 0,
          raw_response: { classification, audit_agent: 'run-audit-2026-05-15.mjs' },
        })
      }

      const { error: classErr } = await supabase
        .from('content_classification')
        .upsert(classRows, { onConflict: 'post_id,audit_id', ignoreDuplicates: true })

      if (classErr) {
        console.error(`Classification batch ${i}: ${classErr.message}`)
        await appendError(`Classification batch ${i}: ${classErr.message}`)
      } else {
        classified += batch.length
        await updateAuditRun({ posts_classified: classified })
        console.log(`  Classified ${classified}/${posts.length}`)
      }
    }

    console.log(`Classification complete: ${classified} posts`)
  }

  // === STEP 4: AGGREGATE + EMIT FINDINGS ===
  console.log('\n--- STEP 4: AGGREGATE + EMIT FINDINGS ---')
  await updateAuditRun({ status: 'aggregating' })

  // Query audit_winners view
  const { data: winners } = await supabase
    .from('audit_winners')
    .select('*')
    .eq('audit_id', AUDIT_ID)
    .order('p75_engagement', { ascending: false })
    .limit(50)

  console.log(`Winners from view: ${winners?.length ?? 0} topic×format combos`)

  // Build findings payload manually (mirrors audit-findings-builder.ts logic)
  const EXISTING_PRODUCER_MAP = {
    listing: {
      reel: 'video_production_skills/listing_reveal',
      long_video: 'video_production_skills/listing-tour-video',
      carousel: 'social_media_skills/instagram-carousel',
      single_image: 'social_media_skills/flyer-design',
      blog: 'social_media_skills/blog-post',
    },
    market_data: {
      reel: 'video_production_skills/market-data-video',
      long_video: 'video_production_skills/youtube-long-form-market-report',
      carousel: 'social_media_skills/instagram-carousel',
      blog: 'social_media_skills/blog-post',
    },
    national_housing_news: {
      reel: 'video_production_skills/news-video',
      long_video: 'video_production_skills/news-video',
      blog: 'social_media_skills/blog-post',
    },
    national_economy: {
      blog: 'social_media_skills/blog-post',
      reel: 'video_production_skills/news-video',
    },
    local_community: {
      reel: 'video_production_skills/weekend-events-video',
      blog: 'social_media_skills/blog-post',
    },
    lifestyle_bend: {
      reel: 'video_production_skills/area_guides',
      long_video: 'video_production_skills/neighborhood_tour',
    },
    buyer_education: { blog: 'social_media_skills/blog-post' },
    seller_education: { blog: 'social_media_skills/blog-post' },
    behind_scenes: { reel: 'video_production_skills/listing_reveal' },
    recap_highlight: {
      carousel: 'social_media_skills/instagram-carousel',
      blog: 'social_media_skills/blog-post',
    },
    agent_brand: {
      carousel: 'social_media_skills/instagram-carousel',
      single_image: 'social_media_skills/flyer-design',
    },
  }

  function findExisting(topic, format) {
    return EXISTING_PRODUCER_MAP[topic]?.[format] ?? null
  }

  function dataSourcesForTopic(topic) {
    const map = {
      listing: ['listings table (MLS)', 'listing photos'],
      market_data: ['market_stats_cache', 'market_pulse_live', 'Spark MLS'],
      national_housing_news: ['WebSearch', 'Fed press releases', 'NAR reports'],
      national_economy: ['BLS', 'BEA', 'FRED', 'WebSearch'],
      local_community: ['Source Weekly', 'Cascade Business News', 'Visit Bend'],
      lifestyle_bend: ['original photography', 'place_attractions table'],
      buyer_education: ['broker expertise', 'OREF forms'],
      seller_education: ['broker expertise', 'OREF forms'],
      behind_scenes: ['broker journals', 'FUB pipeline (anonymized)'],
      recap_highlight: ['market_stats_cache aggregations', 'team activity logs'],
      agent_brand: ['press mentions', 'internal team data'],
    }
    return map[topic] ?? []
  }

  const missing_producers = []
  const existing_validated = []
  const top_winners = []
  const outliers_flagged = []

  for (const w of (winners ?? [])) {
    const topic = w.topic
    const format = w.format
    const existing = findExisting(topic, format)

    top_winners.push({
      topic,
      format,
      median_engagement_rate: Number(w.median_engagement ?? 0),
      p75_engagement_rate: Number(w.p75_engagement ?? 0),
      post_count: Number(w.post_count ?? 0),
      top_creators: (w.sample_post_urls ?? []).map((url, idx) => ({
        competitor_id: w.competitors?.[idx] ?? 'unknown',
        post_url: url,
        engagement_rate: Number(w.p75_engagement ?? 0),
      })),
      exemplar_caption: w.sample_post_urls?.[0] ?? '',
    })

    if (Number(w.post_count) < 8) {
      outliers_flagged.push({
        topic, format,
        flag: 'small_sample',
        detail: `Only ${w.post_count} posts in corpus for ${topic}/${format}.`,
      })
    }
    if (w.competitors?.length === 1 && Number(w.post_count) >= 3) {
      outliers_flagged.push({
        topic, format,
        flag: 'single_creator_dominance',
        detail: `All ${w.post_count} posts from ${w.competitors[0]}.`,
      })
    }

    if (existing) {
      existing_validated.push({
        producer_path: existing,
        validated: true,
        evidence: `${topic}/${format}: ${w.post_count} posts, median ER ${Number(w.median_engagement).toFixed(3)}`,
        recommendation: 'keep',
      })
    } else {
      const skill_name = `${topic.replace(/_/g, '-')}-${format}`
      const isVideo = ['reel','long_video','live'].includes(format)
      const proposed_path = isVideo ? `video_production_skills/${skill_name}/` : `social_media_skills/${skill_name}/`
      const priority = Number(w.post_count) >= 20 && (w.competitors?.length ?? 0) >= 3 ? 'high'
        : Number(w.post_count) >= 10 ? 'medium' : 'low'

      // Find closest existing
      const topicMap = EXISTING_PRODUCER_MAP[topic]
      const closestExisting = topicMap ? Object.values(topicMap)[0] ?? null : null

      missing_producers.push({
        proposed_skill_name: skill_name,
        proposed_path,
        proposed_action_type: `content:${topic}_${format}`,
        topic,
        format,
        evidence: {
          median_engagement_rate_top_quartile: Number(w.p75_engagement ?? 0),
          sample_post_urls: (w.sample_post_urls ?? []).slice(0, 5),
          competitors_running_this: w.competitors ?? [],
          post_count_in_corpus: Number(w.post_count),
        },
        priority,
        rationale: `${w.post_count} winning posts at p75 ER ${Number(w.p75_engagement).toFixed(3)} from ${w.competitors?.length ?? 0} competitors. No producer covers ${topic}/${format} in REGISTRY.md.`,
        data_sources_needed: dataSourcesForTopic(topic),
        similar_existing_producer: closestExisting,
      })
    }
  }

  const completedAt = new Date().toISOString()
  const reportPath = 'docs/marketing-brain/audit-2026-05-15.md'

  const payload = {
    audit_id: AUDIT_ID,
    audit_started_at: new Date(startTime).toISOString(),
    audit_completed_at: completedAt,
    window_days: WINDOW_DAYS,
    competitors_scraped: competitorsScraped,
    competitors_with_data: competitorsWithData,
    platforms_scraped: ['instagram', 'tiktok', 'facebook', 'google_serp', 'google_maps_reviews'],
    posts_classified: (posts ?? []).length,
    classifier_cost_usd: 0,
    apify_cost_usd: runningCostUsd,
    missing_producers: missing_producers.sort((a, b) => ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority])),
    existing_producers_validated: existing_validated,
    top_winners_by_topic_format: top_winners,
    outliers_flagged,
    errors: runErrors,
    report_path: reportPath,
  }

  // Write markdown report
  await writeMarkdownReport(reportPath, payload)

  // Insert action row
  const { data: actionRow, error: actionErr } = await supabase
    .from('marketing_brain_actions')
    .insert({
      action_type: 'analyze:audit_findings',
      target: `audit:${AUDIT_ID}`,
      assigned_producer: 'marketing_brain_skills/audit-findings',
      payload,
      data_evidence: { winners_count: top_winners.length, missing_producers_count: missing_producers.length },
      generation_reason: `Full audit cycle ${AUDIT_ID}: ${competitorsWithData} competitors with data, ${(posts ?? []).length} posts classified. ${missing_producers.length} producer gaps identified.`,
      topic: `Audit findings ${AUDIT_ID}`,
      format: 'audit_findings',
      platforms: ['internal'],
      hook: `Audit ${AUDIT_ID} complete — ${top_winners.length} winning topic×format combos, ${missing_producers.length} missing producers identified`,
      body: `Full payload + markdown report at ${reportPath}`,
      target_audience: 'internal',
      data_sources: ['competitor_intel', 'content_classification', 'audit_winners'],
      predicted_outcome: {
        primary_metric: 'producer_coverage',
        expected_value: `${missing_producers.length} new SKILL.md to author`,
        rationale: 'Each missing producer corresponds to a winning content format competitors run that Ryan Realty currently cannot produce systematically.',
      },
      status: 'pending',
      generated_by: 'marketing_brain:audit-agent',
    })
    .select('id')
    .single()

  if (actionErr) {
    console.error('Action row insert error:', actionErr.message)
    await appendError(`Action row insert: ${actionErr.message}`)
  } else {
    console.log(`Action row inserted: ${actionRow.id}`)
  }

  // Mark audit_run published
  await updateAuditRun({
    status: 'published',
    completed_at: completedAt,
    findings_action_id: actionRow?.id ?? null,
    report_path: reportPath,
    apify_cost_usd: runningCostUsd,
  })

  const duration_ms = Date.now() - startTime
  const summary = {
    audit_id: AUDIT_ID,
    duration_ms,
    competitors_attempted: competitors.length,
    competitors_with_data: competitorsWithData,
    posts_scraped: totalPostsInserted,
    posts_classified: (posts ?? []).length,
    apify_cost_usd: parseFloat(runningCostUsd.toFixed(4)),
    top_5_missing_producers: missing_producers.slice(0, 5),
    top_5_winners: top_winners.slice(0, 5),
    findings_action_id: actionRow?.id ?? null,
    report_path: reportPath,
    errors: runErrors,
  }

  console.log('\n=== AUDIT COMPLETE ===')
  console.log(JSON.stringify(summary, null, 2))

  // Write summary JSON
  await fs.writeFile(
    path.join(REPO_ROOT, 'docs/marketing-brain/audit-2026-05-15-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  )
  return summary
}

async function writeMarkdownReport(reportPath, payload) {
  const absPath = path.resolve(REPO_ROOT, reportPath)
  await fs.mkdir(path.dirname(absPath), { recursive: true })

  const lines = []
  lines.push(`# Marketing brain — competitive audit ${payload.audit_id}`)
  lines.push(``)
  lines.push(`Generated: ${payload.audit_completed_at}`)
  lines.push(`Window: ${payload.window_days} days`)
  lines.push(`Scope: ${payload.competitors_with_data} of ${payload.competitors_scraped} competitors with data; ${payload.platforms_scraped.join(', ')}`)
  lines.push(`Posts classified: ${payload.posts_classified.toLocaleString()}`)
  lines.push(`Cost: Apify $${payload.apify_cost_usd.toFixed(2)} + Classifier $${payload.classifier_cost_usd.toFixed(2)}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Headline summary`)
  lines.push(``)
  lines.push(`- Competitors scraped: ${payload.competitors_scraped}`)
  lines.push(`- Competitors with data: ${payload.competitors_with_data}`)
  lines.push(`- Posts classified: ${payload.posts_classified}`)
  lines.push(`- Missing producers identified: ${payload.missing_producers.length}`)
  lines.push(`- Existing producers validated: ${payload.existing_producers_validated.length}`)
  lines.push(`- Total Apify cost: $${payload.apify_cost_usd.toFixed(2)}`)
  lines.push(``)
  lines.push(`## Top winners by topic × format`)
  lines.push(``)
  lines.push(`| Topic | Format | Posts | p75 ER | Median ER | Competitors |`)
  lines.push(`|---|---|---|---|---|---|`)
  for (const w of payload.top_winners_by_topic_format.slice(0, 25)) {
    const comps = w.top_creators.map(c => c.competitor_id).slice(0, 3).join(', ')
    lines.push(`| ${w.topic} | ${w.format} | ${w.post_count} | ${w.p75_engagement_rate.toFixed(3)} | ${w.median_engagement_rate.toFixed(3)} | ${comps} |`)
  }
  lines.push(``)
  lines.push(`## Missing producers (priority order)`)
  lines.push(``)
  for (const m of payload.missing_producers) {
    lines.push(`### \`${m.proposed_skill_name}\` — ${m.priority.toUpperCase()}`)
    lines.push(``)
    lines.push(`- **Path:** \`${m.proposed_path}\``)
    lines.push(`- **Action type:** \`${m.proposed_action_type}\``)
    lines.push(`- **Topic × Format:** ${m.topic} × ${m.format}`)
    lines.push(`- **Evidence:** ${m.evidence.post_count_in_corpus} posts at p75 ER ${m.evidence.median_engagement_rate_top_quartile.toFixed(3)}; competitors: ${m.evidence.competitors_running_this.slice(0,5).join(', ')}`)
    lines.push(`- **Data sources:** ${m.data_sources_needed.join(', ') || '(none)'}`)
    if (m.similar_existing_producer) lines.push(`- **Closest existing:** \`${m.similar_existing_producer}\``)
    for (const url of m.evidence.sample_post_urls.slice(0, 3)) {
      lines.push(`  - ${url}`)
    }
    lines.push(``)
  }
  if (payload.existing_producers_validated.length > 0) {
    lines.push(`## Existing producers validated`)
    lines.push(``)
    lines.push(`| Producer | Recommendation | Evidence |`)
    lines.push(`|---|---|---|`)
    for (const v of payload.existing_producers_validated) {
      lines.push(`| \`${v.producer_path}\` | ${v.recommendation} | ${v.evidence} |`)
    }
    lines.push(``)
  }
  if (payload.outliers_flagged.length > 0) {
    lines.push(`## Outliers flagged`)
    lines.push(``)
    for (const o of payload.outliers_flagged) {
      lines.push(`- **${o.topic}/${o.format}** [${o.flag}]: ${o.detail}`)
    }
    lines.push(``)
  }
  if (payload.errors.length > 0) {
    lines.push(`## Errors during run`)
    lines.push(``)
    for (const e of payload.errors) {
      lines.push(`- ${e}`)
    }
    lines.push(``)
  }
  lines.push(`---`)
  lines.push(``)
  lines.push(`Per [PROTOCOL.md](../../marketing_brain_skills/audit-findings/PROTOCOL.md), Producer Authoring queries marketing_brain_actions WHERE action_type='analyze:audit_findings' AND status='approved' ORDER BY created_at DESC LIMIT 1 to pick its next work.`)

  const content = lines.join('\n')
  await fs.writeFile(absPath, content, 'utf-8')
  // Also write audit-LATEST.md
  const latestPath = path.resolve(path.dirname(absPath), 'audit-LATEST.md')
  await fs.writeFile(latestPath, content, 'utf-8')
  console.log(`Markdown report written: ${absPath}`)
}

main().catch(async e => {
  console.error('FATAL:', e)
  try {
    const sb = getSupabase()
    const { data } = await sb.from('audit_runs').select('errors').eq('audit_id', AUDIT_ID).single()
    const existing = data?.errors ?? []
    await sb.from('audit_runs').update({
      status: 'killed',
      completed_at: new Date().toISOString(),
      errors: [...existing, `FATAL: ${e.message}`],
    }).eq('audit_id', AUDIT_ID)
  } catch (_) {}
  process.exit(1)
})
