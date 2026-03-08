'use server'

import { createClient } from '@supabase/supabase-js'
import {
  getAdminSyncCounts,
  getListingsBreakdown,
  getListingHistoryTableStatus,
} from './listings'
import { getSyncCursor } from './sync-full-cron'
import { getSyncHistory } from './sync-history'

export type DashboardSyncData = {
  cursor: Awaited<ReturnType<typeof getSyncCursor>>
  history: Awaited<ReturnType<typeof getSyncHistory>>
  counts: Awaited<ReturnType<typeof getAdminSyncCounts>>
  breakdown: Awaited<ReturnType<typeof getListingsBreakdown>>
  historyTableStatus: Awaited<ReturnType<typeof getListingHistoryTableStatus>>
}

export async function getDashboardSyncData(): Promise<DashboardSyncData> {
  const [cursor, history, counts, breakdown, historyTableStatus] = await Promise.all([
    getSyncCursor(),
    getSyncHistory(20),
    getAdminSyncCounts(),
    getListingsBreakdown(),
    getListingHistoryTableStatus(),
  ])
  return { cursor, history, counts, breakdown, historyTableStatus }
}

export type DashboardLeadData = {
  totalVisits: number
  visitsWithUser: number
  visitsLast24h: number
  visitsWithUserLast24h: number
  recentVisits: { path: string; visit_id: string; user_id: string | null; created_at: string }[]
}

export async function getDashboardLeadData(): Promise<DashboardLeadData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return {
      totalVisits: 0,
      visitsWithUser: 0,
      visitsLast24h: 0,
      visitsWithUserLast24h: 0,
      recentVisits: [],
    }
  }
  const supabase = createClient(url, serviceKey)

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, withUserRes, last24hRes, withUser24hRes, recentRes] = await Promise.all([
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }).not('user_id', 'is', null),
    supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayAgo)
      .not('user_id', 'is', null),
    supabase
      .from('visits')
      .select('path, visit_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return {
    totalVisits: totalRes.count ?? 0,
    visitsWithUser: withUserRes.count ?? 0,
    visitsLast24h: last24hRes.count ?? 0,
    visitsWithUserLast24h: withUser24hRes.count ?? 0,
    recentVisits: (recentRes.data ?? []) as DashboardLeadData['recentVisits'],
  }
}

export type DashboardDataQuality = {
  totalListings: number
  missingPrimaryPhoto: number
  classifiedPhotos: number
}

export async function getDashboardDataQuality(): Promise<DashboardDataQuality> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { totalListings: 0, missingPrimaryPhoto: 0, classifiedPhotos: 0 }
  }
  const supabase = createClient(url, serviceKey)

  const activeOrPending = 'StandardStatus.eq.Active,StandardStatus.eq.Pending'
  const [listingsRes, missingPhotoRes, classifiedRes] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }).or(activeOrPending),
    supabase.from('listings').select('*', { count: 'exact', head: true }).or(activeOrPending).is('PhotoURL', null),
    supabase.from('listing_photo_classifications').select('*', { count: 'exact', head: true }),
  ])
  const missingDescription = 0

  const totalListings = listingsRes.count ?? 0
  const missingPrimaryPhoto = missingPhotoRes.count ?? 0
  const classifiedPhotos = classifiedRes.count ?? 0

  return { totalListings, missingPrimaryPhoto, classifiedPhotos }
}
