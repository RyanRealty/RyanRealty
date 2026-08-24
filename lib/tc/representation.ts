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

/** Dual when our CRM people include a buyer and a seller. Otherwise listing vs buyer from the file kind. */
export function ourRoleForEnvelope(input: {
  cycleKind?: string | null
  ourPeopleRoles?: readonly string[]
}): BrokerRole {
  const ours = input.ourPeopleRoles ?? []
  if (ours.includes('buyer') && ours.includes('seller')) return 'dual'
  return ourRoleFromCycleKind(input.cycleKind)
}

/** Both principals NeedsToSign on the envelope means we can run the in-system sequence. */
export function ourRoleFromSignableRoles(
  cycleKind: string | null | undefined,
  signableRoles: readonly string[],
): BrokerRole {
  const buyer = signableRoles.includes('Buyer')
  const seller = signableRoles.includes('Seller')
  if (buyer && seller) return 'dual'
  return ourRoleFromCycleKind(cycleKind)
}

export function isOtherSideRecipientRole(ourRole: BrokerRole, role: string): boolean {
  if (ourRole === 'dual' || ourRole === 'unknown') return false
  if (ourRole === 'listing') return role === 'Buyer' || role === 'BuyerAgent'
  if (ourRole === 'buyer') return role === 'Seller' || role === 'SellerAgent'
  return false
}

function partyNamesPresent(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.some((item) => {
    if (typeof item === 'string') return item.trim().length > 0
    if (item && typeof item === 'object') {
      const o = item as { name?: unknown; full_name?: unknown }
      return String(o.name ?? o.full_name ?? '').trim().length > 0
    }
    return false
  })
}

/** True when the other principal (or their broker) is actually on this file. */
export function otherPrincipalOnFile(input: {
  ourRole: BrokerRole
  peopleRoles?: readonly string[]
  cycleBuyers?: unknown
  cycleSellers?: unknown
  envelopeRoles?: readonly string[]
}): boolean {
  const people = input.peopleRoles ?? []
  const env = input.envelopeRoles ?? []
  if (input.ourRole === 'listing') {
    if (people.includes('buyer')) return true
    if (partyNamesPresent(input.cycleBuyers)) return true
    return env.some((r) => r === 'Buyer' || r === 'BuyerAgent')
  }
  if (input.ourRole === 'buyer') {
    if (people.includes('seller')) return true
    if (partyNamesPresent(input.cycleSellers)) return true
    return env.some((r) => r === 'Seller' || r === 'SellerAgent')
  }
  return false
}

export function needsOtherSideReturn(
  ourRole: BrokerRole,
  requiredRoles: readonly string[],
  opts?: { otherPrincipalOnFile?: boolean },
): boolean {
  if (ourRole === 'dual' || ourRole === 'unknown') return false
  if (opts?.otherPrincipalOnFile === false) return false
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
