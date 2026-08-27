/**
 * /terms - terms of service, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 *
 * VISITOR OBJECTIVE: Understand what governs use of the site and its MLS data,
 * including the SMS consent terms, in one page.
 * MACHINE OBJECTIVE: Hold carrier and platform standing (the A2P consent
 * sentence is verified word-for-word against this page).
 * EXITS: /privacy#sms, /privacy, /
 *
 * THE PAGE CONTRACT: export const metadata (robots index follow, flipped from
 * noindex on 2026-08-26 — the page was noindex AND sitemapped), SMS
 * program copy the A2P gate reads in this file, id="sms" in the HTML.
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

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service and use for Ryan Realty website and MLS data.',
  alternates: { canonical: `${siteUrl}/terms` },
  openGraph: {
    title: 'Terms of Service | Ryan Realty',
    description: 'Terms of service and use for Ryan Realty website and MLS data.',
    url: `${siteUrl}/terms`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  // Indexable, and in the sitemap. These are substantive pages a visitor
  // searches for by name and a compliance reviewer expects to find (the OAuth
  // consent screen and A2P carrier review both pin /privacy). noindex beside a
  // sitemap entry was a contradictory instruction that earned the Search
  // Console "submitted but noindex" warning and hid the accessibility and fair
  // housing statements of a licensed brokerage. Canonical is set above, so
  // indexing carries no duplicate risk.
  robots: 'index, follow',
}

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'Acceptance of terms',
    body: 'By using this website, you agree to these Terms of Service. If you do not agree, do not use the site.',
  },
  {
    kind: 'prose',
    term: 'Account registration',
    body: 'You may create an account to save searches, save listings, and receive notifications. You are responsible for keeping your credentials secure and for all activity under your account.',
  },
  {
    kind: 'prose',
    term: 'MLS data usage',
    body: 'Listing data is provided for your personal, non-commercial use. You may not copy, scrape, or use the data for commercial purposes, resale, or redistribution. Data is subject to Oregon Data Share (ODS) and MLS rules.',
  },
  {
    kind: 'prose',
    term: 'Property information disclaimer',
    body: 'Property information is not guaranteed accurate. Square footage, lot size, and other details may be approximate. You should verify all information independently (with the listing agent, inspections, and public records) before relying on it.',
  },
  {
    kind: 'prose',
    term: 'Automated valuations (CMA)',
    body: 'Any automated valuation, listing-page market read, or comparative market analysis (CMA) provided on this site is an estimate only and is not an appraisal. Do not use it as the sole basis for pricing or purchase decisions.',
  },
  {
    kind: 'prose',
    term: 'User conduct',
    body: 'You may not scrape the site, use bots for bulk data collection, harass other users or agents, or use the site for any unlawful purpose. Commercial use of listing data without permission is prohibited.',
  },
  {
    kind: 'prose',
    term: 'Intellectual property',
    body: 'Our content (text, layout, branding) is owned by Ryan Realty or our licensors. MLS data is owned by the applicable MLS. You may not copy or republish our content without permission.',
  },
  {
    kind: 'prose',
    term: 'Third-party links',
    body: 'We may link to third-party sites. We are not responsible for their content or privacy practices.',
  },
  {
    kind: 'prose',
    term: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, Ryan Realty and its agents are not liable for any indirect, incidental, or consequential damages arising from your use of the site or reliance on any information provided here.',
  },
  {
    kind: 'prose',
    term: 'Indemnification',
    body: 'You agree to indemnify and hold harmless Ryan Realty and its agents from any claims or damages arising from your use of the site or violation of these terms.',
  },
  {
    kind: 'prose',
    term: 'Governing law and disputes',
    body: 'These terms are governed by the laws of the State of Oregon. Disputes will be resolved in the courts of Oregon.',
  },
  {
    kind: 'prose',
    term: 'Termination',
    body: 'We may suspend or terminate your access at any time for violation of these terms or for any other reason.',
  },
  {
    kind: 'prose',
    term: 'Ryan Realty Social: content publishing application',
    body: [
      'Ryan Realty operates an application named Ryan Realty Social that publishes original real-estate content (market reports, listing videos, neighborhood guides, news commentary) from this website to third-party platforms, including TikTok, Instagram, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, and Google Business Profile, on behalf of Ryan Realty and its participating brokerage agents.',
      'Ryan Realty Social does not collect user data from these third-party platforms. It does not post on behalf of website visitors, customers, or any user other than the brokerage and its authorized agents. Use of Ryan Realty Social is governed by these Terms of Service in addition to the platform-specific terms of each connected service (TikTok Developer Terms, Meta Platform Terms, YouTube API Services Terms, LinkedIn API Terms). Connected platform tokens are stored encrypted and used solely to publish Ryan Realty’s own content. We do not access, scrape, or sell any platform user’s data through this application.',
    ],
  },
  {
    kind: 'prose',
    term: 'Text messaging (SMS) program',
    body: [
      'If you provide your phone number on one of our forms and check the SMS consent box, you agree to receive text messages from Ryan Realty related to your request, including property and home-value updates, scheduling, and replies from our team. Consent to receive text messages is not a condition of any purchase or service.',
      'Message frequency varies. Message and data rates may apply. Reply STOP at any time to unsubscribe, or HELP for help. Mobile carriers are not liable for delayed or undelivered messages. We honor STOP and HELP keywords automatically.',
      'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third parties.',
    ],
  },
  { label: 'Privacy policy, SMS section', href: '/privacy#sms' },
]

export default function TermsPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Terms' }]} />

        <div id="sms">
          <V3Quiet
            id="terms"
            eyebrow="Updated May 2026"
            heading="Terms of Service"
            headingLevel={1}
            items={ITEMS}
          />
        </div>

        <V3Ledger
          id="policy-set"
          eyebrow={v3Text('Related')}
          heading={v3Text('Privacy and contact')}
          rows={[
            {
              href: '/privacy',
              when: v3Text('Privacy'),
              what: v3Text('Privacy policy'),
              detail: v3Text('What we collect and how to exercise a right'),
            },
            {
              href: '/contact',
              when: v3Text('Write'),
              what: v3Text('Contact'),
              detail: v3Text('Call, text, or write a broker'),
            },
            {
              href: '/',
              when: v3Text('Home'),
              what: v3Text('Ryan Realty home'),
              detail: v3Text('Back to Central Oregon listings'),
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
