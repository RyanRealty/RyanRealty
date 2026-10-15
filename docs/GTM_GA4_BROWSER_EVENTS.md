# GTM: send browser events to GA4 (GA4 Event tag)

**Owner of the publish: Matt.** Code side: `lib/analytics/ga4-browser-events.ts`. This page, the import file
`docs/gtm/ga4-browser-events.import.json` and that module are kept in step by
`lib/analytics/ga4-browser-events.test.ts`.

## Why

Commit 1224b1f (2026-08-18, "stop dual GA4 tags") removed the in-page `gtag('config', 'G-ST40W4WM6T')`, so the
Google tag inside GTM-WV6R4NZ5 became the only GA4 config. From then on every browser `gtag('event', …)` had no
destination: `section_view`, `scroll_depth`, `call_initiated`, `click_cta`, web vitals and the rest reached the
dataLayer and never reached GA4 (`section_view`'s last GA4 data is the week of 2026-08-17; `call_initiated` read 0
for Sep 10 to Oct 7). A live headless probe on 2026-10-08 (every outgoing hit was blocked, nothing reached Google) confirmed:
a bare `gtag('event')` sent nothing, a dataLayer-only event sent nothing, and only the Google tag's own `page_view`
and `scroll` went out.

The code now pushes every browser event to the dataLayer in one shape and never calls `gtag('event')` for GA4, so
the GTM tag below is the one and only sender. Nothing double counts when it is published.

## The dataLayer shape (what the tag reads)

```js
dataLayer.push({ ga4_params: null })          // clears the previous event's parameters
dataLayer.push({ event: 'section_view', section: 'proof', page_type: 'sell',   // flat keys, unchanged
                 ga4_params: { section: 'proof' } })                         // what GA4 gets
```

- `ga4_params` holds only the allowlisted parameters below (no phone numbers, emails, hrefs or paths).
- Aliases are folded to one name per fact: `section_id` → `section`, `percent` → `depth`, `depth_percent` → `depth`, `listing_id` → `listing_key`, `place_slug` → `place`, `cta_label` → `cta`, `cta_context` → `cta_location`.
- `listing_key` reaches GA4 as `lk_<key>` when the key is all digits (it always is for MLS keys). GA4 stored a bare 26-digit key as a double and dropped digits (2026-10-08, e.g. `2.0251020154621696e+25`). Only `ga4_params.listing_key` carries the prefix; the flat dataLayer key, the first-party store and Meta `content_ids` keep the bare key. No GTM change: the same Data Layer Variable and tag pass it through. Strip `lk_` to join GA4 data back to listings. Rows before 2026-10-09 stay floats and cannot be recovered.
- `page_type` and `broker_slug` are page context, read as flat keys (the GTM bootstrap and PageViewTracker stamp
  them on every navigation). Both tags also send `content_group` from the same `page_type` key (GTM version 10).
- `visitor_intent` and `primary_market` are flat keys too, read as GA4 **user properties** by both tags (GTM
  version 10, below).
- Alert enroll pushes `sign_up` (already on this trigger) with `method`,
  `form_id`, and `lead_type`.
- Not sent by this tag, on purpose: `generate_lead` (server only, Measurement
  Protocol, one per real submission), `page_view` (its own tag, below),
  `valuation_requested` (the server sends it for the same submissions),
  `form_start` (enhanced measurement's Form interactions already sends it; add
  it to the list in code only after that toggle is off).
- `CE generate_lead` was deleted from the live container in version 8 (2026-10-14). `CE page_view` is the
  trigger of the `GA4 - page_view` tag (version 9). Never call the GTM API from this repo except read-only
  (`npm run analytics:audit`).

## page_view: one sender (GTM version 9, 2026-10-14)

`page_view` has its own GA4 Event tag, `GA4 - page_view`, on the Custom Event trigger `CE page_view` (event name
equals `page_view`). The inline GTM bootstrap pushes the first-paint `page_view` right after `gtm.js`
(`lib/analytics/gtm-bootstrap.ts`) and `components/PageViewTracker.tsx` pushes one per **pathname** change. A
query-only change (`?bbox=` from the search map, `?photo=N` from the gallery, identity params being stripped) is
not a new page.

| GA4 parameter | GTM variable | dataLayer key |
|---|---|---|
| `page_type` | `DLV - ga4 page_type` | `page_type` |
| `broker_slug` | `DLV - ga4 broker_slug` | `broker_slug` |
| `content_group` | `DLV - ga4 page_type` | `page_type` (GA4's built-in Content group, the same value) |
| `page_location` | `DLV - ga4 page_location` | `page_location` (identity params `_pid`, `_fuid`, `rr_doc` stripped) |
| `page_referrer` | `DLV - ga4 page_referrer` | `page_referrer` (the previous page on a client-side navigation; absent on first paint) |

It only works with both of these, or page views double:

- The Google tag has the configuration parameter `send_page_view` = `false`.
- GA4 Admin → Data streams → G-ST40W4WM6T → Enhanced measurement → Page views → **Page changes based on browser
  history events** is off.

`npm run analytics:audit` fails on any other mix (two senders, or none).

## Content group and visitor intent (GTM version 10, live since 2026-10-14)

Version 10, `Content group + visitor intent/market user properties (2026-10-14)`, is published. Both GA4 Event tags
(`GA4 - page_view` and `GA4 - dataLayer events`) now carry:

- Event parameter `content_group` = `{{DLV - ga4 page_type}}`. GA4's Content group dimension is the same value as
  `page_type`; no new variable.
- **User Properties** (the tag's "User Properties" section), each from a flat dataLayer key:

| GA4 user property | GTM variable | dataLayer key |
|---|---|---|
| `visitor_intent` | `DLV - ga4 visitor_intent` | `visitor_intent` |
| `primary_market` | `DLV - ga4 primary_market` | `primary_market` |

The values come from `lib/analytics/visitor-intent.ts` (buyer / seller / both / browsing, and the most-viewed
Central Oregon city or community slug). `PageViewTracker` pushes both in the page-context push before every
`page_view`; the inline bootstrap adds the stored values to the first-paint `page_view`; `trackEvent` pushes a new
`visitor_intent` just before the buyer or seller event that changed it. Nothing is stored or pushed without
analytics consent. GTM's data model keeps the last value, so every later event on the page carries it too.
`npm run analytics:audit` fails if either tag stops mapping them.

## Option A: import (about 3 minutes)

1. tagmanager.google.com → container **GTM-WV6R4NZ5** → **Admin** → **Import Container**.
2. Choose file: `docs/gtm/ga4-browser-events.import.json` (from this repo).
3. Workspace: **Existing** → Default Workspace. Import option: **Merge** → **Rename conflicting tags, triggers, and
   variables**. Confirm.
4. It adds 2 tags (`GA4 - dataLayer events`, `GA4 - page_view`), 2 triggers (`CE - GA4 browser events`,
   `CE page_view`) and 34 variables: the event tag's 30 Data Layer Variables, `page_location` and
   `page_referrer`, and the two user-property variables `visitor_intent` and `primary_market` (`DLV - ga4 …`;
   `content_group` reuses `DLV - ga4 page_type`). On the live container, which already has them, Merge renames the duplicates;
   edit by hand there instead. It changes nothing that exists. **Matt must import and publish**
   so `lead_type` on `sign_up` reaches GA4. `sign_up` was already on the trigger regex.
   Do not add `generate_lead` to that regex.
5. Skip to **Test**. If GTM rejects the file, use Option B; the result is identical.

## Option B: by hand

### 1. Variables (Variables → User-Defined Variables → New → Data Layer Variable)

For each row: Data Layer Variable Name = the "dataLayer key" column, Data Layer Version = **Version 2**, no default
value. Name the variable as in the "GTM variable" column.

| # | GA4 parameter | GTM variable | dataLayer key |
|---|---|---|---|
| 1 | `page_type` | `DLV - ga4 page_type` | `page_type` |
| 2 | `broker_slug` | `DLV - ga4 broker_slug` | `broker_slug` |
| 3 | `source` | `DLV - ga4 source` | `ga4_params.source` |
| 4 | `context` | `DLV - ga4 context` | `ga4_params.context` |
| 5 | `surface` | `DLV - ga4 surface` | `ga4_params.surface` |
| 6 | `cta` | `DLV - ga4 cta` | `ga4_params.cta` |
| 7 | `cta_location` | `DLV - ga4 cta_location` | `ga4_params.cta_location` |
| 8 | `action` | `DLV - ga4 action` | `ga4_params.action` |
| 9 | `method` | `DLV - ga4 method` | `ga4_params.method` |
| 10 | `value` | `DLV - ga4 value` | `ga4_params.value` |
| 11 | `currency` | `DLV - ga4 currency` | `ga4_params.currency` |
| 12 | `section` | `DLV - ga4 section` | `ga4_params.section` |
| 13 | `depth` | `DLV - ga4 depth` | `ga4_params.depth` |
| 14 | `search_term` | `DLV - ga4 search_term` | `ga4_params.search_term` |
| 15 | `form` | `DLV - ga4 form` | `ga4_params.form` |
| 16 | `form_id` | `DLV - ga4 form_id` | `ga4_params.form_id` |
| 17 | `listing_key` | `DLV - ga4 listing_key` | `ga4_params.listing_key` |
| 18 | `city` | `DLV - ga4 city` | `ga4_params.city` |
| 19 | `city_slug` | `DLV - ga4 city_slug` | `ga4_params.city_slug` |
| 20 | `community_slug` | `DLV - ga4 community_slug` | `ga4_params.community_slug` |
| 21 | `place` | `DLV - ga4 place` | `ga4_params.place` |
| 22 | `lp_variant` | `DLV - ga4 lp_variant` | `ga4_params.lp_variant` |
| 23 | `lp_source` | `DLV - ga4 lp_source` | `ga4_params.lp_source` |
| 24 | `lp_medium` | `DLV - ga4 lp_medium` | `ga4_params.lp_medium` |
| 25 | `lp_campaign` | `DLV - ga4 lp_campaign` | `ga4_params.lp_campaign` |
| 26 | `lp_content` | `DLV - ga4 lp_content` | `ga4_params.lp_content` |
| 27 | `metric_id` | `DLV - ga4 metric_id` | `ga4_params.metric_id` |
| 28 | `metric_rating` | `DLV - ga4 metric_rating` | `ga4_params.metric_rating` |
| 29 | `lead_type` | `DLV - ga4 lead_type` | `ga4_params.lead_type` |
| 30 | `seconds` | `DLV - ga4 seconds` | `ga4_params.seconds` |
| 31 | `visitor_intent` (user property) | `DLV - ga4 visitor_intent` | `visitor_intent` |
| 32 | `primary_market` (user property) | `DLV - ga4 primary_market` | `primary_market` |

Also confirm the built-in variable **Event** is enabled (Variables → Configure → Event). It is on by default.

### 2. Trigger (Triggers → New → Custom Event)

- Name: `CE - GA4 browser events`
- Event name (tick **Use regex matching**):

```
^(tour_requested|schedule_tour_click|schedule_showing_click|ask_question_click|contact_agent_click|email_agent|call_initiated|text_initiated|cma_downloaded|cma_anchor_click|place_value_answer|address_submit|sign_up|open_house_rsvp|open_house_page_view|view_listing|save_listing|like_listing|share_listing|compare_listing|compare_add|compare_remove|compare_share|compare_pdf_download|share|view_photo_gallery|play_video|view_similar_listings|search|save_search|view_community|view_city|view_neighborhood|view_blog_post|view_market_report|download_report|scroll_depth|section_view|click_cta|calculator_used|calculator_interact|map_interaction|share_collection|ai_compare_used|return_visit|exit_intent_shown|homepage_view|hero_search|hero_impression|hero_city_chip|featured_impression|view_featured_listings|community_impression|newsletter_signup|community_cta_click|city_cta_click|broker_view|contact_agent|view_landing_page|pulse_feed_entry|pulse_card_view|pulse_card_like|pulse_card_share|pulse_cta_click|pulse_filter_change|nav_interact|dwell|module_interact|sarah_teaser_shown|sarah_teaser_clicked|page_not_found|LCP|INP|CLS|FCP|TTFB)$
```

- This trigger fires on: **All Custom Events**.

### 3. Tag (Tags → New → Google Analytics → Google Analytics: GA4 Event)

- Name: `GA4 - dataLayer events`
- Measurement ID: `G-ST40W4WM6T`
- Event Name: `{{Event}}`
- Event Parameters: one row per line 1 to 30 of the table above: Parameter Name = "GA4 parameter", Value = the
  `{{DLV - ga4 …}}` variable, plus this row (31 rows. Empty values are not sent.):

| GA4 parameter | GTM variable | dataLayer key |
|---|---|---|
| `content_group` | `DLV - ga4 page_type` | `page_type` |

- User Properties: `visitor_intent` = `{{DLV - ga4 visitor_intent}}`, `primary_market` = `{{DLV - ga4 primary_market}}`
  (rows 31 and 32). `GA4 - page_view` carries the same `content_group` row and the same two user properties.
- Leave "Send Ecommerce data" off. Consent: leave the built-in consent checks as they are (do not add any).
- Triggering: `CE - GA4 browser events`.

## Test (before Publish)

1. **Preview** → open `https://ryan-realty.com/sell`, accept cookies in the banner.
2. Scroll the page. In Tag Assistant, `section_view` and `scroll_depth` show **GA4 - dataLayer events: Fired**, and
   the hit's parameters show `section` / `depth` and `page_type`.
3. Tap a phone link: `call_initiated` fires the tag. Its parameters must NOT include a phone number.
4. GA4 → Admin → **DebugView** shows the same events.
5. A `page_view` must NOT fire this tag. It fires `GA4 - page_view` only, once per page.

## Publish

**Submit** → Version name `GA4 browser events via dataLayer (2026-10-13)` → **Publish**.

## After publish (Analytics agent verifies)

- Next day: GA4 Data API `section_view` > 0, `call_initiated` > 0 on a day with a tel: click.
- Register event-scoped custom dimensions for `section`, `depth`, `surface`, `cta`, `form_id` if they should show in
  reports (Admin → Data display → Custom definitions). The user-scoped `visitor_intent` and `primary_market` are
  registered by `scripts/ga4-admin-setup.mjs` (run `--dry-run` first). `page_type`, `cta_location`, `source`, `city_slug`,
  `listing_key`, `lp_*`, `broker_slug`, `method`, `lead_type` and `context` are already registered.

## Changing the list later

Edit `lib/analytics/ga4-browser-events.ts`, run `npx tsx scripts/build-gtm-ga4-import.ts`, update this page (the test
names any line that drifted), then re-import or edit the trigger/tag in GTM and publish.
