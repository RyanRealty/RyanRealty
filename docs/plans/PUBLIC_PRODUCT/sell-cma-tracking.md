# /sell?from=cma: how a CMA email click is tracked end to end

Written 2026-09-28 with the /sell landing rebuild (branch `tip/sell-landing-rebuild`).

## The path

1. **The CMA email link.** `lib/cma/send.ts` passes the email HTML through
   `attributeOutbound` (`lib/crm/attributed-links.ts`). Every ryan-realty.com link gets
   `?agent=`, the signed person token `_pid`, and `utm_source=crm&utm_medium=email`, and is
   wrapped in `/api/track/e/click` (`app/api/track/e/click/route.ts`). That route logs the click
   to `crm_timeline` and `email_events`, then redirects.
2. **The landing.** The reader lands on `/sell?from=cma&...`. The page is static (ISR, 1 h), so
   the swap to the CMA headline and sub happens before first paint: `SELL_ENTRY_SCRIPT`
   (`app/sell/_v3/sell-entry.ts`) sets `html[data-sell-entry="cma"]` and the route CSS
   (`app/sell/_v3/sell-landing.css`) shows the alternate lines already in the HTML. The H1 in
   the markup stays the default for search and screen readers.
3. **The visit.** `VisitTracker` sends a `page_view` with the identity token to
   `/api/visitors/track`. The route verifies `_pid`, sets `rr_pid`, and identifies the person.
   The `visitor_events` row keeps `from=cma` in `pageUrl`, and it shows on the CRM person page.
4. **The clicks.** `SellClickTracker` (`app/sell/_v3/SellClickTracker.tsx`) is one
   document-level listener. Every link, button and toggle on the route carries `data-sell-cta`
   (enforced by `npm run ci:sell-cta-tracking`). Each click fires `trackCtaClick` (GA / pixel)
   and a first-party `cta_click` event with `{label, destination, context, surface, from}`, and
   `trackCtaClickAction` (`app/actions/track-cta-click.ts`) records it on the CRM timeline.
5. **The ask.** When the value flow is submitted from a CMA visit, `SellValueForm` sends
   `entry: 'cma'` to `app/lp/seller-home-value/actions.ts`. There is also a referer fallback for
   `from=cma` on the same path. The action:
   - sets `custom.sellEntry = 'cma'`;
   - writes an origin note naming `/sell?from=cma`, with the line
     "Came back through the CMA email";
   - adds `from=cma` to the lead source URL, so it also lands in `valuation_requests.source_url`.

   `stitchFormSubmitIdentity` (`lib/visitor-backfill.ts`) links the anonymous session to the
   person. No new tags are added, so no drip enrollment is triggered.

## The gap (needs Matt)

As of main `265644d2f` (3:02 PM PT, 2026-09-28), the CMA first-contact email
(`lib/cma/first-contact.ts`) links "see how we sell homes" to `${PUBLIC_SITE}/sell`, with **no
`?from=cma`**. `attributeOutbound` still decorates that link, so the click and the visit are
attributed to the person (agent, `_pid`, UTM, click log). What the email does not trigger:
- the CMA headline and sub on /sell;
- `from=cma` on the `cta_click` events;
- `custom.sellEntry = 'cma'` and the CMA origin note on a value-flow lead.

The fix is one line: `SELL_HREF = \`${PUBLIC_SITE}/sell?from=cma\`` in `lib/cma/first-contact.ts`,
plus the wording snapshots in `lib/cma/first-contact*.test.ts` and `lib/cma/send-email-body.test.ts`.
This branch leaves that email code alone. It is Matt's approved copy, and another session landed
it minutes before this was written.
