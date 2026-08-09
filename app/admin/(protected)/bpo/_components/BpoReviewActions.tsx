'use client'

/**
 * BpoReviewActions — the review-page control panel for one Broker Price Opinion.
 * Rebuild (with an optional broker opinion-of-value override + purpose),
 * finalize the draft, or delete. Every mutation runs through a gated server
 * action; the page revalidates on success.
 *
 * 11F: on the LOCKED admin v2 language (this island's page,
 * /admin/bpo/[slug]/page.tsx, already migrated — this brings the mounted
 * control panel to match). Label+Input+Select -> TextField/SelectField,
 * Separator -> a hairline div. confirm() calls are untouched (not a send
 * surface — that restriction is BpoSendDialog's).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, SelectField, TextField } from '@/components/admin/v2'
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
      <TextField
        label="Opinion of value override"
        inputMode="numeric"
        placeholder={props.opinionValue ? props.opinionValue.toLocaleString('en-US') : 'e.g. 1200000'}
        value={override}
        onChange={(e) => setOverride(e.target.value)}
        hint="Leave blank to keep the data-derived opinion. A number re-anchors the opinion and range on your figure and notes the adjustment in the rationale."
      />

      <TextField label="Purpose" placeholder="pre-listing" value={purpose} onChange={(e) => setPurpose(e.target.value)} />

      <SelectField label="Signing broker" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
        {props.brokers.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.displayName}
          </option>
        ))}
      </SelectField>

      <Button onClick={rebuild} disabled={isPending} variant="quiet" touch className="w-full">
        {isPending ? 'Working…' : 'Save and rebuild'}
      </Button>

      <div style={{ borderTop: '1px solid var(--a-border)' }} />

      {props.status !== 'final' ? (
        <Button onClick={finalize} disabled={isPending || !props.hasDocument} touch className="w-full">
          Finalize opinion
        </Button>
      ) : (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          This opinion is finalized. Rebuild to return it to a draft for edits.
        </p>
      )}

      <Button onClick={remove} disabled={isPending} variant="danger" touch className="w-full">
        Delete
      </Button>
    </div>
  )
}
