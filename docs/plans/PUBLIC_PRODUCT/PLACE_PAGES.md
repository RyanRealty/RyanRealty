# Place pages — what they are

Locked from Matt 2026-09-05. This is the way out of the add/remove loop.

Parent inventory (whole site, keep/cut, one look): [`SITE_PAGES.md`](SITE_PAGES.md). This file is the Places chapter. SITE_PAGES overrides leftover contracts that fight this chapter.

The pages look like **one website**. The **information** on each page is unique to that place and to the search that brought the person here. Hierarchy is the same everywhere. First screens are not photocopies of Bend.

Do not relitigate “same template vs five templates.” That was the trap. Same shop. Same climb. Different job on the page.

---

## The rule (plain)

1. **One shop.** Same chrome, same type, same navy/cream, same way a house row looks, same way a breadcrumb works. If you go from Bend to Tetherow to a plat, you never wonder whose site you are on.
2. **A real parent.** Tetherow’s parent is Bend. A plat inside Riverwest climbs to Riverwest. A plat inside Tetherow climbs to Tetherow, then Bend. Children look like children of that parent — not like a second Bend homepage.
3. **The page beats the search.** Someone googles “Northwest Crossing Bend” or “Tetherow” or “Caldera Springs.” This URL has every section that page needs to win, in an order a person would actually read, plus the live sales data no resort homepage and no Zillow clone has.
4. **Say the fact, then stop.** No mannered captions. No “91 listings of every type for sale, 48 pending, 17 sold in the last 30 days. Pinch or scroll to zoom.” The map is the map. Type toggles and pins do the work. Nobody else writes a how-to under the fold. We will not either.
5. **One source for a number.** A median, a count, a months of supply appears once. Hero strip + atlas sentence + market block saying the same thing is a defect.
6. **A number has a job.** It answers the section it sits in. “What’s selling” gets houses. “Which plats are moving” gets a comparison of those plats. “How fast” gets one pace chart. A tile of percents with no sentence is not organization. Do not sprinkle stats because we have them.
7. **Graphics are how regular people read sales data.** Places pages differentiate with Atlas + one cost-or-pace chart + encoded children — not leftover HUD tiles and not essays. Labels are the question a non-broker asks. Jargon (MOS, days to pending) is hover + `/how-we-get-our-numbers`. Spec: [`DATA_GRAPHICS.md`](DATA_GRAPHICS.md).
7. **The place URL is the landing page.** Ads, Meta, Google, emails, and internal doors all hit `/cities/…`, `/communities/…`, `/subdivisions/…`. There is no second Tetherow, no second Bend, no Heath LP with a different chrome. `/lp/tetherow`, `/lp/bend`, `/lp/tetherow/heath` 301 to the real page. Existing ad URLs keep working because they follow.
8. **Stop vibe edits.** A section is on the page because this spec says so, or it is off. Do not add a block because a page “felt empty.” Do not delete photography, maps, or listing facts to satisfy a caption rule.

---

## Hierarchy (the climb is the product)

```
City                    Bend
 ├── Neighborhood       Riverwest, Old Bend, Westside, …
 │    └── Plat          a recorded subdivision inside that neighborhood
 ├── Master-plan        Tetherow, Caldera Springs, Broken Top, Widgi Creek, …
 │    ├── Plat          a neighborhood/plat inside the resort
 │    └── Family        Ridge at Eagle Crest: one name the county recorded in phases
 │         └── Phase    Ridge at Eagle Crest 36 (see "Subdivision families")
 └── ZIP                97703 (a city-shaped Field, not a fifth Bend clone)
```

| You are here | Parent door | Child doors |
|---|---|---|
| City | Central Oregon / homes | Neighborhoods, resorts in this city, ZIPs |
| Neighborhood | Its city | Plats inside the boundary, peer neighborhoods |
| Master-plan | Its city | Plats / villages inside the resort |
| Plat | Neighborhood **or** master-plan, then city | Peer plats, the homes on this plat |
| Listing | Street → plat → neighborhood/resort → city | Similar homes in the same parent |

Breadcrumb is how you feel the family. It is the same mechanic on every grain. It is not optional chrome.

Northwest Crossing is a searched place people treat as a neighborhood (schools, parks, Main Street, plats inside). Whether the URL is `/cities/bend/northwest-crossing` or `/communities/northwest-crossing` is routing. The **job** is: houses here, plats inside, daily life. Do not ship a Bend clone on that URL.

---

## What stays the same on every place page

- V3 chrome and footer
- Breadcrumb climb
- One Field of this place’s houses (photo, price, beds/baths/sqft, street) bound to a map of **this** boundary
- One source line when a number is shown
- Alerts as one Sheet, not a covering overlay
- FAQ as disclosures, not a wall
- Structured data (Place + Dataset + FAQ) from the same live figures the page shows — for Google and for LLMs

## What is not allowed to stay the same

- The first screen
- Which sections exist
- Section order
- Copy that names the grain wrong (“plat” on a city still, Bend’s river photo on Park Addition)

---

## Kill list (do these; do not debate)

- Atlas claim: “N listings of every type for sale, N pending, N sold in the last 30 days. Pinch or scroll to zoom. Tap a place…”
- KPI strip on the hero (679 / $950,000 / seller’s market / 3.9 / 23) as the first thing you read. An answer that appears only after the visitor types their own address (the opening ask, 2026-09-07) is not a strip: nothing prints until they act.
- Teaching the map how to be used
- Duplicate counts in three places
- City still reused on a plat that has four homes
- Mannered “in plain words” filler that restates the H1
- Random percent tiles and leftover KPI grids that are not answering a section
- Public `/lp/*` place landings (`/lp/tetherow`, `/lp/bend`, `/lp/tetherow/heath`). 301 to the canonical place URL. Do not keep a second chrome “for ads.”

Seller/FSBO/expired landings are not place pages. They belong on `/sell/…` with the same shop chrome. They are not an excuse to keep a Vellum `/lp` kit.

---

## Every place page shows its listings on the dial (Matt 2026-09-23, 2026-09-24)

Matt 2026-09-23, re-asked 2026-09-24: "a primary card with a vertical slider on the side; the slider toggles through the thumbnails and that changes the card, and vice versa." Every place page (city, community, neighborhood, plat, and `/commercial-space-for-lease`) shows its listings on `V3ListingDial`, one dial per property type or buyer group, and no place page draws a listing carousel. On city, community and neighborhood pages the homes under the map are `PlaceSubdivisionHomes`, whose only layout is the dial (its carousel variant was deleted 2026-09-24); on a plat the inventory is `V3PlaceInventory layout="dial"`. What the dial holds on every one of them: one listing large with its lead photograph and the card copy (ask, facts, address, a door to the listing); the rest of the set as thumbnails on the dial's rail; "03 / 12" with a filling rule; thumbnails, previous/next, arrow keys, Home/End and a swipe on the photograph all turn it, and the rail follows the card both ways; no scrollbars and no price cut off; every listing an `<a href>` in the served HTML; one listing is the card alone; an empty type is omitted; a commercial lease is never in a for-sale dial or its count (it has its own last dial, "Commercial space for lease"). The map selection still decides what the dials hold.

**One inventory story per page (2026-09-29).** The map's key names its under-contract marks without counting them ("685 for sale · under contract"), because the homes under it count only the part still showing ("3 under contract, still showing"), and a second "under contract" figure on the page read as a contradiction. A months-of-supply bar names its own population where it differs from the map's: the city's is every house with its address ("Houses with a Bend address", Market Truth city membership is the MLS city text), a neighborhood's "Detached for sale", a community's "Houses for sale". City and neighborhood pages open on the figure and the alerts, then the map and its dials; a community page stands its alerts beside the map (`place-one-map--ask`), the places list under the map, because no community geo has a publishable months of supply to open on.

**One "for sale" on the page (SITE-193, 2026-09-24).** The map over the homes and the counts over the dials read one classifier, `publicCountState` in `lib/listing-status-public.ts`: Active is for sale; Active Under Contract and Pending are under contract (the map's pending marks). The dials hold every listing a visitor may see as on the market, so a group reads "533 for sale · 5 under contract" and its Active Under Contract cards say "Under contract". /cities/bend had printed "700 for sale" on the map and "705 for sale" under it, the same 700 Active listings plus 5 under contract. `lib/place/place-count-label.test.tsx` holds the two counts equal. The source line under the homes says the same set in the reader's words (`placeInventorySource`), never MLS status names. The single-family count a neighborhood or plat prints over its map ("homes for sale", its meta description, its Q&A, its median ask, the /neighborhoods and /subdivisions tiles) reads the same classifier: `getNeighborhoodPublicInventory`, `getPlatPublicInventory` and `getPlatFamilyInventory` count Active as `activeCount` and Active Under Contract as `underContractCount`, and keep both in `listingKeys` because both are still shown. The same test holds that count, the for-sale count of the same single-family listings in the homes block, and the map's for-sale house marks equal over one population. (The homes block's house dial also takes manufactured homes, which the single-family count does not; the neighborhood's homes source says it is the wider set.)

**The rail position varies by section (Matt 2026-09-24: not every dial is the same interaction).** A page that stacks several dials does not repeat one arrangement: each dial takes `railPosition={dialRailPositionAt(i)}` by its order on the page (the helper cycles bottom, left, right; the primitive's default is bottom), so adjacent dials differ. PlaceSubdivisionHomes counts its for-sale dials and then the lease dial in page order; V3PlaceInventory counts its type dials and then the lease dial. This replaces the 2026-09-23 rule that every dial stood its rail on the LEFT. The reason for that rule still binds a right-hand rail: the site's Jax button is fixed at the right edge, mid-screen, and must not cover a thumbnail or a control.

---

## City — `/cities/bend`

**Search to beat:** “Bend real estate”, “homes for sale Bend Oregon”, and the top five results for those.

**Job.** Here are Bend’s houses. Here are the neighborhoods and resorts you can open next.

| Order | Section | Why |
|---|---|---|
| 1 | Photo of this city + H1 + breadcrumb | Identity. Verdict, if any, is a short caption on the photo — not a five-number hero. |
| 1b | The market figure and the alerts ask (2026-09-29) | The taste lock: a place page opens with a drawing and a figure beside the alerts sentence. The months-of-supply bars (their homes bar named "Houses with a Bend address", the Market Truth city population) and the alerts strip stand under the photograph; the city's places run as doors under the figure at 1440. |
| 2 | Houses on this city’s map, then the same houses on listing dials | Zillow/Redfin/Compass city URLs are search SERPs. We win with Atlas + live pins, and one dial per buyer group under the map, filtered by the neighborhood or plat chosen on it. |
| 3 | Neighborhoods (doors, with what is moving) | Children of this city. |
| 4 | Resorts / planned communities in this city | Other children. Tetherow is a door, not a clone of this page. |
| 5 | One market answer | Pace or median as a chart you can read. Once. Not a KPI hero. |
| 6 | Schools (table or doors) | Competitors put this on the city/market child. Nearby SFR we already join. |
| 7 | Activity / open houses | Proof it is live. |
| 8 | Guides / parks / trails | Real posts and lifestyle indexes. |
| 9 | Ask | Alerts for this city. |

ZIP is this job without a still: houses first.

---

## Neighborhood — `/cities/bend/old-bend`, Riverwest, Northwest Crossing as a lived place

**Search to beat:** “Northwest Crossing Bend”, “Old Bend neighborhood”, and the best neighborhood pages already ranking (High Lakes / Compass Park / trails / Summit High class of page).

**Job.** What is selling here. What the plats inside are doing. What daily life is if you live here.

| Order | Section | Why |
|---|---|---|
| 1 | Photo of **this** neighborhood + H1 + breadcrumb to the city | You know where you are. Parent is the city. |
| 2 | Houses for sale **in this boundary** | “Here’s what’s selling.” Map of the neighborhood, not Central Oregon. Lot lines when we have them. |
| 3 | Subdivisions / plats inside, encoded by what is moving | “Here are the different subdivisions and which are really moving.” |
| 4 | Schools kids go to from here | Daily life. High Lakes / Pacific Crest / Summit class of fact. |
| 5 | Parks and trails nearby | Compass Park, Discovery Park, neighborhood trail connections. Named, not a walk-score tile we do not have. |
| 6 | What’s on this week | Events that are actually in or next to this place (farmers market class). |
| 7 | Governing docs | Published CC&Rs / ARC / design guidelines when R7 allows. NWX’s official site is only this; we add houses. |
| 8 | One market answer | Pace of **this** neighborhood, once, as a chart or one sentence. |
| 9 | Guides / news about this place | Real posts. |
| 10 | Ask | Alerts for this neighborhood. |

Do not open with a number hero. Do not put subdivisions after a long “about” essay.

**The homes under the map are dials (Matt 2026-09-23).** `PlaceSubdivisionHomes`: each buyer group in the current map selection is one `V3ListingDial`, the same primitive the plat pages use, so a reader looking at River West's multifamily homes sees one of them large and flips through the rest on the dial's rail, with "01 / 02" at the dial's head. Choosing a subdivision on the map still decides what is in the dials (each re-opens on the first home of the new selection). The neighborhood band is 90rem, so the dial lays its card on its side there: the photograph, with the copy in a column on its right (the product-gallery order). The rail's position varies from dial to dial (`railPosition={dialRailPositionAt(i)}`: bottom, left, right, the first dial on the page at the bottom; see "Every place page shows its listings on the dial" above). On 2026-09-23 every rail stood on the LEFT because the site's Jax button sits at the right edge, mid-screen, and covered a right-hand dial wherever the band runs to the viewport's edge; since 2026-09-24 a right-hand rail, and every control along the dial's right edge, stops short of the Jax button (see "The listing dial" below). City and community pages draw the same dials under their maps (Matt 2026-09-24; the carousel is gone from every place page).

---

## Master-plan / resort — `/communities/tetherow`, Caldera Springs, Broken Top, Widgi Creek

**Search to beat:** the resort’s own homepage. For Tetherow that is [tetherow.com](https://tetherow.com/): lodging, restaurants, golf (McLay Kidd), membership, pool/sport, residential neighborhoods, “edge of the forest / 7 minutes from Old Mill / 20 minutes from Bachelor.”

**Job.** This URL has every section that homepage has, **plus** live homes, sold, plats inside, HOA/STR, and the parent door to Bend. We win on merits: their amenities plus our sales.

| Order | Section | Why |
|---|---|---|
| 1 | Owned photo of **this** place + H1 + breadcrumb to the city | Belonging. Not “Tetherow homes for sale” as a city clone. |
| 1b | **Value my home ask** on the photo (Matt 2026-09-07, site queue SITE-01) | One address field. The visitor types their address and sees this place’s verdict, days to pending, cash share, and comparable-sale count, sourced and dated, with no contact asked. Then email (required) and phone (optional) deliver the written valuation. Never a dollar figure on the page. Renders only where Market Truth publishes a figure for the place. |
| 2 | What this place is | Acreage, golf, lodging, dining, pool/sport — official-site facts from `resort-communities.json`. No invented dues. |
| 3 | Amenity grid | Dining, golf, fitness, trails, dog, pool — Caldera/Tetherow homepages live here. |
| 4 | Houses for sale here | Our moat. tetherow.com has none. Priced listing dials under the map, one per buyer group, not “view listings” links. |
| 5 | Villages / plats inside, with what is moving | Child doors. Heath is a child of Tetherow, not a second Tetherow. |
| 6 | Golf / course (when we have it) | They lead with golf. Hole maps belong with belonging. |
| 7 | Membership / HOA / STR | Perks and hours when known. Never fabricated dollar cards. Published CC&Rs when R7 allows. |
| 8 | One sold/pace answer | Once. |
| 9 | Edges | Trails, Bachelor, Old Mill, vacation-rental vs residential **only when both exist**. Gate/office hours on gated places. |
| 10 | Ask | Alerts for this community. The valuation ask lives in the opening (1b), not here. |

A master-plan page that opens like Bend has already lost to tetherow.com.

---

## Plat — `/subdivisions/…`

**Search to beat:** the plat name plus the parent (neighborhood or resort).

**Job.** The homes on this plat. Parent is obvious. Do not dress four listings in a city hero.

**One dial per property type (Matt 2026-09-23: "we need to see carousels of all available property types if there are any; we haven't been doing commercial and multi family"; then, the same day, "an alternative to a carousel ... a primary card ... a smaller dial with thumbnails of the other photos ... some kind of indicator of how many total cards are in the dial").** The inventory is `V3PlaceInventory layout="dial"`: for each type with active stock, in the order single-family, multi-family, townhomes and condos, land, commercial, one `V3ListingDial`. One listing shows large (its lead photograph, then the rail card's copy: ask, facts, address, a door to the listing), the rest of that type are thumbnails on the dial's rail with no scrollbar (the rail's position varies from type to type, bottom, left, right, so adjacent dials differ), and "03 / 12" with a filling rule heads the dial. A thumbnail the dial's edge cuts through shows its photograph but not its caption, so no price is ever shown cut off. The dial turns by thumbnail, previous/next, arrow keys, Home/End, and a swipe on the photograph on a phone, where the dial becomes a strip under the card. A type with one listing is the card alone, with no dial and no count. An empty type is omitted. Every listing is still an `<a href>` in the served HTML (the cards not showing carry `hidden`), and every listing the ledger would list is in the dial (no photo or no price does not drop it; "Price not published" is the unpriced ask). A commercial lease (MLS PropertyType G) is not for sale, so it is never in a dial or its count. The default ledger rows stay available; the `layout="rails"` card carousel was deleted 2026-09-24 (no place page draws a listing carousel).

**The listing dial, where its rail stands and the card's reel (Matt 2026-09-24).** Every dial on a place page is `V3ListingDial` (`design_system/public/PUBLIC_UI.md` section 3). Its thumbnails stand under the card (`bottom`, the default) or in a column on the card's left or right; Matt does not want every dial on a page to turn the same way, so a page that stacks dials (one per property type, one per buyer group) gives the i-th dial `dialRailPositionAt(i)` and no two adjacent dials share a position. A phone lays every one as a strip under the card. The photograph of the card in front always comes first; when the reader rests on it for 1.5 s with the dial on screen, the dial asks `/api/listings/[listingKey]/card-video` for that listing's walkthrough reel (the listing page's own hero reel, never a 3D tour), and if there is one the card can play silently it fades in over the photograph, muted and looping, with Pause and, for a native video, sound. A turn stops it at once; one reel plays on the page; reduced motion and Save-Data get "Play video" instead of autoplay. Pages never read a card's video when they render: the dial asks for one listing at a time, and a caller that knows a listing has no reel passes `hasVideo: false`. The Jax button rides the screen's right edge mid-screen, so wherever the dial runs under it the controls along that edge stop short of it (a right-hand column, the strip's next step, the phone's "01 / 12", the reel's controls). A card that is not showing is served as its door alone (the link with its ask, facts and street), about 1 KB of HTML per listing (`v3-listing-dial-weight.test.tsx`).

**Commercial space for lease (Matt 2026-09-23).** A place with at least one active commercial lease gets one more section, last, after "Commercial property": "Commercial space for lease", counted "N for lease" and never "for sale", in whatever layout the page uses (the plat's `V3PlaceInventory` rows, rails or dial via its `lease` prop; the homes under the map on city, neighborhood and community pages via `PlaceSubdivisionMap leases`, which follow the map's selection like the homes do). The leases come from the tiles the page already read (`placeLeaseSectionFromTiles` in `lib/place/place-lease-stock.ts`; on a plat also the Atlas's `leaseKeys`, because a lease filed under no subdivision name is found only inside the recorded footprint) and never become map pins or a for-sale count. **The unit rule:** a lease's ListPrice is rent, and its unit is only in the raw payload (`listings.details` key "Lease Rate Options", one of `$ Amt/Mo`, `$ Amt/Yr`, `$/SF/Mo`, `$/SF/Yr`, read by `getLeaseRateOptions`). Each card prints `publishLeaseRate`: the rent with its unit ("$1.40/sq ft/mo", "$2,500/mo"), labelled "For lease", or "Lease rate not published" when the unit is missing, unknown, or contradicted by the number (a per-square-foot rate of $100 or more, or a whole-space amount under $100; nothing on the feed falls between $36 and $325, 2026-09-23). A bare number never prints. The listing's own page prints the long form ("$1.40 per sq ft per month") where a sale prints its ask, and withholds every figure that reads the rent as a sale price. The section ends with one door, "See all commercial space for lease", to [`/commercial-space-for-lease`](SITE_PAGES.md): every active lease in Central Oregon, grouped by town, on the same dial and card.

| Order | Section | Why |
|---|---|---|
| 1 | Name + breadcrumb to neighborhood **or** resort, then city | Hierarchy. |
| 2 | The homes: map if the pins earn it, then one dial per property type | The whole page. Lot lines / taxlots when we have them. |
| 3 | Recorded CC&Rs for this plat | When published. Official resort homepages do not offer this. |
| 4 | Peer plats in the same parent | Other children. |
| 5 | Schools (doors) | Inherited assignment, not a second city schools index. |
| 6 | One sold line if we have it | Once. |
| 7 | Ask | Alerts for this plat. |

Never steal the parent city’s still. Never teach zoom.

---

## Subdivision families — one main page, phases one tap below

Matt 2026-09-23: *"When there are multiple phases in a subdivision, we want all those to go into the same main neighborhood page, and then they can jump into the different phases after that. We do that for Tetherow and Broken Top, but sometimes it's not as crystal clear, so we just want to make sure that that grouping is always happening."* Visibility audit 2026-09-22: SEO-7, SEO-4, EXP-3, EXP-7, VOICE-8, gsc-trend-4.

The county records one place as many plats: Ridge at Eagle Crest is 60 (Ridge At Eagle Crest 5 through 59, three roman phases, three replats), Awbrey Butte Homesites 34, Broken Top 27. A person searches the one name. This is the contract that makes the one name one page.

**The family.** Derived, never curated: `derivePlatFamilies` in [`lib/market/plat-family.ts`](../../../lib/market/plat-family.ts), fed live by `getPlatFamilies` ([`lib/data/subdivisions/getPlatFamilies.ts`](../../../lib/data/subdivisions/getPlatFamilies.ts), 6h cache) from `public.boundaries` (plats, labels, boundary-tree city), `subdivision_plat_closed_mv` (closed counts, filed-sales city), `subdivision_city_inventory_mv` (MLS names) and the registry.

1. Strip each county label to its base: land-use file numbers (`711-21-000260-sub`, `Plld20200979`, `Pz-20-0569`), everything from the first recording marker on (Phase, Unit, Stage, Section, No., Replat, Lots/Blocks/Tract), ordinal "First Addition" wherever it sits, filing tokens (Inc., P.U.D., OLU, SFR), trailing numbers in digits, roman numerals or words.
2. Group by base **and town**. The town is the boundary tree's city first (the plat polygon's parent chain), the town its sales were filed under second. Namesakes in two towns are two families. Plats no town holds group with each other only when no plat of that base has a town.
3. Two or more recorded plats make a family.
4. The family's name is a name somebody recorded: a county label (Tetherow Crossing is itself a plat), a registry community or alias, an MLS subdivision name in that town, or the stem every member label begins with. Never an invented heading.

**The main page.** The registry community page when the community owns the name (`/communities/tetherow`, `/communities/broken-top`, `/communities/northwest-crossing`, `/communities/caldera-springs`, `/communities/eagle-crest`). Otherwise `/subdivisions/{family-slug}` (`/subdivisions/ridge-at-eagle-crest`). When that address already belongs to another recorded place, the family is addressed by name and town: Bend's Aspen Heights (4 phases) is `/subdivisions/aspen-heights-bend`, because `/subdivisions/aspen-heights` is the Aspen Heights plat in Prineville. The one exemption: a base that is a city's own name (the Bend, Redmond and La Pine townsite plats); their main page is the city page, already above them in every trail.

**What the main page carries** (`/subdivisions/{family}`):

| Order | Section | Rule |
|---|---|---|
| 1 | H1 = the recorded family name, breadcrumb to its resort (when the registry files it under one) or city | Owns the head term: indexable, self-canonical, title `{Family} homes for sale · {City}, Oregon`. |
| 2 | The family's homes: map of the union of every phase, the Field | One counted set: single-family, Active and Active Under Contract, inside any phase, each listing once (`getPlatFamilyInventory`). |
| 3 | The phases (`#phases`) | Every recorded phase, a real anchor each, its own lifetime closed count and a trace that says the counts are not added. |
| 4 | One sold line | Every closed sale inside the union of the phases, each sale once (`getPlatFamilyClosedSales`). Never the sum of the phases' counts: a replat's sales also sit inside the phase it replats. |

Indexable when the family's phases together clear the plat floor (10 lifetime closed sales, R-123).

**What a phase page carries** (`/subdivisions/{phase}`): the breadcrumb names the family between the parent and the phase (`Redmond / Eagle Crest / Ridge at Eagle Crest / Ridge at Eagle Crest 36`), the same crumb in the JSON-LD, and a visible sentence under the opening, "One of the 60 recorded phases of Ridge at Eagle Crest", whose link is the family's main page. The title is subordinate, `{Phase} · part of {Family}, {City}`, so the family page is the one bidding for the family's name (gsc-trend-4). A phase keeps its own index slot on the SITE-24 rule (own polygon, 10 or more lifetime sales). County file numbers never reach a title; the legal label stays in the body.

**Who links to whom.**
- A community page lists every phase of the family it owns and links down to every family inside it (Ridge at Eagle Crest from Eagle Crest; Painted Ridge at Broken Top from Broken Top): community, then family, then phase.
- `/subdivisions` is the A to Z directory: every indexable subdivision page and every family, town by town, each family's phases nested under its name, every anchor in the served HTML (`V3PlaceDirectory`). No sitemapped subdivision page is an orphan.
- City pages' `#child-places` rows each carry a real `<a href>` door beside the map-select button. Still name-only, still nothing above the neighborhood bars (SITE-128).

**Not indexable as a subdivision.** A plat whose slug is a city, neighborhood or registry community slug (`/subdivisions/bend`, `/subdivisions/sisters`, `/subdivisions/la-pine` render as noindex, follow; `eagle-crest`, `brasada-ranch`, `mountain-high`, `rivers-edge`, `first-on-the-hill-sites` already 308 in middleware and leave the sitemap).

**Locks.** [`lib/market/plat-family.lock.test.ts`](../../../lib/market/plat-family.lock.test.ts) runs the rule over every recorded plat (the 2026-09-23 snapshot of all 3,427) and fails when any multi-plat group has no single main page, when a phase stops answering to its family's page, or when two places share one address. [`app/subdivisions/[slug]/_v3/plat-family-view.test.ts`](../../../app/subdivisions/[slug]/_v3/plat-family-view.test.ts) pins the link up and the phase list. `ci:plat-families` ([`scripts/check-plat-families.mjs`](../../../scripts/check-plat-families.mjs)) fails when a page stops rendering the link up, the family crumb, the phase index, the community doors or the directory.

---

## Listing (method only — full spec after places)

Same method, different page: audit Zillow Showcase / the best Bend listing URLs, list sections in order, then ours must have those **plus** our broker, our payment (one number, one formula), our place climb, our structured data. First screen is this house’s media with price on it, then one ask. Do not start that rebuild until this place spec is live on one neighborhood and one resort.

---

## Data on the page (how it is organized)

We have the data. The failure is dumping it.

Wrong: a hero of `679` / `$950,000` / `3.9` / `23` / `−5.2%`, then a caption that repeats the counts, then a market block that repeats them again.

Right: each section owns one question.

| Section | The number’s job |
|---|---|
| Houses | Pins and rows. The count is the list you can see, not a headline statistic. |
| Child plats | Which plats are moving. Bars or a small comparison, not a percent in a tile. |
| Pace | One chart or one sentence: how long homes here are taking. |
| Sold | One median or one slope, sourced. |
| Daily life | Names of schools, parks, trails. Not a “walkability %.” |

If a figure does not belong to a section above, it does not print. Exception ink (`−5.2%`) only appears on a decline that the section is actually about.

## Landing pages go away

Place pages have to be good enough that an ad can land on them. That is the quality bar, not a second URL.

| Today | Tomorrow |
|---|---|
| `/lp/tetherow` (Playfair, KPI tiles, no primary nav) | `/communities/tetherow` |
| `/lp/tetherow/heath` | Tetherow’s child plat / village page |
| `/lp/bend` | `/cities/bend` |

301 the old paths. Do not rebuild the LP kit “a little nicer.” Capture (alerts, Value my home, tour) already lives on the real pages as one Sheet. If an ad needs a UTM, the place URL takes UTMs. It does not need a fork of the site.

## How we stop the loop

1. This file is the section list. Changing a section means changing this file in the same commit.
2. Build **one neighborhood** (Old Bend or Riverwest) and **one resort** (Tetherow) to this order. Show Matt the two URLs. Then clone the class to every other member.
3. Kill the atlas how-to sentence on every grain in the same pass as the first build.
4. Do not restyle Bend, Tetherow, and a plat to share a first screen again.
5. Competitive audit is per grain, once, written under each heading above. Re-run it when a competitor page changes, not every session.

Tests that currently freeze “Bend’s first fold is the leftover face + split” are tests of the trap. When this spec ships, those tests move with it.
