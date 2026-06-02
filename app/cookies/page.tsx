import type { Metadata } from 'next'

// @data-free static legal/policy page, no DAL access needed. @no-parity no mockup contract.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
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

const SECTION_CLASS = 'mt-8'
const H2_CLASS = 'text-lg font-semibold text-primary'
const P_CLASS = 'mt-2 text-sm text-muted-foreground'
const UL_CLASS = 'mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground'

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
    name: 'fub_cid',
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
    purpose: 'Used by the Meta Pixel for advertising measurement and audience matching. Set only with your marketing consent.',
  },
  {
    name: '_fbc',
    provider: 'Meta (Facebook)',
    type: 'Marketing',
    duration: 'Up to 90 days',
    purpose: 'Stores the click identifier from a Meta ad so a later inquiry can be attributed to that ad.',
  },
]

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Cookie policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 1, 2026</p>
      <p className="mt-4 text-primary">
        This page explains the cookies and similar technologies Ryan Realty uses, what each one does, and how
        to control them. It works alongside our{' '}
        <a href="/privacy" className="text-accent-foreground underline hover:no-underline">
          privacy policy
        </a>
        .
      </p>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>What cookies are</h2>
        <p className={P_CLASS}>
          Cookies are small text files stored on your device. We also use related technologies such as
          browser local storage and tracking pixels. We group them into three categories: essential cookies
          the site needs to function, analytics cookies that help us understand site usage, and marketing
          cookies used for advertising and audience matching.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Cookies we use</h2>
        <ul className={UL_CLASS}>
          {COOKIES.map((c) => (
            <li key={c.name}>
              <strong className="text-primary">{c.name}</strong> ({c.provider}, {c.type}, {c.duration}).{' '}
              {c.purpose}
            </li>
          ))}
        </ul>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>How we recognize returning visitors</h2>
        <p className={P_CLASS}>
          If you continue with Google or Facebook, contact us, or follow a link we send you, we may associate
          your activity with your contact record in our CRM (Follow Up Boss). A first-party cookie then lets us
          recognize you on later visits so your agent can see the homes you care about. We may also send a
          one-way hashed version of your email or phone to Google and Meta so they can match you to your visit
          for advertising measurement. We do not send Google or Meta your raw email or phone.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>How to control cookies</h2>
        <ul className={UL_CLASS}>
          <li>Use our cookie banner to accept all, choose essential only, or set analytics and marketing separately.</li>
          <li>Change or withdraw consent any time by clearing the consent cookie or returning to the banner.</li>
          <li>Use your browser settings to block or delete cookies. Blocking essential cookies may break sign-in.</li>
          <li>
            Opt out of Google Analytics with the{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" className="text-accent-foreground underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              Google Analytics Opt-out Browser Add-on
            </a>
            , and control Google ad personalization at{' '}
            <a href="https://adssettings.google.com" className="text-accent-foreground underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              adssettings.google.com
            </a>
            .
          </li>
          <li>
            Opt out of sale or sharing for targeted advertising on our{' '}
            <a href="/privacy#donotsell" className="text-accent-foreground underline hover:no-underline">
              Do Not Sell or Share
            </a>{' '}
            page.
          </li>
        </ul>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Contact</h2>
        <p className={P_CLASS}>
          Questions about cookies?{' '}
          <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">
            {contactEmail}
          </a>
          .
        </p>
      </section>
    </main>
  )
}
