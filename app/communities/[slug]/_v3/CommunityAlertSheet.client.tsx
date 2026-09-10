'use client'

/**
 * The community node's listing-alert capture, bound to the barrel's
 * V3AlertsStrip (site queue SITE-04, Matt 2026-09-07): the first callout after
 * the opening, with this community's real 30-day count as its claim, and the
 * sticky repeat past #atlas.
 *
 * THIS FILE KEEPS ITS NAME. ci:publish-median-caption pins
 * `app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx` as the community
 * surface that publishes no median, and its assertion is on the path. The
 * component it exports is the strip; the sheet it replaced sat after the area
 * guide, nine sections past the Atlas.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED from the sheet and from KbCommunityAlerts
 * before it: the same server action, `submitSearchAlertSignup`; the same
 * payload `{ email, filters, company }`, with `filters` carrying `city` always
 * and `subdivision` only when the community has one; the same field name on
 * the visible control, `email`; the same trap name on the hidden one,
 * `company`, forwarding its own value; and the same two post-success effects
 * in the same order: the guest-watch residual, then the `alert_create`
 * measurement event, now carrying which mount sent it.
 *
 * THE BUTTON IS A GHOST HERE, not a primary: the community opening already
 * carries the page's one filled ask (CommunityPlaceValue, SITE-01), and one
 * primary per viewport is the rule (PUBLIC_UI.md section 1).
 *
 * THE PRICE-DROP ALERT IS THE SAME ROW: see CityAlertSheet.client.tsx for why
 * a second row is not honest today. The disclosure (frequency, unsubscribe) is
 * in lib/site/place-alerts.ts, in copy a visitor reads. The route to manage a
 * subscription stays a door in the closing block.
 *
 * THE STRIP'S ONE LINE CARRIES THE SCOPE, and the sentence carries no plat
 * fragments. The cadence sentence stays a literal here, where the gate reads
 * it; placeAlertsStickyNote puts the scope line in front of it. `matchNames`
 * still arrives whole — the filter matches every name in it — and only the
 * RENDERED list drops the aliases that read as a data error rather than as this
 * place (readableMatchNames in lib/site/place-alerts.ts).
 */

import { useCallback } from 'react'
import {
  V3AlertsStrip,
  type V3AlertsStickyClaim,
  type V3AlertsSubmit,
  type V3AlertsTypeOption,
} from '@/components/site/v3/V3AlertsStrip.client'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  buildGuestWatchFromPlace,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { formatCount } from '@/lib/format/count'
import {
  newestFirstHref,
  placeAlertsCopy,
  placeAlertsStickyNote,
  publishableNewCount,
} from '@/lib/site/place-alerts'

const TRAP = { name: 'company', label: 'Company' } as const

/**
 * SITE-87: community grain often publishes a 30-day count under the city
 * display threshold (10). Still put that sourced figure through V3Number and
 * keep the digit out of the sentence so the numeral is not printed twice.
 */
function promoteAlertFigure(
  claim: string,
  stickyClaim: V3AlertsStickyClaim,
  count: string | null,
  placeName: string,
): { count: string | null; claim: string; stickyClaim: V3AlertsStickyClaim } {
  if (count) return { count, claim, stickyClaim }
  const match = claim.match(
    /^(\d[\d,]*)\s+(\S+)\s+came on the market in\s+(.+)\s+in the last 30 days\.$/,
  )
  if (!match) return { count, claim, stickyClaim }
  const [, digits, unit, place] = match
  const nextSticky: V3AlertsStickyClaim = {
    before: `${unit} came on the market in`,
    place: place || placeName,
    after: 'in the last 30 days.',
  }
  return {
    count: digits,
    claim: `${nextSticky.before} ${nextSticky.place} ${nextSticky.after}`,
    stickyClaim: nextSticky,
  }
}

type Props = {
  /** The section id. The page passes it so the contract's `#alerts` resolves in the page source (ci:page-purpose). */
  id: string
  communityName: string
  city: string
  /** Empty string = whole city, exactly as KbCommunityAlerts read it. */
  subdivision: string
  /** The Market Truth neighborhood slug the 30-day count was read under. Trace only. */
  geoSlug: string
  /** Market Truth new_listings_30d for this community, or null when withheld. */
  newCount30d: number | null
  /** The page's Market Truth stamp, the same one its market figures carry. */
  updatedAt: string | null
  /** The browse path this page already links for the community; the strip adds the newest sort. */
  browseHref: string
  /**
   * The MLS subdivision names the alert really matches: the registry alias set
   * the search expands `subdivision` into (app/actions/search.ts
   * toSearchAllFilter -> getSubdivisionMatchNames), matched exactly and
   * case-insensitively on subdivision_lower (lib/data/listings/searchListingsAll.ts).
   * Tetherow: Tetherow, Triple, Tetherow Resort. Computed on the server page.
   */
  matchNames: readonly string[]
  types?: readonly V3AlertsTypeOption[]
}

export function CommunityAlertsStrip({
  id,
  communityName,
  city,
  subdivision,
  geoSlug,
  newCount30d,
  updatedAt,
  browseHref,
  matchNames,
  types,
}: Props) {
  const submit = useCallback<V3AlertsSubmit>(
    async (input) => {
      const filters: Record<string, string> = {
        city,
        ...(subdivision ? { subdivision } : {}),
      }
      const result = await submitSearchAlertSignup({
        email: input.email,
        filters,
        // The trap's own answer, never a constant. See the header.
        company: input.company,
        sessionId: readRrSessionId(), // hydration-safe
      })
      if (!result.ok) return result
      rememberGuestWatch( // hydration-safe: event/effect storage only
        buildGuestWatchFromPlace({
          communityName,
          city,
          subdivision: subdivision || undefined,
        }),
      )
      fireSearchEvent('alert_create', { ...buildAlertCreatePayload('daily'), placement: input.placement })
      return result
    },
    [city, communityName, subdivision],
  )

  // With no subdivision the filter is the whole city, and the promise says so.
  const copy = placeAlertsCopy({
    placeName: communityName,
    scopeName: subdivision ? communityName : city,
    newCount30d,
    geoType: 'neighborhood',
    geoSlug,
    matchNames: subdivision ? matchNames : [],
  })

  const n = publishableNewCount(newCount30d)
  const houseNoun = n === 1 ? 'house' : 'houses'
  const figure =
    n != null && !copy.count
      ? {
          count: formatCount(n),
          claim: `${houseNoun} came on the market in ${communityName} in the last 30 days.`,
          stickyClaim: {
            before: `${houseNoun} came on the market in`,
            place: communityName,
            after: 'in the last 30 days.',
          } satisfies V3AlertsStickyClaim,
        }
      : promoteAlertFigure(copy.claim, copy.stickyClaim, copy.count, communityName)

  // SITE-87: promote small counts to V3Number. Two proof cards on a wide
  // fold; one on a phone so the email ask stays in the first viewport.
  const figuredTypes = types?.map((option) => {
    const next = promoteAlertFigure(option.claim, option.stickyClaim, option.count, communityName)
    return { ...option, ...next }
  })

  return (
    <V3AlertsStrip
      {...copy}
      {...figure}
      id={id}
      href={newestFirstHref(browseHref)}
      promise={`Every new listing${copy.promiseScope ? ` in ${copy.promiseScope}` : ''}, by email. Price changes on those homes come in the same email. Unsubscribe any time.`}
      stickyNote={placeAlertsStickyNote(copy.scopeLine, 'Every new listing by email. Unsubscribe any time.')}
      updatedAt={updatedAt}
      trap={TRAP}
      emphasis="ghost"
      types={figuredTypes}
      onSubmit={submit}
    />
  )
}
