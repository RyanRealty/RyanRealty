# Page inventory — locked 2026-09-05

**This is the agreement.** Every public page we keep, what is on it, in order. Change a section here in the same commit as the page. Do not add a block because a page felt empty. Do not build until Matt says this file is the lock.

**Granular outline (purpose, itemized fields, no structured prose, data-flex graphic per page):** [`PAGE_OUTLINE.md`](PAGE_OUTLINE.md).  
**How place pages explain sales data to regular people:** [`DATA_GRAPHICS.md`](DATA_GRAPHICS.md).

Parent: [`SITE_PAGES.md`](SITE_PAGES.md) (keep/cut, one look, Atlas, looking). Places hierarchy: [`PLACE_PAGES.md`](PLACE_PAGES.md).

Rules that apply on every page below:

- One chrome (Homes · Places · Market · Sell · About). One `V3Button`. One house row (photo, price, beds/baths/sqft, street).
- A number has a job in its section or it does not print.
- No “N listings of every type… Pinch or scroll to zoom.”
- No `/lp/*` as a second look. Those URLs 301 here.
- Look at 1440 and 375 screenshots before done.
- Atlas (cream field, navy density) is the map language. Format it so the field is the spectacle.

---

## Menu

| Word | Lands on |
|---|---|
| Homes | `/homes-for-sale` |
| Places | `/cities` |
| Market | `/housing-market` |
| Sell | `/sell` |
| About | `/about` |

Saved = account icon. Value my home fills only on `/sell/*` leaves, not on `/sell` (the address field is the ask).

---

## 1. Home `/`

**Job.** Door. Buy, look, or sell.

| # | Section | Notes |
|---|---|---|
| 1 | Search | Goes to Homes. Placeholder short enough at 375. |
| 2 | Houses / Atlas | Atlas as the spectacle (no how-to caption). Houses bound to it. |
| 3 | Doors | Places · Sell (`Value my home`) · Invest. Never “see what your home is worth.” |
| 4 | Place doors | Cities / resorts as doors, not a KPI grid. |
| 5 | Proof | Firm Google reviews (V3Proof). |
| 6 | Faces | Three brokers as doors to `/team/[slug]`, not a poster that is the whole page. |

---

## 2. Homes

**One house row everywhere:** photo · exact ask · beds · baths · sqft · street (MLS street, including NW). Same row on search, open houses, our listings, similar homes, place Fields. `$/sqft` is one slot, not meta **and** a pill. Empty photo is labeled empty, never a gray slab.

**One payment formula on the listing:** `computeMonthlyPiti` only. Face “Est. $/mo” and the calculator seed the **same cents**. Inputs may change the number; they may not start from a second recipe (today: face includes HOA + 0.35% insurance; calculator omits HOA and uses a different insurance rate — `$9,936` vs `$9,879` on 371 Crosby).

### `/homes-for-sale` (and every filtered URL: city, ZIP, beds, luxury, sold)

**Job.** Show the houses. One Field. City URL is a filter, not a second app.

| # | Section | Notes |
|---|---|---|
| 1 | Map + list | Bound both ways. Atlas language if we can; if tiles stay, restyle chrome to v3 (no Google Draw/Roboto). |
| 2 | Filters | One Sheet. Not email-first at 375. |
| 3 | Rows | Photo, price, beds/baths/sqft, street. No blank gray thumb when photos exist. |
| 4 | Alerts | Sheet under the list, not covering cards. |

**Fold into this Field (301 or query):** `/homes-for-sale/bend` second layout, `/luxury-homes-bend`, `/compare` as a mode, `/lp/buyer-listing-alerts`.

### `/open-houses` · `/price-drops` · `/our-homes`

Same house row (not a custom photo grid each). Photo Field. No filled Value my home as the primary on a buyer list. No email overlay on the cards. `/luxury-homes-bend` is this Field with a price filter, not `LuxuryPhotos`.

### `/videos`

Tours that exist. Until then, listing pages carry video. Do not invent a second product.

### Listing (house URL)

**Job.** This house. Beat Zillow Showcase.

| # | Section | Notes |
|---|---|---|
| 1 | Place breadcrumb | City → neighborhood → community → plat → street. |
| 2 | This house’s media | Price, beds, baths, sqft, street **on** the media. Tabs if we have them: photos, 3D, floor plan, map. No empty navy panel. |
| 3 | One ask | Tour / Call / Text. Cookies cannot cover it. |
| 4 | Facts | Type, lot size, year, HOA if any, $/sqft. Same house-row language. |
| 5 | Payment | **One** formula, one number, with line items (P&I, tax, HOA). No leftover face estimate. |
| 6 | Map | This lot + climb. Atlas language. Assessor lot lines we already have. |
| 7 | Schools | Nearby unless attendance-zone is actually known. Do not claim “assigned.” |
| 8 | Parks / trails nearby | Same thumbs as the indexes. |
| 9 | Tax history | Assessor table + county link. One assessed figure. |
| 10 | CC&Rs that bind this house | Published plat docs, not MLS subdivision name. |
| 11 | Similar in the same parent | Same house row. |
| 12 | Who listed | Live broker. Firm proof if the person has no record. |

---

## 3. Places

Indexes are directories. Members are landings (ads hit these).

### `/cities` · `/neighborhoods` · `/communities` · `/subdivisions`

A–Z directories. Live counts on the **rows**, doors. Not a mini-Bend KPI Instrument (that is live today). Visitor copy on the plat index: subdivision / the place name — never “plat.” `/communities` is resorts/master-plans only, not every neighborhood dumped in.

### City `/cities/[slug]` · ZIP `/zip/[zip]`

**Beat:** top “Bend real estate” results.

| # | Section |
|---|---|
| 1 | Photo of **this** city + H1 + breadcrumb. Verdict is a caption, never a five-number hero. ZIP: skip photo, houses first. |
| 2 | Houses on **this** city’s map (Atlas, no how-to). |
| 3 | Neighborhoods (which are moving). |
| 4 | Resorts / planned communities in this city. |
| 5 | One market answer (one chart or one sentence). |
| 6 | Schools (table or doors). |
| 7 | Activity / open houses. |
| 8 | Guides / parks / trails. |
| 9 | Ask (alerts). |

### Neighborhood `/cities/[city]/[hood]`

**Beat:** best NWX / Old Bend pages (schools, parks, plats).

| # | Section |
|---|---|
| 1 | Photo of **this** neighborhood + breadcrumb to the city. |
| 2 | Houses here. |
| 3 | Plats inside, encoded by what is moving. |
| 4 | Schools from here. |
| 5 | Parks and trails nearby. |
| 6 | What’s on this week (real events). |
| 7 | One pace answer. |
| 8 | Guides / news. |
| 9 | Ask. |

Northwest Crossing is this job even if the URL is `/communities/northwest-crossing`. Routing is not a Bend clone.

### Master-plan `/communities/[slug]`

**Beat:** the resort’s own site (tetherow.com) **plus** live MLS.

| # | Section |
|---|---|
| 1 | Owned photo of **this** place + breadcrumb to the city. Belonging, not “17 homes / $2.3M.” |
| 2 | What this place is (golf, membership, dining, hotel, pool — sourced from `resort-communities.json` and recorded facts). |
| 3 | Houses for sale here. |
| 4 | Villages / plats inside, what’s moving. |
| 5 | Golf / course map when we have it. |
| 6 | Membership / HOA / STR. Published CC&Rs (`V3PlaceDocuments`) when R7 allows. |
| 7 | One sold/pace line. |
| 8 | Edges (trails, Bachelor, Old Mill as doors). |
| 9 | Ask. |

### Plat `/subdivisions/[slug]`

| # | Section |
|---|---|
| 1 | Name + breadcrumb to neighborhood **or** resort, then city. |
| 2 | The homes (list if few; map if pins earn it). Never the parent city’s still. |
| 3 | Peer plats. |
| 4 | Governing docs if published. Lot lines if we have them. |
| 5 | One sold line if we have it. |
| 6 | Ask. |

**301:** `/lp/tetherow` → `/communities/tetherow`. `/lp/bend` → `/cities/bend`. `/lp/tetherow/heath` → Heath’s plat/community URL.

---

## 4. Market

### `/housing-market` (hub)

**Beat:** Redfin/Realtor data pages — one verdict, one chart.

| # | Section |
|---|---|
| 1 | One sentence + one interrogable chart. |
| 2 | Cities as doors (not a 16-tile percent wall). |
| 3 | Closed / history slice. |
| 4 | Activity (folded here; `/activity` and `/pulse` 301 here). |
| 5 | Months of supply as a door to `/months-of-supply` (definition page — keep the URL). |
| 6 | How we get our numbers (door). |
| 7 | Reports that exist. |
| 8 | Blog door. |

### `/housing-market/central-oregon` · `/housing-market/[city]`

Same grammar, tighter geo. Not a second tile kit.

`/housing-market/[city]/[community]` is not a third Tetherow. Fold into the community **place** page’s one sold line, or keep only as a real dated report.

### `/months-of-supply`

Keep. This is the citable definition (formula + city rows), not a 16-tile dump. Hub doors here. First screen: the formula and one chart, not a percent wall.

### `/how-we-get-our-numbers`

Keep. Dictionary as disclosures (`V3Answers`). Houses / Once / Window stays. No live figures here.

### `/housing-market/reports` + published slugs

Only real reports.

### `/blog` · `/blog/[slug]`

Words. Attach to Market. Not a second chrome.

### `/faq`

Disclosures. Questions that belong on Sell/Places also live there. Do not duplicate a wall.

---

## 5. Sell

### `/sell`

**Job.** Address in, valuation out. This opening is a lock.

| # | Section |
|---|---|
| 1 | Stage + address field + **Value my home**. One filled control. |
| 2 | 3% plan. |
| 3 | Firm proof (reviews). |
| 4 | Our listings. |
| 5 | Questions. |

### `/sell/valuation`

Same form, more room. Chrome fill **or** the form, not both plus a ghost. 375: do not overflow the header.

### `/sell/for-sale-by-owner` · `/sell/expired-listings`

Sell leaves. Same shop. Rebuild on the `/sell` spine (not `LeadLandingPage`). **301** `/lp/fsbo` → `/sell/for-sale-by-owner`. **301** `/lp/expired-listing` → `/sell/expired-listings`.

`/sell/inherited-home` folds into `/sell` (a situation, not a fourth product).

**301:** `/lp/seller-home-value`, `/lp/sell-your-home`, `/home-valuation` → `/sell`.

---

## 6. About (brokerage conversion)

Matt sends people here. Eyes-on 2026-09-05:

- `/about` and `/team`: same first screen — three gigantic headshots.
- `/team/matthew-ryan` and `/team/rebecca-peterson`: name + oversized cutout + Call/Text, then a lake of cream, then license, then a personal tally (`21 closed` / `4 closed`), then a CMA **form**. Rebecca’s four sales is exactly the thin personal record we must not lead with.
- `/team/paul-stevenson`: already falls back to “Recent brokerage closings” (no personal set). That fallback is the default for everyone until they have a real record.

That is the conversion failure: poster photo, empty fold, form, footer.

**Proof rule:** until a broker has a real personal sales record, **firm** reviews and **firm** closings sit on `/about` and on `/team/[slug]`. Personal sales appear when they exist. Do not show an empty or embarrassing individual tally.

### `/about`

**Beat:** a brokerage you would actually hire. Call/text first. Firm proof before biography.

| # | Section | Notes |
|---|---|---|
| 1 | Who we are + Call / Text | One line. Phone is the conversion. Faces are doors, not a poster that eats the fold. |
| 2 | Firm proof | The 25 Google reviews (V3Proof). Brokerage social proof, not three empty personal ledgers. |
| 3 | Firm sales | Recent **Ryan Realty** closings / our listings. Same house row. |
| 4 | The brokers | Three people as doors to `/team/[slug]`. Call/Text on the row. |
| 5 | Where we work | Atlas of the service area. No how-to caption. Field is the spectacle. |
| 6 | How it started | Short Quiet. Not the fold. |
| 7 | Licenses | One sourced line (firm + PB). Not a KPI hero. |
| 8 | Questions | V3Answers. |

### `/team`

Roster only. Same house of faces as About’s broker row — not a second About. Call/Text. Door to each `/team/[slug]`.

### `/team/[slug]`

**Job.** This person, backed by the firm.

| # | Section | Notes |
|---|---|---|
| 1 | This person | Normal headshot, name, title, license as a line. Firm review door (`25` Google / `5.0`) next to the name — not a personal volume hero. Not AboutFaces at poster size. |
| 2 | Call / Text / Email | The conversion. Live today the CMA sheet sits **above** these doors. Flip that. Valuation is `/sell`. |
| 3 | Firm proof | Same reviews + firm sales as About, labeled as the brokerage. Default. Competitors who convert lead with stars + contact, then sales. We cannot lead with a four-sale personal tally. |
| 4 | Personal record | **Only if** there is a real set of that broker’s closings. Atlas/Ledger of *their* dots. If not, omit. Do not pad. |
| 5 | Short bio | Facts. No virtue. |
| 6 | Door back | All brokers, reviews, sell. |

### `/reviews`

V3Proof as now (dots, years, full quotes). Firm-level. Do not split into three thin personal walls.

### `/contact`

Call / text / write / book first (already). Form **below**. Same buttons as everywhere.

### `/join` · `/refer-a-client`

Keep as About children. Same chrome. Not a second look.

### `/book`

Calendar. Same chrome.

---

## 7. Invest `/invest`

Honest income-property. Calculator here. Not Value my home as the first filled button.

**Fold:** `/tools/rental-property-calculator`, `/tools/appreciation` → here.

**Fold:** `/tools/mortgage-calculator` → payment block on the listing (one formula). Hub 301.

---

## 8. Lifestyle indexes

Keep the URLs (content). Place pages show the **nearby slice** and door here.

| URL | On the page |
|---|---|
| `/schools` · `/schools/[slug]` | Encoded list + detail. Group by district. |
| `/parks` · `/parks/[slug]` | Keep. Fix black-square thumbs. |
| `/central-oregon/trails` · `/[slug]` | Keep. Same thumb fix. Alias `/trails` → here. |
| `/central-oregon/events` · `/venues` · `/golf` | Keep these live URLs. Alias `/events` `/venues` `/golf` if they 404. **301** `/lp/central-oregon-golf` → `/central-oregon/golf`. |

---

## 9. Account · legal · system

| URL | Status |
|---|---|
| `/account` and saved children | Keep. Not a nav word. |
| privacy, terms, cookies, fair housing, DMCA, accessibility, data-deletion | Footer strip. |
| `/oregon/[city]` | Out of area. Refer. |
| `/newsletter` | Keep or door from Market. |
| `/login` `/cma/*` `/sign/*` | Service. |
| `/not-found` | Quiet + search + doors (already). |
| `/offline` | PWA. |

---

## 10. Explicitly not pages

| URL | Becomes |
|---|---|
| `/lp/tetherow` (still **200** on 2026-09-05 capture) | `/communities/tetherow` |
| `/tetherow-resort-living-real-estate` (blog) | `/communities/tetherow` |
| `/homes-for-sale/{city}/{area}` when area is a community/hood/plat | the place URL |
| `/lp/tetherow/heath` | `/communities/tetherow` (MLS does not tag Heath as its own plat) |
| `/lp/bend` | `/cities/bend` |
| `/lp/seller-home-value` `/lp/sell-your-home` `/home-valuation` | `/sell` |
| `/lp/fsbo` | `/sell/for-sale-by-owner` |
| `/lp/expired-listing` | `/sell/expired-listings` |
| `/sell/inherited-home` | `/sell` |
| `/lp/buyer-listing-alerts` | Homes alert Sheet |
| `/activity` `/pulse` | sections on `/housing-market` |
| `/months-of-supply` | **Keep** as the definition URL. Hub doors to it. Rewrite the tile wall. |
| `/area-guides` `/dashboard` `/resources` `/feed` | indexes, `/account`, Market, `/videos` |
| Second `/homes-for-sale/bend` app | one Field |

---

## Live chrome that still disagrees (from the 2026-09-05 route scan)

These are on the site today. They are not extra product. Retarget when we build.

| Live | Action |
|---|---|
| Nav still labeled Buy / Areas in source | Rename to Homes / Places |
| `/lp/buyer-listing-alerts` in Homes menu | Alerts Sheet on `/homes-for-sale` |
| `/luxury-homes-bend` `/compare` in Homes menu | Filters / mode of the one Field |
| `/activity` in Market menu | Section on `/housing-market` (URL can 301) |
| `/tools/*` in Market menu | Payment on listing; rental/appreciation on `/invest` |
| `/book` missing from public footer | Add under About, same chrome |
| `/cookies` not in LEGAL_LINKS | Add to the legal strip |
| `/buy/{intent}` (first-time, etc.) | Fold into Homes or FAQ. Not a third chrome |
| `/housing-market/history` `/annual-review` `/reports/archive` | Keep as Market members if they have real content; same look |
| `/faq/{slug}` | Keep as FAQ members |
| `/site-index` | Keep (crawler directory) |
| `/join` `/refer-a-client` | Keep as About children |

Full live map: `out/audits/ui-ux-inconsistencies/2026-09-05/findings/inventory-live-routes.md`.

## Agreement

Matt: if a row is wrong, name the **route and the section number**. Do not file a new guideline. When this file is agreed, build starts with: kill Atlas how-to, 301 place LPs, Tetherow + one neighborhood to §3, `/about` to §6.
