# Ryan Realty Newsletter System — Production Spec

**Status:** Draft for Matt's approval · **Version:** 1.2 · **Date:** 2026-07-03
**Owner (spec):** Claude Code · **Intended builder:** a separate implementation process
**Companion:** [`NEWSLETTER_CONVERSION_RESEARCH.md`](NEWSLETTER_CONVERSION_RESEARCH.md) (the evidence base)

> **v1.1 — adversarial-audit revision (2026-07-02).** Fixes found by attacking v1.0 against its goals:
> **C1** cadence↔deliverability tension → each monthly issue now **tranches over ~5–7 days,
> engagement-tiered** (§6.5). **C2** recap accuracy → **draft on the 1st, send from the ~3rd** so the
> prior month is fully closed (§4.1/§8). **H1** per-broker engagement → broker is now stamped on
> **both** the pixel/token *and* the Resend-webhook open/click paths (§5/§13-P3). **H2** the body
> formatting gate moves from static-shell-lint to a **runtime** check (§7/G-NL-7). **M2** G-NL-20 gets a
> no-data branch; **M3** the queue (P4) builds before the identity swap (P3); **M4** Phase 0 verifies
> broker admin accounts. Plus doc-consistency: From-address is `news.ryan-realty.com` throughout,
> §6.6 current-state refreshed, freeze-vs-live broker resolved (§9.5).

> **v1.2 — implementation-audit corrections (2026-07-03).** Phase 0 was run against the live DB +
> code + DNS + routes and attacked adversarially ("assume everything is broken"). Corrections to v1.1,
> each proven against reality:
> **A1** the `newsletter_recipients` status CHECK already exists and **excludes `queued`** — Phase 1
> must widen it to `queued`/`skipped` or the queue is dead on arrival (§3.1).
> **A2** `unique(lower(email))` on subscribers **already exists** (`newsletter_subscribers_email_key`);
> S-9 is already mitigated, do NOT re-add it (§3.1). **A3** the ledger `dedupe_key` formula
> `resend_message_id:event:url` is **broken** — our own open-pixel has no `resend_message_id`, so it
> would collapse every recipient's open into one row; the key must be **recipient-scoped** (§3.1/§5/§13-P5).
> **A4** the live `NEWSLETTER_FROM` constant points at the **transactional** `mail.` domain, not the
> bulk `news.` subdomain — a real bug that defeats §6.6 stream isolation (§1/§13-P3).
> **A5** `recordRecipientSend` upserts `onConflict:'newsletter_id,email'` but the only unique index is
> the expression `(newsletter_id, lower(email))` — a latent PostgREST mismatch Phase 3 must fix (§3.1).
> **A6** the mockup broker **close** paragraph + phone are first-person Matt-only and must be templated
> per broker, beyond the §5 signature swap (§5). **A7** the approved mockup is **640px** (spec said 600)
> and every number in it is a **sample** — the gate threshold and the live-data obligation are restated
> (§7). External blockers to the first real send confirmed: event pages 404 (content-engine, §8.1) and
> `news.` verification unproven until a test-send (§14). None block building Phases 1–8.

This is the buildable definition of the Ryan Realty monthly newsletter, end to end. It is written
so an implementation process can build it without re-discovering the codebase. Every requirement
that can be mechanically enforced has a **named gate** in §12 — this spec is contract + enforcement,
not prose. Where a requirement can only be checked at runtime against DB-authored content (voice,
data-accuracy), it is a **runtime pre-send guard**, also enumerated in §12.

> **Scope note:** this document is spec only. No implementation code is written by the spec author.
> The builder executes §13 phase by phase, each phase gated and shipped draft-first.

---

## 0. Locked decisions (Matt)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Per-broker branding | **Full identity swap** — each recipient's copy is branded/signed by their assigned broker (From display-name, reply-to, headshot, phone, signature). Body identical. Ryan Realty anchors the masthead. |
| 2 | Curation | **Marketing-brain producer auto-drafts → Matt reviews/edits in admin → approves → send.** |
| 3 | Enrollment | **Matt manually enrolls** (admin add + bulk-assign from CRM). Public form stays live, secondary. |
| 4 | Subscriber self-service | **Unsubscribe only** (token one-click). No preference center. |
| 5 | Cadence | **Monthly. Drafted on the 1st** (prior month fully closed), reviewed, **first send from the ~3rd**, then **delivered in engagement-tiered tranches over ~5–7 days** (most-engaged first). Recaps the **prior calendar month's closed sales**; promotes **upcoming** local events. (v1.1: C1+C2.) |
| 6 | Reply / sender | Reply-to = assigned broker's real email. Send-from is `newsletter@news.ryan-realty.com` (the verified bulk subdomain, DKIM-aligned). Only display-name + reply-to + signature swap. |
| 7 | Unassigned subscriber | Defaults to **Matt**. Branding follows **live** `crm_people.assigned_broker` (reassigning a lead moves their next issue's branding). |

---

## 1. Current-state ground truth (verified against live code, 2026-07-02)

Three full-code sweeps established exactly what exists. **This supersedes the stale
`docs/fub-feature-audit/deep-dive-newsletters.md` where they conflict.** Corrections to that audit:

- ✅ **Postal address IS wired.** `lib/email-templates/newsletter-shell.ts` imports
  `BROKERAGE_POSTAL_ADDRESS` and renders it in both the HTML footer and `newsletterTextFooter`.
  The audit's "missing postal address / CAN-SPAM violation" is stale. *Real* risk: the constant's
  value must be a real street address (verified by gate **G-NL-1**), not empty/placeholder.
- ✅ **Segment `general` does NOT leak** into targeted sends — already fixed
  (`getActiveSubscribersForSend`, filter applies to `general` too).
- ✅ **Brand-voice gate exists on the bulk send** (`checkNewsletterVoice` in `adminSendNewsletterAction`).
  Gap: the **one-click** contact send skips it (see §11).

### What exists and works
| Layer | Detail |
|---|---|
| Tables | `newsletter_subscribers`, `newsletters`, `newsletter_recipients`, unified `email_events`. |
| Public subscribe | `NewsletterSignup.tsx` → `subscribeNewsletterAction` (footer + LPs). |
| Admin CRUD | list, compose (subject/preview/audience/body_html), edit, delete-draft, send. |
| Admin subscribers | add single, toggle active/unsubscribed, paginated list. |
| Send (bulk) | Resend on `mail.ryan-realty.com`, voice gate, suppression check, RFC 8058 headers, per-recipient row + `crm_timeline`, 5,000 cap. |
| One-click send | "send current newsletter to this contact" from a CRM card. |
| Tracking | HMAC open pixel + click redirect (compliance-link carve-out, no open-redirect), Svix-verified Resend webhook. |
| Events | `email_events` idempotent (unique `dedupe_key`), indexed `(broker, occurred_at)`, `(person_id, occurred_at)`, `(send_type, event)`. |
| Suppression | hard bounce/complaint → `crm_suppressions` + `newsletter_subscribers.status`; chokepoint `isSuppressed`/`isSuppressedByEmail` (fail-closed). |
| Shell | 600px navy/cream, footer w/ postal address + unsubscribe; plain-text footer generator. |
| Brokers | `brokers(slug, display_name, title, bio, photo_url, email, phone)` — identity-swap data is present. |

### What's missing or wrong (the build target)
1. **No per-broker identity swap** — attribution is by *sender* (admin who clicks send), not the
   *recipient's* assigned broker; shell is single-brand (no broker block).
2. **Synchronous in-request send loop** — up to 5,000 sequential `sendEmail` calls in one server
   action; crash mid-loop strands the newsletter in `status='sending'` forever (no reconciler).
3. **No DB-level send lock** — read-then-write status check races (double-send possible).
4. **`newsletter_recipients` open/click counters double-count** on webhook redelivery (no dedupe).
5. **`email.unsubscribed` Resend event unhandled** (named in docstring, absent from `EVENT_MAP`).
6. **One-click send** skips the voice gate, can silently reactivate an unsubscribed contact and
   clobber their segment to `general`, and drops all tracking on send failure.
7. **No plain-text body** authored in admin (`body_text` never set by the compose form).
8. **Admin subscriber filters/search, CSV import/export, bulk-assign-from-CRM UI** — DAL supports
   them; no UI wires them.
9. **No per-broker analytics** — stats are per-newsletter only, never grouped by broker; no
   broker-scoped view.
10. **No scheduling** — `scheduled_at` column exists, no cron; no 1st-of-month automation.
11. **No producer→admin pipe** — the marketing-brain newsletter producer writes HTML offline with
    no path into the `newsletters` table.
12. **Tracking-token secret has no prod hard-fail**; open/click `crm_timeline` inserts are un-deduped
    (uncapped rows); tokens never expire.
13. **Newsletter `From` sends from the wrong domain** (audit A4, 2026-07-03). The live constant
    `NEWSLETTER_FROM` in both `app/actions/newsletter.ts` and `app/actions/contact-newsletter.ts` is
    `newsletter@mail.ryan-realty.com` — the **transactional** domain — not the verified bulk subdomain
    `newsletter@news.ryan-realty.com` (decision #6). Left as-is, a bulk complaint spike sinks
    transactional deliverability, defeating the entire §6.6 stream-isolation setup. One-line fix, folded
    into Phase 3, gated behind a `news.` verification test-send (§14).

---

## 2. Architecture & data flow

```
 CURATE (1st, after prior month closes)          REVIEW (1st–2nd)    SEND (from ~3rd · tranched 5–7d)
 ┌───────────────────────────┐   draft row   ┌──────────────┐   approve   ┌───────────────────────┐
 │ brain producer            │──────────────▶│ admin edits, │────────────▶│ enqueue recipients    │
 │ • prior-month closed sales│  + citations  │ voice+cite   │             │ (broker resolved,     │
 │ • upcoming events         │               │ gates, prev- │             │  status=queued)       │
 │ • featured sale, nbhd     │               │ as-broker    │             └──────────┬────────────┘
 └───────────────────────────┘               └──────────────┘                        │ cron drain
                                                                                      ▼
 REPORT (per broker)          TRACK                                        ┌───────────────────────┐
 ┌───────────────────────┐   ┌──────────────────────────────┐  per-recip  │ render per-broker      │
 │ broker console:       │◀──│ pixel + click + Resend webhook│◀────────────│ shell, From-name+reply │
 │ own leads' opens/     │   │ → email_events + crm_timeline │             │ swap, links stamped w/ │
 │ clicks, warm list     │   │ → suppression on bounce/compl │             │ recipient broker slug  │
 └───────────────────────┘   └──────────────────────────────┘             └───────────────────────┘
```

**Runtime components:** Next.js server actions (admin), 3 cron routes (monthly-curate,
newsletter-send-drain, stuck-send-reconcile), Resend (send + webhook), Supabase (data + `email_events`).

---

## 3. Data model

### 3.1 Existing tables — required changes

**`newsletters`** — add columns:
- `status` extended: `draft | scheduled | sending | sent | failed | canceled`. **Audit (2026-07-03):**
  `status` is plain text with an existing `newsletters_status_check` = `CHECK (status IN ('draft',
  'sending','sent','failed'))` — Phase 1 must **drop + recreate** it with the full set (the table is
  empty, and the running app only writes `sending`/`sent`/`failed`, so the widen can't reject a live row).
- `scheduled_at timestamptz` — already present; will now be honored.
- `send_started_at timestamptz`, `send_finished_at timestamptz` — reliability/observability.
- `citations jsonb` — the verification trace for every figure in the body (see §8).
- `body_text` — already present; must be populated (auto-generated if admin leaves blank, §7).
- `lock_token uuid` — for the compare-and-swap send lock (§6).

**`newsletter_subscribers`** — no structural change required; `crm_person_id` is the broker-resolution
join key. Add:
- `bounced_at / complained_at timestamptz` (observability; status already flips).
- ~~unique index on `lower(email)`~~ **Audit A2 (2026-07-03): already exists** as
  `newsletter_subscribers_email_key` = `UNIQUE (lower(email))`. S-9 is already mitigated at the DB and
  G-NL-14's email-uniqueness half is already satisfied — **do NOT re-create it** (a second, differently
  named index would be a redundant duplicate). This bullet is done; only the timestamps are new.
- Note: `newsletter_subscribers_segment_check` = `CHECK (segment IN ('general','buyer','seller',
  'past-client'))` also already exists, so the segment allowlist is DB-enforced for subscribers (the
  `newsletters.audience` string still needs code validation — G-NL-14 code half).

**`newsletter_recipients`** — add:
- `broker text` — the **recipient's** resolved broker at send time (frozen for this issue).
- `tier smallint` — engagement tier (1 engaged / 2 new / 3 cold) assigned at enqueue; drives which
  day of the tranche this recipient sends (§6.5 rule 2).
- **Audit A1 (2026-07-03) — CRITICAL:** the existing `newsletter_recipients_status_check` =
  `CHECK (status IN ('sent','delivered','opened','clicked','bounced','complained','failed'))` has **no
  `queued`**. The Phase 3 queue enqueues rows as `queued` and marks skipped-at-drain rows `skipped`
  (S-8/S-14). Phase 1 must **drop + recreate** this CHECK adding `queued` + `skipped`, or every enqueue
  is rejected and the queue is dead on arrival. (Done in migration `…100300`.)
- **Audit A5 (2026-07-03):** a `UNIQUE (newsletter_id, lower(email))` index already exists
  (`newsletter_recipients_letter_email_key`), but `recordRecipientSend` upserts
  `onConflict:'newsletter_id,email'` (raw column) which PostgREST **cannot** match to a functional
  index — a latent failure (0 rows today, never exercised). Phase 3's send-path rewrite must target the
  functional index correctly (or add a plain `(newsletter_id, email)` unique on the already-lowercased
  column) so the drain is truly idempotent (S-3).
- Stop trusting `open_count/click_count` as the source of truth; derive them from a new ledger:

**New table `newsletter_recipient_events`** (fixes double-count, edge case T-4):
```
id bigint generated always as identity pk
newsletter_id uuid, subscriber_id uuid, email text
resend_message_id text
broker text                   -- recipient's FROZEN short slug (§5) — engagement-by-broker analytics
event text check (event in ('delivered','open','click','bounce','complaint'))
url text null                 -- for click granularity
occurred_at timestamptz
dedupe_key text unique        -- see Audit A3 below — RECIPIENT-scoped, NOT resend_message_id-scoped
```
`open_count`/`click_count` become **views/derived counts** over this ledger, so a webhook redelivery
can never inflate them.

**Audit A3 (2026-07-03) — the `dedupe_key` formula in v1.1 was broken.** `resend_message_id:event:url`
fails on two counts: (1) our own HMAC **open pixel has no `resend_message_id`**, so every recipient's
open would collapse to the key `":open:"` and only the first open on the whole list is ever recorded;
(2) when both our pixel **and** Resend's `email.opened` webhook report the same open, a message-id key
double-counts. The key must be **recipient-scoped and source-agnostic**:
`nl:<newsletter_id>:sub:<subscriber_id|lower(email)>:<event>:<url>` (`url` empty for non-click events).
That collapses replays AND cross-source duplicates to one row per recipient-per-link-per-event. Phase 5
implements this construction; the schema (`dedupe_key text unique`) is already flexible enough.

**New table `newsletter_send_schedule`** (drives the tranche drain, §6.5/§6):
```
id bigserial pk
newsletter_id uuid
day_index smallint          -- 0..6 (which day of the ~5–7 day tranche)
tier smallint               -- which engagement tier sends on this day
cap int                     -- max recipients to send this day (ramped for warm-up, flat otherwise)
sent_count int default 0
unique (newsletter_id, day_index, tier)
```
The drain sends a `queued` recipient only when its `tier`'s scheduled `day_index` has arrived and the
day's `cap` isn't hit. Warm-up = ramped `cap` curve; steady-state = flat caps.

### 3.2 Producer / scheduling
**New table `newsletter_schedules`** (or reuse `marketing_brain_actions` with
`action_type='content:newsletter'`) — one row per monthly issue: `period` (YYYY-MM the recap covers),
`state` (planned/drafted/approved/sent), `newsletter_id`. The 1st-of-month cron reconciles against
this so a missed run is visible, not silent.

### 3.3 Analytics
No new table needed — `email_events` is already grained `(broker, person_id, send_type, event,
occurred_at)`. Per-broker reporting is a query. Add a `mpp_suspected boolean` (or store UA/first-open
delta in `meta`) on open events so dashboards can separate engaged opens from prefetch opens
(research §2).

All new tables/columns land via `supabase/migrations/*`, then `npm run ci:data-access -- --refresh`
(gate **G16**). Reads go through `lib/data/newsletter/*` (gate **G1/G8**).

---

## 4. Lifecycle & use cases (complete)

Each use case names its actor, trigger, and the guards it must pass.

### 4.1 Curate
- **UC-C1 Monthly auto-draft.** Cron fires **on the 1st (early local AM), after the prior calendar
  month has fully closed** (fixes C2 — a T-3/28th draft would recap a month that hadn't ended). It
  creates a `content:newsletter` action; the producer pulls **prior calendar month** closed-sales
  stats (verified, §8) + 4–8 upcoming events + one featured sale + neighborhood spotlight, writes a
  `newsletters` draft (`status=draft`, `body_html`, `body_text`, `citations`). Matt reviews on the
  1st–2nd; **first send goes out from the ~3rd** (§6.5), so the recap is complete and there's real
  review lead time. Guard: data-accuracy runtime gate (**R-2**) — no draft without a complete
  citations set. (MLS close-data lag: R-2's `fetched_at` + Spark/Supabase reconciliation catch a
  cache that hasn't caught up; if the prior month's closes are still settling on the 1st, the draft
  waits until the cache is current rather than publishing an undercount.)
- **UC-C2 Manual draft.** Admin composes from scratch (compose form). Same downstream gates.

### 4.2 Review & approve
- **UC-R1 Edit.** Admin edits HTML + plain-text, preview text, audience.
- **UC-R2 Preview-as-broker.** Admin renders the exact per-broker shell for Matt/Rebecca/Paul.
- **UC-R3 Test send.** Admin sends a test to their own address (rendered as a chosen broker).
- **UC-R4 Voice + citation check (inline).** Runtime gates **R-1/R-2** run on demand and again at
  send; both must pass to enable Send.
- **UC-R5 Approve/Send or Schedule.** Approve = Matt clicks Send (immediate) or Schedule (sets
  `status=scheduled, scheduled_at`). Nothing sends without this.

### 4.3 Enrollment (Matt-driven)
- **UC-E1 Add single** (exists). **UC-E2 Bulk-assign from CRM** (wire the UI to the existing action;
  add scope + dedup). **UC-E3 CSV import** (new). **UC-E4 Public signup** (exists, secondary).
- Every enrolled subscriber SHOULD link a `crm_person_id` (for broker + analytics). Unmatched →
  created/linked best-effort; unresolved → default Matt at send time.

### 4.4 Send — see §6. Resolves recipients, freezes each recipient's broker, renders per-broker,
drains via cron queue, records ledger + timeline, idempotent + resumable.

### 4.5 Track — see §5/§11. Pixel + click + webhook → `newsletter_recipient_events` + `email_events`
+ `crm_timeline`; suppression on bounce/complaint; `email.unsubscribed` now handled.

### 4.6 Report — see §9.5. Per-broker, scoped to own leads.

### 4.7 Manage (admin + subscriber)
- Admin: status toggle, filters/search, export, view engagement (§9).
- Subscriber: one-click unsubscribe (exists) + honor Resend `email.unsubscribed`.

---

## 5. Per-broker identity swap (core)

**Resolution (per recipient, at send time):** use the **short** broker slug throughout.
`subscriber.crm_person_id → crm_people.assigned_broker` (`matt|rebecca|paul`) via the live/uncached
`resolveLeadAssignedBroker()` (`lib/data/crm/leadAssignedBroker.ts`); null → `matt`. Load that
broker's identity by short slug via `getCrmBrokers()` / `getBrokerBySlug()` (`brokers.crm_slug` is the
short slug; `brokers.slug` is the long profile slug — do **not** confuse them). Freeze the resolved
short slug onto `newsletter_recipients.broker` so post-hoc analytics are stable even if the lead is
later reassigned.

**Swap map:**
| Element | Value | Source |
|---|---|---|
| From display-name | `"{broker.display_name} · Ryan Realty"` | `brokers.display_name` |
| From address | `newsletter@news.ryan-realty.com` (constant — the verified bulk subdomain) | constant (DKIM) |
| Reply-To | `brokers.email` | `brokers` |
| Signature block | headshot + name + title + phone + reply email + signature copy | `brokers.photo_url` (or local file), `display_name`, `title`, `phone`/`twilio_number`, `email`, **`brokers.email_signature`** (column exists as of 2026-07-02, currently unused — consume it here) |
| Link attribution | `?agent={crm_slug}` on every in-body link | `attributeSiteLinks`, short slug |
| Pixel/click token, `newsletter_recipient_events.broker`, `email_events.broker`, `crm_timeline.broker` | short broker slug | resolved slug |

**Identical across recipients:** masthead, all editorial body, market data, featured sale, events,
section CTA copy, footer text, unsubscribe.

**Per-broker beyond the signature swap (Audit A6, 2026-07-03).** The approved mockup's **broker close**
block is first-person Matt-only prose — `"I'm Matt Ryan… call me at 541.213.6706… TALK TO MATT →"`. The
v1.1 swap map only swapped From/reply/signature/links, which would ship Matt's *words* under Rebecca's
or Paul's name. Phase 4 must **template the close per broker**: first-person intro (`I'm {display_name}`),
CTA label (`Talk to {first_name} →`), and the phone number. **Phone decision:** the close is a
lead-capture surface, so it uses the broker's own reachable line — Matt `541.213.6706` (his direct,
brand voice), Rebecca `415.308.9087`, Paul `541.977.6841` (from `brokers.phone`/`twilio_number`); the
FUB-tracked bio line `541.703.3095` is for social profiles, not the newsletter close. `brokers.email_signature`
is **empty for all three today** (verified) — so the close copy is authored per-broker in the shell,
and `email_signature` is consumed only as an override when populated (not a hard dependency).

**Broker on engagement events — BOTH sources (fixes H1).** Per-broker analytics require broker on
opens/clicks, not just sends. There are two engagement sources and **both** must stamp broker:
1. **Our HMAC pixel/token** (`instrumentEmailHtml`): extend the signed token payload from `{p,k,l,u}`
   to include `b` (broker slug); the `/api/track/e/open` + `/click` routes write it to
   `newsletter_recipient_events.broker` and `email_events.broker`.
2. **The Resend webhook** (`email.opened`/`email.clicked`): these arrive keyed only by `message_id`,
   so the webhook handler resolves broker via `message_id → newsletter_recipients.broker` and stamps
   it on the event rows.
Without both, brokers would see sends-by-broker but not engagement-by-broker — the exact thing the
per-broker requirement asks for. Gate **G-NL-5** covers both write paths.

**Shell change:** `wrapNewsletterHtml` gains a `senderBroker` param and renders a signature block
above the footer. **Headshot must be an absolute HTTPS URL** — email clients can't load relative or
app-hosted assets. The DAL today prefers local files at `/images/brokers/*.png` over DB `photo_url`;
for email, prefix the site origin (`https://ryan-realty.com/images/brokers/{slug}.png`) or use an
absolute `photo_url`. Gate **G-NL-8** asserts each active broker resolves to an absolute HTTPS
headshot that is reachable.

**Why:** research §5 — a personal "from your agent" sender lifts opens meaningfully (+3.8% to +50%
across studies). This is the single highest-leverage engagement lever in the build.

---

## 6. Send reliability & queue

**Problem:** the current in-request loop (≤5,000 sequential sends) risks Vercel timeout → strands
`status='sending'`. Per-recipient rendering makes this worse.

**Design (queue + drain):**
1. **Approve** resolves the active audience, resolves+freezes each recipient's broker **and assigns a
   delivery tier** (Tier 1/2/3 by engagement history, §6.5 rule 2), inserts `newsletter_recipients`
   rows with `status='queued'` + `tier`, and writes the per-issue `newsletter_send_schedule` (per-day
   caps + tier→day map; ramped for a warm-up issue, flat otherwise). Newsletter → `sending` via a
   **compare-and-swap**: `UPDATE newsletters SET status='sending', lock_token=$uuid, send_started_at=now()
   WHERE id=$id AND status IN ('draft','scheduled') RETURNING id`. Zero rows returned → someone else
   already started; abort. (Fixes double-send, edge case S-1.)
2. **Cron `/api/cron/newsletter-send`** (every ~1 min while any `sending` newsletter has eligible
   `queued` rows) drains **only rows whose tier's scheduled day has arrived and while under that day's
   `cap`** (so a large issue paces across ~5–7 days, most-engaged first). Batches ≤100/run via the
   Resend Batch API. Each row: re-check suppression **and** subscriber `status='active'` (fixes
   unsubscribe-during-send, edge case S-8), render per-broker, send, write
   `newsletter_recipient_events(sent)` + `crm_timeline`, flip row `queued→sent|failed`.
3. Newsletter flips `sending→sent` when no `queued` rows remain (`sent` if ≥1 sent; `failed` if 0
   sent and ≥1 failed). `send_finished_at` stamped.
4. **Reconciler cron `/api/cron/newsletter-reconcile`** (hourly). A tranched issue **legitimately
   stays `sending` for ~5–7 days** (future-tier rows are still `queued`), so the reconciler does NOT
   finalize on elapsed time alone. It finalizes to `sent`/`failed` **only when no `queued` rows
   remain**. It flags a **stall** (alerts Matt) when there ARE queued rows **whose scheduled tier-day
   has already passed** yet none have sent for N minutes — a real stuck drain, distinct from normal
   waiting for the next day's tranche. (Fixes stranded-`sending`, edge case S-2.)
5. **Idempotent + resumable:** a row is only drained if `status='queued'`; a crash re-runs only the
   remaining queued rows — no duplicate emails (fixes edge case S-3).

Gate **G-NL-9** asserts the CAS lock (conditional update, not read-then-write) and the absence of a
synchronous >N-recipient loop in the request path.

---

## 6.5 Scale, deliverability & first-send ramp (the 18k reality)

**Verified numbers (audit query, 2026-07-02):**
- `newsletter_subscribers`: **3 active** — the list is effectively empty today.
- `crm_people`: **18,210 total · 15,509 with an email · all broker-assigned.**
- `crm_suppressions` (email/all): **3,922** already suppressed.
- **Net mailable base ≈ 11–12k** (15,509 with email − suppressed∩with-email − invalid/role/dup;
  exact number computed in Phase 0).

**Enrollment stays manual (decision #3).** Matt subscribes leads himself (admin add + bulk-assign +
public form). There is **no auto-migration** of the CRM book. The numbers above are **capacity
context**: the addressable universe Matt may hand-enroll over time is ~12k, so the system must be
built to send to **many thousands** correctly — even though the list grows deliberately, not in one
import.

**The load-bearing truth:** throughput is the easy part (the §6 queue handles it). **Deliverability
is the hard part, and a monthly cadence makes it harder, not easier.** A once-a-month 12k blast from
`news.ryan-realty.com` — a subdomain that otherwise sends little — is a **recurring volume spike**
that reads as a spam signal to Gmail/Yahoo *every month*, not just the first. You cannot warm or
sustain reputation with a single monthly blast. Google's hard ceiling is a **0.3% complaint rate**.
So the model below (Matt's decision 2026-07-02) makes each monthly issue a **paced, engagement-tiered
delivery over ~5–7 days**, not a one-day blast — the machinery applies **whenever a send is large**
(threshold configurable, e.g. >1,000 recipients), regardless of how the list was built.

**Rules (each with an enforcing gate):**

1. **List hygiene before any large send (G-NL-16).** At enrollment and again before each large send:
   dedupe on `lower(email)`, drop syntactically invalid + role addresses (`postmaster@`, `no-reply@`,
   `abuse@`, etc.), exclude every suppressed email, and run email verification (MX + known-bounce, via
   Resend or a verification provider). A pre-send guard **refuses** a large send if its list hasn't
   passed hygiene within N days. (Manual enrollment doesn't exempt the list from hygiene — a
   hand-typed or bulk-assigned address can still be dead.)
2. **Engagement-tiered tranche delivery — the steady-state model (G-NL-17).** Every large issue is
   split into **tiers by engagement and delivered over ~5–7 days**, best senders first:
   - **Tier 1 — engaged:** opened or clicked ≥1 of the last 2 issues. Sent **day 1** (they're most
     likely to open + least likely to complain → they set a strong early reputation signal).
   - **Tier 2 — new / no history:** enrolled since the last issue, or never sent to yet. Sent **days
     2–3**.
   - **Tier 3 — cold:** on the list but no engagement in the last K issues. Sent **days 4–7**, and are
     the engagement-sunset candidates (rule 5).
   A per-issue **`newsletter_send_schedule`** (rows: `newsletter_id, day_index, tier, cap`) drives the
   drain; the drain only sends a row whose tier's day has arrived and stays under that day's `cap`.
   **Warm-up is a special case of this schedule:** the *first* large issue (or the first time the
   active list crosses into the thousands) uses **ramped caps** (500 → 1k → 2k → 4k → 8k → full),
   growing to the next day's cap only while bounce/complaint stay healthy (rule 4). After the domain
   is warm, later issues use flat per-day caps sized to the list. So warm-up and the ongoing tranche
   model are the **same mechanism**, just different cap curves.
3. **Pacing within a day.** Within each day's tranche, spread the send across hours via the Resend
   **Batch API** (≤100/call) under the account rate limit and a per-hour cap. (Note: per-broker
   identity swap + per-person tracking tokens make every email unique, so batching is per-entry, not
   payload-grouped — still one API call per ≤100 recipients.)
4. **Live deliverability circuit-breaker + auto-pause (G-NL-18).** Track rolling bounce rate and
   complaint rate from the webhook during a send. **Auto-pause the queue and alert Matt** if bounce
   > 2% or complaint rate > 0.1% within a send (well before Google's 0.3% ceiling). Resume only on
   Matt's ok. This supersedes the simpler K-consecutive-failure breaker in §6/S-4.
5. **Engagement sunset.** Stop sending to addresses with no open/click in K consecutive issues — move
   them to a `dormant` segment (not deleted). Protects reputation and shrinks complaint surface.
   Re-entry allowed if they later engage.
6. **Resend plan + IP (env/config).** Confirm a paid plan covering the expected monthly volume (Pro =
   50k/mo) and that the account rate limit supports the drain throughput; consider a **dedicated IP**
   for sustained bulk (dedicated IPs need their own warm-up). Verify SPF/DKIM/DMARC alignment
   (research §6) before the first large send.

---

## 6.6 Mail infrastructure & sender reputation (authentication + deliverability)

Deliverability = **authentication + reputation + behavior**. Authentication is DNS; reputation is
what mailbox providers think of the domain/IP; behavior is complaints/bounces/engagement (governed by
§6.5). This section locks the DNS + operational setup so CRM mail authenticates and the domain's
reputation is protected and *visible*.

### Current state (updated 2026-07-02 — see §14 for the live progress log)
| Record | Value | Status |
|---|---|---|
| DKIM `resend._domainkey.mail.ryan-realty.com` + `.news.` | RSA public keys published (1024-bit) | ✅ both domains |
| MAIL FROM / Return-Path `send.mail.` + `send.news.` | SPF `include:amazonses.com` + `feedback-smtp` MX | ✅ aligned bounce domain, both |
| DMARC `_dmarc.mail.ryan-realty.com` | `p=none; rua=mailto:matt@` | ✅ monitor-only (staged) |
| DMARC `_dmarc.ryan-realty.com` (root) | `p=none; rua=mailto:matt@; fo=1; sp=none` | ✅ **reporting enabled 2026-07-02** |
| `news.ryan-realty.com` (bulk newsletter) | created in Resend, DNS live, verified | ✅ **provisioned + isolated from `mail.`** |
| Root `ryan-realty.com` | SPF `include:_spf.google.com`, Google Workspace MX | ✅ separate from bulk |

**Takeaway:** authentication is complete on both sending domains, bulk is isolated on the verified
`news.` subdomain, root DMARC reporting is live, and all 3 domains are registered in Postmaster
(§6.7). Remaining, staged: DMARC enforcement progression (below) and a DMARC report parser.

### Target state (the build/setup contract)

1. **Separate sending reputations by stream (recommended at this scale).** Keep **bulk newsletter** on
   its own authenticated subdomain (e.g. `news.ryan-realty.com`) and **transactional CRM mail**
   (one-offs, CMAs, alerts, password resets) on `mail.ryan-realty.com`. A complaint spike on bulk must
   not sink transactional deliverability, and vice versa. Each subdomain gets its own Resend domain +
   SPF/DKIM/DMARC. **Never send bulk as the root `@ryan-realty.com`** (that's Matt's Workspace
   reputation — already correctly avoided). *Decision item — see below; if declined, bulk + txn share
   `mail.` and rule 4's monitoring becomes even more important.*
2. **DMARC enforcement progression (safe, staged — do NOT jump to reject).**
   - **Now:** add `rua` (and `ruf`) to the **root** `_dmarc.ryan-realty.com`; keep `p=none`; point all
     `rua` at a DMARC monitoring service. Add `sp=` to control subdomain policy explicitly.
   - **After 2–4 weeks** of clean aggregate reports (every legitimate source — Resend, Workspace,
     any other tool — passing DMARC alignment): move the **sending subdomain(s)** to `p=quarantine`,
     then to `p=reject`. Tighten the root last. Premature `reject` can blackhole legitimate Workspace
     mail — enforcement only after monitoring confirms alignment.
3. **Reputation visibility (do immediately — free, read-only, high value).**
   - **Google Postmaster Tools** — register `ryan-realty.com` + the sending subdomain(s); monitor
     domain/IP reputation, spam rate, DKIM/DMARC/SPF pass rates, and feedback-loop data directly from
     Gmail. This is how you *see* a reputation problem before it becomes a block.
   - **Yahoo Sender Hub / Microsoft SNDS** — equivalent registration.
   - **DMARC aggregate-report monitor** (Postmark/dmarcian/Valimail free tier) — turns the raw `rua`
     XML into a readable alignment dashboard. Required to safely execute step 2.
4. **Ongoing hygiene of authentication.** DKIM upgraded to **2048-bit** (Resend supports it). Confirm
   Resend feedback-loop / bounce webhooks are wired (they are — §11) so complaints suppress instantly.
5. **Later, after `p=quarantine`+:** publish a **BIMI** record (+ VMC) so the Ryan Realty logo shows
   next to the newsletter in Gmail/Apple Mail — a trust + open-rate lift, and a reason to reach DMARC
   enforcement.
6. **Dedicated IP** only at sustained high volume, with its own warm-up (§6.5 rule 6).

### Gate
**G-NL-19 Mail-auth monitor** — `scripts/check-mail-auth.mjs`, DNS-dependent so it runs **nightly /
locally** (not in the secret-less static chain, like G16). Fails/alerts when: the sending domain's
SPF lacks the `amazonses` include; the DKIM selector doesn't resolve to a public key; DMARC is absent
on root or a sending subdomain, is missing an `rua`, or **regresses** to a weaker policy than the
tracked target; or a record disappears. The target policy per domain is tracked in a small
`docs/mail-auth-baseline.json` so a silent downgrade is caught.

### Draft-first note
DNS records are outward-facing and hard to reverse. Every DNS change (Cloudflare) and every enforcement
step is proposed to Matt and applied on his go-ahead — never flipped autonomously. The safe immediate
wins (Postmaster Tools registration, DMARC monitor, adding `rua` to the root at `p=none`, DKIM 2048)
carry no deliverability risk and can go first; enforcement (`quarantine`→`reject`) waits on monitoring.

---

## 6.7 Google Postmaster Tools — registration + automated reputation gate (optimized)

**Why:** Gmail is the dominant inbox here, and Postmaster Tools is the only place Gmail tells you your
true **domain/IP reputation, user-reported spam rate, and auth pass rates**. Registering is table
stakes; the real value ("optimize their implementation") is pulling that signal **automatically** and
letting **Gmail's own verdict gate the send** — a leading indicator to complement the real-time
bounce/complaint breaker.

**Registered — DONE 2026-07-02** (postmaster.google.com, owner matt@ryan-realty.com), all three
sending identities so Gmail attributes reputation to the exact DKIM `d=` domain:
- `ryan-realty.com` (org/Workspace; verified Sep 2024)
- `mail.ryan-realty.com` (transactional) — added + verified
- `news.ryan-realty.com` (bulk newsletter) — added + verified

Subdomains **auto-verified via the already-verified parent** (no extra TXT). Reputation data populates
once volume flows to Gmail (~hundreds/day) — so ingestion + gating land in **Phase 5b** (first send).
Note: Google sunsets the legacy UI **2025-10-31** and moves to Postmaster **v2**
(`/v2/sender_compliance`) + an updated API — keep the ingestion adapter thin so a v2 swap is one file.

**Automated ingestion architecture (build in Phase 5b):**
1. **Auth** — reuse the Google service account `viewer@ryanrealty.iam.gserviceaccount.com` (Client ID
   ends …399058; project `ryanrealty`) with **domain-wide delegation** impersonating
   `matt@ryan-realty.com` (already configured for other Google APIs). One-time prereqs:
   (a) ✅ **Postmaster Tools API enabled in GCP** (done 2026-07-02).
   (b) ✅ **DWD scopes granted** (done 2026-07-02, after Matt re-authed): appended
   `postmaster.readonly` + `analytics.readonly` + `business.manage` to the SA's delegation entry
   (client id …399058) — **without touching the 15 existing scopes** (gmail.send, drive, youtube.upload,
   ediscovery, etc.), now 18 total. `gmail.readonly` + `calendar.readonly` were already present.
2. **Lib** — `lib/deliverability/postmaster.ts` → `getPostmasterStats(domain, days)` calls
   `gmailpostmastertools.googleapis.com/v1/domains/{d}/trafficStats`, returns per-day
   `{ userReportedSpamRatio, domainReputation (HIGH|MEDIUM|LOW|BAD), ipReputations[],
   spf/dkim/dmarcSuccessRatio, deliveryErrors[] }`.
3. **Storage** — table `deliverability_metrics(domain, metric_date, spam_ratio, domain_reputation,
   ip_reputation_summary, spf_ok, dkim_ok, dmarc_ok, delivery_errors jsonb, fetched_at)`, unique
   `(domain, metric_date)`; DAL in `lib/data/deliverability/`.
4. **Cron** — `/api/cron/postmaster-sync` (daily) upserts the last N days for all 3 domains; registered
   in `vercel.json`.
5. **Admin surface** — a "Deliverability" tile in `admin/console`: per-domain reputation badge +
   30-day spam-rate + auth-pass sparklines; red at reputation ≤ LOW or spam_ratio > 0.10%.
6. **Gate integration (the optimization)** — the pre-send guard (§6.5 rule 4 / G-NL-18) reads the
   latest `deliverability_metrics` for `news.ryan-realty.com`:
   - `domain_reputation ∈ {LOW, BAD}` **or** `spam_ratio > 0.30%` → **block** the bulk send.
   - `domain_reputation = MEDIUM` **or** `spam_ratio > 0.10%` → **warn** + require confirm.
   Together with the live in-send bounce/complaint breaker, this gives both a **leading** (Gmail's
   standing reputation) and a **real-time** (this send) guardrail.
7. **Alerting** — day-over-day reputation drop or spam_ratio breach → `comms:alert` to Matt.

**Gate G-NL-20 (Postmaster reputation gate):** `check-newsletter-sendpaths.mjs` asserts the bulk-send
path consults `deliverability_metrics` before a large send and blocks on LOW/BAD reputation; a unit
test proves the block fires. G-NL-19's nightly `check-mail-auth.mjs` also asserts all 3 domains stay
registered/verified in Postmaster (via the API).

---

## 7. Design & content — LOCKED (Matt approved 2026-07-02)

**Canonical design reference (the visual target, same role as every `ui_kits/` mockup):**
- **Email-safe (what ships):** [`design_system/ryan-realty/ui_kits/newsletter/email.html`](../design_system/ryan-realty/ui_kits/newsletter/email.html) — table-based, inline styles, absolute-HTTPS images, static meter. This is what `newsletter-shell.ts` must render to.
- **Interactive (design-intent):** `ui_kits/newsletter/index.html` — the browser version with motion; email is its graceful-degradation twin.
- A **mockup-parity gate** (per `docs/MECHANICAL_GATES.md`, like every gated route) enforces the built shell matches this reference.

**It must look like ryan-realty.com, not a generic email.** The site is premium editorial: cream
`#faf8f4` + navy `#102742`, **Amboqia display serif** for headlines (email uses Georgia as the
email-safe stand-in; production may bake hero/section headlines as Amboqia **images** for an exact
match), the signature **eyebrow (`• SECTION`) + thin navy rule + faint giant watermark** section
header, big navy serif items, thin rules, and **live data woven into sentences** (the homepage's
"1,831 homes… median $739,000… pending in 19 days" pattern).

**Section order (locked):**
1. **Navy masthead** (Ryan Realty wordmark + issue line) → **full-bleed hero photo** (Old Mill).
2. **The Market** — buyer's/seller's read. An informing headline, live regional figures woven into a
   sentence, a per-city list (city · N for sale · $median) whose **context is the spread**, CTA to
   `/reports` (+ subscribe).
3. **For Sellers** — one informing seller fact, CTA `/lp/seller-home-value`.
4. **For Buyers** — one informing buyer fact, CTA `/buy`.
5. **Worth Reading** — 1–3 housing items linking to real `/blog/*` posts (rule changes, guides).
6. **Community** — one premier community (photo + live active count), CTA `/communities/[slug]`.
7. **This Month in Central Oregon** — 3 events, CTA to `/central-oregon/events/*` pages.
8. **Closing CTA** (navy band) → `/search`. **Footer** with broker line (the per-broker identity) + compliant footer.

Every section **informs** (teaches a real, specific fact); every section **links to a site page**
(the whole issue is a CTA to the site).

**Voice — the brand voice governs every word** ([`marketing_brain_skills/brand-voice/VOICE.md`](../marketing_brain_skills/brand-voice/VOICE.md), enforced by R-1). The Five Laws: show it don't say it, a number beats an adjective, talk to a smart adult (information not reassurance), the category is not a claim, every number live and true. **Every number appears in context** ("$249,000 more house in Redmond than Bend," not "258 active"). Matter-of-fact register, Economist not flyer. No comfort copy.

**Enforced formatting rules — split by where they're actually checkable (fixes H2).** The *shell*
(`newsletter-shell.ts`) is source; the *body* is DB-authored HTML injected at runtime. A static lint
can only see the shell, so body-content rules are **runtime** checks in the render/approve path, not
a static shell lint.

*Static (shell structure) — G-NL-7 static part:*
- Single `<table>` column, **`max-width:640px`** (Audit A7, 2026-07-03: the approved mockup is 640px, not
  600 — the mockup is canonical, so the gate threshold is ≤640); `color-scheme` meta present (dark-mode
  safe); shell body default font ≥16px / line-height 1.4–1.6; masthead + compliant footer present.
- **Absolute HTTPS assets only.** `brokers.photo_url` is stored relative (`/images/brokers/*.png`) — the
  shell must prefix the site origin (all broker headshots verified reachable at
  `https://ryan-realty.com/images/brokers/{ryan-matt.png, stevenson-paul.jpg, peterson-rebecca.jpg}`).

> **Audit A7 (2026-07-03) — every number in the mockup is a SAMPLE, not shippable data.** `1,831 homes`,
> `19 days`, `$739,000`, Tetherow `16 for sale`, and the Bend `BALANCED` / Redmond `BUYER'S` / Sisters
> `SELLER'S` meters are placeholders (the mockup footer says so). None ships as a literal: the Phase 6
> producer computes each live + traces it (R-2), and the **per-city buyer/seller meter derives from live
> months-of-supply per city** against the §0 thresholds (≤4 seller · 4–6 balanced · ≥6 buyer), with the
> arrow position a function of MoS. The mockup encodes the visual language; the data is always live.

*Runtime (rendered body) — G-NL-7 runtime part, runs at approve + at render:*
- **Exactly one primary CTA**, defined concretely as exactly one element carrying the
  `data-nl-cta="primary"` marker (the composer/producer applies it; secondary links must not). This is
  a countable attribute, not a guess at "which button looks primary." That one CTA must render before
  the fold (within the first ~300px of the rendered email); tap target ≥44×44px.
- Every `<img>` in the body has non-empty `alt`; text-to-image ratio ≥ ~60:40 (measured on the
  rendered body, image bytes vs. text length).
- No reliance on background images for legibility.
- Multipart: non-empty HTML **and** non-empty plain text (gate **G-NL-3**).
- Brand-voice + banned-punctuation clean (runtime gate **R-1**).

Both the static and runtime parts ship with tests; the runtime part blocks `approve` if it fails
(same posture as R-1/R-2).

**Success metric = clicks, not opens.** Dashboards lead with CTR/CTOR; opens shown with an MPP
caveat (research §1/§2).

---

## 8. Content research methodology (accuracy)

**The 1st-of-month timing problem:** NAR national releases lag (~2nd week of the following month), so
they cannot supply the just-ended month on the 1st. **Local MLS closed-sales data is the required
prior-month source** — Ryan Realty already has it in Supabase (`market_stats_cache` /
`market_pulse_live` / `listings`), governed by CLAUDE.md §0.

**Data sources for the locked §7 content (all live, all traced):**
- **The Market:** live per-city figures via the DAL (the same source the homepage/`/cities` renders —
  active count, median list, days-to-pending per city), `PropertyType='A'` (SFR). The **context** is
  computed, not asserted: the inter-city spread ("$249,000 more house in Redmond than Bend" = the two
  live medians), pending speed, etc. Where a prior-period comparison is used, it is pulled and traced,
  never estimated.
- **For Sellers / For Buyers:** one informing fact each. Any figure is live + traced; otherwise the
  sentence carries no number (Law 5).
- **Worth Reading:** 1–3 **real published `/blog/*` posts** (verified 200), chosen for relevance to
  the month. Producer confirms each URL + thumbnail resolve before include.
- **Community:** a premier `/communities/[slug]` with its **live active count** from the DAL.
- **Events:** 3 upcoming Central Oregon events, each with `event_date ≥ send_date` and a real
  destination page under `/central-oregon/events/*` (see build note: event pages must exist or the
  link 404s). Gate **R-3** asserts future date + resolvable page.

**Producer rules (runtime gate R-2 enforces):** every **stat token** (§12 R-2 grammar) in `body_html`
maps to a `citations` entry `{figure, source, table, filter, date_window, row_count, value,
fetched_at, query}`; a draft cannot reach `ready` without a complete, fresh citations set; any
prior-period figure reconciles Spark vs Supabase within 1%. Months-of-supply, where used,
= `active/(closed_6mo/6)` and any market verdict matches the thresholds.

---

## 8.1 Content library — upstream dependency (NOT built in the send path)

**Decision (Matt 2026-07-02):** every event, housing-news, evergreen, point-of-interest, and school
link in the newsletter points to an **owned, SEO/LLM-optimized page on ryan-realty.com** — never an
external site, never a page created at send time.

**Content creation is a separate pipeline that runs AHEAD of the newsletter.** The newsletter is a
**curator**: it selects from an already-live, already-indexed content library and links to it. It
never authors a destination page. Rationale: SEO/LLM authority needs crawl runway before traffic
hits; these pages are evergreen and compound (build once, refresh yearly); LLM structure (schema.org)
is real per-page work; and a curator that only links to live pages can never ship a 404.

**Two production modes (see §"How the library gets built"):**
- **Programmatic** (data → one template → N pages, schema per type): schools, points of interest,
  communities, cities. The site already does this for `/cities/[slug]` and `/communities/[slug]`.
- **Editorial** (AI-draft → review → publish): housing news, evergreen guides. The blog producer
  already does this at `/blog/*`.
- **Events** = hybrid: a Central Oregon events dataset (recurring + seasonal) → `Event`-schema
  template + a short editorial blurb → `/central-oregon/events/[slug]`, produced **~2–3 weeks before
  each issue** so pages are crawled/indexed before the send.

**The newsletter's only obligations here:** select live pages, and pass the pre-send gate.

**Gate R-3 (extended):** before an issue can reach `ready`, every linked event/housing/community/POI
page must (a) return **200** and (b) carry the correct **schema.org** type (`Event`, `Article`,
`EducationalOrganization`/`School`, `Place`/`LocalBusiness`). A dead or schema-less link blocks the
send. (Fixes the "link 404s" risk from §8.)

**Build-plan prerequisite:** the **event-page pipeline must exist (or the first month's pages be
seeded) before the first real send** — it's upstream of Phase 6 (curation), not part of it.

---

## 9. Admin UX — full spec (Matt's explicit ask: see sends, enroll, see opens/clicks)

All under `app/admin/(protected)/newsletters/` (design-system components only, per CLAUDE.md).

### 9.1 Newsletters list
- KPIs: Active subscribers, Total subscribers, **all-time** Newsletters sent (fix the 50-cap count),
  30-day avg CTR.
- Columns: Subject, Status (incl. `scheduled`, `canceled`), Audience, Sent by, Sent (n/of), Date,
  **CTR** (for sent). Per-row actions: Open, Duplicate, Cancel (if scheduled), Delete (if draft).
- Real pagination (not a 50-row cap).

### 9.2 Compose / edit
- Fields: Subject, Preview text, Audience, **Body (HTML)**, **Body (plain text)** — new; if left
  blank, auto-generate from HTML at save via the existing `htmlToPlainText` helper
  (`lib/email/prepare.ts`, already used by `prepareDeliverableEmail`) (gate **G-NL-3** guarantees
  non-empty text at send).
- **Live preview pane** (rendered shell) with **Preview-as-broker** switch (Matt/Rebecca/Paul) and
  mobile/desktop toggle.
- **Test-send** to self (choose broker identity).
- **Inline voice + citation panel** — shows R-1/R-2 status; Send disabled until green.
- **Schedule control** — Send now, or Schedule for a date (sets `scheduled`).
- Send confirmation: design-system `<Dialog>` (not `window.confirm`) summarizing audience size +
  broker split ("312 recipients — Matt 180 · Rebecca 90 · Paul 42").

### 9.3 Newsletter detail / stats (per issue)
- **Delivery stats** lead with **Click rate** and **CTOR**; Open rate shown with "MPP-inflated"
  caveat and an "engaged opens" secondary number.
- **Per-broker breakdown** table: broker · recipients · delivered · CTR · CTOR.
- Per-recipient table: recipient, broker, opens, clicks, what they clicked, status.
- **Warm-lead list**: recipients who clicked (or opened-and-engaged) — one click to open the CRM
  card; feeds each broker's follow-up.
- **Resend to non-openers** (optional, later): re-queue only non-engaged, new subject.

### 9.4 Subscribers
- **Wire the existing filters**: status, segment, search (DAL already supports; UI passes them).
- Columns: email, name, segment, status, **assigned broker** (from `crm_person`), source, last sent.
- **Bulk-assign from CRM** UI (wire `adminBulkAssignNewsletterAction`; add broker-scope guard +
  dedup, fix edge cases S-7/S-12).
- **CSV import** (validate emails, dedupe, link crm_person, default segment) and **CSV export**.
- Status toggle keeps working; add bounce/complaint as visible read-only states.

### 9.5 Per-broker analytics (the "viewable by the assigned broker" requirement)
- New tab in `admin/console`. Role gate: `admin_roles.role='broker'` → **only their own slug's
  events**; `superuser` → all brokers with a filter. Enforced at the query layer (scope by
  `email_events.broker` / `newsletter_recipients.broker` = session broker slug) — gate **G-NL-12**
  includes a test that broker A cannot read broker B's rows.
- Views: last issue CTR/CTOR for my leads; my warm list this month; my leads' engagement trend;
  per-contact last-issue engagement (also on the CRM card via `crm_timeline`).
- **Freeze vs live (resolves the M-series ambiguity):** analytics scope by the **frozen**
  `newsletter_recipients.broker` / `email_events.broker` stamped at that issue's send — so a lead
  reassigned *after* an issue went out keeps that issue's opens/clicks with the broker who actually
  sent it (engagement history is stable and never silently migrates between brokers). *Branding*, by
  contrast, follows **live** `crm_people.assigned_broker` (decision #7) and only affects the **next**
  issue. In short: **branding = live at send; analytics = frozen at send.**

---

## 10. Subscriber-facing surfaces
- **Unsubscribe** (exists): token one-click page, POST-only, RFC 8058 header. Keep.
- **Handle Resend `email.unsubscribed`** (new): add to `EVENT_MAP` + `TIMELINE_KIND`; on receipt,
  set `newsletter_subscribers.status='unsubscribed'` and log timeline. (Fixes edge case T-8.)
- No preference center (decision #4).

---

## 11. Complete edge-case matrix (must be handled)

Grouped Send (S), Tracking (T), Subscriber/data (D). Each row states required behavior; gate column
names the enforcing check (§12).

| ID | Edge case | Required handling | Gate |
|----|-----------|-------------------|------|
| S-1 | Concurrent double-send | CAS lock `WHERE status IN (draft,scheduled)`; 0 rows → abort | G-NL-9 |
| S-2 | Crash mid-send strands `sending` | Reconciler cron finalizes + alerts | G-NL-9 |
| S-3 | Partial failure / retry | Queue-drain resumes only `queued` rows; no dup emails | G-NL-9 |
| S-4 | Resend outage mid-batch | Circuit-breaker: after K consecutive failures, pause queue + alert, don't burn the list | G-NL-9 |
| S-5 | Subscriber has no `crm_person_id` | Broker → default Matt; analytics degrade to email-only, not error | R-4 |
| S-6 | Assigned broker changes after send | Broker frozen on `newsletter_recipients.broker` at send | G-NL-5 |
| S-7 | Same email on 2 crm_people | `lower(email)` unique on subscribers; broker = the linked person; ambiguity logged | G-NL-14 |
| S-8 | Unsubscribe during send | Re-check `status='active'` + suppression inside the drain, per row | G-NL-6 |
| S-9 | Concurrent subscribe race | DB unique index on `lower(email)` (atomic upsert) | G-NL-14 |
| S-10 | One-click reactivates unsubscribed / clobbers segment | One-click must NOT resubscribe an `unsubscribed` contact; never overwrite segment | R-1/G-NL-6 |
| S-11 | One-click send failure drops tracking | Record attempt (recipient row + timeline) on failure too, like bulk | G-NL-6 |
| S-12 | Newsletter-assign skips broker scope | Add scope guard to assign/bulk-assign actions | G-NL-12 |
| S-13 | Invalid `audience` segment string | Validate against SEGMENTS allowlist before send | G-NL-14 |
| S-14 | 0 recipients / all suppressed | Clear "no recipients" result, newsletter stays `draft` (not falsely `sent`) | G-NL-9 |
| T-1 | MPP-inflated / false opens | Flag `mpp_suspected`; dashboards lead with clicks; never lead-score on open alone | R-5 |
| T-2 | Webhook redelivery double-counts | Counts derived from `newsletter_recipient_events` (unique dedupe_key) | G-NL-10 |
| T-3 | Second distinct link click dropped | Click dedupe key includes URL | G-NL-10 |
| T-4 | Un-deduped `crm_timeline` open rows | Open/click timeline inserts carry a dedupe_key | G-NL-10 |
| T-5 | Tampered/expired click token | Verify HMAC; add TTL/nonce; invalid → redirect home, no write | G-NL-11 |
| T-6 | Tracking secret unset in prod | Hard-fail in prod if no real secret (match webhook posture) | G-NL-11 |
| T-7 | Unknown recipient email | `email_events` row with `person_id=null`, re-linkable; never dropped | (existing) |
| T-8 | Resend `email.unsubscribed` unhandled | Add to EVENT_MAP → set status + timeline | G-NL-13 |
| T-9 | Ambiguous email (2+ people) for event | `email_events` fail-closed `person_id=null`; timeline to each (existing) | (existing) |
| D-1 | Bounce not reflected in subscriber list | `status` flips + `bounced_at` set (exists; verify) | G-NL-1 |
| D-2 | Soft-deleted person still tracked | Skip soft-deleted `crm_people` in resolution | R-4 |
| S-15 | Tranche spans days → a `sending` issue looks stuck | Reconciler finalizes only when 0 `queued` rows; stall = queued rows past their tier-day, no send in N min | G-NL-9 |
| S-16 | First large send has no Postmaster reputation data | G-NL-20 no-data branch defers to the warm-up ramp (not block, not full-blast) | G-NL-20 |
| S-17 | Lead reassigned between send and open | Engagement stays with the frozen `recipients.broker`; only the next issue re-brands to the new broker (§9.5) | G-NL-5 |

---

## 12. Mechanical gates (the enforcement — this is not prose)

Two classes. **Static gates** (`scripts/check-newsletter-*.mjs`, wired into `ci:gates`, fail the
build) enforce code/structure. **Runtime gates** (pre-send/approve guards in the send path) enforce
DB-authored content that static analysis can't see. Both are mandatory; the builder wires each and
adds it to the `ci:gates-wired` meta-gate + a baseline where applicable (pattern:
`docs/MECHANICAL_GATES.md`). A phase is not done until its gates are green in CI.

### Static gates (CI)
| Gate | Script | Fails the build when… |
|------|--------|-----------------------|
| **G-NL-1** Compliance constants | `check-newsletter-compliance.mjs` | `BROKERAGE_POSTAL_ADDRESS` is empty/placeholder or lacks a street-number pattern; shell omits postal address or unsubscribe link. |
| **G-NL-2** One-click unsubscribe headers | same | any newsletter `sendEmail` call omits `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. |
| **G-NL-3** Multipart | same | a newsletter send can dispatch with empty/whitespace `text`; compose lacks a body_text path (field or auto-gen). |
| **G-NL-4** Voice gate on every send path | `check-newsletter-sendpaths.mjs` | any function calling `sendEmail` with a `newsletter:*` emailKey does not first call the voice pre-check. |
| **G-NL-5** Recipient-broker attribution | same | the render/attribution uses the sender's slug instead of the recipient's frozen `newsletter_recipients.broker`. |
| **G-NL-6** Suppression + active re-check in drain | same | the drain path sends without re-checking suppression AND subscriber `status='active'`; one-click resubscribes an `unsubscribed` contact or overwrites segment. |
| **G-NL-7** Formatting (split) | `check-newsletter-format.mjs` (static: shell) **+ runtime approve-guard + test** | *Static:* shell isn't single-column ≤600px, missing `color-scheme` meta, or default font <16px. *Runtime (on rendered body):* not exactly one `data-nl-cta="primary"` element, that CTA not above the fold, a body `<img>` without `alt`, or text-to-image ratio <60:40. Body rules can't be statically linted (DB content) — they run in the approve guard like R-1. (§7, fixes H2) |
| **G-NL-8** Broker identity assets | `check-broker-identity.mjs` | any active broker's `photo_url` isn't absolute HTTPS (build-time) / unreachable (nightly). |
| **G-NL-9** Send lock + no sync mega-loop | `check-newsletter-sendpaths.mjs` | status transition is read-then-write instead of a conditional CAS update; a synchronous loop sends to >N recipients in-request; no reconciler cron registered. |
| **G-NL-10** Event idempotency | `check-newsletter-events.mjs` | counts read from `newsletter_recipients` counters instead of the deduped ledger; ledger/timeline inserts lack a URL-inclusive `dedupe_key` + unique index. |
| **G-NL-11** Tracking-token hardening | `check-email-tracking.mjs` | token secret has no prod hard-fail; tokens carry no TTL/nonce. |
| **G-NL-12** Analytics scope | `check-newsletter-scope.mjs` + test | broker-role query is not scoped to the session broker slug; assign actions skip the scope guard. Includes a test that broker A can't read broker B's rows. |
| **G-NL-13** Webhook event coverage | `check-newsletter-events.mjs` | `EVENT_MAP` omits `email.unsubscribed` (or any Resend event the docstring claims). |
| **G-NL-14** Segment allowlist + email uniqueness | `check-newsletter-schema.mjs` | audience segment not validated against SEGMENTS; no `unique(lower(email))` on subscribers. |
| **G-NL-15** Cron registration | reuse gate-wired pattern | monthly-curate / send-drain / reconcile crons not registered in `vercel.json`. |
| **G-NL-16** List hygiene pre-send | `check-newsletter-hygiene.mjs` + runtime guard | a bulk send is dispatched to a list that hasn't passed hygiene (suppressed removed, invalid/role removed, verification run) within N days. |
| **G-NL-17** Warm-up ramp honored | `check-newsletter-sendpaths.mjs` + runtime guard | the send-drain doesn't read a per-day cap from the warm-up schedule, or a send exceeds the day's cap. |
| **G-NL-18** Deliverability circuit-breaker | `check-newsletter-sendpaths.mjs` + test | the drain has no rolling bounce/complaint monitor, or doesn't auto-pause at bounce >2% / complaint >0.1%. Test proves the pause fires. |
| **G-NL-19** Mail-auth monitor (nightly, DNS) | `check-mail-auth.mjs` + `docs/mail-auth-baseline.json` | sending-domain SPF lacks `amazonses` include; DKIM selector doesn't resolve; DMARC absent/missing-`rua` on root or sending subdomain, or **regresses** below the tracked target policy; a record disappears; a sending domain drops out of Postmaster Tools. (§6.6/§6.7) |
| **G-NL-20** Postmaster reputation gate | `check-newsletter-sendpaths.mjs` + test | the bulk-send path doesn't consult `deliverability_metrics` (Postmaster) before a large send, or doesn't block on LOW/BAD Gmail reputation / spam_ratio > 0.30%. **No-data branch (fixes M2):** on the first sends there is no Postmaster data yet (it only populates after volume flows) — `no rows` must **defer to the warm-up ramp** (§6.5 rule 2), not block and not silently allow-at-full-volume. Test proves both the block *and* the no-data→warm-up path. (§6.7) |
| **G16 / G1 / G8** (existing) | data-access / DAL boundary / page-DAL | new tables not in schema snapshot; raw `.from()` outside `lib/data`; page not importing `@/lib/data`. |

### Runtime gates (pre-send / approve guards — enforced in code, tested)
| Gate | Enforced in | Blocks when… |
|------|-------------|--------------|
| **R-1** Voice + banned punctuation | approve + send | body/subject contains a hard-fail (em-dash, semicolon, banned word). Newsletter body is DB content, so this runs at runtime, not static CI. |
| **R-2** Data-accuracy / citations | producer + approve | any **stat token** in the body lacks a citation with fresh `fetched_at`; Spark vs Supabase delta >1%; MoS verdict mismatches thresholds. **"Stat token" is a defined grammar (fixes M1), not "any number":** currency (`$1,234,000`), percent (`↑ 2.1%`), DOM/day counts (`38 days`), months-of-supply (`4.3 months`), and explicitly-labeled counts (`188 sales`, `142 active`). Excluded: prose numerals, bed/bath counts inside a listing blurb, the events count, phone/address digits. The producer emits each stat wrapped `data-nl-stat="<citation_id>"`, so matching is exact, not a regex guess. |
| **R-3** Events freshness | producer + approve | any listed event lacks a future date or a source URL. |
| **R-4** Broker resolution safety | send drain | resolution errors instead of defaulting to Matt; soft-deleted person not skipped. |
| **R-5** MPP open handling | webhook/open | an open is lead-scored without a corroborating click; `mpp_suspected` not flagged. |

Each runtime gate ships with a unit test proving the block fires; those tests run in `ci:test`
(making the runtime guard itself gate-enforced).

---

## 13. Build plan (phased — for the implementation process)

Each phase: build → wire its gates → verify in a real browser → show Matt → commit on sign-off.
Draft-first; no production send without Matt's per-issue approval.

| Phase | Deliverable | Gates that must go green |
|-------|-------------|--------------------------|
| **0** | Verify-and-delta pass (read-only): confirm this spec vs live code, produce the exact diff. Confirm `BROKERAGE_POSTAL_ADDRESS` value. **Verify Rebecca + Paul have `admin_roles` rows (`role='broker'`, `broker_id`→`crm_slug`) so per-broker analytics is reachable (M4).** | — |
| **1** | Schema: `newsletter_recipient_events` ledger (+`broker`, recipient-scoped `dedupe_key` A3), `newsletters` new cols + **widen `newsletters_status_check`** (A2), `newsletter_recipients.broker` + `tier` + **widen `newsletter_recipients_status_check` to add `queued`/`skipped` (A1 — else the queue is DOA)**, `newsletter_send_schedule`, subscribers `bounced_at`/`complained_at` (the `unique(lower(email))` **already exists** — A2, don't re-add). Refresh snapshot. **Migrations drafted 2026-07-03: `supabase/migrations/20260703100000..100400`.** | G16, G-NL-14 |
| **2** | Compliance + format hardening: verify postal address, multipart (auto-gen plain text), shell static lint, tracking-token TTL + prod secret hard-fail, de-dup timeline inserts. | G-NL-1/2/3/7-static/11, G-NL-10 (timeline part) |
| **3** | **Send reliability (build the queue BEFORE the swap — fixes M3):** CAS lock, tier-aware queue + drain cron, tranche-aware reconciler, circuit-breaker, one-click parity (voice, tracking-on-failure, no reactivation). **Also (audit): flip `NEWSLETTER_FROM` `mail.`→`news.` (A4, gated behind the §14 verification test-send), and fix `recordRecipientSend` onConflict to target the functional `(newsletter_id, lower(email))` index (A5).** | G-NL-4/6/9, G-NL-15 |
| **4** | **Per-broker identity swap (built INTO the drain from P3):** shell rebuilt to the approved 640px `email.html` (mockup-parity), **per-broker close paragraph + phone templated (A6)**, absolute-HTTPS headshot prefix, recipient-broker resolution + freeze, From-name/reply/link/token stamping, **broker on BOTH engagement paths — pixel/token payload + Resend-webhook `message_id`→`recipients.broker` (H1)**, G-NL-7 runtime body checks, Preview-as-broker + test-send. | G-NL-5/7-runtime/8, R-4 |
| **5** | Event integrity: derive counts from ledger, **recipient-scoped source-agnostic `dedupe_key` (A3 — NOT the v1.1 `message_id:event:url` formula)**, URL-inclusive click dedupe, `email.unsubscribed` handling, MPP flagging. | G-NL-10/13, R-5 |
| **5b** | **Scale readiness (gates the first large send):** email verification at enrollment + pre-send hygiene, warm-up schedule + ramp-aware drain, deliverability circuit-breaker + auto-pause, engagement sunset, DMARC/plan verification. (No auto-migration — enrollment stays manual per §5.) | G-NL-16/17/18 |
| **6** | Curation pipe + scheduling: producer → `newsletters` draft, citations, monthly cron, `scheduled_at` honored, R-2/R-3. | R-2/R-3, G-NL-15 |
| **7** | Admin UX: list (all-time count, CTR, pagination, per-row actions), compose (plain-text, preview-as-broker, test-send, voice/cite panel, schedule, Dialog confirm), subscribers (filters/search/import/export/bulk-assign+scope), detail (CTR/CTOR lead, per-broker breakdown, warm list). | G-NL-12, R-1 |
| **8** | Per-broker analytics console (scoped to own leads) + broker warm-list. | G-NL-12 |

---

## 14. Environment / config / secrets checklist

**Mail-infra progress (2026-07-02):**
- ✅ **Root DMARC reporting enabled** — `_dmarc.ryan-realty.com` set to
  `v=DMARC1; p=none; rua=mailto:matt@ryan-realty.com; fo=1; sp=none` (via Cloudflare dash API,
  zone `e0e91042…`, account `edc82400…`). Aggregate reports now flow to matt@. **TODO:** point `rua`
  at a parser (Cloudflare DMARC Management or a free monitor) so it's not raw XML; add a Gmail filter.
- ✅ Confirmed live: DKIM published, custom Return-Path `send.mail.ryan-realty.com` (SPF + feedback MX),
  sub-domain DMARC with rua. Cloudflare + Resend + Google all logged in on the mac-mini browser.
- ✅ **`news.ryan-realty.com` provisioned** (Resend, us-east-1, Pro plan; domain id `4e246fd2…`).
  3 DNS records written to Cloudflare + confirmed resolving: TXT `resend._domainkey.news` (DKIM,
  1024-bit — Resend default, no 2048 toggle in UI), TXT `send.news` (SPF `include:amazonses.com`),
  MX `send.news` (`feedback-smtp.us-east-1.amazonses.com`). DMARC already covered by the root record.
  Resend verification was "Pending" at hand-off (records are live+correct; auto-verifies).
  **Audit re-confirmed 2026-07-03:** all three `news.` records still resolve (DKIM public key live, SPF
  `include:amazonses.com`, MX `feedback-smtp`), so Resend has near-certainly auto-verified. **But the
  prod `RESEND_API_KEY` is send-only and cannot query domain status, so verification is not *proven*.
  Hard gate on the `NEWSLETTER_FROM` `mail.`→`news.` flip (A4/Phase 3): a single test-send from
  `news.` to matt@ must land (Gmail: DKIM `d=news.ryan-realty.com`, no auth warning) BEFORE the flip
  ships.** The existing `scripts/_send-newsletter-test.mjs` already sends from `news.` with a `mail.`
  fallback — that is the verification instrument. Do not flip the constant until that send is confirmed.
- ✅ **Google Postmaster Tools — all 3 sending domains registered + verified** (ryan-realty.com,
  mail.ryan-realty.com, news.ryan-realty.com) under matt@. Subdomains auto-verified via the verified
  parent. Automated ingestion + reputation gate architected in §6.7 (build Phase 5b; needs Postmaster
  API enabled + `postmaster.readonly` DWD scope — external one-time).
- ⏳ **Still pending (safe, no traffic yet):** Yahoo Sender Hub registration; DMARC parser (Cloudflare
  DMARC Management) so reports aren't raw XML. DKIM 2048 not exposed by Resend — leaving at 1024
  (matches `mail.`; acceptable).
- **Newsletter `From` becomes `newsletter@news.ryan-realty.com`** once the subdomain verifies (bulk),
  keeping `mail.ryan-realty.com` for transactional CRM mail (decision 2026-07-02).


- `RESEND_API_KEY`, `RESEND_FROM` (prod), `RESEND_WEBHOOK_SECRET` (prod hard-fail — exists).
- `EMAIL_TRACKING_SECRET` — **set a real value in prod** (remove the insecure fallback; G-NL-11).
- `BROKERAGE_POSTAL_ADDRESS` — code fallback is a real address (`Ryan Realty, 115 NW Oregon Ave #2,
  Bend, OR 97703`); **set the env var explicitly in prod** rather than relying on the fallback (G-NL-1).
- DNS: SPF + DKIM + DMARC (`p=none` min) aligned for `mail.ryan-realty.com` (research §6). Verify
  DMARC record exists; monitor complaint rate (<0.1% target, 0.3% hard ceiling).
- **Resend plan — HARD BLOCKER (verified 2026-07-02): the account is on the FREE plan** = 1 domain,
  **100 emails/day / 3,000/mo cap**. This cannot send a newsletter to thousands, and blocks adding the
  `news.` subdomain (free = 1 domain). **Requires Resend Pro ($20/mo: 10 domains, 50k/mo, no daily
  limit).** Upgrading is a purchase Matt must make (payment). Until then, the entire bulk send path is
  non-functional — this is the critical-path dependency for the whole feature. (§6.5)
- **Email verification** provider/credentials wired for the hygiene pass (G-NL-16).
- Cron auth secret for the 3 new cron routes; register in `vercel.json`.
- `brokers.photo_url` for all three brokers = absolute HTTPS (G-NL-8).

---

## 15. Open items (non-blocking, default assumed)
- Keep 4 segments (general/buyer/seller/past-client) despite manual enrollment — assumed **yes**
  (targeting is free).
- Circuit-breaker threshold K and drain batch size N — builder picks sane defaults (K=5, N=100),
  documents them.
- "Resend to non-openers" — deferred to a later phase (listed, not built in phase 7).
</content>
