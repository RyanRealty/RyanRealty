import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmBrokers — the cached, table-backed reader for the CRM broker roster.
 *
 * Replaces the hardcoded CRM_BROKERS const (lib/crm/constants.ts) as the source
 * of brokers for any CRM READ surface. Reads the CRM-facing columns added to
 * public.brokers in migration 20260625171000_crm_brokers_config.sql:
 *   crm_slug (the short matt/rebecca/paul slug) + crm_active + routing_eligible.
 *
 * Only rows that carry a crm_slug are CRM brokers — a broker row without one is
 * a web-only profile and is excluded here. Rows are ordered by the table's
 * sort_order so the roster surfaces in the same order the brokers list elsewhere.
 *
 * DAL boundary (G1): the raw .from('brokers') read lives here, inside lib/data/.
 * Cached because the roster changes rarely; the broker mutation actions
 * revalidate the 'crm-brokers' tag on every change.
 *
 * Fails SOFT (empty array) on an unreadable table so a broker-driven surface
 * degrades to "no brokers" rather than crashing.
 */
export type CrmBroker = {
  /** Short CRM slug (matt/rebecca/paul) — matches crm_people.assigned_broker. */
  slug: string
  /** Display name (brokers.display_name). */
  name: string
  /** Sign-in / routing email. May be null on an incomplete broker row. */
  email: string | null
  /** Is this broker active inside the CRM (pickers, assignment, lists). */
  crmActive: boolean
  /** May this broker receive round-robin lead routing. */
  routingEligible: boolean
}

type RawBrokerRow = {
  crm_slug: string | null
  display_name: string | null
  email: string | null
  crm_active: boolean | null
  routing_eligible: boolean | null
}

/**
 * Map a raw brokers row to the CRM shape. Returns null for any row missing a
 * crm_slug (not a CRM broker). Pure — exported for unit testing.
 */
export function mapCrmBrokerRow(r: RawBrokerRow): CrmBroker | null {
  const slug = (r.crm_slug ?? '').trim()
  if (!slug) return null
  return {
    slug,
    name: (r.display_name ?? '').trim(),
    email: r.email ?? null,
    crmActive: r.crm_active ?? false,
    routingEligible: r.routing_eligible ?? false,
  }
}

/**
 * Map a full result set to CRM brokers, dropping any non-CRM rows. Pure —
 * exported for unit testing the active filter + slug resolution against a
 * realistic multi-row payload.
 */
export function mapCrmBrokerRows(rows: RawBrokerRow[]): CrmBroker[] {
  const out: CrmBroker[] = []
  for (const r of rows) {
    const mapped = mapCrmBrokerRow(r)
    if (mapped) out.push(mapped)
  }
  return out
}

export const getCrmBrokers = unstable_cache(
  async (): Promise<CrmBroker[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
    const { data, error } = await sb
      .from('brokers')
      .select('crm_slug,display_name,email,crm_active,routing_eligible')
      .not('crm_slug', 'is', null)
      .order('sort_order', { ascending: true })
      .order('crm_slug', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmBrokers]', error.message)
      return []
    }
    return mapCrmBrokerRows(data as RawBrokerRow[])
  },
  ['crm-brokers-v1'],
  { revalidate: 300, tags: ['crm-brokers'] },
)

/**
 * Resolve a single CRM broker by its short slug. Returns null when the slug is
 * unknown. Reads through the cached getCrmBrokers() so it shares the same cache
 * entry rather than issuing a second query.
 */
export async function getCrmBrokerBySlug(slug: string): Promise<CrmBroker | null> {
  const key = (slug ?? '').trim()
  if (!key) return null
  const brokers = await getCrmBrokers()
  return brokers.find((b) => b.slug === key) ?? null
}
