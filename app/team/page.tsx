/**
 * /team - broker roster, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (SITE-74, 2026-09-10): Breadcrumb, then a first-viewport
 * pair — AboutFaces editorial (H1 The brokers, principal at conversation
 * scale, companions as rows, one Call each) beside V3Atlas of every closing
 * the three of them have on the MLS. Footer.
 *
 * WHAT CHANGED AND WHY. The taste table of 2026-09-08 scored this page 39 and
 * named the whole route as its own dullest section: "three identical directory
 * cards — headshot, name, title pill, license line, and a row of four contact
 * buttons — with no bio, specialty, tenure, or sales fact to differentiate one
 * broker from another", and "at 1440x900 the entire page fits in one screen
 * with nothing below it worth scrolling to … no map of where they sell". Its
 * own two fixes were a sourced coverage fact per broker and a coverage map, so
 * that is what this page now carries. The figure comes off the MLS record
 * SITE-11 reads (app/team/_v3/broker-roster-record.ts), never off the
 * self-declared `brokers.specialties` tags, and a broker with nothing on the
 * record says nothing rather than printing a zero.
 *
 * THE PAGE CONTRACT: export const metadata through pageMetadata,
 * MetadataBlock JSON-LD (CollectionPage + aboutOrganization +
 * BreadcrumbList), V3SectionTracker pageType="team".
 *
 * D11: no virtue names. No invented quote.
 *
 * Parity: design_system/ryan-realty/ui_kits/team/parity.json
 */

import type { Metadata } from 'next'
import {
  getBrokers,
  getBrokerBySlug,
  getBrokerSales,
  getListingKeysForBrokerByLicense,
  getListingKeysByListAgentEmail,
  getListingTiles,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Atlas,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  type AtlasDot,
  type AtlasType,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { buildBrokerRecord } from '@/app/team/[slug]/_v3/broker-record'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { ATLAS_TYPES } from '@/lib/atlas/build-place-atlas'
import { formatDate } from '@/lib/format/date'
import { TEAM_RANK } from './_v3/team-constants'
import { brokerRosterRecord } from './_v3/broker-roster-record'
import './_v3/team-fold.css'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'Three licensed Oregon brokers who live and work in Central Oregon. Local experts, exceptional customer service, and the same broker with you from the first call through closing.',
  path: '/team',
  ogImage: '/images/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

/* The roster reads three brokers' MLS records. Every read underneath is
   cached for a day (getBrokerSales, getBrokers); this hour is the page's own
   floor so a fresh closing shows up the same day it records. */
export const revalidate = 3600

export default async function TeamPage() {
  const brokers = await getBrokers()

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const [regionAtlas, records] = await Promise.all([
    buildRegionAtlasRegions().catch(() => null),
    Promise.all(
      orderedBrokers.map(async (broker) => {
        const row = await getBrokerBySlug(broker.slug).catch(() => null)
        const sales = await getBrokerSales({
          email: broker.email,
          mlsId: (row as { mls_id?: string | null } | null)?.mls_id ?? null,
        }).catch(() => [])
        const closed = sales.filter((s) => !!s.CloseDate && s.ClosePrice != null && Number(s.ClosePrice) > 0)
        /* Live listings are the third rung of the ladder and are read ONLY
           when the closing set is empty — a broker with closings never pays
           for three extra queries to reach a figure the first rung already
           produced. */
        const actives = closed.length > 0 ? [] : await activeListingsFor(broker.slug, row, broker.email)
        return {
          slug: broker.slug,
          sales,
          record: brokerRosterRecord({ name: broker.fullName, sales, actives }),
        }
      }),
    ),
  ])

  const recordBySlug = new Map(records.map((r) => [r.slug, r]))

  const faces: AboutFace[] = orderedBrokers
    .map((b): AboutFace | null => {
      const face = aboutFaceFromBroker(b)
      if (!face) return null
      return { ...face, record: recordBySlug.get(b.slug)?.record ?? null }
    })
    .filter((face): face is AboutFace => face !== null)

  /* THE COVERAGE MAP. Every closing the three of them hold on the MLS, on one
     field — the same dot builder /team/[slug] uses for one broker, so the two
     surfaces cannot grow two ways of drawing a closing (TASTE.md consistency).
     A closing with no coordinate on the feed is not a dot and is not counted
     in the claim; the trace below says so. */
  const dotByKey = new Map<string, AtlasDot>()
  let closedWithCoords = 0
  let closedTotal = 0
  let newestClose: string | null = null
  for (const r of records) {
    const built = buildBrokerRecord(r.sales)
    closedTotal += built.closings.length
    closedWithCoords += built.dots.length
    for (const dot of built.dots) if (!dotByKey.has(dot.k)) dotByKey.set(dot.k, dot)
    const newest = built.closings[0]?.CloseDate ?? null
    if (newest && (!newestClose || newest > newestClose)) newestClose = newest
  }
  const dots = [...dotByKey.values()]
  const present = new Set(dots.map((d) => d.t))
  const atlasTypes: AtlasType[] = [
    ...ATLAS_TYPES.filter((t) => present.has(t.key)),
    ...[...present]
      .filter((k) => !ATLAS_TYPES.some((t) => t.key === k))
      .map((k) => ({ key: k, label: k === 'other' ? 'Other' : `${k[0]!.toUpperCase()}${k.slice(1)}` })),
  ]
  const atlasSource = v3Text(
    `Closed MLS sales through Oregon Data Share, every closing recorded for a Ryan Realty broker on either side of the deal (list side by list_agent_email, buy side by buyer_agent_mls_id): ${closedTotal} closings on record, ${dots.length} of them carrying a coordinate on the feed and drawn here. A closing the feed gives no latitude and longitude for is not a mark and is not counted in this map. Prices are the recorded ClosePrice.`,
  )
  const atlasStamp = newestClose ? v3Text(formatDate(newestClose.slice(0, 10))) : undefined

  const schemas: SchemaInput[] = [
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      aboutOrganization: true,
      name: 'The Ryan Realty Team',
      description:
        'The licensed Oregon brokers behind Ryan Realty in Bend, serving buyers and sellers across Central Oregon.',
      url: '/team',
    },
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Team', url: '/team' },
      ],
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Team' }]} />

        <div className="team-fold">
          <AboutFaces
            people={faces}
            heading="The brokers"
            size="editorial"
            claim="Three licensed Oregon brokers, all of them here. The one you call is the one who works your deal, start to close, and each of them shows what they have actually closed."
          />

          {dots.length > 0 ? (
            <V3Atlas
              id="closings"
              className="team-fold__atlas"
              headingLevel={2}
              headlineTone="eyebrow"
              keyPlacement="head"
              headline={v3Text('Where the brokers have closed')}
              claimText="Every closing a Ryan Realty broker recorded on the MLS that carries a coordinate. The 12-month counts on the faces are a trailing window of that same feed; this map is the full record."
              dots={dots}
              regions={regionAtlas?.regions ?? []}
              basemap={basemapForRegions(regionAtlas?.regions ?? [], { dots, fit: 'dots' })}
              types={atlasTypes}
              events={[]}
              source={atlasSource}
              stamp={atlasStamp}
              noun={{ one: 'closing', many: 'closings' }}
              fit="dots"
            />
          ) : null}
        </div>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

/**
 * A broker's live listings, matched the same two ways /team/[slug] matches
 * them: the Oregon licence number on the listing, and the list agent's email.
 * Only reached when the broker has no closing on the feed.
 */
async function activeListingsFor(
  slug: string,
  row: { license_number?: string | null } | null,
  email: string | null,
): Promise<{ city: string | null }[]> {
  const keys = new Set<string>()
  const license = (row?.license_number ?? '').trim()
  if (license) for (const k of await getListingKeysForBrokerByLicense(license).catch(() => [])) keys.add(k)
  if (email?.trim()) for (const k of await getListingKeysByListAgentEmail(email).catch(() => [])) keys.add(k)
  if (keys.size === 0) return []
  const tiles = await getListingTiles({
    listingKeys: [...keys].slice(0, 200),
    status: 'active',
    limit: 50,
  }).catch(() => [])
  void slug
  return tiles.map((t) => ({ city: t.city ?? null }))
}
