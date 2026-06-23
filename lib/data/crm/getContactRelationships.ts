/**
 * getContactRelationships — the read side for the Contact-360 relationships panel
 * (CONTACT360 Phase 4.3, read). Matt's ask: "assign relationships like two
 * contacts are married."
 *
 * Returns every relationship a contact has, from THIS contact's side, so the
 * panel can list "Jane Smith — Spouse" with an unlink control. Each row carries:
 *
 *   {
 *     relatedPersonId: number | null   // the linked contact's crm_people.id
 *     name:            string          // the related contact's current name
 *     type:            RelationshipType // canonical kind (humanized for display)
 *     label:           string          // humanized label, e.g. 'Spouse'
 *   }
 *
 * The link is always stored BOTH directions in crm_relationships (see
 * app/actions/crm-relationships.ts), so reading `person_id = crmPersonId` gives
 * the contact's own side of every link with the correct directional `kind`
 * (the from->to row holds the type as it reads FROM this contact).
 *
 * Name resolution prefers the related contact's CURRENT crm_people.name (it can
 * change after the link was written) and falls back to the snapshot
 * `related_name` stored on the row, then to "Contact #<id>". The `kind` column
 * is the relationship type (confirmed in docs/DATABASE_SCHEMA_SNAPSHOT.md ->
 * crm_relationships.kind); a dirty/legacy value normalizes to 'other'.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'
import {
  RELATIONSHIP_LABELS,
  normalizeRelationshipType,
  type RelationshipType,
} from '@/lib/crm/relationships'

export type ContactRelationship = {
  /** crm_relationships.id — the row this contact's side of the link lives on. */
  id: number
  /** The linked contact's crm_people.id, or null for a name-only (FUB-imported) link. */
  relatedPersonId: number | null
  /** The related contact's current display name (falls back to the stored snapshot). */
  name: string
  /** Canonical relationship type as it reads FROM this contact. */
  type: RelationshipType
  /** Humanized label for the Badge, e.g. 'Spouse', 'Co-buyer'. */
  label: string
}

/**
 * Humanize a stored `kind` into its display label. PURE + total: a dirty or
 * legacy value normalizes to 'other' (never throws, never returns an unknown
 * string). Exported so it is unit-testable independent of the DB read.
 */
export function humanizeRelationshipType(kind: string | null | undefined): string {
  return RELATIONSHIP_LABELS[normalizeRelationshipType(kind)]
}

/** Best-effort display name for a linked contact. */
function relationshipName(
  currentName: string | null | undefined,
  snapshotName: string | null | undefined,
  relatedPersonId: number | null,
): string {
  const current = (currentName ?? '').trim()
  if (current) return current
  const snapshot = (snapshotName ?? '').trim()
  if (snapshot) return snapshot
  return relatedPersonId !== null ? `Contact #${relatedPersonId}` : 'Unknown contact'
}

/**
 * Every relationship a contact has, from this contact's own side. Ordered by the
 * related contact's name so the list reads predictably. Returns [] for an invalid
 * id or a contact with no links.
 */
export async function getContactRelationships(
  crmPersonId: number,
): Promise<ContactRelationship[]> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []

  const sb = createServiceClient()

  const { data: rows } = await sb
    .from('crm_relationships')
    .select('id,related_person_id,related_name,kind')
    .eq('person_id', crmPersonId)

  if (!rows || rows.length === 0) return []

  // Resolve current names for the linked contacts in one round trip.
  const relatedIds = Array.from(
    new Set(
      rows
        .map((r) => (r.related_person_id === null ? null : Number(r.related_person_id)))
        .filter((v): v is number => v !== null && Number.isFinite(v)),
    ),
  )

  const nameById = new Map<number, string>()
  if (relatedIds.length > 0) {
    const { data: people } = await sb
      .from('crm_people')
      .select('id,name')
      .in('id', relatedIds)
    for (const p of people ?? []) {
      nameById.set(Number(p.id), String(p.name ?? ''))
    }
  }

  const out: ContactRelationship[] = rows.map((r) => {
    const relatedPersonId = r.related_person_id === null ? null : Number(r.related_person_id)
    const type = normalizeRelationshipType(r.kind)
    return {
      id: Number(r.id),
      relatedPersonId,
      name: relationshipName(
        relatedPersonId !== null ? nameById.get(relatedPersonId) : null,
        r.related_name,
        relatedPersonId,
      ),
      type,
      label: RELATIONSHIP_LABELS[type],
    }
  })

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
