/**
 * Compact "Listed by" line for the listing face.
 *
 * A home listed by another brokerage shows that brokerage's name. The listing
 * broker's phone stays off the page (Matt 2026-09-22). A Ryan Realty listing
 * may name our agent and our phone.
 */

function clean(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (!value || value.startsWith('*')) return null
  return value
}

export function listingOfficeIsOurs(listOfficeName: string | null | undefined): boolean {
  const office = clean(listOfficeName)
  return !!office && office.toLowerCase().includes('ryan realty')
}

export function publishListingListedBy(input: {
  listAgentName?: string | null
  listOfficeName?: string | null
  listAgentPhone?: string | null
  listOfficePhone?: string | null
  /** True when the listing agent resolved to a Ryan Realty broker. */
  ours?: boolean
}): string | null {
  const agent = clean(input.listAgentName)
  const office = clean(input.listOfficeName)
  const ours = input.ours === true || listingOfficeIsOurs(office)
  if (!ours) return office ? `Listed by ${office}` : null
  const who = agent && office ? `${agent}, ${office}` : agent ?? office
  if (!who) return null
  const phone = clean(input.listAgentPhone) ?? clean(input.listOfficePhone)
  return phone ? `Listed by ${who} · ${phone}` : `Listed by ${who}`
}
