/**
 * Attach a skip-traced owner to a CMA that has no client yet.
 *
 * The expired cron writes the owner onto crm_people and expired_listings.
 * A later build (prospecting desk, address-only admin form, CLI rebuild)
 * used to persist a null client and never read that contact back. A null
 * must not wipe a client already stored, and a different person already
 * named on the build is left alone.
 */

import { findCrmPersonIdByEmail, getExpiredOwnerForCma } from '@/lib/data/cma/crm'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import type { CmaClient } from '@/lib/cma/types'

export type CmaClientLink = {
  name: string | null
  email: string | null
  phone: string | null
  personId: number | null
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function cleanEmail(value: string | null | undefined): string | null {
  const trimmed = clean(value)
  return trimmed ? trimmed.toLowerCase() : null
}

function cleanPersonId(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

/**
 * Fill only blank fields. An email already on the build wins. A person id
 * that is not the owner's is not replaced. A null owner leaves the build
 * unchanged.
 */
export function linkUnclaimedCmaClient(args: {
  client: { name: string | null; email: string | null; phone: string | null }
  personId: number | null
  owner: CmaClientLink | null
}): CmaClientLink {
  const name = clean(args.client.name)
  const email = cleanEmail(args.client.email)
  const phone = clean(args.client.phone)
  const personId = cleanPersonId(args.personId)
  const owner = args.owner
  if (!owner) return { name, email, phone, personId }

  const ownerPersonId = cleanPersonId(owner.personId)
  const ownerEmail = cleanEmail(owner.email)
  const claimedByOther =
    personId != null && ownerPersonId != null && personId !== ownerPersonId
  const emailConflicts = email != null && ownerEmail != null && email !== ownerEmail
  if (claimedByOther || emailConflicts) return { name, email, phone, personId }

  return {
    name: name || clean(owner.name),
    email: email || ownerEmail,
    phone: phone || clean(owner.phone),
    personId: personId ?? ownerPersonId,
  }
}

/** Columns to upsert. A null is omitted so a rebuild cannot wipe a stored client. */
export function cmaClientPersistFields(linked: CmaClientLink): {
  client_name?: string
  client_email?: string
  client_phone?: string
  person_id?: number
} {
  const fields: {
    client_name?: string
    client_email?: string
    client_phone?: string
    person_id?: number
  } = {}
  if (linked.name) fields.client_name = linked.name
  if (linked.email) fields.client_email = linked.email
  if (linked.phone) fields.client_phone = linked.phone
  if (linked.personId) fields.person_id = linked.personId
  return fields
}

/**
 * The client this build should store and render.
 *
 * Order: what the caller already named, then the expired-listing owner for
 * this MLS key, then the CRM person on that id (primary email when the
 * expired row has none). An email with no person id is matched to crm_people.
 */
export async function resolveLinkedCmaClient(args: {
  client: CmaClient
  personId: number | null
  listingKey: string | null
}): Promise<CmaClientLink> {
  const listingKey = args.listingKey?.trim() || null
  const owner = listingKey ? await getExpiredOwnerForCma(listingKey) : null
  let linked = linkUnclaimedCmaClient({
    client: args.client,
    personId: args.personId,
    owner,
  })
  if (linked.personId && (!linked.email || !linked.name || !linked.phone)) {
    const person = await getPersonForCmaKickoff(linked.personId)
    if (person) {
      linked = linkUnclaimedCmaClient({
        client: { name: linked.name, email: linked.email, phone: linked.phone },
        personId: linked.personId,
        owner: {
          name: person.name,
          email: person.primaryEmail,
          phone: person.primaryPhone,
          personId: person.id,
        },
      })
    }
  }
  if (linked.personId == null && linked.email) {
    const found = await findCrmPersonIdByEmail(linked.email)
    if (found) linked = { ...linked, personId: found }
  }
  return linked
}
