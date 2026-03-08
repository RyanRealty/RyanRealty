# Ryan Realty — Prioritized Build Sequence Checklist

Follow this order so each phase has the foundation it needs. Matches **Implementation Priority Order** in MASTER_INSTRUCTION_SET.md. Tick as completed.

---

## Priority 1 — Photo Classification and Tagging Pipeline

- [x] **Photo classification pipeline** — Every listing photo through scoring/classification (GPT-4o Vision or Google Vision API). Tags: exterior front, aerial/drone, pool/outdoor living, great room, kitchen, primary suite, bathroom, office/flex, view shot, community amenity, neighborhood, seasonal.
- [x] **Quality score** — Resolution, aspect ratio suitability for hero, composition. Query-time hero selection = highest-scoring photo in category from active listings in geography.
- [x] **Design system and brand tokens** — Navy #102742, Cream #F0EEEC in `globals.css`; all components use tokens. Mobile-first.

---

## Priority 2 — SPARK Sync Engine (State Management and Change-Detection Cascade)

- [x] **Delta sync only** — Cron/worker; fetch only records changed since last successful sync. 15–30 min interval. No brute-force full re-fetch.
- [x] **Listing state classification** — Active, Pending, Closed-not-finalized, Finalized closed (locked, never re-fetched), Expired/Withdrawn.
- [x] **Change detection → cascade** — Status→Pending: inventory + feed event. Status→Closed: market stats recalc (affected geo) + sold feed event. Price change: reduction metrics + price drop feed event. New listing: inventory + new listing feed event. Each change feeds content engine.
- [ ] **Pre-computed statistics cache** — Background job after sync; only affected geographies; report pages read from cache; last-updated timestamp.
- [x] **Transaction + failure handling** — All writes in transaction; retain last success timestamp; retry next interval; no user-facing sync errors.

---

## Priority 3 — Geographic Hierarchy and URL Architecture

- [x] **Geo data model** — Country → State → City → Neighborhood (optional) → Community → Listing. Database-driven; no Oregon hardcoding.
- [x] **URL architecture** — Plan and document migration to `/real-estate/{country}/{state}/{city}/[{neighborhood}/]{community}/` and listing slugs. Redirect strategy. See docs/URL_ARCHITECTURE.md.
- [x] **Neighborhood layer** — Admin: create neighborhoods, assign/reassign communities. No auto-inference from SPARK. Admin → Geography.

---

## Priority 4 — Community Page Hero Selection Logic

- [x] **Media hierarchy at query time** — Tier 1: professional video; Tier 2: drone/aerial; Tier 3: exterior lead photo. Hero for community/city = best asset from active listings in geography using classification tags and quality score.
- [x] **Hero presentation** — Full-viewport, motion-enhanced (e.g. ken-burns pan, parallax). No carousel dots/arrows.

---

## Priority 5 — Activity Feed with Full-Bleed Media Cards

- [x] **Activity feed (basic)** — Price reductions on homepage; newest listings. (Just Sold / Open House when listing_history/OpenHouse available.)
- [x] **Full-bleed media cards** — 4:5 ratio on mobile; lead photo or AI clip; stats overlaid; like/save on every card; infinite scroll; feels like social feed.
- [ ] **Feed reorder for identified visitors** — By viewing history (e.g. Tetherow $2M–$3M activity at top).

---

## Priority 6 — Follow Up Boss Identity Bridge and Real-Time Event Relay

- [x] **FUB listing events** — Tile click, feed card click, save, like → silent event (address, MLS ID, type, timestamp, page, session/contact).
- [x] **Email click identity bridge** — Read FUB tracking ID from URL on load (before anything else); match to contact; link cookie to contact; set first-party identity cookie; server-side FUB event; merge prior anonymous session into contact.
- [x] **Real-time event relay for identified** — Page view (and existing tile/save/listing view) use FUB person id from cookie when not signed in; events stream to FUB contact timeline.

---

## Priority 7 — GA4 Full Custom Event Implementation via GTM

- [ ] **All behavioral events to GA4** — Custom events with full properties (listing, map, search, community, feed, engagement). Not just enhanced measurement.
- [ ] **Audiences** — Anonymous first-time, returning anonymous, identified, high-engagement by score threshold.
- [ ] **GSC connection** — Organic query data + behavior in same environment.
- [ ] **Conversion events** — Contact form, listing save, email alert signup, account creation, phone click, email click. Monitor by source, landing, device.
- [ ] **All tags via GTM** — GA4, Meta, FUB, session recording. Data layer single push to all tools; no code deploy for tag changes.

---

## Priority 8 — Meta Pixel and Conversions API

- [ ] **Pixel on every page** — PageView, ViewContent (listing/community with data), Search (params), Lead (form), CompleteRegistration (account).
- [ ] **Conversions API** — Server-side events in parallel with browser pixel (bypass ad blockers / iOS limits).
- [ ] **Custom audiences** — Visitors 30d, listing detail viewers 14d, high-engagement, form submitters 90d, FUB list synced weekly. Lookalikes if paid runs.

---

## Priority 9 — Lead Scoring Engine and Broker Alert System

- [ ] **Engagement score** — Weighted signals (e.g. detail view 3, video play 5, save 10, return 7d 8, form 25, search 2, community 3, report 4). Decay over time.
- [ ] **Threshold alert** — Score crosses configurable high-intent → FUB alert (name, score, recent activity, link to contact).
- [ ] **Pattern alerts** — Same listing 3+ views in 7d; community listings + community report in same session; dormant 30d then return (re-engagement).

---

## Priority 10 — AI Video Generation Pipeline

- [ ] **When listing has no real video** — Queue AI job. Select 6–10 best photos; Luma Dream Machine (e.g. PiAPI) or Runway Gen-4; branded motion prompt; 20–30s clip, lower-third (address, price). Broker review before publish.
- [ ] **Usage** — Community/city heroes, activity feed, social, email, homepage. Never on listing detail as if real footage. One-line disclosure on community pages.

---

## Priority 11 — Listing Detail Page Swipe-Native Mobile Experience

- [x] **Listing detail** — Collapsible sections; navigation to detail from card/map. (Done.)
- [ ] **Mobile: full-screen photo first** — Entire viewport photo before any data; swipe down for specs, horizontal for photos; address/price/stats as overlay. Swipe-native viewer, not carousel with dots.
- [ ] **Video player** — Autoplay muted, sound toggle, full-screen, progress bar, scrub preview, photo fallback, no layout shift.

---

## Priority 12 — Market Statistics Pre-Computation and Report Pages

- [x] **Report pages as SEO assets** — URL, meta, canonical, OG, Report schema, shareable. (Done.)
- [x] **Reporting layer** — getMarketReportData(period); by city. (Done.)
- [ ] **Pre-computation** — Stats written to cache after sync (Priority 2). All time frames (30d, 90d, 6m, 12m, 24m, 5y) and tiers (state, city, community). Last-synced on every report.
- [ ] **Charts** — Mobile-optimized, interactive, plain-language summaries.

---

## Priority 13 — Automated Social Media Content Engine

- [ ] **Event → content pipeline** — New listing, Just Sold, Price Drop, Under Contract, Market Trend, Hot Community, Appreciation, Interest-based, Seasonal. See CONTENT_ENGINE_TRIGGER_MAP.md.
- [ ] **Caption + assets** — Broker voice; platform-sized images/video; hashtags (brand + algorithmic); deep link. AI video from photos (Luma/Runway) when no real video.
- [ ] **Content dashboard** — Queue: preview, platform, trigger, caption, hashtags. Approve/edit/dismiss; optional auto-publish. One-tap share to connected accounts (OAuth).
- [ ] **Performance tracking** — Pull engagement where APIs allow; feed back into engine. Compliance baked in; Just Sold and AI video require broker review.

---

## Priority 14 — Identified Visitor Personalization

- [ ] **Saved listings** — Surface prominently for identified visitors.
- [ ] **Default context** — If history shows price range and community, default map and search to that on return.
- [ ] **Under-contract + similars** — If they viewed a listing 3× and it goes under contract, notification + similar listings.
- [ ] **New in browsed community** — Surface new listing in community they’ve browsed on next visit.

---

## Priority 15 — Type Two Resort Community Microsites

- [x] **Resort config** — Full Oregon list in lib/resort-communities.ts; Resort schema; About + Amenities sections. (Done.)
- [ ] **Full microsite treatment** — Immersive hero (video/Tier 2), amenity showcase, membership overview, editorial lifestyle, listings, market data, CTA. Outrank resort’s own site on real estate queries. Schema: Resort, GolfCourse, AmenityFeature, ItemList, FAQPage.
- [ ] **Cross-reference SPARK** — Ensure subdivision names match SPARK data; add any missing Type Two communities.

---

## Supporting / Already Addressed

- [x] **Map and grid** — Fit bounds, cluster when unreadable, pins branded; same dataset/filters; per page 6/12/24/48, columns 1–4, jump-to-page.
- [x] **SEO** — Metadata, canonicals, sitemap, robots, structured data, internal linking, social previews on key pages.
- [x] **Community type one and city pages** — /search/[city]/[subdivision]; city = /search/[city]; content briefs wired.
- [x] **Saves and likes** — Persistent; FUB event on save.
- [x] **One-tap share** — ShareButton; OG/Twitter previews.
- [ ] **UTM on outbound links** — source, medium, campaign, content; store with sessions/contact for attribution.
- [ ] **Cookie consent and privacy** — First-party only; CCPA/Oregon banner; no non-essential tracking until consent; opt-out honored; 90d anonymous purge if unlinked. No fingerprinting, third-party identity vendors, or data brokers.

---

## Ongoing

- [ ] **Analytics and engagement** — Dwell time, pages per session, return rate, likes/saves/shares/video plays/map interactions.
- [ ] **Content calendar** — Market reports, neighborhood/community updates, seasonal content.
- [ ] **Backlink and ranking tracking** — Organic visibility and referral traffic.
- [ ] **Quality benchmark pass** — Every shipped feature run through master instruction set questions.

---

*Master: MASTER_INSTRUCTION_SET.md. Content briefs: CONTENT_BRIEF_TEMPLATES.md. Content engine: CONTENT_ENGINE_TRIGGER_MAP.md. **What you need to finish everything:** docs/WHAT_I_NEED_TO_COMPLETE.md.*
