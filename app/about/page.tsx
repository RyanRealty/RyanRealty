/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * About destinations open on Quiet + Sheet. This page opens on Quiet (who we
 * are) then Instrument (verified licenses) then Ledger (service area) then
 * Quiet (FAQ and edges). The family's Sheet lives on /contact and /team/[slug],
 * where the capture forms already were. A new on-page form here would be a new
 * capture contract. The ask on this page is the valuation door, with ?from=/about.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata, MetadataBlock JSON-LD (AboutPage + aboutOrganization +
 * BreadcrumbList + FAQPage), a rendered KbSectionTracker with pageType="about",
 * revalidate 3600, and the route. MetadataBlock and KbSectionTracker stay on
 * the non-v3 register deliberately: both are wiring, neither is visual language,
 * and the barrel ships no equivalent.
 *
 * D11: the mission sentence is the one virtue-word exception, exact words, We.
 * No invented quote. MLS remarks N/A.
 *
 * DATES RENDER IN PACIFIC, a change from the KB page, stated rather than absorbed.
 * The KB articles rail (now deleted) formatted with timeZone UTC. formatDate is
 * pinned to America/Los_Angeles. The city Ledger stamp uses formatDate.
 *
 * Parity: design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers, getMarketPulseCitySnapshots } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatDate } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import { listingsBrowsePath, teamPath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { BRAND, BROKERS } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import {
  ABOUT_CITY_LABELS,
  ABOUT_CITY_SLUG,
  ABOUT_FAQ_ITEMS,
  ABOUT_MISSION,
  FIRM_LICENSE,
} from './_v3/about-constants'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'

const ROUTE_PATH = '/about'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'About Ryan Realty · Bend, Oregon',
    description:
      'Ryan Realty is a Bend, Oregon brokerage, open since June 2023. Every listing gets video, a 3D walkthrough, and a price built from closed comps. The broker you call closes your sale.',
    path: ROUTE_PATH,
    ogImage: '/images/office/ryan-realty-bend-office-interior-01.jpg',
    keywords: [
      'Ryan Realty',
      'Bend Oregon real estate',
      'Central Oregon brokerage',
      'Matt Ryan broker',
    ],
  })
}

export const revalidate = 3600

export default async function AboutPage() {
  const [citySnapshots, brokers] = await Promise.all([
    getMarketPulseCitySnapshots([...ABOUT_CITY_LABELS]),
    getBrokers(),
  ])

  const snapshotByLabel = new Map(citySnapshots.map((s) => [s.geo_label, s]))
  const cityRows: V3LedgerFigureRow[] = []
  const rowed = new Set<string>()
  for (const label of ABOUT_CITY_LABELS) {
    const slug = ABOUT_CITY_SLUG[label]
    const snapshot = snapshotByLabel.get(label)
    if (!slug || !snapshot || snapshot.median_list_price == null) continue
    rowed.add(label)
    const price = formatPrice(snapshot.median_list_price)
    if (price === '\u2014') continue
    cityRows.push({
      href: `/cities/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      value: v3Text(price),
      id: slug,
    })
  }
  const [firstCityRow, ...restCityRows] = cityRows

  const cityFootnotes = ABOUT_CITY_LABELS.filter((label) => !rowed.has(label)).map((label) => {
    const snapshot = snapshotByLabel.get(label)
    if (!snapshot) return { label, fact: `${label} returned no market row in the latest sync` }
    if (snapshot.active_count === 0) {
      return { label, fact: `${label} shows no active single-family listings` }
    }
    return {
      label,
      fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median`,
    }
  })

  const cityRefreshedAt = citySnapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)
  const cityStamp = cityRefreshedAt ? formatDate(cityRefreshedAt) : ''
  const cityUpdated = cityStamp && cityStamp !== '\u2014' ? v3Text(cityStamp) : undefined

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const originItems: V3QuietItem[] = [
    { kind: 'prose', body: ABOUT_MISSION },
    {
      kind: 'prose',
      term: 'How it started',
      body: [
        `Matt Ryan opened Ryan Realty in Bend in ${BRAND.foundedLabel}, after years in the fire service. He learned the business from Hjalmar "Red" Erickson.`,
        'When the comps do not support the price you want, we say so before you sign anything. Every listing gets a video, a 3D walkthrough, and its own page here.',
        'The broker you first speak to is the broker who works your purchase or sale through to close. No hand-off.',
      ],
    },
    { label: 'Broker profiles', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Call, text, or write', href: '/contact' },
  ]

  const licenseFigures: V3InstrumentFigure[] = [
    { value: v3Text(BRAND.foundedLabel), label: v3Text('founded') },
    { value: v3Text(FIRM_LICENSE), label: v3Text('firm license') },
    {
      value: v3Text(`OR #${BROKERS.matt.license}`),
      label: v3Text('principal broker'),
      href: teamPath(BROKERS.matt.slug),
    },
  ]
  const [firstLicense, ...restLicense] = licenseFigures

  const faqItems: V3QuietItem[] = [
    ...ABOUT_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Broker profiles', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Call, text, or write', href: '/contact' },
    { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
    { label: 'Homes for sale', href: listingsBrowsePath() },
    { label: 'Central Oregon housing market', href: '/housing-market' },
  ]
  for (const city of cityFootnotes) {
    faqItems.push({
      kind: 'prose',
      term: `${city.label} inventory`,
      body: city.fact,
    })
    faqItems.push({
      label: `${city.label} homes`,
      href: `/cities/${ABOUT_CITY_SLUG[city.label]}`,
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'webPage',
      pageType: 'AboutPage',
      aboutOrganization: true,
      name: 'About Ryan Realty',
      description:
        'Ryan Realty is based in Bend, Oregon. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding Central Oregon communities.',
      url: '/about',
    },
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'About', url: '/about' },
      ],
    },
    {
      type: 'faqPage',
      items: [...ABOUT_FAQ_ITEMS],
    },
  ]

  const brokerDoors: V3QuietItem[] = orderedBrokers.flatMap((b) => {
    const name = b.fullName?.trim()
    const slug = b.slug?.trim()
    if (!name || !slug) return []
    const title = b.title?.trim()
    return [{ label: title ? `${name}, ${title}` : name, href: teamPath(slug) }]
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="about" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <V3Quiet
          id="about"
          eyebrow="Ryan Realty · Bend, Oregon"
          heading="About Ryan Realty"
          headingLevel={1}
          items={originItems}
        />

        {firstLicense ? (
          <V3Instrument
            id="record"
            level={2}
            eyebrow={v3Text('Verified record')}
            headline={v3Text('Open since June 2023')}
            figures={[firstLicense, ...restLicense]}
            source={v3Text(
              'Oregon Real Estate Agency. Ryan Realty LLC firm license and the principal broker license on file.',
            )}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(ROUTE_PATH),
              variant: 'primary',
            }}
          />
        ) : null}

        {firstCityRow ? (
          <V3Ledger
            id="service-area"
            eyebrow={v3Text('Service area')}
            heading={v3Text('Where we work')}
            note={v3Text(
              'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live single-family list prices.',
            )}
            rows={[firstCityRow, ...restCityRows]}
            source={v3Text(
              'live MLS through Oregon Data Share, single-family homes, city rows from market_pulse_live',
            )}
            updated={cityUpdated}
            action={{
              label: v3Text('Search homes across Central Oregon'),
              href: listingsBrowsePath(),
            }}
          />
        ) : (
          <V3Ledger
            id="service-area"
            eyebrow={v3Text('Service area')}
            heading={v3Text('Where we work')}
            rows={[]}
            emptyMessage={v3Text('City inventory did not return in this refresh.')}
            action={{
              label: v3Text('Search homes across Central Oregon'),
              href: listingsBrowsePath(),
            }}
          />
        )}

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading="Working with Ryan Realty"
          items={[
            ...faqItems,
            ...(brokerDoors.length > 0
              ? [{ kind: 'prose' as const, term: 'Who you work with', body: 'Matt Ryan, Paul Stevenson, Rebecca Peterson.' }, ...brokerDoors]
              : []),
          ]}
        />
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
