'use client'

/**
 * One alerts ask inside the listing Sheet. Capture contract is unchanged:
 * submitSearchAlertSignup, city + propertyType A + price band + beds,
 * field email, trap company, disclosure on the asking step.
 */

import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { V3Button, V3Lede } from '@/components/site/v3'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { priceBandAroundListPrice } from '@/lib/search/price-band'
import type { ListingFace } from '@/lib/listing/listing-face'
import { ListingSectionHead } from './ListingSectionHead'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function ListingLikeThisSheet({
  city,
  listPrice,
  beds,
  face = 'house',
}: {
  city: string
  listPrice: number | null | undefined
  beds: number | null | undefined
  face?: ListingFace
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState('')
  const isLand = face === 'land'
  const extraFilters = useMemo((): Record<string, string> => {
    return {
      propertyType: isLand ? 'D' : 'A',
      ...priceBandAroundListPrice(listPrice),
      ...(isLand ? {} : beds != null && beds > 0 ? { beds: String(beds) } : {}),
    }
  }, [listPrice, beds, isLand])

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
          sessionId: readRrSessionId(),
        })
        if (result.ok) {
          rememberGuestWatch(
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void send({
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? ''),
    })
  }

  return (
    <section id="listing-like-alerts" className="listing-alerts-ask">
      <ListingSectionHead heading={isLand ? 'Get alerts for land like this' : 'Homes like this'} />
      {status === 'sent' ? (
        <V3Lede>
          Set. Similar {city} {isLand ? 'lots' : 'listings'} land by email when they hit the market. One email per
          new listing. Pause or unsubscribe from any alert email.
        </V3Lede>
      ) : (
        <form onSubmit={onSubmit} className="listing-alerts-form">
          <p className="listing-alerts-copy">
            {isLand
              ? 'Get alerts for land like this. One email per new listing. Unsubscribe any time.'
              : 'One email per new listing. Unsubscribe any time.'}
          </p>
          <label className="listing-alerts-label" htmlFor="listing-like-email">
            Email
          </label>
          <input
            id="listing-like-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={254}
            placeholder="you@email.com"
            className="listing-alerts-input"
          />
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />
          {status === 'failed' ? (
            <p className="listing-alerts-problem" role="alert">
              {problem}
            </p>
          ) : null}
          <V3Button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Setting up your alert' : 'Get alerts'}
          </V3Button>
        </form>
      )}
    </section>
  )
}
