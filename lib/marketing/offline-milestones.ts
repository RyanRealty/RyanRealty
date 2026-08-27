/**
 * Deal stage → Meta offline-conversion milestone.
 *
 * WHY THIS EXISTS. Meta only ever saw the form fill. It optimized for cheap
 * leads, because a cheap lead was the only outcome it could measure. Uploading
 * the real milestones back — a signed listing, a pending sale, a closing — lets
 * it optimize toward business that actually transacts, and lets us read
 * cost-per-CLOSING instead of cost-per-lead.
 *
 * Pure: stage in, milestone out. No I/O, so the mapping is testable on its own.
 */
import type { OfflineMilestone } from '@/lib/meta-offline-conversions'

/**
 * The two live pipelines, read from crm_deal_stages 2026-08-26:
 *   buyer  — Buyer Contract → Offer → Pending → Closed | Lost
 *   seller — Pre-Listing → Listed → Offer → Pending → Closed | Lost / Terminated
 *
 * `Offer` is deliberately NOT a milestone in either pipeline. An offer is not a
 * commitment — it can be rejected the same day, and feeding Meta an outcome that
 * routinely evaporates teaches it to buy leads that make offers rather than
 * leads that close. `Pending` is the first point where both sides are bound.
 *
 * `Pre-Listing` and `Lost` are not milestones either: one is an intention, the
 * other is the absence of one.
 */
const STAGE_TO_MILESTONE: Record<string, OfflineMilestone> = {
  listed: 'listing_signed',
  'buyer contract': 'buyer_signed',
  pending: 'under_contract',
  closed: 'closed',
}

export function milestoneForStage(stage: string | null | undefined): OfflineMilestone | null {
  if (!stage) return null
  return STAGE_TO_MILESTONE[stage.trim().toLowerCase()] ?? null
}

/**
 * What we tell Meta the conversion was WORTH.
 *
 * Only the closing carries a value, and that value is OUR COMMISSION — never the
 * sale price. Sending the sale price would overstate return by roughly thirty
 * times and teach the campaign to chase expensive homes rather than profitable
 * business. ROAS has to be return on the revenue we actually receive.
 *
 * The earlier milestones carry no value on purpose: they are not revenue yet, and
 * attaching a number to each would count one deal's worth three times over as it
 * moves down the pipeline.
 */
export function conversionValue(
  milestone: OfflineMilestone,
  commissionDollars: number | null | undefined,
): number | null {
  if (milestone !== 'closed') return null
  if (commissionDollars == null) return null
  const v = Number(commissionDollars)
  if (!Number.isFinite(v) || v <= 0) return null
  return v
}

/**
 * Meta's /events endpoint rejects an event_time older than roughly 7 days, so a
 * milestone can only be uploaded in a narrow window after it happens. We use 6
 * days to leave margin for a late run or a retry.
 *
 * This is why the loop had to exist BEFORE spend rather than be backfilled after:
 * a closing from three months ago cannot be uploaded at all.
 */
export const UPLOAD_WINDOW_DAYS = 6

export function withinUploadWindow(milestoneAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - milestoneAt.getTime()
  if (ageMs < 0) return false
  return ageMs <= UPLOAD_WINDOW_DAYS * 86400_000
}
