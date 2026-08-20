import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * The ONE refusal body for a listing URL we cannot display — an invalid key, a
 * sold/stale key, a seller internet opt-out (permit_internet_yn = false), a
 * non-IDX-participant broker, or a Coming Soon pre-marketing row. Every one of
 * those resolves to `getListingDetail(...) === null`.
 *
 * WHY THIS IS A COMPONENT AND NOT ONLY `not-found.tsx` (2026-08-19).
 * /listing/[listingKey] renders dynamically, and `app/loading.tsx` (inherited
 * when the segment has no closer loading.tsx, which it does) puts the page
 * inside a Suspense boundary. React completes and FLUSHES the shell — html,
 * head, chrome — before the page component has resolved, which commits HTTP
 * 200. `notFound()` thrown after that point cannot change the status, and Next
 * does not server-render the not-found body into an already-flushed stream: it
 * emits `$RX("B:n","NEXT_HTTP_ERROR_FALLBACK;404")` so the CLIENT can swap the
 * boundary after hydration. Measured on ryan-realty.com 2026-08-19:
 * /listing/20260206214430774501000000 returned HTTP 200 with 1,634 characters
 * of text — nav and footer only, no hero, no facts, no price, and the same for
 * the canonical /homes-for-sale/... form. A visitor with JS disabled, and any
 * crawler that does not execute JS, got a blank page.
 *
 * So the refusal is RENDERED, not thrown. The page returns this component for
 * the miss path and pairs it with `robots: noindex` metadata, which is what
 * keeps the soft-200 out of the index. `not-found.tsx` renders the same body
 * for the router-level 404s that never reach the page component.
 *
 * Copy is unchanged from the shipped not-found.tsx — it states only what we can
 * know from the visitor's side and never discloses why a specific listing is
 * withheld (a seller opt-out is confidential, ODS Rule B/G).
 */
export function ListingUnavailable() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading="This home may no longer be on the market"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'It may have sold or been taken off the market. Here is where to look next.',
            },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Central Oregon housing market', href: '/housing-market/central-oregon' },
            { label: 'Value my home', href: valuationHref('/listing') },
            { label: 'Talk to a broker', href: '/contact' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

/**
 * Metadata for the refusal. `index: false` is the load-bearing field: the
 * response is a 200 that Next cannot downgrade to 404 (see above), so noindex
 * is what stops a page with no home on it from entering the index. No
 * canonical — never canonicalise a page we are refusing to serve.
 */
export const LISTING_UNAVAILABLE_METADATA = {
  title: 'This home may no longer be on the market',
  robots: { index: false, follow: true },
} as const
