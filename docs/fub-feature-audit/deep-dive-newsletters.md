# Newsletter Pipeline Deep Dive

**Date:** 2026-06-26
**Scope:** Read-only investigation of the full newsletter pipeline — admin UI, server actions, DAL, email templates, webhook handling, subscriber management, brand-voice gating, and cron configuration.

---

## 1. Full Pipeline Trace

### 1.1 Database schema (3 tables)

**`public.newsletter_subscribers`** — the opt-in list
- Core columns: `id uuid`, `email text NOT NULL`, `name text NULL`, `status text DEFAULT 'active'`, `segment text DEFAULT 'general'`, `source text NULL`, `crm_person_id bigint NULL`, `fub_person_id bigint NULL`, `unsubscribe_token uuid DEFAULT gen_random_uuid()`, `last_sent_at timestamptz NULL`
- Status enum (enforced in code, not DB constraint): `active | unsubscribed | bounced | complained`
- Segment enum: `general | buyer | seller | past-client`
- No DB-level unique constraint visible on `email` in the snapshot — upsert is done in code via `.ilike('email', email)` lookup, then update or insert. Source: `lib/data/newsletter/index.ts:74-101`

**`public.newsletters`** — one row per managed send / draft
- Columns: `id uuid`, `subject text`, `preview_text text NULL`, `body_html text NULL`, `body_text text NULL`, `status text DEFAULT 'draft'`, `audience text DEFAULT 'all'`, `recipient_count int DEFAULT 0`, `sent_count int`, `failed_count int`, `created_by text NULL`, `sent_by text NULL`, `scheduled_at timestamptz NULL`, `sent_at timestamptz NULL`
- Status flow in code: `draft -> sending -> sent | failed`

**`public.newsletter_recipients`** — one row per (newsletter, recipient) pair
- Columns: `id uuid`, `newsletter_id uuid`, `subscriber_id uuid NULL`, `email text`, `resend_message_id text NULL`, `status text DEFAULT 'sent'`, `open_count int DEFAULT 0`, `first_opened_at timestamptz NULL`, `last_opened_at timestamptz NULL`, `click_count int`, `first_clicked_at timestamptz NULL`, `last_clicked_at timestamptz NULL`, `clicked_links jsonb DEFAULT '[]'`
- Upsert on `(newsletter_id, email)`: `lib/data/newsletter/index.ts:261-272`

Migration files: `supabase/migrations/20260615120000_newsletter_feature.sql`, `20260615140000_newsletter_tracking.sql`, `20260625170500_crm_newsletter_segments.sql`, `20260625120000_email_events_unified_store.sql`

---

### 1.2 Admin UI layer

**`app/admin/(protected)/newsletters/page.tsx`**
- Lists all newsletters (up to 50), shows KPI strip (active subscribers, total subscribers, newsletters sent). Calls `listNewsletters(50)` and `newsletterSubscriberCounts()` from DAL. Access gated via `getCrmAccess()`.

**`app/admin/(protected)/newsletters/new/page.tsx`**
- Renders `<NewsletterComposeForm />` with no initial data (create mode).

**`app/admin/(protected)/newsletters/[id]/page.tsx`**
- Detail page. If `status === 'draft'`: shows compose form + `<NewsletterDraftActions>` (send now / delete). If sent: loads `getNewsletterStats(id)` + `getNewsletterRecipients(id, { limit: 500 })` and renders delivery stats KPIs (delivery rate, open rate, click rate) and per-recipient table.

**`app/admin/(protected)/newsletters/subscribers/page.tsx`**
- Paginated subscriber list (50/page). Shows `AddSubscriberForm` and per-row `SubscriberStatusToggle`. Calls `newsletterSubscriberCounts()` + `listNewsletterSubscribers({ page, pageSize: 50 })`.

**`app/admin/(protected)/newsletters/NewsletterComposeForm.tsx`** (client component)
- Controlled form: subject, preview text, audience select, body textarea (HTML or plain text). Calls `adminCreateNewsletterAction` (new) or `adminUpdateNewsletterAction` (edit) from `app/actions/newsletter`.

**`app/admin/(protected)/newsletters/NewsletterDraftActions.tsx`** (client component)
- "Send now" button — asks `window.confirm`, then calls `adminSendNewsletterAction(id)`. "Delete draft" button calls `adminDeleteNewsletterAction(id)`.

**`app/admin/(protected)/newsletters/SubscriberForms.tsx`** (client component)
- `AddSubscriberForm`: email + name + segment → calls `adminAddSubscriberAction`.
- `SubscriberStatusToggle`: toggle active/unsubscribed per row → calls `adminSetSubscriberStatusAction`.

---

### 1.3 Server actions (`app/actions/newsletter.ts`)

**`subscribeNewsletterAction(formData)`** — Public (no auth). Called from `<NewsletterSignup>` in `components/site/NewsletterSignup.tsx`. Source field defaults to `'site'`; segment defaults to `'general'` (no segment picker on the public form).

**`adminAddSubscriberAction(formData)`** — Admin-gated. Resolves email + segment, calls `subscribeToNewsletter()` with `source: 'admin'`.

**`adminAssignCrmPersonAction(personId, segment?)`** — Admin-gated. Resolves person's primary email from `crm_people`, calls `subscribeToNewsletter()` with `source: 'crm-assign'`.

**`adminBulkAssignNewsletterAction(personIds[], segment?)`** — Loops up to 2,000 person IDs, resolves each email, subscribes each. Source: lines 87-99.

**`adminCreateNewsletterAction(formData)`** — Creates a draft via `createNewsletterDraft()`.

**`adminUpdateNewsletterAction(id, formData)`** — Updates draft fields.

**`adminDeleteNewsletterAction(id)`** — Calls `deleteNewsletterDraft()` (only works when `status = 'draft'`).

**`adminSendNewsletterAction(id)`** — The compliance-gated send path (lines 200-262):
1. Auth gate (`getCrmAccess()`).
2. Loads the `newsletters` row; rejects if already sent/sending or body is empty.
3. Resolves audience (`all` or `segment:<slug>`), pulls active subscribers with `getActiveSubscribersForSend({ segment })`.
4. Stamps `status: 'sending'`, `recipient_count`, `sent_by`.
5. For each recipient: checks suppression (`isSuppressed` or `isSuppressedByEmail`); builds unsub URL from `unsubscribe_token`; wraps HTML via `wrapNewsletterHtml()`; attributes outbound links via `attributeOutbound()` (adds `?agent=<broker_slug>` to all site links); appends plain-text footer via `newsletterTextFooter()`; sends via `sendEmail()` with `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
6. Calls `recordRecipientSend()` per recipient.
7. Stamps `last_sent_at` on sent subscriber rows, marks newsletter `sent | failed`.

---

### 1.4 DAL (`lib/data/newsletter/index.ts`)

All functions use the service-role Supabase client (RLS on, no anon access).

Key functions:
- `subscribeToNewsletter()` — upserts by `ilike('email', email)`; reactivates if previously unsubscribed.
- `unsubscribeNewsletterByToken(token)` — flips status to `unsubscribed` by `unsubscribe_token`. Called from the unsubscribe confirm page.
- `getActiveSubscribersForSend()` — `status = 'active'`, optional segment filter (when segment is `'general'`, filter is skipped — general subscribers receive all newsletters). Hard limit: `min(10000, 5000)`.
- `recordRecipientSend()` — upserts on `(newsletter_id, email)`.
- `recordNewsletterEvent()` — applied by the Resend webhook. Advances status rank (never regresses), increments `open_count`/`click_count`, appends `clicked_links`.
- `getNewsletterStats()` — 5 parallel count queries against `newsletter_recipients`; derives delivery rate, open rate, click rate. Source: lines 322-347.

---

### 1.5 Email template (`lib/email-templates/newsletter-shell.ts`)

`wrapNewsletterHtml()` wraps the admin-authored `body_html` in a table-based layout:
- Hidden preheader `<div>` for preview text (escaped via `escapeHtml()`).
- Navy `#102742` header bar with "RYAN REALTY" wordmark in text (not the logo image asset — see gaps section).
- Cream `#faf8f4` background, white content card, 600px max-width.
- CAN-SPAM footer: "Ryan Realty · Bend, Oregon · ryan-realty.com" + unsubscribe link.

`newsletterTextFooter(url)` appends the plain-text footer: `Ryan Realty · Bend, Oregon · ryan-realty.com\nUnsubscribe: <url>`.

Critical gap: the CAN-SPAM footer says `Bend, Oregon` but omits a street address. The `BROKERAGE_POSTAL_ADDRESS` env var used in `lib/email/prepare.ts` is NOT used in the newsletter shell. The newsletter shell hard-codes only `Bend, Oregon`, which fails the postal address requirement.

---

### 1.6 Resend integration (`lib/resend.ts`)

`sendEmail()`:
- Refuses sandbox sender in production: if `RESEND_FROM` is not set and `NODE_ENV === 'production'`, returns an error. Source: lines 17-21.
- `from` override per send: newsletters use `'Ryan Realty <newsletter@mail.ryan-realty.com>'` (hard-coded in `app/actions/newsletter.ts:26`).
- Passes `headers` dict to Resend (List-Unsubscribe headers).
- Returns `{ id }` on success, `{ error: message }` on failure.

The `RESEND_FROM` env var maps to `noreply@mail.ryan-realty.com` per the memory reference. Newsletter sends override this with `newsletter@mail.ryan-realty.com`.

---

### 1.7 Webhook handler (`app/api/webhooks/resend/route.ts`)

POST endpoint, verified via Svix HMAC signature (`verifySvixSignature` + `isFreshTimestamp`). Requires `RESEND_WEBHOOK_SECRET` in production.

Events handled: `delivered`, `opened`, `clicked`, `bounced`, `complained`.

On each event:
1. `recordNewsletterEvent()` — updates `newsletter_recipients` row matched by `resend_message_id`.
2. `recordEmailEvent()` — writes to the unified `email_events` store (deduped by messageId+event+email).
3. For each matched `crm_people` row (via `getPersonIdsByEmail`): upserts a `crm_timeline` row with `dedupe_key` so opens/clicks show once on the contact record.
4. On `bounced` or `complained` with `suppressEmail = true`: calls `addSuppression()` for the email channel on all matched CRM people. This blocks future sends automatically.

---

### 1.8 Public-facing subscriber entry points

**Site footer signup:** `components/site/NewsletterSignup.tsx` → `subscribeNewsletterAction`. No segment picker — all subscribers land as `segment: 'general'`, `source: 'site-footer'` (or overridden by the `source` prop).

**Unsubscribe page:** `app/newsletter/unsubscribe/page.tsx`. Token-confirmed (POST, not GET), redirects to `?done=1` on success. No auth required — the token is the credential. Compliant with RFC 8058 (one-click by design).

**CRM one-click send:** `app/actions/contact-newsletter.ts` → `sendNewsletterToContactAction(personId)`. Resolves the "current" newsletter (latest sent, falling back to latest draft with body). Instruments HTML with open/click tracking pixel (`instrumentEmailHtml`) — this tracking is present here but absent in the bulk send path (see gap below).

**Segment management:** `app/actions/crm-newsletter-segments.ts` wraps a config-table factory for `crm_newsletter_segments`. Supports create/rename/reorder/setActive/delete (with subscriber reassignment on delete).

---

### 1.9 Brand-voice gate scope

`scripts/check-brand-voice.mjs` scans `app/` and `components/` but explicitly excludes `app/admin/` and `app/actions/` (lines 196-211). The newsletter admin UI (`app/admin/(protected)/newsletters/`) is excluded from the gate scan — brand-voice is not CI-enforced on admin-authored newsletter body content. The public `app/newsletter/unsubscribe/page.tsx` is in scope.

The `deliverability.ts` analyzer (called by `prepareDeliverableEmail`) is NOT invoked in the bulk newsletter send path (`adminSendNewsletterAction`). The deliverability analysis is used by `lib/email/prepare.ts` for CRM sequence/drip sends but not for the newsletter action. Source: confirmed by searching `newsletter.ts` for `prepareDeliverableEmail` — not present.

---

### 1.10 Scheduled-send field

The `newsletters` table has `scheduled_at timestamptz NULL` and the `updateNewsletter()` DAL function accepts it. However, the admin send action (`adminSendNewsletterAction`) does not honor this field — it sends immediately on button click. No cron in `vercel.json` polls for due newsletter rows. The `crm-scheduled-sends` cron handles `crm_scheduled_sends` (CRM cohort emails), not the newsletter table. The `scheduled_at` column is orphaned infrastructure.

---

### 1.11 Marketing brain producer

A `newsletter` producer is registered in `marketing_brain_skills/producers/REGISTRY.md` at `social_media_skills/newsletter/SKILL.md`. The SKILL.md describes a monthly content-generation workflow (market snapshot, featured listing, neighborhood spotlight, community event). It does not use the admin UI pipeline — it produces an HTML draft for Matt to copy into the compose form, or in theory could fire via the `ops-email-send` producer. The producer is labeled "Phase 10 smoke-test producer." No evidence it has ever sent a real newsletter through the system.

---

## 2. Best-Practice Assessment

### 2.1 Deliverability (SPF/DKIM/DMARC)

The sending domain is `mail.ryan-realty.com`. Per the memory entry (reference_resend_email_setup.md), the domain is verified with Resend (us-east-1). Resend handles DKIM automatically for verified custom domains. SPF is configured by Resend's DNS records when the domain is verified.

Gap: No code-level check that the domain is currently verified before a bulk send. No monitoring of domain health or bounce rates post-send (beyond per-newsletter stats). No DMARC policy enforcement is visible in this repo; DMARC must be set in DNS externally.

### 2.2 List hygiene and bounce handling

Solid: hard bounces and spam complaints via the Resend webhook immediately trigger `addSuppression()`, which blocks all future email sends to that person's CRM record. Status on `newsletter_subscribers` reflects `bounced` or `complained` through the webhook → `recordNewsletterEvent()` path that advances `status`.

Gap: The webhook advances `newsletter_recipients.status` on bounce/complaint, but does NOT update `newsletter_subscribers.status` to `bounced` or `complained`. The suppression is written to the CRM suppression table (which the send path checks), so re-sends are blocked — but the subscriber row itself remains `active` in `newsletter_subscribers`. This means the subscriber list shows inflated active counts and the admin cannot filter by `bounced` in the subscriber management UI. Source: confirmed — `recordNewsletterEvent()` only updates `newsletter_recipients`, not `newsletter_subscribers`.

Gap: No automated list hygiene cron. Bounced subscribers are blocked at send time via suppression check, but nobody reviews or cleans the list. Over time the active count drifts above the true mailable count.

### 2.3 One-click unsubscribe and CAN-SPAM compliance

Solid: RFC 8058 headers (`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`) are set on every newsletter send at `app/actions/newsletter.ts:249-250`. The unsubscribe URL uses a unique per-subscriber UUID token. The confirm page at `app/newsletter/unsubscribe/page.tsx` uses POST (button click), never GET, so prefetch bots cannot accidentally unsubscribe recipients.

Solid: Unsubscribe link is in every email footer (HTML and plain text).

**Gap (HIGH): CAN-SPAM physical address missing.** The newsletter shell footer (`lib/email-templates/newsletter-shell.ts:35-38`) contains `Ryan Realty · Bend, Oregon · ryan-realty.com` — no street address, no PO box, no ZIP code. CAN-SPAM 15 USC 7704(a)(5) requires a valid physical postal address. The `BROKERAGE_POSTAL_ADDRESS` env var and the street-address logic in `lib/email/prepare.ts` exist but are not wired to the newsletter shell. The deliverability analyzer in `lib/email/deliverability.ts:106-109` checks for a ZIP + OR/Oregon — this check would flag the newsletter shell as `warn: no-physical-address`, but `analyzeEmailDeliverability` is never called in the newsletter send path.

### 2.4 Segmentation quality

Segments available: `general`, `buyer`, `seller`, `past-client`. These map to newsletter audience selectors in the compose UI (`all`, `segment:buyer`, `segment:seller`, `segment:past-client`).

Gap: `segment: 'general'` subscribers receive ALL newsletters regardless of audience (the `getActiveSubscribersForSend` filter skips the segment filter when `segment === 'general'`, line 163). This means a buyer-targeted newsletter also goes to every `general` subscriber. The intent may be that `general` is the catch-all bucket, but it is not documented in the UI — an admin composing to `segment:buyer` likely expects only buyer-segmented subscribers to receive it.

Gap: The public signup form (`components/site/NewsletterSignup.tsx`) captures no segment preference. All site signups land as `general`. There is no onboarding email sequence to discover their interest (buyer vs seller vs general).

Gap: No frequency capping. A subscriber in `general` who also gets assigned to a `buyer` segment could receive duplicates if the audience resolution ever shifts.

### 2.5 Personalization and merge fields

Gap (MEDIUM): No merge fields. The newsletter send loop has access to `r.name` (the subscriber's name, line 159 in the DAL: `getActiveSubscribersForSend` returns `name`) but the body content is static — the `wrapNewsletterHtml()` function takes a `bodyHtml` string with no substitution. There is no `{{first_name}}` or greeting personalization in the bulk send path. The one-click per-contact send (`sendNewsletterToContactAction`) also does not inject the contact's name into the body.

### 2.6 Send timing and rate limiting

Gap (HIGH): The bulk send loop is synchronous and unbatched (`app/actions/newsletter.ts:226-255`). For each recipient, it: checks suppression (async DB call), wraps HTML, attributes links, calls `sendEmail()` (Resend API), records recipient (DB). This is a sequential per-recipient loop with no concurrency, no delay, and no batching. For a list of 500+ subscribers this will run for minutes, potentially hitting the Next.js server action timeout. Resend's free tier allows 100 emails/day; paid plans allow 50,000/month. No rate limit guard is in place.

Gap: The action runs inside a Next.js server action (not a background job or edge function). A server action has a configurable `maxDuration` but the newsletter action sets none. On Vercel Pro, server functions timeout at 60 seconds; a 200-subscriber list at ~100ms/recipient hits this limit. The send would partially complete with no way to resume.

Gap: No send queue or background worker for the newsletter. Unlike CRM bulk sends (which go through `crm-bulk-worker` cron), the newsletter fires inline. The `crm-scheduled-sends` cron only handles `crm_scheduled_sends` rows, not newsletters.

### 2.7 A/B testing

Not implemented. No subject line variants, no send-time optimization, no content variants. The `newsletters` table has no A/B variant columns.

### 2.8 Accessibility (alt text, plain-text part)

Partial: A plain-text body is stored as `body_text` in `newsletters` and appended to the plain-text footer via `newsletterTextFooter()`. However, the compose form (`NewsletterComposeForm.tsx:132`) says "HTML or plain text" and only has one body field. The `body_text` column exists in the schema but there is no separate plain-text editor in the admin UI — `adminCreateNewsletterAction` and `adminUpdateNewsletterAction` both accept `body_text` from FormData, but the compose form only sets `body_html`. The plain-text body will always be empty unless manually set via the API. The `newsletterTextFooter()` is appended to `body_text ?? ''` — so the sent text part is just the footer with no body content.

Gap: The `deliverability.ts` check for `no-plaintext` (fail-severity) is never called in the newsletter send path. An HTML-only newsletter would pass through without warning.

Gap: No alt-text enforcement for images. The `deliverability.ts` check `img-no-alt` exists but is not called in the newsletter path. An admin can paste `<img>` tags without alt text and they will send without validation.

Gap: The newsletter header renders "RYAN REALTY" as text (`<span>`) rather than the brand logo image from `design_system/ryan-realty/assets/brand/logo-blue.png`. This is actually fine for email accessibility (text renders universally) but diverges from the brand spec.

### 2.9 Brand-voice compliance

The brand-voice CI gate (`scripts/check-brand-voice.mjs`) explicitly excludes `app/admin/` from scanning (lines 196-211). Newsletter body content authored in the compose form is never automatically checked against banned words, banned patterns, or the Five Laws before send. A broker could write "This stunning, nestled gem won't last long!" and it would send without any gate catching it.

The `validateComposeContent()` function in `lib/crm/compose-audience.ts` runs `checkTemplateVoice()` for CRM cohort emails — but this is NOT called in the newsletter pipeline. The newsletter compose → save → send path has no brand-voice validation step.

The one-click per-contact send (`sendNewsletterToContactAction`) reuses whatever HTML is in the newsletter row without a brand-voice check.

### 2.10 Data accuracy for market stats (§0)

The newsletter body is free-form HTML authored by the admin. There is no mechanism to pull verified market stats from `market_pulse_live` or `market_stats_cache` into the newsletter body. There is no citation trace, no verification step, and no gate that blocks a newsletter from sending with unverified numbers.

The marketing brain `newsletter` producer SKILL.md says it pulls live market stats, but the producer has not sent a real newsletter through the system and is labeled a smoke-test.

---

## 3. Solid vs Missing/Risky

### What's solid

- RFC 8058 one-click unsubscribe headers on every send (server action lines 249-250).
- Token-based unsubscribe page uses POST, not GET — bot-safe.
- Hard bounce/complaint → CRM suppression via Resend webhook → blocks all future sends.
- Suppression check at send time for both CRM-linked and unlinked subscribers.
- Per-recipient tracking rows tie Resend webhook events back to subscriber identity.
- Webhook signature verification (Svix HMAC) in production.
- Sender locked to verified `mail.ryan-realty.com` domain in production — sandbox refused.
- Open/click/delivery stats displayed per newsletter in admin.
- Segment-level targeting with 4 tiers (general / buyer / seller / past-client).
- CRM timeline entries for newsletter opens/clicks/bounces on the lead record.
- Admin-gated send with explicit `window.confirm` before fire.
- Segment delete safely reassigns subscribers before removing the row.
- Subscriber source field tracks how each subscriber arrived.

### What's missing or risky

1. **(CAN-SPAM violation)** No physical street address in the newsletter footer — only `Bend, Oregon`. Failure to include a valid postal address is a CAN-SPAM violation ($51,744 per email penalty).
2. **(Deliverability analysis not run)** `analyzeEmailDeliverability` and `prepareDeliverableEmail` exist and would catch missing plain text, missing alt text, and the missing postal address — but they are never called in the newsletter send path.
3. **(Sequential unbatched send loop)** The send action runs synchronously in a server action. 200+ recipients at ~100ms/send risks hitting the Vercel function timeout mid-send with no resume capability.
4. **(No plain-text body in compose UI)** `body_text` column exists but the compose form has one body field. All bulk sends go out HTML-only with a text fallback of just the footer — fails Gmail/Yahoo's multipart requirement, a known spam signal.
5. **(Bounce status not reflected in `newsletter_subscribers`)** Hard bounces and complaints are suppressed at the CRM level but `newsletter_subscribers.status` stays `active`, inflating the active count and preventing segment-level bounce analysis.
6. **(`scheduled_at` is orphaned)** The DB column exists and the DAL accepts it but no cron honors it — a newsletter cannot actually be scheduled for future delivery.
7. **(No brand-voice gate on newsletter body)** Admin-authored content bypasses CI and has no server-side voice check before send.
8. **(No merge fields)** Subscriber's name is available at send time but never injected — all newsletters are one-size-fits-all with no personalization.
9. **(General segment leaks into targeted sends)** `segment: 'general'` subscribers receive all newsletters including audience-targeted sends — the filter is explicitly skipped for `general`. Not documented in the UI.
10. **(No send-time optimization or rate limiting)** No throttle guard, no Resend batch API usage, no background worker. Fires inline.
11. **(No A/B testing capability)** No subject line or content variants.
12. **(Marketing brain producer disconnected)** The `newsletter` producer in REGISTRY.md produces HTML but has no automated path to the admin pipeline.
13. **(No double opt-in)** Single opt-in only. No confirmation email is sent after a public signup. CASL (Canada) requires express consent; GDPR requires clear consent records. Even for CAN-SPAM, double opt-in is best practice for list quality.

---

## 4. Ranked Recommendations

### Critical (compliance / send reliability)

**1. Wire the physical street address into the newsletter footer.**
The `BROKERAGE_POSTAL_ADDRESS` env var and logic already exist in `lib/email/prepare.ts:30-31`. Update `lib/email-templates/newsletter-shell.ts:wrapNewsletterHtml()` to accept an optional `postalAddress` param and render it in the footer table cell. Call `BROKERAGE_POSTAL_ADDRESS` from the env. Set `BROKERAGE_POSTAL_ADDRESS=Ryan Realty, 111 NW Hawthorne Ave Ste 102, Bend OR 97701` (or the correct registered address) in Vercel env. This unblocks CAN-SPAM compliance immediately. File: `lib/email-templates/newsletter-shell.ts` lines 35-38.

**2. Move the send loop into a background job.**
The synchronous loop in `adminSendNewsletterAction` (`app/actions/newsletter.ts:226-255`) is the highest reliability risk. Refactor: (a) the send action stamps `status: 'sending'` and inserts one row per recipient into a `newsletter_send_queue` table, then returns immediately; (b) the `crm-bulk-worker` cron (already running every 2 minutes) drains the queue. Alternatively, use Resend's batch API (`sendBatchEmails` already exists in `lib/resend.ts`) to send in chunks of 100 with a delay between chunks.

**3. Add a separate plain-text body field to the compose form.**
Expand `NewsletterComposeForm.tsx` with a second textarea for plain-text content. On save, populate `body_text`. In the send action, use `htmlToPlainText(letter.body_html)` as the fallback when `body_text` is null (this function already exists in `lib/email/prepare.ts:57-74` — import and reuse it). This fixes the multipart requirement.

**4. Run `analyzeEmailDeliverability` (or `prepareDeliverableEmail`) before send.**
In `adminSendNewsletterAction`, before firing recipients, call `analyzeEmailDeliverability({ subject: letter.subject, html: wrappedHtml, text: textBody })` and surface any `fail`-severity issues as an error to the admin rather than proceeding. At minimum this would catch missing postal address and image-only content.

### High priority (list hygiene / accuracy)

**5. Sync bounce/complaint status to `newsletter_subscribers`.**
In `app/api/webhooks/resend/route.ts` when `event.suppressEmail` is true, also update `newsletter_subscribers.status` to `'bounced'` or `'complained'` (matching `event.suppressReason`). This keeps the subscriber list accurate and allows filtering/analysis by bounce status.

**6. Fix the segment-general leak.**
Document in the compose UI that `general` subscribers receive all newsletters. Either: (a) rename the general segment to "All subscribers" in the UI, (b) add a checkbox "include general subscribers" on the targeted sends, or (c) make `general` opt-in only for the `all` audience. Currently an admin sending to `segment:buyer` does not realize they also reach every `general` subscriber.

**7. Honor `scheduled_at` for deferred sends.**
Wire a lightweight cron (or add a check to an existing cron like `crm-scheduled-sends`) to poll `newsletters` where `status = 'draft'` and `scheduled_at <= NOW()`, then trigger the send action. The `scheduled_at` column and the `updateNewsletter()` API are already in place.

### Medium priority (content quality / personalization)

**8. Add a brand-voice pre-send check in the server action.**
In `adminSendNewsletterAction`, before building the send loop, run the newsletter's `subject` and `body_html` through `checkTemplateVoice()` (already used in CRM cohort sends via `lib/crm/compose-audience.ts:validateComposeContent`). Surface failures as a blocking error with the specific violation listed. This closes the gap where admin-authored content bypasses the gate.

**9. Add first-name merge field support.**
Add a `{{first_name}}` substitution in the send loop (line 238 in `newsletter.ts`). Before `wrapNewsletterHtml()`, call `letter.body_html.replace(/\{\{first_name\}\}/gi, r.name?.split(' ')[0] ?? 'there')`. Expose the merge tag in the compose form UI with a helper note. No schema change required.

**10. Wire the marketing brain newsletter producer to the admin pipeline.**
Currently the producer in `social_media_skills/newsletter/SKILL.md` produces HTML offline with no automated path into the `newsletters` table. Create an `app/api/admin/newsletter-from-brain` route or adapt the producer to call `adminCreateNewsletterAction` programmatically via the brain's action-row pipeline. This closes the gap between content generation and delivery.

### Lower priority (nice-to-have)

**11. Add double opt-in confirmation email.**
After a public subscribe, send a confirmation email with a verification link. Only activate the subscriber row on click. This improves list quality and provides GDPR/CASL consent documentation. Requires a new `status: 'pending'` value and a confirmation token column (or reuse the existing `unsubscribe_token` as a confirmation token).

**12. Surface send-time preview / estimated reach in the compose UI.**
Before the "Send now" button, show an estimate of "X subscribers will receive this." The `getActiveSubscribersForSend()` DAL function is already available — call it with the chosen audience to count recipients and display the number above the send button. This prevents accidental sends to unexpected audience sizes.

**13. Implement send-time optimization.**
Resend does not natively support send-time optimization, but the `scheduled_at` field (once wired) could be used to pre-schedule sends to known high-open windows (Tuesday/Thursday mornings per industry benchmarks for real-estate email).

**14. Add A/B subject line testing.**
Add `subject_b` column to `newsletters`, split recipients 50/50 on first send, and compare open rates after 4 hours before sending the winning subject to the remainder. Out of scope for the current architecture but the per-recipient tracking infrastructure supports it.
