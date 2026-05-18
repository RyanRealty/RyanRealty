/**
 * Pulse feed accessor for the Ryan Realty asset library.
 *
 * Source of truth: `data/asset-library/manifest.json`. Photos and videos
 * registered there are pre-approved, tagged, and licensed — they're the
 * preferred backing for any /pulse card that doesn't carry first-party media.
 *
 * For now the manifest is read at build/request time and filtered in memory.
 * If we ever need real-time reads, swap to `lib/asset-library.mjs` (which
 * already supports a Supabase cloud read path).
 */

import manifest from '@/data/asset-library/manifest.json'

export type AssetType = 'photo' | 'video' | 'audio' | 'render'
export type AssetApproval = 'approved' | 'intake' | 'rejected' | 'expired'

export type LibraryAsset = {
  id: string
  type: AssetType
  source: string
  file_path: string | null
  file_url: string | null
  /** Public URL the browser can load. Resolved from file_path when available. */
  public_url: string | null
  width: number
  height: number
  duration_sec: number | null
  geo_tags: string[]
  subject_tags: string[]
  search_query: string | null
  creator: string | null
  creator_url: string | null
  license: string | null
  approval: AssetApproval
}

type ManifestAsset = {
  id: string
  type: string
  source: string
  file_path?: string | null
  file_url?: string | null
  geo_tags?: string[]
  subject_tags?: string[]
  search_query?: string | null
  width?: number
  height?: number
  duration_sec?: number | null
  creator?: string | null
  creator_url?: string | null
  license?: string | null
  approval?: string
}

const ASSETS: LibraryAsset[] = (manifest.assets as ManifestAsset[]).map((a) => {
  const publicUrl =
    a.file_path && a.file_path.startsWith('public/')
      ? a.file_path.replace(/^public/, '')
      : a.file_url ?? null
  return {
    id: a.id,
    type: (a.type ?? 'photo') as AssetType,
    source: a.source ?? 'unknown',
    file_path: a.file_path ?? null,
    file_url: a.file_url ?? null,
    public_url: publicUrl,
    width: Number(a.width ?? 0),
    height: Number(a.height ?? 0),
    duration_sec: a.duration_sec == null ? null : Number(a.duration_sec),
    geo_tags: a.geo_tags ?? [],
    subject_tags: a.subject_tags ?? [],
    search_query: a.search_query ?? null,
    creator: a.creator ?? null,
    creator_url: a.creator_url ?? null,
    license: a.license ?? null,
    approval: (a.approval ?? 'intake') as AssetApproval,
  }
})

const APPROVED = ASSETS.filter((a) => a.approval === 'approved')

export type AssetQuery = {
  type?: AssetType
  geo?: string[]
  subject?: string[]
  /** When set, requires the asset to have a non-empty public_url. */
  servable?: boolean
}

/** Score how well an asset matches a query — used to rank within results. */
function matchScore(asset: LibraryAsset, query: AssetQuery): number {
  let score = 0
  if (query.geo) {
    const geoSet = new Set(query.geo.map((g) => g.toLowerCase()))
    for (const g of asset.geo_tags) {
      if (geoSet.has(g.toLowerCase())) score += 2
    }
  }
  if (query.subject) {
    const subjSet = new Set(query.subject.map((s) => s.toLowerCase()))
    for (const s of asset.subject_tags) {
      if (subjSet.has(s.toLowerCase())) score += 1
    }
  }
  return score
}

export function searchAssets(query: AssetQuery): LibraryAsset[] {
  let results = APPROVED.slice()
  if (query.type) results = results.filter((a) => a.type === query.type)
  if (query.servable) results = results.filter((a) => Boolean(a.public_url))
  // Rank by tag match (descending). Ties break by registration order, which
  // makes results stable across calls.
  const scored = results.map((a) => ({ a, score: matchScore(a, query) }))
  scored.sort((x, y) => y.score - x.score)
  return scored.map((s) => s.a)
}

export function findAssetById(id: string): LibraryAsset | null {
  return APPROVED.find((a) => a.id === id || a.id.startsWith(id)) ?? null
}

/** Convenience: returns the first matching photo's public_url or null. */
export function findPhotoUrl(query: AssetQuery): string | null {
  const matches = searchAssets({ ...query, type: 'photo', servable: true })
  return matches[0]?.public_url ?? null
}

/** Build a photo credit string when the asset has an outside creator. */
export function buildCreditLine(asset: LibraryAsset | null): string | null {
  if (!asset?.creator) return null
  const source = asset.source && asset.source !== 'curated' ? asset.source : null
  if (source) return `Photo by ${asset.creator} on ${capitalize(source)}`
  return `Photo by ${asset.creator}`
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
