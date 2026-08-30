/**
 * Compact "Listed by" line for the listing face.
 * Agent + office + phone when leftover has them. Miss omits.
 */

function clean(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (!value || value.startsWith('*')) return null
  return value
}

export function publishListingListedBy(input: {
  listAgentName?: string | null
  listOfficeName?: string | null
  listAgentPhone?: string | null
  listOfficePhone?: string | null
}): string | null {
  const agent = clean(input.listAgentName)
  const office = clean(input.listOfficeName)
  const who = agent && office ? `${agent}, ${office}` : agent ?? office
  if (!who) return null
  const phone = clean(input.listAgentPhone) ?? clean(input.listOfficePhone)
  return phone ? `Listed by ${who} · ${phone}` : `Listed by ${who}`
}
