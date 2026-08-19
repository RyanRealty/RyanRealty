/**
 * /privacy - how we collect and use information, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet (the policy) then Ledger (the policy set).
 * No sales Sheet. Value my home stays in the header.
 *
 * VISITOR OBJECTIVE: Get the definitive answer to what Ryan Realty collects,
 * how it is used, and the exact channel to exercise a privacy right
 * (do-not-sell, deletion, access) in one page.
 * MACHINE OBJECTIVE: Keep every capture surface lawful and switched on.
 * This URL is pinned by OAuth consent screens and A2P carrier review.
 * EXITS: /cookies, /terms, /data-deletion, /
 *
 * THE PAGE CONTRACT, carried across: export const metadata (title, robots
 * noindex follow, canonical), SMS section copy the A2P gate reads in this
 * file, id="sms" and id="donotsell" in the HTML.
 *
 * D11: no virtue names. No invented quote. Fact, then stop.
 */

// @data-free static legal page, no DAL access needed.
import type { Metadata } from 'next'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { CONTACT } from '@/lib/brand/contact'
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
  title: 'Privacy & cookies',
  description: 'Privacy policy and cookie use for Ryan Realty.',
  alternates: { canonical: `${siteUrl}/privacy` },
  openGraph: {
    title: 'Privacy & cookies | Ryan Realty',
    description: 'Privacy policy and cookie use for Ryan Realty.',
    url: `${siteUrl}/privacy`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    body: 'How we collect, use, and protect your information when you use this website.',
  },
  {
    kind: 'prose',
    term: 'What data we collect',
    body: [
      'Personal information: when you sign in (for example with Google), we receive your name and email. When you contact us or inquire about a listing, we receive what you provide.',
      'Browsing activity: which pages and listings you view, searches you run, and when you are signed in we associate this with your account.',
      'Cookies and device info: session and preference cookies, and general device and browser data for security and analytics.',
    ],
  },
  {
    kind: 'prose',
    term: 'How we use it',
    body: 'We use your data to personalize your experience, route leads to our team, send email notifications (saved search matches) if you have opted in, and analyze site usage. When you are signed in, we record your contact info and activity in our own client-relationship system so we can follow up on properties you care about. That system is operated by Ryan Realty, not a third party.',
  },
  {
    kind: 'prose',
    term: 'Third-party sharing',
    body: [
      'Resend, transactional and marketing email.',
      'Google Analytics (GA4), site analytics, including Google Signals.',
      'Meta, advertising and analytics when you interact with our ads or use Meta products.',
      'Each has its own privacy policy. We do not sell your personal information.',
    ],
  },
  {
    kind: 'prose',
    term: 'SMS and text messaging',
    body: [
      `If you provide your phone number on one of our forms, or text our business number first, you consent to receive calls and text messages from Ryan Realty about your request. Message frequency varies. Message and data rates may apply. Reply STOP at any time to opt out, or HELP for help. You can also reach us at ${CONTACT.phoneDirect}.`,
      'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third parties.',
    ],
  },
  {
    kind: 'prose',
    term: 'Google Signals (demographics and cross-device measurement)',
    body: [
      'We use Google Signals as part of Google Analytics 4. When you are signed in to your Google account and have turned on Ads Personalization in your Google settings, Google may associate aggregate demographic data (age range, gender, general interest categories) and cross-device activity with the visit data we collect. We never see your individual Google account information. We only see aggregate reports such as the age and interest breakdown of our site visitors.',
      'You can control whether Google Signals applies to your visit at adssettings.google.com by turning off Ads Personalization. You can also opt out of Google Analytics entirely by installing the Google Analytics Opt-out Browser Add-on.',
    ],
  },
  {
    kind: 'prose',
    term: 'Cookies',
    body: [
      'Essential: sign-in session, cookie-consent choice. Required for the site to work.',
      'Analytics: with your consent, to understand how the site is used.',
      'Marketing: with your consent, for advertising and retargeting.',
      'You can change your cookie preferences via the cookie banner or your browser settings.',
    ],
  },
  {
    kind: 'prose',
    term: 'Data retention',
    body: 'We retain account and activity data as long as your account is active and as needed for legal, security, or operational purposes. You may request deletion of your data.',
  },
  {
    kind: 'prose',
    term: 'California (CCPA) rights',
    body: 'If you are a California resident, you have the right to know what personal information we collect and how it is used. You have the right to delete your personal information. You have the right to opt-out of sale (we do not sell personal information). You also have the right to non-discrimination for exercising these rights. To exercise, contact us at the email below. We will respond within 45 days.',
  },
  {
    kind: 'prose',
    term: 'Oregon Consumer Privacy Act',
    body: 'Oregon Consumer Privacy Act (effective July 1, 2024) gives Oregon residents the right to access, correct, delete, and obtain a copy of their personal data, and to opt out of the sale of personal data, targeted advertising, and certain profiling. To exercise these rights, contact us at the email below. We will respond within 45 days where required.',
  },
  {
    kind: 'prose',
    term: 'Recognizing you and targeted advertising',
    body: 'Once you sign in, contact us, or follow a link we send, we may recognize you on later visits using a first-party cookie and associate the pages and listings you view with your contact record in our own client-relationship system, so our team can follow up on the homes you care about. We may also send a one-way hashed version of your email or phone to Meta and Google so they can match you to your visit and measure or target advertising. We never send them your raw email or phone. We may use this information to build advertising audiences and to tailor the ads you see. You can opt out as described below.',
  },
  {
    kind: 'prose',
    term: 'Do not sell or share my personal information',
    body: [
      'We do not sell your personal information for money. We do use advertising and analytics services from Meta and Google that may involve sharing online identifiers, such as a hashed email or a cookie identifier, for cross-context behavioral advertising. Under California and Oregon law this can be treated as a sale or a share, and you have the right to opt out.',
      `To opt out on this browser, set Marketing to off in our cookie banner. That stops the Meta Pixel and advertising cookies here. To opt out across our systems, email us at ${contactEmail} with the subject line Do Not Sell or Share, and we will remove you from advertising audiences and stop sharing your identifiers. Opting out does not stop the essential or analytics functions you have allowed.`,
    ],
  },
  {
    kind: 'prose',
    term: 'How to exercise your rights',
    body: `Email us at ${contactEmail}. We will respond within 45 days. You may also sign out and manage cookies via our banner or your browser.`,
  },
  {
    kind: 'prose',
    term: 'Children’s privacy',
    body: 'We do not knowingly collect personal information from children under 13. If you believe we have done so, please contact us and we will delete it.',
  },
  {
    kind: 'prose',
    term: 'Ryan Realty Social, content publishing application',
    body: [
      'Ryan Realty operates an application named Ryan Realty Social that publishes our own original real-estate content (market reports, listing videos, neighborhood guides, news commentary) from this website to third-party platforms on our behalf, including TikTok, Instagram, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, and Google Business Profile.',
      'What data Ryan Realty Social handles: only the OAuth access tokens and refresh tokens that authorize Ryan Realty Social to publish to Ryan Realty’s own brokerage accounts on each platform, plus public engagement metrics on our own posts (views, likes, comments) for performance analytics. Ryan Realty Social does not collect, store, or process personal information of TikTok users, Instagram users, or any other platform’s users. It does not access follower lists, direct messages, or any third-party user data beyond what is publicly visible on our own posts.',
      'Token storage: platform OAuth tokens are stored encrypted at rest in our backend and are used solely for publishing Ryan Realty’s own content. Tokens are never shared with third parties and are revocable at any time by the platform account owner via that platform’s standard OAuth-revoke flow.',
      'Compliance: Ryan Realty Social complies with the TikTok Developer Terms of Service, the Meta Platform Terms, the YouTube API Services Terms of Service (including the Google API Services User Data Policy), the LinkedIn API Terms of Use, the X Developer Agreement, and the Pinterest Developer Terms.',
    ],
  },
  {
    kind: 'prose',
    term: 'Updates',
    body: 'We may update this policy from time to time. The updated date at the top will change. Continued use of the site after changes means you accept the updated policy.',
  },
  { label: 'Google ad personalization settings', href: 'https://adssettings.google.com' },
  { label: 'Google Analytics Opt-out Browser Add-on', href: 'https://tools.google.com/dlpage/gaoptout' },
  { label: `Email ${contactEmail}`, href: `mailto:${contactEmail}` },
]

export default function PrivacyPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Privacy' }]} />

        <div id="sms">
          <div id="donotsell">
            <V3Quiet
              id="privacy"
              eyebrow="Updated June 1, 2026"
              heading="Privacy and cookies"
              headingLevel={1}
              items={ITEMS}
            />
          </div>
        </div>

        <V3Ledger
          id="policy-set"
          eyebrow={v3Text('Related')}
          heading={v3Text('The rest of the policy set')}
          rows={[
            {
              href: '/cookies',
              when: v3Text('Cookies'),
              what: v3Text('Cookie policy'),
              detail: v3Text('Each cookie, its purpose, and how long it lasts'),
            },
            {
              href: '/terms',
              when: v3Text('Terms'),
              what: v3Text('Terms of service'),
              detail: v3Text('Site use, MLS data, and the SMS program'),
            },
            {
              href: '/data-deletion',
              when: v3Text('Rights'),
              what: v3Text('Delete your data'),
              detail: v3Text('Account and personal data removal'),
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
