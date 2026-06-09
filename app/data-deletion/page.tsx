// @no-parity static legal/utility page (same pattern as /privacy, /terms, /cookies), no mockup contract
// @data-free static legal page, renders constant copy, no data layer needed
import type { Metadata } from 'next'
import { H1 } from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const contactEmail = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL ?? 'admin@ryan-realty.com'

export const metadata: Metadata = {
  title: 'Delete your data',
  description: 'How to delete your Ryan Realty account and your personal data.',
  alternates: { canonical: `${siteUrl}/data-deletion` },
  openGraph: {
    title: 'Delete your data | Ryan Realty',
    description: 'How to delete your Ryan Realty account and your personal data.',
    url: `${siteUrl}/data-deletion`,
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

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <H1 className="text-2xl tracking-tight text-primary">Delete your data</H1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2, 2026</p>
      <p className="mt-4 text-primary">
        You can have your Ryan Realty account and your personal data deleted at any time. This page
        explains what we store and how to remove it.
      </p>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>What we store</h2>
        <p className={P_CLASS}>
          When you sign in to ryan-realty.com (with Google, Facebook, or email), we store your name,
          your email, and your activity on the site such as saved homes, saved searches, and the
          listings you have viewed. When you are signed in we also keep a contact record in our CRM,
          Follow Up Boss, so our team can follow up on the homes you care for.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>How to request deletion</h2>
        <p className={P_CLASS}>
          Email{' '}
          <a href={`mailto:${contactEmail}?subject=Delete my data`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a>{' '}
          from the address tied to your account, with the subject line Delete my data. We will confirm
          your identity, delete your account and the personal data tied to it, and email you when it
          is done. We complete deletion requests within 30 days.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>If you signed in with Facebook or Google</h2>
        <p className={P_CLASS}>
          You can also remove the access you granted our app at any time. This stops future sign-ins.
          To also delete the data we already hold, email us as described above.
        </p>
        <ul className={UL_CLASS}>
          <li>
            <strong>Facebook:</strong> open Settings and privacy, then Settings, then Apps and
            websites, and remove Ryan Realty Website Login.
          </li>
          <li>
            <strong>Google:</strong> go to{' '}
            <a href="https://myaccount.google.com/permissions" className="text-accent-foreground underline hover:no-underline" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>{' '}
            and remove Ryan Realty.
          </li>
        </ul>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>What gets deleted</h2>
        <p className={P_CLASS}>
          Your account record, your profile (name and email), your saved searches, saved homes, and
          viewing history, and your contact record in Follow Up Boss. We may keep a limited record
          where the law requires it, for example a completed real estate transaction, along with
          de-identified analytics that cannot be used to identify you.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={H2_CLASS}>Contact</h2>
        <p className={P_CLASS}>
          Questions on deleting your data? Email{' '}
          <a href={`mailto:${contactEmail}`} className="text-accent-foreground underline hover:no-underline">{contactEmail}</a>.
          See our{' '}
          <a href="/privacy" className="text-accent-foreground underline hover:no-underline">privacy policy</a>{' '}
          for how we collect, use, and protect your information.
        </p>
      </section>
    </main>
  )
}
