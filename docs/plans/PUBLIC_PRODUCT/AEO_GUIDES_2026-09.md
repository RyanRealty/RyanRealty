# Buyer + seller AEO guide pack, 2026-09-07

Source brief: `~/Downloads/bend-buyer-seller-aeo-brief-pack-2026-09-07.md` (Cos, 15 ranked
page briefs). Site audit the same day: `~/Downloads/2026-09-07.md`. Both closed in one ship
class on `wt/aeo-briefs-audit-20260907`.

Publish path: `public.blog_posts` (rows upserted 2026-09-07 18:45 UTC), mirrored in
`scripts/blog-content/aeo-guides-2026-09.ts` so a reseed is a no-op. Six slugs already existed
and were rewritten in place; their old seed entries were removed from the sibling files so each
slug lives in one seed file. Author byline: Matt (`2fda6811-2edf-49e3-b3ca-33e1052f82e6`).

## Brief to slug

| # | Brief | Slug | Was |
|---|---|---|---|
| 1 | Cost of living | `cost-of-living-bend-oregon` | draft, unverified July figures |
| 2 | Best neighborhoods for buyers | `best-neighborhoods-bend-buyers` | new |
| 3 | Bend vs Redmond vs Sisters | `bend-vs-redmond-vs-sisters` | new |
| 4 | How to sell | `how-to-sell-your-home-bend` | published, unsourced cost figures |
| 5 | Cost to sell | `cost-to-sell-house-bend-oregon` | new |
| 6 | First-time buyer | `first-time-home-buyer-guide-central-oregon` | published |
| 7 | Buyer closing costs | `understanding-closing-costs-oregon` | draft |
| 8 | Westside vs eastside | `westside-vs-eastside-bend` | new |
| 9 | Good time to buy | `is-now-a-good-time-to-buy-in-bend` | new |
| 10 | How to price | `how-to-price-your-bend-home` | new |
| 11 | Property taxes | `property-taxes-deschutes-county` | draft |
| 12 | Moving from California | `moving-to-bend-from-california` | new |
| 13 | Buyer's agent | `buyers-agent-bend-buyer-broker-agreement` | new |
| 14 | New construction | `new-construction-guide-central-oregon` | published, false warranty claim + unsourced $/sqft |
| 15 | Selling from out of state | `selling-your-bend-home-from-out-of-state` | new |

## Conventions

- Every guide ends with `<h2>Questions</h2>` and five `<h3>question</h3><p>answer</p>` pairs.
  `lib/blog/publish-blog-faq.ts` reads exactly that markup into FAQPage JSON-LD on
  `app/blog/[slug]`, so the schema cannot say what the page does not.
- Market figures (median, $/sqft, days on market, months of supply, concession share) are never
  frozen in a guide. They link to `/housing-market/<city>`, `/months-of-supply`, or the July
  2026 buyers-market report, which carries its own method note.
- Voice: `lib/voice/check.ts` ran on every row before upsert (title, excerpt, meta, body).
  No dashes, semicolons, exclamation marks, virtue words, or invented quotes.
- Hero images reuse existing `/images/blog/*.jpg` files (local paths pass through
  `resolveBlogHeroImage`).

## Figure ledger (§0)

Every number that appears in a guide body, with the primary source fetched 2026-09-07. Raw HTML
saved in the session scratchpad (`verify/`, `verify2/`).

| Figure | Guides | Source |
|---|---|---|
| Oregon has no state real estate transfer tax; Washington County $1 per $1,000 is the exception | 1, 5, 7, 12 | ORS 306.815; washingtoncountyor.gov transfer tax page |
| Measure 50 caps maximum assessed value growth at 3% per year; tax is on assessed value | 1, 6, 11, 12 | oregon.gov/dor MAV manual 303-438 |
| Statements by Oct 25; pay by Nov 15 for 3%, two-thirds for 2%; thirds Nov 15 / Feb 15 / May 15; 2026 due date Mon Nov 16 | 11 | oregon.gov/dor pub 310-665; deschutes.org tax collection page |
| PVAB petition due Dec 31 or next business day | 11 | oregon.gov/dor appeals page |
| Deschutes Assessor 541-388-6508, 1300 NW Wall St, 2nd floor | 11 | deschutes.org/assessor |
| Recording fee $102 first page, $5 each additional, effective 2026-07-01 | 7 | deschutes.org/clerk recording page |
| Closing Disclosure at least three business days before consummation; lender fees zero tolerance; 10% cumulative tolerance class | 7 | consumerfinance.gov TRID guide |
| NAR practice changes effective 2024-08-17: no compensation offers on MLS; written buyer agreement before touring | 5, 6, 13, 14 | nar.realtor/the-facts |
| Oregon HB 4058 (2024): written buyer representation agreement before, or as soon as possible after, assisting a buyer | 13 | oregon.gov/rea 2024 law and rule overview |
| OREF 050 Buyers Representation Agreement | 13 | orefonline.com |
| FHA UFMIP 1.75%; annual MIP 0.55% for 30-year, under 5% down, loan at or under base limit | 7 | HUD mortgagee letter 2023-05 |
| VA funding fee 2.15% / 3.3% / 1.5% / 1.25%; disability compensation exemption | 7 | news.va.gov funding fee page |
| Senior and disabled deferral: 62+, income under $70,000 for 2026-27, five full years, 6% interest, lien | 11 | oregon.gov/dor deferral guide 490-015-1 |
| Disabled veteran exemption $27,092 or $32,512 for 2026, rises 3% a year, file by April 1 | 11 | oregon.gov/dor pub 310-676 |
| Oregon 2026 income tax rates 4.75 / 6.75 / 8.75 / 9.9%; 9.9% from $125,000 single, $250,000 joint | 1 | oregon.gov/dor pub 101-026 (2026) |
| No general sales tax | 1, 12 | oregon.gov/dor sales tax page |
| Property tax year July 1 to June 30 | 5, 7, 11 | oregon.gov/dor pub 303-619 |
| DIAL lookup at dial.deschutes.org | 1, 11 | dial.deschutes.org |
| OHCS Oregon Bond Residential Loan Program; First-Time Home Buyer Savings Account subtraction | 6 | oregon.gov/ohcs FAQ; oregon.gov/dor first-time home buyer page |
| Title insurance rates filed with DCBS before use | 5, 7 | ORS 737.205, 737.320 |
| Remote online notarization permitted for Oregon notaries | 15 | sos.oregon.gov RON page |
| Cascades East Transit fixed routes in Bend | 1, 8 | cascadeseasttransit.com Bend routes |
| ORS 701.320: contractor must make a written offer of a warranty on a new residential structure; no statutory term | 14 | ORS 701.320; ORS 12.135; ORS 701.560 |
| 13 Bend districts | 2, 8 | `lib/neighborhood-areas.ts` BEND_DISTRICTS |
| Bend to Redmond 17.1 mi / 26 min; Bend to Sisters 22.1 mi / 33 min; Bend to Mt. Bachelor 20.9 mi / 38 min, downtown to downtown | 1, 3, 6 | OSRM driving route, 2026-09-07 |
| Earnest money 1 to 3 percent typical in the Bend area | 6 | `/buy` FAQ (site canon) |
| 3% listing plan contents; weekly written report; remote-owner care | 4, 5, 10, 15 | `/sell` constants and `/faq` data (site canon) |
| Seller credits common in Bend; concentrated at the entry level; Redmond share above Bend, H1 2026 | 9, 10 | `bend-buyers-market-shift-2026` (Ryan Realty MLS analysis, July 2026) |
| Months of supply thresholds 4 / 6 | 9 | CLAUDE.md §0, `/months-of-supply` |
| Sisters rodeo (June), quilt show (July), folk festival | 3 | sistersrodeo.com, soqs.org, sistersfolkfestival.org |

Cut from the old drafts because no primary source was re-fetched this session: Freddie Mac rate,
AAA gas price, City of Bend utility rates, marketplace health premiums, ACS median income, Mt.
Bachelor pass prices, county average consolidated tax rate and effective rate, Crook and
Jefferson figures, active-duty exemption formula, VA appraisal fee, sample title premiums, and
every $/sqft, lot price, SDC, and build-cost range in the old new-construction post.

## Site audit fixes shipped with this pack

- Listing photo `alt` from address and city (`components/site/v3/listing-photo-alt.ts`), held by
  `ci:listing-photo-alt`.
- `/homes-for-sale` root: explicit robots, `og:type`, `og:site_name`, and WebPage + ItemList
  JSON-LD (`app/search/SearchRootJsonLd.tsx`), held by `ci:ai-structured-data`.
- Mobile menu group labels are `<p>`, not `<h2>`, so the page H1 is the first heading.
- `/buy` FAQ no longer says the seller offers buyer-agent compensation in the MLS.
- Not changed: the homepage `<title>` stays `Ryan Realty, Bend` (VOICE.md SEO split, pinned by
  `ci:seo-shell`). The audit suggested a keyword title. That is Matt's call.
