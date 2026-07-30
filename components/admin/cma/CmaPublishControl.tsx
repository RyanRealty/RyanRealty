'use client'

/**
 * CmaPublishControl — put this CMA's opinion of value on its listing page, or
 * take it back down.
 *
 * Same idiom as CmaReviewActions (useTransition + a server action + a toast +
 * a Dialog for the consequential step), because this is the same rail.
 *
 * Three states, and only one of them offers a button:
 *
 *   INELIGIBLE — the document cannot publish. The reasons come from
 *   publishBlockers() in lib/data/cma/getPublishedCma.ts, computed on the
 *   server by the page, so this component never guesses and never offers an
 *   action the server would refuse.
 *
 *   ELIGIBLE — a confirm dialog spells out exactly what becomes public before
 *   anything is written.
 *
 *   PUBLISHED — one click takes it down, with the consequence stated: every
 *   download link already handed out stops working, because every delivery
 *   re-checks the publish flag.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import {
  publishCmaToListingAction,
  unpublishCmaFromListingAction,
} from '@/app/actions/cma-publish'

export interface CmaPublishControlProps {
  slug: string
  subjectAddress: string
  listingKey: string | null
  valueLow: number | null
  valueHigh: number | null
  published: boolean
  publishedAt: string | null
  publishedBy: string | null
  /** Plain-language reasons this document cannot publish. Empty means eligible. */
  blockers: string[]
}

export function CmaPublishControl(props: CmaPublishControlProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const range =
    props.valueLow != null && props.valueHigh != null
      ? `${formatPriceExact(props.valueLow)} to ${formatPriceExact(props.valueHigh)}`
      : null
  const canPublish = props.blockers.length === 0

  function publish() {
    setConfirmOpen(false)
    startTransition(async () => {
      const { error, blockers } = await publishCmaToListingAction(props.slug)
      if (error) toast.error(blockers?.length ? `${error} ${blockers[0]}` : error)
      else {
        toast.success('Published. The value range is now on the listing page.')
        router.refresh()
      }
    })
  }

  function unpublish() {
    startTransition(async () => {
      const { error } = await unpublishCmaFromListingAction(props.slug)
      if (error) toast.error(error)
      else {
        toast.success('Taken down. Every download link already handed out is dead.')
        router.refresh()
      }
    })
  }

  if (props.published) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Live on the listing page</Badge>
          {props.publishedAt ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              since {formatDate(props.publishedAt)}
              {props.publishedBy ? ` by ${props.publishedBy}` : ''}
            </span>
          ) : null}
        </div>

        {range ? (
          <p className="text-sm text-foreground">
            Public right now: <span className="font-medium tabular-nums">{range}</span> on{' '}
            {props.subjectAddress}.
          </p>
        ) : null}

        {props.listingKey ? (
          <Button asChild variant="outline" className="w-full min-h-11">
            <Link href={`/listing/${props.listingKey}`} target="_blank" rel="noopener noreferrer">
              View the live listing page
            </Link>
          </Button>
        ) : null}

        <Separator />

        <Button onClick={unpublish} variant="destructive" className="w-full min-h-11" disabled={isPending}>
          {isPending ? 'Taking it down…' : 'Take it down now'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Takes effect on the next page load. It also kills every download link already handed out, because each
          delivery re-checks this flag. Anyone holding a link has to register again after you republish.
        </p>
      </div>
    )
  }

  if (!canPublish) {
    return (
      <div className="space-y-3">
        <Badge variant="outline">Not on the listing page</Badge>
        <p className="text-sm text-foreground">This CMA cannot be published yet.</p>
        <ul className="space-y-2">
          {props.blockers.map((reason) => (
            <li key={reason} className="text-sm text-muted-foreground">
              {reason}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Clear the reasons above and the publish button appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Badge variant="outline">Not on the listing page</Badge>
      <p className="text-sm text-muted-foreground">
        Ready to publish. The listing page would show the value range and the county facts behind it.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button className="w-full min-h-11" disabled={isPending}>
            {isPending ? 'Publishing…' : 'Publish to the listing page'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put this opinion of value on the public page?</DialogTitle>
            <DialogDescription>
              Anyone who opens the listing page for {props.subjectAddress} will see it, with no sign-in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Becomes public</div>
              <ul className="mt-1 space-y-1">
                <li className="tabular-nums text-foreground">{range ?? 'The value range'}</li>
                <li className="text-foreground">{props.subjectAddress}</li>
                <li className="text-muted-foreground">
                  The county and FEMA facts about the property, each with its source
                </li>
                <li className="text-muted-foreground">
                  How many sales we started from, and the months they closed in
                </li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Stays private</div>
              <ul className="mt-1 space-y-1">
                <li className="text-muted-foreground">
                  Every sold comp, by address, price, and date. Those reach a visitor only after they register.
                </li>
                <li className="text-muted-foreground">
                  Your recommended list price. That is advice to the seller and never renders publicly.
                </li>
                <li className="text-muted-foreground">The client name, email, and phone on this document.</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Reversible any time from this panel, and taking it down kills outstanding download links.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={isPending}>
              Publish it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
