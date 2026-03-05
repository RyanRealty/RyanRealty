'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'

type Props = {
  initial: {
    displayName?: string
    phone?: string
    email?: string
  }
}

export default function ProfileForm({ initial }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initial.displayName ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'error' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const { error } = await updateProfile({
      displayName: displayName.trim() || null,
      phone: phone.trim() || null,
    })
    setSaving(false)
    setMsg(error ? 'error' : 'saved')
    if (!error) router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Display name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How we should address you"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Phone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
        />
      </label>
      {initial.email && (
        <div className="block">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <p className="mt-1 text-zinc-600" aria-readonly>
            {initial.email}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            From your sign-in provider. Change it in your Google (or other) account settings.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {msg === 'saved' && <span className="text-sm text-emerald-600">Saved.</span>}
        {msg === 'error' && <span className="text-sm text-red-600">Could not save.</span>}
      </div>
    </form>
  )
}
