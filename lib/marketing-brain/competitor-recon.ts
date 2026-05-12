/**
 * marketing-brain competitor-recon helpers.
 *
 * Scrapes 10 Bend-area and national competitor targets via Apify actors and
 * writes structured observations to public.competitor_intel.
 *
 * Env vars required:
 *   APIFY_API_TOKEN — from apify.com/account/integrations → "Personal API tokens".
 *                     Create a token with "All resources" scope and paste it here.
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitorSlug =
  | 'cascade_hasson_sothebys'
  | 'compass_bend'
  | 'windermere_central_oregon'
  | 'cascade_sothebys'
  | 'coldwell_banker_bain_bend'
  | 'berkshire_hathaway_nw_bend'
  | 'john_l_scott_bend'
  | 'remax_key_properties_bend'
  | 'opendoor'
  | 'offerpad'

export type CompetitorSource =
  | 'google_maps_reviews'
  | 'google_serp'
  | 'instagram_profile'
  | 'tiktok_profile'
  | 'fb_ad_library'

export type CompetitorDataType =
  | 'ad'
  | 'serp_position'
  | 'post'
  | 'review'
  | 'listing'
  | 'profile_metric'
  | 'page_change'

/** Shape of a single row written to public.competitor_intel. */
export interface CompetitorIntelRow {
  observation_date: string // YYYY-MM-DD
  competitor: CompetitorSlug
  source: CompetitorSource
  data_type: CompetitorDataType
  data: Record<string, unknown>
  url?: string
  apify_run_id?: string
}

export interface CompetitorTarget {
  slug: CompetitorSlug
  name: string
  /** Google Maps search URL for Maps review scraping. */
  googleMapsUrl: string
  /** Instagram handle without @. null if unknown. */
  instagramHandle: string | null
  /** TikTok handle without @. null if unknown. */
  tiktokHandle: string | null
  /** Facebook page URL for Ad Library lookups. */
  facebookPageUrl: string | null
  website: string
  /** false = handle/URL was inferred, not confirmed from live profile. */
  verified: boolean
}

// ---------------------------------------------------------------------------
// Canonical competitor target list (locked — matches migration slugs)
// ---------------------------------------------------------------------------

export const COMPETITOR_TARGETS: CompetitorTarget[] = [
  {
    slug: 'cascade_hasson_sothebys',
    name: "Cascade Hasson Sotheby's International Realty",
    googleMapsUrl:
      'https://www.google.com/maps/search/Cascade+Hasson+Sotheby%27s+International+Realty+Bend+Oregon',
    instagramHandle: 'cascadehassonsir',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/CascadeHassonSIR',
    website: 'https://www.cascadehasson.com',
    verified: false,
  },
  {
    slug: 'compass_bend',
    name: 'Compass Bend',
    googleMapsUrl: 'https://www.google.com/maps/search/Compass+Real+Estate+Bend+Oregon',
    instagramHandle: 'compassrealestate',
    tiktokHandle: 'compassrealestate',
    facebookPageUrl: 'https://www.facebook.com/CompassInc',
    website: 'https://www.compass.com/offices/bend-or/',
    verified: false,
  },
  {
    slug: 'windermere_central_oregon',
    name: 'Windermere Central Oregon',
    googleMapsUrl: 'https://www.google.com/maps/search/Windermere+Real+Estate+Central+Oregon+Bend',
    instagramHandle: 'windermerecentraoregon',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/WindermereCentralOregon',
    website: 'https://www.windermere.com/offices/central-oregon',
    verified: false,
  },
  {
    slug: 'cascade_sothebys',
    name: "Cascade Sotheby's International Realty",
    googleMapsUrl:
      'https://www.google.com/maps/search/Cascade+Sotheby%27s+International+Realty+Bend',
    instagramHandle: 'cascadesir',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/CascadeSIR',
    website: 'https://www.cascadesothebysrealty.com',
    verified: false,
  },
  {
    slug: 'coldwell_banker_bain_bend',
    name: 'Coldwell Banker Bain Bend',
    googleMapsUrl: 'https://www.google.com/maps/search/Coldwell+Banker+Bain+Bend+Oregon',
    instagramHandle: 'coldwellbankerbain',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/ColdwellBankerBain',
    website: 'https://www.cbbain.com',
    verified: false,
  },
  {
    slug: 'berkshire_hathaway_nw_bend',
    name: 'Berkshire Hathaway HomeServices Northwest Real Estate Bend',
    googleMapsUrl:
      'https://www.google.com/maps/search/Berkshire+Hathaway+HomeServices+Northwest+Real+Estate+Bend+Oregon',
    instagramHandle: 'bhhsnorthwest',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/BHHSNorthwest',
    website: 'https://www.bhhsnw.com',
    verified: false,
  },
  {
    slug: 'john_l_scott_bend',
    name: 'John L. Scott Bend',
    googleMapsUrl: 'https://www.google.com/maps/search/John+L+Scott+Real+Estate+Bend+Oregon',
    instagramHandle: 'johnlscottrealestate',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/JohnLScottRealEstate',
    website: 'https://johnlscott.com/offices/bend-or',
    verified: false,
  },
  {
    slug: 'remax_key_properties_bend',
    name: 'RE/MAX Key Properties Bend',
    googleMapsUrl: 'https://www.google.com/maps/search/REMAX+Key+Properties+Bend+Oregon',
    instagramHandle: 'remaxkeyproperties',
    tiktokHandle: null,
    facebookPageUrl: 'https://www.facebook.com/REMAXKeyProperties',
    website: 'https://www.remaxkeyproperties.com',
    verified: false,
  },
  {
    slug: 'opendoor',
    name: 'Opendoor',
    googleMapsUrl: 'https://www.google.com/maps/search/Opendoor+real+estate+Bend+Oregon',
    instagramHandle: 'opendoor',
    tiktokHandle: 'opendoor',
    facebookPageUrl: 'https://www.facebook.com/Opendoor',
    website: 'https://www.opendoor.com',
    verified: true,
  },
  {
    slug: 'offerpad',
    name: 'Offerpad',
    googleMapsUrl: 'https://www.google.com/maps/search/Offerpad+real+estate+Oregon',
    instagramHandle: 'offerpad',
    tiktokHandle: 'offerpad',
    facebookPageUrl: 'https://www.facebook.com/Offerpad',
    website: 'https://www.offerpad.com',
    verified: true,
  },
]

/** Google SERP search queries to track competitor rankings on. */
export const SERP_QUERIES: string[] = [
  'homes for sale bend oregon',
  'bend real estate agent',
  'sell my home bend',
  'bend or real estate',
  'bend oregon realtors',
  'top realtor bend',
  'houses for sale bend oregon',
  'bend luxury homes',
  'redmond oregon real estate',
  'central oregon real estate',
]

// ---------------------------------------------------------------------------
// Apify helpers
// ---------------------------------------------------------------------------

/**
 * Read APIFY_API_TOKEN from env.
 *
 * How to get one:
 *   1. Log in to apify.com.
 *   2. Go to Settings → Integrations (apify.com/account/integrations).
 *   3. Click "Create new token", give it "All resources" scope.
 *   4. Add to .env.local as APIFY_API_TOKEN=apify_api_...
 */
export function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    throw new Error(
      'APIFY_API_TOKEN is not set. Add it from apify.com/account/integrations to .env.local.',
    )
  }
  return token
}

const APIFY_BASE = 'https://api.apify.com/v2'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 300_000 // 5 minutes

/** Result returned by runApifyActor. */
export interface ApifyRunResult {
  runId: string
  datasetId: string
  items: unknown[]
}

/**
 * Start an Apify actor, poll until it finishes, return dataset items.
 *
 * @param actorId  e.g. "compass/google-maps-reviews-scraper" or "apify/google-search-scraper"
 * @param input    Actor-specific input object (see each actor's schema on apify.com)
 */
export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<ApifyRunResult> {
  const token = getApifyToken()

  // Start the run
  const startRes = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!startRes.ok) {
    const body = await startRes.text()
    throw new Error(`Apify start actor ${actorId} failed (${startRes.status}): ${body}`)
  }
  const startData = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } }
  const runId = startData.data.id
  const datasetId = startData.data.defaultDatasetId

  // Poll for completion
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!statusRes.ok) continue
    const statusData = (await statusRes.json()) as { data: { status: string } }
    const status = statusData.data.status
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${runId} ended with status: ${status}`)
    }
    // RUNNING or READY — keep polling
  }

  if (Date.now() >= deadline) {
    throw new Error(`Apify run ${runId} timed out after ${POLL_TIMEOUT_MS / 1000}s`)
  }

  // Fetch dataset items
  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!itemsRes.ok) {
    const body = await itemsRes.text()
    throw new Error(`Apify fetch dataset ${datasetId} failed (${itemsRes.status}): ${body}`)
  }
  const items = (await itemsRes.json()) as unknown[]

  return { runId, datasetId, items }
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}

/**
 * Batch insert rows into public.competitor_intel.
 * Returns the count of rows inserted.
 */
export async function insertCompetitorIntel(rows: CompetitorIntelRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const supabase = getSupabase()
  const BATCH = 500
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('competitor_intel').insert(chunk)
    if (error) {
      throw new Error(`insertCompetitorIntel batch ${i}/${rows.length}: ${error.message}`)
    }
    total += chunk.length
  }
  return total
}

// ---------------------------------------------------------------------------
// Scraper functions
// ---------------------------------------------------------------------------

/**
 * Scrape Google Maps reviews for a competitor.
 *
 * Actor: compass/Google-Maps-Reviews-Scraper
 * https://apify.com/compass/google-maps-reviews-scraper
 *
 * TODO: refine input shape after first live run — confirm `startUrls` vs
 * `searchStringsArray` param name against the actor's live schema.
 */
export async function scrapeGoogleMapsReviews(
  target: CompetitorTarget,
  observationDate: string,
): Promise<{ rowsInserted: number; runId: string; error?: string }> {
  try {
    const result = await runApifyActor('compass/Google-Maps-Reviews-Scraper', {
      startUrls: [{ url: target.googleMapsUrl }],
      maxReviews: 50,
      reviewsSort: 'newest',
      language: 'en',
    })

    const rows: CompetitorIntelRow[] = (result.items as Record<string, unknown>[]).map((item) => ({
      observation_date: observationDate,
      competitor: target.slug,
      source: 'google_maps_reviews',
      data_type: 'review',
      data: item,
      url: (item.url as string | undefined) ?? target.googleMapsUrl,
      apify_run_id: result.runId,
    }))

    const rowsInserted = await insertCompetitorIntel(rows)
    return { rowsInserted, runId: result.runId }
  } catch (e) {
    return { rowsInserted: 0, runId: '', error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Scrape Google SERP rankings for each locked query, recording competitor
 * domain appearances and positions.
 *
 * Actor: apify/google-search-scraper
 * https://apify.com/apify/google-search-scraper
 *
 * TODO: refine input shape after first live run — confirm `queries` array
 * key and `resultsPerPage` limit against the actor's live schema.
 */
export async function scrapeGoogleSerp(
  target: CompetitorTarget,
  observationDate: string,
): Promise<{ rowsInserted: number; runId: string; error?: string }> {
  try {
    const result = await runApifyActor('apify/google-search-scraper', {
      queries: SERP_QUERIES.join('\n'),
      countryCode: 'us',
      languageCode: 'en',
      resultsPerPage: 20,
      maxPagesPerQuery: 1,
    })

    // Filter to results that mention the competitor's domain
    const competitorDomain = new URL(target.website).hostname.replace('www.', '')
    const rows: CompetitorIntelRow[] = []

    for (const page of result.items as Record<string, unknown>[]) {
      const query = page.searchQuery as string | undefined
      const organicResults = (page.organicResults as Record<string, unknown>[] | undefined) ?? []

      for (const item of organicResults) {
        const itemUrl = (item.url as string | undefined) ?? ''
        const position = item.position as number | undefined
        if (!itemUrl.includes(competitorDomain)) continue
        rows.push({
          observation_date: observationDate,
          competitor: target.slug,
          source: 'google_serp',
          data_type: 'serp_position',
          data: { query, position, url: itemUrl, title: item.title, snippet: item.description },
          url: itemUrl,
          apify_run_id: result.runId,
        })
      }
    }

    const rowsInserted = await insertCompetitorIntel(rows)
    return { rowsInserted, runId: result.runId }
  } catch (e) {
    return { rowsInserted: 0, runId: '', error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Scrape an Instagram profile for follower count, post count, and recent
 * post engagement.
 *
 * Actor: apify/instagram-profile-scraper
 * https://apify.com/apify/instagram-profile-scraper
 *
 * TODO: refine input shape after first live run — confirm `usernames` vs
 * `directUrls` key and post-count limit against the actor's live schema.
 */
export async function scrapeInstagramProfile(
  target: CompetitorTarget,
  observationDate: string,
): Promise<{ rowsInserted: number; runId: string; error?: string }> {
  if (!target.instagramHandle) {
    return { rowsInserted: 0, runId: '', error: 'no instagram handle configured' }
  }
  try {
    const result = await runApifyActor('apify/instagram-profile-scraper', {
      usernames: [target.instagramHandle],
      resultsLimit: 12,
    })

    const rows: CompetitorIntelRow[] = (result.items as Record<string, unknown>[]).flatMap(
      (item) => {
        const out: CompetitorIntelRow[] = []
        // Profile metric row
        out.push({
          observation_date: observationDate,
          competitor: target.slug,
          source: 'instagram_profile',
          data_type: 'profile_metric',
          data: {
            followers: item.followersCount,
            following: item.followsCount,
            posts: item.postsCount,
            bio: item.biography,
            verified: item.verified,
          },
          url: `https://www.instagram.com/${target.instagramHandle}`,
          apify_run_id: result.runId,
        })
        // Individual recent posts
        const posts = (item.latestPosts as Record<string, unknown>[] | undefined) ?? []
        for (const post of posts) {
          out.push({
            observation_date: observationDate,
            competitor: target.slug,
            source: 'instagram_profile',
            data_type: 'post',
            data: {
              post_url: post.url,
              likes: post.likesCount,
              comments: post.commentsCount,
              timestamp: post.timestamp,
              caption: post.caption,
              type: post.type,
            },
            url: post.url as string | undefined,
            apify_run_id: result.runId,
          })
        }
        return out
      },
    )

    const rowsInserted = await insertCompetitorIntel(rows)
    return { rowsInserted, runId: result.runId }
  } catch (e) {
    return { rowsInserted: 0, runId: '', error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Scrape a TikTok profile for follower/like counts and recent video metrics.
 *
 * Actor: clockworks/free-tiktok-scraper
 * https://apify.com/clockworks/free-tiktok-scraper
 *
 * TODO: refine input shape after first live run — confirm `profiles` vs
 * `profileUrls` key and `resultsPerPage` limit against the actor's live schema.
 */
export async function scrapeTikTokProfile(
  target: CompetitorTarget,
  observationDate: string,
): Promise<{ rowsInserted: number; runId: string; error?: string }> {
  if (!target.tiktokHandle) {
    return { rowsInserted: 0, runId: '', error: 'no tiktok handle configured' }
  }
  try {
    const result = await runApifyActor('clockworks/free-tiktok-scraper', {
      profiles: [`https://www.tiktok.com/@${target.tiktokHandle}`],
      resultsPerPage: 12,
    })

    const rows: CompetitorIntelRow[] = (result.items as Record<string, unknown>[]).map((item) => ({
      observation_date: observationDate,
      competitor: target.slug,
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
        author_followers: (item.authorMeta as Record<string, unknown> | undefined)?.fans,
      },
      url: item.webVideoUrl as string | undefined,
      apify_run_id: result.runId,
    }))

    const rowsInserted = await insertCompetitorIntel(rows)
    return { rowsInserted, runId: result.runId }
  } catch (e) {
    return { rowsInserted: 0, runId: '', error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Scrape Facebook Ad Library for active ads from a competitor page.
 *
 * Actor: apify/facebook-ads-scraper
 * https://apify.com/apify/facebook-ads-scraper
 *
 * TODO: refine input shape after first live run — confirm `adLibraryUrls` vs
 * `searchTerms` + `countryCode` approach against the actor's live schema.
 * The Ad Library API requires a country + search term or page ID; we start
 * with search term and refine once we have page IDs per competitor.
 */
export async function scrapeFacebookAdLibrary(
  target: CompetitorTarget,
  observationDate: string,
): Promise<{ rowsInserted: number; runId: string; error?: string }> {
  if (!target.facebookPageUrl) {
    return { rowsInserted: 0, runId: '', error: 'no facebook page url configured' }
  }
  try {
    const adLibraryUrl =
      `https://www.facebook.com/ads/library/?active_status=active` +
      `&ad_type=all&country=US&q=${encodeURIComponent(target.name)}&search_type=keyword_unordered`

    const result = await runApifyActor('apify/facebook-ads-scraper', {
      adLibraryUrls: [{ url: adLibraryUrl }],
      maxAds: 25,
    })

    const rows: CompetitorIntelRow[] = (result.items as Record<string, unknown>[]).map((item) => ({
      observation_date: observationDate,
      competitor: target.slug,
      source: 'fb_ad_library',
      data_type: 'ad',
      data: {
        ad_id: item.adArchiveID,
        page_name: item.pageName,
        body: (() => {
          const snap = item.snapshot as Record<string, unknown> | undefined
          const bodyObj = snap?.body as Record<string, unknown> | undefined
          const markup = bodyObj?.markup as Record<string, unknown> | undefined
          const cards = snap?.cards as Record<string, unknown>[] | undefined
          const card0 = cards?.[0]
          return markup?.__html ?? card0?.body
        })(),
        cta: (item.snapshot as Record<string, unknown> | undefined)?.cta_text,
        started_at: item.startDate,
        platforms: item.publisherPlatform,
        media_type: (() => {
          const snap = item.snapshot as Record<string, unknown> | undefined
          const videos = snap?.videos as unknown[] | undefined
          return videos?.length ? 'video' : 'image'
        })(),
        impressions_range: item.impressionsWithIndex,
      },
      url: adLibraryUrl,
      apify_run_id: result.runId,
    }))

    const rowsInserted = await insertCompetitorIntel(rows)
    return { rowsInserted, runId: result.runId }
  } catch (e) {
    return { rowsInserted: 0, runId: '', error: e instanceof Error ? e.message : String(e) }
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns all 10 competitor targets. */
export function getCompetitorTargets(): CompetitorTarget[] {
  return COMPETITOR_TARGETS
}
