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
 *   anything is written. Anything the audit called `major` or `minor` is
 *   printed here verbatim, in the panel and again in the dialog. Those do not
 *   block, so the broker is the one who decides, and deciding requires reading
 *   the actual sentence rather than a "flagged for review" badge.
 *
 *   PUBLISHED — one click takes it down, with the consequence stated: every
 *   download link already handed out stops working, because every delivery
 *   re-checks the publish flag.
 *
 * 11F: on the LOCKED admin v2 language. Badge -> StateWord, Separator -> a
 * hairline div, the confirm Dialog stays a plain <Dialog> (not
 * ConfirmDialog) — publish/unpublish are consequential but not destructive
 * in ConfirmDialog's sense (nothing is deleted), matching the original,
 * which used the plain shadcn Dialog rather than AlertDialog here too.
 * "Take it down now" stays a direct danger-variant click with no
 * confirmation step, exactly as before — the original never wrapped it in a
 * dialog, and adding one now would be a behavior change outside this
 * migration's scope.
 *
 * Gate note (ci:admin-ui rule C, at most one primary-variant Button per
 * file): the dialog TRIGGER ("Publish to the listing page") carries the
 * page's one primary accent; the dialog's own CONFIRM ("Publish it") is
 * quiet, matching the confirm-is-never-primary idiom ConfirmDialog itself
 * already bakes in (its footer is Cancel=quiet + Confirm=danger, never
 * primary).
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, Dialog, StateWord } from '@/components/admin/v2'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { publishCmaToListingAction, unpublishCmaFromListingAction } from '@/app/actions/cma-publish'

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
  /**
   * Non-blocking findings, from cmaPublishConcerns(). Structurally the
   * CmaPublishConcern type, restated here so this client component never
   * imports a server-only module.
   */
  concerns?: { severity: 'major' | 'minor'; category: string; reason: string }[]
}

/** The audit's own words, printed. Majors first, minors under their own label. */
function ConcernList({ concerns }: { concerns: CmaPublishControlProps['concerns'] }) {
  const majors = (concerns ?? []).filter((c) => c.severity === 'major')
  const minors = (concerns ?? []).filter((c) => c.severity === 'minor')
  if (majors.length === 0 && minors.length === 0) return null

  return (
    <div
      className="space-y-2"
      style={{ borderRadius: 'var(--a-r-lg)', border: '1px solid var(--a-border)', padding: 12 }}
    >
      {majors.length > 0 ? (
        <>
          <div style={{ fontSize: 'var(--a-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--a-text-2)' }}>
            Read before you publish
          </div>
          <ul className="space-y-2">
            {majors.map((c) => (
              <li key={c.reason} style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
                {c.reason}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {minors.length > 0 ? (
        <>
          <div style={{ fontSize: 'var(--a-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--a-text-2)' }}>
            Minor notes
          </div>
          <ul className="space-y-1">
            {minors.map((c) => (
              <li key={c.reason} style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {c.reason}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        None of these stop a publish on their own. Only a critical finding does that.
      </p>
    </div>
  )
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
          <StateWord state="ok">Live on the listing page</StateWord>
          {props.publishedAt ? (
            <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              since {formatDate(props.publishedAt)}
              {props.publishedBy ? ` by ${props.publishedBy}` : ''}
            </span>
          ) : null}
        </div>

        {range ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
            Public right now: <span className="a-num" style={{ fontWeight: 500 }}>{range}</span> on {props.subjectAddress}.
          </p>
        ) : null}

        {props.listingKey ? (
          <Link
            href={`/listing/${props.listingKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="av2-btn av2-btn--quiet av2-btn--touch w-full"
            style={{ textDecoration: 'none' }}
          >
            View the live listing page
          </Link>
        ) : null}

        <div style={{ borderTop: '1px solid var(--a-border)' }} />

        <Button onClick={unpublish} variant="danger" touch className="w-full" disabled={isPending}>
          {isPending ? 'Taking it down…' : 'Take it down now'}
        </Button>
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Takes effect on the next page load. It also kills every download link already handed out, because each
          delivery re-checks this flag. Anyone holding a link has to register again after you republish.
        </p>
      </div>
    )
  }

  if (!canPublish) {
    return (
      <div className="space-y-3">
        <StateWord state="waiting">Not on the listing page</StateWord>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>This CMA cannot be published yet.</p>
        <ul className="space-y-2">
          {props.blockers.map((reason) => (
            <li key={reason} style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {reason}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Clear the reasons above and the publish button appears here.
        </p>
        <ConcernList concerns={props.concerns} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <StateWord state="waiting">Not on the listing page</StateWord>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Ready to publish. The listing page would show the value range and the county facts behind it.
      </p>

      <ConcernList concerns={props.concerns} />

      <Button onClick={() => setConfirmOpen(true)} touch className="w-full" disabled={isPending}>
        {isPending ? 'Publishing…' : 'Publish to the listing page'}
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Put this opinion of value on the public page?"
        description={`Anyone who opens the listing page for ${props.subjectAddress} will see it, with no sign-in.`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={publish} disabled={isPending}>
              Publish it
            </Button>
          </>
        }
      >
        <div className="space-y-3" style={{ fontSize: 'var(--a-text-sm)' }}>
          <div>
            <div style={{ fontSize: 'var(--a-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--a-text-2)' }}>
              Becomes public
            </div>
            <ul className="mt-1 space-y-1">
              <li className="a-num" style={{ color: 'var(--a-text)' }}>
                {range ?? 'The value range'}
              </li>
              <li style={{ color: 'var(--a-text)' }}>{props.subjectAddress}</li>
              <li style={{ color: 'var(--a-text-2)' }}>The county and FEMA facts about the property, each with its source</li>
              <li style={{ color: 'var(--a-text-2)' }}>How many sales we started from, and the months they closed in</li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 'var(--a-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--a-text-2)' }}>
              Stays private
            </div>
            <ul className="mt-1 space-y-1">
              <li style={{ color: 'var(--a-text-2)' }}>
                Every sold comp, by address, price, and date. Those reach a visitor only after they register.
              </li>
              <li style={{ color: 'var(--a-text-2)' }}>Your recommended list price. That is advice to the seller and never renders publicly.</li>
              <li style={{ color: 'var(--a-text-2)' }}>The client name, email, and phone on this document.</li>
            </ul>
          </div>
          <ConcernList concerns={props.concerns} />
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Reversible any time from this panel, and taking it down kills outstanding download links.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
