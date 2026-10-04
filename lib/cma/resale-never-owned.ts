/**
 * A resale still inside the 5-year window, priced with never-owned new homes.
 *
 * The price set keeps those new homes. They are why the higher prices are in
 * the letter. This sentence says the subject will likely sell for less than
 * those homes. It does not invent a dollar discount.
 */

import {
  isNeverOwnedNewConstruction,
  resaleInsideNewBuildWindow,
} from '@/lib/pricing/classes'

/** The sentence the seller letter must print. A missing copy fails the letter test. */
export const RESALE_NEVER_OWNED_SENTENCE =
  'This home is basically a new home, but it is competing with brand-new homes that have had no previous owner, at that same price point, so it will likely sell for less.'

export type ResaleNeverOwnedComp = {
  address?: string | null
  yearBuilt?: number | null
  newConstructionYn?: boolean | null
}

function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null
  const y = Number(iso.slice(0, 4))
  return Number.isInteger(y) && y > 1900 ? y : null
}

function nameList(addresses: string[]): string {
  if (addresses.length === 0) return ''
  if (addresses.length === 1) return addresses[0]!
  if (addresses.length === 2) return `${addresses[0]} and ${addresses[1]}`
  return `${addresses.slice(0, -1).join(', ')}, and ${addresses[addresses.length - 1]}`
}

/**
 * The paragraph the pricing page prints, or null when this home is not a
 * resale inside the waiting period with never-owned sales in the set.
 */
export function resaleNeverOwnedParagraph(input: {
  subjectYear: number | null | undefined
  subjectNewConstructionYn?: boolean | null
  propertySubType?: string | null
  asOfIso?: string | null
  comps: readonly ResaleNeverOwnedComp[]
}): string | null {
  const asOf = yearOf(input.asOfIso)
  if (asOf == null) return null
  if (
    !resaleInsideNewBuildWindow(
      {
        yearBuilt: input.subjectYear,
        newConstructionYn: input.subjectNewConstructionYn,
        propertySubType: input.propertySubType,
      },
      asOf,
    )
  ) {
    return null
  }
  const never = input.comps.filter((c) =>
    isNeverOwnedNewConstruction(
      { yearBuilt: c.yearBuilt, newConstructionYn: c.newConstructionYn },
      asOf,
    ),
  )
  if (never.length === 0) return null
  const names = nameList(
    never.map((c) => (c.address ?? '').trim()).filter((a) => a.length > 0),
  )
  const which =
    names.length === 0
      ? ''
      : never.length === 1
        ? ` In this letter that home is ${names}.`
        : ` In this letter those homes are ${names}.`
  return `${RESALE_NEVER_OWNED_SENTENCE}${which}`
}
