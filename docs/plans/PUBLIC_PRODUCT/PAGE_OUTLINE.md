# Page outline — purpose, data flex, itemized fields

Locked 2026-09-05. This is the granular layer under [`PAGE_INVENTORY.md`](PAGE_INVENTORY.md).

## Adversarial SEO lock (decided, not asked)

Google already ranks **Zillow / Realtor.com / Redfin** for `Bend homes for sale`. Claiming we will knock those off overnight is a lie. The architecture below is what actually wins: **one URL per query**, live figures, schema, city-cluster internal links, no cannibalizing blogs.

Winnable now: branded (`Ryan Realty`), address+MLS listings, `[place] homes for sale` / `[place] Bend real estate` where the official site has **no inventory** (Tetherow.com), methodology (`months of supply Central Oregon`), LLM citations from Dataset JSON-LD.

Not the primary target (do not write the H1 as if it were): generic `Bend homes for sale` vs Zillow. `/homes-for-sale/bend` still **must** use that H1 so we compete; `/cities/bend` must **not**.

### One winner per query

| Query | Winner URL | Do not also target |
|---|---|---|
| Ryan Realty · Ryan Realty Bend | `/` and `/about` (branded) | — |
| Central Oregon homes for sale | `/homes-for-sale` | `/` |
| **Bend homes for sale** | `/homes-for-sale/bend` | `/cities/bend`, luxury, compare |
| Bend real estate · Bend neighborhoods | `/cities/bend` | Search |
| 97703 homes for sale | `/zip/97703` | Search unless 301 |
| [City] homes for sale | `/homes-for-sale/[city]` | `/cities/[city]` |
| [City] housing market | `/housing-market/[city]` | City guide, blog “market report” |
| Central Oregon housing market | `/housing-market` | `/housing-market/central-oregon` (fold or differentiate: hub = live, CO leaf = report) |
| months of supply Bend / Central Oregon | `/months-of-supply` | Market hub (door only) |
| **Tetherow homes for sale** · Tetherow Bend real estate | `/communities/tetherow` | `tetherow.com` keeps “Tetherow”. **301** `/tetherow-resort-living-real-estate` and any leftover guide here (lifestyle-guide already 301s). **301** `/homes-for-sale/bend/tetherow` → community. |
| Northwest Crossing Bend · NWX homes | **one** URL: neighborhood **or** `/communities/northwest-crossing`, not both. Canonical = `/communities/northwest-crossing` (already the live land). `/cities/bend/northwest-crossing` 301s there. | Haley/Brooks/ARC sites. We win by houses+schools+plats+docs on that one URL. |
| [Plat] Bend homes | `/subdivisions/[slug]` | Parent community |
| [address] Bend [MLS] | listing URL | — |
| sell my house Bend · home value Bend | `/sell` | `/sell/valuation` is the CMA intake, not the SERP |
| Ryan Realty reviews | `/reviews` | `/testimonials` already 301s |
| Matt Ryan realtor Bend | `/team/matthew-ryan` (`/team/matt-ryan` already 301s) | fossil `/matt-ryan/` |
| Bend Oregon schools / parks | **not us** (district / BPRD). `/schools` `/parks` are directories. | Do not title them as the official Bend parks/schools query |

### Title / H1 rules (UX + SEO, one string)

- Title = `{Win query} | Ryan Realty` (city/place name first).
- H1 = the win query in human form. Never two pages with the same H1.
- City guide H1: `Bend, Oregon` or `Bend real estate` — **not** `Bend homes for sale`.
- Search H1: `Bend homes for sale`.
- Community H1: `Tetherow homes for sale` (inventory query). Caption carries belonging.
- Unique live count in the title or first caption (`33 homes`, sourced). Google uses it. §0: it must match the Field.
- Schema on every winner: `BreadcrumbList` + `Place` or `RealEstateListing` + `FAQPage` only for questions we actually answer + `Dataset` on market/MOS. Same numbers as the graphic.

### Cannibalization we already created (fix)

| Live | Action |
|---|---|
| `/tetherow-bend-lifestyle-guide` | already 301 → `/communities/tetherow`. Keep. |
| `/tetherow-resort-living-real-estate` → **blog** | **Wrong.** 301 to `/communities/tetherow`. |
| `/bend-oregon-market-report-*` | already 301 → `/housing-market/bend`. Keep. |
| `/homes-for-sale/bend/{area}` when area is a community/hood | 301 to the place URL. Place page **is** the Field. |
| `/cities/bend` leftover HUD “Bend homes for sale” | Change H1. Search owns that phrase. |
| `/housing-market/bend/tetherow` | Fold into `/communities/tetherow` sold line. |

### Footer-by-city (confirmed)

Internal links with **exact-match anchors** (`Homes for sale in Bend`, `Bend housing market`, `Tetherow`) are how PageRank reaches the winners. Five IA columns (Buy/Areas) do not. City clusters stay.

### Live titles that violate this lock (fix when we build)

From `out/audits/ui-ux-inconsistencies/2026-09-05/findings/seo-live-metadata.md`:

| Live | Must become |
|---|---|
| `/` title + H1 `Homes for Sale in Central Oregon` | Brand. Search owns that query. |
| `/cities/bend` title `Homes for Sale in Bend, Oregon` · H1 `{city} homes for sale` | `Bend real estate`. Search slug owns homes-for-sale. |
| `/homes-for-sale?view=list` self-canonical | Noindex `view` (already the rule on slug search; index route forgot). |
| Map/split search: **no H1** | H1 `{City} homes for sale`. |
| `/homes-for-sale/{city}/{tetherow}` | **301** to `/communities/tetherow`. Community keeps H1 `Tetherow homes for sale` (that query is the win). |
| Listing JSON-LD `@type: SingleFamilyResidence` | `RealEstateListing` (Google listing rich results). |
| `/housing-market/{city}` keywords include `{city} homes for sale` | Delete. Market does not bid on inventory. |
| `/housing-market` vs `/housing-market/central-oregon` | One regional hub. Fold or noindex the duplicate. |
| `/team/{slug}` title `Name · Ryan Realty \| Ryan Realty — Central Oregon` | `{Name}, Bend realtor` once. |
| Layout title template always appends `\| Ryan Realty — Central Oregon` | Keep brand once. `pageMetadata` already strips a second pipe; homepage and communities skip the helper and double up. |

**No structured prose on the site.** No origin essay. No “in plain words.” No “pinch to zoom.” No FAQ wall as a section. If a fact needs words, it is a label, a caption on a figure, or a disclosure the visitor opens. Display is Atlas, Field, Instrument, Ledger, Stage, Sheet, Quiet (one line), Proof — not paragraphs.

**Every page answers:** What is this for? What should the person do? Then it **flexes the data** with one graphic they can touch (Atlas, chart, encoded ledger). That graphic is how we are known.

**UX / DX / AX (do not break):**

| | Elevate | Do not break |
|---|---|---|
| UX | Interrogate the data. One job. 375 works. | §0 accuracy. Reduced-motion still complete. |
| DX | One chart/Atlas primitive with motion. `lib/charts/plot.ts` stays the geometry. | No second chart library, no `/lp` kit, no second house row. |
| AX | Firm proof, one payment, graphics a broker can point at on a call. | No fake personal volume. No second monthly number. |

**Data-flex motion (unlocked).** We are not banned from beautiful animated charts. We banned *decorative* motion (bounce, parallax, entrance on every section) and *animating live numbers while they load*. Hover, scrub, replay, draw-on of a series the visitor caused — that is the flex. `prefers-reduced-motion` = the same chart, already drawn. Do not install a third-party 60-type kit. Grow `V3Chart` + `V3Atlas`.

**Places differentiator:** [`DATA_GRAPHICS.md`](DATA_GRAPHICS.md). Translate sales jargon into one question → one drawing a regular person can read. MOS is “homes for sale vs a month of sales,” not a 3.9 tile. Typical price is a mark on real closes, not a hero numeral.

---

## Footer (every public page)

**Purpose.** Close the page. Get them to a city, a house, sell, or a broker. SEO: city-named links, not “Buy / Areas.”

**Data flex.** Navy-on-cream Bend cityscape (Old Mill, river, stacks) as the band. Wordmark over it. Not a second primary button.

**Contents (itemized, by city — SEO):**

- Band: cityscape + logo-blue wordmark + “Central Oregon”
- **Bend** — Homes for sale in Bend · Bend housing market · Bend neighborhoods · Tetherow · Broken Top · NorthWest Crossing · Awbrey Glen
- **Redmond** — Homes for sale in Redmond · Redmond housing market · Eagle Crest · Pronghorn
- **Sisters** — Homes for sale in Sisters · Sisters housing market · Black Butte Ranch
- **Sunriver** — Homes for sale in Sunriver · Sunriver housing market · Caldera Springs · Crosswater
- **La Pine · Terrebonne · Prineville · Madras** — Homes for sale in {city} · {city} housing market
- **Sell** — Value my home · Our listings
- **About** — Team · Reviews · Contact · Book
- Legal row: privacy, terms, cookies, fair housing, DMCA, accessibility, site-index
- ODS: source line + license + disclaimer (required)

Draft art: `design_system/ryan-realty/assets/footer/bend-cityscape-16x9-draft.jpg` and `…-21x9-draft.jpg`. Logo is the real wordmark overlay, not drawn in the PNG.

---

## `/` Home

**Win.** `Ryan Realty` · `Ryan Realty Bend` (disambiguates Florida/NY/MA shops of the same name).  
**Title / H1.** **Ryan Realty** or **Ryan Realty, Bend** — never “Homes for Sale in Central Oregon” (live H1; that query belongs to `/homes-for-sale`).  
**Purpose.** Door to the shop. Prove we exist in Bend.  
**Do.** Search, open a house, or tap Value my home.

**Data flex.** Atlas can stay as the *picture* of the inventory. It must not steal the regional search query: no competing H1, no “Homes for Sale in Central Oregon” title. Caption is brand or “Central Oregon,” not the search SERP heading.

**Outline**

1. Search  
   - Field: city / community / address  
   - Submit → `/homes-for-sale`
2. Atlas + houses  
   - Pins / density by type (House, Condo, Townhouse)  
   - Bound list: photo · $ · beds · baths · sqft · street  
   - Toggle type. Hover pin ↔ row.
3. Doors  
   - Places → `/cities`  
   - Value my home → `/sell`  
   - Invest → `/invest`
4. Place doors  
   - Each city: name, live for-sale count (once)  
   - Each featured resort: name, live for-sale count
5. Proof  
   - Google: count, average, date range, featured quote as written
6. Brokers  
   - Name · title · Call · Text · href `/team/[slug]`

---

## `/homes-for-sale` (+ city filter URLs)

**Win.** Regional: `Central Oregon homes for sale`. City: `{City} homes for sale` **only** on `/homes-for-sale/{city}`.  
**Title / H1.** Regional H1 **Central Oregon homes for sale** (live is geography-less “Homes for Sale”). City H1 `{City} homes for sale`. Count in caption. Canonical **without** `?bbox=` / `?view=` (crawl trap).  
**Purpose.** Show the houses that match.  
**Do.** Filter, open a house, save the search.  
**Beat.** Zillow/Realtor/Redfin (head term they own); Ladd Group and local IDX galleries (winnable with Atlas + unique facts).

**Data flex.** Map + list as one Field. Atlas language if we can keep tiles honest; no Google Draw/Roboto chrome.

**Outline**

1. Map + list (bound)  
   - Honest count of pins in view  
   - Row: photo · $ · beds · baths · sqft · street
2. Filters (one Sheet)  
   - Status, price, beds, baths, type, more
3. Alerts (Sheet under the list)  
   - Email  
   - Not covering cards. Not first viewport on 375.

Same Field, not a second app: city, ZIP, luxury, sold, compare-as-mode.

---

## `/open-houses` · `/price-drops` · `/our-homes`

**Purpose.** Same houses, one extra fact (open time / cut / listed by us).  
**Do.** Open the house.

**Data flex.** Photo Field, same row. Open-house: time on the still. Price-drop: prior $ and % on the still.

**Do not.** Email overlay. Filled Value my home as the primary.

---

## Listing (house URL)

**Purpose.** Decide on **this** house. Call or tour.  
**Do.** Tour / Call / Text.

**Data flex.**  
- Media with price on it.  
- One payment chart/breakdown (one formula).  
- Atlas of this lot + taxlot lines.  
- Similar encoded against this house.

**Outline**

1. Breadcrumb — city · neighborhood · community · plat · street  
2. Media — photos; 3D / floor plan / map tabs if assets exist; $ · beds · baths · sqft · street on the media  
3. Ask — Tour · Call · Text (44px; cookies cannot cover)  
4. Facts — type · lot · year · HOA $/mo · $/sqft  
5. Payment — one PITI; line items P&I · tax · HOA; same cents as any face label  
6. Map — this lot, climb, assessor lines, source  
7. Schools — name · grades · distance; “nearby” unless zone is known  
8. Parks / trails — name · type · map thumb (same as indexes)  
9. Tax history — year · tax · assessment · county link  
10. CC&Rs — published titles that bind this plat  
11. Similar — same house row, same parent  
12. Broker — face · Call · Text; firm proof if no personal record

---

## Place indexes `/cities` · `/neighborhoods` · `/communities` · `/subdivisions`

**Purpose.** Pick a place.  
**Do.** Open a city / neighborhood / resort / subdivision.

**Data flex.** Encoded directory (count on the row, not a KPI hero).

**Item per row:** name · live for-sale count · href. `/communities` = resorts only. Never the word “plat.”

---

## City `/cities/[slug]` · ZIP `/zip/[zip]`

**Win.** `{City} real estate` · `{City} neighborhoods`. ZIP: `{zip} homes for sale`.  
**Do not H1.** `{City} homes for sale` (search owns it).  
**Title / H1.** `Bend real estate` / `97703 homes for sale`.  
**Purpose.** The place: children, one market answer, then houses.  
**Do.** Open a neighborhood, a resort, or a house.

**Data flex.** Atlas of **this** boundary. One market chart (not five numbers on the photo). ZIP: skip still, houses first.

**Outline**

1. Identity — photo of this city · H1 **Bend real estate** · breadcrumb · verdict as **caption**  
2. Houses — Atlas + Field of this city  
3. Neighborhoods — name · what’s moving (encoded) · href  
4. Resorts in this city — name · for-sale count · href  
5. One market chart — subject series + hover (MOS or median, once)  
6. Schools — name · level · href  
7. Activity / open houses — same house row  
8. Parks / trails / guides — name · href  
9. Alerts — email for this city

---

## Neighborhood `/cities/[city]/[hood]`

**Win.** `{Neighborhood} Bend` · `{Neighborhood} homes for sale` **if** this is the canonical URL.  
**NWX:** canonical `/communities/northwest-crossing`. This path 301s there.  
**Purpose.** What’s selling here, and what daily life is.  
**Do.** Open a house or a subdivision.

**Data flex.** Atlas of this boundary. Plats encoded by what’s moving. Not a city clone.

**Outline**

1. Identity — photo of **this** hood · breadcrumb to city  
2. Houses here — Atlas + Field  
3. Subdivisions — name · sales/pace encoding · href  
4. Schools — name · level (High Lakes / Pacific Crest / Summit class)  
5. Parks / trails — name · thumb  
6. This week — event name · when · where (only real rows)  
7. CC&Rs if published  
8. One pace chart  
9. Guides — title · href  
10. Alerts

---

## Master-plan `/communities/[slug]`

**Win.** `{Name} homes for sale` · `{Name} Bend real estate`.  
**Lose.** Bare `{Name}` (tetherow.com / calderasprings.com).  
**Title / H1.** `Tetherow homes for sale` + live count caption.  
**301 here.** `/homes-for-sale/bend/tetherow`, leftover guides.  
**Purpose.** Beat listing SERPs (Redfin/Realtor/C21) with live Field **plus** belonging they omit.  
**Do.** Open a house or a village.

**Data flex.** Belonging still + Atlas of inventory they do not publish. Course map. Amenity grid as data, not an essay.

**Outline**

1. Identity — owned still · breadcrumb to city  
2. What it is (facts, not paragraphs) — acres · holes · hotel rooms · restaurants · pool/sport · membership types **with source**; no invented dues  
3. Amenity grid — dining · golf · fitness · trails · dog · pool (on/off, sourced)  
4. Houses here — Field  
5. Villages / plats — name · moving encoding · href  
6. Course map — if we have holes  
7. HOA / STR / published CC&Rs  
8. One sold/pace chart  
9. Edges — trail · Bachelor · Old Mill as doors; VR vs residential only if both exist  
10. Alerts

---

## Plat `/subdivisions/[slug]`

**Purpose.** The homes on this plat.  
**Do.** Open a house.

**Data flex.** List if short. Map if pins earn it. Lot lines. CC&Rs.

**Outline**

1. Name · breadcrumb (hood **or** resort → city)  
2. Homes — list or Atlas  
3. CC&Rs — published titles  
4. Peer plats — name · href  
5. Schools — doors  
6. One sold figure if it exists  
7. Alerts

---

## `/housing-market`

**Win.** `Central Oregon housing market`. City leaf: `{City} housing market`.  
**Do not.** Duplicate blog “Bend Oregon Market Report May 2026” (already 301s).  
**Title / H1.** `{Geo} housing market`.  
**Purpose.** Answer the market in one breath, then send them to a city.  
**Do.** Read the chart, open a city.

**Data flex.** One animated/interrogable chart (the flex). Cities as encoded doors, not a tile wall.

**Outline**

1. Verdict sentence (one) + chart (hover, scrub, replay)  
2. Cities — name · one figure · href  
3. Closed / history — door or slice  
4. Activity — encoded, not 24 hairlines  
5. Door → `/months-of-supply`  
6. Door → `/how-we-get-our-numbers`  
7. Reports that exist — title · date · href  
8. Blog — title · href

**`/housing-market/[city]`** — same grammar, that geo.  
**`/housing-market/[city]/[community]`** — not a third Tetherow; fold into the community page.

---

## `/months-of-supply`

**Purpose.** Define the number. Cite it.  
**Do.** Read formula + city rows.

**Data flex.** Formula as the chart (inventory / (sold÷6)). City rows encoded. Not 16 tiles.

**Items:** formula · current regional MOS · verdict band · per-city MOS · source.

---

## `/how-we-get-our-numbers`

**Purpose.** Methodology.  
**Do.** Open a term.

**Items (disclosures, not a wall):** Houses = SFR · Once = one home one place · Window = the time box. No live stats here.

---

## `/housing-market/reports` · `/blog` · `/faq`

**Purpose.** Words and dated reports that exist.  
**Do.** Open one.

Reports: title · period · href. Blog: title · date · href. FAQ: question as disclosure, answer when opened.

---

## `/sell`

**Win.** `sell my house Bend Oregon` · `home value Bend`.  
**Beat.** Opendoor (cash AVM), ByOwnerOregon (flat fee), cash buyers. Our unique: written six-comp CMA, 3% plan, address on the fold.  
**Title / H1.** `Sell your home in Central Oregon` (live — keep).  
**Purpose.** Get the address. Start the valuation.  
**Do.** Submit the address.

**Data flex.** Stage photo. Below: firm reviews + our listings as proof. Not a Bend KPI dump under the form.

**Outline**

1. Address · Value my home (one filled control)  
2. 3% plan — inclusions as a ledger, not an essay  
3. Firm reviews  
4. Our listings — same house row  
5. Questions — disclosures

**`/sell/valuation`** — same ask, more room. Chrome fill **xor** form.  
**`/sell/for-sale-by-owner` · `/sell/expired-listings`** — same spine.  
**`/sell/inherited-home`** — fold into `/sell`.

---

## `/about`

**Win.** `Ryan Realty Bend` (with `/`).  
**Title / H1.** About Ryan Realty · Bend. Not a market dashboard.  
**Purpose.** Hire this brokerage.  
**Do.** Call or text.

**Data flex.** Firm reviews (V3Proof). Firm closings (same house row). Atlas of where the firm works.

**Outline**

1. One line who we are · Call · Text  
2. Firm proof — 25 Google · 5.0 · date range · quotes as written  
3. Firm sales — recent Ryan Realty closings  
4. Brokers — name · title · Call · Text · href  
5. Atlas — service area (no how-to)  
6. How it started — **one short Quiet**, not the fold  
7. Licenses — firm # · PB # · source  
8. Questions — disclosures

---

## `/team`

**Purpose.** Pick a broker.  
**Do.** Open `/team/[slug]` or Call/Text.

**Items:** name · title · Call · Text · href. Same faces as About’s broker row. Not a second About.

---

## `/team/[slug]`

**Purpose.** Call **this** person, backed by the firm.  
**Do.** Call / Text / Email.

**Data flex.** Firm reviews + firm sales by default. Personal Atlas **only if** that broker has a real closing set.

**Outline**

1. Headshot (normal) · name · title · license · firm 25 / 5.0 door  
2. Call · Text · Email (**not** a CMA form)  
3. Firm proof — same reviews + firm closings, labeled Ryan Realty  
4. Personal record — omit if thin (Rebecca’s 4 does not print as a dashboard)  
5. Bio — facts only  
6. Doors — team · reviews · sell

---

## `/reviews`

**Purpose.** Read the Google record.  
**Do.** Call, or open a broker.

**Data flex.** The beeswarm / year chips (already the right object). Firm-level.

---

## `/contact` · `/book` · `/join` · `/refer-a-client`

**Contact purpose.** Reach a broker. **Do.** Call / text / write / book. Form below. Faces not gray squares.  
**Book purpose.** Pick a time.  
**Join / refer purpose.** Recruiting / inbound brokers. Same chrome. Not conversion pages Matt texts a client.

---

## `/invest`

**Purpose.** Honest income-property math.  
**Do.** Run the calculator.

**Data flex.** Cash-flow / cap chart from live assumptions. Not Value my home as the first filled button.

**Fold:** rental + appreciation tools onto this page. Mortgage tool onto listing payment.

---

## Lifestyle indexes

**Purpose.** The named thing (school, park, trail, event, golf).  
**Do.** Open the place or the listing nearby.

**Data flex.** Encoded list + map thumbs (fix black squares). Place pages show the nearby slice and door here.

**Row items:** name · type · city · thumb · href. Schools grouped by district once.

---

## Account · legal · out of area

**Account.** Saved homes / searches. Not a nav word.  
**Legal.** Privacy, terms, cookies, fair housing, DMCA, accessibility, data-deletion, site-index.  
**`/oregon/[city]`.** Not our market. Refer.  
**Newsletter.** Subscribe.  
**404.** Search + doors.

---

## What every page’s graphic is (the flex)

| Page | Graphic |
|---|---|
| Home, city, hood, resort, plat, about | Atlas |
| Listing | Media + lot Atlas + one payment breakdown |
| Search | Map+list Field |
| Market, MOS | One interrogable chart (draw-on / scrub / replay) |
| Reviews | Beeswarm |
| Sell | Stage; proof is reviews + our listings |
| Invest | Cash-flow chart |
| Indexes | Encoded directory |

If a page has no graphic in this table, it is not done.
