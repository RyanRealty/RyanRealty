# Prospecting → CMA → measurement, and the site IA/density pass

**Opened 2026-07-28** from Matt's Brain Dump 2. Status: **live**.
Input to THE LOOP (`docs/DEVELOPMENT_PROCESS.md`). Two tracks, run in parallel:
**Track A — the seller-acquisition workflow** (expired · FSBO · CMA · send · measure).
**Track B — the public-site information architecture + density pass.**

---

## What Matt actually said (verbatim intent, condensed)

**Track A**
1. Prospecting is two columns; it should be ONE list.
2. "Compliance hold" + "Suppressed" appear on everything. The logic is wrong.
3. Can't tell FSBO from expired at a glance.
4. Each row should carry: thumbnail · latest expired detail (on-market date, list price, off-market price) · listing history · our recommended price from the audit.
5. Clicking the address goes to a full detail page. Clicking a CMA title currently blurs the page and opens a drawer that does nothing — it should navigate.
6. Send the audit to the lead from that row.
7. The pill strip at the top (total / ready to send / needs audit) is clunky. Tighten it.
8. Sortable columns — name, city, price, has-audit — everywhere, lightning fast.
9. See at a glance: audit approved and ready to send · sent · activity on the audit.
10. Clicking the lead goes to the lead dashboard: their info, expired listings, CMAs created and sent, activity reporting.
11. CMAs use stale photos from past listings instead of current ones.
12. CMAs / Audits / BPOs must use the SAME pricing + data logic.
13. Comps are too far away and in unrelated neighborhoods. **Matt to specify the rules.**

**Track B**
14. City page sections need the right content AND the right ORDER — high level first, funnelling down.
15. From a city page you can only see featured homes. No path to the rest of the homes for sale. Same on community, subdivision, neighborhood pages.
16. Listing detail pages need a thorough content + IA + UI review.
17. Menus are inadequate — can't reach most features, no clean path to brokerage info, the new About submenu doesn't match the rest.
18. Desktop looks bad: headers eat the whole screen, every section is oversized. Measure against 2026 high-performing-UI metrics.

---

## Verified findings (evidence, not assumption)

### A-1 · The compliance wall is a mislabel, not a data problem — CONFIRMED
Live audit query, 2026-07-28:

| figure | value |
|---|---|
| `expired_listings` rows | 196 |
| rows with `compliance_hard_stop = true` | **0** |
| rows with a resolved CRM person | 75 |
| expired-owner persons with a `crm_suppressions` row (all/sms) | **1** |
| expired-owner persons carrying `contact:do-not-call` on `crm_people.tags` | **54** |
| expired-owner persons carrying `compliance:hard-stop` | 5 |
| expired-owner persons carrying `contact:do-not-text` | 4 |
| `expired_listings` with any `compliance_flags` | 0 |

`lib/data/prospecting/batch.ts:161` builds `HARD_STOP_TAGS` from every `TAG_CHANNEL`
entry whose channels include `all` **or `sms`**. `contact:do-not-call` maps to
`['call','sms']` (correctly — TCPA treats a text as a call). So 54 of 75 persons get
`suppressedSms = true` → `hardStop = true` → the ribbon paints **"Compliance hold" +
"Suppressed"** and `computeSendable` kills the row's action.

**The SMS gate is legally right. The presentation and the blast radius are wrong.**
A DNC-registry contact may still be emailed and mailed. Today the UI says
"Hard stop — do not contact" (`batch.ts:282`) and offers no action at all.

**Fix:** compliance becomes **per-channel**, not one boolean.
- `smsBlocked` / `emailBlocked` / `callBlocked`, each with its own reason.
- The ribbon shows `SMS blocked · email OK`, not `Compliance hold`.
- `computeSendable` returns the set of channels still open; the row's CTA sends on the
  best open channel. Only an all-channel block removes the CTA.
- Reason copy names the actual tag ("On the do-not-call registry — email only").

Fail-closed behaviour is preserved exactly: any read error still blocks every channel.

### A-2 · Prospecting is a card grid, not a list — CONFIRMED
`ProspectingBoard.client.tsx:196` — `grid gap-3 md:grid-cols-2`. Six KPI pills at
`:174`. No sort control anywhere. No thumbnail on the card (`ProspectCard` renders
name/address/price/date only, even though `ProspectRow` already carries `photoUrl`).

### A-3 · The CMA title click dead-ends — CONFIRMED
`CmaCard.client.tsx:50-61` — the address is a `<Button onClick={onOpenDetail}>` that
sets `?id=`, opening a drawer. The real page (`/admin/cmas/<slug>`) is buried in the
overflow menu. Same idiom in `ProspectCard.client.tsx:64-77`.

### A-4 · Comps have no geographic constraint — CONFIRMED
`lib/cma/comps.ts:105-117`. Four tiers: `subdivision-24mo` → `zip-12mo` →
`city-12mo` → `city-24mo-wide`. **No latitude/longitude, no radius, no neighborhood,
no polygon.** Subject subdivision is frequently null and zip is coarse, so most
subjects fall through to `city-12mo` — which for Bend means the entire city. That is
exactly "comps way too far away and in neighborhoods not even really in the same area."

Comp rows already carry `Latitude`/`Longitude` (`comps.ts:48-49`) and the repo already
has `data/bend/bend-neighborhood-polygons.json`. Both are unused by comp selection.

### A-5 · Engagement plumbing exists but is not reported — CONFIRMED
`lib/data/prospecting/engagement.ts` already aggregates `email_events` keyed
`cma:<slug>`, `visitor_events` on `/cma/<slug>`, and `crm_timeline` `sms_click`.
`ProspectRow.engagement` carries views/taps/opens/clicks/lastActivityAt, and
`ProspectCard.client.tsx:114-119` prints one thin line. There is no per-document
performance view and no cross-document report.

### B-1 · No path from featured homes to all homes — CONFIRMED
`components/site/kb/KbFeatured.client.tsx:18` — props are `{ items, eyebrow }`. There
is **no view-all affordance in the component at all**. It is mounted on city
(`app/cities/[slug]/page.tsx:595`), neighborhood, subdivision, community, and listing
(`app/listing/[listingKey]/page.tsx:592`) pages. One component fix closes all five
surfaces.

### B-2 · City page section order — CONFIRMED (current)
hero → featured → ticker → map → about → market HUD → charts → explore-towns →
communities → explore-towns → area-guide video → open houses → activity → articles →
explore-towns → testimonials → team → sell → FAQ → footer.

`KbExploreTowns` is mounted **three times** (`:618`, `:649`, `:666`). Inventory
(featured/ticker/map) fires before any orientation, and the seller CTA (`KbSell`)
sits 18 sections deep, below testimonials and team.

### B-4 · Listing detail ships its whole body TWICE in production — CONFIRMED, P0

Measured live on `https://ryan-realty.com/listing/220224941` (and the pretty
`/homes-for-sale/...` URL, which delegates to the same page):

| | count |
|---|---|
| `main.kb-root` in the **server HTML** | 1 |
| `main.kb-root` in the **live DOM** | **2** |
| every section `<h2>` | **2 each** (9 distinct → 18 nodes) |
| orphaned `body > div[id^="S:"]` containers | **2** (`S:0`, `S:1`) |
| total DOM nodes | 2,002 |

One copy is visible inside `#main-content`; the second is a full duplicate stranded
in a React streaming container at the end of `<body>`. It persists after
`document.readyState === 'complete'` plus a 4-second wait, so it is not a mid-stream
snapshot artifact.

**Not CSP** — ruled out directly: `script-src` includes `'unsafe-inline'` and
`window.$RC` (React's completeBoundary) is defined. The Suspense boundaries simply
never complete, so both the in-place content and the streamed copy remain.

This is the #1 ad-landing surface. It roughly doubles DOM nodes and client-component
instances, which lands on LCP and INP. Needs its own investigation — likely the
interaction between the page's Suspense usage and `SmoothScrollProvider` /
`loading.tsx`. **Do not attribute it to a cause until traced.**

### B-3 · Listing detail renders three permanently-empty sections — CONFIRMED
`app/listing/[listingKey]/page.tsx:455-457`:
```
<ClimateRiskBlock risk={null} />
<VacationRentalPotential projection={null} />
<TransparentCMASummary cma={null} />
```
All three are hardcoded `null`. Either they render placeholder chrome (dead weight in
the middle of the page) or they no-op (dead code). Both need resolving, not shipping.

---

## Track A — the workflow

### A0 · Per-channel compliance *(P0, unblocks everything else)*
`lib/data/prospecting/types.ts` · `batch.ts` · `compliance.ts` · ribbon · card.
Replace the single `hardStop` boolean with a per-channel state. Keep fail-closed.
Update `computeSendable` to return open channels. Rewrite the reason copy.
**Gate:** a unit test asserting `contact:do-not-call` blocks SMS + call and leaves
email open, and that a read error blocks all three.

### A1 · One list, sortable, with the right columns
Replace the two-column card grid with a single dense table (`@/components/ui/table`)
carrying: **thumbnail · owner · address · city · kind badge (Expired / FSBO) ·
was-listed price · off-market date · recommended price from the audit · audit state ·
sent state · activity · action**. Every column sortable via `?sort=&dir=` on the
server (the set is ~200 rows, sorting is free). Cards remain only under `md`.
Collapse the six KPI pills into a single line of text + a status segmented control.

### A2 · Address click → real detail page
`/admin/prospecting/[kind]/[id]` — full expired/FSBO breakdown: thumbnail, listing
history (list → price changes → expiry), the audit's recommended price, the audit
preview, engagement, and **Send audit** inline. The `?id=` drawer is deleted, not
kept alongside. Same treatment for `CmaCard` → `/admin/cmas/<slug>`.

### A3 · Lead dashboard rollup
`/admin/crm/[id]` gains: expired/FSBO listings tied to this person, every CMA/BPO
created and sent for them, and the engagement timeline per document.

### A4 · One pricing engine for CMA · Audit · BPO
Audit `lib/cma/pricing.ts`, `expired-audit.ts`, `audit.ts`, and the BPO path for
divergence. Collapse to one function, one contract, one set of adjustments. Any
intentional difference becomes a documented parameter, not a second code path.

### A5 · Comp selection rework — **spec locked 2026-07-28 from appraisal standards**

Matt asked for the professional answer rather than a preference. The research says the
radius-first design I first proposed is **wrong**, so it is discarded.

**What the standards actually say**

- **There is no proximity rule.** USPAP sets none. Fannie Mae B4-1.3-08 requires comps
  from the subject's *market area* "(including subdivision or project) … when possible
  and must be used in certain instances," and requires distance to be *reported*
  ("1.75 miles NW"), never capped.
- **The 1-mile/5-mile rule was retired with UAD.** It survives only as a soft lender
  overlay (~1 urban / ~2 suburban / ~5 rural). It is a guideline, not a standard, and a
  circular boundary does not describe any real neighborhood.
- **The governing test is buyer substitution:** would a typical buyer have considered
  this property *instead of* the subject? Market areas are bounded by physical barriers
  (freeway, river) and price/character segments — which is exactly Matt's "across a
  major divide" exclusion, so the two agree.
- **Competing-neighborhood comps are allowed but must be disclosed**, with the
  neighborhood differences addressed and the selection explained.
- **Recency:** minimum 3 closed sales within **12 months**; anything **older than 6
  months requires an explanation**. Market-trend analysis uses a 12-month look-back.
- **Size:** the ±25% GLA band is the accepted convention — beyond it you cross into a
  different buyer pool and price tier. Our current ±25% is already correct; the
  `city-24mo-wide` tier's ±35% is outside the norm and must carry the same disclosure.
- **Bracketing** is the quality marker: the set should straddle the subject on GLA
  rather than sit entirely above or below it.

**The design that follows — market-area first, distance as disclosure**

Replace the four radius-free tiers with:

| tier | area | window | disclosure |
|---|---|---|---|
| 1 | same subdivision | ≤ 6 mo | none |
| 2 | same Bend neighborhood polygon | ≤ 6 mo | none |
| 3 | same subdivision / neighborhood | 6–12 mo | "older comp" note per comp |
| 4 | adjacent competing neighborhood, same side of every divide | ≤ 12 mo | competing-neighborhood note + difference explained |
| 5 | city-wide | ≤ 12 mo | only when tiers 1–4 yield < 3; every comp flagged |

Beyond 12 months only with a written justification, never silently.

**Hard exclusions, applied at every tier (Matt 2026-07-28):**
1. **Across a major divide** — US-97 / the Bend Parkway, and the Deschutes River. Never
   crossed regardless of distance.
2. **Different zoning or lot character** — acreage vs in-town lot, or a different zoning
   designation, excluded at any distance.

**Data we already hold:** `data/bend/bend-neighborhood-polygons.json` — 23
non-overlapping polygons built from the **City of Bend GIS neighborhood mesh**. Subject
and comp both resolve by point-in-polygon, so market-area matching uses authoritative
boundaries rather than an approximated circle. The divide rule rides on a
neighbour-pair adjacency table marking which pairs are split by the Parkway or the
river — no hand-drawn geometry (GIS-authoritative-only rule).

**Every comp additionally records** straight-line distance in miles + direction, per
Fannie Mae, into the trace and `citations.json` (§0).

Sources: Fannie Mae Selling Guide B4-1.3-08 *Comparable Sales*; Sacramento Appraisal
Blog, *The myth of the one-mile radius*; RealVals appraisal comparable guidelines.

### A6 · Current photos on CMAs
Trace the photo source in `lib/cma/build.ts` / `subject.ts`. The subject photo must
resolve from the newest listing record for that address, not the first/oldest match.

### A7 · Send performance
`/admin/reports/cma-performance` — per document: sent date, channel, opens, clicks,
report views, time on report, last activity; and the aggregate: send → open → view →
reply → appointment. Reads the existing `email_events` / `visitor_events` /
`crm_timeline` aggregation, no new tracking.

## Track B — the site

### B0 · View-all everywhere *(P0, one component, five surfaces)*
`KbFeatured` takes `viewAllHref` + `viewAllLabel`. Every mount passes a real search
URL scoped to that geography. City → all city listings; neighborhood → that
neighborhood; subdivision → that subdivision; community → that community.

### B1 · Section order to a funnel
Proposed city order — orient, then prove, then convert, then browse:
hero → about (what this place is) → market HUD + charts (the proof) → **featured +
view-all** → map → neighborhoods → communities → open houses → activity → area-guide
video → **sell CTA** → articles → testimonials → team → FAQ → footer.
`KbExploreTowns` drops from three mounts to one. Applied consistently to city,
neighborhood, subdivision, and community.

### B2 · Listing detail IA

**Climate risk — DONE 2026-07-28, retired.** Matt's call. It was never a no-op: the
null branch shipped a fixed paragraph naming FEMA / Deschutes County WUI / NOAA
sources it never queried, identical on every listing. Zillow dropped climate scores
too. Component, mount, parity entry and both copies deleted; the D77 contract test now
asserts it is ABSENT so it cannot return.

**Vacation-rental potential — keep the component, wire it, do not teaser it.** Bend is
the strongest STR market in Oregon and Sunriver / Tetherow / Caldera buyers ask this
first, so the section earns its place. But it needs a real projection: nightly rate,
occupancy, and gross yield from an actual source, plus the city's STR permit status
for that address (Bend caps permits by density, which is the single fact that decides
whether the pro-forma is even legal). Until that source exists it renders nothing,
which is the correct behaviour — unlike climate, it returns `null` rather than
inventing sourcing. Ship it when the data lands, never before.

**Transparent CMA summary — highest-value of the three, and we already own the data.**
This is the Zillow-beater: a Zestimate is a black box, and we can show the actual comps
with the actual adjustments. It should read from our own CMA engine keyed to the
listing address, render the recommended range and the comps that produced it, and link
to the full report. It should ship AFTER A5 (the comp rework) so the first thing a
buyer sees is a defensible number, not a city-wide average.

**Section order** — reorder around buyer decision sequence: hero → price/CTA → specs →
description → tour → map/location → neighborhood market → schools + parks → history →
payment + rental → CMA summary → attribution → broker CTA → nearby for sale.

**B4 above (duplicate DOM) blocks the rest of this item** — reordering a page that
renders twice just reorders it twice.

### B3 · Navigation
One IA covering brokerage/about, buy, sell, market, tools, communities. The About
submenu adopts the same pattern as the rest.

### B4 · Desktop density
Measured pass against 2026 UI benchmarks: hero viewport share, section vertical
rhythm, type scale, content width, above-the-fold information density. `kb.css` is the
single lever for the KB surfaces.

---

## Comp selection — resolved 2026-07-28

Matt's direction: research the professional standard rather than pick a preference.
Done; the answer is in A5 above and the radius-first approach is dropped. Matt
separately confirmed two hard exclusions: **across a major divide** and **different
zoning / lot character**. He did NOT select school attendance area, so it is not a
selection rule.

---

## Sequencing

**Wave 1 (P0, ships first):** A0 per-channel compliance · A1 single sortable list ·
A2 real detail pages · B0 view-all everywhere.
**Wave 2:** A6 current photos · A7 send performance · B1 section order · B2 listing IA.
**Wave 3:** A4 one pricing engine · A5 comps (on Matt's answers) · A3 lead rollup ·
B3 nav · B4 density.

Each wave: build → `npm run ci:gates` → browser-verify the rendered surface → commit
→ push. Per §1 all of this is reversible and ships without waiting for review.
