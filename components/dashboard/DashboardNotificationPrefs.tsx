'use client'

import { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'
import type { NotificationPreferences } from '@/app/actions/profile'

type Props = { initialPrefs: NotificationPreferences }

export default function DashboardNotificationPrefs({ initialPrefs }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailEnabled: initialPrefs?.emailEnabled ?? true,
    savedSearchFrequency: initialPrefs?.savedSearchFrequency ?? 'daily',
    priceDropAlerts: initialPrefs?.priceDropAlerts ?? true,
    statusChangeAlerts: initialPrefs?.statusChangeAlerts ?? true,
    openHouseReminders: initialPrefs?.openHouseReminders ?? true,
    marketDigestFrequency: initialPrefs?.marketDigestFrequency ?? 'weekly',
    blogUpdates: initialPrefs?.blogUpdates ?? false,
  })

  const update = useCallback((patch: Partial<NotificationPreferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      startTransition(async () => {
        const err = await updateProfile({ notificationPreferences: next })
        if (!err.error) {
          setSaved(true)
          router.refresh()
          setTimeout(() => setSaved(false), 2000)
        }
      })
      return next
    })
  }, [router])

  return (
    <div className="mt-6 space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      {saved && (
        <p className="text-sm font-medium text-emerald-600" role="status">Saved</p>
      )}
      <div className="flex items-center justify-between gap-4">
        <label className="font-medium text-zinc-900">Email notifications</label>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.emailEnabled ?? true}
          onClick={() => update({ emailEnabled: !(prefs.emailEnabled ?? true) })}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
            prefs.emailEnabled ?? true
              ? 'border-[var(--accent)] bg-[var(--accent)]'
              : 'border-zinc-300 bg-zinc-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs.emailEnabled ?? true ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div>
        <label className="font-medium text-zinc-900">Saved search matches</label>
        <select
          value={prefs.savedSearchFrequency ?? 'daily'}
          onChange={(e) => update({ savedSearchFrequency: e.target.value as 'instant' | 'daily' | 'weekly' })}
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        >
          <option value="instant">Instant</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="text-zinc-700">Price drop alerts on saved homes</label>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.priceDropAlerts ?? true}
          onClick={() => update({ priceDropAlerts: !(prefs.priceDropAlerts ?? true) })}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
            prefs.priceDropAlerts ?? true ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-zinc-300 bg-zinc-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs.priceDropAlerts ?? true ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="text-zinc-700">Status change alerts (pending/sold)</label>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.statusChangeAlerts ?? true}
          onClick={() => update({ statusChangeAlerts: !(prefs.statusChangeAlerts ?? true) })}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
            prefs.statusChangeAlerts ?? true ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-zinc-300 bg-zinc-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs.statusChangeAlerts ?? true ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="text-zinc-700">Open house reminders</label>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.openHouseReminders ?? true}
          onClick={() => update({ openHouseReminders: !(prefs.openHouseReminders ?? true) })}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
            prefs.openHouseReminders ?? true ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-zinc-300 bg-zinc-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs.openHouseReminders ?? true ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div>
        <label className="font-medium text-zinc-900">Market digest</label>
        <select
          value={prefs.marketDigestFrequency ?? 'weekly'}
          onChange={(e) => update({ marketDigestFrequency: e.target.value as 'weekly' | 'monthly' | 'off' })}
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="off">Off</option>
        </select>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label className="text-zinc-700">Blog / content updates</label>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.blogUpdates ?? false}
          onClick={() => update({ blogUpdates: !(prefs.blogUpdates ?? false) })}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
            prefs.blogUpdates ?? false ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-zinc-300 bg-zinc-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              prefs.blogUpdates ?? false ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {pending && <p className="text-sm text-zinc-500">Saving…</p>}
    </div>
  )
}
