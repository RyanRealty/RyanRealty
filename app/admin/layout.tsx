import { redirect } from 'next/navigation'
import { getSession } from '../actions/auth'
import { getAdminRoleForEmail } from '../actions/admin-roles'
import AdminHeader from '../components/admin/AdminHeader'
import AdminSidebar from '../components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session?.user) {
    redirect(`/auth-error?message=${encodeURIComponent('Please sign in to access the admin.')}&next=${encodeURIComponent('/admin')}`)
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    redirect('/admin/access-denied')
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <AdminHeader
        user={{
          email: session.user.email ?? '',
          avatarUrl: session.user.avatar_url ?? session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture ?? null,
          fullName: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null,
        }}
      />
      <div className="flex">
        <AdminSidebar role={adminRole.role} brokerId={adminRole.brokerId} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
