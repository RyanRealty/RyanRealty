# Voice reader — long-form notes (2026-09-22, HEAD 83a459c, read-only)

Scratch: this directory. Harvested production copy (Playwright innerText, Chrome UA, ignoreHTTPSErrors) in `<slug>.txt`;
server-rendered HTML for `/`, `/subdivisions/ridge-at-eagle-crest`, `/cities/bend/awbrey-butte`, `/listing/220222277`,
`/team/matthew-ryan` in `*-raw.html`. Competitor text in `competitor-*.txt`. Scripts: `harvest.mjs`, `harvest2.mjs`,
`scroll-test.mjs`, `brokers.mjs`, `classsize.mjs`. `git status --short` empty at finish. No MCP tools used.

## 0. What VOICE.md asks for (the bar)

`marketing_brain_skills/brand-voice/VOICE.md` (64 lines, Matt 2026-09-07): warm, direct, specific, "you/we", helpful first,
normal punctuation, no word lists, no mechanical gate. Exemplars: Matt bio, listing post, market line, homepage lead
("Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Local experts, live listings, and a team that takes care of you.").
`brand-voice/SKILL.md` is 9 lines: "Read VOICE.md and write in that voice. No mechanical checks."

## 1. Harvest results (13 pages)

| page | status | chars | notes |
|---|---|---|---|
| / | 200 (after retries) | 11,172 | first Playwright attempt `ERR_TOO_MANY_RETRIES`; scroll-test: 2 of 3 loads returned "upstream request failed" |
| /buy | 200 | 10,913 | |
| /sell | 200 | 7,715 | |
| /about | 200 | 6,674 | console: one 502 resource |
| /team | 200 | 3,717 | |
| /cities/bend | 200 | 51,133 | |
| /cities/bend/awbrey-butte | 200 | 20,225 | |
| /communities/tetherow | 200 | 14,012 | |
| /subdivisions/ridge-at-eagle-crest | **502 first attempt** ("upstream request failed"), 200 on retry | 21,366 | |
| /cities/bend/types/single-family | 200 | 14,776 | |
| /listing/220222277 | Playwright failed twice (proxy retries); curl 200, 948 KB | 25,590 | |
| /housing-market/bend | 200 | 8,156 | |
| /price-drops | 200 | 11,885 | |

Every page logged `Refused to apply style … MIME type ('text/plain')` for `_next/static/chunks/*.css` and
`ERR_TOO_MANY_RETRIES` on some chunks. That is at least partly the sandbox proxy; I did not verify it from a clean network.
The 502s are server responses ("upstream request failed" body), observed 4 times across ~22 loads in 40 minutes.

## 2. Worst lines per page, and why they fail VOICE.md

**/ (home.txt)**
- `Tetherow · Bend · 0 homes for sale · $0 median list price · 0 homes sold, last 30 days · 0 new this week · 0 days to an offer` (lines 265-274, and for all 9 community cards; "0.0 days to an offer" on Awbrey Glen). A number no one would print. Server HTML also carries `$0` and `0` in `home-featured-community__figure-value` spans and `houses for sale 0` in Browse places. Mechanism in §4.
- `Sunriver sits 15 miles south of Bend on the east bank of the Deschutes River, on land that started out as Camp Abbot, a U.S.` (line 370): sentence cut at "U.S." by `firstSentence`.
- `Oregon Data Share via MarketPulse. Alias-aware active inventory and median list for each resort community.` (line 396; `app/_v3/home-featured-community-shared.ts:28`): internal names on a public source line.
- `SELLING IN CENTRAL OREGON` eyebrow over `Homes for sale in Central Oregon` H1 over `What is your home worth?`: three different intents in three lines; the VOICE.md homepage lead is not on the page.
- `Written valuation in 24 hours` (`app/page.tsx:186`, hard-coded): a timeline with no named basis (§0, 2026-07-29).

**/buy (buy.txt)** — mostly good. `1,419 houses for sale right now · $749,900 half the houses ask more · 31 days to an offer, last 90 days` is a human way to say median. Guide cards ("what nobody tells you about winter") read like a person. Weak: `From this page` as an H2; `Next step` eyebrow.

**/sell (sell.txt)** — the best page. `Everything your home needs to sell well is in the plan…` and the FAQ answers sound like Matt. Weak: `THE RECORD` eyebrow printed twice (lines 36-38); `Not a selection.` opener; `Days the average home has been listed 102` (active-set age published beside pace figures); process numbers without a basis: `Email to 300 nearby homeowners`, `Printed mailers to 200 neighbors`, `Outreach to 50 top agents in Portland, Seattle, LA and SF`, `Typically 5 to 7 business days`, `Professional photos happen within 48 hours`.

**/about (about.txt)**
- H1 `About Ryan Realty · Bend` (a middle dot in an H1).
- `Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.` (`app/about/_v3/about-constants.ts:35`, a Matt lock 2026-09-14). "their properties" is not how Matt talks; VOICE.md's own line is "Local experts, live listings, and a team that takes care of you."
- `The brokers are on /team.` (about-constants.ts:89): a URL path in a FAQ answer, and it is emitted as FAQPage JSON-LD.
- `The full conversation continues on Contact.`; `Reach list`; `27 places on this map.`; `+ 19 more+ 3 more`.
- Atlas pulse: `Just listed in PrineVille - Second, $195,000` (raw MLS subdivision casing), `Went pending in Bend, $162,000`.
- The one warm paragraph (`How it started`, Red Erickson) is below two carousels and a map.

**/team (team.txt)** — H1 `The brokers`; the page has no sentence about any broker. `Oregon license 201206613`, `8 closings in the last 12 months`, `1 home for sale right now`, `26 closings.`, `+ 3 more+ -13 more` (negative count; `components/site/v3/V3Atlas.client.tsx:2468-2471` subtracts CHIP_FOLD_AT without clamping). The `brokers` table holds bios of 866/899/1,059 chars (verified through the audit helper, 3 rows) and they read like VOICE.md; they render only on `/team/<slug>` (curl of /team/matthew-ryan contains "Matt Ryan is the owner and principal broker…"). The index deliberately omits them (`app/team/page.tsx:9-20`, SITE-113/166).

**/cities/bend (cities-bend.txt)**
- H2 list: `Bend`, `Bend`, `…`, `Bend` (four bare place-name H2s), `Run the number both ways`, `Where to next`, `Explore other cities`.
- `Move either number below and the other one follows.`, `The middle of this market is above your number. The homes under your ceiling are the ones to look at.` (calculator copy talking about itself).
- `how we calculate this` 14 times on one page.
- Trails: `Sawyer Park spreads across 53 acres on both sides of the Deschutes off O.B.` (cut at "O.B.").
- Good: `Bend is the largest city in Central Oregon. It sits on the Deschutes River with the Cascade Range to the west…` (authored).

**/cities/bend/awbrey-butte (cities-bend-awbrey-butte.txt)**
- `Source Median asking price $1 how we calculate this` (line 586; also in server HTML as `v3-source__name`): the source string is `Median asking price $1,312,500,, …` (`lib/place/publish-place-affordability.ts:121` ends the first item with a comma, then `.join(', ')`), and `sourceNameFromTrace` (`components/site/v3/V3SourceLine.tsx:112-124`) cuts at the first comma, so the visitor reads "$1".
- `Source market_metric financing_mix how we calculate this` (line 599; SSR `v3-source__name`): a table and column as the source name.
- H2 `Hear about new listings in Bend the day they hit the market.` on an Awbrey Butte page (the alert is city-wide; the copy admits it two lines later).
- `Awbrey Butte questions, answered with the number` (templated H2 on three grains).
- Good: `Ask what Awbrey Butte actually offers and the answer is elevation…` (authored JSON, `data/resort-community-bend-awbrey-butte.json`); the build-year/HOA sentences are honest and readable.

**/communities/tetherow (communities-tetherow.txt)**
- `Tetherow has had fewer sales we can attribute to it on its own than a fair buyer's or seller's verdict needs, so we are not printing one.` under the gate-mandated question `Is Tetherow a buyer's or seller's market?` — the page asks a question it then declines to answer, on the two thin grains I looked at (Tetherow, Ridge).
- `Tetherow Where Resort Living Meets Real Estate` / `…Here is what that actually means for your wallet and lifestyle.` — the reading row is a seeded blog spotlight (`scripts/blog-content/community-spotlights.ts:580-595`, hero image from Unsplash).
- `The courts are the fastest-growing social engine at the resort after the clubhouse itself.` (amenity copy in a brochure register).
- Good: the about_prose paragraphs (Solomon Tetherow, David McLay Kidd, Awbrey Hall fire) are specific, sourced and human.

**/subdivisions/ridge-at-eagle-crest (subdivisions-ridge-at-eagle-crest.txt + ridge-raw.html)**
- `The middle asking price of the 0 homes for sale in Ridge at Eagle Crest is $0. Select a band to see how many sit in it.` (line 130) — **in the server HTML** (`ridge-raw.html`), beside `88 homes for sale in Ridge at Eagle Crest` (3×) and `Asking prices of all 14 homes for sale in Ridge at Eagle Crest` (2×). Three counts of "homes for sale in Ridge at Eagle Crest" on one page, one of them zero.
- H2 `RIDGE AT EAGLE CREST RIGHT NOW` (all caps), `6 houses came on the market in Ridge at Eagle Crest in the last 30 days.` as an H2, `Eagle Crest at Ridge Hawk a Condominiums Stage I` (raw plat name), `Each one is recorded under its own MLS subdivision name.`
- `20 homes came off the market … the middle one ran 206 days, and 16 of them cut the ask first, a median of 4.3%.` — dense but honest.

**/cities/bend/types/single-family** — H1 `Single-family in Bend` (fragment) under a title that says `757 single-family homes for sale in Bend, Oregon`; H2s `Listings on the map`, `HOMES FOR SALE`; one prose line on the page (`757 homes ask $379,500 to $2,125,000 for nine in ten.`). The same day `/housing-market/bend` and `/sell` say `581 detached homes for sale` in Bend.

**/listing/220222277 (listing-220222277.txt)**
- `Source leftover membership` (SSR `v3-source__name`) and `Market Truth (market_metric, detached): median days from listing to contract…` (`lib/listing/publish-listing-pill-read.ts:84`), and the RSC payload's `source` field `public.market_metric · stat_id=pct_with_price_cut · geo_type=city …` — engineer traces where the visitor reads.
- `117 days listed is about 4.7 times the 25 a typical Bend home takes…` — "about" in a figure sentence.
- H2 `This home's price sits 42.8% over the Bend median list` and H2 `In Bend, 46% of the homes that sold in the last 12 months had dropped their price before a buyer said yes.` — full sentences as H2s, good claim-first form; but `Cut before they sold46%of every 100 homes that sold` runs together.
- Good: `Sellers move on price more often than they move on anything else. Leave your email and we will tell you the day this one changes.`

**/housing-market/bend**
- `In August 2026 the middle house in Bend sold for $750K. A year earlier, in August 2025, it was $795K, −5.7%, less than the same month last year. Drag across the lines to read any other month.` (`app/housing-market/[...slug]/_v3/CityInsight.client.tsx:229`): a sentence with a stray "−5.7%, less than".
- `You are on the Bend housing market report. The live hub and Central Oregon region report are separate pages.` (`geo-figures.ts:435`); `Cities not in the table above` / `Tumalo has no published active single-family count.` (`hub-sections.ts:92`); `What each report is` / `Where you are`.
- `homes for sale vs a month of sales` subhead; `About 3.3 months of homes on the market.`

**/price-drops**
- Rows: `Bend · Oww`, `La Pine · DrrhLp`, `Redmond · Aspen Creek Mob Pk`, `Bend · Deschutes River Trac`, `Bend · Inn Of The 7th` — raw MLS abbreviations. `app/price-drops/_v3/drops-field-items.ts:66` uses `displaySubdivision` (`lib/slug.ts:34`, sentinel filter only), not `publishPlatDisplayName`; `scripts/check-publish-place-names.mjs` was founded on exactly "Oww / DrrhTrs" but only pins the subdivision route.
- `Hover, tap or tab another cut for its home and dollars.` (`drops-drawing.ts:88`); H2 `The window`; `Recovered and relisted prices stay off this list.`

## 3. Where the copy comes from (storage model)

1. **Hand-authored JSON with sources** — `data/resort-community-*.json` (27 files: 13 Bend neighborhoods + 14 resort communities), `about_prose[]` + `sources[]`. Best copy on the site. Loaded by `lib/resort-community-content`, first sentence reused on `/` (`app/_v3/home-featured-communities.ts:113-130`) and cut by `firstSentence` (regex `^.+?[.!?](?:\s|$)`).
2. **Route-local constants** — `app/about/_v3/about-constants.ts` (firm story lock, FAQ), `app/page.tsx` doors ("Written valuation in 24 hours"), `home-featured-community-shared.ts` source line.
3. **Sentence generators (TypeScript, interpolated numbers)** — the bulk of place copy across ~3,400 subdivision + 28 neighborhood + city/community pages (`boundaries` rows: 3,427 subdivision, 28 neighborhood, via helper):
   - `lib/site/place-answers.ts` (cited Q&A; question templates pinned by `ci:market-question`), e.g. `${place} has ${shown} months of supply, which is a ${kind} market.`, `Half the ${place} homes that went under contract in the last 90 days did it inside ${days} days.`, `Put your street address into the value field at the top of this page…`
   - `lib/site/market-faq.ts` (prose FAQ + JSON-LD), e.g. `There are ${n} active single-family listings in ${geoName} as of ${label}.`, `Yes. Estimated annual HOA fees in ${geoName} start around $${hoa}…`, `${geoName} includes ${aliases}… marketed under the ${geoName} community umbrella on the MLS.`
   - `lib/site/place-faq-extras.ts` (SITE-172 extras), `lib/site/place-recreation.ts` (parks/trails lines), `lib/place/publish-place-affordability.ts` (calculator + source lines), `app/subdivisions/[slug]/_v3/plat-caption.ts` (four "grammars": `${name} is one of ${resort}'s subdivisions. ${n} of its homes are for sale right now, and the typical one is asking ${asking}.`), `subdivision-traces.ts` (five population traces), `app/_v3/home-pulse.ts` (claim reduced to `Central Oregon right now.` after Matt 2026-09-15), `lib/listing/publish-listing-pill-read.ts`, `app/housing-market/[...slug]/_v3/geo-figures.ts`, `app/price-drops/_v3/drops-drawing.ts`.
4. **Seeded blog posts** — `scripts/blog-content/community-spotlights.ts` (20 hand-written seeds → `blog_posts`), surfaced as "area guide"/reading rows on community pages. Unsplash hero images. Portal-guide register.
5. **Supabase `brokers.bio`** — three real bios, rendered only on `/team/<slug>`.
6. **Grok at runtime** — not used for public place copy (`lib/grok` imports in place routes: only `app/communities/[slug]/_v3/place-value-actions.ts`). No `place_content`/`site_copy` table exists in the schema snapshot.

So: copy is templated across thousands of pages from ~10 generator files, with hand-authored prose for 27 places and constants for the firm pages. There is no single file a person can read to see every sentence the site is able to say.

## 4. The zero-figure mechanism (p0)

`components/motion/number.tsx` (beUI `AnimatedNumber`) defaults `settleOnMount=false`; the server face is `format(0)`. Its own doc comment says: "a market page ships '$0 median list price' in its HTML and only becomes true after hydration … in front of a crawler". 13 `<AnimatedNumber` usages in app/ + components/; 5 pass `settleOnMount`; five files never do: `app/_v3/HomeBrowsePlaces.tsx`, `app/_v3/HomeFeaturedCommunity.client.tsx`, `app/cities/[slug]/_v3/CityInsight.client.tsx`, `app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodInsight.client.tsx`, `app/subdivisions/[slug]/_v3/SubdivisionInsight.client.tsx`. `V3Number` wraps it with `settle=true` by default but these islands bypass V3Number.

Evidence: `home-raw.html` has `<span class="tabular-nums home-featured-community__figure-value">$0</span><span …label">median list price</span>` and `houses for sale 0`; `ridge-raw.html` has `The middle asking price of the 0 homes for sale in Ridge at Eagle Crest is $0`. Rendered DOM in headless Chromium after scrolling still shows 9 cards at 0/$0 (`scroll-test.mjs`), so the count-up did not settle in that environment either (chunk loads through the sandbox proxy failed; whether Googlebot's renderer settles is UNVERIFIED — recommend Search Console URL Inspection → rendered HTML on `/` and one `/subdivisions/*`).

## 5. Mechanical rules that still shape copy (post 2026-09-07)

| rule | file | effect on voice | conflicts with 09-07? | needed for another reason? |
|---|---|---|---|---|
| No U+2014 / ` -- ` in public copy | `scripts/check-no-public-em-dash.mjs` (22 hand-listed roots + manifest) | neutral | No: Matt re-locked 2026-09-20 | Matt lock. Coverage gap: 58 U+2014 hits remain in lib/site, lib/place, app/subdivisions, app/communities, app/listing, components/site/v3 (mostly §0 report traces); visible text had 2 em dashes across 13 pages |
| Naked-verb headings (closed list of 10) | `check-naked-verb-headings.mjs` | small help; cannot catch "Bend"/"The window"/"Reach list" | no | keep, cheap |
| "Is {place} a buyer's or seller's market?" on 6 grains | `check-market-question-heading.mjs` | forces the question onto grains that then say "we are not printing one" (Tetherow, Ridge) | Matt 2026-08-26 ruling; predates | SEO intent; ask Matt about thin grains |
| BANNED_WORDS regex (stunning, nestled, boasts, delve, tapestry…) + BANNED_PUNCT | `check-market-narrative-integrity.mjs:79-80`, scope `lib/data/market/market-narrative.ts` only | harmless | yes, contradicts "no word lists"; keep the number check (part A) | §0 part A is the value |
| `placeHomesForSaleHeading` refuses "every home for sale in" | `lib/place/place-homes-heading.ts` | Matt 2026-09-18 | no | fine |
| TITLE_BUDGET / cleanTitle | `lib/site/page-metadata.ts` | neutral | no | SEO |
| Display-heading font ratchet | `check-heading-display.mjs` | none (font only) | no | design |
| `v3Text` non-empty brand | `components/site/v3/atoms.tsx:99` | none | no | a11y |
| `// brand-voice:exempt` markers (10 files) | dead annotation for a deleted gate | none | residue | delete |
| `.claude/hooks/pre-tool-use.mjs` | no copy rules (grep) | — | — | — |

## 6. Accept test / taste rubric / catalog-demo rule and copy

- `.claude/skills/site-queue/SKILL.md` accept test (lines 55-80): 1 catalog installed and imported, 2 tokens, 3 nothing gone (content floor incl. **words**), 4 score. No voice criterion. The content floor counts words, which rewards adding sentences.
- `design_system/public/TASTE.md` rubric: design 30 / originality 30 / interaction 15 / craft 15 / honesty & function 10. Copy appears only as the tell "raw slugs, internal labels, methodology jargon" and "a figure with no plain sentence beside it". The evaluator prompt (`taste-evaluator.v1-2026-09-12.md`) is scored on screenshots (`shotsHash`); nobody reads the text. `taste-rule-freeze.json` forbids changing the rubric without a full table re-run.
- Catalog demo match: the 2026-09-08 taste pass on /team named the missing bios itself; the fix (SITE-113/166) installed AvatarGroup + carousel + map and kept the bios off the index. Three UI-copy examples that read as catalog-demo rather than Central Oregon: `Reach list` (Atlas chip label), `Select a band to see how many sit in it.` / `Drag across the line for any year, or switch it to the running total.` (insight cards), `Hover, tap or tab another cut for its home and dollars.` (price-drops drawing).

## 7. Competitors (tone contrast)

- Compass West Village guide (fetched 200): short sensory declaratives, no numbers: "Lazy strolls along the tree-lined streets, stylish cafes, and gastropubs at every criss-crossed corner." / "It feels like every resident has a favorite coffee shop, pub, or stoop to pass the time on."
- Brooks Resources NorthWest Crossing (200): origin story with names and dates ("Mike Hollern… Mike Tennant… Bill Miller… 486 acres", the Mixed-Use Overlay Zone, the 2007 marketing shift). This is what our about_prose already does well and what the generators cannot.
- Tetherow resort "Live" page (200): brochure register ("striking styles… honor Central Oregon's rich history").
- Redfin returned a Bellevue/South San Francisco page to this proxy (UNVERIFIED for Redfin's Bend tone); Cascade Sotheby's 403; Duke Warner 404; Zillow/Niche 403.
Contrast: our place pages out-specify all of them on figures and traces, and under-deliver on the one paragraph a person would read aloud. Where we have the paragraph (Tetherow, Awbrey Butte JSON) it is better than Compass; where we do not (3,400 subdivisions) the page is figures plus generator sentences.

## 8. Fair housing / §0

- No copy describing who should live somewhere was found in the 13 harvests. The listing's MLS remarks ("one of Bend's most desirable neighborhoods") are another broker's remarks shown as written (allowed).
- Numbers without a source line: `Written valuation in 24 hours` (`app/page.tsx:186`), `sends a price range within 24 hours` (about-constants.ts:107), `5 to 7 business days`, `within 48 hours`, `300 nearby homeowners`, `200 neighbors`, `50 top agents` (/sell). CLAUDE.md §0 (Matt 2026-07-29): a timeline is a number; named basis or it does not ship.
- Same-day disagreement under one reader label: `757 single-family homes for sale in Bend` (type page title/meta, "every active single-family home with a Bend address", read 12:45 PM) vs `581 detached homes for sale` (/housing-market/bend, /sell, pulse). Different populations, same words to a reader or an answer engine.

## 9. Proposal — how copy should be authored, reviewed and gated at 3,000-page scale

1. **One voice model, one sentence book.** Keep VOICE.md as the only voice doc. Add `marketing_brain_skills/brand-voice/exemplars/<page-class>.md` (home, city, neighborhood, community, subdivision, type, listing, market report, price-drops, about/team) with 3-5 real lines per slot: H1, opening sentence, figure sentence, source name, FAQ answer, ask/CTA, empty-state. Generators may only emit sentence shapes that appear in the exemplar file for their class; a new shape is a PR to the exemplar file first. Move every generator sentence into one `sentences.ts` per class so a person can read everything the site can say.
2. **A separate evaluator that reads the text, not the screenshot.** Per class, per round: innerText of the route (chrome stripped), scored on: reads like a person who knows Central Oregon; jargon/identifiers; template repetition (same phrase >2× per page); self-reference ("You are on…", URL paths); fragments/cut sentences; fake precision. Recorded as `voiceReview` beside `tasteReview` in parity.json, builder ≠ evaluator, same rise-floor discipline. Matt reads one page per class per round for 10 minutes; that is the review.
3. **Mechanical gates only where the rule is decidable:** (a) no `<AnimatedNumber` without `settleOnMount` outside `components/motion` (or flip the default to true); (b) `v3-source__name` must be reader-facing: deny `/(^|\W)(public\.|market_metric|_mv\b|stat_id=|leftover|[a-z]+_[a-z]+)/` and deny a name that is a truncated currency; (c) every visitor-facing subdivision label routes through `publishPlatDisplayName` (extend `ci:publish-place-names` to price-drops, atlas pulse, listing cards); (d) no URL path in prose (`/team`, `/contact`) outside `href`; (e) a per-page repetition budget for source-line boilerplate; (f) em-dash gate scans all public string literals in app/, components/site, lib/site, lib/place instead of a 22-path list.
4. **Delete:** `brand-voice:exempt` markers (10); BANNED_WORDS/BANNED_PUNCT in `check-market-narrative-integrity.mjs` (keep part A number check); the word-count component of the content floor as a voice proxy; the 20 spotlight seeds' Unsplash heroes and portal phrasing until re-edited; "questions, answered with the number" as a heading (say the place question instead).
5. **Surface the copy that already sounds right:** broker bio first sentence on /team index and /about; VOICE.md homepage lead on `/`; about_prose first paragraph (not first sentence) on the community cards; the 27 JSON place files become the pattern for the top 100 subdivisions by traffic, one paragraph each with sources.

## 10. Open questions for Matt — see findings.json
