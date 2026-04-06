import { createClient } from '@supabase/supabase-js'
import { fetchListingsWithVideos } from '@/lib/fetch-listings-with-videos'

export type RefreshVideoToursCacheResult = {
  ok: boolean
  homeCount: number
  hubCount: number
  updated_at: string | null
  error: string | null
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Rebuilds `video_tours_cache` (central_oregon_home ×12, central_oregon_hub ×48).
 * Requires `SUPABASE_SERVICE_ROLE_KEY`. Used by cron, `getRefreshVideoToursCache` server action, scripts.
 */
export async function executeRefreshVideoToursCache(): Promise<RefreshVideoToursCacheResult> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      ok: false,
      homeCount: 0,
      hubCount: 0,
      updated_at: null,
      error: 'Supabase service role not configured',
    }
  }

  try {
    const hubFilters = {
      region: 'central_oregon' as const,
      sort: 'price_desc' as const,
      status: 'active' as const,
      limit: 48,
    }
    const homeFilters = { ...hubFilters, limit: 12 }

    const [homeRows, hubRows] = await Promise.all([
      fetchListingsWithVideos(supabase, homeFilters),
      fetchListingsWithVideos(supabase, hubFilters),
    ])

    const now = new Date().toISOString()
    const { error } = await supabase.from('video_tours_cache').upsert(
      [
        { scope: 'central_oregon_home', listings: homeRows, updated_at: now },
        { scope: 'central_oregon_hub', listings: hubRows, updated_at: now },
      ],
      { onConflict: 'scope' }
    )

    if (error) {
      console.error('[executeRefreshVideoToursCache] upsert', error)
      return {
        ok: false,
        homeCount: homeRows.length,
        hubCount: hubRows.length,
        updated_at: null,
        error: error.message,
      }
    }

    return {
      ok: true,
      homeCount: homeRows.length,
      hubCount: hubRows.length,
      updated_at: now,
      error: null,
    }
  } catch (err) {
    console.error('[executeRefreshVideoToursCache]', err)
    return {
      ok: false,
      homeCount: 0,
      hubCount: 0,
      updated_at: null,
      error: err instanceof Error ? err.message : 'refresh failed',
    }
  }
}
