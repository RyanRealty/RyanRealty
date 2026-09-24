'use client'

/**
 * The signer's page. Every field on the documents works the way it prints:
 * signatures and initials by tap, text in a box, dates and times from the
 * phone's own calendar and clock pickers, checkboxes by tap with their
 * group's rule shown. Start and Next walk the signer through what they owe
 * (lib/tc/field-rules.ts signerChecklist); the broker's own fields are locked
 * and other signers' finished values show read-only. The signing date, time
 * and name are stamped by the server when the signer finishes.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PdfPages } from './pdf-pages'
import { SignaturePad, scriptTextToPng } from './SignaturePad'
import { initialsFromFullName } from '@/lib/tc/adopt-signature'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { recordSigningConsent, recordSigningView, submitSigning, declineSigning } from '@/app/actions/tc-sign'
import type { SigningPayload, SubmitFieldValue } from '@/app/actions/tc-sign'
import type { EnvelopeField, SignFieldValue } from '@/lib/tc/signing'
import { signerBlockColor } from '@/lib/tc/signing'
import {
  AUTO_STAMPED_TYPES,
  dateValue,
  fieldOwner,
  groupRuleText,
  nextChecklistItem,
  pacificStamp,
  signerChecklist,
  timeValue,
  valueText,
  type ChecklistItem,
} from '@/lib/tc/field-rules'
import { ESIGN_CONSENT_SUMMARY, esignDisclosure } from '@/lib/tc/esign-consent'
import { cn } from '@/lib/utils'

type Values = Map<string, SignFieldValue>

export function SignFlow({ token, payload }: { token: string; payload: SigningPayload }) {
  const [consented, setConsented] = useState(payload.consented)
  const [agree, setAgree] = useState(false)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [values, setValues] = useState<Values>(() => {
    const m: Values = new Map()
    for (const f of payload.fields) if (f.value && fieldOwner(f, payload.recipientId) === 'mine') m.set(f.id, f.value)
    return m
  })
  const [pad, setPad] = useState<EnvelopeField | null>(null)
  const [adopted, setAdopted] = useState<{ signaturePng: string; initialsPng: string } | null>(null)
  const [editing, setEditing] = useState<EnvelopeField | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | 'completed' | 'partial' | 'declined'>(null)
  const [error, setError] = useState<string | null>(null)
  const [stamp, setStamp] = useState<{ date: string; time: string } | null>(null)
  const viewed = useRef(false)

  // The browser's clock, read after hydration so the server's render never disagrees with it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStamp(pacificStamp(new Date())), [])
  // The first real look, recorded from the browser (a mail scanner never runs this).
  useEffect(() => {
    if (!consented || viewed.current) return
    viewed.current = true
    void recordSigningView(token)
  }, [consented, token])

  const mine = useMemo(() => payload.fields.filter((f) => fieldOwner(f, payload.recipientId) === 'mine'), [payload.fields, payload.recipientId])
  const docOrder = useMemo(() => payload.documents.map((d) => d.documentId), [payload.documents])
  const checklist = useMemo(() => signerChecklist(payload.fields, payload.recipientId, values, docOrder), [payload.fields, payload.recipientId, values, docOrder])
  const required = checklist.filter((i) => i.required)
  const requiredDone = required.filter((i) => i.done).length
  const allDone = required.every((i) => i.done)
  const needsAdopt = mine.some((f) => f.type === 'signature' || f.type === 'initials')
  const activeItem = checklist.find((i) => i.id === activeId) ?? null
  const colorByRecipient = useMemo(() => {
    const ids = [...new Set(payload.fields.map((f) => f.recipientId).filter(Boolean))] as string[]
    return new Map(ids.map((id, i) => [id, signerBlockColor(i)]))
  }, [payload.fields])

  function focusItem(item: ChecklistItem | null, openEditor: boolean) {
    if (!item) {
      setActiveId(null)
      return
    }
    setActiveId(item.id)
    requestAnimationFrame(() => document.getElementById(`sign-field-${item.firstFieldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    const f = mine.find((m) => m.id === item.firstFieldId)
    if (openEditor && f && (f.type === 'text' || f.type === 'date' || f.type === 'time')) setEditing(f)
  }

  function next(openEditor = true) {
    focusItem(nextChecklistItem(checklist, activeId), openEditor)
  }

  function setValue(fieldId: string, v: SignFieldValue | null) {
    setValues((m) => {
      const out = new Map(m)
      if (v) out.set(fieldId, v)
      else out.delete(fieldId)
      return out
    })
  }

  function applyMark(field: EnvelopeField) {
    setActiveId(checklist.find((i) => i.fieldIds.includes(field.id))?.id ?? null)
    if (!adopted) {
      setPad(field)
      return
    }
    setValue(field.id, field.type === 'initials' ? { kind: 'initials', png: adopted.initialsPng } : { kind: 'signature', png: adopted.signaturePng })
  }

  function adopt(png: string) {
    const initials = scriptTextToPng(initialsFromFullName(payload.recipientName)) ?? png
    setAdopted({ signaturePng: png, initialsPng: initials })
    return initials
  }

  async function consent() {
    setBusy(true)
    const res = await recordSigningConsent(token)
    setBusy(false)
    if (res.ok) setConsented(true)
    else setError(res.error ?? 'Could not record consent')
  }

  async function finish() {
    setError(null)
    if (!allDone) {
      next()
      return
    }
    setBusy(true)
    const out: SubmitFieldValue[] = [...values.entries()]
      .filter(([id]) => mine.some((f) => f.id === id && !AUTO_STAMPED_TYPES.has(f.type)))
      .map(([fieldId, value]) => ({ fieldId, value }))
    const res = await submitSigning(token, out)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not submit')
      if (res.fieldId) focusItem(checklist.find((i) => i.fieldIds.includes(res.fieldId!)) ?? null, false)
      return
    }
    setDone(res.completed ? 'completed' : 'partial')
  }

  async function decline() {
    setBusy(true)
    const res = await declineSigning(token, declineReason)
    setBusy(false)
    setDeclineOpen(false)
    if (res.ok) setDone('declined')
    else setError(res.error ?? 'Could not decline')
  }

  if (done) {
    const copy =
      done === 'completed'
        ? { title: 'All signed and complete', body: 'Every party has signed. A completed copy is on its way to your email.' }
        : done === 'declined'
          ? { title: 'You declined', body: 'Nothing was signed. Your broker has been told and will be in touch.' }
          : { title: 'Thank you', body: 'Your part is done. When everyone has signed, a completed copy is emailed to you.' }
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
      </div>
    )
  }

  if (!consented) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-2xl font-bold text-foreground">Review and sign for {payload.propertyAddress}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hi {payload.recipientName}, you have documents ready to sign. Before you start, please agree to sign electronically.
        </p>
        <Card className="mt-6 space-y-4 p-4">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" aria-label="I agree to sign electronically" />
            <span className="text-muted-foreground">{ESIGN_CONSENT_SUMMARY}</span>
          </label>
          <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => setShowDisclosure((v) => !v)}>
            {showDisclosure ? 'Hide the full disclosure' : 'Read the full disclosure'}
          </Button>
          {showDisclosure ? (
            <div className="space-y-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {esignDisclosure().map((d) => (
                <div key={d.heading}>
                  <p className="font-medium text-foreground">{d.heading}</p>
                  <p className="mt-0.5">{d.text}</p>
                </div>
              ))}
            </div>
          ) : null}
          <Button className="w-full" disabled={!agree || busy} onClick={consent}>
            Agree and review documents
          </Button>
        </Card>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    )
  }

  if (needsAdopt && !adopted) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-2xl font-bold text-foreground">Adopt your signature</h1>
        <p className="mt-3 text-sm text-muted-foreground">Draw it, type it, or upload a picture. Then tap each Sign box on the documents. Nothing to install.</p>
        <SignaturePad open onOpenChange={() => undefined} title="Adopt your signature" defaultName={payload.recipientName} confirmLabel="Adopt and start signing" onComplete={adopt} />
      </div>
    )
  }

  const started = activeId != null || checklist.some((i) => i.done)
  return (
    <div className="mx-auto max-w-3xl px-2 pb-36 pt-4 sm:px-3">
      <div className="mb-4 px-1">
        <h1 className="font-display text-xl font-bold text-foreground">{payload.propertyAddress}</h1>
        <p className="text-sm text-muted-foreground">{payload.envelopeName}</p>
        {adopted ? (
          <Button variant="link" size="sm" className="h-auto px-0 text-xs text-muted-foreground" onClick={() => setAdopted(null)}>
            Change signature
          </Button>
        ) : null}
      </div>

      {payload.documents.map((doc) => (
        <div key={doc.documentId} className="mb-6">
          <p className="mb-2 px-1 text-sm font-medium text-foreground">{doc.name}</p>
          <PdfPages
            url={doc.url}
            overlay={(pageNumber, size) => (
              <>
                {payload.fields
                  .filter((f) => f.documentId === doc.documentId && f.page === pageNumber)
                  .map((f) => (
                    <FieldBox
                      key={f.id}
                      field={f}
                      size={size}
                      owner={fieldOwner(f, payload.recipientId)}
                      color={colorByRecipient.get(f.recipientId ?? '') ?? '#2563eb'}
                      value={fieldOwner(f, payload.recipientId) === 'mine' ? values.get(f.id) ?? null : f.value}
                      stamp={stamp}
                      recipientName={payload.recipientName}
                      active={!!activeItem?.fieldIds.includes(f.id)}
                      onSign={() => applyMark(f)}
                      onEdit={() => {
                        setActiveId(checklist.find((i) => i.fieldIds.includes(f.id))?.id ?? null)
                        setEditing(f)
                      }}
                      onCheck={(checked) => {
                        setActiveId(checklist.find((i) => i.fieldIds.includes(f.id))?.id ?? null)
                        setValue(f.id, { kind: 'checkbox', checked })
                      }}
                    />
                  ))}
              </>
            )}
          />
        </div>
      ))}

      {/* What is left, and the way through it */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="flex items-center gap-3">
            <Progress value={required.length ? (requiredDone / required.length) * 100 : 100} className="h-1.5 flex-1" aria-label="Required fields done" />
            <span className="shrink-0 text-xs text-muted-foreground">
              {requiredDone} of {required.length} required
            </span>
          </div>
          {activeItem && !activeItem.done ? <p className="truncate text-xs text-foreground">{activeItem.prompt}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeclineOpen(true)} disabled={busy}>
              Decline
            </Button>
            <div className="flex items-center gap-2">
              {!allDone ? (
                <Button onClick={() => next()} disabled={busy}>
                  {started ? 'Next' : 'Start'}
                </Button>
              ) : null}
              <Button onClick={finish} disabled={busy || !allDone} variant={allDone ? 'default' : 'outline'}>
                {busy ? 'Submitting…' : 'Finish signing'}
              </Button>
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>

      <FieldEditor
        key={editing?.id ?? 'none'}
        field={editing}
        value={editing ? values.get(editing.id) ?? null : null}
        onClose={() => setEditing(null)}
        onSave={(v, andNext) => {
          if (!editing) return
          setValue(editing.id, v)
          setEditing(null)
          if (andNext) requestAnimationFrame(() => next())
        }}
      />

      <SignaturePad
        open={!!pad}
        onOpenChange={(v) => !v && setPad(null)}
        title={pad?.type === 'initials' ? 'Add your initials' : 'Adopt your signature'}
        defaultName={payload.recipientName}
        confirmLabel="Adopt"
        onComplete={(png) => {
          const initials = adopt(png)
          if (pad?.type === 'initials') setValue(pad.id, { kind: 'initials', png: initials })
          else if (pad?.type === 'signature') setValue(pad.id, { kind: 'signature', png })
          setPad(null)
        }}
      />

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline to sign?</AlertDialogTitle>
            <AlertDialogDescription>Nothing will be signed, the request is canceled for everyone, and your broker is told right away.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea id="decline-reason" rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep signing</AlertDialogCancel>
            <AlertDialogAction onClick={decline} disabled={busy}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Text, date and time fields open here: a real keyboard, the phone's own calendar and clock. */
function FieldEditor({
  field,
  value,
  onClose,
  onSave,
}: {
  field: EnvelopeField | null
  value: SignFieldValue | null
  onClose: () => void
  onSave: (v: SignFieldValue | null, andNext: boolean) => void
}) {
  // Keyed by field: each field opens with its own value.
  const [draft, setDraft] = useState(() =>
    !field ? '' : field.type === 'date' ? (value?.kind === 'date' ? value.iso : '') : field.type === 'time' ? (value?.kind === 'time' ? value.hhmm : '') : valueText(value),
  )
  if (!field) return null
  const title = field.label?.trim() || (field.type === 'date' ? 'Pick a date' : field.type === 'time' ? 'Pick a time' : 'Fill in')
  const parsed: SignFieldValue | null =
    field.type === 'date' ? dateValue(draft) : field.type === 'time' ? timeValue(draft) : draft.trim() ? { kind: 'text', text: draft } : null
  const tall = field.h > 0.03
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{field.required ? 'Required' : 'Optional'}</SheetDescription>
        </SheetHeader>
        <form
          className="space-y-4 px-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(parsed, true)
          }}
        >
          {field.type === 'date' ? (
            <Input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} min="1900-01-01" max="2100-12-31" autoFocus aria-label={title} />
          ) : field.type === 'time' ? (
            <Input type="time" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label={title} />
          ) : tall ? (
            <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} autoFocus aria-label={title} />
          ) : (
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} autoFocus aria-label={title} />
          )}
          <SheetFooter className="flex-row justify-end gap-2 p-0">
            <Button type="button" variant="ghost" onClick={() => onSave(null, false)}>
              Clear
            </Button>
            <Button type="submit" disabled={field.required && !parsed}>
              Done
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function FieldBox({
  field,
  size,
  owner,
  color,
  value,
  stamp,
  recipientName,
  active,
  onSign,
  onEdit,
  onCheck,
}: {
  field: EnvelopeField
  size: { w: number; h: number }
  owner: 'mine' | 'locked' | 'theirs'
  color: string
  value: SignFieldValue | null
  stamp: { date: string; time: string } | null
  recipientName: string
  active: boolean
  onSign: () => void
  onEdit: () => void
  onCheck: (checked: boolean) => void
}) {
  const style: React.CSSProperties = { position: 'absolute', left: field.x * size.w, top: field.y * size.h, width: field.w * size.w, height: field.h * size.h }
  const fontSize = Math.max(8, Math.min(12, field.h * size.h * 0.7))
  const id = `sign-field-${field.id}`
  const ring = active ? { boxShadow: `0 0 0 2px ${color}` } : {}

  if (field.type === 'strike') {
    return (
      <div style={style} className="pointer-events-none flex items-center">
        <span className="block h-[2px] w-full bg-foreground" />
      </div>
    )
  }
  if (field.type === 'highlight') return <div style={{ ...style, background: 'rgba(255, 230, 80, 0.45)' }} className="pointer-events-none" />

  const shownText = valueText(value)
  const isMark = field.type === 'signature' || field.type === 'initials'
  const png = value && (value.kind === 'signature' || value.kind === 'initials') ? value.png : null

  // The broker's locked fields and other signers' finished ones: as they will print.
  if (owner !== 'mine') {
    return (
      <div style={{ ...style, fontSize }} className="pointer-events-none flex items-center overflow-hidden px-0.5 leading-none text-foreground" aria-hidden>
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt="" className="max-h-full max-w-full object-contain object-left" />
        ) : field.type === 'checkbox' ? (
          value?.kind === 'checkbox' && value.checked ? <span className="w-full text-center font-bold">X</span> : null
        ) : (
          <span className="truncate">{shownText}</span>
        )}
      </div>
    )
  }

  // Filled when the signer finishes: shown so they see what will print.
  if (AUTO_STAMPED_TYPES.has(field.type)) {
    const preview = field.type === 'full_name' ? recipientName : field.type === 'date_signed' ? stamp?.date ?? '' : stamp?.time ?? ''
    return (
      <div id={id} style={{ ...style, fontSize }} className="pointer-events-none flex items-center overflow-hidden px-1 leading-none text-foreground/70" title="Filled in when you finish">
        {preview}
      </div>
    )
  }

  if (isMark) {
    return (
      <button
        type="button"
        id={id}
        style={{ ...style, color, boxShadow: `inset 0 0 0 1.5px ${color}`, ...ring }}
        className={cn('flex items-center justify-start overflow-hidden rounded-sm px-0.5 text-[11px] font-medium', png ? 'bg-transparent' : 'bg-white/60 hover:bg-black/5')}
        onClick={onSign}
        aria-label={field.type === 'initials' ? 'Initial here' : 'Sign here'}
      >
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt="" className="max-h-full max-w-full object-contain object-left" />
        ) : (
          <span className="pl-1">{field.type === 'initials' ? 'Initial' : 'Sign'}</span>
        )}
      </button>
    )
  }

  if (field.type === 'checkbox') {
    const checked = value?.kind === 'checkbox' && value.checked
    // A 32 px target over a box that may be 11 px on a phone.
    return (
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        aria-label={field.label?.trim() || (field.group ? groupRuleText(field.group) : 'Check')}
        style={{ ...style, ...ring }}
        className={cn('flex items-center justify-center rounded-sm font-bold leading-none', checked ? 'bg-primary text-primary-foreground' : 'bg-primary/10 ring-1 ring-primary/70')}
        onClick={() => onCheck(!checked)}
      >
        <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2" aria-hidden />
        <span style={{ fontSize }}>{checked ? 'X' : ''}</span>
      </button>
    )
  }

  // Text, date and time: the box shows the value; a tap opens the editor.
  const placeholder = field.label?.trim() || (field.type === 'date' ? 'Date' : field.type === 'time' ? 'Time' : 'Type here')
  return (
    <button
      type="button"
      id={id}
      style={{ ...style, fontSize, ...ring }}
      className={cn(
        'flex items-center overflow-hidden rounded-sm px-1 text-left leading-tight',
        shownText ? 'bg-primary/5 text-foreground ring-1 ring-primary/30' : 'bg-primary/10 text-primary/80 ring-1 ring-primary/70',
      )}
      onClick={onEdit}
      aria-label={placeholder}
    >
      <span className={cn(field.h > 0.03 ? 'line-clamp-3 whitespace-pre-wrap break-words' : 'truncate')}>{shownText || placeholder}</span>
    </button>
  )
}
