'use client'

/**
 * BpoReviewActions — the review-page control panel for one Broker Price Opinion.
 * Rebuild (with an optional broker opinion-of-value override + purpose),
 * finalize the draft, or delete. Every mutation runs through a gated server
 * action; the page revalidates on success.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { rebuildBpoAction, finalizeBpoAction, deleteBpoAction } from '@/app/actions/bpo-admin'

export interface BrokerOption {
  slug: string
  displayName: string
}

export function BpoReviewActions(props: {
  bpoId: string
  slug: string
  status: string
  opinionValue: number | null
  priceOverride: number | null
  purpose: string | null
  brokerSlug: string | null
  brokers: BrokerOption[]
  hasDocument: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [override, setOverride] = useState(props.priceOverride ? String(props.priceOverride) : '')
  const [purpose, setPurpose] = useState(props.purpose ?? '')
  const [brokerSlug, setBrokerSlug] = useState(props.brokerSlug ?? props.brokers[0]?.slug ?? 'matthew-ryan')

  function rebuild() {
    const parsed = override.trim() ? Number(override.replace(/[^0-9.]/g, '')) : null
    startTransition(async () => {
      const { error } = await rebuildBpoAction({
        slug: props.slug,
        priceOverride: parsed && parsed > 0 ? parsed : null,
        brokerSlug,
        purpose: purpose.trim() || null,
      })
      if (error) toast.error(error)
      else {
        toast.success('Rebuilt. Review the updated opinion.')
        router.refresh()
      }
    })
  }

  function finalize() {
    startTransition(async () => {
      const res = await finalizeBpoAction(props.slug)
      if (res.error && res.needsReviewAck) {
        // Accuracy gate: the build carries review findings. Finalizing is the
        // broker's call, but only with the findings explicitly acknowledged.
        const ack = confirm(
          `${res.error}\n\nReview the findings in the document and the build summary. Finalize anyway, acknowledging the recorded findings?`,
        )
        if (!ack) return
        const retry = await finalizeBpoAction(props.slug, { acknowledgeReview: true })
        if (retry.error) toast.error(retry.error)
        else {
          toast.success('Finalized with review findings acknowledged.')
          router.refresh()
        }
        return
      }
      if (res.error) toast.error(res.error)
      else {
        toast.success('Finalized.')
        router.refresh()
      }
    })
  }

  function remove() {
    if (!confirm('Delete this broker price opinion? This cannot be undone.')) return
    startTransition(async () => {
      const { error } = await deleteBpoAction(props.bpoId)
      if (error) toast.error(error)
      else {
        toast.success('Deleted.')
        router.push('/admin/bpo')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bpo-override">Opinion of value override</Label>
        <Input
          id="bpo-override"
          inputMode="numeric"
          placeholder={props.opinionValue ? props.opinionValue.toLocaleString('en-US') : 'e.g. 1200000'}
          value={override}
          onChange={(e) => setOverride(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to keep the data-derived opinion. A number re-anchors the opinion and range on your figure and
          notes the adjustment in the rationale.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bpo-purpose-edit">Purpose</Label>
        <Input
          id="bpo-purpose-edit"
          placeholder="pre-listing"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bpo-broker-edit">Signing broker</Label>
        <Select value={brokerSlug} onValueChange={setBrokerSlug}>
          <SelectTrigger id="bpo-broker-edit" className="w-full">
            <SelectValue placeholder="Select a broker" />
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

      <Button onClick={rebuild} disabled={isPending} variant="outline" className="w-full min-h-11">
        {isPending ? 'Working…' : 'Save and rebuild'}
      </Button>

      <Separator />

      {props.status !== 'final' ? (
        <Button onClick={finalize} disabled={isPending || !props.hasDocument} className="w-full min-h-11">
          Finalize opinion
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          This opinion is finalized. Rebuild to return it to a draft for edits.
        </p>
      )}

      <Button onClick={remove} disabled={isPending} variant="ghost" className="w-full text-destructive">
        Delete
      </Button>
    </div>
  )
}
