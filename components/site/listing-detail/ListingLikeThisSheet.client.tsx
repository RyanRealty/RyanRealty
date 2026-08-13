'use client'

/**
 * Listing-detail "homes like this" capture, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED from KbCommunityAlerts:
 *   - submitSearchAlertSignup from app/actions/search-alert-capture
 *   - payload `{ email, filters, company }`
 *   - filters always carry city, propertyType 'A', the list-price band, and beds
 *     when the listing has them
 *   - field name `email`, trap name `company`
 *   - trap value is the trap's own answer, never a hardcoded ''
 *   - post-success: guest-watch residual, then alert_create measurement
 *
 * Disclosure stays on the asking step: "One email per new listing. Unsubscribe
 * any time." Confirmation repeats frequency and how to stop.
 *
 * `#listing-like-alerts` is the jump target for PriceCtaStrip, RoomRestyle, and
 * ListingAlertCoach. It lives on this Sheet.
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
import { priceBandAroundListPrice } from '@/lib/search/price-band'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function ListingLikeThisSheet({
  city,
  listPrice,
  beds,
}: {
  city: string
  listPrice: number | null | undefined
  beds: number | null | undefined
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const answersRef = useRef<Record<string, string>>({})

  const extraFilters = useMemo((): Record<string, string> => {
    return {
      propertyType: 'A',
      ...priceBandAroundListPrice(listPrice),
      ...(beds != null && beds > 0 ? { beds: String(beds) } : {}),
    }
  }, [listPrice, beds])

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      const filters: Record<string, string> = {
        city,
        ...extraFilters,
      }
      try {
        const result = await submitSearchAlertSignup({
          email: answers.email ?? '',
          filters,
          company: answers.company ?? '',
        })
        if (result.ok) {
          rememberGuestWatch( // hydration-safe: event/effect storage only
            buildGuestWatchFromPlace({
              communityName: city,
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
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [city, extraFilters],
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
    label: `Where should similar ${city} listings go?`,
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
            label: `Set. Similar ${city} listings land by email when they hit the market.`,
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
      id="listing-like-alerts"
      eyebrow="New listings"
      heading={`Get new ${city} listings like this by email`}
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
  )
}
