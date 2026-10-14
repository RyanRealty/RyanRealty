# ryan-realty.com analytics

**This file is the source of truth** for what ryan-realty.com measures, how events reach GA4 / Meta / Google Ads, and the rules agents must not break. Implementation lives in `lib/analytics/*`, `lib/lead-tracking.ts`, `lib/ga4-measurement-protocol.ts`, and `/api/cron/offline-conversions`. Older notes (`docs/GTM_ANALYTICS_SETUP.md`, `docs/ANALYTICS_LEAD_TRACKING.md`, `docs/GTM_CONSENT_REGION_DEFAULTS.md` on Google Signals) are secondary; if they disagree with this page, this page wins.

**Never put credentials here.** No API secrets, Measurement Protocol secrets, service-account keys, `.env` values, or access tokens. Public property / container / customer IDs are not secrets.


## Start here: every analytics, SEO-measurement or tracking task

1. Read Matt's pinned calls first: tracking in [`data/analytics/decisions.json`](../../data/analytics/decisions.json),
   SEO and AEO in [`data/seo/decisions.json`](../../data/seo/decisions.json). Build on them; never re-decide one
   in chat. When Matt makes a new call, add an entry in the same session (see "Pinned decisions" below).
   Then read this page to the end. It wins over every older analytics doc, skill and handoff.
   For SEO changes (titles, URLs, redirects, canonicals, robots, schema) also read [`docs/SEO.md`](../SEO.md).
2. Run the live audit before you touch anything, and again after you ship:

   ```bash
   npm run analytics:audit            # GA4 config + data health, Search Console, GTM live vs code
   npm run analytics:audit -- --days=7
   ```

   It is read-only, uses the service account, and prints no credentials. It is the
   answer to "do we have access" and "is tracking working". Never sign in to Google
   from a bot browser, and never write a new probe script.
3. Find your file in the **Registry** below. Extend a registered file. A new file that
   sends to GA4, or calls the GA4, Search Console or Tag Manager APIs, fails
   `ci:analytics-registry` until it is added to the Registry with the reason it exists.
4. Ship through `npm run ship`. Work is done when it is live on ryan-realty.com and the
   audit shows it.

---

## Pinned decisions (Matt 2026-10-14)

> "This all needs to be written someplace so that we're always moving our tracking, our SEO, our AEO ... forward and not one-offing things, breaking things." (Matt, 2026-10-14)

Every tracking and measurement call Matt has made is an entry in [`data/analytics/decisions.json`](../../data/analytics/decisions.json): who decided, when, why, and how it is held.

- **`check`** entries are compared with live GA4 and GTM by `npm run analytics:audit` (the "Pinned tracking decisions" section). A FAIL means the setup drifted: fix GA4 or GTM, not the entry.
- **`code`** entries name the test or file that holds the rule.
- **`manual`** entries say where to look; no read-only API exposes them (the Business Profile link, GTM user permissions, Google tag settings).
- **Adding** an entry is free and expected the moment Matt decides something. **Removing or changing** one needs a `Tracking-decision: <who, when, why>` commit trailer (`scripts/check-tracking-decisions.mjs`, run by the commit-msg hook on every commit). SEO and AEO work the same way through `data/seo/decisions.json` and `SEO-decision:`.

---

## Identifiers (live)

| Surface | ID |
|---|---|
| GA4 property | `527333348` (Ryan Realty) |
| GA4 measurement ID | `G-ST40W4WM6T` | <!-- pragma: allowlist secret -->
| GTM container | `GTM-WV6R4NZ5` | <!-- pragma: allowlist secret -->
| Google Ads customer | `5881785778` (linked to this GA4 property) |
| Search Console property | `https://ryan-realty.com/` (linked to this GA4 property) |

Env vars (names only): `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_CONTAINER_ID`, `GA4_API_SECRET` (server Measurement Protocol). Read them from the environment; do not copy values into docs or chat.

---

## GA4 property settings (owner decisions)

- **Custom dimensions registered:** 33 (31 event-scoped, 2 user-scoped: `assigned_broker`, `lead_status`). `seconds` ("Dwell seconds") was added 2026-10-14. They include `lead_type`, `form_id` and `lp_variant`. `scripts/ga4-admin-setup.mjs` also registers the user-scoped `visitor_intent` ("Visitor intent") and `primary_market` ("Primary market"), added 2026-10-14 (see "Visitor intent and market"); the audit's custom dimension list shows whether they are live. `npm run analytics:audit` prints the full list. Register any new reportable param in GA4 Admin → Data display → Custom definitions before relying on it in Explorations.
- **Key events (9):** `generate_lead`, `qualify_lead`, `close_convert_lead`, `call_initiated`, `email_agent`, `cma_anchor_click`, `cma_downloaded`, `tour_requested`, and GA4's built-in `purchase`. Matt removed four that nothing sent (`schedule_showing`, `listing_showing_click`, `listing_inquiry`, `home_valuation_cta_click`) on 2026-10-14; GA4 keeps their history. `scripts/ga4-admin-setup.mjs` holds this list (and `RETIRED_KEY_EVENTS`), so a run never re-adds them. A new key event needs a sender first, and it changes what Google Ads can import: Matt's call.
- **Primary channel group:** `AI Assistants (Custom)` — includes an **AI Assistants** channel (ChatGPT / Perplexity / similar referral hosts). Do not delete the group.
- **Google Signals: ON.** Owner decision. Do not disable. (`scripts/ga4-admin-setup.mjs` enables Signals + consented; the older consent doc that said to keep Signals off is stale.)
- **Data retention:** 14 months (Standard-tier maximum).
- **Google Ads:** property linked to customer `5881785778`. Import GA4 key events (`generate_lead`, and once they accumulate, `qualify_lead` / `close_convert_lead`) as Ads conversions from the GA4 ↔ Ads link. Do not invent an `AW-` conversion tag in the page for those offline events.

---

## GTM container

**Version 8** (2026-10-14, `Audit cleanup: Google tag on Initialization`): the Google tag moved to **Initialization - All Pages**; unused trigger `CE generate_lead` and duplicate variable `DLV page_type` deleted. **Version 9** (2026-10-14) makes the dataLayer the one `page_view` sender (below). **Version 10** (2026-10-14, live, `Content group + visitor intent/market user properties (2026-10-14)`) adds `content_group` (= `page_type`) and the user properties `visitor_intent` / `primary_market` to both GA4 Event tags. `npm run analytics:audit` prints the live version and fails if either tag stops mapping them.

What the container holds:

- The **base Google tag** for `G-ST40W4WM6T` (Initialization - All Pages), configuration parameter `send_page_view` = `false`. **It is not in the repo import file.** <!-- pragma: allowlist secret -->
- Tag **`GA4 - dataLayer events`** — GA4 Event tag, Event Name `{{Event}}`, parameters from `ga4_params.*` plus flat `page_type` / `broker_slug` / `content_group`, user properties `visitor_intent` / `primary_market`. Trigger: **`CE - GA4 browser events`** (regex on the allowlist below).
- Tag **`GA4 - page_view`** — GA4 Event tag, Event Name `page_view`, parameters `page_type`, `broker_slug`, `content_group`, `page_location`, `page_referrer` (flat keys, `GA4_PAGE_VIEW_PARAMS`), the same two user properties (`GA4_USER_PROPERTIES`). Trigger: **`CE page_view`** (event equals `page_view`).

### page_view: one sender

The page pushes `page_view` to the dataLayer and `GA4 - page_view` sends it: the inline GTM bootstrap once on first paint (right after `gtm.js`, so a visitor who leaves before hydration still counts), then `components/PageViewTracker.tsx` once per **pathname** change. A query-only change is not a page view: the search map rewrites `?bbox=` on every pan and zoom, the gallery writes `?photo=N`, the identity bridges strip params. Enhanced measurement's history page views counted all of those (2026-10-14 audit: one map zoom sent a second `page_view`) and carried no `page_type`.

It depends on two settings outside the code, both set 2026-10-14: the Google tag's `send_page_view` = `false`, and GA4 enhanced measurement **Page changes based on browser history events** off. Turning either back on doubles or drops page views; `npm run analytics:audit` fails on any mix but one sender. `page_location` is GA4-safe (next section): the Google tag used to send a tracked email link's contact id to Google on first paint, before `PersonIdentityBridge` cleaned the address bar.

### No personal information in GA4 (Matt 2026-10-14)

Google's GA4 terms forbid personal information, and a mailing address is personal information. Pinned as `no-person-data-in-ga4` and `no-person-data-in-ga4-live` in `data/analytics/decisions.json`.

**One implementation:** `stripGa4UrlParams` in `app/api/visitors/track/strip-identity.ts`, with `ga4SafeUrlJs` as the same function for the inline bootstrap (a test runs both over one case list). It:

- makes `/cma/<slug>`, `/bpo/<slug>` and the static copies (`/cmas/<slug>/…`, `/drafts/<slug>/…`) into `/<prefix>/[document]`; the slug is the subject's street address;
- removes `GA4_STRIP_PARAMS`: the identity params (`_pid`, `_fuid`), `rr_doc`, and `PERSON_TEXT_PARAMS` (`address`, `inquiry`, `email`, `phone`, `name`, `message`, …), matched without regard to case;
- removes any param whose value is an email address, a phone number, or a link into a person document or carrying a person param (`/login?next=/cma/<slug>`);
- turns a legacy `utm_campaign=<cma slug>` into `cma-letter`, and drops the fragment.

The page itself keeps everything: `/sell?address=` still prefills the form and `/contact?inquiry=` the select. Only what GA4 receives changes.

**Where it runs:**

| Path | How |
|---|---|
| First paint | `lib/analytics/gtm-bootstrap.ts` pushes the safe `page_location` on the `page_view`, and `gtag('set', { page_location, page_referrer })` before `gtm.js`, so every other hit on the page carries the safe address too |
| Client-side navigation | `PageViewTracker` calls `setGa4PageLocation` (`lib/analytics/ga4-browser-events.ts`) before its `page_view`; `pushDataLayerEvent` sets it again when only the query changed |
| Browser event params | `ga4ParamsFrom` drops an email or phone value from any parameter and makes a CMA slug in `lp_campaign` `cma-letter` |
| Every Measurement Protocol event | `fireGa4Event` runs `ga4SafeEventParams` on the event and on `campaign_details`: person-named params dropped (`GA4_PERSON_PARAM_NAME_RE`), page fields made safe, a CMA or BPO `page_title` replaced with a fixed label |
| Lead events | `ga4LeadExtra` (`lib/analytics/lead-event.ts`): labels and ids only, `inquiry_type` mapped to a fixed list. The CRM keeps the full text |
| CMA and BPO views | The mirror sends `/cma/[document]` plus `cma_id` (or `bpo_id`), the row's opaque uuid, so a view is still counted and attributable. `valuation_requested` sends `cma_id`, never `cma_slug` |
| Referrer | `/cma`, `/bpo`, `/cmas`, `/drafts` send `Referrer-Policy: strict-origin`, so a click out of a document never carries its address to the next page or any vendor |

**No GTM change was needed.** Verified on production 2026-10-14 with every Google request blocked in the browser: after `gtag('set', { page_location, page_referrer })`, a dataLayer event (`GA4 - dataLayer events`), `scroll_depth`, and enhanced measurement's own `form_start` all sent that `dl=` and `dr=`.

**Gates:** `lib/analytics/ga4-no-person-data.test.ts` fails when any file writes a `page_location` or `page_referrer` that did not come from `stripGa4UrlParams`; `ga4-browser-events.test.ts` fails when a registry parameter, alias or user property is named for a person; `strip-identity.test.ts`, `gtm-bootstrap.test.ts`, `ga4-measurement-protocol.test.ts`, `ga4-mirror.client-document.test.ts` and `lead-event.test.ts` hold the behavior. `npm run analytics:audit` counts (never prints) what GA4 holds and fails on any new person data dated 2026-10-21 or later.

**What GA4 already holds** (GA4 Data API, property 527333348, 430 days to 2026-10-14, counted by `npm run analytics:audit -- --days=430`): 29 distinct CMA/BPO document paths (94 events); 99 distinct page_locations with a person param (317 events: `message` 44, `_pid` 45, `_fuid` 19, `inquiry` 6, `rr_doc` 2, `address` 1, `email` 1); 27 distinct referrers (181 events); 7 CMA-slug campaign names (10 sessions). Removing them is a GA4 data-deletion request (Admin > Data collection and modification > Data deletion requests), Matt's call.

### Import rule (do not skip)

GTM imports **MUST use Merge** (Admin → Import Container → **Merge** → Rename conflicting tags, triggers, and variables). **Never Overwrite.**

`docs/gtm/ga4-browser-events.import.json` is a **partial** container: 2 tags (`GA4 - dataLayer events`, `GA4 - page_view`), 2 triggers (`CE - GA4 browser events`, `CE page_view`), 34 Data Layer Variables (`DLV - ga4 …`; `content_group` reuses `DLV - ga4 page_type`). It **intentionally omits the base Google tag**. Overwrite deletes that Google tag and every other live tag/trigger/variable that is not in the file.

Publish belongs to Matt. After a bad import, restore via **Versions → Set as latest** (prior published versions stay restorable).

Rebuild the import after changing the allowlist:

```bash
npx tsx scripts/build-gtm-ga4-import.ts
```

`lib/analytics/ga4-browser-events.test.ts` keeps the TypeScript allowlist, this import file, and `docs/GTM_GA4_BROWSER_EVENTS.md` in step. Publish steps live in that GTM doc.

---

## Browser events (dataLayer → GTM → GA4)

Browser events reach GA4 **only** through `dataLayer` → the **`GA4 - dataLayer events`** tag. The page never calls `gtag('event', …)` for GA4.

```ts
import { trackEvent } from '@/lib/tracking'           // preferred
import { pushDataLayerEvent } from '@/lib/analytics/ga4-browser-events'
```

1. `pushDataLayerEvent` clears `ga4_params` (`{ ga4_params: null }`), then pushes `{ event, …flat, ga4_params }`.
2. Only names in `GA4_BROWSER_EVENTS` match the Custom Event trigger.
3. Only keys in `GA4_EVENT_PARAMS` enter `ga4_params`. Phone numbers, emails, hrefs, and paths are dropped.
4. **`click_cta` is the CTA event.** Do not invent `cta_click` / `button_click`.
5. Adding an event: add it to `GA4_BROWSER_EVENTS`, rebuild the import, update the GTM trigger regex, Matt publishes.

### Allowlisted event names

`tour_requested`, `schedule_tour_click`, `schedule_showing_click`, `ask_question_click`, `contact_agent_click`, `email_agent`, `call_initiated`, `text_initiated`, `cma_downloaded`, `cma_anchor_click`, `place_value_answer`, `address_submit`, `sign_up`, `open_house_rsvp`, `open_house_page_view`, `view_listing`, `save_listing`, `like_listing`, `share_listing`, `compare_listing`, `compare_add`, `compare_remove`, `compare_share`, `compare_pdf_download`, `share`, `view_photo_gallery`, `play_video`, `view_similar_listings`, `search`, `save_search`, `view_community`, `view_city`, `view_neighborhood`, `view_blog_post`, `view_market_report`, `download_report`, `scroll_depth`, `section_view`, `click_cta`, `calculator_used`, `calculator_interact`, `map_interaction`, `share_collection`, `ai_compare_used`, `return_visit`, `exit_intent_shown`, `homepage_view`, `hero_search`, `hero_impression`, `hero_city_chip`, `featured_impression`, `view_featured_listings`, `community_impression`, `newsletter_signup`, `community_cta_click`, `city_cta_click`, `broker_view`, `contact_agent`, `view_landing_page`, `pulse_feed_entry`, `pulse_card_view`, `pulse_card_like`, `pulse_card_share`, `pulse_cta_click`, `pulse_filter_change`, `nav_interact`, `dwell`, `module_interact`, `page_not_found`, `LCP`, `INP`, `CLS`, `FCP`, `TTFB`.

### Allowlisted parameters

| GA4 parameter | dataLayer key | Notes |
|---|---|---|
| `page_type` | `page_type` | Flat page context (every navigation) |
| `broker_slug` | `broker_slug` | Flat page context |
| `content_group` | `page_type` | GA4's built-in Content group, the same value as `page_type` (GTM version 10, both tags) |
| `source` | `ga4_params.source` | |
| `context` | `ga4_params.context` | |
| `surface` | `ga4_params.surface` | |
| `cta` | `ga4_params.cta` | CTA label (`cta_label` aliases here) |
| `cta_location` | `ga4_params.cta_location` | `cta_context` aliases here |
| `action` | `ga4_params.action` | |
| `method` | `ga4_params.method` | |
| `value` | `ga4_params.value` | **Not used on leads** |
| `currency` | `ga4_params.currency` | **Not used on leads** |
| `section` | `ga4_params.section` | `section_id` aliases here |
| `depth` | `ga4_params.depth` | `percent` / `depth_percent` alias here |
| `search_term` | `ga4_params.search_term` | |
| `form` | `ga4_params.form` | |
| `form_id` | `ga4_params.form_id` | |
| `lead_type` | `ga4_params.lead_type` | Browser `sign_up` only; `generate_lead` is server |
| `listing_key` | `ga4_params.listing_key` | GA4 copy is `lk_<key>` so a 26-digit MLS key stays text |
| `city` | `ga4_params.city` | |
| `city_slug` | `ga4_params.city_slug` | |
| `community_slug` | `ga4_params.community_slug` | |
| `place` | `ga4_params.place` | `place_slug` aliases here |
| `lp_variant` | `ga4_params.lp_variant` | |
| `lp_source` | `ga4_params.lp_source` | |
| `lp_medium` | `ga4_params.lp_medium` | |
| `lp_campaign` | `ga4_params.lp_campaign` | |
| `lp_content` | `ga4_params.lp_content` | |
| `metric_id` | `ga4_params.metric_id` | Web vitals |
| `metric_rating` | `ga4_params.metric_rating` | Web vitals |
| `seconds` | `ga4_params.seconds` | `dwell` threshold reached (listing pages 30/60/120/300, `/subdivisions` 15/45/120) |

### User properties (both GA4 Event tags, GTM version 10)

| GA4 user property | dataLayer key | Notes |
|---|---|---|
| `visitor_intent` | `visitor_intent` | `buyer`, `seller`, `both` or `browsing` (see "Visitor intent and market"). User-scoped custom dimension "Visitor intent" |
| `primary_market` | `primary_market` | Most-viewed Central Oregon city or community slug (`bend`, `tetherow`). User-scoped custom dimension "Primary market" |

`assigned_broker` is also a user property, set through `gtag('set', 'user_properties', …)` by `applyVisitBrokerToGtag` (`lib/tracking.ts`), not by these tables.

### Visitor intent and market

**One definition** (Matt 2026-10-14): `lib/analytics/visitor-intent.ts` reads `visitorPageCategoryFromPath` (`lib/analytics/page-type.ts`), the same page categories `visitor_events.page_category`, the CRM and the sales funnel use. Never classify buyers or sellers a second way.

| Label | Rule (constants in the module) |
|---|---|
| `seller` | Any `seller_intent` page, or a seller event: `address_submit`, `place_value_answer` |
| `buyer` | 3 or more `listing_detail` page views in the last 30 days (`BUYER_LISTING_VIEW_THRESHOLD`, `LISTING_VIEW_WINDOW_DAYS`), or any `buyer_intent` page, or a buyer event: `save_listing`, `schedule_tour_click`, `ask_question_click`, `tour_requested` |
| `both` | Buyer and seller |
| `browsing` | Neither |

A page or event flag never expires; only the listing-view count has a window. `save_listing` and `tour_requested` are in the rule but no browser code sends them yet (2026-10-14), so today a buyer comes from listing views, buyer pages, `schedule_tour_click` and `ask_question_click`.

**Market** (`marketSlugFromPath`): the service-area city in `/homes-for-sale/<city>/…` (listing detail pages included), `/cities/<city>/…`, `/open-houses/<city>`, `/price-drops/<city>` and `/housing-market/<city>/…`, only when it is in `CENTRAL_OREGON_CITY_SLUGS`; the slug in `/communities/<slug>/…`. Everything else, `/subdivisions/<slug>` included (a plat slug carries no city), counts no market. `primary_market` is the most-viewed market; a tie keeps the one reported before.

**Storage:** localStorage `rr_visitor_intent_v1`: listing-view timestamps (30 days, at most 50), the four flags as timestamps, view counts per market (at most 30), and the last label and market. No identifier. Written only when `hasAnalyticsConsent()` is true; without it nothing is recorded, `PageViewTracker` removes the key and pushes both dataLayer keys as `undefined` (so GTM stops sending values pushed earlier on the page), and it does the same the moment the banner turns analytics off. Every read and write is wrapped, so blocked storage only forgets. Listed on `/cookies`.

**Where it shows:**

- `PageViewTracker` records each counted page and pushes `visitor_intent` / `primary_market` in the page-context push, before the `page_view` push.
- The inline bootstrap (`lib/analytics/gtm-bootstrap.ts`) adds the STORED values to the first-paint `page_view`, after the same consent test, since it runs before hydration.
- `trackEvent` (`lib/tracking.ts`) records a buyer or seller event and, when the label changes, pushes the new `visitor_intent` just before that event, so the event's own hit carries it.
- GA4: user properties `visitor_intent` / `primary_market` on every hit (GTM version 10), user-scoped custom dimensions from `scripts/ga4-admin-setup.mjs`, and the audiences below.

**Audiences** (`scripts/ga4-admin.mjs`, group `visitor-intent`). Behavior only, for fair housing: no age, gender, interest, ZIP, city or other geography condition, because these audiences can feed housing ads. The payload builder throws if one of them names such a field (`FAIR_HOUSING_BANNED_FIELDS`), `primary_market` and the site's own place parameters included. All 30-day membership.

| Audience | Condition |
|---|---|
| Buyers - active | `view_listing` count over 2, or `save_listing` (GA4 allows no day window on an event count; the 30-day membership drops a buyer who stops returning) |
| Buyers - hot | `schedule_tour_click`, `ask_question_click` or `call_initiated` |
| Sellers - interested | `page_view` with `page_type` = `sell`, or `address_submit`, or `place_value_answer` |
| Sellers - started valuation | `address_submit`, excluding users with `generate_lead` |
| Visitor intent: buyer / seller / both | user property `visitor_intent` equals that label |

Dry run first: `node scripts/ga4-admin.mjs apply-audiences --dry-run --group=visitor-intent` prints every request body. Register the dimensions (`node scripts/ga4-admin-setup.mjs --dry-run`, then without it) before creating the `Visitor intent:` audiences.

### Deliberately not sent by the GTM tag

| Name | Why |
|---|---|
| `generate_lead` | Server only (Measurement Protocol). A browser copy would double-count. |
| `page_view` | Its own tag, `GA4 - page_view` (above). Never on the shared trigger. |
| `valuation_requested` | Server (`lib/cma-request.ts`) for the same submissions. |
| `form_start` | Enhanced measurement already sends it. |

---

## Server events (Measurement Protocol)

`lib/ga4-measurement-protocol.ts` → `fireGa4Event`. Used by lead tracking and the visitor-track mirror.


### Server events join the visitor's GA4 session (2026-10-14)

Every server sender that runs inside the visitor's request reads one context:
`lib/analytics/ga4-server-context.ts` → `ga4ServerContext()`. It supplies:

- `client_id` from the `_ga` cookie.
- `session_id` and `session_number` from the `_ga_<stream>` cookie. `sessionFromGaStreamCookie` parses the GS1 and GS2 formats.
- `page_location` from the Referer, GA4-safe (`stripGa4UrlParams`: no contact id, typed address, inquiry or CMA slug).
- Consent: GPC or a decline means nothing is sent.
- The same suppression rule the browser tag loader uses (`lib/analytics/ga-suppression.ts`): a broker's own browser, automation, `/admin` and non-production hosts send nothing.

Without `session_id`, GA4 makes every server event a session of its own, with hostname (not set), source (not set) and channel Unassigned. All 117 `generate_lead` events from 2026-09-15 to 2026-10-13 landed that way. Source: GA4 Data API, property 527333348, `eventName = generate_lead` by `hostName`, read 2026-10-14. The fix shipped in #563.

These senders use the context: `fireLeadGenerated` and `fireNonLeadEvent` (`lib/lead-tracking.ts`), `person_identified` (`app/actions/identity-bridge.ts`) and `valuation_requested` (`lib/cma-request.ts`).

A provider webhook has no browser behind it. It passes `serverToServer: true` and sends without a session. Today that is only the Meta Lead webhook.

A new server event must go through `ga4ServerContext()`. Never call `fireGa4Event` with only a `client_id`.

### `generate_lead` (server-only)

One event per real submission. **Only** `fireLeadGenerated` in `lib/lead-tracking.ts` may send it. Never from the browser, never `fireGa4Event('generate_lead')` directly, never `trackEvent('generate_lead')`. Held by `lib/analytics/lead-event.test.ts`.

Leads are **counted by type**. No dollar values: `value` and `currency` are stripped. Meta Pixel / CAPI `Lead` events also send **no value / no currency** since #542.

| Param | Source |
|---|---|
| `lead_type` | Fixed list in `LEAD_TYPES` |
| `form_id` | Fixed list in `LEAD_FORM_IDS` |
| `lp_variant` | Form / page variant (see buyer table below) |
| `lp_source` / `lp_medium` / `lp_campaign` / `lp_content` | First-party UTM copy (`utm_*` → `lp_*`) |

`lead_type` values: `seller_valuation`, `seller_listing`, `buyer_showing`, `buyer_question`, `buyer_alerts`, `listing_inquiry`, `contact_general`.

Not leads (own events, never `generate_lead`): `recruit_inquiry`, `newsletter_signup` via `fireNonLeadEvent`.

### Buyer landing pages

| Page | `form_id` | `lp_variant` | `lead_type` |
|---|---|---|---|
| `/buy/alerts` | `buyer_alerts_lp` | `buy-alerts` | `buyer_alerts` |
| `/buy/leverage` | `buyer_leverage_lp` | `buy-leverage` | `buyer_alerts` |

UTM on paid / organic buyer links (`lib/analytics/utm.ts`, `docs/analytics/buyer-utm-spec.md`):

- `utm_campaign` = `buyer-<angle>` (`buyer-leverage`, `buyer-price-drops`, `buyer-what-it-buys`, `buyer-relocate`, `buyer-first-home`, `buyer-deal-report`, or a later kebab `buyer-*`)
- `utm_content` = **creative ID** (e.g. `reloc-h3-v1`, or the ad-platform macro in the ad URL template — never a street address)

### Landing-page views and audiences

- `view_landing_page` fires once per view of a live landing page from `components/tracking/LandingPageViewTracker.tsx` (mounted once in `PublicClientLayer`). Live means the four /sell pages and each `/buy/<slug>` in `lib/routing/buy-public-slugs.ts` (`liveLandingVariant`); a 404 sends nothing. `lp_variant` is the PAGE variant (`seller-home-value`, `expired-listing`, `fsbo`, `buy-<slug>`), with the page's own `lp_*` utm.
- GA4 audiences built on it, managed by `scripts/ga4-admin.mjs` (`apply-audiences` runs the audience step only): **LP visitors 7d / 30d — no conversion** (`view_landing_page`, excluding `generate_lead`) and **High-intent sellers** (`scroll_depth` with `page_type` `sell` and `depth` over 74; `audiences/16124906126`, rebuilt 2026-10-14). Audience filters cannot be edited; a rebuild goes through `REBUILT_AUDIENCES`.
- CRM credit for a buyer lead (saved search, alert, save, price watch, the /buy forms) is the landing link of the live visit, else the page's own link when there is no live visit (`lib/crm/visit-attribution.ts`, Matt 2026-10-09). The browser keeps no landing context.

### Server page-view mirror (kept on purpose)

`app/api/visitors/track` still mirrors essential-tier `page_view` (and a few intent events) through Measurement Protocol (`lib/analytics/ga4-mirror.ts`, on since 2026-08-10). **That mirror stays.** Since 2026-10-09 it skips views the browser tag already counts (analytics-tier visitors), so it now covers essential-tier visitors and `/cma` / `/bpo` client documents only. Unassigned sessions fell from hundreds a day to 3 on 2026-10-12 and 17 on 2026-10-13 (GA4 Data API, `sessionDefaultChannelGroup = Unassigned` by date, read 2026-10-14). A 28-day window still shows mostly Unassigned until the older days age out. Consequence: GA4 **geography is unreliable** (MP hits do not carry a real visitor geo), and sessions / source / medium / engagement are shaped by the mirror. Use first-party `visitor_sessions` / Search Console when geography or organic counts matter. `session_start` / `first_visit` still come only from the browser tag — those are the outage canary (`lib/analytics/ga4-tracking-health.ts`).

---

## Offline conversions (daily 8 AM PT)

Cron: `/api/cron/offline-conversions` — `vercel.json` schedule `0 15 * * *` (15:00 UTC = 8:00 AM Pacific). Code: `lib/marketing/offline-milestones.ts` (Meta), `lib/marketing/offline-ga4.ts` (GA4). Meta `/events` rejects `event_time` older than ~7 days; the upload window is 6 days. No backfill.

| CRM stage | Meta event | GA4 event |
|---|---|---|
| Buyer Contract | `Lead` | `qualify_lead` (`lead_type=buyer_contract`) |
| Pending | `StartTrial` | `qualify_lead` (`lead_type=pending`) |
| Closed | `Purchase` | `close_convert_lead` (`lead_type=closed`) |
| Listed (seller) | `Lead` | — (Meta only) |

GA4 offline events shipped on `main` via #543. They use the stored `_ga` client_id on `crm_people.custom.gaClientId` (first-touch from `fireLeadGenerated`). A missing client_id is skipped, never minted. `lead_type` only — no dollars. Import `qualify_lead` / `close_convert_lead` as Google Ads conversions from the linked GA4 property.

Meta Lead **form-fills** stay valueless (#542). Only a **Closed → Purchase** offline upload may carry a value, and that value is **our commission**, never sale price (`conversionValue` in `lib/marketing/offline-milestones.ts`).

---

## Consent

Set in the page **before** `gtm.js` (`lib/analytics/consent-defaults.ts` + `lib/analytics/gtm-bootstrap.ts`). One restricted-region list: `lib/analytics/consent-regions.ts` (EEA + GB + CH).

| Visitor | Default |
|---|---|
| US / rest of world, no banner answer, no GPC | `analytics_storage` **granted**; all `ad_*` **denied** |
| EU / UK / CH, no banner answer | analytics **denied**; all `ad_*` **denied** |
| Global Privacy Control on | all denied, including analytics (US included) |
| Stored decline (`ryan_realty_cookie_consent`) | all denied |
| Accept all | analytics + `ad_*` granted |

Honor GPC and a stored decline everywhere. **Meta Pixel loads only after marketing accept** (`lib/analytics/meta-pixel-consent.ts`; `META_PIXEL_DEFAULT_FOLLOWS_ANALYTICS_STORAGE = false`). An ad click is not consent. Automation browsers set `rr_automation=1` / `rr_internal=1` and never grant analytics consent (`scripts/lib/marked-playwright.mjs`).

---

## Lead capture surfaces (server)

Every real lead calls `fireLeadGenerated` after the CRM person exists. A new form adds a `form_id` to `LEAD_FORM_IDS` and a test in `lib/analytics/lead-event.test.ts`.

| Door | Typical `form_id` |
|---|---|
| `app/actions/lead-capture.ts` | `page_cta`, listing / contact CTAs |
| `app/actions/lead-landing.ts` | `lead_landing`, `buyer_leverage_lp` |
| `app/actions/search-alert-capture.ts` | `search_alert`, `buyer_alerts_lp`, `buyer_leverage_lp` |
| `app/contact/actions.ts` | `contact` (`contactLeadType` picks `lead_type`) |
| `app/lp/seller-home-value/actions.ts` | `sell_value` |
| `app/communities/[slug]/_v3/place-value-actions.ts` | `place_value` |
| `app/buy/concessions/actions.ts` | `buy_concessions` |
| `app/actions/cma-download.ts` | `listing_cma_download`, `listing_cma_request` |
| `app/api/meta/lead-webhook/route.ts` | `meta_lead_ad` |
| `app/actions/inbound-agent-referral.ts` / `out-of-area-referral.ts` | `inbound_agent_referral`, `out_of_area_referral` |
| `app/actions/listing-payment-email.ts` | `listing_payment_email` |

---

## UTM (outbound links)

One set per URL, via `buildTrackedUrl` in `lib/analytics/utm.ts`. Existing `utm_*` are replaced, never appended. No street addresses, person names, or per-property slugs in any `utm_*`. Test/preview sends use `test: true` → `utm_campaign=test-<campaign>`. CMA identity is `rr_doc=<cmas.slug>`, not a UTM. Vocab and buyer table: AGENTS.md rule 25, `.cursor/rules/utm-convention.mdc`, `docs/analytics/buyer-utm-spec.md`.

---

## Do not

- Call `gtag('event', …)` for GA4 from the page.
- Send `generate_lead` from the browser or a second server helper.
- Put `value` / `currency` on `generate_lead`, Meta `Lead`, `qualify_lead`, or `close_convert_lead`.
- Import a GTM container with **Overwrite**.
- Disable Google Signals.
- Trust GA4 geography, sessions, or source/medium as human truth while the MP page-view mirror is on.
- Put API keys, tokens, or `.env` values in this file, a commit, or chat.
- Use `ryanrealty.vercel.app` on any outward URL.
- Write a new GA4, Search Console or GTM probe, script or scratch audit. Extend `scripts/analytics-audit.mjs` and the Registry.
- Send a server GA4 event with only a `client_id`. Use `ga4ServerContext()`.
- Hand GA4 a `page_location` or `page_referrer` that did not go through `stripGa4UrlParams`, or a parameter named for a person (`cma_slug`, `address`, `email`). See "No personal information in GA4".
- Run `scripts/ga4-admin.mjs apply`. Change GA4 Admin config only through `scripts/ga4-admin-setup.mjs` (dry-run first).

---

## Search Console

- **Property:** `https://ryan-realty.com/`, a URL-prefix property. The service account is a site owner. No `sc-domain:` property is visible to it, and the domain has no Google TXT record. A Domain property would also cover `www.` and the `seller.` / `buyer.` subdomains. Verifying one needs a DNS TXT record, which is Matt's call.
- **Sitemaps:** the index `/sitemap.xml` plus five children: `core`, `geo`, `listings`, `matrix`, `content`. All are submitted, with 0 errors and 0 warnings, read 2026-10-14. The Sitemaps API's `indexed` field always reads 0 because Google stopped reporting it. Never report that as "nothing indexed". Use URL Inspection (`lib/crawl-probe/gsc.ts`) for index state. Resubmit with `scripts/seo-gsc-sitemap-submit.mjs`.
- **Daily data:** `/api/cron/snapshot-channels` (12:20 UTC) runs `marketing-snapshot-gsc`. It writes `marketing_channel_daily` with `channel = 'gsc'` and `source = 'gsc_search_analytics_api'`: account totals plus the top 25 queries and pages per day. Each run re-pulls today-9 to today-2, but first asks Google for the latest date it has final data for and writes only days on or before it (`lib/marketing-brain/gsc-reported-days.ts`). A day Google has not finished has no row, never a row of zeros. Before 2026-10-14 the newest day was stored as zeros until the next run (2026-10-12 was, and read as a click drop). Readers should still end a comparison window at the latest stored date, not today.
- **Weekly data:** `/api/cron/loop-weekly-measure` (Mondays 13:00 UTC) writes the full page and query × page tables `gsc_page_daily` and `gsc_query_page_daily` (`lib/data/loop/gsc-api.ts`, `gsc-store.ts`).
- **Crawl probe:** `/api/cron/crawl-probe` (11:55 UTC) checks the sitemaps against GSC and samples URL Inspection. It writes `marketing_channel_daily` with `channel = 'crawl_probe'`.
- **Admin panel:** `app/actions/search-console-report.ts`.
- **Freshness, read 2026-10-14:**
  - `gsc_page_daily` latest date is 2026-10-09. That is expected, because the weekly job runs Mondays.
  - `marketing_channel_daily` gsc clicks latest is 2026-10-11, fetched 2026-10-13 12:20 UTC.
  - crawl_probe run is 2026-10-13.

---

## Corrections to the shared "Ryan Realty analytics guide" (2026-10-13)

The claude.ai shared skill of that name was written before these live reads. Where it differs, this page wins.

| Guide said | Live, read 2026-10-14 through the GTM and GA4 APIs |
|---|---|
| GTM version 6 had 34 variables, and 4 may need restoring | Version 6 had 29 variables and version 7 has 30. Version 7 added `DLV - ga4 lead_type` and dropped none. Nothing needs restoring. |
| Custom dimensions registered: `lead_type`, `form_id`, `lp_variant` | 33 are registered. Those three are among them. |
| Search Console is linked to GA4 | The API cannot read this link. Confirm it in GA4 Admin → Product links → Search Console. |
| Server page views through the Measurement Protocol stay | They do, but only for essential-tier visitors and client documents since 2026-10-09 (see "Server page-view mirror"). |
| (not in the guide) | Server lead events had no GA4 session, so every lead was Unassigned. Fixed by #563 (see "Server events join the visitor's GA4 session"). |

---

## Registry

Every file that sends to GA4, reads the GA4, Search Console or Tag Manager APIs, or lives in `lib/analytics/` is listed here. `ci:analytics-registry` (`scripts/check-analytics-registry.mjs`) fails on an unlisted file and on a row whose file is gone. **Extend a listed file. Do not add a parallel one.**

### Sending to GA4 (server)

| File | Role |
|---|---|
| `lib/ga4-measurement-protocol.ts` | The one Measurement Protocol client (`fireGa4Event`) and the cookie parsers (`_ga`, `_ga_<stream>`) |
| `lib/analytics/ga4-server-context.ts` | The request context every in-request server sender reads |
| `lib/lead-tracking.ts` | `generate_lead` (`fireLeadGenerated`) and the non-lead form events |
| `app/actions/identity-bridge.ts` | `person_identified` on an email-click identify |
| `lib/cma-request.ts` | `valuation_requested` for seller LP, FSBO LP and place-page submissions |
| `app/api/visitors/track/route.ts` | The page-view mirror (essential tier and client documents) |
| `lib/marketing/send-offline-ga4.ts` | `qualify_lead` / `close_convert_lead` from the daily offline cron |

### Reading Google APIs (app and crons)

| File | Role |
|---|---|
| `app/actions/ga4-report.ts` | GA4 Data API reports for admin and the daily GA4 snapshot |
| `app/actions/ga4-demographics.ts` | GA4 demographics panel. Each report is its own section (ok, withheld, empty, error). Age and gender are Google Signals data that GA4 thresholds; read 2026-10-14, every age and gender report for the last 30 days came back withheld. `userAgeBracket` is incompatible with `sessionSourceMedium`; the age cross-tab uses `sessionDefaultChannelGroup`. |
| `lib/marketing-brain/ga4-health-counts.ts` | Exact daily `session_start` / `first_visit` counts (outage canary) |
| `lib/analytics/ga4-internal-traffic-qa.ts` | Daily read-only check that internal and automated traffic stays out |
| `app/actions/search-console-report.ts` | Search Console summary for the admin panel |
| `lib/data/loop/gsc-api.ts` | Full Search Console page and query pulls for the weekly measurer |
| `lib/crawl-probe/gsc.ts` | Sitemaps and URL Inspection for the daily crawl probe |

### Scripts

| File | Status |
|---|---|
| `scripts/analytics-audit.mjs` | **Canonical** live audit of GA4, Search Console and GTM. `npm run analytics:audit`. Extend this one. |
| `scripts/measure-search-and-analytics.mjs` | Re-runs the 2026-08-02 measured-metrics snapshot for diffing. Keep it for that only. |
| `scripts/seo-gsc-sitemap-submit.mjs` | Submits the sitemap index and its children to Search Console |
| `scripts/gsc-listing-noindex-sweep.mjs` | URL Inspection sweep that fills `gsc_listing_index_flags` |
| `scripts/ga4-404-report.mjs` | GA4 page views that land on a 404, for redirects |
| `scripts/ga4-admin-setup.mjs` | **Canonical** GA4 Admin config: Signals, retention, lookback, custom dimensions, key events and retired key events. Matches the live property as of 2026-10-14. Run `--dry-run` first; change GA4 config by editing this file, then applying. |
| `scripts/ga4-admin.mjs` | Older GA4 Admin config plus audiences, the audience owner. `apply-audiences --dry-run [--group=visitor-intent]` prints what it would create. **Do not run `apply`.** Its 7 "locked" conversions disagree with the live property and with `ga4-admin-setup.mjs`, the canonical config. Use `npm run analytics:audit` to read config. |
| `scripts/_gsc-by-class.mjs` | One-off (2026-08). Search Console clicks by route class. Superseded by `lib/data/loop/gsc-api.ts`. Do not extend. |
| `scripts/_gsc-index-check.mjs` | One-off. Sites and sitemaps. Superseded by `npm run analytics:audit`. Do not extend. |
| `scripts/_gsc-place-pages.mjs` | One-off (2026-09-22). Place-page query landings. Do not extend. |
| `scripts/_gsc-sitemap-fix.mjs` | One-off. Superseded by `scripts/seo-gsc-sitemap-submit.mjs`. Do not extend. |

### `lib/analytics/` modules

| File | Role |
|---|---|
| `lib/analytics/ga4-browser-events.ts` | Browser event allowlist, `ga4_params`, `pushDataLayerEvent` |
| `lib/analytics/lead-event.ts` | Fixed `lead_type` / `form_id` lists |
| `lib/analytics/form-conversion.ts` | Browser `sign_up` for listing and search alert enrolls (the server still sends `generate_lead`) |
| `lib/analytics/submit-alert-signup.ts` | Client wrappers for the alert-capture actions; push `sign_up` only on a counted submit |
| `lib/analytics/ga-suppression.ts` | The one "may this reach GA4" rule, browser and server |
| `lib/analytics/automation.ts` | Automation and crawler classifier |
| `lib/analytics/internal-user-cookie.ts` | `rr_internal` cookie (broker browsers) |
| `lib/analytics/non-production-build.ts` | No Google tag on dev or preview builds |
| `lib/analytics/ga4-demographic-sections.ts` | GA4 report states for the demographics page: withheld when Google's privacy thresholds remove every group, never a 0 or an error |
| `lib/analytics/non-production-host.ts` | No GA4 hits from non-production hosts |
| `lib/analytics/private-paths.ts` | Pages whose address is a secret never load a tag |
| `lib/analytics/consent-defaults.ts` | Consent Mode v2 default script |
| `lib/analytics/consent-regions.ts` | Restricted consent regions |
| `lib/analytics/meta-pixel-consent.ts` | Meta Pixel waits for marketing consent |
| `lib/analytics/gtm-bootstrap.ts` | The inline GTM loader |
| `lib/analytics/inline-script-check.mjs` | Parses shipped inline scripts so a syntax error fails a test |
| `lib/analytics/page-type.ts` | `page_type` taxonomy |
| `lib/analytics/visit-broker.ts` | `assigned_broker` / `broker_slug` from `?agent=` and the cookie |
| `lib/analytics/visitor-session.ts` | First-party visit session id and lifecycle |
| `lib/analytics/ga4-visit.ts` | Mirror session params and `campaign_details` |
| `lib/analytics/ga4-mirror.ts` | When the page-view mirror is on, and which stored figures it shapes |
| `lib/analytics/ga4-tracking-health.ts` | Tracking-health verdict for the daily snapshot |
| `lib/analytics/ga4-internal-traffic-qa.ts` | (above) |
| `lib/analytics/utm.ts` | `buildTrackedUrl`, one UTM convention |
| `lib/analytics/lp-variant.ts` | `lp_variant` from the path |
| `lib/analytics/own-site-links.ts` | Finds ryan-realty.com links in a message so each can be decorated (tracked) |
| `lib/analytics/web-vitals-sample.ts` | Validates one real-user Web Vitals sample before `public.web_vitals` stores it |
| `lib/analytics/visitor-intent.ts` | Visitor intent (buyer / seller / both / browsing) and primary market, from the shared page categories; the `rr_visitor_intent_v1` memory behind the GA4 user properties |

---

## Code map

| Need | File |
|---|---|
| Browser allowlist + `pushDataLayerEvent` | `lib/analytics/ga4-browser-events.ts` |
| Lead types / form IDs | `lib/analytics/lead-event.ts` |
| Server `generate_lead` | `lib/lead-tracking.ts` |
| Consent defaults / regions | `lib/analytics/consent-defaults.ts`, `consent-regions.ts` |
| Meta Pixel consent | `lib/analytics/meta-pixel-consent.ts` |
| UTM builder | `lib/analytics/utm.ts` |
| LP variant from path | `lib/analytics/lp-variant.ts` |
| Landing-page view (`view_landing_page`) | `components/tracking/LandingPageViewTracker.tsx` |
| Buyer lead credit (visit, else page) | `lib/crm/visit-attribution.ts`, `lib/data/identity/visitCampaign.ts` |
| GA4 audiences | `scripts/ga4-admin.mjs` (`apply-audiences`, `--dry-run`, `--group=visitor-intent`) |
| Visitor intent and market | `lib/analytics/visitor-intent.ts` |
| MP page-view mirror | `lib/analytics/ga4-mirror.ts` |
| GTM bootstrap | `lib/analytics/gtm-bootstrap.ts` |
| Offline Meta + GA4 | `lib/meta-offline-conversions.ts`, `lib/marketing/offline-milestones.ts`, `lib/marketing/offline-ga4.ts`, `app/api/cron/offline-conversions/route.ts` |
| GTM import | `docs/gtm/ga4-browser-events.import.json`, `docs/GTM_GA4_BROWSER_EVENTS.md` |
| Buyer UTM table | `docs/analytics/buyer-utm-spec.md` |
| Tracking invariants (gated) | `docs/TRACKING_POLICY.md`, `scripts/check-tracking-policy.mjs` |
