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

/**
 * A frame OF ONE NAMED PLACE on the board, keyed by the board row's key
 * (SITE-116 round 2, 2026-09-16). The evaluator's finding was that six of
 * nine Tetherow places render as photo-less text cards while the resort's own
 * homepage is a grid of photo tiles, and Matt's words were "there should be
 * some imagery, we can't just have walls of text".
 *
 * THE RULE THIS MAP OBEYS, AND WHY IT IS SHORT. A photograph on a tile is a
 * claim that the frame shows THAT place. The three Tetherow frames we own are
 * all of the golf course, so the golf tile gets one and the café, the spa, the
 * sport centre, the courts, the Nordic loops, the two restaurants and Shevlin
 * Park get none — because we hold none. A generated still is not a
 * photograph either: `pickLibraryPhotos` already refuses `source:
 * 'grok-imagine'`, and nothing here reaches around that. A tile with no frame
 * renders the board's designed place mark (V3PlaceAmenities), which says "we
 * have not photographed this yet" honestly instead of showing an empty box or
 * a picture of somewhere else.
 *
 * The other way a tile gets a real photograph needs no entry here: when the
 * row carries a `blog_slug` and we have published a guide about that place,
 * the page puts the guide's own cover on the tile. NorthWest Crossing's two
 * parks arrive that way.
 */
const CURATED_PLACE_TILE_PHOTOS: Record<string, Record<string, PlacePhoto>> = {
  tetherow: {
    'golf-course': {
      src: '/lp/tetherow/img/tetherow-aerial-course.jpg',
      alt: 'The Tetherow course from the air: fairways, sagebrush rough, and the homes along them',
    },
  },
  heath: {
    'golf-course': {
      src: '/lp/tetherow/img/tetherow-course-118.jpg',
      alt: 'A fairway at Tetherow, fescue and sagebrush on both sides',
    },
  },
}

/**
 * The frame for one board row, or null. Pure and synchronous: the map is
 * authored, so a caller never waits on it and a missing entry is the normal
 * case rather than a failure.
 */
export function curatedPlaceTilePhoto(slug: string, key: string | null | undefined): PlacePhoto | null {
  const k = key?.trim()
  if (!k) return null
  return CURATED_PLACE_TILE_PHOTOS[slug]?.[k] ?? null
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
 * library photos, never a frame already spent elsewhere on the page.
 *
 * `excludeSrc` takes one path or several: the fold's hero, and (SITE-116 round
 * 2) any frame already standing on a board tile. A frame on the tile of the
 * place it shows beats the same frame in a general strip, so the strip yields
 * it rather than printing it twice.
 */
export async function getPlacePhotoStrip(
  slug: string,
  options: { excludeSrc?: string | readonly (string | null | undefined)[] | null; limit?: number } = {},
): Promise<PlacePhoto[]> {
  const limit = options.limit ?? 3
  const excluded = new Set(
    (Array.isArray(options.excludeSrc) ? options.excludeSrc : [options.excludeSrc])
      .map((s) => (typeof s === 'string' && s.trim() ? normalize(s) : null))
      .filter((s): s is string => Boolean(s)),
  )
  const out: PlacePhoto[] = []
  const seen = new Set<string>()
  const push = (photo: PlacePhoto) => {
    const key = normalize(photo.src)
    if (!key || seen.has(key) || excluded.has(key)) return
    seen.add(key)
    out.push(photo)
  }

  for (const photo of CURATED_COMMUNITY_PHOTOS[slug] ?? []) push(photo)

  if (out.length < limit) {
    for (const photo of pickLibraryPhotos(await readManifest(), slug)) push(photo)
  }

  return out.slice(0, limit)
}
