/**
 * /auth-error - sign-in failure, on the v3 barrel.
 *
 * // @data-free utility page. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet recovery. No form. No sales Sheet. Layout chrome already carries
 * the wordmark.
 *
 * VISITOR OBJECTIVE: See why sign-in failed and try again or go home.
 * MACHINE OBJECTIVE: Keep the next-path plumbing to /login and /admin/login.
 * Noindex.
 * EXITS: /login, /admin/login, /
 *
 * D11: no virtue names. No invented quote. Who is talking: We.
 */

// @data-free static utility page, no DAL access needed.
import type { Metadata } from 'next'
import { adminLoginHref, isSafeAdminReturnPath } from '@/lib/auth/admin-return-path'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const callbackUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://yoursite.com').replace(/\/$/, '')}/auth/callback`

export const metadata: Metadata = {
  title: 'Sign-in issue',
  description: 'We could not sign you in. Try again or return home.',
  alternates: { canonical: `${siteUrl}/auth-error` },
  robots: 'noindex, follow',
}

type Props = { searchParams: Promise<{ message?: string; next?: string }> }

export default async function AuthErrorPage({ searchParams }: Props) {
  const { message, next } = await searchParams
  const tryAgainHref = isSafeAdminReturnPath(next)
    ? adminLoginHref(next ?? '/admin')
    : next && next.startsWith('/')
      ? `/login?next=${encodeURIComponent(next)}`
      : '/login'
  let decodedMessage = 'We could not sign you in.'
  if (message) {
    try {
      decodedMessage = decodeURIComponent(message)
    } catch {
      decodedMessage = message
    }
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Quiet
          id="auth-error"
          heading="Sign-in issue"
          headingLevel={1}
          items={[
            { kind: 'prose', body: decodedMessage },
            {
              kind: 'prose',
              body: `If you use Google sign-in, add ${callbackUrl} under Supabase Authentication, URL Configuration, Redirect URLs.`,
            },
            { label: 'Try again', href: tryAgainHref },
            { label: 'Back to home', href: '/' },
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
