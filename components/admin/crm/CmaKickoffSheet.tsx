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
 * Built on the admin v2 <Dialog> (design_system/admin/ADMIN_UI.md), which wraps
 * the platform <dialog>: focus trap, Esc and top-layer stacking come from the
 * browser. Opened by state (the URL param), not a trigger.
 *
 * Submit resolution (abort-retry + in-flight polling) lives in
 * ./cma-kickoff-client.ts — pure and unit-tested (adversarial review 2026-07-17).
 *
 * 11F notes:
 *  - The shadcn onOpenChange guard ("never dismiss mid-flight") becomes the
 *    onClose guard. Esc reaches onCancel, which preventDefaults, so a pending
 *    build keeps the dialog up exactly as before.
 *  - Label + Input -> TextField, whose FieldShell owns the <label htmlFor> pair.
 *  - ci:admin-ui rule C — one primary Button per file. The kick-off is it. The
 *    done-state "Build a fresh CMA" is quiet: at that point a CMA already
 *    exists, and reviewing it is the recommended path (it was the outlined
 *    action before, and stays visually ahead of nothing).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, Dialog, TextField } from '@/components/admin/v2'
import { kickoffCmaForContactAction } from '@/app/actions/crm-cma-kickoff'
import { resolveKickoff } from './cma-kickoff-client'

type DoneState = {
  slug: string
  alreadyQueued: boolean
  alreadyBuilt: boolean
  existingStatus: string | null
  /** The terminal state came from the explicit fresh-build confirmation. */
  freshBuild: boolean
}

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
  // the same request server-side instead of enqueueing a second build. The
  // fresh-build confirmation is a DISTINCT request (the first key already
  // stored the alreadyBuilt result), so it carries its own per-mount key —
  // still double-tap-safe.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])
  const freshBuildKey = useMemo(() => crypto.randomUUID(), [])

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

  const submit = (buildNewVersion = false) => {
    setError(null)
    startTransition(async () => {
      const outcome = await resolveKickoff(() =>
        kickoffCmaForContactAction({
          personId,
          address,
          idempotencyKey: buildNewVersion ? freshBuildKey : idempotencyKey,
          buildNewVersion,
        }),
      )
      if (outcome.kind === 'done') {
        setDone({
          slug: outcome.result.slug,
          alreadyQueued: outcome.result.alreadyQueued,
          alreadyBuilt: outcome.result.alreadyBuilt ?? false,
          existingStatus: outcome.result.existingStatus ?? null,
          freshBuild: buildNewVersion,
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
      : done?.freshBuild
        ? 'Fresh CMA build kicked off'
        : 'CMA build kicked off'
  const doneBody = done?.alreadyBuilt
    ? `A ${done.existingStatus ?? 'previous'} CMA for ${address.trim()} already exists. Nothing was rebuilt or overwritten — review it and send it from there, or build a fresh one with current comps.`
    : done?.alreadyQueued
      ? `A CMA for ${address.trim()} is already in the build queue. No duplicate was created — you'll get a text when the draft is ready to review.`
      : done?.freshBuild
        ? `Building a fresh CMA for ${address.trim()} with current comps. The existing document keeps its link. You'll get a text when the new draft is ready to review.`
        : `Building the CMA for ${address.trim()} now. You'll get a text when the draft is ready to review.`

  // The shadcn onOpenChange guard, moved to the one dismissal callback the v2
  // Dialog exposes: Esc, the header Close button and a programmatic close all
  // arrive here, and a build in flight still refuses to dismiss.
  const dismiss = () => {
    if (!pending) close()
  }

  // ONE Dialog across both states, exactly as the single DialogContent was.
  // Branching into two <Dialog> elements would unmount the native <dialog> and
  // remount it mid-flow, flashing the modal closed and open again.
  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title={done === null ? 'Build a CMA' : doneTitle}
      description={
        done === null
          ? `${personName ?? 'This contact'}${contactLine ? ` · ${contactLine}` : ''}`
          : doneBody
      }
      footer={
        // The stacked footer, plus the trailing reassurance line, reproduce the
        // original order (actions, then the note). av2-dialog__foot is a flex
        // row, so the column lives on this wrapper.
        done === null ? (
          <div className="flex w-full flex-col gap-2">
            <Button onClick={() => submit()} disabled={pending || address.trim().length === 0}>
              {pending ? 'Kicking off…' : 'Build CMA — text me when ready'}
            </Button>
            <Button variant="quiet" onClick={close} disabled={pending}>
              Not now
            </Button>
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              The draft lands in the CMA queue for your review. Nothing is sent to the lead until
              you approve it.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <Link
              href={done.alreadyBuilt ? `/admin/cmas/${done.slug}` : '/admin/cmas'}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              {done.alreadyBuilt ? 'Review the existing CMA' : 'Open the CMA queue'}
            </Link>
            {done.alreadyBuilt ? (
              <Button variant="quiet" onClick={() => submit(true)} disabled={pending}>
                {pending ? 'Kicking off…' : 'Build a fresh CMA — text me when ready'}
              </Button>
            ) : null}
            <Button variant="quiet" onClick={close} disabled={pending}>
              Done
            </Button>
            {done.alreadyBuilt ? (
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                A fresh build pulls current comps into a separate new version. The existing
                document and its link stay exactly as they are.
              </p>
            ) : null}
          </div>
        )
      }
    >
      {done === null ? (
        <div className="space-y-1.5">
          <TextField
            label="Property address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 NW Bond St, Bend"
            autoComplete="off"
            // `text-base` was load-bearing, not decoration: iOS auto-zooms a
            // focused field under 16px. --a-text-lg IS 16px, and an inline style
            // beats .av2-input's own font-size without restating its class (a
            // className passed to TextField REPLACES av2-input — it spreads rest
            // after its own className).
            style={{ fontSize: 'var(--a-text-lg)' }}
          />
          {suggestedAddress ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Pulled from their message. Confirm it before building.
            </p>
          ) : (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Include the city so comps resolve.
            </p>
          )}
        </div>
      ) : null}
      {error ? <p style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-danger)' }}>{error}</p> : null}
    </Dialog>
  )
}
