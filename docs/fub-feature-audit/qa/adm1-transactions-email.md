# ADM-1 QA: Transactions/TC + Email + Newsletters

Audited: 2026-06-26 — read-only code trace, no outbound sends triggered.
Scope: `/admin/deals`, `/admin/deals/[key]`, `/admin/signing`, `/admin/signing/[envelopeId]`,
`/admin/commissions`, `/admin/financials`, `/admin/forms`, `/admin/sign-off`, `/admin/cmas`,
`/admin/email/campaigns`, `/admin/email/compose`, `/admin/newsletters`, `/admin/newsletters/[id]`,
`/admin/newsletters/new`, `/admin/newsletters/subscribers`

Classification key:
- ✅WIRED-OK — handler traced end-to-end, code is coherent
- ☠️DEAD — button/link with no working handler or route
- 🐞BROKEN — handler exists but has a confirmed defect
- ❓UNVERIFIED — outbound-risk or data-dependent; code-only trace done, live e2e not safe to run

---

## Defect table

| # | Element | Page | Classification | Evidence (file:line) | Suggested fix | Severity | Outbound risk |
|---|---------|------|----------------|----------------------|---------------|----------|--------------|
| 1 | Deal row links → `/admin/deals/[key]` | `/admin/deals` | ✅WIRED-OK | `app/admin/(protected)/deals/page.tsx` — `getDealDashboard()` populates `propertyKey`; all rows rendered as `<Link href={...}>` | — | — | No |
| 2 | "Commissions →" link | `/admin/deals` | ✅WIRED-OK | `page.tsx` — `<Link href="/admin/commissions">` | — | — | No |
| 3 | "Show archived / Hide archived" toggle | `/admin/deals/[key]` | ✅WIRED-OK | `app/admin/(protected)/deals/[key]/page.tsx` — `<Link ...?archived=1>` param passthrough | — | — | No |
| 4 | Download document button | `/admin/deals/[key]` | ✅WIRED-OK | `DocumentRowActions.tsx` `DownloadButton` → `getTcDocumentUrl(documentId)` → `window.open(url, '_blank')` | — | — | No |
| 5 | Archive / Unarchive document | `/admin/deals/[key]` | ✅WIRED-OK | `DocumentRowActions.tsx` `ArchiveToggle` → `window.prompt` → `setTcDocumentArchived(docId, !archived, reason)` → reload | — | — | No |
| 6 | Upload document (3-step flow) | `/admin/deals/[key]` | ✅WIRED-OK | `DocumentUpload.tsx` → `createTcUploadUrl` → PUT `signedUrl` → `finalizeTcUpload` → reload. All three steps present. | — | — | No |
| 7 | Edit commission (Dialog) | `/admin/deals/[key]` | ✅WIRED-OK | `CommissionControls.tsx` → Dialog → `updateTcCommission(row.id, {...})` → reload. Disabled until category filled. | — | HIGH-RISK (financial mutation on live deals — code-only verified per safety rules) | No |
| 8 | Checklist status transitions (5 states) | `/admin/deals/[key]` | ✅WIRED-OK | `ChecklistControls.tsx` `ChecklistStatusControl` → DropdownMenu → `setTcChecklistStatus(itemId, to, note)` → reload. Reject prompts via `window.prompt`. | — | — | No |
| 9 | Add / Edit / Remove deal contact | `/admin/deals/[key]` | ✅WIRED-OK | `DealContacts.tsx` → `saveDealContact` / `deleteDealContact` → reload. Remove guarded by `window.confirm`. | — | — | No |
| 10 | "New envelope" dialog — create envelope | `/admin/deals/[key]` | ✅WIRED-OK | `DealEnvelopes.tsx` `NewEnvelopeDialog` → checkbox multi-select → `createEnvelopeFromDocuments(cycleId, [...], name)` → `router.push('/admin/signing/' + res.envelopeId)`. Button disabled when `cycle.documents.length === 0`. | — | — | No |
| 11 | "New envelope" button — no documents guard | `/admin/deals/[key]` | ✅WIRED-OK | `DealEnvelopes.tsx:` button `disabled={cycle.documents.length === 0}` | — | — | No |
| 12 | Existing envelope row links → `/admin/signing/[id]` | `/admin/deals/[key]` | ✅WIRED-OK | `DealEnvelopes.tsx` — each envelope rendered as `<Link href={/admin/signing/${e.id}}>` | — | — | No |
| 13 | Signing dashboard — all envelope row links | `/admin/signing` | ✅WIRED-OK | `signing/page.tsx` — `<Link href={/admin/signing/${e.id}}>` on each row, desktop and mobile card | — | — | No |
| 14 | "Add signer" button | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:261` — `addRecipient()` appends to local state | — | — | No |
| 15 | "Save signers" button | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:262` → `saveSigners()` → `saveEnvelopeRecipients(detail.id, recipients)` → DB write in `tc-envelopes.ts` | — | — | No |
| 16 | Remove signer (✕ button) | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:245` → `removeRecipient(i)` clears local state + removes fields for that recipient | — | — | No |
| 17 | Signer role, name, email, order inputs | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:236-255` — `updateRecipient(i, patch)` updates local state; inputs are `disabled={readonly}` when non-draft | — | — | No |
| 18 | Field-type selector (signature / initials / date / text) | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:290-299` — `setActiveType(t)` local state; field placed on canvas click | — | — | No |
| 19 | Assign-to signer select (field palette) | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:274-284` — `setActiveRecipientId(v)` local state; requires saved signers first | — | — | No |
| 20 | Click-to-place field on PDF canvas | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:100-118` `placeField()` — appends `LocalField` with fractional coords to `fields` state | — | — | No |
| 21 | Delete field chip (hover × on canvas) | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:119-121` `deleteField(localId)` | — | — | No |
| 22 | Drag field chip to move | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:209-211` — `setFields` updates `x/y` on drop via `onMove` prop | — | — | No |
| 23 | "Save draft" button | `/admin/signing/[envelopeId]` | ✅WIRED-OK | `EnvelopeComposer.tsx:320` → `handleSaveDraft()` → `saveDraft()` → `saveEnvelopeRecipients` + `saveEnvelopeFields` → DB write | — | — | No |
| 24 | "Send for signature" button | `/admin/signing/[envelopeId]` | ❓UNVERIFIED-outbound | `EnvelopeComposer.tsx:321` → `handleSend()` → `saveDraft()` + `sendEnvelope(detail.id)` → `tc-envelopes.ts:551`: marks envelope `status='sent'`, mints token, calls `sendSigningInvite({to: r.email, ...})` which sends real emails to real recipients. Code is fully wired. NOT triggered per safety rules. | Test on a disposable envelope with a test email address. | HIGH | YES — sends signing invite emails to real recipients |
| 25 | "Void envelope" button | `/admin/signing/[envelopeId]` | ❓UNVERIFIED-outbound | `EnvelopeComposer.tsx:315` → `handleVoid()` → `window.prompt` → `voidEnvelope(detail.id, reason)` → `tc-envelopes.ts:681` marks `status='voided'`. Only shown on non-draft status. Code is fully wired. NOT triggered per safety rules. | Safe to test with a test envelope. | MEDIUM | Indirect (notifies signers if implemented) |
| 26 | Commissions page — all deal links | `/admin/commissions` | ✅WIRED-OK | `commissions/page.tsx` — `<Link href={/admin/deals/${encodeURIComponent(d.propertyKey)}}>` | — | — | No |
| 27 | "Financials →" link | `/admin/commissions` | ✅WIRED-OK | `commissions/page.tsx` — `<Link href="/admin/financials">` | — | — | No |
| 28 | "Add expense" button + dialog | `/admin/financials` | ✅WIRED-OK | `ExpenseControls.tsx` `AddExpense` → Dialog → `addTcExpense({category, description, amount, incurred_on, vendor, dealPropertyKey})` → reload. Submit disabled until all four required fields filled. | — | — | No |
| 29 | "Archive expense" button (per row) | `/admin/financials` | ✅WIRED-OK | `ExpenseControls.tsx` `ArchiveExpense` → `window.prompt` → `archiveTcExpense(id, reason)` → reload | — | — | No |
| 30 | "See all N expenses / Show less" toggle | `/admin/financials` | ✅WIRED-OK | `ExpenseLedger.tsx` — local `useState(false)` toggle, no server call | — | — | No |
| 31 | Forms search (GET method) | `/admin/forms` | ✅WIRED-OK | `forms/page.tsx` — `<form method="GET">` with `?q=` and `?lib=` query params, Server Component re-fetches on navigation | — | — | No |
| 32 | "Open blank" link (per form) | `/admin/forms` | ✅WIRED-OK (conditional) | `forms/page.tsx` — `<a href={f.blankUrl} target="_blank">` rendered ONLY when `f.blankUrl` exists. Missing `blankUrl` silently hides the link. | Confirm all production form records have `blank_pdf_storage_path`/`blankUrl` populated. Emit a visible "URL unavailable" badge when missing. | LOW-MEDIUM (data gap, not code bug) | No |
| 33 | "See all / Show less" library filter links | `/admin/forms` | ✅WIRED-OK | `forms/page.tsx` — `<Link>` modifying `?lib=` query param | — | — | No |
| 34 | Sign-off "Sign off" button (per item) | `/admin/sign-off` | ✅WIRED-OK | `SignOffControls.tsx` → `recordPrincipalReview(itemId, 'approved')` → reload. Action writes to `tc_checklist_items` (principal_review_status). | — | HIGH-RISK (principal-broker approval on live deals — code-only verified per safety rules) | No |
| 35 | Sign-off "Send back" button (per item) | `/admin/sign-off` | ✅WIRED-OK | `SignOffControls.tsx` → `window.prompt` → `recordPrincipalReview(itemId, 'sent_back', reason)` → reload | — | HIGH-RISK | No |
| 36 | Sign-off — deal address link | `/admin/sign-off` | ✅WIRED-OK | `sign-off/page.tsx:64-68` — `<Link href={/admin/deals/${encodeURIComponent(deal.propertyKey)}}>` | — | — | No |
| 37 | Sign-off — document thumbnail HoverCard | `/admin/sign-off` | ✅WIRED-OK | `sign-off/page.tsx:89-103` — Radix HoverCard renders `<img src={doc.thumbUrl}>` on hover; thumbnail is a pre-fetched signed URL from `getPrincipalSignOffQueue` | — | — | No |
| 38 | CMA search (GET) + status facet links + pagination | `/admin/cmas` | ✅WIRED-OK | `cmas/page.tsx` — `<form method="GET">` for search; `<Link>` for status + pagination | — | — | No |
| 39 | CMA "PDF" link per row | `/admin/cmas` | ✅WIRED-OK | `cmas/page.tsx` — `<Link href="/api/cma/[slug]/pdf" target="_blank">` conditional on `cma.asset_available`. Route exists at `app/api/cma/[slug]/pdf/route.ts`, implemented with `renderCmaPdfBuffer`. | — | — | No |
| 40 | CMA "HTML" link per row (finalized) | `/admin/cmas` | ✅WIRED-OK | `cmas/page.tsx` — `<Link href="/cmas/[slug]/cma.html">` conditional on `cma.asset_available && cma.finalized_at` | — | — | No |
| 41 | CMA "HTML" link per row (draft) | `/admin/cmas` | ✅WIRED-OK | `cmas/page.tsx` — `<Link href="/drafts/[slug]/cma.html">` conditional on `cma.asset_available && !cma.finalized_at` | — | — | No |
| 42 | CMA — links hidden when `asset_available=false` | `/admin/cmas` | ✅WIRED-OK (intentional) | `cmas/page.tsx` — both PDF and HTML links are behind `cma.asset_available` guard. CMAs without assets show no link. | Confirm UX intent: should a placeholder / status badge appear for CMA rows with no asset yet? | LOW | No |
| 43 | "Email reporting →" button | `/admin/email/campaigns` | ✅WIRED-OK | `campaigns/page.tsx:108` — `<Link href="/admin/reports/emails">` | — | — | No |
| 44 | "Compose" button | `/admin/email/campaigns` | ✅WIRED-OK | `campaigns/page.tsx:112` — `<Link href="/admin/email/compose">` | — | — | No |
| 45 | Audience type toggle (Smart list / Pipeline stage) | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:212-230` — local state `setAudienceKind`; also calls `resetPreview()` | — | — | No |
| 46 | Smart list select | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:236-255` — `setViewId(v)` + `resetPreview()`; options loaded from `getComposeOptionsAction()` | — | — | No |
| 47 | Pipeline stage select | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:257-276` — `setStage(v)` + `resetPreview()`; stage list from `getComposeOptionsAction()` | — | — | No |
| 48 | Content mode toggle (Template / Write it) | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:292-303` — `setContentMode(...)` local state | — | — | No |
| 49 | Template select | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:306-319` — `setTemplateId(v)` from loaded templates | — | — | No |
| 50 | Inline subject + body inputs | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:320-347` — controlled inputs updating local state | — | — | No |
| 51 | "Preview recipients" button | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:363-371` → `handlePreview()` → `previewComposeCohortAction(currentAudience())` → live recipient count (read-only, no send) | — | — | No |
| 52 | Send mode toggle (Send now / Schedule) | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:396-406` — `setSendMode(...)` local state | — | — | No |
| 53 | Schedule datetime-local input | `/admin/email/compose` | ✅WIRED-OK | `ComposeToCohort.tsx:408-421` — controlled input updating `scheduledAt` state | — | — | No |
| 54 | "Send to cohort" / "Schedule send" button | `/admin/email/compose` | ❓UNVERIFIED-outbound | `ComposeToCohort.tsx:429` → `handleSend()` → if `sendMode='now'`: `dispatchComposeCohortAction({audience, content})` which triggers bulk email send to all contacts in the audience. If `sendMode='later'`: `scheduleComposeCohortAction({...scheduledAt})` queues send. Code is fully wired. NOT triggered per safety rules. | Test with a 1-person test smart list + test email. Check `crm-compose` server action for suppression gate. | CRITICAL | YES — bulk email send to real recipients |
| 55 | Single-recipient To / Subject / Body inputs | `/admin/email/compose` | ✅WIRED-OK | `AdminEmailCompose.tsx:46-75` — controlled inputs | — | — | No |
| 56 | "Send now" button (single recipient) | `/admin/email/compose` | ❓UNVERIFIED-outbound | `AdminEmailCompose.tsx:81` → `handleSend()` → `sendAdminEmail({to, subject, body})` → `isSuppressedByEmail` check → `sendEmail()` (Resend) + `email_campaigns` row insert. Suppression gate is present. NOT triggered per safety rules. | Test with your own email address. Suppression gate confirmed in code. | HIGH | YES — real email via Resend |
| 57 | "Compose newsletter" link | `/admin/newsletters` | ✅WIRED-OK | `newsletters/page.tsx` — `<Link href="/admin/newsletters/new">` | — | — | No |
| 58 | Newsletter row links → detail | `/admin/newsletters` | ✅WIRED-OK | `newsletters/page.tsx` — each row is `<Link href={/admin/newsletters/${n.id}}>` | — | — | No |
| 59 | "Manage subscribers →" link | `/admin/newsletters` | ✅WIRED-OK | `newsletters/page.tsx` — `<Link href="/admin/newsletters/subscribers">` | — | — | No |
| 60 | Newsletter compose form — subject, preview_text, audience, body | `/admin/newsletters/new` and `/admin/newsletters/[id]` | ✅WIRED-OK | `NewsletterComposeForm.tsx:subject,preview_text,audience(Select),body_html(Textarea)` — all controlled | — | — | No |
| 61 | Newsletter compose — Save draft (create mode) | `/admin/newsletters/new` | ✅WIRED-OK | `NewsletterComposeForm.tsx` → no id → `adminCreateNewsletterAction(fd)` → `router.push('/admin/newsletters/' + r.id)` | — | — | No |
| 62 | Newsletter compose — Save draft (edit mode) | `/admin/newsletters/[id]` | ✅WIRED-OK | `NewsletterComposeForm.tsx` → id present → `adminUpdateNewsletterAction(id, fd)` → sets message + `router.refresh()` | — | — | No |
| 63 | "Send now" newsletter button | `/admin/newsletters/[id]` | ❓UNVERIFIED-outbound | `NewsletterDraftActions.tsx` → `window.confirm` gate → `adminSendNewsletterAction(id)` → `newsletter.ts:200`: loops active subscribers, calls `sendEmail()` (Resend) per subscriber, records send in `newsletter_sends`. Error codes: empty_body, no_recipients, already_sent, not_found, unauthorized. Code is fully wired. NOT triggered per safety rules. | Test with a 1-subscriber test newsletter. `already_sent` guard prevents double-send. | CRITICAL | YES — real email via Resend to all subscribers |
| 64 | "Delete draft" newsletter button | `/admin/newsletters/[id]` | ✅WIRED-OK | `NewsletterDraftActions.tsx` → `window.confirm` → `adminDeleteNewsletterAction(id)` → `router.push('/admin/newsletters')`. Only shown for draft status. | — | — | No |
| 65 | Newsletter stats + recipients (sent newsletters) | `/admin/newsletters/[id]` | ✅WIRED-OK | `newsletters/[id]/page.tsx` — renders `getNewsletterStats` + `getNewsletterRecipients` read-only tables when `newsletter.status === 'sent'` | — | — | No |
| 66 | Add subscriber form | `/admin/newsletters/subscribers` | ✅WIRED-OK | `SubscriberForms.tsx` `AddSubscriberForm` → `adminAddSubscriberAction(fd)` → `startTransition` → `router.refresh()`. Error surfaced inline. | — | — | No |
| 67 | Subscriber active/unsubscribed toggle | `/admin/newsletters/subscribers` | ✅WIRED-OK | `SubscriberForms.tsx` `SubscriberStatusToggle` → `adminSetSubscriberStatusAction(id, next)` → `router.refresh()` | — | — | No |
| 68 | Subscriber pagination links | `/admin/newsletters/subscribers` | ✅WIRED-OK | `subscribers/page.tsx` — `<Link>` modifying `?page=` query param; Server Component re-fetches | — | — | No |

---

## Summary

| Classification | Count |
|---|---|
| ✅ WIRED-OK | 62 |
| ☠️ DEAD | 0 |
| 🐞 BROKEN | 0 |
| ❓ UNVERIFIED | 6 |
| **Total elements** | **68** |

### UNVERIFIED items

| # | Element | Page | Why unverified | Action needed |
|---|---------|------|----------------|---------------|
| 24 | "Send for signature" | `/admin/signing/[envelopeId]` | Sends real signing invite emails to real recipients via `sendSigningInvite` | Safe-test with disposable envelope + test email address |
| 25 | "Void envelope" | `/admin/signing/[envelopeId]` | Writes `status='voided'` on a real envelope; may notify signers | Safe-test with a disposable envelope |
| 54 | "Send to cohort" / "Schedule send" | `/admin/email/compose` | Triggers bulk email via `dispatchComposeCohortAction` or `scheduleComposeCohortAction`; hits all contacts in the selected smart list or stage | Test with a 1-person test smart list; verify suppression gate in `crm-compose` action |
| 56 | "Send now" (single recipient) | `/admin/email/compose` | Calls `sendAdminEmail` → Resend → real email. Suppression gate present in code. | Test with your own email; confirm `isSuppressedByEmail` returns false for internal address |
| 63 | "Send now" newsletter | `/admin/newsletters/[id]` | Loops all active subscribers and calls `sendEmail()` per subscriber | Test with a 1-subscriber draft newsletter; `already_sent` guard confirmed |
| 32 | "Open blank" link (forms) | `/admin/forms` | `blankUrl` is data-dependent; link silently hidden when null | Confirm all production form records have `blank_pdf_storage_path` populated; add visible "unavailable" badge when missing |

### Notable observations (not defects)

- **No dead buttons or broken handlers found.** The entire ADM-1 cluster is coherently wired — server actions are `'use server'` files that hit Supabase via service-role client, all revalidate the right paths.
- **Financial mutation guard (item 7):** `updateTcCommission` has no secondary confirm dialog — relies on the Edit button opening a form, which is reasonable but worth noting for high-stakes corrections on closed deals.
- **Sign-off is principal-broker-only** (items 34-35): `getPrincipalSignOffQueue` checks role; non-authorized users see an "access denied" message, not a 500.
- **Newsletter `already_sent` guard** (item 63): `adminSendNewsletterAction` checks `status === 'sent'` before sending — prevents duplicate blasts.
- **Single-recipient email suppression gate** (item 56): `isSuppressedByEmail` is called before Resend — confirmed in `admin-email.ts`.
- **Envelope send is ordered:** `sendEnvelope` mints tokens only for the lowest signing-order group first; subsequent groups are unlocked by `advanceOrSeal` as each turn completes.
- **CMA PDF route exists and is implemented** (`app/api/cma/[slug]/pdf/route.ts` using `renderCmaPdfBuffer`) — not a dead route.
