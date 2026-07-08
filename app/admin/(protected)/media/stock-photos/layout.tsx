import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/** Stock APIs use developer keys — superuser only (same bar as Banners). */
export default async function StockPhotosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  return <>{children}</>
}
