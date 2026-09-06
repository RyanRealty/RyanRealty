# Site pages — one inventory

Locked from Matt 2026-09-05.

This file is the page list and the section list. **It overrides** any older page contract, leftover-HUD test, LP kit, “class opener” memo, or UI-kit parity note that would keep us cloning Bend onto Tetherow, keeping `/lp/*`, or dumping percent tiles.

**Locked section list (every page, in order):** [`PAGE_INVENTORY.md`](PAGE_INVENTORY.md). Agree that file before we build.

Places hierarchy: [`PLACE_PAGES.md`](PLACE_PAGES.md).

Look: one chrome, one button, one house row, navy/cream, Amboqia + Geist. Tokens stay `components/site/v3/tokens.css`. A button that looks different on search vs a listing is a defect. A second style guide is a defect.

**Looking is the job.** Reading the JSX and a green test is not looking. Matt’s complaint is that we ship, then a person opens the URL and it is gross. Before any public change is done: open the page at 1440 and 375, screenshot the first viewport and the full page, and look. `TASTE.md` ritual, then a second agent on those screenshots. If you did not look at the pixels, you are not done.

**Atlas is the reference object.** The cream field, navy density, place names, and type toggles (`V3Atlas`) are the kind of thing we want more of: unique, on-brand, data you can touch. Google’s map chrome on search is not that. A KPI tile wall is not that. Eyes-on 2026-09-05: the Atlas *idea* is right and the **format** is not — a two-line how-to caption talks over the map, the left rail squishes the field into a pale strip, the heat legend is too small, and on city pages the number hero steals the fold so Atlas reads as leftover. Fix format. Keep the object. Put it where the job is “what’s here,” not under a percent strip.

**Every kept page ships one data-flex graphic.** Atlas, an interrogable V3Chart (draw-on / scrub / replay), encoded ledger, beeswarm, or payment breakdown. Structured prose is off the site. Nothing in TASTE or PUBLIC_UI forbids beautiful animated charts; it forbids decorating and counting numbers up on load. Grow `V3Chart` + `V3Atlas`. Do not add Recharts, D3-as-a-product, or a 60-type third-party kit. Footer cityscape: navy-on-cream Bend drawing + real wordmark; links broken out **by city** for SEO (`PAGE_OUTLINE.md` Footer).

Content stays. Duplicate **URLs** go away. Fold, do not delete.

---

## What this overrides

| Old thing | What it was doing | Now |
|---|---|---|
| 2026-09-03 “one place opener” + `site-contracts` leftover face | Forced city / hood / resort / plat to share Bend’s first screen | `PLACE_PAGES.md` wins. Tests move when we build. |
| PUBLIC_UI.md openings table where it fights PLACE_PAGES | Two written first screens | PLACE_PAGES is the opening. PUBLIC_UI keeps tokens, patterns, chrome. |
| `/lp/*` kit + `HideOnLP` | Second site for ads | Place URL is the landing. 301. |
| `VALUATION_LP`, nav link to `/lp/buyer-listing-alerts` | Ads as a fork | `/sell#get-value`, alerts on the real search/place page |
| KPI leftover strip + atlas how-to sentence | Random stats | A number has a job in a section or it does not print |
| Two search products (`/homes-for-sale` vs `/homes-for-sale/bend`) | Two apps | One Field. City URL is a filter, not a second chrome. |
| `gate-contracts.md` KB leftovers, ui_kits parity that freeze old stacks | CI as a museum | Rewrite the gate to this file when the page ships |
| Nav source still saying Buy / Areas | Chrome already says Homes / Places | Rename the source to match the chrome |

Do not start a third guideline. Change this file in the same commit as a section change.

---

## Menu (keep, simplify)

Chrome: **Homes · Places · Market · Sell · About**. Saved is an account icon. Value my home fills only on Sell leaves, not on `/sell` itself (the address field is the ask).

| Menu | Goes to | Children that stay | Children that fold |
|---|---|---|---|
| Homes | `/homes-for-sale` (one map+list) | Open houses, price drops, our listings, sold as a **filter**, invest | Luxury as a filter of search (keep the URL as 301). Compare as a mode of search. Video tours stay as `/videos` until they live on the listing. Listing alerts: on-page Sheet, not `/lp/…` |
| Places | `/cities` | Cities, neighborhoods, communities, subdivisions, Tetherow and the other resorts, schools, parks, trails, events, golf | `/area-guides` → indexes. Venues can live under events. |
| Market | `/housing-market` | How we get our numbers, blog, FAQ | Months of supply and activity **fold into** the market page as sections. Reports index stays if it is real published reports. Calculators: payment lives on the listing; rental/appreciation on `/invest`. |
| Sell | `/sell` | Value my home (the field), written valuation, our listings | `/home-valuation`, `/lp/seller-home-value`, `/lp/sell-your-home` → `/sell`. FSBO / expired → `/sell/…` |
| About | `/about` | Team, reviews, contact | Join / refer stay as About children, not a second look |

Footer matches the same five columns. No second solid button. Flagship search gets the same footer as everyone else.

---

## Keep / fold / 301 / cut

Content is the point. **URLs** are what we cut.

### Keep (the site)

| Family | URLs | Why |
|---|---|---|
| Home | `/` | Door. Houses, then places, then sell. |
| Search | `/homes-for-sale` and filtered paths | The buy job. One Field. |
| Listing | house URL | This house. |
| Place indexes | `/cities`, `/neighborhoods`, `/communities`, `/subdivisions` | Directories. Not a fourth Bend. |
| Place pages | `/cities/[city]`, `/cities/[city]/[hood]`, `/communities/[slug]`, `/subdivisions/[slug]`, `/zip/[zip]` | The landing pages. Spec in PLACE_PAGES.md. |
| Open houses / price drops | `/open-houses`, `/price-drops` | Modes of Homes. Same house row as search. |
| Our listings | `/our-homes` | Broker inventory. |
| Invest | `/invest` | Income property. Honest that Bend often does not cash-flow on LTR. |
| Market | `/housing-market`, `/housing-market/central-oregon`, `/housing-market/[city]`, `/how-we-get-our-numbers` | One knowledge engine. |
| Reports | `/housing-market/reports` + published slugs | Only real reports. |
| Blog | `/blog`, `/blog/[slug]` | Words. Attach to Market. |
| FAQ | `/faq` | Disclosures. Also a section on the page that owns the question. |
| Sell | `/sell`, `/sell/valuation` | Address is the spine. |
| About | `/about`, `/team`, `/team/[slug]`, `/reviews`, `/contact` | Faces, proof, ask. |
| Book | `/book` | Calendar. Same chrome. |
| Lifestyle indexes | `/schools`, `/parks`, `/central-oregon/trails`, `/events`, `/golf` | Content. Place pages **link here** and also show the nearby slice. |
| Account | `/account` and saved children | Not a nav word. |
| Legal | privacy, terms, cookies, fair housing, DMCA, accessibility, data-deletion | Footer strip. |
| Out of area | `/oregon/[city]` | Refer-out. |
| Auth / CMA / sign | `/login`, `/cma/*`, `/sign/*` | Service. Noindex where they already are. |

### Fold (keep the content, lose the extra URL)

| Today | Becomes |
|---|---|
| `/homes-for-sale/bend` as a **different app** (pagination, COLUMNS, alert banner) | Same Field as `/homes-for-sale?city=bend` |
| `/months-of-supply` | **Keep** as the definition URL (not a tile wall). Hub doors to it. |
| `/activity`, `/pulse` | Section on `/housing-market` (and a slice on the place page) |
| `/area-guides` | `/cities` + `/communities` |
| `/reports` (if it only re-exports) | `/housing-market/reports` |
| `/dashboard` | `/account` |
| `/resources` | Market / FAQ |
| `/feed` | `/videos` |
| `/home-valuation` | `/sell` |
| `/tools/mortgage-calculator` | Payment block on the listing (one formula). Hub link can 301. |
| `/tools/rental-property-calculator`, `/tools/appreciation` | `/invest` |
| `/compare` | Mode of search |
| `/luxury-homes-bend` | Filter of search (keep 301 for SEO) |
| `/buy/[intent]` | Homes or Sell, not a third chrome |
| Schools/parks **black-square indexes** | Same row primitive the listing already uses |

### 301 (ads and old paths keep working)

| From | To |
|---|---|
| `/lp/tetherow` | `/communities/tetherow` |
| `/lp/tetherow/heath` | Tetherow child plat (Heath) |
| `/lp/bend` | `/cities/bend` |
| `/lp/central-oregon-golf` | `/central-oregon/golf` |
| `/lp/seller-home-value`, `/lp/sell-your-home` | `/sell` |
| `/lp/fsbo` | `/sell/for-sale-by-owner` |
| `/lp/expired-listing` | `/sell/expired` |
| `/lp/buyer-listing-alerts` | `/homes-for-sale` with the alert Sheet |
| `/neighborhoods/{slug}` (already) | `/cities/bend/{slug}` |

Do not keep a Vellum page “so the ad looks like an ad.”

### Cut only if empty

`/motivated-sellers` if it is not a real product. `/builders` if it is a thin directory — otherwise keep as Places content. `/dev/*` stays off production chrome.

---

## What we already have (the moat — use it, do not re-research from scratch)

Competitor pages are the **baseline of sections**. These assets are how we beat them. They already exist. Wire them into the section that owns the question. Do not dump them as percent tiles.

| Asset | Where it lives | Page job |
|---|---|---|
| Live listings / pins | `listings` via DAL, Field + Atlas | What’s selling here |
| Market pulse + cache | `market_pulse_live`, `market_stats_cache` | One pace/sold answer |
| Place polygons | `boundaries`, `data/resort-communities.json` | Map of **this** place, child plats |
| Recorded CC&Rs / bylaws / design guidelines | `place_document` + `place_document_link`, pipeline `scripts/place-documents/`, `V3PlaceDocuments` | Plat/community “governing docs” section. County title index is a research bucket, not a publish set — R7 still holds. |
| Lot lines | taxlots DAL, `getTaxlotsNear`, listing atlas parcels, cron `taxlot-refresh` | Listing map + plat map |
| Amenities / membership / golf | `data/resort-communities.json`, `V3CourseMap` | Master-plan belonging |
| Schools / parks / trails / events | `/schools` `/parks` `/central-oregon/*` DAL | Neighborhood daily life + listing nearby |
| Reviews | V3Proof / Google reviews | About + home proof |
| Resort research dumps | `data/resort-community-*.json`, `tmp/eagle-crest-associations.json` | Source for belonging copy, not a second page |

If a section in PLACE_PAGES has no data yet, omit the section. Do not invent a percent.

## One look (non-negotiable)

- One header, one footer, one `V3Button`. Filled navy is the one primary in the viewport. Ghost is the rest. Mic is not a second filled primary.
- One house row: photo, price, beds/baths/sqft, street. Search, open houses, place Field, similar homes — same row.
- Search wears Ledger (dense). Everything else Broadside. Radius 0. No elevation. No Playfair, no Inter, no rounded KPI tiles.
- Cookie banner cannot cover Tour, Value my home, or the first house.

---

## What is on each page

A number belongs to a section or it does not print. Beat the competitor **and** add the live MLS they do not have.

### Home `/`

**Beat:** the first impression of a serious local brokerage, not a portal.

1. Search that goes to Homes  
2. Houses on the map  
3. Doors: Places, Sell, Invest (no “see what your home is worth”)  
4. Resorts / cities as doors  
5. Proof (reviews)  
6. Faces  

### Homes `/homes-for-sale`

**Beat:** [Zillow Bend](https://www.zillow.com/bend-or/) — map + list, filters, save, photo/price/beds.

1. Map + list bound both ways  
2. Filters in one Sheet  
3. Honest count of what is on the map  
4. Save / alerts as a Sheet, not the first viewport  
5. Click a house → listing  

City, ZIP, and “Bend luxury” are this page with filters. Not a second layout.

### Listing (house URL)

**Beat:** Zillow Showcase — media, price, facts, map, schools, payment, similar, agent.

1. This house’s photos (price and specs on the media)  
2. One ask: tour / talk to a broker  
3. Facts  
4. One payment (one formula — no `$9,936` vs `$9,879`)  
5. Map of this house + place climb  
6. Schools / parks nearby (same thumbs as `/parks`)  
7. History  
8. Similar in the same parent  
9. Structured data from the same figures  

### Places

See [`PLACE_PAGES.md`](PLACE_PAGES.md). Short version:

| Page | Beat | Must have, in order |
|---|---|---|
| City | Top “Bend real estate” results + Zillow city | Photo of the city, houses, neighborhood doors, resort doors, one market answer, activity, guides, ask |
| Neighborhood | Best NWX / Old Bend pages (schools, parks, trails, plats) | Photo of **this** hood, houses here, plats and which are moving, schools, parks/trails, events, one pace, guides, ask |
| Master-plan | The resort’s own site (tetherow.com: golf, membership, dining, hotel, pool) **plus** live MLS | Belonging, houses, child plats, golf/membership/HOA/STR, one sold line, edges, ask |
| Plat | Plat name + parent | Homes (list if short), parent breadcrumb, peer plats, ask |
| Indexes | A directory, not an article | A–Z of that grain, live counts, doors |

Lifestyle `/schools` `/parks` `/trails` `/events` `/golf`: encoded lists with real thumbs, linked from the place page’s nearby slice. Not a black square.

### Market `/housing-market`

**Beat:** Redfin / Realtor.com Bend data pages — one verdict, one chart, not sixteen tiles.

1. One sentence + one chart you can read  
2. Cities as doors (not a percent wall)  
3. History / closed as a slice  
4. How we get our numbers (link or short dictionary)  
5. Reports that exist  
6. Blog  

Months of supply and activity are sections here, not sister sites.

### Sell `/sell`

**Beat:** a seller page that starts with the address, not a brochure.

1. Photo + address field + Value my home  
2. The 3% plan  
3. Proof  
4. Our listings  
5. Questions  

`/sell/valuation` is the same form with more room. One filled ask. Chrome fill XOR the form, not both plus a ghost.

### About `/about` · `/team` · `/team/[slug]`

See [`PAGE_INVENTORY.md`](PAGE_INVENTORY.md) §6. Conversion page Matt sends: Call/Text first, **firm** reviews and **firm** sales, brokers as doors. Individual sales only when that broker has a real record. No poster-sized three-headshot fold. No valuation form on the broker page.

### Invest `/invest`

Honest numbers. Calculator lives here. Not a Value-my-home first viewport.

---

## Data so LLMs cite us

Every kept page already should ship Place / Dataset / FAQ JSON-LD from the **same** live figures the human sees. Do not invent a parallel “AI version.” `llms.txt` points at these URLs. A number that is only in a tile and not in the schema is half a page.

---

## Build order (so we do not loop)

1. Rename nav source to Homes / Places. Kill atlas how-to sentence. One house row. Cookie off Tour.  
2. 301 place LPs.  
3. One neighborhood + Tetherow to PLACE_PAGES.md. Show Matt those two URLs.  
4. Clone that class to every other hood / resort / plat / city.  
5. One search Field (kill the Bend SEO second app).  
6. Listing: price on media, one payment, one ask.  
7. Market: one chart, fold MOS + activity.  
8. Rewrite tests/parity that freeze the old stacks **in the same commit** as the page.

No page ships a second button language. No page ships a leftover KPI strip “until we get to that grain.”
