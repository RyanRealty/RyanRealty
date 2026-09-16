/**
 * Route-local: the fact list on an amenity tile, from the config's own access
 * text (SITE-116 round 3, defect 2).
 *
 * The community configs record who can use a place as ONE authored line with
 * its parts joined by a middle dot: "Open to public · reservations via
 * Tetherow Resort", "Open to public · 7am to 2pm seasonally", "Members +
 * Lodge guests · seasonal". Round 2 printed that line whole under a badge.
 * With the badge gone, the tile is carried by type and facts, and the facts
 * are these parts, each under the label it answers: the first part is who can
 * use it; a part with a clock time in it is hours; anything else is a detail
 * (booking, season, weather).
 *
 * §0: nothing is added. Every value is a verbatim part of the config's own
 * string; the labels only name what the config's author wrote. A config with
 * no access text yields no facts and the tile prints nothing there.
 */

import type { V3PlaceAmenityFact } from '@/components/site/v3'

const CLOCK = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i

export function amenityAccessFacts(access: string | null | undefined): V3PlaceAmenityFact[] {
  const parts = (access ?? '')
    .split(/\s*[·•|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return []
  const facts: V3PlaceAmenityFact[] = []
  parts.forEach((part, index) => {
    if (index === 0) {
      facts.push({ label: 'Who can use it', value: part })
      return
    }
    if (CLOCK.test(part)) {
      facts.push({ label: 'Hours', value: part })
      return
    }
    facts.push({ label: 'Details', value: part })
  })
  return facts
}
