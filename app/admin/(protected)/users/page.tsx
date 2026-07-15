import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail, listPlatformUsersForAdmin } from '@/app/actions/admin-roles'
import AdminUsersList from '@/app/components/admin/AdminUsersList'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * /admin/users — platform-user (site signup) viewer.
 *
 * Consolidation 2026-07-15: admin_roles management moved to the single team
 * surface at /admin/crm/settings/team. This page now only lists registered
 * site accounts with their engagement counts.
 */
export default async function AdminUsersPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  const users = await listPlatformUsersForAdmin()

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Site users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registered site accounts with saved listings, searches, and activity. Sign in is via
            Google. Admin access and roles are managed on the team page.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0">
          <Link href="/admin/crm/settings/team">Manage admin roles</Link>
        </Button>
      </div>
      <AdminUsersList users={users} />
    </main>
  )
}
