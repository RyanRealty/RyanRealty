/**
 * City-level geographic facts for listing detail (no fabricated per-listing
 * drive times). City without a verified line returns null so the lifestyle
 * line simply does not render rather than show a wrong one (§0).
 */
const CITY_LIFESTYLE_LINE: Record<string, string> = {
  bend: 'In Bend, the largest city in Central Oregon, between the high desert and the Cascades.',
  redmond: 'In Redmond, at the center of the Central Oregon High Desert.',
  sisters: 'In Sisters, at the foot of the Three Sisters.',
  sunriver: 'In Sunriver, a Deschutes River resort community south of Bend.',
  'la pine': 'In La Pine, high desert near the Cascade Lakes and Newberry National Volcanic Monument.',
  tumalo: 'In Tumalo, just northwest of Bend.',
  prineville: 'In Prineville, in the Crooked River valley.',
  terrebonne: 'In Terrebonne, beneath Smith Rock State Park.',
  'powell butte': 'In Powell Butte, ranch country between Bend and Prineville.',
  madras: 'In Madras, near Lake Billy Chinook.',
  'crooked river ranch': 'In Crooked River Ranch, high-desert canyon country north of Terrebonne.',
}

export function buildLifestyleLine(listing: { city: string | null }): string | null {
  const key = (listing.city ?? '').toLowerCase().trim()
  return CITY_LIFESTYLE_LINE[key] ?? null
}
