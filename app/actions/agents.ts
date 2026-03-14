'use server'

import { createClient } from '@supabase/supabase-js'
import { getActiveBrokers, getBrokerBySlug, type BrokerRow } from '@/app/actions/brokers'
import type { HomeTileRow } from '@/app/actions/listings'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Undercontract%,StandardStatus.ilike.%Contingent%'
const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, details'

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
  const roleFilter = 'agent_role.eq.list,agent_role.eq.listing'

  if (licenseNumber?.trim()) {
    const licenseTrim = licenseNumber.trim()
    const { data: byLicense } = await supabase()
      .from('listing_agents')
      .select('listing_key')
      .or(roleFilter)
      .ilike('agent_license', `%${licenseTrim}%`)
    ;(byLicense ?? []).forEach((r: { listing_key: string }) => {
      if (r.listing_key) keys.add(r.listing_key)
    })
  }

  if (brokerEmail?.trim()) {
    const emailTrim = brokerEmail.trim()
    const { data: byEmail } = await supabase()
      .from('listing_agents')
      .select('listing_key')
      .or(roleFilter)
      .ilike('agent_email', emailTrim)
    ;(byEmail ?? []).forEach((r: { listing_key: string }) => {
      if (r.listing_key) keys.add(r.listing_key)
    })
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
  const { count } = await supabase()
    .from('listings')
    .select('ListingKey', { count: 'exact', head: true })
    .or(ACTIVE_OR)
    .in('ListingKey', keys.slice(0, 5000))
  return count ?? 0
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
  const { data } = await supabase()
    .from('listings')
    .select('ClosePrice, CloseDate')
    .in('ListingKey', keys.slice(0, 5000))
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', since)
  const rows = (data ?? []) as { ClosePrice?: number | null; CloseDate?: string | null }[]
  let volume = 0
  for (const r of rows) {
    const p = Number(r.ClosePrice)
    if (Number.isFinite(p) && p > 0) volume += p
  }
  return { count: rows.length, volume }
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

/** Broker's active listings (limit). */
export async function getAgentActiveListings(
  licenseNumber: string | null,
  limit: number,
  brokerEmail?: string | null
): Promise<HomeTileRow[]> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return []
  const { data } = await supabase()
    .from('listings')
    .select(HOME_TILE_SELECT)
    .in('ListingKey', keys.slice(0, 5000))
    .or(ACTIVE_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as HomeTileRow[]
}

/** Broker's sold listings (last 24 months, limit). */
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
  const { data } = await supabase()
    .from('listings')
    .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
    .in('ListingKey', keys.slice(0, 5000))
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', since)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as (HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
}

/** Broker's pending/under-contract listings (limit). */
export async function getAgentPendingListings(
  licenseNumber: string | null,
  limit: number,
  brokerEmail?: string | null
): Promise<HomeTileRow[]> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return []
  const { data } = await supabase()
    .from('listings')
    .select(HOME_TILE_SELECT)
    .in('ListingKey', keys.slice(0, 5000))
    .or(PENDING_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as HomeTileRow[]
}

/** Performance stats from sold listings: avg sale price, avg DOM (uses days_on_market when present, else ListDate/CloseDate). */
async function getAgentPerformanceStats(
  licenseNumber: string | null,
  brokerEmail?: string | null
): Promise<{ avgSalePrice: number | null; avgDom: number | null }> {
  const keys = await getListingKeysForBroker(licenseNumber, brokerEmail)
  if (keys.length === 0) return { avgSalePrice: null, avgDom: null }
  const twentyFourMoAgo = new Date()
  twentyFourMoAgo.setMonth(twentyFourMoAgo.getMonth() - 24)
  const since = twentyFourMoAgo.toISOString().slice(0, 10)
  const { data } = await supabase()
    .from('listings')
    .select('ClosePrice, CloseDate, ListDate, days_on_market')
    .in('ListingKey', keys.slice(0, 5000))
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', since)
  const rows = (data ?? []) as {
    ClosePrice?: number | null
    CloseDate?: string | null
    ListDate?: string | null
    days_on_market?: number | null
  }[]
  const prices = rows.map((r) => Number(r.ClosePrice)).filter((p) => Number.isFinite(p) && p > 0)
  const avgSalePrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
  const domFromColumn = rows
    .map((r) => (r.days_on_market != null && Number.isFinite(Number(r.days_on_market)) ? Number(r.days_on_market) : null))
    .filter((d): d is number => d != null && d > 0 && d < 10000)
  const domFromDates =
    domFromColumn.length > 0
      ? []
      : rows
          .filter((r) => r.CloseDate && r.ListDate)
          .map((r) => {
            const close = new Date(r.CloseDate!).getTime()
            const list = new Date(r.ListDate!).getTime()
            const days = Math.round((close - list) / (24 * 60 * 60 * 1000))
            return days > 0 && days < 10000 ? days : null
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
  const { brokerId, name, email, message, phone, helpType } = params
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
