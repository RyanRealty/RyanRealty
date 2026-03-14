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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
      <p className="mt-1 text-muted-foreground">
        Choose how and when you receive updates. Changes save automatically.
      </p>
      <DashboardNotificationPrefs initialPrefs={prefs} />
      <p className="mt-8 text-sm text-muted-foreground">
        <a href="/account" className="underline hover:text-muted-foreground">Unsubscribe from all</a> (required by CAN-SPAM).
      </p>
    </>
  )
}
