'use client'

/**
 * MobileContactPointsSection — interactive §25.5.4 PHONE NUMBERS + §25.5.5
 * EMAILS cards.
 *
 * CRM supports multiple phones/emails per contact; each section gets an
 * "Add phone / Add email" row that opens a small sheet (label + value) and
 * saves through addCrmContactPointAction.
 *
 * Action circles (Matt punch list #4, 2026-07-02 — "I need to be able to text
 * from my CRM not open up my messaging app"):
 *   SMS   → the IN-APP thread composer (/admin/crm/inbox?c=<id>&m=sms) —
 *           compliance-gated sendCrmSmsAction, never the native sms: app.
 *   Call  → the S8 calling-method sheet (Twilio bridge via startCrmCallAction,
 *           recorded + logged; honest direct-dial tel: fallback).
 *   Email → the IN-APP email composer (/admin/crm/inbox?c=<id>&m=email).
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, MessageSquare, Phone, Plus, Smartphone } from 'lucide-react'
import { Button, SearchField, Sheet, ToolbarSelect } from '@/components/admin/v2'
import { startCrmCallAction } from '@/app/actions/crm'

export interface MobilePhoneEntry {
  id: number
  display: string
  /** tel: URI e.g. tel:+15415550123 — the untracked direct-dial fallback. */
  tel: string
  label: string | null
}

export interface MobileEmailEntry {
  id: number
  value: string
  label: string | null
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--a-bg)' }}>
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.8px]"
        style={{ color: 'var(--a-text-2)' }}
      >
        {label}
      </span>
    </div>
  )
}

const CIRCLE_CLS =
  'flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95'

/** ADMIN_UI §1: ONE action accent — the three CRM circle colours collapse to it,
 *  and the icon + accessible name carry the difference between them. */
const CIRCLE_STYLE = { backgroundColor: 'var(--a-btn-bg)', color: 'var(--a-btn-fg)' } as const

function AddRow({ label, onTap }: { label: string; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={CIRCLE_STYLE}
      >
        <Plus size={14} strokeWidth={3} />
      </span>
      <span className="text-[15px]" style={{ color: 'var(--a-accent)' }}>{label}</span>
    </button>
  )
}

export function MobileContactPointsSection({
  personId,
  personName,
  phones,
  emails,
  addContactPointAction,
}: {
  personId: number
  personName: string
  phones: MobilePhoneEntry[]
  emails: MobileEmailEntry[]
  addContactPointAction: (fd: FormData) => Promise<void>
}) {
  const [addKind, setAddKind] = useState<null | 'phone' | 'email'>(null)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('Mobile')
  const [pending, startTransition] = useTransition()
  const [callOpen, setCallOpen] = useState(false)
  const [callNote, setCallNote] = useState<string | null>(null)
  const [callPending, startCallTransition] = useTransition()

  const save = () => {
    if (!addKind || !value.trim()) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('personId', String(personId))
      fd.set('kind', addKind)
      fd.set('value', value.trim())
      fd.set('label', label)
      await addContactPointAction(fd)
      setValue('')
      setAddKind(null)
    })
  }

  const startBridgeCall = () => {
    setCallOpen(false)
    startCallTransition(async () => {
      const fd = new FormData()
      fd.set('personId', String(personId))
      const res = await startCrmCallAction(fd)
      setCallNote(
        res.ok
          ? 'Calling your cell now to connect you. The call is recorded and logged to the timeline.'
          : res.error ?? 'Could not start the call',
      )
    })
  }

  return (
    <>
      {/* ── §25.5.4 PHONE NUMBERS ─────────────────────────────────────────── */}
      <SectionHeader label="Phone Numbers" />
      <div
        style={{
          background: 'var(--a-surface)',
          borderTop: '1px solid var(--a-border)',
          borderBottom: '1px solid var(--a-border)',
        }}
      >
        {callNote ? (
          <p
            className="px-4 py-2 text-[13px]"
            style={{ borderBottom: '1px solid var(--a-border)', color: 'var(--a-text-2)' }}
          >
            {callNote}
          </p>
        ) : null}
        {phones.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ minHeight: 52, borderBottom: '1px solid var(--a-border)' }}
          >
            <div className="min-w-0 flex-1">
              {p.label ? (
                <p className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>{p.label}</p>
              ) : null}
              <p className="text-[14px] font-medium tabular-nums" style={{ color: 'var(--a-text)' }}>
                {p.display}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/admin/crm/inbox?c=${personId}&m=sms`}
                aria-label="Send text"
                className={CIRCLE_CLS}
                style={CIRCLE_STYLE}
              >
                <MessageSquare size={18} strokeWidth={2} aria-hidden />
              </Link>
              <button
                type="button"
                aria-label="Call"
                disabled={callPending}
                onClick={() => setCallOpen(true)}
                className={CIRCLE_CLS}
                style={CIRCLE_STYLE}
              >
                <Phone size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        ))}
        <AddRow label="Add phone number" onTap={() => { setLabel('Mobile'); setAddKind('phone') }} />
      </div>

      {/* ── §25.5.5 EMAILS ────────────────────────────────────────────────── */}
      <SectionHeader label="Emails" />
      <div
        style={{
          background: 'var(--a-surface)',
          borderTop: '1px solid var(--a-border)',
          borderBottom: '1px solid var(--a-border)',
        }}
      >
        {emails.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ minHeight: 52, borderBottom: '1px solid var(--a-border)' }}
          >
            <div className="min-w-0 flex-1">
              {e.label ? (
                <p className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>{e.label}</p>
              ) : null}
              <p className="truncate text-[14px] font-medium" style={{ color: 'var(--a-text)' }}>
                {e.value}
              </p>
            </div>
            <Link
              href={`/admin/crm/inbox?c=${personId}&m=email`}
              aria-label="Email"
              className={CIRCLE_CLS}
              style={CIRCLE_STYLE}
            >
              <Mail size={18} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        ))}
        <AddRow label="Add email" onTap={() => { setLabel('Home'); setAddKind('email') }} />
      </div>

      {/* ── S8 calling-method sheet (same anatomy as the inbox thread's) ─── */}
      <Sheet
        open={callOpen}
        onClose={() => setCallOpen(false)}
        title={`Call ${personName}`}
        description={phones[0] ? phones[0].display : undefined}
      >
        <div className="mt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            variant="quiet"
            className="w-full"
            style={{
              justifyContent: 'flex-start',
              gap: 12,
              minHeight: 0,
              borderRadius: 0,
              padding: '14px 0',
              fontWeight: 400,
              textAlign: 'left',
              background: 'none',
              border: 'none',
            }}
            onClick={startBridgeCall}
          >
            <Phone className="h-5 w-5" style={{ color: 'var(--a-text)' }} aria-hidden />
            <span>
              <span className="block text-[15px] font-medium" style={{ color: 'var(--a-text)' }}>
                Call via Ryan Realty line
              </span>
              <span className="block text-xs" style={{ color: 'var(--a-text-2)' }}>
                Rings your cell, bridges to the contact, recorded + logged
              </span>
            </span>
          </Button>
          {phones[0] ? (
            <a
              href={phones[0].tel}
              className="flex w-full items-center gap-3 py-3.5"
              style={{ borderTop: '1px solid var(--a-border)' }}
            >
              <Smartphone className="h-5 w-5" style={{ color: 'var(--a-text)' }} aria-hidden />
              <span>
                <span className="block text-[15px] font-medium" style={{ color: 'var(--a-text)' }}>
                  Call direct from this phone
                </span>
                <span className="block text-xs" style={{ color: 'var(--a-text-2)' }}>
                  Uses your phone dialer — not tracked in the CRM
                </span>
              </span>
            </a>
          ) : null}
        </div>
      </Sheet>

      {/* Add sheet — label picker + value input */}
      <Sheet
        open={addKind !== null}
        onClose={() => { setAddKind(null); setValue('') }}
        title={addKind === 'phone' ? 'Add phone' : 'Add email'}
      >
        <div className="space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <Button variant="quiet" onClick={() => setAddKind(null)}>
              Cancel
            </Button>
            <Button variant="quiet" disabled={pending || !value.trim()} onClick={save}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <ToolbarSelect
            aria-label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ width: '100%', maxWidth: 'none', minHeight: 44, fontSize: 16 }}
          >
            {(addKind === 'phone' ? ['Mobile', 'Home', 'Work', 'Other'] : ['Home', 'Work', 'Other']).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </ToolbarSelect>
          <SearchField
            autoFocus
            aria-label={addKind === 'phone' ? 'Phone number' : 'Email address'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={addKind === 'phone' ? 'tel' : 'email'}
            inputMode={addKind === 'phone' ? 'tel' : 'email'}
            placeholder={addKind === 'phone' ? '541-555-0123' : 'name@example.com'}
            style={{ width: '100%', maxWidth: 'none', minHeight: 44, fontSize: 16 }}
          />
          <Button onClick={save} disabled={pending || !value.trim()} touch className="w-full">
            {pending ? 'Saving…' : addKind === 'phone' ? 'Add phone number' : 'Add email'}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
