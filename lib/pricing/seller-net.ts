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
 * The anchor is now the list, and every subtraction is a line with its own
 * source. A cost this row cannot defend from data is NOT a line: it is named
 * in `unknowns`, so the reader can see what the figure leaves out. Commission
 * is never a silent zero.
 *
 * WHY CONCESSIONS ARE THE ONLY LINE. It is the one seller cost the printed
 * sales themselves measure: the MLS reports the amount and the yes/no per
 * closed sale, `resolveConcessions` turns that into a dollar figure per sale,
 * and the median over the same set the grid prints is a number the reader can
 * check against the grid. Commission is a term of an agreement that does not
 * exist yet, title, escrow and recording are third-party quotes, and the
 * payoff is the lender's. §0: a figure with no named source does not ship, so
 * those are named as absent rather than estimated.
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

const ALWAYS_UNKNOWN = [
  SELLER_NET_UNKNOWNS.commission,
  SELLER_NET_UNKNOWNS.title,
  SELLER_NET_UNKNOWNS.escrow,
  SELLER_NET_UNKNOWNS.recording,
  SELLER_NET_UNKNOWNS.payoff,
]

/** "a, b, c and d" — one list, no serial comma before the final and. */
function joinWords(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The itemisation, pure. Returns null when there is no usable list price — a
 * document with no price has nothing to net from, and a zero would be an
 * invented one.
 */
export function buildSellerNet(args: { list: number; summary: ConcessionSummary }): CmaSellerNet | null {
  const list = args.list
  if (!Number.isFinite(list) || list <= 0) return null
  const summary = args.summary
  const expected = summary.knownCount > 0 ? summary.medianIncludingZero : null

  const lines: CmaSellerNetLine[] = []
  const unknowns: string[] = []
  if (expected != null) {
    const givenBit =
      summary.givenCount > 0
        ? `${summary.givenCount} of them gave one${
            summary.medianWhenGiven != null ? `, median ${usd(summary.medianWhenGiven)}` : ''
          }`
        : 'None of them gave one'
    lines.push({
      label: 'Seller concession',
      amount: Math.max(0, Math.round(expected)),
      source: `Median of the ${summary.knownCount} comparable sales that reported the field. ${givenBit}.`,
    })
  } else {
    unknowns.push(SELLER_NET_UNKNOWNS.concessions)
  }
  unknowns.push(...ALWAYS_UNKNOWN)

  const costs = lines.reduce((sum, l) => sum + Math.max(0, l.amount), 0)
  // The net can never exceed the list: every line is a cost, and the floor
  // stops a pathological set from netting below zero.
  const net = Math.min(Math.round(list), Math.max(0, Math.round(list) - Math.round(costs)))

  const article = /^8/.test(String(Math.round(list))) ? 'an' : 'a'
  const head = `From ${article} ${usd(list)} list`
  // The line above carries the median across every sale that reported the
  // field, zeros included. When fewer than half gave one that median is $0,
  // which is not the same fact as "none gave one", so the sentence says
  // which it is (round-four class E: the sentence contradicted its own line).
  const middle =
    expected == null
      ? `, ${usd(net)} remains.`
      : expected > 0
        ? `, less ${usd(expected)} in seller concessions, ${usd(net)} remains.`
        : summary.givenCount > 0
          ? `, and with ${summary.givenCount} of the ${summary.knownCount} comparable sales giving a seller concession the median across all ${summary.knownCount} is $0, ${usd(net)} remains.`
          : `, and none of the ${summary.knownCount} comparable sales that reported the field gave a seller concession, ${usd(net)} remains.`
  const tail = ` This figure does not include ${joinWords(unknowns)}.`

  return {
    basis: 'list',
    list: Math.round(list),
    lines,
    net,
    sentence: `${head}${middle}${tail}`,
    unknowns,
    expectedConcessions: expected,
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
