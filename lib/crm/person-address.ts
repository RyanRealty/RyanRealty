/**
 * crm_people.addresses jsonb: first-class household address.
 * Shape matches saveAddressRowAction: { street, city, state, zip, country? }.
 * Zip may arrive as `code` from older merge tokens.
 */

export type PersonAddress = {
  street: string
  city: string
  state: string
  zip: string
  country?: string
}


/**
 * A state on its own is not an address.
 *
 * The quick-add form pre-fills State with "OR", so a contact saved with no
 * street, city or zip still produced { state: 'OR' } — which the header then
 * rendered as a bare line reading "OR", twice, on every addressless contact.
 * An address is real when it has a street, a city, or a zip; the state
 * qualifies those, it does not stand in for them.
 */
function hasRealAddress(a: { street: string; city: string; zip: string }): boolean {
  return Boolean(a.street || a.city || a.zip)
}

export function firstPersonAddress(raw: unknown): PersonAddress | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const row = raw[0]
  if (!row || typeof row !== 'object') return null
  const a = row as Record<string, unknown>
  const street = String(a.street ?? '').trim()
  const city = String(a.city ?? '').trim()
  const state = String(a.state ?? '').trim()
  const zip = String(a.zip ?? a.code ?? '').trim()
  const country = String(a.country ?? '').trim()
  if (!hasRealAddress({ street, city, zip })) return null
  return country ? { street, city, state, zip, country } : { street, city, state, zip }
}

export function formatPersonAddress(address: PersonAddress): string {
  const cityState = [address.city, address.state].filter(Boolean).join(', ')
  const cityStateZip = [cityState, address.zip].filter(Boolean).join(' ')
  return [address.street, cityStateZip].filter(Boolean).join(', ')
}

export function personAddressFromFields(fields: {
  street?: string
  city?: string
  state?: string
  zip?: string
}): PersonAddress | null {
  const street = String(fields.street ?? '').trim()
  const city = String(fields.city ?? '').trim()
  const state = String(fields.state ?? '').trim()
  const zip = String(fields.zip ?? '').trim()
  if (!hasRealAddress({ street, city, zip })) return null
  return { street, city, state, zip, country: 'US' }
}
