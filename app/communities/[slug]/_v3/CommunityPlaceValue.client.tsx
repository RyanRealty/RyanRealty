'use client'

/**
 * The community page's first-screen ask (SITE-01): the barrel primitive bound to this
 * route's two server actions. The primitive owns the steps, the honeypot, the events;
 * this file only names the place and hands over the calls.
 */

import { V3PlaceValue } from '@/components/site/v3'
import { answerPlaceValue, requestPlaceValuation } from './place-value-actions'

type Props = {
  slug: string
  placeName: string
}

export function CommunityPlaceValue({ slug, placeName }: Props) {
  return (
    <div className="place-opening__ask">
      <V3PlaceValue slug={slug} placeName={placeName} answer={answerPlaceValue} request={requestPlaceValuation} />
    </div>
  )
}
