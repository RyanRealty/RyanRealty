import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * Geography shell — one taxonomy surface (consolidation 2026-07-07):
 * Communities & geo (hierarchy editor) + Resort & master plan (subdivision
 * flags, moved from /admin/resort-communities). Superuser gate covers both,
 * same as the two pages carried separately before the merge.
 */
export default async function AdminGeoLayout({
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
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <AdminLinkTabs
          tabs={[
            { href: '/admin/geo', label: 'Communities & geo' },
            { href: '/admin/geo/resort-communities', label: 'Resort & master plan' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
