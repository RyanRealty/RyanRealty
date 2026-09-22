/**
 * ClosePrice is the contract / sold price. Seller concessions are a separate
 * MLS field (Spark ConcessionsAmount + Concessions YN). They do not change
 * ClosePrice. They do change seller net from that price.
 *
 * Measured on sale_pricing_facts detached, PK-bounded details->Concessions:
 * 2024 and 2025 rows with a null amount are YN No (300/300). Amount > 0 is
 * YN Yes (150/150). 2022–2023 nulls mix No, Yes-without-dollars, and blank YN,
 * so those years stay unknown unless YN or an amount is present.
 */

import type { CmaSellerNet, CmaSellerNetLine } from '@/lib/cma/types'
import { ownersPolicyPremium } from '@/lib/pricing/owners-policy'

/**
 * Enhanced plan, and the buyer-agent share the sheet uses when the seller
 * offers one. Matt, 2026-07-14. Kept here so this module does not import the
 * expired-audit sheet (that sheet imports back).
 */
export const NET_LISTING_FEE_PCT = 3
export const NET_BUYER_AGENT_FEE_PCT = 2.5

/** Our fee, the buyer's agent if offered, and the filed owner's title policy. */
export function sellerCostLines(list: number): CmaSellerNetLine[] {
  if (!Number.isFinite(list) || list <= 0) return []
  const title = ownersPolicyPremium(list)
  if (title == null) return []
  const rounded = Math.round(list)
  return [
    {
      label: 'Our fee',
      amount: Math.round(rounded * (NET_LISTING_FEE_PCT / 100)),
      source: `${NET_LISTING_FEE_PCT}% of ${usd(rounded)}`,
    },
    {
      label: "Buyer's agent",
      amount: Math.round(rounded * (NET_BUYER_AGENT_FEE_PCT / 100)),
      source: `${NET_BUYER_AGENT_FEE_PCT}% of ${usd(rounded)}, if you offer it`,
    },
    {
      label: 'Title insurance',
      amount: title,
      source: `Oregon owner's policy rate at ${usd(rounded)}`,
    },
  ]
}

export const CONCESSIONS_YN_NO_INFERRED_FROM = '2024-01-01'

function money(n: number | null | undefined): number | null {
  if (n == null) return null
  return Number.isFinite(n) && n >= 0 ? n : null
}

function ynNorm(yn: string | null | undefined): 'Yes' | 'No' | null {
  const s = (yn ?? '').trim().toLowerCase()
  if (s === 'yes') return 'Yes'
  if (s === 'no') return 'No'
  return null
}

export function resolveConcessions(opts: {
  amount: number | null | undefined
  yn?: string | null
  closeDate?: string | null
}): number | null {
  const amount = money(opts.amount)
  if (amount != null) return amount
  const yn = ynNorm(opts.yn)
  if (yn === 'No') return 0
  if (yn === 'Yes') return null
  const close = (opts.closeDate ?? '').slice(0, 10)
  if (close && close >= CONCESSIONS_YN_NO_INFERRED_FROM) return 0
  return null
}

/**
 * Stamp the resolved seller concession on every sale the document prints.
 *
 * The grid needs a per-sale concessions line — it is the FIRST value
 * adjustment on Form 1004 and ours printed none (research brief 2026-09-07,
 * item 8) — and the seller-net caption under the grid has to be reading the
 * same rows, or the document contradicts itself. Both now resolve through
 * `resolveConcessions`: a dollar amount when one was reported, 0 when the sale
 * reported none, and null when nothing was recorded at all.
 *
 * Verified over the rows the engine prices on, 2026-09-07: on closed detached
 * sales in the last 12 months, `concessions_amount` is populated on 47.3% of
 * Redmond (321/678) and 43.9% of Bend (917/2,087) — but `concessions_yn` is
 * populated on ~100%, so after resolution every one of those rows carries a
 * printable value and none reads "not reported".
 */
export function attachCompConcessions<
  T extends { concessionsAmount?: number | null; concessionsYn?: string | null; closeDate?: string | null },
>(comps: readonly T[]): Array<T & { concessions: number | null }> {
  return comps.map((c) => ({
    ...c,
    concessions: resolveConcessions({
      amount: c.concessionsAmount,
      yn: c.concessionsYn,
      closeDate: c.closeDate,
    }),
  }))
}

export function sellerNetFromPrice(closePrice: number, concessions: number | null): number | null {
  if (!(closePrice > 0) || concessions == null) return null
  return Math.round(closePrice - concessions)
}

export type ConcessionSummary = {
  knownCount: number
  givenCount: number
  medianIncludingZero: number | null
  medianWhenGiven: number | null
  rate: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export function summarizeConcessions(
  rows: Array<{
    concessionsAmount?: number | null
    concessionsYn?: string | null
    closeDate?: string | null
  }>,
): ConcessionSummary {
  const known = rows
    .map((r) => resolveConcessions({ amount: r.concessionsAmount, yn: r.concessionsYn, closeDate: r.closeDate }))
    .filter((n): n is number => n != null)
  const given = known.filter((n) => n > 0)
  return {
    knownCount: known.length,
    givenCount: given.length,
    medianIncludingZero: median(known),
    medianWhenGiven: median(given),
    rate: known.length ? given.length / known.length : null,
  }
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * WHAT THE SELLER KEEPS — from the price we recommend they LIST at, itemised.
 *
 * ROUND FOUR, CLASS A. What this replaced was one figure,
 * `predictedSellerNet = predictedClose - expectedConcessions`. Its anchor was
 * the ENGINE's close estimate, which is the seller's own ask times 0.98 on a
 * listed subject and the pre-ceiling comp number on a capped expired. Neither
 * is the price printed beside it, so all four round-four exemplars published a
 * net that did not follow from the list: $1,707,603 against a $1,473,000 list
 * (a net ABOVE the price), $616,000 against $816,000, $426,575 against
 * $435,000, $436,008 against $461,000 — under a chapter headed "What you keep".
 *
 * The anchor is the list. The lines are our fee, the buyer's agent when the
 * seller offers 2.5%, and the Oregon owner's title policy. A credit to the
 * buyer is not one of those lines: homes like this one did not give one
 * amount, and a median of a mixed set is not this seller's credit. That
 * record is written beside the sheet, per sale, and nothing is subtracted
 * for it. The loan payoff is the lender's figure. It is not estimated.
 */
export const SELLER_NET_UNKNOWNS = {
  /** Every note this module writes opens with this, so a re-anchor replaces its own line. */
  notePrefix: 'From a',
  commission: 'the listing and buyer-broker commission',
  title: 'title insurance',
  escrow: 'escrow and closing fees',
  recording: 'recording and transfer fees',
  payoff: 'your loan payoff',
  concessions: 'a seller concession, which these sales did not report',
} as const

/**
 * The itemisation, pure. Returns null when there is no usable list price.
 * The concession summary stays on the block as the trace. It is not a line.
 */
export function buildSellerNet(args: { list: number; summary: ConcessionSummary }): CmaSellerNet | null {
  const list = args.list
  if (!Number.isFinite(list) || list <= 0) return null
  const summary = args.summary
  const lines = sellerCostLines(list)
  if (lines.length === 0) return null
  const costs = lines.reduce((sum, l) => sum + Math.max(0, l.amount), 0)
  const net = Math.min(Math.round(list), Math.max(0, Math.round(list) - Math.round(costs)))
  return {
    basis: 'list',
    list: Math.round(list),
    lines,
    net,
    sentence: '',
    unknowns: [],
    expectedConcessions: summary.knownCount > 0 ? summary.medianIncludingZero : null,
    knownCount: summary.knownCount,
    givenCount: summary.givenCount,
    medianWhenGiven: summary.medianWhenGiven,
    rate: summary.rate,
  }
}

type SellerNetHost = {
  recommended: number
  notes: string[]
  sellerNet?: CmaSellerNet | null
} | null

/** Drop any seller-net sentence a previous pass wrote, so a re-anchor replaces rather than stacks. */
function stripSellerNetNote(notes: string[]): void {
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const n = notes[i] ?? ''
    if (n.startsWith(SELLER_NET_UNKNOWNS.notePrefix) && n.includes('does not include')) notes.splice(i, 1)
  }
}

/**
 * Write the block onto `pricing`, anchored to `pricing.recommended` AT CALL
 * TIME. There is deliberately no close-price parameter: the third argument
 * this used to take is the whole of class A.
 */
export function attachSellerNet(
  pricing: SellerNetHost,
  comps: Array<{
    concessionsAmount?: number | null
    concessionsYn?: string | null
    closeDate?: string | null
  }>,
): ConcessionSummary {
  const summary = summarizeConcessions(comps)
  if (pricing) {
    const block = buildSellerNet({ list: pricing.recommended, summary })
    pricing.sellerNet = block
    stripSellerNetNote(pricing.notes)
    if (block) pricing.notes.unshift(block.sentence)
  }
  return summary
}

/**
 * Recompute the block from the CURRENT `pricing.recommended`, keeping the
 * concession trace the comparable set produced.
 *
 * The list moves after `attachSellerNet` runs: `applyFailedAskCap` lowers it
 * on every expired build, and it can run more than once per build. A net
 * anchored to a price that has since changed is the same defect in a new
 * place, so the ceiling calls this itself.
 */
export function reanchorSellerNet(pricing: SellerNetHost): void {
  if (!pricing?.sellerNet) return
  const prior = pricing.sellerNet
  const block = buildSellerNet({
    list: pricing.recommended,
    summary: {
      knownCount: prior.knownCount,
      givenCount: prior.givenCount,
      medianIncludingZero: prior.expectedConcessions,
      medianWhenGiven: prior.medianWhenGiven,
      rate: prior.rate,
    },
  })
  pricing.sellerNet = block
  stripSellerNetNote(pricing.notes)
  if (block) pricing.notes.unshift(block.sentence)
}
