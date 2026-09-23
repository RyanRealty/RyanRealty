/**
 * The plat page title. Place first, Redfin-like (Matt 2026-09-17).
 * The city segment is dropped when the plat name already ends in the city —
 * "Rock Ridge Cabin Sites of Black Butte Ranch · Black Butte Ranch, Oregon"
 * said the place twice on a 120-character title (SITE-25).
 * A null city says nothing about the city (§0): the layout suffix already
 * carries "Central Oregon" once.
 *
 * County land-use file numbers never reach the title (SEO-7, visibility audit
 * 2026-09-22): "Canyon Ridge, Phase 4 711-18-000032-sub" titles as "Canyon
 * Ridge, Phase 4". The numbered phase and the full legal label stay; the legal
 * label is still printed in the page body.
 */
import { stripCountyDocumentTokens } from '@/lib/market/plat-family'
import { publishPlaceHomesTitle } from '@/lib/site/page-metadata'

export function platPageTitle(name: string, cityName: string | null): string {
  return publishPlaceHomesTitle(stripCountyDocumentTokens(name) || name, cityName)
}
