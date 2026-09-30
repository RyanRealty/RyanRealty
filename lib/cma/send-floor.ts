/**
 * MATT'S 80% LINE (Matt 2026-09-30). An expired-listing CMA whose recommended
 * list price sits under 80% of the price that listing last asked never leaves
 * the building by any path. It goes to Matt instead.
 *
 * Why 80%: docs/research/cma-backtest-2026-08-05.json, 3,394 Central Oregon
 * listings that came off the market unsold and later closed, matched by address.
 * Nine in ten closed at 80.2% of the failed ask or more (10th percentile 0.802,
 * median 0.942; FAILED_ASK_BACKTEST in lib/cma/expired-audit.ts carries the
 * median and 75th percentile). On 2026-09-30 four CMAs went to owners at 72% to
 * 79% of their last list, and every one was priced off the wrong sales: a
 * subdivision's own sales dropped for cheaper tracts next door, an attached ADU
 * and a second tax lot never read, a half-acre lot priced off tenth-acre lots.
 * A number that far under what nine in ten of these homes really fetched is far
 * more likely an engine miss than a finding, so a person reads it first.
 *
 * Fails closed. An expired CMA with no readable price or no readable last list
 * is held too: the line cannot be checked, so nothing sends on a guess.
 *
 * Every send rail calls this: sendCmaToLead (lib/cma/send.ts), approveCmaAction
 * (app/actions/cma-admin.ts), the prospecting text path (app/actions/prospecting.ts),
 * finalizeAndDeliverCma (lib/cma-deliver.ts), and the queue state
 * (lib/data/cma/unified-queue.ts). Held by ci:cma-send-floor.
 */

export const EXPIRED_SEND_FLOOR_RATIO = 0.8

export type ExpiredSendFloor =
  | { held: false; ratio: number | null; reason: null }
  | { held: true; ratio: number | null; reason: string }

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function positive(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Whether an expired CMA is held under the 80% line.
 *
 * `isExpired` is the caller's answer to "is this an expired-listing CMA": the
 * CMA's own origin is expired, or an expired_listings row points at it. Any
 * other CMA is never held here.
 */
export function expiredSendFloor(args: {
  isExpired: boolean
  price: number | null | undefined
  lastListPrice: number | null | undefined
}): ExpiredSendFloor {
  if (!args.isExpired) return { held: false, ratio: null, reason: null }
  const price = positive(args.price)
  const last = positive(args.lastListPrice)
  if (price == null || last == null) {
    return {
      held: true,
      ratio: null,
      reason:
        `Held for Matt: this expired CMA has no ${price == null ? 'recommended price' : 'last list price'} on file, ` +
        `so the 80% line cannot be checked. Expired CMAs under 80% of the last list never send (Matt 2026-09-30).`,
    }
  }
  const ratio = price / last
  if (ratio >= EXPIRED_SEND_FLOOR_RATIO) return { held: false, ratio, reason: null }
  return {
    held: true,
    ratio,
    reason:
      `Held for Matt: priced at ${money(price)}, ${(Math.floor(ratio * 1000) / 10).toFixed(1)}% of the last list of ${money(last)}. ` +
      `Expired CMAs under 80% of the last list never send (Matt 2026-09-30).`,
  }
}
