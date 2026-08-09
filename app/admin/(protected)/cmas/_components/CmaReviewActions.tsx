'use client'

/**
 * Review-page action rail: edit client info + price adjustment (rebuild),
 * approve draft → finalized, send to lead, or delete. Send goes out through
 * the CRM — a real email from the signing broker's own mailbox, tracked and
 * logged on the contact's timeline. Sending requires the explicit button
 * click plus a confirmation dialog — nothing fires automatically.
 *
 * 11F: on the LOCKED admin v2 language. Label+Input+Select ->
 * TextField/SelectField, Separator -> a hairline div, the send-confirmation
 * Dialog stays a plain <Dialog> (mirrors CmaPublishControl and the BPO
 * family's send flow — sending is consequential but not destructive in
 * ConfirmDialog's sense), and the delete confirmation -> <ConfirmDialog>
 * (genuinely destructive + irreversible, exactly what it exists for).
 *
 * Gate note (ci:admin-ui rule C, at most one primary-variant Button per
 * file): this file carries three CTA-shaped moments (Approve, the "Send to
 * lead" trigger, and its dialog's "Send now" confirm) plus Save-and-rebuild
 * and Archive. "Send to lead" keeps the one primary accent — the highest-
 * stakes single click on this page (a real email leaving to a real client).
 * Approve, Save-and-rebuild and Archive are quiet; "Send now" is quiet too,
 * matching the confirm-is-never-primary idiom ConfirmDialog itself already
 * bakes in for Delete.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, ConfirmDialog, Dialog, SelectField, TextField } from '@/components/admin/v2'
import { formatPriceExact } from '@/lib/format/money'
import {
  rebuildCmaAction,
  rebrandCmaAction,
  approveCmaAction,
  archiveCmaAction,
  unarchiveCmaAction,
  deleteCmaAction,
  sendCmaToLeadAction,
} from '@/app/actions/cma-admin'

export interface CmaReviewActionsProps {
  cmaId: string
  slug: string
  status: string
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  recommendedList: number | null
  priceOverride: number | null
  brokerSlug: string | null
  brokers: Array<{ slug: string; displayName: string }>
  hasDocument: boolean
}

const usd = formatPriceExact

export function CmaReviewActions(props: CmaReviewActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [clientName, setClientName] = useState(props.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(props.clientEmail ?? '')
  const [clientPhone, setClientPhone] = useState(props.clientPhone ?? '')
  const [priceOverride, setPriceOverride] = useState(
    props.priceOverride != null ? String(props.priceOverride) : '',
  )
  const [brokerSlug, setBrokerSlug] = useState(props.brokerSlug ?? props.brokers[0]?.slug ?? 'matthew-ryan')
  const [sendOpen, setSendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isDraft = props.status === 'draft'
  const isArchived = props.status === 'archived'
  const isSendable = (props.status === 'finalized' || props.status === 'delivered') && Boolean(clientEmail.trim())

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
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        priceOverride: override,
      })
      if (error) toast.error(error)
      else {
        toast.success('Rebuilt. The preview below is the new document.')
        router.refresh()
      }
    })
  }

  /**
   * Swap the signature block only. This deliberately does NOT go through
   * rebuild(): rebuildCmaAction re-selects comparables and re-runs two
   * Anthropic passes, so routing a broker change through it could move the
   * recommended list price on a document a seller prices against.
   */
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
        toast.success('Approved. You can now send it to the lead.')
        router.refresh()
      }
    })
  }

  function sendToLead() {
    setSendOpen(false)
    startTransition(async () => {
      const { data, error } = await sendCmaToLeadAction(props.slug)
      if (error) toast.error(error)
      else {
        const from = data?.transport === 'gmail' && data.mailbox ? ` from ${data.mailbox}` : ''
        toast.success(`Sent to ${clientEmail.trim()}${from}. Opens, clicks, and replies land on the contact record.`)
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

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <TextField label="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        <TextField label="Client email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        <TextField label="Client phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />

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
          <p className="mt-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Re-renders the signature block. Pricing, comparables and citations stay exactly as built.
          </p>
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

      <div style={{ borderTop: '1px solid var(--a-border)' }} />

      <div className="space-y-2">
        {isDraft ? (
          <Button onClick={approve} disabled={isPending || !props.hasDocument} variant="quiet" touch className="w-full">
            Approve (draft to final)
          </Button>
        ) : null}

        <Button onClick={() => setSendOpen(true)} touch className="w-full" disabled={isPending || !isSendable}>
          Send to lead
        </Button>

        <Dialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          title="Send this CMA to the lead?"
          description={
            <>
              A tracked email goes to {clientEmail.trim() || 'the client'} through the CRM, sent from the signing
              broker&apos;s own mailbox with the PDF attached and a link to the online report. Opens, clicks, and
              replies land on the contact record.
            </>
          }
          footer={
            <>
              <Button variant="quiet" onClick={() => setSendOpen(false)}>
                Cancel
              </Button>
              <Button variant="quiet" onClick={sendToLead} disabled={isPending}>
                Send now
              </Button>
            </>
          }
        />
        {!isSendable && props.status === 'draft' ? (
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Approve the draft before sending.</p>
        ) : null}
        {!clientEmail.trim() ? (
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Add a client email (and rebuild) to enable sending.</p>
        ) : null}
      </div>

      <div style={{ borderTop: '1px solid var(--a-border)' }} />

      <Button onClick={toggleArchive} variant="quiet" touch className="w-full" disabled={isPending}>
        {isArchived ? 'Restore from archive' : 'Archive CMA'}
      </Button>

      <Button onClick={() => setDeleteOpen(true)} variant="danger" touch className="w-full" disabled={isPending}>
        Delete CMA
      </Button>
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
