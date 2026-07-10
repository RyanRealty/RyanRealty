---
name: local-seo
description: Run the Local SEO loop — the GBP / map-pack / citations / review-velocity layer. Competitive audits of Ryan Realty's Google presence against the Bend brokerages actually holding the 3-pack, with every fix routed through the existing approval pipeline. Use when Matt says "/local-seo", "audit the GBP", "local SEO audit", "map pack", "citations audit", "review velocity", "why aren't we in the 3-pack", or when a /loop firing carries this protocol.
---

# Local SEO loop — the local-pack layer

This loop owns the layer the growth-loop does NOT: Google Business Profile, the map pack, citations/NAP, review velocity, GBP photos/posts/services/Q&A. The growth-loop (`.claude/skills/growth-loop/SKILL.md`) owns the website SERP layer (GSC, titles/meta, on-page depth, vitals, JSON-LD plumbing). Findings that belong to the website layer get FILED to the growth-loop candidate list, never executed here.

**Knowledge base (read before the first audit of a session):** `marketing_brain_skills/platforms/gbp/SKILL.md` — the algorithm primer (relevance × distance × prominence), the `marketing_channel_daily` metric dictionary, the format playbook, and the name-stuffing suspension warning. That file is the WHY; this file is the RUNBOOK.

## §0 Non-negotiables (inherited, restated because they bind every audit)

1. **CLAUDE.md §0 data accuracy.** Every count, rating, velocity number, and ranking position in an audit output traces to a live pull made THIS run — a timestamped scrape, screenshot, or API row. No LLM-recall numbers, no "last time we checked." Competitor names and stats persist in `data/local-seo/` with `fetched_at` stamps and go stale after 30 days.
2. **Draft-first.** The audit itself is `analyze:` — internal, no approval. But every public-facing OUTPUT (description rewrite, post, review reply, Q&A answer, services text, attribute change, category change) is a draft: brand-voice self-check, then Matt approves, then it publishes through the pipeline below. Nothing is written to GBP or any directory without Matt's explicit go.
3. **Truthful categories and attributes only.** Never add a category or attribute for a service Ryan Realty does not actually offer, even if every competitor has it. "Property Management Company" goes on the profile only if Ryan Realty manages property. A licensed brokerage claiming services it doesn't provide is a compliance exposure, and category-stuffing is a GBP suspension trigger (gbp SKILL §2, NAP section).
4. **Fair housing.** Neighborhood and audience language in posts, descriptions, and review-ask scripts never steers. Describe the place and the inventory, never the people ("close to Drake Park," never "great for young families").
5. **Voice.** `marketing_brain_skills/brand-voice/VOICE.md` Five Laws on all public copy. Review replies are Matt's 1:1 correspondence voice — the canonical phrases ("a small business like ours," "genuinely a pleasure") are allowed THERE and nowhere else. Corpus: `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.
6. **Live-session discipline.** The Chrome MCP browser carries Matt's real Google session. `business.google.com` clicks are REAL mutations to the live profile. Reads only, unless a specific approved change is being applied — and then apply exactly that change, verify, stop.

## §1 Business context — pre-loaded, never re-ask

| Field | Value | Source |
|---|---|---|
| Legal/DBA name | Ryan Realty (exactly — no keyword suffix, ever) | gbp SKILL §2 NAP rule |
| Address | 115 NW Oregon Avenue, Bend, OR 97703 | site JSON-LD, `app/lp/bend/page.tsx` |
| Citation phone | 541.703.3095 (FUB-tracked — canonical on GBP + every directory so inbound attributes) | design system §Voice; `lib/listing-cta.ts` |
| Website | https://ryan-realty.com | canon |
| Email | matt@ryan-realty.com | canon |
| Business license | Ryan Realty LLC #201253677, founded 2023-06-21 (OREA-authoritative) | memory `reference_orea_license_records` |
| Brokers | Matt Ryan PB #201206613 · Paul Stevenson #201259123 · Rebecca Peterson #201254727 | same |
| Service areas | Bend, Redmond, Sisters, Sunriver, Tumalo, Terrebonne, La Pine, Prineville, Madras (16-city region in `market_pulse_live`) | gbp SKILL §2b |
| Socials (sameAs) | @ryanrealtybend on every platform; /ryanrealtybend on FB + LinkedIn | design system, locked 2026-05-13 |
| GA4 | account 386736554 / property 527333348 | memory `reference_ga4_property` |
| GBP metrics | `marketing_channel_daily` channel='gbp' (daily cron `marketing-snapshot-gbp`) — DAL-first, read the DAL index before querying | gbp SKILL §3 |

**Seed target queries** (targets to score against, not facts — refine against GSC query data): `real estate agent bend oregon` · `realtor bend oregon` · `real estate agency bend` · `homes for sale bend oregon` · `sell my house bend oregon` · plus one per secondary city (`realtor redmond oregon`, `real estate agent sisters oregon`, …).

**First-run capture (once, then persisted):** the live GBP place URL, current primary + secondary categories, current attributes, current services list, current description, review count/rating, photo count. Write to `data/local-seo/profile.json` with `fetched_at`. If the live GBP phone ≠ 541.703.3095 or name ≠ "Ryan Realty" exactly, flag to Matt before anything else — NAP canon disagreement outranks every other finding.

## §2 Tooling and output conventions

- **Browser:** Chrome MCP — select browser by NAME ("mac mini matt logged in"), never a hardcoded deviceId (memory `feedback_chrome_browser_default`). Google Maps place pages render competitor categories, attributes, reviews, posts, photos without any paid tool.
- **Scale scraping:** Apify GBP/reviews actors when a listing has hundreds of reviews — check the $200 usage cap first (memory `project_apify_usage_cap_dark_pipeline`); a capped Apify returns silent empties.
- **Persistence:** `data/local-seo/competitors.json` (the competitor registry — discovered, never hardcoded), `data/local-seo/profile.json` (our live-profile snapshot), `data/local-seo/citations.json` (directory-by-directory NAP findings). All rows carry `fetched_at` + source URL.
- **Scratch:** `out/local-seo/<YYYY-MM-DD>/` for the run's raw evidence (page text dumps as `.txt`/`.json`, screenshots). Never save raw `.html` page dumps to a tracked path (memory `reference_tailwind_scans_scratch_html`).
- **Draft surface:** one scoreboard file per run at `out/local-seo/<date>/scoreboard.md` — every number with its one-line trace, every recommendation with impact (high/med/low) + effort. Give Matt the `open` path.

## §3 The audit stack

Run A first, always — it discovers who the real competitors are this month. Then whichever audits the run's scope calls for. A full audit = A through I.

### A. Local-pack scoreboard + competitor discovery
For each seed query, load Google Maps, record the 3-pack + positions 4–10: business name, rating, review count, primary category (visible on the place page). Ryan Realty's position (or absence) per query is THE headline metric of this loop. Persist the top recurring brokerages (≥2 pack appearances) as the competitor registry — typically 3–5 names. Everything downstream compares against these, not against whoever we assume competes.

### B. Category audit
Extract primary + all secondary categories for us and each registry competitor (place page → "About"/category line; the full secondary list needs the listing detail). Build the matrix: category × (us / each competitor). Categories ALL pack-holders share and we lack = table stakes (subject to §0.3 truthfulness). Categories one competitor uses = differentiation candidates. Output: prioritized add/change list with the §0.3 filter applied and the suspension warning attached to any primary-category change.

### C. Attributes audit
Same matrix for attributes ("Online appointments", "LGBTQ+ friendly", "Identifies as veteran-owned", etc.). Flag: all-competitors-have-it-we-don't (immediate), 2-of-3 (recommended), 1-of-3 (optional). Attributes also lift CTR — note which ones render as visible pills in the pack.

### D. Review velocity teardown
Per competitor + us: total, rating, count in last 30/60/90 days (read review dates; Apify for long tails). Compute the catch-up line: reviews/month needed to match the leader's velocity and the months-to-parity at that rate. Mine the last ~50 reviews per competitor for: services named, neighborhoods/cities named, broker names, recurring complaints. Those mentions are doing local-relevance work for them — the mined vocabulary feeds E's ask-script and F's post topics. Complaint themes are positioning ammunition for the website layer (file to growth-loop).

### E. Review response + ask system
Measure response rate and lag for us vs competitors (last 30 reviews each). Deliverables, routed as `ops:review_response` / `ops:review_request` action rows through `marketing_brain_skills/produce/` to the `ops-reputation` producer (it already owns this — do NOT draft outside the pipeline): refreshed reply variations per star tier in Matt's 1:1 voice, and a post-closing ask script that invites clients to mention their neighborhood and what we did — invitation, never scripting ("if you felt like sharing what part of the process we handled and where the home is, that helps neighbors find us").
2026-07 status: review REQUESTS can automate off closed `tc_cycles` via Twilio/Gmail (coordinate with the CRM session; respect `compliance:hard-stop` tags). RESPONSES stay Matt-approved per the producer's gate.

### F. Posts cadence
Forensics on competitor posting (count/90 days, types, CTAs, topics, gaps). Almost always the finding is "nobody posts" — the cheapest differentiation in the stack. Build the calendar (2–3/week: neighborhood-specific closings [fair-housing-clean], market-stat posts, open houses, team) and route each as an `ops:gbp_post` row. Any market number in a post obeys §0 in full — pulled from `market_pulse_live`/`market_stats_cache` with a verification trace in the action row, never recalled.

### G. Services + description
Diff our GBP services list against ryan-realty.com's actual service surface (buyer representation, seller representation, CMA/pricing opinion, relocation, land, …) — site-has-it-GBP-doesn't is invisibility for that query in the pack. Draft 40–60-word descriptions per service (VOICE.md Five Laws: show it, number beats adjective) and 3 versions of the 750-char business description (ranking-weighted / conversion-weighted / balanced) for Matt to pick and rotate on a 30-day test. All draft-first.

### H. Photo pipeline
Count + recency for us vs competitors. Ryan Realty's unfair advantage: `data/asset-library/manifest.json` — 1,100+ vision-graded photos (search `vision_*` fields, EXCLUDE the 92 watermarked Shutterstock rows in 'curated'; memory `reference_asset_library_visual_catalog`). Build a weekly upload queue (3–5/week, beating the leader's velocity) with keyword-and-place filenames (`deschutes-river-old-mill-bend-or.jpg`). Uploads to the live profile are mutations → batch for Matt's one-click approval per §0.6.

### I. Citations / NAP audit
Sweep the real-estate-relevant directory set: Zillow, Realtor.com, Homes.com, Yelp, BBB, Bing Places, Apple Maps (Business Connect), Facebook, Nextdoor, Yellow Pages, Bend Chamber of Commerce, Oregon Association of REALTORS, plus the three brokers' portal profiles (memory `reference_agent_portal_profiles` — realtor.com is automation-blocked; note it as manual-for-Matt ONLY after automation is attempted and fails, per `feedback_do_not_offload_to_matt`). For each: exists? name/address/phone/site EXACT vs §1 canon? duplicates? Write `data/local-seo/citations.json`; red-flag every mismatch. Fixes are outward-facing writes → list them, get Matt's go, then apply via browser automation where the platform allows.

### J. Entity/schema + knowledge panel (file-only)
Check: does `[business name] bend` produce a knowledge panel; does org-level `RealEstateAgent` JSON-LD with `sameAs` (socials + Zillow/realtor.com profiles) exist on the homepage (today it exists on `/lp/bend` — `app/lp/bend/page.tsx`). Site-code changes belong to the growth-loop (it owns `lib/site/json-ld.ts`) — FILE the finding with evidence, don't edit site code from this loop.

## §4 Measurement (close the loop or it didn't happen)

Monthly, before starting a new run: re-score A (pack positions per query — position deltas are the outcome metric), pull `marketing_channel_daily` channel='gbp' 30-day deltas (impressions, call_clicks, website_clicks, direction_requests, action rate), review count + velocity delta. Append one row per month to `data/local-seo/ledger.json`: what shipped last cycle, the before/after, verdict. A change-class that moves pack position or action rate gets repeated; one that doesn't gets dropped. Findings, not vibes.

## §5 What this loop never does

- Publish anything to GBP, a directory, or any public surface without a `marketing_brain_actions` row and Matt's explicit approval on the specific draft.
- Invoke a producer directly (`feedback_brain_pipeline_protocol`) — always through `produce/`.
- Create a new producer or REGISTRY row (G45 producer freeze) — `ops-reputation` already covers this loop's content types; this skill is a session recipe, not an execution-layer producer.
- Execute website-layer fixes — those are growth-loop candidates.
- Trust a directory's rendered listing over the §1 canon — the repo is the source of truth for NAP.
