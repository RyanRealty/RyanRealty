/**
 * /cookies - cookie policy, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 *
 * VISITOR OBJECTIVE: See exactly which cookies the site sets, what each does,
 * and change or clear consent from this page.
 * MACHINE OBJECTIVE: Make the consent banner’s choices legible and honorable.
 * EXITS: /privacy, /privacy#donotsell, /
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static legal/policy page, no DAL access needed. @no-parity no mockup contract.
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
  title: 'Cookie policy',
  description: 'How Ryan Realty uses cookies and similar tracking technologies.',
  alternates: { canonical: `${siteUrl}/cookies` },
  openGraph: {
    title: 'Cookie policy | Ryan Realty',
    description: 'How Ryan Realty uses cookies and similar tracking technologies.',
    url: `${siteUrl}/cookies`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

type CookieRow = {
  name: string
  provider: string
  type: 'Essential' | 'Analytics' | 'Marketing'
  duration: string
  purpose: string
}

const COOKIES: CookieRow[] = [
  {
    name: 'Supabase auth session (sb-*)',
    provider: 'Ryan Realty (first-party)',
    type: 'Essential',
    duration: 'Session and refresh token',
    purpose: 'Keeps you signed in after you continue with Google, Facebook, or email.',
  },
  {
    name: 'ryan_realty_cookie_consent',
    provider: 'Ryan Realty (first-party)',
    type: 'Essential',
    duration: '1 year',
    purpose: 'Remembers your cookie choices so we apply them on return visits.',
  },
  {
    name: 'rr_pid',
    provider: 'Ryan Realty (first-party)',
    type: 'Marketing',
    duration: '90 days',
    purpose:
      'Recognizes you as a known contact in our CRM after you sign in or follow one of our links, so we can show your activity to your agent and pick up where you left off.',
  },
  {
    name: 'rr_session_id',
    provider: 'Ryan Realty (first-party)',
    type: 'Analytics',
    duration: 'Stored in your browser until cleared',
    purpose: 'Groups the pages and listings you view in a single browsing session.',
  },
  {
    name: 'ryan_realty_visit_id',
    provider: 'Ryan Realty (first-party)',
    type: 'Analytics',
    duration: '1 year',
    purpose: 'A visit-level identifier used for first-party site analytics.',
  },
  {
    name: 'rr_agent_attribution',
    provider: 'Ryan Realty (first-party)',
    type: 'Marketing',
    duration: '90 days',
    purpose: 'Remembers which agent or campaign referred you so your inquiry routes to the right person.',
  },
  {
    name: '_ga and related _ga_* cookies',
    provider: 'Google Analytics 4 (Google)',
    type: 'Analytics',
    duration: 'Up to 2 years',
    purpose: 'Measures site usage and distinguishes visitors. Set only with your analytics consent.',
  },
  {
    name: '_fbp',
    provider: 'Meta (Facebook)',
    type: 'Marketing',
    duration: '90 days',
    purpose:
      'Used by the Meta Pixel for advertising measurement and audience matching. Set only with your marketing consent.',
  },
  {
    name: '_fbc',
    provider: 'Meta (Facebook)',
    type: 'Marketing',
    duration: 'Up to 90 days',
    purpose: 'Stores the click identifier from a Meta ad so a later inquiry can be attributed to that ad.',
  },
]

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    body: 'The cookies and similar technologies Ryan Realty uses, what each one does, and how to control them.',
  },
  {
    kind: 'prose',
    term: 'What cookies are',
    body: 'Cookies are small text files stored on your device. We also use related technologies such as browser local storage and tracking pixels. We group them into three categories: essential cookies the site needs to function, analytics cookies that help us understand site usage, and marketing cookies used for advertising and audience matching.',
  },
  ...COOKIES.map(
    (c): V3QuietItem => ({
      kind: 'prose',
      term: c.name,
      body: `${c.provider}, ${c.type}, ${c.duration}. ${c.purpose}`,
    }),
  ),
  {
    kind: 'prose',
    term: 'How we recognize returning visitors',
    body: 'If you continue with Google or Facebook, contact us, or follow a link we send you, we may associate your activity with your contact record in our own client-relationship system. A first-party cookie then lets us recognize you on later visits so your agent can see the homes you care about. We may also send a one-way hashed version of your email or phone to Google and Meta so they can match you to your visit for advertising measurement. We do not send Google or Meta your raw email or phone.',
  },
  {
    kind: 'prose',
    term: 'How to control cookies',
    body: [
      'Use our cookie banner to accept all, choose essential only, or set analytics and marketing separately.',
      'Change or withdraw consent any time by clearing the consent cookie or returning to the banner.',
      'Use your browser settings to block or delete cookies. Blocking essential cookies may break sign-in.',
    ],
  },
  { label: 'Google Analytics Opt-out Browser Add-on', href: 'https://tools.google.com/dlpage/gaoptout' },
  { label: 'Google ad personalization settings', href: 'https://adssettings.google.com' },
  { label: 'Do not sell or share', href: '/privacy#donotsell' },
  { label: `Email ${contactEmail}`, href: `mailto:${contactEmail}` },
]

export default function CookiePolicyPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Cookies' }]} />

        <V3Quiet
          id="cookies"
          eyebrow="Updated June 1, 2026"
          heading="Cookie policy"
          headingLevel={1}
          items={ITEMS}
        />

        <V3Ledger
          id="policy-set"
          eyebrow={v3Text('Related')}
          heading={v3Text('Privacy')}
          rows={[
            {
              href: '/privacy',
              when: v3Text('Privacy'),
              what: v3Text('Privacy policy'),
              detail: v3Text('What we collect and how it is used'),
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
