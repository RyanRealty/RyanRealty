'use client'

/**
 * Regional (or city-scoped) SFR listing-alert capture as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS CARRIED ACROSS from RegionalSfrAlertsBand /
 * KbCommunityAlerts. Same action (`submitSearchAlertSignup`), same field name
 * (`email`), same filter map the KB band built: `city` (empty string on the
 * indexes, a city name on a place detail) plus `propertyType: 'A'`. Same two
 * side effects on success: guest-watch residual, then `alert_create`.
 *
 * The honeypot is a sheet-level `trap` named `company`. Its value rides in
 * onAdvance().answers and is forwarded to the action. A filled trap is the
 * action's signal to fake a success and write nothing. Hardcoding `company: ''`
 * is the same as having no trap.
 *
 * THE FIGURE (site queue SITE-92 round 5). On the city index this sheet closed
 * the page as "a centered label, input, and navy button with nothing else in
 * the viewport" (the separate evaluator). The ask has data behind it — the
 * region's real 30-day count, the same Market Truth figure the fold's strip
 * prints — and a scope, every town the alert covers. A caller that holds both
 * passes `figure`, and the sheet stands the ask on them: the count as the
 * installed digit primitive in one plain sentence, the towns as a strip of
 * their recorded outlines, each a door, and the §0 disclosure for the count
 * (V3PlaceStrip in the Sheet's `figure` slot). Nothing is computed here: the
 * count, its trace and the outlines are the page's, from reads the page
 * already makes. Callers that pass no figure render exactly as before.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3/V3Sheet'
import { V3PlaceStrip, v3Text, type V3PlaceStripPlace } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import {
  earnsDisplayFigure,
  joinClaimParts,
  placeAlertsClaimParts,
  publishableNewCount,
} from '@/lib/site/place-alerts'
import { formatCount } from '@/lib/format/count'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

const PROPERTY_TYPE = 'A'

export type RegionalAlertSheetFigure = {
  /** Market Truth new_listings_30d for the scope, or null when withheld. */
  newCount30d: number | null
  /** The §0 trace for the count and the outlines, built by the page. */
  source: string
  /** The source's name for the disclosure's compact clause. */
  sourceName?: string | null
  /** When the count was read; rendered through the canonical formatter. */
  updatedAt?: string | null
  /** Every place the alert covers that has a recorded outline, as doors. */
  places: readonly V3PlaceStripPlace[]
  /** What the strip is, as the reader should see it: "Every town the Atlas draws". */
  placesLabel: string
  /** The scope sentence the step carries ahead of the cadence line. */
  scopeLine?: string
}

export function RegionalAlertSheet({
  placeLabel,
  city = '',
  figure,
}: {
  /** Visible name in the heading. Indexes pass "Central Oregon". */
  placeLabel: string
  /** MLS City filter. Empty string = whole region, same as the KB band. */
  city?: string
  /** The data the ask stands on. Optional; see the header. */
  figure?: RegionalAlertSheetFigure
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const filters: Record<string, string> = {
        city,
        propertyType: PROPERTY_TYPE,
      }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
          company: answers.company ?? '',
          sessionId: readRrSessionId(), // hydration-safe
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: placeLabel,
              city,
              extraFilters: { propertyType: PROPERTY_TYPE },
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
    [city, placeLabel],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...event.answers }
      if (event.toStepId !== null) return
      void send(answersRef.current)
    },
    [send],
  )

  // The disclosure a licensed broker's capture form owes the visitor stays in
  // copy a visitor reads: how often the email comes and how to stop it
  // (ci:alert-capture-disclosure). The scope line, when the caller has one,
  // sits ahead of it so the cadence sentence is still the one that closes.
  const cadence = 'One email per new listing. Unsubscribe any time.'
  const askStep: V3SheetStep = {
    id: 'email',
    label: `Where should new ${placeLabel} listings go?`,
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
    children: figure?.scopeLine ? [figure.scopeLine, cadence] : cadence,
    advanceLabel: 'Get alerts',
  }

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Set. New ${placeLabel} listings land by email when they hit the market.`,
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

  // THE CLAIM IS THE FOLD STRIP'S SENTENCE, from the same helpers, so the two
  // mounts of the same figure on one page read the same way: the count as a
  // display numeral when it earns one, inline in the sentence when it is
  // small, the plain promise when none was published (absent is not zero).
  const figureNode = useMemo(() => {
    if (!figure) return null
    const n = publishableNewCount(figure.newCount30d)
    const parts = placeAlertsClaimParts(placeLabel, placeLabel, n)
    const claim = earnsDisplayFigure(n)
      ? { count: { value: n, formatted: v3Text(formatCount(n)) }, text: v3Text(joinClaimParts(parts)) }
      : { text: v3Text(joinClaimParts(parts)) }
    return (
      <V3PlaceStrip
        id="alerts-figure"
        claim={claim}
        label={v3Text(figure.placesLabel)}
        places={figure.places}
        source={v3Text(figure.source)}
        sourceName={figure.sourceName}
        updatedAt={figure.updatedAt ?? undefined}
      />
    )
  }, [figure, placeLabel])

  return (
    <V3Sheet
      id="alerts"
      eyebrow="New listings"
      heading={`Get new ${placeLabel} listings by email`}
      steps={steps}
      trap={{ name: 'company', label: 'Company' }}
      currentStepId={currentStepId}
      showEcho={false}
      showProgress={false}
      figure={figureNode}
      onStepChange={(id) => {
        if (id === 'email') setStatus('asking')
      }}
      onAdvance={onAdvance}
    />
  )
}
