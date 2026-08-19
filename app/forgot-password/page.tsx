/**
 * /forgot-password - password reset, on the v3 barrel.
 *
 * // @data-free utility page. No DAL.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this is) then the leftover ForgotPasswordForm island. No sales
 * Sheet. Layout chrome already carries the wordmark. Do not re-typeset it here.
 *
 * VISITOR OBJECTIVE: Get a reset link to the email on the account.
 * MACHINE OBJECTIVE: Keep the reset-email capture contract unchanged. Noindex.
 * EXITS: /login
 *
 * D11: no virtue names. No invented quote. Who is talking: We.
 */

// @data-free static utility page, no DAL access needed.
import type { Metadata } from 'next'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Send a password reset link to your email.',
  robots: 'noindex, follow',
}

export default function ForgotPasswordPage() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <V3Quiet
          id="forgot-password"
          heading="Reset password"
          headingLevel={1}
          items={[
            { kind: 'prose', body: 'Enter your email and we will send a reset link.' },
            { label: 'Back to sign in', href: '/login' },
          ]}
        />
        {/* Leftover shadcn island. Do not rebuild ForgotPasswordForm this lease. */}
        <div className="mx-auto max-w-md px-4 pb-16">
          <ForgotPasswordForm />
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
