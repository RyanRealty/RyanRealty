// @data-free
/**
 * /how-we-get-our-numbers — the public dictionary for market figures.
 *
 * VISUAL THESIS: a bound dictionary you land in from a question mark beside a
 * live figure. Cream field, navy display, the membership rule as the opening
 * answer, then every public market label as a term with a hash id. Not a
 * second live months-of-supply dashboard.
 *
 * Rhythm (three of six, no two adjacent alike): Breadcrumb -> Instrument
 * (the pile) -> Quiet (the dictionary and questions) -> Ledger (doors) ->
 * Footer outside main.
 *
 * No live figures. Copy lives in lib/market/how-we-get-our-numbers.ts.
 * MOS formula and thresholds are imported there, never retyped here.
 * JSON-LD is hand-emitted so this new page stays on the v3 barrel only
 * (MetadataBlock is the legacy register).
 */
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  HOW_NUMBER_ENTRIES,
  HOW_NUMBER_FAQS,
  HOW_NUMBER_METADATA_DESCRIPTION,
  HOW_NUMBER_METADATA_KEYWORDS,
  HOW_NUMBER_RELATED,
  HOW_WE_GET_OUR_NUMBERS_PATH,
} from '@/lib/market/how-we-get-our-numbers'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { HowNumberHashScroll } from './_v3/HowNumberHashScroll.client'

export const revalidate = 86400

export const metadata: Metadata = pageMetadata({
  title: 'How we get our numbers',
  description: HOW_NUMBER_METADATA_DESCRIPTION,
  path: HOW_WE_GET_OUR_NUMBERS_PATH,
  keywords: HOW_NUMBER_METADATA_KEYWORDS,
})

export default function HowWeGetOurNumbersPage() {
  const site = getCanonicalSiteUrl()
  const pageUrl = `${site}${HOW_WE_GET_OUR_NUMBERS_PATH}`

  const dictionaryItems: V3QuietItem[] = [
    ...HOW_NUMBER_ENTRIES.map((entry) => ({
      kind: 'prose' as const,
      id: entry.id,
      term: entry.term,
      body: entry.body,
    })),
    ...HOW_NUMBER_FAQS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
  ]

  const [firstDoor, ...restDoors] = HOW_NUMBER_RELATED.map(
    (link): V3LedgerPlainRow => ({
      href: link.href,
      when: v3Text('Market'),
      what: v3Text(link.label),
    }),
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Housing market',
            item: `${site}/housing-market`,
          },
        ],
      },
      {
        '@type': 'Article',
        headline: 'How we get our numbers',
        description: HOW_NUMBER_METADATA_DESCRIPTION,
        url: pageUrl,
      },
      {
        '@type': 'FAQPage',
        mainEntity: HOW_NUMBER_FAQS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'DefinedTermSet',
        name: 'Ryan Realty market figures',
        url: pageUrl,
        hasDefinedTerm: HOW_NUMBER_ENTRIES.map((entry) => ({
          '@type': 'DefinedTerm',
          name: entry.term,
          description: entry.body.join(' '),
          url: `${pageUrl}#${entry.id}`,
        })),
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
        <HowNumberHashScroll />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'How we get our numbers' },
          ]}
        />

        <V3Instrument
          id="how-we-get-our-numbers"
          level={1}
          eyebrow={v3Text('Market dictionary')}
          headline={v3Text('How we get our numbers')}
          figures={[
            { value: v3Text('Houses'), label: v3Text('single-family only') },
            { value: v3Text('Once'), label: v3Text('each home in one place') },
            { value: v3Text('Window'), label: v3Text('the one on the tile') },
          ]}
          source={v3Text(
            'Oregon Data Share listings in Central Oregon. Single-family houses, counted once per place type by the place we mapped as home. Closed sales have a close date and a close price of $1,000 or more.',
          )}
          action={{
            label: v3Text('Central Oregon market report'),
            href: '/housing-market/central-oregon',
            variant: 'primary',
          }}
        />

        <V3Quiet
          id="dictionary"
          eyebrow="Dictionary"
          heading="What each figure means"
          items={dictionaryItems}
          note="On the HUD KPI row, a missing leftover cell is omitted. We do not invent a zero."
        />

        {firstDoor ? (
          <V3Ledger
            id="see-the-numbers"
            eyebrow={v3Text('On the site')}
            heading={v3Text('Where these numbers appear')}
            rows={[firstDoor, ...restDoors]}
          />
        ) : null}
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
