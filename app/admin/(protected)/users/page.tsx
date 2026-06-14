import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail, listAdminRoles, listPlatformUsersForAdmin } from '@/app/actions/admin-roles'
import { getBrokersForAdmin } from '@/app/actions/brokers'
import AdminUsersList from '@/app/components/admin/AdminUsersList'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  const [initialRoles, brokers, users] = await Promise.all([listAdminRoles(), getBrokersForAdmin(), listPlatformUsersForAdmin()])

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage admin access by role, and review registered site users. Sign in is via Google.
      </p>
      <AdminUsersList initialRoles={initialRoles} brokers={brokers} users={users} />
    </main>
  )
}
