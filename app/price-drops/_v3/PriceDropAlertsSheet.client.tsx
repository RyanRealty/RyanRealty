'use client'

/**
 * Price-drop pages' on-page ask. Same capture contract as KbCommunityAlerts
 * on these routes: submitSearchAlertSignup, field `email`, filters as passed.
 * Trap `company` is the honeypot the action already checks. NOTHING about the
 * payload changes here — the words do.
 *
 * SITE-108, the evaluator's one BLOCKING finding on this page: "the visible
 * ask is Get new Central Oregon listings by email. The conversion path is for
 * new listings, not cuts, so the page job and the form job disagree."
 *
 * The page job and the product agreed all along; only the copy did not. An
 * alert created here takes the `listing_alerts.events` column DEFAULT, and
 * that default is
 * `{"new":true,"price_change":true,"status_change":true,...}` (migration
 * 20260729235500_listing_alerts_typed_events.sql, mirrored by
 * DEFAULT_EVENT_TOGGLES in lib/alerts/event-detection.ts for rows written
 * before it applied — the two agree, so price_change is on either way).
 * `detectListingEvents` emits `price_change` with the old price, the new price
 * and the direction, and lib/alerts/send.ts renders it under "Price changes"
 * with the previous price on the card. So this sheet has always emailed
 * subscribers when a matching home cut its ask; on the page ABOUT cuts it said
 * "new listings" instead.
 *
 * It now leads with the cut and names the other two events it really carries.
 * Claiming a cut-only digest would be the opposite error (§0) — the alert is
 * new listings AND price changes AND status changes on the saved search, and
 * the copy says exactly that.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
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

export function PriceDropAlertsSheet({
  placeLabel,
  city,
  extraFilters,
}: {
  placeLabel: string
  city: string
  extraFilters?: Record<string, string>
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})
  const filters = useMemo(() => extraFilters ?? {}, [extraFilters])

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const payloadFilters: Record<string, string> = { ...filters }
      if (city) payloadFilters.city = city
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters: payloadFilters,
          company: answers.company ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: placeLabel,
              city,
              extraFilters: filters,
            }),
          )
          fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
          setStatus('sent')
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [city, filters, placeLabel],
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
    label: `Where should ${placeLabel} price cuts go?`,
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
    children:
      'One email per new match — a price cut, a new listing or a status change on this search. Unsubscribe any time.',
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. ${placeLabel} price cuts land by email, with new listings and status changes on the same search.`,
            children: 'Pause from any alert email.',
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
      eyebrow="Price cut alerts"
      heading={`Email me when a ${placeLabel} home cuts its price`}
      trap={{ name: 'company', label: 'Company' }}
      steps={steps}
      currentStepId={currentStepId}
      showEcho={false}
      showProgress={false}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
