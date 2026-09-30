/**
 * The property behind an expired / FSBO recovery enrollment, for the CRM
 * sequence engine's relist guard (lib/crm/sequence-relist-guard.ts).
 *
 * An enrollment row carries no property; the link is the person. Both prospect
 * tables stamp the owner's CRM person: `outreach_crm_person_id` (the native id
 * the outreach send or a broker's "link person" writes) and `fub_person_id`
 * (the detection crons write the native id there since the CRM cutover; older
 * rows may hold the legacy id, matched too). Same rule as
 * getContactProspectStory, which paints these rows on the contact page.
 *
 * Unlike that reader this one THROWS on a read error: the caller is deciding
 * whether to text an owner, and "no rows" must never stand in for "could not
 * read". DAL boundary (G1): the raw reads live here.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ProspectKind } from '@/lib/data/prospecting/types'

export type RecoveryProspect = {
  kind: ProspectKind
  /** listing_key (expired) | fsbo_url (fsbo). */
  id: string
  streetAddress: string | null
  city: string | null
  postalCode: string | null
  /** Expired: the day it came off the market. FSBO: the day we found it. A sale on or after it is "sold since". */
  offMarketAt: string | null
}

/** Rows read per table. A person is the owner behind one or two records; more than this is checked as far as it goes. */
const PER_TABLE = 10

function personFilter(personId: number, fubLegacyId: number | null | undefined): string {
  const parts = [`outreach_crm_person_id.eq.${personId}`, `fub_person_id.eq.${personId}`]
  if (fubLegacyId != null && fubLegacyId !== personId) parts.push(`fub_person_id.eq.${fubLegacyId}`)
  return parts.join(',')
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** Every expired and FSBO record this person is the owner contact for. Throws on a read error. */
export async function getRecoveryProspectsForPerson(params: {
  personId: number
  fubLegacyId?: number | null
}): Promise<RecoveryProspect[]> {
  const personId = Number(params.personId)
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const filter = personFilter(personId, params.fubLegacyId)
  const [expired, fsbo] = await Promise.all([
    sb
      .from('expired_listings')
      .select('listing_key, street_address, city, postal_code, expired_at, status_change_timestamp, detected_at')
      .or(filter)
      .order('detected_at', { ascending: false })
      .limit(PER_TABLE),
    sb
      .from('fsbo_listings')
      .select('fsbo_url, street_address, city, postal_code, detected_at')
      .or(filter)
      .order('detected_at', { ascending: false })
      .limit(PER_TABLE),
  ])
  if (expired.error) throw new Error(`expired_listings read failed: ${expired.error.message}`)
  if (fsbo.error) throw new Error(`fsbo_listings read failed: ${fsbo.error.message}`)
  const out: RecoveryProspect[] = []
  for (const r of (expired.data ?? []) as Array<Record<string, unknown>>) {
    const id = str(r.listing_key)
    if (!id) continue
    out.push({
      kind: 'expired',
      id,
      streetAddress: str(r.street_address),
      city: str(r.city),
      postalCode: str(r.postal_code),
      offMarketAt: str(r.expired_at) ?? str(r.status_change_timestamp) ?? str(r.detected_at),
    })
  }
  for (const r of (fsbo.data ?? []) as Array<Record<string, unknown>>) {
    const id = str(r.fsbo_url)
    if (!id) continue
    out.push({
      kind: 'fsbo',
      id,
      streetAddress: str(r.street_address),
      city: str(r.city),
      postalCode: str(r.postal_code),
      offMarketAt: str(r.detected_at),
    })
  }
  return out
}

/**
 * How many timeline notes this person already carries under a dedupe-key
 * prefix: the relist guard counts its own "could not answer" notes this way,
 * so a count needs no new column. Throws on a read error.
 */
export async function countTimelineNotesWithKeyPrefix(personId: number, prefix: string): Promise<number> {
  const sb = createServiceClient()
  const { count, error } = await sb
    .from('crm_timeline')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId)
    .like('dedupe_key', `${prefix}%`)
  if (error) throw new Error(`crm_timeline count failed: ${error.message}`)
  return count ?? 0
}
