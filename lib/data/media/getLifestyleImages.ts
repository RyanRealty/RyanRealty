/**
 * getLifestyleImages — approved Central Oregon active-lifestyle photography
 * (mountain biking, skiing, fly fishing, hiking, climbing, trail running, …)
 * from `asset_library`, surface-tagged 'lifestyle'. Powers the LifestyleStrip
 * section ("why people live here"), kept SEPARATE from the scenic hero/card
 * pools so an activity shot never lands on a geo tile.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type LifestyleImage = { url: string; activity: string }

// Map an activity subject tag to a human label for the caption.
const ACTIVITY_LABEL: Record<string, string> = {
  'mountain-biking': 'Mountain biking',
  skiing: 'Skiing',
  snowboarding: 'Snowboarding',
  'fly-fishing': 'Fly fishing',
  hiking: 'Hiking',
  'rock-climbing': 'Rock climbing',
  'trail-running': 'Trail running',
  kayaking: 'Kayaking',
  paddleboarding: 'Paddleboarding',
  golf: 'Golf',
  camping: 'Camping',
  brewery: 'Breweries',
}

function labelFor(subjects: string[] | null): string {
  for (const s of subjects ?? []) {
    if (ACTIVITY_LABEL[s]) return ACTIVITY_LABEL[s]
  }
  return 'Central Oregon'
}

async function _getLifestyleImagesUncached(limit = 12): Promise<LifestyleImage[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('asset_library')
    .select('file_url, subject_tags')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .contains('surface_tags', ['lifestyle'])
    .not('file_url', 'is', null)
    .limit(60)
  if (error || !data) {
    if (error) console.error('[getLifestyleImages]', error)
    return []
  }
  // One photo per activity first (variety), then fill to `limit`.
  const rows = data as Array<{ file_url: string; subject_tags: string[] | null }>
  const seen = new Set<string>()
  const primary: LifestyleImage[] = []
  const rest: LifestyleImage[] = []
  for (const r of rows) {
    const activity = labelFor(r.subject_tags)
    const img = { url: r.file_url, activity }
    if (!seen.has(activity)) {
      seen.add(activity)
      primary.push(img)
    } else {
      rest.push(img)
    }
  }
  return [...primary, ...rest].slice(0, limit)
}

export const getLifestyleImages = unstable_cache(
  _getLifestyleImagesUncached,
  ['lifestyle-images-v1'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
)
