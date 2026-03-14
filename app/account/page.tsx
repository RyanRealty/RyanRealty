import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getBuyingPreferences } from '@/app/actions/buying-preferences'
import { redirect } from 'next/navigation'
import ExportMyDataButton from '@/components/ExportMyDataButton'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your account dashboard at Ryan Realty.',
}

export default async function AccountPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const [profile, savedSearches, savedKeys, savedCitySlugs, savedCommunityKeys, prefs] = await Promise.all([
    getProfile(),
    getSavedSearches(),
    getSavedListingKeys(),
    getSavedCitySlugs(),
    getSavedCommunityKeys(),
    getBuyingPreferences(),
  ])
  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const displayName = (profile?.displayName?.trim() || authName || session.user.email || 'there').split(/\s+/)[0]

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back, {displayName}</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your saved searches, favorite homes, and buying preferences.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Link
          href="/account/profile"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Profile</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Name, phone, and email
          </span>
        </Link>
        <Link
          href="/account/saved-searches"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Saved searches</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {savedSearches.length} saved
          </span>
        </Link>
        <Link
          href="/account/saved-homes"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Saved homes</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {savedKeys.length} saved
          </span>
        </Link>
        <Link
          href="/account/saved-cities"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Saved cities</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {savedCitySlugs.length} saved
          </span>
        </Link>
        <Link
          href="/account/saved-communities"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Saved communities</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {savedCommunityKeys.length} saved
          </span>
        </Link>
        <Link
          href="/account/buying-preferences"
          className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition hover:border-border hover:shadow"
        >
          <span className="text-lg font-semibold text-foreground">Buying preferences</span>
          <span className="mt-1 text-sm text-muted-foreground">
            {prefs
              ? `${prefs.downPaymentPercent}% down, ${prefs.interestRate}% rate, ${prefs.loanTermYears} yr — est. monthly payment shown on listings`
              : 'Set down payment %, interest rate, and term to see estimated monthly payment on listings'}
          </span>
        </Link>
        <div className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
          <span className="text-lg font-semibold text-foreground">Privacy & data</span>
          <span className="mt-1 text-sm text-muted-foreground">
            Download a copy of your data (saved homes, searches, profile, activity). For deletion requests, contact us.
          </span>
          <ExportMyDataButton className="mt-4" />
        </div>
      </div>
    </>
  )
}
