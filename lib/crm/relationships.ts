/**
 * CRM relationship vocabulary (CONTACT360 Phase 4.1).
 *
 * The typed vocabulary for contact-to-contact links ("married / co-buyer /
 * referrer"). Two link shapes:
 *
 *   - SYMMETRIC  (spouse, partner, sibling, co-buyer) — the reciprocal type is
 *     the same type. A's spouse B implies B's spouse A.
 *   - DIRECTIONAL (parent<->child, agent<->client, referrer<->referred,
 *     assistant<->principal) — the reciprocal is the inverse type so each
 *     record reads correctly from its own side.
 *
 * Every link writes BOTH directions to crm_relationships so a relationship is
 * never one-sided. `reciprocalType()` is a PURE, total map over the vocabulary
 * (every key has a reciprocal, and the map round-trips:
 * reciprocalType(reciprocalType(t)) === t for every t). This file has NO
 * side effects and NO imports — it is the unit-tested core the server actions
 * and UI build on top of.
 */

/** Canonical relationship type keys stored in crm_relationships.kind. */
export const RELATIONSHIP_TYPES = [
  'spouse',
  'partner',
  'sibling',
  'co-buyer',
  'parent',
  'child',
  'agent',
  'client',
  'referrer',
  'referred',
  'assistant',
  'principal',
  'other',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

/** Human label for each type (the side shown ON the related contact's card). */
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  partner: 'Partner',
  sibling: 'Sibling',
  'co-buyer': 'Co-buyer',
  parent: 'Parent',
  child: 'Child',
  agent: 'Agent',
  client: 'Client',
  referrer: 'Referrer',
  referred: 'Referred',
  assistant: 'Assistant',
  principal: 'Principal',
  other: 'Other',
}

/**
 * Whether a type is symmetric (its own reciprocal). Symmetric types render the
 * same label on both records; directional types render the inverse.
 */
export const SYMMETRIC_TYPES: ReadonlySet<RelationshipType> = new Set<RelationshipType>([
  'spouse',
  'partner',
  'sibling',
  'co-buyer',
])

/**
 * The reciprocal map. Symmetric types map to themselves; directional types map
 * to their inverse. This is a TOTAL involution over RELATIONSHIP_TYPES:
 *   - every key is present, and
 *   - RECIPROCAL[RECIPROCAL[t]] === t  for every t.
 */
const RECIPROCAL: Record<RelationshipType, RelationshipType> = {
  // symmetric — reciprocal is the same type
  spouse: 'spouse',
  partner: 'partner',
  sibling: 'sibling',
  'co-buyer': 'co-buyer',
  other: 'other',
  // directional pairs — reciprocal is the inverse type
  parent: 'child',
  child: 'parent',
  agent: 'client',
  client: 'agent',
  referrer: 'referred',
  referred: 'referrer',
  assistant: 'principal',
  principal: 'assistant',
}

/** Narrow an arbitrary string to a known RelationshipType, else null. */
export function isRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === 'string' && (RELATIONSHIP_TYPES as readonly string[]).includes(value)
}

/** Coerce a raw/legacy `kind` to a canonical RelationshipType, defaulting to 'other'. */
export function normalizeRelationshipType(value: string | null | undefined): RelationshipType {
  const v = String(value ?? '').trim().toLowerCase()
  return isRelationshipType(v) ? v : 'other'
}

/**
 * The reciprocal type for the OTHER side of a link. PURE + total.
 * spouse<->spouse, parent<->child, agent<->client, referrer<->referred,
 * assistant<->principal, other<->other.
 */
export function reciprocalType(type: RelationshipType): RelationshipType {
  return RECIPROCAL[type]
}

/** True when the two ids name the same person (a self-link — always rejected). */
export function isSelfLink(fromPersonId: number, toPersonId: number): boolean {
  return fromPersonId === toPersonId
}

/**
 * Validate a link request BEFORE any write. Pure (no DB). Guards:
 *   - both ids are positive finite integers,
 *   - the ids are not the same person (no self-link),
 *   - the type is a known RelationshipType.
 * Returns the canonical type on success so callers write a clean `kind`.
 */
export function validateLink(params: {
  fromPersonId: number
  toPersonId: number
  type: string
}): { ok: true; type: RelationshipType } | { ok: false; error: string } {
  const { fromPersonId, toPersonId } = params
  if (!Number.isInteger(fromPersonId) || fromPersonId <= 0) {
    return { ok: false, error: 'fromPersonId required' }
  }
  if (!Number.isInteger(toPersonId) || toPersonId <= 0) {
    return { ok: false, error: 'toPersonId required' }
  }
  if (isSelfLink(fromPersonId, toPersonId)) {
    return { ok: false, error: 'A contact cannot be linked to itself' }
  }
  if (!isRelationshipType(params.type)) {
    return { ok: false, error: 'Unknown relationship type' }
  }
  return { ok: true, type: params.type }
}

/**
 * The unordered pair key for duplicate detection: the two ids sorted, so
 * (12, 7) and (7, 12) share one key. Used to guard against linking the same
 * two people twice regardless of which side initiated.
 */
export function pairKey(a: number, b: number): string {
  return a <= b ? `${a}:${b}` : `${b}:${a}`
}
