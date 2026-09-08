/**
 * The listing page's payment, shared between the calculator and the close.
 *
 * SITE-06. "Email me this payment" has to send THE VISITOR'S OWN inputs, and
 * the inputs live in `MortgageCalculator`'s local state halfway up the page.
 * The close sits below it, and a React context cannot reach between them: the
 * page is a server component and the two clients are separate islands under it.
 *
 * So this is a module-level store with the `useSyncExternalStore` contract.
 * Both islands import this one module, so both get the same instance; the
 * calculator publishes on every keystroke and the close subscribes. Changing
 * the down payment up the page moves the figure in the close, which is the
 * point — the two are one instrument, not two.
 *
 * WHAT IS AND IS NOT IN HERE. Only the five numbers a visitor can turn, plus
 * the total for display. Property tax and HOA are facts about the house and
 * stay on the server: `submitListingPaymentEmail` reads them off the listing
 * row and recomputes the whole payment there, so nothing this store holds ever
 * becomes an emailed figure on its own (CLAUDE.md §0).
 */

export type PaymentSnapshot = {
  /** Which house this belongs to, so a stale snapshot cannot cross listings. */
  listingKey: string
  price: number
  downPct: number
  ratePct: number
  termYears: number
  /** The visitor's own insurance quote per year, or null for our assumption. */
  insuranceAnnual: number | null
  /** Monthly PITI as the calculator currently shows it, for display only. */
  total: number
}

let current: PaymentSnapshot | null = null
const listeners = new Set<() => void>()

function sameSnapshot(a: PaymentSnapshot | null, b: PaymentSnapshot | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.listingKey === b.listingKey &&
    a.price === b.price &&
    a.downPct === b.downPct &&
    a.ratePct === b.ratePct &&
    a.termYears === b.termYears &&
    a.insuranceAnnual === b.insuranceAnnual &&
    a.total === b.total
  )
}

/** Called by the calculator. A no-op when nothing actually changed, so a
 *  re-render on unrelated state cannot loop the subscribers. */
export function publishPayment(next: PaymentSnapshot): void {
  if (sameSnapshot(current, next)) return
  current = next
  for (const listen of listeners) listen()
}

export function subscribePayment(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The store's snapshot. Identity is stable between publishes, which is what
 *  useSyncExternalStore requires. */
export function readPayment(): PaymentSnapshot | null {
  return current
}

/** The server render has no calculator state yet, and must not invent one. */
export function readPaymentServer(): PaymentSnapshot | null {
  return null
}

/** Test seam. Never called by the app. */
export function __resetPaymentBus(): void {
  current = null
  listeners.clear()
}
