'use client'

/**
 * MobileContactPointsSection — interactive §25.5.4 PHONE NUMBERS + §25.5.5
 * EMAILS cards.
 *
 * FUB supports multiple phones/emails per contact; each section gets an
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    <div className="flex items-center justify-between bg-secondary px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{label}</span>
    </div>
  )
}

const CIRCLE_CLS =
  'flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95'

function AddRow({ label, onTap }: { label: string; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--console-info)' }}
      >
        <Plus size={14} className="text-white" strokeWidth={3} />
      </span>
      <span className="text-[15px]" style={{ color: 'var(--console-info)' }}>{label}</span>
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
      <div className="bg-card shadow-sm">
        {callNote ? (
          <p className="border-b border-border px-4 py-2 text-[13px] text-muted-foreground">{callNote}</p>
        ) : null}
        {phones.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"
            style={{ minHeight: 52 }}
          >
            <div className="min-w-0 flex-1">
              {p.label ? <p className="text-[12px] text-muted-foreground">{p.label}</p> : null}
              <p className="text-[14px] font-medium tabular-nums text-foreground">{p.display}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/admin/crm/inbox?c=${personId}&m=sms`}
                aria-label="Send text"
                className={CIRCLE_CLS}
                style={{ backgroundColor: '#7595e8' }}
              >
                <MessageSquare size={18} className="text-white" strokeWidth={2} aria-hidden />
              </Link>
              <button
                type="button"
                aria-label="Call"
                disabled={callPending}
                onClick={() => setCallOpen(true)}
                className={CIRCLE_CLS}
                style={{ backgroundColor: '#4ad09f' }}
              >
                <Phone size={18} className="text-white" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        ))}
        <AddRow label="Add phone number" onTap={() => { setLabel('Mobile'); setAddKind('phone') }} />
      </div>

      {/* ── §25.5.5 EMAILS ────────────────────────────────────────────────── */}
      <SectionHeader label="Emails" />
      <div className="bg-card shadow-sm">
        {emails.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"
            style={{ minHeight: 52 }}
          >
            <div className="min-w-0 flex-1">
              {e.label ? <p className="text-[12px] text-muted-foreground">{e.label}</p> : null}
              <p className="truncate text-[14px] font-medium text-foreground">{e.value}</p>
            </div>
            <Link
              href={`/admin/crm/inbox?c=${personId}&m=email`}
              aria-label="Email"
              className={CIRCLE_CLS}
              style={{ backgroundColor: '#4ab8e8' }}
            >
              <Mail size={18} className="text-white" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        ))}
        <AddRow label="Add email" onTap={() => { setLabel('Home'); setAddKind('email') }} />
      </div>

      {/* ── S8 calling-method sheet (same anatomy as the inbox thread's) ─── */}
      <Sheet open={callOpen} onOpenChange={setCallOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Call {personName}</SheetTitle>
            {phones[0] ? <p className="text-sm text-muted-foreground">{phones[0].display}</p> : null}
          </SheetHeader>
          <div className="mt-2 divide-y divide-border pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" className="flex w-full items-center gap-3 py-3.5 text-left" onClick={startBridgeCall}>
              <Phone className="h-5 w-5 text-foreground" aria-hidden />
              <span>
                <span className="block text-[15px] font-medium text-foreground">Call via Ryan Realty line</span>
                <span className="block text-xs text-muted-foreground">
                  Rings your cell, bridges to the contact, recorded + logged
                </span>
              </span>
            </button>
            {phones[0] ? (
              <a href={phones[0].tel} className="flex w-full items-center gap-3 py-3.5">
                <Smartphone className="h-5 w-5 text-foreground" aria-hidden />
                <span>
                  <span className="block text-[15px] font-medium text-foreground">Call direct from this phone</span>
                  <span className="block text-xs text-muted-foreground">
                    Uses your phone dialer — not tracked in the CRM
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add sheet — label picker + value input */}
      <Sheet open={addKind !== null} onOpenChange={(v) => { if (!v) { setAddKind(null); setValue('') } }}>
        <SheetContent side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0">
          <div className="flex h-[50px] shrink-0 items-center justify-between bg-primary px-4">
            <button type="button" className="text-[17px] text-primary-foreground" onClick={() => setAddKind(null)}>
              Cancel
            </button>
            <SheetTitle className="text-[17px] font-semibold text-primary-foreground">
              {addKind === 'phone' ? 'Add phone' : 'Add email'}
            </SheetTitle>
            <button
              type="button"
              disabled={pending || !value.trim()}
              className="text-[17px] text-primary-foreground disabled:opacity-60"
              onClick={save}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger className="h-11 text-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(addKind === 'phone' ? ['Mobile', 'Home', 'Work', 'Other'] : ['Home', 'Work', 'Other']).map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type={addKind === 'phone' ? 'tel' : 'email'}
              inputMode={addKind === 'phone' ? 'tel' : 'email'}
              placeholder={addKind === 'phone' ? '541-555-0123' : 'name@example.com'}
              className="h-11 text-[16px]"
            />
            <Button onClick={save} disabled={pending || !value.trim()} className="h-11 w-full">
              {pending ? 'Saving…' : addKind === 'phone' ? 'Add phone number' : 'Add email'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
