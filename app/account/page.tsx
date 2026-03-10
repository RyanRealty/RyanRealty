import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getProfile } from '@/app/actions/profile'
import { getSavedSearches } from '@/app/actions/saved-searches'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
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

  const [profile, savedSearches, savedKeys, savedCommunityKeys, prefs] = await Promise.all([
    getProfile(),
    getSavedSearches(),
    getSavedListingKeys(),
    getSavedCommunityKeys(),
    getBuyingPreferences(),
  ])
  const authName = session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? null
  const displayName = (profile?.displayName?.trim() || authName || session.user.email || 'there').split(/\s+/)[0]

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Welcome back, {displayName}</h1>
      <p className="mt-1 text-zinc-600">
        Manage your saved searches, favorite homes, and buying preferences.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Link
          href="/account/profile"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <span className="text-lg font-semibold text-zinc-900">Profile</span>
          <span className="mt-1 text-sm text-zinc-500">
            Name, phone, and email
          </span>
        </Link>
        <Link
          href="/account/saved-searches"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <span className="text-lg font-semibold text-zinc-900">Saved searches</span>
          <span className="mt-1 text-sm text-zinc-500">
            {savedSearches.length} saved
          </span>
        </Link>
        <Link
          href="/account/saved-homes"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <span className="text-lg font-semibold text-zinc-900">Saved homes</span>
          <span className="mt-1 text-sm text-zinc-500">
            {savedKeys.length} saved
          </span>
        </Link>
        <Link
          href="/account/saved-communities"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <span className="text-lg font-semibold text-zinc-900">Saved communities</span>
          <span className="mt-1 text-sm text-zinc-500">
            {savedCommunityKeys.length} saved
          </span>
        </Link>
        <Link
          href="/account/buying-preferences"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow"
        >
          <span className="text-lg font-semibold text-zinc-900">Buying preferences</span>
          <span className="mt-1 text-sm text-zinc-500">
            {prefs
              ? `${prefs.downPaymentPercent}% down, ${prefs.interestRate}% rate, ${prefs.loanTermYears} yr — est. monthly payment shown on listings`
              : 'Set down payment %, interest rate, and term to see estimated monthly payment on listings'}
          </span>
        </Link>
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <span className="text-lg font-semibold text-zinc-900">Privacy & data</span>
          <span className="mt-1 text-sm text-zinc-500">
            Download a copy of your data (saved homes, searches, profile, activity). For deletion requests, contact us.
          </span>
          <ExportMyDataButton className="mt-4" />
        </div>
      </div>
    </>
  )
}
