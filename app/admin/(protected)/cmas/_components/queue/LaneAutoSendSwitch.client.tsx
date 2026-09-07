'use client'

/**
 * The Auto-send switch for one lane.
 *
 * This is the only control on the queue that changes what happens to documents
 * nobody has looked at yet, so turning it ON is confirmed in words that say
 * exactly what will happen, and turning it OFF is immediate — stopping mail
 * should never need a dialog.
 *
 * A lane whose switch cannot do anything renders as a disabled control with the
 * reason beside it, not as an armed-looking toggle.
 */

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog, Switch } from '@/components/admin/v2'

export function LaneAutoSendSwitch({
  lane,
  laneLabel,
  on,
  cold,
  disabledReason,
  setAutoSend,
}: {
  lane: string
  laneLabel: string
  on: boolean
  /** Cold lanes ride the weekday drip; asked lanes send immediately. */
  cold: boolean
  /** When set, the switch is inert and this says why. */
  disabledReason?: string | null
  setAutoSend: (origin: string, on: boolean) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const apply = useCallback(
    async (next: boolean) => {
      setBusy(true)
      try {
        const res = await setAutoSend(lane, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(next ? `Auto-send on for ${laneLabel}.` : `Auto-send off for ${laneLabel}.`)
        startTransition(() => router.refresh())
      } finally {
        setBusy(false)
        setConfirming(false)
      }
    },
    [lane, laneLabel, router, setAutoSend],
  )

  if (disabledReason) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch label="Auto-send" stateText="Auto-send" checked={false} disabled readOnly />
        <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>{disabledReason}</span>
      </span>
    )
  }

  return (
    <>
      <Switch
        label={`Auto-send for ${laneLabel}`}
        stateText="Auto-send"
        checked={on}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.checked
          if (next) setConfirming(true)
          else void apply(false)
        }}
      />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Turn on Auto-send for ${laneLabel}?`}
        description={
          <>
            Ready documents in this lane send without review.{' '}
            {cold
              ? 'Cold lanes go through the weekday drip.'
              : 'Asked lanes send immediately.'}{' '}
            A document that failed its audit, that nothing audited, that is flagged, or whose build
            failed is never sent.
          </>
        }
        confirmLabel="Turn on Auto-send"
        busy={busy}
        onConfirm={() => void apply(true)}
      />
    </>
  )
}
