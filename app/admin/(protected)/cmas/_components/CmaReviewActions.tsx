'use client'

/**
 * Review-page action rail. Shared compose = EmailBodyEditor (G50).
 * R1 drip card when queued. R2 To/From/Subject + CMA PDF chip + preview.
 * R3 stay on Review (no People compose hop). R4 one primary send verb.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, ConfirmDialog, SelectField, TextField } from '@/components/admin/v2'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { CmaTextMeButton } from '@/components/admin/crm/CmaTextMeButton'
import { formatPriceExact } from '@/lib/format/money'
import {
  rebuildCmaAction,
  rebrandCmaAction,
  approveCmaAction,
  archiveCmaAction,
  unarchiveCmaAction,
  deleteCmaAction,
  searchCmaPersonAction,
  attachCmaPersonAction,
  saveCmaFirstContactOverrideAction,
  updateCmaOutboundToAction,
} from '@/app/actions/cma-admin'
import {
  approveAndDeliverCma,
  holdCmaInDripAction,
  removeCmaFromDripAction,
} from '@/app/actions/cma-queue'
import { cmaClientIntentLabel, isCmaClientIntent, type CmaClientIntent } from '@/lib/cma/client-intent'
import type { CmaSendMode } from '@/lib/cma/origin'
import './cma-review.css'

export interface CmaReviewActionsProps {
  cmaId: string
  slug: string
  status: string
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  personId: number | null
  personName: string | null
  subjectBeds: number | null
  subjectBaths: number | null
  subjectSqft: number | null
  clientIntent: CmaClientIntent | null
  recommendedList: number | null
  priceOverride: number | null
  brokerSlug: string | null
  brokers: Array<{ slug: string; displayName: string }>
  hasDocument: boolean
  /** Origin send lane. */
  sendMode: CmaSendMode
  /** True when this CMA is currently in the weekday drip queue. */
  inDrip: boolean
  /** ETA card lines when inDrip (position + datetime + cadence). */
  dripEtaLabel: string | null
  dripCadence: string | null
  /** Signing broker mailbox shown as From (read-only). */
  fromMailbox: string
  /** Signature HTML (Oregon disclosure included) for EmailBodyEditor preview. */
  signatureHtml: string | null
  /** Default outbound subject (first-contact compose). */
  emailSubject: string
  /** Default outbound body (first-contact compose). */
  emailBody: string
  /** Ready to approve+deliver (audit ok, contact, document). */
  canDeliver: boolean
}

const usd = formatPriceExact

export function CmaReviewActions(props: CmaReviewActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [clientName, setClientName] = useState(props.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(props.clientEmail ?? '')
  const [clientPhone, setClientPhone] = useState(props.clientPhone ?? '')
  const [toEmail, setToEmail] = useState(props.clientEmail ?? '')
  const [priceOverride, setPriceOverride] = useState(
    props.priceOverride != null ? String(props.priceOverride) : '',
  )
  const [brokerSlug, setBrokerSlug] = useState(props.brokerSlug ?? props.brokers[0]?.slug ?? 'matthew-ryan')
  const [personId, setPersonId] = useState<number | null>(props.personId)
  const [personName, setPersonName] = useState(props.personName ?? '')
  const [personQuery, setPersonQuery] = useState('')
  const [personHits, setPersonHits] = useState<Array<{ id: number; name: string | null; email: string | null }>>([])
  const [beds, setBeds] = useState(props.subjectBeds != null ? String(props.subjectBeds) : '')
  const [baths, setBaths] = useState(props.subjectBaths != null ? String(props.subjectBaths) : '')
  const [sqft, setSqft] = useState(props.subjectSqft != null ? String(props.subjectSqft) : '')
  const [intent, setIntent] = useState<CmaClientIntent | ''>(props.clientIntent ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState(props.emailSubject)
  const [emailBody, setEmailBody] = useState(props.emailBody)

  const isDraft = props.status === 'draft'
  const isArchived = props.status === 'archived'
  const isDripLane = props.sendMode === 'drip'
  const isNowLane = props.sendMode === 'now'

  function overrideIfEdited() {
    const subject = emailSubject.trim()
    const bodyText = emailBody.trim()
    const edited =
      subject !== props.emailSubject.trim() || bodyText !== props.emailBody.trim()
    return edited ? { subject, bodyText } : { subject, bodyText }
  }

  function rebuild() {
    const override = priceOverride.trim() ? Number(priceOverride.replace(/[^0-9.]/g, '')) : null
    if (priceOverride.trim() && (!Number.isFinite(override) || (override ?? 0) <= 0)) {
      toast.error('Price adjustment must be a positive number.')
      return
    }
    startTransition(async () => {
      const { error } = await rebuildCmaAction({
        slug: props.slug,
        clientName: clientName.trim() || null,
        clientEmail: (toEmail.trim() || clientEmail.trim()) || null,
        clientPhone: clientPhone.trim() || null,
        personId,
        beds: beds.trim() || null,
        baths: baths.trim() || null,
        sqft: sqft.trim() || null,
        intent: intent || null,
        priceOverride: override,
      })
      if (error) toast.error(error)
      else {
        toast.success('Rebuilt. Open report to read the new document.')
        router.refresh()
      }
    })
  }

  function rebrand() {
    startTransition(async () => {
      const { error } = await rebrandCmaAction({ slug: props.slug, brokerSlug })
      if (error) toast.error(error)
      else {
        toast.success('Re-branded. Same numbers, new signature block.')
        router.refresh()
      }
    })
  }

  function approve() {
    startTransition(async () => {
      const { error } = await approveCmaAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success('Approved.')
        router.refresh()
      }
    })
  }

  function saveEmail() {
    startTransition(async () => {
      const subject = emailSubject.trim()
      const bodyText = emailBody.trim()
      if (!subject || !bodyText) {
        toast.error('Subject and email body are required.')
        return
      }
      const { error } = await saveCmaFirstContactOverrideAction(props.slug, { subject, bodyText })
      if (error) toast.error(error)
      else {
        toast.success('Email saved for drip / next send.')
        router.refresh()
      }
    })
  }

  function deliver(delivery: 'now' | 'drip') {
    startTransition(async () => {
      const subject = emailSubject.trim()
      const bodyText = emailBody.trim()
      if (!subject || !bodyText) {
        toast.error('Subject and email body are required before send.')
        return
      }
      if (toEmail.trim() && toEmail.trim().toLowerCase() !== (props.clientEmail ?? '').toLowerCase()) {
        const { error: toErr } = await updateCmaOutboundToAction(props.slug, toEmail.trim())
        if (toErr) {
          toast.error(`Could not update To: ${toErr}`)
          return
        }
      }
      const ov = overrideIfEdited()
      const res = await approveAndDeliverCma(props.slug, ov, { delivery })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.outcome === 'sent') toast.success('Sent.')
      else if (res.outcome === 'queued') toast.success(`Scheduled. ${res.position} waiting in the drip.`)
      else toast.success(res.reason)
      router.refresh()
    })
  }

  function holdDrip() {
    startTransition(async () => {
      const res = await holdCmaInDripAction(props.slug)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success('Held — moved to the back of the drip.')
        router.refresh()
      }
    })
  }

  function removeDrip() {
    startTransition(async () => {
      const res = await removeCmaFromDripAction(props.slug)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success('Removed from drip.')
        router.refresh()
      }
    })
  }

  function remove() {
    setDeleteOpen(false)
    startTransition(async () => {
      const { error } = await deleteCmaAction(props.cmaId)
      if (error) toast.error(error)
      else {
        toast.success('CMA deleted.')
        router.push('/admin/cmas')
      }
    })
  }

  function toggleArchive() {
    startTransition(async () => {
      const { error } = isArchived ? await unarchiveCmaAction(props.slug) : await archiveCmaAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success(isArchived ? 'CMA restored.' : 'CMA archived. It is hidden from send surfaces until restored.')
        router.refresh()
      }
    })
  }

  // R4: one primary send verb.
  // Warm → Send now. Cold ready → Schedule primary, Send now quiet. Queued → drip card.
  const showSchedule = props.canDeliver && isDripLane && !props.inDrip
  const showSendNow =
    (props.canDeliver && (isNowLane || isDripLane)) || (props.inDrip && Boolean(toEmail.trim()))
  const primaryIsSchedule = showSchedule
  const primaryIsSendNow = showSendNow && !showSchedule

  return (
    <div className="space-y-5">
      {props.inDrip ? (
        <div
          className="cma-drip-card space-y-2"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            padding: 12,
            background: 'var(--a-surface-2, var(--a-surface))',
          }}
        >
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            In drip
          </p>
          {props.dripEtaLabel ? (
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>
              {props.dripEtaLabel}
            </p>
          ) : null}
          {props.dripCadence ? (
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {props.dripCadence}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
            <Button onClick={() => deliver('now')} disabled={isPending || !props.hasDocument} touch>
              {isPending ? 'Working…' : 'Send now'}
            </Button>
            <Button onClick={holdDrip} disabled={isPending} variant="quiet" touch>
              Hold
            </Button>
            <Button onClick={removeDrip} disabled={isPending} variant="quiet" touch>
              Remove from drip
            </Button>
          </div>
        </div>
      ) : null}

      <div className="cma-send-dock space-y-3">
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
          Outbound email
        </p>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Edit on Review. PDF attaches automatically on send. Signature and Oregon disclosure show in preview.
        </p>

        <TextField
          label="To"
          type="email"
          value={toEmail}
          onChange={(e) => {
            setToEmail(e.target.value)
            setClientEmail(e.target.value)
          }}
          hint="Recipient. Saved when you Schedule or Send now."
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          From · {props.fromMailbox}
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid var(--a-border)',
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text)',
          }}
          data-cma-attach="pdf"
        >
          CMA PDF
          <span style={{ color: 'var(--a-text-2)' }}>attaches on send</span>
        </div>

        <EmailBodyEditor
          subject={emailSubject}
          onSubjectChange={setEmailSubject}
          body={emailBody}
          onBodyChange={setEmailBody}
          signatureHtml={props.signatureHtml}
          hideMergeFields
        />

        {showSchedule ? (
          <Button
            onClick={() => deliver('drip')}
            disabled={isPending || !props.hasDocument}
            variant={primaryIsSchedule ? undefined : 'quiet'}
            touch
            className="w-full"
          >
            {isPending ? 'Working…' : 'Schedule'}
          </Button>
        ) : null}

        {showSendNow ? (
          <Button
            onClick={() => deliver('now')}
            disabled={isPending || !props.hasDocument}
            variant={primaryIsSendNow ? undefined : 'quiet'}
            touch
            className="w-full"
          >
            {isPending ? 'Working…' : 'Send now'}
          </Button>
        ) : null}

        {!showSchedule && !showSendNow && isDraft ? (
          <Button onClick={approve} disabled={isPending || !props.hasDocument} variant="quiet" touch className="w-full">
            Approve (draft to final)
          </Button>
        ) : null}

        {(props.inDrip || isDripLane) && props.hasDocument ? (
          <Button onClick={saveEmail} disabled={isPending} variant="quiet" touch className="w-full">
            {isPending ? 'Working…' : 'Save email for drip'}
          </Button>
        ) : null}

        {props.hasDocument ? <CmaTextMeButton slug={props.slug} /> : null}
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Client, price, rebuild
        </summary>
        <div className="space-y-4" style={{ marginTop: 12 }}>
          <div className="space-y-1.5">
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {personId
                ? `Linked person: ${personName || clientName || `people/${personId}`}`
                : 'No person linked. Search and attach a CRM contact.'}
            </p>
            {personId ? (
              <Link href={`/admin/people/${personId}`} style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-xs)' }}>
                Open person file
              </Link>
            ) : null}
            <TextField
              label="Find person"
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
              hint="Name, at least two characters. This is the person-link, not free-text client name."
            />
            <Button
              type="button"
              variant="quiet"
              disabled={isPending || personQuery.trim().length < 2}
              onClick={() => {
                startTransition(async () => {
                  const { data, error } = await searchCmaPersonAction(personQuery)
                  if (error) toast.error(error)
                  else setPersonHits(data)
                })
              }}
            >
              Search people
            </Button>
            {personHits.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {personHits.map((hit) => (
                  <li key={hit.id} style={{ marginBottom: 6 }}>
                    <Button
                      type="button"
                      variant="quiet"
                      className="w-full"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const { data, error } = await attachCmaPersonAction({
                            slug: props.slug,
                            personId: hit.id,
                          })
                          if (error || !data) {
                            toast.error(error ?? 'Could not link this person.')
                            return
                          }
                          setPersonId(data.personId)
                          setPersonName(data.clientName ?? hit.name ?? '')
                          if (data.clientName) setClientName(data.clientName)
                          if (data.clientEmail) {
                            setClientEmail(data.clientEmail)
                            setToEmail(data.clientEmail)
                          }
                          if (data.clientPhone) setClientPhone(data.clientPhone)
                          setPersonHits([])
                          setPersonQuery('')
                          toast.success(`Linked to ${data.clientName ?? hit.name ?? `people/${hit.id}`}.`)
                          router.refresh()
                        })
                      }}
                    >
                      {hit.name ?? `people/${hit.id}`}
                      {hit.email ? ` · ${hit.email}` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <TextField label="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <TextField label="Client phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />

          <div className="grid gap-4 md:grid-cols-3">
            <TextField label="Beds" inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value)} />
            <TextField label="Baths" inputMode="decimal" value={baths} onChange={(e) => setBaths(e.target.value)} />
            <TextField label="Sqft" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </div>
          <SelectField
            label="Rent or sell"
            value={intent}
            onChange={(e) => setIntent(isCmaClientIntent(e.target.value) ? e.target.value : '')}
          >
            <option value="">Not set</option>
            <option value="sell">{cmaClientIntentLabel('sell')}</option>
            <option value="rent">{cmaClientIntentLabel('rent')}</option>
            <option value="both">{cmaClientIntentLabel('both')}</option>
          </SelectField>

          <div className="space-y-1.5">
            <SelectField label="Signing broker" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
              {props.brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.displayName}
                </option>
              ))}
            </SelectField>
            <Button
              type="button"
              variant="quiet"
              className="mt-2"
              disabled={isPending || !isDraft || brokerSlug === (props.brokerSlug ?? '')}
              onClick={rebrand}
            >
              Re-brand for this broker
            </Button>
          </div>

          <TextField
            label="Adjust recommended list price"
            placeholder={props.recommendedList != null ? String(props.recommendedList) : 'e.g. 725000'}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
            hint={`Data-supported recommendation: ${usd(props.recommendedList)}. Setting a number here re-anchors the tier grid on your price and notes the adjustment in the document. Leave blank to keep the computed value.`}
          />

          <Button onClick={rebuild} disabled={isPending} variant="quiet" touch className="w-full">
            {isPending ? 'Working…' : 'Save and rebuild'}
          </Button>
        </div>
      </details>

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Remove
        </summary>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          <Button onClick={toggleArchive} variant="quiet" touch className="w-full" disabled={isPending}>
            {isArchived ? 'Restore from archive' : 'Archive CMA'}
          </Button>
          <Button onClick={() => setDeleteOpen(true)} variant="danger" touch className="w-full" disabled={isPending}>
            Delete CMA
          </Button>
        </div>
      </details>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this CMA?"
        description="The stored document, pricing, and comp set are removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        busy={isPending}
      />
    </div>
  )
}
