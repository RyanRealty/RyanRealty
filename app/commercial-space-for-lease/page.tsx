/**
 * /commercial-space-for-lease: every active commercial lease in Central
 * Oregon, one page, on the components/site/v3 barrel (Matt 2026-09-23).
 *
 * THE JOB. A person searching "commercial space for lease Bend" wants the
 * spaces and what they rent for. The portals file leases behind a filter
 * state with no indexable URL; this is a standing page that lists every one,
 * each a door to its own listing, with the rent in its own unit.
 *
 * RHYTHM. Ledger (the towns, each a count drawn as a length, opens the page
 * with the H1), then one V3ListingDial per town (the enumeration: the same
 * primitive a place page's "Commercial space for lease" section is), then
 * Quiet (the towns' own pages). Chrome exempt. A town with no lease is absent.
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
  leaseItemList,
  leaseMetaDescription,
} from './_v3/lease-page'

export const revalidate = 900

// The layout suffix adds "Ryan Realty, Central Oregon"; Bend is the search.
const TITLE = 'Commercial Space for Lease in Bend, Oregon'

/** One JSON-LD node as a script body, with `<` escaped so no text can close the tag. */
function ldJson(input: SchemaInput): string {
  return JSON.stringify(buildJsonLd(input)).replace(/</g, '\\u003c')
}

const LEASE_TRACE =
  'regional MLS through Oregon Data Share: every publicly active commercial lease (MLS property type G) in the Central Oregon service area, Active and Active Under Contract. Each rent is the listing’s own asking rent in its own unit, never converted. A town’s rate line covers every listing it counts: a span for each unit with how many listings use it, and how many rates are not published (no unit on the listing, or a unit its own number contradicts)'

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
  const { tiles, rateOptions } = await getCommercialLeaseListings()
  const groups = leaseCityGroups(tiles, rateOptions)
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
  }))
  const [firstRow, ...restRows] = ledgerRows

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
              heading={v3Text(LEASE_PAGE_HEADING)}
              headingLevel={1}
              encode="bar"
              rows={[firstRow, ...restRows]}
              source={v3Text(LEASE_TRACE)}
            />
            {/* One dial per town: the same primitive, the same card and the
                same rent line as the lease section on a place page. */}
            <V3PlaceInventory
              id="lease"
              layout="dial"
              placeName="Central Oregon"
              sections={groups.map((group) => ({
                key: group.slug,
                heading: group.label,
                countLabel: group.countLabel,
                label: `Commercial space for lease in ${group.label}`,
                rows: group.rows,
              }))}
              source={LEASE_TRACE}
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
