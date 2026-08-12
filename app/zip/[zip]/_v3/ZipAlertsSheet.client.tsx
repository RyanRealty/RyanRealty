'use client'

/**
 * The ZIP page's one on-page ask, as a barrel Sheet: free listing alerts on this
 * ZIP's single-family inventory.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. It calls the same public server action the
 * KB band called, `submitSearchAlertSignup`, with the same three argument names
 * and the same filter map:
 *
 *     { email, filters: { city, propertyType: 'A', postalCode: zip }, company }
 *
 * `city` is the parent city so the alert reads as a place a person recognizes,
 * `postalCode` is a real searchListingsAll filter, and `propertyType: 'A'`
 * matches this page's SFR scope. Nothing downstream moved: the same
 * listing_alerts row, the same lead, the same compliance gate. The two residuals
 * the KB band fired on success fire here too, from the same helpers with the
 * same arguments: the guest-watch record that shows the soft return banner, and
 * the `alert_create` search event that keeps measurement parity with every other
 * alert surface.
 *
 * THE HONEYPOT IS BACK, THROUGH THE BARREL. The KB band rendered a hidden
 * `company` input, and the first cut of this sheet sent that key as a hardcoded
 * empty string because V3Sheet had no control for it. An always-empty honeypot
 * is an unarmed one: `submitSearchAlertSignup`'s first defence (a filled
 * `company` means a script, answer ok and write nothing) could not fire from
 * this surface, leaving a public CRM write path on four defences instead of
 * five. V3Sheet now takes the trap as a SHEET-LEVEL prop, which is the sanctioned
 * move (components/site/v3/V3Sheet.tsx, "the trap is the one control nobody is
 * meant to fill, and it is a prop, not a step"), so the field is a real control
 * with a real value again and nothing outside the barrel hand-rolls an input.
 * Its value rides in `onAdvance().answers` under its own name and goes to the
 * action unchanged. The other four defences are untouched: the per-IP rate
 * limit, email validation, native dedup, and the compliance gate.
 *
 * Client because the answer, the step, and the send are all visitor-caused
 * state. Controlled for the reason the market sheet is: `steps` and
 * `currentStepId` derive from one status value and always change together, so
 * the sheet never sees an id that names no step, and while a send is in flight
 * the only rendered step is terminal, so a second click cannot fire a second
 * submit.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function ZipAlertsSheet({
  zip,
  area,
  city,
}: {
  /** The five-digit ZIP this page covers. */
  zip: string
  /** Its service-area label, e.g. "Bend NE". */
  area: string
  /** The parent city, and the `city` value in the capture payload. */
  city: string
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  // The filter map, written once. The same object reaches the action and the
  // guest-watch residual, so the alert a person signs up for and the search the
  // return banner links to cannot describe different inventory.
  const extraFilters = useMemo(() => ({ propertyType: 'A', postalCode: zip }), [zip])

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters: { city, ...extraFilters },
          // The honeypot, as the visitor left it. A human never sees the control,
          // so this is the empty string for every real person and a value only a
          // script can produce otherwise.
          company: answers.company ?? '',
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: `ZIP ${zip}`,
              city,
              extraFilters,
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
    [city, zip, extraFilters],
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
    label: `Where should new ${zip} listings go?`,
    children: [
      `When a single-family home hits the market in ${zip} (${area}), you hear first.`,
      // The standing disclosure, at the point of capture rather than after it.
      // The KB band printed this line beside the field on every render, and a
      // form that asks for an address states the frequency and the exit before
      // it takes one.
      'One email per new listing. Unsubscribe from any of them.',
    ],
    field: {
      kind: 'email',
      name: 'email',
      label: 'Email',
      required: true,
      autoComplete: 'email',
      // 254, the RFC 5321 maximum and the exact bound the server action applies
      // (app/actions/search-alert-capture.ts). A shorter cap in the control
      // silently truncates an address the action would have accepted.
      maxLength: 254,
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
            label: 'Set. Watch your inbox.',
            children: [
              `New ${zip} listings land by email when they hit the market.`,
              'One email per new listing. Pause from any alert email.',
            ],
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
      id="get-alerts"
      eyebrow="New listings"
      heading={`Get new ${zip} listings by email`}
      // `company` is the name the trap is meant to bait and the key the action
      // already checks. It renders on every step, so a script that posts only
      // the last form still trips it.
      trap={{ name: 'company', label: 'Company' }}
      steps={steps}
      currentStepId={currentStepId}
      showProgress={false}
      showEcho={false}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
