/**
 * Broker types. Three active brokers (public.brokers, ordered by sort_order):
 *   - matthew-ryan   (Matt Ryan, Owner & Principal Broker)
 *   - paul-stevenson (Paul Stevenson, Broker)
 *   - rebecca-peterson (Rebecca Ryser Peterson, Broker)
 *
 * `slug` is the DB slug (data-driven, not a fixed union) — getBrokerBySlug
 * resolves inbound aliases (matt, matt-ryan, rebecca-ryser-peterson, …) to
 * these canonical values.
 */

/**
 * Broker slug. Data-driven (the brokers table owns the canonical slugs), so
 * this is a permissive string alias rather than a fixed union — the old union
 * (`matt-ryan` | …) drifted from the real DB slugs (`matthew-ryan`, …) and
 * caused silent mismatches. Re-exported via lib/data/index + used by lead.ts.
 */
export type BrokerSlug = string

export type BrokerSocial = {
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  youtube: string | null
  tiktok: string | null
  x: string | null
}

export type Broker = {
  slug: string
  fullName: string
  title: string
  email: string | null
  /** Public display phone (dotted, e.g. 541.703.3095) — normalized from the
   *  brokers.phone column, which holds the FUB-tracked number so inbound calls
   *  attribute correctly. */
  phoneDirect: string | null
  phoneFub: string | null
  headshotPng: string          // /images/brokers/<slug>.png (transparent PNG)
  headshotJpg: string          // /images/brokers/<slug>.jpg (legacy white-bg fallback)
  licenseNumber: string | null
  bio: string | null
  isPrincipal: boolean

  // ── Enrichment from public.brokers (optional; null/empty when unset) ──
  /** Short positioning line under the name. */
  tagline?: string | null
  /** Focus-area pills (e.g. "Redmond Area", "First-Time Buyers"). */
  specialties?: string[]
  /** Professional designations (e.g. "ABR", "GRI"). */
  designations?: string[]
  yearsExperience?: number | null
  /** Remote photo_url from the DB; the local headshotPng is preferred for render. */
  photoUrl?: string | null
  /** External review-platform profile URLs (verified links, never inline review text). */
  reviews?: { google: string | null; zillow: string | null }
  social?: BrokerSocial
  introVideoUrl?: string | null
}
