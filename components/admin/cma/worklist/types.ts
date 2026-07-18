/**
 * CMA worklist — shared contract for /admin/cmas (the Seller-CMA sibling of
 * /admin/prospecting, spec 07's card-grid + `?id=` drawer + guarded send
 * pattern). Presentational types only: the page maps raw `cmas` rows
 * (lib/data/sync/syncWrites.ts listCmasForAdmin) into CmaWorklistRow, then
 * the client tree (CmaBoard/CmaCard/CmaDetailPanel/CmaFilters) works off
 * these shapes exclusively — no component here imports the DAL.
 */

export type CmaWorklistStatus = 'draft' | 'finalized' | 'delivered' | 'archived'

export type CmaStatusFilter = 'all' | CmaWorklistStatus

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
}
