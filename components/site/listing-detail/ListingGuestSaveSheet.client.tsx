'use client'

/**
 * Guest save capture — the email-first branch of the listing Save button.
 *
 * A signed-out Save used to bounce straight to the Google sheet, and the
 * visitor who declined left no trace (funnel audit 2026-09-01: the one
 * high-intent action with no guest path). This sheet asks for an email only,
 * routes through the hardened submitListingSaveCapture action, and keeps the
 * account path one tap away — "Save with Google instead" preserves the
 * pending-save resume exactly as before.
 *
 * Same V3Sheet idiom as ListingLikeThisSheet so the two listing-page asks
 * read as one system (TASTE.md consistency rule).
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitListingSaveCapture } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function ListingGuestSaveSheet({
  listingKey,
  addressLine,
  onUseGoogle,
  onDone,
}: {
  listingKey: string
  addressLine: string | null
  /** The existing OAuth path (stash pending save + open the Google sheet). */
  onUseGoogle: () => void
  /** Called after a successful capture so the caller can reflect saved state. */
  onDone?: () => void
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})
  const home = addressLine?.trim() || 'this home'

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await submitListingSaveCapture({
          email: answers.email ?? '',
          listingKey,
          addressLine: addressLine ?? undefined,
          company: answers.company ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          setStatus('sent')
          onDone?.()
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [listingKey, addressLine, onDone],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...event.answers }
      if (event.toStepId !== null) return
      void send(answersRef.current)
    },
    [send],
  )

  const askStep: V3SheetStep = {
    id: 'email',
    label: `Where should updates on ${home} go?`,
    children: 'Price changes and status updates for this home. Unsubscribe any time.',
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      placeholder: 'you@email.com',
      requiredMessage: 'An email is required so the updates have somewhere to land.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Save this home',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Saved. Updates on ${home} land by email.`,
            children: 'Sign in with Google any time to see every home you have saved in one place.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Saving this home.' }]
        : status === 'failed'
          ? [askStep, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : [askStep]

  const currentStepId =
    status === 'sent' ? 'sent' : status === 'sending' ? 'sending' : status === 'failed' ? 'failed' : 'email'

  return (
    <div>
      <V3Sheet
        id="guest-save"
        eyebrow="Save this home"
        heading={`Watch ${home} by email`}
        steps={steps}
        trap={{ name: 'company', label: 'Company' }}
        currentStepId={currentStepId}
        showProgress={false}
        showEcho={false}
        onStepChange={(id) => {
          if (id === 'email') setStatus('asking')
        }}
        onAdvance={onAdvance}
      />
      {status !== 'sent' ? (
        <button
          type="button"
          onClick={onUseGoogle}
          className="mt-2 text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground"
        >
          Save with Google instead
        </button>
      ) : null}
    </div>
  )
}
