'use server'

import { createClient } from '@supabase/supabase-js'
import { getActiveBrokers, getBrokerBySlug, type BrokerRow } from '@/app/actions/brokers'
import type { HomeTileRow } from '@/app/actions/listings'
import { HOME_TILE_SELECT } from '@/lib/listing-tile-projections'
import { getListingTiles } from '@/lib/data'
import type { ListingTile } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Undercontract%,StandardStatus.ilike.%Contingent%'
function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

/** Broker with aggregate stats for agents index page. */
export type AgentForIndex = BrokerRow & {
  activeCount: number
  soldCount24Mo: number
  soldVolume24Mo: number
  avgRating: number | null
  reviewCount: number
}

/**
 * Get listing_keys where listing agent matches broker (list/listing role).
 * Matches by: 1) agent_license containing broker license (e.g. "OR 201206613" matches "201206613"), 2) if email provided, agent_email match.
 */
async function getListingKeysForBroker(
  licenseNumber: string | null,
  brokerEmail?: string | null
): Promise<string[]> {
  const keys = new Set<string>()
  void supabase
  const { getListingKeysForBrokerByLicense, getListingKeysForBrokerByEmail, getListingKeysByListAgentEmail } =
    await import('@/lib/data')

  if (licenseNumber?.trim()) {
    const byLicense = await getListingKeysForBrokerByLicense(licenseNumber)
    byLicense.forEach((k) => keys.add(k))
  }

  if (brokerEmail?.trim()) {
    // listing_agents is a partial third-party sample with no Ryan Realty rows, so
    // the normalized email lookup returns [] for our own brokers. The populated,
    // indexed listings.list_agent_email column is the reliable source — without it
    // the broker pages showed neither active nor sold listings.
    const [byEmail, byListAgent] = await Promise.all([
      getListingKeysForBrokerByEmail(brokerEmail),
      getListingKeysByListAgentEmail(brokerEmail),
    ])
    byEmail.forEach((k) => keys.add(k))
    byListAgent.forEach((k) => keys.add(k))
  }

  return [...keys]
}

/** Active listing count for broker. */
async function getActiveCountForBroker(
  licenseNumber: string | null,
  brokerEmail?: string | null
): Promise<number> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return 0
  void ACTIVE_OR
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'active',
    limit: 5000,
  })
  return tiles.length
}

/** Sold count and volume in last 24 months for broker. */
async function getSoldStatsForBroker(
  licenseNumber: string | null,
  brokerEmail?: string | null
): Promise<{ count: number; volume: number }> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return { count: 0, volume: 0 }
  const twentyFourMoAgo = new Date()
  twentyFourMoAgo.setMonth(twentyFourMoAgo.getMonth() - 24)
  const since = twentyFourMoAgo.toISOString().slice(0, 10)
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'closed',
    sort: 'close-newest',
    limit: 5000,
  })
  // 24-month window filter post-fetch (DAL doesn't have a close_date range yet).
  const inWindow = tiles.filter((t) => t.closeDate != null && t.closeDate.slice(0, 10) >= since)
  let volume = 0
  for (const t of inWindow) {
    const p = Number(t.closePrice)
    if (Number.isFinite(p) && p > 0) volume += p
  }
  return { count: inWindow.length, volume }
}

/** Average rating and review count for broker. */
async function getReviewStatsForBroker(brokerId: string): Promise<{ avgRating: number | null; reviewCount: number }> {
  const { data } = await supabase()
    .from('reviews')
    .select('rating')
    .eq('broker_id', brokerId)
    .eq('is_hidden', false)
  const rows = (data ?? []) as { rating?: number | null }[]
  if (rows.length === 0) return { avgRating: null, reviewCount: 0 }
  let sum = 0
  let n = 0
  for (const r of rows) {
    const v = Number(r.rating)
    if (Number.isFinite(v)) {
      sum += v
      n += 1
    }
  }
  const avgRating = n > 0 ? Math.round((sum / n) * 10) / 10 : null
  return { avgRating, reviewCount: rows.length }
}

/** All active brokers with stats for agents index page. */
export async function getAgentsForIndex(): Promise<AgentForIndex[]> {
  const brokers = await getActiveBrokers()
  const result: AgentForIndex[] = []
  for (const b of brokers) {
    const [activeCount, soldStats, reviewStats] = await Promise.all([
      getActiveCountForBroker(b.license_number, b.email),
      getSoldStatsForBroker(b.license_number, b.email),
      getReviewStatsForBroker(b.id),
    ])
    result.push({
      ...b,
      activeCount,
      soldCount24Mo: soldStats.count,
      soldVolume24Mo: soldStats.volume,
      avgRating: reviewStats.avgRating,
      reviewCount: reviewStats.reviewCount,
    })
  }
  result.sort((a, b) => b.activeCount - a.activeCount || b.soldCount24Mo - a.soldCount24Mo || a.display_name.localeCompare(b.display_name))
  return result
}

/** Single broker detail with listings, sold, reviews, performance stats. */
export type AgentDetail = BrokerRow & {
  activeCount: number
  soldCount24Mo: number
  soldVolume24Mo: number
  avgDom: number | null
  avgSalePrice: number | null
  avgRating: number | null
  reviewCount: number
}

export type ReviewRow = {
  id: string
  source: string
  rating: number
  text: string | null
  reviewer_name: string | null
  review_date: string | null
}

/** Map DAL ListingTile → HomeTileRow shape (legacy callers expect). */
function tileToHomeTileRow(tile: ListingTile): HomeTileRow {
  return {
    ListingKey: tile.listingKey,
    ListNumber: tile.listNumber,
    ListPrice: tile.listPrice,
    BedroomsTotal: tile.beds,
    BathroomsTotal: tile.baths,
    StreetNumber: tile.streetNumber,
    StreetName: tile.streetName,
    City: tile.city,
    State: null,
    PostalCode: tile.postalCode,
    SubdivisionName: tile.subdivisionName,
    PhotoURL: tile.photoUrl,
    Latitude: tile.lat,
    Longitude: tile.lng,
    StandardStatus: tile.status,
    TotalLivingAreaSqFt: tile.sqft,
    OnMarketDate: tile.onMarketDate,
    has_virtual_tour: tile.hasVirtualTour,
    year_built: tile.yearBuilt,
    price_per_sqft: tile.pricePerSqft,
    lot_size_acres: tile.lotSizeAcres,
    garage_spaces: tile.garageSpaces,
    pool_yn: tile.poolYn,
    price_drop_count: tile.priceDropCount,
    DaysOnMarket: tile.dom,
  }
}

/** Broker's active listings (limit). Reads from listing_tile_mv via DAL. */
export async function getAgentActiveListings(
  licenseNumber: string | null,
  limit: number,
  brokerEmail?: string | null
): Promise<HomeTileRow[]> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return []
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'active',
    sort: 'newest',
    limit,
  })
  return tiles.map(tileToHomeTileRow)
}

/** Broker's sold listings (last 24 months, limit). Reads from DAL. */
export async function getAgentSoldListings(
  licenseNumber: string | null,
  limit: number,
  brokerEmail?: string | null
): Promise<(HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return []
  const twentyFourMoAgo = new Date()
  twentyFourMoAgo.setMonth(twentyFourMoAgo.getMonth() - 24)
  const since = twentyFourMoAgo.toISOString().slice(0, 10)
  // DAL: fetch closed tiles by key, then filter to last-24mo close window
  // post-fetch (DAL doesn't expose a close_date range filter today).
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'closed',
    sort: 'close-newest',
    limit: limit * 3,
  })
  const sinceTs = since
  return tiles
    .filter((t) => t.closeDate != null && t.closeDate >= sinceTs)
    .slice(0, limit)
    .map((t) => ({
      ...tileToHomeTileRow(t),
      ClosePrice: t.closePrice,
      CloseDate: t.closeDate,
    }))
}

/** Broker's pending/under-contract listings (limit). Reads from DAL. */
export async function getAgentPendingListings(
  licenseNumber: string | null,
  limit: number,
  brokerEmail?: string | null
): Promise<HomeTileRow[]> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return []
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'pending-only',
    sort: 'newest',
    limit,
  })
  return tiles.map(tileToHomeTileRow)
}

/** Performance stats from sold listings: avg sale price, avg DOM (typed DaysOnMarket when present, else CloseDate minus on-market). */
async function getAgentPerformanceStats(
  licenseNumber: string | null,
  brokerEmail?: string | null
): Promise<{ avgSalePrice: number | null; avgDom: number | null }> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return { avgSalePrice: null, avgDom: null }
  const twentyFourMoAgo = new Date()
  twentyFourMoAgo.setMonth(twentyFourMoAgo.getMonth() - 24)
  const since = twentyFourMoAgo.toISOString().slice(0, 10)
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({
    listingKeys: keys.slice(0, 5000),
    status: 'closed',
    sort: 'close-newest',
    limit: 5000,
  })
  const rows = tiles.filter((t) => t.closeDate != null && t.closeDate.slice(0, 10) >= since)
  const prices = rows.map((t) => Number(t.closePrice)).filter((p) => Number.isFinite(p) && p > 0)
  const avgSalePrice =
    prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
  const domFromColumn = rows
    .map((t) => (t.dom != null && Number.isFinite(Number(t.dom)) ? Number(t.dom) : null))
    .filter((d): d is number => d != null && d >= 0 && d < 10000)
  const domFromDates =
    domFromColumn.length > 0
      ? []
      : rows
          .filter((t) => t.closeDate && t.onMarketDate)
          .map((t) => {
            const close = new Date(t.closeDate!).getTime()
            const start = new Date(t.onMarketDate!).getTime()
            const days = Math.round((close - start) / (24 * 60 * 60 * 1000))
            return days >= 0 && days < 10000 ? days : null
          })
          .filter((d): d is number => d != null)
  const allDoms = domFromColumn.length > 0 ? domFromColumn : domFromDates
  const avgDom = allDoms.length > 0 ? Math.round(allDoms.reduce((a, b) => a + b, 0) / allDoms.length) : null
  return { avgSalePrice, avgDom }
}

/** Reviews for broker (not hidden), newest first. */
export async function getAgentReviews(brokerId: string, limit: number): Promise<ReviewRow[]> {
  const { data } = await supabase()
    .from('reviews')
    .select('id, source, rating, text, reviewer_name, review_date')
    .eq('broker_id', brokerId)
    .eq('is_hidden', false)
    .order('review_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit)
  return (data ?? []) as ReviewRow[]
}

/** Broker gallery images (page_images where page_type='broker', page_id=brokerId). */
export async function getBrokerGalleryImages(brokerId: string): Promise<{ id: string; image_url: string }[]> {
  const { data } = await supabase()
    .from('page_images')
    .select('id, image_url')
    .eq('page_type', 'broker')
    .eq('page_id', brokerId)
  return (data ?? []) as { id: string; image_url: string }[]
}

export type SubmitBrokerInquiryParams = {
  brokerId: string
  brokerSlug?: string
  name: string
  email: string
  phone?: string
  message: string
  helpType?: string
}

/** Submit broker contact form: send to FUB as General Inquiry with broker context. */
export async function submitBrokerInquiry(
  params: SubmitBrokerInquiryParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { brokerId, brokerSlug, name, email, message, phone, helpType } = params
  const emailTrim = email?.trim()
  if (!emailTrim) return { ok: false, error: 'Email is required.' }

  const { sendEvent } = await import('@/lib/followupboss')
  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
  const fullMessage = [
    message,
    helpType ? `Interest: ${helpType}` : '',
    `Broker ID: ${brokerId}`,
  ]
    .filter(Boolean)
    .join('\n')

  const result = await sendEvent({
    type: 'General Inquiry',
    person: {
      emails: [{ value: emailTrim }],
      firstName: name.trim().split(/\s+/)[0] ?? undefined,
      lastName: name.trim().split(/\s+/).slice(1).join(' ') || undefined,
      phones: phone?.trim() ? [{ value: phone.trim() }] : undefined,
    },
    source,
    message: fullMessage,
    sourceUrl: `${source}/agents`,
    pageUrl: `${source}/agents`,
    pageTitle: 'Agent contact form',
    brokerAttribution: brokerSlug?.trim()
      ? {
          brokerSlug: brokerSlug.trim().toLowerCase(),
        }
      : undefined,
  })

  if (!result.ok) return { ok: false, error: result.error ?? 'Failed to send.' }
  return { ok: true }
}

/** Full agent detail by slug. */
export async function getAgentBySlug(slug: string): Promise<AgentDetail | null> {
  const broker = await getBrokerBySlug(slug)
  if (!broker) return null
  const [activeCount, soldStats, reviewStats, perf] = await Promise.all([
    getActiveCountForBroker(broker.license_number, broker.email),
    getSoldStatsForBroker(broker.license_number, broker.email),
    getReviewStatsForBroker(broker.id),
    getAgentPerformanceStats(broker.license_number, broker.email),
  ])
  return {
    ...broker,
    activeCount,
    soldCount24Mo: soldStats.count,
    soldVolume24Mo: soldStats.volume,
    avgDom: perf.avgDom,
    avgSalePrice: perf.avgSalePrice,
    avgRating: reviewStats.avgRating,
    reviewCount: reviewStats.reviewCount,
  }
}
