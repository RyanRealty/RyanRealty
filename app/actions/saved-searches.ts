'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { prewarmSearchCache } from '@/app/actions/search-cache'
import {
  buildSearchUrlFromFilters,
  getFilterNameFallback,
  getFiltersSummary,
  getSavedSearchHash,
  normalizeSavedSearchFilters,
  type SavedSearchFilters,
} from '@/lib/search-filters'

export type SavedSearchRow = {
  id: string
  name: string
  filters: Record<string, unknown>
  created_at: string
  is_public: boolean
  public_title: string | null
  filters_hash: string | null
  result_count: number | null
  cache_listing_keys: string[] | null
  cache_refreshed_at: string | null
  public_click_count: number | null
}

export type PublicSearchRow = {
  id: string
  name: string
  title: string
  href: string
  summary: string
  resultCount: number
  clickCount: number
  createdAt: string
}

export async function getSavedSearches(): Promise<SavedSearchRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('saved_searches')
    .select('id, name, filters, created_at, is_public, public_title, filters_hash, result_count, cache_listing_keys, cache_refreshed_at, public_click_count')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as SavedSearchRow[]
}

export async function createSavedSearch(
  name: string,
  filters: SavedSearchFilters,
  options?: { isPublic?: boolean; publicTitle?: string }
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const normalizedFilters = normalizeSavedSearchFilters(filters ?? {})
  const filtersHash = getSavedSearchHash(normalizedFilters)
  const isPublic = options?.isPublic === true
  const publicTitle = options?.publicTitle?.trim() || null
  const defaultPublicTitle = name.trim() || null
  const warm = await prewarmSearchCache(normalizedFilters, 24)

  const { error } = await supabase.from('saved_searches').insert({
    user_id: user.id,
    name: name.trim() || 'Saved search',
    filters: normalizedFilters,
    filters_hash: filtersHash,
    is_public: isPublic,
    public_title: isPublic ? (publicTitle ?? defaultPublicTitle) : null,
    result_count: warm.totalCount,
    cache_listing_keys: warm.listingKeys.slice(0, 24),
    cache_refreshed_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteSavedSearch(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function setSavedSearchPublicState(
  id: string,
  isPublic: boolean,
  publicTitle?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const updatePayload: Record<string, unknown> = {
    is_public: isPublic,
    public_title: isPublic ? (publicTitle?.trim() || null) : null,
  }
  if (!isPublic) updatePayload.public_click_count = 0

  const { error } = await supabase
    .from('saved_searches')
    .update(updatePayload)
    .eq('id', id.trim())
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function refreshSavedSearchCache(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, filters')
    .eq('id', id.trim())
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Search not found' }

  const filters = normalizeSavedSearchFilters((data.filters ?? {}) as SavedSearchFilters)
  const warm = await prewarmSearchCache(filters, 24)
  const { error: updateError } = await supabase
    .from('saved_searches')
    .update({
      filters_hash: warm.cacheKey,
      result_count: warm.totalCount,
      cache_listing_keys: warm.listingKeys.slice(0, 24),
      cache_refreshed_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('user_id', user.id)
  if (updateError) return { error: updateError.message }
  return { error: null }
}

export async function getPopularPublicSearches(limit = 12): Promise<PublicSearchRow[]> {
  try {
    const service = createServiceClient()
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)))
    const { data, error } = await service
      .from('saved_searches')
      .select('id, name, public_title, filters, result_count, public_click_count, created_at')
      .eq('is_public', true)
      .order('public_click_count', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit)
    if (error) return []
    const rows = (data ?? []) as Array<{
      id: string
      name: string
      public_title: string | null
      filters: SavedSearchFilters | null
      result_count: number | null
      public_click_count: number | null
      created_at: string
    }>
    return rows.map((row) => {
      const filters = normalizeSavedSearchFilters(row.filters ?? {})
      const title = row.public_title?.trim() || row.name?.trim() || getFilterNameFallback(filters)
      return {
        id: row.id,
        name: row.name?.trim() || 'Saved search',
        title,
        href: buildSearchUrlFromFilters(filters),
        summary: getFiltersSummary(filters),
        resultCount: Math.max(0, Number(row.result_count ?? 0)),
        clickCount: Math.max(0, Number(row.public_click_count ?? 0)),
        createdAt: row.created_at,
      }
    })
  } catch (error) {
    console.error('[getPopularPublicSearches]', error)
    return []
  }
}

export async function trackPublicSearchClick(id: string): Promise<void> {
  const searchId = id.trim()
  if (!searchId) return
  try {
    const service = createServiceClient()
    const { data } = await service
      .from('saved_searches')
      .select('public_click_count')
      .eq('id', searchId)
      .eq('is_public', true)
      .maybeSingle()
    if (!data) return
    const next = Math.max(0, Number((data as { public_click_count?: number | null }).public_click_count ?? 0)) + 1
    await service
      .from('saved_searches')
      .update({ public_click_count: next })
      .eq('id', searchId)
      .eq('is_public', true)
  } catch (error) {
    console.error('[trackPublicSearchClick]', error)
  }
}
