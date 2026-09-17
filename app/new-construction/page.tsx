// @no-parity — factual 2026-09-16 snapshot. No Wave-3 mockup / taste class.
// @data-free
/**
 * /new-construction — Bend new-construction communities, list-price bands,
 * and published builder financing. Snapshot researched 2026-09-16 PT.
 *
 * VISUAL THESIS: a Redfin-like inventory list, then the concession legal
 * copy with flags, then Call / Text / Schedule. Not a search redirect.
 * /builders still 301s here.
 *
 * Rhythm: Breadcrumb -> Instrument -> Ledger -> Ledger -> Quiet -> Doors
 * -> Footer outside main. Copy and figures live in
 * lib/site/bend-new-construction.ts. Do not invent MOS, rates, or prices here.
 */
import type { Metadata } from 'next'
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
  BEND_NEW_CON_PRIMARY,
  BEND_NEW_CON_SEARCH_HREF,
  BEND_NEW_CON_SINGLE,
  BEND_NEW_CON_UNSPECIFIED,
  BEND_NEW_CONSTRUCTION_DESCRIPTION,
  BEND_NEW_CONSTRUCTION_KEYWORDS,
  BEND_NEW_CONSTRUCTION_PATH,
  BEND_NEW_CONSTRUCTION_RESEARCH_DATE,
  BEND_NEW_CONSTRUCTION_TITLE,
  bendNewConCommunityHref,
  bendNewConSearchHref,
  bendNewConWeight,
  flagLabel,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import {
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Doors,
  V3Footer,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  v3Text,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'

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

function financingItems(): V3QuietItem[] {
  const items: V3QuietItem[] = []
  for (const offer of BEND_NEW_CON_FINANCING) {
    const flags = flagLabel(offer.flags)
    items.push({
      kind: 'prose',
      id: offer.id,
      term: flags ? `${offer.builder} — ${offer.title} · ${flags}` : `${offer.builder} — ${offer.title}`,
      body: offer.terms,
    })
    for (const source of offer.sources) {
      items.push({
        kind: 'link',
        label: source.label,
        href: source.href,
        mark: 'external',
        detail: offer.builder,
      })
    }
  }
  return items
}

export default function NewConstructionPage() {
  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}${BEND_NEW_CONSTRUCTION_PATH}`
  const researched = formatDate(BEND_NEW_CONSTRUCTION_RESEARCH_DATE)
  const office = `${BRAND.address.street}, ${BRAND.address.city}`
  const [firstPrimary, ...restPrimary] = BEND_NEW_CON_PRIMARY.map(inventoryRow)
  const [firstSingle, ...restSingle] = BEND_NEW_CON_SINGLE.map(inventoryRow)

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

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: '/homes-for-sale' },
            { label: BEND_NEW_CONSTRUCTION_TITLE },
          ]}
        />

        <V3Instrument
          id="new-construction"
          level={1}
          eyebrow={v3Text('Bend proper · researched 2026-09-16 PT')}
          headline={v3Text(BEND_NEW_CONSTRUCTION_TITLE)}
          note={v3Text(
            'Not a loan offer. Published terms change. Verify with onsite sales and the lender on the purchase agreement.',
          )}
          figures={[
            {
              value: v3Text(String(BEND_NEW_CON_HEADLINE.active)),
              label: v3Text('Active new construction'),
              href: BEND_NEW_CON_SEARCH_HREF,
              sentence: v3Text('Bend city, Active only, new-construction flag on.'),
            },
            {
              value: v3Text(`${BEND_NEW_CON_HEADLINE.priceLow}–${BEND_NEW_CON_HEADLINE.priceHigh}`),
              label: v3Text('List-price span'),
              href: BEND_NEW_CON_SEARCH_HREF,
              sentence: v3Text('Valid list prices in that pull. One $1.32 row was dropped.'),
            },
            {
              value: v3Text(BEND_NEW_CON_HEADLINE.median),
              label: v3Text('Median list'),
              href: BEND_NEW_CON_SEARCH_HREF,
              sentence: v3Text('Median of the valid list prices, same pull.'),
            },
          ]}
          source={v3Text(BEND_NEW_CON_INVENTORY_SOURCE)}
          updated={v3Text(researched)}
          sourceName={v3Text('Ryan Realty listings')}
          action={{
            label: v3Text('See Bend new construction'),
            href: BEND_NEW_CON_SEARCH_HREF,
          }}
        />

        {firstPrimary ? (
          <V3Ledger
            id="for-sale"
            eyebrow={v3Text('What’s for sale')}
            heading={v3Text('Named communities in Bend')}
            note={v3Text(
              'Active count and list-price band from the 2026-09-16 pull. Hover or focus a row for the median and the typical plan range.',
            )}
            rows={[firstPrimary, ...restPrimary]}
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

        <V3Quiet
          id="financing"
          eyebrow="Financing and concessions"
          heading="What builders published that day"
          alert={{
            title: BEND_NEW_CON_DISCLAIMER.title,
            description: BEND_NEW_CON_DISCLAIMER.description,
            action: { label: 'Call the office', href: `tel:${CONTACT.phoneDirectTel}` },
          }}
          items={financingItems()}
          source={BEND_NEW_CON_FINANCING_SOURCE}
          note="UNVERIFIED, STALE, NOT DISCLOSED, and CONFLICT are printed on the offer they belong to. Horton’s community page and FlippingBook flyer are separate sources."
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
