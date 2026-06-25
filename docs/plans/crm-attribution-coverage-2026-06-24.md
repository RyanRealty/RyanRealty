# CRM broker-attribution + tracking coverage map (2026-06-24)

Matt's rule: EVERY link in newsletters, market reports, saved-search alerts, and
CMAs must carry broker attribution so the broker sees sent / opened / delivered /
bounced. The FUB cutover killed FUB-side email tracking, so engagement now flows
entirely through OUR path:

- **opened / clicked** come from the open pixel + click redirects that
  `instrumentEmailHtml` (lib/email-tracking.ts) injects into the email HTML.
  The pixel/redirect hit `app/api/track/e/{open,click}` and write `crm_timeline`
  rows (kind `email_open` / `email_click`) keyed by `personId` (the signed
  token carries the crm_people.id).
- **delivered / bounced / complained** come from Resend's own webhook at
  `app/api/webhooks/resend/route.ts` -> `lib/crm/resend-webhook.ts`, keyed by the
  recipient email and Resend message id, writing `crm_timeline` rows
  (`email_delivered` / `email_bounce`). This path does NOT depend on the email
  body, so it works for any send through `lib/resend.ts sendEmail`.
- **broker routing on click** comes from `?agent=<slug>` stamped by
  `attributeSiteLinks` (lib/crm/merge.ts); `AgentAttributionBridge` reads it and
  sets the 90-day routing cookie. `?_fuid=<id>` ties the click session back to
  the contact.

The single chokepoint every HTML send path should route through is the new
`lib/crm/attributed-links.ts`:

- `attributeOutbound(html, { brokerSlug, personId, fubPersonId, emailKey, label })`
  -> returns broker-attributed + open/click-instrumented HTML. Idempotent.
- `attributeUrl(url, brokerSlug, fubPersonId?)` -> attributes a bare link for
  SMS / non-HTML cases (no open/click pixel, attribution only).

`attributeOutbound` composes the two primitives in the ONLY correct order:
attribution first (mutate the real ryan-realty.com destination), tracking second
(wrap the now-attributed URL inside the signed click token). Reverse order would
bury the destination inside the click token where the attribution regex cannot
see it, so no `?agent=` would ever land.

---

## Per-channel coverage

### 1. Newsletter

- **Send path:** `app/actions/newsletter.ts` -> `adminSendNewsletterAction(id)`
  (loops `getActiveSubscribersForSend`, builds `html` via `wrapNewsletterHtml`
  from `lib/email-templates/newsletter-shell.ts`, calls `sendEmail` from
  `lib/resend.ts`, records each send via `recordRecipientSend`).
- **Today:** NO attribution, NO open/click instrumentation. `wrapNewsletterHtml`
  only injects the unsubscribe footer. delivered/bounced still arrive via the
  Resend webhook (it does not need the body), but opened/clicked do NOT, and
  links carry no `?agent=`.
- **Change:** after building `html` (line ~227), before `sendEmail` (line ~229),
  wrap it:
  ```ts
  const finalHtml = html
    ? attributeOutbound(html, {
        brokerSlug,                 // see broker-resolution note below
        personId: r.crm_person_id ?? null,
        emailKey: `newsletter:${id}`,
        label: letter.subject,
      })
    : undefined
  ```
  then pass `finalHtml` to `sendEmail({ ..., html: finalHtml })`.
- **Broker-slug source:** the newsletter records `sent_by` (gate.email). Resolve
  that admin email to a `brokers.slug` once before the loop (a `brokers` lookup
  in a DAL reader, or fall back to the env default `matt-ryan`). Per-recipient
  routing to the recipient's own assigned broker would be better, but the
  newsletter subscriber row does not carry an assigned broker today, so
  send-broker (sender) attribution is the correct first step. `r.crm_person_id`
  is already on the subscriber row, so open/click tracking is fully wired the
  moment `attributeOutbound` is applied.

### 2. Market report

- **Status today:** there is NO email send path for a market report. The market
  report is a video/render pipeline (`app/api/cron/market-report/route.ts`
  triggers a render; it sends no email). The newsletter IS the channel a market
  report would ship through (a market-update newsletter body).
- **Change:** when a market-report email is introduced, it MUST go out through
  `adminSendNewsletterAction` (or a sibling that mirrors it) so it inherits the
  `attributeOutbound` wrap from item 1. Do not build a second bespoke send path.
  Use `emailKey: 'market-report:<geo>:<period>'` so the timeline groups the
  engagement under that report.

### 3. Saved-search / listing alerts

- **Send path:** `app/actions/saved-search-alerts.ts` ->
  `runSavedSearchAlerts` (signed-in) and `runGuestSearchAlerts` (guest), both
  driven by the cron at `app/api/cron/saved-search-alerts/route.ts`. Each builds
  a TEXT-ONLY email (no `html` field) and calls `sendEmail` from `lib/resend.ts`.
  Links are pre-built with a local `appendTracking(url, fubPersonId)` helper that
  adds `utm_*` + `?_fuid=`.
- **Today:** PARTIAL. `appendTracking` adds `_fuid` + utm but NOT `?agent=`
  broker attribution, and because these are text emails there is no open/click
  pixel (so no `email_open`/`email_click` timeline rows; only delivered/bounced
  via the Resend webhook).
- **Change (two parts):**
  1. Broker routing on every link: route each link through
     `attributeUrl(url, brokerSlug, fubPersonId)` instead of (or in addition to)
     the bare `appendTracking`. The `brokerSlug` is the contact's assigned broker
     (resolve from the crm_people row for the signed-in user, or the guest
     alert's `fub_person_id` -> assigned broker; fall back to `matt-ryan`).
     `attributeUrl` is idempotent, so it is safe to layer with the existing
     utm params (call `appendTracking` first for utm, then `attributeUrl` for
     `?agent=`).
  2. Open/click tracking: to get `email_open` / `email_click` rows the alert
     must send an HTML body. When the alert is upgraded to HTML, wrap the body
     with `attributeOutbound(html, { brokerSlug, personId, fubPersonId, emailKey:
     `alert:${searchId}`, label: subject })`. `personId` is the crm_people.id for
     the signed-in user (resolve by account email) or the guest's linked person.
     Until then, the text path gets routing-only attribution via `attributeUrl`
     and relies on the Resend webhook for delivered/bounced.

### 4. CMA

- **Send path:** `lib/cma-delivery.ts` -> `composeCmaEmail(...)` builds the
  lead-facing HTML; the broker reviews at `/cma-drafts/<id>` and the actual send
  to the lead happens in the admin send action (`sendCmaDelivery`, the route that
  flips the row to 'sent'). `lib/cma-deliver.ts` is the alternate/legacy direct
  composer (it already imports the merge helpers).
- **Today:** `composeCmaEmail` HTML is NOT attributed or instrumented. The CMA
  email links (mailto/tel and any site links) carry no `?agent=` and no
  open/click pixel. delivered/bounced arrive via the Resend webhook.
- **Change:** at the actual lead-send step (where `email_body_html` is passed to
  `sendEmail`), wrap the stored `email_body_html`:
  ```ts
  const finalHtml = attributeOutbound(row.email_body_html, {
    brokerSlug: row.assigned_broker_slug ?? 'matt-ryan',
    personId,                         // crm_people.id for row.lead_email
    fubPersonId: row.fub_person_id ?? null,
    emailKey: `cma:${deliveryId}`,
    label: row.email_subject ?? 'Your Bend home value',
  })
  ```
  The CMA row already carries `assigned_broker_slug` and `fub_person_id`, so the
  broker slug is available with no extra lookup. Resolve `personId` from
  `row.lead_email` (crm_people by email) at send time.

---

## Summary table

| Channel | Send-path file + function | Attribution today | Tracking today | Wire through |
| --- | --- | --- | --- | --- |
| Newsletter | `app/actions/newsletter.ts` `adminSendNewsletterAction` | none | delivered/bounced only (webhook) | `attributeOutbound(html, {brokerSlug, personId: r.crm_person_id, emailKey: 'newsletter:<id>', label})` |
| Market report | (no email path; ships via newsletter) | n/a | n/a | route through newsletter send -> inherits `attributeOutbound` |
| Saved-search alerts | `app/actions/saved-search-alerts.ts` `runSavedSearchAlerts` / `runGuestSearchAlerts` | `_fuid`+utm only, no `?agent=` | delivered/bounced only (text email, no pixel) | `attributeUrl(url, brokerSlug, fubPersonId)` per link; `attributeOutbound` once moved to HTML body |
| CMA | `lib/cma-delivery.ts` `composeCmaEmail` (sent via `sendCmaDelivery`) | none | delivered/bounced only (webhook) | `attributeOutbound(row.email_body_html, {brokerSlug: row.assigned_broker_slug, personId, fubPersonId: row.fub_person_id, emailKey: 'cma:<id>', label})` |

## Shared infrastructure (already correct, no change)

- `app/api/webhooks/resend/route.ts` + `lib/crm/resend-webhook.ts` — delivered /
  bounced / complained -> `crm_timeline`, keyed by recipient email + Resend
  message id. Channel-agnostic; covers all four channels once they send through
  `lib/resend.ts sendEmail`.
- `app/api/track/e/{open,click}` + `lib/email-tracking.ts` — opened / clicked ->
  `crm_timeline`, keyed by the signed `personId` token. Activated for a channel
  the moment `attributeOutbound` wraps an HTML body for that send.
- `lib/crm/merge.ts attributeSiteLinks` + `AgentAttributionBridge` /
  `FubIdentityBridge` — `?agent=` routing + `?_fuid=` identity backfill.
