# FB Seller Campaign — Launch Runbook (Matt's 30-min checklist)

**Status as of 2026-05-18:** All code-side wiring is shipped to production. The ONLY remaining steps live inside Meta Ads Manager + FUB UI. Everything below is sequential and takes ~30 min total once you start clicking.

**Budget:** $20/day total (Matt's directive 2026-05-18, scaled down from playbook's $60/day default).

**Goal:** First paid seller leads landing in FUB within 48 hours of launch.

**Cross-reference:** [`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`](FB_SELLER_CAMPAIGN_PLAYBOOK.md) for the canonical strategy. This runbook is the "do this now" version.

---

## What's already wired (no action needed)

✅ **Seller LP form is end-to-end live** — `/lp/seller-home-value` fires `generate_lead` to GA4, Meta Pixel `Lead` + CAPI mirror with shared event_id, persists `valuation_requests` row in Supabase, creates FUB person with `audience:seller` + tier tag + `source:seller-lp` + `broker:matt` tags, writes 6 custom fields, assigns Matt as broker, queues canonical CMA producer via `marketing_brain_actions`, geocodes property + applies neighborhood tags.

✅ **Two emails fire on every successful submission:**
1. **Broker assignment email** (via `createCmaRequest` — goes to Matt as the assigned broker — contains lead details + CMA status)
2. **Matt always-on alert email** (via the new `lib/seller-lead-alert.ts` — contains tier badge, property, contact, UTM attribution, direct FUB link)

✅ **CMA auto-generation pipeline** — the brain producer at `marketing_brain_skills/producers/cma/SKILL.md` picks up the action row, builds a 15-page HTML CMA, renders the PDF, and emails it to the lead via `/api/cma/[slug]/email`.

✅ **WordPress event tagger live** — sister site `ryan-realty.com` fires the same GA4 events on click/scroll/form submit. Cache lag 5-15 min after AgentFire saves; verified in production HTML.

✅ **GA4 unified property** `527333348` (measurement ID `G-ST40W4WM6T`) receives data from both sites. 12 custom dimensions registered, 10 audiences defined, 3 Key events marked.

✅ **Brain reads daily at 06:30 UTC** — 199 GA4 rows + 1,648 GSC rows + 90 FUB rows over past 14 days currently flowing.

✅ **Custom audience CSVs generated** — ready to upload to Meta:
   - `out/meta-custom-audiences/suppression-2026-05-19T01-05-26-456Z.csv` (13,053 FUB people — exclude on every campaign so we don't pay to reacquire existing leads)
   - `out/meta-custom-audiences/lookalike-seed-2026-05-19T01-05-27-218Z.csv` (10,715 past sellers — seeds the Lookalike Audience)

---

## ⚠️ Account-level prerequisites Matt MUST do first

Meta blocked the campaign from being created until these complete. Per CLAUDE.md "prohibited actions" the agent can't do these.

### A. Complete Account Overview setup

Meta says: *"Confirm a few details in Account Overview so that you can publish your first ad campaign."*

1. Go to `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1933407227562419`
2. Click **Account Overview** in the left nav
3. Complete whatever Meta asks for — billing method (credit card), business name confirmation, time zone, currency. None of this is reversible without their support.

### B. Verify the FB Page + Instagram are connected to this ad account

In Account Overview:
- Connected Facebook Page: Ryan Realty
- Connected Instagram: @ryanrealtybend
- If either is missing, click "Connect" — uses your existing Meta Business Suite ID.

### C. Grant the Chrome extension permission for adsmanager.facebook.com

When you open Chrome, the Claude in Chrome extension should prompt you to approve `adsmanager.facebook.com`. Click Approve. After that the agent can drive the next steps for you on the next session.

---

## Step 1 — Upload the two custom audiences (5 min)

Both CSVs are pre-built. Meta accepts them with no column re-mapping (the script wrote Meta's exact column names).

1. Open `https://www.facebook.com/adsmanager/audiences?act=1933407227562419`
2. Click **Create Audience → Custom Audience → Customer List**
3. Upload `out/meta-custom-audiences/suppression-2026-05-19T01-05-26-456Z.csv`
4. Origin: **Directly from customers** (people who interacted directly with your business)
5. Name: **Ryan Realty FUB suppression**
6. Click **Upload and Create**
7. While that processes, click **Create Audience** again
8. Upload `out/meta-custom-audiences/lookalike-seed-2026-05-19T01-05-27-218Z.csv`
9. Origin: **Directly from customers**
10. Name: **Ryan Realty FUB past sellers**
11. Click **Upload and Create**

Meta processes each in 15-60 min. **Wait for "Audience Ready" status before Step 2.**

---

## Step 2 — Build the Lookalike Audience (3 min)

Once "Ryan Realty FUB past sellers" shows as Ready:

1. Hover the audience → Click **⋯ → Create Lookalike**
2. Audience source: Ryan Realty FUB past sellers
3. Location: **United States** (must be a country for Lookalike, then we lock geo on the ad set)
4. Audience size: **1%** (most similar)
5. Name: **LAL 1% Bend metro — past sellers**
6. Click **Create Audience**

Meta processes 4-24 hours. Move to Step 3 in parallel.

---

## Step 3 — Build the Retargeting Audience (3 min)

Pixel-based audience of visitors to the seller LP who didn't convert.

1. Audiences → Create Audience → Custom Audience → **Website**
2. Source: Meta Pixel `1546878946032105` (already firing on both sites)
3. Include: People who visited specific web pages
4. URL contains: `/lp/seller-home-value`
5. In the past **30** days
6. Exclude: People who fired a **Lead** event in the past 30 days (so we only retarget non-converters)
7. Name: **Seller LP visitors — no convert 30d**
8. Click **Create Audience**

---

## Step 4 — Create the campaign (10 min)

Settings:

| Field | Value |
|---|---|
| Objective | **Leads** |
| Special ad category | **Housing** (legally required — locks age range and detailed targeting) |
| Campaign name | `Seller — Bend metro — Q2 2026 launch` |
| Buying type | Auction |
| Budget mode | **CBO (Campaign Budget Optimization)** — daily |
| Daily budget | **$20.00** |
| Bid strategy | Lowest cost (default) |
| Schedule | Start: immediately. End: no end date |

Click **Continue** to ad sets.

---

## Step 5 — Build the two ad sets (10 min total)

CBO will distribute the $20 across them.

### Ad Set 1 — Cold + Lookalike ($14/day budget guide)

| Field | Value |
|---|---|
| Ad set name | `Cold + LAL 1% — Bend metro 25mi` |
| Performance goal | Maximize number of leads |
| Conversion location | **Website** |
| Pixel | Meta Pixel `1546878946032105` |
| Conversion event | **Lead** |
| Location | Bend, OR — radius **25 mi** (Special Ad Category locks "people who live in this area") |
| Age | 18+ (locked by Housing) |
| Audience: Include | **LAL 1% Bend metro — past sellers** |
| Audience: Exclude | **Ryan Realty FUB suppression** |
| Detailed targeting | LEAVE EMPTY — Meta's 2026 algorithm self-discovers better than manual interest targeting in Special Ad Category |
| Placements | **Manual** — Facebook Feed, Instagram Feed, Facebook Stories. **UNCHECK Audience Network** (low-quality leads). |
| Budget | CBO distributes; no per-ad-set budget |

### Ad Set 2 — Retargeting ($6/day budget guide)

| Field | Value |
|---|---|
| Ad set name | `Retargeting — seller LP visitors 30d` |
| Performance goal | Maximize number of leads |
| Conversion location | Website |
| Pixel | Meta Pixel `1546878946032105` |
| Conversion event | Lead |
| Location | Bend, OR — radius 25 mi |
| Audience: Include | **Seller LP visitors — no convert 30d** |
| Audience: Exclude | **Ryan Realty FUB suppression** |
| Placements | Manual — Facebook Feed, Instagram Feed, Facebook Stories |
| Budget | CBO distributes |

---

## Step 6 — Create the 3 ad creatives (10 min)

The destination URL is **the same for all 3** — only the creative changes. URL convention:

```
https://ryan-realty.com/lp/seller-home-value/?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-bend-metro-q2-2026&utm_content=<variant>&utm_term=<targeting>
```

Set the URL parameters in Ad Setup → URL parameters. Meta's UI accepts a single `utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-bend-metro-q2-2026&utm_content={{ad.name}}` template that auto-fills `utm_content` per ad.

### Variant A — Data hook

```
Headline:  Bend home values: what yours might be worth in 2026
Body:      The median Bend home sold for $694,900 in the last 90 days. Get a
           free instant report on what yours might be worth. No obligation,
           no follow-up unless you ask for it.
CTA:       Get quote
Image:     1080x1080 Bend home exterior with mountain backdrop (NOT staged stock).
Name:      ad-a-data-694k
URL params: utm_content=ad-a-data-694k
```

### Variant B — Question hook

```
Headline:  Wondering what your Bend home is worth right now
Body:      Bend's market sits at 4.1 months of supply with 449 active listings.
           We will send you a free valuation in under 5 minutes. No agent calls
           unless you tell us to call.
CTA:       Get quote
Image:     1080x1080 Bend home with garage/driveway visible (signals owner-occupied)
Name:      ad-b-question-4p1mos
URL params: utm_content=ad-b-question-4p1mos
```

### Variant C — Contrarian hook

```
Headline:  Why selling now might beat waiting for spring
Body:      Bend spring inventory always doubles. Lower competition right now
           means a faster sale and stronger price. See what your home might
           be worth. Free, no pressure.
CTA:       Learn more
Image:     1080x1080 Bend home with off-season light (Cascades snow on horizon)
Name:      ad-c-contrarian-spring
URL params: utm_content=ad-c-contrarian-spring
```

Put all 3 ads in **both** ad sets (Cold and Retargeting). Meta auto-picks the winner in week 1.

**Banned words in copy** (algorithm penalty + brand-voice rule):
- "stunning", "must see", "don't miss", "free consultation", "best agent in Bend", "act now"
- em-dashes, hyphens-in-prose, "delve", "leverage", "tapestry"
- Anything you wouldn't say to a neighbor at a coffee shop

---

## Step 7 — Publish + verify (5 min)

1. Review the campaign — check the budget summary shows **$20.00/day**.
2. Click **Publish**.
3. Meta enters "In review" — usually 15-60 min. Special Ad Category sometimes takes longer.
4. Once approved, the campaign auto-starts.

### Immediate verification:

1. Open `https://ryan-realty.com/lp/seller-home-value?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-bend-metro-q2-2026&utm_content=ad-a-data-694k` in **incognito**.
2. Verify the page loads + the form is visible.
3. Submit a test lead with email `test+verify@ryan-realty.com`.
4. Within 30 seconds, check:
   - **matt@ryan-realty.com inbox** — broker assignment email + Matt alert email (two separate emails, both should arrive)
   - **FUB** — new person with tags `audience:seller`, `seller:warm`, `source:seller-lp`, `broker:matt`
   - **CMA** — `app/admin/cmas` page should show a new draft row
   - **Meta Events Manager** → Test Events → see `Lead` event with eventID + `content_name: seller_lp_home_value`

If any of these don't fire, debug per the diagnostic playbook in `docs/MARKETING_ANALYTICS_PLAYBOOK.md` §7.

---

## Step 8 — FUB Automation Rule (one-time, 5 min)

For ALL seller leads (not just FB ones), set up the canonical FUB automation per `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`:

1. Open `https://ryan-realty.followupboss.com/2/admin/automations`
2. Click **+ Create Automation**
3. Trigger: **Tag added** → `audience:seller`
4. Actions:
   - Add to Action Plan: `Seller Lead — Master Workflow` (or whichever action plan you've defined for the seller cadence)
   - Optionally: Add to a Smart List "Seller Leads — Active"
5. Save + activate

This is what enrolls every seller lead in the canonical email + SMS touch cadence. FUB handles the actual sends from its own engine.

---

## Step 9 — Weekly review cadence

From here forward, follow the Monday-morning routine in `docs/MARKETING_ANALYTICS_PLAYBOOK.md` §6:

1. Brain dashboard `/dashboard/marketing` — north-star metric trend
2. GA4 → Acquisition → Traffic acquisition — leads by source
3. Meta Ads Manager — cost per Lead per ad + creative
4. FUB — new leads count + SLA hit rate
5. GSC — top organic queries
6. **One decision per week**

If the campaign hits >$50 CPL for 3 consecutive days, pause it and check the diagnostic in playbook §7.

---

## What happens automatically once a lead lands

1. **Within 30 seconds**: Matt receives 2 emails (broker assignment + always-on alert).
2. **Within 30 seconds**: FUB person created with full tag set.
3. **Within 60 seconds**: Meta CAPI Lead fired with $500 value — Meta starts learning who converts.
4. **Within 5 min** (for HOT timeline leads only): FUB realtime task fires.
5. **Within ~10 min**: Brain producer picks up the CMA action row → builds 15-page HTML + PDF.
6. **Within ~15 min**: CMA email auto-sends to the lead.
7. **24h later**: Brain's daily cron pulls the GA4 + FUB data into `marketing_channel_daily`. The cost-per-qualified-lead metric updates on `/dashboard/marketing`.

End-to-end attribution: FB ad impression → click → LP view → form submit → FUB lead → CMA delivered → brain visibility. Every step is tracked.

---

## If something goes wrong

- **No lead arriving in FUB after form submit**: server action error. Check `vercel logs` and `vercel inspect --logs <latest-deploy>` for the `[seller-lp]` warnings.
- **Email alerts not arriving**: Resend domain probably not verified yet. Check `https://resend.com/domains` — confirm `mail.ryan-realty.com` is fully verified (SPF + DKIM + DMARC green). If not, alerts still fire from `onboarding@resend.dev` as a fallback.
- **CMA doesn't generate**: brain producer not running. Manually trigger via `/api/cron/marketing-brain-dispatcher?dryRun=false`.
- **Meta Lead event not deduplicated**: shared `event_id` between browser pixel + CAPI is wrong. Check `lib/meta-pixel-helpers.ts` — verify the same eventID is passed to both.

---

## Files behind this runbook

- `lib/seller-lead-alert.ts` — always-on Matt alert
- `app/lp/seller-home-value/actions.ts` — seller LP submit handler
- `app/lp/seller-home-value/SellerLPForm.tsx` — form UI
- `lib/cma-request.ts` — CMA action row creation + broker email
- `marketing_brain_skills/producers/cma/SKILL.md` — CMA producer
- `scripts/export-fub-custom-audience.mjs` — re-run to refresh audiences (do quarterly)
- `docs/MARKETING_LEAD_FLOW.md` — path-by-path lead creation reference
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` — the canonical end-to-end pipeline doc
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` — original strategy (this runbook is the executable version)
- `docs/MARKETING_ANALYTICS_PLAYBOOK.md` — Matt-facing weekly cadence
- `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` — GA4 contract
