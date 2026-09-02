/**
 * CMA worklist — shared contract for /admin/cmas (the Seller-CMA sibling of
 * /admin/prospecting, spec 07's card-grid + `?id=` drawer + guarded send
 * pattern). Presentational types only: the page maps raw `cmas` rows
 * (lib/data/sync/syncWrites.ts listCmasForAdmin) into CmaWorklistRow, then
 * the client tree (CmaBoard/CmaCard/CmaDetailPanel/CmaFilters) works off
 * these shapes exclusively — no component here imports the DAL.
 */

export type CmaWorklistStatus = 'draft' | 'finalized' | 'delivered' | 'archived'

/** 'asked' is a virtual facet: a person requested this value (seller-lp /
 *  lead-form) and it was never delivered — the send queue's front of line. */
export type CmaStatusFilter = 'all' | 'asked' | CmaWorklistStatus

export interface CmaWorklistFilters {
  q: string | null
  city: string | null
  status: CmaStatusFilter
  page: number
  pageSize: number
}

export interface CmaWorklistRow {
  /** cmas.id (uuid) — the `?id=` detail-drawer key. */
  id: string
  slug: string
  subjectAddress: string
  subjectSubdivision: string | null
  subjectCity: string | null
  clientName: string | null
  clientEmail: string | null
  brokerSlug: string | null
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
  compsCount: number | null
  status: CmaWorklistStatus
  createdAt: string | null
  finalizedAt: string | null
  deliveredAt: string | null
  builtAt: string | null
  buildError: string | null
  /** build_summary.needs_review — the comp set was too heterogeneous for the
   *  deterministic builder to trust; the broker must confirm before it ships. */
  needsReview: boolean
  /** html_path starts with 'db:' or 'public/cmas/' — an openable document exists. */
  hasDocument: boolean
  /** cmas.published_to_listing — the value range is live on the public listing page. */
  publishedToListing: boolean
  publishedAt: string | null
  /** cmas.subject_listing_key — the listing this document is attached to, if any. */
  listingKey: string | null
  /** cmas.request_source — who asked: seller-lp / lead-form (a real person),
   *  expired-listing-cron / fsbo-cron (proactive), internal-qa, or null. */
  requestSource: string | null
}

export interface CmaWorklistSummary {
  total: number
  drafts: number
  finalized: number
  delivered: number
  /** Ever delivered (delivered_at IS NOT NULL), independent of current status —
   *  distinct from `delivered` (current status), which drops once a sent CMA
   *  is archived. Mirrors prospecting's "sent" bucket. */
  sent: number
  /** published_to_listing = true — the value range is live on a public page. */
  published: number
  /** A person asked (seller-lp / lead-form) and delivered_at is still null. */
  askedUnsent: number
}
