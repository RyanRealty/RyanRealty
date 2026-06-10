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
tc_form_libraries      OREF | ODS | OR | RR (house forms), license notes
tc_form_versions       versioned forms; blank PDF in Storage; field_map jsonb
                       (fill bindings to deal data + signature fields with signer roles);
                       signer_profile from the compliance form library;
                       checklist_activity_hint for auto-assignment on execution
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

**Licensing boundary:** form templates are copyrighted (OREF especially). The engine is generic; blank PDFs load under Matt's OREF/ODS member access only and are never redistributed. Template onboarding: AcroForm field maps extracted programmatically where the blanks carry form fields; manual placement UI otherwise.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Read side: master file + `/admin/deals` dashboard | Built 2026-06-09 |
| 1 | Schema + full historical migration (51 folders, all binaries) | This delivery |
| 2a | Write side: doc upload, archive/unarchive UI, checklist transitions, reviewer sign-off — all writing `tc_events` | Archive done; transitions next |
| 2c | **Smart required-document anticipation** — `docs/TC_OREGON_COMPLIANCE.md` (cited matrix) + `lib/tc/required-documents.ts` (engine) + "Documents anticipated" on the deal page (role×property → needed/present/missing). Property facts auto-populate from the listing feed via `lib/data/listings/getPropertyFactsByMls.ts` (year-built→LBP, sewer→septic, HOA, sub-type→condo/manufactured/land); unknowns surface as confirm prompts. | Shipped 2026-06-10 |
| 2b | Forms + signing: template onboarding (OREF/ODS/OR blanks + field maps), envelope composer (place fields, assign signers), signing pages, sealing | With 2a |
| 3 | Email ingest: per-deal inbound address → Storage → auto-classify → auto-assign (fixes dead-folder contamination by design) | After 2 |
| 4 | Parallel run: next NEW deal filed in both systems end to end (forms + signing included) | After 3 |
| 5 | Dashboard reads tc_* natively; Gmail gap-hunt + FUB person links surfaced per deal | After 3 |
| 6 | Cutover: archive export verified, SkySlope canceled | After a clean parallel deal |

## Invariants (carry from CLAUDE.md + the compliance skill)

- Draft-first: UI/code deliverables reviewed before commit; SkySlope mutations still require explicit approval per action while it remains live.
- `tc_events` is append-only. No exceptions. Every mutation writes one.
- Retention: nothing in tc_* is hard-deleted while within the six-year window; "delete" = archive.
- Data accuracy: money fields carry settlement-verified values; discrepancies surface, never silently overwrite.
- FUB is the people system; Gmail is the correspondence/settlement recovery source; this system is the document + checklist + audit record.
