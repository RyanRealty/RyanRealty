# Domain audit — Deals pipeline + Transaction coordination (TC)

Auditor scope: `app/admin/(protected)/crm/deals/**`, `app/admin/(protected)/deals/**`, `signing/**`, `forms/**`, `sign-off/**`, `commissions/**`, `financials/**`, `audit-log/**`, `app/sign/[token]`, `components/admin/crm/deals/**`, `components/tc/pdf-sign/**`, `app/actions/crm-deals.ts`, `app/actions/crm-deal-pipelines.ts`, `app/actions/deals.ts`, `app/actions/tc*.ts`, `lib/tc/**`, `lib/crm/deal-*`, `lib/data/crm/{listDealsBoard,getCrmDeal,getDealPipelines,getDealScopeRow,agentActivityClosedDeals}.ts`.

Date: 2026-07-16. Every claim below carries file:line evidence. DB ground truth pulled live from Supabase (`dwvlophlbvvygjfxcrhm`) with an audit-tagged one-off query.

---

## 0. Headline

There are **three disconnected "deal" systems** wearing one nav section, and the newest one (the in-house TC with e-signing) is **fully built but has never been used**: `tc_envelopes` = **0 rows**, `tc_principal_reviews` = **0 rows** (live DB, 2026-07-16). Meanwhile the `/admin/deals` "Transactions" dashboard renders from a **SkySlope snapshot last synced 2026-06-10 — 36 days stale** — because its only refresh path is a shell script run by hand on the Mac (`scripts/skyslope-dashboard-refresh.mjs`); no cron exists (`vercel.json` has no skyslope/tc entry). The CRM Kanban (`crm_deals`, 20 rows) shares **no key, no FK, and no sync** with the TC tables (`tc_deals`, 33 rows) — commission is recorded in three unrelated places that never reconcile. There is **no way to create a transaction from any UI**: new deals enter the TC system only via manual scripts. The e-sign flow itself (envelope → tokenized links → ordered signing → seal → certificate → email) is genuinely well engineered end-to-end, but it hangs off a stale, script-fed spine, several of its read actions are callable without any auth, and its emails fail silently.

### The three systems

| System | Tables | List UI | Detail UI | Writes | Freshness |
|---|---|---|---|---|---|
| CRM pipeline (FUB-parity) | `crm_deals`, `crm_pipelines`, `crm_deal_stages`, `crm_deal_people`, `crm_deal_splits`, `crm_deal_files`, `crm_timeline` | `/admin/crm/deals` Kanban | `?deal=` modal + orphaned `/admin/crm/deals/[id]` page | full CRUD from UI | live |
| SkySlope snapshot | `skyslope_transactions`, `skyslope_dashboard_meta` | `/admin/deals` | (feeds the list only) | none — read-only snapshot | manual script; **36 days stale** |
| In-house TC | `tc_deals`, `tc_cycles`, `tc_documents`, `tc_checklist_items`, `tc_checklist_assignments`, `tc_envelopes`, `tc_envelope_recipients/documents/fields`, `tc_commissions`, `tc_expenses`, `tc_deal_contacts`, `tc_form_libraries`, `tc_form_versions`, `tc_principal_reviews`, `tc_events` | (none — reached via `/admin/deals` links) | `/admin/deals/[key]` | docs/checklist/envelopes/commissions/contacts from UI; **deals/cycles only via scripts** | migrated once; new deals never appear |

**Linkage: none.** Grep for `tc_deal` in the CRM deal code and `crm_deal` in the TC code returns zero hits (verified across `lib/data/crm`, `app/actions/crm-deals.ts`, `app/actions/tc*.ts`, `lib/tc`). A CRM deal cannot become a transaction. `/admin/deals` list rows link to `/admin/deals/[key]` by `property_key`; that key resolves against `tc_deals.property_key` (`app/actions/tc.ts:98-104`) — a snapshot row without a migrated `tc_deals` row 404s (`app/admin/(protected)/deals/[key]/page.tsx:398-399`).

### Duplicated fields across the systems (no reconciliation anywhere)

- Price: `crm_deals.value` ↔ `tc_cycles.sale_price` ↔ `skyslope_transactions.headline.salePrice`
- Commission: `crm_deals.commission_dollars` + `crm_deal_splits` ↔ `tc_commissions` (gci/fees/split/nets) ↔ snapshot `officeGross`
- Close date: `crm_deals.close_date`/`actual_close_date` ↔ `tc_cycles.escrow_closing_date`/`actual_closing_date`
- Address: `crm_deals.property_address` ↔ `tc_deals.address`
- Broker: `crm_deals.assigned_broker` (slug: `matt`) ↔ `tc_deals.broker_name` (full name) — different formats, no mapping table
- Contacts: `crm_deal_people` (CRM persons) ↔ `tc_deal_contacts` (free-text names) ↔ `tc_cycles.sellers/buyers` (string arrays)

Reporting reads different sources: Agent Activity "closed deals" reads `crm_deals` (`lib/data/crm/agentActivityClosedDeals.ts:54`); `/admin/commissions` + `/admin/financials` read `tc_commissions`; `/admin/deals` KPIs read the stale snapshot. **Three different "how much did we close" answers.**

### DB ground truth (live query, 2026-07-16)

```
crm_deals 20 · crm_pipelines 2 · crm_deal_stages 11
tc_deals 33 · tc_cycles 51 · tc_documents 2,358 · tc_events 103
tc_envelopes 0 (0 completed) · tc_principal_reviews 0
tc_commissions 22 · tc_expenses 1 · tc_form_versions 111 (active)
skyslope_transactions 33 · last synced 2026-06-10 00:35 UTC
```

Read: the e-sign system, the composer, the public signing page, the sealer, the sign-off queue — all real code, **zero production use**. The forms library is loaded (111 versions) but the only UI path that could consume templates (`createEnvelopeFromTemplate` / `createDraftEnvelope`) is **wired to nothing** (see §11).

---

## 1. `/admin/crm/deals` — CRM Deals Kanban

**File:** `app/admin/(protected)/crm/deals/page.tsx` · board `components/admin/crm/deals/DealsBoard.tsx` · sub-bar `DealsSubBar.tsx` · dialogs `DealsDialogs.tsx`

**Purpose:** FUB-parity dual-pipeline (Buyers/Sellers) Kanban over `crm_deals`.

**Data path:** `getCrmAccess()` → `getDealPipelines()` (cached 300s, tag `crm-deal-pipelines`; static fallback if tables empty — `lib/data/crm/getDealPipelines.ts:49-64`) + `listDealsBoard(scoped, {status, agent})` (uncached, broker scope enforced in the DAL — `lib/data/crm/listDealsBoard.ts:95`) + `getCrmBrokers()`, in one `Promise.all` (`page.tsx:68-72`). Filters and the open modal all live in the URL (`?pipeline=&status=&agent=&deal=`).

**Mutations:** drag-to-restage → `restageCrmDeal` (`app/actions/crm-deals.ts:114-179`) with optimistic override + revert-on-failure + inline error banner (`DealsBoard.tsx:374-390, 400-404`) — this is the best-executed mutation UX in the whole domain. Add deal (per-column `+`) → `createCrmDeal` (`crm-deals.ts:273-354`, validates stage against live config, self-assigns creator, scope-checks the attached contact). Stage add/edit/delete/reorder → `crm-deal-pipelines.ts` (owner-only, renames cascade to `crm_deals` rows stored BY NAME, deletes refused while deals exist — `crm-deal-pipelines.ts:126-132, 154-163`).

**Correctness notes:**
- `restageCrmDeal` validates the target stage only when `row.pipeline` is set (`crm-deals.ts:138`) — a pipeline-less deal accepts ANY stage string.
- Stage/pipeline stored by name (strings), not FK. Renames cascade in a second non-transactional update (`crm-deal-pipelines.ts:121-132`) — a crash between the two leaves every deal in the renamed stage orphaned into the board's "Unsorted" column.
- `entered_stage_at` is overwritten on every restage; there is no stage-history table, so "time in stage" history is unrecoverable.
- Board totals sum `value` per column client-side (`DealsBoard.tsx:226`) — fine at 20 rows.

**Steps-to-job:** restage = 1 drag (desktop). Add deal = 1 click + 2 required fields + Create (good). Open deal = 1 click.

**Mobile:** `< md` renders a **read-only stacked list** (`DealsBoard.tsx:471-515`): no drag, **no add-deal button, no stage editing**, and since the detail modal has no stage control either (§2), **a phone user cannot move a deal to a new stage at all, anywhere**. Root gets the navy `MobileCrmHeader` (`page.tsx:103-110`); mobile tab bar has a Deals entry (`components/console/CrmMobileTabBar.tsx:35`).

**Verdict: WORKS** (desktop). Best surface in the domain. Mobile is a viewer, not a tool.

---

## 2. `?deal=<id>` — Deal detail modal (§11)

**File:** `components/admin/crm/deals/DealDetailModal.tsx`, mounted by the board page when `?deal=` is set (`page.tsx:90-95, 135-142`).

**Data path:** server-side `getCrmDeal(dealId)` (cached 30s, tag `crm-deal-detail` — `lib/data/crm/getCrmDeal.ts:129-133`) + **scope check `dealInScope` before render** (`page.tsx:93-95`) — correct.

**Mutations:** click-to-edit fields (price, 5 milestone dates, commission $, address, description, close date) via `updateCrmDeal`; people link/unlink via `addDealPerson`/`removeDealPerson` (junction + legacy `person_id` pointer kept coherent — `crm-deals.ts:370-374, 394-407`); splits add/remove; files add-by-URL/remove; archive/restore. Each mutation → `router.refresh()`; single shared error strip (`DealDetailModal.tsx:283-285`).

**Defects:**
- **No stage control.** The modal shows the stage as a breadcrumb only (`DealDetailModal.tsx:253-267`). Desktop users must close the modal and drag; mobile users have no path (see §1).
- **Every card click is a full server re-render of the whole page** — `?deal=` navigation re-runs `listDealsBoard` + `getCrmDeal` on the server before the modal appears (`page.tsx:68-92`). No client-side cache; opening 5 deals = 5 full board refetches. No pending indicator while the RSC roundtrip happens — the click feels dead for its duration.
- "Custom fields" section is a stub: "Show all fields" always reveals "No custom deal fields defined." (`DealDetailModal.tsx:412-425`).
- Files are **URL links only** — no upload. The TC side has real storage upload; the CRM side asks the broker to paste a URL (`DealDetailModal.tsx:459-499`).
- `updateCrmDeal` passes the client patch straight into `.update(patch)` with **no runtime key whitelist** (`crm-deals.ts:74-93`) — a forged request can set any `crm_deals` column (e.g. `status`, `person_id`, `entered_stage_at`), and a **restricted broker can reassign `assigned_broker`** (in `DealPatch`, `crm-deals.ts:70`) even though the UI hides the Team select from non-owners (`DealDetailModal.tsx:635-651`).
- Split add takes a bare % with no validation that splits sum ≤ 100 and no dollars computation (`DealDetailModal.tsx:565-605`; `addDealSplit` `crm-deals.ts:183-199` stores whatever arrives).

**Verdict: WORKS** with gaps (no stage change, stub custom fields, no real file upload).

---

## 3. `/admin/crm/deals/[id]` — ORPHANED duplicate full-page deal detail

**Files:** `app/admin/(protected)/crm/deals/[id]/page.tsx` + `DealHeader.tsx` + `DealMilestones.tsx` + `DealCommission.tsx` + `DealFiles.tsx` (604 lines total).

This is a pre-modal full-page edition of §2: same `getCrmDeal` read, same `updateCrmDeal`/split/file mutations, same fields, different layout.

- **Nothing links to it.** Repo-wide grep for `crm/deals/${` and `href=.*crm/deals/` finds zero inbound links (the person-detail rail's deals section links only to the board — `components/admin/crm/person-detail/PersonRightRail.tsx:689`; deal rows there aren't links at all, lines 698-712). Reachable only by hand-typed URL.
- **Missing the scope check the modal has.** It calls `getCrmAccess()` then renders `getCrmDeal(numId)` for ANY id (`[id]/page.tsx:38-44`); `getCrmDeal` is an unscoped service-role read (`lib/data/crm/getCrmDeal.ts:56-127`). A restricted broker can read any other broker's deal — value, commission, splits, milestones — by URL. Contrast the board page's `dealInScope` gate (`crm/deals/page.tsx:93-95`). Mutations from this page still enforce scope server-side, so it's a **read** leak.
- People section here shows only the legacy single `person` and says "No contact linked." when the junction is used but `person_id` is null-ish path differs from the modal's full `people` list (`[id]/page.tsx:103-128`).
- `generateMetadata` operator-precedence bug: `deal?.name ?? `Deal #${id}` + ' | CRM | Admin'` — when the deal has a name the title carries no " | CRM | Admin" suffix; when it doesn't, it becomes `Deal #12 | CRM | Admin` (`[id]/page.tsx:17`). Cosmetic but indicative.

**Verdict: DEAD/DUPLICATE + scope leak.** Two maintained UIs for the same job; this one is unreachable and less safe.

---

## 4. `/admin/crm/deals/pipelines` — Manage Pipelines

**Files:** `pipelines/page.tsx`, `components/admin/crm/deals/ManagePipelines.tsx`, actions `app/actions/crm-deal-pipelines.ts`.

Superuser-only (route redirect `pipelines/page.tsx:24` + every action re-checks `requireOwner()` `crm-deal-pipelines.ts:36-42`). Add/rename/reorder/delete pipelines; renames cascade to `crm_deals.pipeline` strings (`crm-deal-pipelines.ts:248-250`); deletes refused while deals exist (`:266-272`). Reorder loops per-row updates (N queries, not transactional — `:288-295`) — harmless at 2 pipelines. Grip icon suggests drag-reorder but only up/down chevron buttons work (`ManagePipelines.tsx:103, 105-125`) — decorative affordance.

**Verdict: WORKS.**

---

## 5. `/admin/crm/reporting/deals` — deferred stub

`app/admin/(protected)/crm/reporting/deals/page.tsx` is a `redirect('/admin/crm/deals')` (deliberate, documented §21 deferral). Fine, but the sub-nav tab labeled "Deals" that lands you back on the board is a small dead-end loop for the user.

---

## 6. `/admin/deals` — "Transactions" dashboard (SkySlope snapshot)

**File:** `app/admin/(protected)/deals/page.tsx` (657 lines) · data `app/actions/deals.ts`.

**Purpose:** every SkySlope transaction: live pipeline cards with step tracker + checklist %, closed compliance table, action items, dead files.

**Data path:** `getDealDashboard()` reads `skyslope_transactions` (SELECT *) + `skyslope_dashboard_meta` (`deals.ts:136-139`); dev fallback to `tmp/skyslope-master/master.json` (`:103-121`). Populated ONLY by `scripts/skyslope-dashboard-refresh.mjs` run manually (script header: "Usage: node --env-file=.env.local ..."). **No cron** — `vercel.json` crons contain no skyslope/tc path. **Live DB shows last sync 2026-06-10 → the "Live pipeline", "Under contract" KPI, and every action item on this page have been 5 weeks stale.** The page shows "Synced 2026-06-10" in small print (`page.tsx:224`) but no staleness warning.

- The empty state literally instructs the user to run a node script (`page.tsx:200-215`) — an admin dead end for anyone but a developer.
- The footer repeats the script name as the refresh mechanism (`page.tsx:647-653`).
- The page's checklist/step tracker is derived by regex over SkySlope activity names (`page.tsx:37-64`) — display heuristics, not the tc_checklist state that the detail page mutates. **The list's "Checklist 12/19 filled" and the detail's checklist statuses come from two different systems**; approving items on the detail page never changes the list.
- Compliance/Broker-Notes badges (`BnBadge`, `ComplianceBadge`) render snapshot rollups — also frozen at last sync.
- `app/actions/deals.ts` builds its own `createClient` (`:96-101`) — service-role read in an action file with no role check beyond the layout gate. Any admin role (incl. report-viewer-class roles) sees all sale prices + office gross.
- Memory/process rule says "Vault is the sole source of truth for transaction coordination; never reconcile against SkySlope" — this page IS a SkySlope reconciliation surface presented as the Transactions home.

**Mobile:** closed deals + dead files fork into stacked-card lists (`page.tsx:341-372, 573-602`); live pipeline cards stack fine. Parity is decent here.

**Verdict: PARTIAL — real UI over stale, manually-fed, read-only data; presented as the live "Transactions" home.**

---

## 7. `/admin/deals/[key]` — TC transaction detail

**File:** `app/admin/(protected)/deals/[key]/page.tsx` (518 lines) + `DocumentUpload.tsx`, `DocumentRowActions.tsx`, `ChecklistControls.tsx`, `CommissionControls.tsx`, `DealContacts.tsx`, `DealEnvelopes.tsx` · data/mutations `app/actions/tc.ts`, `tc-contacts.ts`, `tc-commissions.ts`, `tc-required-docs.ts`, `tc-envelopes.ts`.

**Purpose:** the real TC working surface: per-cycle documents (with hover first/last-page previews), Oregon anticipated-documents matrix, commission rows, checklist with review statuses, deal contacts, envelopes, event feed.

**Data path (waterfall):** `getTcDeal(key)` → then `getDealContacts(deal.id)` → then `getCommissionsForCycles(...)` → then per-cycle `getAnticipatedDocuments` (parallel) → then per-cycle `getEnvelopesForCycle` (parallel) (`[key]/page.tsx:398-419`). Five sequential await stages; `getTcDeal` itself is deal → cycles → docs/items/assignments/events → signed thumb URLs (`tc.ts:100-148`). For a 2-cycle deal ≈ 15+ DB roundtrips plus 2×N signed-URL generation for **every** document (2,358 docs in the table; a doc-heavy deal signs hundreds of thumb URLs per page view). This page is the domain's slowest load and every mutation below reloads it from scratch.

**Mutations (all real, all audited to `tc_events`):**
- Upload: `createTcUploadUrl` → client PUT to signed URL → `finalizeTcUpload` (sha256 dedupe per cycle, page count via pdfjs, path-prefix anti-tamper check, storage cleanup on reject) — `tc.ts:314-474`. Genuinely solid. Ends with `window.location.reload()` (`DocumentUpload.tsx:96`).
- Archive/unarchive doc: `setTcDocumentArchived` (`tc.ts:231-272`), reason via `window.prompt`, then `window.location.reload()` (`DocumentRowActions.tsx:46-55`).
- Checklist status: `setTcChecklistStatus` (required→in_review→completed/na — `tc.ts:483-520`), reject-reason via `window.prompt`, `window.location.reload()` (`ChecklistControls.tsx:42-55`).
- Commission edit: `updateTcCommission` — nets recomputed server-side via pure tested `computeCommissionNets` (`tc-commissions.ts:159-166`, `lib/tc/commission-math.ts:31-39`, agent+brokerage sum exactly, no penny leak), before/after diff into `tc_events`. Dialog ends in `window.location.reload()` (`CommissionControls.tsx:62`).
- Contacts: `saveDealContact`/`deleteDealContact` (`tc-contacts.ts:59-117`).
- New envelope from documents: `DealEnvelopes.tsx:98` → `createEnvelopeFromDocuments` → router.push to composer.

**Defects:**
- **`getTcDeal` and `getTcDocumentUrl` have NO auth check** (`tc.ts:98, 221-228`). Both are exported `'use server'` actions using the service role — invocable as public POST endpoints by anyone holding the (non-secret, build-emitted) action id. `getTcDocumentUrl(documentId)` mints a 5-minute signed URL to any transaction document from a guessable... actually a UUID, but the principle stands: the credential is "knows a UUID", not "is logged in". Every sibling mutation checks roles; these reads don't. Same class: `getEnvelopesForCycle`, `getEnvelopeDetail`, `getEnvelopesOverview` (`tc-envelopes.ts:116, 160, 717`) and `getSigningSession` is deliberately token-gated (fine).
- **`tc_checklist_assignments` fetched with no filter** — `supabase.from('tc_checklist_assignments').select('item_id, document_id')` loads the ENTIRE table on every deal-page view (`tc.ts:121-123`); every other query in the same Promise.all is `.in('cycle_id', ...)` scoped.
- The whole interaction model is prompt()/alert()/reload(): 5 distinct mutations end in `window.location.reload()` on the heaviest page in the admin (evidence above). Every checklist click costs a full 15-roundtrip re-render.
- Thumbnails only exist if `scripts/tc-generate-thumbnails.mjs` was run; natively-uploaded docs have no thumbs until the next manual run (`tc.ts:134-141` comment).
- No back-link to CRM: the deal shows `fub_person_ids` in its type but the page never renders people/CRM links — a transaction and its CRM contact live in different worlds.
- Anticipated-docs facts: well/septic/HOA/etc auto-populate from the listing only via MLS number; everything else remains null → "Confirm to refine:" prompt renders a list of fact names with **no control to actually confirm them** (`[key]/page.tsx:209-215`, `tc-required-docs.ts:40-60`) — a dead-end prompt.

**Mobile:** documents fork to stacked cards (`[key]/page.tsx:275-310`), table hidden. Hover-only previews (`HoverCard`) have no touch equivalent — on a phone the doc-preview feature doesn't exist. Checklist grid, commission rows, envelope dialog are responsive-ish. Upload works on mobile.

**Verdict: WORKS (core TC ops) / PARTIAL (perf, reload-driven UX, unauth reads, dead-end confirm prompt).**

---

## 8. E-sign flow end-to-end

**Create → compose:** `createEnvelopeFromDocuments` (broker-gated, PDF-only, docs must belong to the cycle, recipients pre-seeded from cycle parties — `tc-envelopes.ts:241-311`) → composer at `/admin/signing/[envelopeId]`.

**Composer** (`components/tc/pdf-sign/EnvelopeComposer.tsx`): edit signers (role/name/email/signing order), click-to-place 5 field types on a pdf.js canvas, drag chips, save draft, send. Draft-only editing enforced server-side (`loadDraftEnvelope`, `tc-envelopes.ts:536-544`). `saveEnvelopeRecipients` delete-then-upsert keeps ids stable for placed fields (`:451-484`); `saveEnvelopeFields` is wholesale replace (`:499-529`).

**Send:** `sendEnvelope` (`tc-envelopes.ts:551-631`) validates: ≥1 doc, ≥1 signer, all emails valid, every signer has ≥1 field, ≥1 signature field. Ordered routing: mints sha256-hashed tokens ONLY for the lowest signing order; later signers get fresh tokens when their turn comes (`:597-615`, `lib/tc/seal-envelope.ts:47-72`). Token = 32 random bytes base64url; only the hash is stored (`lib/tc/signing.ts:96-103`). Good design.

**Sign (public):** `/sign/[token]` (`app/sign/[token]/page.tsx`) → `getSigningSession` (`app/actions/tc-sign.ts:56-167`): token hash lookup, ordered-routing gate ("waiting" state), first-view stamp with IP/UA, per-recipient fields only, 1-hour signed doc URLs. ESIGN/UETA consent recorded before signing (`recordSigningConsent` `:170-188`; UI gate `SignFlow.tsx:90-114`). `submitSigning` validates required completeness server-side, persists values per field (scoped `.eq('recipient_id', recip.id)`), completes recipient, kills token, audits (`:193-256`).

**Seal:** `advanceOrSeal` → when all signed, `sealAndCompleteEnvelope` (`lib/tc/seal-envelope.ts:77-238`): downloads sources, flattens values via pdf-lib, appends audit certificate (`lib/tc/seal-pdf.ts`), stores `Signed — <name>` as a new executed `tc_documents` row, updates envelope with `sealed_sha256`, emails completion copies to every party, broker notice to creator. Decline voids the envelope + kills all tokens (`tc-sign.ts:259-287`).

**Defects in the flow:**
1. **Email failures are silent.** `sendEmail` returns `{error}` and never throws (`lib/resend.ts:48-60`); `sendEnvelope` ignores the return of every `sendSigningInvite` (`tc-envelopes.ts:606-615`), as do `advanceOrSeal` (`seal-envelope.ts:64-71`) and the completion-copy loop (`:214-226`). The envelope is marked `sent` BEFORE the emails go out (`tc-envelopes.ts:592`); if Resend fails, the broker sees "Sent for signature", the signer receives nothing, nothing is logged, and there is no delivery/bounce tracking at all. For a legal signing system this is the worst silent-failure spot in the domain.
2. **No broker notification on individual sign or decline.** `sendBrokerSignedNotice` has a "N signers still pending" branch (`lib/tc/signing-emails.ts:94-101`) but its only call site is at seal with `remaining: 0` (`seal-envelope.ts:229-237`) — the partial branch is dead code. Decline writes a tc_events row only (`tc-sign.ts:280-286` — "notifies the broker via the audit log" means: no notification). The broker learns a deal-killing decline only by re-opening the page.
3. **Concurrent-seal race.** `sealAndCompleteEnvelope` guards with a read-then-act (`status === 'completed'` early return, `seal-envelope.ts:78-79`); two last signers submitting simultaneously both pass `allSigned` and both seal → duplicate executed `tc_documents` rows (same storage path via upsert, two DB rows, two completion-email fan-outs). No transaction/lock/conditional update.
4. **Waiting-signer view-stamp order quirk:** `getSigningSession` records first view before checking... no, it returns `waiting` before the stamp — fine. But `submitSigning` doesn't re-check the ordered-routing gate — a lower-order signer who received a token but hasn't signed doesn't block a HIGHER-order signer who somehow holds a live token; in practice tokens for later orders are minted only when the earlier group completes (`advanceOrSeal:50-52` filters `!r.auth_token_hash && !r.viewed_at`), except `resendRecipientInvite` will happily re-mint a token for ANY not-completed recipient regardless of order (`tc-envelopes.ts:634-678`) — a manual reminder to signer 2 while signer 1 is pending gives signer 2 a live link whose session shows "waiting" (`tc-sign.ts:89-94`) but whose `submitSigning` has **no order check** and will accept their signature out of order.
5. Composer field placement is desktop-mouse-oriented; the PDF canvas renders at fixed 612–760px width (`pdf-pages.tsx:65-67`), wider than a phone viewport, with no scale-to-container — **the public signing page overflows horizontally on phones** (fixed `style={{ width: p.width }}`, `pdf-pages.tsx:122-133`; container `max-w-3xl px-3` `SignFlow.tsx:117`). "Mobile tap-to-sign" is the primary consumer use case and it requires horizontal panning on a 375px screen.
6. `saveEnvelopeRecipients` delete clause: `.not('id','in',\`(${keepIds.join(',')})\`)` with raw UUID interpolation (`tc-envelopes.ts:463-466`) — works, but silently deletes recipients that already viewed if the composer state drifted; no guard that recipients being deleted have no completed fields (draft-only mitigates).
7. `/admin/signing/[envelopeId]/page.tsx` has **no role/scope check in-page** (layout-only), and `getEnvelopeDetail` is the unauth-read action noted above.

**Verdict: WORKS as engineered, UNVERIFIED in production (0 envelopes ever), with silent-failure email spine and a mobile-hostile signer canvas.**

---

## 9. `/admin/signing` — envelope dashboard

**File:** `app/admin/(protected)/signing/page.tsx`. Reads `getEnvelopesOverview()` (limit 200, joined to deal address). KPI count cards, "Out for signature" table, all-envelopes with disclosure. Mobile forks to tappable cards (`page.tsx:96-119`). No compose entry here — "Open a deal and use New envelope" (`:85`), so composing takes: Signing → Deals → deal → scroll to Envelopes → New envelope → pick docs → composer (≈6 steps before placing a field). Empty-state text even points at a per-document affordance that doesn't exist ("use 'New envelope' on a document").

**Verdict: WORKS (as a read dashboard over zero rows).**

---

## 10. `/admin/sign-off` — principal-broker review queue

**Files:** `sign-off/page.tsx`, `SignOffControls.tsx`, `app/actions/tc-signoff.ts`, `lib/tc/banking-days.ts`.

Superuser-only (action-level, `tc-signoff.ts:59-61`; non-superusers get a polite in-page denial). Queue = `tc_checklist_items.status='in_review'` on live-stage deals, with OAR 863-015-0140 7-banking-day deadlines from `contract_acceptance_date` (banking-day math is pure + tested + holiday-aware, `lib/tc/banking-days.ts`; `.test.ts` exists). Approve → `completed` + immutable `tc_principal_reviews` row (name+date, the legal record) + event; send back → `required` (`tc-signoff.ts:176-248`).

**Defects:**
- **0 reviews ever recorded** (live DB) — the compliance record this exists for has never been produced. Items only reach the queue if a broker manually sets checklist items to "in_review" on `/admin/deals/[key]` — whose data went stale 2026-06-10, so the intake pipe is dry.
- Deadline anchor is the CYCLE's `contract_acceptance_date` for every item (`tc-signoff.ts:139`), not the document's own acceptance/signing date — OAR clock should start per document event; all items on a cycle share one deadline here.
- UI actions are `window.prompt`/`window.alert`/`window.location.reload()` (`SignOffControls.tsx:13-24`).
- MAX 6 deals shown; the "See all N deals →" overflow link goes to `/admin/deals` (the stale dashboard), not to a full queue (`page.tsx:126, 184-191`).

**Verdict: WORKS (code) / DEAD (usage).**

---

## 11. `/admin/forms` — TC forms library

**Files:** `forms/page.tsx`, `app/actions/tc-forms.ts`.

Browser over `tc_form_libraries` + `tc_form_versions` (111 active versions loaded — OREF blanks etc.), search by number/name, per-form field-map stats + signed blank-PDF links, sample/production badges. GET-form search (full page reload per search).

**Dead wiring:** the two template-to-envelope actions — `createDraftEnvelope` (`tc-forms.ts:107-172`) and the newer, more complete `createEnvelopeFromTemplate` (`tc-envelopes.ts:322-440`, copies blanks into the deal, places the verified field map, auto-assigns by signer role) — **have zero UI call sites** (repo grep). The forms page has no "use on a deal" button; the deal page's New Envelope only offers already-uploaded documents. The page footer admits it: "Composer ships next" (`forms/page.tsx:264-268`). So the whole verified-template value proposition (111 mapped forms) is unreachable.

Also: the two actions are near-duplicates with different behavior — `createDraftEnvelope` creates an envelope with recipients but **no documents and no fields** (an unsendable husk if ever wired; `sendEnvelope` would refuse it at `tc-envelopes.ts:570`), while `createEnvelopeFromTemplate` does the full job. One of them should not exist.

**Verdict: PARTIAL — library browsing works; the reason it exists is unwired.**

---

## 12. `/admin/commissions` — commission roll-up

**Files:** `commissions/page.tsx`, `app/actions/tc-commissions.ts`.

Reads `getCommissionsRollup()` (all `tc_commissions` joined to cycle/deal). Earned = status != projected; office KPIs, per-broker cards, in-escrow list, recent ledger (mobile card fork at `page.tsx:218-249`). Numbers derive from `tc_commissions` (22 rows, settlement-backfilled) — honest, but:

- **Disagrees with the CRM leaderboard by construction** — Agent Activity closed-deals commission sums `crm_deals.commission_dollars` (`lib/data/crm/agentActivityClosedDeals.ts`), not `tc_commissions`. Two money reports, two sources.
- "See all N ledger rows →" and "See all N brokers →" both link to `/admin/financials` (`page.tsx:157-162, 298-305`), which does NOT render a full commission ledger (it renders P&L + expenses) — a mislabeled dead end; the full ledger is viewable nowhere.
- No auth beyond layout: any admin role can read every broker's compensation (page has no role check; `getCommissionsRollup` `tc-commissions.ts:86-100` has none either).
- New commission rows cannot be created from any UI — `tc_commissions` rows exist only from the migration backfill (`scripts/tc-backfill-commissions.mjs`); a new closing gets a commission row never. Edit-only UI (`CommissionEdit`).

**Verdict: PARTIAL — accurate over its 22 backfilled rows; can't grow, links lie.**

---

## 13. `/admin/financials` — brokerage P&L

**Files:** `financials/page.tsx`, `ExpenseControls.tsx`, `ExpenseLedger.tsx`, `app/actions/tc-financials.ts`.

Revenue = `tc_commissions` (verified+paid) bucketed by close year; expenses = `tc_expenses` (1 row ever) + auto ad-spend from `marketing_channel_daily` (`tc-financials.ts:73-158`). Net = brokerage retained − expenses. Mobile: per-year cards replace the wide table (`page.tsx:92-138`) — good fork. Add-expense dialog validates category/amount/date and optionally links a deal by property key (`tc-financials.ts:163-217`); archive-not-delete with reason. Both end in `window.location.reload()` (`ExpenseControls.tsx:54`).

- Same source-of-truth caveat as §12: P&L years only contain what the one-time backfill verified; 2026 closings post-migration will be missing until someone manually creates commission rows (no UI to do so).
- Any admin role can read full brokerage P&L (layout-only gate).
- Deal-link on an expense is by typed `property_key` string with existence check — no picker (`ExpenseControls` free-text; `tc-financials.ts:182-189`).

**Verdict: WORKS (mechanics) / PARTIAL (data can't stay current; effectively 1 expense recorded).**

---

## 14. `/admin/audit-log`

**Files:** `audit-log/page.tsx`, `audit-log/layout.tsx` (superuser gate), `app/actions/admin-audit.ts`, writer `app/actions/log-admin-action.ts`.

Paginated table over `admin_actions` — the CONTENT-admin audit trail (media, banners, brokers, site pages, roles: see `logAdminAction` callers). **It contains no deal/TC events**: TC audit lives in `tc_events` (103 rows) shown only as the last-15 feed on a deal page (`[key]/page.tsx:491-514`), and CRM deal changes go to `crm_timeline` per contact. The `/admin/deals` footer links here as "the audit trail" for settlement verification (`deals/page.tsx:647-651`) — wrong ledger. Three audit stores, no unified viewer, and `tc_events` (the legally relevant one) has no browsing surface at all beyond 15 rows per deal.

**Verdict: WORKS for its actual (content-admin) purpose; mislinked as the TC audit trail; superuser-only.**

---

## 15. Cross-cutting defect ledger

| # | Sev | Defect | Evidence |
|---|-----|--------|----------|
| D1 | critical | TC system of record is script-fed and stale: no cron, no UI create path for deals/cycles; snapshot last synced 2026-06-10; new transactions appear nowhere | `vercel.json` (no skyslope/tc cron); `scripts/skyslope-dashboard-refresh.mjs`; no `insert into tc_deals/tc_cycles` anywhere in `app/` (grep); DB `max(synced_at)=2026-06-10` |
| D2 | critical | Entire e-sign + sign-off apparatus has zero production usage — `tc_envelopes`=0, `tc_principal_reviews`=0 — while being presented in nav as live capability | live DB counts 2026-07-16 |
| D3 | high | Unauthenticated server-action reads with service role: `getTcDeal`, `getTcDocumentUrl`, `getEnvelopesForCycle`, `getEnvelopeDetail`, `getEnvelopesOverview` have no session/role check | `app/actions/tc.ts:98,221`; `app/actions/tc-envelopes.ts:116,160,717` |
| D4 | high | `/admin/crm/deals/[id]` renders any deal to any admin with no broker-scope check (modal path has one) | `crm/deals/[id]/page.tsx:38-44` vs `crm/deals/page.tsx:93-95` |
| D5 | high | Signing emails fail silently; envelope marked `sent` before sending; no delivery tracking, no error surfaced/logged | `tc-envelopes.ts:592,606-615`; `seal-envelope.ts:64-71,214-226`; `lib/resend.ts:48-60` |
| D6 | high | No stage-change control exists outside desktop drag → mobile users cannot restage a deal at all | `DealsBoard.tsx:471-515` (read-only mobile), `DealDetailModal.tsx:253-267` (breadcrumb only) |
| D7 | high | Commission recorded in 3 unlinked systems; reports disagree by construction (leaderboard=crm_deals, commissions/financials=tc_commissions, deals dashboard=snapshot officeGross) | `agentActivityClosedDeals.ts:54`; `tc-commissions.ts:86`; `deals.ts` headline |
| D8 | medium | `updateCrmDeal` mass-assignment: no runtime key whitelist; restricted broker can set `assigned_broker` | `crm-deals.ts:70,74-93` |
| D9 | medium | `resendRecipientInvite` re-mints tokens ignoring signing order, and `submitSigning` never re-checks order → out-of-order signing possible | `tc-envelopes.ts:634-678`; `tc-sign.ts:193-256` (no order gate) |
| D10 | medium | Concurrent double-seal race (read-then-act guard only) → duplicate executed docs + duplicate email fan-out | `seal-envelope.ts:77-79` |
| D11 | medium | Broker never notified on individual signer completion or decline (partial-notice branch is dead code) | `signing-emails.ts:94-101`; only call `seal-envelope.ts:229` (remaining:0); `tc-sign.ts:259-287` |
| D12 | medium | Public signing PDF canvas fixed 612–760px wide, no scale-to-viewport → horizontal overflow on phones on the client-facing signing page | `pdf-pages.tsx:65-67,122-133`; `SignFlow.tsx:117` |
| D13 | medium | `tc_checklist_assignments` fetched unfiltered (whole table) on every TC deal-page load | `tc.ts:121-123` |
| D14 | medium | Sign-off deadline anchored to cycle acceptance date for all items, not per-document event (OAR 863-015-0140 clock) | `tc-signoff.ts:139` |
| D15 | medium | Money pages (`/admin/commissions`, `/admin/financials`, `/admin/deals*`, `/admin/signing*`) rely solely on the layout's any-admin-role gate; no in-page role checks on reads | `commissions/page.tsx`, `financials/page.tsx`, `deals/page.tsx`, `signing/*` (no role checks) |
| D16 | low | Stage/pipeline stored by name; rename cascade non-transactional; deals with unknown stages fall into "Unsorted" | `crm-deal-pipelines.ts:121-132`; `DealsBoard.tsx:342-358` |
| D17 | low | `restageCrmDeal` skips stage validation for pipeline-less deals | `crm-deals.ts:138` |
| D18 | low | Anticipated-docs "Confirm to refine" prompt has no confirm control (dead-end text) | `deals/[key]/page.tsx:209-215`; `tc-required-docs.ts:47-59` |
| D19 | low | Commissions page "See all" links go to /admin/financials which has no ledger; full commission ledger unviewable | `commissions/page.tsx:157-162,298-305` |
| D20 | low | `generateMetadata` precedence bug on CRM deal detail title | `crm/deals/[id]/page.tsx:17` |
| D21 | low | `entered_stage_at` overwritten per restage; no stage history | `crm-deals.ts:146-149` |

## 16. Duplication ledger

1. **Two full deal-detail UIs for `crm_deals`** — `DealDetailModal.tsx` (modal, current) vs `crm/deals/[id]/{page,DealHeader,DealMilestones,DealCommission,DealFiles}.tsx` (orphaned page): same reads, same mutations, drifted behavior (people list, scope check).
2. **Two template-envelope actions** — `createDraftEnvelope` (`tc-forms.ts:107`) vs `createEnvelopeFromTemplate` (`tc-envelopes.ts:322`): the former is an incomplete husk; neither is wired to UI.
3. **Three commission stores** (crm_deals+splits / tc_commissions / snapshot officeGross) and **two contact stores per deal** (crm_deal_people vs tc_deal_contacts + tc_cycles.sellers/buyers).
4. **Three audit ledgers** (admin_actions / tc_events / crm_timeline) with one viewer covering only the least relevant.
5. **Two checklists for the same transaction** — snapshot activities regexed on `/admin/deals` list vs live `tc_checklist_items` on the detail.
6. `getServiceSupabase()` re-implemented identically in 8 action files (`tc.ts`, `tc-envelopes.ts`, `tc-sign.ts`, `tc-signoff.ts`, `tc-commissions.ts`, `tc-financials.ts`, `tc-forms.ts`, `tc-contacts.ts`, `deals.ts`) — all bypass `lib/data` DAL (tolerated by gates via action-file placement, but architecturally the raw `.from()` boundary rule is dead in this domain).
7. Nav offers both "Pipeline" and "Transactions" under one "Deals" section (`admin-nav.ts:192-216`) — two deal homes with disjoint data; sub-bar "Deal Reporting" → reporting tab "Deals" → redirect back to the board (circular).

## 17. Performance ledger

1. `/admin/deals/[key]`: 5-stage await waterfall + ~15 queries + signed-URL generation for 2×(every doc) per view (`[key]/page.tsx:398-419`, `tc.ts:100-148`); then every mutation triggers `window.location.reload()` re-running all of it (5 call sites).
2. `tc.ts:121-123` unbounded `tc_checklist_assignments` scan per view.
3. Kanban modal open = full board RSC refetch per card click (`?deal=` navigation, `crm/deals/page.tsx:68-92`); no pending feedback during roundtrip.
4. `getDealDashboard` `select('*')` on `skyslope_transactions` incl. full `cycles` jsonb (every activity of every checklist) to render a list (`deals.ts:136-139`).
5. `renumberStages`/`reorderDealPipelines` issue one UPDATE per row in a loop (`crm-deal-pipelines.ts:54-67,288-295`) — trivial at current scale.
6. Composer/sign pages load + render every PDF page to canvas up front (no virtualization, `pdf-pages.tsx:62-67, 96-111`) — heavy for multi-doc envelopes.

## 18. Mobile divergence ledger

- CRM board: desktop drag-Kanban vs mobile read-only stacked list; add-deal, stage-edit, restage all desktop-only (`DealsBoard.tsx:406-469` vs `471-515`).
- No stage change possible on mobile anywhere (D6).
- TC deal detail: doc hover-previews (HoverCard) have no touch path; doc table→cards fork exists; checklist/commission dialogs usable.
- Public signing page overflows horizontally on phones (D12) — the one surface consumers touch.
- Envelope composer stacks on mobile but click-to-place + pointer-drag chips on an overflowing canvas make phone composing impractical.
- `/admin/deals`, `/admin/signing`, `/admin/commissions`, `/admin/financials`, `/admin/audit-log`, `/admin/forms` all carry hand-rolled `md:hidden` card forks — six bespoke mobile table-to-card implementations, each slightly different.
- Only `/admin/crm/deals` gets the mobile CRM navy header + tab-bar treatment; the six TC pages render in the generic console shell with no mobile-specific nav.

## 19. Dead / orphaned inventory

- `app/admin/(protected)/crm/deals/[id]/**` (5 files, ~604 lines) — orphaned duplicate detail page, zero inbound links.
- `createDraftEnvelope` (`tc-forms.ts:107-172`) — never called; creates unsendable envelopes.
- `createEnvelopeFromTemplate` (`tc-envelopes.ts:322-440`) — complete, never called; the forms library's only consumer.
- `sendBrokerSignedNotice` partial branch (`signing-emails.ts:94-101`) — dead code path.
- Modal "Custom fields → Show all fields" — permanent stub (`DealDetailModal.tsx:412-425`).
- `/admin/crm/reporting/deals` — intentional redirect stub.
- Snapshot dev fallback `tmp/skyslope-master/master.json` (`deals.ts:103-121`) — dev-only.
- `fub_person_ids` on `TcDeal` — fetched, typed, never rendered (`tc.ts:93,214`).

## 20. What is real vs demo/stub

- **Real and used:** CRM Kanban + modal (20 deals, live), TC document store (2,358 docs), commission ledger (22 backfilled rows), forms library (111 versions loaded).
- **Real but unused:** the entire e-sign stack, sign-off queue, expenses (1 row), deal contacts UI.
- **Stub/dead:** custom deal fields, template→envelope path, deals report, `[id]` page, per-signer broker notices.
- **Stale-by-architecture:** everything on `/admin/deals` list + KPIs (snapshot).
