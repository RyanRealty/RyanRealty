/**
 * Shared images for About-tab sections (Attractions, Places to eat).
 * One image per section reused across all cities/subdivisions.
 * Set NEXT_PUBLIC_SECTION_IMAGE_ATTRACTIONS and NEXT_PUBLIC_SECTION_IMAGE_DINING
 * to use your own (e.g. Supabase Storage); otherwise fallback placeholders are used.
 */

const FALLBACK_ATTRACTIONS =
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1200&q=80'
const FALLBACK_DINING =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'

export function getSectionImageAttractions(): string {
  return process.env.NEXT_PUBLIC_SECTION_IMAGE_ATTRACTIONS?.trim() || FALLBACK_ATTRACTIONS
}

export function getSectionImageDining(): string {
  return process.env.NEXT_PUBLIC_SECTION_IMAGE_DINING?.trim() || FALLBACK_DINING
}
