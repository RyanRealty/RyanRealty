/**
 * Referral-tier geo classification for buyer intake (W12).
 *
 * The MLS feed is statewide, so a visitor can inquire about a listing in
 * Medford or Klamath Falls. Those inquiries must NOT enter the standard
 * Central Oregon buyer drip (the master buyer sequence auto-sends its first
 * touches). Instead they get `geo:out-of-area` + `referral:candidate` tags and
 * land in the referral queue for a broker-to-broker handoff.
 *
 * PURE module (no DB, no server imports) so every classification rule is
 * unit-tested. Callers:
 *   - app/contact/actions.ts            (live listing tour/question path)
 *   - app/actions/track-contact-agent.ts (listing inquiry actions)
 *   - app/oregon/[city]/actions.ts       (out-of-area city capture form)
 *   - lib/crm/enroll.ts                  (auto-enroll gate — covers the intake
 *     call AND the 15-min crm-auto-enroll catch-all cron)
 *
 * Fail-closed rule (lane W12): when a PROPERTY inquiry's city cannot be
 * classified, the lead is tagged `geo:unclassified` and is NOT auto-enrolled.
 * A broker reviews it by hand. General inquiries with no property in play are
 * never classified and keep the standard path.
 */

import { isCentralOregonCity } from '@/lib/central-oregon'
import { outOfAreaCitySlug } from '@/lib/out-of-area-cities'

export type PropertyGeoScope = 'local' | 'out-of-area' | 'out-of-state' | 'unknown'

/** Tag that marks a lead as an out-of-area referral candidate. */
export const REFERRAL_CANDIDATE_TAG = 'referral:candidate'

/** Geo tags that block auto-enrollment (see geoReferralEnrollBlock). */
export const GEO_OUT_OF_AREA_TAG = 'geo:out-of-area'
export const GEO_OUT_OF_STATE_TAG = 'geo:out-of-state'
export const GEO_UNCLASSIFIED_TAG = 'geo:unclassified'

/**
 * Classify the inquired PROPERTY's city.
 *
 *   local        — city is in the Central Oregon service area
 *   out-of-area  — city known, state OR (or unstated), outside the service area
 *   out-of-state — state present and not OR
 *   unknown      — no usable city (classification uncertainty → no enrollment)
 */
export function classifyPropertyGeo(
  city: string | null | undefined,
  state?: string | null,
): PropertyGeoScope {
  const st = (state ?? '').trim().toUpperCase()
  if (st && st !== 'OR' && st !== 'OREGON') return 'out-of-state'
  const c = (city ?? '').trim()
  if (!c) return 'unknown'
  return isCentralOregonCity(c) ? 'local' : 'out-of-area'
}

/**
 * Parse the city out of a display listing address of the shape
 * "123 Main St, Medford, OR 97504" (the format the listing CTA components
 * build from `address` + `cityStateZip`). Returns null unless the trailing
 * segment is a clean "ST 99999" / "ST" state block — anything else is
 * uncertainty and the caller fails toward NO enrollment.
 */
export function cityFromListingAddress(listingAddress: string | null | undefined): {
  city: string | null
  state: string | null
} {
  const raw = (listingAddress ?? '').trim()
  if (!raw) return { city: null, state: null }
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return { city: null, state: null }
  const tail = parts[parts.length - 1]
  const m = tail.match(/^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/)
  if (!m) return { city: null, state: null }
  const city = parts[parts.length - 2]
  if (!city || /\d/.test(city)) return { city: null, state: m[1].toUpperCase() }
  return { city, state: m[1].toUpperCase() }
}

/**
 * Extra tags a buyer-intake path applies for a classified property inquiry.
 * Local inquiries get nothing (standard path). Non-local inquiries get the
 * enroll-blocking geo tag + referral:candidate (+ the city interest for the
 * referral queue). Unknown gets ONLY the unclassified marker — a human
 * decides, nothing auto-sends.
 */
export function referralIntakeTags(scope: PropertyGeoScope, city?: string | null): string[] {
  switch (scope) {
    case 'local':
      return []
    case 'out-of-area':
      return [
        GEO_OUT_OF_AREA_TAG,
        REFERRAL_CANDIDATE_TAG,
        ...(city?.trim() ? [`city-interest:${outOfAreaCitySlug(city)}`] : []),
      ]
    case 'out-of-state':
      return [
        GEO_OUT_OF_STATE_TAG,
        REFERRAL_CANDIDATE_TAG,
        ...(city?.trim() ? [`city-interest:${outOfAreaCitySlug(city)}`] : []),
      ]
    case 'unknown':
      return [GEO_UNCLASSIFIED_TAG]
  }
}

/**
 * Auto-enroll gate (called from lib/crm/enroll.ts autoEnrollPerson, which
 * serves BOTH the intake fire-and-forget path and the 15-min catch-all cron).
 *
 * Returns a human-readable block reason when the person's tags mark them as a
 * referral candidate (`referral:candidate` — written by the W12 buyer-intake
 * classification and the /oregon/[city] capture form) or an unclassified
 * property inquiry (`geo:unclassified`) — none of which may enter the standard
 * drip sequences. Returns null for everyone else.
 *
 * Deliberately keyed on `referral:candidate`, NOT on the bare `geo:out-of-area`
 * tag: the seller-LP geocode path (lib/lead-geocode.ts buildGeoTags) has been
 * stamping `geo:out-of-area` on seller leads whose address falls outside the
 * covered polygons since before the referral tier existed, and gating on that
 * bare tag would silently change the live seller funnel. The referral tier owns
 * only the leads it explicitly routes.
 */
export function geoReferralEnrollBlock(tags: readonly string[] | null | undefined): string | null {
  const lower = (tags ?? []).map((t) => t.toLowerCase())
  if (lower.includes(REFERRAL_CANDIDATE_TAG)) {
    return 'referral candidate (out-of-area — referral queue, no local drip)'
  }
  if (lower.includes(GEO_UNCLASSIFIED_TAG)) {
    return 'property geo unclassified (fail-closed: broker reviews before any drip)'
  }
  return null
}
