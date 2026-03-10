import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import DashboardNotificationPrefs from '@/components/dashboard/DashboardNotificationPrefs'

export const metadata: Metadata = {
  title: 'Notification Preferences',
  description: 'Manage your email and notification preferences at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardNotificationsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const profile = await getProfile()
  const prefs = profile?.notificationPreferences ?? {}

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Notifications</h1>
      <p className="mt-1 text-zinc-600">
        Choose how and when you receive updates. Changes save automatically.
      </p>
      <DashboardNotificationPrefs initialPrefs={prefs} />
      <p className="mt-8 text-sm text-zinc-500">
        <a href="/account" className="underline hover:text-zinc-700">Unsubscribe from all</a> (required by CAN-SPAM).
      </p>
    </>
  )
}
