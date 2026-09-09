import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'

/**
 * The ONE refusal body for a listing URL we cannot display — an invalid key, a
 * seller internet opt-out (permit_internet_yn = false), a non-IDX-participant
 * broker, or a Coming Soon pre-marketing row. Every one of those resolves to
 * `getListingDetail(...) === null`.
 *
 * A SOLD KEY IS NOT ONE OF THEM, and this header said it was until 2026-09-09
 * (SITE-21). getListingDetail refuses exactly two things — the IDX opt-outs and
 * Coming Soon (lib/data/listings/getListingDetail.ts) — so a Closed, Expired,
 * Canceled or Withdrawn listing has always resolved and always rendered the
 * full page. The false line here is how the off-market state came to be
 * believed handled while the live page was computing a mortgage on a sold
 * home's old ask and offering a tour of it. The real off-market state is the
 * page itself: isPublicOffMarketStatus in lib/listing-status-public.ts, the
 * sold facts in ListingOffMarketFacts, the active-inventory rail and the saved
 * search. MASTER_SPEC §4.9 is explicit that a sold listing returns 200 with
 * that state rather than this refusal.
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
 * THE COPY (rewritten 2026-09-09, SITE-32). It used to read "This home may no
 * longer be on the market · It may have sold or been taken off the market",
 * inherited from not-found.tsx. That was the one thing this page never means.
 * A sold home does not reach here — Matt ruled 2026-09-08 that off-market URLs
 * stay indexed and serve the honest off-market state, so Closed, Expired,
 * Canceled and Withdrawn all render the full page. Sending a visitor who typed
 * a wrong address, or who followed a link to a listing we may not publish, away
 * with "it probably sold" is a false statement of fact about a specific home.
 *
 * What replaces it says only what is true of ALL THREE refusals and never which
 * one applies: the address matches nothing we hold, or the listing is one we
 * are not permitted to display publicly. That second clause covers the seller
 * internet opt-out, the non-IDX-participant broker and Coming Soon alike —
 * which is what keeps it compliant, because naming the reason for a particular
 * listing would disclose a confidential seller instruction (ODS Rule B/G).
 */
export function ListingUnavailable() {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading="We can't show this home"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'This address does not match a listing we hold, or it is one we are not permitted to display publicly. A broker can look it up for you. Here is where to go next.',
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
  title: "We can't show this home",
  robots: { index: false, follow: true },
} as const
