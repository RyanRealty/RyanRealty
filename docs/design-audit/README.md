# Ryan Realty — Full-Site UI/UX Design Audit

**Date:** 2026-07-12 · **Auditor:** Claude (senior product-design-lead lens) · **Build:** live `next dev` off `main` @ `4780d901`

> **Prior passes preserved:** the fully-remediated **[2026-07-07 audit](README.2026-07-07.md)** (218 findings, all fixed) and its **[2026-07-11 search-system addendum](search-audit-2026-07-11.md)** still live in this folder. This is a fresh 2026-07-12 pass on the current build; the "[Since the 2026-07-07 audit](#since-the-2026-07-07-audit)" section reconciles the two.

**The question this answers:** can a normal Bend buyer or seller land on the site, **understand** what it is, **trust** it enough to hand over contact info, and **finish the core action** (find a home and ask about it · request a home valuation) without help — measured against the Zillow-class bar consumers arrive with. Not "does it look nice." Every issue is tagged **P0–P3**, marked for which of **understanding / trust / conversion** it hurts, with a **specific fix** and an **effort** estimate.

---

## TL;DR — the verdict

**This is a strong, genuinely high-quality site — better than most brokerage sites in the country.** The homepage, search, and listing-detail surfaces are portal-class: a natural-language search ("3 bed under $800k in Bend with a shop") that parses to real filters, a Zillow-grade split map + cards results page with a well-built zero-results empty state, a listing page with a broker-attributed **Schedule a Tour / Call / Text** rail and 5.0★ social proof, and an excellent recovery 404. First impressions on the flagship pages are excellent, the brand system is distinctive, and the accessibility/consent baseline is above average.

**What holds it back is coherence and finishing, not the core product.** Three patterns generate most of the register:

1. **Two navigation systems collide mid-funnel.** A premium "KbNav" (uppercase, transparent-over-hero) runs on ~58 pages including the homepage and listing detail; an older "SiteHeader" (Title Case, solid navy, with conversion CTAs) runs on the **search results page** and legal/report pages. Because the seam sits *inside the primary buyer funnel* (click **HOMES** → land on a differently-chrome'd search page → open a listing → chrome changes back), a first-time user momentarily feels like they left the site. That single split spawns ~a third of the findings (nav, footer, buttons, mobile drawer, megamenu, auth label, CTA placement). This is the same "register seam" the 2026-07-07 audit flagged as recommendation #4 — it was *bridged*, not *unified*, and is still live.
2. **One hero template forced onto every intent.** The (beautiful) KB hero ships a generic two-CTA row ("Browse" / "Home worth?") and a reused Old Mill drone photo, then gets dropped onto pages of every intent — reviews, FAQ, tools, open-houses, buy, luxury. Result: off-intent CTAs, funnel entries with no clear primary action, and the same photo on 7+ pages. (Prior audit recommendation #2, "give KbHero intent variants," still open.)
3. **Empty / loading / media states aren't finished.** Photoless listing tiles render as flat navy voids; MLS tour videos paint a solid black block while buffering; an unfilled AdSense slot leaves a "Sponsored" dead box; the open-houses page with no open houses jumps straight to a seller pitch. (Prior audit theme 5, "media states paint black," partially recurs.)

**Net:** nothing here is a rebuild. Consolidate the two navs, give the hero per-intent CTAs/imagery, and finish the empty/media states, and this site clears the bar on all three axes. **One safe fix (hero eyebrow contrast) was applied and browser-verified in-session.**

### Severity counts (this pass, after dedup + verification)

| | P0 | P1 | P2 | P3 |
|---|:-:|:-:|:-:|:-:|
| Cross-cutting review (nav/design/conversion/states) | 1 | 2 | 9 | 2 |
| Per-page review (28 pages, P0/P1 adversarially verified) | 0¹ | 6 | 57 | 46 |

¹ One per-page "P0" (luxury-listing hero showing a security block page) was **verified to be a capture-network artifact** — the live hero renders its Vimeo drone video correctly; the real defect is a latent no-fallback resilience gap (reframed to P2). See [caveats](#caveats).

### The 5 issues hurting conversion most

1. **[P0 · convert·trust·understand] The search results page wears a different header/footer than the rest of the site.** The buyer's most-used page reads as a different product mid-funnel; nav labels, CTAs, and account affordance all change. → *Unify to one header/footer on every public route.*
2. **[P2 · convert · mobile] The map view is unreachable on mobile search** — no List/Map switcher renders, so phone users (the majority) can't get to the map at all on the core find-a-home page. → *Render the List/Map/Split switcher on mobile.*
3. **[P2 · convert·trust] The listing-detail broker differs by viewport** — desktop names "Paul Stevenson," the mobile sticky bar says "Your broker · Matt." One home names two contacts in one session. → *Resolve the broker once, feed both surfaces.*
4. **[P2 · convert] The contact page buries the fastest contact methods** — the hero is a single "Send a message" button; phone/email live only in the footer, while a *listing* page surfaces call/text directly. → *Put tap-to-call + email in the contact hero.*
5. **[P2 · convert] Funnel-entry pages have no clear primary CTA** — `/buy` opens on five identical ghost buttons; `/sell` re-asks the address across two near-identical valuation heroes; `/open-houses`, `/faq`, and `/tools` heroes push generic/seller CTAs that point away from the page's job. → *Give the KB hero a per-page CTA row (one primary), and prefill the valuation address.*

### 5 quick wins fixable today

1. **✅ DONE — hero eyebrow contrast.** `.hero-tag` was 70%-opacity cream with no shadow and dropped below readable contrast over the bright hero photo. Fixed to full cream + a soft navy text-shadow (`components/site/kb/kb.css`), browser-verified. Applies to every KB hero.
2. **Auth label consistency** — the header says **ACCOUNT** on KB pages and **Sign in** on search. Pick one ("Sign in" logged-out) everywhere. *(copy)*
3. **Currency format consistency** — the same regional median renders `$742,000` on home/market but `$742K` on the cities tile. Align to the brand rule (round to thousands, full format). *(formatter)*
4. **Seller LP accent** — `/lp/seller-home-value` uses an off-brand **orange** CTA + orange stars that clash with the navy/cream site it feeds into. Swap to brand navy (or keep as a logged A/B). *(token)*
5. **Broker track-record grid** — the `/team/matthew-ryan` "Featured Homes / Track record" grid renders 3 of 9 tiles as empty flat-navy voids (photoless sold listings). Filter photoless tiles out before the row cap (6 good tiles beat 9 with 3 holes). *(one `.slice` filter)*

---

## Since the 2026-07-07 audit

The prior audit was fully remediated (`remaining-backlog.json` is `[]`). This pass, on the current build, confirms:

- **Held / fixed and still good:** editorial-page CTAs now render with visible text (the navy-on-navy cascade bug is gone); the search filter bar docks correctly; the zero-results empty state names the cause and offers *Clear all filters*; the 404 recovers well; the mortgage default is sane. Good.
- **Still open (was a "bigger recommendation," not a fix):** the **two-nav register seam** (rec #4) — bridged, not unified. Now the single P0.
- **Recurring class, new instances:** *scope-mislabeled "Live" feeds* — the prior audit fixed `/cities/[slug]` ("Live · Awbrey Butte" → "Live · Bend"), but **`/communities/[slug]` still shows the same bug** ("Live · Tetherow" listing a Bend/Petrosa home). *Media-renders-black* (theme 5) recurs on the home Featured card, the luxury Featured card, and the Tetherow featured media. *Reused Old Mill hero* recurs across blog/about/market/utility pages. *KbHero generic CTAs* (rec #2) still applied to every intent.
- **New this pass:** hero eyebrow contrast (fixed); the viewport broker mismatch on listing detail; the broker track-record navy voids; the mobile search map switcher missing; the `/resources` empty "Sponsored" ad box; the `/open-houses` empty-state void; the luxury-listing hero's no-fallback embed.

---

## Methodology

- **Real site, real data.** Booted the actual Next.js app (`next dev`, :3000) and drove live pages — homepage, search/IDX, a real mid-market $550K listing and a $11.9M luxury listing, the seller funnel, trust pages, discovery hubs, market/authority pages, content, tools, account entry.
- **Capture.** Playwright under `prefers-reduced-motion: reduce` (which disables the site's Lenis smooth-scroll wrapper → clean, non-blank full-page captures — a documented gotcha here). Each page captured as **readable viewport panels** (desktop 1440×900 @1.5×, mobile 390×844 @2×) so reviewers judge real pixels, not a downscaled tall image. 456 page panels + 12 state/nav captures.
- **Coverage.** 28 pages × (desktop + mobile where applicable), plus states: 404, invalid-listing, zero-results empty search, both megamenus open, both mobile drawers.
- **Review.** A multi-agent panel reviewed every page across the 7 dimensions and traced the buyer + seller funnels; a separate cross-cutting pass covered nav/IA, design-language, conversion paths, and states. Every **P0/P1** finding was re-checked by an **adversarial verifier** told to refute it, and the highest-risk findings were then **live-verified by hand** in the browser.

### Caveats

- **Dev-only chrome.** Captures ran against `next dev`, so a small dark **"N" circle in the bottom-left corner is the Next.js dev-mode indicator** (confirmed via the live DOM: `nextjs-portal` + dev-tools shadow root; no such production element) — a capture artifact, **excluded** from findings.
- **Luxury-hero "security error" was an artifact.** A per-page agent flagged a P0: the $11.9M listing hero showing "We couldn't verify the security of your connection." Live verification shows the hero renders its Vimeo drone video correctly (`player.vimeo.com/video/1109492359`) — the capture machine's network transiently blocked the video host. **Reframed to P2:** the real defect is that the full-bleed hero embed has no `onError`/photo fallback, so *any* embed failure (firewall, geo-block, host down) surfaces the embed's error page as the hero. Recommend adding an `onError → photos[0]` fallback.
- **"Invisible Text Matt / Email Matt buttons" (agent P2) did not hold.** Live check: those buttons are navy text on a cream fill (readable); the fill blends into the cream section, so it's a minor affordance nit, not an invisible-CTA regression. **Downgraded to P3.**
- **Sign-in modal.** Automated captures suppressed the first-visit "Get the most out of Ryan Realty" prompt (via localStorage) so pages could be seen; driving the homepage *without* suppression shows it appears over the hero on first load (noted as CNV-4).
- **P2/P3 confidence.** Only P0/P1 were adversarially verified; P2/P3 are single-agent observations. Two scary ones were downgraded on live check (above), so treat the P2/P3 list as leads to confirm, not gospel. The themes below are corroborated across multiple pages/agents and are high-confidence.

---

## Coverage

| Surface | Route | Desktop | Mobile |
|---|---|:-:|:-:|
| Homepage | `/` | ✅ | ✅ |
| Search results (IDX) | `/homes-for-sale` | ✅ | ✅ |
| Listing detail (mid $550K) | `/listing/…` | ✅ | ✅ |
| Listing detail (luxury $11.9M) | `/listing/…` | ✅ | — |
| Sell · Valuation · Seller LP | `/sell` `/sell/valuation` `/lp/seller-home-value` | ✅ | ✅ |
| About · Team · Broker profile | `/about` `/team` `/team/matthew-ryan` | ✅ | ✅/✅/— |
| Contact | `/contact` | ✅ | ✅ |
| Cities hub · City detail | `/cities` `/cities/bend` | ✅ | ✅ |
| Communities hub · Community | `/communities` `/communities/tetherow` | ✅ | ✅ |
| Housing market · Report | `/housing-market` `/housing-market/central-oregon` | ✅ | ✅/— |
| Reviews · Blog · Article | `/reviews` `/blog` `/blog/…` | ✅ | ✅/✅/— |
| Buy · Luxury LP | `/buy` `/luxury-homes-bend` | ✅ | — |
| FAQ · Resources · Open houses · Mortgage calc | … | ✅ | — |
| Login · Signup | `/login` `/signup` | ✅ | — |
| States | 404 · invalid-listing · empty-search · megamenus · mobile drawers | ✅ | ✅ |

---

## What's genuinely strong (say it plainly)

- **Homepage hero** — full-bleed Old Mill drone, big Amboqia display headline, a natural-language search bar, and a **live** proof line (`1,870 homes · median list $742,000 · pending in 20 days`). Understands its audience in the first second.
- **Search / IDX** — split map + cards, filter pills, sort, Split/List/Map toggle, Save-this-search, and a genuinely helpful **zero-results empty state** ("No homes match these filters here / Loosen a filter, or zoom out" + Clear-all + removable chips). Portal-class.
- **Listing detail** — a "Talk to a broker" rail with broker headshot + license #, **Schedule a Tour** primary + **Call / Text**, phone, email, and **5.0★ · 25 Google reviews** with a testimonial. Excellent conversion scaffolding.
- **404** — search box + three recovery links + homepage link. Keeps the user oriented.
- **Trust/compliance** — a privacy-respecting cookie banner (Accept all / Essential only / Preferences / Do Not Sell), consistent Amboqia + Geist type, tabular numerals on stats, broker license numbers surfaced.

---

## Findings by dimension

Severities are the **verified/synthesized** severity. `hurts` = which axis it damages.

### 1 · Navigation & information architecture

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| NAV-1 | **P0** | u·t·c | **Two entirely different global headers depending on route.** KB pages render KbNav (uppercase, transparent, no CTAs); the **search results page** + legal/report pages render SiteHeader (Title Case, solid navy, with Sign in / Get listing alerts / What's my home worth). The nav's identity changes on the core home→search→listing path. Confirmed in `app/layout.tsx` + `lib/site/chrome-routes.ts`. | Consolidate to **one** header on every public route (recommend keeping SiteHeader's persistent CTAs + IA, brand-styled). | large |
| NAV-2 | P1 | u·c | **Top-level IA differs between the two headers.** Communities/Cities are primary tabs on KB but demoted into a dropdown on SiteHeader; Market/Guides/About are top-level on SiteHeader, absent as KB tabs. Same destination, different depth. | One top-level IA (5 primary destinations), consistent depth everywhere. | medium |
| NAV-3 | P2 | t | Nav casing/register clash — ALL-CAPS (KB) vs Title Case (SiteHeader). Both are Geist sans (not a serif/sans clash — verified). | One casing rule + one nav font. | medium |
| NAV-4 | P2 | u | Auth entry labeled two ways — "ACCOUNT" (KB) vs "Sign in" (SiteHeader). | One label ("Sign in" logged-out) everywhere. | quick |
| NAV-5 | P2 | c | Persistent conversion CTAs exist only on SiteHeader; KB pages (incl. high-intent listing detail) have no persistent header CTA. | Carry a persistent CTA in the consolidated header. | medium |
| NAV-6 | P2 | u·t | Two mobile drawer paradigms (full-screen navy list vs right-side white accordion). | One mobile drawer component. | medium |
| NAV-7 | P2 | u | Two desktop megamenu models (full-screen takeover vs hover dropdown with lead card). | One megamenu pattern (recommend the hover panel + lead card). | medium |
| NAV-8 | P2 | t·c | No persistent phone / click-to-call in either header (only at the bottom of the KB menu; absent in SiteHeader). | Persistent `tel:` / "Call" affordance in the header + mobile drawer. | quick |
| NAV-9 | P2 | t | Footer is also two systems (homepage KB footer vs global SiteFooter, different taxonomy). | One SiteFooter on every public route. | medium |

### 2 · Conversion paths

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| CNV-1 | P2 | c | **Map view unreachable on mobile search** — no List/Map/Split switcher renders on phones, so mobile buyers can't reach the map on the core find-a-home page. | Render the view switcher on mobile. | medium |
| CNV-2 | P2 | c·t | **Listing broker differs by viewport** — desktop rail "Paul Stevenson" (SSR default → hydrates to attributed broker) vs mobile sticky bar "Your broker · Matt" (no attribution swap). Same home, two contacts. | Resolve the broker once; feed both the desktop card and mobile bar. | medium |
| CNV-3 | P2 | c | **Contact page hides the fastest contact methods** — hero is a single "Send a message"; phone/email only in the footer, while a *listing* surfaces call/text. | Put tap-to-call + email in the contact hero (or lift the form up). | medium |
| CNV-4 | P2 | c | **Seller funnel re-asks the address** across two near-identical valuation heroes (`/sell` + `/sell/valuation`); the second form shows an empty placeholder. | One canonical entry; prefill the address the user already typed. | medium |
| CNV-5 | P2 | c | **Funnel-entry pages lack a clear primary CTA** — `/buy` = five identical ghost buttons; `/open-houses`, `/faq`, `/tools`, `/resources` heroes stack generic/seller/off-intent CTAs that point away from the page's job. | Give KbHero a per-page CTA row (label/href/which-is-primary); one primary per page. | medium |
| CNV-6 | P2 | c | First-load sign-in modal covers the homepage hero before the value prop lands (dismissible via "Maybe later"). | Delay the prompt (scroll-depth/time) or make it non-blocking. | quick |
| CNV-7 | P2 | c·t | **Nearby/featured rails aren't price-relevant** — a $550K listing's "Featured Homes" rail shows only $4M–$12M estates (`fetch-nearby-tiles` sorts price-desc, widens to city-wide, still price-desc); `/luxury-homes-bend` promises 214 homes and shows 12. | Re-rank rails by price proximity (±band); reconcile the count vs display. | medium |
| CNV-8 | P3 | c | Repeated back-to-back home-valuation asks on `/team/matthew-ryan`, `/housing-market/central-oregon`, and `/resources` (two identical closers stacked). | One valuation CTA per page. | quick |

### 3 · Component & visual consistency

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| CMP-1 | P2 | t | Primary buttons split into two systems — all-caps rectangular (marketing) vs Title Case rounded pills (search). Same action ("HOME WORTH?" vs "What's my home worth") styled two ways. | One Button component + one casing convention. | medium |
| CMP-2 | P1 | t·u | **Reused Old Mill hero photo across 7+ pages** — every blog post card, all three /about "Guides" cards, all three market-report cards, and the contact/reviews/valuation/FAQ/mortgage heroes render the same three-smokestack aerial. Cheapens the hand-crafted feel. | Distinct town/topic imagery per page (rotate the brand hero crops; assign per-post hero at authoring). | medium |
| CMP-3 | P1 | t | **`/team/matthew-ryan` track-record grid renders 3 of 9 tiles as empty flat-navy voids** (photoless sold listings fall back to a navy block). | Filter photoless tiles before the 3/6/9 row cap; or a branded "SOLD $X" stamp. | quick |
| CMP-4 | P1 | t | **`/cities/bend` "WATCH BEND" area-guide video is a raw HTML5 player** (default grey controls) floating in a tall empty navy band; mobile shows a blank navy box. | Wrap in branded chrome (poster `object-fit:cover` + design-system play overlay); fix the box sizing. | medium |
| CMP-5 | P3 | t | Currency format mixed — `$742,000` (home/market) vs `$742K` (cities tile) vs `$550K` (listing). | One headline-stat format (brand rule: full, rounded to thousands). | quick |
| CMP-6 | P2 | t | `/tools/mortgage-calculator` — the calculator is a plain shadcn card double-framed inside the KB card; inputs show raw unformatted numbers while the result is currency-formatted. | Single framed tool; format inputs consistently. | medium |

### 4 · Loading / empty / error / media states

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| STA-1 | P1 | u·t·c | **`/open-houses` with no open houses is a silent void** — the hero promises open houses, then jumps straight to "What's your home worth?" with zero "none scheduled" message; the hero sub-line is a broken fragment at count zero. | Render an explicit empty state ("No open houses scheduled right now" + "Get notified" / "Browse homes") and fix the zero-count copy. | medium |
| STA-2 | P1 | t·c | **`/resources` empty "Sponsored" AdSense card** — an unfilled ad slot leaves a ~250px blank "SPONSORED" box on a first-party conversion hub (and, when it fills, can point to a competitor). | Remove the ad unit from the conversion hub (or replace with a branded internal promo). | quick |
| STA-3 | P2 | u·t | **MLS tour videos render a solid black block while buffering** — the home Featured-homes lead card, the luxury Featured card, and the Tetherow featured media all paint black (or forever if autoplay is blocked). Recurs from the prior audit's theme 5. | Keep `photos[0]` visible until the video `canplay`; never show a bare black rectangle. | medium |
| STA-4 | P2 | u·t | **Invalid/sold listing URL renders a headerless, orphaned "Page not found"** (no logo/nav) — the listing route suppresses SiteHeader, then `notFound()` throws before its own header renders. Exactly the state a shared/stale `/listing/<key>` link produces. | Add `app/listing/[listingKey]/not-found.tsx` with chrome; treat missing as sold ("This home may no longer be on the market" + similar active homes). | medium |
| STA-5 | P2 | t | **Zero-inventory cards render as voids/dashes** — `/cities` featured cards show bare `—` for both stats; `/communities` degrades into a run of full-screen zero-inventory cards. | Suppress or collapse zero-inventory cards; show a real "coming soon / no active listings" state. | medium |
| STA-6 | P2 | t·r | Luxury-hero embed has **no `onError`/photo fallback** — a failed Vimeo embed surfaces the host's error page as the full-bleed hero (observed during capture on a filtered network; does not reproduce on an unfiltered network). | `onError → photos[0]` fallback (and/or server-side embed health check) in `ListingHero`'s VideoLayer. | medium |
| STA-✓ | — | — | **Zero-results empty search + 404 = strong (positive).** No action. | — | — |

### 5 · Trust signals

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| TRU-1 | P1 | t·u | **`/communities/tetherow` "Live · Tetherow · Latest market activity" shows non-Tetherow (Bend/Petrosa) listings.** The eyebrow promises community-specific activity; the query is city-wide (`getActivityFeedWithFallbackMulti({cities:[cityName]})`). Same class the prior audit fixed on `/cities/[slug]`, still open here. | Scope the feed to the community (subdivision/alias), or relabel the eyebrow to "Bend · Latest market activity." | medium |
| TRU-2 | P2 | t | `/city-bend` "Latest market activity" badges every item **NEW** but the dates are stale — the "live/new" claim reads as untrue. | Only badge genuinely-recent items; show real relative dates. | quick |
| TRU-3 | P2 | t | `/blog/…` article has **no author byline or bio** — zero attribution on an expertise piece; body measure runs ~100+ chars/line. | Add author byline + bio; cap body measure at ~70ch. | quick |
| TRU-4 | P2 | t | `/team` broker cards give nothing to choose between the three brokers; the "By the numbers" ledger shows undecoded license numbers with no "License" label. | Differentiate brokers (specialty/areas); label the license line. | quick |
| TRU-5 | P2 | t | `/communities` community photos misrepresent the place (a foreign alpine shot; wrong-location imagery). | Use verified local photography per community. | medium |
| TRU-6 | P2 | t | `/sell/valuation` — no human/social proof anywhere near the lead form; trust rests entirely on the marque. | Add a broker face + a one-line proof near the form. | quick |

### 6 · First impression & visual hierarchy

| # | Sev | hurts | Finding | Fix | Effort |
|---|:-:|---|---|---|:-:|
| FST-1 | P2→**fixed** | u·t | Hero eyebrow nearly invisible (`.hero-tag` was 70% cream, no shadow, over bright foliage). **✅ Fixed** to full cream + soft navy text-shadow; verified. | (done) | — |
| FST-2 | P3 | t | `/sell` opens on a muddy grainy pink/purple hero, noticeably softer/off-palette next to the crisp Old Mill hero — on the main seller entry. | Swap to a clean navy-toned / Old Mill hero. | quick |
| FST-3 | P2 | u | `/city-bend` mobile guide-card headline clips mid-line and overlaps the body paragraph; `/faq` giant right-aligned category headers overpower the questions. | Fix mobile heading line-height/clamp; rebalance FAQ header scale. | quick |
| FST-4 | P2 | c | `/luxury-homes-bend` hero ends on prose with **no CTA**; the flagship card reads incoherent ($11.9M for 3bd/3ba/2,268 sqft — a 118-acre land/estate play the card doesn't explain). | Add a hero CTA; show acreage/land context where it explains price. | medium |

---

## Per-page appendix (notable, beyond the themes above)

- **home** — flagship quality; nits: first-load modal (CNV-6), eyebrow (fixed), Featured card black-while-buffering (STA-3), map cluster markers collide with base-map labels.
- **search** — excellent; its real problems are the other-header (NAV-1) and no mobile map switcher (CNV-1); central-Bend pins overlap heavily.
- **listing-detail** — excellent rail; defects are the viewport broker mismatch (CNV-2), the $4M–$12M "featured" rail on a $550K home (CNV-7), and two "data on request" sections that promise but don't show.
- **listing-luxury** — great Vimeo hero (live); the Rental Analysis auto-fills a $2,336 HUD rent → "−$63,117/mo" on an $11.9M estate (gate the investor tool above a price threshold); Featured card black.
- **sell / valuation** — strong single-field conversion + phone fallback; hurt by double-hero/address re-ask (CNV-4), muddy hero (FST-2), fee message repeated ~6×, no proof near the form (TRU-6), bare address input (no autocomplete).
- **team / team-member** — track-record navy voids (CMP-3); brokers undifferentiated (TRU-4); "Text/Email Matt" fill blends into the cream section (P3 affordance nit — text is readable); SMS-consent checkbox sits below the submit.
- **about** — "Meet the team" shows no people (just a heading + button); three identical Old Mill blog cards.
- **cities / city-bend / communities / tetherow** — zero-inventory voids/dashes (STA-5); scope-mislabeled Live feeds (TRU-1, TRU-2); WATCH BEND raw player (CMP-4); misrepresentative community photos (TRU-5); mobile clipping (FST-3).
- **housing-market / market-report** — identical Old Mill photo on all cards; two back-to-back valuation closers.
- **reviews** — good; mobile list never caps (24 full-height cards ≈ 20 screens); reuses the home hero + generic CTAs.
- **blog / blog-post** — identical Old Mill photo across cards (CMP-2); no byline/bio, over-wide measure (TRU-3); bylines appear on some card types but not others.
- **buy / faq / resources / open-houses / tools / luxury** — off-intent/absent hero CTAs (CNV-5); empty ad box (STA-2); open-house void (STA-1); mortgage tool double-framed (CMP-6); luxury no-CTA + incoherent flagship card (FST-4).
- **login / signup** — Facebook sign-in label is muted gray while Google is full-strength (the two providers read as unequal).

---

## What was fixed on the spot

| Fix | File | Status |
|---|---|---|
| Hero eyebrow contrast (full cream + soft navy text-shadow; was 70% cream, no shadow) | `components/site/kb/kb.css` (`.kb-root .hero-tag`) | ✅ applied, browser-verified, **uncommitted** (awaiting sign-off) |

Before/after evidence: `assets/home-desktop-01.png` (before) vs `assets/fix-eyebrow-home-after-desktop.png` (after). No other code was changed; all larger items are recommendations. No payment/delete/publish surfaces were touched.

**Recommended next quick wins (safe, not yet applied — held for your call):** auth-label unification, currency-format alignment, LP orange→navy, filter photoless tiles from the broker track-record grid, remove the `/resources` empty ad slot.

---

## Screenshot index

Evidence in [`assets/`](assets/). Per page: `<page>-desktop-NN.png` / `<page>-mobile-NN.png` (top-to-bottom panels). States: `state-404-desktop.png`, `state-listing-notfound-desktop.png`, `state-search-empty-real-desktop.png` (+mobile), `state-nav-megamenu-desktop.png`, `state-nav-siteheader-desktop.png`, `state-nav-drawer-home-mobile.png`, `state-nav-drawer-site-mobile.png`. Fix proof: `fix-eyebrow-home-after-desktop.png`, `fix-eyebrow-sell-after-desktop.png`. Machine-readable: `_capture-manifest.json`, `_crosscutting-result.json`, `_perpage-result.json`. Prior passes: [README.2026-07-07.md](README.2026-07-07.md), [search-audit-2026-07-11.md](search-audit-2026-07-11.md).
