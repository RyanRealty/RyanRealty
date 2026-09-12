/**
 * WHICH SALES WERE SET ASIDE, in one place, so the document cannot say it in
 * one chapter and act otherwise in the next.
 *
 * tasteReview round three, §2: 65365 Concorde printed "2 sales, at $1.07M and
 * $2.95M were set aside" and then carried those two sales at 38.4 percent of
 * the weight in the recommended price, with full "Sale price today" values and
 * a Weight row and no mark. 19968 the same at 22.3 percent. A reader told a
 * sale was set aside will not expect it to be the second-heaviest sale in the
 * answer.
 *
 * So "set aside" means ONE thing in the seller document: the sale is shown,
 * it is named with the reason it was set aside, and it carries no weight row.
 * The pricing unit owns the decision — this module only reads it, and falls
 * back to the rule the unit already publishes (`rangeRule.rule`) on rows built
 * before the field landed.
 */

import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

export type SetAsideSale = {
  listingKey: string | null
  address: string | null
  reason: string | null
  adjustedPrice: number | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function bag(pricing: CmaPricing | null | undefined, key: string): Record<string, unknown> | null {
  const raw = (pricing as unknown as Record<string, unknown> | null | undefined)?.[key]
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

/**
 * The sales the pricing unit says it set aside, wherever it writes them.
 *
 * Three places are read because the field is landing on the pricing side in
 * this same cycle: whichever one carries it, the document renders what it
 * gives and never composes a set-aside list of its own.
 */
export function readSetAsideSales(pricing: CmaPricing | null | undefined): SetAsideSale[] {
  const candidates: unknown[] = [
    (pricing as unknown as { setAside?: unknown } | null | undefined)?.setAside,
    bag(pricing, 'rangeRule')?.setAside,
    bag(pricing, 'reconciliation')?.setAside,
  ]
  for (const raw of candidates) {
    if (!Array.isArray(raw) || raw.length === 0) continue
    const rows = raw
      .map((r) => {
        const o = (r ?? {}) as Record<string, unknown>
        return {
          listingKey: str(o.listingKey),
          address: str(o.address),
          reason: str(o.reason),
          adjustedPrice: num(o.adjustedPrice),
        }
      })
      .filter((r) => r.listingKey || r.address)
    if (rows.length > 0) return rows
  }
  return []
}

/** True when `pricing.rangeRule` says the extremes were trimmed. */
function trimsEachEnd(pricing: CmaPricing | null | undefined): boolean {
  return bag(pricing, 'rangeRule')?.rule === 'trimmed-one-each-end'
}

function key(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/**
 * WHICH PRINTED SALES ARE SET ASIDE, by their index in the grid.
 *
 * The field wins. When it is absent the rule is read the way it always was:
 * `trimmed-one-each-end` sets aside the highest and the lowest adjusted sale,
 * which is the sentence the pricing unit itself prints in the method block.
 * Nothing is decided here.
 */
export function setAsideCompIndexes(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[],
): Set<number> {
  const out = new Set<number>()
  const named = readSetAsideSales(pricing)
  if (named.length > 0) {
    const keys = new Set(named.flatMap((r) => [key(r.listingKey), key(r.address)].filter(Boolean)))
    comps.forEach((c, i) => {
      if (keys.has(key(c.listingKey)) || keys.has(key(c.address))) out.add(i)
    })
    if (out.size > 0) return out
  }
  if (!trimsEachEnd(pricing)) return out
  const ranked = comps
    .map((c, i) => ({ i, v: c.adjustedPrice }))
    .filter((r) => r.v != null && Number.isFinite(r.v) && r.v > 0)
    .sort((a, b) => a.v - b.v)
  // Tip Ready P0 / Cos Falcon smoke: screen needs ≥5 stacked sold comps. Do not
  // trim ends when that would leave fewer than 5 kept sales on the grid.
  const MIN_KEPT_ON_STACK = 5
  if (ranked.length < 4) return out
  if (ranked.length - 2 < MIN_KEPT_ON_STACK) return out
  out.add(ranked[0]!.i)
  out.add(ranked[ranked.length - 1]!.i)
  return out
}

/** The sales that set the number: everything the grid prints, less those. */
export function keptCompCount(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[],
): number {
  return Math.max(comps.length - setAsideCompIndexes(pricing, comps).size, 0)
}

/**
 * The set-aside sales as the document shows them: the address, and why.
 *
 * When the pricing unit supplies a reason it is printed as written. When only
 * the rule is on the row, the reason is the rule's own words — the highest and
 * the lowest, which is what `rangeRule.sentence` says three lines above.
 */
export function setAsideRows(
  pricing: CmaPricing | null | undefined,
  comps: readonly CmaAdjustedComp[],
): Array<{ address: string; reason: string }> {
  const indexes = [...setAsideCompIndexes(pricing, comps)]
  if (indexes.length === 0) return []
  const named = new Map(
    readSetAsideSales(pricing).flatMap((r) =>
      [key(r.listingKey), key(r.address)].filter(Boolean).map((k) => [k, r] as const),
    ),
  )
  const values = indexes
    .map((i) => comps[i]?.adjustedPrice ?? null)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const high = values.length ? Math.max(...values) : null
  const low = values.length ? Math.min(...values) : null
  return indexes
    .map((i) => {
      const c = comps[i]
      if (!c) return null
      const supplied = named.get(key(c.listingKey)) ?? named.get(key(c.address)) ?? null
      const price = c.adjustedPrice ?? null
      const fallback =
        price != null && high != null && price === high
          ? 'The highest of these sales once each is moved to today. The range is the spread of the rest.'
          : price != null && low != null && price === low
            ? 'The lowest of these sales once each is moved to today. The range is the spread of the rest.'
            : 'Not one of the sales the range is the spread of.'
      return { address: c.address, reason: supplied?.reason ?? fallback }
    })
    .filter((r): r is { address: string; reason: string } => r != null)
}

/**
 * `pricing.clamp.sentence` — the seller sentence the pricing unit writes when
 * the failed-ask clamp binds, and nothing at all when it does not.
 *
 * tasteReview round three, §5.2: Concorde stated a method that yields
 * $1,973,000 and printed $1,473,000, with nothing between them. The clamp is
 * the missing sentence; the document prints it under the number, where the
 * reader meets the number.
 */
export function clampSentence(pricing: CmaPricing | null | undefined): string {
  const clamp = bag(pricing, 'clamp')
  if (!clamp) return ''
  if (clamp.bound === false || clamp.binds === false || clamp.applied === false) return ''
  return str(clamp.sentence) ?? ''
}
