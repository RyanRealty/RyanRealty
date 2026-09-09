/**
 * The cover photo (Matt 2026-09-09, engine item 3: "cover photo and map").
 *
 * The cover used to be whatever single photo the MLS row carried as its hero
 * — usually the front of the house, sometimes a kitchen, once a floor plan.
 * This picks the best EXTERIOR among the listing's own photos: the Spark feed
 * for the subject's listing key (Photos, Primary first), each candidate graded
 * once by the same vision pass the Studio uses (lib/grok/classify.ts:
 * subject, quality 0–100, marketing overlay), stopping at the first strong
 * front exterior. Fail-open at every step: no feed, no key, no grade → the MLS
 * hero stays. A home with no exterior at all falls back to the brand hero
 * (CLAUDE.md §3, the Old Mill frame), never to a kitchen; the home's own
 * exterior, even one with a photographer's overlay, always beats the brand.
 *
 * Cost: at most MAX_GRADES vision calls a build, and one in the common case.
 */
import { gradePhoto, type PhotoGrade, type ShotSubject } from '@/lib/grok/classify'
import { grokConfigured } from '@/lib/grok/client'
import { fetchSparkListingByKey } from '@/lib/spark'
import { sparkPhotoAt } from '@/lib/cma/render-blocks'

export const MAX_GRADES = 6
/** A front exterior at or above this ends the search. */
export const STRONG_FRONT = 55
export const BRAND_HERO = '/images/hero/hero-old-mill-master-4k.jpg'

const EXTERIOR: Record<string, number> = { exterior_front: 4, aerial: 3, exterior_rear: 2, view: 1 }

export type CoverCandidate = { url: string; primary: boolean }

export type CoverPick = {
  url: string | null
  /** 'hero' = the MLS hero as it was; 'graded' = chosen by the grade; 'brand' = no usable exterior. */
  source: 'hero' | 'graded' | 'brand'
  graded: Array<{ url: string; subject: ShotSubject; quality: number; hasOverlay: boolean }>
  costUsd: number
  reason: string
}

export type CoverPhotoDeps = {
  fetchPhotos: (listingKey: string) => Promise<CoverCandidate[]>
  grade: (url: string) => Promise<(PhotoGrade & { costUsd: number | null }) | null>
  enabled: () => boolean
}

async function sparkPhotos(listingKey: string): Promise<CoverCandidate[]> {
  try {
    const res = await fetchSparkListingByKey(listingKey, 'Photos')
    const photos = res?.D?.Results?.[0]?.StandardFields?.Photos ?? []
    return photos
      .map((p) => ({ url: (p.Uri1024 ?? p.Uri1280 ?? p.Uri800 ?? p.Uri640 ?? p.UriLarge ?? '').trim(), primary: p.Primary === true }))
      .filter((p) => /^https?:\/\//.test(p.url))
  } catch {
    return []
  }
}

/**
 * The MLS CDN refuses model-side fetchers (its robots.txt; the story pass hit
 * the same wall on Anthropic 2026-08-05), so the photo is fetched HERE at a
 * modest size and handed to the grade as a data URL.
 */
async function gradeOne(url: string) {
  try {
    // The resize service does not hold every size for every photo (the
    // Concorde hero 404s at 800x600 and serves at 1600x1200): the smaller
    // variant first, the row's own URL when that is missing.
    // The row's PhotoURL often lacks the `-o.jpg` the CDN serves the original
    // under (the sync stores that form; a bare id answers 404 with a grey
    // placeholder). Smaller first, then the row's own form, then `-o.jpg`.
    const withSuffix = (u: string) => (/\.(jpe?g|png|webp)$/i.test(u) ? u : `${u}-o.jpg`)
    const variants = [...new Set([sparkPhotoAt(url, '800x600') ?? url, url, withSuffix(sparkPhotoAt(url, '800x600') ?? url), withSuffix(url)])]
    let res: Response | null = null
    for (const v of variants) {
      const r = await fetch(v, { signal: AbortSignal.timeout(8000) })
      if (r.ok) {
        res = r
        break
      }
    }
    if (!res) {
      console.warn('[cover-photo] photo fetch failed on every variant', url.slice(0, 120))
      return null
    }
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg'
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
      console.warn('[cover-photo] not an image:', mime, url.slice(0, 120))
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 4_000_000) {
      console.warn('[cover-photo] photo size', buf.length, url.slice(0, 120))
      return null
    }
    return await gradePhoto({ imageUrl: `data:${mime};base64,${buf.toString('base64')}` })
  } catch (e) {
    console.warn('[cover-photo] grade failed open:', e instanceof Error ? e.message : String(e))
    return null
  }
}

const LIVE: CoverPhotoDeps = { fetchPhotos: sparkPhotos, grade: gradeOne, enabled: grokConfigured }

export async function pickCoverPhoto(
  input: { listingKey: string | null; heroUrl: string | null },
  deps: CoverPhotoDeps = LIVE,
): Promise<CoverPick> {
  const hero = (input.heroUrl ?? '').trim() || null
  const keep = (reason: string): CoverPick => ({ url: hero, source: 'hero', graded: [], costUsd: 0, reason })
  if (!deps.enabled()) return keep('no vision pass configured')

  const feed = input.listingKey ? await deps.fetchPhotos(input.listingKey) : []
  const ordered: string[] = []
  const push = (u: string | null) => {
    if (u && !ordered.includes(u)) ordered.push(u)
  }
  push(hero)
  for (const p of feed.filter((x) => x.primary)) push(p.url)
  for (const p of feed) push(p.url)
  if (ordered.length === 0) return keep('no photo on the row and none in the feed')

  const graded: CoverPick['graded'] = []
  let cost = 0
  for (const url of ordered.slice(0, MAX_GRADES)) {
    const g = await deps.grade(url)
    if (!g) continue
    cost += g.costUsd ?? 0
    graded.push({ url, subject: g.subject, quality: g.quality, hasOverlay: g.hasOverlay })
    if (g.subject === 'exterior_front' && g.quality >= STRONG_FRONT && !g.hasOverlay) break
  }
  // The home's own exterior always beats the brand frame. A marketing overlay
  // (a banner, a stamp, another brokerage's logo) only loses to a CLEAN
  // exterior; 2465 NE 7th's one exterior is an aerial with the photographer's
  // markings, and that is still the seller's home, not the Old Mill.
  const exteriors = graded
    .filter((g) => EXTERIOR[g.subject])
    .sort(
      (a, b) =>
        Number(a.hasOverlay) - Number(b.hasOverlay) ||
        EXTERIOR[b.subject]! - EXTERIOR[a.subject]! ||
        b.quality - a.quality,
    )
  const best = exteriors[0] ?? null
  if (best) {
    const source: CoverPick['source'] = best.url === hero ? 'hero' : 'graded'
    return {
      url: best.url,
      source,
      graded,
      costUsd: cost,
      reason: `${best.subject.replace('_', ' ')} at ${best.quality}/100${best.url === hero ? ', the MLS hero' : `, chosen over the MLS hero`}`,
    }
  }
  if (graded.length === 0) return keep('no photo could be graded')
  return {
    url: BRAND_HERO,
    source: 'brand',
    graded,
    costUsd: cost,
    reason: `no usable exterior among ${graded.length} graded photo(s) (${graded.map((g) => g.subject).join(', ')})`,
  }
}
