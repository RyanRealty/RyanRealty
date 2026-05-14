---
name: tools_registry-resend
description: Use this skill when a task involves sending transactional or marketing email through Resend — including ops-email-send blasts, comms-matt-alert email tier, CMA delivery, contact-form notifications, saved-search alerts, or any programmatic send from mail.ryan-realty.com. Covers authentication, the current blocked-send state (domain unverified as of 2026-05-14), send patterns, batch sends, audience management, failure modes, CAN-SPAM requirements, and the DNS unblock path.
---

# Resend Tool Skill

## Canonical references

This is a capability skill used by email-producing brain components. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (never send without Matt's explicit approval)
- `marketing_brain_skills/producers/ops-email-send/SKILL.md` — the producer that calls this tool for newsletters and blasts
- `marketing_brain_skills/producers/comms-matt-alert/SKILL.md` — the producer that calls this tool for the email tier of alerts

---

## CRITICAL: DOMAIN NOT VERIFIED — ALL SENDS FROM mail.ryan-realty.com BLOCKED

**As of 2026-05-14, `mail.ryan-realty.com` is not verified on Resend.**

This is a hard block. Resend rejects every outbound send from `noreply@mail.ryan-realty.com` with HTTP 403 / "domain not verified." This affects every email-producing brain component:

- `ops-email-send` — newsletters, blasts, announcements
- `comms-matt-alert` — email tier (medium/low/summary urgency)
- `lib/resend.ts` — CMA delivery, contact-form notifications, saved-search alerts, valuation auto-responses
- `app/api/cma-drafts/[id]/send/route.ts` — seller CMA report delivery

**Nothing ships email via Resend until Matt completes the DNS verification steps below.**

The temporary fallback for one-off sends (e.g. an AgentFire support ticket) is the Gmail service-account path at `scripts/seo-send-agentfire-support-ticket-gmail.mjs`. That is a workaround for ad-hoc sends only — not a production substitute for the Resend pipeline.

---

## Scope

**Use Resend for:**

| Use case | Producer / caller |
|---|---|
| Newsletter and blast emails to FUB segments | `ops-email-send` |
| Brain alerts, digests, and status updates to Matt (email tier) | `comms-matt-alert` |
| CMA report delivery to seller leads | `lib/cma-delivery.ts` |
| Contact-form submission notifications to Matt | `app/contact/actions.ts` |
| Home-valuation lead auto-response | `app/home-valuation/actions.ts` |
| Saved-search property alert emails | `app/actions/saved-search-alerts.ts` |
| Admin notification emails | `app/actions/admin-email.ts` |

**Do NOT use Resend for:**

| Data / channel | Use instead |
|---|---|
| Direct broker-to-client conversation email | Gmail through Follow Up Boss (FUB native mailer) |
| FUB drip sequence emails | FUB action plan config via `ops-fub-crm` |
| Social DM or comment replies | `engagement_bot` capability |
| iMessage alerts (critical/high urgency) | `comms-matt-alert` → iMessage tier (not Resend) |

The rule: Resend is the transactional and marketing email platform. Direct client conversations route through FUB's native inbox.

---

## Authentication

| Variable | Where to get it | Scope required |
|---|---|---|
| `RESEND_API_KEY` | resend.com → API Keys | "Sending access" (send-scoped) is sufficient for almost all use cases |
| `RESEND_WEBHOOK_SECRET` | resend.com → Webhooks → signing secret | Required only for `app/api/webhooks/resend/route.ts` |

```ts
// lib/resend.ts — canonical client getter (already implemented)
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key?.trim()) return null
  return new Resend(key)
}
```

Token is stored in:
- `.env.local` (local dev)
- Vercel → Project Settings → Environment Variables → Production + Preview + Development

A send-scoped key is the correct choice for `RESEND_API_KEY`. A full-access key is not needed and increases blast radius if the key leaks.

---

## API endpoints

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /emails` | Send a single email | Returns `{ id }` on success |
| `POST /emails/batch` | Send up to 100 emails per call | Use for bulk segment sends; `lib/resend.ts::sendBatchEmails` wraps this serially today |
| `GET /emails/{id}` | Check delivery status | Poll after send to confirm `delivered` vs `bounced` |
| `POST /audiences/{id}/contacts` | Add a contact to an audience | Marketing-tier audience management |

Base URL: `https://api.resend.com`

---

## Send pattern — single email

The canonical implementation lives in `lib/resend.ts`. Read it before writing any new send path. Do not re-implement the client instantiation or error-capture pattern.

```ts
// Raw API equivalent of lib/resend.ts::sendEmail — for reference only
// Always call lib/resend.ts::sendEmail in application code, not this raw fetch
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'Ryan Realty <noreply@mail.ryan-realty.com>',
    to: ['recipient@example.com'],
    subject: 'Subject line here',
    html: '<p>Body HTML here.</p>',
    text: 'Body plain text here.',
    reply_to: 'matt@ryan-realty.com',
  }),
})
```

The `from` address **must** match a verified sending domain. Until `mail.ryan-realty.com` is verified, this call returns 422 / 403. The only working `from` address today is `onboarding@resend.dev` (Resend's sandbox — for testing only, never for production sends to real recipients).

---

## Send pattern — batch

`lib/resend.ts::sendBatchEmails` today sends serially (one call per email in a loop). For segments over ~50 recipients, replace with a true batch call:

```ts
// Batch — up to 100 per call; use for bulk segment sends
const res = await fetch('https://api.resend.com/emails/batch', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([
    {
      from: 'Ryan Realty <noreply@mail.ryan-realty.com>',
      to: ['lead1@example.com'],
      subject: '...',
      html: '...',
    },
    {
      from: 'Ryan Realty <noreply@mail.ryan-realty.com>',
      to: ['lead2@example.com'],
      subject: '...',
      html: '...',
    },
    // up to 100 items
  ]),
})
```

For segments larger than 100, chunk the list and call `/emails/batch` once per chunk with a short delay between calls to avoid rate-limit pressure.

---

## Delivery status check

```ts
const statusRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
})
const { data } = await statusRes.json()
// data.last_event: 'delivered' | 'bounced' | 'opened' | 'clicked' | 'complained' | 'unsubscribed'
```

Store the Resend `id` returned from `/emails` on the `marketing_brain_actions` row in `executor_response` so delivery status can be audited later.

---

## Webhook handler

`app/api/webhooks/resend/route.ts` receives delivery events (delivered, opened, clicked, bounced, complained, unsubscribed). The handler today logs events and marks unsubscribed contacts. Set the webhook endpoint in the Resend dashboard to `https://ryan-realty.com/api/webhooks/resend`. Verify `RESEND_WEBHOOK_SECRET` is set in Vercel env.

---

## Audience management (marketing tier)

Resend audiences are contact lists for marketing (non-transactional) sends. Ryan Realty is not yet using audience-managed sends — the current pattern sends directly to individual addresses pulled from FUB. If the newsletter grows past ad-hoc FUB exports, migrate to:

1. Create an audience at resend.com → Audiences
2. Sync FUB opt-in segment to the audience via `POST /audiences/{id}/contacts`
3. Send using the audience ID as recipient

Not currently wired into the pipeline. Do not build this until Matt approves the migration from direct-address sends to audience-managed sends.

---

## Cost model

| Tier | Monthly emails | Cost |
|---|---|---|
| Free | 3,000 / month, 100 / day | $0 |
| Pro | 50,000 / month | $20 / month |

At Ryan Realty's current volume (daily digest + occasional blasts + CMA delivery + transactional form notifications), the free tier is sufficient during development. Move to Pro before the first active-subscriber newsletter send. No per-email charge at Pro; overage above 50,000 is billed per email.

---

## CAN-SPAM compliance (mandatory for every marketing send)

Matt is a licensed principal broker. Marketing email has legal requirements. Every bulk email send must include:

1. **Unsubscribe link** — a one-click opt-out mechanism in every email footer. Resend does not auto-inject this; the template HTML must include it. Route unsubscribe clicks to an endpoint that sets a suppression flag in FUB and/or Resend's suppression list.
2. **Physical address footer** — Ryan Realty's physical address must appear in every marketing email. Current address: confirm from the listings office address in Supabase or CLAUDE.md before use; do not hard-code from memory.
3. **Honest subject line** — no deceptive subjects. No fake urgency ("Your account will close in 24h").
4. **Sender identity** — from name must clearly identify Ryan Realty as the sender.

Transactional emails (CMA delivery, contact-form notifications, valuation auto-responses) are exempt from CAN-SPAM's unsubscribe requirement but must still meet the honest-sender and non-deceptive-subject requirements.

**Brand voice applies to all email content.** The banned-words list in CLAUDE.md (stunning, nestled, boasts, charming, etc.) applies. No em-dashes, no exclamation marks, no AI filler. Run every email body through brand-voice validation before surfacing to Matt.

---

## DNS verification checklist — THE UNBLOCK PATH

**Matt completes this. The agent documents and surfaces it; Matt executes the Cloudflare steps.**

Current state: DNS is hosted on Cloudflare (`jeff.ns.cloudflare.com` + `eva.ns.cloudflare.com`). The zone is `ryan-realty.com`.

Full step-by-step: `docs/resend-dns-verification-steps-2026-05-14.md`

Summary:

1. Log in at `https://resend.com` → Domains
2. Find or add `mail.ryan-realty.com`; Resend shows the exact records to add (values are account- and region-specific — use Resend's values verbatim, not the placeholders below)
3. Log in at `https://dash.cloudflare.com/` → `ryan-realty.com` zone → DNS
4. Add the four records Resend provides:

| Type | Host (Cloudflare field) | Value | Priority | Proxy |
|---|---|---|---|---|
| MX | `mail` | `feedback-smtp.us-east-1.amazonses.com` | 10 | OFF (grey cloud) |
| TXT | `mail` | `v=spf1 include:amazonses.com ~all` | — | OFF |
| TXT | `resend._domainkey` (exact selector Resend shows) | (long DKIM key — copy verbatim) | — | OFF |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@ryan-realty.com` | — | OFF |

5. Proxying must be OFF (grey cloud) on every record. Cloudflare proxying intercepts DNS resolution and breaks Resend's verification.
6. Back in Resend dashboard → Domains → click "Verify DNS records"
7. All records should turn green within 5–60 minutes (Cloudflare propagation is fast, typically under 5 minutes)
8. Test with a live send: `node --env-file=.env.local scripts/seo-send-agentfire-support-ticket.mjs`
9. On success, document verification date in `.auto-memory/memory_marketing_brain_decisions.md`

**Before any send attempt, always check domain status.** A fast pre-flight:

```ts
// Verify domain status — run before any production send
const domainsRes = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
})
const { data } = await domainsRes.json()
const mailDomain = data?.find((d: { name: string }) => d.name === 'mail.ryan-realty.com')
// mailDomain.status should be 'verified' before allowing sends
```

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Domain not verified (current state) | HTTP 422 or 403, message "domain not verified" or "The from address doesn't match a verified domain" | Complete DNS verification checklist above; do not attempt workarounds or domain substitutions |
| `RESEND_API_KEY` not set | `null` from `getClient()`, send returns `{ error: 'Email not configured' }` | Add key to `.env.local` and Vercel env; redeploy |
| From address doesn't match a verified domain | HTTP 422 | Only send from verified domains; do not change the `from` field to a workaround address without Matt's approval |
| Recipient hard bounce | `email.bounced` webhook event; `last_event: 'bounced'` on status check | Mark contact as undeliverable in FUB; do not retry bounced addresses |
| Recipient complained (spam report) | `email.complained` webhook event | Immediately suppress; add to Resend suppression list; do not retry |
| Recipient unsubscribed | `email.unsubscribed` webhook event | Suppression handler in `app/api/webhooks/resend/route.ts` runs automatically; verify it is working after domain verification |
| HTML validation error | HTTP 422, specific field error in response body | Resend's HTML validator is strict on malformed tags and certain CSS patterns; validate HTML before sending |
| Rate limit | HTTP 429 | Free tier: 100/day hard cap; Pro tier: no daily cap but burst limits apply. Use batch endpoint for bulk sends; add delays between chunk calls |
| `RESEND_WEBHOOK_SECRET` not set | Webhook events are received but not verified; potential spoofing | Set `RESEND_WEBHOOK_SECRET` in Vercel env; `app/api/webhooks/resend/route.ts` validates the `svix-signature` header |

---

## Existing implementation

`lib/resend.ts` is the canonical send wrapper. It exports:

- `sendEmail(options)` — single email; returns `{ id?, error? }`; handles missing key, Sentry error capture, and dev-mode skip
- `sendBatchEmails(emails[])` — serial loop over `sendEmail`; for segments >50, replace with true `/emails/batch` call (see pattern above)
- `sendContactNotification(params)` — contact-form notification helper; sends to `ADMIN_EMAIL` env var
- `getResendClient()` — returns raw `Resend` SDK instance for callers that need direct SDK access

Do not re-implement the client instantiation or the Sentry error capture. Call `sendEmail()` from `lib/resend.ts` in all application code. Raw fetch calls are for reference only.

Callers in the current codebase:

- `app/actions/auto-response.ts`
- `app/actions/admin-email.ts`
- `app/actions/lead-landing.ts`
- `app/actions/saved-search-alerts.ts`
- `app/contact/actions.ts`
- `app/home-valuation/actions.ts`
- `app/api/cma-drafts/[id]/send/route.ts`
- `lib/cma-delivery.ts`

All of these are currently blocked pending domain verification.

---

## Pre-flight checklist (before any production send)

```
[ ] RESEND_API_KEY confirmed in .env.local and Vercel env
[ ] Domain mail.ryan-realty.com status is 'verified' in Resend dashboard (GET /domains)
[ ] From address is noreply@mail.ryan-realty.com (matches the verified domain)
[ ] Subject line is honest, non-deceptive, sentence case
[ ] Body passes brand-voice check: no banned words, no em-dashes, no exclamation marks, no AI filler
[ ] Marketing email: unsubscribe link present in footer
[ ] Marketing email: physical address present in footer
[ ] Recipient list is from FUB segment (no purchased lists)
[ ] Matt has explicitly approved the subject and body ("ship it" / "approved" / "go")
[ ] Resend email ID stored in executor_response on the marketing_brain_actions row after send
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/resend.ts` | Canonical implementation — `sendEmail`, `sendBatchEmails`, `sendContactNotification` |
| `marketing_brain_skills/producers/ops-email-send/SKILL.md` | Producer for newsletter and blast sends; dispatches through this tool |
| `marketing_brain_skills/producers/comms-matt-alert/SKILL.md` | Alert producer; routes medium/low/summary urgency to the email tier |
| `lib/cma-delivery.ts` | CMA report delivery — uses `sendEmail` |
| `app/api/webhooks/resend/route.ts` | Delivery event webhook handler (delivered, bounced, unsubscribed, etc.) |
| `docs/resend-dns-verification-steps-2026-05-14.md` | Detailed Cloudflare DNS steps to unblock the domain |
| `docs/seo-execution-log-2026-05-14.md` | Discovery log: Resend unverified, Gmail API fallback used, unblock path documented |
| `video_production_skills/API_INVENTORY.md` §Resend | Live verification status as of 2026-04-27 |
| https://resend.com/domains | Resend domain verification UI — start here for the unblock |
| https://resend.com/docs/api-reference/emails | REST API reference — `/emails`, `/emails/batch`, `/emails/{id}` |
| https://dash.cloudflare.com | DNS management for ryan-realty.com — add Resend's MX/SPF/DKIM/DMARC records here |
