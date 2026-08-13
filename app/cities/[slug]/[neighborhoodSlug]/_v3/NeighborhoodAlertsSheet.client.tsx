'use client'

/**
 * The neighborhood node's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED, and it is city-scoped on purpose. It calls
 * the same server action the KB block called, `submitSearchAlertSignup` in
 * app/actions/search-alert-capture.ts, with the same payload shape and the same
 * field name: `email`, under `filters` of `{ city, propertyType: 'A' }` and no
 * subdivision key. Neighborhood names are not 1:1 with MLS subdivision tags, so
 * a neighborhood filter here would be an invented narrowing (CLAUDE.md section
 * 0) — the KB block carried the same city scope and the same reason. The three
 * side effects that ran on success run here in the same order: the guest-watch
 * residual, the confirmation, and the `alert_create` measurement event.
 *
 * THE HONEYPOT IS A REAL HONEYPOT AGAIN. An earlier revision of this file sent
 * `company: ''` as a hardcoded constant, which kept the action's payload shape
 * intact and made its first defence dead on this surface: `submitSearchAlertSignup`
 * refuses when `company` arrives non-empty (app/actions/search-alert-capture.ts),
 * and a literal empty string can never arrive non-empty. The KB block bound that
 * key to a hidden input carrying real user state, so the removal was a genuine
 * reduction in a public server-action write path, whatever the payload looked
 * like. V3Sheet's `trap` prop is the barrel's answer: it renders the input inside
 * the form on every step, aria-hidden and out of the tab order, off-screen via CSS
 * rather than display:none so a scripted filler still finds it, and its value
 * arrives in `onAdvance().answers` under the same key. So the value forwarded to
 * the action is now whatever was typed into it, which is what makes the branch
 * able to fire. Rate limit, email validation, and the narrowing-filter check are
 * server-side and were never affected.
 *
 * ONE THING THE KB BLOCK HAD THAT THIS DOES NOT, declared in
 * design_system/ryan-realty/ui_kits/neighborhood/parity.json: THE POST-SUBMIT
 * "Sign in to manage alerts" LINK. A terminal Sheet step takes prose and no
 * links. The sentence that names the unsubscribe path survives here, and the
 * anchor itself survives on the page, in the closing block that carries this
 * node's outbound edges, with the same label and the same href.
 *
 * CONTROLLED, on purpose, for the reason the market hub's sheet states: `steps`
 * and `currentStepId` derive from one status value and always change together,
 * so the sheet never sees an id that names no step, and while the send is in
 * flight the only rendered step is terminal, so a second click cannot fire a
 * second submit.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

/**
 * The honeypot. `company` is the key the server action already checks, and it is
 * also the name a form-filling bot is looking for, so it is the name that baits.
 * Declared once and read in both places (the trap and the payload) so the key
 * cannot drift out of the branch it exists to trip.
 */
const TRAP = { name: 'company', label: 'Company' } as const

type Props = {
  /** The city the alert filter is scoped to. Also the name the copy uses. */
  cityName: string
  /** The neighborhood the visitor is standing in. Named in the copy only. */
  neighborhoodName: string
}

export function NeighborhoodAlertsSheet({ cityName, neighborhoodName }: Props) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters: { city: cityName, propertyType: 'A' },
          // The trap's value, not a constant. See the header.
          company: answers[TRAP.name] ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          // F2 residual (label + href only; no email) so return visits show the
          // soft "You're watching …" banner without an account.
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: cityName,
              city: cityName,
              extraFilters: { propertyType: 'A' },
            }),
          )
          setStatus('sent')
          // Same alert_create event as SearchAlertCapture (measurement parity).
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
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
    [cityName],
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
    label: `Where should new ${cityName} listings go?`,
    // THE COPY NAMES THE POPULATION THE FILTER ACTUALLY SENDS. It said "a
    // single-family home", and the filter is propertyType 'A' — the bucket that
    // also carries townhouses and condominiums, which is the same mislabel this
    // route carried in its H1 and its Q&A. Every alert this form creates can send
    // a townhouse, so the promise says home.
    //
    // THE STANDING DISCLOSURE IS BACK. The KB block always rendered "One email
    // per new listing. Unsubscribe any time." beside the field; the first version
    // of this sheet dropped both sentences, leaving a licensed broker's public
    // capture form collecting an address with no stated send frequency and no
    // stated way out. ci:alert-capture-disclosure ledgered this surface for both;
    // that row is deleted in the same change.
    children: `Enter your email. When a home hits the market in ${cityName} (including ${neighborhoodName}), you hear first. One email per new listing. Unsubscribe any time.`,
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
    advanceLabel: 'Email me new listings',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${cityName} listings land by email when they hit the market.`,
            children: `Next visit we will remind you that you are watching ${cityName}. Pause from any alert email.`,
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
      heading={`Get new ${cityName} listings by email`}
      eyebrow="New listings"
      steps={steps}
      trap={TRAP}
      currentStepId={currentStepId}
      showProgress={false}
      showEcho={false}
      onStepChange={(id) => {
        // Backing out of the failure screen returns the sheet to the question.
        if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
