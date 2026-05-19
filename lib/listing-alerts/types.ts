/**
 * Type definitions for the LP-driven listing-alerts subsystem.
 *
 * Source of truth: marketing_brain_skills/producers/listing-alerts/SKILL.md §2 + §4.1
 *
 * Distinct from the older `public.saved_searches` table used by authenticated
 * users on /account/saved-searches. This subsystem captures anonymous LP form
 * submissions (e.g. the Custom Tetherow Alerts card on /lp/tetherow).
 */

/**
 * Inbound payload from a community/subdivision/city LP "Custom alerts" form.
 * POST body shape for /api/listing-alerts/subscribe.
 */
export interface ListingAlertsSubscribePayload {
  /** Subscriber email (required). */
  email: string
  /** Subscriber name (required). Single field, "First Last". */
  name: string
  /** LP identifier, e.g. 'lp-tetherow-v1'. Used in the unique constraint. */
  source_lp: string
  /** One of community_slug OR city_slug must be set. */
  community_slug?: string
  /** One of community_slug OR city_slug must be set. */
  city_slug?: string
  /** Dollars. Subscriber's min (typically from a select dropdown). */
  price_min: number
  /** Dollars. Subscriber's max. */
  price_max: number
  /** Minimum bedrooms. */
  beds_min: number
  /** Optional. Minimum bathrooms; defaults to 0. */
  baths_min?: number
  /** Optional. Minimum living area sqft. */
  sqft_min?: number
  /** RETS PropertyType. Defaults to 'A' (SFR); 'C' = condo, 'D' = townhouse. */
  property_type?: string
  /** Optional. Subscriber-picked sub-neighborhood (e.g. 'Heath' inside Tetherow). */
  subdivision?: string
  /** Required true. Marketing-email consent. */
  consent_marketing: boolean
  /** Optional. SMS-marketing consent (future feature). */
  consent_sms?: boolean
  /** Optional. Tracking parameters captured from LP query string. */
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }
}

/**
 * Stored criteria for a single listing-alerts subscriber. Persisted as JSON
 * in `public.listing_alerts.criteria`. Distinct from
 * ListingAlertsSubscribePayload because the persisted shape is the criteria
 * only — email/name/source_lp/community_slug/city_slug live on the row itself.
 */
export interface ListingAlertCriteria {
  price_min: number
  price_max: number
  beds_min: number
  baths_min?: number
  sqft_min?: number
  /** Defaults to 'A' (SFR) when undefined. */
  property_type?: string
  subdivision?: string
}

/**
 * A row from `public.listing_alerts`. Mirrors the SQL schema.
 */
export interface ListingAlertRow {
  id: string
  email: string
  name: string
  source_lp: string
  community_slug: string | null
  city_slug: string | null
  criteria: ListingAlertCriteria
  status: 'active' | 'paused' | 'unsubscribed'
  paused_until: string | null
  pause_reason: string | null
  unsubscribe_token: string
  utm: Record<string, unknown> | null
  fub_lead_id: string | null
  consent_marketing: boolean
  consent_sms: boolean
  created_at: string
  updated_at: string
  last_sent_at: string | null
  unsubscribed_at: string | null
}

/**
 * A row from `public.listing_alert_matches`. Tracks delivery state.
 */
export interface ListingAlertMatchRow {
  id: string
  alert_id: string
  listing_id: string
  match_type: 'new' | 'price_drop' | 'status_change'
  matched_at: string
  sent_at: string | null
  digest_id: string | null
}

/**
 * Result row from the match engine. Subset of the listings columns needed
 * to render an email card. All quoted column names from the listings table
 * are mapped to camelCase here for downstream consumption.
 */
export interface MatchedListing {
  listingId: string
  listPrice: number | null
  originalListPrice: number | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  bedroomsTotal: number | null
  bathroomsTotal: number | null
  totalLivingAreaSqFt: number | null
  cumulativeDaysOnMarket: number | null
  photoURL: string | null
  subdivisionName: string | null
  standardStatus: string | null
  modificationTimestamp: string | null
  /** Match classification produced by the engine. */
  matchType: 'new' | 'price_drop' | 'status_change'
  /** Price delta in dollars (negative for a drop). Populated for match_type='price_drop'. */
  priceDelta?: number | null
}

/**
 * Aggregate result of a single digest run for a single subscriber.
 */
export interface DigestRunResult {
  alertId: string
  email: string
  matched: number
  sent: boolean
  resendId?: string
  error?: string
  skipReason?: 'paused' | 'unsubscribed' | 'rate_limited' | 'consent_revoked' | 'no_matches' | 'no_email_client'
}

/**
 * Aggregate result of a full cron digest run across every active subscriber.
 */
export interface DigestCronSummary {
  startedAt: string
  finishedAt: string
  durationMs: number
  scanned: number
  sent: number
  skipped: number
  errors: number
  details: DigestRunResult[]
}

/**
 * Resort/community config shape (subset). Loaded from
 * `data/resort-community-<slug>.json` to resolve subdivision aliases for
 * the geo filter in the match engine.
 */
export interface ResortCommunityAliases {
  slug: string
  name: string
  city: string
  subdivision_aliases: string[]
}
