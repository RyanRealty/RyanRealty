'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions/profile'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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
      className="mt-8 max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Display name</span>
        <Input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How we should address you"
          className="mt-1 w-full rounded-lg border border-primary/20 px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
      </Label>
      <Label className="block">
        <span className="text-sm font-medium text-muted-foreground">Phone</span>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="mt-1 w-full rounded-lg border border-primary/20 px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
      </Label>
      {initial.email && (
        <div className="block">
          <span className="text-sm font-medium text-muted-foreground">Email</span>
          <p className="mt-1 text-muted-foreground" aria-readonly>
            {initial.email}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From your sign-in provider. Change it in your Google (or other) account settings.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
        {msg === 'saved' && <span className="text-sm text-success">Saved.</span>}
        {msg === 'error' && <span className="text-sm text-destructive">Could not save.</span>}
      </div>
    </form>
  )
}
