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

### A5 · Comp selection rework *(blocked on Matt's answers — see below)*
Add distance-first tiering: subject lat/lng → radius bands → neighborhood polygon →
subdivision → zip → city, with the radius as the primary constraint rather than an
afterthought. Record every filter in the trace (already the pattern) so `citations.json`
still traces per §0.

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
Resolve the three `null` sections. Reorder around buyer decision sequence: hero →
price/CTA → specs → description → tour → map/location → neighborhood market → schools
+ parks → history → payment + rental → attribution → broker CTA → nearby for sale.

### B3 · Navigation
One IA covering brokerage/about, buy, sell, market, tools, communities. The About
submenu adopts the same pattern as the rest.

### B4 · Desktop density
Measured pass against 2026 UI benchmarks: hero viewport share, section vertical
rhythm, type scale, content width, above-the-fold information density. `kb.css` is the
single lever for the KB surfaces.

---

## Open question for Matt — comp selection rules (A5)

Matt asked to be queried on this. Answers needed before A5 ships:

1. **Radius.** Hard mile cap for a Bend comp (0.5 / 1 / 2 miles), and does it change
   for rural/acreage subjects?
2. **Neighborhood boundary.** Should a comp be required to sit inside the same
   neighborhood polygon when the subject is inside one, with radius as the fallback?
3. **Recency.** Max age of a closed sale (6 / 12 months) before it is excluded rather
   than merely down-weighted?
4. **Sqft band.** Current is ±25% widening to ±35%. Tighter?
5. **Never-comp rules.** Cross-highway, cross-river, different school attendance area,
   different zoning — any hard exclusions regardless of distance?

---

## Sequencing

**Wave 1 (P0, ships first):** A0 per-channel compliance · A1 single sortable list ·
A2 real detail pages · B0 view-all everywhere.
**Wave 2:** A6 current photos · A7 send performance · B1 section order · B2 listing IA.
**Wave 3:** A4 one pricing engine · A5 comps (on Matt's answers) · A3 lead rollup ·
B3 nav · B4 density.

Each wave: build → `npm run ci:gates` → browser-verify the rendered surface → commit
→ push. Per §1 all of this is reversible and ships without waiting for review.
