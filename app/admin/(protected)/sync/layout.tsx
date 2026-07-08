import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * System health shell (consolidation 2026-07-07): Sync (pipeline status +
 * operator controls) + Spark (MLS API connection, moved from
 * /admin/spark-status). Superuser gate on this shared parent covers both.
 */
export default async function AdminSyncLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <AdminLinkTabs
          tabs={[
            { href: '/admin/sync', label: 'Sync' },
            { href: '/admin/sync/spark', label: 'Spark' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
