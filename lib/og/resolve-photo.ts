/**
 * Local, verified photos for share cards. No live DB read.
 *
 * Listing and blog heroes are resolved in the /api/og route. Place cards use
 * the same curated maps as the public pages (lib/geo-images). The 11 MB
 * homepage aerials stay off this path so the card stays under 1s.
 */

import { communityImage } from '@/lib/geo-images'

/** Web-sized Tetherow aerial (same photo as public/images/homepage/tetherow-golf-aerial.jpg). */
export const OG_FALLBACK_PHOTO = '/images/kb/tetherow-golf-aerial.jpg'

export const OG_LOGO_REL = 'public/brand/logo-horizontal-white.png'

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

export function resolvePlaceOgPhoto(kind: 'community' | 'city', slug: string): string {
  const key = slug.trim().toLowerCase()
  if (!key) return OG_FALLBACK_PHOTO
  if (kind === 'community') {
    return communityImage(key) ?? COMMUNITY_KB[key] ?? CITY_OG_PHOTOS[key] ?? OG_FALLBACK_PHOTO
  }
  return CITY_OG_PHOTOS[key] ?? communityImage(key) ?? OG_FALLBACK_PHOTO
}

export function isLocalPublicPath(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//')
}
