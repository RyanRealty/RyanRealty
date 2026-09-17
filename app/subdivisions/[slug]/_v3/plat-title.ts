/**
 * The plat page title. Place first, Redfin-like (Matt 2026-09-17).
 * The city segment is dropped when the plat name already ends in the city —
 * "Rock Ridge Cabin Sites of Black Butte Ranch · Black Butte Ranch, Oregon"
 * said the place twice on a 120-character title (SITE-25).
 * A null city says nothing about the city (§0): the layout suffix already
 * carries "Central Oregon" once.
 */
import { publishPlaceHomesTitle } from '@/lib/site/page-metadata'

export function platPageTitle(name: string, cityName: string | null): string {
  return publishPlaceHomesTitle(name, cityName)
}
