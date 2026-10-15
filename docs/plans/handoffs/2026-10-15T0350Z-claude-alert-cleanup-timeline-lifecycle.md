# 2026-10-15 (Claude cloud, alert cleanup + email lifecycle on the contact timeline)

Branch: `claude/timeline-email-lifecycle`. Follows #629 (place-page daily alerts) and
#654 (hub cell). Matt's answers 2026-10-15: remove the test and internal alert
subscriptions, stop real ones nobody ever opened, and show every email event on the
contact timeline, delivered included.

Data cleanup (done in production, each write logged to `admin_actions`):
- `listing_alerts` 74 rows -> 46, active 66 -> 32 after the first two steps.
- Deleted 28 internal/test alerts (`action_type listing_alert.delete_test`): matt@ (6,
  made by e2e and fleet runs while signed in as Matt), marketing@ (1), the
  marketing+avery..harper buyer personas (14, `scripts/_cma-harness-requests.ts`),
  fleet-test+flow/site04 (3, `scripts/fleet-test-cases.ts`,
  `scripts/probe-site-punch-prod.mjs`), e2e-home/g4-accept @example.com (2),
  matt+alerts-test (1), mattmryan2@gmail.com (1, person 18194 tagged `test:email-harness`).
- Stopped 10 alerts with 20+ sends and no open or click ever
  (`listing_alert.stop_never_opened`): abuse@ziggo.nl, thomasandbetty@verizon.net,
  dpigao@yahoo.com, ktormondberindaln@gmail.com, foadrazavi@yahoo.com,
  info@travelbreakthroughsandtours.co.za, mroshanzabiahmed78@gmail.com,
  michaelbogh@yahoo.com, yara.cuyumjian@hotmail.com, christopher_ray77@hotmail.com.
  Held: chuckkoeniger@icloud.com (9 sends, signed up 2026-10-14).
- Stopped the same test addresses' newsletter rows (10, status `unsubscribed`) and
  market-report subscriptions (3: ids 3, 9010, 9012).
- Kept: nicholeryan76@gmail.com (person 7976, broker-assigned West Hills, opened 10 of 10).

- Stopped 14 generated-looking Gmail signups on Matt's yes
  (`listing_alert.stop_suspected_bot`): e.g. lenniemptreuteligy34@, gordonferreirask118@,
  signed up 2026-09-17..22, 153 to 349 sends, 6 to 18 opens, no click ever.
- After all of it: `listing_alerts` 46 rows, 18 active.

Found: 43 non-test alerts named "Popular search" came from the site's alert sheet
with only `{propertyType: 'A'}` (all houses, every city, instant). Pre-existing
alerts keep the cadence and filters their owners chose; only new signups get the
daily, every-type default (Matt's Q3, 2026-10-15).

Code (this branch):
- Migration `20261015040000`: `crm_timeline_kind_check` adds `email_delivered`,
  `email_bounce`, `email_complaint`, `email_unsubscribe`. Applied to production
  2026-10-15 03:4xZ, live definition read back.
- `lib/crm/email-lifecycle-kinds.ts`: the four kinds, shown on the contact activity
  list and timeline with the email's subject; never "Last activity"; kept out of the
  AI draft context (`getConversationThread`) and, for delivered, the Messages pane.
- `getCrmPersonFull` reads deliveries apart (`getPersonDeliveredRows`) so they cannot
  push real history out of its newest-100 window.
- Listing-alert unsubscribe now writes `email_unsubscribe`, not `system`.
- Contract test: the newest kind-check migration allows every kind the Resend webhook,
  Gmail bounce watch and alert unsubscribe write.

Checks: tsc clean; 169 neighboring unit files (2,151 tests) pass; `ci:gates` 222/222.

Skills read: endtoend, crm-e2e. Node: none (Matt direct ask).
