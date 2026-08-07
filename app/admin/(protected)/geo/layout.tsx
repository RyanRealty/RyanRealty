import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import AdminLinkTabs from '@/components/admin/AdminLinkTabs'

/**
 * Geography shell — one taxonomy surface (consolidation 2026-07-07):
 * Communities & geo (hierarchy editor) + Resort & master plan (subdivision
 * flags, moved from /admin/resort-communities). Superuser gate covers both,
 * same as the two pages carried separately before the merge.
 *
 * The third tab was added with the v2 migration: Area guide media already
 * lived under this layout and inherited its guard, but it was reachable only
 * from a sentence on the geo page and had nothing naming it. The acceptance
 * bar drops the page-title <h1>, so the nav has to carry the name.
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
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', padding: '8px 16px 0' }}>
        <AdminLinkTabs
          tabs={[
            { href: '/admin/geo', label: 'Communities & geo' },
            { href: '/admin/geo/resort-communities', label: 'Resort & master plan' },
            { href: '/admin/geo/area-guide-upload', label: 'Area guide media' },
          ]}
        />
      </div>
      {children}
    </>
  )
}
