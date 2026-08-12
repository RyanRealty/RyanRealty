'use client'

/**
 * The city node's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS CARRIED ACROSS. This calls the same server action the
 * KB block called, `submitSearchAlertSignup` in app/actions/search-alert-capture.ts,
 * with the same payload shape and the same field name: `email`, under the same
 * filter map the KB block built on this route, `{ city, propertyType: 'A' }` (no
 * `subdivision` key, because KbCommunityAlerts omitted it whenever its
 * `subdivision` prop was the empty string this page passed). The two side
 * effects of a successful capture are unchanged and fire in the same order: the
 * F2 guest-watch residual through `buildGuestWatchFromPlace` +
 * `rememberGuestWatch`, then the `alert_create` search event with
 * `buildAlertCreatePayload('daily')`. Nothing about what reaches
 * `listing_alerts` or `crm_people` moved. Only the markup did.
 *
 * ONE FIELD DID NOT SURVIVE, AND IT IS NOT A SILENT DROP. KbCommunityAlerts
 * rendered a `company` honeypot: a visually hidden text input humans never fill,
 * which the action treats as a bot signal. `V3SheetField` has four kinds
 * (text/email/tel/number, textarea, select, choice) and no hidden variant, and
 * `.design-token-lint-ignore` states that components/site/v3 owns the raw input
 * "that every other public file is then forbidden to hand-roll", so this file
 * cannot render one itself. The action's `company` parameter is optional and an
 * omitted value takes the same branch an unfilled honeypot took, so the capture
 * still works; what is lost is the catch on a bot that fills every field. The
 * remaining spam controls on this path are untouched (per-IP rate limit failing
 * closed in production, email validation, native dedup, the compliance gate).
 * A hidden-field kind in V3Sheet is the barrel gap that closes it, and it is
 * reported as such.
 *
 * Client because the answer, the step, and the send are all visitor-caused
 * state. Controlled on purpose, the same discipline MarketInquirySheet states:
 * `steps` and `currentStepId` derive from one status value and always change
 * together, so the sheet never sees an id that names no step, and while the send
 * is in flight the only rendered step is the terminal one, so a second click
 * cannot fire a second submit.
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
import { CITY_ALERT_PROPERTY_TYPE } from './city-constants'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function CityAlertSheet({ cityName }: { cityName: string }) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  // What the visitor typed on the last advance, kept so a retry after a failed
  // send resubmits it instead of asking for the address again.
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const filters: Record<string, string> = {
        city: cityName,
        propertyType: CITY_ALERT_PROPERTY_TYPE,
      }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: cityName,
              city: cityName,
              extraFilters: { propertyType: CITY_ALERT_PROPERTY_TYPE },
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
        // nothing was captured. Saying so beats a spinner that never resolves.
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
    children: 'One email per new listing. Unsubscribe any time.',
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${cityName} listings land by email when they hit the market.`,
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
      eyebrow="New listings"
      heading={`Get new ${cityName} listings by email`}
      steps={steps}
      currentStepId={currentStepId}
      showEcho={false}
      showProgress={false}
      onStepChange={(id) => {
        // Backing out of the failure screen returns the sheet to the question.
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
