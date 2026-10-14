// @no-parity
/**
 * /buy/homes-under-500k-central-oregon — regional under-$500K comparison.
 *
 * Live Active PropertyType-A counts by town from getUnder500kCityInventory
 * (listing_search_mv). SFR medians are Query B, never pulse median_list_price
 * (that Bend cell has printed $745K). Sisters and Sunriver are footnote rows.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0 / §3: inventory count, residential only.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, v3 barrel. Order:
 * Breadcrumb, answer, table, ask, Questions, Sources, Quiet, Footer.
 */
import { cache, type ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDetachedOverlays, getUnder500kCityInventory } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { UNDER_500K_TOWNS } from '@/lib/data/listings/under-500k-classify'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import EqualHousing from '@/components/legal/EqualHousing'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Eyebrow,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
  MetadataBlock,
} from '@/components/site/v3'
import { LINKS, MLS_SOURCE, ROUTE_PATH } from './_v3/constants'
import { nextItems, under500kCopy } from './_v3/copy'
import { buildUnder500kSnapshot } from './_v3/data'
import { Under500kSignup } from './_v3/Signup.client'
import { Under500kTable } from './_v3/Table.client'
import './_v3/under-500k.css'

export const revalidate = 3600

const OVERLAY_KEYS = UNDER_500K_TOWNS.map((town) => ({
  geoType: 'city' as const,
  geoSlug: town.slug,
}))

function overlayKey(slug: string): string {
  return `city:${slug}`
}

const FAQ_LINKS: Array<{ phrase: string; href: string; external?: boolean }> = [
  { phrase: 'Housing Works', href: LINKS.housingWorks, external: true },
  { phrase: 'Oregon Housing and Community Services', href: LINKS.ohcs, external: true },
  { phrase: 'Bend under $400K', href: '/homes-for-sale/bend/under-400k' },
  { phrase: 'Bend under $300K', href: '/homes-for-sale/bend/under-300k' },
  { phrase: 'Ask about price cuts and seller credits on homes that have sat.', href: LINKS.priceDrops },
]

function linkFaqAnswer(text: string) {
  const parts: Array<string | ReactNode> = [text]
  for (const link of FAQ_LINKS) {
    const next: Array<string | ReactNode> = []
    for (const part of parts) {
      if (typeof part !== 'string') {
        next.push(part)
        continue
      }
      const idx = part.indexOf(link.phrase)
      if (idx < 0) {
        next.push(part)
        continue
      }
      if (idx > 0) next.push(part.slice(0, idx))
      if (link.external) {
        next.push(
          <a key={link.href} href={link.href} rel="noopener noreferrer">
            {link.phrase}
          </a>,
        )
      } else {
        next.push(
          <Link key={link.href} href={link.href}>
            {link.phrase}
          </Link>,
        )
      }
      if (idx + link.phrase.length < part.length) next.push(part.slice(idx + link.phrase.length))
    }
    parts.splice(0, parts.length, ...next)
  }
  return parts
}

const loadSnapshot = cache(async () => {
  const [inventory, overlays, ...paceRows] = await Promise.all([
    getUnder500kCityInventory(),
    getDetachedOverlays(OVERLAY_KEYS).catch(() => new Map()),
    ...OVERLAY_KEYS.map((key) =>
      getPublicDetachedPace({ geoType: key.geoType, geoSlug: key.geoSlug }).catch(() => ({
        ...EMPTY_PUBLIC_PACE,
      })),
    ),
  ])
  const paces = new Map<string, PublicPaceRow>()
  OVERLAY_KEYS.forEach((key, i) => {
    paces.set(overlayKey(key.geoSlug), paceRows[i] ?? { ...EMPTY_PUBLIC_PACE })
  })
  return buildUnder500kSnapshot({ inventory, overlays, paces })
})

export async function generateMetadata(): Promise<Metadata> {
  const snap = await loadSnapshot()
  const copy = under500kCopy(snap)
  return pageMetadata({
    title: copy.title,
    description: copy.metaDescription,
    path: ROUTE_PATH,
    keywords: [
      'homes under 500k Central Oregon',
      'homes under 500k Bend Oregon',
      'affordable homes for sale Central Oregon',
    ],
  })
}

export default async function HomesUnder500kCentralOregonPage() {
  const snap = await loadSnapshot()
  const copy = under500kCopy(snap)
  const dateModified = snap.published && snap.asOfIso ? snap.asOfIso : undefined
  const itemListTowns = snap.published ? snap.headlineTowns.filter((t) => t.residential > 0) : []

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: LINKS.homes },
        { name: 'Homes under $500K in Central Oregon', url: ROUTE_PATH },
      ],
    },
    {
      type: 'webPage',
      name: copy.h1,
      description: copy.metaDescription,
      url: ROUTE_PATH,
      pageType: 'CollectionPage',
      dateModified,
      aboutPlace: 'Central Oregon',
    },
    {
      type: 'faqPage',
      items: copy.faqs.map(({ question, answer }) => ({ question, answer })),
      dateModified,
    },
  ]
  if (itemListTowns.length > 0) {
    schemas.push({
      type: 'itemList',
      name: 'Homes under $500K by town',
      items: itemListTowns.map((town) => ({
        name: `${town.name} homes under $500K`,
        url: town.listingsHref,
      })),
    })
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: LINKS.homes },
            { label: 'Homes under $500K in Central Oregon' },
          ]}
        />

        <section id="answer" className="v3-net-section v3-net-section--lead" aria-labelledby="under500-heading">
          <V3Eyebrow>{copy.eyebrow}</V3Eyebrow>
          <V3Heading level={1} id="under500-heading">
            {copy.h1}
          </V3Heading>
          {copy.answer.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="v3-net-answer">
              {paragraph}
            </p>
          ))}
          {copy.leverageLine ? <p className="v3-net-answer">{copy.leverageLine}</p> : null}
          <p className="v3-net-answer-source">
            {copy.methodLine}{' '}
            <Link href={LINKS.method}>How we get our numbers</Link>.
          </p>
          <V3SourceLine sourceName={MLS_SOURCE} asOf={snap.asOfLabel} source={copy.methodLine} />
        </section>

        <section id="towns" className="v3-net-section" aria-labelledby="towns-heading">
          <V3Heading level={2} id="towns-heading">
            Town by town
          </V3Heading>
          <Under500kTable caption={copy.tableCaption} headline={snap.headlineTowns} footnotes={snap.footnoteTowns} />
          <p>
            {copy.lotsLine}{' '}
            <Link href={LINKS.homes + '/bend/lots-and-land'}>Lots and land in Bend</Link>
            {' and the same filter on each town page.'}
          </p>
        </section>

        <section id="ask" className="v3-net-section" aria-labelledby="ask-heading">
          <V3Heading level={2} id="ask-heading">
            Email me new listings under $500K
          </V3Heading>
          <p>Pick the towns you want. We email when a new residential listing under $500,000 matches.</p>
          <Under500kSignup />
        </section>

        <section id="questions" className="v3-net-section" aria-labelledby="questions-heading">
          <V3Heading level={2} id="questions-heading">
            {copy.questionsHeading}
          </V3Heading>
          <dl className="v3-net-faq">
            {copy.faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>{linkFaqAnswer(faq.answer)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="sources" className="v3-net-section" aria-labelledby="sources-heading">
          <V3Heading level={2} id="sources-heading">
            {copy.sourcesHeading}
          </V3Heading>
          <ul className="v3-net-sources">
            <li>
              {`${MLS_SOURCE}, Active residential listings under $500,000`}
              {snap.asOfLabel ? `, as of ${snap.asOfLabel}` : ''}
            </li>
            <li>
              <Link href={LINKS.method}>How we get our numbers</Link>
            </li>
            <li>
              <Link href={LINKS.fairHousing}>Fair housing</Link>
            </li>
          </ul>
        </section>

        <V3Quiet id="next" heading={copy.nextHeading} items={nextItems()} />
        <div className="v3-net-section">
          <EqualHousing />
        </div>
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
