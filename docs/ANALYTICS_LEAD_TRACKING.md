# Analytics & Lead Tracking — putting a name with a number

**Purpose:** tie an individual identity (a name in Follow Up Boss) to anonymous, cross-source (Google / Facebook), and repeat-visitor behavior, so you can see exactly what a lead did before and after they identified themselves.

**Last verified:** 2026-05-28 (GA4 property `527333348` "Ryan Realty", measurement ID `G-ST40W4WM6T`). Re-verify with `node scripts/ga4-admin.mjs audit`.

---

## TL;DR — where the name lives vs where the number lives

There are two analytics surfaces, and they answer different questions.

| Surface | Shows | Use it for |
|---|---|---|
| **In-app admin dashboards** + **Follow Up Boss** | The real **name, email, phone**, full session timeline | "Who is this person and exactly what did they look at?" |
| **Google Analytics 4** | Pseudonymous `fub_person_id` + behavior, **no names/emails** (GA4 ToS forbids PII) | Aggregate funnels, source attribution, cohorts, and **ad-targeting audiences** |

The join key between them is the **FUB person id**. In GA4 you get a *number*; you turn it into a *name* by opening that person in FUB:

```
https://app.followupboss.com/2/people/view/<fub_person_id>
```

The in-app admin already does this join for you — it reads our own database, so it can show the name directly.

---

## 1. Identity architecture

### 1.1 Two identifiers, two jobs

- **`rr_session_id`** — a UUID v4 minted into `localStorage` (key `rr_session_id`) the first time a browser hits a surface. It stitches **anonymous → known browsing WITHIN one origin**. On the Vercel app, `components/VisitTracker.tsx` mints it and records every page/listing view into `visitor_events`. On WordPress, the identify snippet mints its own.
- **FUB person id** — the **cross-surface identity join**. Resolved from an email (form submit, OAuth) or carried directly in an email-click link (`?_fuid=`). This is the only identifier that ties a person together across WordPress, the Vercel app, Google, Facebook, and email.

### 1.2 Cross-origin caveat (important, and a common misconception)

`localStorage` is **origin-scoped**. The `rr_session_id` minted on `ryan-realty.com` (WordPress) is a **different value** than the one on `ryanrealty.vercel.app`. They do not and cannot match across origins. So `rr_session_id` is **not** a cross-surface key — it only links anonymous-to-known within a single origin. The cross-surface link is always the FUB person id.

### 1.3 The five identify paths

A visitor becomes "known" (gets a FUB person id) via any of these. Each one now also stitches their prior anonymous session:

| Path | Where | Trigger | `identifiedVia` |
|---|---|---|---|
| Google One-Tap / FB Login | WordPress (`ryan-realty.com`) | sign-in modal | `google` / `facebook` |
| Email-click bridge | Vercel app | landing with `?_fuid=<id>` | `email_click_fuid` |
| Lead forms (seller / buyer / expired / contact) | Vercel app | form submit | `form_submit` |
| Supabase OAuth | Vercel app | `/app/auth/callback` | `google` / `facebook` |
| Manual admin tag (future) | — | — | `magic_link` |

### 1.4 What identification does (`lib/visitor-backfill.ts → backfillSessionToFub`)

On identify, for the matching `visitor_sessions` row:

1. Marks the session identified: `identified_at`, `fub_person_id`, `identified_email`, `identified_via`.
2. Replays prior `visitor_events` into FUB as **Viewed Property** / **Viewed Page** events (only the high-signal categories: `listing_detail`, `seller_intent`, `buyer_intent`, `area_guide`, `financial_tools`, `search` — blog/home/about noise is skipped).
3. Marks each replayed event `pushed_to_fub_at` (idempotent — re-running never double-fires).
4. Writes `events_backfilled_at` / `events_backfilled_count` on the session.
5. Posts **one** chronological summary note to FUB: the browsing window, first-touch source/campaign, listings viewed, and pages, in real chronological order (the FUB events API stamps "now", so the note carries the true timeline).

The first-touch UTMs captured at session start ride along on every backfilled event, so the lead's FUB record reflects the **original source**, not the moment of sign-in.

---

## 2. What's live now (the identification-gap fix)

Before this fix, `identified_sessions = 0` — the "name with a number" had fired zero times. Root cause: only `/api/fub/identify` (WordPress One-Tap, which had ~0 sign-ins) called the backfill, and the Vercel forms + email-click bridge knew the FUB id but never captured `rr_session_id` or called backfill.

### Part A — Vercel app (in-repo)

`readRrSessionId()` added to `lib/tracking.ts`. Every lead path now reads it and stitches:

- `app/contact/ContactForm.tsx` + `app/contact/actions.ts` (`form_submit`)
- `app/lp/seller-home-value/*` (`form_submit`)
- `app/lp/buyer-listing-alerts/*` (`form_submit`)
- `app/lp/expired-listing/*` (`form_submit`)
- `components/FubIdentityBridge.tsx` + `app/actions/fub-identity-bridge.ts` (`email_click_fuid`)
- `lib/visitor-backfill.ts` — `email` made optional so the email-click path (FUB id only) can stitch.

### Part B — WordPress identify snippet

`docs/wordpress-fub-identify-snippet.html` now mints/reads `rr_session_id` (`getOrCreateRrSessionId()`) and forwards it as `sessionId` in the `/api/fub/identify` POST. The endpoint already accepts and backfills on it.

### Per-surface reality

| Surface | Anonymous browsing recorded? | Anonymous → known stitching |
|---|---|---|
| **Vercel app** (`ryanrealty.vercel.app`) | **Yes** — `VisitTracker` → `visitor_events` | **Full** end-to-end (record → identify → replay) |
| **WordPress** (`ryan-realty.com`) | **No** — see §6 | Identification works (FUB person + tags + note); the forwarded `sessionId` is forward-compatible plumbing with nothing to replay yet |

---

## 3. How to read a lead

### 3.1 Fastest — in-app admin (shows the name directly)

These read our own Supabase, so they show name/email/phone with no GA4 PII restriction. The fix above is what populates the identified columns.

- **`/admin/analytics`** — analytics hub.
- **`/admin/visitors/live`** — live visitor feed; identified rows link straight to the FUB person.
- **`/admin/visitors/[sessionId]`** — one session's full timeline, with the resolved FUB person + email.
- **`/admin/people/[fubPersonId]`** — one person's cross-session view.
- **`/admin/fub-attribution`** — source/medium attribution per lead.
- **`/admin/reports/lead-flow`**, **`/admin/reports/leads`**, **`/admin/reports/traffic-sources`** — roll-ups.
- **`/admin/analytics/funnel-breakdown`**, **`/admin/analytics/lp-leaderboard`**, **`/admin/analytics/cost-per-lead`**, **`/admin/analytics/action-required`** — funnel + LP + spend views.

### 3.2 In Follow Up Boss

Open the person at `https://app.followupboss.com/2/people/view/<id>`. After identification you'll see the replayed **Viewed Property / Viewed Page** events plus the single **"Anonymous browsing history backfilled"** note with the true chronology, first-touch source, and listings viewed.

### 3.3 In GA4 (pseudonymous)

GA4 shows the **`fub_person_id`** event-scoped dimension on identified events. To name it, copy the id into the FUB URL above. Repeat visitors who later identify light up retroactively (within origin), because backfill attaches the id to their prior session.

---

## 4. GA4 configuration that's live (verified 2026-05-28)

Declared in `scripts/ga4-admin.mjs`; `audit` confirms zero drift from the locked spec. To add more, edit the spec then run `node scripts/ga4-admin.mjs apply`.

### 4.1 Conversion events (18)

`purchase`, `close_convert_lead`, `qualify_lead`, `schedule_showing`, `property_inquiry`, `form_start`, `contact_agent`, `generate_lead`, `call_initiated`, `listing_showing_click`, `valuation_requested`, `cma_anchor_click`, `tour_requested`, `cma_downloaded`, `listing_inquiry`, `home_valuation_cta_click`, `newsletter_signup`, `email_agent`.

### 4.2 Custom dimensions (25)

Identity/lead: `fub_person_id` (EVENT), `lead_type`, `lead_classification`, `lead_status` (USER), `assigned_broker` (USER), `method`, `possible_realtor`, `meta_lead_id`.
Attribution: `source`, `lp_source`, `lp_variant`, `lp_campaign`, `lp_content`, `lp_medium`.
Content/context: `price_range`, `property_type`, `property_location`, `cta_location`, `city_slug`, `community_slug`, `broker_slug`, `listing_key`, `mls_number`, `inquiry_type`, `context`.

### 4.3 Audiences (22) — the "name with a number" + cross-source segments

`All Users`, `Purchasers`, `Property Page Viewers`, `Lead Form Starters`, `Schedule Showing Prospects`, `Leads`, `Property Searchers`, `Active Buyers (3+ listings)`, `CMA Downloaders`, `Engaged Sellers (no convert 30d)`, `Repeat visitors — no conversion`, `Form starters — no submit`, `LP visitors 7d — no conversion`, `LP visitors 30d — no conversion`, `High-intent sellers`, **`Identified leads (FUB person)`**, `Real site traffic`, `Google visitors`, `Returning visitors`, **`Identified Google leads`**, `Facebook visitors`, **`Identified Facebook leads`**.

The three bold audiences are the direct answer to "if they continue with Google or Facebook we know who they are": each requires `fub_person_id` to be set alongside the source.

---

## 5. GA4 Explorations recipe (UI-only — build these once)

GA4 **Explorations cannot be created by API** — they are UI artifacts. Build them at **Explore → Blank** (2 minutes each). Settings that apply to all of them:

### 5.0 Apply to every exploration

- **Reporting identity = Blended.** Admin → Data display → Reporting identity → **Blended**. This stitches user-id + device + modeled signals so a person seen on two devices counts once. (Set once, property-wide.)
- **Segment: "Real site traffic only."** Build a **Session segment** named `Real site traffic only` with condition **`hostname` matches regex** `^(ryan-realty\.com|www\.ryan-realty\.com|ryanrealty\.vercel\.app)$`. Drop it onto every exploration to strip spam-referral / staging / localhost hostnames. (This is the Explorations counterpart to the `Real site traffic` audience.)

### 5.1 Identified leads — name with a number  *(the headline report)*

- Type: **Free form**, table.
- Rows: `fub_person_id`, then `lead_type`, `assigned_broker`.
- Values: `Event count`, `Conversions`, `Sessions`.
- Filter: `fub_person_id` **is not** `(not set)`.
- Read: each row is one identified person. Copy the id → FUB URL for the name. Sort by Conversions to surface hottest leads.

### 5.2 Single-lead deep-dive — "see exactly what they are doing"

- Type: **User exploration** (Explore → User exploration template).
- Add segment **Identified leads (FUB person)** or filter `fub_person_id` = the specific id.
- Click a user row → the **user activity timeline** lists every event in sequence with timestamps and parameters (which listings, which LPs, which CTAs).
- This is the GA4 mirror of the FUB activity log + `/admin/visitors/[sessionId]`.

### 5.3 Lead source attribution

- Type: **Free form**, table.
- Rows: `Session source / medium`, then `lp_source`, `lp_campaign`.
- Values: `generate_lead`, `qualify_lead`, `Total users`, `Conversions`.
- Read: which channels/campaigns actually produce leads, not just traffic.

### 5.4 Lead funnel

- Type: **Funnel exploration**.
- Steps: (1) `session_start` → (2) `form_start` → (3) `generate_lead` → (4) `qualify_lead` → (5) `schedule_showing`.
- Breakdown: `Session source / medium` or `lp_source`.
- Toggle **"Make open funnel"** to see drop-off at each step.

### 5.5 Repeat-visitor → conversion

- Type: **Free form**, table.
- Segment: add **Returning visitors**.
- Rows: `fub_person_id` (or `Session source / medium` for anonymous).
- Values: `Sessions`, `Conversions`, `Days since first visit` (or use `Sessions to conversion` if available).
- Read: how many return visits precede a conversion — informs nurture timing.

### 5.6 High-intent sellers

- Type: **Free form**, table.
- Rows: `Session source / medium`, `lp_campaign`.
- Values: `valuation_requested`, `cma_downloaded`, `home_valuation_cta_click`, `cma_anchor_click`.
- Segment: **High-intent sellers**.

### 5.7 Property engagement → inquiry

- Type: **Free form**, table.
- Rows: `listing_key` (or `mls_number`), `property_location`.
- Values: `Views`, `property_inquiry`, `listing_inquiry`, `schedule_showing`, `listing_showing_click`.
- Read: which listings drive the most buyer intent.

### 5.8 Google vs Facebook identified leads

- Type: **Free form**, table.
- Rows: `Session source / medium`.
- Values: `Total users`, `fub_person_id` (as a count via `Event count` on identify events), `Conversions`.
- Segments side by side: **Identified Google leads** vs **Identified Facebook leads**.

---

## 6. WordPress anonymous capture (the deferred "Option B")

> This section is the canonical reference the WordPress snippet comment points at.

**Today:** anonymous browsing on the WordPress site (`ryan-realty.com`) is recorded **nowhere**. `/api/fub/track-page` requires a `fubPersonId` (it only fires *after* identification) and never writes `visitor_sessions` / `visitor_events`. So although the snippet now forwards its `rr_session_id`, there is no prior WP anonymous history to replay — the forwarded id is forward-compatible plumbing only.

**Option B (not built):** add a CORS-enabled anonymous page-view capture from WordPress into `visitor_events`, keyed by the WP `rr_session_id`. Then when a WP visitor later identifies (One-Tap / FB), `backfillSessionToFub` would have real WP history to stitch into FUB.

**Decision — deferred (over-engineering for now):**

- The unrecorded window is tiny: Google One-Tap auto-prompts on page load, so the gap between landing and identification is roughly the first ~1 second. There is little anonymous WP browsing to capture before sign-in.
- Building it well means a new CORS endpoint, cross-origin consent handling, and event dedup against the post-identify `track-page` events — real complexity for marginal signal.
- The Vercel app already does full anonymous → known stitching, which is where most pre-identification browsing happens.

The plumbing is in place (snippet forwards `sessionId`; the endpoint validates and backfills on it), so building Option B later requires **no snippet change** — only the new capture endpoint. Matt decides if/when the signal is worth it.

---

## 7. Maintenance

- **Re-verify GA4 state:** `node scripts/ga4-admin.mjs audit` → writes `out/ga4-audit.json`, prints counts + any drift from the locked spec.
- **Add/change dimensions, conversions, or audiences:** edit the spec in `scripts/ga4-admin.mjs`, then `node scripts/ga4-admin.mjs apply`. These mutations are reversible in the GA4 UI.
- **Explorations** are UI artifacts — they live in GA4 under Explore, not in code. Rebuild from §5 if one is deleted.
- **GA4 PII rule:** never push name/email into GA4. Only the pseudonymous `fub_person_id` (and hashed `user_id`) may flow. The name lives in FUB and the in-app admin.
