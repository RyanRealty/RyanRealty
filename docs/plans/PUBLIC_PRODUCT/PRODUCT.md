# The product

This is the entire public product. Not a UI pass. Not a grade. Not a third OS.

Matt, Aug 13: the entire public site is the conversion surface. Every process, every page, the funnel. Not a subset of money pages.

Matt, Aug 14: it has to be super easy. What are you trying to do. Buy a home, sell a home, or look. Track that. Lead classic search and AI citation. Both. Display the housing data. Let people flow.

The look (PropXYZ cards, Tremor instruments, HouseMe report) is how the data is shown. It is not the product.

Do not run page-grade. Do not start Public Product OS 2. Do not ask Matt to restate this.

---

## What we broke

Page-grade scored pages, then deleted photography, maps, and listing facts so a caption rule could pass. Agents called Looks green. The phone looked like a 1998 template. Intent, welcome-back, Google comms, and analytics stayed in canvases and never became the product. That is the fuck-up.

---

## The job (locked, do not relitigate)

From Matt Aug 11–14, still binding:

1. Every page has an objective and the information required to meet it.
2. The site is one exploration graph. Dead ends are defects.
3. The whole site is a lead-gen machine that never acts like it. The machine objective is only achieved by serving the visitor objective.
4. Market knowledge is explorable: present, past, and what it means. Named basis only. No invented forecasts.
5. Context follows the visitor: place, search, intent, identity.
6. Chrome: Homes · Places · Market · Sell · About. Saved is an account affordance, not a nav word. CTA is **Value my home** / **Get my home's value**. Never the worth-question on a button.
7. One shop, five place rhythms: city, neighborhood, master-plan, plat, listing. Tetherow is the master-plan exemplar, not a one-off. A listing that looks like another product is a lock break.
8. Brand: navy `#102742` / cream `#faf8f4`, Amboqia + Geist. Voice: say the fact, then stop.
9. 390 is truth. Send test: would you text this URL to a buyer, a seller, or a referrer.
10. Fees: one 3% plan. Written CMA in 24 hours, every day. No save until contact exists.

Broker loops (copilot, closings, expired/FSBO) stay in Broker OS. This product **feeds** them. It does not rebuild them.

---

## How a person arrives

Locked Matt 2026-08-14 (his words, not a canvas):

> If they're coming in from Google or something like that, then we just let them go. We don't need to figure out what they're trying to do. It's only if they were coming in direct. Maybe they typed the name in, or we haven't seen them before. They have no record, and we can't tie them to any of our existing. We always want to try and map them back to who we have in the database so that it's kind of a full circle from their Google account to ours. If we don't know, if we don't have them as a visitor, then that's when we would want to capture their intent.

| Arrival | Known to us? | What they see | Intent we store |
|---|---|---|---|
| Google, ad, email, text, shared listing | Does not matter | The page they clicked. No quiz. | Inferred from the URL |
| Any source | Yes — `rr_vid`, person, Google email, prior session | **Welcome back · the thing they left.** No quiz. | Last intent. Resume. |
| Typed the name / bookmark / blank `/` | No — first browser, no person | Three words **in the page**: **Buy · Sell · Look** | Whatever they tap. Look is the site. |
| Continue with Google | Always try | Identity, not a quiz. Map email → `crm_people` + this `rr_vid`. | Keep what we had. Full circle. |

Look / just browsing kicks them into the site. We still count it. We do not invent a second workflow.

Welcome back names a thing (last house, last search, saved count). It does not say their name from a cookie. It is not an account tutorial.

Do not put a modal on land. Cookie is one interrupt. Sign-in already waits. A third overlay is how we already failed Quiet.

---

## The five jobs (what they are trying to do)

| They tap / they land | The job | First screen | Then |
|---|---|---|---|
| **Buy** / Homes / a listing | Find a home | Houses. Photo + price + beds/baths/sqft + street. Map bound to the list. | Filters (FlexMLS grain) + a sentence box. Listing. Save / alert / tour. |
| **Sell** / Value my home | Get the number, decide whether to sell | Address field. | Contact, written CMA in 24h, one 3% plan. |
| **Look** / Market / Places / About | Understand the place or the market, or who we are | The page they opened. | Doors into homes or Value my home, after the answer. |
| **Places** grain | Evaluate this place | City = this city's houses. Neighborhood = this place's pace, then houses. Master-plan = owned photo, child polygons, pins. Plat = list of its homes. | Daily life on neighborhood. Membership number on master-plan. See-all stays on the page. |
| **This house** | Decide on this listing | This house's media. Dense facts. | HouseMe-shaped report from our stamp. Sticky broker. Map popup is a photo + facts. |

Continuity (already locked in IA, never built as product):

- Place follows: Tumalo → Homes arrives pre-filtered to Tumalo.
- Search follows: filters survive listing and back.
- Intent shades next steps: seller sees Value / CMA exits; buyer sees save / alert. One primary per viewport.
- Identity upgrades in place. Attribution cookie survives every hop.

---

## The cube (Aug 10 — this is the reporting product)

Matt, 2026-08-10, his words:

> We're just scratching the surface of what's available in terms of our data reporting. The fact that we can really go deep into all sales in Central Oregon is something that I feel like we're not really leveraging.
>
> Overall market: what it consists of. What was it in 1990, whatever our first year was, versus now. $2 million versus $3 billion. What components: single-family, multifamily.
>
> How many homes with fireplaces sold in 1998. That level of detail. Model it. Expose it on the site.
>
> Unique searches. Build market reports and analysis off of that. Competitor share: which brokerages do the most deals, which brokers inside them. Fast. No bottlenecks. You are the expert. Take it further.

That is not a market-page decoration. It is the warehouse product. Pulse and `market_stats_cache` answer “this place, this month.” The cube answers “the whole market, any year, any cut.”

### What exists (do not invent `sales_cube_*`)

Plans still say `sales_cube_annual`. Those tables were never created. The shipped cube is:

| Name on disk | Grain | Reader |
|---|---|---|
| `analytics_mart_market_annual` | year × geo × `type_scope` → count, `$` volume, median, type mix | `getCoMarketAnnual`, `getCoMarketAnnualSeries` |
| `analytics_mart_feature_annual` | year × geo × type × `feature_key` | `getCoFeatureAnnual` |
| `analytics_mart_office_share_annual` + dims | year × office/agent | `getCoOfficeShare*`, `getCoAgentShare` — **admin only** |
| `analyze_closed_sales_co` + `analytics_result_cache` | constrained unique search | `analyzeClosedSales` |
| `analytics_v_closed_sale_co` | closed fact **view** (no `details`) | rebuild script only |

Rebuild: `scripts/analytics/rebuild-analytics-marts.mjs`. Cron `/api/cron/rebuild-analytics-marts` — **last 2 calendar years only**.

Live on site today: `/housing-market` size strip (2024: **5,707 closes / $3.931B**, 0% vs EDA), `/housing-market/central-oregon` series **1998–2024**, `/housing-market/history` explorer, `/admin/analytics/competition`. Matt lock I6: no competitor names on the public site.

### What does not work yet (vs the ask)

| Ask | Today | Gap |
|---|---|---|
| Then vs now from first thick year | Public series starts **2016**. EDA floor is **1998** (1990 = 0 rows). | Marts not backfilled 1998–2015 |
| Fireplaces sold in 1998 | Feature mart is **2016–2025**. Explorer can RPC a 1998 filter. | 1998 is not a cube cell. A request can still hit the RPC. |
| Unique search + reports off the model | History explorer exists. Report factory and CMA do **not** read the marts. | SI-6 embeds missing on city / sell / listing. CMA still on `sale_pricing_facts` only. |
| Competitor share | Admin desk live. | Public stays locked. Entity `office_id` still residual at rebuild. |
| No request-path aggregation | `getCoMarketAnnual` still has a **24h live `listings` fallback**. | Violates the cube lock. Kill it. |
| Fast, no bottlenecks | Nightly last-2-years only. | Need one-shot 1998→now rebuild, then weekly full from floor. |
| Docs agents actually read | `DATABASE_FOR_AI_AGENTS.md` omitted the marts until this session. | Next agent will re-plan `sales_cube_*` unless they read the lookup table. |

### Remaining units (this is the work)

A unit is done when the command has been run in this session, the printed number matches the page, and there is no `source: 'live_aggregate'` on that path.

1. **Backfill the mart 1998–2015.**  
   `node scripts/analytics/rebuild-analytics-marts.mjs --from 1998 --to 2015`  
   Region + REPORT_CITIES, every `type_scope`, feature keys fireplace/garage/association.  
   Accept: `SELECT year, sold_count, total_volume FROM analytics_mart_market_annual WHERE geo_slug='central-oregon' AND type_scope='all' AND year=1998` returns a row. Fireplace 1998 is a row in `analytics_mart_feature_annual`. Print both. Same numbers on `/housing-market/history?year=1998`.

2. **Public then-vs-now uses the floor.**  
   Change `CLOSED_SALES_FROM_YEAR` from 2016 to **1998** in `app/housing-market/central-oregon/_v3/region-constants.ts` (and any hub copy that says 2016). Series reads the mart only.  
   Accept: `/housing-market/central-oregon` chart starts 1998. 2024 still 5,707 / $3.931B.

3. **Kill the live listings fallback** on public cube reads.  
   `getCoMarketAnnual` / series: if the mart row is missing, render empty + source line, do not scan `listings`.  
   Accept: grep `live_aggregate` unused on those public callers.

4. **Rebuild schedule matches the warehouse.**  
   Nightly last 2 years stays. Add weekly full from 1998 (same script, advisory lock). Heartbeat fails if 1998 region `all` is missing.  
   Accept: cron registered in `vercel.json`; one successful weekly job log.

5. **Place and listing read the cube.**  
   City / neighborhood Instrument and the listing report pull `getCoMarketAnnual` / `getCoFeatureAnnual` for that geo when a mart row exists. Pulse stays the live HUD. Do not mix SFR pulse with all-type volume without a label.  
   Accept: Bend city page shows 2024 all-type volume from the mart, labeled. Listing HouseMe block can show this place’s median from pulse **or** this year’s mart — each labeled.

6. **Reports and CMA read the same model.**  
   Market-report blog and CMA market board call the mart DAL, not ad-hoc `listings` sums. `content-market-claims.mjs` already gates blogs — keep it.  
   Accept: one CMA rebuild printout cites `analytics_mart_market_annual` for the community/city year figure.

7. **Show it like Tremor.**  
   `/housing-market`, `/housing-market/history`, `/housing-market/central-oregon` use Tremor KPI + chart blocks on the mart rows. Same shop as the rest of the site.  
   Accept: 390 screenshot. The $ volume and the composition are the first screen, not a caption under cream.

8. **Admin share stays admin.**  
   Competition desk keeps names. Public never lists competitor brokerages. Finish `office_id` on rebuild when touching the script.  
   Accept: I6 still holds on a public grep.

Do not create `sales_cube_*` tables. Do not aggregate raw `listings` on a public request. Do not publish 1990 (zero rows). Do not call this 10× — alerts were still 6 when the marts shipped.

---

## How data is shown (the stamped look)

| System | Where | What |
|---|---|---|
| **PropXYZ** | Home, city, ZIP, browse | Photo + price + beds/baths/sqft + street on the first screen. Map + list bound. |
| **Tremor** | Market, neighborhood open, listing analysis | KPI cards, charts, dense tables. Skin navy/cream. Cache only. |
| **HouseMe** | Listing after the hero | Over/under or honest refuse. Comps *n*. $/sqft. DOM vs this place. True Cost from real fields. Investment lens only when a rental figure exists. No invented 0–10. No 5-year %. |

`PUBLIC_UI.md` Stripe/Linear density is revoked for Field and Instrument. Six section types stay.

Classic search and sentence search are both product. A sentence ("3 bed under 800 in Tetherow") writes the same URL params the filters already understand. No chat bubble. "No chatbot" meant: do not bolt a widget on and call that AI. Make the real page citable.

---

## How they become a client (the machine, never acting like it)

Capture happens after the page did its job.

| Door | What we take | What we do not |
|---|---|---|
| Value my home | Address, then email required, phone optional, Google/Facebook continue. No save until contact exists. | Orphan address leads. A second `/sell/valuation` spine. |
| Save / alert | Email. Current search context, never a blank form. | A quiz. |
| Continue with Google | Identity + optional comms **on the same card**, before they leave for Google. | A second "Almost there" page. Treating the Google click as SMS consent. |
| Contact / tour | The listing they were on. This broker. | A generic form that forgets the house. |

**Google card (locked direction, Aug 14):** Continue with Google. Optional number. Unchecked email box. Unchecked carrier SMS sentence. They can tap Google with nothing checked and still get the account. Persist checks across the redirect. Kill the CMA second screen once that cookie exists. Consent is not the price of the site or the report.

A buyer who opts in gets listing and search mail, not seller drips. A seller gets the report path, not buyer alerts. Look gets a quiet market note only if they asked.

Looking at a specific home wakes the broker phone like a new lead (`{name} is looking at {address}.`). We ask the lead first, then a **buyer** packet — never a seller CMA.

---

## How we know (analytics, SEO, both boards)

Dialed means measured, not claimed.

**First-party (ops truth):** `visitor_sessions` + `visitor_events`.

| Event | When | Dimensions |
|---|---|---|
| `intent_declared` | They tapped Buy / Sell / Look, or we inferred from the URL | `intent` = buyer \| seller \| look. `source` = inbound \| return \| unknown_direct \| tap |
| `welcome_back` | We named the thing they left | Thing = house \| search \| saved \| none |
| `identified` | Google/email/phone stitched to `crm_people` | Match tier: login \| they-gave-it \| browser |
| `email_opt` / `sms_opt` | Boxes on the Google card or a form | Intent at opt-in |
| Existing trail | Page views, listing views, saves, valuation starts | Already on `intent_tags` from path. Keep it. |

**GA4 (Google board):** the same events and a user property `intent`. Audiences: `returning_buyer`, `returning_seller`. Do not stamp CRM buyer from a cookie alone.

**SEO / GSC / LLM (Loop F, already a process):**

- One survivor URL per job. If a seller query lands on `/`, fix what we submit to Google. Do not add a quiz.
- Indexable, canonical, JSON-LD, internal graph, cut-list 301s. Sitemap does not submit `/lp/*`.
- `/llms.txt` + open AI robots. Test queries must cite a real Ryan Realty page:
  - best broker in Bend
  - 3-bedroom 2-bath in Northwest Crossing
  - Get my home's value in Bend
- GSC daily snapshot is the scoreboard. Slipping queries get a class fix.
- Ads stay parked. When they return they land on the same spines.

Scoreboard we actually watch: resume rate (returner opened last house), stitch rate (anonymous session later attached to a person), opt-in rate on the Google card vs sign-in count, qualified leads / week, non-brand money-query clicks. A high sign-in with a low opt-in means identity worked and comms is still a second process.

---

## Already built. Do not rebuild.

- `rr_vid`, `intent_tags`, VisitTracker, UTM / gclid, agent attribution, person identity bridges.
- Browse split map + list. FlexMLS-grain `SEARCH_FIELDS`.
- Home tiles already compute `meta`. V3Field draws it on rows, not on the photograph.
- Listing already loads `getListingPricingRead`. It is a range + a sentence, not a report.
- Market already has Instrument + Recharts + cache.
- City map impl exists. First paint is an empty cream box.
- `/llms.txt`, sitemaps, GSC ingest, dual-objective inventory.
- Valuation spine, 3% plan, written-CMA process. `skipPartialLead` exists and is not wired on `/sell`.

---

## Order (the product, in this sequence)

After every public-UI step: recapture home, browse, city, neighborhood, Tetherow, a plat, a listing, sell, market, about at 390 and 1280. Shared `V3Field` is how the last flatten spread. Worse on any of those → revert that step.

### 1. Arrival and memory — shipping

Buy · Sell · Look only on blank unknown direct. Welcome back names the last thing. Stitch Google email / `rr_vid` / person before any ask. Fire `intent_declared` and `welcome_back` to first-party + GA4. No modal.

### 2. Field cards and maps (Buy)

Draw `meta` on the photo. Lead house fills the fold. City/ZIP poster until Google paints. Browse looks like PropXYZ. Sentence search writes existing params.

### 3. Place grains

Neighborhood: Tremor pace, then houses, daily life on the first path. Master-plan (Tetherow first, then the other resorts): owned photo, child polygons, pins, membership number, see-all on the page. Plat: list of homes. Resort list on every grain. Place context follows into Homes and Market.

### 4. This house

HouseMe report from the stamp. Sticky this-listing broker. Map popup = photo + facts. Looking-at wakes the phone. Buyer packet, not seller CMA.

### 5. Market

Tremor density. One block. MoS verdict matches the number. Chart under the job.

### 6. Sell

Address first. Wire `skipPartialLead`. Kill leftover worth-question copy. One spine. Low-contrast tabs fixed.

### 7. Continue with Google is the comms door

One card. Persist consent across redirect. Kill CMA Almost there. Intent chooses the sequence.

### 8. About + leftover

Three faces, Call and Text. Reviews as written. Scoped open houses. No mystery search square. No `?`.

### 9. Both boards, used

Prove the three citation queries. GSC slipping class. Dual-source intent audiences. Resume / stitch / opt-in on a real scoreboard, not a claim in a plan.

---

## Done

A stranger who types the name sees Buy · Sell · Look and can start. A Google click is not interrupted. A returner is welcomed with the house they left. A buyer sees houses and facts. A seller sees an address field. A listing tells them what the number means. Analytics can say buyer vs seller vs look, new vs returning, inbound vs direct. Google and ChatGPT can cite a real page. You would text the URL.

A green ledger does not count.

---

## End-to-end mission (2026-08-15)

The argument is PRODUCT.md. Done means a real person can walk the site and do the job. A green ledger does not count.

**When finished, a stranger can:**

1. Type ryan-realty.com with no cookie and see Buy · Sell · Look in the page, not a modal. Google / ad / email land is not interrupted.
2. Come back and see the last house or last search named. Analytics records `intent_declared` and `welcome_back`.
3. Buy: houses fill the fold (photo + price + beds/baths/sqft + street). Map and list are the same homes. A sentence writes the same filter params the chips already understand.
4. Open a place and stay in that place: Homes and Market keep the filter. Master-plan shows the owned photo, membership number, child plats, and every home on the page. Plat lists its homes.
5. Open a listing and read a HouseMe-shaped report from our stamp. Sticky broker is this listing's broker. Map popup is photo + facts. No invented 0–10 or 5-year %.
6. Open Market and see 2024 all-type volume and composition first. Months of supply verdict matches the number. Charts use `V3Chart` / `AChart` / print SVG. No second chart library.
7. Sell: address first, no orphan address save, one 3% plan, no worth-question on a button.
8. Continue with Google: identity plus optional comms on one card. CMA does not say Almost there.
9. About: three faces, Call and Text. Open houses are scoped. No mystery search square.
10. Google and ChatGPT can cite a real page for: best broker in Bend · 3-bedroom 2-bath in Northwest Crossing · Get my home's value in Bend.

**Bar:** production READY on `origin/main`, ten-page strip recaptured at 390 and 1280, numbers from the mart or pulse with a source line. Field stays photography. Public stays navy/cream. Admin stays Inter.

**Will not do in this mission (named stops):**

- Outbound looking-at SMS or buyer-packet send — CLAUDE.md §1, per-action approval. The ask can exist. The send cannot.
- Ad spend. Ads stay parked.
- Competitor names on the public site (I6).
- Page-grade. New Public Product OS. Tremor npm. PropXYZ purchase.

**Progress** is the table under Order. Update it when a step is live on production, not when a file exists.
