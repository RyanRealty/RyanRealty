/**
 * getContactProspectStory — the contact page's view of the prospecting tables
 * (expired_listings + fsbo_listings): the structured listing story behind an
 * expired/FSBO lead, matched by CRM person id. Powers the right-rail "Listing
 * history" card so the story lives as data, not a buried prose note.
 *
 * Linking columns (see docs/DATABASE_SCHEMA_SNAPSHOT.md): both tables carry
 * `outreach_crm_person_id` (the native crm_people id stamped by the outreach
 * send) and `fub_person_id` (post-CRM-cutover this stores the NATIVE id too;
 * pre-cutover rows may still hold the CRM legacy id, so the optional
 * `fubLegacyId` is matched as well).
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type ContactProspectStory = {
  kind: 'expired' | 'fsbo'
  /** listing_key (expired) | fsbo_url (fsbo) — the prospect route's <id> segment. */
  prospectId: string
  /** 'Expired' / 'Canceled' / … (expired standard_status) or the FSBO status. */
  status: string
  statusDate: string | null
  mlsNumber: string | null
  lastListPrice: number | null
  originalListPrice: number | null
  daysOnMarket: number | null
  priorAgentName: string | null
  priorOfficeName: string | null
  streetAddress: string | null
  city: string | null
  /**
   * Deep link to the prospect's own page, /admin/prospecting/<kind>/<id>. The
   * `?id=` drawer this replaces was deleted 2026-07-28; the id segment stays
   * URL-encoded because a fsbo_url carries slashes (the route decodes it).
   */
  detailHref: string
}

function num(v: unknown): number | null {
  return v == null ? null : Number(v)
}

// supabase-js cannot statically parse a concatenated select string, so the
// rows come back untyped — same RawRow pattern as lib/data/prospecting/get.ts.
type RawRow = Record<string, unknown>

/** PostgREST .or() filter over the person-linking columns. */
function personFilter(personId: number, fubLegacyId: number | null | undefined): string {
  const parts = [`outreach_crm_person_id.eq.${personId}`, `fub_person_id.eq.${personId}`]
  if (fubLegacyId != null && fubLegacyId !== personId) parts.push(`fub_person_id.eq.${fubLegacyId}`)
  return parts.join(',')
}

export async function getContactProspectStory(params: {
  personId: number
  fubLegacyId?: number | null
}): Promise<ContactProspectStory[]> {
  const personId = Number(params.personId)
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const filter = personFilter(personId, params.fubLegacyId)

  const [expired, fsbo] = await Promise.all([
    sb
      .from('expired_listings')
      .select(
        'listing_key, list_number, street_address, city, standard_status, expired_at, status_change_timestamp, detected_at, ' +
          'list_price, original_list_price, days_on_market, cumulative_days_on_market, list_agent_name, list_office_name',
      )
      .or(filter)
      .order('detected_at', { ascending: false })
      .limit(5),
    sb
      .from('fsbo_listings')
      .select('fsbo_url, street_address, city, status, detected_at, list_price, days_listed')
      .or(filter)
      .order('detected_at', { ascending: false })
      .limit(5),
  ])
  if (expired.error) console.error('[getContactProspectStory] expired read failed:', expired.error.message)
  if (fsbo.error) console.error('[getContactProspectStory] fsbo read failed:', fsbo.error.message)

  const stories: ContactProspectStory[] = []
  for (const r of ((expired.data ?? []) as unknown as RawRow[])) {
    const id = String(r.listing_key)
    stories.push({
      kind: 'expired',
      prospectId: id,
      status: (r.standard_status as string | null) ?? 'Expired',
      statusDate:
        (r.expired_at as string | null) ??
        (r.status_change_timestamp as string | null) ??
        (r.detected_at as string | null) ??
        null,
      mlsNumber: (r.list_number as string | null) ?? null,
      lastListPrice: num(r.list_price),
      originalListPrice: num(r.original_list_price),
      daysOnMarket: num(r.cumulative_days_on_market) ?? num(r.days_on_market),
      priorAgentName: (r.list_agent_name as string | null) ?? null,
      priorOfficeName: (r.list_office_name as string | null) ?? null,
      streetAddress: (r.street_address as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      detailHref: `/admin/prospecting/expired/${encodeURIComponent(id)}`,
    })
  }
  for (const r of ((fsbo.data ?? []) as unknown as RawRow[])) {
    const id = String(r.fsbo_url)
    stories.push({
      kind: 'fsbo',
      prospectId: id,
      status: (r.status as string | null) === 'off_market' ? 'Off market' : 'FSBO',
      statusDate: (r.detected_at as string | null) ?? null,
      mlsNumber: null,
      lastListPrice: num(r.list_price),
      originalListPrice: null,
      daysOnMarket: num(r.days_listed),
      priorAgentName: null,
      priorOfficeName: null,
      streetAddress: (r.street_address as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      detailHref: `/admin/prospecting/fsbo/${encodeURIComponent(id)}`,
    })
  }

  stories.sort((a, b) => (b.statusDate ?? '').localeCompare(a.statusDate ?? ''))
  return stories
}
