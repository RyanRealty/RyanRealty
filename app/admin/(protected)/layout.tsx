import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import AdminHeader from '@/app/components/admin/AdminHeader'
import AdminSidebar from '@/app/components/admin/AdminSidebar'

/**
 * Auth and chrome for all admin dashboard pages. Login and setup live outside this group
 * so unauthenticated users can reach them without a redirect loop.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session?.user) {
    // Do NOT redirect to /admin/login: that page lives under app/admin/ and would be wrapped by the same
    // admin route group. Redirecting there would cause an infinite loop when the layout runs again for /admin/login.
    // Redirect to /auth-error (outside admin); that page then links to /admin/login for sign-in.
    redirect('/auth-error?next=/admin')
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    redirect('/admin/access-denied')
  }

  return (
    <div className="min-h-screen bg-muted">
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
