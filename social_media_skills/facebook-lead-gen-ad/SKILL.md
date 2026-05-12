---
name: facebook-lead-gen-ad
description: Create and launch Facebook Lead Generation ads with native FB lead forms that route captured leads to Follow-Up Boss (FUB) for nurture. Use this skill whenever the user requests a Facebook ad, says "make a Facebook ad for [topic]", "launch the FB ad for the market report", "boost this on Facebook" (note: redirect to lead-gen, not boost — see §1), "create a lead-gen campaign", or asks for paid social with form-based lead capture. Use this skill ALWAYS when the monthly-market-report-orchestrator routes deliverable #4. The locked default for monthly market reports is a Lead Generation ad (not boosted post, not traffic ad) because the report itself is the lead magnet — see §2 for the rationale. This skill creates the ad, attaches the form, sets targeting and budget, and surfaces it as a draft for Matt's "go" before launch.
---

# Facebook Lead-Gen Ad Skill — Ryan Realty

**Scope:** Generate Meta (Facebook + Instagram) Lead Generation ad campaigns where the market report content acts as the lead magnet. Captures leads via FB native lead form → routes to Follow-Up Boss (FUB) for nurture. Locked default for the `monthly-market-report-orchestrator` deliverable #4.

**Status:** Locked 2026-05-07 per Matt directive — Lead Generation is the default ad type for monthly market reports.

**Repo wiring:** Before proposing URLs, webhooks, UTMs, or server-side events, read **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** (live pipeline: pixel, CAPI, FUB, Supabase, weekly crons). For seller-acquisition launch specifics use **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`**.

---

## 1. When to use / when not to use

**Use this skill for:**
- Monthly market report ads (deliverable #4 from `monthly-market-report-orchestrator`)
- New listing launches that warrant paid placement
- Quarterly buyer/seller guide drops
- Email-list-building campaigns where the lead magnet is content (a report, a guide, a tool)

**Do NOT use this skill for:**
- Boosted Reels / posts (use `automation_skills/automation/buffer_poster/SKILL.md` for organic-with-paid-amplification)
- Pure traffic ads driving clicks to the website (rare for our use case — leads > clicks for residential RE)
- Retargeting campaigns (separate skill — different audience strategy)
- Awareness / brand-only campaigns (no lead capture goal)

**If the user says "boost this on Facebook":** clarify with them. Boosted posts grow reach but don't capture leads. For monthly market reports, Lead Generation is the locked default because the goal is FUB-routed lead capture. Confirm intent before defaulting to a boost.

---

## 2. Why Lead Generation, not boost or traffic

| Ad type | Why it's wrong (or right) for monthly market reports |
|---|---|
| **Boosted post** | Cheapest, highest reach. But: NO lead capture. Reach without a list-build is wasted on monthly reports — you've already built awareness, you need conversion. |
| **Traffic ad** (drive clicks to blog) | Decent for SEO + awareness. But: lead capture happens on the blog only IF the visitor opts into a popup or form. Form friction is high (typing on mobile in browser). Lead-gen ads pre-fill the form with FB profile data — near-zero friction. |
| **Lead Generation ad** (LOCKED DEFAULT) | The market report is the lead magnet. Form pre-fills with name/email/phone from the user's FB profile. They tap "Submit" once — done. Lead lands in FUB seconds later for nurture. The audience is already in market — they just watched a 30s reel about Bend real estate. Conversion rate ≈ 8–15% vs traffic ad ≈ 1–2%. |

**Rationale:** Top-of-funnel = capture intent at the moment of highest interest. The market report does the awareness lift; the ad's job is the email-capture conversion. FUB then runs the nurture (drip emails, listing alerts, eventual handoff to Matt for showings).

---

## 3. Required env vars + auth

Add to `.env.local`:
```
META_AD_ACCOUNT_ID=act_<your-ad-account-id>
META_PAGE_ID=<your-FB-page-id>                # Ryan Realty FB page
META_APP_TOKEN=<long-lived-app-access-token>
META_PAGE_TOKEN=<long-lived-page-access-token>  # already verified live per CLAUDE.md
META_FB_LEAD_FORM_TEMPLATE_ID=<form-template>   # see §5
FUB_API_KEY=<follow-up-boss-API-key>
FUB_PIPELINE_ID=<lead-pipeline-id>              # which FUB pipeline new leads enter
```

If `META_AD_ACCOUNT_ID` is missing, halt with: "Meta Ad Account ID not configured. Find it at Ads Manager → Account Overview → Account ID. Add to `.env.local` as `META_AD_ACCOUNT_ID=act_XXXXXXXXX`."

If `FUB_API_KEY` is missing, halt with: "Follow-Up Boss API key not configured. Generate at FUB → My Settings → API → Generate New Key. Add to `.env.local`."

---

## 4. Ad campaign structure

Meta Ads Manager has 3 levels: Campaign → Ad Set → Ad. The lead-gen pattern uses one of each per market report.

### 4.1 Campaign
- **Objective:** `LEAD_GENERATION`
- **Buying type:** `AUCTION` (default; reserve buys are for branding)
- **Special ad category:** `HOUSING` (REQUIRED by Meta for real estate ads — restricts age/gender/zip targeting per Fair Housing Act)
- **Name pattern:** `RR Market Report — {City} {Month YYYY} Lead Gen`

### 4.2 Ad set
- **Optimization goal:** `LEAD_GENERATION`
- **Billing event:** `IMPRESSIONS` (Meta optimizes for completions but bills per impression)
- **Daily budget:** $20–$50 default — Matt confirms per campaign
- **Schedule:** Run for 14 days from launch (covers the month's discovery window)
- **Targeting** (constrained by Housing category):
  - Geo: city + 25mi radius (e.g. Bend OR + 25mi captures Redmond, Sisters, Tumalo)
  - Age: 25–65 (Housing category enforces ≥18, no upper-age targeting nuance)
  - Gender: All
  - Detailed targeting: interests in `Real estate`, `Home buying`, `Mortgage`, `Real estate investing`. EXCLUDE: agents/brokers (interest in `Real estate agent` job role).
  - Lookalike audience: 1% lookalike based on the FUB-imported "engaged buyers" custom audience (if available — falls back to interest targeting only)

### 4.3 Ad creative
- **Format:** Video ad (the short-form vertical reel from `market-data-video/SKILL.md`)
- **Aspect:** 1:1 (1080×1080) preferred for FB feed — re-render OR center-crop the 9:16 short-form. Reels placement uses 9:16 directly.
- **Primary text** (above video, 125 chars max for in-feed):
  ```
  Bend's median home price hit $699K in April, down 13% from last year. Get the full market breakdown — neighborhoods, days on market, and what it means for buyers and sellers.
  ```
- **Headline** (below video, 27 chars max):
  ```
  Bend Market Report — April 2026
  ```
- **Description** (40 chars max):
  ```
  Free monthly market report
  ```
- **CTA button:** `LEARN_MORE` or `SIGN_UP` (test both; SIGN_UP usually wins for lead-gen)
- **Destination:** the lead form (not a website URL)

### 4.4 Lead form (the conversion mechanism)

Pre-fill these from the user's FB profile (no typing required):
- First name
- Last name
- Email
- Phone (optional but ask)

Custom question (optional — high-intent filter):
- "Are you currently in the market to buy or sell a home in Central Oregon?"
  - Yes, buying in 0–6 months
  - Yes, selling in 0–6 months
  - Both
  - Just exploring

Privacy policy URL: `https://ryan-realty.com/privacy`

Thank-you screen:
- **Headline:** "Your Bend market report is on the way"
- **Description:** "Check your inbox in the next 5 minutes. Matt Ryan, Principal Broker at Ryan Realty, will follow up personally if you indicated active intent."
- **CTA:** "Visit our website" → `https://ryan-realty.com`

---

## 5. Lead form template

Cache a Form Template ID in `META_FB_LEAD_FORM_TEMPLATE_ID` so we don't recreate the form each month. Create once via the Marketing API:

```
POST /v18.0/{page-id}/leadgen_forms
Access-Token: {META_PAGE_TOKEN}

{
  "name": "Ryan Realty Monthly Market Report",
  "follow_up_action_url": "https://ryan-realty.com/thank-you-market-report",
  "questions": [
    {"type": "FIRST_NAME"},
    {"type": "LAST_NAME"},
    {"type": "EMAIL"},
    {"type": "PHONE"},
    {
      "type": "CUSTOM",
      "key": "buy_sell_intent",
      "label": "Are you currently in the market to buy or sell a home in Central Oregon?",
      "options": [
        {"value": "buying"},
        {"value": "selling"},
        {"value": "both"},
        {"value": "exploring"}
      ]
    }
  ],
  "privacy_policy": {
    "url": "https://ryan-realty.com/privacy",
    "link_text": "Privacy Policy"
  },
  "thank_you_page": {
    "title": "Your Bend market report is on the way",
    "body": "Check your inbox in the next 5 minutes...",
    "button_text": "Visit our website",
    "button_type": "VIEW_WEBSITE",
    "website_url": "https://ryan-realty.com"
  }
}
```

Form ID returned — store in `.env.local`. Reuse across campaigns by passing the same `form_id` in each Ad's `lead_gen_form_id`.

---

## 6. FUB integration (lead routing)

Meta posts each new lead to a **Lead Ads webhook**. Wire the webhook to a Vercel API route:

```
POST https://ryanrealty.vercel.app/api/meta/lead-webhook
```

That route:
1. Verifies the webhook signature (`X-Hub-Signature-256` against `META_APP_SECRET`)
2. Fetches the lead details from `/v18.0/{lead-id}` using `META_PAGE_TOKEN`
3. Creates a contact in FUB via the FUB API:
   ```
   POST https://api.followupboss.com/v1/people
   Authorization: Basic {base64(FUB_API_KEY:)}

   {
     "firstName": "{first_name}",
     "lastName": "{last_name}",
     "emails": [{"value": "{email}", "type": "Primary"}],
     "phones": [{"value": "{phone}", "type": "Mobile"}],
     "source": "Facebook Lead Ad — Bend Market Report April 2026",
     "tags": ["FB Lead Ad", "Market Report"],
     "stage": "Lead",
     "customFields": {
       "buySellIntent": "{buy_sell_intent}",
       "campaign": "{campaign-name}"
     }
   }
   ```
4. Triggers FUB's drip campaign for new market-report leads

**Webhook config in Meta:** App Dashboard → Webhooks → Page → subscribe to `leadgen` field. Set callback URL to the Vercel route. Verify on first save.

---

## 7. Generation flow (when called by orchestrator)

1. **Receive video + copy from orchestrator** — the `monthly-market-report-orchestrator` provides:
   - The short-form video MP4 (re-cropped to 1:1 if needed)
   - The headline stat (e.g. "$699K median, down 13.4%")
   - The verification trace
   - The blog post URL (for the thank-you screen + post-form follow-up)

2. **Generate ad copy** (per §4.3 patterns) — primary text, headline, description, CTA. Run through banned-word grep.

3. **Upload video** to Meta:
   ```
   POST /v18.0/{ad-account-id}/advideos
   ```

4. **Create campaign** (per §4.1 spec).

5. **Create ad set** (per §4.2 spec) — under the campaign just created.

6. **Create ad creative** (per §4.3 spec) — using the uploaded video ID + lead form ID.

7. **Create ad** — under the ad set, attached to the creative.

8. **Set status to PAUSED** initially (Meta default for new ads is ACTIVE — explicitly set PAUSED).

9. **Surface to Matt** — preview URL:
   ```
   https://www.facebook.com/ads/manager/creation/creation/?act={ad-account-id}&campaign_id={campaign-id}&ad_set_id={adset-id}&ad_id={ad-id}
   ```
   And a copy-only preview for the inline review:
   ```
   📢 Facebook Lead-Gen Ad — DRAFT (paused)

   Campaign: RR Market Report — Bend April 2026 Lead Gen
   Daily budget: $30
   Run length: 14 days
   Audience: Bend OR + 25mi, age 25-65, real estate interest
   
   Primary text:
   "{primary_text}"
   
   Headline: {headline}
   CTA: SIGN_UP → opens lead form
   
   Form fields: First name, Last name, Email, Phone, Intent (buy/sell/both/exploring)
   
   On approval: status PAUSED → ACTIVE, leads route to FUB pipeline {pipeline-id}.
   ```

10. **On Matt's "go"** — flip to ACTIVE:
    ```
    POST /v18.0/{ad-id}
    {"status": "ACTIVE"}
    ```
    Same for the ad set and campaign.

11. **Confirm to Matt** — campaign live, daily spend cap set, leads will route to FUB starting now.

---

## 8. Pre-launch QA checklist

Before flipping PAUSED → ACTIVE:

- [ ] Campaign objective = `LEAD_GENERATION` (NOT engagement, traffic, awareness)
- [ ] Special ad category = `HOUSING` (Fair Housing Act compliance)
- [ ] Daily budget set + total budget cap if specified
- [ ] Run length defined (default 14 days)
- [ ] Geo targeting = correct city + 25mi radius
- [ ] Age range = 25–65 (or as specified)
- [ ] Lead form attached + has all required fields (first/last/email/phone/intent)
- [ ] Privacy policy URL valid (`https://ryan-realty.com/privacy`)
- [ ] Thank-you screen text approved
- [ ] FUB webhook configured + verified
- [ ] Video uploaded (1:1 or 9:16 — Meta auto-handles cross-placement)
- [ ] Ad copy passes banned-word grep
- [ ] Banned-word grep on lead form copy too
- [ ] Status currently PAUSED — DON'T flip to ACTIVE without Matt's "go"

---

## 9. Reporting (post-launch)

After campaign runs for 7 days, surface metrics to Matt:

- Impressions
- Reach
- Cost per result (CPL)
- Total leads captured
- Lead → FUB sync rate (should be 100%)
- Intent breakdown (buying / selling / both / exploring)
- Top-performing audience segment (if multiple ad sets)

Use Meta Marketing API insights endpoint:
```
GET /v18.0/{campaign-id}/insights?fields=impressions,reach,cost_per_result,actions
```

Surface in a one-line summary:
```
📊 Bend Market Report Lead Gen — Day 7
   Spend: $210 / $420 budget (50%)
   Leads: 28 captured (avg CPL $7.50)
   Intent: 9 buying / 6 selling / 3 both / 10 exploring
   Top segment: Bend 25mi + age 30-45 + interest "real estate" — CPL $5.20
```

---

## 10. Broker headshots in ad creative

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.jpg` — Matt Ryan (owner / principal broker)
- `paul-stevenson.jpg` — Paul Stevenson
- `rebecca-peterson.jpg` — Rebecca Peterson

All 800×1200 px, pure white bg, identical head height, natural color. Specs in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Agent-face creative guidance:** For listing-specific lead-gen ads, test an agent-face creative variant alongside the property-photo version. Agent-face ads (broker headshot + listing address as text overlay, no photo of the home) frequently outperform property-only creatives for lead capture because they signal a real person is on the other end. Resolve the listing agent from `ListAgentFullName` in the Supabase `listings` row and use that broker's headshot. For brand-led campaigns (monthly market report, buyer/seller guide), omit the individual headshot — use the Ryan Realty logo from `design_system/ryan-realty/assets/brand/logo-blue.png`.

---

## 11. See also

- `video_production_skills/monthly-market-report-orchestrator/SKILL.md` — the orchestrator that calls this skill
- `video_production_skills/market-data-video/SKILL.md` — the short-form video this ad uses + canonical data dictionary
- `video_production_skills/media-sourcing/SKILL.md` — image / video sourcing decision tree (the ad re-uses the short-form video, so any media decisions cascade from there)
- `social_media_skills/blog-post/SKILL.md` — the blog post the lead receives in the thank-you email
- `automation_skills/automation/publish/SKILL.md` — sister skill for organic publishing (this skill is the paid counterpart)
- `automation_skills/automation/engagement_bot/SKILL.md` — handles inbound DMs / comments from the ad
- Meta Marketing API: https://developers.facebook.com/docs/marketing-api
- Meta Lead Ads: https://developers.facebook.com/docs/marketing-api/guides/lead-ads
- Follow-Up Boss API: https://docs.followupboss.com/
- Fair Housing Act compliance: https://www.facebook.com/business/m/special-ad-categories
