# Ryan Realty — company dump for new Grok bots

Read this once. Then go back to [`docs/GROK_BOT_BRAIN.md`](GROK_BOT_BRAIN.md) and open one door. Dated decisions stay in `.auto-memory/` and CROSS_AGENT Current, not here.

## Who

Matthew Ryan (Matt), principal broker. Ryan Realty. Bend / Central Oregon. Site and CRM: https://www.ryan-realty.com/. Phone 541.703.3095. Repo: RyanRealty/RyanRealty.

Team includes Paul and Rebecca. Public listing CTA and sticky dock are text only (stars, phone, Call, Text). No broker photos unless Matt asks.

## Service area

Capture and public buy work: Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine. Any list price. Terrebonne and the rest of Oregon are out of expired-capture. Do not invent cities, districts, or communities.

## Product

- Public site and CRM are the same Next.js app on ryan-realty.com.
- Listings: Spark MLS. Places: place graph + official registries in `data/`. Charts: Chart Room Time/Relate/Rank. No fake line charts.
- Outbound (email, SMS, files, CMA, v-card, group) goes through the CRM. If it cannot go out from the CRM it is broken.
- Work calendar is matt@ryan-realty.com. Morning digest reads that calendar only, not holidays.

## Public pages

Five proofs, then crank. Screens live in `design_system/ryan-realty/locked/`.

| Type | Proof | H1 |
|------|-------|----|
| Listing | House A | the listing address / price as locked |
| Home | home-d | Central Oregon Homes for Sale |
| Neighborhood | River West | River West homes for sale |
| City | Redmond | Redmond homes for sale |
| Community | Tetherow | Tetherow homes for sale |
| Resort | Sunriver | Sunriver homes for sale |

Restyle live templates only. Same URLs. Recreate the look from the locked PNG. Keep SEO, analytics, ODS, labeled metrics.

Kit: navy `#102742`, cream `#faf8f4`, square corners. Amboqia for price / H1 / H2 only. Geist for UI. Contact is the navy footer plus the sticky Call/Text dock. No mid-page Ask me. No second contact band.

Buyer words only. H1 and title are the search, not just the place name. Never say plat, nest, parent, child, sibling, CDP, or Feeders on a public page. School blocks are titled Schools or Assigned schools.

Do not invent parks, trails, HOA dollars, counts, routes, or children. City amenities attach by city string in `data/co-*.ts`, not as children of the city row. Official aux research is not a license to make up a park.

Listing with a video: full-bleed playing hero, price/facts overlay, Call/Tour/Save below. Grid cells play a short clip when a video exists.

## Ship

Public restyles: Grok Build on the bot computer, separate worktrees off main, one merge at a time. Not Cursor cloud unless Matt says so. Ping him only when the page is live on ryan-realty.com.

THE LOOP is armed (2026-08-21). It may push and deploy. It must not send live client mail, book calls, or spend money. Disarm word is "disarm the loop".

Matt does not tap mechanical steps. Agents have blanket approval to do the work.

## Accuracy

Matt is a licensed principal broker. Every number traces to Spark, the place graph, Chart Room, or an official named source. If the source is missing, stop and say so. Do not paper it over.
