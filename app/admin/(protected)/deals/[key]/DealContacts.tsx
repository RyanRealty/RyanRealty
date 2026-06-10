'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { saveDealContact, deleteDealContact } from '@/app/actions/tc-contacts'
import { TC_CONTACT_ROLES, TC_CONTACT_ROLE_LABEL, type TcContact } from '@/lib/tc/contact-roles'

type FormState = {
  id?: string
  role: string
  name: string
  company: string
  email: string
  phone: string
}

const EMPTY: FormState = { role: 'lender', name: '', company: '', email: '', phone: '' }

export function DealContacts({ dealId, contacts }: { dealId: string; contacts: TcContact[] }) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState | null>(null)

  const open = (c?: TcContact) =>
    setForm(
      c
        ? { id: c.id, role: c.role, name: c.name ?? '', company: c.company ?? '', email: c.email ?? '', phone: c.phone ?? '' }
        : { ...EMPTY }
    )

  const save = () => {
    if (!form) return
    startTransition(async () => {
      const res = await saveDealContact({ dealId, ...form })
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  const remove = (id: string, label: string) => {
    if (!window.confirm(`Remove ${label}?`)) return
    startTransition(async () => {
      const res = await deleteDealContact(id)
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  const set = (k: keyof FormState, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f))

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Deal team &amp; contacts</p>
        {!form ? (
          <Button size="sm" variant="outline" onClick={() => open()}>
            + Add contact
          </Button>
        ) : null}
      </div>

      {contacts.length === 0 && !form ? (
        <p className="text-sm text-muted-foreground">No contacts yet. Add the lender, title, escrow, co-agents…</p>
      ) : null}

      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-foreground">
                {c.name || c.company || c.email}
                <Badge variant="outline" className="ml-2 align-middle text-xs">
                  {TC_CONTACT_ROLE_LABEL[c.role] ?? c.role}
                </Badge>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[c.company && c.name ? c.company : null, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => open(c)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                className="text-destructive hover:text-destructive"
                onClick={() => remove(c.id, c.name || c.company || 'this contact')}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {form ? (
        <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Role
              <select
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {TC_CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {TC_CONTACT_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <Input placeholder="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input placeholder="Company" value={form.company} onChange={(e) => set('company', e.target.value)} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? 'Saving…' : form.id ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
