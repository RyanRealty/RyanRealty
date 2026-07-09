# FUB Lead Workflow — Live Audit & Per-Lead Flow Documentation

> **⚠️ SUPERSEDED (2026-07-08).** This audit describes the FUB Automations 2.0-era architecture, which was replaced by the in-house CRM engine (`lib/crm/enroll.ts` + `lib/crm/sequence-engine`) starting 2026-06-10; FUB API sending was decommissioned entirely 2026-06-24. For current lead-flow behavior, trace `lib/crm/enroll.ts`, `app/api/cron/crm-auto-enroll/route.ts`, and `app/api/cron/crm-sequence-engine/route.ts` directly, or run `node scripts/crm-e2e-verify.mjs` for a live health check.

**Date:** 2026-05-29
**Author:** Claude Code (live FUB API + browser inspection + source-code trace)
**Scope:** Every inbound lead path → what the code does → what FUB does → where the lead actually ends up.
**Method:** Verified against the live FUB v1 API (`/v1/actionPlans`, `/v1/actionPlansPeople`, `/v1/people`, `/v1/templates`) and the live Automations 2.0 UI on 2026-05-29, cross-referenced with the source in `app/lp/`, `app/api/`, and `lib/followupboss.ts`. Every number below is a fresh API pull, not a recalled figure.

---

## 0. The headline (read this first)

**The lead-capture code works. The drip workflows are fully built. They are not connected to each other.**

- The code tags and assigns every lead correctly (`audience:seller`, `audience:buyer`, tier, source, broker).
- The Action Plans that are supposed to nurture those leads (Seller Master, Buyer Master, Expired Recovery, FSBO Recovery) **exist, are Active, and are fully built** with real emails, real SMS, real cadence, and opt-out language.
- **But every one of those plans has 0 people enrolled and has never run** (`isUsed: false`, `contactsRunningCount: 0`).
- **3,492 people carry `audience:seller` and 37 carry `audience:buyer`. Zero of them are enrolled in any drip.**

The break is the bridge between "tag applied" and "enrolled in plan." Detail in §5.

---

## 1. There are TWO automation systems in this FUB account — don't confuse them

This is the single most important thing to understand, and it's what made the earlier read confusing.

### System A — Legacy Action Plans (`/v1/actionPlans`)
This is where the **real Ryan Realty workflows live.** Our code targets these by numeric ID. All Active as of 2026-05-29:

| ID | Name | Steps | Enrolled | Ever used |
|----|------|-------|----------|-----------|
| 69 | Seller Lead — Master Workflow | 9 | **0** | no |
| 70 | Buyer Lead — Master Workflow | 11 | **0** | no |
| 71 | Expired Recovery (auto) | 10 | **0** | no |
| 72 | FSBO Recovery (auto) | 10 | **0** | no |
| 73 | Out-of-State Owner Nurture | 4 | **0** | no |
| 74 | Neighborhood Resident Nurture | 12 | **0** | no |
| 75 | Sphere Nurture | 6 | **0** | no |

(Plans 1–68 are FUB defaults and old `*KTS AP*` templates — all `Deleted`.)

### System B — Automations 2.0 (the `/2/automations/v2` UI)
This is the newer FUB trigger→action UI. It holds:

- **FUB default templates, migrated:** Seller Lead Drip (83), Buyer New Lead Website Registration (84), Facebook Lead Ads (85), Seller - Home Evaluation Request (86), Web Inquiry Option 01 (87). **All use a "Manual" trigger** (a human must add the person) and are mostly unconfigured stock.
- **4 custom Ryan Realty automations (104–107):** 3 are DISABLED. The 1 that is ACTIVE (#107) triggers on a `Re-engage` tag and points at **archived (`zzzArchived`) email templates.** **Zero people hold the `Re-engage` tag**, so #107 never fires.

**Our lead-capture code does NOT target System B.** System B is either stock FUB defaults or a deprecated experiment. The code targets System A by ID (71/72 directly) or expects a System-A enrollment to be triggered by a tag (69/70). See §5 for why that expectation fails.

---

## 2. The lead entry points (what the code does)

Every figure here was traced from source. Assignment default is **Matt (userId 1)**; the agent-attribution cookie (`?agent=rebecca|paul` → `rr_agent_attribution`, 90-day) overrides to Rebecca (2) or Paul (3).

### 2.1 Seller Home Value LP — `app/lp/seller-home-value/actions.ts`
- **Trigger:** form POST (server action).
- **Compliance gate:** reads the person's tags first; if `compliance:hard-stop` (or any of the 7 DNC tags) is present, the `audience:*` tag and enrollment are **skipped.** This is the TCPA guard.
- **Tags applied:** `audience:seller`, one of `seller:hot|warm|nurture`, `source:seller-lp`, `broker:<slug>`, plus async geo tags (neighborhood/city).
- **Assignment:** `assignedUserId` = Matt (or attributed broker).
- **Custom fields:** `customMoveTimeline`, `customLeadTier`, `customIsSellerCurious`, `customSellerPropertyAddress`.
- **Task:** if HOT → `Call` task due in **5 minutes**.
- **Side effects:** Resend alert email to Matt; queues a CMA brain action.
- **Enrollment:** **none in code.** Applies `audience:seller` and *expects a FUB automation rule to enroll into AP 69.*
- **Sends:** does NOT send lead-facing email/SMS itself — that's the plan's job.

### 2.2 Buyer Listing Alerts LP — `app/lp/buyer-listing-alerts/actions.ts`
- **Trigger:** form POST. Same hard-stop gate.
- **Tags:** `audience:buyer`, one of `buyer:hot|warm|nurture`, `source:buyer-lp`, `broker:<slug>`.
- **Custom fields:** `customLeadTier`, `customBuyerMoveTimeline`, conditionally `customBuyerBudgetMin/Max`, `customBuyerSearchAreas`, `customBuyerBedsMin`.
- **Task:** if HOT → `Call` task due in **5 minutes**.
- **Enrollment:** **none in code.** Expects a FUB rule to enroll into AP 70.
- **Sends:** none itself.

### 2.3 Meta / Facebook Lead Webhook — `app/api/meta/lead-webhook/route.ts`
- **Trigger:** Meta pushes a POST on lead-form submit.
- **Person:** `POST /v1/people` with `source = "Facebook Lead Ad — <campaign>"`, `stage = "Lead"`, name/email/phone, `buySellIntent`, `campaign`.
- **Tags (in the create body):** `FB Lead Ad`, then `audience:buyer|seller`, an `Intent: Buying|Selling|Buying + Selling|Exploring`, a tier tag (or `possible-realtor`), and `source:fb-ads-buyer|seller`.
- **Note:** structured lead detail.
- **Task:** if HOT and not `possible-realtor` → `Call` task due in **5 minutes**.
- **⚠ Assignment:** **NONE.** The webhook never sets `assignedUserId` and never applies a `broker:` tag. FB leads land unassigned.
- **⚠ Compliance:** unlike the LP forms, **no `isHardStopped` check** before applying `audience:*`.
- **Enrollment:** none in code; expects a FUB rule.

### 2.4 Expired-Listing Cron — `app/api/cron/detect-expired-listings/route.ts` (+ `lib/expired-listing-processor.ts`)
- **Trigger:** Vercel cron schedule **removed 2026-05-22**; now invoked by `/api/cron/sync-delta` (every 10 min). Still callable on demand with `Bearer $CRON_SECRET`.
- **Person:** created via `POST /v1/events` (synthetic email if owner unknown).
- **Tags:** one of `Expired|canceled|withdrawn`, `audience:seller`, `seller:hot`, `intent:expired-listing`, `source:expired-listing-cron`, `broker:matt`, `owner-lookup:pending|resolved`.
- **Custom fields:** `customSellerPropertyAddress`, `customLeadTier = hot`, `customMoveTimeline = ready-now`.
- **Task:** `Call` task due in **60 minutes**.
- **Enrollment:** **`applyActionPlan(personId, 71)` — direct `POST /v1/actionPlansPeople`.** This path does NOT depend on a FUB rule; it enrolls itself.
- **Sends:** Resend alert to Matt; no FUB sends.

### 2.5 FSBO Cron — `app/api/cron/detect-fsbo-listings/route.ts`
- **Trigger:** Vercel cron `20 7 * * *` (07:20 UTC daily).
- **Tags:** `FSBO`, `<City>` (plain), `audience:seller`, `seller:hot`, `seller:fsbo-untouched`, `intent:fsbo`, `source:fsbo-cron`, `broker:matt`, `city:<slug>`, `owner-lookup:pending|resolved`.
- **Custom fields:** same shape as expired.
- **Task:** `Call` due in **60 minutes**.
- **Enrollment:** **`applyActionPlan(personId, 72)` — direct.** Same pattern as expired.
- **Assignment:** `broker:matt` + `assignedUserId` via the `brokerAttribution` flow.

### 2.6 Outreach-Execution Cron — `app/api/cron/fub-outreach-execution/route.ts`
- **Trigger:** no Vercel schedule found; on-demand (`Bearer $CRON_SECRET`).
- **Behavior:** for up to 150 of Matt's non-realtor, non-terminal leads — sets `stage` (`Attempting Contact` / `Seller Nurture`) and merges tags `auto:seller-seq:new|attempt|nurture|watch`, `auto:brand-voice:plain-honest`, `segment:my-leads`; writes a NOTE containing a drafted SMS + email for Matt.
- **Gated:** writes only when `FOLLOWUPBOSS_EXECUTION_ENABLED=true`; otherwise dry-run (writes a summary to Supabase `agent_insights`).
- **Enrollment / sends:** none. Drafts live in notes for Matt to send manually.

### 2.7 Seller-Workflow-Pause Cron — `app/api/cron/seller-workflow-pause/route.ts`
- **Trigger:** Vercel cron, every 15 min.
- **Behavior:** if an enrolled lead has inbound email/text within a 20-min lookback → applies `seller:in-conversation` or `buyer:in-conversation`.
- **Intent:** a FUB rule is supposed to read that tag and **unenroll** the lead (pause the drip on human reply).
- **Sends:** none.

### 2.8 Agent attribution — `components/AgentAttributionBridge.tsx` + `app/actions/agent-attribution-read.ts`
- Bridge sets the `rr_agent_attribution` cookie from `?agent=<slug>` (no FUB write). Reader returns `{ broker, userId }` to the LP actions so the lead routes to the right broker. Default: Matt.

---

## 3. The live workflows (what the plans actually do)

All verified Active, `stopOnContacted: true` (FUB auto-pauses the drip the moment the lead replies), real email templates (672–697, 720 — confirmed real, NOT archived: e.g. tmpl 672 = "SL-01 Seller LP Confirmation", 673 = "SL-02 A few thoughts", 685 = "SL-S2 Seller SMS Check-in"). SMS sends from the FUB-tracked number **+1 541.703.3095**.

### AP 69 — Seller Lead — Master Workflow (9 steps)
- **Day 0 + 1 min:** initial SMS — "Hi %first%, this is Matt Ryan with Ryan Realty. Got your home value request for %address%. Your CMA will be in your inbox shortly… If you'd rather I don't text you, just say stop." (opt-out present)
- **Day 0:** Call task ("seller LP lead") + email tmpl 672
- **Day 2:** email tmpl 673
- **Day 3:** HOT-only personal-SMS task (tmpl 685)
- **Day 10 / 21 / 45:** emails 674 / 675 / 676
- **Day 60:** remove `seller:hot|warm|nurture`, add `seller:long-nurture`

### AP 70 — Buyer Lead — Master Workflow (11 steps)
- **Day 0 + 1 min:** initial SMS — "Hi %first%, Matt with Ryan Realty. Got your search set up for %areas%. What's the best time to call you this week?"
- **Day 0:** Call task + email 677 + task "send first matched-listings batch within 30 min"
- **Day 2:** email 678
- **Day 5:** HOT-only personal-SMS task (BL-S2)
- **Day 10 / 21 / 45 / 90:** emails 679 / 680 / 681 / 720
- **Day 90:** remove `buyer:hot|warm|nurture`, add `buyer:long-nurture`

### AP 71 — Expired Recovery (auto) (10 steps) — no initial auto-SMS
- **Day 0:** manual EXP-T0 SMS task (tmpl 77) + email 688
- **Day 2:** email 686
- **Day 6:** email 687 + "mail letter" task
- **Day 14 / 15 / 17:** emails 689 / 691 / 690
- **Day 30:** "mail postcard" task
- **End:** add `expired:long-nurture`

### AP 72 — FSBO Recovery (auto) (10 steps) — no initial auto-SMS
- **Day 0:** manual FSBO-T0 SMS task (tmpl 78) + email 694
- **Day 2:** email 692
- **Day 6:** email 693 + "mail letter" task
- **Day 14 / 15 / 17:** emails 695 / 697 / 696
- **Day 30:** "mail postcard" task
- **End:** add `fsbo:long-nurture`

### AP 73 / 74 / 75 — Nurture plans (email-only)
Out-of-State Owner (4 emails), Neighborhood Resident (12 emails), Sphere (6 emails). All Active, 0 enrolled. No code path currently enrolls into these — they would be manual or future-tag-rule driven.

---

## 4. The compliance / pause layer (verified working in design)
- **Hard-stop gate (LP paths):** the 7 DNC tags + `compliance:hard-stop` block `audience:*` from being applied, so a DNC contact never enters a drip. (Confirmed in code. **Gap: the Meta webhook lacks this check — §2.3.**)
- **Opt-out language:** AP 69/70 initial SMS both carry "say stop" / standard opt-out. ✓
- **stopOnContacted = true** on every plan → FUB halts the drip when the lead replies.
- **Pause cron** adds `*:in-conversation` for a belt-and-suspenders pause (0 applied to date, because nothing is enrolled).

---

## 5. The gap, with numbers (this is the finding)

Live `/v1/people` tag counts (global, 18,162 people total) vs. enrollment:

| Code-applied tag | People carrying it | Plan it should feed | Actually enrolled |
|---|---:|---|---:|
| `audience:seller` | **3,492** | AP 69 | **0** |
| `audience:buyer` | **37** | AP 70 | **0** |
| `source:seller-lp` | 0 | AP 69 | 0 |
| `source:buyer-lp` | 0 | AP 70 | 0 |
| `source:fb-ads-seller/buyer`, `FB Lead Ad` | 0 / 0 | AP 69/70 | 0 |
| `intent:expired-listing` | 306 | AP 71 | **0** |
| `source:expired-listing-cron` | 142 (newest 2026-05-20) | AP 71 | **0** |
| `intent:fsbo` / `source:fsbo-cron` | 0 / 0 | AP 72 | 0 |
| `Re-engage` (only active Automation 2.0 trigger) | **0** | Automation #107 | n/a |
| `seller:in-conversation` / `buyer:in-conversation` | 0 / 0 | pause | 0 |

### Why nothing is enrolled

**LP + Meta leads (AP 69/70):** the code applies `audience:seller` / `audience:buyer` and relies on a FUB automation rule to enroll them. **No such rule exists.** Proof:
- AP 69/70 have `leadFlowIds: []` (no lead-source auto-enroll) and `isDefaultSellerPlan / isDefaultBuyerPlan: false` (not the account default plan).
- The only tag-triggered Automation 2.0 rule is #107, which watches `Re-engage` — a tag **0 people hold** — and points at archived templates.
- Net: 3,492 seller-tagged + 37 buyer-tagged people, **0 enrolled.** The tag is a dead end.

**Expired / FSBO leads (AP 71/72):** the code enrolls directly via `applyActionPlan(71/72)`, so these do NOT need a rule. Yet enrollment is still 0. The most recent expired-cron batch was created **2026-05-20**; AP 71 was reconfigured **2026-05-27**. So that batch predates the current plan config. **This needs one live verification:** trigger a single fresh expired/FSBO detection and confirm a person actually lands in `/v1/actionPlansPeople` for plan 71/72. Until that's observed, treat the direct-enrollment path as unconfirmed (do not assume it fires, do not assume it's broken).

**Source tags at 0 (LP + FB):** `source:seller-lp`, `source:buyer-lp`, and all `fb-ads`/`FB Lead Ad` counts are 0 — meaning **no production lead has entered through the LP forms or the Meta webhook yet** (the 3,492 `audience:seller` are a historical book, newest created 2026-02-04). So those paths are also end-to-end **untested in production**, separate from the enrollment gap.

---

## 6. What "connecting it" would take (recommendation only — not yet done)

Listed for Matt's decision; nothing here has been changed.

1. **Build the missing enrollment rule(s)** so `audience:seller` → enroll AP 69 and `audience:buyer` → enroll AP 70. Two options:
   - a FUB **Automation 2.0** rule (Trigger: "Tag Added: audience:seller" → step "Start Action Plan 69"), or
   - add `applyActionPlan(69/70)` directly in the LP/Meta code (same pattern the expired/FSBO crons already use). The code-side option is more reliable and testable than a UI rule.
2. **Add the hard-stop compliance check to the Meta webhook** (§2.3) before it applies `audience:*`, and give FB leads an assignment + `broker:` tag.
3. **Verify the direct expired/FSBO enrollment** with one live detection (§5).
4. **Decide what to do with the 3,492 historical `audience:seller` contacts** — a one-time backfill enrollment would blast a 60-day drip at a large legacy list, so this is a deliberate, compliance-screened, batched decision, not an automatic one.
5. **Retire or fix the Automations 2.0 customs (104–107)** — they point at archived templates and only #107 is active (on a dead tag). They add confusion against the System-A plans the code actually uses.

---

## 7. Source trace (so this is auditable)
- Action plans + status: `GET /v1/actionPlans?limit=100` (2026-05-29) → 76 plans, 69–75 Active.
- Plan steps/cadence: `GET /v1/actionPlans/{69,70,71,72}` (2026-05-29).
- Enrollment: `GET /v1/actionPlansPeople?actionPlanId={69..75}` → `_metadata.total = 0` for all; AP 69 `contactsRunningCount: 0`, `isUsed: false`.
- Tag populations: `GET /v1/people?tags=<tag>&limit=1` → `_metadata.total` per tag (2026-05-29).
- Recency: `GET /v1/people?tags=source:expired-listing-cron&sort=-created` → newest 2026-05-20; `audience:seller` newest 2026-02-04.
- Templates: `GET /v1/templates/{672,673,685}` → real names/subjects/bodies (not archived).
- Code: `app/lp/seller-home-value/actions.ts`, `app/lp/buyer-listing-alerts/actions.ts`, `app/api/meta/lead-webhook/route.ts`, `app/api/cron/detect-expired-listings/route.ts`, `app/api/cron/detect-fsbo-listings/route.ts`, `app/api/cron/fub-outreach-execution/route.ts`, `app/api/cron/seller-workflow-pause/route.ts`, `components/AgentAttributionBridge.tsx`, `app/actions/agent-attribution-read.ts`, `lib/followupboss.ts`.
- Automations 2.0 UI: `https://ryan-realty.followupboss.com/2/automations/v2` — 83–87 Manual triggers, 104–107 custom (3 disabled, #107 active on `Re-engage`).
