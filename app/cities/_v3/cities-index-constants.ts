/**
 * Cities index constants. Featured slugs are the ones with a verified
 * cityHero() in lib/geo-images.ts (Family 4). Sentence fallbacks are
 * geographic facts, not market claims.
 */

export const FEATURED_CITY_SLUGS = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'terrebonne',
  'prineville',
  'madras',
  'powell-butte',
  'crooked-river-ranch',
  'culver',
] as const

export const FEATURED_PULSE_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Sun River',
  'La Pine',
  'Lapine',
  'Tumalo',
  'Terrebonne',
  'Prineville',
  'Madras',
  'Powell Butte',
  'Crooked River Ranch',
  'Culver',
] as const

export const CITY_SENTENCE_FALLBACK: Record<string, string> = {
  'la-pine': 'Larger lots and ponderosa forest at the southern end of Deschutes County.',
  tumalo: 'An unincorporated community on the Deschutes River between Bend and Sisters, with acreage lots and river access.',
  terrebonne: 'Home to Smith Rock State Park, with farm parcels above the Crooked River canyon.',
  'powell-butte': 'Ranch and acreage country between Bend and Prineville, with open Cascade views.',
  culver: 'A farm town near Lake Billy Chinook and The Cove Palisades State Park.',
  'crooked-river-ranch': 'A canyon-rim community with its own golf course between Terrebonne and Madras.',
}

export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.?](?=\s|$)/)
  return (m ? m[0] : text).trim()
}
