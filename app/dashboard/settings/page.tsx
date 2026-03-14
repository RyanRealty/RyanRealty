import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import DashboardSettingsForm from '@/components/dashboard/DashboardSettingsForm'

export const metadata: Metadata = {
  title: 'Settings & Preferences',
  description: 'Manage your profile and preferences at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardSettingsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const [profile, buyingPrefs] = await Promise.all([
    getProfile(),
    getBuyingPreferences(),
  ])

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Preferences</h1>
      <p className="mt-1 text-muted-foreground">
        Update your profile and buying preferences. Use Save to apply changes.
      </p>
      <DashboardSettingsForm
        profile={profile}
        buyingPrefs={buyingPrefs}
        userEmail={session.user.email ?? ''}
      />
    </>
  )
}
