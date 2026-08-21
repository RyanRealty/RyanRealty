# Ryan Realty locked public pages

Give this folder to an agent that is restyling live `ryan-realty.com` templates. The PNGs are the look. This file is the contract. Do not invent a new wireframe.

**Site:** https://www.ryan-realty.com/
**Repo:** https://github.com/RyanRealty/RyanRealty
**Owner:** Matthew Ryan (Matt), Ryan Realty, Bend / Central Oregon
**Site phone:** 541.703.3095

Ping Matt only when a page is actually live on ryan-realty.com. Do not ping about research, CI, or coordinates.

---

## What is locked

Five templates, then crank. Same layout per type. Place-specific content. Do not build every city / resort / community until these are right.

| Type | Proof | Locked shots |
|---|---|---|
| Listing | House A | `listing/house-a-desk.png`, `listing/house-a-phone.png`, video variants |
| Home | home-d | `home/home-d-desk.png` plus `home-d-desk-1`…`8`, phones, `home-d.pdf` |
| Neighborhood | River West | `neighborhood/river-west-desk.png`, `neighborhood/river-west-phone.png` |
| City | Redmond | `city/redmond-desk.png`, `city/redmond-phone.png` |
| Community / MPC | Tetherow | `community/tetherow-desk.png`, `community/tetherow-phone.png` |
| Resort | Sunriver | `resort/sunriver-community-*.png`, `resort/sunriver-city-*.png` (latest captured; treat as the resort proof) |

About, team, journal/blog, and sell do **not** need their own lock meeting. Build them from this kit after home is right.

---

## Folder

```
locked-screens/
  LOCKED.md                  ← this file
  listing/                   House A desk + phone + video
  home/                      home-d full page, slices, PDF
  neighborhood/              River West desk + phone
  city/                      Redmond desk + phone
  community/                 Tetherow desk + phone
  resort/                    Sunriver community + city
```

Screenshots are PNG (or one PDF). Matt cannot review HTML. Always deliver desk + phone.

---

## Restyle rules (binding)

1. **Live templates only.** Same URLs. Do not invent routes.
2. **Read the existing page first.** Keep Spark, place graph, Chart Room. Recreate the look from the locked PNG.
3. **Do not invent** counts, parks, HOA dollars, schools, dog parks, subdivisions, or routes.
4. **H1 and title = the buyer search**, not just the place name. City: “Redmond homes for sale”. Neighborhood: “River West homes for sale”. Community: “Tetherow homes for sale”.
5. **Never say plat, nest, parent, child, sibling, CDP, or Feeders** on a public page. School blocks are “Schools” or “Assigned schools”.
6. **No mid-page Ask me / Call CTA.** Contact is the navy footer + sticky Call/Text dock. No broker photos on the dock unless Matt asks.
7. **No chips or place-type labels** under the menu. Quiet name-only breadcrumb on the hero (Bend › River West). Never label “neighborhood / city / planned community”.
8. **Kit:** navy `#102742`, cream `#faf8f4`, square corners. Amboqia for price / H1 / H2 only. Geist for UI. Tight 8px / 1120 grid.
9. **One merge to main at a time.**
10. **Do not paste mock HTML or Glen sample numbers into production.**

---

## Home (home-d)

Section order, varied UIs, not a tile dump:

1. Full-bleed hero — Old Mill video if it exists, flag-centered still as fallback. H1 “Central Oregon Homes for Sale”. Search. Live count / median / pending.
2. **Towns** — “Where to start”. Left list of official towns + one stat. Right map of official city polygons. Hover links list ↔ map.
3. **Golf and master-plan** — one large **course** photo (Tetherow McLay Kidd, etc.). Name + hover list of official communities. Not a listing-card carousel.
4. **Luxury** — **one** giant house. Price + address on the photo. A small rail of other asks under it. Share kind beside the ask when the listing is a share (do not invent the label).
5. **Journal** — magazine spread. One headline + dek + Read. Sidebar of dated posts. Headline must clear the fixed nav.
6. **Parks** — one full-bleed official park (Drake Park / Mirror Pond). Named official parks only. Do not invent a dog park.
7. **Alerts** — “New listings by email”. Must say frequency and unsubscribe (“One email per new listing. Unsubscribe any time.”). Company honeypot stays.
8. **Navy footer** — logo, 541.703.3095, Buy / Sell / Company / Places (complete list), OREC + Equal Housing.

**Not in the lock:** the old “Market Desk / THE MARKET, ON RECORD” HUD. Do not put `KbMarketHud` back on `/`.

**Missing vs the long home-d desk composite (optional, only if you can use live Chart Room):** “How the towns sit” Time/Relate/Rank, and “What’s your home worth”. Fake line charts are banned. If you cannot wire the real Chart Room, leave it off.

Live `/` already has home-d sections. As of 2026-08-21 it still also rendered leftover Market Desk. A fix branch was removing that HUD and the homepage-v6 parity row that required `KbMarketHud`.

---

## Listing (House A)

- If the listing has a video: hero is **full-bleed playing video**, not a still beside the price rail. Price / address / facts overlay the video. Call / Tour / Save below.
- In photo grids, a listing with video plays a short clip in the cell the way the live site already does.
- No video = current stills layout.
- No broker headshots on Ask / dock. Text, 5.0 stars, 541.703.3095, Call, Text.

---

## Neighborhood (River West)

Buyer jobs: homes, pin map, official children **once** (map + side list, hover-linked). Trails / parks / events / journal guides we already have. Essay. Compare. Real Chart Room Time/Relate/Rank. Nearby official districts. Schools. Footer + dock.

- **Never a streets list.**
- Mid-page outdoor block is amenities: parks, trails, events, venues, dog parks we already have. Do not replace with restaurants or a plat.
- Official children only if that district has them. Do not invent subdivisions.
- River West outdoor (west bank, already sourced): Drake Park, Pioneer Reach, Whitewater Park, Hayden Homes Amphitheater, Munch & Music, Pride, Pet Parade. Drake Park is on-leash. Closest official off-leash is Riverbend Park (799 SW Columbia), not inside the district.
- Neighborhoods with more than one planned community get photo tiles for those children only: Summit West = NWX, Discovery West, Shevlin Commons. Century West = Broken Top, Mt Bachelor Village. Awbrey Butte = Awbrey Glen, Rivers Edge. Southeast Bend = Mountain High.

---

## City (Redmond)

Same Glen / buy bar as River West, plus on-the-ground (airport, Smith Rock, named public course) and competitor-parity buy jobs (filters, new construction, sold).

Aux parks / schools / venues / events attach by city string in `data/co-*.ts`. They are **not** children of the city Postgres row. Do not invent them. File official names on the city record / registries. Tumalo schools are **Redmond 2J**, not Bend-La Pine.

---

## Community / MPC (Tetherow) and resort (Sunriver)

Beat the official club page at course / stay / amenities / lifestyle, **and** do the buy job those sites skip: See homes, Chart Room Time/Relate/Rank, map, assigned schools, Call/Text. One page.

- Golf heroes must look like that community’s **actual course**. Official course photos as reference. Originals only. No people / text / logos. No MLS/stock as the file itself.
- Official villages once: map + list. Tetherow’s 12 official villages are the MPC proof. Do not invent village names.
- Tetherow is a Census CDP, mostly outside Bend. Do not nest it under Summit West or Century West except the four in-city plats.
- On Sisters pages, Black Butte is nearby, not a Sisters child.
- Planned-community villages use the same UI job as neighborhood subdivisions.

---

## Places chrome

Header: Homes, Places, Market, Sell, About, Saved, 541.703.3095.

Places mega = complete 12 cities / 13 Bend districts / 25 communities. Market and Saved have no dropdown. Phone Places is the same full list. No house photo under the menu.

Places nest (research / IA only, not buyer copy): City → Neighborhood → Planned Community → Subdivision → Listings.

Official Bend: 13 City of Bend districts only. Shevlin is not a district. NorthWest Crossing is Summit West. Discovery West is a separate Brooks parent. Pronghorn rebranded Juniper Preserve in 2022 (one parent, two MLS labels; club still Pronghorn).

---

## Data you may not invent

- Parks, trails, events, venues, dog parks, HOA dollars, school names, subdivision / village names, listing counts, sale prices, share labels.
- Share kind comes from `publishListingShareKind` (feed subtype or reviewed registry). Print it beside the ask. Do not invent “fractional” / “1/5th”.
- Chart Room must be real Time/Relate/Rank fragments, not a fake sparkline.

---

## Shipping

- Restyle the live template. Keep SEO (H1, title, canonical, sitemap, JSON-LD), analytics, ODS attribution, labeled metrics.
- One merge to `main` at a time.
- Do not claim live until you open https://www.ryan-realty.com/ (or the real URL) and see the locked sections.
- Screens for Matt: full-scroll PNG or PDF, desk + phone. Never HTML.

---

## Current live gap (2026-08-21)

`/` is already home-d (towns map, hover course, one house, magazine journal, Drake Park, alerts). It still also showed leftover **Market Desk / THE MARKET, ON RECORD** (`KbMarketHud`). Journal headline was colliding with the fixed nav. Homepage-v6 `parity.json` still listed `KbMarketHud` as required until a fix branch dropped it.

City / neighborhood / community restyles were open and not live.

Do not put Market Desk back. Do not sit on a failed check overnight without saying so.
