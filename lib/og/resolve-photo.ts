/**
 * Local, verified photos for share cards. No live DB read.
 *
 * Listing and blog heroes are resolved in the /api/og route. Place cards use
 * the same curated maps as the public pages (lib/geo-images). The 11 MB
 * homepage aerials stay off this path so the card stays under 1s.
 *
 * Pages with no primary photo never get a photo-less navy card. Each kind
 * picks a real Bend / Central Oregon photo we already hold:
 *   community / neighborhood / city → area aerial
 *   blog / guide                    → downtown Bend (Drake Park)
 *   homepage / listing-no-photo / other → Three Sisters landscape
 */

import { communityImage } from '@/lib/geo-images'

/** Area / aerial fallback for community, neighborhood, and city cards. */
export const OG_PHOTO_AERIAL = '/images/kb/tetherow-golf-aerial.jpg'

/** Downtown Bend for guides and blog posts with no hero. */
export const OG_PHOTO_DOWNTOWN = '/images/kb/bend-drake-park-aerial.jpg'

/** General Bend landscape for the homepage and any other photo-less page. */
export const OG_PHOTO_LANDSCAPE = '/images/kb/three-sisters-sunrise.jpg'

/** @deprecated use resolveOgFallbackPhoto('community') */
export const OG_FALLBACK_PHOTO = OG_PHOTO_AERIAL

export const OG_LOGO_REL = 'public/brand/logo-horizontal-white.png'

export type OgPhotoKind =
  | 'community'
  | 'neighborhood'
  | 'city'
  | 'blog'
  | 'guide'
  | 'listing'
  | 'default'

const CITY_OG_PHOTOS: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

const COMMUNITY_KB: Record<string, string> = {
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  'three-rivers': '/images/kb/three-rivers.jpg',
  'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
}

export function resolveOgFallbackPhoto(kind: OgPhotoKind): string {
  switch (kind) {
    case 'community':
    case 'neighborhood':
    case 'city':
      return OG_PHOTO_AERIAL
    case 'blog':
    case 'guide':
      return OG_PHOTO_DOWNTOWN
    case 'listing':
    case 'default':
      return OG_PHOTO_LANDSCAPE
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function resolvePlaceOgPhoto(kind: 'community' | 'city', slug: string): string {
  const key = slug.trim().toLowerCase()
  if (!key) return resolveOgFallbackPhoto(kind)
  if (kind === 'community') {
    return communityImage(key) ?? COMMUNITY_KB[key] ?? CITY_OG_PHOTOS[key] ?? resolveOgFallbackPhoto('community')
  }
  return CITY_OG_PHOTOS[key] ?? communityImage(key) ?? resolveOgFallbackPhoto('city')
}

export function isLocalPublicPath(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//')
}
