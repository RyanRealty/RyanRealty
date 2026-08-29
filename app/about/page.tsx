/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. About is who we are,
 * not homes for sale. Faces first (Quiet + Sheet grain). The first 390
 * screen is the H1 plus all three live broker cutouts, names, and 44px
 * Call/Text, with cookie space reserved. How it started is the page:
 * fire service, Red Erickson, no hand-off, video + 3D. Verified record
 * is a quiet license line, not Amboqia numerals competing with market.
 * Towns are one sentence plus a market door. FAQ keeps same-broker,
 * towns, and valuation. Origin and licenses are told once.
 *
 * THE PAGE CONTRACT: generateMetadata through pageMetadata, MetadataBlock
 * JSON-LD (AboutPage + aboutOrganization + BreadcrumbList + FAQPage),
 * V3SectionTracker, revalidate 3600. Seller lives on Sell. The family's
 * Sheet stays on /contact and /team/[slug].
 *
 * Parity: design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { BRAND, BROKERS } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  ABOUT_FAQ_ITEMS,
  ABOUT_TOWNS_SENTENCE,
  FIRM_LICENSE,
} from './_v3/about-constants'
import { AboutFaces } from './_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from './_v3/about-faces'
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
  const brokers = await getBrokers()

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const originItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: [
        `Matt Ryan opened Ryan Realty in Bend in ${BRAND.foundedLabel}, after years in the fire service. He learned the business from Hjalmar "Red" Erickson.`,
        'When the comps do not support the price you want, we say so before you sign anything. Every listing gets a video, a 3D walkthrough, and its own page here.',
        'The broker you first speak to is the broker who works your purchase or sale through to close. No hand-off.',
        ABOUT_TOWNS_SENTENCE,
      ],
    },
    { label: 'Central Oregon housing market', href: '/housing-market' },
    { label: 'Broker profiles', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Call, text, or write', href: '/contact' },
  ]

  const recordItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: `Oregon Real Estate Agency. ${BRAND.legalName}, ${FIRM_LICENSE}. Principal broker Matt Ryan, OR #${BROKERS.matt.license}. Open since ${BRAND.foundedLabel}.`,
    },
  ]

  const faqItems: V3QuietItem[] = [
    ...ABOUT_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
    { label: 'Homes for sale', href: listingsBrowsePath() },
    { label: 'Central Oregon housing market', href: '/housing-market' },
    { label: 'Broker profiles', href: '/team' },
    { label: 'Call, text, or write', href: '/contact' },
  ]

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

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <AboutFaces people={faces} heading="About Ryan Realty" trio />

        <V3Quiet
          id="about"
          heading="How it started"
          headingLevel={2}
          items={originItems}
        />

        <V3Quiet
          id="record"
          eyebrow="Verified record"
          ariaLabel="Verified record"
          items={recordItems}
        />

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading="Working with Ryan Realty"
          items={faqItems}
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
