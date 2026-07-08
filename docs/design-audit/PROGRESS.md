# Design-audit remediation — progress log

Mission: complete every item in [README.md](README.md) (the 2026-07-07 full-site audit) to production grade. Each phase is browser-verified end-to-end before its commit. Statuses here are the source of truth for what has shipped since the audit.

## Phase A — top-10 quick wins (2026-07-08) ✅

| # | Item | Fix | Verified |
|---|---|---|---|
| 1 | Homepage hero says who we are | Lead now "across Central Oregon, from the Deschutes to Smith Rock. Real numbers, direct from the brokers who close deals here." — also fixes the "six cities" scope mismatch ([app/page.tsx](../../app/page.tsx)) | curl: composed sentence renders with live count |
| 2 | Zillow 3D tours framed a competitor logo + CAPTCHA | zillow.com iframe tours demoted to the branded "Open the virtual tour" new-tab card ([ListingVideoEmbed.tsx](../../components/site/listing-detail/ListingVideoEmbed.tsx)) | 63177 Iner: 0 zillow iframes, link card target=_blank |
| 3 | Search → listing dead-click | Listing-shaped `loading.tsx` skeletons for `/listing/by-address/[...slug]` + `/listing/by-key/[listingKey]` | route 200s; skeleton file per Next convention |
| 4 | $1,000 "home" led price-drops | `listPrice >= $50K` floor in getPriceDrops (grid + analytics) and getPriceDropTiles (homepage picker) | /price-drops: lowest card now $1,049,000 |
| 5 | Homepage map framed the Willamette Valley | `fitToFeatures` + 5th–95th-percentile core framing at region scale + SuperCluster radius 80 ([KbListingMapImpl.tsx](../../components/site/kb/KbListingMapImpl.tsx)) | screenshot: Sisters→Prineville, Madras→La Pine, clusters separated |
| 6 | "caldera springs 0 ACTIVE" marquee card | Title-cased card names; 0-inventory featured cards sell the guide ("Community guide · Sunriver") ([KbCommunities.client.tsx](../../components/site/kb/KbCommunities.client.tsx)) | curl: "Caldera Springs" + "Community guide ·", zero "0 active" |
| 7 | /team promised numbers the cards didn't show | Each card renders the broker's public Twilio line from the canonical registry; "Talk to a broker" now routes to /contact (was /sell) ([KbTeam.client.tsx](../../components/site/kb/KbTeam.client.tsx)) | DOM: 541.703.3095 / 541.502.3436 / 541.250.3380 on cards |
| 8 | Valuation form never said what happens next | "A broker emails your written valuation within 24 hours, with the comps behind the number. No obligation." under the submit | rendered on /sell/valuation |
| 9 | Signup collected credentials with no terms | Consent line linking /terms + /privacy under Create account ([SignupForm.tsx](../../components/auth/SignupForm.tsx)) | rendered with both links |
| 10 | Mobile search input crushed to ~60px ("Ben") | Location input gets its own row on phones (`basis-full sm:basis-auto`) ([SearchFilters.tsx](../../components/search/SearchFilters.tsx)) | 390px viewport: input 366px wide |

Ratchet cleanups the gate required in touched files: `no-scrollbar` utility on the chip track, ladder-compliant widths (`w-screen max-w-sm`, `w-44`, `max-w-sm`), play-overlay `<button>` → design-system `<Button>`.

## Phase B — conversion opens (2026-07-08) ✅

| Item | Fix | Verified |
|---|---|---|
| Listing sidebar never stuck | `.kb-root` `overflow-x: hidden` → `clip` (hidden made kb-root the sticky containing block) | sidebar pinned at 96px at 50% scroll; 0px horizontal overflow on 6 kb pages at 390px |
| One CTA row for every intent | KbHero gains `cta`/`ctaSecondary` props (default unchanged). /sell: "What's my home worth" filled + Browse ghost, search bar off; /sell/valuation: "Get my home value" → form anchor; /contact: "Send a message" → form anchor | DOM: all three heroes render intent CTAs, zero buyer search bars |
| /sell ask buried ~11 screens | Early CTA section after SellValueProps (y≈1777 on mobile) + LP-style sticky mobile bottom bar (valuation + call) | both render; sticky bar pinned to viewport bottom |
| Tour CTA dumped buyers on a blank form | intent=tour on all three listing CTAs; /contact renders the property card (photo, address, price, beds/baths, link back); tour-time select; "Request a tour" submit; intent-aware success copy | E2E: listing → Schedule a tour → card "63177 Iner, Bend $742,000 · 3 bd · 2 ba" + tour field + tour submit |
| Sign-in modal fired over the tour form | /contact + /sell/valuation added to SignInPrompt suppression (lead forms are never interrupted) | E2E re-run: no modal on the tour form |
| Tumalo tile rendered a bare name | KbExploreTowns renders "0 Active" instead of hiding the ledger | /housing-market: "Tumalo 0 Active" |

Ratchet cleanups: ContactForm labels → `text-primary`; sell sticky bar `tracking-widest`; PriceCtaStrip/TextMattCTA arbitrary text sizes → ladder (`text-4xl/lg/sm/xs`, `leading-relaxed/normal`); PriceCtaStrip registered in `.design-token-lint-ignore` for its two KB `.btn` controls (same exception class as components/site/kb/).

## Phase C — market-stat pipeline unification — PENDING

## Phase D — seam continuity, curation, media states, signup, addresses — PENDING

## Phase E — P2/P3 register sweep — PENDING

## Phase F — final review pass — PENDING
