// @data-free - auth'd account page; user-specific data via server actions, not the public cached DAL
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { Card } from '@/components/ui/card'
import DashboardNotificationPrefs from '@/components/dashboard/DashboardNotificationPrefs'

export const metadata: Metadata = {
  title: 'Notification Preferences',
  description: 'Manage your email and notification preferences at Ryan Realty.',
}

// Rendered per-request automatically: getSession() reads the auth cookie, which
// opts the route out of static rendering.

export default async function AccountNotificationsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const profile = await getProfile()
  const prefs = profile?.notificationPreferences ?? {}

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how and when you receive updates. Changes save automatically.
        </p>
      </header>

      {/* ── Notification preferences ── */}
      <section>
        <div className="mb-3 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Email and alerts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Pick the updates you want and how often we send them.</p>
        </div>
        <DashboardNotificationPrefs initialPrefs={prefs} />
      </section>

      {/* ── Unsubscribe ── */}
      <section>
        <Card className="flex flex-col items-start gap-2 p-4">
          <span className="text-sm font-semibold text-foreground">Unsubscribe</span>
          <span className="text-xs text-muted-foreground">
            Turning off email notifications above stops every alert email from Ryan Realty
            (required by CAN-SPAM). To stop or edit one search, manage your saved searches.
            Every email we send also carries its own one-click unsubscribe link.
          </span>
          <Link href="/account/saved-searches" className="mt-1 text-sm font-medium text-primary hover:underline">
            Manage saved searches and alerts
          </Link>
        </Card>
      </section>
    </div>
  )
}
