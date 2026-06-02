# Handoff — SkySlope closed-deal metadata audit + Broker Notes (2026-05-29)

Read this first, then `reference_skyslope_form_compliance_lessons.md` (in `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/`) for the durable API gotchas. Everything below is verified against live SkySlope + certified settlements as of this date.

## TL;DR — what state things are in

There are **21 closed deals** in Ryan Realty's SkySlope (project `ryan-realty-platform`, API `api-latest.skyslope.com`, HMAC auth from `.env.local`). They split into two work sets:

- **The 12 "non-Jeanette" work set** (#1–12) — metadata fully corrected + verified this session.
- **The 9 "Jeanette" deals** (#13–21, the previously "do not touch" set; Matt lifted the hold 2026-05-29) — **full audit + metadata remediation + Broker Notes all COMPLETE this session.**

**Nothing is mid-flight.** All SkySlope writes done this session are verified clean. No uncommitted code deliverables.

## The 21 closed deals (GUIDs)

**Work set (12):** `f50fe2a6` 712 SW 1st · `2b9046c3` 15352 Bear St · `eb9a24d6` 29500 Ochoco Way · `a0d269e0` 2129 SW 35th · `b3d7cb82` 61271 Kwinnum (Rebecca) · `1f4436e6` 534 Crowson · `f88642ff` 2732 Ordway · `13e20213` 54474 Huntington · `6ef1013a` 1050 Butler · `45549882` 3235 Cedar · `e1892930` 20401 Penhollow · `740abefb` 1974 Newport

**Jeanette set (9, #13–21):** `32c42212` 56111 School House · `8b3033bd` 17130 Mayfield · `f620aee8` 19571 SW Simpson (Rebecca) · `c9fcc145` 2354 Drouillard (Rebecca) · `69b85dea` 20473 Jacklight · `ce3c30de` 2680 Nordic (Rebecca) · `487fb3bf` 703 SW 7th · `18380841` 64350 Old Bend Redmond Hwy · `59152e77` 3480 SW 45th

(Active/pending files are OUT of scope — "do not work on active files.")

## ✅ COMPLETE — the 9 Jeanette deals

Audited every deal against its **certified title-company settlement** (pulled from the SkySlope folder, or Gmail DWD, or the OREF 091/050 for buyer-side comp). All corrected + re-verified:

- **Escrow #s** (7 were empty/0 → real numbers), **close dates** (Mayfield was 6 MONTHS off: 2026-04-04 → 2025-10-29; Drouillard/Jacklight also fixed), **sale prices** (Simpson $750K→$735K, Nordic $1.32M→$1.35M), **commissions** (School House empty→$103,500; Drouillard overstated $26,582→$2,000 flat; Jacklight/Old Bend $0→$13,220/$25,750; etc.), **agent splits** (all null → **Matt 100% / Rebecca 90%**), **trust-vesting** on sellers/buyers.
- Matt personally confirmed the 3 tricky commissions: **Drouillard $2,000, Jacklight $13,220, Old Bend $25,750.**
- Full per-deal detail + sources in **`tmp/_meta-audit/AUDIT-9-RESULTS.md`**.
- **Broker Notes generated + emailed + ingested + attached** to all 8 that lacked them (Nordic already had one). Confirmed 8/8 assigned to the Broker Notes checklist activity with clean names.
- Final metadata verify: `node --env-file=.env.local tmp/_meta-audit/verify-9-final.mjs` → all 9 clean.
- Broker Notes confirm: `node --env-file=.env.local tmp/_meta-audit/confirm-bn.mjs` → 8/8 attached.

## ✅ COMPLETE — the 12 work set (this session)

- Commission + split (Matt 100 / Rebecca 90 on Kwinnum), escrow (Crowson `0`→`7161-4250991`, Huntington `4250991`→`7064-4224031`), Huntington buyer (TBD→**Michele Sciaraffo**), Crowson buyers (added Krister Axel + Lavinia Coleman Evans Axel), close dates (Crowson→04/30, Ochoco→10/31, Cedar/Penhollow escrow-date aligned), split fixes on Bear/Butler/Cedar.
- All commission amounts verified vs certified settlements/091s.

## ⛔ DROPPED / BLOCKED — F1 dealType flip

Goal was to flip dealType Purchase/Both → **Listing** on the 6 listing-side work-set deals (#1,#2,#3,#4,#6,#8). **Cannot be done:**
- API has NO writable dealType/saleType field (`UpdateSaleForm` only exposes property-type).
- Legacy UI (`CreateTransaction.aspx` "TYPE (REPRESENTATION)" dropdown) lets you *select* Listing but the change **never persists** on a Closed deal (custom span widget; form_input fails; JS privacy-blocked; click+postback doesn't save; tab-switch doesn't save). Likely SkySlope silently locks deal-type on Closed files.
- **Matt's ruling: forget F1.** Deal-type label is the least consequential field; not worth reopening closed compliance files. saleTypeId map (FYI): 31=Listing, 32=Purchase, 33=Both.

## 🔲 OPEN / NEXT (Matt's call)

1. **The 12's pending Broker Notes** (task #15: #8–12 = Huntington, Butler, Cedar, Penhollow, Newport). Same machine as the 9 — adapt `tmp/_meta-audit/build-broker-notes.mjs` + `send-9-broker-notes.mjs` + `finalize-9-broker-notes.mjs` with those GUIDs.
2. **Deeper form-compliance on the 8 Jeanette deals** — only Nordic has had the full classify→dedup→archive→rename pass (`skyslope-form-compliance` skill, 10-phase). The other 8 got a Broker Notes from settlement-verified data but NOT a full OCR/dedup/archive pass.
3. **MLS / listingPrice polish** — School House is off-market (blank MLS + listingPrice 0 are CORRECT). Simpson MLS still blank (check if it was listed). `listingPrice = 0` on all 9 (pullable from Spark/MLS feed if wanted).
4. Older pending: #16 flag rulings (Butler/Penhollow), #17 re-verify #1/#2/#3 forms.

## KEY TECHNICAL LEARNINGS (durable — also in the memory file)

- **Executors live in `tmp/_meta-audit/`** (gitignored scratch). Pattern: GET→echo-all-fields→overlay-change→PUT→deep-diff→assert-only-intended-changed. Always `--dry-run` then `--execute`. Before/after snapshots written per folder.
- **officeGrossCommissionOnSale is server-derived and FLAKY:** the SALE PUT recomputes it from `saleCommissionPercent × salePrice`; the `/commissions` PUT uses `listingCommissionPercent` if set. **Robust recipe:** PUT `/commissions` with `saleCommissionPercent = earned/price*100` + **null both listingCommission fields** + null saleCommissionAmount; PUT `/commissionSplit`; then **a no-op SALE PUT** + 3s wait forces officeGross to derive exactly. Flat fees go in as a tiny percent (e.g. Drouillard $2,000 = 0.11662%).
- **Commission split rule (Matt):** brokers (Rebecca `512ee312`, Paul) keep 90% (90/10); Matt (`41c18058`) keeps 100%.
- **Settlement sources:** listing-side comp = seller CD/settlement (in folder or emailed by title co). Buyer-side comp is NOT on the buyer ALTA (seller-paid co-op) → use OREF **091** Notice of Real Estate Compensation or **050** Buyer Rep. Watch odd doc names ("Final Seller's Statement" apostrophe, "Seller Final", "Final BuyerBorrower Statement", "..._IHLA_NNN").
- **Broker Notes pipeline:** generate `broker-notes.txt` → `scripts/_txt-to-pdf.py <in> <out>` (reportlab) → Gmail DWD send (scope `gmail.send`, subject `matt@`) to `sale.portalEmail` → SkySlope ingests in **10–25 min** (closed folders) with spaces→`_` + random `_NNN` suffix → finalize: match (regex must make `.pdf` OPTIONAL — the `name` field drops it), PATCH `FileName`, POST `checklist-items/{bnActivityId}` `{documentGuid}`. **A bare "Broker Notes - ..." rename 422s; prefix with `X_` or the sale#.** Decouple send (fast) from finalize (slow poll). Background the poll via Bash `run_in_background`, NOT an Agent subagent.
- **Sale-list endpoint:** `GET /api/files/sales?earliestDate=<unix>&latestDate=<unix>&pageNumber=N` (10/page). Returns `value.sales[]` with `propertyAddress`/`status`/`saleGuid`. Full inventory in `tmp/_meta-audit/all-sales.json`.
- **Gmail DWD:** service account impersonates `matt@`/`rebeccapeterson@`/`paul@`; env `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` + `..._PRIVATE_KEY` (`.replace(/\\n/g,'\n')`). `matt.lists.homes@gmail.com` is a consumer account (not DWD-reachable) — was NOT needed.

## CONSTRAINTS STILL IN FORCE

- **Draft-First / Commit-Last:** surface every metadata change as a verification trace before writing; treat every escrow #/date/price/commission/party change as needing Matt's eyes (he gave blanket "fix everything" for the 9 after seeing the audit).
- **Vault is the SOLE source of truth** for transaction state — never reconcile against SkySlope; closing settlements/Spark are authoritative for values.
- **No Bash script imports `@anthropic-ai/sdk` / calls `api.anthropic.com`.** Phase 2/3 vision = Agent-tool subagents only.
- **No background Agent subagents for SkySlope pipelines** (shared rate limits). Foreground subagents OK; Bash `run_in_background` OK.
- **FUB bulk ops default to Matt's contacts only.** Read every PDF end-to-end. Velocity is not the goal.
- **Chrome:** `select_browser({deviceId:"deb95298-0353-4203-be38-27ac39834b22"})` (mac mini) directly; never `list_connected_browsers`. SkySlope UI login needs Matt's password (cannot be entered by agent).

## FILES THIS SESSION

- `docs/HANDOFF_SKYSLOPE_AUDIT_2026-05-29.md` (this file)
- `tmp/_meta-audit/AUDIT-9-RESULTS.md` — the 9-deal audit detail
- `tmp/_meta-audit/*.mjs` — all executors/generators/verifiers (gitignored scratch)
- `tmp/_meta-audit/audit9/<deal>/broker-notes.txt` + `.pdf` — the generated Broker Notes
- Memory: `reference_skyslope_form_compliance_lessons.md` — appended commission-entry + officeGross + dealType-lock + Broker-Notes lessons

---

# UPDATE 2026-06-01 — ALL FOUR OPEN ITEMS COMPLETE

Everything in the "OPEN / NEXT" list above is now done.

## ✅ Item 1 — the 12's Broker Notes (#8–12)
Generated + sent + attached for Butler, Cedar, Penhollow, Newport (Huntington #8 already had one → all 5 work-set deals now have Broker Notes). Every commission verified to its certified settlement / OREF 091: Butler $1,500 (First American ALTA), Cedar $13,250 (Western Title buyer stmt; 091's $535K was pre a $5K reduction → reconciled to $530K), Penhollow $14,377.50 (091), Newport $23,820 (Final Sellers Stmt). Machine: `build-12-broker-notes.mjs` → `send-12-broker-notes.mjs` → `finalize-12-broker-notes.mjs` (rename-validator wanted a descriptive `<Addr>-Closing_X_` prefix; bare `X_` 422'd).

## ✅ Item 3 — MLS / listingPrice on the 9
listingPrice filled on the 4 listing-side deals from Spark OriginalListPrice (Mayfield $839K, Drouillard $1.89M, Jacklight $829K, Old Bend $1.099M); buyer-side stayed $0 (12-set convention). Simpson MLS recorded (`220202576`). School House stayed $0 (off-market). Jacklight Spark CloseDate 9/29 vs settlement 10/17 → settlement wins (already correct), no change. Executor: `exec-3-listprices.mjs` (deep-diff verified only intended field changed).

## ✅ Item 4 — flags
#16 closed (Butler buyer kept as Sullivan Family Trust per Matt; Penhollow date/listingPrice already resolved). #17 re-verified 712/Bear/Ochoco — intact (no fabricated docIds, Bear `_X` preserved, Ochoco clean, 712 wood-stove archival was a correct later refinement). Found + fixed one real gap: 712 "Electronic Funds Advisory" activity was empty → cross-linked the executed EFA bundle `3a29b3c2` to it.

## ✅ Item 2 — full form-compliance pass on all 8 Jeanette deals

| Deal | guid8 | archived | reassign / xlink | fabricated docIds |
|---|---|---|---|---|
| 3480 SW 45th | 59152e77 | 10 | 3 reassign | 0 |
| Mayfield | 8b3033bd | 16 | 1 reassign, 1 xlink | 0 |
| Simpson | f620aee8 | 15 | 2 reassign, 3 xlink | 0 |
| Jacklight | 69b85dea | 16 | 2 reassign, 2 xlink | 0 |
| 703 SW 7th | 487fb3bf | 35 | 2 reassign, 1 xlink | 0 |
| School House | 32c42212 | 23 | 4 reassign | 0 |
| Drouillard | c9fcc145 | 33 | 4 xlink | 0 |
| Old Bend | 18380841 | 52 | 1 xlink | 0 |

Pipeline (per deal): `fetch-folder-pdfs.mjs --guid` → `dump-classify-context.mjs <guid>` → ONE foreground Sonnet `Agent` subagent (own context) writes `plan.json` → **`build-phase5.mjs <guid> <label>`** (schema-tolerant; consumes `documents[]`+`dedup_groups`+`misassignments`+`mislabeled_filenames`+`cross_links`) → `execute-plan.mjs --execute` (`--resume` on 422) → `verify-fc.mjs <guid>`.

**Cross-cutting findings:**
- **"Advisory Regarding Septic Wells" filename = OREF 091** Notice of Real Estate Compensation in 7 of 8 deals (~15 instances). Recurring SkySlope template-naming bug. All corrected.
- **Wrong-folder contamination:** 703 SW 7th held 10 docs from the **122 SW 10th St** canceled deal (`c1ac8195`, Hakkila/Chester, MR08012025) — checked: 122 SW 10th's own folder HAS its RSAs+counters, so nothing critical missing; the 703 copies were archived as wrong-cycle. Old Bend held a **3480 SW 45th SPD** (Christel Panther) — archived wrong-cycle.
- **SkySlope mirror duplicates:** Old Bend's `/documents` returned 160 entries = 99 unique docIds (61 mirror entries). Builder dedups by docId.

**OPEN DECISIONS for Matt (kept-both, did not auto-pick):**
1. School House RSA — bundle `58f5ca81` (16pp = RSA + PP1) vs standalone `64d96848`. Both kept in the RSA activity; pick canonical.
2. Dead-cycle RSAs/counters retained on Drouillard (3 cycles) + Old Bend (3 cycles). Archivable if you want them thinned.

**Builder/executor hardening this session** (durable, in the skill): `execute-plan.mjs sanitize()` now strips `# , ; % { } / \` (see `references/sanitize-fixes.md`); `build-phase5.mjs` tolerates 3 subagent schema variants, pulls real extensions from `manifest.json`, length-bounds names, infers bundle cross-links, protects dedup canonicals, and backfills any activity that archiving would empty.
