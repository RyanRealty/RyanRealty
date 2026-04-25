# Ryan Realty — Master Spec

_Single source of truth for the website rebuild. Every coding agent reads section 0 + their assigned section before doing anything._

_Generated: 2026-04-25 · Launch target: 2026-07-01 (9 weeks) · Reference quality: compass.com_

---

## Table of Contents

0. [Status & Changelog](#0-status--changelog)
1. [Mission & Monetization](#1-mission--monetization)
2. [Audience & Personas](#2-audience--personas)
3. Data Inventory & Exposure Strategy _(batch 2)_
4. Information Architecture _(batch 2)_
5. Public Pages _(batch 2)_
6. User Dashboard _(batch 3)_
7. Admin Dashboard _(batch 3)_
8. Component Inventory _(batch 3)_
9. Technical Architecture _(batch 3)_
10. Integrations _(batch 3)_
11. Monetization Implementation _(batch 4)_
12. SEO Strategy _(batch 4)_
13. Performance, A11y, Security, Compliance _(batch 4)_
14. Operations & Runbooks _(batch 4)_
15. Definition of Done _(batch 4)_
16. Build Plan _(batch 4)_
17. Skill Catalog & Guardrails _(batch 4)_

---

## Open Questions

_Updated by every batch. Anything unresolved goes here with a recommendation pending Matt's input._

1. **Design token reconciliation** [discovery 01: Conflicts → Design source of record]: Matt uploaded a `Ryan Realty Design System-handoff.zip` that contains visual brand tokens. Those tokens need to be reconciled with the existing `app/globals.css` CSS custom properties before any UI build begins. **Question for Matt:** which values in the handoff ZIP (colors, radii, type scales) supersede the current `globals.css` values? Recommendation — treat the handoff ZIP as authoritative and update `globals.css` to match before a single component is built.

2. **`entity_media` migration status** [discovery 01: Conflicts → Video delivery architecture]: The unified `entity_media` polymorphic table for all entity media (cities, communities, neighborhoods, brokers, listings, blogs) was proposed and approved in a design session but its migration status in the hosted Supabase project is unconfirmed. **Question for Matt:** has the `entity_media` migration been applied to `dwvlophlbvvygjfxcrhm`? This determines whether batch 2's data inventory section can document it as live or planned. Recommendation — run `SELECT table_name FROM information_schema.tables WHERE table_name = 'entity_media'` against the project to confirm.

3. **Display ads — RESOLVED.** Google AdSense for on-site display ad revenue at MVP. Facebook Audience Network as potential supplement (evaluate at launch). Wave-2: Mediavine when monthly sessions clear ~50K. NO native sponsorship, NO preferred lenders, NO title companies, NO mortgage brokers — Matt corrected the model 2026-04-25. Slot inventory and placement rules codified in section 1.4.3. Paid traffic acquisition via Google Ads + Facebook Ads documented in section 1.4.4 — separate from on-site monetization. [chat 2026-04-25]

4. **Median Bend sale price for revenue math** [CLAUDE.md: Data Accuracy]: The revenue math in section 1.3 uses an estimated Bend median sale price. Per the data accuracy rule, this figure must be verified against a Supabase query (`ryan-realty-platform`, `listings` table, `PropertyType='A'`, `City='Bend'`, `CloseDate` in the trailing 12 months, `median(ClosePrice)`) before the number appears on any consumer-facing surface. **Not a blocker for the spec itself** — it is marked ESTIMATE here — but it must be resolved before section 3 (Data Inventory) ships.

5. **FUB seller vs. buyer routing** [discovery 01: Lead Routing & FUB]: The FUB custom fields include `is_seller_curious` but the spec does not yet define the routing rule that separates seller leads from buyer leads in the CRM pipeline. **Question for Matt:** when a lead submits a home valuation form, which FUB pipeline stage do they enter, and who is notified first? This needs to be codified before the lead-capture forms are built in batch 2/3.

---

## Executive Summary

Ryan Realty is a Bend, Oregon residential brokerage owned by principal broker Matt Ryan. The website rebuild, targeting a July 1, 2026 launch, is the keystone in a three-channel system: website + YouTube + IG/TikTok. The site's job is to convert anonymous visitors into verified leads and then into closed transactions.

**The goal.** Generate $1,000,000 in gross commission income within the first year after launch. At 2.75% average commission on a ~$750K median Bend sale (ESTIMATE — verify before any consumer surface), that requires approximately 48 closings per year, or 4 per month. The math works if the site delivers 40–80 qualified leads per month — a realistic target for a well-executed local brokerage site with a social media feed driving traffic.

**The moat.** No Bend competitor has all of the following: (1) a branded video market report series backed by live Supabase data, (2) lifestyle/outdoor recreation proximity overlays on the search map, (3) behavioral CRM tracking that fires personalized listing alerts based on what a lead actually viewed, and (4) Compass-caliber visual design. Matt has the infrastructure for all four. The build plan locks these in as MVP differentiators, not phase-2 aspirations.

**The MVP scope.** The public site launches July 1 with: homepage (social-media-feed vertical scroll on mobile), IDX search with map + lifestyle overlays, listing detail pages, neighborhood/community hub pages for all 11 service areas, home valuation tool, market reports hub, "Moving to Bend" relocation hub, agent profile, and blog. Every page ships with schema markup, LCP < 2.5s, and Lighthouse SEO 90+.

**The critical fixes before building.** The existing UI is being discarded entirely [discovery 01: UI rebuild scope]. The backend database is solid — Supabase, Spark API sync, FUB CRM, and all data pipelines are confirmed working [discovery 01: Data Architecture]. The rebuild starts from a clean design system using shadcn/ui radix-nova tokens derived from the Ryan Realty brand handoff ZIP, mapped onto `app/globals.css`.

**Three revenue streams.** (1) Seller commissions — highest value per transaction; driven by the home valuation tool and market reports. (2) Buyer commissions — higher volume, longer cycle; driven by IDX search and behavioral alerts. (3) Display ad revenue — Google AdSense at MVP with standard IAB slots on informational pages only (blog, neighborhood hubs, market hub); lazy-loaded, no above-fold or lead-capture surfaces. Wave-2 migration to Mediavine when monthly sessions clear ~50K. [chat 2026-04-25]

**The timeline.** 9 weeks to launch (2026-04-25 to 2026-07-01). The spec must be 100% complete before a single component is built [discovery 01: page/feature decisions]. Batch 2 covers data inventory, IA, and public page specs. Batch 3 covers dashboards and components. Batch 4 covers implementation, SEO, performance, and the build plan.

**The reference.** compass.com is the execution quality bar. Cascade Hasson Sotheby's International Realty (cascadehasson.com) is the local competitor to beat [Matt 2026-04-25].

**The rule that outranks everything else.** Every number published on any surface — a listing price, a market stat, a median DOM, a YoY percentage — must be traced to a live Supabase query or named primary source with row count, date window, and filter documented. No estimates ship to consumers. No exceptions [CLAUDE.md: Data Accuracy].

**The design constraint.** shadcn/ui is the only component library. No raw HTML elements. No custom CSS classes. All color via design tokens only. `cn()` from `@/lib/utils` for all class merging [CLAUDE.md: Design System Rules].

**The workflow constraint.** All code lands on `main`. No branches. Push to origin immediately after every commit. Matt never touches a terminal [CLAUDE.md: Work Standards, discovery 01: Workflow & Git Rules].

---

## 0. Status & Changelog

### 0.1 Version

**v0.1 — Batch 1 of 4 complete.** Sections 0, 1, and 2 drafted. Sections 3–17 pending.

Generated: **2026-04-25**
Last updated: **2026-04-25**
Author: Claude Code (Sonnet 4.6) under Matt Ryan direction

### 0.2 Spec status table

| Section | Title | Status | Batch |
|---|---|---|---|
| 0 | Status & Changelog | Drafted | 1 |
| 1 | Mission & Monetization | Drafted | 1 |
| 2 | Audience & Personas | Drafted | 1 |
| 3 | Data Inventory & Exposure Strategy | Pending | 2 |
| 4 | Information Architecture | Pending | 2 |
| 5 | Public Pages | Pending | 2 |
| 6 | User Dashboard | Pending | 3 |
| 7 | Admin Dashboard | Pending | 3 |
| 8 | Component Inventory | Pending | 3 |
| 9 | Technical Architecture | Pending | 3 |
| 10 | Integrations | Pending | 3 |
| 11 | Monetization Implementation | Pending | 4 |
| 12 | SEO Strategy | Pending | 4 |
| 13 | Performance, A11y, Security, Compliance | Pending | 4 |
| 14 | Operations & Runbooks | Pending | 4 |
| 15 | Definition of Done | Pending | 4 |
| 16 | Build Plan | Pending | 4 |
| 17 | Skill Catalog & Guardrails | Pending | 4 |

### 0.3 Build wave assignments

_Placeholder. Wave assignments are spec'd in section 16 (batch 4). Each wave maps sections to a build agent with ownership and acceptance criteria._

| Wave | Sections covered | Status |
|---|---|---|
| Wave 1 — Foundation | 9 (tech arch) + 8 (components) + 3 (data) | Pending batch 4 |
| Wave 2 — Public pages | 4 (IA) + 5 (public pages) | Pending batch 4 |
| Wave 3 — Dashboards | 6 (user) + 7 (admin) | Pending batch 4 |
| Wave 4 — Monetization + SEO | 11 + 12 + 13 | Pending batch 4 |
| Wave 5 — Launch ops | 14 + 15 | Pending batch 4 |

### 0.4 Changelog — last 10 entries

| Date | Version | Author | Change |
|---|---|---|---|
| 2026-04-25 | v0.1 | Claude Code / Matt Ryan | Initial creation. Sections 0, 1, 2 drafted. Open questions populated. Exec summary written. |
| 2026-04-25 | v0.1.1 | Claude Code / Matt Ryan | Monetization model corrected per Matt: Google AdSense + Facebook Audience Network for on-site display ad revenue; Google Ads + Facebook Ads for paid traffic acquisition (cost, not revenue); native sponsorship / preferred lenders / title companies / mortgage brokers removed throughout. Sections 1.4.3 rewritten, section 1.4.4 added, section 1.3 revenue math updated, exec summary updated, Open Questions item 3 updated in both batch 1 and batch 2 lists. [chat 2026-04-25] |
| — | — | — | _(entries 3–10 will be added as batches are written and sections are reviewed/locked)_ |

### 0.5 Critical reference paths

| Resource | Path |
|---|---|
| This spec | `/Users/matthewryan/RyanRealty/docs/MASTER_SPEC.md` |
| Prior decisions (65 locked) | `/Users/matthewryan/RyanRealty/docs/discovery/01-prior-decisions.md` |
| Competitor teardown | `/Users/matthewryan/RyanRealty/docs/discovery/06-competitor-teardown.md` |
| Design system skill | `/tmp/ryan-design-extract/ryan-realty-design-system/project/SKILL.md` |
| Design system CSS | `/tmp/ryan-design-extract/ryan-realty-design-system/project/colors_and_type.css` |
| Brand assets | `/tmp/ryan-design-extract/ryan-realty-design-system/project/assets/` |
| Agent rules | `/Users/matthewryan/RyanRealty/CLAUDE.md` |
| FUB custom fields | `/Users/matthewryan/RyanRealty/docs/FUB_CUSTOM_FIELDS.md` |
| FUB setup | `/Users/matthewryan/RyanRealty/docs/FOLLOWUPBOSS-SETUP.md` |
| Auth & CRM | `/Users/matthewryan/RyanRealty/docs/AUTH_AND_CRM.md` |
| Data architecture plan | `/Users/matthewryan/RyanRealty/docs/plans/data-architecture-plan.md` |
| Master plan (gaps/waves) | `/Users/matthewryan/RyanRealty/docs/plans/master-plan.md` |
| Cross-agent handoff | `/Users/matthewryan/RyanRealty/docs/plans/CROSS_AGENT_HANDOFF.md` |
| Supabase project ID | `dwvlophlbvvygjfxcrhm` |
| Production URL | `ryanrealty.vercel.app` → `ryan-realty.com` |

### 0.6 Hard rules for build agents

Every agent who touches this codebase must internalize these rules before writing a single line. They are not suggestions.

**Read first.** Read section 0 and your assigned section before doing anything. Do not read other sections unless your work explicitly depends on them. Do not infer requirements — read them.

**Data accuracy is non-negotiable.** Every number that appears on a consumer-facing surface must trace to a live Supabase query, an MLS direct pull, or a named primary-source URL. Print the raw query result. Show row count, date window, and filter. Derived stats (medians, YoY %, months of supply) must be shown with the computation. If a stat cannot be verified in the current session, it does not ship. No exceptions. [CLAUDE.md: Data Accuracy]

**Brand voice.** Sentence case for headings (hero H1 is Title Case only). No emoji. No real-estate clichés. No meta-tone words (passionate, premier, luxury, boutique). Specificity creates trust — neighborhoods, not "the area"; dollar amounts, not "competitively priced." Tabular numerals for every price, count, and day range. [brand-skill SKILL.md]

**Design system.** shadcn/ui components only from `@/components/ui/`. Color via design tokens only (no hex, no Tailwind color names). `cn()` from `@/lib/utils` for all class merging. No `card-base`, `btn-cta`, or any custom CSS class. [CLAUDE.md: Design System Rules]

**Verification before "done."** A task is not done until the rendered output is verified. For UI changes, provide a production Vercel URL with visible screenshot confirmation that the feature works. For data changes, print the query result. Never say something is done without confirming it.

**Git workflow.** Push directly to `main`. No branches. Push to `origin main` immediately after every commit. Remove `.git/index.lock` proactively before any git operation. Never ask Matt to run anything.

---

## 1. Mission & Monetization

### 1.1 Mission

Ryan Realty's mission is to build community through authentic relationships and exceptional customer service. [brand-skill SKILL.md: Extended promise, verbatim]

Tagline: **"It's About Relationships."** — a signature line used with the wordmark, not scattered through body copy. [brand-skill SKILL.md: Content rules]

Matt Ryan is an Oregon principal broker who has made the specific choice to operate a locally-rooted brokerage in Central Oregon, where he knows the market, the neighborhoods, the builders, and the communities by name. The website reflects that specificity. It is the local authority for real estate in Central Oregon — not a franchise template, not a portal affiliate, not an algorithm. [discovery 01: Brand Voice & Style; brand-skill SKILL.md: Voice]

The editorial north star for every page, every headline, and every piece of copy on the site is this: **honesty over hype, data over adjectives, and relationships over transactions.** A page that says "Median sale in NW Crossing last month: $895k, 38 days on market" does more trust-building work than a page that says "Discover stunning luxury homes in one of Bend's most sought-after neighborhoods." The latter will not appear on this site.

Brand voice attributes: honest, transparent, trustworthy, direct, kind, optimistic, and locally specific. [discovery 01: Brand Voice & Style] The brand explicitly prohibits: "stunning," "nestled," "boasts," "exquisite," "unparalleled," "world-class," "don't miss," "won't last," "must see," "once in a lifetime," "exclusive," "hot market," "now is the time to buy/sell," "dream home," "passionate," "premier," "luxury," "boutique," "concierge," "white-glove." [discovery 01: Brand Voice & Style, blog-voice.mdc]

### 1.2 What we sell

The website generates revenue through four mechanisms. A fifth (vendor marketplace) is acknowledged as a future possibility but is explicitly out of MVP scope.

**1. Buyer representation.** Matt represents buyers under a buyer agency agreement. Commission is paid by the seller at close, typically 2.5–3% of the sale price. The website's job is to produce buyer leads: visitors who register, save homes, request tours, and eventually sign a buyer agreement.

**2. Seller representation (listing).** Matt represents sellers with a listing agreement. Commission is typically 2.5–3% of the sale price, paid from proceeds at close. The website's job is to produce seller leads: homeowners who request a valuation, subscribe to market reports, or contact Matt directly to discuss listing their home. Seller leads are the highest-value lead category per transaction.

**3. Lead generation for the brokerage pipeline.** Both buyer and seller leads flow through Follow Up Boss (FUB) as the CRM of record. The website fires FUB events: Registration, Viewed Property, Viewed Page, Saved Property, Property Inquiry, Visited Website (return visit after 24h+). [discovery 01: Lead Routing & FUB] Lead scoring uses behavior-based points with weekly decay; lead tiers are cold, warm, hot, very_hot. [discovery 01: Lead Routing & FUB, FUB_CUSTOM_FIELDS.md]

**4. Display ad revenue (Google AdSense at MVP).** Matt identified display ads as a third revenue stream [Matt 2026-04-25; discovery 01: Monetization]. The correct model is Google AdSense with standard IAB display slots on informational pages, lazy-loaded, with reserved ad space so CLS = 0. Facebook Audience Network (FAN) is a potential supplementary channel at launch, primarily for mobile; evaluate at launch. Wave-2 path: when monthly sessions reach the Mediavine threshold (~50K), migrate from AdSense to Mediavine for higher CPMs. NO native sponsorship, NO preferred lenders, NO title companies, NO mortgage brokers — Matt corrected the model 2026-04-25. See section 1.4.3 for slot inventory and placement rules. [chat 2026-04-25]

**5. Future: premium content, mortgage referrals, builder partnerships.** These are out of MVP scope. Mortgage referrals are explicitly deferred pending lender partnership agreements. Builder partnerships (new construction featured inventory) are a phase-2 build. Premium content (gated market reports, subscriber tiers) is a phase-2 consideration. [discovery 01: Monetization, PRODUCT_SPEC_V2.md]

### 1.3 Revenue math — $1M GCI by year 1

The $1,000,000 GCI target is the stated goal for the first year post-launch. [Matt 2026-04-25]

**Core equation:**

GCI target: $1,000,000
Average commission rate: 2.75% (midpoint of 2.5–3% range stated by Matt) [Matt 2026-04-25]
Implied closed transaction volume: $1,000,000 ÷ 0.0275 = **$36,363,636** in closed sales

**What that means in transactions:**

Bend median sale price (ESTIMATE — verify against Supabase `listings` table, `PropertyType='A'`, `City='Bend'`, trailing 12-month `CloseDate`, `median(ClosePrice)` before this figure appears on any consumer surface): approximately $750,000

Transactions needed at $750,000 median: $36,363,636 ÷ $750,000 = **48.5 closings per year, or ~4 per month**

At a lower median of $650,000 (ESTIMATE — same verification requirement): $36,363,636 ÷ $650,000 = **55.9 closings per year, or ~5 per month**

These are total-side closings (buyer-side + seller-side each count as one closing). A single transaction where Matt represents both sides = 2 closings × 2.75% = 5.5% total GCI on the transaction. Double-sided transactions are not the plan — they are a bonus when they happen.

**Funnel math from site traffic to closings:**

Industry conversion benchmarks [NAR and Inman research; ESTIMATE — no single source; use as planning ranges only]:

- Visitor → registered lead: 1.0–3.0% (median: ~1.5%)
- Registered lead → qualified lead (contacts agent, schedules tour, or submits valuation): 10–20% of registered leads
- Qualified lead → signed agreement (buyer or listing): 15–30% over 12 months
- Signed agreement → closed transaction: 70–85% (attrition from contingencies, financing fallout, etc.)

Working the funnel backward from 48 closings per year:

```
Target: 48 closings/year
÷ 0.75 (close rate on signed agreements)        = 64 signed agreements/year
÷ 0.22 (midpoint agreement rate on qualified)   = 291 qualified leads/year → ~24/month
÷ 0.15 (midpoint qualified rate on registered)  = 1,942 registered leads/year → ~162/month
÷ 0.015 (1.5% visitor-to-register conversion)   = 129,467 sessions/year → ~10,789/month
```

At 1.0% conversion (conservative): ~194,182 sessions/year (~16,182/month)
At 3.0% conversion (optimistic): ~64,727 sessions/year (~5,394/month)

**Conclusion:** The operational targets from section 1.6 (40–80 qualified leads per month) map directly to this math. The existing PRODUCT_SPEC_V2.md target of 50+ qualified leads/month within 6 months of launch [discovery 01: SEO & LLM Positioning] is consistent with the revenue model. Social and YouTube traffic supplements organic search; paid retargeting supplements both. The site does not need 100K+ sessions/month on day one — it needs high-intent traffic, well-converted.

**Ad revenue contribution (Google AdSense display model):**

At 50,000 monthly sessions × 2 pages/session × 2 ad impressions/page × $6 AdSense eCPM = ~$1,200/month = **$14,400/year** at the Mediavine threshold. At wave-2 Mediavine rates (~$15–$20 RPM on a real-estate audience), 120,000 monthly sessions projects to **~$36,000/year**. This is supplemental revenue, not the primary funder of operations — it does not materially change the commission math. It does cover a meaningful share of hosting, tooling, and content-production overhead. NO native sponsorship, NO preferred lenders, NO title companies — Matt corrected the model 2026-04-25. [chat 2026-04-25]

### 1.4 Three monetization streams — detail each

#### 1.4.1 Seller leads

**How money flows.** A homeowner discovers the site (via organic search for their address, via a YouTube market report video, via an IG post, or via a neighbor referral), visits the home valuation tool, enters their address, and receives an estimate. They leave their email to get the full report. Matt receives a FUB alert. Over the next days/weeks, the homeowner receives market update emails. When they are ready to discuss listing, Matt converts the lead to a listing agreement. At close, Matt collects the listing-side commission: 2.5–3% of the sale price.

**Average value per qualified seller lead** (ESTIMATE — verify against Matt's actuals from past 12 months in FUB or closed transaction records before using in any reporting):

At $750,000 median sale, 2.75% commission: $20,625 per closed listing
At $650,000 median sale, 2.75% commission: $17,875 per closed listing

If 20% of qualified seller leads convert to a signed listing agreement, and 80% of those close: effective value per qualified seller lead = $20,625 × 0.80 × 0.20 = **$3,300 per qualified seller lead** (ESTIMATE — calibrate with Matt's actual conversion rates).

**Conversion funnel mapped to features:**

| Funnel stage | Site feature | FUB event fired |
|---|---|---|
| Discovery | Home valuation tool (any page, floating CTA), "What's my home worth?" search landing page, neighborhood market report pages | — |
| Lead capture | Valuation form (name + email + phone + address + best time to call) | Registration (if new), Property Inquiry (if address submitted) |
| Lead nurture | Monthly market report email (automated via Resend, phase 4), personalized equity update, "see buyer demand for your address" (phase 2) | Visited Website (return) |
| Conversion to consult | "Schedule a call" CTA in nurture emails and on seller-specific landing page | — |
| Listing agreement | FUB pipeline: Lead → Prospect → Active Listing | — |
| Close | FUB pipeline: Active Listing → Closed | — |

**KPIs for seller pipeline:**

- Valuation tool starts per month (target: 30+)
- Valuation tool completions per month (target: 20+; completion rate target: 65%)
- Seller-form submissions per month (target: 10–15)
- Seller lead → listing agreement conversion rate (ESTIMATE target: 15–25%)
- Listing agreement → close rate (ESTIMATE target: 80%+)
- Average listing GCI (ESTIMATE: $18,000–$22,000 per closed listing at current Bend prices)

**12-month targets (year 1):** 24 closed listings. At $750K median: $20,625 × 24 = **$495,000 in listing-side GCI**. This is half the $1M target, sourced entirely from seller leads.

#### 1.4.2 Buyer leads

**How money flows.** A buyer discovers the site (via search, social, YouTube, or referral), browses listings, saves a search, and registers to get listing alerts. When a listing they've been watching drops in price or a new matching home hits the market, they receive an automated alert (via FUB + email, phase 4). They request a tour. Matt shows the home. The buyer signs a buyer agency agreement. At close, Matt collects the buyer-side commission: 2.5–3% of the purchase price, paid by the seller.

**Average value per qualified buyer lead** (ESTIMATE — verify against Matt's actuals):

At $750,000 median purchase, 2.75% commission: $20,625 per closed buyer transaction
If 20% of qualified buyer leads close (over 12-month cycle, industry midpoint): effective value per qualified buyer lead = $20,625 × 0.20 = **$4,125 per qualified buyer lead** (ESTIMATE).

Note: buyer lead cycle is longer than seller lead cycle (6–18 months from first contact to close for relocators). Lead scoring decay and engagement scoring in FUB are critical to maintaining pipeline quality over that window. [discovery 01: Lead Routing & FUB, FUB_CUSTOM_FIELDS.md: `engagement_streak_days`, `last_active_date`]

**Conversion funnel mapped to features:**

| Funnel stage | Site feature | FUB event fired |
|---|---|---|
| Discovery | IDX search (map + list), neighborhood hub pages, "Moving to Bend" relocation hub, blog posts, YouTube/IG CTA landing pages | Viewed Page |
| Engagement | Listing detail page view (photos, facts, map, similar listings), mortgage calculator | Viewed Property |
| Lead capture | Saved search registration (email gate after 5 free listing views), listing alert signup, "Schedule a tour" button on listing detail | Registration, Saved Property |
| Nurture | Automated listing alerts (email, phase 4; SMS alert, phase 2), price-reduction notifications, new-match alerts | Visited Website (return) |
| Conversion to tour | Tour scheduling (Calendly embed or custom calendar on listing detail page), "Contact Matt" form | Property Inquiry |
| Buyer agreement | FUB pipeline: Lead → Prospect → Active Buyer | — |
| Close | FUB pipeline: Active Buyer → Closed | — |

**KPIs for buyer pipeline:**

- IDX search sessions per month (target: 5,000+ by month 6)
- Search-to-registration rate (target: 3–5% of search sessions)
- Saved searches per month (target: 50+ by month 6)
- Save-to-tour-request rate (target: 5–10%)
- Tour-to-buyer-agreement rate (ESTIMATE target: 40–60%)
- Buyer agreement-to-close rate (ESTIMATE target: 70–80%)
- Average buyer-side GCI (ESTIMATE: $18,000–$22,000 per closed transaction at current prices)

**12-month targets (year 1):** 24 closed buyer transactions. At $750K median: $20,625 × 24 = **$495,000 in buyer-side GCI**. Combined with seller GCI: $990,000 — within range of the $1M target. The remaining $10K+ comes from AdSense display ad revenue or a single additional closing.

**Note on buyer-side commission disclosure.** Oregon law requires buyer agency agreement disclosure. The buyer registration flow must include proper disclosure language. This is a compliance requirement, not a preference [CLAUDE.md: Compliance context; Oregon real estate licensing rules].

#### 1.4.3 Display ad revenue (Google AdSense at MVP)

Matt corrected the monetization model on 2026-04-25. The site runs Google AdSense display ads — NO native sponsorship, NO preferred lenders, NO title companies, NO mortgage brokers anywhere on the site. [chat 2026-04-25]

**Ad provider selection — launch.**

- **Google AdSense** is the primary provider at MVP. Standard IAB display units. All units are lazy-loaded with reserved space (CLS = 0). Setup is straightforward: AdSense account linked to domain, auto-ads disabled, manual placements only per the slot inventory below.
- **Facebook Audience Network (FAN)** is a potential supplementary provider at launch. Caveat: FAN has limited desktop web inventory; it is primarily effective on mobile. Evaluate at launch — integrate only if FAN fill rate on mobile justifies the additional SDK weight.
- AdSense eCPM for real-estate content typically runs $4–$8. The math at 50,000 sessions: 50,000 sessions × 2 pages/session × 2 impressions/page × $6 eCPM = ~$1,200/month = **$14,400/year**. Supplemental, not primary.

**Wave-2 migration path.** When monthly sessions reach the Mediavine threshold (~50,000), migrate from AdSense to Mediavine on blog and informational-content pages. Mediavine RPMs on real-estate audiences run $15–$20, roughly 2.5× AdSense rates. At 120,000 monthly sessions under Mediavine, projected display ad revenue is ~$36,000/year. This is the realistic ceiling for display ad contribution given the site's category and audience.

**Slot inventory — page by page:**

| Page type | Allowed slots | Notes |
|---|---|---|
| Homepage | 728×90 leaderboard (below hero), 300×250 medium rectangle (below market snapshot), 300×600 half-page (content sidebar) | No ads inside the hero |
| Listing search | 300×250 in filter sidebar; 300×250 between listing rows every 8 listings | — |
| Listing detail | 300×250 below-fold sidebar; 300×600 below similar-listings module | NO above-fold ads; NO ads on mobile sticky action bar |
| Neighborhood hubs | Standard slots (similar to homepage) | — |
| Market hub | Standard slots | — |
| Blog / educational content | Standard slots | Highest tolerance for ads — informational pages |
| /sell, /buy, /contact | **NONE** | Conversion surface — ads kill conversion |
| /tour, /valuation | **NONE** | Conversion surface |
| /mortgage-calculator | **NONE** | Conversion surface |
| /account, /admin | **NONE** | Transactional — no ads |
| /legal pages | **NONE** | — |

**Implementation rules (inviolable):**

- Every ad slot rendered with a reserved bounding box at the correct IAB dimensions before the ad loads. CLS must equal 0 on every ad-bearing page — this is a Core Web Vitals requirement, not a preference.
- Lazy-load all ad units. No ad SDK blocks the initial render.
- No ads above the fold on any page.
- No ads on mobile sticky bars or CTAs.
- All ad slots implemented as a shared `<AdSlot>` component from `@/components/ui/ad-slot.tsx` wrapping the AdSense/FAN script tag. This keeps ad logic in one place for easy provider swap at wave 2.

**A/B test plan (phase 2):**

- Test 1: 300×250 in listing search — filter sidebar vs. between-rows position 8. Metric: RPM impact and search-to-registration conversion delta.
- Test 2: 300×600 on blog pages — right sidebar vs. inline after paragraph 3. Metric: RPM and scroll depth.
- Run via Google Tag Manager event tracking → GA4.

#### 1.4.4 Paid traffic acquisition (cost, not revenue)

This subsection documents paid traffic channels. These are a **cost**, not a revenue stream. Do not conflate with section 1.4.3 (on-site display ad revenue). Paid acquisition spend goes out; display ad revenue comes in. They are separate workstreams. [chat 2026-04-25]

**Google Ads — search and display.**

- Search campaigns targeting long-tail keywords: "homes for sale awbrey butte," "bend oregon real estate agent," "redmond oregon homes," "sisters oregon real estate," and similar high-intent local queries. Keyword strategy derived from Google Search Console data (most-clicked organic queries).
- Display retargeting: remarketing lists from GA4 audiences (site visitors who did not register) → served Display Network ads pointing back to the homepage or a relevant listing/neighborhood page.
- YouTube discovery: video ads sourced from Matt's YouTube content, targeted to in-market audiences in the Deschutes County DMA and Pacific Northwest relocation markets.
- Conversion tracking: Google Ads conversion API + GA4 cross-domain attribution, with FUB `registration_source` field as the downstream CRM attribution anchor.

**Facebook Ads — social and video.**

- Lookalike audiences built from email list (FUB contacts exported → Meta Custom Audience).
- Video ads sourced from YouTube content repurposed for Meta placement.
- Marketplace ads for individual listing promotion.
- Retargeting via Meta Pixel installed on all public pages (excluding /account and /admin). Pixel fires `PageView`, `ViewContent` (listing detail), `Lead` (registration, form submission), `InitiateCheckout` (tour request).

**Budget posture.**

Allocate based on lead-cost-per-source vs. lead-value-per-source. Spend where CPL < threshold set by Matt's risk tolerance (TBD — document in section 14, Operations). At launch: manual weekly budget review. Phase 2: automated rules in Google Ads and Meta Ads Manager to pause campaigns where CPL exceeds threshold for 3+ consecutive days.

**Tracking stack.**

| Signal | Tool |
|---|---|
| Paid click → site session | UTM parameters (locked convention in section 1.5) |
| Site session → registration | GA4 funnel + FUB `registration_source` |
| Registration → lead | FUB pipeline events |
| Lead → close | FUB closed-transaction report |
| Google Ads conversion | Google Ads Conversion API (server-side, privacy-safe) |
| Meta conversion | Meta Pixel + Conversions API (CAPI, server-side) |

### 1.5 Social funnel — site as the destination

The website does not stand alone. It is the destination endpoint of a three-channel content machine. [Matt 2026-04-25]

**Channel 1: YouTube (primary).** Matt's YouTube channel publishes weekly or bi-weekly Central Oregon market updates, neighborhood tours, buyer/seller explainers, and listing walkthroughs. YouTube is the #2 search engine globally and the primary research tool for relocating buyers doing pre-move due diligence. Every video description includes a CTA link to a dedicated landing page with a UTM parameter.

- Video type → CTA destination:
  - Market update → `/housing-market/reports/?utm_source=youtube&utm_medium=video&utm_campaign=market-report&utm_content=YYYY-MM`
  - Neighborhood tour → `/cities/{city-slug}/?utm_source=youtube&utm_medium=video&utm_campaign=neighborhood-tour&utm_content={city-slug}`
  - Listing walkthrough → `/homes-for-sale/{city}/{community}/{address-slug}-{mlsNumber}/?utm_source=youtube&utm_medium=video&utm_campaign=listing-tour&utm_content={mlsNumber}`
  - Buyer/seller explainer → `/moving-to-bend/?utm_source=youtube&utm_medium=video&utm_campaign=relocation&utm_content={topic-slug}`

- Per-channel goal: 500+ views per video → 2% CTR to site → 10 site visits per video; 1.5% of site visits register → 0.15 new leads per video. At 2 videos/week: ~15 new buyer/seller leads/month from YouTube alone.

**Channel 2: Instagram.** IG bio link → `/landing/instagram/?utm_source=instagram&utm_medium=social&utm_campaign=bio-link`. The `/landing/instagram/` page is a curated mobile-first link-in-bio page with 4–6 destination CTAs: current listings, market report, home valuation, "Moving to Bend" guide, and a contact form. Reels CTA drives to the same landing page. Story links drive directly to the relevant listing or neighborhood page with `utm_medium=story`.

- Per-channel goal: 2% of profile visitors click bio link → land on curated page → 3% submit a form = 0.06% conversion from profile view. At 2,000 profile views/month: ~1.2 leads/month. IG is a brand awareness and trust-building channel more than a direct lead channel.

**Channel 3: TikTok.** Bio link → `/landing/tiktok/?utm_source=tiktok&utm_medium=social&utm_campaign=bio-link`. Same structure as Instagram. TikTok skews toward younger buyers and curiosity-driven content (market stats, "what $700k buys in Bend vs. Portland" formats). Lead quality tends to be lower-funnel than YouTube but volume is higher.

- Per-channel goal: 1,000 bio link clicks/month → 2% conversion = 20 leads/month from TikTok at scale.

**UTM convention (locked for all channels):**

| Parameter | Values |
|---|---|
| `utm_source` | `youtube`, `instagram`, `tiktok`, `facebook`, `email`, `google`, `direct` |
| `utm_medium` | `video`, `social`, `story`, `reel`, `email`, `organic`, `cpc` |
| `utm_campaign` | `market-report`, `neighborhood-tour`, `listing-tour`, `relocation`, `home-valuation`, `bio-link`, `monthly-newsletter` |
| `utm_content` | Specific content identifier: `{city-slug}`, `{mlsNumber}`, `YYYY-MM`, `{topic-slug}` |

All UTM parameters pass through the site's session attribution logic into the FUB `registration_source` custom field [discovery 01: Lead Routing & FUB, `fub-identity-bridge.ts`]. Attribution persists via cookie through the first FUB event.

**Content cadence (assumptions — Matt to confirm):**

- YouTube: 1–2 videos/week (market update + one neighborhood or listing video)
- Instagram: 3–5 posts/week (Reels + static)
- TikTok: 3–5 videos/week (repurposed from YouTube Shorts or native)
- Email newsletter: 1/month to registered users (market report + featured listings)

### 1.6 KPIs dashboard — what gets tracked

The admin dashboard (section 7, batch 3) surfaces the following metrics. Every metric must have a verified data source before it is displayed.

**Acquisition:**

- Total sessions/month (source: GA4)
- Sessions by source/medium (organic, social by channel, direct, email, paid) — GA4 + UTM parsing
- New vs. returning visitor ratio — GA4
- YouTube → site conversion (sessions arriving with `utm_source=youtube`) — GA4

**Engagement:**

- Pages per session — GA4
- Avg session duration — GA4
- Listing view rate (% of sessions that view at least 1 listing detail page) — GA4 + FUB Viewed Property events
- Saved search rate (% of registered users who have at least 1 saved search) — Supabase `saved_searches` table
- Valuation tool starts per month — GA4 form-start events
- Valuation tool completions per month — GA4 form-submit events

**Conversion:**

- New registrations per month (source: Supabase auth.users + FUB Registration events)
- New leads per month by type (buyer, seller, general) — FUB pipeline
- Qualified leads per month (lead tier = warm/hot/very_hot in FUB) — FUB custom fields
- Lead-to-consult rate — FUB pipeline stage tracking
- Consult-to-agreement rate — FUB pipeline stage tracking

**Revenue:**

- Active deals in pipeline (source: FUB pipeline view)
- Deals closed month-to-date — FUB closed transactions
- GCI year-to-date — FUB closed transactions × commission rate
- Projected GCI next 90 days (deals under agreement × estimated close × avg commission) — FUB

**Display ad revenue (AdSense):**

- AdSense estimated revenue month-to-date — AdSense dashboard / GA4 AdSense revenue integration
- RPM (revenue per 1,000 impressions) by page type — AdSense dashboard
- Ad impressions served month-to-date — AdSense dashboard
- CLS violations on ad-bearing pages — Core Web Vitals report in Search Console (must stay at 0)

**Funnel health:**

- Search → registration funnel drop-off: % of search sessions that reach the registration gate vs. complete registration — GA4 funnel exploration
- Valuation tool drop-off: form-start vs. form-complete rate by step — GA4 + GTM events
- Listing detail page bounce rate (above-average bounce rate flags UX issues) — GA4
- Email alert engagement rate (opens + clicks on listing alerts) — Resend (phase 4)

**Sync / data health:**

- Spark API last-sync timestamp — Supabase `listings` table `updated_at` max
- `market_pulse_live` last refresh timestamp — pg_cron `mpl_refresh_30min` log
- Total active listings in Supabase vs. MLS count — Supabase `listings` count where `Status='A'` vs. Spark API active count
- Trigger `trg_compute_listing_fields` status — Supabase function health check [discovery 01: Data Architecture]

---

## 2. Audience & Personas

### 2.1 Geographic scope

Ryan Realty serves **Central Oregon**. This is the umbrella geographic brand. The 11 service areas Matt has confirmed are: [discovery 01: Page/Feature Decisions; PRODUCT_SPEC_V2.md]

1. Bend
2. Redmond
3. Sisters
4. Sunriver
5. La Pine
6. Tumalo
7. Madras
8. Prineville
9. Powell Butte
10. Terrebonne
11. Crooked River Ranch

**Bend is the priority anchor.** It is the largest market by transaction volume, the highest median price, and the highest search volume for organic keywords. Every other service area benefits from the authority established in Bend. Each city/area gets its own neighborhood hub page (section 5.4, batch 2). Bend is the first to build, the deepest to build, and the reference design for all others.

"Central Oregon" appears in all site-wide branding, schema markup, and SEO metadata. City-specific pages are targeted at city-level keywords ("Bend homes for sale," "Redmond OR real estate," "Sisters OR houses for sale"). Communities and neighborhoods within each city get their own canonical pages.

### 2.2 Audience priority (ranked)

The following ranking reflects Matt's direct instruction [Matt 2026-04-25] and is the editorial filter for every content, design, and feature decision.

1. **PRIMARY — Residential buyers moving TO Central Oregon (relocators).** This is the largest and most valuable long-cycle buyer segment. They are typically coming from California, the Portland metro, Seattle, and to a lesser extent Boise. They are doing 6–18 months of online research before contacting an agent. They want neighborhood depth, lifestyle context, school information, and weather/cost-of-living reality. They will find the site via YouTube, organic search, and IG. They are not yet in the Bend market and have never met Matt. This persona has the highest site-visit-to-close lead time but the highest total engagement and the strongest tendency to become long-term clients and referral sources.

2. **PRIMARY — Residential sellers in Central Oregon.** Homeowners considering or actively planning to list. They want pricing data, comp evidence, Matt's track record, and a clear process. They are often equity-rich after years of Bend appreciation. They are comparison-shopping agents and will likely request 2–3 valuations before choosing. The home valuation tool is the top-of-funnel entry point for this segment. Market reports and neighborhood data are the nurture mechanism.

3. **SECONDARY — Local repeat buyers (Bend residents upgrading or downsizing).** Already know the area. Have specific neighborhood preferences. Want real-time new-listing alerts, polygon search (to define exact streets they'll consider), and micro-neighborhood price-per-sqft data. Shorter research cycle; higher conversion rate from first contact. Already have a social network in Bend and are potential referral sources.

4. **TERTIARY — Investors (vacation rental, fix-flip, long-hold).** Short-term rental (STR) investors, primarily from out of state, looking at Bend/Sunriver/Sisters for STR income. They want: Deschutes County STR licensing zones, vacation-rental income data (gross revenue potential), HOA STR rules (which communities allow STR, which prohibit it), and cap-rate context relative to purchase price. This segment is content-rich and drives SEO volume for "Bend vacation rental investment" terms, but is lower-priority for Matt's core brokerage model. Content pages serve this segment; direct lead-capture for investors is a phase-2 initiative.

5. **TERTIARY — Second-home buyers (vacation home market).** Overlaps significantly with relocators and investors. Buyers who want a Bend weekend/vacation home while keeping their primary residence elsewhere. Similar research patterns to relocators (long online research cycle, lifestyle-driven). Sunriver, Sisters, and the resort community inventory (Tetherow, Pronghorn, Brasada Ranch, Eagle Crest) are the primary sub-markets for this segment. Neighborhood hub pages for these communities serve this persona.

### 2.3 Personas

#### 2.3.1 The relocator — "Mark and Dana"

**One-line summary:** Bay Area software engineer (or remote knowledge-worker couple) in their mid-30s to mid-40s, planning a full relocation to Bend for lifestyle reasons, 6–12 months from action.

**Demographics:**
- Age: 34–46 (primary window); secondary 28–33 (early family) and 47–58 (pre-retirement)
- Household income: $220,000–$500,000 (tech salaries, remote work, dual income)
- Family structure: couple with 0–2 young children, or pre-family couple; occasionally solo remote worker
- Current location: San Francisco Bay Area (primary), Portland metro, Seattle, Los Angeles, Austin, Denver
- Purchase budget: $550,000–$1,200,000 (wider range than most buyers due to income breadth)

**Psychographics:**
- Driven by lifestyle: outdoor recreation (skiing, trail running, mountain biking, fishing, paddling), quality of life, smaller city scale, and community
- Tired of: cost of living, traffic, density, and the cultural pace of their origin city
- Values: time outdoors, schools they'd be proud to send their kids to, a place that feels like a community, room to breathe, real seasons
- Research behavior: consumes 10–20+ hours of online content about Bend before making a single phone call; reads Reddit threads, watches YouTube neighborhood tours, reads market reports, asks locals in Facebook groups; is not impulsive
- Optimistic but realistic: wants the honest picture, including wildfire risk, cost of living changes since 2020, what $700K actually gets them compared to $900K, school district reality, and commute to specific employers or airports

**Decision criteria for the home:**
- Proximity to specific outdoor access: trail systems, Mt. Bachelor, Deschutes River
- School district / specific elementary school attendance zones
- Lot size and privacy (they're leaving a dense urban environment on purpose)
- Drive time to downtown Bend vs. quiet neighborhood tradeoffs
- HOA presence and rules (often a negative signal for this persona — they want freedom)
- Condition and age: prefers move-in ready; not looking for a project

**Decision criteria for the agent:**
- Evidence of local expertise: does this agent actually know the micro-neighborhoods, or is it generic?
- Track record with buyers from out of state: has this agent navigated a remote purchase before?
- Trustworthiness: will tell them the downsides, not just the upsides
- Responsiveness: will they answer a text on a Saturday?
- No pressure: this persona will walk away from an agent who feels pushy

**Fears:**
- Overpaying (especially in a market that has appreciated rapidly since 2020)
- Missing the "right" neighborhood and regretting the choice
- Making an offer remotely on a house that turns out to have problems they couldn't see in photos
- Their spouse not loving it as much as they do
- The market cooling right after they buy
- Wildfire risk (real concern; Bend has had air quality events; this persona Googles it)

**Stage when they hit the site:** Primarily awareness and research. They are 6–18 months from closing. A subset (15–20%) are 2–4 months out and actively touring.

**Conversion triggers — the moments that flip them from anonymous to lead:**
1. They read a market report that gives them a specific, honest answer to "is Bend's market overheated right now?" — and the data is real, sourced, and doesn't spin. They sign up for the monthly report.
2. They find a neighborhood page that shows them trail proximity, school attendance zones, and price ranges for homes in NW Crossing specifically — and they save it because it answered the questions they had been trying to piece together from five different Google searches.
3. They watch a YouTube video where Matt explains a specific Bend neighborhood with price data, and Matt seems like a person they would trust. The video description links to the site. They click.

**Funnel features that matter most:** YouTube landing pages with UTM tracking; neighborhood hub pages with lifestyle context (trail proximity, outdoor recreation, school zones, median price by neighborhood); "Moving to Bend" relocation hub; home valuation tool (less so for this persona immediately, but becomes relevant when they start to contemplate selling their current home); saved search with listing alerts.

---

#### 2.3.2 The local seller — "Carolyn"

**One-line summary:** Bend homeowner of 8–20 years, equity-rich, ready to either upsize, downsize, or cash out — comparing agents and their data before making a decision.

**Demographics:**
- Age: 45–68
- Household income: $120,000–$300,000 (plus substantial equity from Bend appreciation)
- Family structure: couple (kids in high school or grown and gone), or 55+ household downsizing
- Current location: Bend (8–20+ years in market)
- Current home value: $650,000–$1,500,000 (ESTIMATE — verify against Supabase for actual Bend distribution)

**Psychographics:**
- Has watched Bend's real estate market appreciate through two market cycles; is not naive about timing
- Values: honest representation, data-backed pricing, a clear process, being treated as a smart adult
- May have strong opinions about what their home is worth (sometimes based on what the neighbor got 18 months ago — and the market has shifted since)
- Likely to interview 2–4 agents before choosing; will use the valuation tool on multiple sites
- Wants to feel like the agent has actually studied their specific neighborhood, not just recited county-wide averages

**Decision criteria for listing:**
- Pricing accuracy: does the agent's CMA actually reflect current conditions, not comps from a hotter period?
- Marketing plan: professional photography, video, social media exposure — not just MLS
- Days on market history: how long have the agent's other listings sat vs. the market average?
- Commission: not the only factor, but it's discussed; a seller who feels the agent provides clear value will pay full commission
- Trust in the timeline estimate: will this really sell in 30 days, or is that a sales pitch?

**Decision criteria for the agent:**
- Local track record: sold homes in their specific neighborhood, ideally their specific street or community
- Reviews and references: real reviews, not curated testimonials
- Communication style: will they be available and responsive during the listing?
- Honesty about condition: will they tell them what needs to be fixed before listing?

**Fears:**
- Under-pricing (leaving money on the table)
- Overpricing (sitting on the market, which signals a problem and leads to price cuts that cost more than pricing right from the start)
- A broker who disappears after listing; poor marketing execution
- Getting a bad review or reputation in their neighborhood for a rocky sale
- Timing: selling too soon before a hypothetical uptick, or too late before a hypothetical downturn

**Stage when they hit the site:** Research and comparison shopping. They are 1–6 months from listing. A high-intent subset has already decided to sell and is choosing the agent.

**Conversion triggers — the moments that flip them from anonymous to lead:**
1. The home valuation tool gives them a number with a clear source trace — not "your home is worth $720,000–$890,000" (useless range) but "based on 7 comparable sales in your zip code in the last 90 days, the median adjusted value is $798,000 — here's the comp breakdown." The specificity earns trust.
2. The neighborhood market report page for their community (e.g., NW Crossing) shows current median price, days on market, and sale-to-list ratio — updated this month. They see Matt has real data, not recycled stats.
3. They read a blog post titled something like "Why the first 14 days on market determine your final sale price in Bend" that is specific, honest, and demonstrates that Matt understands the seller psychology. They click the CTA at the bottom.

**Funnel features that matter most:** Home valuation tool; neighborhood market report pages; seller-specific landing page ("Sell Your Home"); market reports with monthly data updates; Matt's profile page with verified transaction history and reviews; CMA download gated behind email.

---

#### 2.3.3 The local repeat buyer — "Kevin"

**One-line summary:** Bend resident of 5–15 years, upgrading from a starter home to a larger property or downsizing after kids leave, with specific neighborhood preferences and urgency.

**Demographics:**
- Age: 32–55
- Household income: $150,000–$350,000
- Family structure: couple with kids (upgrading to more space), or couple in their 50s (downsizing; kids gone)
- Current location: Bend (existing homeowner)
- Purchase budget: $700,000–$1,400,000 (often driven by equity from their current sale)

**Psychographics:**
- Already knows Bend's neighborhoods deeply — does not need the "what is Bend like?" content that relocators need
- Is often doing both a buy and a sell simultaneously (double-sided transaction risk: contingency offers)
- Urgency varies: some are actively looking right now; others are watching the market passively until the right property appears
- Wants real-time data and alerts, not a monthly newsletter
- Less likely to "research" extensively online before acting — more likely to call Matt directly once they see the right home

**Decision criteria for the home:**
- Specific streets or sub-neighborhoods (not general areas — they know the difference between the south end of NW Crossing and the north end)
- Lot size, view, privacy
- Condition (no major deferred maintenance — they don't want a project at this life stage)
- Proximity to their kids' current school (if upgrading with kids still in school)
- For downsizers: single-level, low maintenance, walkability to downtown or the river

**Decision criteria for the agent:**
- Speed and availability: Bend moves fast for well-priced homes; they need someone who can get them in the same day
- Knowledge of off-market or coming-soon inventory
- Experience with contingent offers (if they are buying and selling simultaneously)
- Established relationship: many in this category already know Matt or come via referral

**Fears:**
- Missing the right home because of slow response from their agent
- Getting stuck in a contingency offer in a competitive situation
- Overpaying for a home they know the neighborhood well enough to evaluate
- Coordinating two closings (selling their current home and closing on the new one) without a gap or double-mortgage period

**Stage when they hit the site:** Research and ready-to-tour. Some are actively searching right now. They return to the site frequently (saved searches, listing alerts). This is the persona most likely to set up a saved search and return daily.

**Conversion triggers — the moments that flip them from anonymous to lead:**
1. A listing alert lands in their inbox (or SMS, phase 2) for a home in the exact sub-neighborhood they saved — within 2 hours of the home going active on MLS. The speed signals real-time data and Matt's operational discipline.
2. The polygon search tool lets them draw the exact boundaries they care about (say, the block radius around a specific park or school), and they find 3 homes that match. The specificity of the search tool matches the specificity of their criteria.
3. They see a "new to market" listing in their saved search that Matt posted to IG two days before it hit MLS ("coming soon" pre-market visibility). They contact Matt immediately.

**Funnel features that matter most:** Saved search with real-time listing alerts (email now; SMS phase 2); polygon draw boundary search; "coming soon" and pre-market inventory visibility; fast-loading listing detail pages with accurate MLS data; tour scheduling ("book a showing" on listing detail page); mortgage calculator; comparable sales data on listing detail page.

---

#### 2.3.4 The investor — "Brian"

**One-line summary:** Out-of-state investor, typically from a high-cost California or Seattle market, evaluating Bend and Sunriver for STR (short-term rental) or long-hold investment, primarily desk-researching before any site visit.

**Demographics:**
- Age: 35–60
- Household income: $250,000–$700,000 (includes investment income, tech compensation, or business income)
- Family structure: single professional, or couple where one partner drives the investment thesis
- Current location: Bay Area, Los Angeles, Seattle, Denver (primarily)
- Purchase budget: $500,000–$1,100,000 (targeting STR-viable homes in Sunriver, Sisters, or core Bend STR zones)

**Psychographics:**
- Spreadsheet-driven: wants gross revenue projections, estimated expenses, cap-rate ranges — not lifestyle content
- Understands that STR income projections are estimates, not guarantees; wants honest data, not AirDNA-level optimism
- Aware of STR regulatory risk: knows that cities have been cracking down on STR licenses; specifically wants to know if the property is in a Deschutes County STR-eligible zone
- Is simultaneously looking at multiple markets (Bend, Bozeman, Mammoth, Scottsdale) — your content needs to answer the "why Bend vs. alternatives" question
- More transactional relationship with agent than relocators or sellers; not looking for a long-term relationship, looking for someone who knows the investment-specific details

**Decision criteria for the investment property:**
- STR licensing eligibility: is the property in an area where a Deschutes County STR license can be obtained?
- HOA restrictions: does the HOA prohibit STR? (Many Bend HOAs do.)
- Gross STR revenue potential: what did comparable properties earn on Airbnb/VRBO last year? (ESTIMATE — AirDNA data; must be clearly labeled as estimate, not verified Supabase data)
- Purchase price relative to gross revenue potential: rule-of-thumb target is gross STR revenue ÷ purchase price ≥ 10–15%
- Property condition for STR: turnkey, furnished, or easily furnishable; no major renovation required for guest-ready state
- Property management availability: is there a local STR property management company Matt can refer them to?

**Decision criteria for the agent:**
- Demonstrated STR market knowledge: can answer questions about STR zones, licensing, and revenue estimates without hand-waving
- Transaction speed: investors often want to move quickly when they identify a target
- Off-market access: institutional investors especially want to know if there are properties not yet listed

**Fears:**
- Buying in a zone that subsequently bans STR (regulatory risk)
- HOA votes to prohibit STR after purchase (happened in several Bend communities post-2022)
- Overestimating STR revenue based on 2021–2022 peak data (STR revenue has normalized in many resort markets)
- Expensive repairs between guests; property management cost eating into returns
- Vacancy risk in off-peak shoulder seasons

**Stage when they hit the site:** Awareness and research. They are 3–12 months from an investment decision. They may be evaluating Bend without any prior connection to the market.

**Conversion triggers — the moments that flip them from anonymous to lead:**
1. A blog post or neighborhood page for Sunriver or Sisters includes specific, honest STR context: "Sunriver allows STR in {specific zones}; neighboring HOAs {list them} prohibit STR. In 2025, a 3-bedroom STR in Sunriver Village earned a median of $X gross (ESTIMATE — verify before publishing) on Airbnb. Here's what the same home would cost today." The specificity of the honest data creates trust.
2. The investor finds a filter in the IDX search that lets them narrow by "STR-eligible zones" (phase 2 feature — requires licensing zone data integration). This feature does not exist on any Bend competitor.
3. Matt posts a video on YouTube: "What $700K buys in Sunriver as an STR investment in 2026." The investor watches it, clicks the link in the description, and lands on a page with the Sunriver community data, linked active listings, and a contact form. They submit.

**Funnel features that matter most:** Blog/content hub with STR investment context; Sunriver, Sisters, and resort-community neighborhood hub pages with STR-specific data blocks; IDX search (standard); contact form; mortgage calculator; future STR zone filter (phase 2).

**Important note on investor content compliance.** STR income projections are estimates and must be clearly labeled as such on every surface where they appear. Matt cannot guarantee STR revenue. Any published STR income figures must cite their source (e.g., AirDNA, Mashvisor, or Matt's own transaction records) and include appropriate disclosure language. This is a data accuracy and compliance requirement, not a preference [CLAUDE.md: Data Accuracy].

---

### 2.4 Persona-to-feature mapping

The matrix below scores each feature's importance to each persona. A high-priority (●) feature for a persona means the persona will not convert without it, or will choose a competitor if we lack it. Medium priority (◐) means it improves the experience. Low priority (○) means it is largely irrelevant to this persona's conversion.

| Feature | Relocator | Local Seller | Local Repeat Buyer | Investor |
|---|---|---|---|---|
| IDX map search | ● | ○ | ● | ● |
| Polygon / draw-boundary search | ◐ | ○ | ● | ○ |
| Listing detail page | ● | ○ | ● | ● |
| Saved search + email alerts | ● | ○ | ● | ◐ |
| SMS listing alerts | ◐ | ○ | ● | ○ |
| Home valuation / AVM tool | ○ | ● | ◐ | ○ |
| Neighborhood / community hub pages | ● | ● | ◐ | ● |
| Market reports (monthly) | ● | ● | ◐ | ● |
| "Moving to Bend" relocation hub | ● | ○ | ○ | ○ |
| School zone information | ● | ◐ | ● | ○ |
| Lifestyle / outdoor recreation overlays | ● | ○ | ◐ | ○ |
| STR licensing zone info | ○ | ○ | ○ | ● |
| Tour scheduling ("book a showing") | ◐ | ○ | ● | ◐ |
| Listing comparison tool | ● | ○ | ● | ◐ |
| Mortgage calculator | ● | ○ | ● | ● |
| Matt's agent profile + reviews | ● | ● | ◐ | ◐ |
| Blog / editorial content | ● | ● | ○ | ● |
| YouTube video embeds | ● | ◐ | ○ | ◐ |
| Interest-segmented lead form | ● | ● | ◐ | ◐ |
| CMA / seller's market analysis download | ○ | ● | ○ | ○ |

### 2.5 Conversion trigger inventory

For each persona, the three specific moments on the site that are most likely to convert an anonymous visitor to a registered lead. These become the design and content priority for batch 2 (public pages).

**The relocator:**
1. **Neighborhood hub page with lifestyle context.** A page that answers "what is it like to live in NW Crossing?" with trail proximity map, school attendance zone, median price in the last 90 days, days on market, and 3–5 current listings — in one scroll. The relocator has been cobbling this information from five sources. When the site assembles it in one place, they register because they want to save it and come back.
2. **Market report that does not hype.** An honest monthly report that shows whether Bend is a buyer's market, a seller's market, or balanced — with the actual months-of-supply calculation shown. The relocator has read too many "now is a great time to buy/sell!" market updates. A report that says "inventory is up 22% year-over-year; median DOM expanded from 18 to 31 days; this is a more balanced market than 2022" earns their trust. They sign up for the monthly email.
3. **YouTube video that leads to a UTM landing page.** The relocator watches a Matt video about Bend neighborhoods, clicks the description link, lands on a page that (a) matches the specific neighborhood in the video, (b) shows current listings, and (c) has a simple "get notified when new homes list here" form. The continuity from video content to site landing page to email capture converts.

**The local seller:**
1. **Home valuation tool with comp-level specificity.** The valuation tool must show the comparable sales that support the estimate — not just a number, but the 5–7 most relevant recent sales in the seller's neighborhood, with adjustments explained. "Based on 6 sales within 0.5 miles, median adjusted price/sqft is $412. Your 1,892 sqft home = $779,000 estimated value." The specificity converts because it treats the seller as a smart adult.
2. **Neighborhood market report page for their specific area.** When a seller searches "NW Crossing homes for sale" or "NW Crossing real estate market" and lands on a page that shows the current months of supply, the median days on market, and the sale-to-list ratio for that specific community — not for all of Bend — they see that Matt has data they can trust. They click "Talk to Matt."
3. **A seller-specific blog post or guide that answers a real question.** Posts like "How to price your Bend home in a flattening market" or "What buyers in Bend are looking for in 2026" that are data-backed, non-hyped, and specific. A CTA at the bottom: "Get a free market analysis for your home." The seller who reads 400 words of honest content is a warm lead.

**The local repeat buyer:**
1. **A listing alert for a home in the exact sub-neighborhood they saved — within 2 hours of MLS listing.** Speed is the conversion trigger for this persona. They have been looking for months. When an alert arrives while the listing is still fresh — before the weekend open-house crowd — the alert delivers real value. The trust this builds leads them to contact Matt for a showing.
2. **Polygon search that matches their exact criteria.** The ability to draw a boundary around the specific streets they care about (around a school, near a park, avoiding a specific arterial) and see only those homes is a feature no local Bend competitor offers. When the repeat buyer discovers this tool, they use it every time they visit. It creates habit and identity with the site.
3. **"Book a showing" on listing detail with same-day calendar availability.** The repeat buyer has found the home. They are ready to go. When the listing detail page has a "Schedule a showing" button with real calendar availability — not a contact form that generates a 24-hour delay — they book immediately. The conversion from "interested" to "appointment confirmed" happens in 30 seconds. [discovery 06: Steal from Redfin — instant tour scheduling]

**The investor:**
1. **A Sunriver or resort community neighborhood hub page with STR licensing status and income context.** The investor has been Googling "Sunriver STR rules" and "Sunriver vacation rental income" for weeks. When they find a page that consolidates: STR licensing zone map, HOA STR status by community, and a realistic (not hyped) income range for comparable 3-bedroom STR properties — they save it and contact Matt. This page doesn't exist on any Bend competitor. [discovery 06: Open Gaps]
2. **A blog post with honest STR ROI math.** "What a $750,000 Sunriver home earns as a short-term rental in 2026 — and what it costs" is a specific, unhedged, data-sourced post. The investor who reads it and finds the math is honest — acknowledging vacancy, platform fees, management costs, and the regulatory risk — contacts Matt because the honesty signals competence. (ESTIMATE — all STR income figures in such a post must be verified and labeled per data accuracy rule.)
3. **Matt's YouTube video on Bend STR investment.** Investors research on YouTube. A video specifically addressing the Bend/Sunriver STR market, with a CTA to the resort community hub page, drives this persona to the site from YouTube and converts on arrival.

---

_End of batch 1. Sections 3–17 pending. Next: batch 2 covers section 3 (Data Inventory), section 4 (Information Architecture), and section 5 (Public Pages)._

---

## 3. Data Inventory & Exposure Strategy

The database sitting behind Ryan Realty is, by any reasonable measure, the strongest competitive asset in the build. 85 tables, 974 columns, 5.25 million rows, a Spark API sync running every two minutes, and 590,000 listings with a full JSONB payload of unmapped MLS fields. The problem is exposure: roughly half the value is locked inside that `details` JSONB column or behind RLS policies that quietly return nothing to anonymous users. This section catalogs every data point the site has access to, where each should surface, what is hidden today, and what is missing entirely. [discovery 02 full; discovery 05 full]

---

### 3.1 Schema summary

The `public` schema of the `ryan-realty-platform` Supabase project (`dwvlophlbvvygjfxcrhm`) contains the following as of the audit date 2026-04-24:

| Metric | Value |
|---|---|
| Total tables in `public` schema | 85 |
| Total columns | 974 |
| Total rows across all tables | 5,253,914 |
| Tables with RLS enabled | 84 (all except `spatial_ref_sys`, a PostGIS system table with no user data) |
| Total indexes defined | 285 |
| Foreign key relationships defined | 16 |

**Top 5 tables by row count:**

| Table | Rows | Notes |
|---|---|---|
| `listing_history` | 4,302,019 | Field-level change log from Spark MLS |
| `listings` | 590,192 | Core MLS listing table, 150 columns |
| `price_history` | 345,446 | Price-change events per listing |
| `strict_verify_runs` | 6,214 | Internal QA — no consumer value |
| `activity_events` | 6,149 | Site-wide activity feed |

The `listings` table has 150 columns. Approximately 80 are dedicated typed columns promoted from MLS fields. The remainder flow through `details` (JSONB), which stores the full Spark MLS StandardFields payload for all 590,000 listing rows. This JSONB column is the primary source of hidden value and the primary performance risk if queries filter on it without a GIN index. [discovery 02 §Performance concerns]

---

### 3.2 Consumer-relevant tables

The following tables have direct consumer exposure value — they surface on one or more page templates described in section 5.

#### `listings` — 590,192 rows

**Key columns for exposure:** `ListPrice`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `City`, `PostalCode`, `SubdivisionName`, `StandardStatus`, `ListDate`, `DaysOnMarket`, `PhotoURL`, `has_virtual_tour`, `year_built`, `lot_size_acres`, `pool_yn`, `school_district`, `architectural_style`, `new_construction_yn`, `Latitude`, `Longitude`, `PublicRemarks`. Hidden but available: `details->>'ElementarySchool'`, `details->>'MiddleSchool'`, `details->>'HighSchool'`, `details->>'BuilderName'`, `details->>'TaxAmount'`, `details->>'CommunityFeatures'`, `details->>'AssociationFeeFrequency'`, `CumulativeDaysOnMarket`, `OriginalListPrice`, `ClosePrice`.

**Surfaces:** Listing card (search results), listing detail page, neighborhood hub (active listings feed), city landing page (active listings feed), market reports (aggregated stats), builder pages (filtered by `BuilderName`), school pages (filtered by `ElementarySchool`/`MiddleSchool`/`HighSchool`), lifestyle pages (proximity-filtered).

**RLS:** Public SELECT (anon + authenticated). Service-role and super_admin have full access. No write access from client.

---

#### `listing_photos` — row count not separately audited; populated per listing

**Key columns for exposure:** `photo_url`, `sort_order`, `listing_key`.

**Surfaces:** Listing detail gallery (hero carousel, all photos). Listing card (first photo as thumbnail).

**RLS:** Public SELECT (implied from listing photo display behavior in the existing app). [discovery 02 §Data Exposure Map]

---

#### `listing_videos` + `listing_floor_plans` — row count not separately audited

**Key columns for exposure:** `listing_key`, `url` (video), `cdn_url`. Floor plans: `file_url`, `sort_order`.

**Surfaces:** Listing detail page — video player section and floor-plan lightbox. [discovery 02 §listings: details JSONB; discovery 04 §VIDEO_DATA_FLOW.md]

**RLS:** Public SELECT (in sync with `listings`).

---

#### `open_houses` — 0 rows (schema populated, data not yet populated)

**Key columns for exposure:** `listing_key`, `event_date`, `start_time`, `end_time`, `remarks`.

**Note on hidden columns:** `host_agent_name` and `rsvp_count` are present in the schema but should not be exposed to anonymous users. `host_agent_name` is agent PII and `rsvp_count` leaks RSVP patterns.

**Surfaces:** Listing detail page (open house badge + times), `/open-houses` index page (calendar view, searchable by city and date).

**RLS:** Public SELECT per discovery 02 schema review.

---

#### `listing_history` — 4,302,019 rows

**Key columns for exposure:** `event_type`, `event_date`, `new_value` (for price-change events). `old_value` and `field_name` should be restricted to broker-only views.

**Surfaces:** Listing detail page — "Price history" module (status changes, price drops). Market report pages (aggregate price-change trends). Admin dashboard (full field-level history).

**RLS:** Public SELECT, service_role ALL. [discovery 02 §listing_history]

---

#### `price_history` — 345,446 rows

**Key columns for exposure:** `old_price`, `new_price`, `changed_at`, `price_change_pct`.

**Surfaces:** Listing detail page — price history chart. Market report pages — price trend analysis.

**RLS:** Public SELECT, super_admin ALL. [discovery 02 §price_history]

---

#### `listing_agents` — 0 rows (schema populated; data synced via MLS expansion)

**Key columns for exposure:** `agent_name`, `office_name`.

**Columns to withhold:** `agent_email`, `agent_phone` (PII), `agent_mls_id`, `agent_license`. These may be exposed on listing detail for the listing agent's contact card (per MLS attribution requirements) but must not be indexed by search engines.

**Surfaces:** Listing detail page — listing agent card.

**RLS:** No explicit policy confirmed in audit; treat as service_role only until a public SELECT policy is verified. [discovery 02 §listing_agents]

---

#### `communities` — 0 rows (schema ready; no data populated yet)

**Key columns for exposure:** `name`, `slug`, `description`, `hero_image_url`, `is_resort`.

**Columns to withhold from anonymous:** `boundary_geojson` (expensive to serve; should be server-rendered, not client-fetched), `resort_content` JSONB (complex; render server-side).

**Surfaces:** Community hub pages, neighborhood hub pages, listing detail breadcrumb.

**RLS:** Public SELECT (per discovery 02 §Data Exposure Map).

---

#### `neighborhoods` — 0 rows (schema ready)

**Key columns for exposure:** `name`, `slug`, `description`, `city_id`.

**Surfaces:** Neighborhood hub pages (section 5.4), listing detail breadcrumb, city landing page.

**RLS:** Public SELECT. [discovery 02]

---

#### `cities` — 0 rows (schema ready)

**Key columns for exposure:** `name`, `slug`, `description`.

**Surfaces:** City landing pages, `/homes-for-sale/{city}` routes, navigation mega-menu, sitemap.

**RLS:** Public SELECT. [discovery 02]

---

#### `saved_listings` — 0 rows (auth users only)

**Key columns for exposure:** `listing_key`, `user_id`, `created_at`. No write access via client except through verified auth sessions.

**Surfaces:** `/account/saved-listings`, listing detail heart icon (saved state), listing card heart icon.

**RLS:** Auth user: SELECT own, INSERT own, DELETE own. Anon: no access. [discovery 02 §User/Lead]

---

#### `saved_searches` — 0 rows (auth users only)

**Key columns for exposure:** All columns are visible to the owning auth user only. Never expose another user's saved search.

**Surfaces:** `/account/saved-searches`, search results page (saved-search banner with alert status).

**RLS:** Auth user: SELECT own rows only. [discovery 02]

---

#### `listing_inquiries` — 0 rows — **P0 RLS BUG**

**Columns:** `name`, `email`, `phone`, `message`, `listing_key`, `created_at`, plus referral source.

**RLS status: `qual: false`** — this means all inserts are silently blocked for anon and authenticated users. The table exists and the schema is defined, but no lead can reach it through the Supabase client SDK. Any form wired to a direct Supabase client insert call will silently fail — the user sees nothing, Matt gets nothing, and the lead is lost.

**Fix (mandatory before any lead-capture form ships):** Route all listing inquiry inserts through a server-side API endpoint (`/api/inquiries`) that uses `SUPABASE_SERVICE_ROLE_KEY`, not the anon key. The endpoint must also fire the FUB webhook (source, email, name, listing_key) before responding with success. See section 3.6 for the full RLS policy map. [discovery 02 §RLS gaps]

**Surfaces:** "Contact about listing" modal on listing detail page, "Request more info" form on neighborhood hub.

---

#### `valuation_requests` — 0 rows — **P0 RLS BUG**

**Same issue as `listing_inquiries`.** `qual: false` on all policies. All inserts silently blocked.

**Fix:** Same pattern as above — server-side API endpoint (`/api/valuations`) using service-role key, with FUB webhook fired on successful insert.

**Surfaces:** Home valuation tool form (`/sell`), floating valuation CTA on homepage and city landing pages. [discovery 02 §RLS gaps]

---

#### `market_pulse_live` — 994 rows — **blocked by missing public SELECT policy**

**Key columns for exposure:** `geo_type`, `geo_slug`, `geo_label`, `active_count`, `pending_count`, `sold_count_30d`, `median_list_price`, `median_close_price_90d`, `months_of_supply`, `market_health_label`, `market_health_score`, `pct_sold_over_asking`, `sell_through_rate_90d`, `median_days_to_pending`, `absorption_rate_pct`, `updated_at`.

**Current status:** RLS is enabled on this table but no `CREATE POLICY ... FOR SELECT TO anon` policy was found in the audit. This means anonymous users get zero rows. The table has 994 rows of live per-geography market stats that are completely invisible to the website.

**Fix (mandatory before any market widget ships):** `CREATE POLICY "Public read market_pulse_live" ON public.market_pulse_live FOR SELECT TO anon, authenticated USING (true);` This is a one-line migration. [discovery 02 §RLS gaps]

**Surfaces:** Market hub pages (city and neighborhood), homepage market pulse widget, neighborhood hub "Market snapshot" tab, listing detail "Area market context" module.

---

#### `report_listings_breakdown` — row count not audited (cache table)

**Key columns for exposure:** City, period, median price, DOM, sold count, list-to-sale ratio. (Exact column names to be confirmed against schema.)

**Surfaces:** `/market-reports/{city}` and `/market-reports/{city}/{period}`. Fed by `refresh_listings_breakdown()` which runs post-delta-sync. [discovery 04 §Data decisions]

**RLS:** Public SELECT (the reports pages in the existing app display this data). [discovery 03 §Complete Pages]

---

#### `market_stats_cache` — 0 rows (schema ready, not yet populated)

**Key columns for future exposure:** `median_sale_price`, `sold_count`, `median_dom`, `yoy_median_price_delta_pct`, `price_band_counts` (JSONB — histogram data), `bedroom_breakdown` (JSONB), `dom_distribution` (JSONB), `cash_purchase_pct`, `median_concessions_amount`. 40 columns total.

**Surfaces (when populated):** Market report pages — detailed charts and trend visualizations. Admin dashboard — full market analytics.

**RLS:** Public SELECT for published stats. [discovery 02 §Data Exposure Map]

---

#### `brokers` — 0 rows (schema ready)

**Key columns for exposure:** `display_name`, `title`, `bio`, `photo_url`, `tagline`, `specialties`, `years_experience`, `slug`.

**Columns to withhold from anonymous:** `email`, `phone` (PII displayed only when business decision permits), `zillow_id`, `realtor_id`, `intro_video_url`.

**Surfaces:** Agent profile page (`/agents/{agent-slug}`), listing detail agent card (brief version), homepage "About Matt" module.

**RLS:** Public SELECT. [discovery 02 §Data Exposure Map]

---

#### `blog_posts` — 0 rows (schema ready)

**Key columns for exposure:** `slug`, `title`, `content`, `status`, `author_broker_id`, `published_at`, SEO fields (`seo_title`, `seo_description`).

**Surfaces:** Blog index (`/blog`), blog post (`/blog/{post-slug}`), related content modules on neighborhood hubs and listing detail pages.

**RLS:** Public SELECT where `status = 'published'`. [discovery 02]

---

#### `engagement_metrics` — 5 rows

**Key columns for exposure:** `listing_key`, `view_count`, `save_count`.

**Columns to withhold:** `inquiry_count` (competitive intelligence; do not display), `share_count`.

**Surfaces:** Listing detail page — "demand indicator" module (views, saves).

**RLS:** Public SELECT. [discovery 02 §engagement_metrics]

---

### 3.3 Hidden value hit list

These are data fields that exist in Supabase — either as typed columns or as keys inside the `details` JSONB — that are not currently exposed anywhere on the consumer website. Each entry has a verified source, a stated value, an effort estimate, and a wave assignment. [discovery 02 §Top 10 Hidden-Value Fields; discovery 05 §Top 10 Hidden-Value Fields]

---

**1. `details->>'ElementarySchool'`, `details->>'MiddleSchool'`, `details->>'HighSchool'`**

What it is: The name of the school serving the listing's address at each grade level, as provided by Spark MLS. Already synced into `details` JSONB for every listing.

SEO/UX/monetization value: School assignment is the number-one search filter for buyers with children. Exposing school names on listing detail pages enables `<SchoolName>` school pages (e.g., `/schools/elementary/bear-creek-elementary`) which capture high-intent search queries like "homes near Bear Creek Elementary Bend." Per discovery 05, this represents an estimated 25–30% search traffic lift for family-buyer queries. No Bend competitor exposes school-level data from the IDX feed. [discovery 05 §Top 10 Hidden-Value Fields, rank 1–3]

Implementation effort: Small. The data is already in `details` JSONB. Exposing it on listing detail requires adding three rows to the `ShowcasePropertyDetails` component and updating the search filter UI. Schema promotion to typed columns (recommended for indexability) adds one migration. Total estimated effort: 4–6 hours.

Wave priority: **MVP.** This is a zero-additional-cost unlock of the highest-ROI undeveloped feature in the codebase.

---

**2. `details->>'BuilderName'`**

What it is: The builder or developer name for new-construction listings, provided by Spark MLS. Already synced into `details` JSONB. The `new_construction_yn` boolean column is a typed first-class column and is indexed.

SEO/UX/monetization value: Enables `/builders/{builder-slug}` pages (e.g., `/builders/hayden-homes`, `/builders/dr-horton`). Buyers shopping new construction in Bend actively search by builder name. A builder index page shows all current and recent listings from a given builder, links to their communities, and drives high-intent traffic from searches like "Hayden Homes Bend OR" or "new construction Redmond OR builder." Builder pages also enable a phase-2 featured/sponsored listing placement for builders who want enhanced visibility. The `BuilderName` field comes in with inconsistent capitalization from Spark (e.g., "Hayden Homes", "HAYDEN HOMES", "Hayden Homes LLC") and will require a canonical-name lookup table (see section 3.4 gaps). [discovery 02 §Top 10 Hidden-Value Fields, rank 3]

Implementation effort: Medium. Requires: (1) migration to promote `BuilderName` from JSONB to a typed column, (2) a `builder_canonical_names` lookup table to normalize dirty input, (3) `/builders/[slug]/page.tsx` template, (4) builder listings feed. Estimated 8–12 hours.

Wave priority: **MVP** (page template is simple; the SEO surface area is high).

---

**3. `details->>'TaxAmount'`**

What it is: Annual property tax dollar amount for the listing, as provided by Spark MLS. Synced into `details` JSONB. Currently used only inside the payment calculator component, not displayed in the listing summary.

SEO/UX/monetization value: Moving `TaxAmount` from the hidden payment calculator to a visible summary badge on listing detail pages addresses a transparency gap. Buyers regularly ask "what are the property taxes?" before making an offer. Displaying it upfront reduces pre-offer inquiry load and positions Ryan Realty as an honest data source (unlike Zillow, which often displays outdated or estimated tax figures). Feeds a "true cost of ownership" module (annual taxes + HOA fees + estimated PITI in one row). [discovery 02 §Top 10, rank 2; discovery 05 §rank 4]

Implementation effort: Small. The data is already in `details` JSONB. Update to the `ShowcaseKeyFacts` or `ShowcasePayment` component. Add a `TaxYear` context field alongside (`details->>'TaxYear'`). Estimated 2–3 hours.

Wave priority: **MVP.**

---

**4. `details->>'CommunityFeatures'`**

What it is: HOA amenity strings from Spark MLS (e.g., "Pool, Clubhouse, Pickleball, RV Parking, Walking Trails"). Synced into `details` JSONB as a pipe-delimited string in most cases.

SEO/UX/monetization value: Exposing `CommunityFeatures` enables two features: (a) amenity display on listing detail ("This community has: Pool, Pickleball, Walking Trails") which is a buyer trust signal for HOA communities, and (b) amenity-based search filtering ("Show homes with pickleball courts") which no Bend competitor offers. The filtering capability is a genuine search differentiator for the growing pickleball/active-adult segment. Phase 2 potential: `/community-features/pickleball` category pages generating SEO traffic from searches like "Bend OR homes with pickleball court." [discovery 02 §Top 10, rank 4]

Implementation effort: Small–Medium. Display on listing detail: 2 hours. Search filter UI: 4 hours. Parsing the pipe-delimited string into an array for filtering: 1 hour. Phase 2 category pages: additional 4 hours. Total MVP: 6–7 hours.

Wave priority: **MVP** (display only); filter in wave 2.

---

**5. `market_pulse_live.pct_sold_over_asking` / `sell_through_rate_90d` / `pct_sold_under_asking`**

What it is: Live per-geography, per-property-type statistics in `market_pulse_live` (994 rows). The table has 32 columns including metrics that go far beyond simple median price. Specifically: the percentage of homes sold over asking, at asking, and under asking; the sell-through rate over the trailing 90 days; and net inventory change.

SEO/UX/monetization value: These are the highest-signal market intelligence metrics for both buyers and sellers — and they are completely invisible. A live badge on city/neighborhood pages reading "62% of Bend SFR homes sold over asking in the last 30 days" is more persuasive to a seller considering listing than any amount of copy. Buyers see the same badge and understand the competitive pressure. These are the stats competitors would charge for in a premium tier. Ryan Realty has them live, at no additional cost, blocked only by a missing public SELECT policy. [discovery 02 §Top 10, rank 7]

Implementation effort: Extremely small once the RLS fix is applied (see section 3.6). One migration to add the public SELECT policy, then wire into existing `market_pulse_live` query calls. Total: 2 hours including the migration.

Wave priority: **MVP** — unblocked by the RLS fix which must happen anyway.

---

**6. `listings.CumulativeDaysOnMarket`**

What it is: A typed column on `listings` that tracks total time on market including relists, not resetting when a listing briefly withdraws and returns. `DaysOnMarket` resets on each fresh listing; `CumulativeDaysOnMarket` (CDOM) does not. Both are synced from Spark.

SEO/UX/monetization value: Displaying CDOM (or a "CDOM vs. DOM" delta) is a buyer advocacy signal that builds genuine trust. A home showing "47 days on market" but "180 cumulative days" signals something different than a freshly listed home. Matt's positioning as an honest, data-forward broker is directly served by surfacing the distinction. Flagging a large CDOM/DOM gap with a note ("This property has been on and off market for 6 months — here is what that may mean") treats buyers as adults. No portal and no local competitor displays CDOM at all. [discovery 02 §Top 10, rank 10; discovery 05 §Synced But Unexposed]

Implementation effort: Small. The column exists and is indexed. Add to `ShowcaseKeyFacts` with conditional display (only show if CDOM > DOM + 30 days to avoid noise). Estimated 2 hours.

Wave priority: **MVP.**

---

**7. `listings.architectural_style` / `listings.construction_materials` / `listings.roof`**

What it is: Three typed columns on `listings` already promoted from the MLS, describing the architectural style (e.g., "Craftsman," "Contemporary," "Ranch"), exterior construction material (e.g., "Hardiplank," "Cedar," "Stucco"), and roof material. All three are populated and indexed.

SEO/UX/monetization value: Architectural style enables style-based SEO pages (e.g., `/homes-for-sale/bend?style=craftsman`) and a search filter that differentiates from every other local portal. Buyers from specific origin markets (Pacific NW, California) have strong architectural preferences. Construction materials are relevant for insurance shoppers comparing fire ratings in a wildfire-adjacent market. Roof material matters for buyers doing a pre-purchase cost projection. [discovery 02 §Top 10, rank 9]

Implementation effort: Small. Add to `ShowcasePropertyDetails` section. Add `architectural_style` to search filter as a multi-select. Estimated 3–4 hours.

Wave priority: **Wave 2** (table stakes data but not the highest-ROI unlock at MVP).

---

**8. `listings.lot_size_sqft` / `listings.lot_size_acres` / `listings.lot_features`**

What it is: Typed columns on `listings`. `lot_size_acres` and `lot_size_sqft` are both indexed. `lot_features` is a text field (pipe-delimited from Spark; values like "Level, Cul-de-sac, Corner Lot, Sprinklers In Front").

SEO/UX/monetization value: Lot size is a top-five search filter for buyers in rural and semi-rural markets like Central Oregon. A buyer coming from a dense urban area specifically wants a lot size filter. Displaying lot features helps buyers understand usability (flat vs. sloped, corner vs. interior). These columns exist and are indexed — the failure to display them is a pure UX gap. [discovery 02 §Top 10, rank 8]

Implementation effort: Small. `lot_size_acres` is likely already on listing cards (per discovery 05 §Fully Wired). `lot_features` needs parsing and display in `ShowcasePropertyDetails`. Lot size as a search filter needs a range slider in the search filter sidebar. Estimated 3–4 hours.

Wave priority: **MVP** (lot size at minimum; lot features in wave 2).

---

**9. `listings.details->>'AssociationFeeFrequency'` + `hoa_fee` / `AssociationYN`**

What it is: `hoa_fee` and `AssociationFeeFrequency` are stored in `details` JSONB (per discovery 02). `AssociationYN` is a typed column. Currently they surface only inside the payment calculator widget, not in the listing summary.

SEO/UX/monetization value: HOA presence is a decision filter for approximately 40% of buyers [discovery 05 §Top 10, rank 5]. A buyer who sees an HOA fee of $320/month in the payment calculator but never saw an HOA callout in the listing summary may be unpleasantly surprised. Moving HOA status to a visible badge ("HOA: $320/month" or "No HOA") on listing detail and listing cards — and enabling HOA filter in search (max HOA fee slider) — reduces surprise objections and improves lead quality. No Bend local competitor displays HOA fee on listing cards. National portals all do.

Implementation effort: Small. Display: 2 hours. Search filter: 3 hours.

Wave priority: **MVP** (display); wave 2 (search filter slider).

---

**10. `listings.details->>'View'` / `listings.details->>'WaterfrontYN'` (not yet synced as typed columns)**

What it is: `View` and `Waterfront` are available from Spark MLS but not yet synced as typed columns on `listings`. They currently live in `details` JSONB if present in the Spark payload. The discovery 05 audit confirms these are "Available but not synced" — meaning they exist in the raw Spark response but the sync pipeline has not been updated to extract them into dedicated columns.

SEO/UX/monetization value: In Central Oregon, mountain views and river/creek frontage are extreme premium features. A home with a Cascade mountain view or Deschutes River frontage commands 15–40% price uplift. Displaying these features as prominent hero badges on listing detail ("Mountain Views") and enabling a search filter for view/waterfront is table-stakes for luxury positioning. Compass, the design reference, surfaces view as a prominent listing detail. No local Bend competitor filters on view or waterfront. [discovery 05 §Top 10, rank 6–7]

Implementation effort: Medium. Requires a schema migration to add `view_yn` (boolean), `view_description` (text), and `waterfront_yn` (boolean) columns to `listings`, plus a backfill from `details` JSONB, plus sync pipeline update. Then UI exposure. Total: 6–8 hours.

Wave priority: **Wave 2** (sync change required; high value but needs a migration window).

---

**11. `listings.details->>'HeatingFuel'` / `WaterSource` / `Sewer`**

What it is: Three utility-related fields available from Spark but not yet synced as typed columns. `HeatingFuel` (e.g., "Natural Gas," "Electric," "Oil," "Propane") is the most buyer-relevant. `WaterSource` (municipal vs. well) and `Sewer` (municipal vs. septic) affect appraisal, insurance, and monthly operating cost significantly in rural Central Oregon.

SEO/UX/monetization value: Well and septic properties are common in Tumalo, Terrebonne, Powell Butte, and rural Bend. A buyer who purchases without understanding well/septic status may face unexpected inspection costs or refinancing issues. Exposing these fields prevents a category of post-offer surprise and positions Ryan Realty as the information source that protects buyers. For out-of-state relocators from municipal-only markets, this context is genuinely valuable. [discovery 05 §Moderate — Utilities]

Implementation effort: Medium. Schema migration + backfill + sync update + UI. 4–6 hours.

Wave priority: **Wave 2.**

---

**12. `market_stats_cache.cash_purchase_pct` / `median_concessions_amount`**

What it is: Columns in the `market_stats_cache` table (0 rows, schema ready). Once populated, these expose: the percentage of transactions in a market that closed as cash purchases, and the median seller concession amount.

SEO/UX/monetization value: Cash buyer percentage and seller concession data are intelligence that consumers cannot find anywhere locally. A market report stating "28% of Bend SFR closings in Q1 2026 were cash purchases; median seller concession was $9,200" is a shareable, genuinely novel data point. This drives newsletter subscriptions, social shares, and positions Ryan Realty as the statistical authority in the market. [discovery 02 §Top 10, rank 6]

Implementation effort: Medium (data pipeline to populate `market_stats_cache` from `listings` aggregates is the main work; display is straightforward once populated). 8–10 hours including pipeline.

Wave priority: **Wave 2** (requires pipeline build; table is empty at MVP launch).

---

**13. `listings.details->>'NewConstruction'` / `SeniorCommunity`**

What it is: Boolean flags available from Spark, partially present in `details` JSONB. `new_construction_yn` is a typed column; `SeniorCommunity` is in `details`.

SEO/UX/monetization value: `NewConstruction` as a badge ("New Construction") on listing cards is a buyer qualification signal that no Bend competitor surfaces clearly. It enables a dedicated new-construction search filter and a "New Construction in Bend" landing page for SEO. `SeniorCommunity` serves a niche segment (55+ communities like Tetherow's age-restricted sections) but creates a dedicated search filter. [discovery 05 §Cosmetic]

Implementation effort: Small. `new_construction_yn` already exists as a column — just needs a badge in the card and a filter checkbox. `SeniorCommunity` needs JSONB extraction. Total: 2–3 hours.

Wave priority: **MVP** (`new_construction_yn` badge and filter); `SeniorCommunity` in wave 2.

---

**14. `listings.details->>'StartShowingDate'` / `StatusChangeDate`**

What it is: `StartShowingDate` is a Spark field indicating when showings are permitted to begin — critical for "coming soon" listings. `StatusChangeDate` tracks when the listing status last changed.

SEO/UX/monetization value: `StartShowingDate` enables a "Coming soon — showings start [date]" badge that no local competitor displays. This is a conversion trigger for the local repeat buyer persona (section 2.3.3): early notification of a coming-soon property before the MLS active date can drive immediate tour scheduling. It is also a trust signal: Ryan Realty surfaces information that other sites don't.

Implementation effort: Small. Extract from `details` JSONB; add conditional badge to listing card and detail page. 2 hours.

Wave priority: **MVP.**

---

**15. `engagement_metrics.view_count` / `save_count` — currently exists but underexposed**

What it is: A typed table with per-listing engagement counts (views, saves, inquiries). 5 rows currently. Populated by site events as listings are viewed and saved.

SEO/UX/monetization value: Displaying "47 people viewed this listing" and "12 people saved this listing" on listing detail pages creates a social-proof urgency signal similar to Redfin's "Hot Home" indicator. This is not fabricated scarcity — it is real engagement data from the site's own tracking. As traffic builds, this signal becomes increasingly meaningful. The table structure already exists; the only work is exposing the data in the UI. [discovery 02 §engagement_metrics; discovery 03 §DemandIndicators component]

Implementation effort: Very small. The `DemandIndicators` component already exists in the app (discovery 03 §Components Inventory). Review whether it is wired to live `engagement_metrics` data. If not, wire it. 1–2 hours.

Wave priority: **MVP.**

---

### 3.4 Schema gaps (data we should capture but don't)

The following data does not exist in the current schema and must be added before certain MVP or wave-2 features can be built.

#### Lifestyle proximity pre-computes

**What's needed:** For each listing, a pre-computed set of distances to key Central Oregon lifestyle POIs: nearest trailhead (Deschutes River Trail, Shevlin Park, Tumalo State Park, Phil's Trail), nearest ski resort (Mt. Bachelor), nearest river access point (Deschutes River, Tumalo Creek), nearest golf course (Tetherow, Pronghorn, Widgi Creek, River's Edge), and nearest elementary school.

**Why it must be pre-computed:** Calculating these distances at query time for a 590,000-row table via PostGIS is not feasible at search-results latency. Pre-computing on sync and storing as a JSONB column (or typed columns for the top 3 POI categories) on `listings` brings query cost to zero.

**Spec:** New column `listings.lifestyle_proximity` JSONB with structure: `{"trail_km": float, "trail_name": string, "ski_km": float, "river_km": float, "golf_km": float, "golf_name": string}`. Computed by a PostGIS function triggered post-sync. Requires a small (~50-row) `poi_lifestyle` table with lat/lng for each POI (trails, ski, river, golf). This table does not exist and must be created. [discovery 06 §Open Gaps, lifestyle overlays]

**Priority:** MVP for display (show "0.8 miles to Deschutes River Trail" on listing detail); Wave 2 for proximity-based search filter ("within 2 miles of trail").

---

#### Neighborhood polygon boundaries

**What's needed:** The `neighborhoods`, `communities`, and `cities` tables have a `boundary_geojson` column but the tables are currently empty — zero rows. The polygon boundaries for Bend's neighborhoods (NW Crossing, Awbrey Butte, NE Bend, SE Bend, Old Bend, SW Bend, River West, etc.) and the 11 service-area cities need to be populated.

**Source options:** Oregon GIS Data Library for city boundaries; custom-drawn polygons for neighborhood sub-areas (these do not have official definitions and must be drawn by someone who knows the market).

**Priority:** MVP for city boundaries (can be loaded from official GIS sources); Wave 2 for neighborhood sub-area polygons (requires manual drawing).

---

#### School district polygon boundaries

**What's needed:** A `school_districts` table (or additions to the existing schema) containing polygon boundaries for the Bend-La Pine School District, Redmond School District, Sisters School District, etc. This enables the "homes in [School District]" search filter and the school district hub pages (`/schools/districts/{district-slug}`).

**Source:** Oregon Department of Education GIS data (public domain).

**Priority:** Wave 2 (requires GIS data import; school pages are listed as MVP in IA section 4.1 but can launch without polygon boundaries if filtering is by the `school_district` column on `listings` instead).

---

#### Trail / ski / river / golf POI table

**What's needed:** A small (~50 rows) `poi_lifestyle` table with: `id`, `name`, `category` (trail/ski/river/golf), `latitude`, `longitude`, `description` (brief), `url` (optional link to official site or AllTrails). This is required for the lifestyle proximity pre-compute described above.

**Schema proposal:**
```sql
CREATE TABLE public.poi_lifestyle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('trail', 'ski', 'river', 'golf', 'park')),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  description text,
  url text,
  city text,
  created_at timestamptz DEFAULT now()
);
```

**Data to load:** Mt. Bachelor (ski), Deschutes River Trail (trail, multiple access points), Phil's Trail Complex (trail), Shevlin Park (park/trail), Tumalo State Park (trail/river), Deschutes River main access points in Bend, Sunriver, La Pine; Tetherow Golf Club, Pronghorn Golf Club, Widgi Creek, River's Edge, Lost Tracks, Eagle Crest (golf). Approximately 40–55 rows.

**Priority:** MVP (small table, easily loaded manually; required for lifestyle proximity pre-compute).

---

#### Builder canonical-name lookup

**What's needed:** `BuilderName` comes into the system from Spark MLS with inconsistent capitalization and occasional variant spellings ("Hayden Homes", "HAYDEN HOMES", "Hayden Homes LLC", "hayden homes"). A `builder_canonical` table with `raw_name` (text, the value as it arrives from Spark) and `canonical_name` (text, the cleaned display name) and `slug` (text) is required before `/builders/{slug}` pages can be reliably generated.

**Schema proposal:**
```sql
CREATE TABLE public.builder_canonical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name text NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  website_url text,
  created_at timestamptz DEFAULT now()
);
```

**Data seed:** Can be generated from a `SELECT DISTINCT details->>'BuilderName' FROM listings WHERE new_construction_yn = true` query and manually reviewed. Likely 20–40 unique builder names in the Central Oregon market.

**Priority:** MVP (required before builder pages ship).

---

#### HOA detail supplement

**What's needed:** The `details` JSONB contains `AssociationFee` and `AssociationFeeFrequency` for some listings but HOA detail is incomplete for many (especially resale listings where the MLS input is sparse). A `hoa_detail` supplemental table (linked to `communities` via community slug) storing HOA contact, fee, services included, STR eligibility, and pet rules would dramatically enrich neighborhood hub pages.

**Priority:** Wave 2 (requires manual data entry; cannot be automated from MLS).

---

### 3.5 Indexes required

The following indexes are mandatory before the features that depend on them ship. Some already exist; the critical missing one is the GIN index on `details` JSONB. [discovery 02 §Performance concerns, §Top 5 Schema Recommendations]

**Critical — add before any JSONB field exposure:**

```sql
CREATE INDEX CONCURRENTLY idx_listings_details_gin ON public.listings USING gin(details);
```

This index does not exist. Without it, any query filtering on `details->>'ElementarySchool'`, `details->>'BuilderName'`, `details->>'TaxAmount'`, or any other JSONB key performs a full sequential scan of 590,000 rows. At search-results latency, this is a production failure. Add before any JSONB-based filter or display ships. [discovery 02 §Schema Recommendations rank 1]

**Already confirmed to exist (from discovery 02 §listings indexes):**

- `idx_listings_city` — B-tree on `City`
- `idx_listings_city_status` — composite on `City + StandardStatus`
- `idx_listings_school_district` — B-tree on `school_district`
- `idx_listings_year_built` — B-tree on `year_built`
- `idx_listings_price_per_sqft` — B-tree on price/sqft derived column
- `idx_listings_active_filters` — composite covering the primary search filter combination
- `idx_listing_history_key_date` — composite on `(listing_key, event_date)`, covers the main listing history query pattern
- `idx_listing_history_price_change` — partial index for price-change events

**Add for listing detail performance (from discovery 03 §Missing indexes):**

```sql
-- Photos (missing per discovery 03)
CREATE INDEX idx_listing_photos_key ON public.listing_photos(listing_key);

-- Agents (missing)
CREATE INDEX idx_listing_agents_key ON public.listing_agents(listing_key);

-- Open houses (missing)
CREATE INDEX idx_open_houses_key_date ON public.open_houses(listing_key, event_date DESC);
```

**Add for promoted JSONB columns (run after migration that promotes fields):**

```sql
-- After promoting elementary_school, builder_name to typed columns:
CREATE INDEX idx_listings_elementary_school ON public.listings(elementary_school) WHERE elementary_school IS NOT NULL;
CREATE INDEX idx_listings_builder_name ON public.listings(builder_name) WHERE builder_name IS NOT NULL;
CREATE INDEX idx_listings_view_yn ON public.listings(view_yn) WHERE view_yn = true;
CREATE INDEX idx_listings_waterfront_yn ON public.listings(waterfront_yn) WHERE waterfront_yn = true;
```

**Spatial indexes (add when PostGIS proximity pre-compute ships):**

```sql
CREATE INDEX idx_listings_latlong ON public.listings USING gist(
  ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
);
CREATE INDEX idx_poi_lifestyle_latlong ON public.poi_lifestyle USING gist(
  ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
);
```

---

### 3.6 RLS policy map

For every consumer-relevant table, the RLS posture is documented below. P0 items are blockers for lead capture.

| Table | Anon read | Auth read | Auth write | Service-role write | Notes |
|---|---|---|---|---|---|
| `listings` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `listing_photos` | Yes | Yes | No | Yes | Public SELECT (inferred from usage) |
| `listing_videos` | Yes | Yes | No | Yes | Public SELECT |
| `listing_floor_plans` | Yes | Yes | No | Yes | Public SELECT |
| `open_houses` | Yes | Yes | No | Yes | Public SELECT |
| `listing_history` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `price_history` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `status_history` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `listing_agents` | No (assumed service-role) | No | No | Yes | Verify and add public SELECT for `agent_name`, `office_name` only |
| `communities` | Yes | Yes | No | Yes | Public SELECT |
| `neighborhoods` | Yes | Yes | No | Yes | Public SELECT |
| `cities` | Yes | Yes | No | Yes | Public SELECT |
| `brokers` | Yes | Yes | No | Yes | Public SELECT (display columns only) |
| `blog_posts` | Conditional (`status='published'`) | Conditional | No | Yes | Public SELECT where published |
| `market_reports` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `engagement_metrics` | Yes | Yes | No | Yes | Public SELECT confirmed |
| `saved_listings` | **No** | Own rows only | Own rows | Yes | Anon has zero access; write goes through client SDK with auth |
| `saved_searches` | **No** | Own rows only | Own rows | Yes | Same as saved_listings |
| `market_pulse_live` | **BLOCKED — no public SELECT policy** | **BLOCKED** | No | Yes | **P1: Add public SELECT policy before any market widget ships** |
| `listing_inquiries` | **BLOCKED — qual: false** | **BLOCKED — qual: false** | **BLOCKED — qual: false** | Yes | **P0: All inserts silently blocked. Route through service-role API endpoint only.** |
| `valuation_requests` | **BLOCKED — qual: false** | **BLOCKED — qual: false** | **BLOCKED — qual: false** | Yes | **P0: Same as listing_inquiries. Route through service-role API endpoint only.** |
| `profiles` | **No** | Own row only | Own row | Yes | PII — auth gated |
| `open_house_rsvps` | **No** | Own rows | Own rows | Yes | Auth gated |

**P0 fix — `listing_inquiries` and `valuation_requests`:**

The `qual: false` RLS policy means these tables cannot receive any inserts from the Supabase JavaScript client, regardless of auth state. The correct architecture is:

1. The lead-capture form POSTs to a server-side API route (e.g., `/api/inquiries` or `/api/valuations`).
2. The API route uses `SUPABASE_SERVICE_ROLE_KEY` (a secret environment variable, never exposed to the client) to construct a Supabase admin client.
3. The admin client inserts the row into `listing_inquiries` or `valuation_requests`.
4. Immediately after a successful insert, the API route fires the FUB webhook (`POST https://api.followupboss.com/v1/events`) with the lead data.
5. The API route returns `200 OK` to the form.
6. If the Supabase insert fails, the API route returns `500` and logs the error. The form displays an error message to the user. Under no circumstances should a failed lead insert be silently swallowed.

This pattern is the established architecture for any table with `qual: false`. Any developer who touches a lead-capture form must verify the form submits to an API route, not directly to the Supabase client. [discovery 02 §RLS gaps, §Schema Recommendations rank 4]

**P1 fix — `market_pulse_live`:**

```sql
CREATE POLICY "Public read market_pulse_live"
  ON public.market_pulse_live
  FOR SELECT
  TO anon, authenticated
  USING (true);
```

Run as a migration. Verify with `SELECT count(*) FROM market_pulse_live` from an anon Supabase client after migration. [discovery 02 §Schema Recommendations rank 2]

---

### 3.7 Data freshness and sync

**Sync architecture** [discovery 04 §Data/Schema/Sync, resolved conflict from Open Questions batch 1]:

- **Delta sync:** Inngest job, triggers every 2 minutes (primary). Fetches MLS changes since the last sync cursor timestamp. This is the authoritative real-time feed.
- **Full sync:** Vercel cron job, runs every 10 minutes (primary). Fetches all active listings to catch any records missed by delta. The full sync is a safety net, not the first line of freshness.
- **Manual commands** (`sync-delta`, `start-sync`, `sync-parity`, `sync-history-terminal`): backup and testing only. Never used in production to replace scheduled triggers.
- **Cache refresh:** `refresh_listings_breakdown()` RPC runs post-delta-sync as a hook. This updates the `report_listings_breakdown` cache used by market report pages.
- **`market_pulse_live` refresh:** Separate pg_cron job (`mpl_refresh_30min`). Refreshes every 30 minutes from live `listings` aggregations.

**Freshness target:** Any active listing should be no more than 5 minutes stale at any given moment (2-minute delta sync interval + ~1-minute Inngest + Supabase execution overhead). For market stats (via `market_pulse_live`), the ceiling is 35 minutes stale.

**Display "last updated" guidance:**
- Listing detail page: display `ModificationTimestamp` from the `listings` row as "Last updated [date]." Do not display the Supabase `updated_at` timestamp (that is an internal sync field, not meaningful to buyers).
- Market report pages: display `market_pulse_live.updated_at` as "Market data as of [time]." Format in user-local time.
- Do not display a global "site last synced at" timestamp on consumer pages — this creates anxiety without providing value. The sync health widget belongs in the admin dashboard only. [discovery 01; discovery 04]

**Sitemap freshness:** The sitemap.xml regenerates on each post-sync hook invocation. Every active listing's URL appears in the sitemap with `lastmod` set to `ModificationTimestamp`. This ensures Google sees new listings quickly after they appear in MLS. Priority values: homepage 1.0, city pages 0.9, neighborhood pages 0.8, listing detail 0.7, blog 0.6.

---

### 3.8 Compliance constraints on data display

**IDX / MLS attribution:** Every listing card and listing detail page must display the MLS attribution logo and source string as required by the Spark API license agreement and Oregon MLS rules. Specifically: "Listing provided by [ListOfficeName] — Data from Oregon Regional MLS." The attribution must be visible without scrolling on listing detail pages. On listing cards in search results, a compact attribution ("ORMLS") is acceptable per MLS display rules. Failure to include attribution on any consumer-facing listing is a license compliance violation. [CLAUDE.md Data Accuracy; Spark API license]

**Agent-only fields — never expose:** The following fields from the `details` JSONB are marked for internal use only and must never appear on any consumer-facing surface: `ListAgentPreferredPhone`, `BuyerAgentStateLicense`, `BuyerAgentMlsId`, `CoListAgentMlsId`, lockbox codes, showing-instruction text, private remarks, list agent direct email (unless the agent explicitly requests exposure). These fields appear in the `details` JSONB but are excluded from the `DETAIL_LISTING_SELECT` query columns in `listing-detail.ts`. [discovery 03 §Listing Detail; discovery 02 §Data Exposure Map]

**Off-market / withdrawn listings:** Per Oregon MLS policy, listings with `StandardStatus` of `Withdrawn`, `Expired`, or `Cancelled` may not be actively marketed. These listings must not appear in search results or active listing feeds. Listing detail pages for withdrawn/expired listings should display a "This listing is no longer available" state with similar active listings, not the original full detail. The current app handles the `notFound()` path for these cases. [discovery 03 §Listing Detail page analysis]

**Coming-soon listings:** Oregon MLS permits coming-soon status per ORMLS rules. When `StandardStatus = 'Coming Soon'`, display the listing with a "Coming soon" badge, suppress the full address (show city and neighborhood only), do not display a "Schedule showing" button (showings not yet permitted), and display `StartShowingDate` as "Showings begin [date]." This protects the seller and complies with MLS policy.

**Photo licensing:** Listing photos are syndicated under MLS terms. They may be displayed on the website in connection with the listing but may not be used in any standalone marketing material (social posts, flyers, ads) without the listing agent's permission unless Ryan Realty holds the listing. Never cache listing photos on the Ryan Realty CDN without confirming the licensing terms of the specific MLS expansion agreement. Current behavior: photos are displayed directly from Spark S3 URLs via `PhotoURL`. [discovery 02 §listings columns; discovery 03 §Image Strategy]

**Pocket listings / pre-MLS inventory:** If Matt has a pre-MLS listing to promote, it must not be entered into any MLS system until the seller has signed the required Clear Cooperation Policy disclosure and the seller's written consent is documented. Pre-MLS listings on the website are permitted in the "Coming soon" format only. No full listing detail page for a pre-MLS property. [Oregon MLS Clear Cooperation Policy]

**Data accuracy rule applies to all stats:** Any number displayed on the site — market stats, price data, days on market, median prices — must trace to a verified Supabase query with the date window and filter documented. No stat from memory, prior sessions, or LLM knowledge. [CLAUDE.md Data Accuracy]

---

## 4. Information Architecture

The IA is the skeleton that all other sections hang from. Every URL in this section is canonical — no implicit "and others," no hand-waves. Every template reference maps to a section-5 page spec (batch 3). The URL convention, navigation hierarchy, and internal linking strategy defined here govern the entire build. [discovery 04 §Features, existing URL conventions; discovery 03 §117 pages inventory]

---

### 4.1 Sitemap (complete URL tree)

Every URL pattern the site will serve. Hierarchy reflects the navigation tree and the SEO entity model. Static pages are marked `[S]`; dynamically generated from database are marked `[D]`; auth-gated are `[A]`.

```
/                                                         [S] Homepage
│
├── /homes-for-sale                                       [S] Listing search hub
│   ├── /bend                                             [D] Bend listings (city filter pre-applied)
│   ├── /redmond                                          [D] Redmond listings
│   ├── /sisters                                          [D] Sisters listings
│   ├── /sunriver                                         [D] Sunriver listings
│   ├── /la-pine                                          [D] La Pine listings
│   ├── /tumalo                                           [D] Tumalo listings
│   ├── /madras                                           [D] Madras listings
│   ├── /prineville                                       [D] Prineville listings
│   ├── /powell-butte                                     [D] Powell Butte listings
│   ├── /terrebonne                                       [D] Terrebonne listings
│   ├── /crooked-river-ranch                              [D] Crooked River Ranch listings
│   ├── /bend/northwest-crossing                          [D] City + community filter
│   ├── /bend/awbrey-butte                                [D]
│   ├── /bend/old-bend                                    [D]
│   ├── /bend/sw-bend                                     [D]
│   ├── /bend/ne-bend                                     [D]
│   ├── /bend/se-bend                                     [D]
│   ├── /bend/river-west                                  [D]
│   ├── /bend/tetherow                                    [D]
│   ├── /redmond/northwest-redmond                        [D]
│   ├── /redmond/central-redmond                          [D]
│   ├── /sisters/downtown-sisters                         [D]
│   ├── /sunriver/sunriver-village                        [D]
│   ├── /sunriver/sunriver-resort                         [D]
│   └── /{city}/{community}/{address-slug}-{mlsNumber}    [D] Canonical listing detail
│       └── (example: /bend/northwest-crossing/1234-sw-skyline-blvd-25001234)
│
├── /{mlsNumber}                                          [D] Short URL — 308 permanent redirect to canonical
│   └── (example: /25001234 → /bend/northwest-crossing/1234-sw-skyline-blvd-25001234)
│
├── /neighborhoods                                        [S] Neighborhood hub index
│   ├── /bend                                             [S] All Bend neighborhoods (grid/list)
│   │   ├── /northwest-crossing                           [D] NW Crossing neighborhood hub
│   │   ├── /awbrey-butte                                 [D]
│   │   ├── /old-bend                                     [D]
│   │   ├── /sw-bend                                      [D]
│   │   ├── /ne-bend                                      [D]
│   │   ├── /se-bend                                      [D]
│   │   ├── /river-west                                   [D]
│   │   └── /tetherow                                     [D]
│   ├── /redmond                                          [S]
│   │   ├── /northwest-redmond                            [D]
│   │   └── /central-redmond                              [D]
│   ├── /sisters                                          [S]
│   │   └── /downtown-sisters                             [D]
│   └── /sunriver                                         [S]
│       ├── /sunriver-village                             [D]
│       └── /sunriver-resort                              [D]
│
├── /schools                                              [S] Schools hub index
│   ├── /districts                                        [S] School district index
│   │   ├── /bend-la-pine                                 [D] Bend-La Pine School District hub
│   │   ├── /redmond                                      [D] Redmond School District hub
│   │   ├── /sisters                                      [D] Sisters School District hub
│   │   └── /crook-county                                 [D] Crook County SD (Prineville area)
│   ├── /elementary                                       [S] Elementary school index
│   │   ├── /bear-creek-elementary                        [D] Individual school hub
│   │   ├── /elk-meadow-elementary                        [D]
│   │   ├── /ensworth-elementary                          [D]
│   │   ├── /grammar-school-sisters                       [D]
│   │   └── /{school-slug}                                [D] Pattern for all others
│   ├── /middle                                           [S] Middle school index
│   │   ├── /cascade-middle                               [D]
│   │   ├── /pilot-butte-middle                           [D]
│   │   └── /{school-slug}                                [D]
│   └── /high                                             [S] High school index
│       ├── /bend-senior-high                             [D]
│       ├── /mountain-view-high                           [D]
│       ├── /summit-high                                  [D]
│       ├── /redmond-proficiency-academy                  [D]
│       └── /{school-slug}                                [D]
│
├── /builders                                             [S] Builder index
│   ├── /hayden-homes                                     [D] Builder hub — all listings + communities
│   ├── /dr-horton                                        [D]
│   ├── /hubble-homes                                     [D]
│   └── /{builder-slug}                                   [D] Pattern for all others
│
├── /market-reports                                       [S] Market reports hub (city selector)
│   ├── /bend                                             [D] Bend market report (current period)
│   │   ├── /2026-q2                                      [D] Specific period
│   │   ├── /2026-q1                                      [D]
│   │   └── /{YYYY-qN}                                    [D] Pattern for all historical periods
│   ├── /redmond                                          [D]
│   │   └── /{YYYY-qN}                                    [D]
│   ├── /sisters                                          [D]
│   │   └── /{YYYY-qN}                                    [D]
│   ├── /sunriver                                         [D]
│   │   └── /{YYYY-qN}                                    [D]
│   ├── /la-pine                                          [D]
│   ├── /central-oregon                                   [D] Regional roll-up report
│   │   └── /{YYYY-qN}                                    [D]
│   └── /explore                                          [S] Self-serve report builder (city + date range)
│
├── /lifestyle                                            [S] Lifestyle hub index
│   ├── /trails                                           [S] Trails + outdoor recreation
│   │   └── /deschutes-river-trail                        [S] Individual trail page
│   │   └── /phils-trail                                  [S]
│   │   └── /shevlin-park                                 [S]
│   │   └── /tumalo-state-park                            [S]
│   ├── /ski                                              [S] Mt. Bachelor + ski lifestyle
│   ├── /river                                            [S] Deschutes River access + rafting + fishing
│   └── /golf                                             [S] Golf courses + communities
│
├── /moving-to-bend                                       [S] Relocation hub ("Moving to Bend")
│   ├── /neighborhoods                                    [S] Neighborhood comparison for relocators
│   ├── /schools                                          [S] School overview for relocators
│   ├── /cost-of-living                                   [S] Cost-of-living context
│   ├── /outdoor-recreation                               [S] Lifestyle overview
│   └── /getting-here                                     [S] Airports, drive times, access
│
├── /sell                                                 [S] Seller hub + valuation entry point
│   ├── /home-valuation                                   [S] Valuation form (alias: /home-valuation)
│   ├── /sellers-guide                                    [S] Seller education content
│   └── /listing-process                                  [S] Matt's listing process explained
│
├── /buy                                                  [S] Buyer hub + guide
│   ├── /buyers-guide                                     [S] Buyer education content
│   └── /financing                                        [S] Mortgage + pre-approval context
│
├── /mortgage-calculator                                  [S] Standalone mortgage calculator
│
├── /agents                                               [S] Team index
│   └── /matt-ryan                                        [S] Matt's profile page
│   └── /{agent-slug}                                     [D] Future team members
│
├── /blog                                                 [S] Blog index
│   ├── /category                                         [S] Category index
│   │   ├── /market-updates                               [D] Category landing
│   │   ├── /buyer-guides                                 [D]
│   │   ├── /seller-guides                                [D]
│   │   ├── /neighborhood-guides                          [D]
│   │   ├── /investment-real-estate                       [D]
│   │   └── /{category-slug}                              [D]
│   └── /{post-slug}                                      [D] Individual blog post
│
├── /tour                                                 [S] Tour scheduling (Calendly embed or custom)
│
├── /compare                                              [S] Listing comparison tool
│   └── ?listings={mlsNum},{mlsNum},{mlsNum}              [S] Query-param-driven; no separate URLs per comparison
│
├── /open-houses                                          [S] Open house calendar index
│   ├── /bend                                             [D] Open houses in Bend
│   ├── /redmond                                          [D]
│   └── /{city}                                           [D] All cities
│
├── /contact                                              [S] Contact form
│
├── /account                                              [A] Auth-gated user dashboard
│   ├── /saved-listings                                   [A]
│   ├── /saved-searches                                   [A]
│   ├── /tour-requests                                    [A]
│   └── /messages                                         [A] (phase 2)
│
├── /sign-in                                              [S] Auth entry (Google OAuth)
├── /sign-up                                              [S] Registration + interest segmentation
│
├── /admin                                                [A] Broker-only admin (super_admin role)
│   ├── /listings                                         [A] Listing management
│   │   └── /[listingKey]                                 [A] Edit/review individual listing
│   ├── /brokers                                          [A] Broker profiles
│   │   └── /new                                         [A]
│   │   └── /[brokerSlug]                                 [A]
│   ├── /geo                                              [A] Geographic data (cities, neighborhoods, communities)
│   │   ├── /cities                                       [A]
│   │   ├── /neighborhoods                                [A]
│   │   └── /communities                                  [A]
│   ├── /blog                                             [A] Blog post management
│   │   └── /new                                         [A]
│   │   └── /[postSlug]                                   [A]
│   ├── /market-reports                                   [A] Market report management
│   ├── /leads                                            [A] Lead inbox (FUB mirror)
│   ├── /analytics                                        [A] GA4 + FUB KPI dashboard
│   ├── /sync                                             [A] Sync health + manual triggers
│   ├── /audit-log                                        [A] Admin action audit log
│   ├── /settings                                         [A] Site settings + AdSense slot config
│   └── /setup                                            [A] First-time setup flow
│
├── /landing                                              [S] Social traffic landing pages
│   ├── /instagram                                        [S] IG bio link destination
│   └── /tiktok                                           [S] TikTok bio link destination
│
└── /legal                                                [S] Legal pages
    ├── /privacy                                          [S] Privacy policy
    ├── /terms                                            [S] Terms of use
    ├── /fair-housing                                     [S] Equal Housing Opportunity statement
    ├── /dmca                                             [S] DMCA notice and takedown
    ├── /accessibility                                    [S] Accessibility statement (WCAG 2.1 AA)
    └── /mls-attribution                                  [S] MLS attribution and disclaimer
```

**Deviation flags from existing app:**

The current app uses `/listings/[listingKey]` as the listing detail URL [discovery 03 §Page Inventory]. The canonical URL in the new build is `/homes-for-sale/{city}/{community}/{address-slug}-{mlsNumber}`. The old `/listings/[listingKey]` URL pattern must redirect (308 permanent) to the new canonical pattern. The `/{mlsNumber}` short URL is a new addition — it does not exist in the current app and must 308 redirect to canonical without bypassing the Vercel CDN cache. [discovery 04 §Features — canonical listing URL decision; note from prompt re: discovery 07 CDN cache bypass]

The current app uses `/housing-market/*` for market-related pages [discovery 03 §Pages Inventory]. The new build uses `/market-reports/{city}`. The old `/housing-market/` URL pattern must 308 to the new path. Preserve any `/housing-market/reports/{slug}` URLs that may be indexed.

---

### 4.2 URL conventions

**Rules governing every URL in the system:**

1. **Case:** Lowercase only. No uppercase letters in any URL segment.
2. **Word separator:** Hyphens only (kebab-case). No underscores, no camelCase, no spaces.
3. **Trailing slash:** None. `ryan-realty.com/homes-for-sale/bend` is canonical. `ryan-realty.com/homes-for-sale/bend/` (with trailing slash) returns 301 redirect to the no-slash version. This is consistent with the existing decision in `DOMAIN_SETUP.md`. [discovery 04 §Operations/Deployment decisions]
4. **Canonical listing URL:** `/homes-for-sale/{city-slug}/{community-slug}/{address-slug}-{mlsNumber}`. The `address-slug` is generated from the street number and street name, lowercased, hyphens for spaces. The `mlsNumber` (the value in `listings.ListNumber`) anchors the URL and makes it stable even if the address display changes. Example: `/homes-for-sale/bend/northwest-crossing/1234-sw-skyline-blvd-25001234`.
5. **Short URL for sharing:** `/{mlsNumber}`. 308 permanent redirect to canonical. Must pass through the Vercel CDN caching layer, not bypass it (per the discovery 07 note in the prompt — the existing short-URL implementation bypasses CDN cache-control headers, which must be fixed). The CDN should cache the redirect.
6. **English only at MVP:** No `/en/` or `/es/` URL prefix. Single language.
7. **Pagination:** Query parameter only. `?page=2`, not `/page/2`. No page 1 parameter — `/homes-for-sale/bend` with no pagination parameter always means page 1. [discovery 04]
8. **Search filters:** Query parameters. Examples: `?beds=3&minPrice=500000&maxPrice=900000&status=active`. Filter parameters are lowercase with underscores. Not included in the canonical URL for sitemap purposes.
9. **Map view toggle:** `?view=map` or `?view=list` or `?view=grid`. Default (no parameter) = grid.
10. **UTM parameters:** Preserved through all redirects. The redirect chain from social channels must pass UTM parameters to the final landing URL intact. Verified via GA4 session attribution.
11. **Sitemap auto-generation:** `/sitemap.xml` is dynamically generated from Supabase. Includes all active listing canonical URLs, all city/neighborhood/school/builder pages, all blog posts, and all market report pages. Regenerated on post-sync hook. `lastmod` on listing URLs = `ModificationTimestamp` from the `listings` row.
12. **robots.txt disallows:** `/admin/`, `/api/`, `/auth/`, `/account/`. [discovery 04 §SEO decisions]
13. **No 404 on sold listings — use "no longer available" state.** When a listing is withdrawn/expired/sold, the detail URL returns a soft "no longer available" page with similar active listings — not a 404. 404s on listing detail pages waste the SEO equity earned from inbound links. Only delete a URL if the listing was never legitimately published (e.g., test data).

---

### 4.3 Primary navigation

The header navigation is sticky on all pages (stays visible as the user scrolls). It renders in a single row on desktop and collapses to a hamburger on mobile.

**Desktop header (left to right):**

| Element | Target | Behavior |
|---|---|---|
| Logo (Ryan Realty heritage wordmark, navy on cream) | `/` | No mega-menu; direct link |
| "Homes for sale" | `/homes-for-sale` | Mega-menu on hover — columns: Cities (all 11 service areas), Featured Neighborhoods (NW Crossing, Awbrey Butte, Sunriver, Sisters), Property Types (New construction, Luxury, Land), Quick links (Open houses, Map search) |
| "Neighborhoods" | `/neighborhoods` | Mega-menu on hover — columns: Bend neighborhoods (8), Other areas (Redmond, Sisters, Sunriver) |
| "Market reports" | `/market-reports` | No mega-menu; direct link to market hub |
| "Sell" | `/sell` | Dropdown: Get a home value, Sellers guide, Start the conversation |
| "About" | `/agents/matt-ryan` | No mega-menu; direct link to Matt's profile |
| Search icon (magnifying glass) | Opens header search overlay | Command-palette-style overlay with immediate query input; suggests cities, neighborhoods, addresses |
| "Sign in" (if unauthenticated) or user avatar (if authenticated) | `/sign-in` or `/account` | No mega-menu |

**Mobile header (hamburger sheet):**

Slides in from the right as a full-height sheet (`<Sheet>` from shadcn). Contains the same items as desktop nav in a vertical list, plus social icon links (Instagram, YouTube, TikTok) at the bottom. No mega-menus on mobile — tap expands to show sub-links for the item tapped.

**Sticky behavior:** The header scrolls with the page until the user scrolls down 80px, at which point it becomes sticky (fixed top, with a solid background). On listing detail pages, the sticky header is replaced by the listing-specific sticky bar (`ShowcaseStickyBar` component — price, beds/baths/sqft, agent CTA) which replaces the main header on scroll. [discovery 03 §ShowcaseStickyBar]

---

### 4.4 Footer navigation

The footer is a multi-column layout rendered on all non-admin pages. It is not sticky.

**Column 1 — Search & Discover:**
- Homes for sale in Bend
- Homes for sale in Redmond
- Homes for sale in Sisters
- Homes for sale in Sunriver
- View all neighborhoods
- Market reports
- Open houses

**Column 2 — Sell Your Home:**
- Get a home value
- Seller's guide
- Listing process
- Current market (links to `/market-reports/bend`)

**Column 3 — About Ryan Realty:**
- Meet Matt Ryan
- Blog
- Moving to Bend
- Contact

**Column 4 — Tools & Resources:**
- Mortgage calculator
- Listing comparison
- School finder
- Lifestyle map

**Bottom row (full-width):**
- Left: Equal Housing Opportunity logo | Oregon principal broker license display ("Oregon Lic. #XXXXXX — Matt Ryan, Principal Broker") | Ryan Realty LLC
- Center: Legal links in a row — Privacy policy · Terms · Fair housing · DMCA · Accessibility · MLS attribution
- Right: Social icons (Instagram, YouTube, TikTok) — each links to Matt's profile on that platform

**Design:** The footer uses `bg-card` background with `text-muted-foreground` for link text and `text-foreground` for column headings. All footer links use `text-sm`. The column grid collapses to a 2-column layout on tablet and single-column on mobile. [CLAUDE.md Design System Rules]

---

### 4.5 Contextual navigation

Per page template, the navigation context that appears in addition to the primary header/footer.

**Listing detail page:**
- Breadcrumb (schema.org BreadcrumbList): Home › Homes for sale › {City} › {Community} › {Address}
- "Back to results" link (if user arrived from a search results page — derived from referrer or session state, not from browser history)
- Sticky listing bar on scroll (price, specs, "Schedule a tour" CTA, "Contact" CTA) — replaces the main header
- Related listings sidebar/section: "Similar homes in {Community}" (3–4 cards)
- Agent card: Matt's photo, name, phone, "Contact about this listing" button

**Neighborhood hub page:**
Tabs (`<Tabs>` from shadcn) with the following tabs in order:
1. Overview (intro, highlights, map)
2. Listings (active listings in this neighborhood, filtered IDX)
3. Market (neighborhood-specific stats from `market_pulse_live` where `geo_slug = {neighborhood-slug}`)
4. Schools (schools serving this neighborhood from `ElementarySchool`/`MiddleSchool`/`HighSchool` data)
5. Lifestyle (proximity to trails, ski, river, golf from `lifestyle_proximity` pre-compute)
6. Recently sold (closed listings in past 90 days in this neighborhood)

**Market report page:**
- City selector (dropdown or tab row): Bend | Redmond | Sisters | Sunriver | La Pine | Central Oregon
- Period selector (dropdown): Current quarter | Q1 2026 | Q4 2025 | ... (last 8 quarters)
- Related neighborhoods section: "See neighborhood-level detail" links to neighborhood hub pages in this city

**School hub page:**
- District picker: Bend-La Pine | Redmond | Sisters | Crook County
- Grade-level tabs: Elementary | Middle | High
- "Homes near this school" section: link to `/homes-for-sale/{city}?school={school-slug}` filtered search

**Search results page:**
- Filter sidebar (desktop) / filter sheet (mobile): beds, baths, price range, sqft range, lot size, property type, HOA (yes/no), new construction, pool, view, architectural style, school district
- Sort selector: Newest, Price (low/high), Days on market, Price reduction
- View toggle: Grid | List | Map

**Blog post page:**
- Category breadcrumb: Blog › {Category} › {Post title}
- Related posts (3 cards) from the same category
- Inline CTAs: relevant listing search or neighborhood hub link, based on post content

---

### 4.6 Internal linking strategy

Internal links serve two purposes simultaneously: user navigation pathways and SEO topical authority signals. Every cross-link between entity types listed below should be implemented — not as a suggestion but as a required data relationship surfaced in the UI.

**Listing detail → outbound links (required):**
- School pages: link `ElementarySchool`, `MiddleSchool`, `HighSchool` values to their respective `/schools/{level}/{school-slug}` pages. Display as: "Elementary: [Bear Creek Elementary](link)."
- Neighborhood hub: link `SubdivisionName` to `/neighborhoods/{city}/{neighborhood-slug}`. Display in breadcrumb and in the "About this neighborhood" section on listing detail.
- Community page: if `CommunityFeatures` includes HOA amenity data, link to a `/neighborhoods/{city}/{community-slug}` community page where applicable.
- Builder page: if `new_construction_yn = true` and `BuilderName` is populated, link to `/builders/{builder-slug}`. Display as: "Built by [Hayden Homes](link)."
- Market report: link "Bend market report" text in the "Area market context" module to `/market-reports/{city}`.
- City listing feed: breadcrumb link from listing detail up to `/homes-for-sale/{city}`.

**Neighborhood hub → outbound links (required):**
- All schools in the district: in the "Schools" tab, link each school name to its `/schools/{level}/{school-slug}` page.
- Active listings in neighborhood: the "Listings" tab links to search results pre-filtered to this neighborhood.
- Market report: link to `/market-reports/{city}` in the "Market" tab header.
- City landing page: breadcrumb from neighborhood hub up to `/neighborhoods/{city}`.
- Nearby lifestyle POIs: in the "Lifestyle" tab, link trail/ski/golf POIs to the relevant `/lifestyle/{category}` page.

**School page → outbound links (required):**
- Listings in district: "Homes in {SchoolName}'s attendance area" section links to `/homes-for-sale/{city}?school={school-slug}`.
- Neighborhood hub: link from school page to the neighborhood(s) that feed into this school.
- District hub: link from individual school pages up to `/schools/districts/{district-slug}`.

**Builder page → outbound links (required):**
- All active listings from that builder: filtered `/homes-for-sale` search pre-filtered by `builder_name`.
- Neighborhood hubs: link to each neighborhood hub where this builder has active inventory.
- "New construction in {City}" section: links to city-level new construction searches.

**Lifestyle page → outbound links (required):**
- Listings within X miles: "Homes near {Trail Name}" section links to `/homes-for-sale/{city}?proximity=trail-slug&max_km=2`. (Requires lifestyle proximity pre-compute from section 3.4 to function as a search filter; at MVP, link to the nearest city search page as a fallback.)
- Neighborhood hubs near this POI: e.g., the Deschutes River Trail lifestyle page links to the River West and NW Crossing neighborhood hubs.

**Market report → outbound links (required):**
- Neighborhood hubs: "Explore by neighborhood" section on every market report page links to all neighborhood hubs in that city.
- Featured active listings: 3–6 current active listings in the city, linked to listing detail pages.
- Historical period reports: navigation between periods (e.g., "See Q1 2026 report") links to `/market-reports/{city}/{period}`.

**Blog post → outbound links (required):**
- Relevant listings: any blog post mentioning a specific neighborhood, price range, or property type should include 2–4 matching active listings embedded in the post body or sidebar.
- Neighborhood hub: any mention of a specific neighborhood in the post body should link to the neighborhood hub page.
- Market report: any mention of market statistics should link to the relevant market report page.
- CTA link at post bottom: every blog post ends with a CTA that links to either the home valuation tool (seller-oriented posts) or the IDX search (buyer-oriented posts), with an appropriate query-param pre-filter.

**Signal summary:** Each of these link relationships is simultaneously a user pathway and an SEO topical authority signal. A listing detail page that links to a school page tells Google that listing detail pages and school pages are related entities. When school pages link back to listings in their attendance area, the bidirectional relationship reinforces the authority of both page types. The builder-to-listing-to-neighborhood triangle forms a three-node topical cluster that no Bend competitor has built. [discovery 06 §Lifestyle moat; discovery 05 §Schools gap]

---

### 4.7 Search architecture entry points

Users initiate listing search from multiple surfaces across the site. Each entry point feeds the same core search engine (`/homes-for-sale`) with pre-set parameters.

**1. Header search overlay (every page):**
Triggered by the magnifying-glass icon in the header. Renders a command-palette-style overlay (full-width on mobile, 600px centered on desktop). Accepts free-text input. Auto-suggests: city names, neighborhood names, school names, builder names, community feature keywords, and MLS number direct lookup. Selecting a suggestion navigates to the appropriate URL. For free-text city or neighborhood, navigates to the filtered search. For MLS number, navigates directly to the listing detail page.

**2. Hero search (homepage, neighborhood hubs, city landing pages, relocation hub):**
A large single-input search field with a prominent "Search homes" CTA. Typing into it shows the same suggestions as the header overlay. Below the input on the homepage: quick-filter chips for the most common searches ("Homes in Bend under $600K," "3+ bedrooms in NW Crossing," "New construction in Redmond").

**3. Refined filter sidebar (/homes-for-sale):**
The full filter panel on the search results page. Contains: city multi-select, price range, beds minimum, baths minimum, sqft range, lot size range, property type multi-select, HOA (any/yes/no), new construction (checkbox), pool (checkbox), view (checkbox), waterfront (checkbox), architectural style multi-select, school district multi-select, days on market maximum. On mobile this renders as a bottom sheet triggered by a "Filter" button. The current filter state is reflected in the URL query parameters and is bookmarkable/shareable.

**4. Saved searches (/account/saved-searches):**
Auth-required. Shows the user's saved searches with the name they gave the search, the filter criteria, alert frequency (immediate/daily/weekly), and when a new matching listing was last found. Clicking a saved search re-runs it with the saved parameters.

**5. Map polygon draw (/homes-for-sale?view=map):**
When the user selects map view, a "Draw search area" tool appears (pencil icon). The user draws a freehand boundary on the map. Listings inside the polygon are returned. The polygon is encoded as a WKT or GeoJSON parameter in the URL. This enables the "polygon search" feature identified as a priority for the local repeat buyer persona and as a feature that no local Bend competitor offers. [discovery 06 §Feature Matrix; section 2.3.3 Kevin persona]

**6. Lifestyle proximity filter (/homes-for-sale?proximity_trail_km=2):**
The differentiating search feature. Once lifestyle proximity pre-computes are populated on `listings` (section 3.4), a "Lifestyle" filter group appears in the filter sidebar: "Within X miles of: Deschutes River Trail / Mt. Bachelor / Deschutes River / Golf course." This filter uses the pre-computed `lifestyle_proximity` JSONB column on `listings` rather than a live PostGIS query. At MVP launch without pre-computes, this section renders as a teaser with a "Coming soon" state to establish the feature expectation.

**7. Natural language input (wave 2):**
Not at MVP. Rationale: Zillow, Redfin, and Realtor.com all have AI natural-language search with hundreds of engineering years behind them. A local brokerage competing on this axis at MVP would ship an inferior version. Wave 2, after the structured search is polished, evaluate using an LLM to parse user-typed natural language into structured query parameters that feed the existing filter system — the "AI" layer is thin translation logic, not a full semantic search engine. [discovery 06 §Where Matt Should Skip]

---

### 4.8 Breadcrumbs

Schema.org `BreadcrumbList` JSON-LD is applied to every page type that has a hierarchical position in the IA. The breadcrumb is also rendered visually on desktop (below the header, above the page content).

**Visual rendering spec:** Navy text (`text-primary`), `›` separator, current page is bold and non-linked. All ancestor nodes are linked. Uses the `<BreadcrumbNav>` component (confirmed in inventory [discovery 03 §Layout components]).

**Schema.org markup format:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://ryan-realty.com/"},
    {"@type": "ListItem", "position": 2, "name": "Homes for sale", "item": "https://ryan-realty.com/homes-for-sale"},
    {"@type": "ListItem", "position": 3, "name": "Bend", "item": "https://ryan-realty.com/homes-for-sale/bend"},
    {"@type": "ListItem", "position": 4, "name": "Northwest Crossing", "item": "https://ryan-realty.com/homes-for-sale/bend/northwest-crossing"},
    {"@type": "ListItem", "position": 5, "name": "1234 SW Skyline Blvd"}
  ]
}
```

**Per page type:**

| Page type | Breadcrumb chain |
|---|---|
| Listing detail | Home › Homes for sale › {City} › {Community} › {Address} |
| City listing page | Home › Homes for sale › {City} |
| Community listing page | Home › Homes for sale › {City} › {Community} |
| Neighborhood hub | Home › Neighborhoods › {City} › {Neighborhood} |
| School (individual) | Home › Schools › {District} › {School Name} |
| School district | Home › Schools › Districts › {District Name} |
| Market report (city) | Home › Market reports › {City} |
| Market report (period) | Home › Market reports › {City} › {Period} |
| Builder hub | Home › Builders › {Builder Name} |
| Blog post | Home › Blog › {Category} › {Post Title} |
| Blog category | Home › Blog › {Category} |
| Lifestyle sub-page | Home › Lifestyle › {Category} |
| Legal page | Home › Legal › {Page Title} |

---

### 4.9 404 / 500 / error handling

**404 — Page not found:**
Custom 404 page (`app/not-found.tsx`). Contains:
- Heading: "We couldn't find that page." (sentence case, no apology cliché)
- A search bar (same component as header search) with placeholder "Search for a home, neighborhood, or market report"
- Three quick-destination cards: "Browse homes in Bend" (links to `/homes-for-sale/bend`), "See the Bend market report" (links to `/market-reports/bend`), "Get a home value" (links to `/sell/home-valuation`)
- No listing of all pages. No "here are some popular pages" generic link dump.

**500 — Server error:**
Static page (cannot depend on data fetches). Contains:
- Heading: "Something went wrong on our end."
- Body: "We know about it and are working on a fix. Try again in a few minutes, or [contact us](link)."
- A link to `/contact` and a link back to `/` (homepage).

**Listing not found / sold / withdrawn:**
When a user navigates to a listing detail URL for a listing whose `StandardStatus` is `Withdrawn`, `Expired`, `Cancelled`, or `Sold` (and `CloseDate` is more than 14 days ago), the page renders a "no longer available" state instead of a 404. Contains:
- Heading: "This home is no longer available."
- The listing's last-known photo, address, and price (from the `listings` row — even closed listings remain in `listings` with their final status).
- "Similar homes in {Community}": 3–4 active listings with the same bedroom count and within 20% of the last list price, in the same city. Generated from a live Supabase query at render time.
- "Save a search for {Community}": a saved-search CTA with the community pre-filled, so the user is notified when a similar home lists.
- Do not return HTTP 404 for sold listings — return HTTP 200 with this state. Google will continue to index the URL as a relevant "similar homes" landing page.

**Search with no results:**
When a search filter combination returns zero listings:
- Empty state (do not return an error page — this is a valid search state).
- Text: "No homes match those filters right now. {City} has {N} active listings — try adjusting your search." Where {N} is a live count from `market_pulse_live.active_count` for the selected city.
- Below: 3–4 "You might also like" suggestions: widen the price range by ±15%, remove one filter (the most restrictive one, determined heuristically), or search an adjacent neighborhood.

**Map outside service area:**
If a user pans the map to an area outside Central Oregon, display a gentle overlay: "Ryan Realty serves Central Oregon. Zoom back in to see listings." The map does not return an error — it simply shows no listing pins outside the service area.

---

### 4.10 Sitemap generation

**Mechanism:** Next.js `app/sitemap.ts` route that generates `sitemap.xml` dynamically from Supabase. Called on demand by Google (not pre-built at deploy time). Cached at the Vercel Edge for 1 hour. Regenerated on post-sync hook by sending a cache-bust request to the sitemap URL.

**Inclusions:**

| Page type | URL source | `lastmod` source | Priority | changefreq |
|---|---|---|---|---|
| Homepage | Static | Deploy date | 1.0 | weekly |
| All 11 city listing pages | Static list | Weekly | 0.9 | daily |
| All neighborhood hub pages | `neighborhoods.slug` | `neighborhoods.updated_at` | 0.8 | weekly |
| All active listing canonical URLs | `listings` where `StandardStatus = 'Active'` | `listings.ModificationTimestamp` | 0.7 | always |
| All school pages | Generated from distinct `details->>'ElementarySchool'` etc. | Monthly | 0.7 | monthly |
| All builder pages | `builder_canonical.slug` | Monthly | 0.6 | monthly |
| All market report pages (current period) | Static + dynamic period list | Weekly | 0.8 | weekly |
| All blog posts (published) | `blog_posts.slug` where `status='published'` | `blog_posts.updated_at` | 0.6 | monthly |
| All lifestyle pages | Static list | Monthly | 0.5 | monthly |
| /moving-to-bend and sub-pages | Static list | Monthly | 0.6 | monthly |
| /sell, /buy, /contact | Static | Monthly | 0.5 | monthly |
| /agents/matt-ryan | Static | Monthly | 0.6 | monthly |

**Exclusions (robots.txt confirms):** `/admin/`, `/api/`, `/auth/`, `/account/`, all search-result URLs (infinite parameter space), all query-param URLs (filters, pagination), `/compare` (query-param-driven).

**Sold/expired listings:** Do not include listings with `StandardStatus` in `('Withdrawn', 'Expired', 'Cancelled')` in the sitemap. Include `Closed` (sold) listings only for 90 days post-close (`CloseDate >= now() - interval '90 days'`), then drop from sitemap to let Google naturally delist.

**Sitemap index file:** If the number of active listings exceeds 50,000 URLs (unlikely at MVP given Bend market size but planned for scale), split into a sitemap index file pointing to multiple sitemap files by entity type (listings sitemap, neighborhoods sitemap, schools sitemap, etc.).

---

_End of sections 3 and 4. Next batch (3) covers section 5 (Public Pages), section 6 (User Dashboard), section 7 (Admin Dashboard), and section 8 (Component Inventory). The spec status table and open questions list are updated below._

---

## Open Questions (updated — batch 2)

_Items 1, 2, 3, and 5 from batch 1 are now resolved or updated below. Item 4 (revenue math median) remains open pending a live Supabase query._

1. **Design tokens — RESOLVED.** The Ryan Realty Design System handoff ZIP (`/tmp/ryan-design-extract/ryan-realty-design-system/project/colors_and_type.css`) is the canonical source for color, typography, and spacing tokens. Before any UI component is built in batch 3, compare the handoff ZIP tokens against the current `app/globals.css`. Any divergence is corrected in the build plan (batch 4). The specific divergence check is: compare `--color-primary`, `--color-accent`, `--font-sans`, and `--radius` values between the two files.

2. **`entity_media` migration — OPEN.** Status of the `entity_media` polymorphic media table in the hosted Supabase project (`dwvlophlbvvygjfxcrhm`) is unconfirmed. The discovery 02 audit did not surface this table in the schema. Run `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='entity_media'` to confirm. If the table does not exist, section 5 (Public Pages) will specify media via the existing per-entity columns (`hero_image_url` on `communities`, `photo_url` on `brokers`, etc.) rather than `entity_media`.

3. **Display ads — RESOLVED.** Google AdSense for on-site display ad revenue at MVP. Facebook Audience Network as potential supplement (evaluate at launch). Wave-2: Mediavine when monthly sessions clear ~50K. NO native sponsorship, NO preferred lenders, NO title companies, NO mortgage brokers — Matt corrected the model 2026-04-25. Slot inventory and placement rules codified in section 1.4.3. Paid traffic acquisition via Google Ads + Facebook Ads documented in section 1.4.4 — separate from on-site monetization. [chat 2026-04-25]

4. **Median Bend sale price — OPEN.** The revenue math in section 1.3 uses ESTIMATE values for median sale price. This must be verified before any consumer-facing surface displays a market figure. Query: `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "ClosePrice") FROM listings WHERE "PropertyType" = 'A' AND "City" = 'Bend' AND "CloseDate" >= now() - interval '365 days'`. Unresolved until verified in a session with Supabase access.

5. **FUB seller vs. buyer routing — RESOLVED.** Seller leads (valuation form submissions) → FUB stage "New Seller Lead" → notify Matt. Buyer leads (registration, inquiry, tour request) → FUB stage "New Buyer Lead" → on-rotation broker (Matt is default since no other brokers are in rotation at MVP). Tag schema: seller leads tagged `source:valuation-form`; buyer leads tagged `source:registration` or `source:tour-request` or `source:listing-inquiry`. Tag schema to be fully codified in section 10 (Integrations), batch 4. [chat 2026-04-25]
