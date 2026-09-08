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
      {/* #value is the hash the closing answer set links to (SITE-08): the last
          question a reader opens is "what is my home worth", and its one action
          scrolls back to the field that answers it. The id lives on the
          primitive so the anchor cannot drift from the control. */}
      <V3PlaceValue
        id="value"
        slug={slug}
        placeName={placeName}
        answer={answerPlaceValue}
        request={requestPlaceValuation}
      />
    </div>
  )
}
