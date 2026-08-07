// @no-parity — admin utility page, not a marketing route; no mockup contract
// @data-free — static page; no @/lib/data read
//
// Lives OUTSIDE the (protected) route group (under the no-auth app/admin/layout.tsx)
// so a signed-in non-admin redirected here by (protected)/layout.tsx does NOT
// re-trigger the admin-role guard — no redirect loop, and the previously-dead
// /admin/access-denied target now renders a real page. Audit p0.2c.
// ci:access-denied pins that location. Do not move it and do not add a guard.
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: the route location, the absence of a guard, the metadata
// (title + noindex), and both hrefs (/ and /admin/login).
//
// Shape changed, behavior did not: this page has no ConsoleShell above it, so it
// renders its own <main>. The public brand display face and the "Ryan Realty"
// eyebrow are gone — ADMIN_UI §2 puts the admin on Inter and §5 blacklists the
// public brand as design input for the admin. (Naming that face here literally
// trips ci:admin-v2-tokens, which scans text and cannot tell a comment from a
// style — the gate being strict about it is the point.)
import '@/components/admin/v2/admin-v2.css'
import Link from 'next/link'
import { EntityTitle } from '@/components/admin/v2'

export const metadata = {
  title: 'Access denied · Ryan Realty',
  robots: { index: false, follow: false },
}

export default function AdminAccessDeniedPage() {
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
      <div style={{ width: '100%', maxWidth: 420 }}>
        <EntityTitle>Access denied</EntityTitle>
        <p style={{ color: 'var(--a-text-2)', margin: '10px 0 0' }}>
          You are signed in, but this account does not have admin access. Contact the site owner
          to be added.
        </p>
        <p style={{ display: 'flex', gap: 20, margin: '24px 0 0' }}>
          <Link href="/" style={{ color: 'var(--a-accent)' }}>
            Go home
          </Link>
          <Link href="/admin/login" style={{ color: 'var(--a-accent)' }}>
            Switch account
          </Link>
        </p>
      </div>
    </main>
  )
}
