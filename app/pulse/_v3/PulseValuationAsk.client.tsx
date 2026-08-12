'use client'

/**
 * The pulse page's one on-page ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED. It fires the same server action the KB card
 * fired, `trackHomeValuationCta` in app/actions/lead-capture.ts, with the same two
 * arguments in the same order (the LP campaign object built from the lib/tracking LP
 * context reader, then the rr session id). Nothing about what reaches sendEvent
 * moved. Only the markup did, and the control changed from an anchor to the Sheet's
 * submit, which is the one thing a barrel pattern cannot express as a link: V3Button
 * renders a next/link when it has an href and drops onClick there, so an anchor
 * could not have carried the tracking call. The destination stays reachable as a
 * real crawlable link from the closing Quiet block on the page, which is handed the
 * same string from the same builder.
 *
 * THE DESTINATION MOVED, AND IT IS PASSED IN RATHER THAN BUILT HERE. The KB card
 * pointed at '/sell/valuation'. It now points wherever `href` says, and the page
 * builds that with valuationHref('/pulse') from lib/site/valuation-href.ts: the one
 * builder for a valuation link on a content surface (migration-recipe.md addendum,
 * 2026-08-11), which stamps `?from=/pulse` for lead attribution and resolves to the
 * locked intake spine at /sell#get-value. Taking it as a prop rather than calling the
 * builder here keeps one origin path on the route instead of two copies of the string
 * that would drift the first time one of them was edited.
 *
 * WHY THE ATTRIBUTION IS READ AT MOUNT AND NOT AT CLICK. The LP context reader
 * touches the URL and sessionStorage; the session-id reader touches localStorage.
 * ci:hydration-safety bans both anywhere outside a useEffect body in a client
 * component, because a render-body read of either is the React #418 class that
 * killed the listing tiles site-wide. Both values are fixed for the life of the page
 * (the LP context is captured and persisted on arrival, the session id is a stored
 * uuid), so a mount read sends exactly what a click read would have sent. Neither
 * helper is named with its call parentheses anywhere in this prose: the gate scans
 * comment lines too, and this repo has twice shipped a gate that fired on its own
 * explanation.
 *
 * Client because the send happens from the browser and because the navigation is
 * the visitor's action, not the server's.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { V3Sheet, type V3SheetStep } from '@/components/site/v3'
import { trackHomeValuationCta } from '@/app/actions/lead-capture'
import { getLpContext, readRrSessionId } from '@/lib/tracking'

/** The campaign shape trackHomeValuationCta takes. Written as a literal rather than
 *  imported so this file pulls no type out of the legacy lead-capture surface;
 *  TypeScript still matches it structurally, so a renamed field is a compile error. */
type Campaign = {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

/** One step, one control. The copy is the KB card's, word for word. */
const STEPS: readonly V3SheetStep[] = [
  {
    id: 'valuation',
    label: 'Get a free valuation with local market data and next steps from our team.',
    advanceLabel: 'Get your free home valuation',
  },
]

export function PulseValuationAsk({ href }: { href: string }) {
  const router = useRouter()
  const attribution = useRef<{ campaign: Campaign; sessionId: string | undefined }>({
    campaign: {},
    sessionId: undefined,
  })

  useEffect(() => {
    const context = getLpContext()
    attribution.current = {
      campaign: {
        source: context.lp_source,
        medium: context.lp_medium,
        campaign: context.lp_campaign,
        term: context.lp_term,
        content: context.lp_content,
      },
      sessionId: readRrSessionId(),
    }
  }, [])

  const onAdvance = useCallback(() => {
    // Fire and navigate, the same order the KB card used: the tracking call is not
    // awaited there either, and blocking the visitor on an analytics round trip
    // would trade a lead for a log line.
    void trackHomeValuationCta(attribution.current.campaign, attribution.current.sessionId)
    router.push(href)
  }, [router, href])

  return (
    <V3Sheet
      // The KB page's own section id, kept so the `section_view` analytics
      // dimension KbSectionTracker reports for this ask does not change.
      id="pulse-valuation"
      eyebrow="Free valuation"
      heading="What's your home worth?"
      steps={STEPS}
      showProgress={false}
      showEcho={false}
      onAdvance={onAdvance}
    />
  )
}
