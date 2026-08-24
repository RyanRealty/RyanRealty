/**
 * Parties on a TC deal — many CRM people, one file.
 * Dual-intent is one person on this deal (one role). Two houses = two deals.
 */

import type { PersonWhoLabel } from '@/lib/crm/person-who-labels'

export const DEAL_PERSON_ROLES = ['buyer', 'seller', 'other'] as const
export type DealPersonRole = (typeof DEAL_PERSON_ROLES)[number]

export const DEAL_PERSON_ROLE_LABEL: Record<DealPersonRole, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  other: 'Other party',
}

export function isDealPersonRole(value: string): value is DealPersonRole {
  return (DEAL_PERSON_ROLES as readonly string[]).includes(value)
}

/** Seller-side who-labels start a seller role. Everyone else starts as buyer. */
export function defaultDealRoleFromWho(labels: readonly PersonWhoLabel[]): DealPersonRole {
  if (labels.includes('Seller') || labels.includes('Expired listing') || labels.includes('FSBO')) {
    return 'seller'
  }
  return 'buyer'
}

/** Spouse / partner / co-buyer ride the same side. Agents and others are other. */
export function roleForRelated(
  relationshipType: string,
  primary: DealPersonRole,
): DealPersonRole {
  const t = relationshipType.trim().toLowerCase()
  if (t === 'spouse' || t === 'partner' || t === 'co-buyer' || t === 'sibling') return primary
  return 'other'
}

export function parseCityFromAddress(address: string): string | null {
  const parts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const city = parts[1]?.replace(/\s+\d{5}(?:-\d{4})?$/, '').trim()
  return city || null
}

export function propertyKeyForInhouseDeal(address: string, id: string): string {
  const slug = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const short = id.replace(/-/g, '').slice(0, 8)
  return `inhouse-${slug || 'deal'}-${short}`
}

/** Prospect street+city first; else an inbound address parse. */
export function defaultDealAddress(
  prospectStory: ReadonlyArray<{ streetAddress: string | null; city: string | null }>,
  inboundCandidate: string | null,
): string {
  const story = prospectStory.find((s) => s.streetAddress?.trim())
  if (story?.streetAddress?.trim()) {
    return [story.streetAddress.trim(), story.city?.trim()].filter(Boolean).join(', ')
  }
  return inboundCandidate?.trim() ?? ''
}

/** Related CRM people to pre-check on Start a deal. Primary stays off this list. */
export function relatedPartiesForStartDeal(
  related: ReadonlyArray<{
    relatedPersonId: number | null
    name: string
    label: string
    type: string
  }>,
  primaryPersonId: number,
  primaryRole: DealPersonRole,
): Array<{ personId: number; name: string; label: string; role: DealPersonRole }> {
  const seen = new Set<number>([primaryPersonId])
  const out: Array<{ personId: number; name: string; label: string; role: DealPersonRole }> = []
  for (const r of related) {
    const id = r.relatedPersonId
    if (id == null || !Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    out.push({
      personId: id,
      name: r.name,
      label: r.label,
      role: roleForRelated(r.type, primaryRole),
    })
  }
  return out
}

/** Buyer/seller names for form fill. Other is omitted. Blank names drop. */
export function namesByDealRole(
  parties: ReadonlyArray<{ role: DealPersonRole; name: string | null | undefined }>,
): { buyers: string[]; sellers: string[] } {
  const buyers: string[] = []
  const sellers: string[] = []
  for (const p of parties) {
    const name = (p.name ?? '').trim()
    if (!name) continue
    if (p.role === 'buyer') buyers.push(name)
    else if (p.role === 'seller') sellers.push(name)
  }
  return { buyers, sellers }
}

function asPartyNameList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const n = item.trim()
      if (n) out.push(n)
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as { name?: unknown; full_name?: unknown }
      const n = String(o.name ?? o.full_name ?? '').trim()
      if (n) out.push(n)
    }
  }
  return out
}

/** CRM people on the file win; cycle jsonb is the SkySlope-mirror fallback. */
export function partyNamesForEnvelopeSeed(
  cycleBuyers: unknown,
  cycleSellers: unknown,
  parties: ReadonlyArray<{ role: string; name: string | null | undefined }>,
): { buyers: string[]; sellers: string[] } {
  const fromPeople = namesByDealRole(
    parties.filter(
      (p): p is { role: DealPersonRole; name: string | null | undefined } =>
        p.role === 'buyer' || p.role === 'seller' || p.role === 'other',
    ),
  )
  return {
    buyers: fromPeople.buyers.length ? fromPeople.buyers : asPartyNameList(cycleBuyers),
    sellers: fromPeople.sellers.length ? fromPeople.sellers : asPartyNameList(cycleSellers),
  }
}

function normPartyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Link cycle buyer/seller names to CRM people only when the name is unique.
 * Ambiguous or missing names stay unlinked. Brokers are not a deal-people role.
 */
export function uniquePartyLinks(
  wanted: ReadonlyArray<{ name: string; role: DealPersonRole }>,
  people: ReadonlyArray<{ id: number; name: string | null }>,
): Array<{ personId: number; role: DealPersonRole; name: string }> {
  const byName = new Map<string, number[]>()
  for (const p of people) {
    const key = p.name ? normPartyName(p.name) : ''
    if (!key || !Number.isFinite(p.id) || p.id <= 0) continue
    const ids = byName.get(key) ?? []
    ids.push(p.id)
    byName.set(key, ids)
  }
  const seen = new Set<number>()
  const out: Array<{ personId: number; role: DealPersonRole; name: string }> = []
  for (const w of wanted) {
    const key = normPartyName(w.name)
    if (!key) continue
    const ids = byName.get(key) ?? []
    if (ids.length !== 1) continue
    const personId = ids[0]
    if (seen.has(personId)) continue
    seen.add(personId)
    out.push({ personId, role: w.role, name: w.name.trim() })
  }
  return out
}

export function dedupeParties(
  parties: ReadonlyArray<{ personId: number; role: DealPersonRole }>,
): Array<{ personId: number; role: DealPersonRole }> {
  const seen = new Set<number>()
  const out: Array<{ personId: number; role: DealPersonRole }> = []
  for (const p of parties) {
    if (!Number.isFinite(p.personId) || p.personId <= 0) continue
    if (seen.has(p.personId)) continue
    seen.add(p.personId)
    out.push({ personId: p.personId, role: p.role })
  }
  return out
}
