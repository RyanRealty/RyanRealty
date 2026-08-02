/**
 * lib/data/agent/resolve-property.ts — fuzzy property resolution for the
 * broker SMS agent (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.2
 * resolve_property + Amendment R2.9).
 *
 * Zero new query paths: reuses findCmaSubjectByMls / findCmaSubjectByAddress
 * (lib/data/cma/builderReads.ts) for the confident paths, and adds one broad
 * ILIKE fallback across StreetName/SubdivisionName/City for the naive-broker
 * case ("the tumalo reservoir place", no street number, no MLS number).
 *
 * Deliberately promiscuous: an SMS-worthy "which one?" confirm-back costs one
 * text; a wrong silent guess costs a wrong CMA. This function only PROPOSES
 * candidates — lib/agent/tools/listings.ts's resolve_property tool always
 * reads the match back to the broker before any downstream tool acts on it.
 */
import { createServiceClient } from '@/lib/supabase/service'
import {
  findCmaSubjectByAddress,
  findCmaSubjectByMls,
  type CmaListingRow,
} from '@/lib/data/cma/builderReads'

export interface PropertyCandidate {
  listingKey?: string
  mlsId?: string | null
  address: string
  city: string | null
  /** Lightly-normalized status for display. Same value as standardStatus —
   *  kept as a separate field because callers reasonably expect a `status`
   *  key, while `standardStatus` documents that it is the raw MLS token. */
  status: string | null
  /** Raw StandardStatus verbatim — R2.9 listing-state inference needs the
   *  exact MLS token (e.g. the literal "Coming Soon"), not a paraphrase. */
  standardStatus: string | null
  listAgentEmail?: string | null
  onMarketDate?: string | null
  listDate?: string | null
  closeDate?: string | null
  currentPrice?: number | null
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

const CANDIDATE_COLUMNS =
  'ListingKey, ListNumber, StreetNumber, StreetName, City, StandardStatus, ' +
  'ListPrice, ClosePrice, CloseDate, OnMarketDate, ListDate, list_agent_email, ' +
  'PostalCode, SubdivisionName, ModificationTimestamp'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'on', 'at', 'in', 'of', 'and', 'near', 'off',
  'place', 'house', 'property', 'home', 'listing', 'residence', 'estate',
  'road', 'rd', 'street', 'st', 'drive', 'dr', 'lane', 'ln', 'way',
  'court', 'ct', 'loop', 'ave', 'avenue', 'circle', 'cir',
  'condo', 'unit', 'apt', 'cma', 'mls',
])

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOPWORDS.has(t))
}

/** Strip PostgREST or()/ilike() filter-grammar characters — property-name
 *  tokens never legitimately need them. */
function escapeIlikeArg(pattern: string): string {
  return pattern.replace(/[(),]/g, '')
}

function rowToCandidate(row: CmaListingRow): PropertyCandidate {
  const r = row as Record<string, unknown>
  const streetNumber = r.StreetNumber != null ? String(r.StreetNumber) : ''
  const streetName = r.StreetName != null ? String(r.StreetName) : ''
  const address = [streetNumber, streetName].filter(Boolean).join(' ').trim() || 'unknown address'
  const standardStatus = (r.StandardStatus as string | null) ?? null
  const closePrice = r.ClosePrice != null ? Number(r.ClosePrice) : null
  const listPrice = r.ListPrice != null ? Number(r.ListPrice) : null
  return {
    listingKey: (r.ListingKey as string | undefined) ?? undefined,
    mlsId: (r.ListNumber as string | null) ?? null,
    address,
    city: (r.City as string | null) ?? null,
    status: standardStatus,
    standardStatus,
    listAgentEmail: (r.list_agent_email as string | null) ?? null,
    onMarketDate: (r.OnMarketDate as string | null) ?? null,
    listDate: (r.ListDate as string | null) ?? null,
    closeDate: (r.CloseDate as string | null) ?? null,
    currentPrice: closePrice ?? listPrice ?? null,
  }
}

function candidateKey(c: PropertyCandidate): string {
  return c.listingKey ?? c.mlsId ?? c.address
}

/**
 * Fuzzy-resolve a broker's free-text property reference to up to 5 candidate
 * listings-table rows. Zero candidates most often means pre-market (no MLS
 * row exists yet) — the caller should ask the broker for facts directly
 * rather than treat it as a lookup failure.
 */
export async function searchPropertyCandidates(query: string): Promise<PropertyCandidate[]> {
  const trimmed = (query ?? '').trim()
  if (!trimmed) return []

  const sb = client()
  if (!sb) return []

  const candidates = new Map<string, PropertyCandidate>()
  const addAll = (rows: CmaListingRow[]) => {
    for (const row of rows) {
      const candidate = rowToCandidate(row)
      const key = candidateKey(candidate)
      if (!candidates.has(key)) candidates.set(key, candidate)
    }
  }

  // 1) Exact MLS / ListingKey match — cheapest, most confident signal.
  const mlsCandidate = trimmed.replace(/\s+/g, '')
  if (/^[a-z0-9-]{5,}$/i.test(mlsCandidate)) {
    try {
      addAll(await findCmaSubjectByMls(mlsCandidate))
    } catch {
      /* fall through to the fuzzy paths below */
    }
  }

  // 2) "<number> <street name...>" parse -> the address-bounded lookup.
  const streetMatch = trimmed.match(/^(\d{1,6})\s+(.+)$/)
  if (streetMatch && candidates.size < 5) {
    const [, streetNumber, rest] = streetMatch
    const tokens = significantTokens(rest)
    if (tokens.length) {
      try {
        addAll(
          await findCmaSubjectByAddress({
            streetNumber,
            streetNameIlike: `%${escapeIlikeArg(tokens.join('%'))}%`,
          }),
        )
      } catch {
        /* fall through */
      }
    }
  }

  // 3) Broad fuzzy fallback: subdivision/community nicknames ("the tumalo
  //    reservoir place"), street names without a number, city mentions.
  if (candidates.size < 5) {
    const tokens = significantTokens(trimmed)
    if (tokens.length) {
      const pattern = `%${escapeIlikeArg(tokens.join('%'))}%`
      const { data, error } = await sb
        .from('listings')
        .select(CANDIDATE_COLUMNS)
        .or(`StreetName.ilike.${pattern},SubdivisionName.ilike.${pattern},City.ilike.${pattern}`)
        .order('ModificationTimestamp', { ascending: false })
        .limit(25)
      if (!error) addAll((data ?? []) as unknown as CmaListingRow[])
    }
  }

  return Array.from(candidates.values()).slice(0, 5)
}

// ── Amendment R2.9 — raw signals for the listing-state inference module ──

/**
 * Raw MLS signals for ONE resolved property, for the (separately-owned) pure
 * inference module lib/agent/listing-state.ts to map into a ListingState.
 * This function stays a dumb signal fetch on purpose — state inference logic
 * belongs entirely to that module, not here, so it stays unit-testable
 * without a database.
 *
 * `hasListingsRow: false` IS itself a signal (no MLS row at all -> candidate
 * pre-market property), deliberately returned as its own field rather than
 * collapsed into a single enum here.
 */
export interface RawListingStateSignals {
  listingKey: string | null
  mlsId: string | null
  hasListingsRow: boolean
  standardStatus: string | null
  onMarketDate: string | null
  listDate: string | null
  closeDate: string | null
  closePrice: number | null
  originalListPrice: number | null
  listPrice: number | null
  daysOnMarket: number | null
  cumulativeDaysOnMarket: number | null
  pendingTimestamp: string | null
  statusChangeTimestamp: string | null
}

function emptySignals(mlsId: string | null): RawListingStateSignals {
  return {
    listingKey: null,
    mlsId,
    hasListingsRow: false,
    standardStatus: null,
    onMarketDate: null,
    listDate: null,
    closeDate: null,
    closePrice: null,
    originalListPrice: null,
    listPrice: null,
    daysOnMarket: null,
    cumulativeDaysOnMarket: null,
    pendingTimestamp: null,
    statusChangeTimestamp: null,
  }
}

export async function getListingStateSignals(
  candidate: Pick<PropertyCandidate, 'listingKey' | 'mlsId'>,
): Promise<RawListingStateSignals> {
  const key = (candidate.listingKey ?? candidate.mlsId ?? '').trim()
  const sb = client()
  if (!sb || !key) return emptySignals(candidate.mlsId ?? null)

  const escaped = escapeIlikeArg(key)
  const { data, error } = await sb
    .from('listings')
    .select(
      'ListingKey, ListNumber, StandardStatus, OnMarketDate, ListDate, CloseDate, ' +
        'ClosePrice, OriginalListPrice, ListPrice, DaysOnMarket, CumulativeDaysOnMarket, ' +
        'pending_timestamp, status_change_timestamp, ModificationTimestamp',
    )
    .or(`ListingKey.eq.${escaped},ListNumber.eq.${escaped}`)
    .order('ModificationTimestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return emptySignals(candidate.mlsId ?? null)

  const row = data as unknown as Record<string, unknown>
  return {
    listingKey: (row.ListingKey as string | null) ?? null,
    mlsId: (row.ListNumber as string | null) ?? candidate.mlsId ?? null,
    hasListingsRow: true,
    standardStatus: (row.StandardStatus as string | null) ?? null,
    onMarketDate: (row.OnMarketDate as string | null) ?? null,
    listDate: (row.ListDate as string | null) ?? null,
    closeDate: (row.CloseDate as string | null) ?? null,
    closePrice: row.ClosePrice != null ? Number(row.ClosePrice) : null,
    originalListPrice: row.OriginalListPrice != null ? Number(row.OriginalListPrice) : null,
    listPrice: row.ListPrice != null ? Number(row.ListPrice) : null,
    daysOnMarket: row.DaysOnMarket != null ? Number(row.DaysOnMarket) : null,
    cumulativeDaysOnMarket: row.CumulativeDaysOnMarket != null ? Number(row.CumulativeDaysOnMarket) : null,
    pendingTimestamp: (row.pending_timestamp as string | null) ?? null,
    statusChangeTimestamp: (row.status_change_timestamp as string | null) ?? null,
  }
}
