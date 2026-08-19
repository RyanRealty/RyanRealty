// @no-parity — admin utility page, not a marketing route; no mockup contract
// @data-free — reads no @/lib/data; the sign-in flow lives in the client island
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: the server-side GOOGLE_OAUTH_CLIENT_ID read (deliberately
// NOT a NEXT_PUBLIC_ duplicate), the `next=` destination preservation and its
// /admin prefix check, the metadata (title + noindex), and the AdminLoginForm
// mount with both props unchanged.
//
// Shape changed, behavior did not: no ConsoleShell sits above this route, so the
// page renders its own <main>. It is on admin tokens, not the public brand — this
// is the door into the admin and it should look like what it opens (ADMIN_UI §5
// blacklists the public brand as design input for the admin). The "Ryan Realty"
// logotype became a plain quiet link home, and the "Sign in with your Ryan Realty
// Google account" line was dropped because AdminLoginForm already renders "Use
// your @ryan-realty.com Google account" directly below it.
import '@/components/admin/v2/admin-v2.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EntityTitle } from '@/components/admin/v2'
import { isSafeAdminReturnPath } from '@/lib/auth/admin-return-path'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'
import AdminLoginForm from './_components/AdminLoginForm'

export const metadata: Metadata = {
  title: 'Admin sign in',
  description: 'Sign in to the Ryan Realty admin portal.',
  robots: 'noindex, nofollow',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // Web OAuth client id for Google One Tap (FedCM). Read server-side so it never
  // needs a NEXT_PUBLIC_ duplicate; passed to the client form below.
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || null
  // Preserve the post-auth destination the (protected) layout forwarded through
  // /auth-error → here, so a deep link survives sign-in (RC5). Admin-scoped only.
  const { next } = await searchParams
  const dest = isSafeAdminReturnPath(next) ? safeRedirectPath(next) : undefined
  return (
    <main
      className="av2-scope"
      style={{
        minHeight: '100vh',
        background: 'var(--a-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--a-surface)',
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          padding: 24,
        }}
      >
        <EntityTitle>Admin sign in</EntityTitle>
        <AdminLoginForm googleClientId={googleClientId} next={dest} />
      </div>
      <p style={{ margin: '20px 0 0', fontSize: 'var(--a-text-sm)' }}>
        <Link href="/" style={{ color: 'var(--a-accent)' }}>
          Back to the site
        </Link>
      </p>
    </main>
  )
}
