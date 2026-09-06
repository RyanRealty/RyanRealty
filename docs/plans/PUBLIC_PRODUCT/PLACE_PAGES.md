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
 │    └── Plat          a neighborhood/plat inside the resort
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
- KPI strip on the hero (679 / $950,000 / seller’s market / 3.9 / 23) as the first thing you read
- Teaching the map how to be used
- Duplicate counts in three places
- City still reused on a plat that has four homes
- Mannered “in plain words” filler that restates the H1
- Random percent tiles and leftover KPI grids that are not answering a section
- Public `/lp/*` place landings (`/lp/tetherow`, `/lp/bend`, `/lp/tetherow/heath`). 301 to the canonical place URL. Do not keep a second chrome “for ads.”

Seller/FSBO/expired landings are not place pages. They belong on `/sell/…` with the same shop chrome. They are not an excuse to keep a Vellum `/lp` kit.

---

## City — `/cities/bend`

**Search to beat:** “Bend real estate”, “homes for sale Bend Oregon”, and the top five results for those.

**Job.** Here are Bend’s houses. Here are the neighborhoods and resorts you can open next.

| Order | Section | Why |
|---|---|---|
| 1 | Photo of this city + H1 + breadcrumb | Identity. Verdict, if any, is a short caption on the photo — not a five-number hero. |
| 2 | Houses on this city’s map | Zillow/Redfin/Compass city URLs are search SERPs. We win with Atlas + live pins. |
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

---

## Master-plan / resort — `/communities/tetherow`, Caldera Springs, Broken Top, Widgi Creek

**Search to beat:** the resort’s own homepage. For Tetherow that is [tetherow.com](https://tetherow.com/): lodging, restaurants, golf (McLay Kidd), membership, pool/sport, residential neighborhoods, “edge of the forest / 7 minutes from Old Mill / 20 minutes from Bachelor.”

**Job.** This URL has every section that homepage has, **plus** live homes, sold, plats inside, HOA/STR, and the parent door to Bend. We win on merits: their amenities plus our sales.

| Order | Section | Why |
|---|---|---|
| 1 | Owned photo of **this** place + H1 + breadcrumb to the city | Belonging. Not “Tetherow homes for sale” as a city clone. |
| 2 | What this place is | Acreage, golf, lodging, dining, pool/sport — official-site facts from `resort-communities.json`. No invented dues. |
| 3 | Amenity grid | Dining, golf, fitness, trails, dog, pool — Caldera/Tetherow homepages live here. |
| 4 | Houses for sale here | Our moat. tetherow.com has none. Priced rows, not “view listings” links. |
| 5 | Villages / plats inside, with what is moving | Child doors. Heath is a child of Tetherow, not a second Tetherow. |
| 6 | Golf / course (when we have it) | They lead with golf. Hole maps belong with belonging. |
| 7 | Membership / HOA / STR | Perks and hours when known. Never fabricated dollar cards. Published CC&Rs when R7 allows. |
| 8 | One sold/pace answer | Once. |
| 9 | Edges | Trails, Bachelor, Old Mill, vacation-rental vs residential **only when both exist**. Gate/office hours on gated places. |
| 10 | Ask | Alerts for this community. |

A master-plan page that opens like Bend has already lost to tetherow.com.

---

## Plat — `/subdivisions/…`

**Search to beat:** the plat name plus the parent (neighborhood or resort).

**Job.** The homes on this plat. Parent is obvious. Short plat is a list. Do not dress four listings in a city hero.

| Order | Section | Why |
|---|---|---|
| 1 | Name + breadcrumb to neighborhood **or** resort, then city | Hierarchy. |
| 2 | The homes (list if few; map if the pins earn it) | The whole page. Lot lines / taxlots when we have them. |
| 3 | Recorded CC&Rs for this plat | When published. Official resort homepages do not offer this. |
| 4 | Peer plats in the same parent | Other children. |
| 5 | Schools (doors) | Inherited assignment, not a second city schools index. |
| 6 | One sold line if we have it | Once. |
| 7 | Ask | Alerts for this plat. |

Never steal the parent city’s still. Never teach zoom.

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
