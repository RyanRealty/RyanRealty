'use client'

/**
 * Review-page action rail: edit client info + price adjustment (rebuild),
 * approve draft → finalized, send to lead (tracked email), create a Gmail
 * draft, or delete. Sending requires the explicit button click plus a
 * confirmation dialog — nothing fires automatically.
 */

import { useState, useTransition } from 'react'
import { formatPriceExact } from '@/lib/format/money'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  rebuildCmaAction,
  approveCmaAction,
  deleteCmaAction,
  sendCmaToLeadAction,
  createCmaGmailDraftAction,
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
        brokerSlug,
      })
      if (error) toast.error(error)
      else {
        toast.success('Rebuilt. The preview below is the new document.')
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
      const { error } = await sendCmaToLeadAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success(`Sent to ${clientEmail.trim()}. Opens and clicks will track on the contact.`)
        router.refresh()
      }
    })
  }

  function gmailDraft() {
    startTransition(async () => {
      const { data, error } = await createCmaGmailDraftAction(props.slug)
      if (error) toast.error(error)
      else toast.success(`Gmail draft created${data?.draftId ? ` (${data.draftId})` : ''}. Review it in the broker's Drafts folder.`)
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

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rv-client-name">Client name</Label>
          <Input id="rv-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rv-client-email">Client email</Label>
          <Input id="rv-client-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rv-client-phone">Client phone</Label>
          <Input id="rv-client-phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rv-broker">Signing broker</Label>
          <Select value={brokerSlug} onValueChange={setBrokerSlug}>
            <SelectTrigger id="rv-broker" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.brokers.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rv-price">Adjust recommended list price</Label>
          <Input
            id="rv-price"
            placeholder={props.recommendedList != null ? String(props.recommendedList) : 'e.g. 725000'}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Data-supported recommendation: {usd(props.recommendedList)}. Setting a number here re-anchors the
            tier grid on your price and notes the adjustment in the document. Leave blank to keep the computed value.
          </p>
        </div>
        <Button onClick={rebuild} disabled={isPending} className="w-full min-h-11" variant="secondary">
          {isPending ? 'Working…' : 'Save and rebuild'}
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        {isDraft ? (
          <Button onClick={approve} disabled={isPending || !props.hasDocument} className="w-full min-h-11">
            Approve (draft to final)
          </Button>
        ) : null}

        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogTrigger asChild>
            <Button className="w-full min-h-11" disabled={isPending || !isSendable}>
              Send to lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send this CMA to the lead?</DialogTitle>
              <DialogDescription>
                A tracked email goes to {clientEmail.trim() || 'the client'} with the PDF attached and a link
                to the online report. Opens and clicks land on the contact record.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendToLead} disabled={isPending}>
                Send now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {!isSendable && props.status === 'draft' ? (
          <p className="text-xs text-muted-foreground">Approve the draft before sending.</p>
        ) : null}
        {!clientEmail.trim() ? (
          <p className="text-xs text-muted-foreground">Add a client email (and rebuild) to enable sending.</p>
        ) : null}

        <Button
          onClick={gmailDraft}
          disabled={isPending || !isSendable}
          variant="outline"
          className="w-full min-h-11"
        >
          Create Gmail draft instead
        </Button>
      </div>

      <Separator />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="w-full min-h-11" disabled={isPending}>
            Delete CMA
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this CMA?</DialogTitle>
            <DialogDescription>
              The stored document, pricing, and comp set are removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
