import type { BrokerRole } from './required-documents'

/**
 * Who we represent vs who the other broker represents.
 * Listing file: sellers are ours, buyers are the other side.
 * Buyer file: opposite. Dual: both sides are ours (no "other" principal).
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
