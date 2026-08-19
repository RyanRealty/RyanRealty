/**
 * /accessibility - accessibility statement, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 *
 * VISITOR OBJECTIVE: Learn the site’s accessibility commitment and report a
 * barrier through a working channel.
 * MACHINE OBJECTIVE: Keep the accessibility-compliance posture documented and
 * the barrier-report channel real (one mailbox, same as the other legal pages).
 * EXITS: /
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static legal page, no DAL access needed.
import type { Metadata } from 'next'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'

const siteUrl = getCanonicalSiteUrl()
const ogImage = `${siteUrl}/api/og?type=default`
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'admin@ryan-realty.com'

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'How ryan-realty.com aims to meet WCAG 2.1 Level AA, and how to report a barrier.',
  alternates: { canonical: `${siteUrl}/accessibility` },
  openGraph: {
    title: 'Accessibility statement | Ryan Realty',
    description: 'How ryan-realty.com aims to meet WCAG 2.1 Level AA, and how to report a barrier.',
    url: `${siteUrl}/accessibility`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'What we aim for',
    body: 'We build this site so people with disabilities can use it. We aim for Web Content Accessibility Guidelines (WCAG) 2.1 Level AA where we can.',
  },
  {
    kind: 'prose',
    term: 'What we do on the page',
    body: 'Semantic HTML, keyboard navigation, color contrast that holds up, and descriptive links and labels. We avoid content that flashes in a way that could trigger seizures. Meaningful images get text alternatives where it helps.',
  },
  {
    kind: 'prose',
    term: 'Known limitations',
    body: 'Some third-party content, such as maps or embedded tools, may not be fully accessible. We keep improving pages and components. If you hit a barrier, tell us.',
  },
  {
    kind: 'prose',
    term: 'Reporting accessibility issues',
    body: `If you cannot use any part of this site, or you have a fix in mind, email ${contactEmail}. We will reply and fix what we can.`,
  },
  {
    kind: 'prose',
    term: 'Third-party audits',
    body: 'We may hire third-party accessibility audits from time to time. The date of the most recent audit, when one has been done, will sit here. Right now we rely on internal review and what you report.',
  },
  { label: `Email ${contactEmail}`, href: `mailto:${contactEmail}` },
]

export default function AccessibilityPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Accessibility' }]} />

        <V3Quiet
          id="accessibility"
          eyebrow="Updated March 2026"
          heading="Accessibility statement"
          headingLevel={1}
          items={ITEMS}
        />

        <V3Ledger
          id="next"
          eyebrow={v3Text('Next')}
          heading={v3Text('Back to the site')}
          rows={[
            {
              href: '/',
              when: v3Text('Home'),
              what: v3Text('Ryan Realty home'),
              detail: v3Text('Central Oregon listings'),
            },
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
