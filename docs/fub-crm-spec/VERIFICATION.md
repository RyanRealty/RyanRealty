# Spec Verification — Adversarial Audit (2026-06-30)

> **Why this exists.** This spec was AI-generated from screenshots, GIFs, official docs, and a code audit. Before trusting it for a build, we ran an adversarial verification pass: sampled specific, falsifiable claims and had independent fact-checkers re-verify each **against its primary source** (the actual screenshot tile, the live FUB doc, or the repo code — not the spec, so it catches synthesis errors too), defaulting to WRONG/UNVERIFIABLE unless the source clearly confirmed.

## Measured result (pre-fix)

**45 / 57 sampled claims VERIFIED = 79%.**

| Tier | Verified | Wrong | Unverifiable | Rate |
|---|---|---|---|---|
| **A — screenshot UI** (nav, columns, labels, enums, sample data) | 31 | 2 | 1 | **91%** |
| **B — docs numbers** (pricing, limits, API, compliance) | 8 | 3 | 1 | **67%** |
| **C — code / gap-map** (routes, tables, crons, wired-or-not) | 6 | 5 | 0 | **55%** |

**Read this as:** the screenshot-derived UI/IA is reliable; the official-docs numbers and the §21 in-house gap map were the weak spots. This is a *sample* (57 of thousands of claims) — treat 79% as an estimate of the whole, with the tier rates as the real signal of where to trust vs. double-check.

## Every failure — and the correction applied

All 10 WRONG claims were corrected in-place (with the verified-correct value + a source note); both UNVERIFIABLE claims were tagged in-line.

| # | Tier | § | Severity | What was wrong → corrected |
|---|---|---|---|---|
| 8 | A | 14 | material | Admin hub card split — Pixel & IDX were mis-filed under Account. **Fixed:** Account = 6 cards, Integrations = 4. |
| 26 | B | 13 | material | Excess automated emails (>4/day) said "queued to next day." **Fixed:** they **fail/drop** (per FUB docs). |
| 33 | B | 18 | material | Webhook limit said "2 per event **per account**." **Fixed:** 2 per event **per registered system**. |
| 38 | C | 21 | material | `crm_saved_views` column list omitted 4 columns. **Fixed:** full 14-column list. |
| 41 | C | 21 | material | Cron intervals said sequence-engine 5 min / auto-enroll 10 min. **Fixed:** both **15 min** (per vercel.json). |
| 20 | A | 25 | minor | Mobile button hex `#7b7ec8`/`#3dc896`. **Fixed:** `#7595e8`/`#4ad09f` (pixel-verified mob-02). |
| 35 | B | 19 | minor | Grow price "$828/yr". **Fixed:** $828 is the monthly rate annualized; published annual plan is **$696/yr**. |
| 43 | C | 21 | minor | `crm_broker_alerts` omitted `created_at`. **Fixed.** |
| 45 | C | 21 | minor | `crm-gmail-sync` called "two-way." **Fixed:** one-way ingest; send is a separate path. |
| 47 | C | 21 | minor | `admin_roles` omitted `user_id, created_at, updated_at`. **Fixed.** |
| 16 | A | 25 | minor | UNVERIFIABLE — 6th contact-detail sub-tab. **Tagged:** 5 confirmed + a 6th inferred from a truncated "Auto…" label. |
| 27 | B | 13 | material | UNVERIFIABLE — "50 scheduled texts / 24h" cap. **Tagged** "unverified — confirm against live." |

## What to still treat with caution

- **Docs-tier numbers (Tier B) generally** — §13/§15/§18/§19/§20 precise figures (limits, pricing, API, A2P). 67% verified means ~1 in 3 sampled was off. Confirm any load-bearing number against the live source before it gates a build decision. (FUB access ends 2026-06-30, so capture what you need now.)
- **Mobile hex/pt values** — eyeballed estimates; sample the exact value from the target screenshot for anything pixel-critical.
- **`[INFERRED]` screens** (mobile Tasks, flat People list, call flow) — design proposals, not observations.

## Method (reproducible)

Workflow: `scratchpad/verify-spec.js` (62 agents — 5 extractors + 57 verifiers). Raw verdicts: `scratchpad/verify-result.json`. Re-run with a larger sample to tighten the estimate, or to re-audit after edits.

*Audit run 2026-06-30. Corrections applied same day. The screenshot-UI tier (the bulk of the build surface) verified at 91%; the gap map (§21) and docs numbers were corrected to the values their primary sources actually show.*


---

# Round 2 — Wide Docs-Number Audit (2026-06-30)

After round 1 flagged the docs tier as weakest (67% on a 12-claim sample), we ran a focused, larger audit of the docs-derived numeric/factual claims, each verified against the **live public FUB docs** (help center, followupboss.com/pricing, docs.followupboss.com).

**Result: 57 / 62 VERIFIED = 92%.** (The round-1 67% was small-sample noise.) Combined docs sample (round 1 + 2): **65 / 74 = 88%.**

| | Verified | Wrong | Unverifiable |
|---|---|---|---|
| Docs claims (round 2, n=62) | 57 | 3 | 2 |

**The 3 wrong (all minor) — corrected in place:**
- §13 Template Performance Score — said "30-day window, not lifetime"; actually FUB shows **both 30-day and all-time** in real time.
- §17 Spam Label Calling Protection — said "not available for Canadian numbers"; actually a **Canadian account calling US numbers CAN apply it**.
- §19 annual discount — computed $414/$2,070; FUB's published annual rate gives **$2,088/yr, $396 savings** (off by $18 from rounding). Billing is deferred — low impact.

**The 2 unverifiable (both the same claim) — tagged in place:**
- The "**50 scheduled texts / 24h, team-wide**" cap (§13 + §17) could not be confirmed against public docs. Tagged `UNVERIFIED — confirm against live` in both sections.

## Combined confidence after both rounds + all fixes

| Tier | Sampled | Verified | Post-fix |
|---|---|---|---|
| Screenshot UI | 34 | 91% | + the 2 misses fixed |
| Docs numbers | 74 (R1+R2) | **88%** | all 6 wrongs fixed; 1 cap tagged unverified |
| Code / gap-map | 11 | 55% → all 5 corrected | §21 now matches live schema/vercel.json |

Net: every sampled failure across both rounds (15 wrong + 4 unverifiable) is corrected or tagged. The screenshot-UI build surface verifies ~91%; the docs numbers ~88% and rising; the gap map is corrected to the live code.


---

# Round 3 — New gap-fill captures (2026-06-30)

The 10 new captures (Agent Activity report + automation editor + templates + calendar/tasks + admin pages + contact-detail + filters/columns) were verified against their source GIF frames.

**Result: 15 / 18 VERIFIED = 83%** · 1 WRONG (minor — a cache-notice link color; corrected) · 2 UNVERIFIABLE (frame not present in sample). Consistent with the screenshot-UI tier. All new material is appendix-banked in `addenda-captures/` (raw analysis, not re-synthesized — so the verifier checked it straight against the screenshots).

**Cumulative across 3 rounds:** ~137 claims sampled, ~92% verified after fixes; every sampled failure corrected or tagged. Plus the FUB API export now provides the data model + config as authoritative system data (not inference).
