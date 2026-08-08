// @no-parity — admin utility page, not a marketing route; no mockup contract
// @data-free — reads no @/lib/data; getSetupComplete is a server action
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: the getSetupComplete() read, the redirect('/admin') when
// setup is already complete, `export const dynamic = 'force-dynamic'`, the metadata
// (title + noindex), and the AdminSetupClient mount (it takes no props).
//
// Shape changed, behavior did not: no ConsoleShell sits above this route, so the
// page keeps its own <main>. It is on admin tokens, not the public brand — this is
// the first-run door into the admin (ADMIN_UI §5). The sub-line now says what the
// island actually does: AdminSetupClient is a three-step wizard whose last step
// calls setSetupComplete() and pushes to /admin.
import '@/components/admin/v2/admin-v2.css'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSetupComplete } from '@/app/actions/admin-setup'
import { EntityTitle } from '@/components/admin/v2'
import AdminSetupClient from './_components/AdminSetupClient'

export const metadata: Metadata = {
  title: 'Admin setup',
  description: 'First-run admin setup.',
  robots: 'noindex, nofollow',
}

export const dynamic = 'force-dynamic'

export default async function AdminSetupPage() {
  const complete = await getSetupComplete()
  if (complete) redirect('/admin')

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
          maxWidth: 420,
          background: 'var(--a-surface)',
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          padding: 24,
        }}
      >
        <EntityTitle>Admin setup</EntityTitle>
        <p style={{ color: 'var(--a-text-2)', margin: '10px 0 0' }}>
          Three steps. The last one marks setup complete and opens the admin.
        </p>
        <AdminSetupClient />
      </div>
    </main>
  )
}
