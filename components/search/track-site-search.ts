/**
 * trackSiteSearch: the ONE way a search on the site is recorded.
 *
 * A search has two readers, and both must hear about it:
 *   - GA4, through the dataLayer `search` event (lib/tracking.ts trackEvent; the
 *     GTM "GA4 - dataLayer events" tag sends it, lib/analytics/ga4-browser-events.ts);
 *   - the first-party store, a visitor_events row with event_type 'search'
 *     (components/VisitTracker.tsx fireFirstPartyEvent). The admin Website view's
 *     "Searched on the site" card counts these rows and their metadata.query.
 *
 * WHY ONE HELPER. Until 2026-10-14 each surface called the two senders itself,
 * and they drifted: the homepage hero and the header search sent GA4 only, the
 * sentence box on /homes-for-sale sent nothing, and the filter dock fired twice
 * per pick. search-tracking-contract.test.ts fails on any direct
 * trackEvent('search') or fireFirstPartyEvent('search') outside this file.
 *
 * A search is words: a blank submit (the homepage hero's empty Search opens the
 * whole list) records nothing, so the card's count is searches that had a term.
 * GA4 `search_term` is what was searched (the place picked, the sentence
 * applied), never the half-typed letters; those ride first-party metadata.term.
 *
 * Fire-and-forget: a tracking failure never breaks a search, and one sender
 * failing never stops the other. Consent is each sender's own gate.
 */
import { trackEvent } from '@/lib/tracking'
import { fireFirstPartyEvent } from '@/components/VisitTracker'

/** The page or control the search was made in. GA4 `surface`, first-party metadata.surface. */
export type SiteSearchSurface = 'search_page' | 'home_hero' | 'chrome'

/**
 * How the search was made. First-party metadata.source; the first three are the
 * values visitor_events already holds from before this helper.
 */
export type SiteSearchSource =
  | 'typeahead'
  | 'natural_language'
  | 'places_multi'
  | 'sentence'
  | 'submit'

export type SiteSearch = {
  surface: SiteSearchSurface
  source: SiteSearchSource
  /** What the search resolved to: the place picked, or the sentence applied. Blank records nothing. */
  query: string
  /** What the visitor had typed, when it differs from `query`. */
  term?: string
  city?: string
  subdivision?: string
  postalCode?: string
}

function clean(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v ? v : undefined
}

export function trackSiteSearch(search: SiteSearch): void {
  const query = clean(search.query)
  if (!query) return
  const term = clean(search.term)
  const city = clean(search.city)
  const subdivision = clean(search.subdivision)
  const postalCode = clean(search.postalCode)
  try {
    trackEvent('search', {
      surface: search.surface,
      search_term: query,
      city,
      subdivision,
      postalCode,
    })
  } catch {
    // GA4 is optional; the first-party row below still goes out.
  }
  try {
    fireFirstPartyEvent('search', {
      metadata: {
        query,
        term: term && term !== query ? term : undefined,
        city,
        subdivision,
        postalCode,
        surface: search.surface,
        source: search.source,
      },
    })
  } catch {
    // never block a search on tracking
  }
}
