'use server'

import { createClient } from '@supabase/supabase-js'
import {
  getListingsForHomeTiles,
  getHomeTileRowsByKeys,
  getCityMarketStats,
  getHotCommunitiesInCity,
} from '@/app/actions/listings'
import { getTrendingListingKeys } from '@/app/actions/listing-views'
import { sendEvent } from '@/lib/followupboss'
import type { HomeTileRow } from '@/app/actions/listings'
import type { HotCommunity } from '@/app/actions/listings'
import type { CityMarketStats } from '@/app/actions/listings'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, details'

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const CLOSED_OR = 'StandardStatus.ilike.%Closed%'

/** Featured: top 6 by engagement view_count, then by ModificationTimestamp. Active only. */
export async function getFeaturedListings(): Promise<HomeTileRow[]> {
  try {
    const sb = supabase()
    const { data: em } = await sb
      .from('engagement_metrics')
      .select('listing_key, view_count')
      .order('view_count', { ascending: false })
      .limit(20)
    const keys = (em ?? []).map((r: { listing_key?: string }) => (r?.listing_key ?? '').trim()).filter(Boolean)
    if (keys.length === 0) {
      const { data: fallback } = await sb
        .from('listings')
        .select('ListingKey')
        .or(ACTIVE_OR)
        .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
        .limit(6)
      const fallbackKeys = (fallback ?? []).map((r: { ListingKey?: string }) => (r?.ListingKey ?? '').trim()).filter(Boolean)
      const rows = await getHomeTileRowsByKeys(fallbackKeys)
      return rows.filter((r) => /active|for sale|coming soon/i.test(String(r.StandardStatus ?? ''))).slice(0, 6)
    }
    const rows = await getHomeTileRowsByKeys(keys)
    return rows.filter((r) => /active|for sale|coming soon/i.test(String(r.StandardStatus ?? ''))).slice(0, 6)
  } catch {
    return []
  }
}

/** Just listed: 8 newest Active by ModificationTimestamp. */
export async function getJustListed(): Promise<HomeTileRow[]> {
  try {
    const rows = await getListingsForHomeTiles({ city: 'Bend', limit: 8 })
    return rows.slice(0, 8)
  } catch {
    return []
  }
}

/** Recently sold: 4 newest Closed with close price/date. */
export async function getRecentlySold(): Promise<(HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  try {
    const sb = supabase()
    const { data } = await sb
      .from('listings')
      .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
      .or(CLOSED_OR)
      .not('CloseDate', 'is', null)
      .order('CloseDate', { ascending: false, nullsFirst: false })
      .limit(8)
    const rows = (data ?? []) as (HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
    return rows.slice(0, 4)
  } catch {
    try {
      const sb = supabase()
      const { data } = await sb
        .from('listings')
        .select(`${HOME_TILE_SELECT}, close_price, close_date`)
        .or(CLOSED_OR)
        .not('close_date', 'is', null)
        .order('close_date', { ascending: false, nullsFirst: false })
        .limit(8)
      const rows = (data ?? []) as (HomeTileRow & { close_price?: number | null; close_date?: string | null })[]
      return rows.slice(0, 4).map((r) => ({
        ...r,
        ClosePrice: (r as { close_price?: number }).close_price,
        CloseDate: (r as { close_date?: string }).close_date,
      }))
    } catch {
      return []
    }
  }
}

/** Price drops: 6 listings where original price > current price (from listings table). */
export async function getPriceDrops(): Promise<(HomeTileRow & { originalPrice?: number; savings?: number })[]> {
  try {
    const sb = supabase()
    const { data } = await sb
      .from('listings')
      .select(`${HOME_TILE_SELECT}, OriginalListPrice`)
      .or(ACTIVE_OR)
      .not('ListPrice', 'is', null)
      .limit(300)
    const rows = (data ?? []) as (HomeTileRow & { OriginalListPrice?: number | null })[]
    const withDrop = rows.filter(
      (r) => r.OriginalListPrice != null && r.ListPrice != null && r.OriginalListPrice > r.ListPrice
    )
    return withDrop.slice(0, 6).map((r) => ({
      ...r,
      originalPrice: r.OriginalListPrice ?? undefined,
      savings: r.OriginalListPrice != null && r.ListPrice != null ? r.OriginalListPrice - r.ListPrice : undefined,
    }))
  } catch {
    try {
      const sb = supabase()
      const { data } = await sb
        .from('listings')
        .select(`${HOME_TILE_SELECT}, original_list_price`)
        .or(ACTIVE_OR)
        .not('list_price', 'is', null)
        .limit(300)
      const rows = (data ?? []) as (HomeTileRow & { original_list_price?: number | null })[]
      const withDrop = rows.filter(
        (r) =>
          (r as { original_list_price?: number }).original_list_price != null &&
          r.ListPrice != null &&
          (r as { original_list_price: number }).original_list_price > r.ListPrice!
      )
      return withDrop.slice(0, 6).map((r) => ({
        ...r,
        originalPrice: (r as { original_list_price?: number }).original_list_price ?? undefined,
        savings:
          (r as { original_list_price?: number }).original_list_price != null && r.ListPrice != null
            ? (r as { original_list_price: number }).original_list_price - r.ListPrice
            : undefined,
      }))
    } catch {
      return []
    }
  }
}

/** Community highlights: top 6 by listing count (Bend city). */
export async function getCommunityHighlights(): Promise<HotCommunity[]> {
  const list = await getHotCommunitiesInCity('Bend')
  return list.slice(0, 6)
}

/** Market snapshot for Bend (active count, median price, avg DOM). */
export async function getMarketSnapshot(): Promise<CityMarketStats & { avgDom?: number | null }> {
  const stats = await getCityMarketStats({ city: 'Bend' })
  return { ...stats, avgDom: null }
}

/** Trending: 4 listings by trending (listing_views) for Bend. */
export async function getTrendingListings(): Promise<HomeTileRow[]> {
  const keys = await getTrendingListingKeys('Bend', 4)
  if (keys.length === 0) {
    const fallback = await getListingsForHomeTiles({ city: 'Bend', limit: 4 })
    return fallback
  }
  const rows = await getHomeTileRowsByKeys(keys)
  return rows.filter((r) => /active|pending|for sale|coming soon/i.test(String(r.StandardStatus ?? ''))).slice(0, 4)
}

/** Blog posts for homepage teaser. Returns empty until blog CMS exists. */
export async function getBlogPostsForHome(): Promise<Array<{
  id: string
  title: string
  excerpt: string
  slug: string
  imageUrl?: string | null
  publishedAt: string
  readTimeMinutes?: number
  category?: string | null
}>> {
  return []
}

/** Newsletter signup: push to FUB as lead with tag "newsletter-signup". */
export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = email?.trim().toLowerCase()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Invalid email' }
  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryanrealty.com').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const result = await sendEvent({
    type: 'Registration',
    person: { emails: [{ value: e }] },
    source,
    message: 'newsletter-signup',
  })
  if (result.ok) return { ok: true }
  return { ok: false, error: result.error ?? 'Subscription failed' }
}
