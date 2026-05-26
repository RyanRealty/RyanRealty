# Procedure runbook — end-to-end audit pipeline

When to read: running a fresh audit pass on one or more folders;
extending the pipeline; diagnosing where a script failed; building a
new per-folder gap-hunt script.

## Phase-by-phase

The implementation lives in
[scripts/](../scripts/) (inside the skill) and at repo root
`scripts/*.mjs`. The pipeline chains these phases:

1. **Enumerate** — pull every doc from every non-closed sale folder
   AND every active listing folder via the SkySlope Files API. Skip
   pseudo-rows (`fileSize: -1`, `pages: null`, archive markers).

2. **Fetch + OCR** — for each doc, GET the binary via
   `fetchSkyslopeDocumentBinary`, run pdfjs + tesseract through 50
   pages, cache the merged text + page count + image-only flag.

3. **Identify** — match the OCR text against the canonical form
   library ([oref-form-library.md](oref-form-library.md)). The matcher
   returns one of:
   - `{ formId: 'oref-001-rsa', confidence: 'high' }` — exact header match
   - `{ formId: 'oref-001-rsa', confidence: 'medium' }` — title text match
   - `{ formId: null, candidates: [...], reason: 'ambiguous' }` — flag for human review
   - `{ formId: null, reason: 'no-match' }` — flag for library expansion

4. **Extract sale#** — regex
   `/Sale Agreement\s*(?:Number|#)\s*[:.]?\s*([A-Z0-9\-\.\/]+)/i`
   on page 1 text. Validate: ≥3 chars, ≤40 chars, must contain at
   least one digit OR letter (not punctuation-only). Reject common
   false positives ("Buyer", "Residential" — blank field
   placeholders).

5. **Validate execution** — call `validateExecution(formId, ocrText)`.
   Returns `{ executed: bool, matched: [...], missing: [...], reason }`.
   See [signer-validation.md](signer-validation.md) for the per-form
   algorithm.

6. **Emit v5 name** — format defined in the SKILL.md body. Strip
   leading underscore if `saleNumber` is empty.

7. **PATCH back** — `PATCH /api/files/{kind}s/{guid}/documents/{docId}`
   with JSON body `{ FileName: newName }`. Never use query-param form
   (HTTP 500 — see [skyslope-api-quirks.md](skyslope-api-quirks.md)).
   Preserve extension byte-for-byte. Skip pseudo-rows. Cross-endpoint
   retry for shared docs handled by
   `skyslope-forms-recover-crossendpoint.mjs`.

8. **Assign to checklist** — for each renamed doc, POST to
   `/api/files/{kind}s/{guid}/checklist-items/{activityId}` with the
   doc's GUID. Use the form-to-activity mapping in
   `scripts/_nordic-checklist-assign.mjs` `FORM_TO_ACTIVITY` (the
   "checklist-mapping" reference that was promised but never written
   lives effectively in that script's const).

9. **UNASSIGN + ARCHIVE** (Phase 8a + 8b) — see
   [archive-and-trash-workflows.md](archive-and-trash-workflows.md).

10. **BROKER NOTES** — see
    [broker-notes-generation.md](broker-notes-generation.md). One PDF
    per unique sale agreement number per folder.

## OREF 042 + brokerage-internal BBSA pattern

**Form 9.4 Buyer Representation Agreement is brokerage-internal, NOT
OREF.** When a buyer signs the 9.4 BBSA via direct email attachment
(rather than via a SkySlope DocuSign envelope), the OREF 042 Initial
Agency Disclosure Pamphlet acknowledgment is NOT bundled in. This
creates a real compliance gap because Oregon law requires the pamphlet
acknowledgment at first substantive contact.

**The SkySlope envelope pattern** that bundles OREF 042 + OREF 050
(and sometimes OREF 047 Real Estate Compensation Advisory) is the
"Buyer Agency Agreement" envelope subject. Look for emails from
`noreply@skyslope.com` with subject `"Envelope completed: Next steps:
Please review & sign your buyer agreement"` — these typically include
all three forms together.

When the audit finds a 9.4 BBSA but no OREF 042 envelope completion:
- Search gmail for any standalone OREF 042 for these buyers (may be
  older, from initial broker-client establishment)
- If none found, recommend resending a fresh OREF 042 via SkySlope
  envelope to the buyers for retroactive acknowledgment
- Note this gap in `flags.json` with `askOf: "Matt"` and a draft
  message in the `outsideAsk` block

## Gap-detection + chase-down routine

After v5 rename + checklist reassignment + archive folder move are
complete on a folder, walk the post-state checklist and produce a
`flags.json` of Required-but-empty activities. For each gap:

1. **Build a query stack** specific to the missing doc type. Lives in
   `scripts/_<folder>-gap-hunt.mjs` (one per folder during the audit).
   Each query layer narrows by:
   - Doc-type keywords (form number, form name, common abbreviation)
   - Property hook (address, escrow#, sale#, party names)
   - Date window (extend wide — disclosure docs can predate or postdate
     the offer-cycle window)
2. **Run across all broker inboxes** — the roster as of 2026-05-26 is
   **4 accounts**, not 3:
   - `matt@ryan-realty.com` — Workspace, via service-account DWD
   - `rebeccapeterson@ryan-realty.com` (NOT `rebecca@`) — Workspace, DWD
   - `paul@ryan-realty.com` — Workspace, DWD
   - **`matt.lists.homes@gmail.com`** — personal Gmail (NOT Workspace).
     Service-account DWD does NOT work here. Use the Playwright session
     captured by `scripts/_gmail-login-capture.mjs` which saves
     `tmp/gmail-session-matt-lists-homes.json` after Matt logs in once.
     The gap-hunt search adapter consumes that storage state and queries
     Gmail via the browser-side UI (or the Gmail OAuth flow once it's
     wired). Re-capture every ~14 days when Google re-prompts.
   This personal account is the one most likely to hold listing-side
   correspondence, MLSCO contracts, DataShare exports, seller-onboarding
   emails — anything Matt sent or received from his personal listing
   workflow rather than the brokerage Workspace.
3. **Filter false positives** by property + escrow# + party names so
   docs from sibling transactions don't get attached to the audit
   folder.
4. **Categorize hits:**
   - Direct match → forward to SkySlope mailbox
   - Plausible candidate → render page 1, visually verify
   - No match → log as genuine gap in `flags.json`
5. **For genuine gaps**, the chase routine outputs a list of asks
   for: listing agent, title company, buyer-side broker, lender,
   internal (Broker Notes). The list gets surfaced in `flags.json`
   and the `transaction-summary.txt` for Matt to action.

## Common doc-type-to-source mapping

From the Ordway pass:

| Required activity | Usual source | Common reason missing |
|---|---|---|
| Initial Agency Disclosure (OREF 042) | Each broker's general client file | Signed at first contact, not transaction-specific |
| Buyers/Sellers Rep Agreement (040/041/050) | Each broker's general client file | Same |
| FIRPTA Advisory | Title company | Often skipped when seller is clearly US-domestic |
| Electronic Funds Advisory | Title company | Embedded in wire-fraud flyer, not separate doc |
| Real Estate Forms Advisory | Brokerage internal | Often not produced as standalone |
| Smoke Alarm Advisory / Compliance | Listing agent or builder | Compliance date in timeline, no signed advisory |
| Broker Commission Demand from Title | Title company internal | Generated internally; request from escrow officer |
| Transaction Timeline | Each brokerage TC system | Sits in agent emails, not in SkySlope |
| Broker Notes | Internal only — generated by this skill | No external source |

## Draft outside-ask email templates

When the gap-hunt confirms a doc genuinely doesn't exist in any of
our broker inboxes, draft a one-shot outside-ask email for Matt to
send (or copy-paste into his client) per the standard recipients:

- **Listing agent** — Smoke Alarm Certification (OREF 028), SPD
  signatures, OAA seller initials, any seller-side signed advisories
- **Title company / escrow officer** — FIRPTA cert, Electronic Funds
  Advisory, Commission Disbursement Authorization (CDA), Recorded
  Deed (if not already received)
- **Lender** — Pre-Approval (if missing), Final Loan Statement
- **Internal** — Broker Notes (per
  [broker-notes-generation.md](broker-notes-generation.md))

Drafted emails live in `flags.json.outsideAsk` so Matt can scan all
chase-down asks in one place. Each email block carries `to`,
`subject`, and a body that includes the property + escrow # + closing
date + exact list of requested docs.
