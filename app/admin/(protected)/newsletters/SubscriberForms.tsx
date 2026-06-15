'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminAddSubscriberAction,
  adminSetSubscriberStatusAction,
} from '@/app/actions/newsletter'
import type { SubscriberStatus } from '@/lib/data'

const SEGMENTS: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'past-client', label: 'Past client' },
]

/** Add a subscriber by email + segment. */
export function AddSubscriberForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('general')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!email.trim()) {
      setMessage({ type: 'err', text: 'Enter an email address.' })
      return
    }
    const fd = new FormData()
    fd.set('email', email.trim())
    fd.set('name', name.trim())
    fd.set('segment', segment)
    startTransition(async () => {
      const r = await adminAddSubscriberAction(fd)
      if (r.ok) {
        setMessage({ type: 'ok', text: 'Subscriber added.' })
        setEmail('')
        setName('')
        setSegment('general')
        router.refresh()
      } else {
        setMessage({ type: 'err', text: r.error === 'invalid_email' ? 'That email looks invalid.' : 'Could not add the subscriber.' })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="sub-email">Email</Label>
        <Input id="sub-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-name">Name</Label>
        <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-segment">Segment</Label>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger id="sub-segment" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add subscriber'}</Button>
      {message ? (
        <p className={message.type === 'ok' ? 'text-sm text-success sm:col-span-4' : 'text-sm text-destructive sm:col-span-4'} role="alert">
          {message.text}
        </p>
      ) : null}
    </form>
  )
}

/** Per-row remove (→ unsubscribed) / re-add (→ active) toggle. */
export function SubscriberStatusToggle({ id, status }: { id: string; status: SubscriberStatus }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isActive = status === 'active'

  function onToggle() {
    const next: SubscriberStatus = isActive ? 'unsubscribed' : 'active'
    startTransition(async () => {
      const r = await adminSetSubscriberStatusAction(id, next)
      if (r.ok) router.refresh()
    })
  }

  return (
    <Button type="button" size="sm" variant={isActive ? 'destructive' : 'outline'} onClick={onToggle} disabled={pending}>
      {pending ? '…' : isActive ? 'Remove' : 'Re-add'}
    </Button>
  )
}
