'use client'

/**
 * MobileContactPointsSection — interactive §25.5.4 PHONE NUMBERS + §25.5.5
 * EMAILS cards.
 *
 * FUB supports multiple phones/emails per contact; each section gets an
 * "Add phone / Add email" row that opens a small sheet (label + value) and
 * saves through addCrmContactPointAction. Action circles are live:
 *   SMS  → sms: URI (periwinkle #7595e8, pixel-verified mob-02)
 *   Call → tel: URI (mint #4ad09f)
 *   Email→ mailto: (sky #4ab8e8)
 */

import { useState, useTransition } from 'react'
import { Mail, MessageSquare, Phone, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface MobilePhoneEntry {
  id: number
  display: string
  /** tel: URI e.g. tel:+15415550123 */
  tel: string
  /** sms: URI */
  sms: string
  label: string | null
}

export interface MobileEmailEntry {
  id: number
  value: string
  label: string | null
}

function SectionHeader({ label, rightLabel }: { label: string; rightLabel?: string }) {
  return (
    <div className="flex items-center justify-between bg-secondary px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{label}</span>
      {rightLabel ? (
        <span className="text-[13px]" style={{ color: 'var(--console-info)' }}>{rightLabel}</span>
      ) : null}
    </div>
  )
}

function ActionCircle({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: typeof Phone
  label: string
  href: string
  color: string
}) {
  return (
    <a
      href={href}
      aria-label={label}
      style={{ backgroundColor: color }}
      className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95"
    >
      <Icon size={18} className="text-white" strokeWidth={2} />
    </a>
  )
}

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
  phones,
  emails,
  addContactPointAction,
}: {
  personId: number
  phones: MobilePhoneEntry[]
  emails: MobileEmailEntry[]
  addContactPointAction: (fd: FormData) => Promise<void>
}) {
  const [addKind, setAddKind] = useState<null | 'phone' | 'email'>(null)
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('Mobile')
  const [pending, startTransition] = useTransition()

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

  return (
    <>
      {/* ── §25.5.4 PHONE NUMBERS ─────────────────────────────────────────── */}
      <SectionHeader label="Phone Numbers" rightLabel={phones.length > 1 ? 'TEXT ALL...' : undefined} />
      <div className="bg-card shadow-sm">
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
              <ActionCircle icon={MessageSquare} label="Send text" href={p.sms} color="#7595e8" />
              <ActionCircle icon={Phone} label="Call" href={p.tel} color="#4ad09f" />
            </div>
          </div>
        ))}
        <AddRow label="Add phone number" onTap={() => { setLabel('Mobile'); setAddKind('phone') }} />
      </div>

      {/* ── §25.5.5 EMAILS ────────────────────────────────────────────────── */}
      <SectionHeader label="Emails" rightLabel={emails.length > 1 ? 'EMAIL ALL...' : undefined} />
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
            <ActionCircle icon={Mail} label="Email" href={`mailto:${e.value}`} color="#4ab8e8" />
          </div>
        ))}
        <AddRow label="Add email" onTap={() => { setLabel('Home'); setAddKind('email') }} />
      </div>

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
