'use client'

import { useEffect, useMemo, useState } from 'react'
import { PdfPages } from './pdf-pages'
import { SignaturePad, scriptTextToPng } from './SignaturePad'
import {
  fieldNeedsAdoptedMark,
  initialsFromFullName,
  nextRequiredFieldId,
  stampPreparedSignerFields,
} from '@/lib/tc/adopt-signature'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { recordSigningConsent, submitSigning, declineSigning } from '@/app/actions/tc-sign'
import type { SigningPayload, SubmitFieldValue } from '@/app/actions/tc-sign'
import type { EnvelopeField, SignFieldType, SignFieldValue } from '@/lib/tc/signing'
import { signerBlockColor } from '@/lib/tc/signing'

const FIELD_PROMPT: Record<SignFieldType, string> = {
  signature: 'Sign',
  initials: 'Initials',
  full_name: 'Full name',
  date_signed: 'Date',
  time_signed: 'Time',
  text: 'Type here',
  checkbox: '',
  strike: '',
  highlight: '',
}

export function SignFlow({ token, payload }: { token: string; payload: SigningPayload }) {
  const [consented, setConsented] = useState(payload.consented)
  const [agree, setAgree] = useState(false)
  const [values, setValues] = useState<Map<string, SignFieldValue>>(() => {
    const m = new Map<string, SignFieldValue>()
    for (const f of payload.fields) {
      if (f.value) m.set(f.id, f.value)
    }
    return m
  })
  const [pad, setPad] = useState<EnvelopeField | null>(null)
  const [adopted, setAdopted] = useState<{ signaturePng: string; initialsPng: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | 'completed' | 'partial'>(null)
  const [error, setError] = useState<string | null>(null)
  const [signedDate, setSignedDate] = useState('')
  const [signedTime, setSignedTime] = useState('')
  useEffect(() => {
    const now = new Date()
    setSignedDate(now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }))
    setSignedTime(
      now.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
      }),
    )
  }, [])
  useEffect(() => {
    if (!adopted || !signedDate) return
    setValues((m) => {
      const next = new Map(m)
      applyPreparedStamps(next)
      return next
    })
  }, [adopted, signedDate, signedTime])

  const requiredIds = useMemo(
    () =>
      payload.fields
        .filter(
          (f) =>
            f.required &&
            fieldNeedsAdoptedMark(f.type) &&
            (!f.recipientId || f.recipientId === payload.recipientId),
        )
        .map((f) => f.id),
    [payload.fields, payload.recipientId],
  )
  const filledCount = requiredIds.filter((id) => values.has(id)).length
  const allFilled = filledCount === requiredIds.length
  const needsAdopt = payload.fields.some(
    (f) => fieldNeedsAdoptedMark(f.type) && (!f.recipientId || f.recipientId === payload.recipientId),
  )
  const colorByRecipient = useMemo(() => {
    const ids = [...new Set(payload.fields.map((f) => f.recipientId).filter(Boolean))] as string[]
    const m = new Map<string, string>()
    ids.forEach((id, i) => m.set(id, signerBlockColor(i)))
    return m
  }, [payload.fields])

  function applyPreparedStamps(into: Map<string, SignFieldValue>) {
    for (const s of stampPreparedSignerFields(payload.fields, {
      recipientId: payload.recipientId,
      name: payload.recipientName,
      date: signedDate,
      time: signedTime,
    })) {
      if (!into.has(s.fieldId)) into.set(s.fieldId, s.value)
    }
  }

  const setValue = (fieldId: string, v: SignFieldValue) =>
    setValues((m) => {
      const next = new Map(m)
      next.set(fieldId, v)
      const nid = nextRequiredFieldId(
        payload.fields.filter((f) => fieldNeedsAdoptedMark(f.type)),
        new Set(next.keys()),
      )
      if (nid) {
        requestAnimationFrame(() => document.getElementById(`sign-field-${nid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
      return next
    })

  function adoptPng(png: string) {
    const initials = scriptTextToPng(initialsFromFullName(payload.recipientName)) ?? png
    setAdopted({ signaturePng: png, initialsPng: initials })
    setValues((m) => {
      const next = new Map(m)
      applyPreparedStamps(next)
      return next
    })
  }

  function applyMark(field: EnvelopeField) {
    if (!adopted) {
      setPad(field)
      return
    }
    if (field.type === 'initials') setValue(field.id, { kind: 'initials', png: adopted.initialsPng })
    else setValue(field.id, { kind: 'signature', png: adopted.signaturePng })
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
    if (!allFilled) {
      setError('Please complete every required field.')
      return
    }
    setBusy(true)
    const submitted = new Map(values)
    applyPreparedStamps(submitted)
    const payloadValues: SubmitFieldValue[] = [...submitted.entries()].map(([fieldId, value]) => ({ fieldId, value }))
    const res = await submitSigning(token, payloadValues)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not submit')
      return
    }
    setDone(res.completed ? 'completed' : 'partial')
  }

  async function decline() {
    const reason = window.prompt('Optional: tell us why you are declining.') ?? ''
    setBusy(true)
    const res = await declineSigning(token, reason)
    setBusy(false)
    if (res.ok) setDone('partial')
    else setError(res.error ?? 'Could not decline')
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {done === 'completed' ? 'All signed and complete' : 'Thank you'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {done === 'completed'
            ? 'Every party has signed. A completed copy is on its way to your email.'
            : 'Your part is done. We will email you a completed copy once everyone has signed.'}
        </p>
      </div>
    )
  }

  if (!consented) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Review and sign for {payload.propertyAddress}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hi {payload.recipientName}, you have documents ready to sign. Before you start, please agree to sign electronically.
        </p>
        <Card className="mt-6 p-4">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <span className="text-muted-foreground">
              I agree to use electronic records and signatures for this transaction, and I understand my electronic
              signature is legally binding under the ESIGN Act and Oregon law.
            </span>
          </label>
          <Button className="mt-4 w-full" disabled={!agree || busy} onClick={consent}>
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
        <p className="mt-3 text-sm text-muted-foreground">
          Draw it, type it, or upload a picture. Then tap each Sign box on the documents. Nothing to install.
        </p>
        <SignaturePad
          open
          onOpenChange={() => undefined}
          title="Adopt your signature"
          defaultName={payload.recipientName}
          confirmLabel="Adopt and start signing"
          onComplete={adoptPng}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-3 pb-32 pt-6">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-foreground">{payload.propertyAddress}</h1>
        <p className="text-sm text-muted-foreground">{payload.envelopeName}</p>
        {adopted ? (
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setAdopted(null)}
          >
            Change signature
          </button>
        ) : null}
      </div>

      {payload.documents.map((doc) => (
        <div key={doc.documentId} className="mb-6">
          <p className="mb-2 text-sm font-medium text-foreground">{doc.name}</p>
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
                      color={colorByRecipient.get(f.recipientId ?? '') ?? '#2563eb'}
                      ownerId={payload.recipientId}
                      value={values.get(f.id) ?? f.value ?? null}
                      onSignature={() => applyMark(f)}
                      onText={(text) => setValue(f.id, { kind: f.type === 'date_signed' ? 'date_signed' : 'text', text })}
                      onCheckbox={(checked) => setValue(f.id, { kind: 'checkbox', checked })}
                    />
                  ))}
              </>
            )}
          />
        </div>
      ))}

      {/* sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {filledCount} of {requiredIds.length} required
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={decline} disabled={busy}>
              Decline
            </Button>
            <Button onClick={finish} disabled={busy || !allFilled}>
              {busy ? 'Submitting…' : 'Finish signing'}
            </Button>
          </div>
        </div>
        {error ? <p className="mx-auto mt-1 max-w-3xl text-xs text-destructive">{error}</p> : null}
      </div>

      <SignaturePad
        open={!!pad}
        onOpenChange={(v) => !v && setPad(null)}
        title={pad?.type === 'initials' ? 'Add your initials' : 'Adopt your signature'}
        defaultName={payload.recipientName}
        confirmLabel="Adopt"
        onComplete={(png) => {
          const initials = scriptTextToPng(initialsFromFullName(payload.recipientName)) ?? png
          setAdopted({ signaturePng: png, initialsPng: initials })
          if (pad?.type === 'initials') setValue(pad.id, { kind: 'initials', png: initials })
          else if (pad?.type === 'signature') setValue(pad.id, { kind: 'signature', png })
          setPad(null)
        }}
      />
    </div>
  )
}

function FieldBox({
  field,
  size,
  color,
  ownerId,
  value,
  onSignature,
  onText,
  onCheckbox,
}: {
  field: EnvelopeField
  size: { w: number; h: number }
  color: string
  ownerId: string
  value: SignFieldValue | null
  onSignature: () => void
  onText: (text: string) => void
  onCheckbox: (checked: boolean) => void
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: field.x * size.w,
    top: field.y * size.h,
    width: field.w * size.w,
    height: field.h * size.h,
  }
  const filled = value != null
  const others = !!(field.recipientId && field.recipientId !== ownerId)
  const base =
    'flex items-center overflow-hidden rounded-sm text-[11px] font-medium ring-1 transition-colors'
  const ring = filled ? 'ring-success/60 bg-success/5' : 'hover:bg-black/5 cursor-pointer'

  if (field.type === 'signature' || field.type === 'initials') {
    if (others) {
      return (
        <div style={style} className={`${base} justify-start bg-transparent ring-0`}>
          {value && (value.kind === 'signature' || value.kind === 'initials') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.png} alt="" className="max-h-full max-w-full object-contain object-left" />
          ) : null}
        </div>
      )
    }
    return (
      <button
        type="button"
        id={`sign-field-${field.id}`}
        style={{ ...style, color, boxShadow: `inset 0 0 0 1.5px ${color}` }}
        className={`${base} justify-start bg-white/40 px-0.5 ${ring}`}
        onClick={onSignature}
      >
        {value && (value.kind === 'signature' || value.kind === 'initials') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.png} alt="signature" className="max-h-full max-w-full object-contain object-left" />
        ) : (
          <span className="pl-1">{FIELD_PROMPT[field.type]}</span>
        )}
      </button>
    )
  }

  if (field.type === 'date_signed' || field.type === 'full_name' || field.type === 'time_signed') {
    const shown =
      value && (value.kind === 'date_signed' || value.kind === 'text') ? value.text : ''
    return (
      <div
        style={style}
        className="pointer-events-none flex items-center overflow-hidden px-1 text-[11px] leading-none text-foreground"
      >
        {shown}
      </div>
    )
  }

  if (field.type === 'strike') {
    return (
      <div style={style} className="pointer-events-none flex items-center">
        <span className="block h-[2px] w-full bg-foreground" />
      </div>
    )
  }

  if (field.type === 'highlight') {
    return (
      <div
        style={{ ...style, background: 'rgba(255, 230, 80, 0.45)' }}
        className="pointer-events-none"
      />
    )
  }

  if (field.type === 'checkbox') {
    const checked = value?.kind === 'checkbox' ? value.checked : false
    return (
      <button
        type="button"
        style={style}
        className={`${base} ${checked ? 'bg-primary text-primary-foreground ring-primary' : 'ring-primary/70 bg-primary/10 cursor-pointer'}`}
        onClick={() => onCheckbox(!checked)}
      >
        {checked ? '✓' : ''}
      </button>
    )
  }

  const typed = value?.kind === 'text' ? value.text : ''
  const tall = field.h > 0.03
  const boxStyle: React.CSSProperties = {
    ...style,
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontSize: Math.max(9, Math.min(12, field.h * size.h * 0.7)),
    lineHeight: 1.2,
    resize: 'none',
  }
  if (!field.recipientId) {
    return (
      <div
        style={boxStyle}
        className={`pointer-events-none px-1 text-foreground ${tall ? 'whitespace-pre-wrap break-words' : 'truncate whitespace-nowrap'}`}
      >
        {typed}
      </div>
    )
  }
  if (tall) {
    return (
      <textarea
        style={boxStyle}
        className="rounded-sm bg-primary/10 px-1 text-foreground ring-1 ring-primary/70 outline-none focus:bg-white"
        defaultValue={typed}
        placeholder={FIELD_PROMPT.text}
        onChange={(e) => onText(e.target.value)}
      />
    )
  }
  return (
    <input
      style={boxStyle}
      className="rounded-sm bg-primary/10 px-1 text-foreground ring-1 ring-primary/70 outline-none focus:bg-white"
      defaultValue={typed}
      placeholder={FIELD_PROMPT.text}
      onChange={(e) => onText(e.target.value)}
    />
  )
}
