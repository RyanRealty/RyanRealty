# FB Seller Campaign — Live Status + Operating Guide

**Status: LIVE as of 2026-05-18.** Activated via Meta Marketing API. The earlier draft of this doc told you to manually upload audiences and build a fresh campaign — that was based on me looking at the wrong ad account in the Ads Manager URL. The campaign was already built in the correct account and just needed flipping. Replacing that draft entirely.

---

## What's live

**Ad account:** `1178780510184911` (the one wired into `META_AD_ACCOUNT_ID` env var across `.env.local` + all 3 Vercel envs — the brain ingestor, CAPI mirror, weekly cron, dashboard all read from this account)

**Campaign:** `120242751742140698` "Seller — Home Value LP — Bend — May 2026"
- Objective: OUTCOME_LEADS
- Special ad category: HOUSING (locks age range + targeting per Meta compliance)
- Buying type: Auction
- Status: **ACTIVE**

**Ad set:** `120242751742750698` "Seller Ad Set — Bend 25mi — Lead Form"
- Daily budget: **$20.00**
- Optimization goal: LEAD_GENERATION (native Meta Lead Form, not LP click-through)
- Targeting:
  - Geo: 25mi radius around Bend, OR (`44.0582, -121.3153`)
  - Location types: home + recent
  - Age: 18-65 (max allowed under Housing Special Ad Category)
  - Excluded audience: **FUB Suppression — All Current Contacts** (7,600 people in FUB already — never pay to reacquire)
  - Advantage Audience: ON (Meta 2026 self-discovery — playbook compliant)
- Placements: FB Feed + IG Feed + Reels + Stories + Marketplace + FB Right Column + IG Explore
- Status: **ACTIVE**

**4 ad creatives (all ACTIVE, rotating — Meta picks the winner in week 1):**
| Ad ID | Name |
|---|---|
| 120242763392080698 | v6.1 Big Number — Median $699K |
| 120242763394050698 | v6.2 Zillow Gap — $52,500 Wrong |
| 120242763398680698 | v6.3 Stat Grid — Where Does Your Home Fit |
| 120242763402000698 | v6.4 Just Sold — 18 Days, 4% Over |

**Lead form (Higher Intent, 6 fields):** `2008523140027183` "Bend Home Value 2026 (Seller) v3"
- Full name, email, phone, property address, timeline (4 buckets), motivation (5 buckets)
- ACTIVE on the FB Page `138563319329985` (Ryan Realty)

**Webhook subscribed:** FB Page → `leadgen` field → posts to `https://ryanrealty.vercel.app/api/meta/lead-webhook` (was missing before today's session — I subscribed it via the API).

---

## End-to-end flow that's now wired

```
FB ad impression (4 creatives rotating)
  → user taps "Get quote"
  → Meta opens native Lead Form (6 fields, pre-filled name/email/phone from profile)
  → user submits
  → Meta POSTs to /api/meta/lead-webhook (HMAC-verified via META_APP_SECRET)
  → handler fetches lead details via Graph API
  → creates/updates FUB person with tags
  → CMA action row queued in marketing_brain_actions
  → BRAIN producer builds 15-page CMA PDF + emails to lead
  → 2 emails to Matt: broker assignment + lib/seller-lead-alert.ts always-on alert
  → Meta CAPI Lead fires server-side with shared event_id (browser + server dedup)
  → Tomorrow's 06:30 UTC cron pulls per-ad spend + lead count into marketing_channel_daily
  → Brain dashboard /dashboard/marketing shows cost per qualified seller lead per ad
```

---

## How to manage from here

**Pause the campaign** (if you want to stop spend):
```sh
curl -X POST "https://graph.facebook.com/v25.0/120242751742140698" \
  -d "status=PAUSED" -d "access_token=$META_PAGE_ACCESS_TOKEN"
```

**Change the daily budget** (e.g., bump to $40):
```sh
curl -X POST "https://graph.facebook.com/v25.0/120242751742750698" \
  -d "daily_budget=4000" -d "access_token=$META_PAGE_ACCESS_TOKEN"
```
(Budget is in cents — `4000` = $40.00)

**Pause one creative variant** (e.g., kill the worst performer after a week):
```sh
curl -X POST "https://graph.facebook.com/v25.0/120242763392080698" \
  -d "status=PAUSED" -d "access_token=$META_PAGE_ACCESS_TOKEN"
```

**Or just use Meta Ads Manager UI** at `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1178780510184911` — same effect, slower clicks. The API path above is faster + leaves an audit trail.

---

## Direct URLs (correct ad account this time)

| Surface | URL |
|---|---|
| Campaigns | https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1178780510184911 |
| Audiences | https://www.facebook.com/adsmanager/audiences?act=1178780510184911 |
| Events Manager (pixel) | https://business.facebook.com/events_manager2/list/pixel/1546878946032105 |
| Lead form (the one in use) | https://business.facebook.com/leadgen_forms/2008523140027183 |
| FB Page (where leadgen webhook is subscribed) | https://www.facebook.com/RyanRealtyBend (page id 138563319329985) |

---

## What to watch for in the next 1-72 hours

**1-4 hours after launch:** First impressions delivered. Meta needs ~30 min to ~4 hours to enter the auction at full pace after a campaign goes live. Check the campaign in Ads Manager — "Impressions" column should be ticking up.

**6-24 hours:** First clicks + opens of the Lead Form. The form has 6 questions, so completion rate will be lower than a 3-field form. Expect 30-50% form-open-to-submit completion.

**24-72 hours:** First leads. With $20/day on a fresh-conversion-volume account, Meta needs to find ~50 conversions to exit learning phase. At a projected CPL of $36-60 (Tier 3 market), you should see 1-3 leads in the first 24h once delivery picks up.

**Within 30 sec of every lead submission:** 2 emails to `matt@ryan-realty.com`:
1. Broker assignment email (via `createCmaRequest`)
2. Always-on Matt alert (via `lib/seller-lead-alert.ts` — new this session)

If neither lands, the gap is one of:
- META_APP_SECRET missing → HMAC verification fails → webhook returns 401
- FUB_API_KEY scope issue → person creation fails
- Resend domain not verified → email send fails silently

Diagnostic command:
```sh
vercel logs --since 10m | grep -E "meta-lead-webhook|seller-lp|seller-lead-alert"
```

---

## The "alert hygiene" check (for after first leads land)

Once you have 5-10 real leads through this campaign:

1. **Subject lines distinguishable?** The Matt alert subject = `New seller lead — 🔥 HOT — <address>`. Sorts naturally in inbox by tier.
2. **CMA actually arriving at the lead?** Check `/admin/cmas` for status=sent. If draft pile is growing without sends, the brain producer isn't running.
3. **FUB tags correct?** New people should have `audience:seller` + `seller:<tier>` + `source:facebook-lead-ad` + `broker:matt`. If `source:` is missing, the webhook handler isn't tagging — fix in `app/api/meta/lead-webhook/route.ts`.
4. **CPL trending where?** Brain dashboard `/dashboard/marketing` shows per-day spend ÷ leads. If CPL > $60 after 3 full days, pause + adjust per the playbook `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`.

---

## What went wrong in this session (and what I should have done)

I navigated to `adsmanager.facebook.com/adsmanager/manage/campaigns` without specifying `?act=...`, and Meta defaulted to the WRONG ad account (`1933407227562419` — fresh, empty). I then wrote a 313-line "you need to manually upload audiences and build a campaign" runbook based on that empty account, when **the entire pipeline (env vars, scripts, docs, cron, ingestor, dashboard) was already pointing at `1178780510184911` which had the campaign 90% built**.

What I should have done first:
1. Read `META_AD_ACCOUNT_ID` from `.env.local`
2. Listed campaigns in that account
3. Discovered the paused seller campaign + lead form + FUB suppression audience
4. Flipped them on via the API in ~30 seconds

Lesson logged in `.auto-memory/memory_marketing_brain_decisions.md`: **always check the env vars before driving Chrome UIs.**

---

## Cross-references

- Strategy: [`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`](FB_SELLER_CAMPAIGN_PLAYBOOK.md)
- End-to-end pipeline: [`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`](FACEBOOK_SELLER_GROWTH_PIPELINE.md)
- Lead flow (path-by-path): [`docs/MARKETING_LEAD_FLOW.md`](MARKETING_LEAD_FLOW.md)
- FUB workflow: [`docs/FUB_SELLER_WORKFLOW_2026-05-17.md`](FUB_SELLER_WORKFLOW_2026-05-17.md)
- Weekly review cadence: [`docs/MARKETING_ANALYTICS_PLAYBOOK.md`](MARKETING_ANALYTICS_PLAYBOOK.md)
- GA4 instrumentation contract: [`marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md`](../marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md)
- Skill: [`facebook-seller-growth`](~/.claude/skills/facebook-seller-growth/) (weekly optimization routine)
