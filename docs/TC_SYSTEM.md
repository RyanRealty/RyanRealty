# TC System — Ryan Realty's transaction-coordination system of record

Approved by Matt 2026-06-09 ("yes lets do that and lets start by getting all of our existing Transactions into the system"). Strangler-pattern replacement for SkySlope. People and communications stay in **FUB**. Certified settlements and correspondence recovery stay in **Gmail** (service-account DWD). This system owns folders, documents, checklists, and the compliance audit trail.

## Why we are replacing SkySlope

The 2026-06-09 full audit (51 folders) catalogued the recurring failure modes, every one structural:

- **Archiving is broken.** The UI archive-folder move fights a lock-store bug, the API `folder` field is decoupled from the UI, and the workaround is filename `ARCHIVE` prefixes. Matt's words: "we run into a lot of issues not being able to archive files and things are very clunky."
- Wrong-folder contamination (docs landing in dead folders — live Beaumont example; historical Huntington/703/Old Bend cases).
- Mirror duplicates in `/documents` responses; folder-per-offer-cycle sprawl (Beaumont has 4 folders).
- Filename validator quirks (422s on periods, `#`, bare `X_` stems); fields locked on Closed files (dealType).
- SkySlope cannot read documents. All classification/dedup/signer validation intelligence lives in OUR pipeline anyway (`.claude/skills/skyslope-form-compliance/`).

## Architecture

Supabase (project `dwvlophlbvvygjfxcrhm`) + the existing Next.js admin.

```
tc_deals          one row per PROPERTY (stage, broker, FUB person links)
  └─ tc_cycles    one row per offer/listing cycle (maps 1:1 to a SkySlope folder; carries
                  full source snapshot in `raw` jsonb — nothing lost)
       ├─ tc_documents              binary in Storage bucket `tc-documents`, sha256,
       │                            archived FLAG + reason (never a rename),
       │                            classification jsonb (OREF#, signer status, bundles)
       ├─ tc_checklist_items       Required/Optional/In Review/Completed/NA state machine
       └─ tc_checklist_assignments m2m (bundles satisfy multiple items)
tc_events         append-only audit spine (UPDATE/DELETE revoked) — ORS 696.280 defensibility
```

Migration: `supabase/migrations/20260610010000_tc_system_v1.sql`. RLS enabled, zero policies = service-role only.

### Archive semantics (the fix for the #1 pain)

`tc_documents.archived` boolean + `archived_reason` + `archived_at`. Archiving = one UPDATE + one `tc_events` row. Unarchiving = same. The document name never changes for filing reasons; provenance stays intact. Views default to live docs with a one-click archived toggle.

### Document intelligence is native

The compliance pipeline's output (`plan.json` classify/dedup/signer verdicts) writes into `tc_documents.classification`. On the ingest path (Phase 2 of roadmap), every inbound document gets classified, v5-named, checklist-assigned, and gap-checked on arrival instead of in after-the-fact audit passes.

## Migration of existing transactions (Phase 1 — this delivery)

`scripts/tc-migrate-from-skyslope.mjs`:

1. Property grouping from the master file (`scripts/skyslope-master-file.mjs` output).
2. Per cycle: LIVE re-fetch of detail + documents (saved S3 URLs expire in ~5 min).
3. Every real binary downloaded, sha256-checksummed, uploaded to `tc-documents` Storage at `tc/<source_guid>/<docId8>__<name>`.
4. `ARCHIVE`-prefixed filenames → `archived=true` + parsed reason.
5. Checklist activities + doc assignments preserved (m2m).
6. One `tc_events` migration row per cycle.
7. Idempotent re-runs (upsert on `source_guid` / `(cycle_id, source_doc_id)`); `--verify` prints counts + missing-binary check; failures land in `tmp/skyslope-master/tc-migration-failures.json`.

Smoke-tested on Butler (30 docs, 21.9 MB, 0 failures, checksum round-trip verified) before the full run.

## Forms + native e-signature (Matt directive 2026-06-09: "implement the forms from ODS, OR, and OREF, and create signature fields and assign them to people")

SkySlope's model, extracted from their Partnership API spec (saved at `tmp/skyslope-master/skyslope-partner-openapi.json`, source `forms.skyslope.com/partner/api/docs`) and DigiSign's block/recipient model:

- **Libraries** are authorization-scoped per user (this is where OREF/ODS/OR licensing attaches): `{id, name, regionCodes}`.
- **Form versions** per library: `{id, formId, name, attributes, publishedVersionId, thumbnailUrl}` — forms are versioned; a newer published version supersedes.
- **Envelopes** are created on a file from documentIds; signature "blocks" (signature, initials, date, text, checkbox, strike) are placed per page and assigned to recipients; audit certificate is generated per envelope (`digisign3.skyslope.com/api/envelopes/{id}/auditCertificate`).
- Their partner API auth: OAuth2 + PKCE via `accounts.skyslope.com`, scope `forms.files` (partner credentials require a SkySlope order form — relevant only if we want a bridge integration).

Our equivalent (migration `20260610020000_tc_forms_signing_v1.sql`):

```
tc_form_libraries      OREF | ODS | OR | RR (house forms), license notes,
                       SkySlope source_library_id (1340 / 1528 / 1837), last catalog stamp
tc_form_versions       versioned forms; blank PDF in Storage; field_map jsonb;
                       source_form_id + source_version_id; update_available + pending_*
tc_form_catalog_items  last published catalog per source form (current/updated/new/retired)
tc_form_catalog_checks one row per library per check (counts only)
tc_envelopes           draft → sent → partially_signed → completed | voided;
                       sealed_sha256 + certificate + executed_document_id on completion
tc_envelope_documents  envelope ↔ filled-but-unsigned renders
tc_envelope_recipients role, email, FUB person id, signing order, tokenized-link auth
                       (hash only), consent/viewed/completed/declined + IP/UA
tc_envelope_fields     typed fields with page/x/y/w/h, recipient assignment, value, signed_at
```

Signing flow: compose (pick form versions → render filled PDF from field_map + deal data) → send (unique tokenized links via Resend `mail.ryan-realty.com`) → sign (public signing page: consent record → click-to-sign per field) → seal (flatten PDF, append audit-certificate page, sha256, store as executed `tc_documents` row, auto-assign to checklist, `tc_events` rows throughout). Legal bar: ESIGN + Oregon UETA (ORS ch. 84) — intent, consent, attribution, tamper evidence, signer copy, retention.

**Email-first signing UX (Matt requirement 2026-06-09 — the acceptance bar for Phase 2b):**
documents are EMAILED to recipients and signing must be easy straight from the email.

1. Per-recipient branded email from `mail.ryan-realty.com`: subject "Signature requested: <property> — <form name>", one prominent "Review & sign" button, reply-to the sending broker. Brand-voice rules apply (client-facing copy).
2. The link IS the auth — unique per-recipient token, no account, no login, no app. First open records ESIGN/UETA consent; opens log IP/UA/timestamp to `tc_envelope_recipients`.
3. Mobile-first signing page: tap-to-sign, auto-advance through assigned fields, typed or drawn signature, progress indicator, unmistakable finish state.
4. On completion: sealed PDF + audit certificate auto-emailed to every party and the broker; executed doc auto-filed to the checklist.
5. Pending-signer reminders (48h default) and per-recipient status (sent / viewed / signed) on the deal detail page.

**Licensing boundary:** form templates are copyrighted. Oregon Realtors and Oregon Data Share blanks are free with those memberships. OREF blanks load under Matt's paid OREF subscription. The engine is generic; blanks never redistribute. Template onboarding: AcroForm field maps extracted programmatically where the blanks carry form fields; manual placement UI otherwise.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Read side: master file + `/admin/deals` dashboard | Built 2026-06-09 |
| 1 | Schema + full historical migration (51 folders, all binaries) | This delivery |
| 2a | Write side: doc upload, archive/unarchive UI, checklist transitions, reviewer sign-off — all writing `tc_events` | COMPLETE 2026-06-10. Doc upload shipped: signed-upload-URL flow (no server-action body limit), sha256 dedupe per cycle, pdfjs page count (`serverExternalPackages`), optional checklist assignment, `document_uploaded` event. Archive + transitions + sign-off queue shipped same day |
| 2c | **Smart required-document anticipation** — `docs/TC_OREGON_COMPLIANCE.md` (cited matrix) + `lib/tc/required-documents.ts` (engine) + "Documents anticipated" on the deal page (role×property → needed/present/missing). Property facts auto-populate from the listing feed via `lib/data/listings/getPropertyFactsByMls.ts` (year-built→LBP, sewer→septic, HOA, sub-type→condo/manufactured/land); unknowns surface as confirm prompts. | Shipped 2026-06-10 |
| 2d | **Deal team & contacts** — tc_deal_contacts (co-agents + lender/title/escrow/appraiser/TC/other-agent), backfilled from tc_cycles.raw (72 contacts/28 deals), editable on the deal page; feeds notifications/signing/calendar | Shipped 2026-06-10 |
| 2e | **Commission tracking (rung 11)** — `tc_commissions` (per cycle per agent: side from dealType, GCI = settlement office gross, splits from SkySlope per-deal records [Matt 100 / Rebecca 90], fees, agent/brokerage nets recomputed server-side), backfill of 22 rows reconciling to the cent ($384,393.35 verified GCI), Commission block on the deal page with audited edit dialog, `/admin/commissions` roll-up (office + per-broker YTD/all-time, in-escrow projections kept separate, full ledger). OAR 863-015-0250/-0260 records anchor in TC_OREGON_COMPLIANCE.md | Shipped 2026-06-10 |
| 2f | **Revenue + expense tracking (rung 12)** — `tc_expenses` (deal-scoped + overhead, 14 categories, delete=archive) + `/admin/financials` P&L by year: commission income / agent share / brokerage retained / auto ad-spend line from `marketing_channel_daily` / manual expenses / net. Expense add + archive dialogs, every mutation audited. Cross-linked with /admin/commissions + sidebar nav | Shipped 2026-06-10 |
| 2b | **Envelope + e-signature engine — SHIPPED 2026-06-12.** Works on any PDF on a deal (template fill-from-deal-data layers on later when OREF blanks are pulled). Composer at `/admin/signing/[envelopeId]` (`EnvelopeComposer`): pick documents, place signature/initials/date/text/checkbox fields on the rendered PDF (client pdfjs, same-origin worker at `public/pdf.worker.min.mjs`), assign each field to a recipient + signing order. Send (`sendEnvelope`) mints a per-recipient tokenized link (sha256 hash stored, raw token only in the email) and emails the first signing-order group via Resend (`lib/tc/signing-emails.ts`, brand-voice clean). Public signer at `/sign/[token]` (`SignFlow`): no login, ESIGN/UETA consent gate, tap-to-sign (draw or type), per-field capture, IP/UA recorded. On the last signature, `sealAndComplete` flattens every value onto the PDF with pdf-lib, appends a certificate-of-completion page (signers, timestamps, IP, source hashes, legal basis), sha256-seals it, files it back as an executed `tc_documents` row, and emails the sealed copy to every party + a completion ping to the broker. **Ordered routing enforced**: order N is emailed only after every order < N completes; later-order tokens are minted at advance time so a live link never exists before a signer's turn. Dashboard at `/admin/signing`. Deal page "Envelopes & signing" section composes per cycle. Void + manual reminder supported. Engine files: `app/actions/tc-envelopes.ts`, `app/actions/tc-sign.ts`, `lib/tc/{signing,seal-pdf,signing-emails}.ts`, `components/tc/pdf-sign/*`. **Pending live e2e**: one real compose→send→sign→seal test to a Matt-owned email (draft-first review gate). Template field-mapper (rung 3) + OREF blank onboarding still to come. | Shipped 2026-06-12 |
| 3 | **Email ingest = the Vault mail index (2026-09-23).** No per-deal address: every broker mailbox is read through the Workspace service account, each email is decided by the filing rules (escrow/MLS number → thread → street address → who it touched only on one open file), documents file to the right cycle, offers become `tc_offers` rows whether or not anyone replied (OAR 863-015-0250(1)), and what cannot be decided waits in `/admin/closings/mail` grouped by property. Closed files keep taking post-close mail. A daily sweep searches each file's identifiers across all history and opens a file when queued mail proves a deal is under way. Rules + audit: [`docs/TC_MAIL_FILING_RULES.md`](TC_MAIL_FILING_RULES.md). Replaces the 2026-08-23 filer, which misfiled 3,185 of 3,295 filings in the audited window (`docs/audits/TC_MAIL_AUDIT_2026-09-23.md`). | Built 2026-09-23; production run pending Matt's go-ahead |
| 3b | **Client transaction page (2026-09-23).** `/account/transactions` on the site login: a buyer or seller whose confirmed email is on the file sees stage, milestones, what is waiting on them (sign from the page), key dates, signed and shared documents, and their team. Never call notes, filed email, other offers, commission or principal review (`lib/tc/client-portal.ts`). Brokers see client calls/texts/notes on the deal page (CRM timeline), never shown to clients. | Built 2026-09-23 |
| 3c | **Document reader (2026-09-23).** Every PDF is read from page images: which form and instance, who must sign (the canonical OREF library), who signed, when, and how. One copy per form instance stays; superseded, duplicate and unaccepted-offer copies go to the archive with a reason and a pointer to the copy that replaced them; only fully executed copies sit on the checklist. A removal on the strength of "not fully executed" needs a second model to agree. `lib/tc/doc-read/`, `/api/cron/tc-document-read`, [`TC_DOCUMENT_READER.md`](TC_DOCUMENT_READER.md). | Built 2026-09-23 |
| 4 | Parallel run: next NEW deal filed in both systems end to end (forms + signing included) | After 3 |
| 5 | Dashboard reads tc_* natively; Gmail gap-hunt + FUB person links surfaced per deal | After 3 |
| 6 | Cutover: archive export verified, SkySlope canceled | After a clean parallel deal |

## SkySlope inbound recon mirror (ops)

`skyslope_transactions` / `skyslope_dashboard_meta` are a **read-only recon snapshot**, not the deal SoR. Closings read `tc_deals`. The class that left the mirror stale from 2026-06-10 was "refresh lives only on a Mac script."

**Ops path (inbound only — no SkySlope file mutations):**

1. Production cron `GET /api/cron/skyslope-mirror-refresh` daily 06:20 UTC (`vercel.json`), `Authorization: Bearer $CRON_SECRET`.
2. DAL: `refreshSkySlopeMirrorInbound()` + `getSkySlopeMirrorFreshness()` in `lib/data/tc/skyslope-mirror.ts`.
3. Client: `lib/tc/skyslope-inbound.ts` — HMAC `POST /auth/login`, then GET folder list + detail (and, for the intake below, the document list + binaries). Runtime allowlist refuses PUT/PATCH/DELETE and any POST except login. The folder list answers **HTTP 422 for a page past the end** instead of an empty page, so a folder count on an exact multiple of 10 used to fail the whole refresh: production failed 2026-09-23 and 09-24 with `sales page 5: HTTP 422` at exactly 40 sale folders (`sync_logs` endpoint `skyslope_mirror_refresh`). `folderPageIsPastEnd` now reads a 422 after a full page as the end of the list.
4. Manual: same cron URL against production, or `npx tsx scripts/loop-probe-g8.ts` to read freshness.
5. Heartbeat: `evalSkySlopeMirror` in `/api/cron/loop-health-check` (red if `synced_at` older than 36h).
6. Blocker if keys are missing: set `SKYSLOPE_ACCESS_KEY` / `SKYSLOPE_ACCESS_SECRET` / `SKYSLOPE_CLIENT_ID` / `SKYSLOPE_CLIENT_SECRET` on Vercel production (existing Files API HMAC — not a new OAuth grant) and re-run the cron.

The heavier Mac chain (`scripts/skyslope-dashboard-refresh.mjs`) still exists for a full document-list inventory. It is not the freshness path.

## SkySlope → Vault daily intake (until cutover)

Matt 2026-09-24: "Until you cut over, the Vault pulls new files and cycles from SkySlope every day — add only, never overwrite Vault work." Brokers still open and work files in SkySlope; the one-time import of 2026-06-10 (`scripts/tc-migrate-from-skyslope.mjs`) took in nothing after it ran, so new cycles (a second sale on 3480 SW 45th, the pending sale on 19496 Tumalo Reservoir), new documents and closings (20702 Beaumont) never reached the Vault.

**This is ingest, not reconciliation.** CLAUDE.md §8 holds: the Vault is the sole source of truth and audits never reconcile against SkySlope. The intake does not ask SkySlope what is true about a Vault file; it carries the work brokers did in SkySlope into the Vault, and wherever the Vault has its own answer, the Vault's answer stands.

**Where it runs:** `GET /api/cron/skyslope-vault-intake`, daily 06:50 UTC (`vercel.json`), 30 minutes after the mirror refresh; `Authorization: Bearer $CRON_SECRET`; lease `skyslope-vault-intake`; stops cleanly at a 240s deadline and the next run picks up where it stopped (properties with folders the Vault lacks go first, then open files). One `sync_logs` row per run (endpoint `skyslope_vault_intake`). By hand: `npx tsx scripts/tc-skyslope-intake.ts plan` (dry run: per property, what it would add, update and keep; writes nothing) and `... apply [--only <address text>] [--verbose]`.

**Code:** decisions are pure in `lib/tc/skyslope-intake.ts` (tests: `lib/tc/skyslope-intake.test.ts`); I/O in `lib/data/tc/skyslope-intake.ts`; SkySlope reads through the same read-only client as the mirror (`lib/tc/skyslope-inbound.ts`, now also GET document list + GET binary). Held by `ci:skyslope-mirror` (`scripts/check-skyslope-mirror.mjs`).

**The rules:**

1. **Add what the Vault lacks.** A SkySlope folder whose guid is not a `tc_cycles.source_guid` becomes a cycle on the deal that holds the property: first the deal already holding that property's other SkySlope folders, then the same `property_key` (the migration's grouping), then a deal whose address names the same house number and street with the city agreeing (an in-house file the mail sweep opened, `inhouse-…` key). Two such deals is ambiguous and nothing is added. A `tc_deals` row is created only when no deal holds the property. Documents new to the cycle (identity: cycle + SkySlope document id, as in the migration) are downloaded, stored in the `tc-documents` bucket at `tc/<source_guid>/<docId8>__<name>`, and inserted; `ARCHIVE…` names arrive archived with the parsed reason. New checklist items, assignments and deal contacts are added.
2. **Never overwrite Vault work.** On a SkySlope cycle the Vault already holds, a field (status, dates, prices, escrow and MLS numbers, parties, broker, portal email, checklist type) changes only when the Vault value still equals what the previous import wrote: `tc_cycles.raw` mapped with the migration's mapping. When the Vault value differs (someone edited it in the Vault) the Vault value stays; if SkySlope also changed, that is recorded as drift (`skyslope_drift_kept`). Then `raw` moves forward to today's payload, so the same difference is recorded once. Three columns the migration meant to write but never carried (`portal_email`, `checklist_type`, `listing_date`: the migration wrote null on every cycle) count null as "what the previous import wrote", so the first run fills them where the Vault is still empty. `earnest_money` is not taken from SkySlope: the Vault owns it (`{ amount }` from offers).
3. **Add only, judged against the previous payload.** "New" means new in SkySlope since `raw`, so anything the Vault removed on purpose stays removed: the document reader drops assignments of non-executed copies, brokers delete contacts. Documents are never deleted, renamed, un-archived or re-assigned onto a document the Vault archived. Assignments set in the Vault are never changed.
   **Checklist status follows rule 2.** Matt reviews in SkySlope until the cutover, so an item he approves there must leave the Vault's review queue. A status SkySlope changed moves onto the Vault item only while the Vault status still equals the previous import's (`skyslope_checklist_status_updated`); the write is conditional on that status, so a Vault decision made meanwhile is never overwritten. A status set in the Vault (a sign-off or send-back on Sign-off) is kept, and when SkySlope moved differently the pair is recorded as drift. A SkySlope status word the intake does not know never moves an item.
4. **Deal stage** follows the newest cycle the way the migration derived it (`stageFromCycles`, newest folder first), and only while the Vault stage still equals what the previous import would have derived. A stage set in the Vault (an in-house file, a broker's call) is kept.
5. **Audit.** Every write appends one `tc_events` row, actor `skyslope-intake`: `skyslope_deal_added`, `skyslope_cycle_added`, `skyslope_field_updated`, `skyslope_stage_updated`, `skyslope_document_added`, `skyslope_checklist_items_added`, `skyslope_checklist_status_updated`, `skyslope_checklist_assignments_added`, `skyslope_contacts_added`, `skyslope_raw_refreshed`, and `skyslope_drift_kept` for a Vault edit kept over a SkySlope change.
6. **Idempotent.** A second run changes nothing: the pre-signed document URLs SkySlope mints on every read are ignored when comparing payloads, and jsonb key order does not count. Order per property is crash-safe: deal, cycle rows and field updates, deal stage, then adds, then drift record and `raw` last, so a run cut off midway never makes an unwritten add look already imported.

**The cutover switch:** `TC_SKYSLOPE_INTAKE_ENABLED` (Vercel production env), on by default. Set it to `false` (or `0` / `off` / `no`) the day brokers stop working files in SkySlope: the cron answers "skipped" and `apply` refuses; `plan` still reads. Then retire the route with the rest of SkySlope (roadmap phase 6).

## Deal terms from the contract (2026-09-24)

Matt 2026-09-24: "When they read the actual deal file, any counteroffers, addendums, and all that stuff will be automatically placed into the deal file in the CRM ... not just 'Okay, now you manually fill it in.'" and "It must be bulletproof."

The document reader (`lib/tc/doc-read`) identifies each form, its pages and whether it is executed; it never looks at the pages that carry terms. The terms reader does:

1. **Pick the contract forms** on a read document: sale agreements (accepted or countered), counteroffers in the chain, fully executed addenda and amendments, earnest money receipts, settlement statements (`instrumentKindForTitle`, `termsFormsForDocument`).
2. **Read every page of those forms twice, independently** (`lib/tc/terms/read.ts`): Claude on a PDF of just those pages (the Messages API reads each page's text and image), Grok on our own page renders. `lib/tc/terms/agree.ts` keeps a term only when both read the same value. Either reader missing: nothing is read (the route answers 503). The Claude model (`TC_TERMS_CLAUDE_MODEL`, default `claude-opus-5`) must accept a forced tool call; Claude Opus 5.5 and Fable 5.1 reject one with a 400.
2a. **A third read breaks a tie** (Matt 2026-09-24: "Third read breaks the tie"; `lib/tc/terms/tiebreak.ts`, `readThird`): a term the two read differently, or only one found, is read a third time by Claude on our renders of only the pages in question, one form at a time, without being shown either earlier answer. Two of three decide; a term only one reader found that the third does not find is not on the form. A three-way split, or a third read that failed (retried up to 3 times), stays unsettled and goes to Matt's queue. The form's kind and its buyers are never voted on. Stored as `classification.terms.tiebreak`; documents read before the third read existed get one on the next runs.
3. **Hold each term to sense** (`normalizeTermsReading`): a plausible amount, day count or calendar date, a page that was shown, and for inspection and financing periods a quote that names the provision (the 2-day pre-approval deadline on form 1.1 was read as the financing period on Beaumont).
4. **Resolve the chain** (`lib/tc/terms/resolve.ts`): the offer whose buyers are the cycle's, its sale agreement, each counter up to the one both sides signed, then each fully executed addendum in date order; the earnest money receipt fills a missing deposit; the settlement statement's price wins over the agreement's and says so. An offer nobody accepted writes nothing.
5. **Write it: contract wins, unless a person typed it** (Matt 2026-09-24; `lib/tc/terms/plan.ts`, `applyCycleTerms`): price, earnest money, acceptance and closing dates, inspection and financing periods, escrow company and number, buyers, sellers.
   - An empty field is filled (`deal_terms_filled`, with the document, form, page and quote).
   - A different value a machine wrote (the SkySlope import or intake, an email) is replaced (`deal_terms_replaced`, with the old value). The intake then leaves it alone: it only updates a field that still holds the previous import's value.
   - A different value a person typed is never overwritten. It goes to Matt's queue at `/admin/sign-off/terms` beside the contract's page: **Use the contract** (`deal_terms_accepted`) or **Keep the file** (`deal_terms_kept`; the same contract value is not flagged again, a later change is). A broker with `transactions.edit` can also take the contract's value from the Overview.
   - Who wrote each value lives in `tc_cycles.term_provenance` (`lib/tc/terms/provenance.ts`): `person` (offer accepted, contingency days saved, parties entered when opening a file: `writeCycleTermsByPerson`), `contract`, `import`, `mail`. No stamp means a machine wrote it before provenance existed (migration `20260924190000` backfilled every person-typed and reader-written value).
6. **Matt's contract-terms queue** (`getTermsReviewQueue`, `lib/tc/terms/review.ts`): live files only, soonest closing first; the typed-value conflicts and the terms still split after the third read (another buyer's offer on the same property is left out). Only splits on terms that go on the file reach it (`QUEUE_FIELDS`: price, earnest money, closing date, inspection and financing days, escrow company and number, signature date; Matt 2026-09-24); a split on possession wording, concessions or financing type shows on the file only. No texts (Matt 2026-09-24: "Queue and dashboard only"): it shows on `/admin/sign-off`, the transactions dashboard's Needs you, and the file. Picking a reading (`deal_terms_reading_confirmed`) makes it the agreed reading of that form and writes the file's terms again. Linked from `/admin/sign-off` and from the file's "From the contract" panel.

Stored on `tc_documents.classification.terms` (version `deal-terms-v1-2026-09-24`): both raw readings, the agreed reading, the disagreements, the models and cost. A copy with the same bytes is not read twice. Three failed attempts leave a copy for a person.

**Cron:** `/api/cron/tc-deal-terms` every 20 minutes, live files first. `?doc=<id>&dry=1` reads one document and returns both readings without writing; `?cycle=<id>` resolves and fills one cycle. The same route watches the document reader: readable documents waiting and nothing read for two hours texts Matt once per 12 hours (`lib/data/tc/reader-health.ts`). The reader itself was down 09:35 to about 16:00 UTC on 2026-09-24 (a poster-size page ran it out of memory on every run); renders are now capped and a copy that keeps failing leaves the queue.

## Invariants (carry from CLAUDE.md + the compliance skill)

- Draft-first: UI/code deliverables reviewed before commit; SkySlope mutations still require explicit approval per action while it remains live.
- `tc_events` is append-only. No exceptions. Every mutation writes one.
- Retention: nothing in tc_* is hard-deleted while within the six-year window; "delete" = archive.
- Data accuracy: money fields carry settlement-verified values; discrepancies surface, never silently overwrite.
- FUB is the people system; Gmail is the correspondence/settlement recovery source; this system is the document + checklist + audit record.
