'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PdfPages } from './pdf-pages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { applyPacketSectionText } from '@/app/actions/tc-envelope-text'
import { areaSpace, layoutAreaText, type AreaLayout } from '@/lib/tc/text-areas'
import { continuationFormFor, continuedMarker, layoutWithMarker } from '@/lib/tc/continuation'
import {
  saveEnvelopeRecipients,
  saveEnvelopeFields,
  sendEnvelope,
  voidEnvelope,
  setEnvelopeReminders,
  setEnvelopeInviteMessage,
  resendRecipientInvite,
  type EnvelopeDetail,
  type RecipientInput,
  type FieldInput,
} from '@/app/actions/tc-envelopes'
import {
  RECIPIENT_ROLES,
  ACTION_REQUIRED,
  ACTION_REQUIRED_LABEL,
  SIGN_FIELD_TYPES,
  SIGN_FIELD_LABEL,
  signerBlockColor,
  DEFAULT_FIELD_SIZE,
  isSignableRole,
  storedRecipientRole,
  coerceActionRequired,
  recipientRoleLabel,
  signingGroupLabel,
  type ActionRequired,
  type SignFieldType,
} from '@/lib/tc/signing'
import { SIGNER_COMPLETED_TYPES } from '@/lib/tc/required-fields'

type LocalField = FieldInput & { localId: string; fieldId?: string }
type Section = EnvelopeDetail['sections'][number]
const sectionId = (s: { documentId: string; key: string }) => `${s.documentId}|${s.key}`

/**
 * Lay a section's text the way the server will (lib/data/tc/continuation.ts):
 * on its own printed lines, and when it does not fit, ending with the marker
 * that names where it continues. The addendum number is settled on save.
 */
function layoutSection(sec: Section, text: string, pts: { w: number; h: number }, addendumNumber: number): AreaLayout {
  const { space, size } = areaSpace(sec.lines, pts.w, pts.h)
  const plain = layoutAreaText(text, space, size)
  if (!plain.overflow) return plain
  return layoutWithMarker(text, space, size, continuedMarker(continuationFormFor(sec.library), addendumNumber, '1'))
}


export function EnvelopeComposer({ detail }: { detail: EnvelopeDetail }) {
  const router = useRouter()
  const readonly = detail.status !== 'draft'

  const [recipients, setRecipients] = useState<RecipientInput[]>(
    detail.recipients.map((r) => ({
      id: r.id,
      role: storedRecipientRole(r.role),
      actionRequired: r.actionRequired,
      name: r.name,
      email: r.email,
      signingOrder: r.signingOrder,
    }))
  )
  const [fields, setFields] = useState<LocalField[]>(
    detail.fields.map((f, i) => ({
      localId: `${f.id}-${i}`,
      fieldId: f.id,
      documentId: f.documentId,
      recipientId: f.recipientId,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      required: f.required,
      value: f.value,
    }))
  )
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(
    detail.recipients.find((r) => isSignableRole(r.role, r.actionRequired))?.id ?? null
  )
  const [activeType, setActiveType] = useState<SignFieldType>('signature')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [remindersEnabled, setRemindersEnabled] = useState(detail.remindersEnabled !== false)
  const [inviteSubject, setInviteSubject] = useState(detail.inviteSubject ?? '')
  const [inviteBody, setInviteBody] = useState(detail.inviteBody ?? '')
  const dragRef = useRef<{ localId: string; offsetX: number; offsetY: number } | null>(null)

  // --- lined sections: one text box each (Matt 2026-09-24) ---
  const [sectionTexts, setSectionTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.sections.map((sec) => [sectionId(sec), sec.text]))
  )
  const [dirtySections, setDirtySections] = useState<Set<string>>(() => new Set())
  const [editingSection, setEditingSection] = useState<string | null>(null)
  // Page sizes in PDF points, reported by the viewer: text is measured in points.
  const pagePts = useRef<Map<string, { w: number; h: number }>>(new Map())
  const ptsOf = (documentId: string, page: number) => pagePts.current.get(`${documentId}:${page}`) ?? { w: 612, h: 792 }
  const sectionLineIds = useMemo(() => new Set(detail.sections.flatMap((sec) => sec.fieldIds)), [detail.sections])
  const continuationFor = (documentId: string) => detail.continuations.filter((c) => c.sourceDocumentId === documentId)
  const nextAddendumGuess = (documentId: string) => continuationFor(documentId)[0]?.addendumNumber ?? 1

  function setSectionText(sec: Section, text: string) {
    const id = sectionId(sec)
    setSectionTexts((t) => ({ ...t, [id]: text }))
    setDirtySections((d) => new Set(d).add(id))
    const laid = layoutSection(sec, text, ptsOf(sec.documentId, sec.page), nextAddendumGuess(sec.documentId))
    const order = new Map(sec.fieldIds.map((fid, i) => [fid, i]))
    setFields((fs) =>
      fs.map((f) => {
        const i = f.fieldId ? order.get(f.fieldId) : undefined
        if (i === undefined) return f
        const line = laid.lines[i] ?? ''
        return {
          ...f,
          value:
            line || i === 0
              ? { kind: 'text' as const, text: line, size: laid.size, ...(i === 0 ? { area: { key: sec.key, text } } : {}) }
              : null,
        }
      })
    )
  }

  const colorOf = (recipientId: string | null) => {
    if (!recipientId) return '#64748b'
    const idx = recipients.findIndex((r) => r.id === recipientId)
    return signerBlockColor(idx)
  }
  const savedSignable = recipients.filter((r) => r.id && isSignableRole(r.role, r.actionRequired))
  const completedIds = new Set(detail.recipients.filter((r) => r.completedAt).map((r) => r.id))
  const envelopeOut =
    detail.status === 'sent' ||
    detail.status === 'partially_signed' ||
    detail.status === 'awaiting_other_side'

  // --- recipient editing ---
  function updateRecipient(idx: number, patch: Partial<RecipientInput>) {
    setRecipients((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function addRecipient() {
    const taken = new Set(recipients.map((r) => storedRecipientRole(r.role)))
    const defaultRole =
      detail.requiredSignerRoles.find((role) => !taken.has(role)) ??
      detail.missingSignerRoles[0] ??
      'Seller'
    const id = crypto.randomUUID()
    setRecipients((rs) => [
      ...rs,
      {
        id,
        role: defaultRole,
        actionRequired: 'NeedsToSign',
        name: '',
        email: '',
        signingOrder: defaultRole === 'SellerAgent' || defaultRole === 'BuyerAgent' ? 2 : 1,
      },
    ])
    setActiveRecipientId(id)
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
      setStatus(res.error ?? 'Could not save recipients')
      return
    }
    setRecipients(
      res.recipients.map((r) => ({
        id: r.id,
        role: storedRecipientRole(r.role),
        actionRequired: r.actionRequired,
        name: r.name,
        email: r.email,
        signingOrder: r.signingOrder,
      }))
    )
    if (!activeRecipientId) {
      setActiveRecipientId(res.recipients.find((r) => isSignableRole(r.role, r.actionRequired))?.id ?? null)
    }
    setStatus('Recipients saved')
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
        required: SIGNER_COMPLETED_TYPES.has(activeType),
        value: null,
      },
    ])
  }
  function deleteField(localId: string) {
    setFields((fs) => fs.filter((f) => f.localId !== localId))
  }

  async function saveDraft(): Promise<boolean> {
    const opt = await setEnvelopeReminders(detail.id, remindersEnabled)
    if (!opt.ok) {
      setStatus(opt.error ?? 'Could not save reminders')
      return false
    }
    const msg = await setEnvelopeInviteMessage(detail.id, { subject: inviteSubject, body: inviteBody })
    if (!msg.ok) {
      setStatus(msg.error ?? 'Could not save the outgoing message')
      return false
    }
    const rRes = await saveEnvelopeRecipients(detail.id, recipients)
    if (!rRes.ok || !rRes.recipients) {
      setStatus(rRes.error ?? 'Could not save recipients')
      return false
    }
    setRecipients(
      rRes.recipients.map((r) => ({
        id: r.id,
        role: storedRecipientRole(r.role),
        actionRequired: r.actionRequired,
        name: r.name,
        email: r.email,
        signingOrder: r.signingOrder,
      }))
    )
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
      value: f.value ?? null,
    }))
    const fRes = await saveEnvelopeFields(detail.id, fieldPayload)
    if (!fRes.ok) {
      setStatus(fRes.error ?? 'Could not save fields')
      return false
    }
    if (dirtySections.size) {
      // The server lays every section out again and builds the continuation
      // addenda, numbered next on the file, right after their forms.
      const texts = detail.sections.map((sec) => ({ documentId: sec.documentId, areaKey: sec.key, text: sectionTexts[sectionId(sec)] ?? '' }))
      const aRes = await applyPacketSectionText(detail.id, texts)
      if (!aRes.ok) {
        setStatus(aRes.error ?? 'Could not save the text boxes')
        return false
      }
      setDirtySections(new Set())
      router.refresh()
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
    const res = await sendEnvelope(detail.id, { remindersEnabled })
    setBusy(false)
    if (!res.ok) {
      setStatus(res.error ?? 'Could not send')
      return
    }
    router.refresh()
    setStatus('Sent for signature')
  }

  async function remind(recipientId: string) {
    setBusy(true)
    setStatus(null)
    const res = await resendRecipientInvite(recipientId)
    setBusy(false)
    setStatus(res.ok ? 'Reminder sent' : res.error ?? 'Could not send reminder')
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
              overlay={(pageNumber, size) => {
                pagePts.current.set(`${doc.documentId}:${pageNumber}`, { w: size.ptsW, h: size.ptsH })
                return (
                <PageLayer
                  readonly={readonly}
                  toolActive={!!activeRecipientId}
                  onPlace={(xf, yf) => placeField(doc.documentId, pageNumber, xf, yf)}
                >
                  {fields
                    .filter((f) => f.documentId === doc.documentId && f.page === pageNumber)
                    .filter((f) => !f.fieldId || !sectionLineIds.has(f.fieldId))
                    .map((f) => (
                      <FieldChip
                        key={f.localId}
                        field={f}
                        size={size}
                        color={colorOf(f.recipientId)}
                        readonly={readonly}
                        clickThrough={
                          (activeType === 'signature' || activeType === 'initials') &&
                          f.type !== 'signature' &&
                          f.type !== 'initials'
                        }
                        onDelete={() => deleteField(f.localId)}
                        onMove={(xf, yf) =>
                          setFields((fs) => fs.map((x) => (x.localId === f.localId ? { ...x, x: xf, y: yf } : x)))
                        }
                        dragRef={dragRef}
                      />
                    ))}
                  {detail.sections
                    .filter((sec) => sec.documentId === doc.documentId && sec.page === pageNumber)
                    .map((sec) => (
                      <SectionBox
                        key={sectionId(sec)}
                        section={sec}
                        size={size}
                        lines={sec.fieldIds.map((fid) => {
                          const v = fields.find((f) => f.fieldId === fid)?.value
                          return v && v.kind === 'text' ? v.text : ''
                        })}
                        typeSize={(() => {
                          const v = fields.find((f) => f.fieldId === sec.fieldIds[0])?.value
                          return v && v.kind === 'text' && v.size ? v.size : 9
                        })()}
                        active={editingSection === sectionId(sec)}
                        readonly={readonly}
                        onOpen={() => setEditingSection(sectionId(sec))}
                      />
                    ))}
                </PageLayer>
                )
              }}
            />
            {continuationFor(doc.documentId).length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Continues on {continuationFor(doc.documentId).map((c) => `Addendum No. ${c.addendumNumber}`).join(', ')}, right after this form.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* control panel */}
      <div className="space-y-4">
        {detail.sections.length ? (
          <SectionEditor
            sections={detail.sections}
            documents={detail.documents}
            texts={sectionTexts}
            editing={editingSection}
            readonly={readonly}
            dirty={dirtySections.size > 0}
            layoutOf={(sec, text) => layoutSection(sec, text, ptsOf(sec.documentId, sec.page), nextAddendumGuess(sec.documentId))}
            onEdit={setEditingSection}
            onChange={setSectionText}
          />
        ) : null}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Recipients
              <Badge variant="outline">{recipients.length}</Badge>
            </CardTitle>
            <p className="text-[11px] font-normal text-muted-foreground">
              Same group signs together. The next group is emailed after this group finishes.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipients.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(r.id ?? null) }} />
                  <Select value={storedRecipientRole(r.role)} onValueChange={(v) => updateRecipient(i, { role: v })} disabled={readonly}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      {RECIPIENT_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="text-xs">
                          {recipientRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!readonly ? (
                    <button onClick={() => removeRecipient(i)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                  ) : null}
                </div>
                <div className="mt-1.5">
                  <Label className="text-[11px] text-muted-foreground">Action required</Label>
                  <Select
                    value={coerceActionRequired(r.actionRequired, r.role)}
                    onValueChange={(v) => updateRecipient(i, { actionRequired: v as ActionRequired })}
                    disabled={readonly}
                  >
                    <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_REQUIRED.map((action) => (
                        <SelectItem key={action} value={action} className="text-xs">
                          {ACTION_REQUIRED_LABEL[action]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input className="mt-2 h-8 text-xs" placeholder="Full name" value={r.name} disabled={readonly}
                  onChange={(e) => updateRecipient(i, { name: e.target.value })} />
                <Input className="mt-1.5 h-8 text-xs" placeholder="email@example.com" value={r.email} disabled={readonly}
                  onChange={(e) => updateRecipient(i, { email: e.target.value })} />
                {isSignableRole(r.role, r.actionRequired) ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground">{signingGroupLabel(r.signingOrder)}</Label>
                    <Input type="number" min={1} className="h-7 w-16 text-xs" value={r.signingOrder} disabled={readonly}
                      onChange={(e) => updateRecipient(i, { signingOrder: parseInt(e.target.value || '1', 10) })} />
                  </div>
                ) : null}
                {readonly && envelopeOut && r.id && isSignableRole(r.role, r.actionRequired) && !completedIds.has(r.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={busy}
                    onClick={() => remind(r.id!)}
                  >
                    Send reminder
                  </Button>
                ) : null}
              </div>
            ))}
            {!readonly ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={addRecipient}>Add recipient</Button>
                <Button size="sm" className="flex-1" onClick={saveSigners} disabled={busy}>Save recipients</Button>
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
                    <SelectValue placeholder={savedSignable.length ? 'Pick a signer' : 'Save recipients first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSignable.map((r) => (
                      <SelectItem key={r.id} value={r.id!} className="text-xs">
                        {r.name || recipientRoleLabel(r.role)}
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
                {activeRecipientId ? 'Click on the document to drop a field. Drag to move, hover to delete.' : 'Save recipients, then pick who signs to start placing fields.'}
              </p>
              {detail.formRead && detail.requiredSignersLabel ? (
                <p className="text-[11px] text-foreground">
                  This form requires {detail.requiredSignersLabel} to sign
                  {detail.missingSignerRoles.length
                    ? `. Missing ${detail.missingSignerRoles.map((r) => recipientRoleLabel(r)).join(' and ')}. One party signing is not fully executed.`
                    : '. Every required signer must finish before this is complete.'}
                </p>
              ) : (
                <p className="text-[11px] text-foreground">
                  {detail.unreadSignersMessage ??
                    'Vault has not identified this form yet, so it does not know who must sign. It will not send until the document is read. One party signing is not fully executed.'}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-2 pt-4">
            {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
            {detail.unreadSignersMessage ? (
              <p className="text-xs text-foreground">{detail.unreadSignersMessage}</p>
            ) : null}
            {detail.incompletePrepareMessage ? (
              <p className="text-xs text-foreground">{detail.incompletePrepareMessage}</p>
            ) : null}
            {detail.outdatedFormsMessage ? (
              <p className="text-xs text-foreground">{detail.outdatedFormsMessage}</p>
            ) : null}
            {detail.status === 'awaiting_other_side' ? (
              <p className="text-xs text-foreground">
                Our clients have signed. The signed PDF goes to the other side. This is not fully executed until they send the signed copy back and it is filed.
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={remindersEnabled}
                disabled={readonly}
                onChange={(e) => setRemindersEnabled(e.target.checked)}
              />
              <span>Enable automatic reminders on this envelope.</span>
            </label>
            {!readonly ? (
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Outgoing email subject</Label>
                <Input
                  className="h-8 text-xs"
                  value={inviteSubject}
                  placeholder="You have documents to sign"
                  onChange={(e) => setInviteSubject(e.target.value)}
                />
                <Label className="text-[11px] text-muted-foreground">Outgoing email message</Label>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  value={inviteBody}
                  placeholder="Your documents are ready to review and sign."
                  onChange={(e) => setInviteBody(e.target.value)}
                />
              </div>
            ) : null}
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
                <Button className="w-full" onClick={handleSend} disabled={busy || Boolean(detail.outdatedFormsMessage)}>Send for signature</Button>
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
  clickThrough = false,
  onDelete,
  onMove,
  dragRef,
}: {
  field: LocalField
  size: { w: number; h: number }
  color: string
  readonly: boolean
  clickThrough?: boolean
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
    pointerEvents: clickThrough ? 'none' : undefined,
    overflow: 'hidden',
    boxSizing: 'border-box',
  }
  const shownText =
    field.value && 'text' in field.value && field.value.text ? field.value.text : ''
  const emptyText = field.type === 'text' && !shownText
  const tall = field.h > 0.03
  return (
    <div
      data-field-chip
      style={style}
      className={`group flex rounded-sm border-2 text-[10px] font-semibold ${
        emptyText
          ? 'items-center border-dashed bg-white/15'
          : tall
            ? 'items-start bg-white/70'
            : 'items-center justify-center bg-white/70'
      }`}
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
      <span
        className={`pointer-events-none px-0.5 ${tall ? 'whitespace-pre-wrap break-words' : 'truncate whitespace-nowrap'}`}
      >
        {emptyText ? '' : shownText || SIGN_FIELD_LABEL[field.type]}
      </span>
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

/**
 * One lined section on the page: its laid-out text sits on the printed lines,
 * exactly as the signed PDF will draw it; a click opens it for typing.
 */
function SectionBox({
  section,
  size,
  lines,
  typeSize,
  active,
  readonly,
  onOpen,
}: {
  section: Section
  size: { w: number; h: number; ptsW: number; ptsH: number }
  lines: string[]
  typeSize: number
  active: boolean
  readonly: boolean
  onOpen: () => void
}) {
  const top = Math.min(...section.lines.map((l) => l.y))
  const bottom = Math.max(...section.lines.map((l) => l.y + l.h))
  const left = Math.min(...section.lines.map((l) => l.x))
  const right = Math.max(...section.lines.map((l) => l.x + l.w))
  const px = size.w / (size.ptsW || 612)
  return (
    <div
      data-field-chip
      role="button"
      tabIndex={readonly ? -1 : 0}
      aria-label={`Text box: ${sectionTitle(section)}, page ${section.page}`}
      onClick={(e) => {
        e.stopPropagation()
        if (!readonly) onOpen()
      }}
      onKeyDown={(e) => {
        if (!readonly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'absolute rounded-sm border border-dashed',
        active ? 'border-primary bg-primary/5' : 'border-primary/40 hover:border-primary hover:bg-primary/5',
        readonly ? 'cursor-default' : 'cursor-text'
      )}
      style={{ left: left * size.w - 2, top: top * size.h - 2, width: (right - left) * size.w + 4, height: (bottom - top) * size.h + 4 }}
    >
      {section.lines.map((l, i) =>
        lines[i] ? (
          <span
            key={i}
            className="pointer-events-none absolute whitespace-nowrap text-foreground"
            style={{
              left: (l.x - left) * size.w + 2 + 2 * px,
              top: (l.y - top) * size.h + 2,
              height: l.h * size.h,
              lineHeight: `${l.h * size.h}px`,
              fontSize: typeSize * px,
              fontFamily: 'Helvetica, Arial, sans-serif',
            }}
          >
            {lines[i]}
          </span>
        ) : null
      )}
      {!lines.some(Boolean) && !readonly ? (
        // On the first line, where typing starts, never over the printed label beside it.
        <span
          className="pointer-events-none absolute text-[10px] font-medium text-primary"
          style={{ left: (section.lines[0].x - left) * size.w + 4, top: (section.lines[0].y - top) * size.h + 2, lineHeight: `${section.lines[0].h * size.h}px` }}
        >
          Type here
        </span>
      ) : null}
    </div>
  )
}

/** A section as the form prints it: "29. Additional Provisions". */
function sectionTitle(sec: Section): string {
  return sec.title ? (sec.number ? `${sec.number}. ${sec.title}` : sec.title) : 'Text box'
}

/** The text of the section being edited, and how it fits. */
function SectionEditor({
  sections,
  documents,
  texts,
  editing,
  readonly,
  dirty,
  layoutOf,
  onEdit,
  onChange,
}: {
  sections: Section[]
  documents: EnvelopeDetail['documents']
  texts: Record<string, string>
  editing: string | null
  readonly: boolean
  dirty: boolean
  layoutOf: (sec: Section, text: string) => AreaLayout
  onEdit: (id: string | null) => void
  onChange: (sec: Section, text: string) => void
}) {
  const current = sections.find((sec) => sectionId(sec) === editing) ?? null
  const docName = (id: string) => documents.find((d) => d.documentId === id)?.name.replace(/\.pdf$/i, '') ?? 'Form'
  const labelOf = (sec: Section) => {
    const lines = sec.printedLines ? (sec.printedLines.includes('-') ? `lines ${sec.printedLines}` : `line ${sec.printedLines}`) : null
    return `${sectionTitle(sec)} · ${[docName(sec.documentId), `page ${sec.page}`, lines].filter(Boolean).join(', ')}`
  }
  const text = current ? texts[sectionId(current)] ?? '' : ''
  const laid = current ? layoutOf(current, text) : null
  const used = laid ? laid.lines.filter(Boolean).length : 0
  const form = current ? continuationFormFor(current.library) : null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          Text boxes
          <Badge variant="outline">{sections.length}</Badge>
        </CardTitle>
        <p className="text-[11px] font-normal text-muted-foreground">
          Each lined section is one box. Text fills the printed lines; what does not fit continues on an addendum placed right after the form.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <div className="space-y-2">
            <Label htmlFor="section-text" className="text-xs">
              {labelOf(current)}
            </Label>
            <Textarea
              id="section-text"
              value={text}
              rows={8}
              disabled={readonly}
              onChange={(e) => onChange(current, e.target.value)}
              placeholder="Type or paste the text for this section."
            />
            <p className={cn('text-xs', laid?.overflow ? 'text-foreground' : 'text-muted-foreground')}>
              {!text.trim()
                ? `${current.lines.length} printed lines.`
                : laid?.overflow
                  ? `Fills all ${current.lines.length} lines. The rest continues on ${form?.title === 'General Addendum' ? 'a 2.2 General Addendum' : 'an OREF 002 Addendum'} right after this form, numbered next on the file when you save.`
                  : `Fits on the form: ${used} of ${current.lines.length} lines.`}
            </p>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(null)}>
                Done
              </Button>
              {dirty ? <span className="text-[11px] text-muted-foreground">Saved with the draft.</span> : null}
            </div>
          </div>
        ) : (
          <ul className="space-y-1">
            {sections.map((sec) => {
              const t = texts[sectionId(sec)] ?? ''
              return (
                <li key={sectionId(sec)}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-0 whitespace-normal px-2 py-1.5 text-left text-xs font-normal"
                    onClick={() => onEdit(sectionId(sec))}
                  >
                    <span className="block font-medium text-foreground">{labelOf(sec)}</span>
                    <span className="block w-full truncate text-muted-foreground">{t.trim() ? t : 'Empty'}</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

