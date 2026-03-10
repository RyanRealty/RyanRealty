'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'
import { setBuyingPreferences } from '@/app/actions/buying-preferences'
import type { Profile } from '@/app/actions/profile'
import type { BuyingPreferences } from '@/app/actions/buying-preferences'

type Props = {
  profile: Profile | null
  buyingPrefs: BuyingPreferences | null
  userEmail: string
}

export default function DashboardSettingsForm({ profile, buyingPrefs, userEmail }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<'success' | 'error' | null>(null)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [defaultCity, setDefaultCity] = useState(profile?.defaultCity ?? '')
  const [maxPrice, setMaxPrice] = useState(buyingPrefs?.maxPrice ?? '')
  const [minBeds, setMinBeds] = useState(buyingPrefs?.minBeds ?? '')
  const [minBaths, setMinBaths] = useState(buyingPrefs?.minBaths ?? '')

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const err = await updateProfile({
        displayName: displayName.trim() || null,
        phone: phone.trim() || null,
        defaultCity: defaultCity.trim() || null,
      })
      setMessage(err.error ? 'error' : 'success')
      if (!err.error) router.refresh()
      setTimeout(() => setMessage(null), 3000)
    })
  }

  function handleSaveBuying(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const err = await setBuyingPreferences({
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minBeds: minBeds ? Number(minBeds) : null,
        minBaths: minBaths ? Number(minBaths) : null,
      })
      setMessage(err.error ? 'error' : 'success')
      if (!err.error) router.refresh()
      setTimeout(() => setMessage(null), 3000)
    })
  }

  return (
    <div className="mt-8 space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700">Display name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">Email</label>
            <input
              id="email"
              type="email"
              value={userEmail}
              readOnly
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
            <p className="mt-0.5 text-xs text-zinc-500">Linked to your account; change in your auth provider.</p>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">Phone</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="defaultCity" className="block text-sm font-medium text-zinc-700">Default city</label>
            <input
              id="defaultCity"
              type="text"
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              placeholder="e.g. Bend"
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Buying preferences</h2>
        <p className="mt-1 text-sm text-zinc-500">Used for personalized recommendations.</p>
        <form onSubmit={handleSaveBuying} className="mt-4 space-y-4">
          <div>
            <label htmlFor="maxPrice" className="block text-sm font-medium text-zinc-700">Max price</label>
            <input
              id="maxPrice"
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="e.g. 800000"
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="minBeds" className="block text-sm font-medium text-zinc-700">Min bedrooms</label>
            <input
              id="minBeds"
              type="number"
              min={0}
              value={minBeds}
              onChange={(e) => setMinBeds(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="minBaths" className="block text-sm font-medium text-zinc-700">Min bathrooms</label>
            <input
              id="minBaths"
              type="number"
              min={0}
              step={0.5}
              value={minBaths}
              onChange={(e) => setMinBaths(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save preferences'}
          </button>
        </form>
      </section>

      {message === 'success' && <p className="text-sm font-medium text-emerald-600" role="status">Saved.</p>}
      {message === 'error' && <p className="text-sm font-medium text-red-600" role="alert">Something went wrong.</p>}

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Delete account</h2>
        <p className="mt-1 text-sm text-zinc-600">
          To delete your account and data, please contact us. Your saved items will be removed and data anonymized; broker relationship data may be retained per our policy.
        </p>
      </section>
    </div>
  )
}
