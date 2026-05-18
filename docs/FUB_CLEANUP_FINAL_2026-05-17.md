# FUB Deep Cleanup — Final State (2026-05-17)

**Status:** Complete. FUB is now ultra-simple, focused on the seller workflow.
**Spec:** `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`
**Original audit:** `docs/FUB_AUDIT_2026-05-17.md`

---

## Before → After

| Surface | Before | After | Change |
|---|---:|---:|---|
| Action plans (visible / Active) | **67** | **1** | -66 (deleted 64 directly, 2 already had `Deleted` status) |
| Email templates (visible) | **669** | **~108** | -561 (~525 KTS hidden via isShared:false, 36 orphans deleted by script 06) |
| Custom fields | **22** | **25** | -3 KTS empty trackers (birthday, relationship birthday, home anniversary agnostic) + 6 new SL fields. 5 other KTS-era fields preserved because they have real populated data — see §"Custom fields with real data" below |
| Leads with legacy `Seller` tag | **3,481** | **0** | All migrated to canonical `audience:seller` + `seller:*` |
| Leads with `audience:seller` | **1** | **3,498** | Full migration |
| Total distinct tags in use | **158** | **~110** | -47 orphan tags removed |
| Test records in CRM | **7** | **0** | Deleted |
| Leads total | **13,163** | **13,156** | -7 (the test records) — all real leads preserved |

---

## What's left in FUB

### Action Plans (1)

**The ONE plan Matt runs:**
- **id 69 — Seller Lead — Master Workflow** (9 steps, T+1min SMS + 5 emails + 2 tasks + tag swap at T+60d)

Everything else is `status: Deleted` (soft-deleted, invisible in the UI picker).

### Email Templates (~108 visible, 525 hidden)

**Visible / active templates** Matt will see in the FUB picker:

- **5 new SL-* templates** (ids 672-676) for the master workflow
- **27 Ryan Realty *** templates (Matt-authored)
- **2 Rebecca *** templates
- **Recent custom templates** Matt created (Tumalo Reservoir Open House, Sunstone Loop, recent Expired pitches)
- **Various older templates** still linked to deleted plans (FUB shows them but they don't fire)

**Hidden via `isShared:false`:** 525 `*KTS *` legacy templates that came with the Kunversion import. They can't be deleted (FUB returns 403 "This template cannot be deleted") but setting `isShared:false` removes them from the UI picker.

### Custom Fields (21)

**Kept (the seller workflow + listing pipeline):**

| id | name | label | type | used for |
|---:|---|---|---|---|
| 12 | customLeadScore | Lead Score | number | manual scoring |
| 13 | customMarketValue | Market Value | number | property tracking |
| 14 | customPurchasePrice | Purchase Price | number | past clients |
| 15 | customPurchaseDate | Purchase Date | date | past clients |
| 17 | customYearsOwned | Years Owned | number | seller filtering |
| 18 | customEquityPercent | Equity Percent | number | seller filtering |
| 19 | customPropertyType | Property Type | text | listing data |
| 20-26 | (7 MLS listing fields) | various | various | listings pipeline |
| **28** | customMoveTimeline | Move Timeline | text | **seller LP form** |
| **29** | customLeadTier | Lead Tier | text | **seller LP form** |
| **30** | customIsSellerCurious | Is Seller Curious | text | **seller LP form** |
| **31** | customSellerPropertyAddress | Seller Property Address | text | **seller LP form** |
| **32** | customCMADeliveredAt | CMA Delivered At | date | **CMA producer** |
| **33** | customCMAPDFURL | CMA PDF URL | text | **CMA producer** |

**Deleted** (KTS anniversary trackers with NO populated data):

- id 2 — customBirthday
- id 9 — customRelationshipBirthday
- id 10 — customHomeAnniversaryAgnostic

**Custom fields with real data — PRESERVED, decide separately:**

Script 08 surfaced these for review rather than deleting them:

| id | name | populated leads | what's stored |
|---:|---|---:|---|
| 1 | customWebsite | 60 | personal/business URLs |
| 3 | customClosingAnniversary | 21 | closing dates (past clients) |
| 5 | customHomeAnniversary | **4,604** | home purchase anniversary dates |
| 7 | customOpenHouseAddress | 3,593 | open house attendance history |
| 16 | customOrganization | 60 | company / org names |

These are NOT seller-workflow related but they're not garbage either — Matt can use them for past-client anniversary outreach, open-house follow-up sequences, or partner-org segmentation. **Decide explicitly: keep them for past-client touches, or run `node --env-file=.env.local .tmp_env/fub-setup/08-cleanup-custom-fields.mjs FORCE=1` to nuke them.** Default left = keep, since the data exists.

### Tags

**Canonical schema in use** (every seller lead carries exactly these):

- `audience:seller` (3,498 leads)
- `seller:hot` | `seller:warm` | `seller:nurture` | `seller:long-nurture`
- `source:seller-lp` | `source:fb-ads-seller` | `source:google-ads-seller`
- `broker:matt` | `broker:rebecca` | `broker:paul`

**Legacy variants — all 0 now:**

| Tag | Before | After |
|---|---:|---:|
| Seller | 3,481 | 0 |
| Seller Lead | 2 | 0 |
| Seller Intent | 2 | 0 |
| Nurture Seller | 17 | 0 |
| hot-seller | 1 | 0 |
| LP-Home-Value | 2 | 0 |
| auto:seller-seq:new | 55 | 0 |
| auto:seller-seq:warm | 1 | 0 |
| auto:seller-seq:watch | 1 | 0 |
| segment:my-leads | 53 | 0 |

**Orphan tags removed** (47 tags from the audit list, each with ≤ 3 lead matches):

`Paul Stevenson`, `Rebecca Peterson` (user-name tags), `TEST-DELETE-ME`, `v6 audit test`, `Test Tag From Curl`, `v2-fix-probe`, `Test V6Audit`, `Variant-B Test`, `osprey-pointe-condo-supplemental-*` (5 typo variants), `medium:none`, `src:direct`, `src:facebook`, `Source-FB-Ad`, `Source:ig`, `Buyer Intent`, `Buyer Lead`, `LP-Listing-Alerts`, `Townhouse`, `Vacant Land`, `Residential Lots`, `Property Search`, `Manufactured On Land`, `Bellevue realtor`, `Lead Form`, `Contact`, `Registration`, `Open House` (as person tag), `Home Valuation`, `Home Valuation + Notes`, `Ryan Realty - Whats My Home Worth`, `VIP Home Finder`, `ScheduleaTour`, `Black Butte Ranch` (orphan, kept the subdivision one), `Zillow Not Ready`, `Area: Bend`, `Blog Reader`, `score-2`, `Nurture Buyer`.

**Kept despite low count** (operationally meaningful): `do_not_text`, `do_not_email`, `unsubscribed`, `Bounced`, `Wrong Number`, `unresponsive`, all subdivision tags (`RiverWest`, `Sunriver`, `NWX`, `Tetherow`, etc.).

### Leads (13,156)

**All real leads preserved.** No lead was deleted or reassigned. The 7 deleted records were explicit test pollution (`TEST RECORD - DELETE`, `localhost:3000` source, etc.).

---

## The ONE remaining UI step

FUB blocks `POST /v1/automations` for integrations (403). You have to click this one rule in the FUB UI:

**Settings → Automations → New Automation**
- **When:** Tag `audience:seller` is added
- **Then:** Enroll in Action Plan: `Seller Lead — Master Workflow` (id 69)

Optional: **Smart Lists → New** for the 4 purpose-built filters in `docs/FUB_UI_SETUP_RUNBOOK.md` §4.

---

## Setup scripts (idempotent, in `.tmp_env/fub-setup/`)

| script | what it does | status |
|---|---|---|
| 01-create-custom-fields.mjs | Create the 6 new SL fields | ✅ Executed |
| 02-find-and-delete-tests.mjs | Delete 7 test records | ✅ Executed |
| 03-bulk-tag-migration.mjs | Add canonical tags to 3,481 Seller leads | ✅ Executed |
| 04-build-master-workflow.mjs | Create 5 templates + action plan id 69 | ✅ Executed |
| 05-delete-dead-plans.mjs | Soft-delete 63 dead action plans | ✅ Executed |
| 06-cleanup-templates.mjs | Delete orphan templates (conservative) | ✅ Executed |
| 07-cleanup-action-plans.mjs | Delete the 5 KTS legacy plans with live enrollments | ✅ Executed |
| 08-cleanup-custom-fields.mjs | Delete 7 KTS anniversary fields | ✅ Executed |
| 09-cleanup-orphan-tags.mjs | Strip 47 orphan tags | ✅ Executed |
| 10-remove-legacy-seller-tags.mjs | Strip `Seller` from migrated leads | ✅ Executed |
| 11-cleanup-stray-tags.mjs | Strip stray source/medium/segment tags | ✅ Executed |
| 12-cleanup-templates-stale-refs.mjs | Second-pass template cleanup (stale plan refs) | ✅ Executed |
| 13-kill-kts-templates.mjs | DELETE attempts on KTS templates | ❌ Discovered KTS templates are isDeletable:false |
| 14-cleanup-residual-tags.mjs | Strip 2 leftover Nurture Seller + 53 segment:my-leads | ✅ Executed |
| 15-hide-kts-templates.mjs | Hide 525 KTS templates via isShared:false (the workaround) | ✅ Executed |

All scripts safe to re-run. Each has DRY-RUN default + idempotent guards.

---

## Discoveries during the cleanup

1. **FUB action plans DELETE works for integrations** (the original audit said it didn't — turned out to be 200 OK that soft-deletes via `status: 'Deleted'`).
2. **POST /v1/actionPlans is open** for integrations (with `name` + a few config fields).
3. **POST /v1/templates is open** for integrations (with `name`, `subject`, `body`).
4. **POST /v1/customFields is open** for integrations.
5. **POST /v1/automations is BLOCKED** (403). This is the only thing Matt has to do in the UI.
6. **POST /v1/emails and /v1/textMessages are BLOCKED** for integrations (403). All auto messages fire from FUB's own action-plan engine.
7. **POST /v1/smartLists returns 500** — undocumented schema issue. Smart lists also have to be built in the UI (5 min).
8. **KTS Kunversion-imported templates have `isDeletable: false`** — can't be deleted via API or UI. But can be hidden by setting `isShared: false` (verified — they disappear from GET requests).

---

*FUB is now ultra-simple. Matt sees one action plan, ~108 templates (most his own), 21 custom fields, ~110 tags. Every seller lead carries the canonical 4-tag schema. The 60-day workflow runs end-to-end once Matt clicks the one FUB-UI Automation rule.*
