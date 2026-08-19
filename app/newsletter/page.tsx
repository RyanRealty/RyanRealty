// @no-parity utility subscribe door, no marketing mockup (mirrors app/newsletter/unsubscribe)
/**
 * /newsletter - monthly briefing subscribe door, on the v3 barrel.
 *
 * // @data-free form-only public door. No DAL read. No market figure.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then Sheet (the email). No sales dump. No listing.
 *
 * VISITOR OBJECTIVE: Subscribe to the monthly briefing in one step.
 * MACHINE OBJECTIVE: Capture email through subscribeNewsletterAction and
 * stitch identity. No send from this page.
 * EXITS: /homes-for-sale, /housing-market, /
 *
 * THE PAGE CONTRACT: export const metadata, V3SectionTracker, V3Breadcrumb,
 * V3Footer outside main. Founding fingerprints 71e7816c6d1dd62201a57fa480d7fd39
 * and c650b38778f7a41487262a461a617d6f.
 *
 * D11: no virtue names. No invented quote. No !.
 */

// @data-free form-only public door, no DAL access needed.
import type { Metadata } from 'next'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { publishNewsletterSubscribeHref } from '@/lib/site/publish-newsletter-href'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { NewsletterSheet } from './_v3/NewsletterSheet.client'

const siteUrl = getCanonicalSiteUrl()
const path = publishNewsletterSubscribeHref()
const pageUrl = `${siteUrl}${path}`

export const metadata: Metadata = {
  title: 'Monthly briefing · Bend real estate',
  description:
    'Market shifts, new listings, and one neighborhood, once a month. No spam.',
  alternates: { canonical: pageUrl },
  openGraph: {
    title: 'Monthly briefing · Ryan Realty',
    description: 'Market shifts, new listings, and one neighborhood, once a month.',
    url: pageUrl,
    type: 'website',
  },
}

const INTRO: V3QuietItem[] = [
  {
    kind: 'prose',
    body: 'Market shifts, new listings, and one neighborhood, once a month.',
  },
]

const EXITS: V3QuietItem[] = [
  { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
  { label: 'Market overview', href: '/housing-market' },
  { label: 'Back to home', href: '/' },
]

export default function NewsletterPage() {
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { name: 'Home', url: siteUrl },
    { name: 'Monthly briefing', url: pageUrl },
  ])

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Monthly briefing' }]} />

        <V3Quiet
          id="briefing"
          eyebrow="Ryan Realty · Central Oregon"
          heading="Bend real estate, monthly"
          headingLevel={1}
          items={INTRO}
        />

        <NewsletterSheet source="newsletter-page" />

        <V3Quiet id="next" heading="Keep looking" items={EXITS} />
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
