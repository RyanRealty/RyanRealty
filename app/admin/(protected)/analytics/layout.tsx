import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * Superuser-only gate. Per Phase 1 decision (2026-05-21), the comprehensive
 * analytics dashboard is locked to Matt. Paul / Rebecca per-broker views
 * land in v2.
 */
export default async function AdminAnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }
  return <>{children}</>
}
