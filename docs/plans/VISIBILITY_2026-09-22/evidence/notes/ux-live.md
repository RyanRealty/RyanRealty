# ux-live — what a person sees on ryan-realty.com today (2026-09-22)

Reader: ux-live. Read-only. All captures from production `https://ryan-realty.com`, Chrome UA,
Playwright 1.58 driving `/opt/pw-browsers/chromium-1194` (the installed Playwright wants build
1208; I pointed `executablePath` at 1194 instead of running `playwright install`).
Scripts and raw data live beside this file:

- `audit.js` — 13 routes x {1440x900, 375x812}: fold + full-page PNG, perf, console, asks, link trees → `metrics.json`, `menus.json`, `linktrees.json`
- `scrolled.js` — desktop full-page AFTER scrolling (lazy images + in-view numbers settled) → `scrolled.json`
- `tracking-probe.js` → `tracking-probe.json`; `ads-probe.js` → `ads-probe.json`
- `competitors.js` / `competitors2.js` → `competitors*.json`
- `zeros.js` / `linktree.js` — static analysis of saved HTML (`home.html`, `bend.html`, `tetherow.html`)
- `route-status.txt` — status/canonical/robots for orphan and decision routes
- `shots/` — every PNG named `<route>--<viewport>--<fold|full|full-scrolled>.png`, `menu--*.png`, `competitor--*.png`, `ads-probe--*.png`

## Environment caveat (read first)

The sandbox egress proxy dropped ~40% of tunnels to ryan-realty.com during this session
(curl probe: 4/10 requests died at ~11s with `ws_closed_mid_exchange`; the other 6 answered
in 0.31–0.51s). Chromium saw that as `ERR_TOO_MANY_RETRIES`, 502 "upstream request failed"
pages, and CSS served as `text/plain`. NONE of those are production defects. I retried every
request up to 6x through `context.route` so screenshots are fully styled, and I measured TTFB
with curl on successful samples only. Playwright DCL/LCP numbers in `metrics.json` are inflated
by those retries and are NOT usable as production LCP; request counts, HTML bytes, and TTFB are.

## Verified facts (evidence in parentheses)

1. GTM never loads in a JS browser. `components/GTMHead.tsx` lines 78–79 ship
   `w[l].push({'gtm.start':}}` + a stray `// hydration-safe` comment inside the inline
   script; the whole block fails to parse (`pageerror: SyntaxError: Unexpected token '}'` on
   every route captured; `node -e "new Function(body)"` on the served inline script #1 of
   `home.html` throws the same). `git blame` → commit `f1e2a90f9` (Cursor Agent,
   2026-09-17 "fix: attribute crm email clicks to the sending broker in ga4"); no commit has
   touched the file since (`git log f1e2a90f9..HEAD -- components/GTMHead.tsx` is empty).
   Live probe (`tracking-probe.json`): `window.google_tag_manager` = false, zero requests to
   `googletagmanager.com` or `google-analytics.com` on `/` and `/cities/bend`.
   `components/GoogleAnalytics.tsx:69-73` deliberately skips `gtag('config', G-…)` when
   `GTM_ID` is set ("GTM already ships a GA4 Configuration tag"), so there is no fallback:
   no GA4 page_view has been collected from browsers since the 2026-09-17 deploy. Only the
   `<noscript>` GTM iframe remains (JS-off visitors). `scripts/check-tracking-policy.mjs`
   greps for the consent call but never parses the script.
2. AdSense Auto ads is live on the brokerage site: every route loads
   `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=pub-5928669094439003`,
   then `getconfig/abg_config?…ama_t=adsense` and `googleads.g.doubleclick.net/pagead/ads?…`
   ad auctions; an `ins.adsbygoogle` (data-ad-status="unfilled") + `aswift_0` iframe exist in
   the DOM of `/`, `/listing/220222277`, `/cities/bend` at 1440 and 375 (`ads-probe.json`).
   All four probes were unfilled (0x0), so no ad rendered in my captures. Source:
   `components/GoogleAnalytics.tsx:215`, `components/AdUnit.tsx`; the enterprise map marks
   INT-036 AdSense "KEEP · Monetization".
3. The served homepage HTML carries 54 zero-valued figures (`zeros.js home.html`):
   9 `tabular-nums`, 32 `home-featured-community__figure-value` ("$0 median list price",
   "0 homes sold, last 30 days", "0 new this week", "0 days to an offer" for Tetherow,
   Caldera Springs, Broken Top, …), 13 `home-browse-places__count` ("Bend · houses for sale ·
   0", La Pine 0, Redmond 0 …). Mechanism: `components/motion/number.tsx` renders `format(0)`
   on the server unless `settleOnMount` is passed (its own comment, lines 16–23, names
   CLAUDE.md §0 as the reason the opt-in exists). `app/_v3/HomeBrowsePlaces.tsx:109` and
   `app/_v3/HomeFeaturedCommunity.client.tsx:42,126` do not pass it. `bend.html` and
   `tetherow.html` carry 0 zero-figures (they use `V3Number settle`). After scrolling
   (`scrolled.json`), the town counts settle (Bend=581, La Pine=142, Redmond=196,
   Sunriver=47, Sisters=91, Terrebonne=42) but 36 zeros remain for a human (22 resort-card
   figures on off-screen carousel slides, 4 new-construction doors, 6 "· 0 homes for sale").
4. `/cities/bend` HTML is 3,773,850 bytes: 2,060,539 bytes are RSC flight data
   (`self.__next_f.push`, 105 chunks), 923,267 bytes are 41 inline `<svg>` (155 path `d`
   attributes, largest 22 KB), 787 `<img>`, 995 `<a>`. Playwright counted 321 requests at
   1440. `/cities/bend/awbrey-butte` 2,011,675 bytes / 247 requests / 162 img (60 no alt);
   `/cities/bend/types/single-family` 1,684,335 bytes; `/subdivisions/ridge-at-eagle-crest`
   1,068,288 bytes / 348 requests; `/communities/tetherow` 920,858 bytes / 220 requests;
   `/` 535,618 bytes / 233 requests; `/buy` 388,330 / 218; `/sell` 283,432 / 147.
5. TTFB is fine; payload is not. `ttfb.sh` (curl, Chrome UA, 3 samples each, `ttfb.txt`):
   median TTFB `/` 0.22s · `/buy` 0.24 · `/sell` 0.45 · `/cities/bend` 0.28 · awbrey 0.32 ·
   tetherow 0.22 · ridge 0.21 · single-family 0.33 · `/homes-for-sale/bend` 0.54 ·
   `/listing/220222277` 0.56 · `/housing-market/bend` 0.18 · `/about` 0.24 · `/contact` 0.24.
   Vercel edge cache is on (`cache-control: public, s-maxage=60|300, stale-while-revalidate`,
   `x-vercel-cache: STALE|HIT`). Wire bytes with brotli: `/` 57,560 · `/communities/tetherow`
   146,189 · `/cities/bend` 576,344 · `/about` 868,253 (decoded 535 KB / 921 KB / 3.77 MB /
   4.68 MB). Playwright DCL/LCP are proxy-inflated and not reported as production numbers.
6. Header primary link "Homes" → `/homes-for-sale?view=list` (also footer "Search homes");
   that URL serves `<meta name="robots" content="noindex, follow">` with canonical
   `/homes-for-sale`. The clean `/homes-for-sale` is `index, follow` but is linked from no
   header/footer control (`route-status.txt`, `linktree-home.json`).
7. Menu vs SITE_PAGES.md: "Luxury homes in Bend" in the Homes mega → `/luxury-homes-bend`
   → 308 to `/homes-for-sale/bend?minPrice=1500000` (a redirect in the sitewide header);
   "Months of supply" → `/months-of-supply` is a live indexed page (SITE_PAGES: "fold into
   the market page"); `/buy` (200, index, duplicates `/`), `/activity` (200, index),
   `/tools/appreciation` (200, index), `/invest` (footer only; SITE_PAGES puts it under Homes)
   are live pages absent from the header. All `/lp/*` 308 correctly; `/dev/*` 404 noindex.
8. The same figure differs by page on the same afternoon: "Bend 581" (menu, homepage town
   card, `geo_snapshot_mv.active_sfr_count`), "708 for sale" (`/cities/bend` legend),
   "757 homes" (`/cities/bend/types/single-family`, "every active single-family home with a
   Bend address"), "1,419 houses for sale right now" (`/buy`, Central Oregon), "3,237 listed"
   (`/` hero, Central Oregon). Two of those claim to be Bend single-family.
9. Console on every page: the GTM SyntaxError; `google.maps.places.Autocomplete` legacy
   deprecation warning (Sell + Home address fields); "AdSense head tag doesn't support
   data-nscript"; 16–17 "preloaded using link preload but not used" CSS chunks on `/` and
   `/cities/bend` (17 `<link rel=stylesheet>` + 32 `<link rel=preload>` in `home.html`);
   `/videos/hero-optimized.mp4` requested twice then aborted on `/`.
10. Every page has the phone as a tappable `tel:+15417033095` link in the header (top=10)
    at 1440; mobile check pending in `metrics.json`.

## Per-page critique — desktop 1440 (mobile appended below when captured)

(the voice is a demanding owner; "first thing I see" is the literal fold PNG)

### `/` — shots/home--desktop--fold.png, home--desktop--full.png, home--desktop--full-scrolled.png
First thing: the Old Mill drone photo, "3,237 LISTED / Homes for sale in Central Oregon",
Buy|Sell tabs, a 288-px search field whose placeholder is clipped ("Bend, Tetherow, or an
addres") with a `kbd` "F" badge (a keyboard-shortcut hint on a consumer search box). Below:
"Homes in Bend and nearby" rail with real cards (price, bd/ba/sqft/$sqft, address) — the
strongest thing on the site. Clear what the page is for: yes. Exposed: prices yes, inventory
yes (3,237), map only as a dot-cloud further down. Boutique or template: the hero + Amboqia
H1 is boutique; the rest is the stacked-rail template TASTE.md itself names (three rails,
then Guides, then a stat block, then resort cards, then doors, then brokers, then places,
then reviews — 14 sections, 9,318 px tall, 71 `$` figures). Bugs: the 54 zero figures in
the HTML (fact 3); "Homes in Bend and nearby" shows Sisters and Redmond houses; the hero
video is fetched and aborted twice; cookie button overlaps the rail's last card at 1440.
Change first: ship true numbers in the HTML (`settleOnMount`) and cut the page to hero,
one rail, places, brokers, proof.

### `/buy` — shots/buy--desktop--fold.png
First thing: a second homepage. Same shape (photo hero "Buy a home in Central Oregon",
outlined "Search homes"), a navy stat strip (1,419 houses · $749,900 median ask · 31 days to
an offer, sourced "Live MLS · Oregon Data Share · as of Sep 22, 2026" — good), then the
same "Homes in Bend and nearby" rail whose first two cards are La Pine (30 miles away)
with a price-band tab row and an unlabeled tick ruler "$306,900 ‖ | | … $2,995,000". Not in
any menu (orphan) yet indexed with its own canonical; it competes with `/` and
`/homes-for-sale` for the same query. Change first: 301 to `/homes-for-sale` or make it the
search page.

### `/sell` — shots/sell--desktop--fold.png
Best fold on the site: "3% LISTING PLAN / Sell your home in Central Oregon", a cream card
with a sourced fact (2,050 Bend closings, $760,000 median, Oregon Data Share), "FREE. NO
LISTING AGREEMENT.", the address field and a large "Value my home" button. Ask visible,
correct for intent, phone in header. Bugs: the navy "Sell" breadcrumb band stops at
x≈1295 while the hero is full-bleed (on `/buy` the same band is full width); the button's
icon tile is three dots on an arc that reads as a spinner; Sisters aerial under a Bend
statistic. 8,326 px tall for a page whose ask is answered at 620 px.

### `/cities/bend` — shots/cities_bend--desktop--fold.png
First thing: a 140-px dim photo band with the H1, then an EMPTY top-left quadrant
(20→400 px x, 200→480 px y), a legend "708 for sale · 328 pending · 10 parks · 12 trails",
a "FEWER SALES ▭▭▭▭ MORE SALES" swatch, Parks/Trails checkboxes, seven property-type
checkboxes, and a grey heat-cell map with pills like "$50k+", "$74k+", "$99k+" over a city
whose median is ~$750K (cell-minimum prices read as Bend prices). Left column: neighborhood
list with 60-px thumbnails and "55 single-family · 1 townhome or condo · 14 land". Is it
clear what the page is for: it reads as a GIS panel, not "the Bend page". Exposed: yes,
deeply (18 sections, 51,085 chars of text, 812 `$` figures) — but nothing in the first
viewport says why Bend, shows a Bend photograph at display scale, or shows a house. Weight:
3.77 MB HTML, 786 images, 321 requests (fact 4). Change first: open on a photograph and
three sentences a person would say about Bend, put the map second, ship the plat/neighborhood
list as links not 786 thumbnails, and stop serializing 2 MB of props.

### `/cities/bend/awbrey-butte` — shots/cities_bend_awbrey-butte--desktop--fold.png
Same template as the city page: dim band, empty quadrant, "69 for sale · 28 pending · 1 park ·
2 trails", checkboxes, a map with 30 price pills. The left list is "Awbrey Butte Homesites
Phase Eighteen · 1 single-family / Phase Eleven · 1 lot / Phase Fifteen …" — plat phases as
the browse unit, in the first viewport, for a neighborhood a buyer knows by its views and
its streets. 2.0 MB HTML, 162 images, 60 without alt.

### `/communities/tetherow` — shots/communities_tetherow--desktop--fold.png
Band carries the best facts on the site ("$2,052 HOA a year from homes here. 3 membership
tiers. 700 acres", "24 for sale · 4 pending"), then the same empty quadrant, plat list
("Highlands Ridge Phase 3 & 4 · 2 townhomes and condos", "Outrider Overlook Phase 2 · 1
lot") and a near-blank grey plat map with four pills. Versus tetherow.com (competitor shot):
they open on a golden-hour fairway photograph, a Condé Nast badge and one ask; we open on a
GIS legend. We win on inventory (24 real listings, HOA, tiers, acreage); we lose on the
first three seconds. 15 uses of "Phase" in the visible text.

### `/subdivisions/ridge-at-eagle-crest` — shots/subdivisions_ridge-at-eagle-crest--desktop--fold.png
Band + one sourced sentence ("88 homes for sale in Ridge at Eagle Crest. Toggle house, land,
or other types on the map." — the second sentence is UI instruction, not a sentence a
person says), then the map IS the fold: two disjoint boundary polygons and ~30 price pills.
1.07 MB HTML, 348 requests (highest request count of the set).

### `/cities/bend/types/single-family` — shots/cities_bend_types_single-family--desktop--fold.png
Cleanest place fold: "Single-family in Bend / 757 homes ask $379,500 to $2,125,000 for nine
in ten." with a source line and a read timestamp, a price slider, the heat map, then "ON THE
MARKET" photo cards. Two defects: the count contradicts the menu's "Bend 581" (fact 8), and
the map cells again print "$90k+", "$185k+" pills for a single-family page whose floor is
$379,500.

### `/homes-for-sale/bend` — shots/homes-for-sale_bend--desktop--fold.png, crop--hfs-bend-row.png
The flagship search. First thing: a filter bar (search field with the `F` badge, PLACES: BEND,
BEDS, ALL FILTERS, SAVE THIS SEARCH), then a FULL-WIDTH NAVY SLAB ~40 px tall that is the
price slider at "Any price" (it reads as a loading bar), then "495 homes on this map,
$57K–$5.3M · Bend · nearest matches · SOURCE Oregon Data Share" and rows: 160-px photo,
price, bd/ba/sqft/$sqft, a caption "$608/SQFT · ABOVE MIDDLE HALF OF 478 ON THIS MAP" with a
hairline drawn THROUGH the first line (crop confirms — reads as strikethrough), address,
"Discovery West Phase 5". Map: a grey Bend outline on a blank white canvas with five cluster
bubbles (10 · 112 · 144 · 86 · 143) — no basemap, no roads, no labels. 495 (header) vs 478
(row caption) in one viewport. JSON-LD on this page is only RealEstateAgent + WebSite (no
ItemList/BreadcrumbList). Versus Redfin Bend (competitor--redfin-bend--fold.png: "1,499
homes", two large photo cards with price/facts, a Google basemap with price pins, filters,
Save search): we lose on the map, on photo size, and on the first read; we win on the
source line and the $/sqft context — if the caption rendered cleanly. Ask: "Get alerts"
form exists (top=0, hidden Sheet). Change first: a basemap under the clusters, a real
slider, kill the strikethrough, one count.

### `/listing/220222277` — shots/listing_220222277--desktop--fold.png, --full-scrolled.png, crop--listing-cookies.png
First thing: a full-bleed photograph of 1671 NW Saginaw Avenue with breadcrumb, "35 photos
| 3D | Floor | Map" tabs, a filmstrip, and at bottom-right "Open · Street view" with the
Cookies pill sitting on top of "Street view" (crop confirms). NO price, NO H1, NO beds/baths
in the first 900 px — the ask (Tour / Save / "Questions about this home? Matt Ryan · call ·
text") starts at ~1,000 px. That is Matt's 2026-09-10 layout lock (full-bleed hero above the
grid), so I flag it as a trade-off, not a defect: Redfin/Zillow put price + facts beside
the photo. The DOM stacks 35 "View photo N of 35" buttons (each 1440x792) before the price
— 35 focus stops for a keyboard user. Below the fold the page is the most complete on the
site: address H1, price, facts table (overview/interior/exterior/systems/financial/listing),
remarks, payment calculator, "what else is selling in River West" map, schools, parks,
trails, "price sits 42.8% over the Bend median list" row, sale/tax history, CC&Rs, a "46% of
Bend homes that sold in the last 12 months had dropped their price" block, and a
"Watch this price" form (top=8,592). 10,342 px, 948 KB HTML, 278 requests. Console: the
hero video is a `drive.google.com/file/d/…/preview` embed (Drive's internal sharing frame is
refused by X-Frame-Options; the preview itself is UNVERIFIED as broken). JSON-LD:
BreadcrumbList + RealEstateListing.

### `/housing-market/bend` — shots/housing-market_bend--desktop--fold.png
Clean and honest: "Bend housing market: a seller's market", a sentence with the figure
("In August 2026 the middle house in Bend sold for $750K … $795K, −5.7%"), split-flap
$750K / $795K, a two-year median line, and "About 3.3 months of homes on the market · Homes
for sale 581 · A month of sales 175 · SOURCE Oregon Data Share MLS · as of Sep 21, 2026".
581/175 = 3.32 → seller's, consistent with the §0 thresholds and with the menu's "Bend 581".
Copy tell: "Drag across the lines to read any other month" is a UI instruction inside the
market sentence; "−5.7%, less than the same month last year" is not how a person says it.
330 KB HTML, 133 requests — the lightest place-class page. Ask: "See Bend homes for sale"
button at 870 px; no valuation ask on a page whose H1 says seller's market.

## Competitor comparison (first viewport, 1440)

- `/cities/bend` vs Redfin Bend (`competitor--redfin-bend--fold.png`): Redfin = "1,499
  homes", two large photo cards with price/beds/baths/sqft/address, a basemap with pins,
  filter row. Ours = legend, seven checkboxes, empty quadrant, grey heat cells with
  "$50k+" pills, 60-px thumbnails. We win: neighborhood counts by type, parks/trails,
  sold-heat, and 21,000 px of Bend content below. We lose: no house in the fold, no
  basemap, no photograph of Bend at display scale, 3.77 MB vs a page that streams.
- `/communities/tetherow` vs tetherow.com (`competitor--tetherow-resort--fold.png`) and
  enjoybendlife.com/bend/tetherow (`competitor--enjoybendlife-tetherow--fold.png`): the
  resort opens on a golden-hour fairway, a Condé Nast badge, one ask; the brokerage opens
  on a course photo with a search form. Ours opens on a GIS legend and a plat list. We win:
  "24 for sale · 4 pending", HOA $2,052, 3 tiers, 700 acres, a hole-by-hole course map
  (at ~9,000 px), amenities, build years. We lose: the first three seconds, and the plat
  vocabulary ("Highlands Ridge Phase 3 & 4", 15 "Phase" in visible text).
- bendrealestate.com, cascadehasson.com, bendpremierrealestate.com, homes.com, zillow.com
  all served Cloudflare/PerimeterX blocks to headless Chromium — recorded, not compared.

## The catalog method — three landed demoMatch:true nodes, judged on the live control

TASTE.md rule (lines 321–351): score must rise ≥3 AND `demoMatch: true`. Parity records:
- `sell` (score 73, "rose", beUI layout-size expand on Value my home): live at 1440 the
  expanding control is a 64-px navy button with a three-dot tile that reads as a spinner.
  The ask itself (address → value) is right for the page; the demo adds nothing a seller
  needs and one thing that confuses ("is it loading?"). Decoration.
- `place-type` (score 57, "rebaselined", shadcn carousel on `/cities/bend/types/single-family`):
  live fold is H1 + sourced sentence + slider + heat map; the carousel ("ON THE MARKET")
  starts at ~860 px. The carousel is the one control that shows a house; it should be the
  fold. Useful, mis-placed.
- `community` (score 64, "rebaselined", beui-number on `/communities/tetherow`): the
  AnimatedNumber is the "24 for sale" figure — a count-up on a number the visitor needs to
  trust. TASTE.md itself bans numbers counting up. On the homepage the same primitive is
  what ships 54 zeros to crawlers (fact 3). Harmful where it is, and the instrument
  rewarded it.
Pattern across the three: the evaluator scores whether the catalog object is visible in an
"open-state" screenshot, so builders bolt a catalog object onto a page whose fold is still
a legend and a map. None of the three verdicts mentions a buyer task completed faster.
`cities` (demoMatch false, score 54) is the honest record: "combobox open is still a cream
popover, masonry is a clipped strip".

## Per-page critique — mobile 375x812 (shots/<route>--mobile--fold.png)

Two things repeat on every mobile fold and go in the findings: (a) the Jax floater
(`V3DogFloater`, `position: fixed; top: 50%; right: 16px; 68x68; z-index 95`, a second
"Open Ryan Realty menu" button) sits over content mid-screen on every page — over the second
card's "OPEN SAT" badge on `/`, over the SOURCE line and third stat on `/buy`, over the
"how we calculate this" link on `/sell` (that link is not tappable there); (b) the header at
375 shows wordmark · (search icon) · Sign in · ☰ and NO phone — the two `tel:` links the DOM
reports at top=0 are inside the hidden menu dialog. First tappable phone: `/` y=5,135,
`/buy` y=8,576, `/sell` y=1,479 ("Call Matt Ryan"). The Cookies pill covers "See price cuts"
on `/` and "Value my home"'s row on `/buy`.

### `/` mobile
Strong: hero photo, "3,236 LISTED" (desktop said 3,237 twenty minutes earlier — normal
drift), H1, Buy/Sell, a full-width search field with no kbd badge, then large photo cards
with price/facts. 11,552 px tall. Ask in the first viewport: search (yes), phone (no).

### `/buy` mobile
Navy "Buy" band, hero with "Search homes", the stat strip stacks well (1,419 · $749,900 ·
31 days, sourced), but the price-band tab row clips ("$1.5M AND UP" cut) and the tick ruler
"$549,000 |‖ | | | … $2,995,000" is unreadable at this width. 9,401 px. Phone: no.

### `/sell` mobile
The best mobile fold: eyebrow "3% LISTING PLAN", H1, the cream card with the sourced Bend
figure, "FREE. NO LISTING AGREEMENT.", address field (y≈497) and "Value my home" (y≈578)
inside the first 812 px. The three-dot tile on the button is 100 px wide here and reads
even more like a spinner. "how we calculate this" is under the dog. Phone: "Call Matt Ryan"
at 1,479 (second screen).

### Remaining mobile pages (from metrics-mobile.json + fold PNGs; the mobile run reached 9 routes)
- `/cities/bend` mobile (cities_bend--mobile--fold.png): photo band shrinks to ~125 px with the H1 and
  three underlined links, then legend "708 for sale · 328 pending · 10 parks · 12 trails", then the heat
  map fills the rest of the 812 px with "$50k+", "$74k+", "$99k+", "$100k+" … pills. Jax covers the NE
  corner of the map; Cookies pill covers the zoom control. First tappable phone y=25,470.
- `/cities/bend/awbrey-butte`, `/communities/tetherow`, `/subdivisions/ridge-at-eagle-crest`,
  `/cities/bend/types/single-family` mobile: same class shape as desktop (band → legend → map);
  first tappable phone at 21,104 / 15,653 / 24,032 / 17,518.
- `/homes-for-sale/bend` mobile (homes-for-sale_bend--mobile--fold.png): "Bend homes for sale", search
  field, PLACES: BEND / FILTERS / SAVE SEARCH, the "Any price" slider as a full-width navy slab, a map
  with NO basemap (grey Bend outline, clusters 382/16/15/12/11/9, two price pins), Map/List/SORT, and a
  bottom sheet "1,181+ homes for sale · 490 on this map · $45K–$4.0M" whose tail is under the Cookies pill.
  No tel: link on the page outside the hamburger dialog.
- Not captured at 375: `/listing/220222277`, `/housing-market/bend`, `/about`, `/contact` (run ended).
  No mobile claims are made for those four.
- Header menus: no `menu--*.png` was captured. The link tree comes from served HTML
  (`linktree-home.json`: desktop mega 5 groups; mobile dialog 57 links incl. Video tours, Golf, Parks,
  Monthly briefing not in the desktop mega). Nav source is `lib/site-nav.ts` (grouped by
  `lib/site/chrome-mega.ts`); `/homes-for-sale` is rewritten to `app/search/*` (next.config.ts:468-469).

### Conversion asks table (first viewport)
| Route | 1440 ask in fold | 375 ask in fold | first tappable phone @375 |
|---|---|---|---|
| `/` | search (y 381), header phone | search (y 287) | 5,135 |
| `/buy` | "Search homes"; alerts form at 6,876 | "Search homes"; alerts at 7,651 | 8,576 |
| `/sell` | address + Value my home (513) | address + Value my home (470) | 1,479 |
| `/cities/bend` | none (legend/map); listings form 3,235 | none; form 4,121 | 25,470 |
| awbrey-butte | none; form 2,339 | none; form 3,123 | 21,104 |
| tetherow | none; form 4,185 | none; form 4,963 | 15,653 |
| ridge-at-eagle-crest | none; form 1,454 | "Send me new listings" 737 | 24,032 |
| single-family | price slider only | price slider only | 17,518 |
| `/homes-for-sale/bend` | filters + Save search; alerts Sheet | same | none |
| `/listing/220222277` | none in 900 px; Tour/Save/Questions ~1,000; price-watch 8,592 | not captured | — |
| `/housing-market/bend` | "See Bend homes for sale" 870 | not captured | — |
| `/contact` | form + big phone in fold | not captured | — |
At 1440 the header phone (tel:+15417033095, top 10) is on every route.

## Completion pass — 2026-09-23 (after rate-limit interruption)

Re-probes (cheap, one each):
- `curl -A <Chrome 140> https://ryan-realty.com/` → 200, saved `home-recheck.html`. It still contains
  `gtm.start':}}`, and `node zeros.js home-recheck.html` still gives 54 zero figures (9 / 32 / 13).
  Both p0s are live today.
- `curl /site-index` → 0 links to /buy, /activity, /tools/appreciation (1 each to /videos and
  /central-oregon/golf). Saved as `site-index.html`.
- site_signal GA4 (`ga4-days2.mjs`, `ga4-src.mjs`, through scratch lib/sb.mjs; site_signal aggregates
  are allowed). Account sessions 09-14..21: 994, 1452, 1103, 644, 685, 699, 434, 205. Per-source rows:
  up to 09-17 there are 6-8 sources a day ((not set), (direct), crm/doc, email-click, chatgpt, gbp,
  google/organic); from 09-19 exactly one, "(not set)". So GA4 still gets server-side MP page_views
  (app/api/visitors/track/route.ts:493-508), but browser-attributed sessions ended with the 09-17 deploy.
  Before the break "(not set)" was already 85-97% of sessions (09-12: 361/423; 09-15: 1444/1490).
- Repo at HEAD b30f361b8. The GTM bug is in HEAD. Another session has a fix in the shared working tree
  (`lib/analytics/gtm-bootstrap.ts` + test, `components/GTMHead.tsx`, `scripts/check-tracking-policy.mjs`,
  and `components/motion/number.tsx` modified). During this pass it went from unstaged to staged
  (`A  lib/analytics/gtm-bootstrap.ts`). It is not committed. I touched none of it.

Corrections to the 09-22 draft:
- UXLIVE-1: consent-default and gtag DO exist (tracking-probe: gtagType function, dataLayer 12 entries
  incl. consent default), pushed by another script. What is dead is the GTM loader, so
  window.google_tag_manager is absent. "No GA4 page_view collected" was wrong: MP still fills
  page_views, but with no source. Added the site_signal evidence.
- UXLIVE-3: downgraded p0 → major. Googlebot's HTML fetch cap is 15 MB, so these pages are not
  truncated for Google. The cost is phone download, parse and hydrate time (LCP/INP) plus crawl time.
  AI-crawler truncation is UNVERIFIED.
- UXLIVE-4/7/8/9: file paths fixed. The nav lives in `lib/site-nav.ts` (not only chrome-mega), and the
  search route is `app/search/*` (rewritten from /homes-for-sale); `app/homes-for-sale/*` does not exist.
- UXLIVE-6: the "$50k+" pill mechanism is confirmed in `lib/atlas/pin-price.ts:41-51` (the cluster's
  lowest ask + "+").
- UXLIVE-7: added the mobile search header "1,181+ homes for sale · 490 on this map". I did not verify
  which definition each count uses against the DB (no listings aggregate was run).
- UXLIVE-8: SITE_PAGES.md contradicts itself on /months-of-supply (:48 "fold into" vs :91 "Keep as
  the definition URL"), so that item is no longer a violation, just a plan conflict. /buy, /activity
  and /tools/appreciation orphan status is confirmed across header, footer, dialog, 5 bodies and
  /site-index.
- UXLIVE-11: the community beui-number animates "the 30-day count" (per parity verdict), not
  "24 for sale". The Tetherow HTML has 0 zero figures because V3Number settles. The harm there is
  the banned count-up (TASTE.md:540-541, confirmed by grep), not a served zero.
- UXLIVE-12: dropped the CSS "preloaded but not used" warnings and the hero-video double fetch.
  Both are ambiguous under the proxy confounder (CSS served text/plain, aborted tunnels). Added the
  /contact stray "for a text back" label (contact--desktop--fold.png) and the shortcut source
  `components/site/v3/V3MorphSearch.tsx:73`.
- New UXLIVE-13 (mobile: no phone in the first viewport; header gives the slot to Sign in) and UXLIVE-14
  (Jax floater + Cookies pill overlays), both from metrics-mobile.json + fold PNGs.

Final output: `findings.json` (14 findings, 22 facts, 8 questions).

## Screenshot index (shots/)
- Desktop 1440 fold/full: home, buy, sell, cities_bend, cities_bend_awbrey-butte, communities_tetherow,
  subdivisions_ridge-at-eagle-crest, cities_bend_types_single-family, homes-for-sale_bend,
  listing_220222277, housing-market_bend, about, contact (+ `--full-scrolled` for home, cities_bend,
  communities_tetherow, subdivisions_ridge-at-eagle-crest, homes-for-sale_bend, listing_220222277, about).
- Mobile 375 fold/full: home, buy, sell, cities_bend, cities_bend_awbrey-butte, communities_tetherow,
  subdivisions_ridge-at-eagle-crest, cities_bend_types_single-family, homes-for-sale_bend.
- Crops: crop--hfs-bend-row.png, crop--listing-cookies.png, crop--home-brokers.png,
  crop--home-places.png, crop--home-resorts.png.
- Competitors: competitor--redfin-bend, --tetherow-resort(-home), --enjoybendlife-tetherow,
  --bendpremier-tetherow, --redfin-awbrey-butte, and the block pages (zillow-bend, homes-com-tetherow,
  bendrealestate, cascadehasson, cascadesir, dukewarner).
- Ads probe: ads-probe--home--desktop/mobile, --listing_220222277--mobile, --cities_bend--mobile.
