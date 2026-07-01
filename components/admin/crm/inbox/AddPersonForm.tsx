'use client'

/**
 * AddPersonForm — the Inbox unknown-caller "Add Person" affordance (spec §9,
 * AC-19/AC-20/AC-35). Rendered inline in the reading pane's contact panel (NOT a
 * Dialog/Sheet) when the open conversation is still an unidentified caller.
 *
 * Submitting names the existing placeholder contact (first/last + optional email)
 * via the bound server action; on success the page refreshes and the thread shows
 * the real name. "Search Google" opens a lookup for the number in a new tab. No
 * message is ever sent from here.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AddPersonForm({
  phone,
  addAction,
}: {
  phone: string | null
  addAction: (firstName: string, lastName: string, email: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const googleHref = phone
    ? `https://www.google.com/search?q=${encodeURIComponent(phone)}`
    : null

  function submit() {
    if (!first.trim() && !last.trim()) {
      setError('Enter a first or last name')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await addAction(first, last, email)
      if (!res.ok) {
        setError(res.error ?? 'Could not add the contact')
        return
      }
      setFirst('')
      setLast('')
      setEmail('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add person</div>
      <p className="text-xs text-muted-foreground">
        This conversation is from an unrecognized {phone ? 'number' : 'contact'}. Name it to add a contact record.
      </p>

      <div className="space-y-1">
        <Label htmlFor="ap-first" className="text-xs">First name</Label>
        <Input id="ap-first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ap-last" className="text-xs">Last name</Label>
        <Input id="ap-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ap-email" className="text-xs">Email</Label>
        <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="Optional" />
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? 'Adding…' : 'Add person'}
        </Button>
        {googleHref ? (
          <a href={googleHref} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            Search Google
          </a>
        ) : null}
      </div>
      </CardContent>
    </Card>
  )
}
