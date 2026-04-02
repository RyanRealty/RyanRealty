import type { Metadata } from 'next'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'privacy@ryanrealty.com'

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
const H2_CLASS = 'text-lg font-semibold text-primary'
const P_CLASS = 'mt-2 text-sm text-muted-foreground'
const UL_CLASS = 'mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-primary">Privacy & cookies</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 2026</p>
      <p className="mt-4 text-primary">
        How we collect, use, and protect your information when you use our website.
      </p>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>What data we collect</h2>
        <p className={P_CLASS}>
          We collect: (1) <strong>Personal information</strong> — when you sign in (e.g., with Google), we receive your name and email; when you contact us or inquire about a listing, we receive what you provide. (2) <strong>Browsing activity</strong> — which pages and listings you view, searches you run, and when you are signed in we associate this with your account. (3) <strong>Cookies and device info</strong> — session and preference cookies, and general device/browser data for security and analytics.
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
          <li><strong>Follow Up Boss (FUB)</strong> — CRM for lead and activity tracking</li>
          <li><strong>Resend</strong> — transactional and marketing email</li>
          <li><strong>Google Analytics (GA4)</strong> — site analytics</li>
          <li><strong>Meta</strong> — advertising and analytics when you interact with our ads or use Meta products</li>
        </ul>
        <p className={P_CLASS}>
          Each has its own privacy policy. We do not sell your personal information.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Cookies</h2>
        <p className={P_CLASS}>We use:</p>
        <ul className={UL_CLASS}>
          <li><strong>Essential</strong> — sign-in session, cookie-consent choice. Required for the site to work.</li>
          <li><strong>Analytics</strong> — with your consent, to understand how the site is used.</li>
          <li><strong>Marketing</strong> — with your consent, for advertising and retargeting.</li>
        </ul>
        <p className={P_CLASS}>
          You can change your cookie preferences via the cookie banner or your browser settings.
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
          If you are a California resident, you have: the <strong>right to know</strong> what personal information we collect and how it is used; the <strong>right to delete</strong> your personal information; the <strong>right to opt-out of sale</strong> (we do not sell personal information); and the <strong>right to non-discrimination</strong> for exercising these rights. To exercise, contact us at the email below. We will respond within 45 days.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Oregon Consumer Privacy Act</h2>
        <p className={P_CLASS}>
          Oregon’s consumer privacy law (effective July 2025) may give you the right to access, correct, delete, and opt-out of targeted advertising. To exercise these rights, contact us at the email below. We will respond within 45 days where required.
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
