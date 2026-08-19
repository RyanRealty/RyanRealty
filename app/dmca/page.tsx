/**
 * /dmca - DMCA notice and takedown, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 *
 * VISITOR OBJECTIVE: A copyright claimant finds the designated agent and the
 * exact notice and counter-notice elements to file, in one page.
 * MACHINE OBJECTIVE: Preserve DMCA safe-harbor standing for MLS photos.
 * EXITS: /
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static legal page, no DAL access needed.
import type { Metadata } from 'next'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
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
const designated = BROKERS.matt
const designatedAddress = BRAND.mailingAddress
const designatedPhone = CONTACT.phoneDirect
const designatedEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? designated.email

export const metadata: Metadata = {
  title: 'DMCA Policy',
  description: 'DMCA notice and takedown procedure for Ryan Realty.',
  alternates: { canonical: `${siteUrl}/dmca` },
  openGraph: {
    title: 'DMCA Policy | Ryan Realty',
    description: 'DMCA notice and takedown procedure for Ryan Realty.',
    url: `${siteUrl}/dmca`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    body: 'Digital Millennium Copyright Act notice and takedown procedure.',
  },
  {
    kind: 'prose',
    term: 'Designated agent',
    body: `Ryan Realty has designated ${designated.name}, ${designated.title}, as agent to receive notifications of claimed copyright infringement. Mail: ${designatedAddress}. Phone: ${designatedPhone}. Email: ${designatedEmail}.`,
  },
  {
    kind: 'prose',
    term: 'Filing a DMCA notice',
    body: [
      'If you believe content on this site infringes your copyright, you may send a written DMCA notice to our designated agent. Your notice must include:',
      'Your physical or electronic signature.',
      'Identification of the copyrighted work you believe is infringed.',
      'Identification of the material that you claim is infringing and where it is located on our site.',
      'Your contact information (address, phone, email).',
      'A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner.',
      'A statement under penalty of perjury that the information in the notice is accurate and that you are authorized to act on behalf of the copyright owner.',
      'We will respond to valid notices in accordance with the DMCA and may remove or disable access to the allegedly infringing material.',
    ],
  },
  {
    kind: 'prose',
    term: 'Counter-notification',
    body: 'If you believe material you posted was removed or disabled by mistake or misidentification, you may send a counter-notification to our designated agent. It must include your physical or electronic signature, identification of the material that was removed and its location before removal, a statement under penalty of perjury that the material was removed by mistake, your name and contact information, and consent to jurisdiction of the federal court in your district (or Oregon if outside the U.S.). We may forward the counter-notification to the original complainant. If the copyright owner does not file a court action, we may restore the material.',
  },
  {
    kind: 'prose',
    term: 'Repeat infringers',
    body: 'We may terminate accounts of users who are repeat infringers in appropriate circumstances.',
  },
  { label: `Email ${designatedEmail}`, href: `mailto:${designatedEmail}` },
]

export default function DMCAPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'DMCA' }]} />

        <V3Quiet
          id="dmca"
          heading="DMCA Policy"
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
