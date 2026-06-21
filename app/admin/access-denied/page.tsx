// @no-parity — admin utility page, not a marketing route; no mockup contract
// @data-free — static page; no @/lib/data read
// Lives OUTSIDE the (protected) route group (under the no-auth app/admin/layout.tsx)
// so a signed-in non-admin redirected here by (protected)/layout.tsx does NOT
// re-trigger the admin-role guard — no redirect loop, and the previously-dead
// /admin/access-denied target now renders a real page. Audit p0.2c.
import Link from 'next/link'

export const metadata = {
  title: 'Access denied · Ryan Realty',
  robots: { index: false, follow: false },
}

export default function AdminAccessDeniedPage() {
  return (
    <div className="console-root">
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ryan Realty</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You are signed in, but this account does not have admin access. If you think this is a
          mistake, contact the site owner to be added.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-primary underline underline-offset-4">Go home</Link>
          <Link href="/admin/login" className="text-primary underline underline-offset-4">Switch account</Link>
        </div>
      </div>
    </div>
  )
}
