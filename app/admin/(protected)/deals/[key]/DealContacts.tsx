'use client'

// @no-parity — internal admin tool (TC deal team & contacts)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — saveDealContact,
// deleteDealContact, the confirm/alert strings, the reloads and the edit-vs-add
// form shape are carried over unchanged.
//
// Two shape notes:
//   - The role badge is `av2-chip`, NOT a StateWord. A role ("Lender",
//     "Escrow") is DATA about the person, and .av2-state uppercases and reads
//     as a status word — states are for states.
//   - The four placeholder-only inputs became labelled TextFields. v2's form
//     pattern is label-above (ADMIN_UI §3 pattern 6) and TextField requires a
//     label, so the word moved from placeholder to label; nothing a broker
//     reads was added or removed.
import { useState, useTransition } from 'react'
import { Button, SelectField, TextField } from '@/components/admin/v2'
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
    <div className="av2-pane">
      <div className="flex items-center justify-between gap-3">
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
          Deal team &amp; contacts
        </p>
        {!form ? (
          <Button variant="quiet" onClick={() => open()}>
            + Add contact
          </Button>
        ) : null}
      </div>

      {contacts.length === 0 && !form ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
          No contacts yet. Add the lender, title, escrow, co-agents…
        </p>
      ) : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {contacts.map((c, i) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-3 py-2"
            style={{ borderTop: i ? '1px solid var(--a-border)' : undefined }}
          >
            <div className="min-w-0">
              <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                {c.name || c.company || c.email}
                <span className="av2-chip ml-2 align-middle" style={{ cursor: 'default' }}>
                  {TC_CONTACT_ROLE_LABEL[c.role] ?? c.role}
                </span>
              </p>
              <p
                className="truncate"
                style={{ margin: '2px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                {[c.company && c.name ? c.company : null, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="quiet" disabled={pending} onClick={() => open(c)}>
                Edit
              </Button>
              <Button
                variant="quiet"
                disabled={pending}
                // The shadcn control was a GHOST button in the destructive
                // colour, not a solid red one; v2 has no quiet-danger variant,
                // and `danger` is a filled button that would shout from every
                // contact row. Only the text colour is inline, so
                // .av2-btn--quiet:hover (which paints the background) still
                // fires — an inline background is what kills a hover, a colour
                // is not.
                style={{ color: 'var(--a-danger)' }}
                onClick={() => remove(c.id, c.name || c.company || 'this contact')}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {form ? (
        <div
          className="space-y-2"
          style={{
            background: 'var(--a-inset)',
            borderRadius: 'var(--a-r-md)',
            padding: 'var(--a-s3)',
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectField label="Role" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {TC_CONTACT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {TC_CONTACT_ROLE_LABEL[r]}
                </option>
              ))}
            </SelectField>
            <TextField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            <TextField label="Company" value={form.company} onChange={(e) => set('company', e.target.value)} />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <TextField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button disabled={pending} onClick={save}>
              {pending ? 'Saving…' : form.id ? 'Save' : 'Add'}
            </Button>
            <Button variant="quiet" disabled={pending} onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
