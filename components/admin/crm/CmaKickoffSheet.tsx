'use client'

/**
 * One-tap CMA kick-off dialog (admin-rebuild v2, D8 — the litmus surface).
 *
 * Auto-opens when the person page is reached with `?intent=cma` (the new-lead
 * notification deep link). Pre-filled with the resolved lead + best subject
 * address; one primary tap kicks off the standard draft-first async CMA build
 * and the broker gets a TEXT when the draft is ready to review in /admin/cmas.
 * Nothing is ever auto-sent to the lead (§0 / D8).
 *
 * Built on the design-system <Dialog> (focus-trap + Escape + tokens per
 * ci:design-tokens); opened by state (the URL param), not a trigger.
 *
 * Submit resolution (abort-retry + in-flight polling) lives in
 * ./cma-kickoff-client.ts — pure and unit-tested (adversarial review 2026-07-17).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { kickoffCmaForContactAction } from '@/app/actions/crm-cma-kickoff'
import { resolveKickoff } from './cma-kickoff-client'

type DoneState = { slug: string; alreadyQueued: boolean; alreadyBuilt: boolean }

export function CmaKickoffSheet({
  personId,
  personName,
  personPhone,
  personEmail,
  suggestedAddress,
  autoOpen,
}: {
  personId: number
  personName: string | null
  personPhone: string | null
  personEmail: string | null
  suggestedAddress: string | null
  autoOpen: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const [address, setAddress] = useState(suggestedAddress ?? '')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<DoneState | null>(null)
  const [pending, startTransition] = useTransition()
  // One key per mount: a double-tap (or retry after a transient error) replays
  // the same request server-side instead of enqueueing a second build.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  const close = () => {
    setOpen(false)
    // Strip ?intent so a soft refresh doesn't re-open the dialog.
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('intent')) {
        url.searchParams.delete('intent')
        window.history.replaceState(null, '', url.pathname + url.search)
      }
    } catch {
      /* non-fatal */
    }
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const outcome = await resolveKickoff(() =>
        kickoffCmaForContactAction({ personId, address, idempotencyKey }),
      )
      if (outcome.kind === 'done') {
        setDone({
          slug: outcome.result.slug,
          alreadyQueued: outcome.result.alreadyQueued,
          alreadyBuilt: outcome.result.alreadyBuilt ?? false,
        })
      } else {
        setError(outcome.message)
      }
    })
  }

  const contactLine = [personPhone, personEmail].filter(Boolean).join(' · ')
  const doneTitle = done?.alreadyBuilt
    ? 'CMA already on file'
    : done?.alreadyQueued
      ? 'Already building'
      : 'CMA build kicked off'
  const doneBody = done?.alreadyBuilt
    ? `A CMA for ${address.trim()} already exists. Nothing was rebuilt or overwritten — review the existing document and send it from there.`
    : done?.alreadyQueued
      ? `A CMA for ${address.trim()} is already in the build queue. No duplicate was created — you'll get a text when the draft is ready to review.`
      : `Building the CMA for ${address.trim()} now. You'll get a text when the draft is ready to review.`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) close()
      }}
    >
      <DialogContent className="max-w-md">
        {done === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Build a CMA</DialogTitle>
              <DialogDescription>
                {personName ?? 'This contact'}
                {contactLine ? ` · ${contactLine}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="cma-kickoff-address">Property address</Label>
              <Input
                id="cma-kickoff-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 NW Bond St, Bend"
                autoComplete="off"
                className="text-base"
              />
              {suggestedAddress ? (
                <p className="text-xs text-muted-foreground">
                  Pulled from their message. Confirm it before building.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Include the city so comps resolve.</p>
              )}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={submit} disabled={pending || address.trim().length === 0}>
                {pending ? 'Kicking off…' : 'Build CMA — text me when ready'}
              </Button>
              <Button variant="ghost" onClick={close} disabled={pending}>
                Not now
              </Button>
            </DialogFooter>
            <p className="text-xs text-muted-foreground">
              The draft lands in the CMA queue for your review. Nothing is sent to the lead until
              you approve it.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">{doneTitle}</DialogTitle>
              <DialogDescription>{doneBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button variant="outline" asChild>
                <Link href={done.alreadyBuilt ? `/admin/cmas/${done.slug}` : '/admin/cmas'}>
                  {done.alreadyBuilt ? 'Review the existing CMA' : 'Open the CMA queue'}
                </Link>
              </Button>
              <Button variant="ghost" onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
