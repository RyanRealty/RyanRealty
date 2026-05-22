/**
 * Shared scalar types used across the Data Access Layer.
 */

/** A URL-safe slug (lowercase, hyphen-separated). */
export type Slug = string

/** ISO 8601 date string. */
export type IsoDate = string

/** ISO 8601 timestamp. */
export type IsoTimestamp = string

/** Currency in whole dollars (we round to nearest thousand at render time). */
export type Currency = number

/** Geo type discriminator used everywhere. */
export type GeoType = 'city' | 'neighborhood' | 'community' | 'subdivision' | 'zip' | 'region'

/** Result wrapper for ops that can fail with a typed error. */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Pagination input shared across list functions. */
export type Page = {
  limit?: number     // default 24
  cursor?: string    // opaque cursor for keyset pagination
}

/** Standard pagination output. */
export type Paginated<T> = {
  items: T[]
  nextCursor: string | null
  totalCount?: number
}
