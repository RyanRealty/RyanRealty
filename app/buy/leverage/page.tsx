/**
 * /buy/leverage — buyers have leverage in Bend (SEO & AEO Desk 2026-10-13, BUY-1).
 *
 * Live leftover HUD + 12-month pace, the same cells /housing-market/bend,
 * /cities/bend, /price-drops/bend, and /months-of-supply print. Pulse 68.5%
 * under asking, 2.97 months, and 471 active stay off this page.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, v3 barrel. Order:
 * Breadcrumb, answer (H1 + proof), area table, two ask forms, Questions,
 * Sources, Quiet, Footer. Answer, table, and FAQ are server HTML.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { getPriceDrops } from '@/lib/data/listings/getPriceDrops'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
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
import { CELL_UNPUBLISHED, LEVERAGE_AREA_DEFS, LEVERAGE_LINKS, MLS_SOURCE, ROUTE_PATH } from './_v3/leverage-constants'
import { leverageCopy, leverageNextItems } from './_v3/leverage-copy'
import { buildLeverageSnapshot } from './_v3/leverage-data'
import { LeverageForms } from './_v3/LeverageForms.client'
import './_v3/leverage.css'

export const revalidate = 3600

const OVERLAY_KEYS = [
  ...LEVERAGE_AREA_DEFS.map((area) => ({ geoType: 'city' as const, geoSlug: area.slug })),
  { geoType: 'region' as const, geoSlug: 'central-oregon' },
]

function overlayKey(geoType: 'city' | 'region', slug: string): string {
  return `${geoType}:${slug}`
}

const loadSnapshot = cache(async () => {
  const [overlays, weekDrops, ...paceRows] = await Promise.all([
    getDetachedOverlays(OVERLAY_KEYS).catch(() => new Map()),
    getPriceDrops({ city: 'Bend', limit: 48, days: 7 }),
    ...OVERLAY_KEYS.map((key) =>
      getPublicDetachedPace({ geoType: key.geoType, geoSlug: key.geoSlug }).catch(() => ({ ...EMPTY_PUBLIC_PACE })),
    ),
  ])
  const paces = new Map<string, PublicPaceRow>()
  OVERLAY_KEYS.forEach((key, i) => {
    paces.set(overlayKey(key.geoType, key.geoSlug), paceRows[i] ?? { ...EMPTY_PUBLIC_PACE })
  })
  return buildLeverageSnapshot({ overlays, paces, weekDrops })
})

export async function generateMetadata(): Promise<Metadata> {
  const snap = await loadSnapshot()
  const copy = leverageCopy(snap)
  return pageMetadata({
    title: copy.title,
    description: copy.metaDescription,
    path: ROUTE_PATH,
    keywords: [
      'buyers have leverage in Bend',
      'Bend Oregon housing market for buyers',
      'Bend price reductions',
      'Bend months of supply',
    ],
  })
}

export default async function BuyLeveragePage() {
  const snap = await loadSnapshot()
  const copy = leverageCopy(snap)
  const asOf = snap.bend.asOfLabel
  const dateModified = snap.bend.asOfIso ?? undefined

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: LEVERAGE_LINKS.homes },
        { name: 'Buyer leverage', url: ROUTE_PATH },
      ],
    },
    {
      type: 'webPage',
      name: copy.title,
      description: copy.metaDescription,
      url: ROUTE_PATH,
      dateModified,
    },
    {
      type: 'faqPage',
      items: copy.faqs.map(({ question, answer }) => ({ question, answer })),
      dateModified,
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: LEVERAGE_LINKS.homes },
            { label: 'Buyer leverage' },
          ]}
        />

        <section id="answer" className="v3-net-section v3-net-section--lead" aria-labelledby="leverage-heading">
          <V3Eyebrow>{copy.eyebrow}</V3Eyebrow>
          <V3Heading level={1} id="leverage-heading">
            {copy.h1}
          </V3Heading>
          {copy.answer.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="v3-net-answer">
              {paragraph}
            </p>
          ))}
          {copy.qualifier ? <p className="v3-net-answer">{copy.qualifier}</p> : null}
          {copy.paceLine ? <p className="v3-net-answer">{copy.paceLine}</p> : null}
          {copy.weekLine ? (
            <p className="v3-net-answer">
              {copy.weekLine}{' '}
              <Link href={LEVERAGE_LINKS.bendDrops}>Bend price drops this week</Link>.
            </p>
          ) : null}
          {copy.regionLine ? <p className="v3-net-answer">{copy.regionLine}</p> : null}
          <p className="v3-net-answer-source">
            {copy.methodLine}{' '}
            <Link href={LEVERAGE_LINKS.bendMarket}>Bend housing market</Link>
            {', '}
            <Link href={LEVERAGE_LINKS.bendCity}>Bend city page</Link>
            {', '}
            <Link href={LEVERAGE_LINKS.monthsOfSupply}>months of supply</Link>
            {', '}
            <Link href={LEVERAGE_LINKS.method}>how we get our numbers</Link>.
          </p>
          <V3SourceLine sourceName={MLS_SOURCE} asOf={asOf} source={copy.methodLine} />
        </section>

        <section id="towns" className="v3-net-section" aria-labelledby="towns-heading">
          <V3Heading level={2} id="towns-heading">
            {copy.townsHeading}
          </V3Heading>
          <table className="v3-net-table">
            <caption>{copy.areaCaption}</caption>
            <thead>
              <tr>
                <th scope="col">Town</th>
                <th scope="col">Months of supply</th>
                <th scope="col">Sales after a cut</th>
                <th scope="col">Days to an offer</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {snap.areas.map((row) => (
                <tr key={row.slug}>
                  <th scope="row">
                    <Link href={row.href}>{row.name}</Link>
                  </th>
                  <td>{row.monthsSupplyLabel ?? CELL_UNPUBLISHED}</td>
                  <td>{row.priceCutShareLabel ?? CELL_UNPUBLISHED}</td>
                  <td>{row.daysToOffer90Label ?? CELL_UNPUBLISHED}</td>
                  <td className="v3-leverage-note">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          id="ask"
          className="v3-net-section"
          aria-label={`${copy.reportHeading} and ${copy.consultHeading}`}
        >
          <LeverageForms copy={copy} />
        </section>

        <section id="questions" className="v3-net-section" aria-labelledby="questions-heading">
          <V3Heading level={2} id="questions-heading">
            {copy.questionsHeading}
          </V3Heading>
          <dl className="v3-net-faq">
            {copy.faqs.map((faq) => (
              <div key={faq.question}>
                <dt>{faq.question}</dt>
                <dd>
                  {faq.answer}
                  {faq.related ? (
                    <>
                      {' '}
                      <Link href={faq.related.href}>{faq.related.label}</Link>.
                    </>
                  ) : null}
                </dd>
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
              {`Ryan Realty, `}
              <Link href={LEVERAGE_LINKS.bendMarket}>Bend housing market</Link>
              {asOf ? ` (Oregon Data Share MLS), as of ${asOf}` : ' (Oregon Data Share MLS)'}
            </li>
            <li>
              <Link href={LEVERAGE_LINKS.bendCity}>Bend city page</Link>
              {' for sale-to-list and the median price cut'}
            </li>
            <li>
              <Link href={LEVERAGE_LINKS.bendDrops}>Bend price drops</Link>
              {' for this week\'s asking-price cuts'}
            </li>
            <li>
              <Link href={LEVERAGE_LINKS.monthsOfSupply}>Months of supply</Link>
              {' for Central Oregon overall'}
            </li>
            <li>
              <Link href={LEVERAGE_LINKS.method}>How we get our numbers</Link>
            </li>
            <li>{copy.firmLine}</li>
          </ul>
        </section>

        <V3Quiet id="next" heading={copy.nextHeading} items={leverageNextItems()} />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
