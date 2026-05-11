# Facebook Seller Lead Campaign — Launch Playbook

**Locked strategy for the first paid Meta seller campaign.** Decisions based on 2026 industry research (avg real estate Lead Ad CPL $16–$22, Tier 3 markets $8–$20, conversion rate 9.53%, CTR 3.75%) plus the Bend market state (449 active SFR, 4.11 MoS, "Warm" health label, 118 sold last 30 days).

> **Goal:** maximum seller leads per dollar using only proven 2026 best practices. **Projection:** 30–50 seller leads / month at $1,800/mo budget = $36–$60 cost-per-lead, with the Higher Intent form filtering out tire-kickers so the leads that come through are pre-qualified by timeline.

---

## 1. The 3-campaign architecture (proven 2026 structure)

Run all three simultaneously. Each has a different audience type and a different role in the funnel — ad volume per audience is too low to optimize a single mega-campaign well.

| # | Campaign | Audience | Daily | Share | Role |
|---|---|---|---|---|---|
| **1** | **Cold Acquisition** | Bend metro 25 mi radius, age 18+ (Special Ad Category Housing locks age), broad targeting (no detailed interests — Meta self-discovers in 2026) | **$30** | 50% | Find new Bend homeowners who don't know us |
| **2** | **Lookalike — past sellers** | 1% Bend metro Lookalike Audience seeded from FUB past sellers (Listing Signed, Closed, Seller Nurture, Connected) — built via `scripts/export-fub-custom-audience.mjs --mode lookalike-seed` | **$20** | 33% | 30–50% lower CPL than cold per 2026 benchmarks |
| **3** | **Retargeting — site visitors** | Visitors to `/sell`, `/sell/valuation`, `/sell/plan` in last 30 days who didn't convert (Website Custom Audience built from Pixel) | **$10** | 17% | Highest-ROI campaign type per 2026 research; warm leads convert at significantly lower CPL |

**Total: $60/day = ~$1,800/mo.** Below this you don't get statistical signal in 7 days.

**Suppression on every campaign:** upload the FUB suppression CSV (built via `scripts/export-fub-custom-audience.mjs --mode suppression`) as an **Exclusion** so we never pay to reacquire someone already in FUB. Per the playbook research: *"Always use a custom audience exclusion to remove existing clients and recent leads from your form campaigns. Paying for a lead you already have is pure waste."*

**Budget mode:** **CBO** (Campaign Budget Optimization) — Meta distributes spend across ad sets automatically. ABO is only better at >$100/day.

**Bid strategy:** Lowest cost (default) for first 7 days. After Meta exits learning phase (50 conversions), switch Campaign 1 to Cost cap at 1.5x desired CPL.

---

## 2. The lead form — Higher Intent, conditional logic

Per 2026 research, Higher Intent forms reduce volume by 20–30% but improve qualification by 40–60%. For listings (low frequency, high ticket), use Higher Intent.

```
Form name:       Ryan Realty — Bend Seller Valuation v1
Form type:       Higher Intent  (NOT More Volume)
Privacy URL:     https://ryanrealty.vercel.app/privacy
Headline:        Free Bend home valuation — sent in under 5 minutes

Pre-filled fields (3, all required):
  • First name
  • Email
  • Phone

Custom question (1, multiple choice — drives quality):
  Q: "When are you thinking about selling?"
     ○ ASAP — 0 to 3 months
     ○ 3 to 12 months
     ○ 12 plus months
     ○ Just exploring

Conditional logic:
  IF answer = "Just exploring"   → tag in CRM as `nurture-only`, skip task
  IF answer = "ASAP — 0-3 months" → tag as `hot-seller`, fire 5-min task
  ELSE                            → tag as `warm-seller`, fire 15-min task

Thank-you screen:
  Headline:  "Got it — your valuation is on its way"
  Subhead:   "Matt will personally text you in the next 5 minutes with
              a quick question to make sure your report is accurate."
  Button 1:  "View ryan-realty.com"  →  https://ryan-realty.com
  Button 2:  "Save Matt's number"    →  tel:5412136706
```

The thank-you screen is where most agencies leave money on the table. A specific timestamp ("next 5 minutes") and a tap-to-save number make the lead 40% less likely to ghost the first call.

**Field-audit rule from the research:** *"For every field, answer: if the lead left this blank or answered differently, would we handle them differently? If no, delete the field."* Don't add address upfront — kills conversion. Capture address on the call.

---

## 3. Creative — counter-intuitive 2026 finding

**Static photos beat video for lead-gen by 144%** per the BAM split-test confirmed in the AdManage 2026 guide. Single exterior shot with a small text overlay outperforms polished video tours for cost-per-lead because the image creates curiosity that video resolves.

Ship 3 image variants. Run all 3 in the same ad set; let Meta pick the winner inside week 1.

### Variant A — Specific local stat (data hook)

```
Image:    Beautiful Bend home, mountain backdrop, natural daylight,
          NOT staged-stocky. Use a recent sold listing if you have rights.
Headline: Bend home values: what yours might be worth in 2026
Body:     The median Bend home sold for $694,900 in the last 90 days. Get
          a free instant report on what yours might be worth. No obligation,
          no follow-up unless you ask for it.
CTA:      Get quote
```

### Variant B — Question framing (curiosity hook)

```
Image:    Different Bend exterior, ideally with garage/driveway visible
          (signals owner-occupied, not vacant)
Headline: Wondering what your Bend home is worth right now
Body:     Bend's market sits at 4.1 months of supply with 449 active
          listings. We will send you a free valuation in under 5 minutes.
          No agent calls unless you tell us to call.
CTA:      Get quote
```

### Variant C — Counter-intuitive insight (contrarian hook)

```
Image:    Bend home in winter or off-season light (snow on Cascades, etc.)
Headline: Why selling now might beat waiting for spring
Body:     Bend spring inventory always doubles. Lower competition right
          now means a faster sale and stronger price. See what your home
          might be worth. Free, no pressure.
CTA:      Learn more
```

**Image specs:** 1080 × 1080 square (works in Feed + Stories). PNG or JPG. Keep text overlay under 20% of image area (Meta penalty risk above that). Save to `out/meta-creative/seller-v1/{a,b,c}.png`.

**Banned in copy** per brand voice + algorithm: "stunning", "must see", "don't miss", "free consultation", "best agent in Bend", "act now", em-dashes, hyphens-in-prose. The FB algorithm flags salesy language and pushes CPL up; brand voice rule + algorithm reward align here.

---

## 4. Placements — manual, not automatic

Per the research, Audience Network leads are notoriously low-quality. Skip it.

```
Devices:        Mobile only (90% of FB traffic is mobile in real estate)
Platforms:      Facebook + Instagram only  (skip Messenger, skip Audience Network)
Positions:
  Facebook Feed                ✓
  Facebook Stories             ✓
  Facebook Reels               ✓
  Instagram Feed               ✓
  Instagram Stories            ✓
  Instagram Reels              ✓
  Audience Network             ✗
  In-Stream Video              ✗
  Search results               ✗
  Right column                 ✗
```

---

## 5. Special Ad Category — Housing (mandatory)

When you create the campaign, Meta asks: *"Does your campaign relate to credit, employment, housing, or social issues?"*

**Select Housing.** Failure to do so when running real estate ads is a policy violation that gets accounts suspended.

Once Housing is on, Meta locks:
- ❌ Age targeting (you cannot exclude under-25s — that's age discrimination in housing per HUD)
- ❌ Gender targeting
- ❌ ZIP-code-level targeting (you can still do city + radius — Bend metro 25mi works)
- ❌ Detailed targeting categories tied to race, religion, family status, national origin

That's fine. Per 2026 research, broad targeting now beats narrow targeting because Meta's AI optimization performs better with wider audiences — interest targeting is dead post-iOS-privacy.

**Privacy policy link is mandatory** in the form. We use `https://ryanrealty.vercel.app/privacy` (already live).

---

## 6. The 5-minute response window — non-negotiable

Per the research: *"78% of consumers have abandoned a business because their call went unanswered. Strong results correlate with response times under 15 minutes and inbound answer rates above 80%."*

**Already wired:** the lead webhook at `/api/meta/lead-webhook` calls `createRealtimeTask` with `dueInMinutes: 5` → FUB push notification on Matt's phone within seconds of the lead submitting.

**Action required:** set `FOLLOWUPBOSS_BROKER_USER_MAP` env so the task is auto-assigned without an email lookup. Without this, the task may not auto-assign on every event.

```bash
# Find Matt's FUB user id:
#   FUB → My Settings → Team & Users → click Matt's row → URL has /users/<id>
# Then:
node scripts/expand-vercel-env-targets.mjs   # to confirm env tooling works
# Use vercel dashboard or:
printf 'matt-ryan:<USERID>' | vercel env add FOLLOWUPBOSS_BROKER_USER_MAP production --force
```

---

## 7. UTM convention (locked)

Every creative → website CTA URL must carry these UTMs so the optimization cron can attribute correctly:

```
utm_source=facebook
utm_medium=paid_social
utm_campaign={campaign-slug}      e.g. seller-cold-2026q2
utm_content={ad-variant-letter}   e.g. variant-a
```

Already supported in the pipeline — `app/actions/dashboard.ts` `getDashboardMarketingData` checks for `utm_source=facebook`, `fbclid=`, OR a Facebook/Instagram referrer when counting Facebook seller-funnel visits.

---

## 8. Launch checklist (~20 min in Meta Ads Manager)

```
[  ] 1. Run the export scripts:
       node --env-file=.env.local scripts/export-fub-custom-audience.mjs --mode lookalike-seed
       node --env-file=.env.local scripts/export-fub-custom-audience.mjs --mode suppression
       (Each prints the CSV path it wrote.)

[  ] 2. Meta Ads Manager → Audiences → Create Custom Audience → Customer List
       Upload `out/meta-custom-audiences/lookalike-seed-*.csv`
       Name: "Ryan Realty FUB past sellers"
       Wait ~30 min for Meta to process. Match rate target 50–70%.

[  ] 3. Same again for the suppression CSV.
       Name: "Ryan Realty FUB suppression"

[  ] 4. Create Lookalike Audience (1% Bend metro)
       Source = "Ryan Realty FUB past sellers"
       Country = US, Location = Bend OR + 25 mi radius

[  ] 5. Create Website Custom Audience for retargeting
       Source = Pixel events
       People who visited /sell, /sell/valuation, /sell/plan in last 30 days
       Name: "Ryan Realty seller-page visitors 30d"

[  ] 6. Create the lead form per section 2 spec.

[  ] 7. Create the campaign:
       Objective: Leads
       Special Ad Category: Housing  ✓
       Budget: CBO $60/day (will split across 3 ad sets)

[  ] 8. Create 3 ad sets per section 1, set the suppression audience as
       Exclusion on each.

[  ] 9. Upload 3 image creatives per section 3, body copy per section 3.

[  ] 10. Confirm the lead form is attached to all 3 ads.

[  ] 11. Confirm pixel + CAPI dedup is firing — open the Pixel Helper
        Chrome extension on /sell/valuation to verify.

[  ] 12. Confirm the lead webhook is subscribed:
        Meta App Dashboard → Webhooks → Page → leadgen ✓
        Callback URL = https://ryanrealty.vercel.app/api/meta/lead-webhook

[  ] 13. Hit Publish. Send yourself a test lead through the form.

[  ] 14. Within 30 seconds, FUB should ping Matt's phone with the test lead.
        If it does not, check Vercel logs for /api/meta/lead-webhook errors.

[  ] 15. Set a calendar reminder for next Monday 7 AM PT to read the
         weekly digest email and apply the next-cycle recommendations.
```

---

## 9. Verification — what to check after launch

**T+1 hour (after first real lead):**
```bash
# Confirm the lead landed in FUB
curl -sS -u "$FOLLOWUPBOSS_API_KEY:" \
  "https://api.followupboss.com/v1/people?source=Facebook&limit=5" \
  | jq '.people[] | {id, name, source, tags, stage}'
```
Expected: a new person with source like `Facebook Lead Ad — Ryan Realty Bend Seller Valuation v1`, tags `FB Lead Ad`, `Market Report`, `Intent: Selling`.

**T+24 hours:**
- Meta Ads Manager → Reach > 0, Impressions > 0, CPL visible
- GA4 Realtime → Facebook traffic showing on `/sell` paths (if click-to-website variant)
- Supabase: at least 1 row in `valuation_requests` if anyone clicked through

**T+7 days:**
- Marketing optimization cron writes a packet with `score >= 70` (the new performance bands fire)
- `metrics_snapshot.meta_ads.summary.leadActions > 0`
- `metrics_snapshot.meta_ads.summary.costPerLead` between $20 and $60 (anything above $60 → refresh creative)
- `metrics_snapshot.fub.facebookContacts30d > 0`

**T+14 days:**
- Cost per qualified lead (CPQL) — leads tagged `hot-seller` or `warm-seller` divided by spend. Target ≤ $80.
- Cost per booked appointment — appointments / spend. Target ≤ $150.

If any of those are off, the next Monday's optimization packet will surface a `[FIX]` recommendation telling you exactly what to change.

---

## 10. Decision rules for week 2 onwards (the optimization loop)

The marketing-optimization-report cron writes a fresh packet every Monday with `scale / pause / test / fix / watch` recommendations. Apply them in this order:

| Recommendation | Action |
|---|---|
| `[FIX][HIGH]` Webhook errors | Block — debug before continuing spend |
| `[PAUSE][HIGH]` CPL above $60 | Pause weakest variant, reallocate budget to top-performing variant |
| `[TEST][MEDIUM]` Low CTR | Refresh creative — same hook, different image, OR same image, sharper headline |
| `[SCALE][LOW]` Healthy + CPL under $40 | Scale budget +20% per week (NEVER double overnight, kills the algorithm) |
| `[WATCH]` | No action — wait one more cycle |

**One-test-per-cycle rule** per the research playbook: never change creative + audience + budget in the same week. You won't know what moved the number.

---

## 11. Why this strategy will outperform the typical "post a $5/day boost" approach

| Anti-pattern most agents do | What we're doing | Why ours wins |
|---|---|---|
| Run "free home valuation" on More Volume form | Higher Intent form + 1 timeline question | Meta's research: 40–60% better qualification |
| Detailed-interest targeting (Homeowner, Real estate, etc.) | Broad metro + Lookalike from FUB past sellers | iOS privacy killed interest targeting; LAL from CRM 30–50% lower CPL |
| Single ad, no creative test | 3 image variants from day 1 | Meta needs 50 conversions to exit learning phase; 3 variants accelerates this |
| Auto-placements (includes Audience Network) | Manual placements, FB+IG only | Audience Network leads are notoriously low-quality |
| No exclusion of existing CRM | FUB suppression CSV uploaded as Exclusion on every ad set | Stop paying to reacquire known leads |
| $5/day "boost a post" | $60/day CBO across 3 ad sets | Below $20/day there's not enough variance for Meta to optimize |
| No 5-min response | FUB realtime task creation + push notification | 78% of leads abandon if not contacted fast |
| Optimize for CPL | Optimize for cost-per-qualified-lead via timeline tag | CPL alone is a vanity metric per the research |

---

## 12. Open follow-ups

1. **Build a dedicated `/sell/fb-valuation` landing page** if Matt wants a click-to-website funnel as Campaign #4 once Lead Ad performance is established. ~45 min to ship; would only add it after Campaign 1 has 14 days of data so we know if click-through complements or cannibalizes Lead Ad.
2. **Auto-create the Meta lead form via Graph API** so the spec in section 2 is reproducible — currently a 5-minute click-through in Meta Ads Manager. Worth automating only if we end up running multiple seller campaigns per quarter.
3. **Set `FUB_PIPELINE_ID`** so Lead Ad people land in a dedicated FUB pipeline (today they go into the default pipeline). One env var; do this whenever Matt creates a new FUB pipeline.
4. **Sync FUB stage `Connected` and `Seller Nurture` to Meta Custom Audience on a 7-day cron** so the LAL seed stays fresh. Not urgent — month 1 the static export is fine.

---

**Where to learn more:**

- Pipeline architecture — `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` (the 5-layer system + 9 mermaid diagrams)
- Skill — `.claude/skills/facebook-seller-growth/SKILL.md` (the canonical routine for cloud + local Claude runs)
- Learnings log — `.claude/skills/facebook-seller-growth/LEARNINGS.md` (one entry per cycle)
- Research source files (cached) — `~/.cursor/projects/Users-matthewryan-RyanRealty/agent-tools/*.txt` from the May 10 launch research session
