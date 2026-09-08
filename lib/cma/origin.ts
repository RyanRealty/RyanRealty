/**
 * Where a CMA came from — the ONE origin vocabulary (Matt 2026-09-04).
 *
 * Every CMA runs the same engine (buildCma → selectComps), so origin never
 * changes the pricing. It changes three things and only three: which extra
 * section the report carries, how the first-contact email opens, and whether
 * the send goes out now or through the cold drip.
 *
 * Pure — no DB, no server-only. The DAL classifies with it and the queue UI
 * renders with it, so a badge in the list can never disagree with the send
 * rule behind the button.
 */

export type CmaOrigin =
  | 'expired'
  | 'fsbo'
  | 'seller-valuation'
  | 'place-page'
  | 'lead-form'
  | 'bpo'
  | 'broker'
  | 'internal'
  | 'unknown'

/** Short label for the queue badge. */
export const CMA_ORIGIN_LABEL: Record<CmaOrigin, string> = {
  expired: 'Expired',
  fsbo: 'FSBO',
  'seller-valuation': 'Seller form',
  'place-page': 'Place page',
  'lead-form': 'Lead form',
  bpo: 'BPO',
  broker: 'Broker',
  internal: 'Internal',
  unknown: 'Unknown',
}

/**
 * One line of intent per origin — what this report is trying to do. Shown on
 * the review screen so whoever is approving knows who they are writing to.
 */
export const CMA_ORIGIN_INTENT: Record<CmaOrigin, string> = {
  expired: 'Their listing came off unsold. Audit what happened and what sold meanwhile.',
  fsbo: 'Selling it themselves. Show the competition at their price and why FSBOs stall.',
  'seller-valuation': 'A seller weighing a move asked what it is worth.',
  'place-page': 'A homeowner on a neighborhood or community page typed their address and asked what it would sell for.',
  'lead-form': 'Asked for a value through a lead form.',
  // Verified against lib/bpo/build.ts + app/actions/bpo-admin.ts: every BPO is
  // started by a signed-in broker, from the admin form or a CRM contact card,
  // and the broker picks the purpose (pre-listing, listing appointment,
  // internal review, lender / relocation, seller check-in). There is no
  // inbound lender or asset-manager request path in this system.
  bpo: 'A broker asked for the brokerage opinion of value. The purpose on the row says why.',
  broker: 'A broker requested this for their client.',
  internal: 'Internal build — not client outreach.',
  unknown: 'Origin not recorded on the row.',
}

/**
 * `*-backfill` are the lane-recovery tokens written by
 * supabase/migrations/20260907130000_cmas_request_source_lane_backfill.sql.
 *
 * `request_source` only became a column on 2026-08-27, so every row built
 * before that carries NULL no matter which path built it. The prospect link
 * tables (`expired_listings.cma_id`, `fsbo_listings.cma_id`) prove the LANE
 * for those rows, but both the cron and the dashboard write that link, so the
 * trigger is not recoverable. These tokens record what is true — the lane —
 * rather than asserting a cron that may not have built it (§0).
 */
const EXPIRED_SOURCES = new Set([
  'expired-listing-cron',
  'expired-dashboard',
  'expired-outreach-queue',
  'expired-backfill',
])
const FSBO_SOURCES = new Set(['fsbo-cron', 'fsbo-dashboard', 'fsbo-lp', 'fsbo-outreach', 'fsbo-backfill'])
const SELLER_SOURCES = new Set(['seller-lp', 'seller-home-value'])
const PLACE_PAGE_SOURCES = new Set(['place-page'])
const LEAD_FORM_SOURCES = new Set(['lead-form', 'contact-form'])
const BROKER_SOURCES = new Set(['admin-manual', 'admin-rebuild', 'crm-contact-card', 'crm-kickoff'])
const INTERNAL_PREFIXES = ['cli-', 'brain-', 'test-']

/**
 * Resolve origin from the stored request_source, falling back to doc_type.
 *
 * A legacy `expired-audit` document is an expired build whatever its source
 * says — that doc_type was only ever produced by the expired path.
 */
export function classifyCmaOrigin(
  requestSource: string | null | undefined,
  docType?: string | null,
): CmaOrigin {
  const s = (requestSource ?? '').trim().toLowerCase()
  if (s) {
    if (EXPIRED_SOURCES.has(s)) return 'expired'
    if (FSBO_SOURCES.has(s)) return 'fsbo'
    if (SELLER_SOURCES.has(s)) return 'seller-valuation'
    if (PLACE_PAGE_SOURCES.has(s)) return 'place-page'
    if (LEAD_FORM_SOURCES.has(s)) return 'lead-form'
    if (BROKER_SOURCES.has(s)) return 'broker'
    if (INTERNAL_PREFIXES.some((p) => s.startsWith(p))) return 'internal'
  }
  if ((docType ?? '').toLowerCase() === 'expired-audit') return 'expired'
  return 'unknown'
}

/**
 * Did a person ask for this? Drives send timing (Matt 2026-09-04: asked goes
 * now, cold goes through the drip) and which email opening is honest.
 */
export function isAskedOrigin(origin: CmaOrigin): boolean {
  return (
    origin === 'seller-valuation' ||
    origin === 'place-page' ||
    origin === 'lead-form' ||
    origin === 'broker' ||
    origin === 'bpo'
  )
}

/** Cold outreach — nobody requested it, so it is spaced by the weekday drip. */
export function isColdOrigin(origin: CmaOrigin): boolean {
  return origin === 'expired' || origin === 'fsbo'
}

export type CmaSendMode = 'now' | 'drip' | 'manual'

/**
 * When approve should put the email on the wire.
 *
 * `manual` covers origins we never bulk-send: internal builds and rows whose
 * origin was never recorded. Those still send, but only from the row itself,
 * deliberately — a backfilled row with no provenance must not ride a batch.
 */
export function sendModeForOrigin(origin: CmaOrigin): CmaSendMode {
  if (isAskedOrigin(origin)) return 'now'
  if (isColdOrigin(origin)) return 'drip'
  return 'manual'
}

/** The prospect table an origin is joined to, when it has one. */
export function prospectKindForOrigin(origin: CmaOrigin): 'expired' | 'fsbo' | null {
  if (origin === 'expired') return 'expired'
  if (origin === 'fsbo') return 'fsbo'
  return null
}

/** What to call the price THEY had on it, per origin. Null when there isn't one. */
export function theirPriceLabelFor(origin: CmaOrigin): string | null {
  if (origin === 'expired') return 'Last list'
  if (origin === 'fsbo') return 'Their ask'
  return null
}
