// @data-free - auth'd account page; user-specific data via server actions, not the public cached DAL
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { getNewsletterMembershipForUserEmail } from '@/lib/data/newsletter/perLead'
import { Card } from '@/components/ui/card'
import DashboardNotificationPrefs from '@/components/dashboard/DashboardNotificationPrefs'
import { NewsletterToggle } from './NewsletterToggle'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Your email and notification preferences at Ryan Realty.',
}

// Rendered per-request automatically: getSession() reads the auth cookie, which
// opts the route out of static rendering.

export default async function AccountNotificationsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const profile = await getProfile()
  const prefs = profile?.notificationPreferences ?? {}
  // Newsletter membership for the signed-in user's email (newsletter_subscribers).
  const userEmail = session.user.email?.trim().toLowerCase() ?? ''
  const membership = await getNewsletterMembershipForUserEmail(userEmail)
  const newsletterSubscribed = membership.subscribed
  const newsletterCanSubscribe = membership.canSubscribe

  return (
    <AccountFrame>
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

      {/* ── Monthly newsletter ── */}
      <section>
        <div className="mb-3 min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Newsletter</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Your subscription to the monthly Ryan Realty newsletter.</p>
        </div>
        <NewsletterToggle initialSubscribed={newsletterSubscribed} canSubscribe={newsletterCanSubscribe} />
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
    </AccountFrame>
  )
}
