/**
 * lib/agent/tools/listings.ts — resolve_property, search_listings,
 * listing_detail (R2.2).
 *
 * resolve_property is the property-confirmation gate every property-specific
 * tool call sits behind (lib/agent/prompt.ts's PROPERTY CONFIRMATION rule) —
 * it never chooses for the broker, it only proposes candidates + attaches raw
 * R2.9 listing-state signals when there is exactly one candidate to reason
 * about.
 */
import { searchPropertyCandidates, getListingStateSignals } from '@/lib/data/agent/resolve-property'
import { searchListingsAll } from '@/lib/data/listings/searchListingsAll'
import { getListingDetail } from '@/lib/data/listings/getListingDetail'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'
import { getPropertyFactsByMls } from '@/lib/data/listings/getPropertyFactsByMls'
import type { AgentContext, AgentCitation, AgentTool, ToolOutcome } from '@/lib/agent/types'

const SEARCH_STATUSES = ['active', 'active-and-pending', 'pending-only'] as const
type SearchStatus = (typeof SEARCH_STATUSES)[number]

function isSearchStatus(v: unknown): v is SearchStatus {
  return typeof v === 'string' && (SEARCH_STATUSES as readonly string[]).includes(v)
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

// ── resolve_property ────────────────────────────────────────────────────────

async function resolvePropertyHandler(input: Record<string, unknown>, _ctx: AgentContext): Promise<ToolOutcome> {
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  if (!query) return { result: { error: 'query is required' } }

  const candidates = await searchPropertyCandidates(query)
  if (candidates.length === 0) {
    return {
      result: {
        query,
        candidates: [],
        note: 'No listings-table match — likely a pre-market property. Ask the broker for address, price, beds, baths, and square footage directly, then confirm every figure back to them as broker-provided.',
      },
    }
  }

  // R2.9: attach raw listing-state signals when there is exactly one
  // candidate — no second tool round trip needed to reason about
  // pre-market/coming-soon/just-listed/etc when there is no ambiguity to
  // resolve first. With multiple candidates, resolve the ambiguity first.
  const stateSignals = candidates.length === 1 ? await getListingStateSignals(candidates[0]) : null

  const citations: AgentCitation[] = candidates.map((c) => ({
    figure: c.address,
    source: `listings table match: ListingKey=${c.listingKey ?? 'n/a'} ListNumber=${c.mlsId ?? 'n/a'} StandardStatus=${c.standardStatus ?? 'n/a'}`,
  }))

  return { result: { query, candidates, stateSignals }, citations }
}

// ── search_listings ─────────────────────────────────────────────────────────

async function searchListingsHandler(input: Record<string, unknown>, _ctx: AgentContext): Promise<ToolOutcome> {
  const city = typeof input.city === 'string' && input.city.trim() ? input.city.trim() : undefined
  const priceMin = asNumber(input.priceMin)
  const priceMax = asNumber(input.priceMax)
  const bedsMin = asNumber(input.bedsMin)
  const bathsMin = asNumber(input.bathsMin)
  const keywordsRaw = typeof input.keywords === 'string' ? input.keywords.trim() : ''
  const status: SearchStatus = isSearchStatus(input.status) ? input.status : 'active'
  const limitRequested = asNumber(input.limit) ?? 5
  const limit = Math.min(Math.max(Math.round(limitRequested), 1), 10)

  const { rows, totalCount } = await searchListingsAll({
    city,
    priceMin,
    priceMax,
    bedsMin,
    bathsMin,
    keywords: keywordsRaw.length >= 2 ? keywordsRaw : undefined,
    status,
    limit,
    sort: 'newest',
  })

  const citations: AgentCitation[] = [
    {
      figure: `${totalCount} matching`,
      source: `listing_search_mv via searchListingsAll, city=${city ?? 'any'}, status=${status}, totalCount=${totalCount}`,
    },
  ]

  return {
    result: {
      totalCount,
      returned: rows.length,
      listings: rows.map((r) => ({
        listingKey: r.listingKey,
        address: [r.streetNumber, r.streetName].filter(Boolean).join(' '),
        city: r.city,
        status: r.status,
        listPrice: r.listPrice,
        beds: r.beds,
        baths: r.baths,
        sqft: r.sqft,
        dom: r.dom,
      })),
    },
    citations,
  }
}

// ── listing_detail ───────────────────────────────────────────────────────────

async function listingDetailHandler(input: Record<string, unknown>, _ctx: AgentContext): Promise<ToolOutcome> {
  const raw = typeof input.listingKeyOrMls === 'string' ? input.listingKeyOrMls.trim() : ''
  if (!raw) return { result: { error: 'listingKeyOrMls is required' } }

  const canonicalKey = await resolveCanonicalListingKey(raw)
  const detail = await getListingDetail(canonicalKey)
  if (!detail) return { result: { found: false, listingKeyOrMls: raw } }

  const facts = detail.listNumber ? await getPropertyFactsByMls(detail.listNumber) : null

  const citations: AgentCitation[] = [
    {
      figure: detail.listPrice != null ? `$${Math.round(detail.listPrice).toLocaleString('en-US')}` : String(detail.listingKey),
      source: `listing_tile_mv via getListingDetail, ListingKey=${detail.listingKey}, status=${detail.status}`,
    },
  ]

  return { result: { ...detail, propertyFacts: facts }, citations }
}

export const listingsTools: AgentTool[] = [
  {
    name: 'resolve_property',
    description:
      "Fuzzy-match a broker's free-text property reference (address, nickname, subdivision, or MLS number) to up to 5 candidate listings-table rows. ALWAYS call this before any property-specific work and read the match back to the broker before proceeding. Zero candidates usually means pre-market (no MLS row yet) — ask the broker for the facts directly instead of treating it as a failed lookup.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The broker\'s own words for the property, e.g. "2417 NW Awbrey" or "the tumalo reservoir place".',
        },
      },
      required: ['query'],
    },
    handler: resolvePropertyHandler,
  },
  {
    name: 'search_listings',
    description:
      'Search on-market listings (Active / Active Under Contract / Coming Soon / Pending) by city, price range, beds/baths, and keywords. Capped at 10 results — narrow the search rather than asking for more rows.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        priceMin: { type: 'number' },
        priceMax: { type: 'number' },
        bedsMin: { type: 'number' },
        bathsMin: { type: 'number' },
        keywords: { type: 'string', description: 'Free-text match against the public remarks, e.g. "shop" or "one level".' },
        status: { type: 'string', enum: SEARCH_STATUSES },
        limit: { type: 'number', description: 'Max 10.' },
      },
      required: [],
    },
    handler: searchListingsHandler,
  },
  {
    name: 'listing_detail',
    description:
      'Full detail on one listing by ListingKey or MLS number, plus derived property facts (year built, well/septic/HOA/condo/manufactured/vacant-land flags).',
    input_schema: {
      type: 'object',
      properties: {
        listingKeyOrMls: { type: 'string' },
      },
      required: ['listingKeyOrMls'],
    },
    handler: listingDetailHandler,
  },
]
