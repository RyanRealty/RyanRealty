/**
 * The contract-terms review queue, shaped for Matt. Pure.
 *
 * Two kinds of item land here (Matt 2026-09-24):
 *   conflict   a term a person typed differs from the executed contract.
 *              "Contract wins, unless a person typed it": he decides, use
 *              the contract's value or keep the file's.
 *   unsettled  the readers still read a term differently after the third
 *              read ("anything still unsettled goes on the file and into your
 *              review queue"): he picks the reading that is right, from the
 *              page beside it.
 * Only files that are still live; a closed or dead file carries no warnings.
 */
import { surnames, type TermSource } from './resolve'
import type { TermColumn } from './plan'

export const TERMS_REVIEW_PATH = '/admin/sign-off/terms'

export const TERM_FIELD_LABEL: Record<string, string> = {
  purchasePrice: 'Price',
  earnestMoney: 'Earnest money',
  closingDate: 'Closing',
  closingText: 'Closing terms',
  inspectionDays: 'Inspection period',
  financingDays: 'Financing period',
  financingType: 'Financing',
  sellerConcessions: 'Seller concessions',
  possession: 'Possession',
  escrowCompany: 'Escrow company',
  escrowNumber: 'Escrow number',
  settlementDate: 'Settlement date',
  receivedDate: 'Deposit received',
  lastSignatureDate: 'Last signature',
}

const MONEY = new Set(['purchasePrice', 'earnestMoney', 'sellerConcessions'])
const DAYS = new Set(['inspectionDays', 'financingDays'])

/** A reading as Matt reads it. null is "not on the form". */
export function formatTermValue(field: string, value: unknown): string {
  if (value == null || value === '') return 'Not on the form'
  if (MONEY.has(field) && typeof value === 'number') return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (DAYS.has(field) && typeof value === 'number') return `${value} day${value === 1 ? '' : 's'}`
  if (field === 'financingType' && typeof value === 'string') return value === 'fha' || value === 'va' || value === 'usda' ? value.toUpperCase() : value.charAt(0).toUpperCase() + value.slice(1)
  return String(value)
}

type Where = { cycleId: string; propertyKey: string; address: string; broker: string | null; closing: string | null }

export type TermsReviewItem =
  | (Where & {
      kind: 'conflict'
      key: string
      column: TermColumn
      label: string
      current: string
      contract: string
      typedBy: string | null
      typedAt: string | null
      source: TermSource | null
    })
  | (Where & {
      kind: 'unsettled'
      key: string
      documentId: string
      documentName: string
      instrument: number
      title: string
      field: string
      label: string
      page: number | null
      /** The distinct readings, in reader order, each with who read it. */
      readings: Array<{ value: unknown; display: string; readers: Array<'first' | 'second' | 'third'> }>
    })

export const conflictKey = (cycleId: string, column: string) => `c:${cycleId}:${column}`
export const unsettledKey = (documentId: string, instrument: number, field: string) => `u:${documentId}:${instrument}:${field}`

const norm = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]/g, '') : v)

/** first / second / third readings grouped by value, so two readers who agree show as one choice. */
export function groupReadings(field: string, first: unknown, second: unknown, third: unknown): Array<{ value: unknown; display: string; readers: Array<'first' | 'second' | 'third'> }> {
  const out: Array<{ value: unknown; display: string; readers: Array<'first' | 'second' | 'third'> }> = []
  const add = (who: 'first' | 'second' | 'third', v: unknown) => {
    const hit = out.find((o) => norm(o.value) === norm(v ?? null))
    if (hit) hit.readers.push(who)
    else out.push({ value: v ?? null, display: formatTermValue(field, v), readers: [who] })
  }
  add('first', first)
  add('second', second)
  if (third !== undefined) add('third', third)
  return out
}

/**
 * Does a form belong to this cycle? When both name buyers and share no
 * surname, the form is another buyer's offer and its disputes are noise here.
 */
export function formIsThisCycles(formBuyers: readonly string[], cycleBuyers: readonly string[]): boolean {
  if (!formBuyers.length || !cycleBuyers.length) return true
  const a = surnames(formBuyers)
  for (const s of surnames(cycleBuyers)) if (a.has(s)) return true
  return false
}

/** Soonest closing first (no date last), then by address; a typed-value conflict before a reading on the same file. */
export function orderTermsQueue(items: readonly TermsReviewItem[]): TermsReviewItem[] {
  return [...items].sort(
    (a, b) =>
      (a.closing ?? '9999').localeCompare(b.closing ?? '9999') ||
      a.address.localeCompare(b.address) ||
      (a.kind === b.kind ? 0 : a.kind === 'conflict' ? -1 : 1) ||
      a.label.localeCompare(b.label),
  )
}

export function termsReviewHref(input: { item?: string | null; deal?: string | null }): string {
  const q = new URLSearchParams()
  if (input.item) q.set('item', input.item)
  if (input.deal) q.set('deal', input.deal)
  const qs = q.toString()
  return qs ? `${TERMS_REVIEW_PATH}?${qs}` : TERMS_REVIEW_PATH
}

/** After a decision: the item that took this one's place, else the one before, else the empty queue. */
export function afterTermsDecisionHref(items: readonly TermsReviewItem[], key: string, deal: string | null): string {
  const i = items.findIndex((x) => x.key === key)
  const next = i >= 0 ? items[i + 1] ?? items[i - 1] : null
  return termsReviewHref({ item: next?.key ?? null, deal })
}
