'use client'

/**
 * MobileEditSheet — the §25.3.2 header "Edit" mode for the mobile contact
 * detail (Matt punch list #2, 2026-07-02: "I cannot edit leads").
 *
 * Full-screen fixed z-50 sheet (occludes tab bar + FAB — the mob-06 modal
 * pattern): navy Cancel · Edit Contact · Save header over three cards:
 *   NAME           — first / last inputs → updatePersonNameAction
 *   PHONE NUMBERS  — per-row label select + number input + primary + remove,
 *                    add row → savePhoneNumbersAction (atomic replace, §07a)
 *   EMAILS         — per-row input + remove, add row → saveEmailRowAction
 *                    (per-row add/update/remove diff)
 *
 * All writes go through the existing scope-gated §07 actions — no new paths.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  savePhoneNumbersAction,
  saveEmailRowAction,
  updatePersonNameAction,
  type PhoneRow,
} from '@/app/actions/crm-person-detail'

export interface MobileEditData {
  firstName: string
  lastName: string
  phones: PhoneRow[]
  emails: string[]
}

const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Other', 'Fax']

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-secondary px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{label}</span>
    </div>
  )
}

export default function MobileEditSheet({
  personId,
  initial,
  onClose,
}: {
  personId: number
  initial: MobileEditData
  onClose: () => void
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [phones, setPhones] = useState<PhoneRow[]>(initial.phones)
  // Emails carry their ORIGINAL value so edits/removals diff explicitly (a
  // positional diff mis-fires when a middle row is removed).
  const [emails, setEmails] = useState<Array<{ prev: string | null; value: string }>>(
    initial.emails.map((e) => ({ prev: e, value: e })),
  )
  const [removedEmails, setRemovedEmails] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = useMemo(() => {
    return (
      firstName !== initial.firstName ||
      lastName !== initial.lastName ||
      JSON.stringify(phones) !== JSON.stringify(initial.phones) ||
      removedEmails.length > 0 ||
      emails.some((e) => e.prev !== e.value)
    )
  }, [firstName, lastName, phones, emails, removedEmails, initial])

  const setPhone = (i: number, patch: Partial<PhoneRow>) =>
    setPhones((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const setPrimary = (i: number) =>
    setPhones((rows) => rows.map((r, idx) => ({ ...r, isPrimary: idx === i })))

  const save = () => {
    setError(null)
    startTransition(async () => {
      // 1) Name.
      if (firstName !== initial.firstName || lastName !== initial.lastName) {
        const r = await updatePersonNameAction(personId, firstName, lastName)
        if (!r.ok) { setError(r.error); return }
      }
      // 2) Phones — atomic replace when the set changed.
      if (JSON.stringify(phones) !== JSON.stringify(initial.phones)) {
        const r = await savePhoneNumbersAction(personId, phones)
        if (!r.ok) { setError(r.error); return }
      }
      // 3) Emails — explicit per-row diff (removals first, then edits/adds).
      for (const prev of removedEmails) {
        const r = await saveEmailRowAction(personId, prev, '')
        if (!r.ok) { setError(r.error); return }
      }
      for (const e of emails) {
        const next = e.value.trim()
        if ((e.prev ?? '') === next || (!e.prev && !next)) continue
        const r = await saveEmailRowAction(personId, e.prev, next)
        if (!r.ok) { setError(r.error); return }
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-secondary md:hidden" role="dialog" aria-label="Edit contact">
      {/* ── Navy header ──────────────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center justify-between bg-primary px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button type="button" className="text-[16px] text-primary-foreground" onClick={onClose}>
          Cancel
        </button>
        <span className="text-[17px] font-semibold text-primary-foreground">Edit Contact</span>
        <button
          type="button"
          disabled={pending || !dirty}
          className="text-[16px] font-semibold text-primary-foreground disabled:opacity-50"
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {error ? <p className="bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">{error}</p> : null}

        {/* ── NAME ─────────────────────────────────────────────────────────── */}
        <SectionHeader label="Name" />
        <div className="space-y-3 bg-card p-4 shadow-sm">
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            aria-label="First name"
            className="h-11 text-[16px]"
          />
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            aria-label="Last name"
            className="h-11 text-[16px]"
          />
        </div>

        {/* ── PHONE NUMBERS ───────────────────────────────────────────────── */}
        <SectionHeader label="Phone Numbers" />
        <div className="bg-card shadow-sm">
          {phones.map((p, i) => (
            <div key={i} className="space-y-2 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Select value={p.label} onValueChange={(v) => setPhone(i, { label: v })}>
                  <SelectTrigger className="h-10 w-28 shrink-0 text-[14px]" aria-label="Phone label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_LABELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={p.value}
                  onChange={(e) => setPhone(i, { value: e.target.value })}
                  type="tel"
                  inputMode="tel"
                  placeholder="541-555-0123"
                  aria-label="Phone number"
                  className="h-10 flex-1 text-[15px]"
                />
                <button
                  type="button"
                  aria-label="Remove phone"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                  onClick={() => setPhones((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[13px]"
                style={{ color: p.isPrimary ? 'var(--console-info)' : undefined }}
                onClick={() => setPrimary(i)}
              >
                <Check className={p.isPrimary ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 opacity-30'} aria-hidden />
                {p.isPrimary ? 'Primary' : 'Make primary'}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => setPhones((rows) => [...rows, { value: '', label: 'Mobile', bad: false, isPrimary: rows.length === 0 }])}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--console-info)' }}>
              <Plus size={14} className="text-white" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-[15px]" style={{ color: 'var(--console-info)' }}>Add phone number</span>
          </button>
        </div>

        {/* ── EMAILS ──────────────────────────────────────────────────────── */}
        <SectionHeader label="Emails" />
        <div className="bg-card shadow-sm">
          {emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border p-4">
              <Input
                value={e.value}
                onChange={(ev) => setEmails((rows) => rows.map((r, idx) => (idx === i ? { ...r, value: ev.target.value } : r)))}
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                aria-label="Email address"
                className="h-10 flex-1 text-[15px]"
              />
              <button
                type="button"
                aria-label="Remove email"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const row = emails[i]
                  if (row?.prev) setRemovedEmails((rm) => [...rm, row.prev!])
                  setEmails((rows) => rows.filter((_, idx) => idx !== i))
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => setEmails((rows) => [...rows, { prev: null, value: '' }])}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--console-info)' }}>
              <Plus size={14} className="text-white" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-[15px]" style={{ color: 'var(--console-info)' }}>Add email</span>
          </button>
        </div>
      </div>
    </div>
  )
}
