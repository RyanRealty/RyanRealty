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
| Meta (FB + IG) | Live | Long-lived page token, all publishing scopes |
| GA4 | Live | Service account `viewer@ryanrealty.iam.gserviceaccount.com` |
| GSC | Live | Same service account, property `https://ryan-realty.com/` (URL-prefix, NOT `sc-domain:`) |
| FUB | Live | API key in env |
| LinkedIn | Token present | Ingestor not yet built |
| YouTube | Token present | Ingestor not yet built |
| X | Token present | Ingestor not yet built |
| TikTok | Token present (2026-05-12) | Ingestor not yet built |
| GBP | Token present | Ingestor not yet built |
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

## Changelog

- **2026-05-13** — Initial decisions log created. Added GSC URL-prefix gotcha, FUB tag-form gotcha, Meta Ads `effective_status` gotcha, inverse-metrics fix, 2 approved briefs, SERP findings.
