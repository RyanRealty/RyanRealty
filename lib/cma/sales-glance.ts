/**
 * THE SALES AT A GLANCE (web chapter only, Matt 2026-10-07).
 *
 * On a phone the sales that set the price were 5,937px: a status table, then
 * one tall card per sale. A reader had to scroll a screen and a half before
 * meeting the first sale. This is the list a broker reads first: each sale
 * that set the number, what it sold for, what it is worth adjusted to this
 * home, and how much of the price it carries.
 *
 * NOTHING HERE IS A NEW FIGURE (CLAUDE.md §0). Each cell is the exact string
 * the matrix under it prints for the same sale, from the same functions:
 * `closedEntries` builds the entry the column is drawn from, and the Sold
 * after concessions, Adjusted and Weight cells come from the cell helpers the
 * grid itself calls. The rows are the printed sales less the ones the
 * document sets aside, which is the count the chapter's own lead sentence
 * uses (`setAsideCompIndexes`), so the count shown is the count used.
 */

import { escapeHtml, countWord } from '@/lib/cma/render-blocks'
import {
  moneyCell,
  pinBadge,
  soldAfterConcessionsCell,
  weightCell,
  MIN_CLOSED_SALES_FOR_MATRIX,
} from '@/lib/cma/comp-matrix'
import { closedEntries } from '@/lib/cma/matrix-entry'
import { compWeightIndex } from '@/lib/cma/pricing-method'
import { setAsideCompIndexes } from '@/lib/cma/set-aside'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

export type SalesGlanceInput = {
  subject: CmaSubject
  /** The sales the matrix prints, in its order (`salesThatSetItArgs(a).comps`). */
  comps: readonly CmaAdjustedComp[]
  pricing: CmaPricing
  docLinks?: TrackedDocLinkCtx | null
}

export type SalesGlanceRow = {
  /** The map pin and the matrix column this sale is. */
  key: string
  address: string
  href: string | null
  /** The matrix's "Sold after concessions" cell for this sale. */
  sold: string
  /** True when this sale's record carries a concession that came off. */
  concession: boolean
  /** The matrix's "Adjusted" cell for this sale. */
  adjusted: string
  /** The grid's "Weight in this price" cell, or null when the row has none. */
  weight: string | null
}

/** One row per sale that set the price, in the matrix's own order. */
export function salesGlanceRows(input: SalesGlanceInput): SalesGlanceRow[] {
  const comps = input.comps
  // The matrix does not print under the pricing unit's floor, so neither does
  // a summary of it.
  if (comps.length < MIN_CLOSED_SALES_FOR_MATRIX) return []
  const entries = closedEntries(comps, input.docLinks ?? null, input.subject)
  const aside = setAsideCompIndexes(input.pricing, comps)
  const weights = compWeightIndex(input.pricing)
  const rows: SalesGlanceRow[] = []
  comps.forEach((comp, i) => {
    if (aside.has(i)) return
    const entry = entries[i]
    if (!entry) return
    const w = weights.get(comp.listingKey ?? '')?.weight ?? null
    const c = entry.concessionsAmount
    rows.push({
      key: entry.key,
      address: entry.address,
      href: entry.href,
      sold: soldAfterConcessionsCell(entry),
      concession: c != null && Number.isFinite(c) && c > 0,
      adjusted: moneyCell(entry.adjustedPrice),
      weight: w != null && Number.isFinite(w) ? weightCell(w) : null,
    })
  })
  return rows
}

/** The heading over the list. The number in it is the number of rows under it. */
export function salesGlanceHeading(n: number): string {
  return n === 1 ? 'The one sale, at a glance' : `The ${countWord(n)} sales, at a glance`
}

export function salesGlanceHtml(input: SalesGlanceInput): string {
  const rows = salesGlanceRows(input)
  if (rows.length === 0) return ''
  // The column is named for what it holds. When no sale carried a concession
  // the figure IS the sold price, and "after concessions" over it would claim
  // a deduction nobody made.
  const soldHead = rows.some((r) => r.concession) ? 'Sold after concessions' : 'Sold'
  const showWeight = rows.some((r) => r.weight != null)
  const body = rows
    .map((r) => {
      const badge = pinBadge(r.key, 'closed')
      const name = r.href
        ? `<a class="g-link" href="${esc(r.href)}" data-rr-track="cma-sale">${badge}<span class="g-addr-t">${esc(
            r.address,
          )}</span></a>`
        : `<span class="g-link">${badge}<span class="g-addr-t">${esc(r.address)}</span></span>`
      return `<tr data-comp="${esc(r.key)}"><th scope="row" class="g-addr">${name}</th><td class="n">${esc(
        r.sold,
      )}</td><td class="n">${esc(r.adjusted)}</td>${showWeight ? `<td class="n">${esc(r.weight ?? '-')}</td>` : ''}</tr>`
    })
    .join('')
  return `<div class="sales-glance" data-glance-rows="${rows.length}">
  <h3 class="subhead">${esc(salesGlanceHeading(rows.length))}</h3>
  <table class="glance">
    <thead><tr><th scope="col" class="g-addr">Sale</th><th scope="col" class="n">${esc(soldHead)}</th><th scope="col" class="n">Adjusted</th>${
      showWeight ? '<th scope="col" class="n">Weight in this price</th>' : ''
    }</tr></thead>
    <tbody>${body}</tbody>
  </table>
</div>`
}
