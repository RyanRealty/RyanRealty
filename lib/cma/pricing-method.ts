/**
 * How the price was reached, stated before the evidence for it.
 *
 * Delta 1: "The method is stated in three sentences with the numbers in them,
 * above the table: which sales, how each was adjusted (date, size, style) to a
 * sale price today, and how the range and the recommended list follow."
 *
 * Every sentence here is WRITTEN BY `lib/pricing` and stored on `render_args`.
 * The renderer picks them up and orders them; it does not compose a method
 * sentence of its own, because a sentence about how a number was reached that
 * the number's own unit did not write is a sentence nobody can audit.
 *
 * Research items 2, 3, 5 and 10 all land here: the time-adjustment basis
 * (Fannie Mae B4-1.3-09 requires the data source and technique be described),
 * the range rule (USPAP permits a range; ours is the spread of the adjusted
 * prices printed below it), the reconciliation naming the most-weighted sale,
 * and the sales considered and set aside.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'
import type { CmaPricing } from '@/lib/cma/types'

const esc = escapeHtml

/** `pricing.reconciliation`, validated off the row. */
export type PricingReconciliation = {
  sentence: string | null
  mostWeighted: string | null
  weights: Array<{
    listingKey: string | null
    address: string | null
    weight: number | null
    grossAdjustmentPct: number | null
  }>
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function block(pricing: CmaPricing | null | undefined, key: string): Record<string, unknown> | null {
  const raw = (pricing as unknown as Record<string, unknown> | null)?.[key]
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

export function readReconciliation(pricing: CmaPricing | null | undefined): PricingReconciliation | null {
  const o = block(pricing, 'reconciliation')
  if (!o) return null
  const weights = Array.isArray(o.weights)
    ? o.weights.map((w) => {
        const r = (w ?? {}) as Record<string, unknown>
        return {
          listingKey: str(r.listingKey),
          address: str(r.address),
          weight: num(r.weight),
          grossAdjustmentPct: num(r.grossAdjustmentPct),
        }
      })
    : []
  return { sentence: str(o.sentence), mostWeighted: str(o.mostWeighted), weights }
}

/** The per-sale weight and gross adjustment, keyed by listing, for the grid. */
export function compWeightIndex(
  pricing: CmaPricing | null | undefined,
): Map<string, { weight: number | null; grossAdjustmentPct: number | null }> {
  const out = new Map<string, { weight: number | null; grossAdjustmentPct: number | null }>()
  for (const w of readReconciliation(pricing)?.weights ?? []) {
    if (!w.listingKey) continue
    out.set(w.listingKey, { weight: w.weight, grossAdjustmentPct: w.grossAdjustmentPct })
  }
  return out
}

/**
 * The three method sentences, in the order the method runs.
 *
 * 1. which sales — the search story the caller already composes
 * 2. how each was adjusted — `pricing.timeAdjustment.sentence`
 * 3. how the range and the recommended list follow — `pricing.rangeRule.sentence`
 *    then the reconciliation naming the sale that carried the most weight
 *
 * A missing sentence is dropped, never replaced with a renderer-written one.
 */
export function pricingMethodSentences(input: {
  pricing: CmaPricing | null | undefined
  whichSales?: string | null
}): string[] {
  const timeAdjustment = str(block(input.pricing, 'timeAdjustment')?.sentence)
  const rangeRule = str(block(input.pricing, 'rangeRule')?.sentence)
  const reconciliation = readReconciliation(input.pricing)?.sentence ?? null
  return [str(input.whichSales), timeAdjustment, rangeRule, reconciliation].filter(
    (s): s is string => s != null,
  )
}

export function renderPricingMethodHtml(input: {
  pricing: CmaPricing | null | undefined
  whichSales?: string | null
}): string {
  const sentences = pricingMethodSentences(input)
  if (sentences.length === 0) return ''
  return `<div class="method">
    ${sentences.map((s) => `<p class="method-line">${esc(s)}</p>`).join('\n    ')}
  </div>`
}

/** `pricing.rejected`, validated. */
export type RejectedSaleRow = { listingKey: string | null; address: string; reason: string }

export function readRejectedSales(pricing: CmaPricing | null | undefined): RejectedSaleRow[] {
  const raw = (pricing as unknown as { rejected?: unknown } | null)?.rejected
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      const address = str(o.address)
      const reason = str(o.reason)
      return address && reason ? { listingKey: str(o.listingKey), address, reason } : null
    })
    .filter((r): r is RejectedSaleRow => r != null)
}

/**
 * Considered and not used (research item 10).
 *
 * An appraisal names the sales it looked at and set aside, with the reason.
 * This document asserted a search radius and showed nothing that failed it, so
 * a reader had no way to see that the bigger house down the street was looked
 * at and rejected rather than missed. The reasons are composed at build from
 * each sale's own recorded facts; the renderer prints them as written.
 */
export function renderRejectedSalesHtml(
  pricing: CmaPricing | null | undefined,
  used?: ReadonlyArray<{ listingKey?: string | null; address?: string | null }>,
): string {
  // A sale cannot be both one of the sales that set the price and a sale that
  // was set aside. On 65365 Concorde the row's `rejected` list named five of
  // the six sales printed in the grid above it, so the chapter said "these
  // were looked at and set aside" under a table that had just used them.
  // The grid is the evidence; anything in it leaves this list.
  const keys = new Set(
    (used ?? []).flatMap((c) => [c.listingKey, c.address].filter((v): v is string => !!v && !!v.trim()).map((v) => v.trim().toLowerCase())),
  )
  const rows = readRejectedSales(pricing).filter(
    (r) => !keys.has(r.address.trim().toLowerCase()) && !(r.listingKey && keys.has(r.listingKey.trim().toLowerCase())),
  )
  if (rows.length === 0) return ''
  const items = rows
    .map(
      (r) =>
        `<li><span class="rj-addr">${esc(r.address)}</span><span class="rj-why">${esc(r.reason)}</span></li>`,
    )
    .join('')
  return `<h4 class="sale-paths-h">Considered and not used</h4>
  <p class="small">${esc(
    `${rows.length === 1 ? 'This sale was' : `These ${rows.length} sales were`} looked at and set aside. Each one is shown with what the record says about it.`,
  )}</p>
  <ul class="rejected-list">${items}</ul>`
}
