'use client'

/**
 * The community node's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED from KbCommunityAlerts:
 *   - the same server action, `submitSearchAlertSignup` from
 *     app/actions/search-alert-capture.ts
 *   - the same payload: `{ email, filters, company }`, with `filters` carrying
 *     `city` always and `subdivision` only when the community has one, the
 *     exact keys the unified `listing_alerts` row is normalized from
 *   - the same field NAME on the one visible control: `email`
 *   - the same trap NAME on the one hidden control: `company`
 *   - the same two post-success side effects, in the same order: the guest-watch
 *     residual (`buildGuestWatchFromPlace` -> `rememberGuestWatch`) so a return
 *     visit shows "you are watching X" without an account, and the `alert_create`
 *     measurement event built by `buildAlertCreatePayload('daily')`.
 *
 * THE HONEYPOT IS BACK, through the barrel rather than around it. The first cut of
 * this sheet dropped it and declared the deletion, reasoning that V3Sheet renders
 * one labelled control per step and a trap is not a question. That reasoning is
 * why `trap` is a SHEET-level prop rather than a field kind: a honeypot is a
 * property of the working surface. Its value rides in `onAdvance().answers` under
 * `company` and reaches the action unchanged, so the first of that action's five
 * defences, the naive-bot filter in FRONT of the per-IP limiter, is restored on a
 * public write path. The limiter (fail-closed in production) and the RFC-bounded
 * email validation behind it are as they were.
 *
 * THE STANDING DISCLOSURE IS BACK TOO, and it had left with the honeypot without
 * being declared. KbCommunityAlerts always rendered "One email per new listing.
 * Unsubscribe any time." and, after a success, "Pause from any alert email." An
 * address collected on a licensed broker's site with no frequency statement and no
 * unsubscribe statement is a change to the capture contract, not a visual choice.
 * Both lines are step prose here. The third piece, "Sign in to manage alerts", was
 * a LINK, and V3Sheet renders prose rather than nodes on purpose (an open node slot
 * is the hole a nameless control walks through), so the route to manage a
 * subscription is a door in the closing block instead. That is the one barrel gap
 * this section still has, and it is reported to the orchestrator.
 *
 * Client because the answer, the send, and the confirmation are visitor-caused
 * state. Controlled on purpose: `steps` and `currentStepId` are derived from one
 * status value and always change together, so the sheet never sees an id that
 * names no step, and while the send is in flight the only rendered step is the
 * terminal one, so a second tap cannot fire a second submit.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function CommunityAlertSheet({
  communityName,
  city,
  subdivision,
}: {
  communityName: string
  city: string
  /** Empty string = whole city, exactly as KbCommunityAlerts read it. */
  subdivision: string
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const filters: Record<string, string> = {
        city,
        ...(subdivision ? { subdivision } : {}),
      }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
          // The trap's own answer, never a hardcoded ''. A filled `company` is the
          // action's signal to fake a success and write nothing, and hardcoding the
          // no-bot value is the same as having no trap.
          company: answers.company ?? '',
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName,
              city,
              subdivision: subdivision || undefined,
            }),
          )
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
          setStatus('sent')
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        // A thrown send is the same visitor-facing fact as a rejected one:
        // nothing was captured. Saying so beats a control that never resolves.
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [city, communityName, subdivision],
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
    label: `Where should new ${communityName} listings go?`,
    // What the address is used for, how often, and how it stops. Rendered on the
    // asking step, so it is on screen before the address is typed.
    children: 'One email per new listing. Unsubscribe any time.',
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      maxLength: 254,
      placeholder: 'you@email.com',
      requiredMessage: 'An email is required so the alert has somewhere to land.',
      invalidMessage: 'That address does not look complete.',
    },
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${communityName} listings land by email when they hit the market.`,
            children: 'One email per new listing. Pause or unsubscribe from any alert email.',
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Setting up your alert.' }]
        : status === 'failed'
          ? [askStep, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : [askStep]

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'failed'
          ? 'failed'
          : 'email'

  return (
    <V3Sheet
      id="alerts"
      eyebrow="New listings"
      heading={`Get new ${communityName} listings by email`}
      steps={steps}
      // The bait keeps the name a scripted post reads and fills. Nobody sees it:
      // the pair is aria-hidden and out of the tab order inside the primitive.
      trap={{ name: 'company', label: 'Company' }}
      currentStepId={currentStepId}
      showProgress={false}
      showEcho={false}
      onStepChange={(id) => {
        // Backing out of the failure screen returns the sheet to the question.
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
