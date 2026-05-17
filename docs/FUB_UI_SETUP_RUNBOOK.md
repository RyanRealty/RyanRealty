# FUB UI Setup Runbook — Seller Lead Master Workflow

**For:** Matt (broker, FUB account owner)
**Spec source:** `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`
**Time:** ~45 min one-time setup
**Outcome:** ONE clean seller workflow that runs every time a lead fills out `/lp/seller-home-value`

---

## What the code already did (no UI work needed for these)

✅ Created 6 custom fields in FUB (Move Timeline, Lead Tier, Is Seller Curious, Seller Property Address, CMA Delivered At, CMA PDF URL)
✅ Deleted 7 test records polluting the recent-seller cohort
✅ Rewrote `app/lp/seller-home-value/actions.ts` to emit the canonical kebab-case namespaced tag schema (`audience:seller`, `seller:hot|warm|nurture`, `source:seller-lp`, `broker:matt|rebecca`)
✅ Round-robin assignment between Matt + Rebecca for warm/nurture leads (hot still defaults to Matt)
✅ Custom fields written automatically on every LP submission
✅ New `marketing_assignments` Supabase table for round-robin state
✅ New 15-min cron `/api/cron/seller-workflow-pause` that detects when a lead replies and pauses the auto touches

## What you need to do in the FUB UI (this runbook)

1. **Build 7 email + SMS templates** (10 min) — copy-paste from §1 below
2. **Build the master action plan** (15 min) — 11 steps total, branching by tier
3. **Build the automation rule** (5 min) — listens for `audience:seller` tag → enrolls in action plan
4. **Build 4 smart lists** (5 min) — daily / hot / warm / recovery filters
5. **Archive 60+ unused action plans** (10 min) — Settings → Action Plans
6. **Connect Gmail BCC tracking** for the CMA delivery email (1 min)

---

## 1. Templates — paste these into FUB UI Settings → Templates

Each template uses FUB merge tokens — `{{firstName}}`, `{{lastName}}`, `{{address}}`, `{{city}}` etc. The `{{address}}` token reads from `customSellerPropertyAddress` (just created). Custom field merge tokens are written as `{{customMoveTimeline}}`, etc.

### Template SL-01 (Email) — Seller LP Confirmation

**Name:** `SL-01 Seller LP Confirmation`
**Type:** Email
**Subject:** `Got your home value request for {{customSellerPropertyAddress}}`
**Body:**

```
Hi {{firstName}},

Thanks for reaching out. We got your request for the home value analysis
on {{customSellerPropertyAddress}}, and I'm pulling comps now.

You'll have the full personalized CMA in your inbox shortly. If anything
specific about the property would change how I think about value — recent
upgrades, special features, anything unique — just reply here and I'll
factor it in.

Talk soon,
Matt Ryan
Ryan Realty
541.213.6706
matt@ryan-realty.com
```

---

### Template SL-S1 (SMS) — Seller SMS Confirmation

**Name:** `SL-S1 Seller SMS Confirmation`
**Type:** SMS
**Body:** (160 chars max)

```
Hey {{firstName}}, Matt from Ryan Realty here. Got your home value request for {{customSellerPropertyAddress}}. CMA in your inbox shortly. Anything I should know first?
```

---

### Template SL-02 (Email) — Seller CMA Check-in (T+24h)

**Name:** `SL-02 Seller CMA Check-in`
**Type:** Email
**Subject:** `Did the CMA make sense?`
**Body:**

```
Hi {{firstName}},

Wanted to make sure the analysis came through OK on {{customSellerPropertyAddress}}.
The market has been doing some interesting things, and your property has
a few things working in its favor.

Happy to walk through it over the phone or coffee if you want to dig in.

Matt
541.213.6706
```

---

### Template SL-S2 (SMS) — Seller SMS Check-in (T+3d, HOT only)

**Name:** `SL-S2 Seller SMS Check-in`
**Type:** SMS
**Body:**

```
Hi {{firstName}}, Matt at Ryan Realty checking in. Did you get a chance to look at the home value analysis I sent? Happy to answer anything.
```

---

### Template SL-03 (Email) — Seller Market Update (T+7d)

**Name:** `SL-03 Seller Market Update`
**Type:** Email
**Subject:** `Where Bend is right now`
**Body:**

```
Hi {{firstName}},

A quick update on what's happening in the area that might affect what
your home could fetch right now.

I'll send through the latest numbers in a follow-up. In the meantime,
if anything has shifted on your end — timing, expectations, the property
itself — let me know.

Matt
541.213.6706
```

(Future enhancement: a separate cron will populate live market numbers
into a per-lead version of this template via FUB's "Custom Plan Step"
mechanism. For now, the broker handles the per-city market data
manually in a follow-up email.)

---

### Template SL-04 (Email) — Seller Case Study (T+14d)

**Name:** `SL-04 Seller Case Study`
**Type:** Email
**Subject:** `A recent comparable sale you'd want to see`
**Body:**

```
Hi {{firstName}},

A property near you closed recently and I thought you'd want to see how
it played out. The takeaway for your home: a clear story for the right
buyer matters a lot more than just the list price.

If you're getting closer to making a move, let's talk through what the
next 60 days could look like for {{customSellerPropertyAddress}}.

Matt
```

---

### Template SL-05 (Email) — Seller Soft Check-in (T+30d)

**Name:** `SL-05 Seller Soft Check-in`
**Type:** Email
**Subject:** `Still thinking about selling?`
**Body:**

```
Hi {{firstName}},

It's been a few weeks since the CMA on {{customSellerPropertyAddress}}.
No pressure either way — just wanted to check in.

If your timing has shifted, I'm here. If not, I'll keep you on the
market updates so when the time is right, you've got the picture.

Matt
541.213.6706
```

---

## 2. Action Plan — `Seller Lead — Master Workflow`

**FUB UI:** Settings → Action Plans → New Action Plan

**Name:** `Seller Lead — Master Workflow`
**Trigger:** *None (we trigger it via Automation Rule in §3 below)*

### Steps (in order)

| # | Wait | Action | Details |
|---|---|---|---|
| 1 | 0 min | Send Email | Template `SL-01 Seller LP Confirmation` |
| 2 | 1 min | Send Text | Template `SL-S1 Seller SMS Confirmation` |
| 3 | 5 min | Create Task | Title: `Call {{firstName}} — seller LP lead`, Type: Call, Due: 5 min, Assigned to: assigned user |
| 4 | 24 hours | Send Email | Template `SL-02 Seller CMA Check-in` **(skip if person has tag `seller:nurture`)** |
| 5 | 3 days | Send Text | Template `SL-S2 Seller SMS Check-in` **(skip if person does NOT have tag `seller:hot`)** |
| 6 | 7 days | Send Email | Template `SL-03 Seller Market Update` |
| 7 | 14 days | Send Email | Template `SL-04 Seller Case Study` |
| 8 | 30 days | Send Email | Template `SL-05 Seller Soft Check-in` |
| 9 | 60 days | Remove Tags | `seller:hot, seller:warm, seller:nurture` |
| 10 | 60 days | Add Tags | `seller:long-nurture` |

**Pause conditions** (configure under "Pause Settings" in the action plan):
- ☑ Pause when lead replies via email
- ☑ Pause when lead replies via text
- ☑ Stop when tag `seller:in-conversation` is added
- ☑ Stop when tag `seller:do-not-contact` is added
- ☑ Stop when stage moves past `Lead`

---

## 3. Automation Rule — `Seller LP → Master Workflow`

**FUB UI:** Settings → Automations → New Automation

**Name:** `Seller LP → Master Workflow`

**When ALL of these are true:**
- Tag `audience:seller` IS added
- Person source is one of: `Ryan-Realty.com`, `ryan-realty.com`, `ryanrealty.vercel.app`, `Ryan Realty LP - Seller - Home Value (FB Ads)`

**Then do:**
1. Enroll in Action Plan: `Seller Lead — Master Workflow`

That's it. The action plan's per-step skip rules handle the hot/warm/nurture branching.

---

## 4. Smart Lists — 4 purpose-built

**FUB UI:** Smart Lists → New Smart List for each

### Smart List 1: `Sellers — new today`
- Filter: Has tag `audience:seller` **AND** Created in last 1 day **AND** Has NOT been emailed in last 1 day
- Pin to top of Smart Lists sidebar
- Save and share with Rebecca

### Smart List 2: `Sellers — hot, untouched`
- Filter: Has tag `seller:hot` **AND** Last broker activity > 4 hours ago **AND** Does NOT have tag `seller:in-conversation`
- Pin to top

### Smart List 3: `Sellers — warm in flight`
- Filter: Has tag `seller:warm` **AND** Last broker activity 1-7 days ago
- Pin to top

### Smart List 4: `Sellers — recovery candidates`
- Filter: Has tag `seller:recovery` **AND** Last activity > 90 days ago
- Pin to top

---

## 5. Archive the 60+ unused action plans

**FUB UI:** Settings → Action Plans

**Keep these (active production):**
- `Seller Lead — Master Workflow` (the one you just built)
- `*KTS AP Nurture Buyer` (4 leads currently enrolled — keep until buyer workflow rebuild)
- `*KTS AP Nurture Seller` (1 lead enrolled — keep until that lead exits)
- Any plan you're actively editing

**Archive everything else.** Click each plan → "Archive". Specifically:

- The 40+ `*KTS AP …` plans not in the keep list above
- 3 empty placeholders: `Expired Second Touch (Apr 2026)`, `Out of State Second Touch (Apr 2026)`, `Expired Listing SMS v2 (Apr 2026)`
- `Seller - Home Evaluation Request` (id 5) — replaced by the new master workflow, archive AFTER 30 days of the new one running cleanly

This reduces your action plan picker from 67 items to ~5.

---

## 6. Connect Gmail BCC tracking for CMA delivery emails

The CMA producer sends the CMA PDF from `matt@ryan-realty.com` via Resend. For FUB to track that email under the lead's record, BCC it to your FUB-tracking address.

**FUB UI:** Settings → Email & Calendar → Email Forwarding

Look for your "BCC Forwarding Address" — it'll be something like `<random>@bcc.followupboss.com`.

Then in `lib/cma-delivery.ts` or `/api/cma/[slug]/email/route.ts`, add the BCC address to outgoing emails. Provide it to me and I'll wire it in (it's a one-line change). It's worth keeping that BCC out of the repo (it's an account-bound secret) — set it as `FUB_BCC_TRACKING_EMAIL` in Vercel env vars.

---

## 7. Test end-to-end

Before bulk-tagging the 3,481 existing `Seller`-tagged leads:

1. Open `/lp/seller-home-value` in an incognito browser
2. Submit with YOUR address + email (use `matt+e2e@ryan-realty.com` to avoid touching your real record)
3. Verify in FUB UI:
   - Person was created with canonical tags (`audience:seller`, `seller:hot`/`warm`/`nurture`, `source:seller-lp`, `broker:matt` or `broker:rebecca`)
   - Person has custom field values (Move Timeline, Lead Tier, Property Address)
   - Action plan `Seller Lead — Master Workflow` started — check person's timeline
   - First task created (call within 5 min)
   - Person assigned to Matt OR Rebecca per round-robin
4. Wait 1 min and confirm SL-S1 SMS fired
5. Reply to the confirmation email from another inbox
6. Wait 15 min and confirm:
   - The cron added tag `seller:in-conversation`
   - The action plan paused

If all 6 check out, the workflow is live. Then we can:
- Run the bulk tag migration on existing `Seller`-tagged leads
- Archive the old `Seller - Home Evaluation Request` plan

---

## 8. After 7 days of clean running

Run the legacy tag cleanup pass — this removes the old Title Case tags
(`Seller`, `Seller Lead`, `Seller Intent`, `Nurture Seller`, `hot-seller`,
`LP-Home-Value`) from the leads that now carry the canonical equivalents:

```bash
DELETE=1 node --env-file=.env.local .tmp_env/fub-setup/04-legacy-tag-cleanup.mjs
```

(That script doesn't exist yet — I'll write it once Matt confirms phase 3+4
are running cleanly.)
