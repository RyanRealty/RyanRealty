# Marketing Brain — Decisions Log

Persistent memory for the marketing brain so decisions, configurations, and gotchas survive across sessions. Every meaningful choice the brain or its operator makes that another session needs to know about lands here.

This file complements three other persistence layers:
- **`public.marketing_decisions`** in Supabase — every brain decision logged with data evidence. Machine-readable. Query for audit.
- **`marketing_brain_skills/*/SKILL.md`** — operational rules and behavior. Read by the brain itself.
- **`marketing_brain_skills/brand-voice/corpus/`** — canonical voice training data.

This file captures the WHY and the GOTCHAS — context an outside agent needs to read the system correctly.

---

## Configuration anchors (locked)

### North-star metric
**Qualified seller leads.** Single number that defines a winning week. All ranking, briefing, and budget decisions weight this above other metrics.

### Brand voice anchors (5)
**Trustworthy, honest, knowledgeable, professional, dependable.** Full ruleset at `marketing_brain_skills/brand-voice/voice_guidelines.md`. The brain enforces voice on every brief. Canonical corpus: Matt's 22 GBP review responses.

### Budget authority
Sign-off model. Brain proposes ad spend changes. Matt approves all.

### Content publish authority
Draft-first. Brain generates briefs, persists with `status='pending'`. Matt reviews. Nothing publishes until approval.

### Frequency targets
Research-driven, not fixed. Brain decides per-channel cadence based on measured response.

### Competitor list (8 local + 2 national disruptors)
cascade_hasson_sothebys, compass_bend, windermere_central_oregon, cascade_sothebys, coldwell_banker_bain_bend, berkshire_hathaway_nw_bend, john_l_scott_bend, remax_key_properties_bend, opendoor, offerpad.

---

## Platform OAuth status (verified 2026-05-13)

| Platform | Status | Notes |
|---|---|---|
| Meta (FB + IG) | **Live** | Long-lived page token, all publishing scopes. Ingestors flowing: ~3,600 rows each over 90d. |
| GA4 | **Live** | Service account `viewer@ryanrealty.iam.gserviceaccount.com`. ~1,304 rows over 90d. |
| GSC | **Live** | Same service account, property `https://ryan-realty.com/` (URL-prefix, NOT `sc-domain:`). 17,932 rows over 90d. |
| FUB | **Live** | API key in env. 665 rows over 90d. Window-based fetcher (NOT createdAfter/createdBefore — see gotchas). |
| GBP | **Live** | Performance API (NOT deprecated Insights API). 801 rows over 90d. |
| X | **Live** | 3,825 rows over 75d. /2/users/me hits 429 rate limit aggressively — cache user_id locally to avoid. |
| TikTok | **Token live, ingestor debugging** | open_id column added 2026-05-13. /v2/video/list `fields` param goes in QUERY string, not body. |
| YouTube | **Re-auth needed 2026-05-13** | Old scope was upload-only. Added youtube.readonly + yt-analytics.readonly. Matt to click /api/youtube/authorize. |
| LinkedIn | **Re-auth needed 2026-05-13** | Old scopes were openid+profile+email+w_member_social. Added rw_organization_admin + r_organization_social. Requires Community Management API product on the LinkedIn Developer App. |
| Threads | No token | Skipped per Matt 2026-05-12 |
| Nextdoor | No token | Pending |
| Pinterest | No dev app | Pending |

---

## Critical gotchas (read before debugging)

### GSC: URL-prefix property only
The service account has `siteFullUser` on `https://ryan-realty.com/`. It does NOT have access to `sc-domain:ryan-realty.com`. Code default is URL-prefix. Vercel env `GOOGLE_SEARCH_CONSOLE_SITE_URL` is also set to `https://ryan-realty.com/` across all 3 envs. Override per-call via `?site=` query param if a different property is ever added.

Diagnostic: `/api/marketing-brain/gsc-properties` lists every property the service account can see. Hit it with `Authorization: Bearer $CRON_SECRET`.

### FUB tag matching is case-insensitive AND includes multiple forms
The kebab-case playbook tags (`hot-seller`, `warm-seller`, `seller`, `seller-lead` from `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`) do not appear in production. The actual tags are Title Case (`Seller Lead`, `Seller Intent`) plus automation tags (`auto:seller-seq:new`) and landing-page tags (`LP-Home-Value`). The ingestor at `app/api/cron/marketing-snapshot-fub/route.ts` matches all forms via the `isSellerLead` helper. Don't strip the case-insensitive match — it's load-bearing.

### Meta Ads Insights: status is not a valid `fields` param
Neither `campaign_status` nor `effective_status` works on `/{ad_account_id}/insights`. Status comes from `/campaigns`, not `/insights`. Don't add it back to `CAMPAIGN_INSIGHTS_FIELDS` in `lib/meta-graph.ts`. If you need campaign status, add a separate `fetchCampaigns()` helper that hits `/campaigns` and joins client-side.

### FUB v1 /people does not accept createdAfter / createdBefore
Returns HTTP 400. Use the `fetchInDateWindow` helper in `marketing-snapshot-fub/route.ts` which paginates by `sort=-created` and stops once items fall below the window start. The ingestor fetches the whole window once per endpoint, not once per day.

### `marketing_channel_daily` upsert needs client-side dedup
Some upstream APIs (especially GA4 topPages/topSources) return duplicate `scope_id`s on the same day. Postgres rejects an upsert that targets the same conflict row twice. `upsertMetricRows()` in `lib/marketing-brain/snapshot.ts` dedupes by composite PK before the upsert with last-write-wins.

### Inverse metrics (lower = better)
The brain's `classifySignificance` (in `lib/marketing-brain/diagnose.ts`) flips spike/crash and rising/falling for inverse metrics. The locked list:
- `position`, `avg_position` (GSC search rank, 1 = best)
- `bounce_rate`
- `cpm`, `cpc`, `cpa`, `cost_per_lead`
- `avg_response_time_minutes`
- `days_on_market`
- `unsubscribe_rate`

Bug fixed 2026-05-13: brain was reporting GSC avg_position drop (from worse position numbers to better) as a "crash." Was actually a ranking IMPROVEMENT. If you add a new metric where lower is better, add it to `INVERSE_METRICS`.

### Brand voice "fake urgency" regex doesn't catch all variants
The voice validator catches `"won't last long"` and `"act fast"` but not phrasings like `"the window will not stay open long"`. Brief #1 (id `876ecf7c-b094-4f2f-b046-bde4d43d5afe`) had its hook rewritten manually before persist to remove this borderline phrasing. Consider expanding the regex in `applyBrandVoice` to catch more "window closing" / "moment of opportunity" patterns.

---

## Active briefs (pending Matt review pre-render)

### 2026-05-13 cycle

| Brief ID | Format | Platforms | Topic | Status |
|---|---|---|---|---|
| `876ecf7c-b094-4f2f-b046-bde4d43d5afe` | fb_ad_creative | facebook, instagram | Capitalize on 300% WoW seller-lead momentum | pending |
| `d89079ac-af48-4c02-98ae-3af66a4906ac` | ig_reel | instagram | Bend market snapshot reel — seller positioning | pending |

Both approved by Matt 2026-05-13. Awaiting content engine render.

---

## Findings worth tracking (anomalies the brain surfaced)

### 2026-05-13: SERP gap on seller-intent queries
We don't appear in Google's top 10 for any of the 10 canonical Bend real estate queries we track. Most striking miss: `"sell my home bend"` (dominated by cash-buyer sites). Massive SEO opportunity. Pending Matt's content-plan review.

### 2026-05-13: Ranking IMPROVEMENTS for brand queries (initially misread as a crash)
- `"ryan realty"` → position 37 to 4 (+33 positions improvement)
- `"ryan real estate"` → position 55 to 1 (+54 positions, now #1)
- `"duplex for sale bend oregon"` → 33 to 10 (entered top 10)
- `"matt tuck realtor"` → 67 to 50

These are LARGE positive moves. The brain initially flagged them as a "crash" because of the inverse-metric bug above. Real interpretation: SEO is working, especially on brand queries.

### 2026-05-13: Ranking DROPS for some local-keyword queries
- `"real estate company"` → 1 to 16 (fell out of top 10)
- `"bend or real estate agents"` → 38 to 46 (worse by 8)
- `"bend real estate companies"` → 21 to 28

These are real declines and worth investigating. Possibly competitor pages displaced us or specific content lost relevance.

### 2026-05-13: Meta Ads paused intentionally
Matt confirmed 2026-05-13 the $60/day playbook is intentionally off pending his review of the campaigns. Brain will continue to surface this as a "playbook gap" but will not auto-restart anything. Audit-ads opportunities should be filtered downstream once paused state is normalized.

### 2026-05-13: GA4 engagement up 87% WoW
Session duration improving. Users staying longer. Likely tied to recent site changes.

---

## Open questions / next-iteration work

1. **5 missing social ingestors** to build: YouTube, LinkedIn, X, TikTok, GBP. Tokens exist for all. Pattern matches GA4 ingestor exactly. Should be one parallel subagent dispatch.

2. **GA4 on-site setup audit** — confirm the website is firing all the right events. Current LEAD_EVENT_NAMES in `app/actions/ga4-report.ts`: generate_lead, contact_agent, contact_agent_click, schedule_tour_click, tour_requested, valuation_requested, cma_downloaded, sign_up, newsletter_signup. Audit whether each fires correctly on the site and whether we should add more (video_play, scroll_depth, etc.).

3. **Vercel env `GOOGLE_SEARCH_CONSOLE_SITE_URL`** is now set to `https://ryan-realty.com/` across all 3 envs (2026-05-13). Daily cron no longer needs `?site=` override.

4. **Position-rank diagnostic alerts** should be added to the SERP gap audit: when a brand query enters top 10 (like `"ryan realty"` did this week), that's a celebration signal worth content amplification.

5. **GSC daily cron** runs without `?site=` override now that env is correct. Verify on next 06:30 UTC run.

---

## Per-platform locked "most important metric"

For every platform, the deep-research playbook at
`marketing_brain_skills/platforms/<name>/SKILL.md` locked the single
metric the algorithm cares about most. The brain weights signals on
this metric above others for that channel.

| Platform | Most important metric | Why |
|---|---|---|
| YouTube | `average_view_percentage` (retention) | Determines whether the algorithm expands Suggested + Browse distribution after the initial test window. |
| LinkedIn | Dwell time (proxied via `engagement_rate`) | LinkedIn's 2025 360Brew foundation model shifted dominant signal from Social Graph to Interest Graph; dwell is its measurement. |
| X | `replies` | 13.5× the baseline engagement weight in the OSS algorithm — by far the highest signal. |
| TikTok | `completion_rate` | Practical proxy for the algorithm's top two signals (watch time + view-through). Currently tier-gated behind Research API. |
| GBP | `call_clicks` | Cleanest bottom-of-funnel signal; isolates Map Pack ranking issues from profile-trust issues. |

---

## More gotchas (added 2026-05-13 from the platform-ingestor build)

### LinkedIn OAuth needs Community Management API product
Adding `rw_organization_admin` / `r_organization_social` to the scope
list is necessary but not sufficient. The LinkedIn Developer App must
have the **Community Management API** product enabled at
developer.linkedin.com → app → Products. Without it, the OAuth flow
rejects the scope with `unauthorized_scope`. Approval is typically
instant for verified pages.

### YouTube Analytics requires its own scope
`youtube.upload` alone does not grant access to the Analytics API. Must
include `yt-analytics.readonly` (Analytics) and `youtube.readonly`
(channel + video metadata). Otherwise every call returns
`ACCESS_TOKEN_SCOPE_INSUFFICIENT`.

### TikTok /v2/video/list field placement
`fields` is a QUERY STRING parameter, NOT a body parameter on TikTok
v2 endpoints. Putting it in the JSON body returns 400 Bad Request with
no detailed error. Verified live 2026-05-13. `max_count` and `cursor`
DO go in the body.

### TikTok open_id is required for many endpoints
`tiktok_auth.open_id` column added 2026-05-13. Older rows from before
the column existed have NULL; ingestor fetches from /v2/user/info and
persists back at runtime if missing.

### X /2/users/me rate-limit
The Free / Basic tier rate-limits /2/users/me aggressively. Backfills
that call it once per day hit 429s after the first ~14 days. Mitigation:
cache the X user_id locally (env var or Supabase) so the ingestor only
calls /2/users/me once per ingestor run, not once per day in the loop.

### GBP env vars must be in Vercel
`GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` and `GOOGLE_BUSINESS_PROFILE_LOCATION_ID`
existed in `.env.local` but not on Vercel. Added to Production +
Development envs via `vercel env add` 2026-05-13. Preview not yet
populated.

---

## Platform-specific decisions awaiting Matt

1. **TikTok Research API ($$$)** — would unlock completion_rate (the
   locked most-important metric per the playbook). Currently we can
   only see views/likes/comments/shares. Decision pending budget.

2. **LinkedIn Community Management API product** — must be requested
   at developer.linkedin.com before the new scopes work. Quick form +
   usually instant approval.

3. **X tier upgrade** — Basic tier limits both rate and metrics. Likely
   not worth upgrading until X consistently drives qualified leads.

---

## Changelog

- **2026-05-13 morning** — Initial decisions log. GSC URL-prefix gotcha, FUB tag forms, Meta Ads `effective_status` gotcha, inverse-metrics fix, 2 approved briefs, SERP findings.
- **2026-05-13 afternoon** — 5 platform ingestors + playbooks shipped. Added locked-metric table per platform. Documented GBP env wiring, LinkedIn/YouTube re-auth requirements, TikTok video.list query-param fix, TikTok open_id column, X 429 rate limit pattern.
- **2026-05-13 evening** — YouTube re-auth + analytics scope wired; ingestor now flows 1,166 rows over 89 days (14 metrics). Dropped `impressions` + `impressionsClickThroughRate` from the per-video query (YouTube Analytics only exposes them at channel level, not at video dimension — verified 400 "Unknown identifier" error). LinkedIn blocked: Community Management API product is **mutually exclusive** with Share-on-LinkedIn + Sign-In-with-LinkedIn products on the same app. Matt must either create a separate "Ryan Realty Analytics" Developer App for the Community Management API, or remove the existing publishing products (which would break the current LinkedIn publishing flow via `/api/social/publish`). Decision pending. Until then, LinkedIn analytics stays at 0. 9-channel weekly-cycle pass ran clean — GBP impressions +31% WoW, GA4 engagement +87%, GSC rankings continuing to improve for brand queries.

- **2026-05-14** — **Brain architecture v2 landed** (Item 3 producer-mix expansion + audit-prep groundwork). Eight files shipped on origin/main inside commit **`80dbc1f9`** despite that commit's misleading message ("feat(brand): host rendered Matt + Paul email signatures at public URLs"); see "Cross-session git collision" gotcha below. Files: [`lib/marketing-brain/generate-briefs.ts`](../lib/marketing-brain/generate-briefs.ts) (Item 3 mapper expansion), [`lib/marketing-brain/topic-taxonomy.ts`](../lib/marketing-brain/topic-taxonomy.ts) (TS types + classifier prompt template), [`config/marketing-brain/topics.json`](../config/marketing-brain/topics.json) (12-bucket taxonomy + 5 enums), [`config/marketing-brain/competitors.json`](../config/marketing-brain/competitors.json) (27 seed competitors, 6 weight categories, expansion_pool of 10), [`marketing_brain_skills/tools_registry/REGISTRY.md`](../marketing_brain_skills/tools_registry/REGISTRY.md) (tools index paralleling producers/REGISTRY.md), [`marketing_brain_skills/tools_registry/apify/SKILL.md`](../marketing_brain_skills/tools_registry/apify/SKILL.md) (Apify scraper layer), [`marketing_brain_skills/tools_registry/classifier/SKILL.md`](../marketing_brain_skills/tools_registry/classifier/SKILL.md) (LLM tagger via Haiku + Sonnet escalation + Batches API), [`marketing_brain_skills/audit-findings/PROTOCOL.md`](../marketing_brain_skills/audit-findings/PROTOCOL.md) (contract between audit run and Producer Authoring session — `action_type=analyze:audit_findings` payload schema). Brain producer coverage went from 4 of 21 producers reachable to 9 of 21; `ig_reel → listing_reveal` mis-routing fixed (listing_reveal requires an MLS#, brand briefs have target='brand', so ig_reel briefs were silently failing); voice cleanup of borderline fake-urgency hook done.

## Cross-session git collision (read before multi-session work) — added 2026-05-14

**Gotcha:** another agent's session ran `git add -A` (or `git commit -a`) while my staged files were also in the index. Their commit (intended as a brand/email-signatures commit) ended up containing 8 marketing-brain files plus their 2 install-kit HTML files. My subsequent `git commit` then failed with "nothing to commit, working tree clean" because the sweep had already absorbed my staged content. Net effect: the work shipped, but git history mis-attributes the change.

**Defense:** CLAUDE.md "Work Standards" already says "prefer adding specific files by name rather than using 'git add -A' or 'git add .'". This incident is the exact failure mode. When multiple sessions are committing to main:
- Every session MUST `git add <specific-paths>` not `git add -A`
- Every session MUST `git status --short` immediately before `git commit` to confirm only its own paths are staged
- Pre-commit hooks that run tests are fine; pre-commit hooks that auto-stage are dangerous in multi-session work

**Remediation:** none performed. Force-pushing main to rewrite the history would disrupt the other sessions that have already pulled. The content is correct; the audit trail is documented here.

## Item 3 verification trace (2026-05-14)

- `tsc --noEmit -p tsconfig.json` → 0 errors before commit
- Local Next.js dryRun (`http://localhost:3000/api/cron/marketing-weekly-cycle?asOfDate=2026-05-13&dryRun=true&windowDays=7`) returned 2 voice-clean briefs (fb_lead_gen_ad + market_data_short on the audit-crm north_star +200% WoW spike) with correct producer routing — confirms the new mapping works against real signals.
- 11 opportunities silently dropped in the dryRun. All trace to Items 1/2/5 (audit-ads budget/campaign_structure → ops:meta_*; audit-crm response_time/tagging_drift/source_quality → ops:fub_*; channel-insight actions on gsc/gbp/ga4/x → site:* + ops:*; platform-trend algorithm → comms:matt_alert).

## Architectural pattern locked 2026-05-14

- `marketing_brain_skills/tools_registry/REGISTRY.md` parallels `marketing_brain_skills/producers/REGISTRY.md`. Producers look up `action_type → assigned_producer` in the producers registry; producers and brain look up `capability → tool SKILL.md` in the tools registry. Both registries are read at decision time. **Editing a tool's auth/cost/usage inline inside a producer is non-compliant — update the tools registry instead.**
- Topic taxonomy: 12 buckets (listing, market_data, national_housing_news, national_economy, local_community, lifestyle_bend, buyer_education, seller_education, behind_scenes, recap_highlight, agent_brand, other). 5 supporting enums (format, headless_or_face, hook_style, audio_used, cta_pattern). Both classifier output and producer-format-naming reference these.
- Audit-findings contract: every audit run writes ONE row to `marketing_brain_actions` with `action_type='analyze:audit_findings'`, payload containing `missing_producers[]` array. Producer Authoring queries `WHERE action_type='analyze:audit_findings' AND status='approved' ORDER BY created_at DESC LIMIT 1` to pick its next work. Also writes a Markdown report at `docs/marketing-brain/audit-YYYY-MM-DD.md`.

## Next-session queue (priority order after Item 3 + groundwork)

1. ~~**Item 1 — site:\* signal wiring**~~: **SHIPPED** in commit `4fc9e7a3` (2026-05-14). audit-website seo+test_new_creative emits `site:meta_update`; audit-website page+audit_landing_page emits `site:cta_update`; audit-website funnel+audit_landing_page emits `site:cta_update` on the upstream page. GeneratedBrief gained optional `target` + `payload_override` fields. formatRoute now includes 8 site:\* entries. Brain producer coverage 9/21 → 11/21. audit-ads budget/tracking/targeting and audit-website traffic are still dropped (next session).
2. ~~**Item 2 — cadence + active-listing awareness**~~: **SHIPPED** in commit `6dae73df` (2026-05-14). gatherCadenceGaps() reads marketing_channel_daily for last-7d posts per channel, compares against locked CADENCE_TARGETS (IG/TT 5/wk, Meta Page 4/wk, YouTube 2/wk, LinkedIn 3/wk, X 5/wk, GBP 2/wk), emits cadence opportunities with severity scaling by staleness. gatherActiveListingNeeds() queries top-20 active listings by ListPrice, filters those covered in last 14 days, emits the top-3 uncovered. Handlers route cadence → channel-matched default format (market_data_short on social, ig_carousel on LinkedIn, gbp_post on GBP) and listing_coverage → content:list_kit orchestrator. Brain producer coverage 11/21 → 12/21 (adds list-kit). ops:fub_\* wiring from audit-crm was NOT done — moved to next item.

## Next-session queue (revised after Items 1+2 — 2026-05-14)
3. **ops:meta_\* wiring** — audit-ads budget/tracking/targeting/campaign_structure → ops:meta_budget / ops:meta_pause / ops:meta_audience / ops:meta_creative_swap. The ops-meta-ads producer exists per `producers/REGISTRY.md` Section D. ~30 min. Pushes brain coverage 12/21 → 13/21.
4. **ops:fub_\* wiring** — audit-crm response_time/source_quality/tagging_drift/pipeline_health → ops:fub_tag_fix / ops:fub_sequence_change / ops:fub_task_create / ops:fub_routing. The ops-fub-crm producer exists per REGISTRY Section D. ~30 min. Pushes brain coverage 13/21 → 14/21.
5. **Item 5 — daily digest**: route platform-trend algorithm + diagnose anomalies on non-content channels to `comms:matt_alert`. ~30 min once channel chosen (Resend / Gmail draft / iMessage).
6. **Audit run itself**: refactor `lib/marketing-brain/competitor-recon.ts` to read `config/marketing-brain/competitors.json`; add YouTube + LinkedIn scraper actors; add 180-day windowing; add classifier post-processing pass writing to `content_classification` (table not yet migrated — add the migration); write the first audit-findings action row + Markdown report. ~2-4 hours + $50-90 first run (Apify $30-80 + Haiku classifier ~$18).
7. **Stub tools** in REGISTRY (supabase, replicate, spark_mls, meta_graph, resend) authored in priority order.
