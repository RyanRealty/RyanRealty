# START HERE — next session pickup (2026-06-13)

You are continuing CRM + lead-funnel + LP work on Ryan Realty. Everything below is committed, pushed, and deployed. Read this first, then the two detailed handoffs.

## Read order
1. **This file** (the prioritized pointer).
2. `docs/plans/HANDOFF_CRM_SESSION_2026-06-12.md` — the big CRM/funnel/mobile/live-visit rebuild.
3. `docs/plans/HANDOFF_HEATH_LP_2026-06-13.md` — the Heath LP "home as an asset" rebuild.
4. Memories: `project_crm_ui_queue`, `project_lead_funnel_audit_2026-06-12`, `project_heath_lp_charts`, `feedback_post_fixes_keep_grinding`, `feedback_continuous_work_and_handoff`.

## First thing every session: confirm health
```bash
node scripts/crm-e2e-verify.mjs    # ~30 production checks; last run 32 pass / 0 fail
```
Green = 0 fail; the only expected warns are A2P-in-review, a few timeline near-twins, and Anthropic-credits-out. Anything else = investigate.

## ⚠️ CRITICAL: a parallel session shares this working tree
A second session is actively editing this repo (TC system, broker command center, brand-voice rework, homepage v6, trails DAL) with uncommitted files in the tree. This caused real damage twice this session.
- **`lib/data/index.ts` is shared.** It has uncommitted `trails/getTrail*` exports referencing files that aren't committed — committing the working copy breaks the pre-push typecheck. Fix: stage a clean blob (origin + only your export) via `git hash-object -w` + `git update-index --add --cacheinfo 100644 <blob> lib/data/index.ts`, leaving the working file untouched.
- **Brand-voice files keep getting swept into commits.** ALWAYS run `git diff --cached --name-status` before committing. Pathspec-scope every `git add`. NEVER `git add -u` (no path) or `git add .`.
- `--no-verify` is blocked by a hook guard. Don't try it.
- Push workflow: `git pull --rebase --autostash origin main` then `git push origin main`, immediately after each commit.

## Next actions, in priority order

### 1. CRM lead identity header (TOP — Matt's words: "I have no idea what lead I'm looking at")
Pin to the top of `/admin/crm/[id]` (mobile included): photo + name + colored stage (`StageBadge`) + home-ownership one-liner (from the owned-home match) + assigned broker + a **suggested-next-step pill**. Pill priority: suppressed > on-site-now > unanswered inbound > overdue task > due-today task > awaiting first-touch approval > no outbound in 7d > all caught up. Color-coded red/yellow/green, links to the matching composer anchor (`#send-text` / `#send-email` / `#add-note`). The data is already on the page (`getCrmPersonFull`, owned-home match, twilioStatus). Build this first; verify phone-width.

### 2. Tetherow Heath funnel outlier
`app/lp/tetherow/heath/actions.ts` uses the `seller-intent` tag namespace + a 30-min deferred mirror instead of instant. Make it match the gold-standard seller LP (`app/lp/seller-home-value/actions.ts`): inline `audience:seller` tag + instant `autoEnrollByFubId(fubPersonId)` + `mirrorPersonFromFub(fubPersonId)`. ~20 LOC.

### 3. Heath LP follow-ons (see HANDOFF_HEATH_LP)
- Golf-dues + property-tax panel — needs Matt's verified figures OR compute taxes from Deschutes assessed values. NEVER invent these (§0, license risk).
- Move URL `/lp/tetherow/heath` → `/communities/tetherow/heath` with a 301 (SEO; the `/lp/` prefix is the only weak spot).
- Templatize `getRepeatSalesAppreciation` + `HeathAssetPerformance` across resort LPs (Broken Top, Caldera, Pronghorn).

### 4. CRM polish backlog (`project_crm_ui_queue`)
Inbox → thread-aware (tap inbound → conversation view → reply inline); click-to-call with logged calls; bulk actions on contacts; template editor UI.

## External blockers (state changes unlock work)
- **A2P campaign IN_PROGRESS** (carrier review). When it flips VERIFIED: queued SMS drain, smoke-test 1 number, announce texting live. Watch: https://console.twilio.com/us1/develop/sms/regulatory-compliance/campaigns
- **541.703.3095 port** — awaiting Twilio approval email.
- **Anthropic credits OUT** — blocks marketing producer-runtime (the 4 queued expired CMAs build when credits return).

## Hard rules (non-negotiable)
- §0 data accuracy: every public number traces to a verified source. No fabricated dues/taxes/returns.
- Draft-first: public-surface commits need Matt's approval or the `DRAFT_FIRST_OK=1` marker under his standing directive; surface live URLs for review.
- Suppressions are sacred; never mass-enroll the historical book (`ENROLLMENT_EPOCH`); never auto-send outside active sequences.
- Post fixes as you go (commit+push per fix, one-line status); don't stop mid-initiative to report (`feedback_post_fixes_keep_grinding`).

## What's done & live (do not redo)
CRM: per-broker email signatures + Oregon disclosure link, rendered send previews, merge resolution, broker link attribution, A2P/SMS compliance unblock + resubmit, job-based nav + ⌘K + loading skeletons + self-healing error boundary, broker-funnel home dashboard (+ `/admin/operations`), global Tasks page, manual contact creation, phone-native shell (tab bar + cards), Contacts search-as-you-type + semantic colors, OAuth + FUB profile photos (1,659 backfilled), conversation thread + sticky FAB, the live-visit alert loop (verified end-to-end), owned-home view. Funnel: Meta seller geocoding + expired-LP CMA fixed; attributed-broker card on listings. Expired: pipeline confirmed, 4 contactable leads queued both texts + CMAs (in `/admin/crm/approvals`). LP: Heath "home as an asset" repeat-sales section (live, +6.8%/yr verified).
