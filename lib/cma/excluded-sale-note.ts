/**
 * Why a closed sale printed outside the price chapter does not set the price.
 *
 * The sentence is the one the engine recorded (SKILL §0.3 rule 29, Matt
 * 2026-10-08, 2745 Aldrich). This module does not recompute a gap, a
 * community, or a product the walk already named. When the walk never
 * recorded the sale (a letter stored before the field landed), it asks the
 * same price-set decision, then the set-aside record, and prints that.
 */
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import type { SetAsideSale } from '@/lib/cma/set-aside'
import { UNSEATED_PRINT_REASON, priceSetRefusal, type NotSettingSale } from '@/lib/pricing/price-set'

export type PrintedHistorySale = {
  listNumber?: string | null
  address?: string | null
  sqft?: number | null
}

const STREET_SUFFIX = new Set([
  'ln',
  'st',
  'dr',
  'ave',
  'rd',
  'way',
  'ct',
  'pl',
  'blvd',
  'lane',
  'street',
  'drive',
  'avenue',
  'road',
  'court',
  'place',
  'boulevard',
  'cir',
  'circle',
  'ter',
  'terrace',
  'trl',
  'trail',
  'loop',
  'hwy',
  'pkwy',
])

function normToken(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/** Full address, with a trailing street suffix dropped so "Ln" and "Lane" agree. */
function addressCore(v: string | null | undefined): string {
  const parts = normToken(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  while (parts.length > 1 && STREET_SUFFIX.has(parts[parts.length - 1]!)) parts.pop()
  return parts.join(' ')
}

type IdSale = {
  listNumber?: string | null
  mlsNumber?: string | null
  listingKey?: string | null
  address?: string | null
}

function listIds(sale: IdSale): string[] {
  return [sale.listNumber, sale.mlsNumber].map(normToken).filter((s) => s.length > 0)
}

function sameList(a: IdSale, b: IdSale): boolean {
  const right = listIds(b)
  return listIds(a).some((id) => right.includes(id))
}

function sameKey(a: IdSale, b: IdSale): boolean {
  const left = normToken(a.listingKey)
  const right = normToken(b.listingKey)
  return left.length > 0 && left === right
}

function sameAddress(a: IdSale, b: IdSale): boolean {
  const left = addressCore(a.address)
  const right = addressCore(b.address)
  return left.length > 0 && left === right
}

function samePrintedSale(a: IdSale, b: IdSale): boolean {
  return sameList(a, b) || sameKey(a, b) || sameAddress(a, b)
}

/**
 * The sentence to print once beside this history sale, or null when the sale
 * is one of the sales that set the price.
 */
export function excludedSaleReason(input: {
  sale: PrintedHistorySale
  subject: Pick<CmaSubject, 'sqft' | 'lotAcres'>
  /** Grid rows that still set the price. Set-aside rows are not in this list. */
  setters: readonly Pick<CmaAdjustedComp, 'listingKey' | 'mlsNumber' | 'address'>[]
  setAside: readonly SetAsideSale[]
  notes: readonly NotSettingSale[] | null | undefined
}): string | null {
  const sale = input.sale
  if (input.setters.some((row) => samePrintedSale(sale, row))) return null

  const recorded = (input.notes ?? []).find((row) => samePrintedSale(sale, row))
  if (recorded?.reason) return recorded.reason

  // History rows carry an address and an MLS number, not the listing key the
  // set-aside entry was written with. The address still names the sale.
  const aside = input.setAside.find((row) => sameAddress(sale, row) || sameKey(sale, row))
  if (aside?.reason) return aside.reason

  // The street list is the subject's own plat. Unknown lot fails open, so
  // this call names a size refusal and does not invent a community.
  const refusal = priceSetRefusal({
    ownPlat: true,
    subjectSqft: input.subject.sqft,
    saleSqft: sale.sqft,
  })
  if (refusal) return refusal.reason
  return UNSEATED_PRINT_REASON
}
