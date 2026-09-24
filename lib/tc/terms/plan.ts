/**
 * What the standing terms change on the cycle. Pure.
 *
 * An empty field is filled. A field that already holds the same value is left
 * alone. A field that holds a DIFFERENT value is never overwritten: it is a
 * conflict, shown on the file beside the contract's value and its page, and a
 * person settles it with one click (app/actions/tc-deal-terms.ts). Only an
 * executed agreement writes anything; an offer nobody accepted fills nothing.
 */
import type { ResolvedField, ResolvedTerms, TermSource } from './resolve'

export type CycleTermColumns = {
  sale_price: number | null
  earnest_money: unknown
  contract_acceptance_date: string | null
  escrow_closing_date: string | null
  inspection_days: number | null
  financing_days: number | null
  escrow_company: string | null
  escrow_number: string | null
  buyers: string[] | null
  sellers: string[] | null
}

export type TermColumn = keyof CycleTermColumns

export const TERM_COLUMN_LABEL: Record<TermColumn, string> = {
  sale_price: 'Sale price',
  earnest_money: 'Earnest money',
  contract_acceptance_date: 'Accepted',
  escrow_closing_date: 'Closing',
  inspection_days: 'Inspection period',
  financing_days: 'Financing period',
  escrow_company: 'Escrow company',
  escrow_number: 'Escrow number',
  buyers: 'Buyers',
  sellers: 'Sellers',
}

export type TermWrite = { column: TermColumn; value: unknown; display: string; source: TermSource | null }
export type TermConflict = { column: TermColumn; current: string; contract: string; value: unknown; source: TermSource | null }

export type TermsPlan = { fills: TermWrite[]; conflicts: TermConflict[]; same: TermColumn[] }

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

/** tc_cycles.earnest_money is { amount } (app/actions/tc-offers.ts); older rows may hold a bare number. */
export function earnestAmount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v && typeof v === 'object' && typeof (v as { amount?: unknown }).amount === 'number') return (v as { amount: number }).amount
  return null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function surnameKey(people: readonly string[]): string {
  return people
    .map((p) => p.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).pop() ?? '')
    .filter(Boolean)
    .sort()
    .join('|')
}

export function planTermsWrite(terms: ResolvedTerms, cycle: CycleTermColumns): TermsPlan {
  const plan: TermsPlan = { fills: [], conflicts: [], same: [] }
  if (terms.status !== 'executed') return plan

  const consider = <T>(column: TermColumn, field: ResolvedField<T> | undefined, current: unknown, opts: { write: (v: T) => unknown; show: (v: T) => string; showCurrent: (v: unknown) => string; equal: (a: unknown, b: T) => boolean; empty: (v: unknown) => boolean }) => {
    if (!field) return
    if (opts.empty(current)) plan.fills.push({ column, value: opts.write(field.value), display: opts.show(field.value), source: field.source })
    else if (opts.equal(current, field.value)) plan.same.push(column)
    else plan.conflicts.push({ column, current: opts.showCurrent(current), contract: opts.show(field.value), value: opts.write(field.value), source: field.source })
  }
  const isEmpty = (v: unknown) => v == null || v === ''
  const num = { write: (v: number) => v, show: money, showCurrent: (v: unknown) => money(Number(v)), equal: (a: unknown, b: number) => Math.abs(Number(a) - b) < 0.005, empty: isEmpty }
  const date = { write: (v: string) => v, show: (v: string) => v, showCurrent: (v: unknown) => String(v).slice(0, 10), equal: (a: unknown, b: string) => String(a).slice(0, 10) === b, empty: isEmpty }
  const days = { write: (v: number) => v, show: (v: number) => `${v} days`, showCurrent: (v: unknown) => `${v} days`, equal: (a: unknown, b: number) => Number(a) === b, empty: isEmpty }
  const text = { write: (v: string) => v, show: (v: string) => v, showCurrent: (v: unknown) => String(v), equal: (a: unknown, b: string) => norm(String(a)) === norm(b) || norm(String(a)).includes(norm(b)) || norm(b).includes(norm(String(a))), empty: isEmpty }

  consider('sale_price', terms.salePrice, cycle.sale_price, num)
  consider('earnest_money', terms.earnestMoney, earnestAmount(cycle.earnest_money), { ...num, write: (v: number) => ({ amount: v }) })
  consider('contract_acceptance_date', terms.acceptanceDate, cycle.contract_acceptance_date, date)
  consider('escrow_closing_date', terms.closingDate, cycle.escrow_closing_date, date)
  consider('inspection_days', terms.inspectionDays, cycle.inspection_days, days)
  consider('financing_days', terms.financingDays, cycle.financing_days, days)
  consider('escrow_company', terms.escrowCompany, cycle.escrow_company, text)
  consider('escrow_number', terms.escrowNumber, cycle.escrow_number, { ...text, equal: (a: unknown, b: string) => norm(String(a)) === norm(b) })

  const people = (column: 'buyers' | 'sellers', names: string[], current: string[] | null) => {
    if (!names.length) return
    const show = names.join(', ')
    if (!current?.length) plan.fills.push({ column, value: names, display: show, source: null })
    else if (surnameKey(current) === surnameKey(names)) plan.same.push(column)
    else plan.conflicts.push({ column, current: current.join(', '), contract: show, value: names, source: null })
  }
  people('buyers', terms.buyers, cycle.buyers)
  people('sellers', terms.sellers, cycle.sellers)
  return plan
}
