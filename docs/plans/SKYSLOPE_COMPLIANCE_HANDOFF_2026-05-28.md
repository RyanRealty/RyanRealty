# SkySlope Compliance — Cross-Session Handoff (2026-05-28)

**Purpose:** Continuous SkySlope compliance work across 21 closed sales. Previous session built v2 skill + processed 8 folders + discovered 13 more remain. This file is the new agent's complete pickup.

---

## Where we are at — 8 of 21 closed sales done

**Already processed (do NOT re-touch unless Matt asks):**

| # | guid | Address | What was done |
|---|---|---|---|
| 1 | `f50fe2a6` | 712 SW 1st St, Madras | v1+v2 rerun; BN regen $305K → $275K corrected |
| 2 | `2b9046c3` | 15352 Bear St, La Pine | v1+v2 rerun; 2 orphan `_X` fixed; BN regen |
| 3 | `eb9a24d6` | 29500 SE Ochoco Way, Prineville | v1+v2 rerun; 23 actions; 4 wrong-cycle reversals; BN regen |
| 4 | `a0d269e0` | 2129 SW 35th St, Redmond | v2 fresh; 72 mutations + 4 image fixes; BN new |
| 5 | `b3d7cb82` | 61271 Kwinnum Drive, Bend | v2 fresh; 85 mutations; BN $525K → $750K corrected |
| 6 | `1f4436e6` | 534 Crowson Rd, Ashland | Oregon REALTORS forms (not OREF); 9 mutations; BN new |
| 7 | `f88642ff` | 2732 NW Ordway Avenue, Bend | Already cleaned by prior pass; 4 Final HUD assigns |
| 8 | `13e20213` | 54474 Huntington Road, Bend | In-session pattern-based; 64 mutations; BN new |

## JEANETTE ARGYLE CARVE-OUT — CUTOFF AT #13 (Matt ruling, 2026-05-28)

**Matt's directive (verbatim):** *"ok 13is the cutoff lets make note of this and then go through all of the files that Jeanette hasnt touched and that are remaining."*

Jeanette Argyle (Bridgetown Files TC, `transactions@bridgetownfiles.com`) became the transaction coordinator at a point in time, and **every deal from #13 onward was hers.** Matt set the cutoff at **#13 (3480 SW 45th Street)**. As principal broker, his ruling governs — it overrides the email-evidence ambiguity (the cross-inbox DWD search found no Bridgetown-participant emails for #13 itself; the Jeanette+Millard thread that exists is #14, 64350 Old Bend Redmond Hwy). Cross-inbox reconciliation detail: `tmp/jeanette-carveout-2026-05-28/RECONCILIATION.md`.

### EXCLUDE — Jeanette's deals. DO NOT TOUCH (#13–#21)

| # | guid | Close | Address |
|---|---|---|---|
| 13 | `59152e77` | 2025-08-14 | 3480 SW 45th Street, Redmond ← **CUTOFF** |
| 14 | `18380841` | 2025-09-25 | 64350 Old Bend Redmond Hwy, Bend |
| 15 | `487fb3bf` | 2025-09-29 | 703 SW 7th Street, Redmond |
| 16 | `ce3c30de` | 2025-10-10 | 2680 NW Nordic Avenue, Bend |
| 17 | `69b85dea` | 2025-10-21 | 20473 Jacklight Lane, Bend |
| 18 | `c9fcc145` | 2025-10-27 | 2354 NW Drouillard Ave, Bend |
| 19 | `f620aee8` | 2026-03-16 | 19571 SW Simpson Ave, Bend |
| 20 | `8b3033bd` | 2026-04-04 | 17130 Mayfield Drive, Bend |
| 21 | `32c42212` | 2026-05-15 | 56111 School House Rd, Bend |

### WORK — non-Jeanette set is #1–#12. Remaining to process: #8 (re-do), #9, #10, #11, #12

| # | guid | Close | Address | State |
|---|---|---|---|---|
| 9 | `6ef1013a` | 2025-06-06 | 1050 NE Butler Market Rd #2, Bend | not yet processed |
| 10 | `45549882` | 2025-07-17 | 3235 NW Cedar Ave, Redmond | not yet processed |
| 11 | `e1892930` | 2025-07-25 | 20401 Penhollow Ln, Bend | not yet processed |
| 12 | `740abefb` | 2025-08-14 | 1974 NW Newport Hills, Bend | not yet processed |

#8 Huntington (`13e20213`) had a bad first pass and is being re-done (see `tmp/huntington-rd-2026-05-28/` + its CORRECTIVE_PLAN). #1–#7 are done.

> **Supersedes the prior "13 remaining / START HERE #9" framing.** That count predated the carve-out and treated all of #9–#21 as work. #13–#21 are now EXCLUDED. The work queue is **#8, #9, #10, #11, #12 only.**

Full inventory snapshot saved at `tmp/skyslope-full-inventory.json`.

**SkySlope API caveat:** the `/api/files/sales?pageSize=N` endpoint silently caps at 10 results per page. Use `pageNumber=1,2,3...` to paginate. Earlier session missed this and thought there were only 10 closed sales total.

---

## RULES THE PRIOR SESSION LEARNED (read before processing the next folder)

### 1. NEVER use scripts that import `@anthropic-ai/sdk` or use `ANTHROPIC_API_KEY` directly

Those bill Matt's Anthropic API console SEPARATELY from his Claude Code plan. Already deleted from the skill: `claude-reader.mjs`, `test-claude-reader.mjs`, `process-folder.mjs`, `process-document.mjs`, `process-all-documents.mjs`, `v4-namer.mjs`. Memory: `feedback_no_background_subagents.md`.

### 2. Agent tool subagents (background or foreground) are FINE

They run under the Claude Code plan. BUT: Matt has explicitly directed in this session that he wants in-session execution only because subagents kept getting killed by the Anthropic backend (3+ killed subagents on heavy folders). For the remaining 13 folders, **drive the work from the main session using Bash scripts.** Pattern-match classification via pdfjs text + filename. Skip vision OCR.

### 3. One folder at a time, end-to-end. No deviation mid-folder. No editorializing between folders.

After each folder completes Phase 9 ingest+attach, just say "X done. Next: Y." Don't surface flags mid-pipeline. Don't ask questions between folders. Don't list "things to watch." Document everything in the BN (audit-defensible record), then move on.

### 4. UPDATE SkySlope folder metadata when finding drift

When `sale.salePrice` doesn't match the closing doc, or `sale.buyers` is "TBD" / "Raiter Raiter" etc., PATCH the SkySlope folder fields, not just the BN. SkySlope is the working record for the TC/broker UI. **Retroactive metadata fixes owed:**
- 712: salePrice $305K → $275K + $500 seller credit; sellers "TBD TBD" → Travis L White + Misty M White
- Kwinnum: salePrice $525K → $750K; sellers "Raiter Raiter" → Fredrick A. Raiter + Robin H. Raiter
- Huntington: buyers "TBD Buyer" → actual from Offer 6 final RSA
- Crowson: buyers/sellers "TBD" → actual from RSA

### 5. Closed deals only

Skip Pending, Canceled/App, Canceled/Pend. The Listings-side endpoint has 14 records — 8 in "Transaction" stage. Matt has not yet decided whether to process those — DO NOT TOUCH listings without his explicit go.

### 6. Don't suggest multiple options or ask permission menus

Per `feedback_decide_dont_ask.md`. When in doubt about a folder-internal decision, just do the obvious mechanical thing and document it in the BN.

---

## Skill state — `.claude/skills/skyslope-form-compliance/`

- **SKILL.md** 186 lines (under 500 ceiling)
- **references/** — 13 markdown files including `failure-modes.md` §6 (the no-direct-API rule), `canonical-selection.md`, `bundle-detection.md`, `oref-form-library.md`, `signer-validation.md`
- **subagent-prompts/** — `classifier.md` + `signer-verifier.md` (templates for Agent subagent invocation; NOT for direct API calls)
- **scripts/** — 7 clean utilities (no Anthropic API):
  - `execute-plan.mjs` — generic Phase 7-8 executor consuming `phase5-plan.json`
  - `fetch-folder-pdfs.mjs`, `form-library.mjs`, `sale-number-extractor.mjs`, `validator.mjs`, `cross-ref.mjs`, `v5-namer.mjs`
- **evals/** — 3 test prompts (712, Bear St, Ochoco) with gold answers. Eval ran 100% on with_skill vs 38% on old_skill snapshot.
- **`.claude/skills/skyslope-form-compliance-v1-snapshot/`** — rollback safety copy of pre-rebuild skill.

---

## Per-folder execution pattern (reusable for #9-21)

For each remaining folder, follow this Bash-driven pattern. Total wall-clock ~10-25 minutes per folder.

### Step 1 — Phase 0 fetch

```bash
SALE='<full-guid>'
WORK="tmp/<short>-2026-05-28"
mkdir -p $WORK/{phase0,phase2,phase5,phase6,binaries,renders}

# Fetch sale-detail + documents (see scripts/_huntington-fetch-render.mjs as template)
node --env-file=.env.local -e "..."
```

### Step 2 — Fetch binaries

Copy and adapt `/tmp/huntington-fetch-render.mjs` (in tmp/, not in skill). Iterates documents, fetches each from `doc.url`, writes to `binaries/<short8>.pdf`.

### Step 3 — Pattern-classify

Copy and adapt `scripts/_huntington-classify.mjs` for the new folder. Outputs `phase2/classify.json` with OREF# detection per doc + bundle detection.

### Step 4 — Build plan

Copy and adapt `scripts/_huntington-build-plan.mjs`. Detects cycle prefixes in filenames (look for `Offer N`, `RRP*`, `JJ*`, `MR*`, or similar patterns specific to this folder's broker). Archives failed-cycle docs. Fixes obvious misclassifications. Outputs `phase5-plan.json` at workspace root.

### Step 5 — Execute

```bash
# Dry run first
node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/<short>-2026-05-28

# Live
node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/<short>-2026-05-28 --execute
```

### Step 6 — Generate BN

Write a `transaction-summary.txt` following the Bear St / Ochoco / Kwinnum format (HEADER / PARTIES / MONEY / TIMELINE / DISPOSITION / CROSS-CYCLE / FORM INVENTORY / FLAGS / AUDIT TRAIL). Then:

```bash
python3 scripts/_txt-to-pdf.py "tmp/<short>-2026-05-28/phase6/transaction-summary.txt" "tmp/<short>-2026-05-28/phase6/<SALE>_X_Broker Notes - Transaction Summary.pdf"
```

### Step 7 — Gmail send + ingest + attach

Clone `scripts/_kwinnum-send-broker-notes.mjs` for the new folder. Updates the GUID, PDF path, base name, canonical name, subject. Runs Gmail-send via service account DWD → polls SkySlope ingest → PATCH rename to canonical → ASSIGN to Broker Notes activity. Up to 25 min polling per send.

### Step 8 — Metadata sync (NEW — owed retroactively + going forward)

If you find drift in `sale.salePrice` or `sale.buyers` or `sale.sellers`, PATCH the SkySlope folder:

```bash
node --env-file=.env.local -e "
// PUT to /api/files/sales/<guid> with corrected fields
"
```

Then say "X done. Next: Y." Move on.

---

## Auth — `.env.local`

Already populated. Variables used:
- `SKYSLOPE_CLIENT_ID`, `SKYSLOPE_CLIENT_SECRET`, `SKYSLOPE_ACCESS_KEY`, `SKYSLOPE_ACCESS_SECRET` — HMAC login
- `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — Gmail send via DWD impersonation of `matt@ryan-realty.com`

---

## Key memory files the new agent should know about

- `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_no_background_subagents.md` — the cost rule
- `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_verify_every_document.md` — read every page (when vision is available)
- `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/reference_skyslope_form_compliance_lessons.md` — operational lessons
- `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_decide_dont_ask.md` — execute, don't ask menus

---

## Resume here (post-carve-out)

Work queue is **#8, #9, #10, #11, #12 only** — #13–#21 are EXCLUDED (Jeanette's, per the cutoff above; do not touch).

Order: finish **#8 Huntington re-do** (already underway), then #9 Butler Market → #10 Cedar Ave → #11 Penhollow → #12 Newport Hills. Process end-to-end, one at a time, dry-run by default. Surface "Butler Market done. Next: Cedar Ave."

After #8–#12 are done, surface a final audit table covering the non-Jeanette set (#1–#12) so Matt has the complete compliance record for the files he owns.

---

*Generated 2026-05-28 by previous Claude Code session at context cap.*
