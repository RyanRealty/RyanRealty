// @no-parity — internal admin surface, no public mockup contract
//
// /admin/media — Library, the first tab of the media family. 11C: migrated to
// the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only.
//
// Carried over verbatim: the getSession + getAdminRoleForEmail superuser guard
// and its redirect('/admin/access-denied'), `dynamic = 'force-dynamic'`, and the
// <AdminMediaManager /> mount (no props, untouched — a legacy client island that
// migrates with its own unit).
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the main landmark), the page-title <h1> is gone (the nav names the page), and
// the standing description became the surface's verdict line. The 1600px page
// width is preserved as an inline maxWidth instead of a Tailwind width token.
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { VerdictLine } from '@/components/admin/v2'
import AdminMediaManager from './AdminMediaManager'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') redirect('/admin/access-denied')

  return (
    <div className="av2-scope" style={{ maxWidth: 1600, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>Branding, brokers, banners, reports.</b> Every uploaded file across those four
          storage scopes, each one marked linked or unused before you delete it.
        </VerdictLine>
      </div>

      <AdminMediaManager />
    </div>
  )
}
