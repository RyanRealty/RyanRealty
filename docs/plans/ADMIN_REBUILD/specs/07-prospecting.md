# Spec 07 · Prospecting — Expireds, FSBOs, Expired Outreach

> **Area:** the ONE prospecting surface over the `detect → skip-trace → CRM → auto-CMA → guarded-send` spine.
> **Replaces:** 4 routes (`/admin/expireds`, `/admin/expired-listings[/[key]]`, `/admin/expired-outreach`, `/admin/fsbos`) + 2 competing SMS pipelines with contradictory guarantees.
> **Derived from:** `00-REASONING-AND-ARCHITECTURE.md` (C1–C5, RC1–RC7, §4.2/§4.4/§4.5/§4.6/§4.7) and `audit-reports/prospecting.md` (every `file:line` below is from that report, re-verified against the working tree at `d3dd457a`).
> **Conforms to:** §4.2 optimistic+idempotent mutation; §4.4 one auth primitive/capability map; §4.5 one definition per number; §4.6 cached DAL + streaming; §4.7 one canonical surface per concept.

---

## 0. The job this surface serves (C2)

Prospecting is the **top-left edge of the loop**: a listing expires (or a FSBO appears), the system detects it, resolves the owner + compliance, builds a seller-facing analysis (expired-audit / CMA), and the broker sends ONE compliant intro that carries that analysis. The owner replies → it becomes a normal conversation in the Inbox → the deal is tracked to close. So prospecting **manufactures leads and hands them to the response half of the loop.** It is not a separate product; it is a lead factory feeding PEOPLE.

The owner's litmus (§6) applies verbatim: *"text this expired owner their report, in seconds."* Today that job is **2 pages, 2 row-finds, ~5 clicks + a 60s blocking wait** (audit §10) because the automation builds a document one surface refuses to use (Defect 4) and the send lives on a different page than the build (Defect 4/§4.4). This spec makes it **1 surface, 1–2 taps, no rebuild.**

### Root causes this spec kills

| Symptom (audit) | Root cause | Fix in this spec |
|---|---|---|
| Two SMS pipelines, divergent guards/templates/link handling (Defect 7) | RC4 (accretion, no source of truth) | §5 ONE reconciled send path |
| Auto-CMA built as `doc_type:'cma'`, surface demands `'expired-audit'` → manual 60s rebuild (Defect 4) | RC6 (placebo: automation produces an artifact the surface refuses) | §4.1 `doc_type` threaded end-to-end |
| Hard-stop is a free-text regex the Tracerfy path never populates → deceased/DNC one click from a text (Defect 3) | RC6 (wrong source of truth) + C5 | §6 tag-based hard-stop, fix Strategy 2, delete the regex |
| FSBO off-market guard tests `status:'gone'` nothing writes; no FSBO re-list guard (Defect 2) | RC6 (placebo guard) + C5 | §6.4 real status lifecycle + MLS re-list guard |
| Broker clicks a property → access-denied (Defect 1) | RC5 (nav ≠ access) | §4.4 one capability, gated once |
| `confirm()` send, whole-queue recompute per send, double-send race (Defect 8/16, §7) | RC2 (no optimistic/idempotent layer) | §5 optimistic + at-most-once claim |
| Desktop-only 7-col tables, action column off-screen on phone (§8) | RC3 (not mobile-first) | §8 one responsive tree, mobile-first |
| 5,000-row `visitor_events` scan per load, `force-dynamic`, ~10 serial queries (Defect 10, §7) | RC4 + §4.6 | §7 cached, bounded engagement reads |

---

## 1. Keep / Rebuild / Delete (explicit, cited)

### KEEP (solid core — never discard; audit §11)

- **Suppression chokepoint** `isSuppressed` / `isSuppressedByEmail` (`lib/crm/suppressions.ts:31,84`) — fail-closed on any read error, consulted on every live send path. **This is the authoritative compliance gate.** Verified: `TAG_CHANNEL` maps `compliance:hard-stop`→all, `contact:do-not-text`→sms, `contact:do-not-call`→call+sms (`suppressions.ts:18-29`).
- **Quiet hours** `inSmsQuietHours` (`lib/crm/quiet-hours.ts`, 8am–9pm America/Los_Angeles) — single shared impl on all SMS actions.
- **Merge-token fail-closed refusal** `findUnresolvedMergeTokens` on every composed send (`send-doc.ts:213,257`, `expired-outreach.ts:126`).
- **Auto-enroll gate (KEEP AS-IS):** the source-taxonomy short-circuit. `classifyLeadSource(source).outreachList` blocks Plan 71/72 sequences for `expired-listing-cron`/`expired-outreach-queue`/`fsbo-cron`/`fsbo-outreach` (`lib/data/crm/leadSourceTaxonomy.ts:87-88,124-135`; `enroll.ts:57-60`; `crm-auto-enroll/route.ts:138-142`), with the inbound `-lp` form carve-out that still enrolls (correct). **Not the stale `fub_created_at` gate** — that comment is a hazard (Defect 14), see §6.5.
- **Expired live re-list check at send time** (`outreach.ts:59-77` batch, `:215-230` single) — never solicit an on-market listing.
- **Detection dedupe** on `expired_listings.listing_key` (`processor:213-216`) and `fsbo_listings.fsbo_url` — prevents re-alerting across overlapping windows.
- **Short-link click tracking** with bot filtering, `_pid` session stitching, no-open-redirect (`app/r/[code]/route.ts`, `lib/data/crm/shortLinks.ts`).
- **The CMA/BPO send libs** — `sendCmaToLead` (`lib/cma/send.ts`, Gmail-DWD-with-Resend-fallback, suppression fail-closed at `:300-302`, open/click tracking) and the deterministic `buildCma` engine incl. the **expired-audit variant** (`lib/cma/build.ts:283-`). These are §3 kept-core. Keep the libs; kill the redundant surfaces.
- **The CMA build queue + worker** — `createCmaRequest` (`lib/cma-request.ts:103`) → `marketing_brain_actions` row → `runCmaBuildWorker` (`lib/cma/worker.ts:135`, `maxDuration=300`). The async build spine. Keep it; **route the dashboard "Build" through it** instead of a synchronous 60s server action (§4.2, Defect 9).
- **Detection crons + processors** — `processNewExpiredListings` (called from `sync-delta:533-548`), `detectFsboListings`, `lib/expired-owner-lookup.ts`, `lib/owner-resolution.mjs` (Deschutes county + BatchData). Keep; patch the compliance-tag gaps (§6) and the silent-failure gaps (§6.4).

### REBUILD

- **The 4 routes → ONE surface** `/admin/prospecting` with an Expired | FSBO type filter (§4.7). The old routes become redirects (§3 sequencing).
- **The 2 SMS pipelines → ONE reconciled send** (§5). `sendExpiredIntroAction` (`app/actions/expired-outreach.ts:45`) and `sendDocSmsAction` (`app/actions/send-doc.ts:240`) collapse into `sendProspectingIntro` with the intro semantics (auto-linked CMA + one-intro-ever) and §4.2 optimistic/idempotent behavior.
- **Hard-stop resolution** — from free-text regex (5 duplicate sites: `dashboard.ts:190`, `outreach.ts:98,321`, `fsbo/dashboard.ts:171`, `fsbo-dashboard.ts:90,131`, `send-doc.ts:96`) → tag-based read via `isSuppressed` + a persisted structured flag (§6.1).
- **The two dashboard DALs** — `lib/data/expired/dashboard.ts` (208 lines) and `lib/data/fsbo/dashboard.ts` (95% copy, 186 lines) → ONE parameterized `listProspects(kind)` (§4.7, kills the duplication map §6 of the audit).
- **Engagement aggregation** — the global newest-5,000 `visitor_events` scan (`dashboard.ts:140-165`) → bounded, cached, per-doc read (§7).
- **Build UX** — synchronous `setMsg('Building… about a minute')` label with no timeout/`maxDuration` (`ExpiredAuditActions.client.tsx:27-32`) → async queued build with optimistic "Building" pill + poll (§4.2, §5.4).

### DELETE (dead / placebo / duplicate; audit §9)

- **Dead actions (zero consumers, grep-verified):** `sendExpiredAuditEmailAction` (`expired-dashboard.ts:56-106`), `sendFsboCmaEmailAction` + `sendFsboIntroSmsAction` (`fsbo-dashboard.ts:82-199`), `previewExpiredIntroAction` (`expired-outreach.ts:158-180`).
- **The `fsbo_listings.status='gone'` guard trio + "off market" badge** (`fsbo-dashboard.ts:93,134`; `send-doc.ts:98/:208/:251`; `fsbos/page.tsx:90`) — a reachable UI/guard for an unreachable state (nothing writes `'gone'`). Replace with the real lifecycle (§6.4), not delete-and-leave.
- **The hardcoded template preview** (`expired-outreach/page.tsx:41-46`) — preview ≠ what sends (Defect 13). The composer shows the actual merged body.
- **The 5 duplicate hard-stop regexes** — replaced by one tag read (§6.1).
- **The `/admin/expired-listings` redirect stub under a superuser layout** (Defect 1, §4.2) — folds into `/admin/prospecting`; the stub's superuser layout is deleted.

### NEVER DELETE (documented restore paths / load-bearing fallbacks)

- `void autoEnrollPerson` in `expired-listing-processor.ts:380` — the documented Plan-71 restore path (Matt paused auto-enroll 2026-07-11; the import stays).
- `fub_person_id` read as person-id fallback — native ids were written into that column post-cutover (`fsbo-processor.ts:276`); keep the `outreach_crm_person_id ?? fub_person_id` resolution until a backfill nulls the legacy usage. (Naming trap, not a bug.)

---

## 2. Target surface — `/admin/prospecting`

ONE worklist over both prospect kinds. Reachable from **TODAY** ("Prospecting · N expired owners to work · M FSBOs") and from the nav. Gated by a single capability `prospecting` (superuser + broker), enforced once (§4.4) so nothing shown dead-ends.

```
/admin/prospecting
├── header: type toggle [ Expired · FSBO ] + summary chips (Ready to send · Needs audit · Sent · Excluded · No phone)
├── streamed worklist (one <Suspense> region): one card per prospect
│     ├── identity: owner name · address · city · last list price · expired/detected date
│     ├── compliance ribbon (if hard-stop / relisted / off-market / no-phone / suppressed)
│     ├── doc state pill: — none · Building… · Audit ready · Sent
│     ├── engagement: report views · link taps · last activity (cached, §7)
│     └── row actions (adapt by state, §5.2): Build audit · Review · Send intro · Email report · Open in CRM
└── row → Review detail (drawer/route §4.4) OR Open in CRM → PERSON workspace (the canonical send path, §5.5)
```

There is **no separate "outreach queue" page.** The worklist *is* the queue; the "Ready to send" chip filters to sendable rows. There is **no separate FSBO dashboard**; the type toggle switches the source table (`expired_listings` ↔ `fsbo_listings`) through one DAL.

### 2.1 IA placement

Per §5 the eight destinations don't name "prospecting." This surface is a **lead-factory worklist** — closest sibling to TODAY (triage) and PEOPLE (it produces contacts). Default: its own nav item `Prospecting` under the People group, plus a TODAY card. Final placement is an **open question for Matt** (§15 Q1).

---

## 3. Sequencing & migration (no flag-day)

1. **Additive migration** (§4) lands first: `doc_type` threading, compliance columns, `cma_id` FK, FSBO status lifecycle, template seed, conditional-claim RPC. Nothing reads them yet — back-compatible.
2. **Backfill** existing 144 expired + FSBO rows: set `compliance_hard_stop`/`compliance_flags` from the person's live tags where `outreach_crm_person_id` is set, else re-derive from the structured lookup result on next `owner_lookup` (never from the free-text regex). Set `cma_id` from the current slug join.
3. **Build `/admin/prospecting`** reading the new columns; old 4 routes become 301-style `redirect()` shims (kept until analytics confirm no external links).
4. **Delete pass:** dead actions, regexes, hardcoded preview, superuser stub layout.

`expired_listings` / `fsbo_listings` remain the source of truth for detection; `crm_people` remains the source of truth for compliance tags; `cmas` for documents. This spec adds columns, never drops.

---

## 4. Data model

Source of truth: `expired_listings` (~144 rows), `fsbo_listings`, `cmas` (~155 rows), `crm_people.tags` (compliance), `marketing_brain_actions` (build queue). All migrations **additive, back-compatible** (no drops, defaults on new columns).

### 4.1 Fix the auto-CMA doc-type mismatch (Defect 4) — thread `doc_type` end-to-end

The break, verified:
- `createCmaRequest` (`lib/cma-request.ts:214-`) builds the action `payload` with **no `doc_type`**.
- `runCmaBuildWorker` → `buildCma(...)` (`lib/cma/worker.ts:68-86`) passes **no `docType`**.
- `buildCma` defaults `doc_type:'cma'` (`lib/cma/build.ts:283`).
- The Expireds surface requires `doc_type === 'expired-audit'` to offer Send (`expireds/page.tsx:72,96`).

Fix (no schema change — `payload` is `jsonb`):
1. `createCmaRequest` gains `docType?: 'cma' | 'expired-audit'` (default `'cma'`); writes it to `payload.doc_type`.
2. `expired-listing-processor.ts:392` calls `createCmaRequest({ ..., docType: 'expired-audit' })`. FSBO processor stays `'cma'` (correct — FSBOs get a plain CMA).
3. `lib/cma/worker.ts` reads `str(payload['doc_type'])` and passes `docType` to `buildCma`.
4. **ONE "built" definition** (`lib/data/prospecting/docs.ts` → `getBuiltDocForProspect(kind, prospect)`): returns the doc only when `cmas.doc_type === expectedFor(kind)` (`expired`→`'expired-audit'`, `fsbo`→`'cma'`) **and** status is sendable (`draft`/`finalized` with `html_path` populated, not `pending:`). Both the worklist pill and the send-guard read this one helper — the two surfaces can no longer disagree about "built."

Result: the cron-built expired document lands as an **audit**, the surface accepts it, the 60s manual rebuild (Defect 4) is gone.

### 4.2 Link the document by id, not a fuzzy slug (Defect 6) — additive FK

Slug-only joins (`slugifyAddress` strips street-type + zip but not city, 40-char cap — `address-slug.ts:11-23`) can cross-link two properties (same street number+name in two cities, or 40-char twins) onto one document + one client identity.

Migration `add_prospect_cma_link`:
```sql
ALTER TABLE public.expired_listings ADD COLUMN IF NOT EXISTS cma_id uuid REFERENCES public.cmas(id);
ALTER TABLE public.fsbo_listings   ADD COLUMN IF NOT EXISTS cma_id uuid REFERENCES public.cmas(id);
CREATE INDEX IF NOT EXISTS idx_expired_cma_id ON public.expired_listings(cma_id);
CREATE INDEX IF NOT EXISTS idx_fsbo_cma_id    ON public.fsbo_listings(cma_id);
```
- `createCmaRequest` returns `{ ok, cmaId, slug }`; the processor stamps `expired_listings.cma_id = cmaId` (and FSBO analog) when it queues the auto-CMA.
- `getBuiltDocForProspect` resolves the doc by `cma_id` first, slug **only** as a legacy fallback (logs a `console.warn` when it has to fall back, so drift is visible).
- Backfill sets `cma_id` from the current slug join once, at migration time.

### 4.3 Persisted, structured compliance state (Defect 3) — additive columns

The hard-stop truth must be **structured**, written from the structured skip-trace signal, never parsed from prose. Migration `add_prospect_compliance_flags`:
```sql
ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS compliance_hard_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,   -- e.g. ["litigator","dnc:tcpa","deceased"]
  ADD COLUMN IF NOT EXISTS compliance_source text;                                -- 'batchdata' | 'tracerfy' | 'apify' | 'manual'
ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS compliance_hard_stop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_source text;
```
These are the **display + fail-closed-secondary** source. The **authoritative send gate** stays the live `isSuppressed(personId,'sms')` tag read (§6.1). Send is blocked if EITHER says hard-stop (union = fail-closed).

### 4.4 FSBO status lifecycle (Defect 2) — additive enum discipline

`fsbo_listings.status` already exists (`text default 'active'`); only `'active'` is written (`fsbo-processor.ts:76,286`). No migration needed for the column; the **writers** change (§6.4). Documented allowed values: `'active' | 'off_market' | 'relisted'`. A CHECK constraint is optional (open question §15 Q4 — a bad scrape must never be able to mass-write a wrong status, so the writer guards matter more than the constraint).

### 4.5 At-most-once send claim (Defect 8) — conditional-update, no new table

Replace the unconditional stamp `markExpiredOutreachSent` (`outreach.ts:376-384`, and the FSBO equivalent in `send-doc.ts:293-296`) with a **claim/finalize/release** trio:
```sql
-- claim: returns 1 row iff not already sent/claimed
UPDATE public.expired_listings
   SET outreach_sms_status = 'sending', outreach_claim_at = now()
 WHERE listing_key = $1
   AND outreach_sms_sent_at IS NULL
   AND (outreach_sms_status IS DISTINCT FROM 'sending' OR outreach_claim_at < now() - interval '2 minutes')
 RETURNING listing_key;
```
Migration `add_prospect_send_claim`:
```sql
ALTER TABLE public.expired_listings
  ADD COLUMN IF NOT EXISTS outreach_sms_status text,     -- null | 'sending' | 'sent'
  ADD COLUMN IF NOT EXISTS outreach_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_idempotency_key text;
ALTER TABLE public.fsbo_listings
  ADD COLUMN IF NOT EXISTS outreach_sms_status text,
  ADD COLUMN IF NOT EXISTS outreach_claim_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_idempotency_key text;
```
Order (the sequence-executor pattern the architecture praises, §3): **claim → send Twilio → finalize (`status='sent'`, `outreach_sms_sent_at=now()`, sid, idempotency_key) → on Twilio failure, release (`status=null`, `claim_at=null`)**. A concurrent second tap claims 0 rows → aborts *before* Twilio. The stale-claim window (`> 2 min`) frees a claim orphaned by a crash between claim and finalize.

### 4.6 Seed the intro templates (Defect 12) — additive seed migration

`expired-first-touch-sell-v1` and `fsbo-first-touch-v1` exist **only as hosted-DB rows** (no migration/seed; only a column comment references the former — `20260712020000_expired_outreach_tracking.sql:10`). A fresh env's queue send fails "template not found or inactive." Migration `seed_prospecting_templates` inserts both into `crm_templates` (channel `sms`, `is_active=true`) with `ON CONFLICT (key) DO NOTHING` (never clobber Matt's live edits). Body uses `%address%` + `%cma_link%` merge tokens (matching `renderCrmMerge`).

### 4.7 Columns touched — summary

| Table | Existing (read) | New (this spec) |
|---|---|---|
| `expired_listings` | `listing_key, street_address, city, postal_code, owner_name, contact_phone, contact_email, standard_status, expired_at, list_price, enrichment_notes, status_change_timestamp, outreach_sms_sent_at, outreach_crm_person_id, outreach_sms_sid, fub_person_id, alert_sent_at` | `cma_id`, `compliance_hard_stop`, `compliance_flags`, `compliance_source`, `outreach_sms_status`, `outreach_claim_at`, `outreach_idempotency_key` |
| `fsbo_listings` | `fsbo_url, street_address, city, postal_code, owner_name, contact_phone, contact_email, enrichment_notes, status, fub_person_id, outreach_crm_person_id, outreach_sms_sent_at, last_seen_at` | same new set as above |
| `cmas` | `id, slug, status, doc_type, recommended_list, build_summary, client_email, html_path` | (none — read only) |
| `marketing_brain_actions` | `payload` (jsonb) | `payload.doc_type` (jsonb key, no DDL) |
| `crm_people` | `tags` (compliance source of truth) | (none — written by processor via `enrichNativeLead`, §6.1) |

---

## 5. The ONE reconciled send pipeline

Today two pipelines to the same owner (audit §1): the queue path (`expired-outreach.ts`, one-intro-ever + auto-linked CMA + fixed template) and the dialog path (`send-doc.ts`, unlimited repeats + manual link paste + any template). Reconcile to **one intro send**, plus normal CRM conversation afterward.

### 5.1 Two send jobs, cleanly separated

1. **The prospecting INTRO (SMS)** — the cold first touch. Guarded, one-per-owner-ever, auto-carries the built audit/CMA link. This is `sendProspectingIntro(kind, id, { idempotencyKey })`. The single reconciled SMS action.
2. **Everything after** — normal conversation from the PERSON workspace (Inbox composer, §4.2 primitive) + the canonical **CMA/BPO email send** (`sendCmaToLead`, kept lib). No prospecting-specific second SMS path. The dialog's "repeat composed sends" behavior is **deleted** — after the intro, you're in a conversation, not a cold-outreach flow.

This kills Defect 7 (contradictory guarantees): there is exactly one cold-SMS path, and it enforces one-intro-ever by construction (§5.3).

### 5.2 Row action state machine (worklist)

| Prospect state | Primary action | Secondary |
|---|---|---|
| No doc built | **Build audit** (queues async, §5.4) | Review · Open in CRM |
| Building | **Building…** (disabled pill, polls) | Review |
| Audit ready, sendable, not sent | **Send intro** (1 tap → optimistic) | Email report · Review · Open in CRM |
| Audit ready, hard-stop / relisted / off-market / no-phone / suppressed | *(no send)* compliance chip explains why | Review · Open in CRM |
| Intro sent | **Sent {date}** + engagement | Open in CRM (continue the conversation) · Email report |

### 5.3 `sendProspectingIntro` — the reconciled action (server)

Signature: `sendProspectingIntro(kind: 'expired'|'fsbo', id: string, args: { idempotencyKey: string }): Promise<SendResult>`. `SendResult = { ok:true; sid:string; messageId:string } | { ok:false; error:string; code:GuardCode }`. Guards run **in order, fail-closed** (superset of both current chains, deduped):

1. **Auth (in-body, §4.4):** `requireAdmin('prospecting')`. Not the layout gate — this is an independently-invocable POST.
2. **Idempotency:** if a row already has `outreach_idempotency_key === args.idempotencyKey`, return the **original** result (no-op). Duplicate submit = same result, never a second text (§4.2).
3. **Built-doc:** `getBuiltDocForProspect(kind, prospect)` must return a sendable doc (§4.1). Refuse otherwise ("Build the audit first").
4. **Re-list (live):** expired → `isRelistedNow(prospect)` (`outreach.ts:215-230` shape, reused); FSBO → the same MLS re-list check (§6.4, new). Refuse if on-market.
5. **Off-market (FSBO):** refuse if `status !== 'active'` (real status now, §6.4).
6. **Hard-stop (tags, §6.1):** resolve the person; `isSuppressed(personId,'sms')` OR persisted `compliance_hard_stop` → refuse. **No regex.**
7. **Phone:** `toE164(contact_phone)` must resolve.
8. **Quiet hours:** `inSmsQuietHours()` → refuse (8am–9pm Pacific).
9. **Ensure native lead + suppression** (already covered by step 6's `isSuppressed`, re-run post-`ensureNativeLead` in case creation resolved a new person).
10. **Claim (§4.5):** conditional-update claim. 0 rows → "Intro already sent/sending." Abort before Twilio.
11. **Template + merge, auto-linked CMA:** load live `crm_templates` row (never a hardcoded preview); build `%cma_link%` = `{SITE_URL}/cma/{slug}?_pid={personId}&utm_source=crm&utm_medium=sms&utm_campaign={kind}` (matches `expired-outreach.ts:119`); `renderCrmMerge`; `findUnresolvedMergeTokens` → refuse if any unresolved. **The link is always inserted** (not "paste it if you want" — Defect, `SendDocDialog:224-226`).
12. **Short-link** (`instrumentSmsLinks`, fail-open to untracked body).
13. **Send** `sendSmsViaMessagingService` (A2P pre-checked).
14. **Finalize:** stamp `outreach_sms_status='sent'`, `outreach_sms_sent_at=now()`, `outreach_sms_sid`, `outreach_idempotency_key`, `outreach_crm_person_id`; write the message row (§5.6); enrich the person (`customClassification`, address); create a **follow-up task** ("No reply to expired intro — follow up", due +3 days). On Twilio failure: **release** the claim (§4.5) and return the error.
15. **Return the message entity** (§4.2) — the client patches local state; **no `revalidatePath`/`router.refresh()`**.

### 5.4 Build (async, no 60s synchronous action) — Defect 9

The dashboard "Build audit" today is a synchronous server action self-describing "about a minute" with **no `maxDuration`** on the page segment (`ExpiredAuditActions.client.tsx:30`) — a plausible platform-default timeout, work half-done. Rebuild:
- `buildProspectDoc(kind, id)` enqueues a `createCmaRequest({ docType })` row (or re-queues an existing killed/failed one) and returns immediately with the action id.
- The worklist row shows an optimistic **Building…** pill and polls a cached status endpoint (`getBuildStatus(actionId)`) every ~5s until the doc is `ready`/`killed`. The heavy build runs in `runCmaBuildWorker` (`maxDuration=300`), the correct home for a 30–60s job.
- On `killed` (3 attempts), the pill becomes **Build failed — retry** with the recorded reason (`marketing_brain_actions.killed_reason`).

### 5.5 Handoff to the PERSON workspace (the canonical send path, §4.7/§6)

"Open in CRM" and the intro's post-send follow-through deep-link to `/admin/crm/{personId}` (the PERSON workspace) with `?doc={slug}` preserved through auth (§4.4, fixes lost-`next`). The workspace is where all *subsequent* sends happen (reply, email the audit, send a fresh CMA) via the §4.2 composer — one send path, not a prospecting-local composer. The prospecting surface owns only the **cold intro**; the workspace owns the conversation.

### 5.6 Message persistence (conforms to §4.1)

- **Interim (before the conversation model ships):** log to `crm_timeline` (`kind:'sms_out'`) exactly as today (`expired-outreach.ts:138-146`) **plus** `payload.idempotency_key` and `payload.provider_sid = sid` (one consistent SID key, not the current `twilioSid`/`sid`/`messageSid` fragmentation the architecture calls out).
- **After §4.1 lands:** the intro creates/*reuses* the owner's `conversation` (participant = the person), inserts one typed `message` row (`direction:'out'`, `channel:'sms'`, `provider_sid`, `idempotency_key`, `delivery_state`). Delivery receipts attach via `provider_sid` on every path. The prospecting send is then just "a message on the owner's conversation" — the reply lands in the same thread in the Inbox, closing the loop (C2). **This spec depends on 06-messaging for that entity; the interim path ships first and migrates.**

---

## 6. Compliance gates (fail-closed)

### 6.1 Hard-stop reads the TAG system, not a free-text regex (Defect 3, C5)

**Delete** all 5 regex sites (`/HARD STOP|LITIGATOR/i.test(enrichment_notes)`): `dashboard.ts:190`, `outreach.ts:98,321`, `fsbo/dashboard.ts:171`, `fsbo-dashboard.ts:90,131`, `send-doc.ts:96`.

**Replace with** `getProspectHardStop(prospect)`:
- If `outreach_crm_person_id` (or `fub_person_id` fallback) resolves a person → `isSuppressed(personId,'sms').suppressed` (this reads `crm_people.tags` for `compliance:hard-stop`/`contact:do-not-text`/`contact:do-not-call` via `TAG_CHANNEL`, and `crm_suppressions` — the authoritative, fail-closed source).
- **OR** the persisted `compliance_hard_stop` boolean (§4.3) — covers rows with no person yet (display) and is a fail-closed secondary.
- Union: hard-stop if **either** is true. On any read error, fail-closed hard-stop (mirrors `isSuppressed`).

**Fix the writer (the real gap):** the Tracerfy/Apify direct-skiptrace path (`skiptrace-direct`, `expired-owner-lookup.ts:544-560`) returns **no `complianceTags`** — so a person created from it gets none, `isSuppressed` has nothing, and only the (now-deleted) regex could have caught it, which it couldn't (`DECEASED`/`BEST PHONE ON DNC` don't match `/HARD STOP|LITIGATOR/`). Two changes:
1. `enrichOwnerContact` (the direct path) must return structured `{ complianceTags, hardStop, flags }` derived the same way `owner-resolution.mjs:129-175` does (`hardStop = litigator || dncTcpa || deceased`; tags: `compliance:hard-stop` + `contact:do-not-call` + `contact:do-not-text` when hardStop; `contact:do-not-call` when any phone DNC).
2. The direct path's `?? allPhonesRaw[0]` fallback (`expired-owner-lookup.ts:287-290`) that stores a **DNC phone** as `contact_phone` with no tag is **removed** — if every phone is DNC, store **no phone** and set `contact:do-not-call` (a no-phone row is not sendable, which is correct; a DNC-phone-with-no-tag row is a violation).
3. The processor writes `compliance_hard_stop`/`compliance_flags`/`compliance_source` onto the `expired_listings`/`fsbo_listings` row from the structured result (all lookup strategies), AND applies the tags to the person via `enrichNativeLead` (already done on the county path at `processor:346`; now on every path).

**Belt-and-braces preserved:** the county/BatchData path already sets both tags and notes; nothing there regresses.

### 6.2 Suppression + quiet hours (KEEP)

Unchanged. Every send path calls `isSuppressed(personId,'sms')` (fail-closed) and `inSmsQuietHours()`. The email rail keeps its in-lib `sendCmaToLead` suppression check (`lib/cma/send.ts:300-302`).

### 6.3 Expired re-list guard (KEEP + centralize)

Keep the live send-time re-list check (never solicit an on-market listing). Centralize the two divergent shapes (`outreach.ts:59-77` batch, `:215-230` single) into ONE `isRelistedNow(prospect)` used by both the worklist (for the "Excluded/relisted" chip — replacing the hardcoded `relisted:false`, Defect 15) and the send guard. The worklist now shows relisted **before** the broker taps Send, not only at send-refusal.

### 6.4 FSBO off-market + re-list guards (Defect 2 — build the missing truth)

Two missing guards, both compliance-adjacent (never solicit a property that's off-market or now another broker's listing):

1. **Real off-market status.** `detectFsboListings` must mark previously-active rows **not seen in a *successful* scrape** as `status='off_market'`. This depends on the silent-failure fix (§6.6): only when `scrapeZillowCity` reports success can "not in results" mean "gone." A failed city scrape **must not** touch statuses (else a bad scrape mass-marks everything off-market). Writer rule: `UPDATE fsbo_listings SET status='off_market' WHERE fsbo_source=$city AND last_seen_at < $thisRunStartedAt AND status='active'` — **only inside the success branch for that city.**
2. **MLS re-list guard.** Add `isFsboRelistedNow(prospect)` = the same MLS `Active/Pending/Coming Soon` address match used for expireds (§6.3). An FSBO owner who signs with a brokerage (now Active in MLS) is excluded. Replaces the hardcoded `relisted:false` (`send-doc.ts:97`).

Send guards (§5.3 steps 4–5) now test **real** values.

### 6.5 Auto-enroll gate (KEEP — and delete the stale comment)

The gate that prevents Plan 71/72 sequences firing on skip-traced owners is the **source taxonomy** (`outreachList:true`), double-enforced (function + cron). KEEP exactly. **Delete the misleading `fub_created_at` comment** at `fsbo-processor.ts:19-23` (Defect 14) — it describes a gate that no longer exists and would mislead an engineer into thinking a `fub_created_at` backfill re-enables texting. Replace with a one-line pointer to `leadSourceTaxonomy.ts`.

### 6.6 FSBO silent detection failure (Defect 5)

`scrapeZillowCity` swallows every error to `[]` (`fsbo-detector.ts:426-441`), so `detectFsboListings.errors[]` is unreachable, `stats.scrape_errors` always clean, and the dashboard's "No FSBOs detected yet" empty state reads as success even when Apify hit its $200 cap (a known recurring failure). Fixes:
1. `scrapeZillowCity` **throws** on failure (or returns `{ ok:false, error }`); `detectFsboListings` collects real per-city errors and returns them in `stats`.
2. On any city error, send the Matt alert (Resend) — the same alert channel expired detection uses.
3. The worklist empty state distinguishes **"0 detected (last scrape OK {time})"** from **"Scrape failed — {reason}"** (never render a failure as a cheerful empty state).
4. **Budget vs timeout:** 6 cities × Apify `run-sync timeout=180` (`fsbo-detector.ts:419`) against route `maxDuration=300` can eat the whole budget; late cities (Tumalo, La Pine) silently never run. Reduce per-city timeout to fit `6 × t ≤ 270s` (t ≤ 45s) OR chunk cities across runs OR raise `maxDuration`. Decide in build (open question §15 Q3 — Matt may prefer fewer cities per run over a longer function).

---

## 7. Performance (§4.6)

- **Cached, bounded engagement reads.** Kill the per-load global newest-5,000 `visitor_events` scan (`dashboard.ts:140-165`, duplicated in fsbo `:120-147`). Engagement (report views, link taps) is a per-doc aggregate: query `visitor_events` filtered to the specific `cma_id`/slug set of the ≤144 visible rows (bounded by rows shown, O(rows) not O(global events)), wrapped in `unstable_cache` tagged `prospecting:engagement:{kind}`, invalidated on a new `sms_click`/doc-view for a listed slug. Link-tap counts come from `crm_timeline` (`sms_click`) filtered to the resolved person ids, not a global scan.
- **`email_sent_at` attribution fix.** Today it falls back to **any** `email_out` for the person (`dashboard.ts:200`) — an unrelated CRM email shows as the report send. Read the doc-tracker email event keyed to the `cma_id`/slug, not any `email_out`.
- **No whole-queue recompute per send.** `getExpiredOutreachRow = listExpiredOutreachQueue().find()` (`outreach.ts:111-114`) re-reads all expired rows + the `listings` probe + the entire `cmas` table for **every single send and preview**. Replace with a single-row read `getProspect(kind, id)` (one `expired_listings`/`fsbo_listings` row + one `getBuiltDocForProspect` + one `isRelistedNow`).
- **Bounded reads (Defect 11).** The unbounded `cmas` full-table read (`outreach.ts:80`) and `expired_listings` full reads (`outreach.ts:45`, `dashboard.ts:57`, `:343`) silently truncate at PostgREST's 1,000-row cap (144/155 today). The new `getBuiltDocForProspect` resolves by `cma_id` (indexed point lookup), not a full-table scan. The worklist list read stays bounded by page size (add cursor pagination now, before growth — §8).
- **Streamed shell + `<Suspense>`.** The worklist chrome (header, type toggle, chips) renders instantly; the row list is one suspended region. No `force-dynamic` full fan-out.
- **One responsive tree, no double render** (§8).

---

## 8. Responsive behavior (ONE tree, mobile-first — §4.3, RC3)

Today the two dashboards are 7-column `overflow-x-auto` tables — on a phone the **Actions column (the whole point) starts off-screen**; row buttons are `h-8` (32px, sub-44px) while the outreach page uses `h-11` (§8 of audit). Rebuild as **one card-list component**, mobile-first:

- **Phone (default):** each prospect is a **card**, not a table row. Identity + compliance ribbon + doc pill stacked; the primary action (**Send intro** / **Build audit**) is a full-width `h-11` (44px) button at the card foot — always on-screen, never in a horizontal scroll. Secondary actions in an overflow menu.
- **Tablet/desktop (progressive enhancement of the *same* tree):** cards flow into a denser 2–3 column grid; an optional table view toggles on for bulk scanning (same data, same actions, CSS/container-query — not a second tree, not `md:hidden` twins).
- The type toggle, chips, and Review drawer are identical across sizes. No 27-component mobile fork (RC3).
- **Replace the native `confirm()`** (`ExpiredOutreachRow.client.tsx:26-29`, Defect 16) with a design-system `Dialog`/`Sheet` confirm that shows the **actual merged body** (what sends), not an OS-truncated preview.

---

## 9. States (every one)

| State | Worklist row | Send button |
|---|---|---|
| **Empty (0 prospects, scrape OK)** | "No {expired listings / FSBOs} right now. Last check {time}." | — |
| **Empty (scrape/detection failed)** | "Detection failed — {reason}. Matt alerted." (never a cheerful empty state, §6.6) | — |
| **Loading (streamed)** | skeleton cards in the suspended region; chrome already interactive | — |
| **Populated, no doc** | identity + "No audit yet" pill | **Build audit** |
| **Building (optimistic)** | **Building…** pill, polling | disabled |
| **Build failed** | **Build failed — {reason}** | **Retry build** |
| **Ready, sendable** | audit pill + recommended price | **Send intro** (enabled) |
| **Pending/optimistic send** | bubble/pill flips to **Sending…** instantly (§4.2) | disabled + spinner |
| **Send success** | **Sent {date}** + sid confirmation; engagement begins | replaced by "Open in CRM" |
| **Send partial** (Twilio ok, stamp/log failed) | **Sent — logging issue** (surfaced, not swallowed); claim finalized so no double-send | — |
| **Send error** (Twilio failed) | claim **released**; **Retry** affordance, original body preserved | re-enabled |
| **Offline** | Send queued locally is **not** offered for a compliance send (a cold text must confirm delivery); button shows "Reconnect to send" | disabled |
| **Permission-denied** (report_viewer, or missing `prospecting` cap) | the nav item is not rendered at all (§4.4); a direct URL hit shows the standard access surface — **never** a nav item that dead-ends (fixes Defect 1) | n/a |
| **Over-limit** (quiet hours) | compliance chip "Quiet hours — send after 8am Pacific"; button disabled with reason | disabled |
| **Hard-stop / relisted / off-market / suppressed / no-phone** | compliance chip explains which; send not offered | absent |

Every mutation (build, send) is **optimistic + idempotent** (§4.2): the UI reflects the change instantly, the action returns the entity, the client patches local state, no full-page refresh.

---

## 10. Edge cases (exhaustive, specific to real data)

1. **Deceased-only owner via Tracerfy path.** Before: notes say `DECEASED`, regex misses it, no tag, one click from a text (Defect 3). After: `enrichOwnerContact` returns `hardStop:true` + `compliance:hard-stop`; processor writes tag + `compliance_hard_stop=true`; `getProspectHardStop` blocks; send refuses at step 6.
2. **All phones DNC (Tracerfy path).** Before: `?? allPhonesRaw[0]` stores a DNC number, no tag, sendable. After: no phone stored, `contact:do-not-call` set; row is "No phone" (not sendable). Correct.
3. **Owner resolves to an LLC/trust.** County path resolves the human behind the entity (`owner-resolution`); name filed is the person, not "SOME LLC" (`expired-owner-lookup.ts:491-493`). Unchanged, kept.
4. **Same street number+name, two cities (slug collision).** Before: one `cmas` row + one client identity shared (Defect 6). After: `cma_id` FK distinguishes them; each prospect owns its own doc.
5. **40-char slug truncation twins.** Same as #4 — resolved by `cma_id`, slug only a warned fallback.
6. **Auto-CMA built by cron, broker opens the surface.** Before: shows "plain CMA," demands 60s rebuild (Defect 4). After: lands as `expired-audit`, surface shows **Send intro** immediately.
7. **Two devices/tabs tap Send within the Twilio window.** Before: both send (Defect 8). After: first claims the row (§4.5), second claims 0 rows → "already sending" → aborts before Twilio. Exactly one text.
8. **Duplicate submit (double-tap same device).** Idempotency key (§5.3 step 2) → second call returns the first result, no second text.
9. **Broker (Rebecca/Paul) clicks a property name.** Before: superuser-only detail layout → access-denied (Defect 1). After: one `prospecting` capability gates nav + surface + detail together; broker sees it end-to-end.
10. **Template edited in DB after the row rendered.** Before: hardcoded preview shows old wording; `confirm()` shows text that isn't what sends (Defect 13). After: no hardcoded preview; the composer renders the live merged body = exactly what sends.
11. **Template missing/inactive in a fresh env.** Before: send fails "template not found." After: seeded by migration (§4.6), `ON CONFLICT DO NOTHING`.
12. **Merge token with no value** (`%cma_link%` when no doc built). `findUnresolvedMergeTokens` → refuse; but step 3 already blocked (no built doc). Belt-and-braces.
13. **Lead with no phone.** Row classified "No phone," send not offered; email path still available if `contact_email` present.
14. **MLS sync re-lists the property between build and send.** `isRelistedNow` at send time (§6.3) refuses; the worklist chip also flips to "Relisted" on next cached read (no longer only at send-refusal, Defect 15).
15. **FSBO signs with a brokerage (now Active in MLS).** New `isFsboRelistedNow` (§6.4) excludes it — the missing guard is built.
16. **FSBO delisted from Zillow (sold/off-market).** Successful scrape no longer sees it → `status='off_market'` (§6.4); send refuses at step 5. (Depends on §6.6 so a *failed* scrape can't mislabel it.)
17. **Apify hits the $200 cap mid-run.** Before: `scraped:0`, cheerful empty state (Defect 5). After: real error surfaced, Matt alerted, empty state reads "Detection failed."
18. **Apify slow, late cities never run.** Budget fit (§6.6 #4) or chunking prevents Tumalo/La Pine silently skipping; partial success is reported, not hidden.
19. **Expired session mid-send.** `requireAdmin('prospecting')` in-body (§5.3 step 1) → 401; the optimistic bubble flips to **Sign in to send** (the claim, if taken, releases on the failed auth path — auth is step 1, before claim).
20. **Crash after claim, before finalize.** The `2-minute` stale-claim window (§4.5) frees the row on the next attempt; no permanent lock.
21. **Timeout on a 30–60s build.** Build is async in the worker (`maxDuration=300`, §5.4), not a synchronous page action; the worklist shows Building→Ready/Failed via poll, never a half-done "Build failed" from a platform-default timeout (Defect 9).
22. **Metric with no writer.** The engagement counts now trace to real writers (`visitor_events` doc views, `crm_timeline.sms_click`), scoped to the doc — no fabricated `$0`-style number (C4). `email_sent_at` is the doc-tracker event, not any `email_out` (Defect 10).
23. **Concurrent broker edits (two brokers work the same row).** Both see the same live compliance/relist state (server-resolved); the send claim serializes the actual send; the second broker sees "already sent by {broker} {time}."
24. **Person merged after intro sent.** The intro's message row / timeline entry carries `person_id`; merge follows the CRM's `mergePeopleCore` path — the intro history moves with the surviving person (out of scope here; noted for 06-messaging).
25. **Group/raw-number resolution.** Not applicable to the cold intro (always 1:1 to a resolved owner), but the post-intro conversation lives in the Inbox where group/raw-number rules (§4.1) apply — the intro creates a single-participant conversation.
26. **Suppression added between worklist render and send.** The send re-runs `isSuppressed` live at step 6 (tags are live) → refuses even if the cached card still showed "Ready." Fail-closed.
27. **Idempotency key reused across different listings (client bug).** Key is namespaced `intro:{kind}:{listing_key}`; a mismatched key on a different row won't collide.

---

## 11. Error handling & compliance summary

- **Fail-closed everywhere:** auth, suppression (tag + row), quiet hours, merge tokens, hard-stop (tags ∪ persisted flag), re-list, off-market. Any read error → refuse (mirrors `isSuppressed`).
- **In-body auth (§4.4):** `requireAdmin('prospecting')` inside every action (`sendProspectingIntro`, `buildProspectDoc`, `getBuildStatus`, review reads) — not just the layout gate; actions are independently-invocable POSTs.
- **Data accuracy (§C4):** every price/count shown (recommended list, report views, link taps, sent date) traces to one source (`cmas.recommended_list`, scoped `visitor_events`, `crm_timeline`, `outreach_sms_sent_at`) via one DAL function. No hand-rolled duplicate. No number without a writer.
- **TCPA:** the cold intro is the compliance-sensitive send; it is the ONLY cold-SMS path, guarded by the full chain. `contact:do-not-call` blocks SMS (a text is legally a call — the 2026-06-16 incident fix, `suppressions.ts:21-24`).
- **Partial-send integrity (§C5):** claim-before-send + finalize/release means a Twilio success is never lost (finalized) and a Twilio failure never leaves a phantom "sent" (released). A logging failure after a successful send surfaces as "Sent — logging issue," never as a silent success or a re-send.

---

## 12. Acceptance criteria (writer → store → reader → outcome, §8)

Each must be proven end-to-end with an acceptance test (`verify` discipline).

- [ ] **Doc-type loop.** Detection cron queues an expired CMA → worker builds `doc_type='expired-audit'` → `/admin/prospecting` shows **Send intro** (no rebuild) → tap → the intro carries the audit link. *Writer: processor→worker. Store: `cmas.doc_type`. Reader: `getBuiltDocForProspect`. Outcome: sent with no manual rebuild.* (Kills Defect 4.)
- [ ] **One SMS pipeline.** There is exactly one cold-SMS action (`sendProspectingIntro`); `sendExpiredIntroAction`/`sendDocSmsAction`'s cold-outreach roles are gone; grep finds no second cold-SMS path. The intro always carries the short-linked CMA (never a manual paste).
- [ ] **One-intro-ever + no double-send.** Two concurrent taps → exactly one `crm_timeline`/`message` `sms_out` row, one Twilio sid, `outreach_sms_status='sent'`; the second returns "already sending." A duplicate idempotency key returns the original result. *(Defects 7, 8.)*
- [ ] **Tag-based hard-stop.** A person with `compliance:hard-stop` (or `contact:do-not-text`/`-call`) → `getProspectHardStop` true → send refuses; no regex remains (grep clean for `/HARD STOP|LITIGATOR/`). A Tracerfy-path deceased/DNC owner now carries the tag + `compliance_hard_stop=true` and is blocked. *(Defect 3.)*
- [ ] **FSBO off-market truth.** A FSBO absent from a *successful* scrape flips to `status='off_market'` and is unsendable; a *failed* scrape changes no statuses and alerts Matt. *(Defects 2, 5.)*
- [ ] **FSBO re-list guard.** A FSBO now Active in MLS → `isFsboRelistedNow` true → send refuses. *(Defect 2.)*
- [ ] **Broker access.** Rebecca/Paul open a prospect + its review detail end-to-end; the nav never shows an item that dead-ends. *(Defect 1.)*
- [ ] **Async build.** "Build audit" returns immediately, the row polls Building→Ready; a 60s build never times out a page action. *(Defect 9.)*
- [ ] **Bounded/cached reads.** No page load scans 5,000 global `visitor_events`; engagement is scoped to visible docs and cached; `email_sent_at` = the doc's tracked email, not any `email_out`. *(Defects 10, 11.)*
- [ ] **Success-flow budget (§6).** From the prospect row: **1 tap Build (if needed) → poll → 1 tap Send intro → 1 confirm = done.** The happy path (audit already built by cron) is **1 tap + 1 confirm, one surface, seconds** — no second page, no row re-find, no 60s blocking wait. *(Was 2 pages / 2 row-finds / ~5 clicks + 60s, audit §10.)*
- [ ] **Optimistic feedback.** Tapping Send flips the row to "Sending…" within one frame; on success it patches to "Sent {date}" without a full-page refresh; on Twilio failure it shows Retry with the body preserved. *(RC2.)*
- [ ] **One responsive tree.** The surface is one component; on a phone the primary action is on-screen at 44px; no `md:hidden` twin, no `confirm()`. *(RC3, Defect 16.)*

---

## 13. Open questions for Matt

1. **IA placement (§2.1).** Does Prospecting get its own nav item under People, live as a card on TODAY only, or both? (It's a lead factory, not one of the 8 canonical destinations.)
2. **Post-intro follow-up.** Auto-enroll is paused by your 2026-07-11 directive. This spec adds a **follow-up task** (never an auto-text) on send and on link-tap. Do you want the link-tap to also raise the person to "Hot" / notify you, or stay fully manual?
3. **FSBO scrape budget (§6.6 #4).** 6 cities can exceed the 300s function budget. Preference: fewer cities per run (chunked across the day), shorter per-city Apify timeout, or a longer `maxDuration`?
4. **FSBO status CHECK constraint (§4.4).** Add a DB CHECK on `status ∈ {active, off_market, relisted}`, or keep it a writer-enforced convention (so a future value doesn't require a migration)?
5. **Repeat cold outreach.** If a property expires **again** later (new `listing_key`, same owner), should the one-intro-ever guard treat it as a fresh intro (allowed) or block because the owner was already cold-texted once? Currently the guard is per-`listing_key` (a re-expiry would allow a new intro).

---

## 14. Cross-spec dependencies

- **01-foundation** — `requireAdmin(capability)` + capability map + nav generation (§4.4); the optimistic/idempotent mutation primitive (§4.2); the responsive shell (§4.3). This spec consumes all three.
- **06-messaging (conversation model)** — the `conversation`/`message` entity (§4.1). The intro send migrates from `crm_timeline`-only to a typed `message` on the owner's conversation; the reply lands in the same Inbox thread. Interim path ships first.
- **05-send-center / CMA** — the kept `sendCmaToLead`, `buildCma` (incl. expired-audit variant), `createCmaRequest`, the build worker, and the PERSON-workspace send path. This spec threads `doc_type` through them and routes all *post-intro* sends there.
- **Analytics / metric layer (§4.5)** — the TODAY "Prospecting · N to work" count and engagement metrics resolve through one DAL definition, no hand-rolled query.
