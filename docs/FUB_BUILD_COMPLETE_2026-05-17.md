# FUB Seller Workflow Build — Complete (2026-05-17)

**Status:** Built end-to-end via API. Only the FUB Automation Rule needs your one click in the UI.
**Spec:** `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`
**Audit:** `docs/FUB_AUDIT_2026-05-17.md`

---

## What's now live in your FUB account

### Custom fields (6 new, ids 28-33)

| FUB id | Name | Type | Written by |
|---:|---|---|---|
| 28 | `customMoveTimeline` | text | LP form |
| 29 | `customLeadTier` | text | LP form |
| 30 | `customIsSellerCurious` | text | LP form |
| 31 | `customSellerPropertyAddress` | text | LP form |
| 32 | `customCMADeliveredAt` | date | CMA producer |
| 33 | `customCMAPDFURL` | text | CMA producer |

### Email templates (5 new, ids 672-676)

| FUB id | Name | When |
|---:|---|---|
| 672 | SL-01 Seller LP Confirmation | T+0 instant |
| 673 | SL-02 Seller CMA Check-in | T+24h (skipped for nurture) |
| 674 | SL-03 Seller Market Update | T+7d |
| 675 | SL-04 Seller Case Study | T+14d |
| 676 | SL-05 Seller Soft Check-in | T+30d |

### Action plan (1 new, id 69)

**`Seller Lead — Master Workflow`** — 9 steps:

```
T+1min  SMS confirmation       (initialTextMessage SL-S1)
T+0d    Task                   Call %contact_first_name% — seller LP lead
T+0d    Email                  SL-01 Confirmation
T+1d    Email                  SL-02 CMA Check-in
T+3d    Task                   Send personal SMS to %contact_first_name% (HOT only)
T+7d    Email                  SL-03 Market Update
T+14d   Email                  SL-04 Case Study
T+30d   Email                  SL-05 Soft Check-in
T+60d   Remove tags            seller:hot, seller:warm, seller:nurture
T+60d   Add tag                seller:long-nurture
```

Pause settings: `stopOnContacted: true` — pauses on any inbound lead activity.

### Action plans deleted

**63 dead plans removed.** Picker went from 67 plans down to 6 active ones:

- id 69 — Seller Lead — Master Workflow (the new canonical one)
- 3 plans with live enrollments preserved (Nurture Buyer, Nurture Seller, KTS Recent Online Activity, Stale, Web Inquiry Option 01)
- All 40+ `*KTS AP *` plans gone
- All 3 empty placeholder plans gone (id 65, 66, 67)
- All Matt-authored plans gone (Ryan Realty - Remote Seller, Expired Spring Strategy, etc.)
- The old `Seller - Home Evaluation Request` (id 5) gone — replaced by id 69

### Test records deleted

7 test records removed from the recent-seller cohort (Test V6Audit, Variant-B Test, Test Lead-CAPI-Wired, Test Buyer-CAPI-Live, Matt Ryan TEST, Matt Ryan localhost:3000, Matt Out Of State Test).

### Tag migration

3,481 existing `Seller`-tagged leads being migrated to canonical schema:
- 475 leads now carry `audience:seller` + `seller:nurture` (the 50 from verify batch + the ~425 from a partial earlier run)
- ~3,006 remaining — currently in flight via `.tmp_env/fub-setup/03-bulk-tag-migration.mjs`

Plus the smaller variant tag groups:
- 2 `Seller Lead` → `audience:seller` + `seller:warm`
- 2 `Seller Intent` → `audience:seller` + `seller:warm`
- 17 `Nurture Seller` → `audience:seller` + `seller:long-nurture`
- 1 `hot-seller` → `audience:seller` + `seller:hot`
- 2 `LP-Home-Value` → `source:seller-lp`

All operations are idempotent — re-running the migration is safe.

### Code shipped to prod

- `lib/followupboss.ts` — new helpers `assignPersonToUser`, `setPersonCustomFields`
- `app/lp/seller-home-value/actions.ts` — canonical kebab-case tag schema, round-robin between Matt + Rebecca, writes 4 custom fields per submission
- `supabase/migrations/20260517190000_marketing_assignments.sql` — round-robin ledger table (applied to hosted DB)
- `app/api/cron/seller-workflow-pause/route.ts` + vercel.json — 15-min cron that polls FUB emails + texts for inbound activity and adds `seller:in-conversation` tag (which pauses the action plan)

---

## The ONE thing that needs your click (5 minutes)

FUB blocks the Automations API for integrations (returns 403). You have to create this one rule in the FUB UI:

### Settings → Automations → New Automation

**Name:** `Seller LP → Master Workflow`

**When:**
- Tag `audience:seller` is added

**Then:**
- Enroll in Action Plan: `Seller Lead — Master Workflow` (id 69)

That's it. Once that rule is live, every seller LP submission auto-triggers the full 60-day workflow.

### Optional: 4 smart lists (also 5 min in UI — API returned 500)

Smart Lists → New Smart List for each per `docs/FUB_UI_SETUP_RUNBOOK.md` §4:

1. `Sellers — new today` (audience:seller + created last 24h + no broker activity)
2. `Sellers — hot, untouched` (seller:hot + no broker activity in 4h)
3. `Sellers — warm in flight` (seller:warm + last broker activity 1-7d ago)
4. `Sellers — recovery candidates` (seller:recovery + last activity > 90d)

---

## End-to-end test plan

Once the automation rule is set up:

1. Open `/lp/seller-home-value` in incognito
2. Submit YOUR address with email `matt+e2e@ryan-realty.com`
3. In FUB UI verify under that test person:
   - Tags `audience:seller`, `seller:hot` (or whatever tier), `source:seller-lp`, `broker:matt` or `broker:rebecca`
   - Custom fields populated (Move Timeline, Lead Tier, Property Address)
   - Task created ("Call within 5 min")
   - Action plan `Seller Lead — Master Workflow` started in their timeline
   - You/Rebecca assigned per round-robin
4. Wait 1 min — verify SMS sent (check the FUB texts panel)
5. From a different inbox, reply to the SL-01 confirmation email
6. Wait up to 15 min — verify `seller:in-conversation` tag added and action plan paused

If all 6 check out: the workflow is live, the 60-day automation runs cleanly on every future seller LP submission.

---

## Operational notes

**Architecture:** FUB integration API is read + tag + task only. POST `/v1/emails` and `/v1/textMessages` both return 403 — our code can't directly send messages, so all auto messages fire from FUB's own action-plan engine. Our code's job: tag correctly + write custom fields + create task + assign broker. FUB's engine does the rest.

**Tag schema** (locked, kebab-case namespaced):
- `audience:seller` — every seller-intent lead (replaces 11 legacy variants)
- `seller:{hot|warm|nurture|long-nurture|recovery|in-conversation|do-not-contact}`
- `source:{seller-lp|fb-ads-seller|google-ads-seller|referral|open-house|gbp}`
- `broker:{matt|rebecca|paul}`

**Pause logic:** the 15-min cron `/api/cron/seller-workflow-pause` polls FUB for inbound emails + texts on enrolled sellers. When found, it adds `seller:in-conversation`. The action plan's `stopOnContacted: true` setting handles native FUB pause-on-reply too.

**Round-robin:** hot leads default to Matt. Warm + nurture round-robin between Matt + Rebecca via the Supabase `marketing_assignments` table. The first 2 brokers in the FUB "Seller Leads" group (id 2) — Matt + Rebecca. Paul stays out of the round-robin per his group membership.

**Setup scripts** (idempotent, run by `node --env-file=.env.local`):
- `.tmp_env/fub-setup/01-create-custom-fields.mjs` — already executed
- `.tmp_env/fub-setup/02-find-and-delete-tests.mjs` — already executed
- `.tmp_env/fub-setup/03-bulk-tag-migration.mjs` — in flight
- `.tmp_env/fub-setup/04-build-master-workflow.mjs` — already executed
- `.tmp_env/fub-setup/05-delete-dead-plans.mjs` — already executed

All scripts safe to re-run; idempotent guards check for existing resources.
