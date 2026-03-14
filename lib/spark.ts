/**
 * Spark API client for fetching listings.
 * Docs: https://sparkplatform.com/docs/api_services/listings
 * Auth: https://sparkplatform.com/docs/authentication/access_token
 */

const SPARK_BASE = process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
/** Some MLS/Spark setups use "OAuth" instead of "Bearer". Set SPARK_AUTH_SCHEME=OAuth to try. */
const SPARK_AUTH_SCHEME = (process.env.SPARK_AUTH_SCHEME || 'Bearer').trim()

export type SparkPhoto = {
  Id?: string
  Name?: string
  Caption?: string
  UriThumb?: string
  Uri300?: string
  Uri640?: string
  Uri800?: string
  Uri1024?: string
  Uri1280?: string
  Uri1600?: string
  Uri2048?: string
  UriLarge?: string
  Primary?: boolean
}

export type SparkFloorPlan = {
  Id?: string
  Name?: string
  Uri?: string
  [key: string]: unknown
}

export type SparkVideo = {
  Id?: string
  Name?: string
  Caption?: string
  Uri?: string
  Type?: string
  ObjectHtml?: string
  [key: string]: unknown
}

export type SparkVirtualTour = {
  Id?: string
  Name?: string
  Uri?: string
  Type?: string
  [key: string]: unknown
}

export type SparkStandardFields = {
  ListingKey?: string
  ListingId?: string
  ListPrice?: number
  StreetNumber?: string
  StreetName?: string
  StreetDirPrefix?: string | null
  StreetSuffix?: string | null
  StreetDirSuffix?: string | null
  City?: string
  StateOrProvince?: string
  PostalCode?: string
  Latitude?: number
  Longitude?: number
  SubdivisionName?: string | null
  BedsTotal?: number
  BathsTotal?: number
  BuildingAreaTotal?: number
  StandardStatus?: string
  ListStatus?: string
  ModificationTimestamp?: string
  /** List/on-market date; use with _orderby for full historical data (recommended by Spark over ModificationTimestamp). */
  OnMarketDate?: string
  ListDate?: string
  CloseDate?: string
  PublicRemarks?: string
  PrivateRemarks?: string
  ListAgentFirstName?: string
  ListAgentLastName?: string
  ListAgentEmail?: string
  ListAgentPreferredPhone?: string
  ListOfficeName?: string
  ListOfficePhone?: string
  YearBuilt?: number
  LotSizeAcres?: number
  PropertyType?: string
  PropertySubType?: string
  Photos?: SparkPhoto[]
  FloorPlans?: SparkFloorPlan[]
  Videos?: SparkVideo[]
  VirtualTours?: SparkVirtualTour[]
  OpenHouses?: Array<{ Date?: string; StartTime?: string; EndTime?: string }>
  Documents?: SparkDocument[]
  [key: string]: unknown
}

export type SparkDocument = {
  Id?: string
  ResourceUri?: string
  Name?: string
  Uri?: string
  Privacy?: string
  [key: string]: unknown
}

export type SparkListingResult = {
  Id: string
  ResourceUri: string
  StandardFields: SparkStandardFields
}

export type SparkListingsResponse = {
  D?: {
    Success: boolean
    Results?: SparkListingResult[]
    Pagination?: {
      TotalRows: number
      PageSize: number
      TotalPages: number
      CurrentPage: number
    }
    Errors?: unknown[]
  }
}

/**
 * Check Spark API connection and return total listing count (one lightweight request).
 */
export async function getSparkConnectionStatus(): Promise<{
  connected: boolean
  totalListings?: number
  totalPages?: number
  pageSize?: number
  error?: string
}> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { connected: false, error: 'SPARK_API_KEY is not set' }
  }
  try {
    const response = await fetchSparkListingsPage(accessToken, {
      page: 1,
      limit: 1,
    })
    const D = response.D
    if (!D?.Success) {
      return {
        connected: false,
        error: D?.Errors ? String(D.Errors) : 'Spark API returned success: false',
      }
    }
    const pagination = D.Pagination
    return {
      connected: true,
      totalListings: pagination?.TotalRows,
      totalPages: pagination?.TotalPages,
      pageSize: pagination?.PageSize,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { connected: false, error: message }
  }
}

/**
 * Get total listing count and pagination for the sync query (orderby: '+OnMarketDate').
 * Use this to confirm how many listings the sync will actually paginate through.
 * Same query as sync, so TotalRows/TotalPages match the full historical dataset.
 */
export async function getSparkListingsCountForSync(): Promise<{
  totalListings: number
  totalPages: number
  pageSize: number
  error?: string
} | null> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) return null
  try {
    const response = await fetchSparkListingsPage(accessToken, {
      page: 1,
      limit: 100,
      orderby: '+OnMarketDate',
    })
    const pagination = response.D?.Pagination
    if (!pagination) return null
    return {
      totalListings: pagination.TotalRows ?? 0,
      totalPages: pagination.TotalPages ?? 0,
      pageSize: pagination.PageSize ?? 100,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { totalListings: 0, totalPages: 0, pageSize: 100, error: message }
  }
}

/** Result of Spark listing counts by status (same buckets as DB for gap audit). */
export type SparkListingCountsByStatus = {
  total: number
  active: number
  pending: number
  contingent: number
  closed: number
  expired: number
  withdrawn: number
  cancelled: number
  other: number
  error?: string
}

/**
 * Get listing count from Spark for a single _filter. Used for Spark vs DB audit.
 */
async function getSparkListingCountForFilter(accessToken: string, filter: string): Promise<number> {
  const res = await fetchSparkListingsPage(accessToken, { page: 1, limit: 1, filter })
  return res.D?.Pagination?.TotalRows ?? 0
}

/**
 * Get listing counts by status from Spark API (same buckets as get_listing_sync_status_breakdown).
 * Uses SparkQL contains() for substring match. Runs 9 requests in parallel (total + 8 buckets).
 */
export async function getSparkListingsCountsByStatus(): Promise<SparkListingCountsByStatus | null> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) return null
  try {
    // Total (no filter, same query as sync count)
    const totalPromise = getSparkListingsCountForSync().then((r) => (r && !r.error ? r.totalListings : 0))
    // Closed, expired, withdrawn, cancelled: single contains
    const closedP = getSparkListingCountForFilter(accessToken, "StandardStatus Eq contains('closed')")
    const expiredP = getSparkListingCountForFilter(accessToken, "StandardStatus Eq contains('expired')")
    const withdrawnP = getSparkListingCountForFilter(accessToken, "StandardStatus Eq contains('withdrawn')")
    const cancelledP = getSparkListingCountForFilter(accessToken, "StandardStatus Eq contains('cancel')")
    const contingentP = getSparkListingCountForFilter(accessToken, "StandardStatus Eq contains('contingent')")
    // Pending = pending or under contract, excluding contingent (Spark: (A Or B Or C) Not D)
    const pendingFilter =
      "(StandardStatus Eq contains('pending') Or StandardStatus Eq contains('under contract') Or StandardStatus Eq contains('undercontract')) Not StandardStatus Eq contains('contingent')"
    const pendingP = getSparkListingCountForFilter(accessToken, pendingFilter)
    // Active: active/for sale/coming soon (Spark does not allow StandardStatus Eq NULL)
    const activeFilter =
      "(StandardStatus Eq contains('active') Or StandardStatus Eq contains('for sale') Or StandardStatus Eq contains('coming soon')) Not StandardStatus Eq contains('closed') Not StandardStatus Eq contains('expired') Not StandardStatus Eq contains('withdrawn') Not StandardStatus Eq contains('cancel') Not StandardStatus Eq contains('contingent') Not StandardStatus Eq contains('pending') Not StandardStatus Eq contains('under contract') Not StandardStatus Eq contains('undercontract')"
    const activeP = getSparkListingCountForFilter(accessToken, activeFilter)

    const [total, closed, expired, withdrawn, cancelled, contingent, pending, active] = await Promise.all([
      totalPromise,
      closedP,
      expiredP,
      withdrawnP,
      cancelledP,
      contingentP,
      pendingP,
      activeP,
    ])
    const other = Math.max(0, total - active - pending - contingent - closed - expired - withdrawn - cancelled)
    return {
      total,
      active,
      pending,
      contingent,
      closed,
      expired,
      withdrawn,
      cancelled,
      other,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      total: 0,
      active: 0,
      pending: 0,
      contingent: 0,
      closed: 0,
      expired: 0,
      withdrawn: 0,
      cancelled: 0,
      other: 0,
      error: message,
    }
  }
}

/**
 * Get the date range of the dataset (oldest and newest OnMarketDate).
 * Uses OnMarketDate for _orderby so Spark returns full historical data (pre-2024);
 * using ModificationTimestamp can restrict results to a narrow date range.
 */
export async function getSparkDataRange(): Promise<{
  oldest?: string
  newest?: string
  error?: string
}> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) {
    return { error: 'SPARK_API_KEY is not set' }
  }
  try {
    const [oldestRes, newestRes] = await Promise.all([
      fetchSparkListingsPage(accessToken, {
        page: 1,
        limit: 1,
        orderby: '+OnMarketDate',
        select: 'OnMarketDate',
      }),
      fetchSparkListingsPage(accessToken, {
        page: 1,
        limit: 1,
        orderby: '-OnMarketDate',
        select: 'OnMarketDate',
      }),
    ])
    const oldestTs =
      oldestRes.D?.Results?.[0]?.StandardFields?.OnMarketDate
    const newestTs =
      newestRes.D?.Results?.[0]?.StandardFields?.OnMarketDate
    return { oldest: oldestTs, newest: newestTs }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

/**
 * Fetch one page of listings from Spark API.
 */
export async function fetchSparkListingsPage(
  accessToken: string,
  options: {
    page?: number
    limit?: number
    filter?: string
    orderby?: string
    select?: string
    expand?: string
  } = {}
): Promise<SparkListingsResponse> {
  const { page = 1, limit = 100, filter, orderby, select, expand } = options
  const params = new URLSearchParams()
  params.set('_pagination', '1')
  params.set('_limit', String(limit))
  params.set('_page', String(page))
  if (orderby) params.set('_orderby', orderby)
  if (select) params.set('_select', select)
  if (expand) params.set('_expand', expand)
  const token = accessToken.trim()
  const baseQuery = params.toString()
  const filterPart = filter ? `_filter=${encodeURIComponent(filter)}` : ''
  const url = `${SPARK_BASE}/listings?${[baseQuery, filterPart].filter(Boolean).join('&')}`
  const res = await fetch(url, {
    headers: {
      Authorization: `${SPARK_AUTH_SCHEME} ${token}`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (res.status === 404) {
    return { D: { Success: true, Results: [], Pagination: { TotalRows: 0, PageSize: limit, TotalPages: 0, CurrentPage: 1 } } }
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spark API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as SparkListingsResponse
  if (data.D?.Errors?.length) {
    throw new Error(`Spark API errors: ${JSON.stringify(data.D.Errors)}`)
  }
  return data
}

const LISTING_EXPAND =
  'Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents'

/**
 * Fetch a single listing by ListingKey with full media expansions.
 * Returns null when the listing is not found (404), e.g. removed from MLS or invalid key.
 */
export async function fetchSparkListingByKey(
  accessToken: string,
  listingKey: string,
  expand = LISTING_EXPAND
): Promise<SparkListingsResponse | null> {
  const token = accessToken.trim()
  const params = new URLSearchParams()
  if (expand) params.set('_expand', expand)
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      Authorization: `${SPARK_AUTH_SCHEME} ${token}`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Spark API error ${res.status}: ${text}`)
  }
  const data = (await res.json()) as SparkListingsResponse
  if (data.D?.Errors?.length) {
    throw new Error(`Spark API errors: ${JSON.stringify(data.D.Errors)}`)
  }
  return data
}

/**
 * One listing history event. Spark API returns Event, Field, PreviousValue, NewValue,
 * PriceAtEvent, PriceChange, ModificationTimestamp (and sometimes Date, Price, Description).
 * Shape may vary by MLS and API role (Private sees full history; IDX/VOW/Portal see condensed).
 */
export type SparkListingHistoryItem = {
  Date?: string
  Event?: string
  Field?: string
  PreviousValue?: unknown
  NewValue?: unknown
  Price?: number
  PriceAtEvent?: number
  PriceChange?: number
  Description?: string
  ModificationTimestamp?: string
  [key: string]: unknown
}

export type SparkListingHistoryResponse = {
  items: SparkListingHistoryItem[]
  ok: boolean
  /** HTTP status when ok is false (e.g. 400, 403) */
  status?: number
  /** Response body when !ok (for 400/403 diagnosis) */
  errorBody?: string
}

function parseHistoryItems(data: unknown): SparkListingHistoryItem[] {
  if (Array.isArray(data)) return data as SparkListingHistoryItem[]
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.Results)) return d.Results as SparkListingHistoryItem[]
    if (Array.isArray(d.Collection)) return d.Collection as SparkListingHistoryItem[]
  }
  return []
}

/** Spark can return 200 with D.Success = false and D.Message (e.g. Code 1500 permission denied). */
function sparkErrorFromBody(data: Record<string, unknown> | null): string | undefined {
  const d = data?.D as Record<string, unknown> | undefined
  if (!d || typeof d !== 'object') return undefined
  if (d.Success === false && typeof d.Message === 'string') {
    const code = d.Code != null ? ` (Code ${d.Code})` : ''
    return `${d.Message}${code}`
  }
  return undefined
}

/**
 * Listing History — status/event changes on a specific listing.
 * GET /v1/listings/{id}/history
 * Returns audit trail: status changes, who made them, price change data (NewListing, FieldChange, BackOnMarket, etc.).
 * Private role sees full history; IDX/VOW/Portal may see condensed events or be restricted by MLS.
 * @see https://sparkplatform.com/docs/api_services/listings/history
 */
export async function fetchSparkListingHistory(
  accessToken: string,
  listingKey: string
): Promise<SparkListingHistoryResponse> {
  const token = accessToken.trim()
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}/history`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `${SPARK_AUTH_SCHEME} ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const errorBody = await res.text()
      return { items: [], ok: false, status: res.status, errorBody: errorBody || undefined }
    }
    const data = (await res.json()) as Record<string, unknown>
    const err = sparkErrorFromBody(data)
    if (err) return { items: [], ok: false, status: res.status, errorBody: err }
    const d = data?.D as Record<string, unknown> | undefined
    const raw = d?.Results ?? d ?? data.Results ?? data
    const items = parseHistoryItems(raw)
    return { items, ok: true, status: res.status }
  } catch {
    return { items: [], ok: false }
  }
}

/**
 * Price history (under the historical resource): GET /v1/listings/{id}/historical/pricehistory
 * Clean price timeline for the listing: on-market, price changes, most recent status.
 * Limited to last 50 listings for the property. Use as fallback when /history is empty.
 * Part of Historical Listings API; access may differ from /history (e.g. VOW 403).
 */
export async function fetchSparkPriceHistory(
  accessToken: string,
  listingKey: string
): Promise<SparkListingHistoryResponse> {
  const token = accessToken.trim()
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}/historical/pricehistory`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `${SPARK_AUTH_SCHEME} ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const errorBody = await res.text()
      return { items: [], ok: false, status: res.status, errorBody: errorBody || undefined }
    }
    const data = (await res.json()) as Record<string, unknown>
    const err = sparkErrorFromBody(data)
    if (err) return { items: [], ok: false, status: res.status, errorBody: err }
    const d = data?.D as Record<string, unknown> | undefined
    const raw = d?.Results ?? d ?? data.Results ?? data
    const items = parseHistoryItems(raw)
    return { items, ok: true, status: res.status }
  } catch {
    return { items: [], ok: false }
  }
}

/**
 * Historical Listings — listings that are no longer active (off market).
 * GET /v1/listings/{id}/historical
 * Returns full listing objects for all prior MLS records for the same property.
 * Use for "Previously listed at $X in 2020" or full prior listing details.
 * @see https://sparkplatform.com/docs/api_services/listings/historical
 */
export async function fetchSparkHistoricalListings(
  accessToken: string,
  listingKey: string
): Promise<{ listings: SparkListingResult[]; ok: boolean; status?: number; errorBody?: string }> {
  const token = accessToken.trim()
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}/historical`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `${SPARK_AUTH_SCHEME} ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      const errorBody = await res.text()
      return { listings: [], ok: false, status: res.status, errorBody: errorBody || undefined }
    }
    const data = (await res.json()) as Record<string, unknown>
    const err = sparkErrorFromBody(data)
    if (err) return { listings: [], ok: false, status: res.status, errorBody: err }
    const d = data?.D
    const raw = d ?? (data as { Results?: SparkListingResult[] }).Results ?? data
    const listings = Array.isArray(raw) ? raw : []
    return { listings, ok: true }
  } catch {
    return { listings: [], ok: false }
  }
}

/**
 * Get the ListingKey of the most recently listed listing (for template start).
 * Uses OnMarketDate so Spark returns full historical range; ModificationTimestamp can restrict data.
 */
export async function getMostRecentListingKey(): Promise<string | null> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim()) return null
  const response = await fetchSparkListingsPage(accessToken, {
    page: 1,
    limit: 1,
    orderby: '-OnMarketDate',
  })
  const key = response.D?.Results?.[0]?.StandardFields?.ListingKey ?? response.D?.Results?.[0]?.Id
  return key ?? null
}

/**
 * Get the adjacent listing key (next = older by OnMarketDate, prev = newer).
 * Uses OnMarketDate for filter and orderby so Spark returns full historical data.
 * Pass the listing's OnMarketDate (or ListDate or ModificationTimestamp as fallback) for the date value.
 */
export async function getAdjacentListingKey(
  _currentKey: string,
  /** Listing's OnMarketDate (preferred), ListDate, or ModificationTimestamp for ordering. */
  orderByDate: string,
  direction: 'next' | 'prev'
): Promise<string | null> {
  const accessToken = process.env.SPARK_API_KEY
  if (!accessToken?.trim() || !orderByDate) return null
  // SparkQL: use Datetime literal without quotes per Spark docs (Character uses quotes)
  const ts = orderByDate.trim().replace(/^'|'$/g, '')
  const filter =
    direction === 'next'
      ? `OnMarketDate Lt ${ts}`
      : `OnMarketDate Gt ${ts}`
  const orderby = direction === 'next' ? '-OnMarketDate' : '+OnMarketDate'
  try {
    const response = await fetchSparkListingsPage(accessToken, {
      page: 1,
      limit: 1,
      filter,
      orderby,
    })
    const key = response.D?.Results?.[0]?.StandardFields?.ListingKey ?? response.D?.Results?.[0]?.Id
    return key ?? null
  } catch {
    return null
  }
}

/** Spark sometimes returns "********" for masked values; ensure we never send that to numeric/timestamp columns. */
function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    if (v === '' || /^\*+$/.test(v)) return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function toTimestamp(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  if (/^\*+$/.test(v)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : v
}

/**
 * Map Spark StandardFields to our Supabase listings row shape.
 * Sanitizes numeric and timestamp fields so masked values like "********" become null.
 */
export function sparkListingToSupabaseRow(
  result: SparkListingResult
): Record<string, unknown> {
  const f = result.StandardFields ?? {}
  const firstPhoto = f.Photos?.[0] ?? f.Photos?.find((p) => p.Primary)
  const photoUrl =
    firstPhoto?.Uri1600 ?? firstPhoto?.Uri1280 ?? firstPhoto?.Uri1024 ?? firstPhoto?.Uri800 ?? firstPhoto?.Uri640 ?? firstPhoto?.Uri300 ?? null

  const listDate = toTimestamp(f.ListDate ?? f.OnMarketDate ?? null)
  const closeDate = toTimestamp(f.CloseDate ?? null)
  const onMarketDate = toTimestamp(f.OnMarketDate ?? f.ListDate ?? null)
  const status = (f.StandardStatus ?? f.ListStatus ?? '') as string
  const isClosed = typeof status === 'string' && status.toLowerCase().includes('closed')
  const agentFirst = (f.ListAgentFirstName ?? '').toString().trim()
  const agentLast = (f.ListAgentLastName ?? '').toString().trim()
  const listAgentName = [agentFirst, agentLast].filter(Boolean).join(' ') || null
  const openHouses = Array.isArray(f.OpenHouses)
    ? (f.OpenHouses as Array<{ Date?: string; StartTime?: string; EndTime?: string }>).map((oh) => ({
        Date: oh.Date ?? undefined,
        StartTime: oh.StartTime ?? undefined,
        EndTime: oh.EndTime ?? undefined,
      }))
    : []

  return {
    ListingKey: f.ListingKey ?? result.Id,
    ListNumber: f.ListingId ?? result.Id,
    ListPrice: toNum(f.ListPrice),
    StreetNumber: f.StreetNumber ?? null,
    StreetName: f.StreetName ?? null,
    City: f.City ?? null,
    State: f.StateOrProvince ?? null,
    PostalCode: f.PostalCode ?? null,
    Latitude: toNum(f.Latitude),
    Longitude: toNum(f.Longitude),
    SubdivisionName: f.SubdivisionName ?? null,
    BedroomsTotal: toNum(f.BedsTotal),
    BathroomsTotal: toNum(f.BathsTotal),
    TotalLivingAreaSqFt: toNum(f.BuildingAreaTotal),
    StandardStatus: status || null,
    PhotoURL: photoUrl,
    ModificationTimestamp: toTimestamp(f.ModificationTimestamp),
    PropertyType: typeof f.PropertyType === 'string' ? f.PropertyType : null,
    ListDate: listDate,
    CloseDate: closeDate,
    media_finalized: isClosed,
    details: f as Record<string, unknown>,
    ListOfficeName: (f.ListOfficeName ?? '').toString().trim() || null,
    ListAgentName: listAgentName,
    OnMarketDate: onMarketDate,
    OpenHouses: openHouses.length > 0 ? openHouses : null,
  }
}
