# Tracking Policy — privacy-compliant funnel attribution

**Status 2026-06-17.** This is the authoritative spec for how Ryan Realty tracks
a visitor from anonymous first touch through known-lead conversion and attributes
each lead to its originating ad. It is derived from an adversarially-verified 2026
deep-research pass (17 claims confirmed, 8 refuted) cross-referenced against the
live codebase. Load-bearing invariants are **locked by the `ci:tracking-policy`
gate (G48)**. Outward changes that alter live ad/tracking behavior are a **backlog
that ships only on Matt's explicit go** (Draft-First / ops-explicit).

## The architecture (what we do, end to end)

```
anonymous visit ──► first-party visitor_id (cookie/localStorage, PII-free)
                    + capture fbclid/gclid/utm_* into visitor_sessions
        │
        ▼  (browse: page_view, listing_view, search → /api/visitors/track, consent-gated)
        │
   form submit ──► resolve/stitch to FUB person (email > fub_cid cookie > new)
                    + backfill prior events into FUB timeline
                    + Meta CAPI "Lead" (SHA-256 hashed PII) with shared event_id
                    + browser pixel "Lead" with the SAME event_id  → dedup
        │
        ▼  (FUB pipeline: nurture → close/won)
   close/won  ──► [BACKLOG] offline-conversion upload back to Meta/Google
                   keyed by stored fbclid/gclid  → closed-loop ROAS
```

## Principles → status → enforcement

| # | Principle (research-verified) | Status | Enforcement |
|---|---|---|---|
| 1 | Durable **first-party, PII-free visitor_id**; stitch anonymous→known via a **deterministic shared id (hashed email)**, never fingerprinting | ✅ live (`visitor_sessions`, `rr_session_id`, identity bridge) | gate item 4/5 + DAL |
| 2 | **First-party, server-side** event collection preferred over client-only pixels | ✅ live (`/api/visitors/track`, `/api/meta-capi`, same-origin) | `ci:csp` host allowlist |
| 3 | Consent gates event firing; **Consent Mode v2 = 4 params** (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`) denied-by-default | ✅ live (`GoogleAnalytics.tsx`) | **G48 item 1** |
| 4 | Analytics/marketing tags **gated on a consent helper** | ✅ live — Consent Mode v2: tags always load with `denied` defaults, `hasAnalyticsConsent`/`hasMarketingConsent` drive `consent update` (2026-09-01: GTM moved from load-suppression to this pattern after suppression made all non-consenting traffic invisible to GA4 since 2026-08-18) | **G48 item 2** |
| 5 | **PII SHA-256 hashed before transmission** to ad platforms (email lowercased+trimmed; phone digits-only) | ✅ live (`meta-capi` `em`/`ph` only) | **G48 item 3** |
| 6 | Pixel↔CAPI **dedup via one server-generated `event_id`** (same id + same event_name; Meta 48h merge) | ✅ live (seller LP `generateEventId`) | **G48 item 4** |
| 7 | **Persist click IDs (fbclid/gclid) + UTMs on the lead path** so offline conversions can be uploaded | ✅ live (seller LP captures utm + fbclid) | **G48 item 5** |
| 8 | **Every known contact who arrives through a link we sent is identified on that visit**, server-side, from a signed person token; earlier anonymous sessions on the browser are back-stitched; automation is flagged and never identified (Matt 2026-09-23) | ✅ live (`/api/visitors/track`, `lib/identity/*`, Known people view) | **`ci:identity-loop`** (see "The known-contact identity loop") |

## Hard deadline — June 15, 2026

Google Ads stops deriving consent from Google Analytics (Google Signals) settings
and relies on the **CMP's Consent Mode signal**; `ad_storage` becomes the governing
control for ad data flowing GA4 → linked Ads. Our Consent Mode v2 wiring already
satisfies this. The legacy `UploadClickConversions` API also migrates to the Data
Manager API on the same date — build any offline-upload job (backlog #2) to the new
model. (Source: Google Analytics Help answer 17016975; corroborated, vote 2-1.)

## First-party capture and consent (Matt 2026-08-26)

**Campaign parameters and the referrer are recorded at every consent tier that
stores anything. Geo, user agent and listing meta stay gated on analytics consent.**

The reasoning: a UTM tag or an `fbclid` describes the LINK THAT WAS CLICKED, not the
person who clicked it. The referrer has always been treated that way; campaign params
now match it.

What forced the change. 99.5% of visitors never answer the cookie banner, so almost
every arrival lands at `essential`. While campaign params were stripped there, **357 of
79,220 sessions in 90 days carried one** — every paid click landed with its attribution
already destroyed, which made tagging links pointless.

The limits, which are not negotiable:

- An explicit **decline** still stops tracking entirely.
- A **Global Privacy Control** signal still stops tracking entirely, enforced server-side
  before any write (`app/api/visitors/track/route.ts`).
- Geo, user agent, listing meta, scroll and dwell remain analytics-gated.
- It is **disclosed** in `app/privacy/page.tsx` under Cookies. The code and that page
  must not drift apart — changing one without the other means collecting more than we
  say we collect.

**Development traffic never reaches a production property.** Measured 2026-08-26: 43
sessions arrived in GA4 as a `127.0.0.1:8777` referral. All four tag loaders (GA4, GTM
head + body, Meta Pixel) return null on a non-production build via
`lib/analytics/non-production-build.ts`, and `fireGa4Event` refuses a non-production
`page_location` on the server path.

## What we collect at each consent tier (updated 2026-09-23)

The banner answer decides the tier. `components/VisitTracker.tsx` sends it and
`app/api/visitors/track/route.ts` enforces it server-side; no client can widen it.

| Tier | When | Recorded | Not recorded |
|---|---|---|---|
| **Declined** | banner answered with analytics AND marketing off, or an unreadable consent cookie | nothing: no session, no event, no identification, no GA4 mirror | everything |
| **GPC** | `Sec-GPC: 1` or `navigator.globalPrivacyControl` | nothing; if the browser was already identified, a durable `channel='all'` suppression on that contact | everything |
| **Essential** | no banner answer (99.5% of visitors), or marketing-only | browser session id, `rr_vid`, page URL (identity params stripped), page title and category, event type and time, referrer, landing page, campaign params (`utm_*`, `fbclid`, `gclid`), the automation class label (below), and **identification of a person who clicked a link we sent them, signed in, or submitted a form** (the session's `crm_person_id` and the signed `rr_pid` cookie); page views mirrored to GA4 under an anonymous client id | the user-agent string, IP geo, listing meta columns, scroll depth, dwell, the event metadata blob; no looking-at broker text |
| **Analytics / all** | analytics granted | everything above, plus user agent, IP geo, listing meta, scroll, dwell, metadata; the looking-at broker text on a listing view | — |

Identification at essential is disclosed in `app/privacy/page.tsx` ("Once you sign in,
contact us, or follow a link we send, we may recognize you on later visits using a
first-party cookie and associate the pages and listings you view with your contact
record"). The code and that page must not drift apart.

**The automation class is recorded at every storing tier from the request's user-agent
HEADER and `navigator.webdriver`, and only the class label is stored**
(`visitor_sessions.is_automated` / `automation_reason`: `declared-crawler`, `tool`,
`headless`, `webdriver`, `empty-ua`; `lib/analytics/automation.ts`). Reading the header
to classify is not keeping it. A UA-flagged session is still counted, but it is never
identified to a contact, never shown in the known-people view, and never mirrored to GA4.

One behavioural reason is **provisional**: `contact-deep-link`, a brand-new session whose
first page is `/contact?listingKey=<mls>` with no referrer, no campaign params and no
identity token. People reach that form from a listing page, so their session already
exists. Measured 2026-09-23T06:09Z over the 7 days from 2026-09-16T06:09Z
(`visitor_sessions`, supabase-js read): 882 sessions landed that way, each on its own new
`rr_vid`, none lasting over 10 seconds, none identified, and all 300 sampled had exactly
one event. The UA classifier cannot see that crawler because the UA is not stored at
essential. The flag is set at birth and **cleared by the session's next event**; it keeps
that first view out of the GA4 mirror and the counts, and never blocks identification.

## The known-contact identity loop (Matt 2026-09-23)

> "We have them in the database. If they come in through Facebook, Gmail, or Google,
> or whatever, and they visit my site ... we really want to be able to track that ...
> When I go and see who's been active, I can see, 'Okay, this person's been active' ...
> exactly what they're looking at ... I don't want to have to reinvent this every time."

This is the contract. **`ci:identity-loop` (`scripts/check-identity-loop.mjs`) fails the
build when any part of it is broken.**

1. **Every link to ryan-realty.com that goes to a known contact is decorated by ONE
   helper**: `decorateOutboundText` / `decorateOutboundUrl` in
   `lib/identity/outbound-links.ts` (or `attributeOutbound` / `attributeUrl` in
   `lib/crm/attributed-links.ts`, which delegate to it). It stamps `?agent=<broker>`, the
   CRM UTMs, and `?_pid=<signed token>`. No send path stamps `_pid` itself or calls
   `attributeSiteLinks` directly. **No URL ever carries an email address, phone or name.**
2. **Only a signed token identifies.** The token is `<crm_people.id>.<channel>.<hmac>`
   (`lib/identity/link-token.ts`, HMAC-SHA256 over a domain-separated string with the
   email-tracking secret). A bare `?_pid=64115` or the retired `?_fuid=` identifies
   nobody: person ids are sequential and CMA slugs are street addresses, so an unsigned
   id let anyone be recorded as, or open the CMA of, any contact. Links already in
   inboxes still identify their recipient: `/api/track/e/click` (whose own token is
   signed and names the recipient) and the SMS short-link redirect `/r/<code>` (whose row
   names the recipient) re-sign the destination on the way through.
3. **The track route resolves the token server-side** on the landing page view (race
   free, no dependence on client JS), then:
   identifies that browser session (`identified_via = tracked_link:<channel>`),
   **back-stitches every earlier anonymous session on the same `rr_vid`**, maps the
   `rr_vid` to the person in `visitor_identity_map` (so every later session on that
   browser is born identified, `rr_vid_carryover`), and sets the signed `rr_pid` cookie.
   A token arriving on a device we have never seen identifies that device too, so a
   person who reads email on a phone and browses on a laptop is one person once they
   click from each.
4. **Precedence** (`lib/identity/arrival.ts`, unit-tested): a signed token on the link
   just clicked > the `rr_vid` identity map > the signed `rr_pid` cookie. A session
   already owned by a DIFFERENT contact is never reassigned: the route answers
   `rotateSession` and the tracker starts a fresh session, so a shared laptop records
   each person's visit under the person who clicked.
5. **Automation never identifies anyone** (an email security scanner opening a tracked
   link must not read as the contact browsing).
6. **The view**: `/admin/visitors/live` opens on **Known people** (`?filter=people`,
   last 24 hours / 7 days / 30 days): every identified contact active in the window, most
   recent first, with each visit's source and the pages they viewed (title, the home's
   current address and list price, time on page). Contacts the intake screen reads as
   scripted form submits (`quality:suspect`, `lib/crm/lead-quality.ts`; for rows created
   before that screen, the same classifier on the stored name and email; a broker who
   removes the tag brings the contact back) are left off and counted in the footnote, so
   the list is people, not form bots. The CRM person page
   (`/admin/people/<id>`, "On the site") shows the same, for 30 days, across every
   browser stitched to them, plus **Copy personal link**: a `personal`-channel tracked
   link for a Facebook or Instagram DM, a Gmail reply, or a text from a broker's own
   phone. Data: `lib/data/crm/getSiteActivity.ts`; shaping: `lib/crm/site-activity.ts`.

### Channel map

"Before" is the state on 2026-09-22; "now" is this contract.

| How a known contact arrives | Identifier carried | Path to `visitor_sessions.crm_person_id` | Identified before | Now |
|---|---|---|---|---|
| CRM sequence email / SMS | signed `_pid` (`sequence`) | sequence engine → `decorateOutboundText` → click redirect / `/r/` → track route | only if the client bridge won the race (raw id) | yes, server-side |
| Broker composer email (sent through Gmail by the CRM) | signed `_pid` (`email`) | `app/actions/crm.ts` → helper → track route | same race | yes |
| Broker composer SMS, group MMS | signed `_pid` (`sms`) | `sendGovernedSms` / `try-send-group-mms` → helper → `/r/<code>` → track route | same race | yes |
| Newsletter | signed `_pid` (`newsletter`) | `attributeOutbound` / `contact-newsletter` → helper | same race | yes |
| Listing alert email | signed `_pid` (`alert`) | `lib/alerts/send.ts` → `attributeOutbound` | same race | yes |
| Market report email | signed `_pid` (`report`) | `lib/crm/market-report-send.ts` → `attributeOutbound` | same race | yes |
| CMA / BPO email and every link inside the document | signed `_pid` (`document`) | `attributeOutbound` + `trackedDocLink`; doc tracker forwards it | same race | yes |
| Prospecting SMS | signed `_pid` (`prospecting`) | `app/actions/prospecting.ts` → helper → `/r/<code>` | same race | yes |
| Facebook / Instagram DM, Gmail typed by hand, text from a broker's phone | signed `_pid` (`personal`) | broker pastes the person page's personal link | no (no link existed) | yes |
| Email already in an inbox (pre-2026-09-23) | signed click token | `/api/track/e/click` re-signs the destination | raw id, same race | yes |
| Returning device | `rr_vid` cookie, signed `rr_pid` cookie | identity map carryover at session birth; cookie fallback | yes (`rr_vid_carryover`) | yes |
| Sign-in (Google OAuth, email link, password) | the verified session email, matched server-side | `app/auth/callback` + `identifyAuthenticatedSession` → `personIdsByEmailCi` → stitch | yes | yes |
| Google One Tap | not on the public site (only `/admin/login` takes a Google ID token, for brokers) | none | n/a | n/a |
| Form fill | the submitted email | `stitchFormSubmitIdentity` | yes | yes |
| Google Business Profile, organic search, paid ads (`fbclid`/`gclid`), AI assistants | nothing that names a person | anonymous until one of the rows above happens, then back-stitched by `rr_vid` | back-stitch existed | yes |

Matching happens on the server against `crm_people`; no URL carries an email. What the
browser gets back is hashes only (`/api/identity/me`): a GA4 `user_id` that is a SHA-256
of the person id (or of a signed-in visitor's email), and a SHA-256 of a signed-in
visitor's email for Meta Pixel advanced matching.

**Measured, the 30 days to 2026-09-23** (supabase-js reads, fetched 2026-09-23T02:49Z,
window `first_seen_at >= 2026-08-24T02:49Z` on `visitor_sessions`, `ts >=
2026-08-24T02:49Z` on `crm_timeline`):

| Figure | Value | Source and filter |
|---|---|---|
| Sessions | 26,945 | `visitor_sessions`, count |
| Identified sessions | 185 (184 with a person id), 115 distinct people | `identified_at is not null` |
| by `identified_via` (sessions / people) | `form_submit` 121 / 101 · `rr_vid_carryover` 30 / 10 · `email_click_pid` 16 / 13 · `auth_email` 8 / 1 · `google` 5 / 2 · `hot-anonymous` 3 / 1 · `auth_oauth` 1 / 1 · `auth_session` 1 / 0 | same rows grouped in JS; sums to 185 |
| Email-link clicks | 285 click rows from 57 people, 227 to ryan-realty.com (`listing-alert` 149, `bulk` 89, `seq` 20, `contact` 19, `cma` 5, `alert` 3) | `crm_timeline` `kind = 'email_click'`, grouped by `payload.emailKey` prefix |
| Sessions that arrived tagged as email | 7 (`utm_medium = 'email'`), 6 with `utm_source = 'crm'` | `visitor_sessions` |
| Sessions that landed with a raw `_pid` | 14, all on 2026-08-30: 4 identified, 10 never (no later session on those browsers was identified either) | `landing_page` matched `[?&]_pid=` in JS |
| SMS short links created | 0 | `crm_short_links` `created_at` in window |
| Identified sessions with a `gbp` or `facebook` source | 0 of 185 | identified rows grouped by `utm_source` |

So 57 people clicked an email link to us and 13 were identified by it: the gap this
contract closes (server-side resolution, re-signed click redirects, back-stitch).
`form_submit` is the largest identified group and is mostly scripted submits (the p06
screen flagged 69 of 92 site-door contacts in the same window), which is why the view
screens them out.

### Known limits (not fixed by code)

- A forwarded email identifies whoever clicks it as the recipient. Every CRM has this.
- Email security scanners that render tracked links in a real browser with a spoofed
  user agent are not caught by the automation class.
- A person who lands straight on `/contact?listingKey=<mls>` from a bookmark or a pasted
  URL and leaves after one view stays flagged `contact-deep-link`; they were anonymous
  and one page, so only the counts move. If they submit the form they are identified
  and shown (the view ignores the provisional flag on identified sessions).
- A token names the contact until the email-tracking secret rotates; rotating it
  silently un-identifies every link already sent.

## GA4 Measurement Protocol mirror (TRACK-1, 2026-09-23)

The track route mirrors essential-tier page views into GA4 (commit 416911b31, Matt's
decision; kept). Since 2026-09-23 each mirrored hit carries a **per-visit numeric
`session_id`** (the Unix second the visit began; a new visit after 30 minutes idle) and
`session_number`, and the first hit of a visit is preceded by a **`campaign_details`**
event with the source, medium, campaign, content and term the tracker captured (an
untagged arrival is sent as `(direct) / (none)`). UA-flagged sessions are not mirrored,
nor is the first view of a provisional `contact-deep-link` session. `visitor_sessions` / `visitor_events` remain the record of who visited; GA4 is
a secondary view.

## Backlog — outward changes, ship only on Matt's go

These change live ad/tracking behavior, so they are NOT auto-enforced. Each needs
explicit approval before shipping (ops-explicit / Draft-First).

1. ~~**Meta Limited Data Use (LDU) for CCPA/CPRA opt-out.**~~ ✅ **DONE 2026-06-17.**
   `MetaPixel.tsx` now reads the consent cookie and sets `fbq('dataProcessingOptions',
   ['LDU'],0,0)` when marketing consent is not granted (essential-only / "Do Not Sell"),
   and `[]` (no LDU) when granted. Ad-click visitors (fbclid/gclid/utm) with no explicit
   choice are treated as marketing-OK to preserve first-PageView attribution, mirroring
   `autoGrantConsentForAdTraffic`. The server CAPI honors it too: `/api/meta-capi`
   reads the consent cookie (or an `ldu` body flag from server-to-server callers) and
   `lib/meta-capi.ts` sends `data_processing_options: ['LDU']` for opted-out visitors,
   so the browser + server channels stay consistent. Both locked by G48 (`ci:tracking-policy`).
2. ~~**Offline-conversion upload to Meta (closed-loop ROAS).**~~ ✅ **DONE 2026-08-26.**
   `/api/cron/offline-conversions` runs daily, maps deal stages to milestones
   (`lib/marketing/offline-milestones.ts`) and uploads through
   `uploadOfflineConversion`. Only the closing carries a value, and that value is the
   COMMISSION — never the sale price, which would overstate return ~30x and teach the
   campaign to chase expensive homes instead of profitable business. `Offer` is not a
   milestone: it evaporates too often to optimize toward. Idempotent through
   `crm_idempotency_keys` keyed `deal:<id>:<milestone>`. A `channel='all'` suppression
   SKIPS the contact entirely rather than uploading under LDU — a do-not-sell signal
   means do not send them. **Meta's /events rejects an event_time older than ~7 days,
   so there is no backfill**: measured 2026-08-26, all 18 milestone-eligible deals were
   39–417 days old and none could be uploaded. The loop starts at the next milestone.
   **Google Enhanced Conversions is still NOT built** — Google Ads has never run
   ($0 spend, ever). Windows when it does: **GCLID 90 days, hashed-PII 63 days.**
3. **Versioned, timestamped consent record.** Store consent text version + scope +
   timestamp + IP per lead before any call/text automation fires. The FCC abandoned
   the federal one-to-one consent rule, but **state mini-TCPA laws (FL FTSA, OK OTSA)
   may still require seller-specific consent** — the record must capture scope so we
   can prove it. Today we show the disclosure (`ci:sms-consent`) but do not persist a
   per-lead consent record. (Verified 3-0.)
4. **Google Enhanced Conversions (online).** Send hashed PII with the GA4/Ads
   conversion for higher match rates (`AW-` id is present in env; not yet wired).

## Deprecated / do NOT do (refuted or outdated framings)

- Do **not** claim or design around "server-side tagging defeats ad blockers" — refuted
  (0-3). Server-side reduces *some* loss; it is not a cloak.
- Do **not** assume third-party cookies are being universally phased out — Google
  **cancelled** Chrome 3p-cookie deprecation (Jul 2024); the loss is Safari/Firefox-only
  (~36% of traffic).
- Do **not** use browser **fingerprinting** for identity. Stitch on hashed email only.
- Do **not** send **raw/unhashed** email or phone to Meta or Google. Ever. (Locked by G48.)
- Do **not** retain the leading `+` when hashing phone for Meta — strip to digits only,
  or the hash mismatches and match rate drops.

## References

- Research report: deep-research run `wf_f0c1c88d-073` (this session transcript).
- Tealium visitor-stitching docs; Google Ads offline-import (answer 10029210);
  Google Consent Mode docs; FCC one-to-one final rule (consumerfinanceinsights, 2025-09-15).
- Codebase: `components/GoogleAnalytics.tsx`, `components/CookieConsentBanner.tsx`,
  `components/MetaPixel.tsx`, `app/api/meta-capi/route.ts`, `app/api/visitors/track/route.ts`,
  `app/lp/seller-home-value/actions.ts`, `lib/visitor-backfill.ts`.
