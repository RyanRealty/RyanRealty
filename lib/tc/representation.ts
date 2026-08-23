import type { BrokerRole } from './required-documents'

/**
 * Who we represent vs who the other broker represents.
 * Listing file: sellers are ours, buyers are the other side.
 * Buyer file: opposite. Dual: both sides are ours (no "other" principal).
 *
 * Live mail 2026-08: on a listing we collect seller signatures, email the PDF
 * to the buyer's agent, and file the executed copy they send back. We do not
 * send signing links to the other principal.
 */
export function isOtherSideParty(
  ourRole: BrokerRole,
  partyRole: 'buyer' | 'seller',
): boolean {
  if (ourRole === 'dual' || ourRole === 'unknown') return false
  if (ourRole === 'listing') return partyRole === 'buyer'
  if (ourRole === 'buyer') return partyRole === 'seller'
  return false
}

export function ourRoleFromCycles(
  kinds: readonly string[],
  partyRoles: ReadonlyArray<'buyer' | 'seller' | 'other'>,
): BrokerRole {
  const hasBuyer = partyRoles.includes('buyer')
  const hasSeller = partyRoles.includes('seller')
  if (hasBuyer && hasSeller) return 'dual'
  if (hasSeller) return 'listing'
  if (hasBuyer) return 'buyer'
  if (kinds.includes('listing')) return 'listing'
  return 'unknown'
}

/** Envelope cycle kind is the representation flag. Listing file stays listing even after it goes pending. */
export function ourRoleFromCycleKind(kind: string | null | undefined): BrokerRole {
  if (kind === 'listing') return 'listing'
  if (kind === 'sale') return 'buyer'
  return 'unknown'
}

export function isOtherSideRecipientRole(ourRole: BrokerRole, role: string): boolean {
  if (ourRole === 'dual' || ourRole === 'unknown') return false
  if (ourRole === 'listing') return role === 'Buyer' || role === 'BuyerAgent'
  if (ourRole === 'buyer') return role === 'Seller' || role === 'SellerAgent'
  return false
}

export function needsOtherSideReturn(
  ourRole: BrokerRole,
  requiredRoles: readonly string[],
): boolean {
  if (ourRole === 'dual' || ourRole === 'unknown') return false
  return requiredRoles.some((r) => isOtherSideRecipientRole(ourRole, r))
}

/** Other-side agent on the deal contacts table. */
export function otherSideContactRole(ourRole: BrokerRole): 'other_agent' | null {
  if (ourRole === 'listing' || ourRole === 'buyer') return 'other_agent'
  return null
}

export function otherSideAgentEnvelopeRole(ourRole: BrokerRole): 'BuyerAgent' | 'SellerAgent' | null {
  if (ourRole === 'listing') return 'BuyerAgent'
  if (ourRole === 'buyer') return 'SellerAgent'
  return null
}
