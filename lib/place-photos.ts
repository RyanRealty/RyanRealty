import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * The photographs a place page may show of the place itself — the strip on
 * the amenity board (SITE-116, Matt 2026-09-16: "there should be some imagery,
 * we can't just have walls of text").
 *
 * TWO SOURCES, BOTH ALREADY OURS, NEITHER GUESSED:
 *  1. The curated community photography under public/ that lib/geo-images.ts
 *     already resolves one-of for the hero (the Tetherow LP course frames, the
 *     snowdriftvisuals Area Guide plates). Listed here per slug, with an alt
 *     that says only what the frame shows.
 *  2. The asset library manifest (data/asset-library/manifest.json), the
 *     registry lib/asset-library.mjs curates: a photo qualifies only when it
 *     is a photograph (not a Grok Imagine generation), approved, geo-tagged
 *     with this slug, vision-graded A or B, carries a vision caption (which
 *     becomes its alt text), and is not watermarked.
 *     An ungraded photo is not shown — the grade is the quality check, and a
 *     frame nobody has looked at is not a claim we can make about the place.
 *
 * The page's hero is excluded so the board never repeats the fold. Nothing
 * here is stock of somewhere else: a community with no qualifying photograph
 * gets an empty strip, and the board renders without one.
 */

export type PlacePhoto = {
  src: string
  alt: string
  /** Photographer / licensor credit when the frame is not our own. */
  credit?: string | null
}

/** Curated, owned frames per community slug, beyond the one the hero uses. */
const CURATED_COMMUNITY_PHOTOS: Record<string, readonly PlacePhoto[]> = {
  tetherow: [
    { src: '/lp/tetherow/img/tetherow-aerial-course.jpg', alt: 'Tetherow from the air: the course, the sagebrush rough, and the homes along it' },
    { src: '/lp/tetherow/img/tetherow-course-118.jpg', alt: 'A fairway at Tetherow, fescue and sagebrush on both sides' },
    { src: '/lp/tetherow/img/tetherow-course-284.jpg', alt: 'A green at Tetherow with the Cascades behind it' },
  ],
  heath: [
    { src: '/lp/tetherow/img/tetherow-course-118.jpg', alt: 'A fairway at Tetherow, fescue and sagebrush on both sides' },
    { src: '/lp/tetherow/img/tetherow-course-284.jpg', alt: 'A green at Tetherow with the Cascades behind it' },
  ],
  'broken-top': [{ src: '/images/communities/broken-top.jpg', alt: 'The Broken Top entrance sign among ponderosa pines' }],
  // caldera-springs: no curated entry on purpose — the library holds six
  // graded frames of it, including the same entrance boulder the Area Guide
  // plate shows, and the strip showed that boulder twice (2026-09-16).
  'northwest-crossing': [{ src: '/images/communities/northwest-crossing.jpg', alt: 'NorthWest Crossing from above: the roundabout and the mixed-use blocks of the neighborhood center' }],
  'three-rivers': [{ src: '/images/communities/three-rivers.jpg', alt: 'Three Rivers South, near Sunriver' }],
  'vandevert-ranch': [{ src: '/images/communities/vandevert-ranch.jpg', alt: 'Vandevert Ranch on the Little Deschutes' }],
}

export type ManifestAsset = {
  type?: string
  /** Where the frame came from: 'curated', 'pexels', 'grok-imagine', … */
  source?: string
  approval?: string
  geo_tags?: string[]
  file_url?: string | null
  license?: string | null
  creator?: string | null
  vision_quality?: string | null
  vision_caption?: string | null
  vision_scene?: string | null
  vision_watermark?: boolean | null
}

/**
 * The library frames that qualify for a place, A before B, one frame per
 * vision scene so a strip never shows the same subject twice. Pure, so the
 * rule is testable without the manifest on disk.
 */
export function pickLibraryPhotos(assets: readonly ManifestAsset[], slug: string): PlacePhoto[] {
  const graded = assets
    .filter(
      (a) =>
        a.type === 'photo' &&
        // A Grok Imagine still is a generated view, not a photograph. The
        // Stage may use one as a hero; a strip captioned "Photographs of …"
        // may not (§0: the caption is a claim). 27 community-tagged
        // generations were graded on 2026-09-16 and are excluded here.
        a.source !== 'grok-imagine' &&
        a.approval === 'approved' &&
        (a.geo_tags ?? []).includes(slug) &&
        (a.vision_quality === 'A' || a.vision_quality === 'B') &&
        !a.vision_watermark &&
        typeof a.file_url === 'string' &&
        a.file_url.trim() !== '' &&
        typeof a.vision_caption === 'string' &&
        a.vision_caption.trim() !== '',
    )
    // A first, then B; the manifest's own order inside a grade.
    .sort((a, b) => (a.vision_quality === b.vision_quality ? 0 : a.vision_quality === 'A' ? -1 : 1))
  const scenes = new Set<string>()
  const out: PlacePhoto[] = []
  for (const a of graded) {
    const scene = a.vision_scene?.trim().toLowerCase()
    if (scene) {
      if (scenes.has(scene)) continue
      scenes.add(scene)
    }
    const owned = !a.license || a.license === 'owned'
    out.push({
      src: a.file_url!.trim(),
      alt: a.vision_caption!.trim(),
      credit: owned ? null : (a.creator?.trim() || a.license || null),
    })
  }
  return out
}

let manifestCache: Promise<ManifestAsset[]> | null = null

function readManifest(): Promise<ManifestAsset[]> {
  if (!manifestCache) {
    manifestCache = fs
      .readFile(path.join(process.cwd(), 'data', 'asset-library', 'manifest.json'), 'utf8')
      .then((raw) => {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) return parsed as ManifestAsset[]
        const o = parsed as Record<string, unknown>
        const list = (o.assets ?? o.items) as unknown
        return Array.isArray(list) ? (list as ManifestAsset[]) : []
      })
      .catch(() => [])
  }
  return manifestCache
}

function normalize(src: string): string {
  return src.trim().replace(/\?.*$/, '')
}

/**
 * Up to `limit` photographs of the place, curated frames first, then graded
 * library photos, never the frame already used as the hero.
 */
export async function getPlacePhotoStrip(
  slug: string,
  options: { excludeSrc?: string | null; limit?: number } = {},
): Promise<PlacePhoto[]> {
  const limit = options.limit ?? 3
  const exclude = options.excludeSrc ? normalize(options.excludeSrc) : null
  const out: PlacePhoto[] = []
  const seen = new Set<string>()
  const push = (photo: PlacePhoto) => {
    const key = normalize(photo.src)
    if (!key || seen.has(key) || key === exclude) return
    seen.add(key)
    out.push(photo)
  }

  for (const photo of CURATED_COMMUNITY_PHOTOS[slug] ?? []) push(photo)

  if (out.length < limit) {
    for (const photo of pickLibraryPhotos(await readManifest(), slug)) push(photo)
  }

  return out.slice(0, limit)
}
