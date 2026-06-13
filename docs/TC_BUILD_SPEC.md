# TC Build Spec — handoff for the implementing session

**Purpose.** This is the self-contained build specification for finishing Ryan Realty's
in-house Transaction Coordination system (the SkySlope replacement) to full SkySlope parity
+ Oregon-law compliance. A session with **no prior context** should be able to execute it.
Read this top to bottom once, then build the backlog (§7) in order.

**Companion docs (read these too):**
- [`docs/TC_SYSTEM.md`](TC_SYSTEM.md) — architecture + the phased roadmap + invariants (the parity ledger; keep it updated).
- [`docs/TC_SKYSLOPE_PARITY.md`](TC_SKYSLOPE_PARITY.md) — the complete SkySlope feature inventory (live crawl) + gap map this spec implements.
- [`docs/TC_OREGON_COMPLIANCE.md`](TC_OREGON_COMPLIANCE.md) — the cited Oregon-law matrix (the legal spine; every legal claim traces here).
- [`docs/DATABASE_SCHEMA_SNAPSHOT.md`](DATABASE_SCHEMA_SNAPSHOT.md) + [`docs/DAL_INDEX.md`](DAL_INDEX.md) — current schema + data-access functions (read before any query).
- `.claude/skills/tc-builder/SKILL.md` — the build loop + north star + hard rules.
- `.claude/skills/skyslope-form-compliance/` — the OREF form library + classification model.

---

## 1. North star (Matt's words — do not drift)

A **fully functional, automated, thorough, intuitive** transaction system, **compliant with Oregon
real estate law** because Matt is the licensed principal broker and these are his license-bearing
records. Bar: "easier than SkySlope," and beat SkySlope where it's weak. **Don't overstate
compliance** — build what the cited rule requires, nothing performative. Matt is the broker of
record; the system produces the records and tracks the deadlines the law calls for.

Already ahead of SkySlope (lead with these, don't regress): one-flag archiving (no lock bug),
immutable ORS-defensible audit trail, law-cited document anticipation, modern agent-native UI,
inline ESIGN/UETA certificates.

---

## 2. Current state — BUILT, do not rebuild

### Data layer (Supabase project `dwvlophlbvvygjfxcrhm`, all `tc_*`, RLS on, service-role only)
| Table | Migration | Purpose |
|---|---|---|
| `tc_deals` | `20260610010000_tc_system_v1.sql` | one row per property (stage, broker, FUB links) |
| `tc_cycles` | ″ | one row per offer/listing cycle; `raw` jsonb snapshot |
| `tc_documents` | ″ | binary in Storage bucket `tc-documents`; sha256; `archived` flag; `classification` jsonb |
| `tc_checklist_items` | ″ | Required/Optional/In Review/Completed/NA state machine |
| `tc_checklist_assignments` | ″ | m2m items↔documents |
| `tc_events` | ″ | **append-only audit spine** (UPDATE/DELETE blocked) |
| `tc_form_libraries`, `tc_form_versions` | `20260610020000` | form library + versioned forms (`field_map` jsonb, `signer_profile`) |
| `tc_envelopes`, `tc_envelope_documents`, `tc_envelope_recipients`, `tc_envelope_fields` | ″ | e-signature envelopes |
| `tc_deal_contacts` | `20260610030000` | co-agents + lender/title/escrow/appraiser/TC/other-agent |
| `tc_commissions` | `20260610230000` | per cycle per agent: side, GCI, splits, fees |
| `tc_expenses` | `20260610234500` | deal-scoped + overhead expenses |
| `tc_principal_reviews` | `20260613050000` | **immutable** OAR 863-015-0140 review record (reviewer name + date) |

### Working features + their code
- **Deal detail** `app/admin/(protected)/deals/[key]/page.tsx` + `app/actions/tc.ts` (`getTcDeal`): cycles accordion, documents (upload/archive/unarchive — `DocumentUpload.tsx`, `DocumentRowActions.tsx`), checklist transitions (`ChecklistControls.tsx`), **Documents anticipated** (Oregon engine), deal contacts (`DealContacts.tsx`), commissions (`CommissionControls.tsx`), **Envelopes & signing** (`DealEnvelopes.tsx`), audit trail.
- **Required-docs engine** `lib/tc/required-documents.ts` (pure rules: `BrokerRole` × `PropertyFacts` → needed/present/missing) + `app/actions/tc-required-docs.ts` (`getAnticipatedDocuments`; role from `roleFromRaw`; facts from `lib/data/listings/getPropertyFactsByMls.ts`). Buyer-rep is `required` for `buyer`|`dual` (OAR 863-015-0133).
- **E-signature (complete)** — compose `app/admin/(protected)/signing/[envelopeId]/page.tsx` + `EnvelopeComposer.tsx`; lifecycle `app/actions/tc-envelopes.ts`; public sign `app/sign/[token]/page.tsx` + `components/tc/pdf-sign/*` (`SignFlow`, `EnvelopeComposer`, `SignaturePad`, `pdf-pages`); engine `lib/tc/{signing,seal-pdf,seal-envelope,signing-emails}.ts`; public actions `app/actions/tc-sign.ts`. Ordered routing, tokenized email links, pdf-lib seal + certificate, completion emails. Worker at `public/pdf.worker.min.mjs` (copied by `scripts/copy-pdf-worker.mjs` via `prebuild`). Dashboard `/admin/signing`.
- **Principal-broker review (complete)** `/admin/sign-off` + `app/actions/tc-signoff.ts` (`getPrincipalSignOffQueue`, `recordPrincipalReview`) + `lib/tc/banking-days.ts`. Writes the immutable `tc_principal_reviews` record (reviewer name + date) + tc_events; surfaces the 7-banking-day deadline (OAR 863-015-0140), flags overdue.
- **Commissions** `/admin/commissions` + `app/actions/tc-commissions.ts`. **Financials** `/admin/financials` + `app/actions/tc-financials.ts`. **Forms library browser** `/admin/forms` + `app/actions/tc-forms.ts`. **Deal contacts** `app/actions/tc-contacts.ts`.
- Nav: `app/components/admin/admin-nav.ts` (Transactions group: Signing, Commissions, Financials, Forms; Today group: Sign-off queue).

**Do not rebuild any of the above.** Extend.

---

## 3. Architecture & conventions (follow exactly)

- **Server actions, not raw queries in pages.** All TC reads/writes go through `app/actions/tc-*.ts` using a service-role client (`getServiceSupabase()` pattern — copy it). Raw `.from()` is allowed in `app/actions/` (the DAL boundary gate G1 exempts actions); never in pages.
- **Every mutation appends a `tc_events` row** (`{deal_id, cycle_id, document_id?, actor, action, detail}`). Non-negotiable audit spine.
- **Auth:** `getSession()` (`app/actions/auth.ts`) + `getAdminRoleForEmail()` (`app/actions/admin-roles.ts`). Roles: `superuser` (Matt, principal) | `broker` | `report_viewer`. Principal-only surfaces (sign-off, supervision) gate on `role==='superuser'`. `isSuperuserAdmin` hardcodes `matt@ryan-realty.com`.
- **Migrations:** write the file in `supabase/migrations/<timestamp>_<name>.sql` AND apply to hosted Supabase via the Supabase MCP `apply_migration` in the SAME delivery (Cursor parity rule). RLS on, zero policies (service-role only). After any schema change run `npm run ci:data-access -- --refresh` and commit the refreshed `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md`.
- **Immutable compliance records:** for legal records (like `tc_principal_reviews`), add a `before update or delete` trigger that raises (see that migration). Copy the pattern.
- **UI:** design-system components from `@/components/ui/` ONLY (Button, Card, Select, Input, Badge, Dialog, Table, Checkbox, Tabs…). No raw HTML controls. Color tokens (`bg-primary`, `text-muted-foreground`, etc.), never hex. `cn()` for class merge. Admin pages carry `// @no-parity` at the top (they have no marketing mockup). Display headings use the `font-display` (Amboqia) face via `components/site/primitives` where appropriate.
- **Brand voice** on any client-facing text (signing emails, signer pages): no em-dash, no semicolon, no banned words; canonical email tokens from `lib/email/brand.ts` (`EMAIL_FONT_STACK`). The pre-commit + write hooks enforce this.
- **Gates (must pass before commit):** `npm run ci:gates` (design-tokens, seo-routes, DAL boundary, brand-voice, mockup-parity, page-dal, static-params). Pre-commit runs `vitest` (601 tests) + the draft-first gate. Pre-push runs G46 self-containment (tsc). For new admin pages: `// @no-parity`; if a page genuinely fetches no `@/lib/data` DAL data add `// @data-free`.
- **Draft-first:** code/docs/migrations ship to `main` after browser verification. Client-facing DELIVERABLES (a real envelope/email to a real client) need Matt's explicit approval. Commit messages for Matt-directed work carry `Approved-by: matt`.
- **Single `main`, push immediately.** A parallel session shares this working tree. **Stage your files explicitly** (`git add <paths>` then `git commit <explicit pathspecs>`), never `git add -A` — you will sweep the other session's staged files into your commit. Use a retry loop on push (the remote moves under you). Rebase with `git pull --rebase --autostash origin main`.
- **Verify in a real browser** (`feedback_verify_before_moving_on`): `npx tsc --noEmit` + the gates are necessary, not sufficient — the surface must actually render with real data.

### Testing protocol (how to verify without getting blocked)
- **Authenticate the preview browser** (it lands on /auth-error when the session expires): mint a service-role magic link and land it on the local callback. `supabase.auth.admin.generateLink({type:'magiclink', email:'matt@ryan-realty.com', options:{redirectTo:'http://localhost:3000/auth/callback'}})` → take `properties.hashed_token` → navigate the preview to `/auth/callback?token_hash=<hash>&type=magiclink&next=/admin/...`. (`reference_preview_e2e_admin_auth_and_radix`.)
- **The preview harness CANNOT open Radix dialogs** (confirmed on shipped dialogs — tooling limit, not a bug). Plain `<Button onClick>` DO fire via CDP click. For Radix-gated state, set the gating DB field directly + reload. **Verify mutation-heavy flows by extracting the request-context-free engine into a `lib/` function** taking a `supabase` client, then drive it from a Vitest integration test against the real DB (isolated config: `npx vitest run --config tmp/vitest.e2e.config.ts`, include `tmp/**/*.e2e.test.ts`, read `.env.local` into `process.env`). This is how the signing engine + the principal review were verified. Pattern: `lib/tc/seal-envelope.ts`.
- **Prod is behind Cloudflare** — raw `curl` 403s dynamic routes; use a browser `User-Agent` to smoke-check, or hit static assets.
- **Deploys:** watch via the Vercel MCP (`list_deployments` / `get_deployment_build_logs`, project `prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`, team `team_zwYQPapH0CpleD7RzJ7WctGO`).

---

## 4. Oregon-law requirements that gate features (all verified — cite, don't recall)

Every legal rule MUST trace to ORS / OAR ch. 863 / OREF / the Oregon Real Estate Agency. Re-verify
against the primary source before encoding (the §0 data-accuracy discipline). Current spine:

| Rule | Requirement | Feature it gates |
|---|---|---|
| **OAR 863-015-0140(4)** (verified 2026-06-13) | PB reviews each document of agreement **within 7 banking days** of acceptance/rejection/withdrawal; electronic record shows **reviewer name + review date**. | Principal review (DONE). Apply the banking-days deadline to new doc-of-agreement events. |
| **OAR 863-015-0133 + HB 4058** (eff. 2025-01-01) | Written **buyer representation agreement mandatory** when representing a buyer (sole or dual); 8 contents, 24-month max term; commercial / 5+ unit exception. | Required-docs (DONE) + the buyer-agreement wizard (F-Forms). |
| **OAR 863-015-0250** | Associated broker forwards transaction documents to the PB **within 3 banking days** of receipt; enumerates retained records. | Email-ingest receipt clock; records retention. |
| **OAR 863-015-0143 + HB 3137** (eff. 2026-01-01) | **Team disclosure at first contact**; team advertising amendments (863-015-0125). | Team/contact + first-contact disclosure. |
| **ORS 105.464–105.475** | Seller's Property Disclosure; buyer **5-business-day** revocation. | Disclosure timing tracker. |
| **ORS 448.271** | Domestic-well test on offer acceptance; results to OHA + buyer within **90 days**. | Property-fact-driven required docs (DONE for the doc; deadline TODO). |
| **ORS ch. 84 (UETA) + ESIGN** | Electronic signature validity: intent, consent, attribution, integrity, signer copy, retention. | E-signature (DONE — certificate cites this). |
| **OAR 863-015-0255 / -0260 + ORS 696.280** | 6-year records retention; trust-account rules. | Retention (archive-only, never hard-delete within 6 years). |
| Earnest money | Deposited **within 3 banking days** of acceptance (per the sale agreement). | Deadline tracker (F-Tasks/dates). |

Full detail + sources: `docs/TC_OREGON_COMPLIANCE.md` and `docs/research/oregon-law-sweep-2026-06-10.md`.

---

## 5. Banking-days helper (reuse, don't reimplement)
`lib/tc/banking-days.ts` — `addBankingDays`, `bankingDaysBetween`, `reviewDeadline(clockStartIso, now, days)`. Excludes weekends + US federal holidays. Use it for ALL banking-day deadlines (review, EM deposit, transmittal, executed copies).

---

## 6. Conventions for each backlog item (the spec template)
Each item in §7 gives: **Goal · Data model · Server actions · UI · Compliance · Acceptance · Depends-on**. Build one item per PR-sized commit, verify in browser, ship, update `docs/TC_SYSTEM.md` roadmap + `docs/TC_SKYSLOPE_PARITY.md` status, then take the next.

---

## 7. Build backlog (in order)

### TIER 1 — the daily driver

#### T1.1 — Create Transaction / Listing flow  ⟵ START HERE (the front door)
- **Goal:** create a new deal+cycle from scratch (today the system only holds migrated deals). MLS pre-fill.
- **Data model:** no new tables — insert `tc_deals` (+ `tc_cycles`). Generate a `source_guid` (`crypto.randomUUID()`); set `source='native'`. Add a per-deal inbound email handle (column `tc_cycles.portal_email` already exists) — generate `<slug>@<ingest-domain>` for later email-ingest (F-Ingest).
- **Server actions** (`app/actions/tc-deals-create.ts`, new): `createDeal(input)` — `{ address, city, state, zip, stage, type: 'sale'|'listing', agentEmail, mlsNumber?, checklistType, buyers[], sellers[], acceptanceDate?, closingDate?, salePrice? }`. Validate; insert deal + cycle; seed the checklist from the checklist-type template (T2.3); resolve property facts from MLS via `getPropertyFactsByMls`; append `tc_events action='deal_created'`. Return `{property_key}`.
- **UI:** `app/admin/(protected)/deals/new/page.tsx` + a client form (design-system Inputs/Select). "Create Transaction" button on `/admin/deals`. MLS# field → on blur, pre-fill address/price/beds/sqft/year/property facts from the listings feed. On submit → redirect to the deal page.
- **Compliance:** none directly, but the seeded checklist (T2.3) carries the law-required docs; buyer/dual deals must seed buyer-rep as required.
- **Acceptance:** from `/admin/deals` → Create → fill (MLS pre-fills) → submit → land on the new deal with the right checklist + anticipated docs. `tc_events` has `deal_created`.
- **Depends-on:** T2.3 (checklist templates) is ideal but build a minimal default checklist inline if T2.3 isn't done yet.

#### T1.2 — Transactions index v2
- **Goal:** match SkySlope's Manage Transactions: filter/sort + workflow buckets + row actions.
- **Data model:** none (read `tc_deals`/`tc_cycles`). Add a `reviewer_email` column to `tc_deals` (migration) for the Reviewer filter.
- **Server actions** (`app/actions/tc.ts` extend): `listTransactions({ search, agent, office, stage, reviewer, dateField, dateFrom, dateTo, sort, dir })`. Return rows + the 3 buckets: active, canceled-pending-approval (stage cancel + needs approval), closed-to-archive. Row actions: `assignReviewer(dealId, email)`, `cancelTransaction(dealId, reason)`, `duplicateTransaction(dealId)`, archive (reuse). Each appends `tc_events`.
- **UI:** rebuild `/admin/deals` — search box, column header sort, filter controls (stage/agent/office/reviewer/date-range), 3 bucket sections, per-row action menu (DropdownMenu). Columns: File Name, MLS#, Sale/List Price, dates, Escrow#, Agent, Office, Incomplete-Items, Stage.
- **Acceptance:** filter by agent + stage narrows the list; assign a reviewer; cancel moves a deal to the canceled bucket; duplicate creates a copy. All audited.
- **Depends-on:** none.

#### T1.3 — Multiple agents per deal  ⟵ Matt explicitly asked
- **Goal:** a deal holds a primary agent + co-agents + a reviewer, each with role + split %. (SkySlope buries this in the commission breakdown; do it cleanly.)
- **Data model:** new migration `tc_deal_agents` — `{ id, deal_id, cycle_id?, broker_id?, agent_email, agent_name, role ('primary'|'co_agent'|'reviewer'|'referring'), side ('listing'|'buyer'), split_percent numeric, created_at }`. Backfill the existing primary agent from `tc_deals.broker_name`/cycle.
- **Server actions** (`app/actions/tc-deal-agents.ts`): `getDealAgents(dealId)`, `saveDealAgent(input)`, `removeDealAgent(id)`. Append `tc_events`. Feed `tc_commissions` (split source) and the principal-review queue (reviewer).
- **UI:** an "Agents on this deal" section on the deal page (`DealAgents.tsx`) — list + add/edit/remove (roles + split). Multi-select brokers from the `brokers` table.
- **Compliance:** team disclosure at first contact (OAR 863-015-0143 / HB 3137) — surface a flag if 2+ agents (a "team" exists) and the first-contact team disclosure isn't recorded.
- **Acceptance:** add a co-agent with a 50% split; it shows on the deal + flows to the commission breakdown.
- **Depends-on:** none (commissions integration is a follow-up).

#### T1.4 — Tasks
- **Goal:** per-deal + standalone tasks with due dates + assignee → feeds notifications + calendar.
- **Data model:** new migration `tc_tasks` — `{ id, deal_id?, cycle_id?, title, detail, assignee_email, due_date date, status ('open'|'done'|'cancelled'), source ('manual'|'auto_deadline'), created_by, completed_at, created_at }`.
- **Server actions** (`app/actions/tc-tasks.ts`): `getTasks({ assignee?, dealId?, status? })`, `createTask`, `updateTaskStatus`, `deleteTask` (→ cancelled, never hard-delete). Auto-deadline tasks (EM deposit 3 banking days, executed copies 3 days, PB review 7 banking days) generated from deal dates via `banking-days.ts`.
- **UI:** `/admin/tasks` (MyTasks: today/overdue/upcoming) + a Tasks section on the deal page. Nav entry under Today.
- **Acceptance:** create a task with a due date; it appears in MyTasks grouped by due; auto-deadline tasks appear for a deal with an acceptance date.
- **Depends-on:** none. Calendar push (T3.x) consumes these.

### TIER 2 — the Forms moat (beat SkySlope on automation)

#### T2.1 — Pull licensed form libraries + Browse Libraries surface
- **Goal:** load Matt's licensed blanks (Oregon Data Share/ODS, Oregon Real Estate Forms/OREF, Oregon Realtors/OR — 294 forms) into `tc_form_versions`; a browse-and-add surface like SkySlope's Browse Libraries.
- **How (confirmed live 2026-06-13 against the authed Forms SPA):**
  - **Blank-PDF download endpoint (PROVEN):** `GET https://forms.skyslope.com/library/api/form-versions/{formVersionId}/download` returns the real blank PDF bytes (200, binary) when called from the authed session. This is the core — it gives us the actual licensed forms.
  - **Library + form lists:** `GET /library/api/libraries` then the per-library form-versions list (confirm the exact path at build: `/library/api/libraries/{libId}/form-versions` vs `/library/api/form-versions?libraryId={libId}`). Send header `api-version: 2.0`.
  - **Auth — ride the SPA's Forms token, do NOT reuse the identity token.** `sessionStorage['com.skyslope.id.tokens'].accessToken` is the IDENTITY token and **401s** against `/library/api`. The Forms API uses a separate OIDC resource token the SPA attaches per request. Capture it in-page: hook `XMLHttpRequest.prototype.open`+`setRequestHeader` (and `fetch`) and record the `Authorization` header **only for URLs matching `/library/api/`** (the `/form-versions/{id}/download` XHR is the reliable trigger — click a form once), into a `window` var; reuse that exact header for the enumerate + download loop.
  - **Two hard gotchas (learned):** (1) the Claude-in-Chrome **privacy filter blocks any tool return that has a token in scope** — so the in-page loader must NOT return token-adjacent data; have it do all authed work in-page and POST results to our ingest endpoint (or relay sanitized summaries via `localStorage` then read them in a separate call). (2) Browse-Libraries search/filter is **client-side** (no fetch) — trigger real server calls by opening/adding a form, not by typing in search.
  - Store each blank in `tc-documents` Storage; extract AcroForm field maps via pdf-lib `getFields()` where present.
  - **Field coordinates — working assumption: the library does NOT carry signature-field positions.** SkySlope places signature/initials blocks at envelope-creation time (DigiSign), not on the static library form. So plan to map signature fields ourselves once per form (T2.2 map-once tool) + auto-extract any AcroForm *fill* fields. The loader should log one form-version DETAIL response (`GET /library/api/form-versions/{id}`) to our endpoint to confirm/deny coords before assuming.
  - **Needs Matt's live Forms session** in the **Mac Mini** Chrome (the browser named "mac mini matt logged in" — the session lives there; a fresh tab re-auths from `localStorage['com.skyslope.id.cache']` on that profile, but NOT on other machines).
- **Data model:** populate `tc_form_libraries` + `tc_form_versions` (`blank_pdf_storage_path`, `field_map`, `signer_profile`, `effective_date`). **Capture version identity at ingest (migration):** add columns `source_form_id` (SkySlope `formId` — stable across versions), `source_version_id` (SkySlope `publishedVersionId` — changes each revision), `version_label` (the OREF rev shown in checklists, e.g. "10.4"), `source_checked_at`, `update_available boolean default false`, `superseded_by uuid` (→ the newer row). These power T2.1b freshness detection.
- **Ingest endpoint:** `POST /api/admin/forms/ingest` (superuser-only) accepts `{ libraryCode, formNumber, name, effectiveDate, sourceFormId, sourceVersionId, versionLabel, pdfBase64, acroFields? }` → store PDF in Storage `tc-forms/<lib>/<form>__<versionId>.pdf` + upsert `tc_form_versions`; extract AcroForm field map via pdf-lib `getFields()` when present. The in-browser loader script (runs in Matt's SkySlope Forms tab) reads the token from sessionStorage, lists libraries + form-versions, fetches each blank, and POSTs bytes here — the token never leaves the browser.
- **UI:** `/admin/forms` → add library filter + per-form "Add to deal"; a deal-side "Add form" picker.
- **Compliance/licensing:** OREF blanks are copyrighted — load under Matt's member access only, never redistribute. OR + ODS are free. The engine is generic.
- **Acceptance:** browse libraries filtered by ODS/OREF/OR; add a form to a deal → it becomes an envelope-able document. Each form row stores its source version identity.
- **Depends-on:** Matt's live SkySlope Forms session (for the pull + the recon: confirm the form-version API exposes a blank-PDF URL and, ideally, the signature-field coordinates).

#### T2.1b — Form-version freshness detection (SkySlope parity — Matt directive 2026-06-13)
- **Goal:** detect when a library form we hold has been revised at the source (a newer published version exists) and we're using the old one — then flag it and offer a one-click update. This is what SkySlope does ("you're on an old version").
- **How it works:** at ingest we store `source_form_id` + `source_version_id` + `version_label` + `sha256` per form (T2.1). A **freshness check** re-lists the SkySlope library API and, for each active `tc_form_versions`, compares the source's current `publishedVersionId` / `effective_date` to what we hold. If the source is newer → set `update_available=true` and record the new label.
- **Trigger (honest constraint):** the recheck needs SkySlope auth. Until we have durable Partnership-API credentials (requires a SkySlope order form — out of scope now), the recheck runs **in-browser when Matt is logged into SkySlope Forms** — a "Check for form updates" button on `/admin/forms` runs the same token-in-browser comparison the loader uses. Add a standing reminder cadence (e.g., a monthly task via T1.4) so it actually gets run. (Upgrade path: if Partnership-API creds are obtained, move the recheck to a weekly cron — same comparison logic, server-side.)
- **Update flow:** `updateFormVersion(formVersionId)` — pull the new blank → insert a NEW `tc_form_versions` row (new `effective_date` + `version_label` + `source_version_id`) → set the old row's `retired_at` + `superseded_by` → **carry the field map forward ONLY if the layout is unchanged** (compare AcroForm field set / page geometry); if the structure changed, mark the new row `field_map_source='manual'` + `needs_remap` so a stale signature map never lands on a revised form. Append `tc_events`.
- **UI:** `/admin/forms` shows an **"Update available"** badge per outdated form + a "needs update" filter; the **envelope composer warns** when a chosen form has `update_available` ("a newer version is available — update before sending?"); the "Update form" action runs `updateFormVersion`.
- **Compliance:** placing a signature on a stale/wrong form layout is the risk this prevents. The carry-forward guard (re-map on structural change) is the safety. Using a superseded form should warn, not silently proceed.
- **Acceptance:** with a form whose source `publishedVersionId` is newer than ours, the freshness check flags it; "Update form" creates the new version, retires the old, and either carries the map (unchanged layout) or flags re-map (changed layout); the composer warns on outdated forms.
- **Depends-on:** T2.1 (version identity stored at ingest). T2.2 (field-mapper) for the re-map path.

#### T2.2 — Field map from SkySlope's field data + auto-fill  ⟵ the differentiator (now mostly AUTOMATIC)
- **MAJOR finding (confirmed live 2026-06-13):** SkySlope's form-version DETAIL (`GET /library/api/form-versions/{id}?api-version=2.0`) returns a **`fields` array** that already carries every field's **coordinates + type + data binding** — so we do NOT hand-map forms. We pull it and translate. The OREF Residential PSA (id 117038) has 325 fields. We can pull this for every current form during T2.1.
- **The `fields` array shape (per field):** `xCoordinate`, `yCoordinate`, `width`, `height`, `pageNumber`, `fontSize`, `type`, `originalType`, `dataRef` (the data binding key), `domainName` (human label), `format` (e.g. `:agentLicenseNumber`, `:brokerageName`), `isOptional`, `order`, `group`, `associatedDataRefs`. Field **`type`** values seen: `textinputblock`, `Multiline`, `Address`, `Contacts`, `Currency`, `Calculation`, `Date`, `checkboxblock`, **`Signature`**, **`Initials`**, **`DateSigned`**, `TimeSigned`. The DETAIL also returns `pages: [{ formVersionId, width, height }]` — use page width/height to normalize the point coords into our fractional `field_map` geometry (`lib/tc/signing.ts`: fractions, top-left origin).
- **Data model:** store the raw SkySlope `fields` + `pages` on the `tc_form_versions` row (e.g. `source_fields jsonb`) at ingest, AND a translated `field_map` jsonb — array of `{ key, type ('text'|'signature'|'initials'|'date'|'checkbox'), page, x, y, w, h (fractions), binding (mapped from dataRef → our deal-data path), signer_role (derived), required (!isOptional) }`.
- **Two translation layers to build:**
  1. **Coordinate translate (mechanical):** SkySlope point coords + page dims → our fractional geometry. Map `type` → our types (Signature/Initials/DateSigned/Date → signature/initials/date; textinputblock/Multiline/Address/Currency/Calculation → text; checkboxblock → checkbox; Contacts → text with the `format` suffix).
  2. **`dataRef` → deal-data binding + signer role:** map SkySlope `dataRef`s (`premisesAddress`, `saleAgreementNumber`, `buyersAgents:agentLicenseNumber`, `sellersSignature`, etc.) to our `tc_deals`/`tc_cycles`/`tc_deal_agents` fields. Signature/Initials fields' `dataRef`/`group` encode the signer (buyer vs seller vs agent) → derive `signer_role`. Build a `dataRef` lookup table (the high-value forms first: 001 PSA, addenda, agency disclosures, buyer-rep 050/052).
- **Server actions:** extend `tc-envelopes.ts` — `createEnvelopeFromTemplate(cycleId, formVersionIds)` renders the blank, fills `text` fields from the bound deal data (pdf-lib text draw via `lib/tc/seal-pdf.ts`), places `Signature`/`Initials`/`DateSigned` fields assigned to the right recipient by `signer_role`. Then the existing send→sign→seal flow runs unchanged.
- **UI:** mostly automatic; keep the existing composer for per-envelope review/tweak. A small admin tool to review/override the translated map per form (esp. signer-role derivation) is worthwhile for the top forms.
- **Acceptance:** pick the OREF PSA on a deal → rendered PDF has address/price/parties/dates filled and buyer/seller signature + initials + date fields placed at SkySlope's coordinates; send + sign + seal works end to end.
- **Depends-on:** T2.1 (which must also pull + store each form's DETAIL `fields`/`pages`, not just the blank).

#### T2.3 — Checklist-type templates + groups
- **Goal:** checklist TYPES (e.g. "Residential — Standard", "Buyer Agreement", "Listing") with grouped items + per-item status, seeded on deal creation. Wire to the Oregon required-docs engine.
- **Data model:** `tc_checklist_templates` (`{id, name, transaction_type}`) + `tc_checklist_template_items` (`{template_id, group, name, oref_form, sort_order, default_status}`). Seed from Appendix A of `TC_SKYSLOPE_PARITY.md` (the live Oregon checklist).
- **Server actions:** `seedChecklistFromTemplate(cycleId, templateId)` (called by T1.1). Add `tc_checklist_items.group` column for grouping.
- **UI:** group the checklist on the deal page (Buyer Agreement / Sales / Disclosure / Reports / Misc / Closing / Listing); per-item status incl. If-Applicable / Must-Upload / Not-Required.
- **Compliance:** the template carries the law-required docs; cross-reference `TC_OREGON_COMPLIANCE.md`. Buyer/dual → buyer-rep required.
- **Acceptance:** create a deal → checklist seeds with grouped items matching the template; required docs reconcile with the anticipated-docs engine.

#### T2.4 — Templates (form packets) + Clauses library
- **Goal:** saved form packets (a checklist-type's default form set) + reusable clause snippets (personal + brokerage), like SkySlope's Templates + Clauses.
- **Data model:** `tc_form_packets` (`{id, name, form_version_ids jsonb}`); `tc_clauses` (`{id, scope ('personal'|'brokerage'), category, title, body, created_by}`).
- **UI:** `/admin/forms` tabs for Templates + Clauses (Add/edit). Insert clause into a form during compose.
- **Acceptance:** create a packet, instantiate it onto a deal; insert a saved clause into a form.

### TIER 3 — listing side + completeness

#### T3.1 — Offers (listing-side)
- **Goal:** collect + compare offers for a listing client. SkySlope "Offers" parity.
- **Data model:** `tc_offers` (`{id, deal_id, buyer_name, buyer_agent, price, earnest_money, financing_type, close_date, contingencies jsonb, status ('received'|'countered'|'accepted'|'rejected'), submitted_at, documents jsonb}`).
- **UI:** an Offers tab on a listing deal + a comparison grid (price/terms/contingencies side by side).
- **Acceptance:** add 3 offers to a listing; compare in a grid; accept one → links to the sale cycle.

#### T3.2 — Manage Listings surface + listing checklist
- **Goal:** a listing-side pipeline view distinct from sales (cycles already carry `kind='listing'`). Listing checklist type (T2.3).
- **Acceptance:** `/admin/listings` shows listing-stage deals with the listing checklist.

#### T3.3 — Per-deal email ingest
- **Goal:** inbound `<deal>@<domain>` → store attachment → auto-classify (compliance skill) → file to the matching checklist item. Fixes dead-folder contamination by design. Records the 3-banking-day transmittal receipt (OAR 863-015-0250).
- **Data model:** reuse `tc_documents`; add `tc_cycles.portal_email` (exists). Inbound webhook (Resend inbound or a mailbox poll).
- **Acceptance:** email a PDF to a deal's address → it appears on the deal, classified + checklist-assigned, with a `tc_events` receipt timestamp.

#### T3.4 — Reporting
- **Goal:** compliance + production reports per agent/office/period (SkySlope SkySight parity). Build on `tc_commissions` + `tc_principal_reviews` + checklist completeness.
- **Acceptance:** a report shows per-agent production + overdue principal reviews + incomplete checklists for a period.

#### T3.5 — Notifications + Calendar (tc-builder rungs 13–14)
- **Goal:** deal-broker change notifications; principal sign-off alerts + daily digest (extends `/admin/sign-off`); push key dates (transaction timeline, showings, license renewals) to each broker's Google Calendar (Workspace DWD / Calendar MCP). Principal sees all brokers' calendars.
- **Data model:** `tc_notifications` (`{id, recipient_email, kind, payload, read_at, created_at}`); a date model on the deal (or derive from cycle dates + `tc_tasks`).
- **Compliance:** the 7-banking-day review deadline (OAR 863-015-0140) and earnest-money/transmittal/executed-copy banking-day clocks feed the notifications + calendar.
- **Acceptance:** marking an item in-review notifies the principal; a daily digest lists pending reviews + overdue deadlines; key dates appear on the broker's Google Calendar.

#### T3.6 — Per-broker access scoping (tc-builder rung 16)
- **Goal:** a broker's default view is THEIR deals (where they're the agent / on the deal team); the principal sees all + the sign-off queue. Close the current gap where any admin role sees every deal.
- **Acceptance:** a broker logging in sees only their deals; Matt sees all + an all-brokers toggle.

#### T3.7 — Misc parity
Strike signature-field type (`tc_envelope_fields.type`), e-sign auto-reminder cron (48h), CDA/disbursement docs on commissions, in-app PDF annotate, buyer-agreement wizard (the 8-content OAR 863-015-0133 form flow).

---

## 8. Definition of done (per item)
1. Migration written + applied via MCP; schema snapshot refreshed + committed.
2. Server actions with `tc_events` on every mutation; auth-gated.
3. UI from `@/components/ui/`; `// @no-parity`; renders with real data (browser-verified).
4. Mutation flow verified (browser for plain buttons; engine integration test for Radix-gated/complex flows).
5. `npx tsc --noEmit` + `npm run ci:gates` clean.
6. Oregon-law claims cited in `TC_OREGON_COMPLIANCE.md` against a verified primary source.
7. `docs/TC_SYSTEM.md` roadmap + `docs/TC_SKYSLOPE_PARITY.md` status updated.
8. Committed to `main` (explicit pathspec; `Approved-by: matt` for Matt-directed work) + pushed (retry loop) + deploy watched.

## 9. Hard rules (carry every item)
- Oregon-law claims cite ORS/OAR/OREF primary sources, verified in-session. Unverifiable → flag, don't encode. Don't overstate compliance.
- Draft-first for client-facing deliverables; code/docs ship after browser verification.
- Brokers never hand-build forms; signatures come from verified templates; nothing reaches a client unreviewed.
- Never hard-delete within the 6-year retention window — archive.
- Stage files explicitly (shared working tree with a parallel session).
- One complete, shippable item per commit. Thorough beats fast.
