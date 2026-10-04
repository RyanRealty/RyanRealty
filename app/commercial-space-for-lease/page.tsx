/**
 * /commercial-space-for-lease: every active commercial lease in Central
 * Oregon, one page, on the components/site/v3 barrel (Matt 2026-09-23).
 *
 * THE JOB. A person searching "commercial space for lease Bend" wants the
 * spaces and what they rent for. The portals file leases behind a filter
 * state with no indexable URL; this is a standing page that lists every one,
 * each a door to its own listing, with the rent in its own unit.
 *
 * RHYTHM (2026-09-30, "every town is the same dial block"; "no map on a page
 * about geography"). Ledger (the towns, each a count drawn as a length with
 * the square feet its spaces list as a line under it, opens the page with the
 * H1) beside the lease map (every lease a dot at its own coordinates, each town
 * named with its count; hovering a row lights its town on the map and the
 * other way round; on a phone the rows come first and the map follows them);
 * then the busiest town on its own full V3ListingDial (the same primitive a
 * place page's "Commercial space for lease" section is), opening on its
 * largest space whose rent publishes; then every other town as one row of a
 * drawer, busiest first, the rows one drawing of rents on a shared axis, each
 * opening to its own dial (or its rows, under LEASE_DIAL_MIN) on demand; then
 * Quiet (the towns' own pages). Chrome exempt. A town with no lease is
 * absent.
 *
 * THE FIGURES (CLAUDE.md section 0). One read, getCommercialLeaseListings:
 * listing_tile_mv PropertyType 'G', Active and Active Under Contract, MLS City
 * in the service-area allowlist, plus each lease's rent unit from
 * listings.details "Lease Rate Options". Counts are the rows grouped here. A
 * rent prints with its unit or not at all (publishLeaseRate). A lease is never
 * an Offer: the ItemList names the rent in words and carries no price.
 *
 * EMPTY. The tile read is resilient-cached and can answer [] on a failed read,
 * so an empty pull opts out of ISR (noStore) and the page says what it knows:
 * nothing listed on this refresh, never "there is no commercial space".
 */
import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getCommercialLeaseListings } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingsBrowsePath } from '@/lib/slug'
import { buildJsonLd, type SchemaInput } from '@/lib/site/json-ld'
import { COMMERCIAL_LEASE_PATH } from '@/lib/place/place-lease-heading'
import { basemapForFrame } from '@/lib/geo/basemap-source'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3PlaceInventory,
  V3Quiet,
  V3SectionTracker,
  v3Text,
  type V3QuietItem,
} from '@/components/site/v3'
import {
  LEASE_PAGE_HEADING,
  leaseCityGroups,
  leaseCityLedgerRows,
  leaseCompactHeading,
  leaseCompactNote,
  leaseLedgerKey,
  leaseLedgerNote,
  leaseItemList,
  leaseMapPoints,
  leaseMapTowns,
  leaseMetaDescription,
  leaseTownTiers,
} from './_v3/lease-page'
import { leaseMapBbox, leaseMapModel } from './_v3/lease-map'
import { LeaseMap } from './_v3/LeaseMap'
import { LeaseTownDrawer } from './_v3/LeaseTownDrawer'
import './_v3/lease-page.css'

export const revalidate = 900

// The layout suffix adds "Ryan Realty"; Bend is the search.
const TITLE = 'Commercial Space for Lease in Bend, Oregon'

/** One JSON-LD node as a script body, with `<` escaped so no text can close the tag. */
function ldJson(input: SchemaInput): string {
  return JSON.stringify(buildJsonLd(input)).replace(/</g, '\\u003c')
}

/** The contact form with the inquiry filed as a commercial lease (ContactAsk adds the option). */
const LEASE_ASK_HREF = '/contact?inquiry=Commercial%20lease'

/** The dials' and the rows' line: the same population the ledger's trace names in full. */
const LEASE_LIST_TRACE =
  'regional MLS through Oregon Data Share: every commercial space listed for lease in the Central Oregon service area, Active and Active Under Contract, each with the asking rent in its own unit'

const LEASE_TRACE =
  'regional MLS through Oregon Data Share: every commercial space listed for lease in the Central Oregon service area, Active and Active Under Contract. Each rent is the listing’s own asking rent in its own unit, never converted. A town’s rate line covers every listing it counts: a span for each unit with how many listings use it, and how many rates are not published (no unit on the listing, or a unit its own number contradicts)'

export async function generateMetadata(): Promise<Metadata> {
  const { tiles, rateOptions } = await getCommercialLeaseListings()
  return pageMetadata({
    title: TITLE,
    description: leaseMetaDescription(leaseCityGroups(tiles, rateOptions)),
    path: COMMERCIAL_LEASE_PATH,
    keywords: [
      'commercial space for lease Bend',
      'commercial space for lease Redmond Oregon',
      'office space for lease Bend Oregon',
      'retail space for lease Central Oregon',
      'commercial lease Central Oregon',
      'warehouse space for lease Bend',
    ],
  })
}

export default async function CommercialSpaceForLeasePage() {
  const { tiles, rateOptions, leaseTerms, leadPhotos } = await getCommercialLeaseListings()
  const groups = leaseCityGroups(tiles, rateOptions, leaseTerms, leadPhotos)
  if (groups.length === 0) noStore()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const itemList = leaseItemList(groups, siteUrl)
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Commercial space for lease', url: COMMERCIAL_LEASE_PATH },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: LEASE_PAGE_HEADING,
      description: leaseMetaDescription(groups),
      url: COMMERCIAL_LEASE_PATH,
    },
    // Each lease named with its rent in words. No Offer, no price property:
    // a rent is not a sale price.
    ...(itemList ? [itemList] : []),
  ]

  const ledgerRows = leaseCityLedgerRows(groups).map((row) => ({
    href: row.href,
    what: v3Text(row.what),
    value: v3Text(row.value),
    weight: row.weight,
    ...(row.detail ? { detail: v3Text(row.detail) } : {}),
    ...(row.reveal ? { reveal: { line: v3Text(row.reveal) } } : {}),
    ...(row.media ? { media: row.media } : {}),
    ...(row.also ? { also: { weight: row.also.weight, value: v3Text(row.also.value) } } : {}),
  }))
  const ledgerKey = leaseLedgerKey(groups)
  const [firstRow, ...restRows] = ledgerRows

  // The map: every lease at its own coordinates, each town beside its dots,
  // over the highway and river skeleton of that frame (lease-map.ts).
  const mapPoints = leaseMapPoints(groups)
  const mapFrame = leaseMapBbox(mapPoints)
  const mapModel = mapFrame
    ? leaseMapModel(mapPoints, leaseMapTowns(groups), basemapForFrame({ bbox: mapFrame, tier: 'region', pad: 0.05 }))
    : null
  const { lead: leadTown, rest: restTowns } = leaseTownTiers(groups)

  const edges: V3QuietItem[] = [
    ...groups
      .filter((group) => group.cityHref)
      .map((group) => ({ label: `${group.label} real estate`, href: group.cityHref as string })),
    { label: 'Homes for sale in Central Oregon', href: listingsBrowsePath() },
    { label: 'Talk to a broker', href: '/contact' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        {schemas.map((schema, i) => (
          <script
            key={`ld-${schema.type}-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJson(schema) }}
          />
        ))}
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Commercial space for lease' }]} />

        {firstRow ? (
          <>
            <V3Ledger
              id="towns"
              className="lease-towns"
              heading={v3Text(LEASE_PAGE_HEADING)}
              headingLevel={1}
              encode="bar"
              encodeKey={{
                value: v3Text(ledgerKey.value),
                ...(ledgerKey.also ? { also: v3Text(ledgerKey.also) } : {}),
              }}
              note={(() => {
                const note = leaseLedgerNote(groups)
                return note ? v3Text(note) : undefined
              })()}
              drawing={mapModel ? <LeaseMap model={mapModel} /> : undefined}
              rows={[firstRow, ...restRows]}
              source={v3Text(LEASE_TRACE)}
              // The page's own ask, beside the towns (2026-09-30: "no page-native
              // ask"), filed as a commercial-lease inquiry.
              action={{
                label: v3Text('Tell a broker the space you need'),
                href: LEASE_ASK_HREF,
                variant: 'primary',
              }}
            />
            {/* The busiest town leads on its own full dial: the same primitive,
                card and rent line as the lease section on a place page. */}
            <V3PlaceInventory
              id="lease"
              layout="dial"
              placeName="Central Oregon"
              sections={(leadTown ? [leadTown] : []).map((group) => ({
                key: group.slug,
                heading: group.label,
                countLabel: group.countLabel,
                label: `Commercial space for lease in ${group.label}`,
                rows: group.rows,
              }))}
              // Every other town, busiest first, one row each that opens to its
              // own leases on demand: inside this block, above its source line.
              after={
                <LeaseTownDrawer
                  id="lease-more"
                  heading={leaseCompactHeading(restTowns)}
                  note={leaseCompactNote(restTowns)}
                  groups={restTowns}
                />
              }
              source={LEASE_LIST_TRACE}
            />
          </>
        ) : (
          <V3Quiet
            id="towns"
            heading={LEASE_PAGE_HEADING}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'Nothing listed on this refresh',
                body: 'No commercial lease in the Central Oregon service area is on the regional MLS on this refresh. New space lists often, so check back, or tell a broker what you need.',
              },
              { label: 'Talk to a broker', href: '/contact' },
            ]}
          />
        )}

        <V3Quiet id="edges" heading="Keep looking" items={edges} />
      </main>

      {/* Outside <main> so the footer maps to the contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
