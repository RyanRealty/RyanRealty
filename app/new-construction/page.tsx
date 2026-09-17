// @no-parity — factual 2026-09-16 snapshot. No Wave-3 mockup / taste class.
/**
 * /new-construction — Bend new-construction communities, list-price bands,
 * and published builder financing. Snapshot researched 2026-09-16 PT.
 *
 * VISUAL THESIS: compact Stage, then the affordable SFR shelf (Parkside →
 * Calaveras → Easton) on the installed shadcn carousel, then the rest of the
 * named communities, then financing as Answers. Not a search redirect.
 * /builders still 301s here.
 *
 * Rhythm: Breadcrumb-on-Stage -> Stage -> Lead shelf -> Ledger -> Answers
 * -> Doors -> Footer outside main. Snapshot figures live in
 * lib/site/bend-new-construction.ts. Live photos come from the listings DAL.
 */
import type { Metadata } from 'next'
import { getListingTiles } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_FINANCING_SOURCE,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_INVENTORY_SOURCE,
  BEND_NEW_CON_LEDE,
  BEND_NEW_CON_SEARCH_HREF,
  bendNewConLeadRows,
  BEND_NEW_CON_SINGLE,
  BEND_NEW_CON_UNSPECIFIED,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_KEYWORDS,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConCommunityHref,
  bendNewConRestPrimary,
  bendNewConSearchHref,
  bendNewConWeight,
  financingHighlight,
  flagLabel,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import {
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  V3Answers,
  V3Breadcrumb,
  V3Doors,
  V3Footer,
  V3Ledger,
  V3SectionTracker,
  v3Text,
  type V3Answer,
  type V3AnswersDoor,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { V3Stage } from '@/components/site/v3/V3Stage'
import { buildNewConLeadShelf } from './_v3/load-lead-shelf'
import { NewConLeadShelf } from './_v3/NewConLeadShelf.client'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: BEND_NEW_CONSTRUCTION_TITLE,
  description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
  path: BEND_NEW_CONSTRUCTION_PATH,
  keywords: BEND_NEW_CONSTRUCTION_KEYWORDS,
  ogType: 'article',
})

function inventoryRow(row: NewConInventoryRow): V3LedgerFigureRow {
  const builders = row.builders ?? 'Builder not in sampled details'
  const community = bendNewConCommunityHref(row.name)
  const revealBits = [
    row.median ? `Median list ${row.median}` : null,
    row.typical,
    community ? 'Opens the community page' : null,
  ].filter((bit): bit is string => Boolean(bit))

  return {
    href: community ?? bendNewConSearchHref(row.name),
    when: v3Text(builders),
    what: v3Text(row.name),
    detail: v3Text(row.typical ? `${row.priceBand} · ${row.typical}` : row.priceBand),
    value: v3Text(`${row.active} active`),
    weight: bendNewConWeight(row.active),
    reveal:
      revealBits.length > 0
        ? { line: v3Text(revealBits.join(' · ')) }
        : undefined,
  }
}

function financingAnswers(): V3Answer[] {
  return BEND_NEW_CON_FINANCING.map((offer, index) => {
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
      open: index === 0,
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
  const researched = formatDate(BEND_NEW_CONSTRUCTION_RESEARCH_DATE)
  const office = `${BRAND.address.street}, ${BRAND.address.city}`
  const restPrimary = bendNewConRestPrimary().map(inventoryRow)
  const [firstRest, ...moreRest] = restPrimary
  const [firstSingle, ...restSingle] = BEND_NEW_CON_SINGLE.map(inventoryRow)
  const leadRows = bendNewConLeadRows()
  const tilesByName = await Promise.all(
    leadRows.map((row) =>
      getListingTiles({
        city: 'Bend',
        subdivision: row.name,
        status: 'active',
        sort: 'price-asc',
        limit: 12,
      }).catch(() => []),
    ),
  )
  const lead = await buildNewConLeadShelf(leadRows, tilesByName)

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
        headline: BEND_NEW_CONSTRUCTION_TITLE,
        description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
        url: pageUrl,
        datePublished: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        dateModified: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
        author: { '@type': 'Organization', name: BRAND.name, url: site },
        publisher: { '@type': 'Organization', name: BRAND.name, url: site },
      },
    ],
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <V3SectionTracker />

        <div className="relative">
          <V3Stage
            id="new-construction"
            headingLevel={1}
            eyebrow="Bend proper · 2026-09-16"
            headline={BEND_NEW_CONSTRUCTION_TITLE}
            posterSrc={lead.posterSrc}
            overlayStrength="standard"
            height="compact"
            bandWhenCompact
            inventory={{
              figures: [
                {
                  value: String(BEND_NEW_CON_HEADLINE.active),
                  label: 'active new homes in Bend',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
                {
                  value: BEND_NEW_CON_HEADLINE.median,
                  label: 'median list that day',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
                {
                  value: `${BEND_NEW_CON_HEADLINE.priceLow}–${BEND_NEW_CON_HEADLINE.priceHigh}`,
                  label: 'list-price span',
                  href: BEND_NEW_CON_SEARCH_HREF,
                },
              ],
              source: BEND_NEW_CON_INVENTORY_SOURCE,
              sourceName: 'Ryan Realty listings',
              updatedAt: BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
            }}
            action={{
              label: 'See Bend new construction',
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
          />
          <div className="absolute inset-x-0 top-0 z-10 bg-navy">
            <V3Breadcrumb
              tone="on-media"
              belowNav={false}
              trail={[
                { label: 'Home', href: '/' },
                { label: 'Homes for sale', href: '/homes-for-sale' },
                { label: BEND_NEW_CONSTRUCTION_TITLE },
              ]}
            />
          </div>
        </div>

        <NewConLeadShelf
          heading={BEND_NEW_CON_LEDE}
          note="Not a loan offer. Bands are the 2026-09-16 pull. The houses on the shelf are live listings in those communities."
          bands={lead.bands}
          seeAllHref={BEND_NEW_CON_SEARCH_HREF}
        />

        {firstRest ? (
          <V3Ledger
            id="for-sale"
            eyebrow={v3Text('The rest of Bend')}
            heading={v3Text('Named communities')}
            note={v3Text(
              'Hover or focus a row for the median and the typical plan. Parkside, Calaveras, and Easton are on the shelf above.',
            )}
            rows={[firstRest, ...moreRest]}
            source={v3Text(BEND_NEW_CON_INVENTORY_SOURCE)}
            updated={v3Text(researched)}
            encode="bar"
            action={{
              label: v3Text('Open the live search'),
              href: BEND_NEW_CON_SEARCH_HREF,
            }}
            footnote={
              <>
                {BEND_NEW_CON_UNSPECIFIED.note} Band {BEND_NEW_CON_UNSPECIFIED.priceBand}, median{' '}
                {BEND_NEW_CON_UNSPECIFIED.median}. Caldera Springs is Sunriver. It is not in this
                Bend table.
              </>
            }
          />
        ) : null}

        {firstSingle ? (
          <V3Ledger
            id="also-listed"
            eyebrow={v3Text('Also listed')}
            heading={v3Text('One Active home')}
            rows={[firstSingle, ...restSingle]}
            source={v3Text(BEND_NEW_CON_INVENTORY_SOURCE)}
            updated={v3Text(researched)}
          />
        ) : null}

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

        <V3Doors
          id="tour"
          name={v3Text('Tour or ask')}
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
              kicker: v3Text('Schedule'),
              label: v3Text('Pick a time'),
              href: '/book',
            },
            {
              kicker: v3Text('Search'),
              label: v3Text('Bend new construction'),
              href: BEND_NEW_CON_SEARCH_HREF,
            },
          ]}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
