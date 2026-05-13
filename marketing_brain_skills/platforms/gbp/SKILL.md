# GBP Platform Playbook — Ryan Realty

**Skill owner:** Marketing brain  
**Last updated:** 2026-05-13  
**Source of truth for metrics:** `marketing_channel_daily` (channel='gbp', source='gbp_performance_api_v1')  
**Voice canon:** `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` (Matt's 23 first-party review responses)

---

## 1. Platform Overview

Google Business Profile (GBP) is the single highest-leverage local SEO asset Ryan Realty controls. It surfaces the business in three places simultaneously: the Map Pack (the 3-pin carousel above organic results), the Knowledge Panel (right-rail brand card), and Google Maps. Of the three, the Map Pack is the most valuable real estate above the fold — it appears for "real estate agent Bend," "homes for sale Bend OR," "sell my house Bend," and dozens of similar queries before a single organic link shows.

For a local brokerage, Map Pack placement is frequently worth more than a Page 1 SEO ranking because:

1. Map Pack results appear above organic results — more eyeballs before the scroll.
2. Click-to-call is one tap. The friction to reach you from the Map Pack is lower than from any website visit.
3. Local intent is already qualified. "Real estate agent Bend" is a buyer or seller; "real estate tips" is not.
4. Competitor brokerage websites (Windermere, Compass, national portals) rank organically; the Map Pack is one channel where a single-agent brokerage with a strong local footprint can outrank a franchise.

Sources: BrightLocal "Local Consumer Review Survey 2024"; Whitespark "Local Search Ranking Factors 2023"; Sterling Sky "Google Business Profile Optimization Guide 2024."

---

## 2. Algorithm Primer — How Google Ranks in the Map Pack

Google's Local ranking documentation names three factors. They interact multiplicatively — strength in all three beats strength in one.

### 2a. Relevance

Does the profile match what the user searched? Controlled by:
- **Primary category.** For Ryan Realty: "Real Estate Agency." Secondary categories can be added ("Real Estate Agent," "Property Management Company" if applicable). The primary category is the dominant relevance signal — pick exactly what the business does most.
- **Business description.** 750-character field. Include "Bend, OR," "Central Oregon," and service types ("buy," "sell," "listing," "buyer representation") naturally. Not keyword-stuffed — Google penalizes that.
- **Services list.** GBP allows adding individual services under each category. List every service Ryan Realty offers: Buyer Representation, Seller Representation, Listing Services, CMA, Relocation, etc.
- **Google Posts.** Fresh posts with relevant local keywords signal active management and relevance.
- **Q&A.** Google scrapes Q&A content for relevance signals. Seed it with real questions and real answers.

### 2b. Distance

Physical proximity to the searcher's location. Not directly controllable (office address is the office address). What you can control:
- **Accurate address.** Identical to what's in ORMLS, the state license board, and every other citation. NAP consistency (Name, Address, Phone) across the web tells Google the address is authoritative.
- **Service area definition.** GBP allows defining a service area radius or named cities. For Ryan Realty: Bend, Redmond, Sisters, La Pine, Prineville, Sunriver (all served). Adding these tells Google the profile is relevant for searches from within those areas.
- **Citation footprint.** 50+ consistent NAP citations (Yelp, Zillow, Realtor.com, BBB, local chambers) reduce Google's uncertainty about the address and boost trust.

### 2c. Prominence

How well-known and trusted is the business across the web? Driven by:
- **Review count and average rating.** The single most actionable prominence signal. Whitespark (2023 Local Search Ranking Factors) ranks "quantity of Google reviews" as the #3 overall local pack factor and "high numerical Google ratings" as #4. Sterling Sky (2024) confirms review velocity (new reviews per month) is a separate signal from total count.
- **Review response rate.** Google's own documentation says responding to reviews shows you value feedback. BrightLocal (2024) found 88% of consumers would use a business that responds to all reviews. Google's algorithm rewards consistent response behavior.
- **Google Posts activity.** Active posting signals a managed, authoritative profile.
- **Organic backlink authority.** High-authority backlinks to ryan-realty.com spill over into GBP prominence. A link from Oregon Association of Realtors or Bend Magazine matters more than 100 directory links.
- **Photo count and recency.** Google counts photos and freshness. Profiles with more photos and recent uploads rank higher. (BrightLocal 2024: profiles with photos receive 42% more direction requests and 35% more website clicks.)

### NAP Consistency — Non-negotiable

The business name in GBP must be identical to the registered DBA: "Ryan Realty." Adding "Bend OR Real Estate" or "— Top Bend Realtor" to the GBP name violates Google's guidelines (guideline: "Represent your business as it's consistently represented and recognized in the real world"). Name-stuffing is an audit trigger and can result in listing suspension. Suspension takes weeks to resolve with Google Support.

Source: Google Business Profile Help Center — "Guidelines for representing your business on Google."

---

## 3. Metrics Deep-Dive

All metrics ingest daily via `app/api/cron/marketing-snapshot-gbp/route.ts` from the Business Profile Performance API v1. They live in `marketing_channel_daily` (channel='gbp').

### 3a. Impressions (4 metrics)

| Metric | What it is |
|---|---|
| `business_impressions_desktop_maps` | Times the GBP appeared on Google Maps (desktop) |
| `business_impressions_desktop_search` | Times the GBP appeared on Google Search (desktop) |
| `business_impressions_mobile_maps` | Times the GBP appeared on Google Maps (mobile) |
| `business_impressions_mobile_search` | Times the GBP appeared on Google Search (mobile) |

**What "good" looks like for a Bend brokerage (estimated benchmarks — no primary source available for Bend specifically):**

- Total weekly impressions: 200–500 in a stable baseline. Spikes to 600–1,000+ during listing pushes or review velocity events are normal and expected.
- Mobile/desktop split: mobile typically 65–75% of impressions in 2024–2025. If desktop is dominant, the profile may have weaker local intent queries.
- Maps vs Search split: Search impressions tend to be higher for service businesses (people search "real estate agent Bend" on Search more than browsing Maps). A Maps-heavy split can indicate address-proximity searches, which is good for referral traffic.

**Causes of low impressions:**
- Primary category mismatch (profile miscategorized).
- Thin profile (no posts, no services, few photos, low review count).
- NAP inconsistency suppressing confidence.
- Competitors with dramatically more reviews or photos outranking in the pack.
- Searcher location is far from Bend office and service area is not configured.

### 3b. Action Metrics

| Metric | What it is | Target (Bend brokerage, estimated) |
|---|---|---|
| `call_clicks` | Taps on the "Call" button | 5–20/week baseline; 30+ during listing launches |
| `website_clicks` | Clicks through to ryan-realty.com | 20–60/week baseline |
| `business_direction_requests` | "Get directions" taps — strong local intent | 2–10/week |
| `business_conversations` | Messages via GBP Messaging | 0–5/week (Messaging must be enabled) |
| `business_bookings` | Booking clicks (if booking link configured) | 0 until a scheduling tool is connected |

**Action rate** (actions / impressions) is the more useful derived metric than raw actions. A healthy action rate is 2–5% for a service business (BrightLocal 2024 local business benchmark). Below 1% signals the profile is showing up but not compelling clicks — usually a profile photo or review issue.

**`website_clicks` is the highest-volume action metric** for a brokerage. GA4 should confirm the session source as "google / organic" or "google / maps" in the same date window. If GBP shows 50 website clicks and GA4 shows only 10 from that source, the pixel or UTM setup needs attention.

**`call_clicks`** converts at the highest rate — a phone call is a warmer lead than a website visit. Track call click trends weekly. A sustained drop (>20% week-over-week for 3+ weeks) with flat impressions indicates the phone number is wrong, or a competitor has gained significant reviews.

**`business_direction_requests`** is a strong intent signal — the person is physically trying to find the office. Low volume is normal for a brokerage (clients don't typically drive to the office speculatively). Spikes around open houses or in-person events are expected.

### 3c. Metrics NOT ingested (and why)

| Metric | Reason skipped |
|---|---|
| `BUSINESS_FOOD_ORDERS` | Not applicable — no food ordering |
| `BUSINESS_FOOD_MENU_CLICKS` | Not applicable — no menu |
| Review data | Handled separately via Apify scraper; future `own_reviews` table (see TODO in route file) |
| Photo count | Not in Performance API — read from Management API if needed |
| Post engagement | Not exposed in the v1 Performance API — scrape or track manually |

---

## 4. Format Playbook

### 4a. Google Posts

GBP Posts expire after 6 months (Offer posts after 14 days if no expiry is set). Four post types:

| Type | Use for | Character limit | CTA options |
|---|---|---|---|
| Update | Market stats, new listings, sold announcements, news | 1,500 | Learn More, Call Now, Book |
| Offer | Price reductions, open house promotions | 1,500 + offer fields | Redeem Offer |
| Event | Open houses, community events | 1,500 + date/time fields | Book, Sign Up, Learn More |
| Product | Featured listings (add each listing as a product) | 300 | Order Online, Buy, Learn More (use "Learn More") |

**Best practices:**
- Lead with the hook — same rule as video: first sentence is the content, not a preamble.
- Include a location signal in every post: "Bend," "Central Oregon," or neighborhood name.
- First photo matters most: Google surfaces it in the Map Pack preview. Use the listing hero photo, a local landmark, or a data visualization — not the Ryan Realty logo alone.
- Link every post to ryan-realty.com with UTM params (`?utm_source=gbp&utm_medium=post&utm_campaign=<type>`). This makes GA4 attribution exact.
- Banned words apply: no "stunning," "nestled," "charming," etc. per CLAUDE.md.

### 4b. Photos

Categories Google recognizes (upload to the correct category for indexing):
- **Exterior** — office exterior, For Sale signs on properties, open house signage.
- **Interior** — office interior, home interiors from listings (with seller permission).
- **At work** — agent at showing, open house, signing table.
- **Team** — headshots, team photos.
- **Identity** — logo, branded materials.
- **360°** — supported but rarely used for offices; high production cost for marginal gain.

**Photo targets (estimated from BrightLocal 2024):**
- Minimum viable: 25+ photos, refreshed quarterly.
- Competitive in Bend market: 50+ photos, 2–4 new uploads per week.
- Each new upload signals freshness; Google re-crawls the profile after uploads.
- Geo-tag photos where possible (embed GPS EXIF data from Bend, OR). Google reads EXIF. A photo tagged Bend, OR is a faint relevance signal.
- Never use stock photos for the GBP photo gallery. They flag as inauthentic and Google's Vision API can detect repeated commercial stock images.

### 4c. Q&A Monitoring

Anyone can post a question AND anyone can post an answer. This is the most-overlooked and highest-risk GBP feature.

- Set up email alerts for new questions (GBP dashboard → Notifications).
- Answer every question within 24 hours. If a competitor, troll, or misinformed person answers first with wrong information, their answer shows as the accepted answer.
- Seed 5–10 real FAQs yourself: "What neighborhoods do you serve?" "Do you work with first-time buyers?" "How do I schedule a home valuation?" Answer in Matt's voice (see Section 6).
- Q&A text is indexed by Google and contributes to relevance for queries that match the question/answer language.

### 4d. Review Responses

See Section 6 and the canonical voice corpus at `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.

### 4e. Booking Links

GBP supports a "Book an appointment" button linked to a scheduling URL. Connect to Calendly or FUB's scheduling page for a free consultation. This converts direction requests and profile views into booked appointments without a phone call. Currently `business_bookings` is ingested but likely shows 0 until this is configured. Low effort, measurable impact.

### 4f. Service Area Definition

Set in GBP → Info → Service area. Add: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras, Terrebonne, Tumalo. Do NOT set a service area radius that conflicts with a storefront address — Google may remove the address display if a service-area business has a hidden address. Ryan Realty has a physical office so the address stays displayed; the service area is additive.

---

## 5. Posting Cadence + Timing

| Action | Minimum | Target | Notes |
|---|---|---|---|
| Google Post (Update) | 1/week | 2/week | Mon + Thu performs well (BrightLocal 2024 engagement study — local biz) |
| Google Post (Event) | Per open house | Every open house | Create 3–5 days before the event |
| Google Post (Offer) | Per price reduction | Per price reduction | Expires automatically after offer end date |
| Photo upload | 1/week | 4/week | Frequency matters more than batch size |
| Review response | Within 24h | Within 4h | Negative reviews: within 1h |
| Q&A monitoring | Daily check | Real-time alerts | Enable push notifications in GBP app |

**Timing note:** Google does not publish data on optimal post time for local businesses the way Meta does for social. Post when the listing content is freshest (same day as price change, same day as new listing live). For evergreen posts (market stats), mid-week (Tue–Wed) morning (8–10am PT) aligns with when local buyers are actively searching (estimated from GA4 session patterns — verify against ryan-realty.com GA4 data).

---

## 6. Reviews Strategy

Reviews are the single biggest Map Pack lever that Ryan Realty can move in 30 days. Whitespark (2023 Local Search Ranking Factors) ranks review quantity as #3 overall and Google's own local search documentation lists "prominence" — which reviews drive — as a primary factor.

### 6a. Ethical Review Generation

Google's guidelines: you may ask clients to leave a review. You may NOT offer compensation, create fake reviews, or use a review gating service that only sends happy clients to Google and filters unhappy ones.

**Ethical tactics:**
1. **Post-close text/email.** Send a personalized note within 48 hours of closing. Include the direct GBP review link (`g.page/ryanrealty/review` shortlink or the direct Google Maps URL). Keep it brief — one sentence asking, one sentence why it helps. Matt's voice: warm, direct, never pushy.
2. **In-person ask.** At the closing table or final walkthrough, verbally ask. "If you have a few minutes, a Google review makes a huge difference for a small brokerage like ours." The corpus (Response #1: "Reviews like this mean the world to a small business like ours") shows this framing is authentic to Matt's voice.
3. **Email signature link.** A passive review link in Matt's signature captures clients who want to review but forget. Low friction, no ask required.
4. **Annual check-in.** For past clients (FUB CRM), include a GBP link in the annual market update email.

**Review velocity target (estimated benchmark for Bend market):**
- Current: 23 reviews (as of 2026-05-12 corpus pull).
- Competitive: 50+ reviews. Cascade Sotheby's and Windermere Central Oregon locations likely have 30–80 (see Section 7 for live comp data).
- Target cadence: 1–2 new reviews per month minimum. 4+ per month during active transaction periods.
- Average rating floor: maintain above 4.8. A drop to 4.5 or below has measurable Map Pack ranking impact (BrightLocal 2024 Consumer Survey: 57% won't use a business below 4.0; 85% won't use one below 3.0).

### 6b. Response Protocol

**Voice canon:** `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`

The corpus shows four consistent moves in Matt's actual responses:
1. Open with gratitude — name the reviewer if possible.
2. Name something specific from their review (not generic mirroring).
3. Position Ryan Realty as small and grateful, not corporate.
4. Close with a forward-looking well-wish and an open door.

**Response length:** ~75 words for short reviews, ~140 words for detailed reviews. Never pad a short response. Never truncate a detailed one.

**Tone calibration from the corpus:**
- Authentic: "This genuinely made my day" (Response #2) — high-trust signature, use sparingly.
- Warm professional: "It was a privilege to work with you" (Response #6).
- Team recognition: "We" when another agent (e.g., Rebecca) handled the transaction (Response #8).
- Concise gratitude for brief reviews: "Thank you Kim we really appreciate your business and hope to work with you in the future!" (Response #12, 17 words).

**Negative review protocol** (no example in corpus — no negative reviews received as of 2026-05-12):
- Respond within 1 hour — not to fight, but because Google surfaces recent response activity.
- Do NOT dispute the facts in the public response. Acknowledge concern, offer to resolve offline. "I'm sorry your experience fell short of what we aim for. Please reach out directly so I can understand what happened and make it right." — then move to phone/email.
- Never use legal language or threats in a public response.

---

## 7. Competitor Benchmarks

**Data method:** Apify `compass/Google-Maps-Reviews-Scraper` — same scraper used for Ryan Realty's own corpus pull (2026-05-12). Run against Cascade Hasson Sotheby's Bend, Compass Bend, Windermere Central Oregon.

**What to benchmark (per competitor):**
- Total review count
- Average rating
- Review velocity (reviews/month over last 6 months)
- Response rate and average response time
- Post frequency (manually check GBP)
- Primary category
- Photo count (visible in Maps)

**Expected findings (estimated — run live scrape to confirm):**

Franchise brokerages (Windermere, Compass, Sotheby's) typically have fragmented GBP profiles — each agent may have their own profile, diluting reviews from the brokerage profile. A single-brokerage profile (Ryan Realty) that concentrates all reviews in one place can outrank a franchise whose reviews are split across 20 agent profiles.

**Action trigger:** If any competitor reaches 50+ reviews before Ryan Realty, escalate review-generation cadence. If a competitor's average is >4.9 with 30+ reviews, their category, description, and post strategy should be audited for patterns to adopt or differentiate against.

**Run this query to populate live benchmarks:**

```
Apify actor: compass/Google-Maps-Reviews-Scraper
Targets:
  - "Cascade Hasson Sotheby's International Realty Bend"
  - "Compass Real Estate Bend"
  - "Windermere Real Estate Central Oregon"
Output: review count, avg rating, most recent 6 months of reviews (for velocity calc)
```

_Note: Competitor data is directional intelligence, not a primary source. Numbers below are placeholders — replace with live Apify output._

| Brokerage | Reviews (est.) | Avg Rating (est.) | Response Rate (est.) | Posts/month (est.) |
|---|---|---|---|---|
| Ryan Realty | 23 (confirmed 2026-05-12) | 5.0 | 100% | Audit needed |
| Cascade Sotheby's Bend | TBD — run scraper | TBD | TBD | TBD |
| Compass Bend | TBD — run scraper | TBD | TBD | TBD |
| Windermere Central Oregon | TBD — run scraper | TBD | TBD | TBD |

---

## 8. Improvement Tactics — 10 Numbered

1. **Configure service area (Effort: 5 min. Lift: Map Pack coverage across Central Oregon. Lead time: 1–4 weeks for Google re-index.)**  
   Add Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras, Terrebonne, Tumalo. Metric to watch: `business_impressions_mobile_search` from searchers outside the Bend city core.  
   Source: Sterling Sky "Service Area Business Optimization Guide 2024."

2. **Connect a booking link (Effort: 30 min. Lift: `business_bookings` from 0; conversion of profile views to booked consults. Lead time: immediate.)**  
   Link GBP → Calendly free consultation URL. UTM: `?utm_source=gbp&utm_medium=booking`. Measure: `business_bookings` metric in `marketing_channel_daily`.

3. **Seed 10 Q&A entries (Effort: 1 hour. Lift: Relevance signal for long-tail queries; prevents competitor/troll answers. Lead time: 2–4 weeks for indexing.)**  
   Post questions clients actually ask, answered in Matt's voice. Cover: neighborhoods served, buyer/seller process, how to start a home search, first-time buyer programs in Oregon.  
   Source: Google Business Profile Help — Q&A best practices.

4. **Add 4 photos per week for 8 weeks (Effort: 2 hrs/week. Lift: BrightLocal (2024) 42% more direction requests, 35% more website clicks for photo-rich profiles. Lead time: 4–8 weeks.)**  
   Mix: listing exteriors, interiors, neighborhood landmarks (Drake Park, Deschutes River Trail, Old Mill District), team candids. Geo-tag all to Bend, OR EXIF.

5. **Increase review velocity to 2+/month (Effort: 5 min per closing. Lift: #1 Map Pack ranking factor after categories and proximity. Lead time: 90 days to measurable ranking change.)**  
   Send post-close text within 48 hours. Add review link to email signature. Measure: review count in Apify monthly scrape; watch `call_clicks` as proxy for ranking improvement.  
   Source: Whitespark Local Search Ranking Factors 2023, #3 and #4.

6. **Post 2x/week with geo-tagged content (Effort: 30 min/week. Lift: Relevance + freshness signal. Lead time: 4–6 weeks.)**  
   One listing/market update post (Monday) + one local lifestyle post (Thursday, e.g., Central Oregon market stats, Bend community news). Use GBP Post scheduler or schedule manually.  
   Metric: track `website_clicks` trend in `marketing_channel_daily` before/after cadence starts.

7. **Audit and fix NAP consistency across top 50 citations (Effort: 2–4 hours. Lift: Prominence signal, reduces Google's address uncertainty. Lead time: 4–12 weeks for citations to propagate.)**  
   Check: Yelp, Zillow, Realtor.com, Homes.com, BBB, Dun & Bradstreet, local chambers. Name must be exactly "Ryan Realty" with current address and phone. Use Whitespark Citation Finder or BrightLocal Local Listings tool to audit.  
   Source: Whitespark "Citation Building for Local SEO 2024."

8. **Add all services to the Services list (Effort: 20 min. Lift: Relevance for service-specific queries. Lead time: 1–2 weeks.)**  
   GBP → Products & Services. Add: Buyer Representation, Seller Representation, Listing Services, Comparative Market Analysis, Relocation Services, Investment Property, First-Time Buyer, Short Sale / Distressed Property.

9. **Enable GBP Messaging and respond within 1 hour (Effort: 15 min setup. Lift: `business_conversations` metric; direct-to-broker contact. Lead time: immediate.)**  
   GBP Messaging must be enabled in the app or dashboard. Set an auto-reply: "Thanks for reaching out. Matt typically responds within an hour. For faster response, call [number]." Measure: `business_conversations` in `marketing_channel_daily`.  
   Source: BrightLocal "State of Local SEO 2024" — messaging response time as a ranking signal (minor, but no-cost to optimize).

10. **Commission a local PR or community post that links to ryan-realty.com from a high-authority Central Oregon domain (Effort: 2–4 hours of relationship work. Lift: Organic backlink authority spills into GBP prominence. Lead time: 30–90 days.)**  
    Targets: Bend Magazine (bendmagazine.com), The Source Weekly (bendsource.com), Oregon Association of Realtors (oregonrealtors.org). A single link from any of these is worth more prominence signal than 100 directory citations.  
    Source: Moz "Local SEO Guide 2024"; Whitespark Local Ranking Factors.

---

## 9. Anti-Patterns

**These are violations of Google's guidelines or patterns that actively harm ranking:**

1. **Keyword-stuffing the business name.** Adding "Bend OR Real Estate" or "Top Agent" after "Ryan Realty" violates Google's guidelines. Penalty: listing suspension. Suspension is a multi-week, manual appeal process with no guaranteed outcome. Competitors can report keyword-stuffed names as violations. This is the #1 cause of GBP suspensions for real estate. Source: Google Business Profile Help — "Guidelines for representing your business."

2. **Buying or incentivizing reviews.** Offering gift cards, commission discounts, or anything of value for a review violates both Google's Terms of Service and FTC guidelines. Google detects unusual review velocity patterns and has removed listings for this. The FTC requires disclosure of any material connection to a reviewer.

3. **Leaving Q&A unanswered.** Anyone — including competitors — can post answers to Q&A. A competitor can answer "Who is the best real estate agent in Bend?" with their own name. A troll can post false information. Unanswered Q&A is open territory for anyone to fill.

4. **Using stock photos for the profile photo or cover.** Google's Vision API identifies stock images. A profile photo that appears on dozens of other GBP listings is a trust signal downgrade. Every photo should be unique to Ryan Realty.

5. **Deleting and recreating the listing to "reset" reviews.** A common bad advice pattern. Deleting a listing removes all reviews permanently. Merging duplicate listings keeps the reviews from both. Never delete a listing with positive reviews.

6. **Ignoring negative reviews.** A negative review with no response looks worse to prospective clients than a negative review with a professional, empathetic response. Google's algorithm also rewards consistent response behavior — a listing that responds to all reviews ranks higher than one with 100% positive but 0% response rate.

7. **Posting the same photo multiple times.** Google does not count duplicate uploads as fresh photo activity. Unique images only.

8. **Setting the wrong primary category.** "Real Estate Agent" (individual) vs. "Real Estate Agency" (company) matters. For a brokerage, "Real Estate Agency" is correct. The wrong category suppresses relevance for brokerage-level queries.

9. **Neglecting the profile during slow market periods.** GBP algorithmic freshness is continuous. A listing that goes dark for 60+ days (no posts, no photo uploads, no Q&A activity) loses freshness signal and can drop in ranking precisely when it should be building position for the next active cycle.

---

## 10. Brain-Readable Summary

### If X drops, do Y

| Signal | Diagnosis | Action |
|---|---|---|
| `business_impressions_*` drops >20% week/week | Profile freshness or ranking drop | Check post activity; upload new photos; confirm no policy violation or suspension |
| `call_clicks` drops, impressions flat | Profile not compelling enough to click | Audit primary photo; check review count vs. competitors |
| `website_clicks` drops, GA4 organic flat | Attribution gap or UTM problem | Verify UTM params on all GBP posts; check GA4 source/medium |
| `business_conversations` at 0 | Messaging disabled or no awareness | Enable Messaging; add "Message us on Google" to email footer |
| New negative review appears | Response urgency: 1 hour | Respond using voice canon; acknowledge, offer to resolve offline; never argue publicly |
| Competitor surpasses 50 reviews | Ranking threat in 60–90 days | Escalate post-close review request cadence; audit competitor post strategy |

### Top 3 Map Pack Ranking Levers (in order)

1. **Review count and velocity.** No other lever is more controllable and more directly tied to ranking. 2 reviews/month × 12 months = 24 more reviews (doubling the current count). This is a scheduling problem, not a marketing problem — it requires consistent execution at every closing.

2. **Profile completeness and category accuracy.** Primary category "Real Estate Agency," full services list, 750-char description with location signals, all contact info current, service area defined. One-time effort that compounds permanently.

3. **Photo freshness.** 4 uploads/week is achievable with listing photos. Each upload signals active management. Combined with post frequency, this is the highest-return low-cost weekly habit.

### Single Most Important Metric

**`call_clicks`** is the most important action metric. It is the shortest path from GBP impression to live conversation with a potential client. A sustained increase in `call_clicks` at a flat or growing impressions rate signals that the profile is compelling, the reviews are building trust, and the audience is qualified. A sustained decrease signals either a ranking drop (impressions also fall) or a profile trust problem (impressions hold but clicks don't convert) — both require different interventions and the metric split tells you which it is.

Track: `SELECT date, SUM(value) FROM marketing_channel_daily WHERE channel='gbp' AND metric='call_clicks' GROUP BY date ORDER BY date DESC LIMIT 30;`

---

## Appendix A — API Notes

- **Performance API version:** v1 (`businessprofileperformance.googleapis.com/v1`). The Insights API (v4, `mybusiness.googleapis.com/v4`) was deprecated in 2024. Do not use it for new metric ingestion.
- **Auth scope required:** `https://www.googleapis.com/auth/business.manage`
- **Quota:** 5,000 requests/project/day (GCP Console → Business Profile Performance API). Current ingestor uses 9 requests/run (1 per metric). Daily cron leaves 4,991 headroom.
- **Metrics not in Performance API:** Photo count, post engagement, review text, Q&A. These require the Business Information API or Management API (separate endpoints, same OAuth token).
- **Review ingestion:** Not in this ingestor. TODO: build `own_reviews` table + ingestor using `mybusinessplaceactions.googleapis.com` or Apify Google Maps Reviews Scraper (already wired for competitor intel). See route file TODO comment.
- **Data latency:** The Performance API has approximately 2–4 days of data lag (Google does not publish an exact SLA). Running the cron yesterday means the most recent confirmed data point may be 2–3 days old. For weekly trend analysis this is immaterial; for same-day reactive decisions, cross-check the GBP dashboard directly.
