/**
 * Which blank on which OREF form carries which deal fact.
 *
 * The generic matcher in oref-fill.ts compares a normalised binding against a
 * short alias list, which works when a form names its widgets `PropertyAddress`.
 * The licensed OREF blanks do not: their AcroForm widgets are named after the
 * paragraph they sit in — `1 PARTIESPROPERTY DESCRIPTIONPRICE Buyer insert
 * names` — or, for the money column, after the line letter printed beside them,
 * `A` through `E`. On the live 001 that left 2 of 413 blanks bound, and a
 * four-party executed sale agreement went out carrying no address and no price.
 *
 * Each entry below was read off the rendered blank, not guessed. Page 2 of
 * OREF 001 (Released 01/2026) reads:
 *
 *   45  1. PARTIES/PROPERTY DESCRIPTION/PRICE: Buyer (insert name[s]) ______
 *   47  offers to purchase from Seller (insert name[s]) ______
 *   49  ... situated in the State of Oregon, County of ______
 *   51  (a) Street Address: ______
 *   59  Buyer offers to purchase ... (the "Purchase Price") ......... A $______
 *   61  as earnest money, the sum of (the "Deposit") ............... B $______
 *   62  ... (the "Additional Deposit") ............................. C $______
 *   63  at or before Closing, the balance of the down payment ...... D $______
 *   64  at Closing ... the balance of the Purchase Price ........... E $______
 *
 * C, D and E are figures we do not hold and must not invent, so they stay
 * blank. County stays blank too: we hold the city, and Bend is not Deschutes.
 * A blank line is honest; a wrong one is worse than empty.
 */
import type { DealFactKey } from './oref-fill'

export type FormFieldBinding = {
  fact: DealFactKey
  /** Tested against the blank's own AcroForm name, scoped to this form number. */
  match: RegExp
}

/**
 * Blanks the generic matcher would bind but must not, on this form.
 *
 * OREF 001 page 1 closes with the agency-acknowledgment signature block:
 *
 *   33  Buyer ____________________  Date ______   <- widget named "Buyer"
 *   34    Print __________________                <- widget named "Print"
 *   37  Seller ___________________  Date ______   <- widget named "Seller"
 *   38    Print __________________                <- widget named "Print_3"
 *
 * The bare `Buyer` and `Seller` widgets are the signature lines. The generic
 * alias list matches them and would type the party's name where their
 * signature goes; the name belongs on the Print line underneath.
 */
export const OREF_RESERVED_BLANKS: Record<string, readonly RegExp[]> = {
  '001': [/^Buyer(_\d+)?$/i, /^Seller(_\d+)?$/i],
}

export const OREF_FORM_BINDINGS: Record<string, readonly FormFieldBinding[]> = {
  '001': [
    { fact: 'buyers', match: /^1\s*PARTIES.*Buyer\s*insert\s*names?/i },
    { fact: 'sellers', match: /^offers to purchase from Seller\s*insert\s*names?/i },
    { fact: 'address', match: /^a\s*Street Address/i },
    { fact: 'salePrice', match: /^A$/ },
    { fact: 'earnestMoneyAmount', match: /^B$/ },
    { fact: 'escrowCompany', match: /^29\s*ESCROW/i },
    { fact: 'escrowClosingDate', match: /^35\s*CLOSING/i },
    // Page 1 agency acknowledgment: the printed name under each signature line.
    { fact: 'buyers', match: /^Print(_2)?$/i },
    { fact: 'sellers', match: /^Print_(3|4)$/i },
  ],
}

/** True when this blank is a signature or date line the generic matcher must keep its hands off. */
export function formBlankIsReserved(
  formNumber: string | null | undefined,
  blankName: string | null | undefined,
): boolean {
  const num = normalizeFormNumber(formNumber)
  const name = (blankName ?? '').trim()
  if (!num || !name) return false
  return (OREF_RESERVED_BLANKS[num] ?? []).some((re) => re.test(name))
}

/** The fact this blank carries on this form, or null when the form says nothing about it. */
function normalizeFormNumber(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/^OREF[-\s]*/, '')
}

export function formBindingFactKey(
  formNumber: string | null | undefined,
  blankName: string | null | undefined,
): DealFactKey | null {
  const num = normalizeFormNumber(formNumber)
  const name = (blankName ?? '').trim()
  if (!num || !name) return null
  for (const binding of OREF_FORM_BINDINGS[num] ?? []) {
    if (binding.match.test(name)) return binding.fact
  }
  return null
}
