/**
 * Person profile identity edit — first/last name and lead type (buyer/seller/other).
 *
 * Used by the /admin/people/:id editors (v2 header + lead-page-v3 header).
 * The server action writes the plan and a timeline audit note. Never sends.
 */

export const PERSON_LEAD_TYPES = ['buyer', 'seller', 'other'] as const
export type PersonLeadType = (typeof PERSON_LEAD_TYPES)[number]

export const AUDIENCE_BUYER_TAG = 'audience:buyer'
export const AUDIENCE_SELLER_TAG = 'audience:seller'
export const SEGMENT_BUYER_TAG = 'segment:buyer'
export const SEGMENT_SELLER_TAG = 'segment:seller'

const LEAD_TYPE_TAGS = new Set([
  AUDIENCE_BUYER_TAG,
  AUDIENCE_SELLER_TAG,
  SEGMENT_BUYER_TAG,
  SEGMENT_SELLER_TAG,
])

export type PersonIdentitySnapshot = {
  name: string | null
  first_name: string | null
  last_name: string | null
  tags: string[]
  custom: Record<string, unknown> | null
}

export type PersonIdentityInput = {
  firstName: string
  lastName: string
  leadType: string
}

export type PersonIdentityPlan = {
  ok: true
  setName: { first: string | null; last: string | null; name: string } | null
  leadType: PersonLeadType | null
  tags: string[] | null
  customPatch: Record<string, unknown>
  auditTitles: string[]
  skipReason: string | null
} | {
  ok: false
  error: string
}

export function isPersonLeadType(value: unknown): value is PersonLeadType {
  return value === 'buyer' || value === 'seller' || value === 'other'
}

export function composeDisplayName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ').trim()
}

export function leadTypeFromPerson(person: PersonIdentitySnapshot): PersonLeadType {
  const raw = person.custom && typeof person.custom === 'object' ? person.custom.lead_type : null
  if (isPersonLeadType(raw)) return raw
  const tags = person.tags.map((t) => t.toLowerCase())
  if (tags.includes(AUDIENCE_BUYER_TAG)) return 'buyer'
  if (tags.includes(AUDIENCE_SELLER_TAG)) return 'seller'
  return 'other'
}

export function tagsForLeadType(tags: string[], leadType: PersonLeadType): string[] {
  const next = tags.filter((t) => !LEAD_TYPE_TAGS.has(t))
  if (leadType === 'buyer') next.push(AUDIENCE_BUYER_TAG, SEGMENT_BUYER_TAG)
  if (leadType === 'seller') next.push(AUDIENCE_SELLER_TAG, SEGMENT_SELLER_TAG)
  return [...new Set(next)]
}

function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((t, i) => t === right[i])
}

/** Plan a broker-initiated identity write. Empty name is refused. Invalid lead type is refused. */
export function planPersonIdentityEdit(input: {
  person: PersonIdentitySnapshot
  firstName: string
  lastName: string
  leadType: string
  actorEmail: string
}): PersonIdentityPlan {
  const first = input.firstName.trim()
  const last = input.lastName.trim()
  if (!first && !last) return { ok: false, error: 'A first or last name is required.' }
  if (!isPersonLeadType(input.leadType)) return { ok: false, error: 'Lead type must be buyer, seller, or other.' }

  const name = composeDisplayName(first, last)
  const currentName = (input.person.name ?? '').trim()
  const nameChanged = currentName !== name
    || (input.person.first_name ?? '') !== (first || '')
    || (input.person.last_name ?? '') !== (last || '')

  const currentLead = leadTypeFromPerson(input.person)
  const leadChanged = currentLead !== input.leadType
  const nextTags = tagsForLeadType(input.person.tags, input.leadType)
  const tagsChanged = !sameTags(input.person.tags, nextTags)

  const actor = input.actorEmail.trim() || 'unknown'
  const auditTitles: string[] = []
  if (nameChanged) {
    auditTitles.push(`Name changed from "${currentName || '(empty)'}" to "${name}" by ${actor}`)
  }
  if (leadChanged) {
    auditTitles.push(`Lead type changed from "${currentLead}" to "${input.leadType}" by ${actor}`)
  }

  return {
    ok: true,
    setName: nameChanged ? { first: first || null, last: last || null, name } : null,
    leadType: leadChanged ? input.leadType : null,
    tags: tagsChanged ? nextTags : null,
    customPatch: leadChanged ? { lead_type: input.leadType } : {},
    auditTitles,
    skipReason: nameChanged || leadChanged || tagsChanged ? null : 'unchanged',
  }
}
