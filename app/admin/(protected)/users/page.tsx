// @no-parity — internal admin surface, no public mockup contract
//
// /admin/users — platform-user (site signup) viewer.
//
// Consolidation 2026-07-15: admin_roles management moved to the single team
// surface at /admin/crm/settings/team. This page only lists registered site
// accounts with their engagement counts.
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: the getSession() read, getAdminRoleForEmail, the
// superuser-only check and its redirect('/admin/access-denied'),
// listPlatformUsersForAdmin(), `export const dynamic = 'force-dynamic'`, the
// /admin/crm/settings/team href, and the AdminUsersList mount with its one prop.
//
// Shape changed, data did not: ConsoleShell owns the <main>, so the page no
// longer opens a second one. The page-title chrome is gone (the nav names the
// page — ADMIN_UI §3 acceptance bar rule 1) and the shadcn outline Button became
// the family's quiet accent link.
//
// One claim was CUT, not carried: "Sign in is via Google." This page reads
// Supabase auth.users; it does not read a provider, and the site offers
// signInWithPassword (app/actions/auth.ts) alongside OAuth, so the sentence was
// not true of every row it sat above.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail, listPlatformUsersForAdmin } from '@/app/actions/admin-roles'
import AdminUsersList from '@/app/components/admin/AdminUsersList'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  const users = await listPlatformUsersForAdmin()

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>
            {users.length.toLocaleString('en-US')} registered site{' '}
            {users.length === 1 ? 'account' : 'accounts'}.
          </b>{' '}
          Saved listings, saved searches, and activity counts are below.
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
        Admin access and roles are managed on the{' '}
        <Link href="/admin/crm/settings/team" style={{ color: 'var(--a-accent)' }}>
          team page
        </Link>
        , not here.
      </p>

      <AdminUsersList users={users} />
    </div>
  )
}
