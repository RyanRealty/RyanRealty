/**
 * market-report-areas — the one display label for a market-report area slug.
 *
 * The email already said "Larkspur" for `bend-larkspur` (the registry label),
 * while the admin hub printed the raw slug list ("bend, bend-larkspur") and the
 * contact's delivery panel titleized the slug into "Bend Larkspur" (Matt
 * 2026-09-29). Every surface that names a report area now asks here, so the
 * CRM record, the hub, the delivery panel, the preferences page and the email
 * agree.
 *
 * Source: the report-area registry (buildMarketReportAreas: the Central Oregon
 * report cities, the resort communities in data/resort-communities.json, and
 * the Bend districts), then the neighborhood registry, never a raw slug.
 */
import 'server-only'

import { buildMarketReportAreas, type MarketReportArea } from '@/lib/data/crm/getContactReportSubscriptions'
import { labelForNeighborhoodSlug } from '@/lib/neighborhood-areas'

let byslug: Map<string, string> | null = null

function registry(): Map<string, string> {
  if (!byslug) byslug = new Map(buildMarketReportAreas().map((a) => [a.slug, a.label]))
  return byslug
}

/** "bend-larkspur" -> "Larkspur", "bend" -> "Bend", "tetherow" -> "Tetherow". */
export function reportAreaLabel(slug: string): string {
  const s = (slug ?? '').trim()
  if (!s) return ''
  return registry().get(s) ?? labelForNeighborhoodSlug(s)
}

/** Every selectable area, as {slug, label}, sorted by label (the registry's order). */
export function reportAreaOptions(): MarketReportArea[] {
  return buildMarketReportAreas()
}
