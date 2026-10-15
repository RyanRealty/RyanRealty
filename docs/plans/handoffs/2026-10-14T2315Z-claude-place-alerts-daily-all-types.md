# 2026-10-14 (Claude cloud, place-page listing alerts: daily, every property type)

Branch: `claude/place-alerts-daily-all-types`. PR #629 merged as `9f4b120` (2026-10-15);
follow-up `claude/place-alerts-hub-cell` (hub cell two lines, DAL index refresh).

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

Live proof 2026-10-15 on ryan-realty.com /cities/bend/river-west, `matt+alerts-test@`:
row `444e36d9` `{neighborhoodSlug: bend-river-west}` daily; confirmation 01:17:02; first
email 01:17:08 "River West homes: the 12 newest listings" (inbox, List-Unsubscribe
One-Click, 26 tracked links, pixel); email_events sent 01:17:08.055, delivered .189, open
01:17:46, click 01:17:53; hub row "1 sent · 1 delivered · 1 opened · 1 clicked"; one-click
unsubscribe POST recorded `unsubscribe` + timeline. Test person 64828 soft-deleted, tagged
`test:place-alerts-e2e-2026-10-15`, enrollment 218 stopped, task 1354 closed.

Skills read: endtoend, crm-e2e. Node: none (Matt direct ask).
