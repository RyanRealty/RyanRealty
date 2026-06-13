'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PdfPages } from './pdf-pages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  saveEnvelopeRecipients,
  saveEnvelopeFields,
  sendEnvelope,
  voidEnvelope,
  type EnvelopeDetail,
  type RecipientInput,
  type FieldInput,
} from '@/app/actions/tc-envelopes'
import {
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  SIGN_FIELD_TYPES,
  SIGN_FIELD_LABEL,
  DEFAULT_FIELD_SIZE,
  isSignableRole,
  type SignFieldType,
} from '@/lib/tc/signing'

const RECIPIENT_COLORS = ['#2563eb', '#16a34a', '#db2777', '#9333ea', '#ea580c', '#0891b2', '#ca8a04']

type LocalField = FieldInput & { localId: string }

export function EnvelopeComposer({ detail }: { detail: EnvelopeDetail }) {
  const router = useRouter()
  const readonly = detail.status !== 'draft'

  const [recipients, setRecipients] = useState<RecipientInput[]>(
    detail.recipients.map((r) => ({ id: r.id, role: r.role, name: r.name, email: r.email, signingOrder: r.signingOrder }))
  )
  const [fields, setFields] = useState<LocalField[]>(
    detail.fields.map((f, i) => ({
      localId: `${f.id}-${i}`,
      documentId: f.documentId,
      recipientId: f.recipientId,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      required: f.required,
    }))
  )
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(
    detail.recipients.find((r) => isSignableRole(r.role))?.id ?? null
  )
  const [activeType, setActiveType] = useState<SignFieldType>('signature')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ localId: string; offsetX: number; offsetY: number } | null>(null)

  const colorOf = (recipientId: string | null) => {
    if (!recipientId) return '#64748b'
    const idx = recipients.findIndex((r) => r.id === recipientId)
    return RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length]
  }
  const savedSignable = recipients.filter((r) => r.id && isSignableRole(r.role))

  // --- recipient editing ---
  function updateRecipient(idx: number, patch: Partial<RecipientInput>) {
    setRecipients((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function addRecipient() {
    setRecipients((rs) => [...rs, { role: 'buyer1', name: '', email: '', signingOrder: 1 }])
  }
  function removeRecipient(idx: number) {
    const removed = recipients[idx]
    setRecipients((rs) => rs.filter((_, i) => i !== idx))
    if (removed?.id) setFields((fs) => fs.filter((f) => f.recipientId !== removed.id))
  }
  async function saveSigners() {
    setBusy(true)
    setStatus(null)
    const res = await saveEnvelopeRecipients(detail.id, recipients)
    setBusy(false)
    if (!res.ok || !res.recipients) {
      setStatus(res.error ?? 'Could not save signers')
      return
    }
    setRecipients(
      res.recipients.map((r) => ({ id: r.id, role: r.role, name: r.name, email: r.email, signingOrder: r.signingOrder }))
    )
    if (!activeRecipientId) setActiveRecipientId(res.recipients.find((r) => isSignableRole(r.role))?.id ?? null)
    setStatus('Signers saved')
  }

  // --- field placement ---
  function placeField(documentId: string, page: number, xFrac: number, yFrac: number) {
    if (readonly || !activeRecipientId) return
    const size = DEFAULT_FIELD_SIZE[activeType]
    setFields((fs) => [
      ...fs,
      {
        localId: crypto.randomUUID(),
        documentId,
        recipientId: activeRecipientId,
        type: activeType,
        page,
        x: Math.max(0, Math.min(1 - size.w, xFrac - size.w / 2)),
        y: Math.max(0, Math.min(1 - size.h, yFrac - size.h / 2)),
        w: size.w,
        h: size.h,
        required: true,
      },
    ])
  }
  function deleteField(localId: string) {
    setFields((fs) => fs.filter((f) => f.localId !== localId))
  }

  async function saveDraft(): Promise<boolean> {
    const rRes = await saveEnvelopeRecipients(detail.id, recipients)
    if (!rRes.ok || !rRes.recipients) {
      setStatus(rRes.error ?? 'Could not save signers')
      return false
    }
    setRecipients(rRes.recipients.map((r) => ({ id: r.id, role: r.role, name: r.name, email: r.email, signingOrder: r.signingOrder })))
    const fieldPayload: FieldInput[] = fields.map((f) => ({
      documentId: f.documentId,
      recipientId: f.recipientId,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      required: f.required,
    }))
    const fRes = await saveEnvelopeFields(detail.id, fieldPayload)
    if (!fRes.ok) {
      setStatus(fRes.error ?? 'Could not save fields')
      return false
    }
    return true
  }

  async function handleSaveDraft() {
    setBusy(true)
    setStatus(null)
    const ok = await saveDraft()
    setBusy(false)
    if (ok) setStatus('Draft saved')
  }

  async function handleSend() {
    setBusy(true)
    setStatus(null)
    const ok = await saveDraft()
    if (!ok) {
      setBusy(false)
      return
    }
    const res = await sendEnvelope(detail.id)
    setBusy(false)
    if (!res.ok) {
      setStatus(res.error ?? 'Could not send')
      return
    }
    router.refresh()
    setStatus('Sent for signature')
  }

  async function handleVoid() {
    const reason = window.prompt('Reason for voiding this envelope?') ?? ''
    setBusy(true)
    const res = await voidEnvelope(detail.id, reason)
    setBusy(false)
    if (res.ok) router.refresh()
    else setStatus(res.error ?? 'Could not void')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* document canvas */}
      <div className="min-w-0">
        {detail.documents.map((doc) => (
          <div key={doc.id} className="mb-6">
            <p className="mb-2 text-sm font-medium text-foreground">{doc.name}</p>
            <PdfPages
              url={doc.url}
              overlay={(pageNumber, size) => (
                <PageLayer
                  readonly={readonly}
                  toolActive={!!activeRecipientId}
                  onPlace={(xf, yf) => placeField(doc.documentId, pageNumber, xf, yf)}
                >
                  {fields
                    .filter((f) => f.documentId === doc.documentId && f.page === pageNumber)
                    .map((f) => (
                      <FieldChip
                        key={f.localId}
                        field={f}
                        size={size}
                        color={colorOf(f.recipientId)}
                        readonly={readonly}
                        onDelete={() => deleteField(f.localId)}
                        onMove={(xf, yf) =>
                          setFields((fs) => fs.map((x) => (x.localId === f.localId ? { ...x, x: xf, y: yf } : x)))
                        }
                        dragRef={dragRef}
                      />
                    ))}
                </PageLayer>
              )}
            />
          </div>
        ))}
      </div>

      {/* control panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Signers
              <Badge variant="outline">{recipients.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipients.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(r.id ?? null) }} />
                  <Select value={r.role} onValueChange={(v) => updateRecipient(i, { role: v })} disabled={readonly}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECIPIENT_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs">{RECIPIENT_ROLE_LABEL[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!readonly ? (
                    <button onClick={() => removeRecipient(i)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                  ) : null}
                </div>
                <Input className="mt-2 h-8 text-xs" placeholder="Full name" value={r.name} disabled={readonly}
                  onChange={(e) => updateRecipient(i, { name: e.target.value })} />
                <Input className="mt-1.5 h-8 text-xs" placeholder="email@example.com" value={r.email} disabled={readonly}
                  onChange={(e) => updateRecipient(i, { email: e.target.value })} />
                <div className="mt-1.5 flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">Signs in order</Label>
                  <Input type="number" min={1} className="h-7 w-16 text-xs" value={r.signingOrder} disabled={readonly}
                    onChange={(e) => updateRecipient(i, { signingOrder: parseInt(e.target.value || '1', 10) })} />
                </div>
              </div>
            ))}
            {!readonly ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={addRecipient}>Add signer</Button>
                <Button size="sm" className="flex-1" onClick={saveSigners} disabled={busy}>Save signers</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {!readonly ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Place fields</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Assign to</Label>
                <Select value={activeRecipientId ?? ''} onValueChange={setActiveRecipientId}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder={savedSignable.length ? 'Pick a signer' : 'Save signers first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSignable.map((r) => (
                      <SelectItem key={r.id} value={r.id!} className="text-xs">
                        {r.name || RECIPIENT_ROLE_LABEL[r.role as keyof typeof RECIPIENT_ROLE_LABEL] || r.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Field type</Label>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {SIGN_FIELD_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveType(t)}
                      className={`rounded-md border px-2 py-1.5 text-xs ${activeType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {SIGN_FIELD_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {activeRecipientId ? 'Click on the document to drop a field. Drag to move, hover to delete.' : 'Save signers, then pick who signs to start placing fields.'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-2 pt-4">
            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
            {readonly ? (
              <>
                <Badge className="bg-primary text-primary-foreground">{detail.status}</Badge>
                {detail.status !== 'completed' && detail.status !== 'voided' ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={handleVoid} disabled={busy}>Void envelope</Button>
                ) : null}
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={handleSaveDraft} disabled={busy}>Save draft</Button>
                <Button className="w-full" onClick={handleSend} disabled={busy}>Send for signature</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PageLayer({
  readonly,
  toolActive,
  onPlace,
  children,
}: {
  readonly: boolean
  toolActive: boolean
  onPlace: (xFrac: number, yFrac: number) => void
  children: React.ReactNode
}) {
  return (
    <div
      className={`absolute inset-0 ${!readonly && toolActive ? 'cursor-crosshair' : ''}`}
      onClick={(e) => {
        if (readonly || !toolActive) return
        // ignore clicks that land on an existing chip
        if ((e.target as HTMLElement).closest('[data-field-chip]')) return
        const rect = e.currentTarget.getBoundingClientRect()
        onPlace((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
      }}
    >
      {children}
    </div>
  )
}

function FieldChip({
  field,
  size,
  color,
  readonly,
  onDelete,
  onMove,
  dragRef,
}: {
  field: LocalField
  size: { w: number; h: number }
  color: string
  readonly: boolean
  onDelete: () => void
  onMove: (xFrac: number, yFrac: number) => void
  dragRef: React.RefObject<{ localId: string; offsetX: number; offsetY: number } | null>
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: field.x * size.w,
    top: field.y * size.h,
    width: field.w * size.w,
    height: field.h * size.h,
    borderColor: color,
    color,
  }
  return (
    <div
      data-field-chip
      style={style}
      className="group flex items-center justify-center rounded-sm border-2 bg-white/70 text-[10px] font-semibold"
      onPointerDown={(e) => {
        if (readonly) return
        e.stopPropagation()
        const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
        const box = e.currentTarget.getBoundingClientRect()
        dragRef.current = { localId: field.localId, offsetX: e.clientX - box.left, offsetY: e.clientY - box.top }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        const onMoveEv = (ev: PointerEvent) => {
          if (!dragRef.current) return
          const xPx = ev.clientX - parent.left - dragRef.current.offsetX
          const yPx = ev.clientY - parent.top - dragRef.current.offsetY
          onMove(
            Math.max(0, Math.min(1 - field.w, xPx / parent.width)),
            Math.max(0, Math.min(1 - field.h, yPx / parent.height))
          )
        }
        const onUp = () => {
          dragRef.current = null
          window.removeEventListener('pointermove', onMoveEv)
          window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMoveEv)
        window.addEventListener('pointerup', onUp)
      }}
    >
      <span className="pointer-events-none truncate px-0.5">{SIGN_FIELD_LABEL[field.type]}</span>
      {!readonly ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-white group-hover:flex"
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}
