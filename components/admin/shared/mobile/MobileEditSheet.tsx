'use client'

/**
 * MobileEditSheet — the §25.3.2 header "Edit" mode for the mobile contact
 * detail (Matt punch list #2, 2026-07-02: "I cannot edit leads").
 *
 * Full-screen fixed z-50 sheet (occludes tab bar + FAB — the mob-06 modal
 * pattern): accent-bar Cancel · Edit Contact · Save header over three cards:
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
import { IconButton, ToolbarSelect } from '@/components/admin/v2'
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
    <div className="px-4 py-2.5" style={{ background: 'var(--a-inset)' }}>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.8px]"
        style={{ color: 'var(--a-text-2)' }}
      >
        {label}
      </span>
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
    <div
      className="fixed inset-0 z-50 flex flex-col md:hidden"
      role="dialog"
      aria-label="Edit contact"
      style={{ background: 'var(--a-inset)', color: 'var(--a-text)', fontFamily: 'var(--a-font)' }}
    >
      {/* ── Accent header ────────────────────────────────────────────────── */}
      <div
        className="flex h-14 shrink-0 items-center justify-between px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--a-btn-bg)' }}
      >
        <button type="button" className="text-[16px]" style={{ color: 'var(--a-btn-fg)' }} onClick={onClose}>
          Cancel
        </button>
        <span className="text-[17px] font-semibold" style={{ color: 'var(--a-btn-fg)' }}>Edit Contact</span>
        <button
          type="button"
          disabled={pending || !dirty}
          className="text-[16px] font-semibold disabled:opacity-50"
          style={{ color: 'var(--a-btn-fg)' }}
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {error ? (
          <p
            className="px-4 py-2.5 text-[13px]"
            style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)' }}
          >
            {error}
          </p>
        ) : null}

        {/* ── NAME ─────────────────────────────────────────────────────────── */}
        <SectionHeader label="Name" />
        <div className="space-y-3 p-4" style={{ background: 'var(--a-surface)' }}>
          <input
            className="av2-input w-full"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            aria-label="First name"
            style={{ fontSize: 16 }}
          />
          <input
            className="av2-input w-full"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            aria-label="Last name"
            style={{ fontSize: 16 }}
          />
        </div>

        {/* ── PHONE NUMBERS ───────────────────────────────────────────────── */}
        <SectionHeader label="Phone Numbers" />
        <div style={{ background: 'var(--a-surface)' }}>
          {phones.map((p, i) => (
            <div key={i} className="space-y-2 p-4" style={{ borderBottom: '1px solid var(--a-border)' }}>
              <div className="flex items-center gap-2">
                <ToolbarSelect
                  aria-label="Phone label"
                  value={p.label}
                  onChange={(e) => setPhone(i, { label: e.target.value })}
                  className="w-28 shrink-0"
                  style={{ minHeight: 40, fontSize: 14 }}
                >
                  {PHONE_LABELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </ToolbarSelect>
                <input
                  className="av2-input min-w-0 flex-1"
                  value={p.value}
                  onChange={(e) => setPhone(i, { value: e.target.value })}
                  type="tel"
                  inputMode="tel"
                  placeholder="541-555-0123"
                  aria-label="Phone number"
                  style={{ fontSize: 15 }}
                />
                <IconButton
                  label="Remove phone"
                  tone="danger"
                  className="shrink-0"
                  onClick={() => setPhones((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" aria-hidden />
                </IconButton>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[13px]"
                style={{ color: p.isPrimary ? 'var(--a-accent)' : undefined }}
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
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--a-btn-bg)' }}>
              <Plus size={14} strokeWidth={3} aria-hidden style={{ color: 'var(--a-btn-fg)' }} />
            </span>
            <span className="text-[15px]" style={{ color: 'var(--a-accent)' }}>Add phone number</span>
          </button>
        </div>

        {/* ── EMAILS ──────────────────────────────────────────────────────── */}
        <SectionHeader label="Emails" />
        <div style={{ background: 'var(--a-surface)' }}>
          {emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 p-4" style={{ borderBottom: '1px solid var(--a-border)' }}>
              <input
                className="av2-input min-w-0 flex-1"
                value={e.value}
                onChange={(ev) => setEmails((rows) => rows.map((r, idx) => (idx === i ? { ...r, value: ev.target.value } : r)))}
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                aria-label="Email address"
                style={{ fontSize: 15 }}
              />
              <IconButton
                label="Remove email"
                tone="danger"
                className="shrink-0"
                onClick={() => {
                  const row = emails[i]
                  if (row?.prev) setRemovedEmails((rm) => [...rm, row.prev!])
                  setEmails((rows) => rows.filter((_, idx) => idx !== i))
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => setEmails((rows) => [...rows, { prev: null, value: '' }])}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--a-btn-bg)' }}>
              <Plus size={14} strokeWidth={3} aria-hidden style={{ color: 'var(--a-btn-fg)' }} />
            </span>
            <span className="text-[15px]" style={{ color: 'var(--a-accent)' }}>Add email</span>
          </button>
        </div>
      </div>
    </div>
  )
}
