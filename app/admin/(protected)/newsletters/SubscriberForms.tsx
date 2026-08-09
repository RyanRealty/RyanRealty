'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SelectField, TextField } from '@/components/admin/v2'
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

/**
 * Admin v2 (11F): shadcn Input/Label/Select/Button replaced by the locked admin
 * language. The Label + control pairs collapse into the field primitives, which
 * own the <label htmlFor> wiring themselves (FieldShell), so the visible label
 * and the programmatic association both survive the swap. The status toggle's
 * destructive/outline variants map to danger/quiet; v2 Button has no `size`, so
 * the sm sizing goes to the primitive's own 36px metric. Presentation only: same
 * server actions, same FormData fields, same validation, same strings.
 */

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
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        required
      />
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
      <div className="w-full sm:w-40">
        <SelectField label="Segment" value={segment} onChange={(e) => setSegment(e.target.value)}>
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add subscriber'}</Button>
      {message ? (
        <p
          className="sm:col-span-4"
          role="alert"
          style={{
            margin: 0,
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
          }}
        >
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
    <Button type="button" variant={isActive ? 'danger' : 'quiet'} onClick={onToggle} disabled={pending}>
      {pending ? '…' : isActive ? 'Remove' : 'Re-add'}
    </Button>
  )
}
