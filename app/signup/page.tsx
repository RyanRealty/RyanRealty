/**
 * /signup - account create, on the v3 barrel.
 *
 * // @data-free utility page. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then the leftover SignupForm island. No sales Sheet.
 * Layout chrome already carries the wordmark. Do not re-typeset it here.
 *
 * VISITOR OBJECTIVE: Create an account to save homes, set alerts, and keep
 * search history.
 * MACHINE OBJECTIVE: Keep the email/password and OAuth capture contract
 * unchanged. Noindex.
 * EXITS: /login, /
 *
 * D11: no virtue names. No invented quote. Who is talking: We.
 */

// @data-free static utility page, no DAL access needed.
import type { Metadata } from 'next'
import SignupForm from '@/components/auth/SignupForm'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Ryan Realty account.',
  openGraph: {
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ next?: string }> }

export default async function SignupPage({ searchParams }: Props) {
  const { next } = await searchParams
  const nextPath = next && next.startsWith('/') ? next : '/account'
  const loginHref =
    nextPath !== '/account' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="utility" />
        <V3Quiet
          id="signup"
          heading="Create account"
          headingLevel={1}
          items={[
            { kind: 'prose', body: 'Save homes, set alerts, and track your search history.' },
            { label: 'Sign in', href: loginHref },
            { label: 'Back to home', href: '/' },
          ]}
        />
        {/* Leftover shadcn island. Do not rebuild SignupForm this lease. */}
        <div className="mx-auto max-w-md px-4 pb-16">
          <SignupForm next={nextPath} />
        </div>
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
