# Place-page listing alerts: every area page, every property type, daily (Matt 2026-10-14)

## The ask

Every city, neighborhood, community, subdivision and similar area page carries a
quick "get new listings for this area" signup. Email is the only field. The alert
covers every property type in that area, runs daily by default, starts right
away, and every email it sends is tracked: sent, delivered, opened, clicked.

## What existed (audit 2026-10-14)

- The strip (`components/site/v3/V3AlertsStrip.client.tsx`) is on city,
  neighborhood, community, subdivision (map pages only) and ZIP pages: callout
  in the fold, sticky repeat after the Atlas. Email only plus a honeypot.
- Filters pinned `propertyType: 'A'` on city, neighborhood, subdivision, ZIP and
  the regional detail pages. Neighborhood alerts sent the whole city.
- New rows were born `instant`, while the page's analytics said `daily`.
- Nothing sent on signup. "Daily" meant 24 hours after the last send, so the
  send hour drifted later every day on the hourly cron.
- The engine read the 15 newest matches per run. Bend had up to 30 new
  listings a day across all types (60 days to 2026-10-14, median 10), so a
  daily all-types alert would have dropped listings on busy days.
- Tracking: alert sends already write `email_events` (sent with the Resend id),
  the Resend webhook adds delivered, the first-party pixel and click redirect
  add open and click. Gaps: no pixel or link wrap when no CRM person resolved,
  no delivered column in the subscriptions hub, alert unsubscribes recorded
  nowhere.

## Done means

1. Every area page in the inventory renders the strip (or the regional sheet),
   email only.
2. The row it writes: area filter with no property type, `daily`, active.
3. The first email goes out within a minute of signup, then once a day at the
   morning slot when something is new.
4. Each send shows sent, delivered, opened and clicked in `email_events`, on the
   person timeline, and per alert in `/admin/crm/subscriptions`.
5. Unit tests for cadence, window, first-send batch and copy; a real signup on
   production to a Ryan Realty test address proves 1 to 4; test artifacts
   cleaned up.
