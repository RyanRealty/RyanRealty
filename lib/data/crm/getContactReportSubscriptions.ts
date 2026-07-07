/**
 * getContactReportSubscription — the current-state reader the CRM contact record
 * card's market-report toggle renders from (Stream 1, read side).
 *
 * The newsletter + listing-alerts channels already have their reader in
 * getContactMemberships. Market reports are a distinct subscription: a contact
 * gets reports for a chosen set of geo AREAS on a chosen CADENCE. This reader
 * returns that one row's state (or null when the contact has never been set up),
 * and a companion listAvailableMarketReportAreas() returns the valid options the
 * UI's area picker offers.
 *
 * DAL boundary (G1): the raw .from() read of crm_report_subscriptions lives here,
 * inside lib/data/. UI/actions call this; they never query the table directly.
 */
import { createServiceClient } from '@/lib/supabase/service'
import resortCommunities from '@/data/resort-communities.json'
import { BEND_DISTRICTS } from '@/lib/neighborhood-areas'

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

export type ContactReportSubscription = {
  isActive: boolean
  areas: string[]
  frequency: ReportFrequency
}

/** A selectable market-report area option for the picker. */
export type MarketReportArea = { slug: string; label: string }

/** The three cadences the report engine can produce. Mirrors the SQL CHECK. */
export const REPORT_FREQUENCIES: readonly ReportFrequency[] = ['weekly', 'monthly', 'quarterly'] as const

/** Coerce an arbitrary stored value to a valid ReportFrequency (default monthly). */
export function normalizeReportFrequency(value: unknown): ReportFrequency {
  return value === 'weekly' || value === 'monthly' || value === 'quarterly' ? value : 'monthly'
}

/** The Central Oregon cities the report engine serves, used as the area floor. */
const CENTRAL_OREGON_CITIES: MarketReportArea[] = [
  { slug: 'bend', label: 'Bend' },
  { slug: 'redmond', label: 'Redmond' },
  { slug: 'sisters', label: 'Sisters' },
  { slug: 'sunriver', label: 'Sunriver' },
  { slug: 'tumalo', label: 'Tumalo' },
  { slug: 'la-pine', label: 'La Pine' },
  { slug: 'terrebonne', label: 'Terrebonne' },
]

type RegistryCommunity = { slug?: unknown; label?: unknown; is_resort?: unknown }

/**
 * Map a DB row (or null) to the typed subscription shape. Pure — exported for the
 * unit test so the mapping is verified without touching the DB.
 */
export function mapReportSubscriptionRow(
  row: { is_active?: unknown; areas?: unknown; frequency?: unknown } | null | undefined,
): ContactReportSubscription | null {
  if (!row) return null
  const areas = Array.isArray(row.areas) ? row.areas.filter((a): a is string => typeof a === 'string') : []
  return {
    isActive: row.is_active === true,
    areas,
    frequency: normalizeReportFrequency(row.frequency),
  }
}

/**
 * Build the valid area options: the Central Oregon cities plus every resort
 * community from the registry. De-duped by slug (a registry community never
 * overrides a city of the same slug), sorted by label. Pure — exported for the
 * unit test. Reads the static registry JSON, not the DB.
 */
export function buildMarketReportAreas(): MarketReportArea[] {
  const bySlug = new Map<string, MarketReportArea>()
  for (const city of CENTRAL_OREGON_CITIES) bySlug.set(city.slug, city)

  const communities = Array.isArray((resortCommunities as { communities?: unknown }).communities)
    ? ((resortCommunities as { communities: RegistryCommunity[] }).communities)
    : []
  for (const c of communities) {
    const slug = typeof c.slug === 'string' ? c.slug : null
    const label = typeof c.label === 'string' ? c.label : null
    if (!slug || !label || bySlug.has(slug)) continue
    bySlug.set(slug, { slug, label })
  }

  // Bend neighborhood districts (bend-* boundary slugs) — every CRM
  // neighborhood list gets a subscribable market-report area (2026-07-06).
  // market_stats_cache carries geo_type='neighborhood' rows for each.
  for (const d of BEND_DISTRICTS) {
    if (!bySlug.has(d.slug)) bySlug.set(d.slug, { slug: d.slug, label: d.label })
  }

  return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * The valid market-report area options the UI picker offers. Central Oregon
 * cities + resort communities from the registry. Async to match the DAL surface
 * (callers await every reader) even though the data is static today.
 */
export async function listAvailableMarketReportAreas(): Promise<MarketReportArea[]> {
  return buildMarketReportAreas()
}

/**
 * The contact's market-report subscription state, or null when they have never
 * been set up. Null lets the UI render the "not subscribed" default without
 * inventing an areas/frequency pair the broker did not choose.
 */
export async function getContactReportSubscription(
  personId: number,
): Promise<ContactReportSubscription | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_report_subscriptions')
    .select('is_active,areas,frequency')
    .eq('person_id', personId)
    .maybeSingle()
  return mapReportSubscriptionRow(data)
}
