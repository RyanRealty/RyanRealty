// @no-parity — factual 2026-09-16 snapshot + live counts. No Wave-3 mockup / taste class.
/**
 * /new-construction — live Active Bend new-construction communities plus
 * published builder financing. Snapshot researched 2026-09-16 PT.
 *
 * SITE-152 (Matt 2026-09-21): the named SET is today’s Active Bend
 * new-construction SubdivisionName values, not a three-tab shelf with a note
 * that 38 more exist below. One V3Atlas of that market. Do not edit
 * V3Atlas.client.tsx (SITE-159). Do not reopen SITE-132 or SITE-151/152 coverage.
 *
 * SITE-142: 375 pin island pad + cluster stage, crumb/stats no mid-word clip,
 * no hover-only ledger reveal, builder/program doors in #tour.
 *
 * SITE-151: a home that shows a concession shows WHOSE and WHAT, sourced from
 * MLS PublicRemarks or the named builder page already in BEND_NEW_CON_FINANCING.
 * concessions_amount is unused (NULL on Active). Never listing_private.
 *
 * SITE-175: JSON-LD ItemList of photographed homes (canonical /homes-for-sale
 * listing URLs), not only community names. Reuses listingItemListFromHomes.
 *
 * Rhythm: Breadcrumb-on-Stage -> Stage -> Atlas -> live community ledger ->
 * photographed homes with per-home concessions -> contact -> builders ->
 * savings -> financing -> places -> FAQ -> Footer outside main.
 */
import type { Metadata } from 'next'
import { searchListingsAll } from '@/lib/data'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FAQ,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_FINANCING_SOURCE,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_HORTON_TOWNHOME_NOTE,
  BEND_NEW_CON_INVENTORY_SOURCE,
  BEND_NEW_CON_LIVE_SOURCE,
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_H1,
  BEND_NEW_CONSTRUCTION_KEYWORDS,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConLiveCoverageAnswer,
  bendNewConSubdivisionHrefs,
  bendNewConLivePriceSpanFold,
  bendNewConLiveWeight,
  bendNewConRowConcessionHeadline,
  bendNewConSeeHomesLabel,
  financingHighlight,
  flagLabel,
  type BendNewConLiveCommunity,
} from '@/lib/site/bend-new-construction'
import {
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  V3Answers,
  V3Atlas,
  V3Breadcrumb,
  V3Doors,
  V3Footer,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  v3Text,
  type V3Answer,
  type V3AnswersDoor,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { V3Stage } from '@/components/site/v3/V3Stage'
import { buildNewConMarketShelf } from './_v3/load-lead-shelf'
import { photographedNewConHomeJsonLd } from './_v3/photographed-home-item-list'
import { aeoHubQuietItems } from '@/lib/seo/aeo-hub-guides'
import { NewConLeadShelf } from './_v3/NewConLeadShelf.client'
import { NewConSavingsChips } from './_v3/NewConSavingsChips'
import { loadBendNewConLiveMarket } from './_v3/load-live-market'
import {
  NEW_CON_ATLAS_CLUSTER_CELL_PX,
  NEW_CON_ATLAS_CLUSTER_STAGE,
  NEW_CON_ATLAS_CLUSTER_STAGE_PHONE,
  loadNewConOverviewMap,
} from './_v3/load-overview-map'
import './_v3/new-con-page.css'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: BEND_NEW_CONSTRUCTION_TITLE,
  description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
  path: BEND_NEW_CONSTRUCTION_PATH,
  keywords: BEND_NEW_CONSTRUCTION_KEYWORDS,
  ogType: 'article',
})

function liveCommunityRow(
  row: BendNewConLiveCommunity,
  maxCount: number,
): V3LedgerFigureRow {
  const concessionHeadline = bendNewConRowConcessionHeadline(row.name)
  const types = row.propertySubTypes.length > 0 ? row.propertySubTypes.join(', ') : null
  const snapshot = row.snapshot

  return {
    href: row.href,
    when: v3Text(snapshot?.builders ?? types ?? 'Live Active now'),
    what: v3Text(row.name),
    detail: v3Text(
      [
        row.typical ? `${row.priceBand ?? 'Price on request'} · ${row.typical}` : row.priceBand,
        concessionHeadline ? `Concession: ${concessionHeadline}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    value: v3Text(bendNewConSeeHomesLabel(row.count)),
    weight: bendNewConLiveWeight(row.count, maxCount),
  }
}

function financingAnswers(): V3Answer[] {
  return BEND_NEW_CON_FINANCING.map((offer) => {
    const flags = flagLabel(offer.flags)
    const highlight = financingHighlight(offer)
    return {
      id: offer.id,
      question: flags ? `${offer.builder}: ${offer.title} · ${flags}` : `${offer.builder}: ${offer.title}`,
      figure: { value: highlight.value, label: highlight.label },
      body: offer.terms,
      source: BEND_NEW_CON_FINANCING_SOURCE,
      action: offer.sources[0]
        ? { label: offer.sources[0].label, href: offer.sources[0].href }
        : undefined,
    }
  })
}

function financingDoors(): V3AnswersDoor[] {
  return BEND_NEW_CON_FINANCING.flatMap((offer) =>
    offer.sources.map((source) => ({
      label: source.label,
      href: source.href,
      group: offer.builder,
    })),
  )
}

export default async function NewConstructionPage() {
  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}${BEND_NEW_CONSTRUCTION_PATH}`
  const office = `${BRAND.address.street}, ${BRAND.address.city}`
  if (typeof searchListingsAll !== 'function') {
    throw new Error('DAL searchListingsAll is required for the live new-construction set')
  }
  const market = await loadBendNewConLiveMarket()
  const [overview, lead] = await Promise.all([
    loadNewConOverviewMap(market),
    buildNewConMarketShelf(market),
  ])

  const maxCount = market.named.reduce((max, row) => Math.max(max, row.count), 0)
  const primary = market.named.filter((row) => row.count >= 2)
  const singles = market.named.filter((row) => row.count === 1)
  const primaryRows = primary.map((row) => liveCommunityRow(row, maxCount))
  const singleRows = singles.map((row) => liveCommunityRow(row, maxCount))
  const [firstPrimary, ...morePrimary] = primaryRows
  const [firstSingle, ...restSingle] = singleRows
  const priceSpanFold =
    bendNewConLivePriceSpanFold(market.priceMin, market.priceMax) ?? BEND_NEW_CON_HEADLINE.priceSpanFold
  const calderaCount = market.excluded.reduce((sum, row) => sum + row.count, 0)
  const faq = BEND_NEW_CON_FAQ.map((item) =>
    item.id === 'faq-coverage'
      ? {
          ...item,
          answer: bendNewConLiveCoverageAnswer({
            namedCount: market.namedCount,
            homeCount: market.homeCount,
            unspecifiedCount: market.unspecifiedCount,
            excludedCalderaCount: calderaCount,
          }),
        }
      : item,
  )

  // SITE-175: ItemList of the photographed homes on this page (canonical
  // /homes-for-sale listing URLs). The community name list stays beside it.
  const photographedHomesLd = photographedNewConHomeJsonLd(lead.cards)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Homes for sale', item: `${site}/homes-for-sale` },
          { '@type': 'ListItem', position: 3, name: BEND_NEW_CONSTRUCTION_TITLE, item: pageUrl },
        ],
      },
      {
        '@type': 'Article',
        headline: BEND_NEW_CONSTRUCTION_H1,
        description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
        url: pageUrl,
        datePublished: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        dateModified: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        author: { '@type': 'Organization', name: BRAND.name, url: site },
        publisher: { '@type': 'Organization', name: BRAND.name, url: site },
      },
      {
        '@type': 'ItemList',
        name: 'Live Active Bend new-construction communities',
        numberOfItems: market.named.length,
        itemListElement: market.named.map((row, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: row.name,
          url: `${site}${row.href}`,
        })),
      },
      ...(photographedHomesLd ? [photographedHomesLd] : []),
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  }

  return (
    <>
      <main className={`${V3_ROOT_CLASS} newcon-page`}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <V3SectionTracker />

        <div className="newcon-hero">
          <div className="newcon-hero__crumb">
            <V3Breadcrumb
              tone="on-media"
              belowNav={false}
              trail={[
                { label: 'Home', href: '/' },
                { label: 'Homes for sale', href: '/homes-for-sale' },
                { label: 'New construction' },
              ]}
            />
          </div>
          <V3Stage
            id="new-construction"
            headingLevel={1}
            eyebrow="Bend proper · live Active new construction"
            headline={BEND_NEW_CONSTRUCTION_H1}
            posterSrc={lead.posterSrc}
            overlayStrength="standard"
            height="compact"
            bandWhenCompact
            inventory={{
              figures: [
                {
                  value: String(market.listingsOk ? market.homeCount : BEND_NEW_CON_HEADLINE.active),
                  label: market.listingsOk ? 'live Active homes' : 'Active homes that day',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
                {
                  value: String(market.listingsOk ? market.namedCount : BEND_NEW_CON_HEADLINE.namedCommunities),
                  label: market.listingsOk ? 'named subdivisions' : 'named communities that day',
                  href: '#communities',
                },
                {
                  value: priceSpanFold,
                  label: market.listingsOk ? 'list-price span' : 'list-price span that day',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
              ],
              source: market.listingsOk ? BEND_NEW_CON_LIVE_SOURCE : BEND_NEW_CON_INVENTORY_SOURCE,
              sourceName: 'Ryan Realty listings',
              updatedAt: market.listingsOk ? market.stamp : BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
            }}
            action={{
              label: 'See Bend new construction',
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
          />
        </div>

        {overview.regions.length > 0 || overview.dots.length > 0 ? (
          <V3Atlas
            id="zones"
            headingLevel={2}
            headline={v3Text('New-construction zones on the map')}
            headlineTone="eyebrow"
            claimTone="inventory"
            claimText={
              overview.dots.length > 0
                ? `${overview.dots.length} live Active new-construction homes with a coordinate. ${overview.outlinedNamed} of ${overview.namedTotal} named communities have a recorded plat.`
                : `${overview.outlinedNamed} of ${overview.namedTotal} named communities have a recorded plat. Live homes without coordinates stay on the lists below.`
            }
            keyPlacement="head"
            sourceName="Oregon Data Share"
            dots={overview.dots}
            regions={overview.regions}
            types={overview.types}
            source={overview.source}
            stamp={overview.stamp}
            incomplete={overview.incomplete}
            outlinedOf={overview.namedTotal}
            basemap={overview.basemap}
            fit="regions"
            clusterPins
            clusterCellPx={NEW_CON_ATLAS_CLUSTER_CELL_PX}
            clusterStageHint={NEW_CON_ATLAS_CLUSTER_STAGE}
            clusterStageHintPhone={NEW_CON_ATLAS_CLUSTER_STAGE_PHONE}
          />
        ) : null}

        {firstPrimary ? (
          <V3Ledger
            id="communities"
            eyebrow={v3Text(`${market.namedCount} named, live Active search`)}
            heading={v3Text('Every live new-construction community')}
            note={v3Text(
              `${market.namedCount} named subdivisions in today’s Active Bend new-construction search. ${primary.length} have two or more live homes; ${singles.length} have one. Each row opens that subdivision’s live search. The live band and published concession sit on the row.`,
            )}
            rows={[firstPrimary, ...morePrimary]}
            source={v3Text(BEND_NEW_CON_LIVE_SOURCE)}
            updated={v3Text(market.stamp)}
            encode="bar"
            action={{
              label: v3Text('Open the live search'),
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
            footnote={
              <>
                {market.unspecifiedCount} Active {market.unspecifiedCount === 1 ? 'listing has' : 'listings have'} no
                usable subdivision name and {market.unspecifiedCount === 1 ? 'is' : 'are'} counted, not named as a
                community. {BEND_NEW_CON_HORTON_TOWNHOME_NOTE} Caldera Springs is Sunriver
                {calderaCount > 0 ? ` (${calderaCount} live ${calderaCount === 1 ? 'home' : 'homes'} in this pull)` : ''}.
                It is not in this Bend table.
              </>
            }
          />
        ) : null}

        {firstSingle ? (
          <V3Ledger
            id="also-listed"
            eyebrow={v3Text('Also listed')}
            heading={v3Text('One live home')}
            note={v3Text(
              `${singles.length} named ${singles.length === 1 ? 'subdivision has' : 'subdivisions have'} one Active new-construction home in today’s Bend search. Each row is a crawlable door into that search.`,
            )}
            rows={[firstSingle, ...restSingle]}
            source={v3Text(BEND_NEW_CON_LIVE_SOURCE)}
            updated={v3Text(market.stamp)}
          />
        ) : null}

        <NewConLeadShelf
          heading="Live photographed new homes"
          note={`${lead.cards.length} photographed homes from today’s Bend-proper Active new-construction search, lowest list price first. Each card keeps price, address, beds, baths, and sqft. A concession sits on the home when public remarks or that builder’s published page name one. Not a loan offer.`}
          cards={lead.cards}
          seeAllHref={BEND_NEW_CON_SEARCH_HREF}
        />

        <V3Doors
          id="tour"
          name={v3Text('Call, text, or open a builder page')}
          doors={[
            {
              kicker: v3Text('Call'),
              label: v3Text(CONTACT.phoneDirect),
              fact: v3Text(office),
              href: `tel:${CONTACT.phoneDirectTel}`,
              primary: true,
            },
            {
              kicker: v3Text('Text'),
              label: v3Text('Same number'),
              href: `sms:${CONTACT.phoneDirectTel}`,
            },
            {
              kicker: v3Text('Pahlisch'),
              label: v3Text('Golden Key'),
              fact: v3Text('Builder program'),
              href: BEND_NEW_CON_FINANCING[0]!.sources[0]!.href,
            },
            {
              kicker: v3Text('D.R. Horton'),
              label: v3Text('Stevens Ranch flyer'),
              fact: v3Text('Builder program'),
              href: BEND_NEW_CON_FINANCING[1]!.sources[0]!.href,
            },
          ]}
        />

        <V3Doors
          id="builders"
          name={v3Text('Published builder pages')}
          doors={[
            {
              kicker: v3Text('Lennar'),
              label: v3Text('Fall Super Sale'),
              href: BEND_NEW_CON_FINANCING[2]!.sources[0]!.href,
            },
            {
              kicker: v3Text('Hayden'),
              label: v3Text('$0 Down'),
              href: BEND_NEW_CON_FINANCING[4]!.sources[0]!.href,
            },
            {
              kicker: v3Text('Stone Bridge'),
              label: v3Text('Credit banner'),
              href: BEND_NEW_CON_FINANCING[6]!.sources[0]!.href,
            },
            {
              kicker: v3Text('Discovery West'),
              label: v3Text('Builder pages'),
              href: BEND_NEW_CON_FINANCING[7]!.sources[0]!.href,
            },
          ]}
        />

        <NewConSavingsChips />

        <V3Answers
          id="financing"
          eyebrow="Financing and concessions"
          heading="What builders published that day"
          note={`${BEND_NEW_CON_DISCLAIMER.title}. ${BEND_NEW_CON_DISCLAIMER.description.join(' ')} UNVERIFIED, STALE, NOT DISCLOSED, and CONFLICT sit on the offer they belong to. Horton’s community page and FlippingBook flyer are separate sources.`}
          questions={financingAnswers()}
          doors={financingDoors()}
          doorsLabel="Builder pages"
          sourceKey="bend-new-construction:financing:2026-09-16"
        />

        <V3Quiet
          id="places"
          eyebrow="Places and guides"
          heading="Keep going from here"
          items={[
            { kind: 'link', label: 'Bend', href: '/cities/bend', lead: true },
            { kind: 'link', label: 'Bend neighborhoods', href: '/neighborhoods' },
            { kind: 'link', label: 'Communities', href: '/communities' },
            { kind: 'link', label: 'Subdivisions', href: '/subdivisions' },
            ...bendNewConSubdivisionHrefs().map((plat) => ({
              kind: 'link' as const,
              label: plat.name,
              href: plat.href,
            })),
            { kind: 'link', label: 'Homes for sale', href: '/homes-for-sale/bend' },
            { kind: 'link', label: 'Market stories', href: '/blog' },
            ...aeoHubQuietItems('buy').slice(0, 4),
          ]}
          note="Place pages and buyer guides sit here, not only in the footer."
        />

        <V3Answers
          id="faq"
          eyebrow="Questions"
          heading="New homes in Bend: short answers"
          questions={faq.map((item, i) => ({
            id: item.id,
            question: item.question,
            body: item.answer,
            open: i === 0,
            source: item.id === 'faq-coverage' ? BEND_NEW_CON_LIVE_SOURCE : BEND_NEW_CON_INVENTORY_SOURCE,
          }))}
          sourceKey="bend-new-construction:faq:2026-09-16"
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
