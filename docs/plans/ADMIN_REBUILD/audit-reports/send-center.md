# Send Center Audit — Sending things to leads (CMA, BPO, newsletters, saved-search alerts, market reports, one-off email)

Auditor domain: everything that puts a deliverable in front of a lead. Ground-truth read of `page.tsx → component → action → lib → Supabase/Twilio/Resend/Gmail → UI state` for every send type. Every claim carries a file+line.

The owner's stated core job: **"a new lead wants a CMA — I need to get to the site and send it in seconds; right now it's almost impossible."** The audit confirms this job is not achievable in seconds by any path, and is not achievable at all on mobile.

---

## 0. HEADLINE

The send domain is a pile of **parallel, half-overlapping surfaces** with no single "send to this lead" flow. The CMA alone has **four build entry points and six send entry points**, two of which route through a retired pipeline. The person page stacks **three different CMA surfaces, two BPO surfaces, and three market-report subscription surfaces** on top of each other, each behaving differently. The one component that was supposed to unify sending (`ContactSendCenter`) can only send deliverables that are already built AND already approved elsewhere — so it is a last step bolted onto a multi-page approval chase, not a "send in seconds" button. And the entire send domain (CMA card, BPO card, Send Center, market-report/newsletter toggles) **does not exist on mobile at all** — mobile gets free-text email/SMS only. The owner's core CMA job, measured, is roughly **10+ clicks across 4-5 page loads plus a 30-60 second synchronous build that can time out**, not "seconds."

---

## 1. CMA (Comparative Market Analysis)

The most important deliverable and the most fragmented.

### 1.1 The four build entry points (forks)

| # | Entry | File | Sync/async | Result |
|---|-------|------|-----------|--------|
| A | Manual "Build CMA" form | `app/admin/(protected)/cmas/new/page.tsx` → `components/admin/cma/BuildCmaForm.tsx:38-59` → `app/actions/cma-admin.ts:48` (`buildCmaAdminAction`) | **Synchronous** — `buildCma()` runs in the action; button says "Building (30 to 60 seconds)…" (`BuildCmaForm.tsx:140`) | `cmas` row status `draft`, redirect to `/admin/cmas/[slug]` |
| B | Seller LP submission | `app/lp/seller-home-value/actions.ts:612` → `lib/cma-request.ts:103` (`createCmaRequest`) | **Async** — writes `cmas` draft row + `marketing_brain_actions` `content:cma` row (`lib/cma-request.ts:183,208`), built later by cron | Draft appears in `/admin/cmas`; built by `cma-build-worker` cron |
| C | CRM contact card "Generate comp" | `OwnedHomeCard.tsx:55` + `ContactBpoCard`/etc → `form-actions.ts:71` (`startCmaForm`) → `app/actions/contact-cma.ts:112` (`startCmaForContactAction`) | **Synchronous** — awaits `buildCma()` (`contact-cma.ts:147`) | `cmas` draft row, redirect back to contact |
| D | Meta lead webhook | `app/api/meta/lead-webhook/route.ts:633` → `createCmaRequest` | Async (same as B) | Draft + action row |

The async path (B/D) is drained by the cron **`/api/cron/cma-build-worker`** (`vercel.json:188`, every 30 min) → `lib/cma/worker.ts:135` (`runCmaBuildWorker`, caps 3/run, `maxDuration=300`). This is the only build path with a real timeout budget.

**DEFECT (build timeout risk).** Paths A and C run `buildCma()` **synchronously inside a server action** with **no `maxDuration` override** (`cma-admin.ts` and `contact-cma.ts` export none — verified). The action pulls MLS subject + closed comps + 3-method pricing + HTML render; the UI itself advertises "30 to 60 seconds" (`BuildCmaForm.tsx:140`). Default Vercel server-action duration is well under that, so the manual form and the contact-card "Generate comp" can time out and return a generic failure while the row may or may not have persisted. The cron path exists precisely because these builds are too slow for a request, but the two interactive paths didn't get the same treatment.

### 1.2 The list — `/admin/cmas` (`app/admin/(protected)/cmas/page.tsx`, 552 lines)

- Data: `listCmasForAdmin({ limit: WINDOW=500, offset: 0 })` + `getCmaExpiredLinks()` (`page.tsx:181-185`). Pulls **up to 500 rows every load**, then does status filter, free-text search, and pagination **in-memory in the page** (`page.tsx:208-223`). `force-dynamic` (`page.tsx:38`), not cached.
- **DEFECT (scaling).** With rows ≈ 155 today (schema snapshot) this is fine, but the pattern fetches the whole 500-row window into the RSC on every keystroke-driven filter change and paginates presentationally. It will degrade linearly and silently caps the visible universe at 500.
- Mobile: forks into a card list (`page.tsx:315`) vs desktop table (`page.tsx:395`). This one page does have real mobile parity.
- Every row's PDF button hits `/api/cma/[slug]/pdf`; Review → `/admin/cmas/[slug]`.

### 1.3 The review/approve/send page — `/admin/cmas/[slug]` (`page.tsx` + `CmaReviewActions.tsx`)

- Preview is an `<iframe src="/cma/[slug]">` (`page.tsx:137`) — the public route (`app/cma/[slug]/route.ts`), which serves drafts only to an authed admin (`route.ts:50-56`). Good.
- `CmaReviewActions.tsx` is the real control panel: edit client info + price override → `rebuildCmaAction` (`:84`), `approveCmaAction` (draft→finalized, `:102`), `sendCmaToLeadAction` (`:114`), archive/unarchive, delete.
- **Send** (`CmaReviewActions.tsx:111` → `cma-admin.ts:232` → `lib/cma/send.ts:293` `sendCmaToLead`): Gmail DWD from the signing broker's mailbox, Resend fallback, PDF attached, FUB BCC'd, suppression fail-closed (`send.ts:298-304`), `attributeOutbound` open/click tracking (`send.ts:321`), timeline `email_out` (`send.ts:374`). This path is solid and correct.
- Gating: send requires status `finalized`/`delivered` **and** a client email (`CmaReviewActions.tsx:75`; enforced again in `send.ts:68-74`).

### 1.4 The six CMA send entry points

1. `/admin/cmas/[slug]` "Send to lead" → `sendCmaToLeadAction` → `sendCmaToLead` (canonical).
2. `ContactCmaCard.tsx:39` "Send to contact" → `form-actions.ts:79` (`sendCmaForm`) → `contact-cma.ts:189` (`sendCmaForContactAction`) → `sendCmaToLead` (slug path) OR legacy `cma_deliveries` (UUID path, `contact-cma.ts:250`).
3. `ContactSendCenter.tsx:118` CMA tab → `sendCmaForContactAction` (same).
4. `SendDocDialog.client.tsx` (Expireds/FSBO dashboards) → `app/actions/send-doc.ts:197` (`sendDocEmailAction`) / `:240` (`sendDocSmsAction`) → `sendCmaToLead`. This is a **different, richer** compose surface (channel tabs, template picker pre-merged, EmailComposer/SmsComposer) than any of the CRM-side send surfaces.
5. Legacy API routes: `/api/cma/[slug]/email` (Resend auto-send), `/api/cma/[slug]/gmail-draft`, `/api/cma/[slug]/finalize-deliver` — all admin/cron gated, all still live, all referencing `public/cmas/<slug>/cma.html` file paths from the pre-2026-07 producer.
6. Legacy `cma-drafts/[id]/send` route + `/cma-drafts/[id]/page.tsx` — the token-signed broker review page for the retired `cma_deliveries` React-PDF pipeline.

**DUPLICATION (severe).** Three of these (2, 3, and the OwnedHomeCard flow in 1.5) live on the **same person page**. Four different code paths (`send.ts`, `send-doc.ts`, legacy `contact-cma.ts` UUID branch, legacy `/api/cma/*`) can email a CMA, each with its own body copy, its own tracking wiring, and its own suppression call.

### 1.5 OwnedHomeCard — a broken legacy flow still wired into the person page

`components/admin/crm/OwnedHomeCard.tsx` renders on the contact page (`crm/[id]/page.tsx:591`) when the contact owns a home. Its buttons:
- "Generate comp" → `startCmaForm` (builds a **new** `public.cmas` deterministic CMA). OK-ish.
- When `reviewDeliveryId` is set, "Review comp" → `<a href="/cma-drafts/${reviewDeliveryId}">` (`OwnedHomeCard.tsx:47`) — **with no `?token=`**. But `/cma-drafts/[id]/page.tsx:74-86` requires a valid HMAC token via `verifyDeliveryToken` and otherwise renders **"Link not valid."**
- `reviewDeliveryId` is sourced from a **legacy `cma_deliveries` row with status `ready`** (`crm/[id]/page.tsx:245-248`, reading `full.cmaDeliveries`), a pipeline explicitly declared "retired for NEW builds" (`contact-cma.ts:6-11`).

**DEFECT (dead end).** The OwnedHomeCard "Review comp" button is a guaranteed dead end (token-less link into a token-gated page), and it is fed by a retired data source. The card mixes the new deterministic builder (Generate) with the dead legacy pipeline (Review/Send), so a broker who lands on it cannot tell which CMA system they are in.

### 1.6 ContactCmaCard — Review button silently missing; opens wrong page when present

`ContactCmaCard.tsx:74` renders a "Review" button **only when `c.previewUrl` is truthy**. `previewUrl` comes from `getContactCmas` reading `cmas.preview_url` (`lib/data/crm/getContactCmas.ts:37,52`).

**DEFECT (data-source gap).** Nothing in the deterministic build path writes `cmas.preview_url`. `build.ts`'s `upsertCmaRowBySlug` (`lib/cma/build.ts:578-611`) never sets it; `cma-request.ts` upsert never sets it; only the cron's `executor_response.preview_url` is written (`worker.ts:97`) — a different column on a different table (`marketing_brain_actions`). The `cmas.preview_url` column (schema snapshot line 623, nullable, no default) is therefore **NULL for builder-built CMAs**, so on the contact card the "Review" button **does not render** for exactly the CMAs the builder produces. Even when it does render (legacy rows that carried a value), it opens the **public `/cma/[slug]`** doc, not the `/admin/cmas/[slug]` approve page — so **there is no way to Approve a draft CMA from the contact card**. The broker must independently navigate to `/admin/cmas`, find the CMA, open it, and approve, before `ContactSendCenter`/`ContactCmaCard` will even show a Send button (both gate on `status === 'finalized' | 'delivered'` — `ContactSendCenter.tsx:57`, `ContactCmaCard.tsx:59`).

### 1.7 CMA journey click-count (the owner's core job)

Lead already in CRM, owns home on file, wants a CMA now:
1. Search CRM, open the contact (≥2 clicks / 2 loads).
2. "Generate comp" or Send Center → build (synchronous **30-60s wait**, timeout risk §1.1).
3. To approve: leave the contact, go to `/admin/cmas` (1), find the row (1 + scroll), open review (1 load), Approve (1), wait for revalidate.
4. Return to the contact (1-2), open `ContactSendCenter` (1), CMA tab (1), pick the CMA (1), "Send CMA" (1).

≈ **10-12 interactions across 4-5 full page loads plus a 30-60s build**. For a brand-new lead not yet in the CRM it is worse: either `/admin/cmas/new` (synchronous build, then the same approve-then-send chase) or create the contact first. **This is the concrete proof of the owner's complaint.** There is no single screen where "find lead → build → approve → send" happens.

### 1.8 CMA "how do I know they opened it"

Two parallel tracking systems, both live:
- Canonical: `attributeOutbound` (`lib/crm/attributed-links.ts`) wraps links through `/api/track/e/click` + open pixel `/api/track/e/open`, written to `crm_timeline` via those routes + the Resend webhook (`app/api/webhooks/resend/route.ts`). Opens/clicks surface on the contact timeline + `ContactEmailEngagement` + `ContactDeliveryPanel`.
- Legacy: `/api/cma/[slug]/track` (`route.ts`) — a separate 1×1 pixel + `?e=view` redirect that fires `queueBrokerAlert` → iMessage to the broker. Only reachable if the built HTML embeds that pixel (the old file-based producer did).

**DEFECT (split truth).** Two independent open/click mechanisms for the same deliverable means engagement can be recorded in one place and not the other depending on which send path and which HTML template produced the email. The broker-alert-on-open (the thing the owner explicitly asked for per the route comment) lives only on the legacy pixel path, not on the canonical `attributeOutbound` path used by `sendCmaToLead`.

---

## 2. BPO (Broker Price Opinion)

Structurally a near-clone of the CMA, sharing the same send library shape (`lib/bpo/send.ts` mirrors `lib/cma/send.ts`).

### 2.1 Surfaces
- List `/admin/bpo` (`page.tsx`, 149 lines) — simple paginated table, `listBposForAdmin`. No mobile card fork (desktop `<Table>` in an `overflow-x-auto`, `page.tsx:73`).
- Review `/admin/bpo/[slug]` (`page.tsx` + `BpoReviewActions.tsx`) — rebuild, **finalize** (with a review-ack `confirm()` gate, `BpoReviewActions.tsx:65-88`), delete. **There is NO send control on the BPO review page.** The only way to send a BPO is from the contact card / Send Center.
- Build forks: manual `/admin/bpo/new` (synchronous, same timeout risk as CMA), contact-card "New opinion" → `startBpoForm` → `startBpoForContactAction` (`app/actions/contact-bpo.ts:53`, synchronous build).

### 2.2 Send
- Only path: `ContactBpoCard` ("New opinion" builds; no send button on the card itself) + `ContactSendCenter.tsx:112` BPO tab → `sendBpoForContactAction` (`contact-bpo.ts:106`) → `lib/bpo/send.ts:101` (`sendBpoToLead`). Gmail DWD + Resend fallback, offer-strategy stripped for non-owner recipients (`send.ts:142-154`), suppression fail-closed, wrong-recipient guard (`send.ts:121-124`). Solid.
- Requires status `final` (`send.ts:116`). Send Center only lists `status === 'final'` BPOs (`ContactSendCenter.tsx:56`).

### 2.3 DEFECT — Review link on ContactBpoCard opens the client-safe public page, not the finalize page
`ContactBpoCard.tsx:76` Review → `b.previewUrl` = `/bpo/[slug]` (`getContactBpos.ts:52`), the **public client-safe route** (`app/bpo/[slug]/route.ts`, offer strategy stripped). The **finalize** action lives only on `/admin/bpo/[slug]`. So, exactly like the CMA card, the contact-card "Review" takes the broker to the client-facing view, from which they cannot finalize — and a BPO must be finalized before Send Center will send it. Reaching finalize requires manually navigating to `/admin/bpo/[slug]`.

### 2.4 Duplication
BPO exists on the person page in two places (`ContactBpoCard` for build/review + `ContactSendCenter` BPO tab for send), with the build/review/send steps split across three routes (`ContactBpoCard`, `/admin/bpo/[slug]`, `ContactSendCenter`).

---

## 3. Newsletter

### 3.1 Surfaces
- `/admin/newsletters` (list, `page.tsx`) → `/admin/newsletters/[id]` (compose/preview/approve/stats) → `/admin/newsletters/subscribers`, `/admin/newsletters/analytics`, `/admin/newsletters/new`.
- Compose is a **raw HTML `<Textarea>`** (`NewsletterComposeForm.tsx:147`), not a rich editor — the broker hand-writes HTML. "Preview as broker" iframe (`NewsletterComposeForm.tsx:220`) and "Send test to me" exist.
- Send: `NewsletterDraftActions.tsx` "Send now" → confirm dialog with audience preview → `adminSendNewsletterAction` (`app/actions/newsletter.ts:349`) → **enqueue** (`enqueueNewsletter`), drained by cron `/api/cron/newsletter-send` (`vercel.json:4`, every 2 min). Voice hard-fail gate (`newsletter.ts:362`), suppression per-recipient in the drain. Solid, well-instrumented.
- Bulk one-off send to a pasted list / CRM tag: `BulkOneOffForm.tsx` → `adminBulkOneOffSendAction` (`newsletter.ts:388`).
- Schedule/pause: `NewsletterScheduleControls` + `newsletters/actions.ts` (superuser-gated). Circuit-breaker on bounce/complaint.

### 3.2 Person-page newsletter send — sends an UNAPPROVED draft
On the contact page, "Send newsletter" (via `ContactQuickActions` Newsletter sheet, `ContactQuickActions.tsx:118-127`) → `sendNewsletterToContactAction` (`app/actions/contact-newsletter.ts:97`). It resolves the "current" newsletter via `resolveCurrentNewsletter` = latest **sent** issue, **falling back to the newest DRAFT with a body** (`contact-newsletter.ts:83-93`).

**DEFECT (approval bypass).** If no newsletter has been sent yet, this one-click action emails the **newest unreviewed draft** to a live lead. There is a voice gate (`contact-newsletter.ts:126`) but **no approval gate** — the bulk send path requires a superuser to click "Send now" through a confirm dialog, while the per-contact path sends whatever draft happens to be newest with zero review. Draft-first is violated for the one-off contact path.

### 3.3 Newsletter enrollment IS reachable from the person page
Yes — `ContactQuickActions` Newsletter chip/sheet toggles `setNewsletterSubscription` (`ContactQuickActions.tsx:83`). Subscribed state shows live. So the audit question "is newsletter enrollment reachable from the person page" = **yes**, via `ContactQuickActions` (subscribe toggle) and the SubscriberRow admin surface separately.

### 3.4 Subscriber model is a fourth, separate audience
`newsletter_subscribers` is its own table with its own segment vocabulary (general/buyer/seller/past-client), separate from `crm_report_subscriptions`, `listing_alerts`, and CRM sequences. Four disjoint subscription models, four toggle surfaces.

---

## 4. Market reports

### 4.1 Three write-surfaces for the same subscription, on the same page
`crm_report_subscriptions` (one row per person) is written from **three** places on the contact page:
1. `ContactSendCenter.tsx:262` Report tab — pick areas + "Also subscribe monthly" checkbox → `setReportSubscriptionAction` with **frequency hardcoded `'monthly'`** (`ContactSendCenter.tsx:134`).
2. `ContactQuickActions.tsx:217` "Market reports" sheet → embeds `ReportSubscriptionsPanel` → `setReportSubsForm` → `setReportSubscriptionAction`.
3. Standalone `ReportSubscriptionsPanel` again in the website-activity rail (`crm/[id]/page.tsx:652`) → same `setReportSubsForm`.

**DUPLICATION (severe).** The same subscription is editable in three visually different controls on one screen, two of which (`ReportSubscriptionsPanel`) are literally the same component rendered twice, and one of which (`ContactSendCenter`) silently forces monthly cadence regardless of what the panel says. A broker setting weekly in the panel and then using Send Center's subscribe checkbox would flip it back to monthly.

### 4.2 Send now
- `sendMarketReportNowAction` (`app/actions/crm-send-now.ts:25`) — validates area slugs against the registry, renders via `renderMarketReportEmail`, `sendOneSubscriber` (suppression fail-closed), timeline row. Reachable from `ContactSendCenter` Report tab and `ReportSubscriptionsPanel` "Send report now". Solid.

### 4.3 Cadence cron
- `/api/cron/crm-market-report-send` (`vercel.json:32`, 4×/day) → `runMarketReportSend` (`lib/crm/market-report-send.ts:360 lines`) — cadence-aware, §0-accurate cache-only data, per-contact suppression. Solid and well-tested.
- Separate weekly `/api/cron/market-report` (`vercel.json:84`) → `generateWeeklyMarketReport` — generates the public `market_reports` artifact (different product; page `/reports/city/...`).

### 4.4 Admin visibility
- `/admin/crm/settings/market-reports` (`page.tsx`) — subscriber list with per-row preview dialog + verification trace. Scoped (superuser sees all, broker sees own). Clean.
- `/admin/crm/subscriptions` (`page.tsx` + `SubscriptionsHub.tsx`) — 4-tab hub: Listing alerts / Saved searches / Market reports / Delivery. This is the closest thing to a real "what's going out" console, and it's good — but it is a **separate destination** from every send surface, and it duplicates the market-report subscriber view that also lives at settings/market-reports.

### 4.5 Self-serve
Signed-in users self-manage at `/account/notifications` via `market-report-optin.ts`. Separate model surface again.

---

## 5. Saved-search / listing alerts

### 5.1 Can a broker create a saved-search alert on behalf of a lead?
**Yes, via two different surfaces with different behavior:**
1. `ContactSendCenter.tsx:290` Listings tab → `sendListingMatchesForContactAction` (`app/actions/contact-listing-matches.ts:47`) — creates a broker-origin `listing_alerts` row **AND emails current matches immediately**, with cadence weekly/daily.
2. Inline "Add saved search" form on the contact page (`crm/[id]/page.tsx:682-700`) → `assignSavedSearchForm` (`form-actions.ts:107`) → `adminAssignSavedSearchAction` (`newsletter.ts:233`) — creates the alert **but sends nothing**.

**DUPLICATION.** Two saved-search-creation paths on one page: one sends-and-subscribes, one only subscribes. Field sets differ (Send Center has subdivision + min-beds + cadence; the inline form has city + price + beds). A broker cannot tell which one to use, and the results land in the same `listing_alerts` table with different `origin`/behavior.

### 5.2 Read/manage
- `ContactListingAlertsPanel.tsx` (read-only, contact page, `crm/[id]/page.tsx:658`) — shows criteria + active/paused + cadence + deep link. No edit/pause control here.
- `ContactQuickActions` Saved-searches sheet (read-only list).
- Inline form supports **remove** (`deleteSavedSearchForm`, `form-actions.ts:137`) but not edit/pause.
- Full management (pause, bulk, edit) lives only on `/admin/crm/subscriptions` (Alerts + Saved-searches tabs). So per-contact you can create and delete but not pause/edit; you must leave to the hub.

### 5.3 Cron
`/api/cron/saved-search-alerts` (`vercel.json:128`, hourly) → `runListingAlerts` (`app/actions/saved-search-alerts.ts`), unified `listing_alerts` scan, 200 sends/run cap, suppression fail-closed. Solid.

---

## 6. One-off email

### 6.1 Surfaces
- `/admin/email` → redirect to `/admin/email/compose` (`app/admin/(protected)/email/page.tsx`).
- `/admin/email/compose` has **two** stacked composers (`compose/page.tsx`):
  - `ComposeToCohort.tsx` (432 lines) — smart-list/stage audience → template/inline → live preview count → send now/schedule → `dispatchComposeCohortAction`/`scheduleComposeCohortAction`, drained by `crm-scheduled-sends` cron. Rich, correct.
  - `AdminEmailCompose.tsx` (70 lines) — one arbitrary recipient → `sendAdminEmail` (`app/actions/admin-email.ts:7`), suppression fail-closed, logs a fake 1-recipient `email_campaigns` row (`admin-email.ts:32`).
- `/admin/email/campaigns` (`page.tsx`) — sent-campaign engagement, read from `email_events`. Read-only.
- Per-contact email: the person page center column `EmailComposer` (`crm/[id]/page.tsx:533`) → `sendEmailForm` → `sendCrmEmailAction`. This is the real 1:1 send.

### 6.2 Observations
- The one-off `sendAdminEmail` (`admin-email.ts`) sends from the **transactional mailbox** (no broker identity, no `attributeOutbound` tracking, no timeline row on any contact) — it's a fire-and-forget that only writes a synthetic campaign row. Contrast with the person-page `EmailComposer` which threads to the contact. Two very different "send one email" behaviors depending on which surface you're on.
- `SendDocDialog.client.tsx` (used by Expireds/FSBO) is the **only** send surface that unifies channel choice (email/SMS tabs), template picking with live pre-merge, and the canonical `EmailComposer`/`SmsComposer`. None of the CRM-side CMA/BPO/report send surfaces reuse it — they use bespoke one-button dialogs instead.

---

## 7. Mobile parity — the send domain is desktop-only

The person page mobile layout (`crm/[id]/mobile-detail.tsx`) renders six tabs: **Info, Activity, Comms, Homes, Notes, Calendar** (`mobile-detail.tsx:258-306`). There is **no CMA card, no BPO card, no `ContactSendCenter`, no market-report control, no newsletter toggle, no saved-search create** on mobile. `ContactCmaCard`, `ContactBpoCard`, `ContactSendCenter`, `ReportSubscriptionsPanel`, `ContactListingAlertsPanel`, and `ContactQuickActions` are rendered only inside the `hidden md:block` desktop tree (`crm/[id]/page.tsx:483`, `:588-704`).

**DEFECT (critical mobile divergence).** On a phone — where the owner said he needs to "get to the site and send it in seconds" — the entire send domain is absent. The only outbound capability on mobile is the free-text `MobileCommsTab` SMS/email composer (`mobile-detail.tsx:295`, `:105`). A broker who gets a text "lead X wants a CMA" and opens the site on their phone **cannot build, approve, or send a CMA/BPO/market-report at all.** The `/admin/cmas`, `/admin/bpo`, `/admin/newsletters` list pages are reachable on mobile but the CMA list is the only one with a mobile card fork; the others render desktop tables in horizontal scroll.

---

## 8. Dead / retired / orphaned wiring

- **Legacy `cma_deliveries` pipeline** (`lib/cma-delivery.ts`, `/api/cma-delivery`, `/cma-drafts/[id]` + `/send`) — declared retired for new builds (`contact-cma.ts:6-11`) but still fully wired: read on the person page (`crm.ts:370`), surfaced via `OwnedHomeCard` (`reviewDeliveryId`), and sendable via the UUID branch of `sendCmaForContactAction` (`contact-cma.ts:250`). The `OwnedHomeCard` "Review comp" link into `/cma-drafts/[id]` is token-less and dead-ends (§1.5).
- **Legacy CMA API routes** `/api/cma/[slug]/email`, `/gmail-draft`, `/finalize-deliver` — reference the pre-2026-07 file-based producer (`public/cmas/<slug>/cma.html`); admin/cron gated, still live, no UI points at them anymore.
- **Legacy CMA tracking pixel** `/api/cma/[slug]/track` — parallel to the canonical `/api/track/e/*` (§1.8).
- **`NextStepCard.tsx`** (`components/admin/crm/NextStepCard.tsx`, 106 lines) — imported by the person page but only `getContactNextStep` output is consumed; the component itself is referenced only in its own file per grep (the page uses `OwnedHomeCard` for the CMA next-step instead). Appears orphaned; verify before deletion.

---

## 9. What actually works (so the rebuild keeps it)

- `sendCmaToLead` (`lib/cma/send.ts`) and `sendBpoToLead` (`lib/bpo/send.ts`) — correct Gmail-DWD-with-Resend-fallback rails, suppression fail-closed, attribution + tracking, timeline logging. Keep the libs; kill the redundant surfaces on top.
- `runMarketReportSend`, `runListingAlerts`, newsletter enqueue+drain — cron send engines are well-built, cadence-aware, suppression-safe, tested.
- `/admin/crm/subscriptions` 4-tab hub + `ContactDeliveryPanel` — the only good "what went out / what's subscribed" observability. Should become the spine, not a side page.
- `SendDocDialog.client.tsx` — the one send UI that does channel + template + canonical composer right. It should be the template for the unified send surface.
- Suppression is enforced at every send path (verified: CMA, BPO, market report, newsletter, listing matches, admin one-off all call `isSuppressed`/`isSuppressedByEmail`). This is the one consistent thing across the domain.

---

## 10. Source-of-truth notes

- CMA system of record: `public.cmas` (rows ≈ 155). BPO: `public.broker_price_opinions`. These are correct.
- **Wrong-source risk:** `ContactCmaCard`/`getContactCmas` read `cmas.preview_url` which the builder never populates (§1.6) → Review button missing. `OwnedHomeCard` reads retired `cma_deliveries` (§1.5). Both surface stale/absent data on the primary contact screen.
- Newsletter/report/alert subscriptions live in four disjoint tables (`newsletter_subscribers`, `crm_report_subscriptions`, `listing_alerts`, CRM sequences) with four separate toggle surfaces and no unified "what is this person subscribed to" write-model — only `ContactDeliveryPanel` reads across them.
