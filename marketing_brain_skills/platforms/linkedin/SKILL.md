---
name: marketing-brain-platform-linkedin
description: LinkedIn platform playbook for Ryan Realty. Covers algorithm mechanics, metric definitions, format strategy, cadence, voice, competitor benchmarks, and improvement tactics. Read before drafting any LinkedIn content, analyzing LinkedIn metrics, or configuring the LinkedIn ingestor.
---

# LinkedIn Platform Playbook — Ryan Realty

> **When to read this:** Any time you are drafting LinkedIn content, diagnosing LinkedIn metrics, writing the LinkedIn ingestor, or responding to Matt's questions about LinkedIn performance.

---

## 1. Platform Overview

LinkedIn sits in a distinct position in Ryan Realty's channel mix. Every other social platform optimizes for consumer discovery. LinkedIn optimizes for **professional credibility and B2B trust**.

For a principal broker, this means LinkedIn is not primarily a lead-gen machine — it is a **reputation layer**. The audience skews toward:

- Relocating professionals and corporate transferees researching Bend before they move (high buyer intent, months out from transaction)
- Real estate investors, lenders, and title reps who refer business
- Downsizing homeowners in the 55+ cohort who still keep a LinkedIn profile and use it for professional validation
- Local business owners who interact with Ryan Realty through chamber / community events and check credibility before referring clients

The B2B angle matters because **real estate is a referral-dense business**. A single attorney, financial planner, or HR director at a major Bend employer can funnel three to five transactions per year. LinkedIn is the platform where those professionals spend time on weekdays. Instagram gives Ryan Realty reach; LinkedIn gives Ryan Realty legitimacy.

LinkedIn should not try to be Instagram. Polished listing reels belong on Reels, not LinkedIn. What belongs on LinkedIn: market analysis, local economic context, candid broker perspective, and community intelligence. The content signals "this is someone I would trust with a $900,000 transaction" — not "this is a pretty house."

---

## 2. Algorithm Primer

### The 2025 Shift: Social Graph to Interest Graph

In late 2024, LinkedIn deployed **360Brew** — a 150-billion-parameter foundation model (built on Mixtral 8x22B architecture, arXiv:2501.16450) that replaced thousands of separate recommendation models. By fall 2025, it was rolled out across 40–100% of LinkedIn surfaces. The consequence: LinkedIn no longer routes content primarily through your connection network. It routes content to **users whose interest history semantically matches your content topic** — regardless of whether they follow you.

Source: LinkedIn engineering paper "360Brew: A Decoder-only Foundation Model for Personalized Ranking and Recommendation," arXiv:2501.16450, January 2025; van der Blom Algorithm InSights Report 2025 (1.8M-post analysis).

Practical implication: a post about Bend's housing inventory shortage can reach Portland-based real estate investors who have never heard of Ryan Realty. Network size is no longer the primary ceiling on reach.

### The 4-Stage Distribution Process

| Stage | Duration | What happens |
|---|---|---|
| **1. Quality Filtering** | Immediate | Text, formatting, links, hashtags, engagement-bait patterns screened |
| **2. Initial Audience Test** | First 30–60 min | Shown to most-engaged connections + users with similar recent engagement. This window determines reach trajectory. (Van der Blom, 2025, 1.8M-post analysis) |
| **3. Engagement Scoring** | 2–6 hours | Weighted engagement signals scored; strong posts advance |
| **4. Extended Distribution** | Days to weeks | 2nd/3rd degrees, hashtag followers, interest-graph matches |

Source: LinkedIn Engineering, "Large Scale Retrieval for the LinkedIn Feed using Causal Language Models," arXiv:2510.14223, October 2025.

### Dwell Time: The Primary Distribution Signal

LinkedIn's ranking model uses a **"long dwell" binary classifier** (LiRank, arXiv:2402.06859) that predicts whether dwell time exceeds a context-dependent percentile. Posts with longer read time achieve dramatically better distribution:

| Dwell time | Engagement rate |
|---|---|
| 0–3 seconds | 1.2% |
| 11–30 seconds | moderate |
| 31–60 seconds | high |
| 61+ seconds | 15.6% |

Source: Prominence Global, "LinkedIn's Dwell Time: How to Create Content That Keeps Users Engaged," 2025. (Note: exact second-thresholds are heuristic approximations; LiRank's actual percentile cutoff is context-dependent per the arXiv paper.)

This is the single most important algorithm insight: **holding a reader's attention for 60+ seconds delivers a 13x engagement-rate advantage over content they scroll past in three seconds.**

### Comments vs. Likes

Comments are LinkedIn's most-valued engagement signal. Industry estimates cite ~15x the weight of likes. AuthoredUp's 2025 NLP-aware analysis (3M+ posts) pegs it closer to 2x with quality scoring — meaning generic "Great post!" replies carry less weight than substantive comments containing questions, personal experience, or professional insight. Comment threads (back-and-forth conversation) trigger aggressive reach expansion.

Practical rule: **Reply to every comment within 2 hours.** Buffer's 72,000-post analysis found this lifts overall post engagement ~30% across the lifecycle.

Source: AuthoredUp, "How the LinkedIn Algorithm Works in 2025," 2025; Buffer, 2025.

---

## 3. Metrics Deep-Dive

### Account-Level Metrics

**`followers_count`**
Current snapshot of total page followers. Grows slowly for a local brokerage. For a small-business page (~500 followers), a net gain of 3–8 followers per week from organic content is healthy. Watch this as a lagging indicator of brand credibility, not a leading indicator of content effectiveness.

Good benchmark: reaching 500 followers puts Ryan Realty in the "established" tier for local professional services. Pages below 200 followers face algorithmic skepticism (the Interest Graph still needs audience signal to route content).

**`follower_gains`**
Net new followers for the day. Single-digit daily gains are normal; a high-performing post can spike this to 10–30 in one day. Track correlation between post publish dates and gain spikes to identify content types that attract new followers.

Causes of low/zero gains: posting too infrequently, posts not triggering Stage 3 distribution, low dwell time.

**`impressions`**
Total times any post was displayed, including repeats to the same viewer. For a small page, total weekly impressions of 500–2,000 is a reasonable baseline. Impressions spike on carousel/document posts and polls.

Note: LinkedIn impressions count a post as "seen" when at least half of it is visible for at least 300 milliseconds. This is a low bar.

**`unique_impressions`**
Impressions de-duplicated by member. A more honest reach number than raw impressions. Track `unique_impressions / followers_count` as a reach-per-follower ratio. For small pages, ratios above 2.0x (reaching twice your follower base) indicate the Interest Graph is distributing content beyond your network.

**`clicks`**
Clicks on the post itself (to expand from the feed), clicks on links, and clicks on company name/logo. High clicks relative to impressions indicate the post hook is working. Low clicks with high impressions: the hook is weak or the content isn't stopping the scroll.

**`reactions`**
Likes, celebrates, supports, loves, insightful, curious — all aggregated. LinkedIn's algorithm gives reactions the least weight of any engagement signal. Still useful as a sentiment proxy: "insightful" and "love" skew positive; a high reaction count with low comments suggests content is safe rather than provocative enough to spark discussion.

**`comments`**
The single most important engagement metric for algorithmic distribution. Comments per post is a better diagnostic than total comments per day (which mixes post volume). Target: at least 1 meaningful comment per post for small pages. 3+ comments in the first hour is a strong signal for Stage 3 advancement.

Levers for more comments: ask a direct, answerable question in the last line. Make the question specific to a decision someone in your audience actually faces ("If Bend rates dropped to 6.0% overnight, would you list or hold?").

**`shares`**
Reshares send content to the sharer's network — a strong distribution multiplier. Shares are rare on professional content but high-value. Market data posts and local economic analyses earn more shares than listings.

**`engagement_rate`**
LinkedIn calculates this as `(organic clicks + likes + comments + shares) / impressions`. LinkedIn's own formula includes clicks, which inflates it compared to Instagram's like+comment formula. For reference: Socialinsider's Q1 2026 analysis of 5M+ business pages puts the median engagement rate at 4.7% (up 22.1% YoY from 3.85% in 2024). Source: meet-lea.com citing Socialinsider, April 2026.

For a small local brokerage page (~500 followers):
- Below 2%: underperforming — likely weak hooks or wrong format
- 2–5%: on par with median small-business pages
- 5–10%: strong — content is resonating with a relevant audience
- Above 10%: exceptional — usually indicates a post hit the Interest Graph at scale

### Post-Level Metrics

All of the same metrics apply at the post scope. The most useful post-level diagnostic combination:

- **High impressions + low engagement rate**: post reached people but didn't hook them. Likely a weak opening line or irrelevant topic for the distributed audience.
- **Low impressions + high engagement rate**: strong content, narrow initial distribution — post may not have passed Stage 2. Consider if it was published at a low-engagement time, or if the follower base is too small to generate enough early signal.
- **High comments + low clicks**: text post performing well organically. No link = LinkedIn rewards it more.
- **High clicks + low comments**: link post. LinkedIn suppresses reach on outbound links. Accept lower organic reach; use sparingly and only when the destination is worth it.

---

## 4. Format Playbook

### Text Posts
Best for: short punchy takes, local market observations, broker perspective, questions that invite comment. No image, no link — LinkedIn algorithms historically favor native text. Length: 150–300 words with a strong opening hook and a one-line closing question.

Real estate fit: "I wrote 4 offers on houses in Bend this week. Here is what I saw in each negotiation." High dwell time if the content delivers real intel.

### Image Posts
Best for: data visualizations, before/after renovation, neighborhood photos, behind-the-scenes. Multi-image posts (carousel of up to 10 images) perform best among image formats: 6.60% average engagement rate vs 5.00% overall median (Socialinsider 2025). Source: Socialinsider, cited in LinkedIn post by Sophia Stancer-Gray, April 2025.

Real estate fit: "Here is what $800K buys in Bend's top 4 neighborhoods" as a 4-image side-by-side.

### Document/PDF Carousels
The highest-value format for real estate thought leadership on LinkedIn. Uploaded PDFs render as native swipeable slide decks. Socialinsider benchmarks show native documents average 5.85% engagement rate — second only to multi-image posts. Dwell time on a 10-slide document is substantially longer than a text post, which feeds the algorithm's dwell-time signal directly.

Real estate fit: "10 things I tell every out-of-state buyer before they move to Bend" formatted as a 10-slide PDF with one point per slide. Market report summaries. Neighborhood comparison guides.

Format rules: keep each slide to one idea, 30 words or fewer. First slide must hook on its own (it's the only one shown in the feed before the user swipes). Include a final "follow for more" slide only if the content genuinely earns it — not as a reflexive CTA.

### Video
Video on LinkedIn gets 5.60% engagement rate (Socialinsider 2025). But video reach is growing; LinkedIn prioritized native video in its feed in 2024–2025 algorithm updates. Vertical short-form (1080×1920) now displays well on mobile. LinkedIn video is watched muted — captions are required.

Real estate fit: 60-second market updates, neighborhood walkthroughs with narration, answering the top question of the week. Keep under 90 seconds for feed posts. Longer educational content (5–10 min) fits LinkedIn's "newsletter" or "article" formats better.

### Polls
Highest impressions of any format (Socialinsider 2025), but low engagement rate. Use polls when the goal is raw reach and awareness — not engagement quality. One poll per month maximum; overuse feels thin.

Real estate fit: "How long do you think you'll stay in your current home?" — positions Matt as curious about the community, not just selling.

### LinkedIn Newsletter / Articles
Long-form evergreen content. Articles do not appear in the main feed by default — they surface through search and through "articles" notifications to subscribers. Newsletters can build a subscriber list over time, which compounds.

Real estate fit: quarterly market analysis, annual Central Oregon real estate forecast, deep-dive on Bend's build-for-rent trend.

### Live Events
LinkedIn Live requires LinkedIn to approve your account. Use for: live Q&A with buyers, market update broadcasts, panel with a local lender or title rep. Commitment is high — only worth pursuing once the page has 500+ followers and consistent organic engagement.

---

## 5. Posting Cadence and Timing

**Frequency:** 3–5 posts per week is the sweet spot for small-business pages. Daily posting can work if quality holds, but drop in quality hurts dwell time and trains the algorithm to down-rank the page. Van der Blom's 2025 1.8M-post analysis found that top-performing pages post 4x/week on average; middle-tier pages post 6x/week with lower per-post engagement.

**Best days:** Tuesday, Wednesday, and Thursday consistently outperform Monday and Friday across multiple studies. Monday posts compete with catch-up tasks; Friday posts disappear as the professional audience mentally shifts to the weekend.

**Best times (Pacific Time, relevant to Ryan Realty's audience):**
- 7:00–9:00 AM: morning commute / coffee-desk professionals
- 11:30 AM–12:30 PM: lunch scroll
- 4:30–6:00 PM: end-of-workday catch-up

Source: meet-lea.com, "Best Time to Post on LinkedIn: Data-Driven Engagement Guide," January 2026 (1M+ post analysis: peak days Tue–Thu, optimal hours 8–10 AM, 12 PM).

For Ryan Realty's specific audience (relocating professionals in other time zones), consider posting at 8:00 AM Pacific / 11:00 AM Eastern to catch the East Coast lunch window simultaneously with the West Coast morning window. This is the single slot that maximizes national professional reach for a regionally-focused page.

**Initial engagement window:** The first 30–60 minutes after posting determine reach trajectory. Do not post and immediately step away. Have a response ready for the first comment. Post from Matt's personal profile first (personal profiles get higher reach than company pages), then share to the Ryan Realty company page.

---

## 6. Voice on LinkedIn

### The Tension
LinkedIn's algorithm rewards thought-leadership voice — long-form anecdote with a professional takeaway. The most-shared LinkedIn content tells a story, reveals a non-obvious insight, and leaves the reader with something applicable. This sounds like it conflicts with Ryan Realty's brand voice anchors (honest, direct, knowledgeable, not hype-driven). It does not.

The failure mode on LinkedIn is **performing credibility** — writing what sounds authoritative without being specific. The Ryan Realty brand voice is the antidote: be specific about what you actually saw in a negotiation, what a specific data point means, what you actually think about a market trend. Specificity is both the brand voice requirement and the dwell-time driver.

### What works on LinkedIn for a brokerage

**The observation post:**
Start with a specific thing you observed this week. One sentence, no preamble. "I lost a listing to a cash offer at $50K over ask in Tumalo on Thursday." Then explain the context and what it means for buyers and sellers watching that market. This is genuine thought leadership. It is not hype. It is what Matt actually knows.

**The local data post:**
Pull one stat from the Supabase market data. Frame it around a question your clients actually ask. "Sellers keep asking me if it's too late to list. Here is what the absorption rate in Bend SFR actually says right now." Teach the metric briefly, then give the verdict. Under 300 words.

**The reframe post:**
Take a national narrative (Fed rate decision, NAR policy change) and explain what it specifically means in the Bend market. This establishes Ryan Realty as the authority on local interpretation of national signals — a differentiated position no algorithm or national brokerage can replicate.

### What to avoid

- "I'm excited to share..." — delete. Start with the thing.
- "Grateful and honored..." — not relevant to your professional audience.
- "Let me know your thoughts in the comments!" — this is engagement bait. Ask a specific question instead.
- Em-dashes, semicolons, AI filler words (delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock) — all banned per Ryan Realty voice guidelines.
- Motivational content — LinkedIn is full of it and it performs poorly with a skeptical professional audience. Ryan Realty should not be in that bucket.
- Anything that sounds like a press release — "Ryan Realty is proud to announce..." sounds like a brand, not a person. LinkedIn organic reach favors personal-profile posts over company page posts. Let Matt's personal voice carry the page.

---

## 7. Real Estate Competitor Benchmarks

The following is drawn from public profile observation and industry reporting as of early 2026. Exact engagement numbers are not publicly accessible; these are (operator estimates) based on observable post performance and industry benchmark ranges.

**Compass**
LinkedIn following: 150,000+ followers (national brand).
Cadence: 5–7 posts/week from the company page; heavy video and listing showcases.
Format mix: listing reels (~40%), recruiting/culture (~30%), market commentary (~20%), awards/PR (~10%).
Observed engagement: low on listing posts (sub-1% ER by impressions), moderate on market commentary (2–4%).
Takeaway: large pages see lower per-post ER due to follower churn and broad national audience that does not match local content. A focused local page can outperform on engagement rate even at 1/100th the follower count.

**Sotheby's International Realty**
LinkedIn following: 100,000+.
Cadence: 3–5 posts/week.
Format mix: luxury listing video (~50%), brand/lifestyle (~30%), market intelligence (~20%).
Observed engagement: luxury audience on LinkedIn is small but high-trust. Document carousels with market data perform well.
Takeaway: luxury positioning is credible on LinkedIn because the audience skews toward high-net-worth professionals. Ryan Realty's mid-to-upper-end Bend positioning can borrow this — lead with market intelligence and aspirational community identity.

**Keller Williams**
LinkedIn following: 75,000+.
Cadence: 3–4 posts/week.
Format mix: agent recruiting (~50%), community stories (~25%), market data (~15%), culture (~10%).
Takeaway: KW uses LinkedIn as a recruiting channel first, consumer channel second. Not a direct comparator for a principal-broker page. The insight is that Ryan Realty should avoid the KW trap — don't let the page feel like a recruiting bulletin board.

**Local independent brokerages (operator estimate)**
Most Central Oregon independent brokerages have minimal LinkedIn presence — under 200 followers, posting fewer than once/week, mostly listing announcements. This is a genuine gap. Consistent, intelligent content at 3–5 posts/week would make Ryan Realty the dominant voice in the local professional real estate conversation on LinkedIn within 6–12 months.

---

## 8. Improvement Tactics (10 Numbered)

**1. Publish from Matt's personal profile, share to company page**
Target metric: `impressions`, `follower_gains`
Expected lift: personal profiles typically receive 3–5x higher organic reach than company pages for equivalent content. (Operator estimate based on LinkedIn's well-documented algorithmic preference for member content; van der Blom 2025 confirms this pattern.)
Lead time: immediate.

**2. Publish one document carousel per week**
Target metric: `engagement_rate`, dwell time (proxy: longer time in feed)
Expected lift: document posts average 5.85% ER vs 5.00% overall median (Socialinsider 2025). At Ryan Realty's current scale, this likely translates to 1–3x more comments per post than equivalent text posts.
Lead time: 1–2 hours per carousel. Use existing market data from Supabase; format in Canva.

**3. Ask one specific, answerable question in the closing line of every post**
Target metric: `comments`
Expected lift: questions in the first 5 seconds of a post boost comments by approximately 32% (Buffer 2025). A closing question continues the conversation.
Lead time: 5 minutes per post.

**4. Reply to every comment within 2 hours of posting**
Target metric: `comments`, `engagement_rate`
Expected lift: ~30% higher engagement over the post lifecycle (Buffer, 72,000-post analysis).
Lead time: monitoring task; no content creation required.

**5. Post at 8:00 AM Pacific on Tuesday, Wednesday, Thursday**
Target metric: `impressions`, `unique_impressions`
Expected lift: optimal-time posting vs. random-time posting can double the size of the initial audience test cohort — which directly determines Stage 2 advancement. (Operator estimate based on LinkedIn timing research.)
Lead time: schedule posts the night before.

**6. Add `LINKEDIN_ORGANIZATION_ID` env var and connect rw_organization_admin scope**
Target metric: enables all ingestor metrics; required before any data flows.
Lead time: 1 hour. Steps: (a) find the numeric org ID in the Company Page admin URL (linkedin.com/company/[name]/admin/ shows it); (b) add to Vercel env vars; (c) re-OAuth at /api/linkedin/authorize with rw_organization_admin scope added to the LinkedIn app.

**7. Publish one local market data post per week using verified Supabase figures**
Target metric: `engagement_rate`, `shares`, `follower_gains`
Expected lift: market data posts consistently earn 2–3x more shares than listing posts on LinkedIn (operator estimate). Shares are the strongest reach multiplier on the platform.
Lead time: 30 minutes. Pull data, verify per CLAUDE.md Data Accuracy protocol, write one paragraph of context.

**8. Use 2–3 niche hashtags, not generic ones**
Target metric: `unique_impressions` via hashtag-based discovery
Expected lift: niche hashtags outperform generic ones for small pages; the exact lift is not robustly verified but commonly cited at ~10–15% reach improvement. More importantly, niche hashtags route your content to followers of those tags who are relevant buyers/referral partners.
Suggested hashtags: `#BendRealEstate`, `#CentralOregon`, `#ORRealty`. Avoid `#RealEstate` (too broad) and `#HomeBuying` (consumer-facing, not professional-audience-relevant).
Lead time: 1 minute per post.

**9. Analyze top-performing posts quarterly and double down on the format/topic combination**
Target metric: diagnostic; leads to improvement across all metrics.
Expected lift: creator pages that iterate on their top 3 content types see 20–40% engagement improvement over 90 days (operator estimate based on general content optimization literature).
Lead time: 1 hour per quarter. Query `marketing_channel_daily` for `channel='linkedin', scope='post'`, rank by `engagement_rate`, identify common topics/formats in top 10.

**10. Experiment with one LinkedIn Poll per month**
Target metric: `impressions`, `follower_gains`
Expected lift: polls generate the highest impressions of any format (Socialinsider 2025). A well-designed poll question also surfaces intent signals from your audience.
Lead time: 5 minutes. Use a question that reveals something about your audience's market position ("Are you planning to buy in Bend in the next 12 months?").

---

## 9. Anti-Patterns

**"Are you ready for this?" and emotional-reveal openers**
Posts that artificially manufacture suspense before a mundane reveal are widely mocked by professional LinkedIn users. This pattern peaked in 2022–2023 and is now associated with low-quality thought-leadership performativity. Ryan Realty content starts with the thing, not the dramatic setup.

**Motivational-poster carousels**
"Success is not final..." posts with stock photo backgrounds. These get engagement from aspirational audiences but zero credibility from real estate professionals, investors, and referral partners. LinkedIn's own research (LinkedIn Marketing Blog, 2024) shows trust is now the primary KPI for B2B engagement; motivational carousels actively erode trust with a skeptical professional audience.

**Hashtag stuffing**
More than 3–5 hashtags on a LinkedIn post is a spam signal. Van der Blom's 1.8M-post 2025 analysis found hashtag impact has continued to weaken — LinkedIn's Interest Graph contextualizes content semantically and does not rely on hashtag routing the way Instagram does.

**Phantom thought leadership**
Generic takes on national real estate news without local specificity or personal opinion. "The Fed raised rates. Here is what that means for homebuyers." — a hundred brokerages publish this. Ryan Realty's version must include what Matt actually observed in his pipeline this week, what he thinks will happen specifically in Bend, and a specific recommendation. Anything short of that is filler.

**Engagement bait**
"Comment YES if you agree." "Tag someone who needs to hear this." LinkedIn's quality filter (Stage 1 distribution) actively detects and penalizes these patterns. They worked in 2020; they flag as low-quality in 2026.

**Posting outbound links with the expectation of feed reach**
LinkedIn suppresses reach on posts with outbound links. If you include a link (to a blog post, a Zillow listing, an MLS search), expect 40–60% lower organic impressions than equivalent native-content posts. Reserve links for posts where the destination is worth the reach trade-off, or move the link to the first comment.

**Company-page-only posting**
Company page posts consistently underperform personal profile posts. This is documented behavior that LinkedIn has addressed with features like "employee advocacy" specifically because company page organic reach is structurally limited. Matt's personal LinkedIn profile should lead; the company page amplifies.

---

## 10. Brain-Readable Summary

### "If metric X drops, do Y" rules

| Metric drops | Likely cause | Action |
|---|---|---|
| `engagement_rate` falls below 2% | Weak hook or wrong format | Switch to document carousel or text post with specific local data point |
| `impressions` drops by 30%+ week-over-week | Post published off-peak or posting frequency dropped | Restore Tue–Thu 8 AM Pacific cadence; check that posts aren't being suppressed for outbound links |
| `follower_gains` goes to zero | Content not reaching Stage 3 distribution | Prioritize comment-generating content (end posts with specific question); increase personal-profile post frequency |
| `comments` flat at zero | Closing line is a statement, not a question | Add direct answerable question to every post; seed with first comment from Matt's personal profile immediately after posting |
| `clicks` low relative to impressions | Hook is not compelling the "see more" expansion | Rewrite first two lines; use a specific number, a counterintuitive claim, or a named place in the first 5 words |
| `shares` low | Content is too brokerage-centric | Shift to market data and local economic commentary that professionals would share with their networks |

### Top 3 levers for `engagement_rate`

1. **Document carousel with real market data** — drives dwell time directly; 5.85% ER benchmark vs 5.00% median.
2. **Personal-profile post with a specific closing question** — routes through the Interest Graph; comments earned within 60 min trigger Stage 3.
3. **Reply to every comment within 2 hours** — ~30% lifecycle engagement lift (Buffer 2025).

### Single most important metric for the LinkedIn algorithm

**Dwell time** — it is not directly exposed in the API (LinkedIn does not provide a dwell-time metric in `organizationalEntityShareStatistics`). The best proxy available is `engagement_rate` at the post level: posts with high dwell time generate higher ER because users who dwell long enough to read the full post are far more likely to react or comment. A post with 61+ seconds dwell time achieves 15.6% ER vs. 1.2% for a post that gets scrolled past in 3 seconds (Prominence Global, 2025). Engineering for dwell time means: strong hook, short paragraphs, content that delivers a specific payoff worth reading to the end.

---

## Required Env Vars (LinkedIn Ingestor)

| Var | Status | Notes |
|---|---|---|
| `LINKEDIN_CLIENT_ID` | Configured | OAuth app ID |
| `LINKEDIN_CLIENT_SECRET` | Configured | OAuth app secret |
| `LINKEDIN_REDIRECT_URI` | Configured | `https://ryanrealty.vercel.app/api/linkedin/callback` |
| `LINKEDIN_PERSON_ID` | Configured | `314211370` (numeric member ID) |
| `LINKEDIN_ORGANIZATION_ID` | **MISSING — TBD** | Numeric org ID for Ryan Realty Company Page. Obtain from Company Page admin URL. Add to Vercel env vars. Re-OAuth with `rw_organization_admin` scope before ingestor will return company-page data. |

## Required OAuth Scope

The token in `public.linkedin_auth` (id='default') was provisioned with `openid profile email w_member_social`. The Company Page analytics endpoints require `rw_organization_admin`. Add this scope to the LinkedIn app at developer.linkedin.com, then re-authorize via `/api/linkedin/authorize`.

---

## Sources

1. LinkedIn Engineering, "360Brew: A Decoder-only Foundation Model for Personalized Ranking and Recommendation," arXiv:2501.16450, January 2025.
2. LinkedIn Engineering, "Large Scale Retrieval for the LinkedIn Feed using Causal Language Models," arXiv:2510.14223, October 2025.
3. LinkedIn Engineering, "LiRank: Industrial Large Scale Ranking Models at LinkedIn," arXiv:2402.06859, February 2024.
4. Richard van der Blom, "Algorithm InSights Report 2025," 1.8M-post analysis, 2025.
5. Prominence Global, "LinkedIn's Dwell Time: How to Create Content That Keeps Users Engaged," 2025.
6. AuthoredUp, "How the LinkedIn Algorithm Works in 2025," 3M+ post analysis, 2025.
7. Buffer, "Reply Rate Impact on Engagement," 72,000-post / 25,000-account analysis, 2025.
8. Socialinsider, "LinkedIn Benchmarks 2025–2026," 5M+ business pages, Q1 2026 (cited via meet-lea.com and Sophia Stancer-Gray LinkedIn post, 2025).
9. meet-lea.com (Paul Irolla), "LinkedIn Algorithm Explained 2026: Dwell Time, Comments & Reach," updated April 28, 2026.
10. LinkedIn Marketing API documentation, "Organization Follower Statistics" and "Organization Share Statistics," Microsoft Learn, version 202604, updated 2026-04-28.
