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

## Phase B — conversion opens — IN PROGRESS

## Phase C — market-stat pipeline unification — PENDING

## Phase D — seam continuity, curation, media states, signup, addresses — PENDING

## Phase E — P2/P3 register sweep — PENDING

## Phase F — final review pass — PENDING
