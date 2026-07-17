import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export default async function AdminExpiredListingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  // Brokers work the expireds pipeline: the dashboards that link every detail
  // row here (/admin/expireds, /admin/cmas, /admin/expired-outreach) are
  // broker-accessible, so a superuser-only gate on the detail was the audited
  // dead-end class #2 ("a broker can see the Expireds dashboard but cannot open
  // a single detail row" — shell-ia.md §6.2, fix sanctioned by spec 01 §13.3).
  // report_viewer stays bounced, matching the sibling CMAs/BPO gates.
  if (!adminRole || adminRole.role === 'report_viewer') {
    redirect('/admin/access-denied')
  }
  return <>{children}</>
}
