# lib/cma

## Outbound tracking rule (non-negotiable)

Matt's standing order. It covers every outbound send: CMA first-contact emails and letters, market reports, drips and sequences, newsletters, and any other email to a lead, client or homeowner. Every send gets identical tracking. `npm run ci:outbound-tracking` enforces the link and pixel parts in CI.

1. One send path. Every outbound email goes through the one shared send path. No new direct calls to Resend, Gmail or any other mailer.
2. Every link is tracked. Every link goes through /api/track/e/click with a per-link id, and the link text is recorded with the click.
3. Open pixel. Every outbound email carries the open pixel.
4. Delivered, labelled honestly. Every send writes a delivered event and a timestamped crm_timeline row. Label it honestly: an open proves delivery; without an open, say delivery is inferred from no bounce.
5. Visits tied to the person. Site visits are tied to the person through the click token, and every event (sent, delivered, open, click, visit) is timestamped on the lead page (/admin/people/<id>).
6. Production-path proof before go-live. Before any new template or send path goes live, send a real test through the production path to matt@ryan-realty.com and show proof of the sent, the open, every click and every visit on the lead page. Test or sandbox paths do not count.
7. Link text only, one set of UTMs. Emails show link text only, never raw URLs, and carry a single set of UTM tags.
8. The only untracked links are tel:, mailto: and the Oregon Initial Agency Disclosure Pamphlet (compliance).
9. Approved copy is not edited without Matt's sign-off.
10. No em dashes.
