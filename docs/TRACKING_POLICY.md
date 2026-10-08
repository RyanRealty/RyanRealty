# Tracking Policy — privacy-compliant funnel attribution

**Status 2026-06-17.** This is the authoritative spec for how Ryan Realty tracks
a visitor from anonymous first touch through known-lead conversion and attributes
each lead to its originating ad. It is derived from an adversarially-verified 2026
deep-research pass (17 claims confirmed, 8 refuted) cross-referenced against the
live codebase. Load-bearing invariants are **locked by the `ci:tracking-policy`
gate (G48)**. Outward changes that alter live ad/tracking behavior are a **backlog
that ships only on Matt's explicit go** (Draft-First / ops-explicit).

**Updated 2026-09-29 (Matt, the four tracked-email breaks):** the client-document
tracker follows the same consent tiers and first-touch capture as every other page;
sessions now end ("Sessions", below); and automation is never identified, never
alerts a broker, and is never recorded as a click ("Automation", below).

**Updated 2026-09-30 (the review of those fixes):** only an ARRIVAL can end a session on
its campaign, and a session id from before the rule is never kept ("Sessions"); the
browser's own `navigator.webdriver` reaches every identify call and every tracker post,
and the browser back-stitch leaves flagged sessions out ("Automation"); Global Privacy
Control is never read as a campaign-link grant, and a client document records nothing
under it (the tier table).

**Updated 2026-09-30 (the second review):** the session a record belongs to has a key of
its own, so a tab still running the tracker deployed before the rule no longer splits a
visit, and an arrival is judged on the address the page LOADED at ("Sessions"); the
identity bridge identifies the session the tracker's first post landed in, and an
automated click is redirected with no person token ("Automation"); under Global Privacy
Control both trackers write no identifier and send only a notice, the search events and
`trackUserEvent` refuse a decline and GPC, and the campaign-link grant goes through
`arrivalConsent` (the tier table).

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

## What GA4 counts (Matt 2026-10-05)

**Google Analytics counts only real outside visitors. Internal users are excluded by
login.** One decision, `lib/analytics/ga-suppression.ts`, says when a page may reach the
GA4 property (527333348, G-ST40W4WM6T, through GTM-WV6R4NZ5). Nothing is sent when ANY
of these holds:

1. **Admin.** The page is `/admin` or under it.
2. **Not production.** The page host is not `ryan-realty.com` or a subdomain of it:
   `localhost`, `127.0.0.1`, a `*.vercel.app` preview, a local `next start` with
   production credentials.
3. **Automation.** `navigator.webdriver` is true, the user agent is a crawler, an HTTP
   tool or a headless browser (the classifier in `lib/analytics/automation.ts`), or
   our own marker is present: the cookie `rr_automation=1` or `?rr_automation=1`.
   Every browser this repo launches carries `rr_automation=1` and `rr_internal=1`
   (`scripts/lib/marked-playwright.mjs`, `scripts/lib/marked-puppeteer.mjs`, and
   `playwright.config.ts` for the E2E and post-deploy smoke runs) and a declined
   consent cookie — no automation answers the banner with a grant.
4. **Internal user.** The browser holds `rr_internal=1`, a first-party flag (a year,
   SameSite=Lax, Secure on production, no identity in it) set server-side when a
   broker or admin signs in (`app/auth/callback`, the One Tap form) and refreshed on
   every authenticated admin page load (`/api/admin/internal-browser` → `markInternalBrowser`, which re-checks the
   session and the `admin_roles` row). A consumer sign-in sets nothing.

**Where it is read.** In the browser, the GTM bootstrap and `components/GoogleAnalytics.tsx`
run the same rule as one inline expression (`GA_SUPPRESS_JS`) BEFORE gtm.js or gtag.js
is requested, so a suppressed page loads no Google tag at all; `GTMHead` re-applies it
on every client-side navigation through Google's `ga-disable-<id>` switch (a visitor
who walks into `/admin`). On the server, the Measurement Protocol mirror in
`/api/visitors/track` calls `decideGaSuppressionForPage` on the page it is told about.
`lib/analytics/ga-suppression.test.ts` runs the expression and the function over the same
cases. GA4 data filters are not used: the Admin API has no method to create one, and a
tag that never loads needs no filter.

**First-party tracking keeps recording, flagged.** A marker session is stored with
`automation_reason = 'marker'` (automation: never identified). A signed-in broker's
session is stored with `automation_reason = 'internal'`: left out of counts of outside
visitors and never mirrored, but still a person, so the identity loop identifies it
like anyone else (Matt clicking a link we sent him is how an owner-path send is
proven). A page on a non-production host records nothing at all: the track route
refuses it before any write, with the mirror's own host rule (`isNonProductionPageLocation`).

**Unchanged.** Consent Mode defaults, the banner, and what a real visitor is asked.
No new personal data is sent anywhere. Held by `ci:analytics-suppression`.

## What we collect at each consent tier (updated 2026-09-29)

The banner answer decides the tier, and ONE mapping reads it: `lib/identity/consent.ts`
(`parseConsentCookie`, `trackingLevelFromConsent`, `isAdTrafficSearch`). It is followed
by `components/VisitTracker.tsx`, which sends the tier for every page view and every
interaction (`V3SectionTracker` sends the same value; until 2026-09-29 it sent none and
the server dropped every event it posted), by the server's identify paths, and by the
client-document tracker `public/rr-doc-tracker.js`, a plain file that cannot import it
and so MIRRORS it. `app/api/visitors/track/doc-tracker.pin.test.ts` executes that script
and the TypeScript over every cookie shape and campaign URL and fails when they
disagree (until 2026-09-29 the script hard-coded `essential`, so a visitor who had
declined was still recorded and identified on a CMA or BPO document).
`app/api/visitors/track/route.ts` enforces the tier server-side; no client can widen it.

| Tier | When | Recorded | Not recorded |
|---|---|---|---|
| **Declined** | banner answered with analytics AND marketing off, or an unreadable consent cookie | nothing: no session, no event, no identification, no GA4 mirror. On client documents (`/cma`, `/bpo`) as on every page: the script posts nothing and stores no session id | everything |
| **GPC** | `Sec-GPC: 1` or `navigator.globalPrivacyControl` | nothing; if the browser was already identified, a durable `channel='all'` suppression on that contact. Both trackers, the site's and the client document's, write no identifier (no session id, no lifecycle record, no first-touch capture, no consent cookie: the campaign-link grant never applies) and post no event: once per page load they send a notice that carries the signal and nothing else (`{ gpc: true }`), and no identify ping. The route checks GPC before anything else, drops the request, and finds the contact from what the browser already carries on every request here: the signed `rr_pid` cookie, else its `rr_vid` in `visitor_identity_map` (a tracker from before 2026-09-30 still names its session). Until 2026-09-30 the site tracker minted a session id and posted every event with its address and campaign, while the document tracker sent nothing, so a known contact reading a report under GPC was never suppressed | everything |
| **Essential** | no banner answer (99.5% of visitors), or marketing-only | browser session id, `rr_vid`, page URL (identity params stripped), page title and category, event type and time, referrer, landing page, campaign params (`utm_*`, `fbclid`, `gclid`), the automation class label (below), and **identification of a person who clicked a link we sent them, signed in, or submitted a form** (the session's `crm_person_id` and the signed `rr_pid` cookie); page views mirrored to GA4 under an anonymous client id | the user-agent string, IP geo, listing meta columns, scroll depth, dwell, the event metadata blob; no looking-at broker text |
| **Analytics / all** | analytics granted | everything above, plus user agent, IP geo, listing meta, scroll, dwell, metadata; the looking-at broker text on a listing view | — |

Identification at essential is disclosed in `app/privacy/page.tsx` ("Once you sign in,
contact us, or follow a link we send, we may recognize you on later visits using a
first-party cookie and associate the pages and listings you view with your contact
record"). The code and that page must not drift apart.

**The campaign-link grant (Matt 2026-06-02, `autoGrantConsentForAdTraffic`).** A visitor
with NO banner answer who arrives on an ad or campaign link (any `utm_*`, `fbclid`,
`gclid`, `msclkid`, `ttclid`) is treated as `all` for that visit and the grant is stored
in the consent cookie, so their first page view scores and the campaign is attributed. An
explicit answer, a decline included, is never overridden, and a browser sending Global
Privacy Control is never granted anything: an opt-out of sale and sharing is not consent
to marketing (`arrivalConsent`, `gpcFromNavigator`; until 2026-09-30 the grant wrote the
`all` cookie for such a browser on every campaign link, report pages included). Every link we send a known
contact carries `utm_*`, so an email arrival lands here on whichever page it opens,
public page or client document: the client-document tracker follows the same rule
(`isAdTrafficSearch`, and it writes the same cookie the banner does). The link judged is
the one the page ARRIVED on (`pageArrival`, recorded at hydration), not the address a tap
before the lazily loaded tracker mounts has put there since, and the banner decides
through `arrivalConsent` itself (until 2026-09-30 it restated the rule by hand; `gpc` is
now a required argument of it).

**The other event writers follow the same tiers.** The search-funnel events
(`fireSearchEvent`) and the `trackUserEvent` server action behind them (and behind a
signed-in visitor's viewing history) record nothing, and write no session id, for a
visitor who declined or whose browser sends Global Privacy Control; the action checks
the consent cookie and `Sec-GPC` itself (`recordingAllowed`), so no client can widen it.
Until 2026-09-30 neither had any check.

**Section and scroll events (`V3SectionTracker`).** The section tracker used to post no
consent field, and the track route drops an event that names none, so no `section_view` or
`scroll_depth` it sent was ever recorded. It now posts the shared first-party context
(consent included), and only for a visitor at the analytics or all tier: at essential the
route strips the event metadata and the scroll depth, so a row would be an empty event: one
write per section plus up to four scroll milestones, every page view. A decline records nothing and leaves no session id. The
section id and the depth ride in `metadata`, the field the route reads. `scrollDepthPct` is
deliberately not sent: `visitor_score_delta_for_event` scores a `scroll_depth` at 75 or more as
+5 engagement, twice a page (the 75 and 100 milestones), and turning that on across every public
page moves the hot-lead count, which is a scoring decision and not a tracking fix.

**The automation class is recorded at every storing tier from the request's user-agent
HEADER and `navigator.webdriver`, and only the class label is stored**
(`visitor_sessions.is_automated` / `automation_reason`: `declared-crawler`, `tool`,
`headless`, `webdriver`, `empty-ua`; `lib/analytics/automation.ts`). Reading the header
to classify is not keeping it. A UA-flagged session is still counted, but it is never
identified to a contact, never shown in the known-people view, and never mirrored to GA4.
Since 2026-09-29 the class is honored everywhere, not only by the track route:

- **Never identified.** The identify server actions (`identifyPersonFromEmailClickNative`,
  `identifyAuthenticatedSession`) refuse an automated request by its user agent, by the
  browser's own `navigator.webdriver` sent with the call, AND by a session the track route
  flagged as automation. A scripted browser with an ordinary user agent shows only in
  `navigator.webdriver`, which no request header carries, so the flag goes with the call
  (`PersonIdentityBridge` and `VisitTrackerWithSession` send it, and the document
  tracker's identify ping adds `webdriver=1`). `PersonIdentityBridge` identifies the
  session `VisitTracker`'s first post of the page landed in (`postedSession`), as the
  document tracker's ping follows its own page view: the click can END the session in
  storage (a new campaign, 30 minutes idle, an id from before the rule), and the lazily
  loaded tracker starts the new one with that post. Until 2026-09-30 it asked at mount,
  identified the visit before this one, read that session's automation flag, and skipped
  the retry meant for the click's own session. On a page the tracker records nothing on,
  it identifies with no session id after 10 seconds. With a session id, the action also
  runs the session backfill first, and a flagged session ends it before the `rr_pid`
  cookie, the GA4 `person_identified` event or the browser stitch.
  `backfillSessionToFub` itself refuses a flagged session (no person on the session, no
  `visitor_identity_map` row, no back-stitch of the browser's other sessions); so does the
  form-submit stitch (`stitchFormSubmitIdentity`). The browser back-stitch
  (`stitchVisitorIdentity`, run when a person identifies) leaves every flagged session on
  the same `rr_vid` unidentified, and a back-stitch or identity-map write that fails is
  logged, never skipped in silence; the provisional `contact-deep-link` shape is stitched
  like any session. Which sessions automation blocks is ONE rule
  (`lib/analytics/automation.ts`, `sessionBlocksIdentification` and the PostgREST filter
  `IDENTIFIABLE_SESSION_FILTER` built from the same terms), read by the identify paths,
  the back-stitch and the Known people view alike. The contact a form creates exists either way. Every tracker post
  carries `navigator.webdriver` in the shared context, because the route flags a session
  only from the event that creates it, and a section view can be that event (until
  2026-09-30 `V3SectionTracker` sent none). `ci:identity-loop` holds each of these guards
  at its call site.
- **Never alerts a broker.** Neither the "they opened your report" text
  (`queueCmaOpenedAlert`, from a client-document view or from the email's open pixel) nor
  the "looking at this home" text (`queueReturnVisitAlert`) fires for an automated request.
- **Never a click, and never a person token.** `/api/track/e/click` classifies the
  request's user agent. An automated request is still redirected (a scanner that gets no
  answer flags the link), to the destination with no person token on it
  (`withoutIdentityOnOwnSite`): a mail security gateway resolves the link with a library
  user agent and then renders the page it was sent to in a sandbox with an ordinary one,
  and until 2026-09-30 that page carried a freshly signed `_pid`, so the sandbox was
  identified as the contact, cookied, and a "they opened your report" text queued. The
  SMS short link `/r/<code>` does the same for a link preview. A person clicking still
  arrives with the destination re-signed. The automated click is
  recorded ONCE as `email_events.event = 'click_automated'` with `meta.automation_reason`;
  it writes no `crm_timeline` `email_click` row and no newsletter-ledger click. Every
  report that counts engagement reads the exact value `click`, so `click_automated`
  counts toward none of them. Writing it needs the `email_events_event_check` constraint
  widened (`supabase/migrations/20260929170000_email_events_click_automated.sql`, applied
  with the deploy); until it is applied the insert fails, is logged, and the visitor is
  still redirected, so an automated click is recorded nowhere and never as a `click`.

One behavioural reason is **provisional**: `contact-deep-link`, a brand-new session whose
first page is `/contact?listingKey=<mls>` with no referrer, no campaign params and no
identity token. People reach that form from a listing page, so their session already
exists. Measured 2026-09-23T06:09Z over the 7 days from 2026-09-16T06:09Z
(`visitor_sessions`, supabase-js read): 882 sessions landed that way, each on its own new
`rr_vid`, none lasting over 10 seconds, none identified, and all 300 sampled had exactly
one event. The UA classifier cannot see that crawler because the UA is not stored at
essential. The flag is set at birth and **cleared by the session's next event**; it keeps
that first view out of the GA4 mirror and the counts, and never blocks identification.

## Sessions (Matt 2026-09-29)

**A session ends after more than 30 minutes with no tracked activity, or when the visitor
ARRIVES on a link carrying a campaign (`utm_source` or `utm_campaign`) different from the
one the session began under. The next tracked event starts a new session.** That is
Google Analytics' own rule: "[UA] How a web session is defined in Universal Analytics"
(support.google.com/analytics/answer/2731565) ends a session after 30 minutes of
inactivity and when a visitor arrives from a different campaign, and GA4 keeps the
30-minute default ("About Analytics sessions", support.google.com/analytics/answer/9191807).
We take those two conditions and not Universal Analytics' midnight cut. A link that
carries no campaign (an ordinary internal link) never ends a session; campaign values
compare trimmed and case-insensitively, on their first 100 characters.

**An arrival** (`isExternalArrival`) is the first tracked event of a page load that the
browser navigated to (Navigation Timing type `navigate`: not a reload, not the back or
forward button; a browser that cannot say is not counted) from outside the site (no
referrer, as from a mail or messaging app, or another site's). Every other event carries
its page's address too, utm tags and all, for as long as the page is open, and is never
compared. Until 2026-09-30 every event was: a CMA sent by text or by a sequence is linked
with `utm_source=crm` and no campaign, and every comp in it with
`utm_source=cma&utm_campaign=<slug>`, so each tap on the report and each comp page
flipped the session. One reading (a view, four comp taps, each comp opened and come back
from) was nine sessions (`doc-tracker.behavior.test.ts` drives that reading through both
trackers and now finds one). A session that begins on an event that is not an arrival
(30 minutes idle, then a tap) records the campaign on its page's address, the same one its
first-touch capture sends.

The first event of a page load is judged on how the page LOADED: its address, referrer and
navigation type, recorded when the session module is first evaluated, at hydration
(`pageArrival`; `lib/tracking.ts` is in every page's bundle and imports it). Its first-touch
capture reads the same address. `VisitTracker` is loaded lazily, so a visitor who taps a
link before it mounts sends the first event from the page they navigated to; until
2026-09-30 that address was compared and captured, and the campaign they arrived on was
never seen. The document tracker records the same three things when its script runs.

**A session id this rule did not start is never kept.** A browser that last visited before
2026-09-29 holds a months-old `rr_session_id` and either no `rr_visit_v1` or one written
by TRACK-1 without a session id in it. Kept, the next email click landed in that old
session, whose first-touch fields never change, and its campaign was lost. The first
tracked event now starts a new session unless the lifecycle record names the stored id
(its `sid`, in `rr_visit_sid_v1`); the visit count carries on. An id a search event
minted before any tracked event (`getOrCreateSessionId`) is not kept either; nothing joins
`user_events.session_id` to `visitor_sessions`.

**The rollout.** A tab loaded before the deploy keeps running the tracker from before the
rule until it reloads (a search page that changes its filters with `pushState` never
does), and that tracker rewrites `rr_visit_v1` as `{ id, n, last }` on every event. While
the session id sat in `rr_visit_v1`, each such rewrite erased it, and the next event in a
new tab started a new session: five session ids in nine minutes of one visit, splitting
the hot-lead score and letting the "looking at this home" text, which dedupes per session
and listing, fire again. The session a record belongs to now lives in a key the old
tracker never touches, `rr_visit_sid_v1`, so its events are simply activity in the same
session (it posts under the same `rr_session_id`), and a browser from before the rule,
which has no such key, is still not kept. What remains until those tabs reload: the old
tracker never ends a session itself, so after 30 idle minutes an event in an old tab
carries the same session on (as production did before the rule), and a `rotateSession`
it answers is replaced by a new session at the next event in a new tab.
`doc-tracker.pin.test.ts` runs both copies with the old tracker writing between their
events (`test/deployed-visit-tracker.ts`).

**Why.** `rr_session_id` lived in localStorage for the browser's life, and
`visitor_sessions` keeps the first-touch fields (campaign, referrer, landing page, user
agent) of the first event a session id ever sent and never updates them. A returning
visitor carried the campaign of their first-ever visit for good: a tagged email clicked
months later landed in that old session and its `utm_*` was lost. Now the next tagged
arrival is a new session id, which is a new row with its own campaign.

**How.** One module, `lib/analytics/visitor-session.ts`, holds the rule and the storage:
`rr_session_id` (the id), the lifecycle record in two keys read and written as one
(`rr_visit_v1`: the GA4 visit id and number and the last-activity time; `rr_visit_sid_v1`:
the session the visit belongs to and the campaign it began under) and `rr_source_v1` (the
tab's first-touch capture, cleared whenever a session ends so the new one captures ITS
arrival). `components/VisitTracker.tsx` applies it to every tracked
page view and interaction (`V3SectionTracker` posts through the same context), and
`lib/tracking.ts` reads the id lead forms send. `public/rr-doc-tracker.js` mirrors it;
`doc-tracker.pin.test.ts` runs the script and the TypeScript through the same timelines
(the 30-minute boundary either side, campaign changes, re-cased and padded values, a
session id with no record, a corrupt record) and fails when they disagree. A session
and a GA4 visit are the same thing: a new session id always begins a new visit, so the
mirror's `campaign_details` follows the campaign change. A session id a search event
minted before any tracked event is replaced by the first tracked event, as above; a form
never mints one (it sends the id the tracker left, `readRrSessionId`).

**The client-document tracker sends what the site sends.** Before 2026-09-29 a report
opened before any public page created the session without its campaign: the script posted
the address and the landing page stripped of their query, and no `campaign`, `fbclid` or
`gclid` fields at all (only the referrer survived), and `visitor_sessions` never updates
first-touch fields, so the campaign on the email link was lost for good. It now posts the
real address and the same fields the site's tracker sends, in the fields
`/api/visitors/track` already reads (no new endpoint), so a session born on
`/cma/<slug>` carries `utm_source=cma` and `utm_campaign=<slug>`.

**Identity stitches across the break, exactly as before.** The track route identifies a
NEW session by the signed `_pid` token on the link, else by the durable `rr_vid` carried
in `visitor_identity_map` (`rr_vid_carryover`), else by the signed `rr_pid` cookie; a
session owned by a different contact is never reassigned (`rotateSession`).
`app/api/visitors/track/new-session-identity.test.ts` pins each path against the route
with a new session id, and `doc-tracker.to-route.test.ts` drives the real script into the
real route.

**Storage that will not keep it.** The session lives in `localStorage`, shared by every
tab, with a copy in the page's memory. When storage is blocked or refuses writes (a full
quota, some private windows: `getItem` answers while `setItem` throws) the memory copy
serves the page. The id and its record are read as one pair, and the page's pair wins when
it is newer than storage's: a storage that still held an old id and refused writes used to
answer that old id for every event after a session ended (fixed 2026-09-30). A browser
like that keeps one session per page life instead of a new session on every event.

**What ending sessions changes for everything keyed on a session id.** This is the
intended effect of the rule, and it moves these readers; none was changed:

- The "looking at this home" broker text dedupes per session and listing
  (`lookingAtDedupeKind`, `lib/crm/broker-alerts.ts`). A known contact who looks at the same
  home on Monday and again on Wednesday now earns a second text; before, one per browser
  lifetime. That is the "return visit" the alert is named for.
- The hot-lead cron fires once per session that reaches `engagement_score >= threshold`
  (`app/api/cron/visitor-hot-lead-escalation/route.ts`, `hot_lead_fired_at`). Scores now
  accumulate within a visit, not across a browser's life: a single strong visit still trips
  it, and the slow accumulation of many small visits into one old session no longer does.
  Whether the threshold should be re-tuned for per-visit sessions is Matt's call.
  Measured 2026-09-30T06:20Z (supabase-js row reads, counted in a script): the 50 most
  recent `visitor_sessions` rows with `hot_lead_fired_at >= 2026-08-01T06:20Z` (59 rows in
  that window), every one of their `visitor_events` in `event_at` order, replayed with a
  break at every gap over 30 minutes and the trigger's own `score_delta` (the sum equals
  `engagement_score` on 50 of 50 rows). 45 still reach 100 inside one gap-free run, 5 do
  not (their best runs: 50, 51, 53, 58 and 68), and 2 reach it in more than one run (one
  twice, one three times), so 48 fires where there were 50; in 5 of the 45 the run that
  reaches 100 is a later visit than the one the old rule fired in. Of the 30 identified
  rows (the ones that make a call task: 24 people, every row resolving to a `crm_people`
  row, none tagged `quality:suspect`), 27 still reach 100, 3 do not, and the same 2 repeat:
  30 tasks where there were 30. 38 of the 50 were a single run already; the 12 that split
  spanned 143 minutes to 82 days. Campaign arrivals could split runs further, so 45 is an
  upper bound.
- Anything else that reads `visitor_sessions.engagement_score` or `peak_score` per session
  now reads a visit, not a browser's whole history.

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
   link must not read as the contact browsing). Not on the track route, not in the identify
   actions (`app/actions/identity-bridge.ts`), not in `backfillSessionToFub` or the
   form-submit stitch; and it never fires a broker alert or records a click. The list of
   places is under "Automation" above.
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
  user agent are not caught by the automation class: the click redirect classifies the
  user-agent header only (it cannot run `navigator.webdriver`), so such a scanner is
  recorded as the recipient clicking, and the site's tracker records it as the visit.
- Two tabs opened from different campaign links share one session record. The second
  arrival starts a new session, and events in the first tab after it are recorded in that
  new session (only an arrival compares campaigns, so the tabs no longer hand the session
  back and forth). Google Analytics shares one session across tabs the same way.
- A campaign is `utm_source` plus `utm_campaign`. An arrival that carries only a click id
  (`fbclid` or `gclid` with no `utm_*`) inside 30 minutes of the visitor's last activity does
  not end the session, so that click id is not captured for the session already running (a
  session that is new for any other reason captures it). A link tagged with `utm_source`
  or `utm_campaign` is unaffected.
- A person who lands straight on `/contact?listingKey=<mls>` from a bookmark or a pasted
  URL and leaves after one view stays flagged `contact-deep-link`; they were anonymous
  and one page, so only the counts move. If they submit the form they are identified
  and shown (the view ignores the provisional flag on identified sessions).
- A token names the contact until the email-tracking secret rotates; rotating it
  silently un-identifies every link already sent.

## GA4 Measurement Protocol mirror (TRACK-1, 2026-09-23)

The track route mirrors essential-tier page views into GA4 (commit 416911b31, Matt's
decision; kept). Since 2026-09-23 each mirrored hit carries a **per-visit numeric
`session_id`** (the Unix second the visit began; a new visit after 30 minutes idle, and,
since 2026-09-29, on a different campaign: a visit is a session, see "Sessions") and
`session_number`, and the first hit of a visit is preceded by a **`campaign_details`**
event with the source, medium, campaign, content and term the tracker captured (an
untagged arrival is sent as `(direct) / (none)`). UA-flagged sessions are not mirrored,
nor is the first view of a provisional `contact-deep-link` session. `visitor_sessions` / `visitor_events` remain the record of who visited; GA4 is
a secondary view.

The mirror skips a view only when the browser's own gtag is counting it: the analytics or
all tier plus a `_ga` cookie. A raw-HTML client document (`/cma`, `/bpo`, page category
`client-document`) runs no gtag, so its views are always mirrored, whatever the tier
(`ga4-mirror.client-document.test.ts`). Before 2026-09-29 the document tracker always posted at
essential and this held by accident; it now posts the visitor's real tier.

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
