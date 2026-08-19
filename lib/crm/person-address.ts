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
  if (!street && !city && !state && !zip) return null
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
  if (!street && !city && !state && !zip) return null
  return { street, city, state, zip, country: 'US' }
}
