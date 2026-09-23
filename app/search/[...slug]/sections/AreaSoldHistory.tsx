import { V3Instrument, V3Quiet, v3Text, type V3QuietItem } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'
import { homesForSalePath } from '../../../../lib/slug'
import { subdivisionDetailPath } from '@/lib/data/subdivisions/subdivision-index'
import {
  isSameCityPlat,
  publishBrowsePairName,
  type BrowsePairDecision,
  type BrowsePairFacts,
} from '@/lib/seo/browse-pair-decision'

/**
 * The sold-history section of a /homes-for-sale/{city}/{area} browse page
 * (visibility audit 2026-09-22, EXP-2).
 *
 * THE DEFECT. 1,051 of the 1,815 sitemapped pairs had no home for sale
 * (live geo.xml and MVs, 2026-09-23), and the page rendered one line of
 * <main> text, "No homes match this search right now", with nothing under it
 * (12 of 17 in the verifier's live sample). Google filed
 * /homes-for-sale/bend/cambria as a Soft 404 (URL Inspection read 2026-09-23,
 * last crawl 2026-08-04). The data to say more was already cached for the
 * sitemap and never reached the page. 361 of the 748 pairs the sitemap still
 * submits have nothing for sale today; this section is their content.
 *
 * WHAT IT SAYS, and only this (§0, one population per figure):
 *   - the closed sales the regional MLS filed under this subdivision name with
 *     this city, all years on file (subdivision_city_inventory_mv status_counts,
 *     the same row the sitemap decision reads — lib/seo/getBrowsePairDecision.ts);
 *   - the recorded county plat of this place when one exists (same city; the
 *     slug may differ across a word break: BrowsePairFacts.cityPlat), from
 *     subdivision_plat_closed_mv / boundaries, as a door, with no second
 *     count beside the first: the plat page counts a different population
 *     (inside the polygon) and prints its own.
 * No price statistic: a closed PRICE at subdivision grain stays withheld
 * (REGISTRY §4, publishSubdivisionClosedPrice), and sold listings themselves are
 * VOW-only (ODS §5-4), so this is counts, never rows.
 */

export type AreaSoldHistoryModel = {
  name: string
  city: string
  closed: number
  /** The MLS name the closed count sits under, or null when that name is a code. */
  filedAs: string | null
  plat: { label: string; href: string } | null
  pagePath: string
}

/** Pure: what the section shows for this pair, or null when it has nothing true to say. */
export function areaSoldHistoryModel(input: {
  decision: BrowsePairDecision | null
  facts: BrowsePairFacts | null
  city: string | null | undefined
  pagePath: string
}): AreaSoldHistoryModel | null {
  const { decision, facts } = input
  const city = (input.city ?? '').trim()
  if (!decision || !facts || !city) return null
  if (decision.kind === 'unresolved' || decision.kind === 'unknown' || decision.kind === 'community-twin') return null
  const name = decision.publicName
  if (!name) return null
  const closed = facts.inventory?.closedLifetime ?? 0
  // The door goes to THIS place's recorded plat (same city; the slug may
  // differ across a word break). A plat of the same words in another city is
  // another place (bend/north-rim is not the Redmond plat north-rim).
  const cityPlat = isSameCityPlat(facts) ? facts.cityPlat : null
  const platLabel = cityPlat ? publishBrowsePairName(cityPlat.label) : null
  const plat = cityPlat && platLabel ? { label: platLabel, href: subdivisionDetailPath(cityPlat.slug) } : null
  if (closed <= 0 && !plat) return null
  // The name the count was FILED under, when it is printable. A plat twin whose
  // MLS name is a code takes its public name from the plat, and the MLS never
  // filed anything under that name, so the sentence must not say it did.
  const filedAs = publishBrowsePairName(facts.inventory?.mlsName ?? facts.activeName)
  return { name, city, closed, filedAs, plat, pagePath: input.pagePath }
}

export function AreaSoldHistory({ model }: { model: AreaSoldHistoryModel }) {
  const { name, city, closed, filedAs, plat, pagePath } = model
  const filedUnder = filedAs ? `the name ${filedAs}` : "this subdivision's MLS code"
  const doors: V3QuietItem[] = [
    { label: `${city} homes for sale`, href: homesForSalePath(city) },
    { label: `What is my ${name} home worth?`, href: valuationHref(pagePath) },
    { label: 'Talk to a broker', href: '/contact' },
  ]
  return (
    <>
      {closed > 0 ? (
        <V3Instrument
          id="sold-history"
          level={2}
          eyebrow={v3Text('Sold here')}
          headline={v3Text(`${closed.toLocaleString('en-US')} ${closed === 1 ? 'home has' : 'homes have'} sold in ${name}`)}
          figures={[
            {
              value: v3Text(closed.toLocaleString('en-US')),
              label: v3Text(closed === 1 ? 'closed sale on record' : 'closed sales on record'),
              sentence: v3Text(`Sales the regional MLS filed under ${filedUnder} with a ${city} address.`),
            },
          ]}
          source={v3Text(
            `Regional MLS closed listings filed under ${filedUnder} in ${city}, all years on file, as released for internet display. A count only: sold prices at this scale are not published.`,
          )}
          action={
            plat
              ? { label: v3Text(`See the recorded plat of ${plat.label}`), href: plat.href, variant: 'ghost' }
              : undefined
          }
        />
      ) : null}
      <V3Quiet
        ariaLabel={`More on ${name}`}
        items={
          closed > 0 || !plat
            ? doors
            : [{ label: `See the recorded plat of ${plat.label}`, href: plat.href }, ...doors]
        }
      />
    </>
  )
}
