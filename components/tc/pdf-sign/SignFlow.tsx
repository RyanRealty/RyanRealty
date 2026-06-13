'use client'

import { useMemo, useState } from 'react'
import { PdfPages } from './pdf-pages'
import { SignaturePad } from './SignaturePad'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { recordSigningConsent, submitSigning, declineSigning } from '@/app/actions/tc-sign'
import type { SigningPayload, SubmitFieldValue } from '@/app/actions/tc-sign'
import type { EnvelopeField, SignFieldType, SignFieldValue } from '@/lib/tc/signing'

const FIELD_PROMPT: Record<SignFieldType, string> = {
  signature: 'Sign',
  initials: 'Initials',
  date_signed: 'Date',
  text: 'Type here',
  checkbox: '',
}

export function SignFlow({ token, payload }: { token: string; payload: SigningPayload }) {
  const [consented, setConsented] = useState(payload.consented)
  const [agree, setAgree] = useState(false)
  const [values, setValues] = useState<Map<string, SignFieldValue>>(new Map())
  const [pad, setPad] = useState<EnvelopeField | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | 'completed' | 'partial'>(null)
  const [error, setError] = useState<string | null>(null)

  const requiredIds = useMemo(() => payload.fields.filter((f) => f.required).map((f) => f.id), [payload.fields])
  const filledCount = requiredIds.filter((id) => values.has(id)).length
  const allFilled = filledCount === requiredIds.length

  const setValue = (fieldId: string, v: SignFieldValue) =>
    setValues((m) => {
      const next = new Map(m)
      next.set(fieldId, v)
      return next
    })

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
    const payloadValues: SubmitFieldValue[] = [...values.entries()].map(([fieldId, value]) => ({ fieldId, value }))
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

  return (
    <div className="mx-auto max-w-3xl px-3 pb-32 pt-6">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-foreground">{payload.propertyAddress}</h1>
        <p className="text-sm text-muted-foreground">{payload.envelopeName}</p>
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
                      value={values.get(f.id) ?? null}
                      onSignature={() => setPad(f)}
                      onText={(text) => setValue(f.id, { kind: f.type === 'date_signed' ? 'date_signed' : 'text', text })}
                      onDate={() => setValue(f.id, { kind: 'date_signed', text: new Date().toLocaleDateString('en-US') })}
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
        title={pad?.type === 'initials' ? 'Add your initials' : 'Add your signature'}
        defaultName={payload.recipientName}
        onComplete={(png) => {
          if (pad) setValue(pad.id, { kind: pad.type === 'initials' ? 'initials' : 'signature', png })
          setPad(null)
        }}
      />
    </div>
  )
}

function FieldBox({
  field,
  size,
  value,
  onSignature,
  onText,
  onDate,
  onCheckbox,
}: {
  field: EnvelopeField
  size: { w: number; h: number }
  value: SignFieldValue | null
  onSignature: () => void
  onText: (text: string) => void
  onDate: () => void
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
  const base =
    'flex items-center justify-center overflow-hidden rounded-sm text-[11px] font-medium ring-1 transition-colors'
  const ring = filled ? 'ring-success/60 bg-success/5' : 'ring-primary/70 bg-primary/10 hover:bg-primary/20 cursor-pointer'

  if (field.type === 'signature' || field.type === 'initials') {
    return (
      <button type="button" style={style} className={`${base} ${ring}`} onClick={onSignature}>
        {value && (value.kind === 'signature' || value.kind === 'initials') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.png} alt="signature" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-primary">{FIELD_PROMPT[field.type]}</span>
        )}
      </button>
    )
  }

  if (field.type === 'date_signed') {
    return (
      <button type="button" style={style} className={`${base} ${ring}`} onClick={onDate}>
        <span className={filled ? 'text-foreground' : 'text-primary'}>
          {value && value.kind === 'date_signed' ? value.text : 'Date'}
        </span>
      </button>
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

  // text
  return (
    <input
      style={style}
      className="rounded-sm bg-primary/10 px-1 text-[12px] text-foreground ring-1 ring-primary/70 outline-none focus:bg-white"
      defaultValue={value?.kind === 'text' ? value.text : ''}
      placeholder={FIELD_PROMPT.text}
      onChange={(e) => onText(e.target.value)}
    />
  )
}
