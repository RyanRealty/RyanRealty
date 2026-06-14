import type { Metadata } from 'next'
import { H1 } from '@/components/site/primitives'
import { CONTACT } from '@/lib/brand/contact'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
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

const SECTION_CLASS = 'mt-8'
const H2_CLASS = 'text-lg font-display text-primary'
const P_CLASS = 'mt-2 text-sm text-muted-foreground'
const UL_CLASS = 'mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <H1 className="text-2xl tracking-tight text-primary">Privacy & cookies</H1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 1, 2026</p>
      <p className="mt-4 text-primary">
        How we collect, use, and protect your information when you use our website. For the full list of
        cookies and tracking technologies we use, see our{' '}
        <a href="/cookies" className="text-accent-foreground underline hover:no-underline">cookie policy</a>.
      </p>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>What data we collect</h2>
        <p className={P_CLASS}>
          We collect: (1) <strong>Personal information</strong>, when you sign in (e.g., with Google), we receive your name and email. When you contact us or inquire about a listing, we receive what you provide. (2) <strong>Browsing activity</strong>, which pages and listings you view, searches you run, and when you are signed in we associate this with your account. (3) <strong>Cookies and device info</strong>, session and preference cookies, and general device/browser data for security and analytics.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>How we use it</h2>
        <p className={P_CLASS}>
          We use your data to: personalize your experience, route leads to our team, send email notifications (e.g., saved search matches) if you have opted in, and analyze site usage to improve our service. When you are signed in, we send your contact info and activity to our CRM (Follow Up Boss) so we can follow up on properties you care about.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Third-party sharing</h2>
        <ul className={UL_CLASS}>
          <li><strong>Follow Up Boss (FUB)</strong>, CRM for lead and activity tracking</li>
          <li><strong>Resend</strong>, transactional and marketing email</li>
          <li><strong>Google Analytics (GA4)</strong>, site analytics, including <strong>Google Signals</strong> (see below)</li>
          <li><strong>Meta</strong>, advertising and analytics when you interact with our ads or use Meta products</li>
        </ul>
        <p className={P_CLASS}>
          Each has its own privacy policy. We do not sell your personal information.
        </p>
      </section>

      <section id="sms" className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>SMS and text messaging</h2>
        <p className={P_CLASS}>
          If you provide your phone number on one of our forms, or text our business number first, you consent to receive calls and text messages from Ryan Realty about your request. Message frequency varies. Message and data rates may apply. Reply STOP at any time to opt out, or HELP for help. You can also reach us at {CONTACT.phoneDirect}.
        </p>
        <p className={P_CLASS}>
          No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third parties.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Google Signals (demographics and cross-device measurement)</h2>
        <p className={P_CLASS}>
          We use Google Signals as part of Google Analytics 4. When you are signed in to your Google account and have turned on Ads Personalization in your Google settings, Google may associate aggregate demographic data (age range, gender, general interest categories) and cross-device activity with the visit data we collect. We never see your individual Google account information. We only see aggregate reports such as the age and interest breakdown of our site visitors.
        </p>
        <p className={P_CLASS}>
          You can control whether Google Signals applies to your visit at <a href="https://adssettings.google.com" className="text-accent-foreground underline hover:no-underline" target="_blank" rel="noopener noreferrer">adssettings.google.com</a> by turning off Ads Personalization. You can also opt out of Google Analytics entirely by installing the <a href="https://tools.google.com/dlpage/gaoptout" className="text-accent-foreground underline hover:no-underline" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Browser Add-on</a>.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Cookies</h2>
        <p className={P_CLASS}>We use:</p>
        <ul className={UL_CLASS}>
          <li><strong>Essential</strong>, sign-in session, cookie-consent choice. Required for the site to work.</li>
          <li><strong>Analytics</strong>, with your consent, to understand how the site is used.</li>
          <li><strong>Marketing</strong>, with your consent, for advertising and retargeting.</li>
        </ul>
        <p className={P_CLASS}>
          You can change your cookie preferences via the cookie banner or your browser settings. See our{' '}
          <a href="/cookies" className="text-accent-foreground underline hover:no-underline">cookie policy</a>{' '}
          for each cookie we use, its purpose, and how long it lasts.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Data retention</h2>
        <p className={P_CLASS}>
          We retain account and activity data as long as your account is active and as needed for legal, security, or operational purposes. You may request deletion of your data (see rights below).
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>California (CCPA) rights</h2>
        <p className={P_CLASS}>
          If you are a California resident, you have the <strong>right to know</strong> what personal information we collect and how it is used. You have the <strong>right to delete</strong> your personal information. You have the <strong>right to opt-out of sale</strong> (we do not sell personal information). You also have the <strong>right to non-discrimination</strong> for exercising these rights. To exercise, contact us at the email below. We will respond within 45 days.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Oregon Consumer Privacy Act</h2>
        <p className={P_CLASS}>
          Oregon’s Consumer Privacy Act (effective July 1, 2024) gives Oregon residents the right to access, correct, delete, and obtain a copy of their personal data, and to opt out of the sale of personal data, targeted advertising, and certain profiling. To exercise these rights, contact us at the email below. We will respond within 45 days where required.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Recognizing you and targeted advertising</h2>
        <p className={P_CLASS}>
          Once you sign in, contact us, or follow a link we send, we may recognize you on later visits using a first-party cookie and associate the pages and listings you view with your contact record in Follow Up Boss, so our team can follow up on the homes you care about. We may also send a one-way hashed version of your email or phone to Meta and Google so they can match you to your visit and measure or target advertising. We never send them your raw email or phone. We may use this information to build advertising audiences and to tailor the ads you see. You can opt out as described below.
        </p>
      </section>

      <section id="donotsell" className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Do not sell or share my personal information</h2>
        <p className={P_CLASS}>
          We do not sell your personal information for money. We do use advertising and analytics services from Meta and Google that may involve sharing online identifiers, such as a hashed email or a cookie identifier, for cross-context behavioral advertising. Under California and Oregon law this can be treated as a sale or a share, and you have the right to opt out.
        </p>
        <p className={P_CLASS}>
          To opt out on this browser, set Marketing to off in our cookie banner. That stops the Meta Pixel and advertising cookies here. To opt out across our systems, email us at <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a> with the subject line Do Not Sell or Share, and we will remove you from advertising audiences and stop sharing your identifiers. Opting out does not stop the essential or analytics functions you have allowed.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>How to exercise your rights</h2>
        <p className={P_CLASS}>
          Email us at <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a>. We will respond within 45 days. You may also sign out and manage cookies via our banner or your browser.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Children’s privacy</h2>
        <p className={P_CLASS}>
          We do not knowingly collect personal information from children under 13. If you believe we have done so, please contact us and we will delete it.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Ryan Realty Social, content publishing application</h2>
        <p className={P_CLASS}>
          Ryan Realty operates an application named <strong>Ryan Realty Social</strong> that publishes our own original real-estate content (market reports, listing videos, neighborhood guides, news commentary) from this website to third-party platforms on our behalf, including TikTok, Instagram, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, and Google Business Profile.
        </p>
        <p className={P_CLASS}>
          <strong>What data Ryan Realty Social handles:</strong> only the OAuth access tokens and refresh tokens that authorize Ryan Realty Social to publish to Ryan Realty&rsquo;s own brokerage accounts on each platform, plus public engagement metrics on our own posts (views, likes, comments) for performance analytics. Ryan Realty Social does <em>not</em> collect, store, or process personal information of TikTok users, Instagram users, or any other platform&rsquo;s users. It does not access follower lists, direct messages, or any third-party user data beyond what is publicly visible on our own posts.
        </p>
        <p className={P_CLASS}>
          <strong>Token storage:</strong> platform OAuth tokens are stored encrypted at rest in our backend and are used solely for publishing Ryan Realty&rsquo;s own content. Tokens are never shared with third parties and are revocable at any time by the platform account owner via that platform&rsquo;s standard OAuth-revoke flow.
        </p>
        <p className={P_CLASS}>
          <strong>Compliance:</strong> Ryan Realty Social complies with the TikTok Developer Terms of Service, the Meta Platform Terms, the YouTube API Services Terms of Service (including the Google API Services User Data Policy), the LinkedIn API Terms of Use, the X Developer Agreement, and the Pinterest Developer Terms.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Updates</h2>
        <p className={P_CLASS}>
          We may update this policy from time to time. The “Last updated” date at the top will change. Continued use of the site after changes means you accept the updated policy.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Contact</h2>
        <p className={P_CLASS}>
          Questions? <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a>.
        </p>
      </section>
    </main>
  )
}
