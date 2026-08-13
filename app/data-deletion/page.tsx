/**
 * /data-deletion - delete account and personal data, on the v3 barrel.
 *
 * // @data-free static legal page. Renders constant copy. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet legal page. One Quiet then Ledger. No sales Sheet.
 *
 * VISITOR OBJECTIVE: File a data-deletion request, including revoking
 * Facebook/Google app access, through a clearly named channel with a
 * stated 30-day SLA.
 * MACHINE OBJECTIVE: Satisfy the Meta/Google app data-deletion-URL
 * requirement (this URL is externally pinned).
 * EXITS: /privacy, /
 *
 * D11: no virtue names. No invented quote.
 */

// @data-free static legal page, renders constant copy, no data layer needed
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

const ITEMS: V3QuietItem[] = [
  {
    kind: 'prose',
    body: 'You can have your Ryan Realty account and your personal data deleted at any time. This page explains what we store and how to remove it.',
  },
  {
    kind: 'prose',
    term: 'What we store',
    body: 'When you sign in to ryan-realty.com (with Google, Facebook, or email), we store your name, your email, and your activity on the site such as saved homes, saved searches, and the listings you have viewed. When you are signed in we also keep a contact record in our own client-relationship system, so our team can follow up on the homes you care for.',
  },
  {
    kind: 'prose',
    term: 'How to request deletion',
    body: `Email ${contactEmail} from the address tied to your account, with the subject line Delete my data. We will confirm your identity, delete your account and the personal data tied to it, and email you when it is done. We complete deletion requests within 30 days.`,
  },
  {
    kind: 'prose',
    term: 'If you signed in with Facebook or Google',
    body: [
      'You can also remove the access you granted our app at any time. This stops future sign-ins. To also delete the data we already hold, email us as described above.',
      'Facebook: open Settings and privacy, then Settings, then Apps and websites, and remove Ryan Realty Website Login.',
      'Google: go to myaccount.google.com/permissions and remove Ryan Realty.',
    ],
  },
  {
    kind: 'prose',
    term: 'What gets deleted',
    body: 'Your account record, your profile (name and email), your saved searches, saved homes, and viewing history, and your contact record in our client-relationship system. We may keep a limited record where the law requires it, for example a completed real estate transaction, along with de-identified analytics that cannot be used to identify you.',
  },
  { label: `Email ${contactEmail} to delete my data`, href: `mailto:${contactEmail}?subject=Delete my data` },
  { label: 'Google app permissions', href: 'https://myaccount.google.com/permissions' },
]

export default function DataDeletionPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="legal" />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Delete your data' }]} />

        <V3Quiet
          id="data-deletion"
          eyebrow="Updated June 2, 2026"
          heading="Delete your data"
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
              detail: v3Text('How we collect, use, and protect your information'),
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
