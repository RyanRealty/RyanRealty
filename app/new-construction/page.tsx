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
 * Rhythm: Breadcrumb-on-Stage -> Stage -> SFR shelf -> SFR ledger ->
 * Horton townhome note -> Answers
 * -> Doors -> Footer outside main. Snapshot figures live in
 * lib/site/bend-new-construction.ts. Live photos come from the listings DAL.
 */
import type { Metadata } from 'next'
import { searchListingsAllCount } from '@/lib/data'
import { formatDate } from '@/lib/format/date'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  BEND_NEW_CON_BROOKSMILL_NOTE,
  BEND_NEW_CON_DISCLAIMER,
  BEND_NEW_CON_FINANCING,
  BEND_NEW_CON_FINANCING_SOURCE,
  BEND_NEW_CON_HEADLINE,
  BEND_NEW_CON_HORTON_TOWNHOME_NOTE,
  BEND_NEW_CON_HORTON_TOWNHOME_SOURCE,
  BEND_NEW_CON_INVENTORY_SOURCE,
  BEND_NEW_CON_LEDE,
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CON_STEVENS_RANCH_SF,
  BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES,
  bendNewConHortonTownhomeRows,
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
  bendNewConSeeHomesLabel,
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
import {
  loadBendNewConLiveMatch,
  loadLeadShelfTiles,
  loadStevensRanchSfMatch,
  loadStevensRanchTownhomeMatch,
  type BendNewConLiveMatch,
} from './_v3/load-live-matches'
import { NewConLeadShelf } from './_v3/NewConLeadShelf.client'
import './_v3/new-con-page.css'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: BEND_NEW_CONSTRUCTION_TITLE,
  description: BEND_NEW_CONSTRUCTION_DESCRIPTION,
  path: BEND_NEW_CONSTRUCTION_PATH,
  keywords: BEND_NEW_CONSTRUCTION_KEYWORDS,
  ogType: 'article',
})

function inventoryRow(row: NewConInventoryRow, live: BendNewConLiveMatch): V3LedgerFigureRow {
  const builders = row.builders ?? 'Builder not in sampled details'
  const community = bendNewConCommunityHref(row.name)
  const stevensSf = row.name === 'Stevens Ranch'
  const priceBand = stevensSf ? BEND_NEW_CON_STEVENS_RANCH_SF.priceBand : row.priceBand
  const liveLine =
    live.count != null
      ? `${live.count} live Active new-construction ${live.count === 1 ? 'home matches' : 'homes match'} this search`
      : 'Opens the live new-construction search for this subdivision only'
  const revealBits = [
    liveLine,
    `${row.active} Active on 2026-09-16`,
    stevensSf
      ? `${BEND_NEW_CON_STEVENS_RANCH_SF.source} Horton SF QMI about ${BEND_NEW_CON_STEVENS_RANCH_SF.qmi}. DAL mixed band ${BEND_NEW_CON_STEVENS_RANCH_SF.dalMixedBand}. This door is Single Family Residence only.`
      : null,
    row.median && !stevensSf ? `Median list ${row.median}` : null,
    row.typical,
    community ? `Community page also at ${community}` : null,
  ].filter((bit): bit is string => Boolean(bit))

  return {
    href: live.href,
    when: v3Text(builders),
    what: v3Text(row.name),
    detail: v3Text(row.typical ? `${priceBand} · ${row.typical}` : priceBand),
    value: v3Text(bendNewConSeeHomesLabel(live.count)),
    weight: live.count != null && live.count > 0 ? bendNewConWeight(live.count) : bendNewConWeight(row.active),
    reveal: { line: v3Text(revealBits.join(' · ')) },
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
  void searchListingsAllCount
  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}${BEND_NEW_CONSTRUCTION_PATH}`
  const researched = formatDate(BEND_NEW_CONSTRUCTION_RESEARCH_DATE)
  const office = `${BRAND.address.street}, ${BRAND.address.city}`
  const restRows = bendNewConRestPrimary()
  const singleRows = BEND_NEW_CON_SINGLE
  const hortonTownhomeRows = bendNewConHortonTownhomeRows()
  const leadRows = bendNewConLeadRows()
  const [
    leadMatches,
    restMatches,
    singleMatches,
    hortonMatches,
    stevensTownhomeMatch,
    tilesByName,
  ] = await Promise.all([
    Promise.all(leadRows.map((row) => loadBendNewConLiveMatch(row.name))),
    Promise.all(
      restRows.map((row) =>
        row.name === 'Stevens Ranch'
          ? loadStevensRanchSfMatch()
          : loadBendNewConLiveMatch(row.name),
      ),
    ),
    Promise.all(singleRows.map((row) => loadBendNewConLiveMatch(row.name))),
    Promise.all(hortonTownhomeRows.map((row) => loadBendNewConLiveMatch(row.name))),
    loadStevensRanchTownhomeMatch(),
    Promise.all(leadRows.map((row) => loadLeadShelfTiles(row))),
  ])
  const restPrimary = restRows.map((row, i) => inventoryRow(row, restMatches[i]!))
  const [firstRest, ...moreRest] = restPrimary
  const [firstSingle, ...restSingle] = singleRows.map((row, i) =>
    inventoryRow(row, singleMatches[i]!),
  )
  const hortonTownhomes = hortonTownhomeRows.map((row, i) => inventoryRow(row, hortonMatches[i]!))
  const [firstHortonTownhome, ...moreHortonTownhomes] = hortonTownhomes
  const lead = await buildNewConLeadShelf(leadRows, tilesByName, leadMatches)

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

        <div className="newcon-hero">
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
          <div className="newcon-hero__crumb absolute inset-x-0 top-0 z-10 bg-navy">
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
          note="Not a loan offer. Single-family first. Bands from 2026-09-16. Houses on the shelf are live SFR listings. See homes opens every Active new-construction home in that subdivision."
          bands={lead.bands}
          seeAllHref={BEND_NEW_CON_SEARCH_HREF}
        />

        {firstRest ? (
          <V3Ledger
            id="for-sale"
            eyebrow={v3Text('Lowest SFR band first')}
            heading={v3Text('Single-family communities')}
            note={v3Text(
              'Parkside, Calaveras, and Easton are on the shelf. Next are Petrosa, Acadia Pointe, then Horton Stevens Ranch single-family from $579,995. Each row opens that subdivision’s live new-construction search. Hover a row for the snapshot band.',
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
                {BEND_NEW_CON_UNSPECIFIED.median}. {BEND_NEW_CON_BROOKSMILL_NOTE} Caldera Springs is
                Sunriver. It is not in this Bend table.
              </>
            }
          />
        ) : null}

        {firstHortonTownhome ? (
          <V3Ledger
            id="horton-townhomes"
            eyebrow={v3Text('Also listed')}
            heading={v3Text('Horton townhomes')}
            note={v3Text(BEND_NEW_CON_HORTON_TOWNHOME_NOTE)}
            rows={[
              firstHortonTownhome,
              ...moreHortonTownhomes,
              {
                href: stevensTownhomeMatch.href,
                when: v3Text(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.builders),
                what: v3Text(BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.name),
                detail: v3Text(
                  `${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.priceBand} · Horton Express QMI about ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.qmi}.`,
                ),
                value: v3Text(bendNewConSeeHomesLabel(stevensTownhomeMatch.count)),
                weight:
                  stevensTownhomeMatch.count != null && stevensTownhomeMatch.count > 0
                    ? bendNewConWeight(stevensTownhomeMatch.count)
                    : 0.25,
                reveal: {
                  line: v3Text(
                    `${
                      stevensTownhomeMatch.count != null
                        ? `${stevensTownhomeMatch.count} live Townhouse new-construction homes match this Stevens Ranch search`
                        : 'Opens live Townhouse new-construction search for Stevens Ranch'
                    } · ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.priceBand} on the Horton Express page, 2026-09-16 · ${BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.builderHref}`,
                  ),
                },
              },
            ]}
            source={v3Text(BEND_NEW_CON_HORTON_TOWNHOME_SOURCE)}
            updated={v3Text(researched)}
            encode="bar"
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
