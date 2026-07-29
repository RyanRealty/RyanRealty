# Search Optimization Plan — Flexmls teardown → ryan-realty.com search parity-plus

**Date:** 2026-07-29 (rev 2, same day — upgraded to execution grade: coverage audits run,
baseline stamped, acceptance criteria + UX spec added, decisions converted to
recommendations) · **Status:** execution-ready plan, no code yet · **Owner:** search/site
**Sources:** live walkthrough of Flexmls Web (ore.flexmls.com, Matt's account, 2026-07-29) ·
full codebase inventory (agent sweep, same day) · coverage audits over live `listings`
(key presence n=40; per-field coverage + value profiles n=1000 active; mask forensics
joined to `listing_private`) · baseline queries over `listing_alerts` + `user_events`.

Matt's directive: review how Flexmls uses the map to generate saved searches / listing
emails to clients, expose ALL filters for super-granular results, and produce the plan that
takes our on-site search past it. This doc is the baseline. Research first (§1–§3), plan
second (§4).

---

## 1. How Flexmls does it (observed live, Matt's ORE account)

### 1.1 Search architecture

- **Templates per property class.** Quick Search opens a template (Matt's default: "1 -
  Residential"). A template is an ordered checklist of ~34 fields; checking a field expands
  its editor inline and adds it to the query. Templates are user-editable (Preferences →
  Quick Search Templates).
- **The template is only the starting set.** An **"Add a Field"** button opens the full MLS
  field dictionary — ~45 categories, every RESO + ORE custom field, searchable by name
  ("Find a field"). Any field in the dictionary can join the query. This is the "expose all
  filters" model: default simplicity, unlimited depth on demand.
- **Category-level or value-level.** In the dictionary, a "+" adds the whole category as a
  multi-select filter; clicking a single value adds the field pre-filtered to that value.
- **Live result count** ("View Results: 4,691") updates as filters change; the count is a
  click-through to List/Map.
- **Draft autosave.** Edits autosave ("Draft last saved: 7/29/2026 5:12 AM") — an
  in-progress search survives navigation.
- **"Additional Search Options"** (media/meta): has Pictures, Floor Plans, Videos,
  Documents, Virtual Tours, Public Open House Date, within/not-within Listing Collection.
- **Omnibox**: one global input accepts Address, City, ZIP, MLS#, or Contact.
- **Work on behalf of a client:** the whole search UI can run in a client context
  ("Work on behalf of …"), so results/emails carry that client's lens.

**Template "1 - Residential" default fields (in order):** Commonly Known Address · Status
(default Active + Active w/Contingency + Active Short Sale) · Property Sub Type · County ·
City · Postal Code · Subdivision Name · Section · Current Price · Bedrooms Total ·
Bathrooms Total · Bathrooms Full · Bathrooms Half · Main House SqFt · Total Living Area
SqFt · Lot Size Acres · Year Built · Zoning · Levels · Accessory Dwelling Unit YN · Short
Term Rental Permit YN · CC&R's YN · Association YN · Senior Community YN · Horse Property
YN · Garage YN · Garage Spaces · Irrigation Water Rights YN · Listing/Selling Member ·
Listing/Selling Office · Public Remarks · Private Remarks · List Price per SqFt · Sold
Price per SqFt.

### 1.2 Status + date-range model

Status is a 9-value multi-select: Active, Active w/Contingency, Active Short Sale, Coming
Soon, Pending, Closed, Expired, Withdrawn, Cancelled. "See All and Select Date Ranges"
expands **Off Market Dates** — a per-status date window (checkbox + from/to + swap): Under
Contract Date, Close Date, Expiration Date, Withdrawn Date, Cancellation Date. This is how
"Closed in the last 12 months" or "Expired since June" is expressed. Sold search carries
the same filter depth as active search — nothing is disabled by status.

### 1.3 The map system (the heart of the request)

Right-hand live map with:

- **Draw tools:** rectangle, **circle (radius — live mile readout while dragging, e.g.
  "30.07 mi")**, freeform polygon, plus pan, zoom-to-results, identify, measure, address
  pin. Multiple shapes can coexist; each drawn shape becomes part of the search's
  geography ("Inside the map search Polygon" appears in the saved params — the Langevin
  subscription carries TWO polygons). A zero-radius click is rejected with a clear error.
- **Dynamic overlays:** Listings (pins) and Drawn Shapes toggles.
- **MLS GIS overlay layers (16):** City Limits, Counties, Enterprise Zones, Flood Zones,
  Imagery Parcels, Land Ownership, School Districts, Sections, State Parks, Subdivisions,
  Townships, Tsunami Regulatory, Urban Growth Boundary, Wetlands, Wildlife Units, Zip
  Codes. These render as reference layers while drawing.
- **My Map Overlays — named, reusable, shareable custom geography.** Matt has three: "Bend
  West Side", "Old Bend", "River West". An overlay is a named collection of drawn shapes
  with manager verbs NEW / EDIT / RENAME / REMOVE / **GIVE TO SOMEONE** (share to another
  member) and an Options & Permissions panel with **"Public Access (for IDX & Portals)"**
  — i.e. a hand-drawn neighborhood becomes first-class searchable geography on the
  agent's website and client portals. The search box accepts overlays by name ("MLS #,
  address or map overlay" + Browse).

The key insight: **geography is a saved, named, composable asset** — not a transient
viewport. A "search" = filters + any number of named/drawn shapes.

### 1.4 Saved searches

Save menu: **Save Search** (New / update Existing, Mark as Favorite, Name, Description,
attach Contact: None / New (inline create) / Existing) · **Set as Default Search** ·
**Activate IDX** (push this search onto the agent's IDX site). Saving with a contact
offers **"Save and Add Subscription"** in the same motion. Saved Searches also live as a
top-level list (Search → Saved Searches).

Per-contact, each saved search exposes **"view new" semantics**: View all · View new in
the last 24 hours · View new since <last-reset timestamp> · Reset time. "New" is defined
as **new listings + price changes + status changes**.

### 1.5 Contacts + subscriptions (the listing-email engine)

Contact Management list shows per-contact: **Activity bar (last 7 days)**, **Portal
ON/OFF**, phone, email. The contact card shows: email opt-in status ("Confirmed"), last
email activity, Reverse Prospecting flag, **Email Activity counters** (Subscription
Viewed: 122 / Manual / Viewed), **Listings to Approve: 0**, **Listings Automatically
Sent: 294**.

A **Subscription** (Edit Subscription screen) =

| Setting | Options observed |
|---|---|
| Recipients | multi-contact chips (Jim + Lisa on one subscription), Add New Contact inline |
| Notify | ☑ You (sender) · ☑ Selected contacts |
| Engagement ping | ☑ "Send me an email when a contact clicks the link" |
| **Preview Mode** | ☐ — when on, listings queue for agent approval before sending (the "Listings to Approve" counter) |
| Schedule | **ASAP** (instant) · **Weekly** (per-day-of-week checkboxes Sun–Sat) · **Monthly** |
| Email content | Template dropdown + "Save as New", Subject (default "We found new listings matching your home search"), TinyMCE rich-text body with photo insertion |

The **Subscriptions hub** (Contacts → Subscriptions) lists all subscriptions with tabs
**Active (7) / Inactive / Agent Only / Listing Activity Events**, filter-by-search, sort.
Matt's live examples: "Bend ADUs under 1M" and "Bend Multi-Family" → Nate Hon — granular
saved searches driving client email. "Agent Only" = prospecting feeds that email only the
agent.

**Portal preferences → Default Subscription Settings** define the event taxonomy every
subscription inherits (toggles): **New ✓ · Price Change ✓ · Sold ✓ · Open House ✗ ·
Pending ✓ · Back On Market ✗ · Extension ✗ · Status Change ✓**, plus "Use inherited
defaults". Other portal sections: Intro, Portal Basics, Profile Card, Featured Listings,
IDX Lead Generation, Intro Email, News Feed, Listing Content Options, Emailed Listing
Links.

### 1.6 The complete Flexmls field dictionary (ORE dataset, captured 2026-07-29)

Categories and values as exposed in "Add a Field" (values abridged only where noted —
each category below was captured in full):

- **Accessibility Features:** Accessible Approach with Ramp, Bedroom, Closets, Doors,
  Entrance, Full Bath, Hallway(s), Kitchen, Grip-Accessible Features, Lifelong Housing
  Certification, Smart Technology
- **Activities:** Broker Open House Date, Public Open House Date
- **Appliances:** Cooktop, Dishwasher, Disposal, Double Oven, Dryer, Instant Hot Water,
  Microwave, Oven, Range, Range Hood, Refrigerator, Solar Hot Water, Tankless Water
  Heater, Trash Compactor, Washer, Water Heater, Water Purifier, Water Softener, Wine
  Refrigerator, Other
- **Architectural Style:** A-Frame, Bungalow, Chalet, Colonial, Contemporary, Craftsman,
  Log, Northwest, Prairie, Ranch, Traditional, Tudor, Victorian, Other
- **Association Amenities:** Airport/Runway, Clubhouse, Firewise Certification, Fitness
  Center, Gated, Golf Course, Landscaping, Marina, Park, Pickleball Court(s), Playground,
  Pool, Resort Community, Restaurant, Road Assessment, RV/Boat Storage, Security, Sewer,
  Sewer Assessment, Snow Removal, Sport Court, Stable(s), Tennis Court(s), Trail(s),
  Trash, Water, Other
- **Basement:** Daylight, Exterior Entry, Finished, Full, Partial, Unfinished, None
- **Body Type** (manufactured): Single Wide, Double Wide, Triple Wide, Quad Wide, Park
  Model, Other
- **Buyer Financing** (closed): Assumed, Cash, Contract, Conventional, FHA, FHA 203(b),
  FHA 203(k), FMHA, Private, Seller Financing, Trade, Trust Deed, USDA, VA, Other
- **Common Walls:** 1 Common Wall, 2+ Common Walls, End Unit, No Common Walls, No One
  Above, No One Below
- **Community Features:** Access to Public Lands, Gas Available, Park, Pickleball,
  Playground, Pool, Road Assessment, Sewer Assessment, Short Term Rentals Allowed, Short
  Term Rentals Not Allowed, Sport Court, Tennis Court(s), Trail(s)
- **Construction Materials:** Block, Brick, Concrete, Double Wall/Staggered Stud, Frame,
  ICFs, Log, Rammed Earth, Steel Frame, Straw, Structural Insulated Panels, Unknown
- **Contract Information:** Original List Price, Current Price, Status, List Price, List
  Price per SqFt, Listing Contract Date, Projected Active Date, Expiration Date 🔒,
  Agency Represent YN, Listing Agreement, Comp Sale YN
- **Cooling:** Central Air, Ductless, ENERGY STAR Qualified Equipment, Evaporative
  Cooling, Heat Pump, Wall/Window Unit(s), Whole House Fan, Zoned, None, Other
- **Documents:** CC&Rs, Floor Plans, HOA Documents, Lead Based Paint, Seller's Property
  Disclosure
- **Easements:** Access, Conservation, Irrigation, Utilities, View, Well, Other
- **Exterior Features:** Built-in Barbecue, Courtyard, Dock, Fire Pit, Gray Water System,
  Outdoor Kitchen, Rain Barrel/Cistern(s), RV Dump, RV Hookup, Spa/Hot Tub, UIC
  Registered, UIC Rule Authorized
- **Fireplace Features:** Electric, Family Room, Gas, Great Room, Insert, Living Room,
  Office, Outside, Primary Bedroom, Propane, Wood Burning
- **Flood:** Plain, Way, N/A, Unknown
- **Flooring:** Bamboo, Carpet, Concrete, Cork, CRI Green Label Plus Certified Carpet,
  Hardwood, Laminate, Simulated Wood, Stone, Tile, Vinyl, None, Other
- **Foundation Details:** Block, Brick/Mortar, Concrete Perimeter, Pillar/Post/Pier, Slab,
  Stemwall, Stone, None, Other
- **General Property Information** (~40 fields): Property Sub Type, Bedrooms Total,
  Bathrooms Total/Full/Half, Garage YN, Garage Spaces, Total Living Area SqFt, Main House
  SqFt, SqFt Source, Below Grade Finished Area (+Units/Source), Year Built, **Accessory
  Dwelling Unit YN, ADU Type, ADU SqFt, ADU Permitted YN**, Owner Name, Occupant Type,
  Occupant Name, Phone to Show (+Number), Rented YN, Current Rent, Lease End Date, **Short
  Term Rental Permit YN**, New Construction YN, Building Permit Issued YN, Building Permit
  #, Estimated Completion Date, Builder Name, Elementary/Middle/High School, Zoning, Tax
  Annual Amount, Tax Year, Potential Tax Liability YN, Assessment YN, **Irrigation Water
  Rights YN, Irrigation Water Rights Acres, Irrigation District**, CC&R's YN, Association
  YN, Association Fee (+Frequency, Fee 2), Senior Community YN, Horse Property YN,
  Preferred Escrow Company, FIRPTA YN, Sign On Property YN, Audio/Video Surveillance on
  Premises YN
- **Government Overlay:** Airport Zone, Enterprise Zone, Foreign Trade, Opportunity Zone,
  Urban Renewal, Wetlands
- **Green Building Verification:** Energy Performance Score, Earth Advantage, Energy
  Audit Retrofit, ENERGY STAR Certified Homes, LEED For Homes, Home Energy Score, Green
  Verification Metric/URL/Year, WaterSense, Other
- **Heating:** Baseboard, Ductless, Electric, ENERGY STAR Qualified Equipment,
  Fireplace(s), Forced Air, Geothermal, Heat Pump, Hot Water, Natural Gas, Oil, Pellet
  Stove, Propane, Radiant, Solar, Wall Furnace, Wood, Zoned, None, Other
- **Inclusions/Exclusions:** Inclusions, Exclusions
- **Interior Features:** Bidet, Breakfast Bar, Built-in Features, Ceiling Fan(s), Central
  Vacuum, Double Vanity, Dry Bar, Dual Flush Toilet(s), Elevator, Enclosed Toilet(s),
  Fiberglass Stall Shower, Granite Counters, High Speed Internet, In-Law Floorplan,
  Jetted Tub, Kitchen Island, Laminate Counters, Linen Closet, Open Floorplan, Pantry,
  Primary Downstairs, Shower/Tub Combo, Smart Light(s), Smart Lock(s), Smart Thermostat,
  Soaking Tub, Solar Tube(s), Solid Surface Counters, Spa/Hot Tub, Stone Counters, Tile
  Counters, Tile Shower, Vaulted Ceiling(s), Walk-In Closet(s), WaterSense Fixture(s),
  Wet Bar, Wired for Data, Wired for Sound
- **Irrigation Source:** Creek, District, Lake, On Site Well, Pond, River, Spring, None
- **Levels:** One, Two, Three Or More, Multi/Split
- **Listing Terms** (active): Assumable, Cash, Contract, Conventional, FHA, FMHA, Owner
  Will Carry, Private Financing Available, Trade, Trust Deed, USDA Loan, VA Loan
- **Location, Tax, and Legal:** Days On Market, Cumulative DOM, full street-address parts
  (Number, Modifier, Dir Prefix/Suffix, Name, Suffix, Unit), County, City, State, Postal
  Code, Zip+4, Commonly Known Address, Cross Street, Section, Subdivision Name, Parcel
  Number, Tax Map Number, Tax Lot, Tax Block, Lot Size Acres, Lot Size Square Feet,
  Additional Parcels YN/Description, Legacy Pcl #
- **Lot Features:** Adjoins Public Lands, Corner Lot, Drip System, Fenced, Garden,
  Landscaped, Level, Marketable Timber, Native Plants, On Golf Course, Pasture, Rock
  Outcropping, Sloped, Smart Irrigation, Sprinkler Timer(s), Sprinklers In Front,
  Sprinklers In Rear, Water Feature, Wooded, Xeriscape Landscape
- **Media:** Documents, Floor Plans, Pictures, Videos
- **Member:** Listing/Selling Association, Company, Member, Office
- **Other Structures:** Airplane Hangar, Animal Stall(s), Arena, Barn(s), Corral(s),
  Covered Arena, Existing Hardship, Gazebo, Greenhouse, Guest House, Kennel/Dog Run,
  Mobile Home, Outhouse, Poultry Coop, RV/Boat Storage, Second Garage, Second Residence,
  Shed(s), Stable(s), Storage, Workshop, Other
- **Parking Features:** Alley Access, Asphalt, Assigned, Attached, Attached Carport,
  Concrete, Detached, Detached Carport, Driveway, EV Charging Station(s), Garage Door
  Opener, Gated, Gravel, Heated Garage, No Garage, On Street, Paver Block, Permit
  Required, RV Access/Parking, RV Garage, Shared Driveway, Storage, Tandem, Workshop in
  Garage, Other
- **Patio and Porch Features:** Awning(s), Covered, Covered Deck, Deck, Enclosed, Front
  Porch, Glass Enclosed, Patio, Porch, Rear Porch, Screened, Side Porch, Terrace, Wrap
  Around, None, Other, See Remarks
- **Pool Features:** Above Ground, Association, Black Bottom, Cabana, Community, Diving
  Board, Electric Heat, ENERGY STAR Pool Pump, Fenced, Fiberglass, Filtered, Gas Heat,
  Gunite, Heated, In Ground, Indoor, Infinity, Lap, Liner, Outdoor Pool, Pool Cover, Pool
  Sweep, Pool/Spa Combo, Private, Salt Water, Screen Enclosure, Solar Cover, Solar Heat,
  Sport, Tile, Vinyl, Waterfall, None, Other, See Remarks
- **Power Production:** Generator, Hydro, Solar Leased, Solar Owned, Solar PV Ready,
  Wind, None
- **Remarks and Miscellaneous:** Public Remarks, Private Remarks, Showing Instructions,
  Directions, Assessment Comments, Leased Components
- **Road Frontage Type:** Easement, Private Access, Shared Access, Other
- **Road Surface Type:** Cinder, Dirt, Gravel, Paved, Other
- **Roof:** Asphalt, Built-Up, Composition, Membrane, Metal, Rolled/Hot Mop, Rubber,
  Shake, Slate, Tile
- **Rooms:** Bonus Room, Breakfast Nook, Dining Room, Eating Area, Enclosed Porch/Patio,
  Family Room, Great Room, Jack and Jill Bath, Kitchen, Laundry, Living Room, Loft, Media
  Room, Mud Room, Office, Primary Bedroom, Sauna, Second Primary, Solarium, Sunroom, Other
- **Security Features:** Carbon Monoxide Detector(s), Fire Sprinkler System, Security
  System Leased/Owned, Smoke Detector(s), Other
- **Sewer:** Alternative Treatment Tech System, Capping Fill, District, Holding Tank,
  Perc Test On File, Perc Test Required, Private Sewer, Public Sewer, Sand Filter, Septic
  Needed, Septic Tank, Standard Leach Field, None, Other
- **Showing Requirements:** 24 Hour Notice, Appointment Only, Call Listing Agent, Call
  Owner, Call Tenant, Combination Lock Box, Day Sleeper, Key In Office, Listing Agent
  Must Accompany, Lockbox, Lockbox CBS Code Required, No Appointment/Call Needed, Pet(s)
  on Premises, Security System, Text Listing Agent, To Be Built, Under Construction, See
  Showing Instructions
- **Special Listing Conditions:** Auction, Bankruptcy Property, Conservatorship, HUD
  Owned, In Foreclosure, Notice Of Default, Probate Listing, Real Estate Owned, Short
  Sale, Standard, Third Party Approval, Trust, Ownership Interest Type
- **Status Change Information:** Concessions Amount/YN/Comments, Close Date 🔒, Under
  Contract Date 🔒, Back on Market Date, Status Change Timestamp, Withdrawn Date 🔒,
  Cancellation Date 🔒, Contingency, Close Price, Sold Price per SqFt
- **Structure Type:** Cabin, Dock, House, Manufactured House, Mixed Use, None
- **Utilities:** Cable Available/Connected, Electricity Available/Connected, Fiber Optics
  Available, Natural Gas Available/Connected, Phone Available/Connected, Propane, None,
  Other
- **View:** Bay, Beach, Canyon, Cascade Mountains, City, Creek/Stream, Desert, Forest,
  Golf Course, Lake, Mountain(s), Neighborhood, Ocean, Orchard, Panoramic, Park/Greenbelt,
  Pond, Ridge, River, Territorial, Valley, Vineyard
- **Virtual Tours:** Has Virtual Tour
- **Water Source:** Backflow Domestic, Backflow Irrigation, Cistern, Private, Public,
  Shared Well, Spring, Water Meter, Well, None, Other
- **Waterfront Features:** Creek, Lake Front, Ocean Front, Pond, River Front, Stream,
  Waterfront
- **Window Features:** Aluminum Frames, Bay Window(s), Double Pane Windows, ENERGY STAR
  Qualified Windows, Fiberglass Frames, Garden Window(s), Low-Emissivity Windows,
  Skylight(s), Storm Window(s), Tinted Windows, Triple Pane Windows, Vinyl Frames, Wood
  Frames

🔒 = restricted (broker-only) fields.

---

## 2. What we have today (inventory summary, verified 2026-07-29)

Full detail lives in the code; highlights that matter for the gap analysis:

- **One real search app** at [/homes-for-sale](https://ryan-realty.com/homes-for-sale)
  (`app/search/page.tsx`, split/list/map) + an SEO route
  `app/search/[...slug]/page.tsx` (`/homes-for-sale/{city}[/{area}][/{preset}]`, 40
  presets, indexation gated by `lib/seo/search-matrix.ts`).
- **Field registry** [`lib/search/field-registry.ts`](../../lib/search/field-registry.ts):
  **88 fields** (11 range · 33 boolean · 39 multi · 5 text) in 16 categories — single
  source of truth for URL params, the All-Filters sheet, voice/NL parsing
  (`lib/parse-search-query.ts`), and the saved-search whitelist. Serving view:
  `listing_search_mv` (~100 columns incl. 36 RESO `text[]` feature arrays via
  `rr_feature_keys(jsonb)`, weighted `search_vector`, promoted scalars).
- **DAL:** `searchListingsAll` / `searchListingsAllCount`
  ([`lib/data/listings/searchListingsAll.ts`](../../lib/data/listings/searchListingsAll.ts))
  — zod-validated filter schema, resilient cache, boolean predicate table, keyword
  AND-of-words over remarks OR full-text.
- **Map:** Google Maps + clusterer, freehand **polygon** draw. Polygon is evaluated
  **in Node** (bbox → Postgres, ray-cast point-in-polygon in
  `lib/map-polygon.ts`), overfetch cap 1000, split-view display cap 500. Boundaries
  live in PostGIS (`public.boundaries`, geo_types city/neighborhood/subdivision/park/
  school_district) with precomputed membership (`listing_boundary_xref_mv`). **No radius
  search. No named/saved custom shapes. Polygon not URL-persisted on the split view**
  (only the SEO route round-trips `?poly=`).
- **Alerts:** unified `public.listing_alerts` (email + user + crm_person, jsonb filters +
  hash dedupe, cadence instant/daily/weekly/monthly, unsubscribe token, origin
  user/broker/system) → cron `/api/cron/saved-search-alerts` → cadence + compliance gates
  (`isHardStopped`, suppression) → Resend send with broker identity + attribution +
  `recordEmailEvent`. Entry points: SaveSearchButton, guest SearchAlertCapture, buyer-LP,
  community alerts, CRM bulk-assign, admin subscriptions hub.
- **Known deficiencies flagged in the sweep:** two divergent filter UIs (the SEO route's
  `AdvancedSearchFilters` exposes ~23 fields, not the 88-field sheet); sold/closed search
  bypasses the MV and loses nearly all filter depth; beds/baths max-bounds have no UI;
  `laundryFeatures` registers 0 options (dead); stale docs (`docs/ADVANCED_SEARCH.md`,
  `DATABASE_FOR_AI_AGENTS.md` §2h still describe superseded architecture); registry says
  88 while the contract doc reportedly says 89 — reconcile.
- **Data availability — the three-layer truth (rev 2.2, all layers verified).**
  **Layer 1 — already on disk AND mostly already searchable (the bulk of the
  dictionary):** the RESO multi-select categories live as structured feature objects
  in `details`, one field per record, and the MV's 36 arrays + 88-field registry
  already serve them. Verified n=1000 active: LotFeatures 779 · InteriorFeatures 551 ·
  SecurityFeatures 527 · OtherStructures 337 · CommunityFeatures 319 — including
  `Short Term Rentals Allowed` true on 88 and `Not Allowed` on 67, meaning the
  existing `strAllowed` filter works TODAY. Roughly 34 of the ~45 Flexmls categories
  are in this layer. The gap for these is exposure/UX, not data.
  **Layer 2 — in the feed but not in our DB (CustomFields-only):** verified 0/1000
  structured in `details`: ADU YN/Type/SqFt/Permitted, Short Term Rental **Permit** YN
  (distinct from the community allowed-flag), CC&R's YN, Zoning (SF-masked), Flood,
  Government Overlay, Easements, Irrigation District, Rooms, Documents, Power
  Production, Green verification. Live Spark probes with our credentials
  (`_expand=CustomFields`) returned all of these with real values:
  `Accessory Dwelling Unit YN`, `Short Term Rental Permit YN`, `CC&R's YN = "Yes"`,
  `Zoning = "RM"`, `Flood`, `Government Overlay` observed live. **Our sync never
  requests the expansion** — [`lib/sync/deltaSync.ts`](../../lib/sync/deltaSync.ts)
  expands `Photos` only. `ZoningDescription` is real even at the SF level ("RM",
  "A-1"); whether Topography/WaterBodyName have CF mirrors gets one probe during the
  ingest build.
  **Layer 3 — remarks text:** STR phrasing appears in 156/1000 rows, CC&R in 50 —
  keyword-searchable today as the interim for Layer-2 fields.
  Stored-scalar coverage (n=1000): `PreviousListPrice` 43% · `VirtualToursCount>0`
  19% · `VideosCount>0` 12.1% · `FloorPlansCount>0` 11.9% · `BodyType` 8.9% ·
  `IrrigationWaterRightsAcres` 4.6%.
  **Compliance requirement discovered by the CF probe:** CustomFields carries
  confidential data (`Owner Name`, `Phone to Show Number`, escrow officer). The CF
  ingest MUST extend the `PRIVATE_DETAIL_KEYS` redaction to the CF spellings and
  divert them to `listing_private` before anything lands in the anon-readable column.
- **Instrumentation gap (baseline query 2026-07-29):** `user_events` last 30 days =
  1,224 events across 139 sessions, but only two types fire (`page_view` 1,154,
  `listing_view` 70). **Zero search events** — filter applies, map draws, saves, and
  alert signups are untracked. "Optimized" cannot be measured until this is fixed
  (Phase 0.5).

---

## 3. Gap analysis — Flexmls vs ryan-realty.com

| Capability | Flexmls | Us today | Gap class |
|---|---|---|---|
| Filter depth | ~45 categories, every field addable | 88 registry fields on ONE route | Medium — we cover most consumer-relevant facets; missing ~15 categories (below) |
| Progressive disclosure | template → add-any-field | chip bar → All-Filters sheet | Parity in shape; our sheet is registry-capped |
| Field search ("Find a field") | yes | no | Small, high leverage |
| Live count while editing | yes | yes (debounced, rate-limited) | Parity |
| Status model | 9 statuses + per-status date ranges | active/pending/sold, thin sold filters | **Large** |
| Radius search | yes, live mile readout | none | **Large** |
| Polygon search | multi-shape, server-side | single shape, Node-side, cap-bounded | Medium |
| Named saved geography | My Map Overlays + share + IDX-public | none (boundaries are system-owned) | **Large** |
| GIS reference layers | 16 MLS layers | boundaries (5 geo_types) render-only | Medium |
| Exclude-shape / NOT geography | include model w/ multiple shapes | include-only | Small |
| Saved search → contact | first-class, inline contact create | listing_alerts (email/crm link) | Parity-ish |
| Subscription events | New, Price Δ, Sold, Open House, Pending, Back-on-Market, Extension, Status Δ (toggles) | new-match only (hash of result-set keys) | **Large** |
| Cadence | ASAP / weekly per-day / monthly | instant / daily / weekly / monthly | Parity-ish (no per-day-of-week) |
| Preview/approve before send | Preview Mode + approval queue | none | Medium |
| Multi-recipient subscription | yes (household) | one email per row | Small |
| Click-engagement ping to agent | yes | recordEmailEvent exists; no agent ping | Small |
| Email templates | TinyMCE + saved templates | fixed React email | Small (brand-wise ours is better) |
| Client portal | portal w/ activity tracking, approve/sent counters | /account + /dashboard exist | Medium — ours is younger but web-native |
| "New since last viewed" | per-search reset semantics | notified_keys dedupe (send-side only) | Medium |
| Agent-only prospecting feeds | "Agent Only" subscriptions | admin views only | Small |
| Work on behalf of client | yes | no | Not needed v1 |
| Search by member/office | yes | no (by design, consumer site) | n/a |
| Draft autosave | yes | URL is the state (sharable) | Parity (different philosophy) |
| NL / voice search | none | yes (voice + parser) | **Our lead** |
| Payment-based search (PITI) | none | monthlyPaymentMax | **Our lead** |
| SEO surface area | none (walled) | 40-preset matrix, boundaries, schools | **Our lead** |
| CRM integration | separate product | native crm_people + sequences | **Our lead** |

---

## 4. The plan

Ordering follows THE LOOP: each phase is a shippable class-fix with a gate; measurement
stamps close each phase. **No code in this doc — each phase becomes loop iterations.**

### Phase 0 — One search, one truth (foundation, unblocks everything)

1. **Kill the two-UI split.** `AdvancedSearchFilters` (SEO route) either renders the same
   registry-driven sheet as `/homes-for-sale` or is deleted in favor of the shared
   components. One filter surface, one URL-param contract (`ALL_SEARCH_URL_PARAMS`).
2. **Persist drawn geography everywhere.** `?poly=` round-trip on the split view (it
   already exists on the SEO route) so any drawn search is sharable/bookmarkable — the
   precondition for saving map-based searches.
3. **Reconcile the 88-vs-89 registry count** against the CONTRACT doc; fix whichever is
   wrong. Delete or backfill `laundryFeatures`.
4. **Docs debt:** rewrite `docs/ADVANCED_SEARCH.md`, fix `DATABASE_FOR_AI_AGENTS.md` §2h
   (saved_searches → listing_alerts).
5. **Instrument search.** New `user_events` types: `search_filter_apply` (payload:
   changed params), `search_map_draw` (shape type), `search_save`, `alert_create`,
   `search_zero_results`. Fired from the shared filter components so both routes emit
   identically.
6. **Gate:** extend the existing parity/registry tests — a search-filter component that
   does not source the registry fails CI; `?poly=` round-trip gets a test.

**Phase 0 acceptance:** (a) the SEO route renders the identical registry sheet —
`AdvancedSearchFilters.tsx` deleted or reduced to a wrapper; (b) drawing a polygon on
`/homes-for-sale`, reloading, and sharing the URL reproduces the exact shape + results;
(c) registry count matches the contract doc and `laundryFeatures` resolved either way;
(d) `search_filter_apply` events visible in `user_events` from both routes in prod;
(e) both stale docs corrected.

### Phase 1 — Filter depth: close the dictionary gap (super-granular results)

The coverage audit is **done** (2026-07-29, n=1000 active; §2). The backlog below carries
the numbers; §0 rule stands for any future field: no filter ships that matches nothing.

1. **Ship-now tranche (real values verified in `details` / `listings`):**

   | Filter | Source | Coverage | Registry type |
   |---|---|---|---|
   | Has virtual tour ≥, has video, has floor plan | `VirtualToursCount/VideosCount/FloorPlansCount` | 19% / 12.1% / 11.9% | boolean ×3 |
   | Previous list price (price-cut depth) | `PreviousListPrice` | 43% | derived range (supplements existing `priceReduced`) |
   | Manufactured body type | `BodyType` | 8.9% | multi (Single/Double/Triple Wide, Park Model) |
   | Irrigation acres | `IrrigationWaterRightsAcres` | 4.6% (land/farm segment) | range |
   | Spa/hot tub | `listings.spa_yn` (already promoted) | promoted col | boolean |
   | Fencing | `listings.fencing` | promoted col | multi |
   | Carport | `listings.carport_yn/spaces` | promoted col | boolean+range |
   | Total parking | `listings.parking_total` | promoted col | range |
   | Stories | `listings.stories_total` | promoted col | range (complements `levels`) |
   | Fireplaces count | `listings.fireplaces_total` | promoted col | range |
   | Home warranty | `listings.home_warranty_yn` | promoted col | boolean |
   | Walk score | `listings.walk_score` | promoted col | range |
   | Photo count ≥ N | `listings.photos_count` | promoted col | range |
   Each lands as: MV column (where not already exposed) + registry entry with `voice`
   synonyms + All-Filters sheet render (automatic) + saved-search whitelist (automatic
   via `ALL_SEARCH_URL_PARAMS`).
2. **CustomFields ingest — the headline tranche, fully in our control (rev 2.1
   correction: NO external request needed).** Live probes proved the whole Flexmls
   dictionary — ADU YN/Type/SqFt/Permitted, STR Permit YN, CC&R's YN, Zoning, Flood,
   Government Overlay, Easements, Irrigation District, Rooms, Green certs — arrives on
   our existing credentials via `_expand=CustomFields`, which the sync never requests
   (`deltaSync.ts` expands Photos only). Work items:
   (a) extend the delta sync to request + store CustomFields (flattened into `details`
   under their CF names, or a sibling jsonb column — decide at build);
   (b) **extend the privacy redaction first**: CF carries Owner Name, Phone to Show
   Number, escrow officer — add CF spellings to `PRIVATE_DETAIL_KEYS` and divert to
   `listing_private`, mirrored in the SQL `rr_private_keys()`; a CF ingest without
   this is a §0-class privacy regression and must not ship;
   (c) backfill re-pull for on-market rows (bounded: ~10K listings), then promote to
   `listing_search_mv` + registry: **`adu` boolean, `strPermit` boolean, `ccrs`
   boolean, `zoning` text, `flood` multi, `governmentOverlay` multi, `easements`
   multi, `irrigationDistrict` text, `roomsList` multi** with a coverage stamp each;
   (d) "Bend ADUs under 1M" becomes expressible — recreate it as the first in-house
   broker alert (Phase 3 tie-in).
   Only remaining external question: whether SF-masked `Topography`/`WaterBodyName`
   have CF mirrors — checked during (a) with one probe on a waterfront listing; only
   if absent does a narrow ORE/FBS ask exist.
3. **Sold-search depth.** Route closed searches through the same registry pipeline: add
   close-date window, sold-price range, buyer-financing, concessions, sold-$/sqft
   (columns already exist: `buyer_financing`, `concessions_amount`,
   `close_price_per_sqft`). Requires a closed-rows serving path (separate MV or partition
   of `listing_search_mv` — ODS display rules apply: sold data is VOW/registered-user
   territory per [reference_ods_rules]; gate visibility accordingly).
4. **Status model.** Expose Coming Soon (registered users; public exposure stays blocked
   per the no-public-coming-soon gate), Withdrawn/Expired/Cancelled for
   admin/prospecting surfaces only (expired-listing pipeline already consumes these).
5. **"Find a filter" search box** inside the All-Filters sheet (fuzzy over registry keys,
   labels, voice synonyms — the synonym map already exists).
6. **Gate:** registry↔MV column existence check (already exists via tests) + a new
   coverage gate: every registry field must prove ≥1 live match at ship time or carry an
   explicit `coverageNote`.

**Phase 1 acceptance:** (a) every ship-now-tranche filter returns correct, non-zero
result sets in prod matching a hand-checked MLS pull for one fixture query each;
(b) voice parser resolves ≥2 natural phrasings per new filter; (c) CustomFields ingest
live with the privacy diversion verified (zero confidential CF keys reachable via the
anon key — checked by an automated probe), and `adu=true` returns real listings in
prod; (d) sold-search depth: a closed search with close-date window + sold-price range
+ financing filter returns rows and is registry-driven; (e) coverage gate wired into
`ci:gates`.

### Phase 2 — Map parity-plus (the map IS the search)

1. **Radius search** with live readout (Flexmls-style drag = center + radius). Serve via
   PostGIS `ST_DWithin` on the boundaries project's geometry infra — not Node.
2. **Server-side polygon.** Move point-in-polygon into Postgres (`ST_Within` against the
   drawn GeoJSON) killing the 1000-row overfetch ceiling; keep the 4-decimal cache
   rounding. Precedent: `listing_boundary_xref_mv` proves the pattern at scale.
3. **Multi-shape + exclude.** N shapes per search, each include/exclude — union of
   includes minus union of excludes. URL-encode the set (extend `?poly=`).
4. **Named areas ("My Areas" = My Map Overlays, but consumer-grade).** Any signed-in user
   (and any admin on behalf of a client) saves a drawn shape-set as a named area; areas
   are reusable across searches and alerts, listable, editable, shareable
   broker→client. Storage joins the existing `boundaries` model (new geo_type `custom`,
   owner scoped) so `listings_in_boundary`/xref machinery just works. Broker-authored
   areas can be flagged public → they become site-wide landing surfaces (SEO page per
   area: "Bend West Side homes for sale" — we already prove this pattern with
   neighborhoods).
5. **Reference layers.** We already hold city/neighborhood/subdivision/park/school
   boundaries. Add as toggleable map layers while drawing; roadmap candidates matching
   Flexmls's set where public data exists: school districts (have), city limits (have),
   flood (FEMA NFHL), UGB (Oregon DLCD open data), zoning (Bend/Deschutes GIS), parcels
   (Deschutes DIAL — already used by the land pipeline). Per
   [feedback_gis_authoritative_only]: authoritative sources only.
6. **Boundary-snap search.** Click a subdivision/neighborhood on the map → search snaps
   to that boundary (we already resolve tiles by boundary slugs — this is UI wiring, not
   new data).
7. **Gate:** polygon/radius results must equal the PostGIS predicate result on a fixture
   set (no Node-side approximation drift); map-path E2E in the preview harness.

**Phase 2 acceptance:** (a) radius drag shows a live distance readout and the result
count matches `ST_DWithin` exactly on 3 fixture circles; (b) a 3-shape search (2
include + 1 exclude) returns the set-algebra-correct rows and survives URL round-trip;
(c) a signed-in user can save, rename, re-use, and delete a named area, and an alert
scoped to that area fires only inside it; (d) one broker-authored public area renders
as an indexed landing page with correct counts; (e) the 500-row split-view cap is gone
or demonstrably unhittable (server-side predicate + exact count).

### Phase 3 — Alerts engine parity-plus (saved searches → listing emails)

1. **Event taxonomy.** Extend `listing_alerts` matching from "new result-set keys" to
   typed events mirroring (and beating) Flexmls's toggles: **new listing · price change
   (with amount/direction) · status change (pending, back-on-market, sold) · open house
   scheduled · coming-soon (registered users)**. The source columns already exist
   (`price_drop_count`, `last_price_change_*`, `back_on_market_timestamp`,
   `status_change_timestamp`, `pending_timestamp`, `OpenHouses`). Per-alert event
   toggles with account-level defaults (Flexmls's "inherited defaults" pattern).
2. **Cadence.** Add per-day-of-week scheduling to weekly (their model), keep our
   instant/daily floor. Quiet hours + per-person collapse (one email per cadence window
   listing all events, not one email per event).
3. **Preview/approval mode.** Optional per-alert "broker reviews before send" queue in
   the admin subscriptions hub — matches Flexmls Preview Mode + "Listings to Approve",
   and fits our §1 approval culture for broker-initiated sends.
4. **Multi-recipient** (household) alerts: N recipients per alert row (Jim + Lisa case),
   each with own unsubscribe token.
5. **Engagement loop.** We already record email events; surface per-contact
   subscription-viewed / clicked counters on the CRM person page (Flexmls's Activity bar
   + counters), and optional broker notification on click (their "email me when a contact
   clicks" toggle) routed through the existing notification queue.
6. **"New since last visit"** on the site: per saved search, badge count + reset
   semantics for signed-in users (mirrors their View-New/Reset model; we already keep
   `notified_keys`).
7. **Agent-only prospecting feeds:** alert rows with origin `broker`, recipient = broker
   only (their "Agent Only" tab) — e.g. Matt's "Bend ADUs under 1M" moves in-house once
   Phase 1 lands the ADU field.
8. **Mirror Matt's existing Flexmls assets.** Investigate Spark API endpoints for saved
   searches/contacts/subscriptions to import the 7 live subscriptions + 3 map overlays
   instead of re-creating by hand. (Investigation item — API surface availability
   unverified.)
9. **Gate:** alert-engine contract test — for a fixture listing mutation set (new, price
   drop, pending, BOM, sold, OH), exactly the toggled event types fire, once, per
   recipient, respecting cadence + compliance stops.

**Phase 3 acceptance:** (a) the contract test in item 9 green in CI; (b) a real alert
on a drawn area delivers a price-change event end to end (prod listing mutation →
rendered email → click recorded → CRM person timeline shows it); (c) preview-mode queue
holds a send until approved in the admin hub and releases on approval; (d) a
two-recipient alert delivers to both with independent unsubscribe tokens; (e) Matt's 7
Flexmls subscriptions re-created (imported or by hand) and running in-house with him as
sender.

### Phase 4 — Portal experience (the consumer side of subscriptions)

1. Fold alerts, saved searches, saved homes, hidden homes, named areas, and the
   activity/engagement feed into one coherent `/account` "portal" (theirs is a separate
   product; ours is the site itself — keep that advantage).
2. Listing-level conversation hooks (comment/ask on a listing → CRM thread) — Flexmls
   portal has none of this; it's our differentiation with the in-house CRM.
3. Broker-view of a client's portal ("work on behalf of" equivalent): admin impersonation
   of the search context, writing action rows through the CRM.

**Phase 4 acceptance:** a signed-in client can, from one surface: see every alert with
its event toggles, pause/edit cadence, see "new since last visit" per saved search,
manage named areas, and see their own activity; Matt can open any client's view
read-only from the CRM person page.

### Phase 5 — Beyond Flexmls (leads we extend)

- NL/voice search already parses to the registry — extend synonyms to every Phase-1 field
  the day it ships (the registry's `voice` blocks make this mechanical).
- Payment-first search (PITI is already a range filter) + rate-scenario toggles.
- Instant map counts by boundary (hover a neighborhood → live count/median from
  `listing_tile_mv`).
- Lifestyle distance filters from the `DistanceTo*` RESO family + our own drive-time
  isochrones (post-Phase-2 infra).
- SEO: every new high-coverage filter that maps to buyer language becomes a preset in the
  40-preset matrix (e.g. `adu`, `str-permit`, `owner-will-carry`, `single-level`,
  `on-the-river`) — gated by the same ≥1-verified-match rule.

### Target UX spec (the "and UI" half — binding for every phase)

The standard is the site's north star (5-second ooh test), not Flexmls's UI — theirs is
a pro tool; ours must feel like the best consumer product in the market while carrying
pro-grade depth. Spec:

- **Layout:** map-first split stays the default on desktop (`/homes-for-sale`); list is
  a mode, not a separate page. Mobile: full-bleed map with a draggable bottom sheet for
  results (the pattern the KB/CRM mobile work already established with
  `--crm-dock-offset` — reuse the inset machinery). One persistent top bar: location
  omnibox · 4 primary chips (Price, Beds/Baths, Type, Status) · "All filters (N)" ·
  Save. Nothing else. Every other control lives in the sheet or on the map.
- **All-Filters sheet:** keeps the registry-driven category groups, gains (a) a
  "find a filter" typeahead over labels + voice synonyms (Flexmls's one great disclosure
  idea), (b) sticky live count ("Show 214 homes") which we already compute, (c) an
  "active filters" chip row at top with one-tap remove, (d) zero-result guard — if the
  count hits 0 the sheet highlights which filter(s) zeroed it (compute by dropping each
  active filter once; cheap against the MV).
- **Map:** draw button exposes rectangle / circle-with-live-radius / freeform; drawn
  shapes get a floating pill (rename → becomes a named area · exclude toggle · delete).
  Boundary-snap: tapping a neighborhood/subdivision label chip-ifies that boundary as
  geography. Layers control: listings, drawn shapes, boundaries, (later) flood/UGB/
  zoning. Hover/tap a boundary shows count + median from `listing_tile_mv`.
- **Beds/baths get max bounds** in the chip popover (range, not min-only) — the DAL
  already supports it.
- **Save affordance:** saving from the bar captures filters + shapes + named areas; the
  dialog offers alert cadence + event toggles inline (one motion from search to
  subscription, Flexmls's best flow, minus the modal maze).
- **Voice/NL:** the mic stays on the omnibox; every Phase-1 field gets synonyms the day
  it ships (acceptance-gated).
- **Performance budget:** filter apply → results paint < 800 ms p75 (MV query + cache);
  map pan → pin refresh < 500 ms p75. Regressions fail the perf check in the E2E
  harness.
- **Mockup discipline:** the redesigned surface gets a `ui_kits/homes-for-sale/` mockup
  + `parity.json` so the mockup-parity gate owns it (§6 of CLAUDE.md).

### Measurement baseline (stamped 2026-07-29) + targets

| Metric | Baseline (30d) | Source | Target 90d post-Phase-3 |
|---|---|---|---|
| Search events tracked | **0** (untracked) | `user_events` | full funnel visible (Phase 0.5) |
| Sessions | 139 | `user_events` | n/a (growth loop owns traffic) |
| Listing views | 70 | `user_events` | 3× per-session listing-view rate |
| Active listing alerts | **5** (2 user / 3 broker) | `listing_alerts` | 50 active; ≥50% user-origin |
| Distinct alert emails | 4 | `listing_alerts` | 40 |
| Alerts created / 30d | 6 | `listing_alerts` | 20/30d |
| Matt's subscriptions in-house | 0 of 7 (all still in Flexmls) | Flexmls hub | 7 of 7 (Phase 3 acceptance e) |
| Zero-result searches | unmeasured | — | measured, < 10% of applies |

The honest read: search usage is near-zero today, so the plan's payoff metric is
**alert creation and alert-driven return visits** (the compounding asset), not raw
search volume. Every phase ships its measurement stamp per THE LOOP.

### Sequencing + effort (loop iterations, not calendar promises)

| Phase | Size | Dependency |
|---|---|---|
| 0 Foundation | S–M | none |
| 1 Filter depth | M (mechanical after contract; CustomFields ingest incl. privacy diversion) | 0 |
| 2 Map | M–L (PostGIS path, named areas) | 0 |
| 3 Alerts | M–L (event engine) | 1 (fields), 2 (areas in alerts) |
| 4 Portal | M | 3 |
| 5 Extensions | rolling | per-item |

First three loop iterations: **(1)** Phase 0 complete (UI unification, `?poly=`,
registry reconcile, instrumentation, docs) — everything after depends on it; **(2)**
Phase 1.2 CustomFields ingest (privacy diversion first, then ADU/STR/zoning/flood/
CC&R filters — the single highest-value unlock, zero external dependency); **(3)**
Phase 2 items 1–2 (radius + server-side polygon) + the Phase 1 ship-now scalar
tranche + the coverage gate.

---

## 5. Decisions — recommendations with defaults (override, don't answer)

1. **Sold-data exposure** (Phase 1.3) — **default: registered-user gate.** ODS puts
   sold-data display in VOW territory ([reference_ods_rules]); registration also feeds
   the CRM. Build the gate, revisit public exposure only with compliance sign-off.
2. **Feed-gap path** (Phase 1.2) — **RESOLVED rev 2.1: no external request.** Live
   probes proved every headline field arrives via `_expand=CustomFields` on our
   existing credentials; the work is our own sync + privacy diversion + backfill. The
   only conditional ask left is Topography/WaterBodyName if they lack CF mirrors.
3. **Named areas** (Phase 2.4) — **default: broker-authored first, 30 days, then open
   to signed-in users.** Gets the SEO landing surfaces and Matt's three Flexmls
   overlays live immediately; consumer creation follows once save/edit UX survives real
   use.
4. **Flexmls import** (Phase 3.8) — **default: re-create the 7 subscriptions by hand.**
   Seven rows do not justify a Spark saved-search API investigation; timebox the API
   check to one hour during Phase 3 only if it's free along the way.

## 6. Source trace

- Flexmls observations: live session ore.flexmls.com 2026-07-29 (Quick Search template
  "1 - Residential", Add-a-Field dictionary, Status/date editors, map draw + Overlays
  menu, My Map Overlays manager, Save dialog, contact "lisa langevin" card +
  Searches/Subscriptions, Edit Subscription screen, Subscriptions hub, Portal
  preferences → Default Subscription Settings). Counts seen: 4,691 active residential
  statewide template default; 7 active subscriptions; 294 listings auto-sent to the
  Langevin contact.
- Codebase: agent sweep 2026-07-29 over `app/search/*`, `lib/search/field-registry.ts`,
  `lib/data/listings/searchListingsAll.ts`, `supabase/migrations/2026071*`,
  `app/actions/saved-search-alerts.ts`, `lib/search-filters.ts`, `next.config.ts`.
- DB: `docs/DATABASE_SCHEMA_SNAPSHOT.md` (listings columns) + four `-- audit:` queries
  (2026-07-29): key presence n=40 · per-field coverage n=1000 active (batches 1–2) ·
  value profiles n=500 (exposed the `********` feed masks) · mask forensics joined to
  `listing_private` n=1000 (zoning/topography/water-body/green/township = 0 real
  values; BodyType 89, PreviousListPrice 430, IrrigationWaterRightsAcres 46 real).
- Baseline: `listing_alerts` (6 rows, 5 active: 2 user / 3 broker; 4 distinct emails)
  and `user_events` 30-day profile (1,224 events / 139 sessions; types: page_view
  1,154, listing_view 70; zero search events) — queried 2026-07-29.
- Redaction forensics: `PRIVATE_DETAIL_KEYS` + `redactPublicDetails()` in
  `lib/listing-mapper.ts` (11 keys only) — proves the `********` masks originate in the
  Spark feed, not our sync.
