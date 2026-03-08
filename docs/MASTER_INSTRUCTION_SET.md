# Ryan Realty — Luxury Real Estate Platform Master Instructions

**This document is the governing foundation for every decision on this project.**

---

## PROJECT VISION

Build the best real estate website in the world, starting in Central Oregon and scaling globally. Organic growth only — no paid acquisition. Every decision must serve: organic traffic dominance, lowest bounce rate, highest engagement, most shared content, most trusted brand, and scalable quality. The site is not a listing database with a template. It is a content platform that happens to sell real estate, and every piece of listing data, every photo, every video is raw material for an experience that should feel closer to scrolling Instagram than browsing the MLS.

---

## CORE STANDARDS

Mobile-first design. The primary user is on a phone. Performance is non-negotiable from day one. Lighthouse scores are a build requirement, not an afterthought. The quality benchmark is: faster than competition, more engaging, more informative, flawless on mobile, shareable, and SEO-optimized at every level. UI standards are enforced at the project config level via a design system token file. **Brand colors are Navy #102742 and Cream #F0EEEC.**

---

## SPARK API SYNC ARCHITECTURE

All listing data comes from the SPARK API. The sync is smart: finalized closed listings are locked permanently and never re-fetched. Active and pending listings are monitored every 15 to 30 minutes via delta queries.

Listing state classifications: Active, Under Contract or Pending, Closed but Not Finalized, Finalized Closed (immutable, never re-fetched), Expired or Withdrawn (locked with last known data).

Change detection triggers specific cascades only. Status change to pending updates inventory and fires a pending feed event. Status change to closed recalculates all market stats for affected geographies and fires a sold feed event. Price change updates reduction metrics and fires a price drop feed event. New listing updates inventory and fires a new listing feed event. Each change also feeds the automated content engine.

Market statistics are pre-computed after every sync, written to cache, and served instantly. Recalculation is scoped only to affected geographies. Every stat carries a last-synced timestamp. Price history and listing history are pending from SPARK and will be backfilled when available, then locked with finalized listings.

Sync runs as a background cron job and never touches the front end. All writes are wrapped in transactions. Failures are logged and retried on the next interval with no user-facing errors.

---

## GEOGRAPHIC HIERARCHY

Country → State → City → Neighborhood (optional, manual) → Community or Subdivision → Listing. Every tier gets its own page, URL, metadata, Schema markup, and SEO strategy. Never hardcode Oregon logic. The architecture must support any geography.

Neighborhoods are manually assigned in admin and never auto-populated. Communities without neighborhoods sit directly under city. URL structure is clean and hierarchical: `/real-estate/oregon/bend/tetherow/123-fairway-drive-bend-or-97703/`

Two community types exist. Type One is a Standard Subdivision with clean data-driven presentation and Schema types Residence, ItemList, and BreadcrumbList. Type Two is a Resort Community with full microsite treatment: immersive hero, video, amenity showcase, membership overview, and editorial content. The goal for every Type Two community is to outrank the resort's own site on real estate queries. Schema types for Type Two are Resort, GolfCourse, AmenityFeature, ItemList, and FAQPage.

---

## TYPE TWO RESORT COMMUNITIES — FULL OREGON LIST

**Central Oregon — Bend:** Tetherow, Pronghorn (Juniper Preserve), Broken Top, Awbrey Glen, Widgi Creek, River's Edge, Lost Tracks / Sunset View, Mountain High, Seventh Mountain, Mt. Bachelor Village

**Sunriver and La Pine:** Sunriver Resort, Crosswater, Caldera Springs, Vandevert Ranch

**Powell Butte:** Brasada Ranch, Thornburgh / Tribute (planned)

**Sisters:** Black Butte Ranch, Aspen Lakes, Suttle Lake Lodge

**Redmond:** Eagle Crest Resort, Greens at Redmond

**Terrebonne and Prineville:** Crooked River Ranch, Three Rivers Recreation Area

**Warm Springs:** Kah-Nee-Ta Hot Springs Resort

**Eastern Oregon:** Silvies Valley Ranch (Seneca), Minam River Lodge, Wildhorse Resort (Pendleton)

**Southern Oregon — Klamath Falls:** Running Y Ranch

**Medford and Rogue Valley:** Rogue Valley CC, Centennial GC, Quail Point, Bear Creek, Stewart Meadows, Eagle Point GC, Quail Run, Stone Ridge, Poppy Village

**Grants Pass:** Dutcher Creek, Grants Pass GC, Applegate GC, Shadow Hills

**Coast — North:** Gearhart Golf Links, Highlands GC, Manzanita GC, Seaside GC

**Coast — Central:** Salishan Coastal Lodge, Chinook Winds, Crestview / Fairway Villas (Waldport)

**Coast — South:** Ocean Dunes (Florence), Three Rivers Casino, Bandon Dunes

**Mt. Hood and Gorge:** Mt. Hood Oregon Resort (Welches), Persimmon CC (Gresham), Cooper Spur, Hood River GC

**Portland Metro:** Rock Creek CC, Pumpkin Ridge, The Reserve, Tualatin CC, Lake Oswego CC, Oregon GC (West Linn), Claremont, Oswego Lake CC, Heron Lakes, Portland GC

**Willamette Valley:** Emerald Valley (Creswell), Shadow Hills CC (Junction City), Trysting Tree (Corvallis), Santiam (Stayton), McNary (Keizer), Creekside, Illahe Hills, Salem GC

Cross-reference all of these against SPARK subdivision data to catch any communities not yet on this list.

---

## MARKET REPORTING

Pre-computed stats at every geographic tier, served from cache, load instantly. Variable time frames: 30 and 90 days, 6, 12, and 24 months, 5 years, custom. Track: median and average price, price per square foot trends, days on market, list-to-sale ratio, inventory, new listings, closed sales, price reductions, absorption rate, year-over-year appreciation, sold volume, and seasonal trends.

Every report page is a fully indexed SEO asset with unique metadata, shareable as a branded link, and carries a last-synced timestamp. Charts are mobile-optimized, interactive, and include plain-language summaries.

---

## AUTOMATED SOCIAL MEDIA CONTENT ENGINE

Every database event is potential content. The engine identifies moments, evaluates content potential, generates platform-appropriate assets, and queues them for review or publishing.

Content types auto-generated: New Listing Alerts (immediate on sync), Just Sold (on finalized close), Price Drop (on reduction sync), Under Contract (on pending status), Market Trend Summaries (weekly and monthly scheduled), Hot Community Alerts (threshold-triggered), Price Appreciation Milestones (YoY and multi-year thresholds), Interest-Based amplification (high saves and views trigger), Seasonal and Calendar-Driven content, and AI Video Generation from listing photos via Luma AI or Runway when professional video is unavailable.

Platform-specific optimization: Instagram and Reels (visual, under 30 seconds, strong opening 2 seconds, overlaid text, single CTA, carousel posts). Facebook (longer story-form, market graphics, locally relevant video, shareable to groups). TikTok (immediate, surprising, or educational content, dramatic hook, 3-second opening critical). LinkedIn (market analysis, investor data, appreciation trends, authority positioning). X (short punchy stats, rapid commentary).

Content Dashboard is a broker-facing first-class feature. The queue shows preview, platform, trigger event, generated caption, and hashtags. Approve, edit, dismiss, or auto-publish if enabled. Each piece is fully formatted and platform-ready with a deep link back to the site. One-tap sharing to connected social accounts via OAuth APIs for Instagram, Facebook, LinkedIn, TikTok, and X.

Caption standards follow the broker's voice: direct, authentic, no generic real estate phrases, no superlatives, no hyphens or colons, no hollow claims. Platform-calibrated length. Always ends with a CTA linking to the site.

Hashtags are dynamic. Brand-standard hashtags always included: #RyanRealtyBend #BendOregon #BendRealEstate #CentralOregon #BendHomes #BendLife #QualityLocalService. Community-specific hashtags added as relevant: #Tetherow #SunriverOregon. Event-specific hashtags added: #JustListed #JustSold #PriceDrop.

Performance tracking: engagement data pulled back where APIs allow, surfaced in the dashboard, and fed back into the engine to weight future generation toward high-performers.

Compliance is baked into generation logic, not a manual review layer: Oregon real estate law, MLS rules, fair housing, broker identification, no misrepresentation, no confidential transaction data.

---

## VISITOR TRACKING, BEHAVIORAL INTELLIGENCE, AND LEAD CONVERSION

The platform tracks every visitor, every action, and every signal with the precision of a top-tier consumer web application. The goal is to know everything legally knowable about every person who touches the site, convert anonymous visitors into identified leads as quickly as possible, and give the broker a real-time intelligence feed on every contact's behavior.

**The Identity Resolution Funnel** — Every visitor is in one of three states. State One: fully anonymous (first-party session cookie, all behavior captured). State Two: cookied but unidentified (historical data accumulating). State Three: fully identified (cookie linked to FUB contact; all current and historical data attributed; real-time events stream to contact record).

**Email Click Identity Bridge** — When FUB sends an email and the contact clicks a link, FUB appends a unique tracking identifier to the URL. On landing: read identifier from URL before anything else; match to FUB contact; permanently link cookie to contact; set first-party identity cookie (FUB contact ID, encrypted); fire server-side event to FUB (identity resolution, email, landing URL, timestamp, device); merge prior anonymous session history into contact. From then on, every page visit, listing view, search, community browse, video play, save, like, and return streams to FUB in real time. Highest-priority identity pathway.

**Real-Time Behavioral Event Tracking** — For anonymous: store locally. For identified: stream to FUB in real time. Events: Listing (tile impression, tile click, detail view with address/MLS/price/community/city/type, gallery interaction, video play, video completion 75%, save, share, contact form, time on page); Map (loaded with count, pin click, viewport change, filter applied); Search (performed with params, results viewed, saved); Community/geography (community view, neighborhood view, city view, market report view and time on page); Feed (card impression, card click with type, scroll depth); Engagement (contact form with location, phone click, email click, chat, account created, login, email alert signup, listing alert, return 24h/7d, session depth, session duration).

**Follow Up Boss Real-Time Contact Intelligence** — Every event pushes a structured activity note to the contact timeline. Derived fields pushed to FUB: total listings viewed, total detail views, most viewed listing, most viewed community, price range viewed (min/max), session count, most recent session, days since first identified, engagement score (weighted), hot lead flag (configurable threshold → broker notification).

**Session Recording and Heatmaps** — Microsoft Clarity (free, no session limits) or Hotjar. Session replay and heatmaps for UX; for identified contacts, replay is lead intelligence.

**Google Analytics 4** — Full custom event tracking. Audiences: anonymous first-time, returning anonymous, identified, high-engagement. Connect to Search Console. Conversion events: contact form, listing save, email alert signup, account creation, phone click, email click. Monitor by source, landing page, device.

**Google Tag Manager** — All tags (GA4, Meta Pixel, FUB identity bridge, session recording, future) via GTM. No code deploy for tag changes. Data layer passes event properties to all tools in one push.

**Meta Pixel and Conversions API** — PageView, ViewContent (listing/community with data), Search, Lead, CompleteRegistration. Run CAPI server-side in parallel with browser pixel. Custom audiences: visitors 30d, listing detail viewers 14d, high-engagement, form submitters 90d, FUB list synced weekly.

**Automated Lead Scoring and Broker Alerts** — Weighted engagement score with decay. Threshold → FUB alert (name, score, recent activity, link to contact). Pattern alerts: same listing 3+ times in 7 days; community listings + community report in same session; dormant 30+ days then return.

**Identified Visitor Personalization** — Surface saved listings; default map/search to inferred community and price range; under-contract notification + similar listings; new listing in browsed community on next visit.

**UTM Parameters** — Required on all outbound links: source (followupboss, instagram, facebook), medium (email, social, organic), campaign (message or campaign name), content (listing, community). Store with sessions and contact events for attribution.

**Cookie Consent and Privacy** — First-party cookies only. Cookie consent banner required (CCPA and Oregon). Clean, non-intrusive; describes data collection; stores choice; no non-essential tracking until consent. Functional opt-out; honor across all systems. Anonymous data 90 days then purge if unlinked; identified data retained indefinitely. The platform does not use: browser fingerprinting, third-party identity resolution vendors, other sites' cookies, purchased data broker lists, or any method outside the direct visitor relationship or existing contact database.

---

## DYNAMIC MEDIA ARCHITECTURE AND VISUAL ENGAGEMENT

**The Media Asset Hierarchy** — Tier One: original professional video (SPARK). Tier Two: drone or aerial photography. Tier Three: high-quality exterior listing photography (lead MLS photo). Tier Four: interior photography (editorial, feature rows, feed, AI video source). Tier Five: AI-generated video and imagery when no real media exists.

**Photo Classification and Intelligence Layer** — Every listing photo through a scoring/classification pipeline (GPT-4o Vision or Google Vision API). Tags: exterior front, aerial/drone, pool/outdoor living, great room, kitchen, primary suite, bathroom, office/flex, view shot (mountain, water, etc.), community amenity, neighborhood/streetscape, seasonal. Quality score (resolution, aspect ratio, composition). At query time: hero for community/city = highest-scoring photo in category from active listings in that geography. Always current.

**Community and City Page Hero Strategy** — Community: full-viewport, motion-enhanced background (Tier 1 or 2). Best asset cycles with slow ken-burns pan (CSS), subtle parallax on scroll. No carousel dots or arrows. City: top aerial/landscape from listings or communities in city.

**AI Video Generation Pipeline** — When listing lacks real video or page needs cinematic content: queue AI job. Select 6–10 best photos; call Luma AI Dream Machine (e.g. via PiAPI ~$0.20/gen) or Runway Gen-4; branded motion prompt (smooth camera, slow zooms, parallax, warm lighting). Output 20–30s clip, branded lower-third (address, price) near end. Luma for volume; Runway for hero placements. AI-generated video never on listing detail where it could be mistaken for real footage. Use for: community/city heroes, activity feed, social, email, homepage. One-line disclosure on community pages. Check Oregon MLS on sold-listings photo use before building.

**MLS Photo Rights** — IDX permits displaying other brokers' listings as listings (card with attribution, IDX disclosure, data current). Not permitted without written permission: detaching photo from listing context for hero, background, or editorial. For your own listings: full control. For heroes/editorial: your listings' photos, AI from your photos, or commissioned photography you own.

**Scroll-Native Engagement** — Mobile listing detail: full-screen photo first (entire viewport); swipe down for specs, horizontal for photos. Swipe-native viewer; address/price/stats as translucent overlay. Activity feed: infinite scroll, full-bleed 4:5 cards, lead photo or AI clip, stats overlaid, like/save on every card. Community hero animates; listing cards subtle zoom on hover / crossfade in viewport on mobile; price charts and stat numbers animate on scroll. For identified visitors, feed reorders by viewing history. Every video autoplays muted; speaker icon for sound; first 3 seconds communicate hook without audio.

**Third-Party Imagery** — Unsplash API (free) for geography context only: landscapes (mountains, forests, rivers, skies) to establish place. Never for specific property, community building, or golf course. Tag with source flag; replace with real listing asset when one becomes available.

---

## SEO ARCHITECTURE

Server-side rendering or static generation on every page. Dynamic metadata on every page. Canonical URLs throughout. Full Schema.org at every geographic tier: State, City, Neighborhood, Residence and Resort community types, RealEstateListing with all fields, Person (agent), VideoObject, ImageObject, BreadcrumbList. Auto-updating XML sitemaps. Clean keyword-rich URLs. Semantic HTML. Keyword-informed alt text. Deep internal linking. Core Web Vitals green. Rich social previews. All market report pages fully indexed.

---

## ACTIVITY FEED

Real-time from sync events. Card types: Recently Listed, Just Sold, Price Drop, Open House. Photo or video thumbnail, key stats, activity label, like button. Filterable. On mobile: feel and behave like a social feed.

---

## MAP AND GRID

No clustering unless truly unreadable. Fit viewport to listing boundaries on load. Pins clean, branded, responsive. Map and grid are one system: same dataset and filters, simultaneous updates. Grid controls: per page (6, 12, 24, 48) and columns (1, 2, 3, 4) as premium segmented buttons.

---

## SAVES AND LIKES

Available from any context. Immediate, satisfying. Persistent saved location (account or cookie). Silent FUB event on every save. High-save listings feed content engine and social queue.

---

## VIDEO PLAYER

Custom player throughout: autoplay muted, sound toggle, full-screen, branded progress bar, scrub preview, graceful photo fallback, mobile-optimized, no layout shift. Oregon real estate law compliant.

---

## FOLLOW UP BOSS ACTIVITY TRACKING

Every listing click, feed card click, save, and like fires a silent event to FUB: address, MLS ID, event type, timestamp, page, session/contact ID. Zero UI disruption and zero latency impact.

---

## BROKER VOICE AND CONTENT STANDARDS

All generated content (captions, descriptions, emails, alerts) must follow: no hyphens as dashes, no colons, no overtly stated honesty or transparency (convey by language), no generic real estate phrases, no pandering, no superlatives, direct and empathetic tone, conversational authenticity over corporate polish.

---

## IMPLEMENTATION PRIORITY ORDER

1. Photo classification and tagging pipeline. Everything else in the media strategy depends on this.
2. SPARK sync engine with state management and change-detection cascade.
3. Geographic hierarchy and URL architecture.
4. Community page hero selection logic.
5. Activity feed with full-bleed media cards.
6. Follow Up Boss identity bridge and real-time event relay.
7. GA4 full custom event implementation via GTM.
8. Meta Pixel and Conversions API.
9. Lead scoring engine and broker alert system.
10. AI video generation pipeline for all listings lacking real video.
11. Listing detail page swipe-native mobile experience.
12. Market statistics pre-computation and report pages.
13. Automated social media content engine.
14. Identified visitor personalization layer.
15. Type Two resort community microsites.

---

*Reference: BUILD_SEQUENCE_CHECKLIST.md (implementation order); CONTENT_BRIEF_TEMPLATES.md (copy/SEO); CONTENT_ENGINE_TRIGGER_MAP.md (events → content → platforms).*
