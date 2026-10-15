# 2026-10-14 (Claude cloud, place-page listing alerts: daily, every property type)

Branch: `claude/place-alerts-daily-all-types`. PR: opened from this branch with auto-merge.

Matt's ask: every area page carries a quick email-only "new listings for this area"
signup, every property type, daily by default, first email right away, and every
email tracked sent / delivered / opened / clicked. Plan and audit:
`docs/plans/PLACE_ALERTS_DAILY_2026-10-14.md`.

Landed in the branch:
- Binders (city, neighborhood, community, subdivision, ZIP, regional) write no
  property type and `daily`. Bend districts alert by polygon (`neighborhoodSlug`).
- New `app/_v3/place-alerts/PlaceAlertsStrip.client.tsx` on mapless plats, city and
  community type pages, every buyer-answer page, city and community market pages.
- First email at signup (`after()` -> `runListingAlerts({ alertIds })`), newest 12,
  "newest" copy. Daily rows at the 07:00 Pacific slot. Match window by cadence
  (daily 60). Freshness guard. One email key per send.
- Subscriptions hub: sent / delivered / opened / clicked per email. Alert
  unsubscribes recorded in `email_events` + timeline (`system` kind).

Found, not changed (asked Matt):
- `crm_timeline_kind_check` refuses `email_delivered` / `email_bounce` /
  `email_complaint` / `email_unsubscribe`, so the Resend webhook's timeline rows for
  those never land (probe 2026-10-14). Delivery is in `email_events` only.
- 10 active alerts have 10+ sends and no open or click ever (1,903 emails); several
  look bot-entered. Sunset rule proposed, not built.

Next: merge, production READY, live signup test to `matt+alerts-test@ryan-realty.com`
(sent, delivered, opened, clicked), clean up the test contact.

Skills read: endtoend, crm-e2e. Node: none (Matt direct ask).
