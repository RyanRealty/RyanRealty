/**
 * POST /api/fub/track-page
 *
 * Cross-origin page-tracking endpoint for the AgentFire WordPress site at
 * ryan-realty.com. Called by the body-before-closing-tag snippet on every
 * page load (after the visitor has identified via /api/fub/identify and the
 * `rr_identified=<fubPersonId>` cookie is set).
 *
 * Dispatches to the existing FUB helpers:
 *   - listing detail page (mlsNumber or street present) → trackListingView
 *     (FUB event type: "Viewed Property")
 *   - any other page → trackPageView
 *     (FUB event type: "Viewed Page")
 *
 * Auth model:
 *   - Origin allowlist (only ryan-realty.com / www.ryan-realty.com)
 *   - fubPersonId is trusted from the request body. Trade-off: a spammer who
 *     spoofs Origin and posts arbitrary fubPersonIds will create noise events
 *     in FUB. Acceptable for v1 because (a) Origin check stops casual abuse,
 *     (b) IP rate-limit middleware is already in place at 60 req/min, (c) the
 *     attack value is just noise — no PII exfiltration, no account takeover.
 *     A signed-cookie HMAC layer can be added in v2 if abuse is observed.
 */

import { NextResponse } from 'next/server'
import { trackPageView, trackListingView, addPersonTags, addPersonNote, createRealtimeTask } from '@/lib/followupboss'

const ALLOWED_ORIGINS = new Set<string>([
  'https://ryan-realty.com',
  'https://www.ryan-realty.com',
])

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonError(status: number, error: string, origin: string | null) {
  return NextResponse.json({ ok: false, error }, { status, headers: corsHeaders(origin) })
}

type ListingMeta = {
  listingUrl?: string
  street?: string
  city?: string
  state?: string
  code?: string
  mlsNumber?: string
  price?: number
  bedrooms?: number
  bathrooms?: number
  area?: number
}

type Campaign = {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

type TrackPageBody = {
  fubPersonId?: number | string
  pageUrl?: string
  pageTitle?: string
  listing?: ListingMeta | null
  /** UTM/referrer attribution carried from the visitor's first session. */
  campaign?: Campaign
  /** Page intent classification e.g. "listing_detail", "seller_intent",
   *  "buyer_intent", "search", "area_guide", "blog", "home", "about". */
  category?: string
  /** Tags to merge onto the person (e.g. ["Seller Intent", "Area: Bend"]). */
  intentTags?: string[]
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return jsonError(403, 'Origin not allowed', origin)
  }

  let body: TrackPageBody
  try {
    body = (await request.json()) as TrackPageBody
  } catch {
    return jsonError(400, 'Invalid JSON', origin)
  }

  const fubPersonId = Number(body.fubPersonId)
  if (!Number.isFinite(fubPersonId) || fubPersonId <= 0) {
    return jsonError(400, 'Invalid fubPersonId', origin)
  }

  const pageUrl = body.pageUrl?.trim() || ''
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
    return jsonError(400, 'Missing or invalid pageUrl', origin)
  }
  // Defense in depth: only accept URLs from the allowed origins.
  try {
    const u = new URL(pageUrl)
    if (!ALLOWED_ORIGINS.has(`${u.protocol}//${u.host}`)) {
      return jsonError(400, 'pageUrl host not allowed', origin)
    }
  } catch {
    return jsonError(400, 'pageUrl unparseable', origin)
  }

  const pageTitle = body.pageTitle?.trim() || undefined
  const campaign = body.campaign && Object.values(body.campaign).some(Boolean) ? body.campaign : undefined
  const category = body.category?.trim() || undefined

  const listing = body.listing
  const isListingPage = !!(listing && (listing.mlsNumber || listing.street))

  let eventType: 'Viewed Property' | 'Viewed Page'
  if (isListingPage && listing) {
    await trackListingView({
      fubPersonId,
      listingUrl: listing.listingUrl || pageUrl,
      property: {
        street: listing.street,
        city: listing.city,
        state: listing.state,
        code: listing.code,
        mlsNumber: listing.mlsNumber,
        price: typeof listing.price === 'number' ? listing.price : undefined,
        bedrooms: typeof listing.bedrooms === 'number' ? listing.bedrooms : undefined,
        bathrooms: typeof listing.bathrooms === 'number' ? listing.bathrooms : undefined,
        area: typeof listing.area === 'number' ? listing.area : undefined,
      },
      campaign,
    })
    eventType = 'Viewed Property'
  } else {
    await trackPageView({
      fubPersonId,
      pageUrl,
      pageTitle,
      campaign,
      message: category ? `category=${category}` : undefined,
    })
    eventType = 'Viewed Page'
  }

  // Merge intent tags onto the person record so Matt can filter / segment in
  // FUB without configuring per-event automation rules. AWAIT this — in
  // serverless the lambda terminates on response.return, so a fire-and-forget
  // PUT may be killed mid-flight. Cost: ~150ms added to response time.
  const tagsToMerge: Array<string | undefined> = []
  if (Array.isArray(body.intentTags)) tagsToMerge.push(...body.intentTags)
  let taggedSucceeded = false
  if (tagsToMerge.length > 0) {
    try { taggedSucceeded = await addPersonTags(fubPersonId, tagsToMerge) } catch {}
  }

  // Post a FUB note for HIGH-INTENT activity so Matt's FUB app pings him on
  // the things that matter: listing views, seller intent, buyer intent,
  // area guide views. Other categories (home / blog / about / search /
  // financial_tools / other) don't add notes — those would be too noisy.
  let noteAdded = false
  let taskCreated = false
  const noteCategories = new Set(['listing_detail', 'seller_intent', 'buyer_intent', 'area_guide'])
  if (category && noteCategories.has(category)) {
    let noteBody = ''
    if (category === 'listing_detail' && listing) {
      const addr = [listing.street, listing.city, listing.state, listing.code].filter(Boolean).join(', ')
      const mls = listing.mlsNumber ? ` (MLS ${listing.mlsNumber})` : ''
      noteBody = `Viewed property: ${addr}${mls}.`
    } else if (category === 'seller_intent') {
      const path = (() => { try { return new URL(pageUrl).pathname } catch { return pageUrl } })()
      noteBody = `Seller intent signal: visited ${path}.`
    } else if (category === 'buyer_intent') {
      const path = (() => { try { return new URL(pageUrl).pathname } catch { return pageUrl } })()
      noteBody = `Buyer intent signal: visited ${path}.`
    } else if (category === 'area_guide') {
      const areaTag = (Array.isArray(body.intentTags) ? body.intentTags.find((t) => /^Area:/i.test(t)) : undefined) ?? ''
      const area = areaTag.replace(/^Area:\s*/i, '').trim() || 'unknown area'
      noteBody = `Area interest: viewed ${area} guide.`
    }
    if (noteBody) {
      try { noteAdded = await addPersonNote(fubPersonId, noteBody) } catch {}
    }

    const taskCategories = new Set(['listing_detail', 'seller_intent', 'buyer_intent'])
    if (taskCategories.has(category)) {
      let taskName = 'Website activity alert. Follow up now.'
      let dueInMinutes = 10
      if (category === 'listing_detail' && listing) {
        taskName = `Lead viewed listing now (${listing.mlsNumber ?? 'no MLS'})`
        dueInMinutes = 5
      } else if (category === 'seller_intent') {
        taskName = 'Seller intent page activity. Call now.'
        dueInMinutes = 5
      } else if (category === 'buyer_intent') {
        taskName = 'Buyer intent page activity. Follow up now.'
        dueInMinutes = 10
      }
      try {
        taskCreated = await createRealtimeTask({
          personId: fubPersonId,
          taskType: 'Call',
          dueInMinutes,
          taskName,
        })
      } catch {}
    }
  }

  return NextResponse.json(
    { ok: true, eventType, taggedCount: tagsToMerge.length, taggedSucceeded, noteAdded, taskCreated },
    { headers: corsHeaders(origin) },
  )
}
