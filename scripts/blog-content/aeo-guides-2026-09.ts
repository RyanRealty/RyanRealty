import type { BlogPostSeed } from '../seed-blog-posts'

/**
 * Buyer + seller AEO guide pack, 2026-09-07. Fifteen guides from the keyword brief (docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md). Six of these slugs replaced older seed entries in the sibling files, so each slug lives in exactly one seed file. Every number in these bodies traces to the source named in that doc; dated figures carry their as-of date in the text.
 */
export const posts: BlogPostSeed[] = [
  {
    title: "Cost of Living in Bend, Oregon: Housing, Taxes, and a Realistic Budget",
    slug: "cost-of-living-bend-oregon",
    category: "Relocation Guides",
    tags: ["cost of living","bend","relocation","moving to bend","budget"],
    hero_image_url: "/images/blog/four-seasons-central-oregon-living.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Cost of Living in Bend, Oregon (2026): Housing, Taxes",
    seo_description: "What it costs to live in Bend: live housing numbers, Oregon income and property tax rules, insurance, utilities, and how to build a budget before you tour.",
    excerpt: "Housing is the cost that decides whether Bend works. A plain look at the housing numbers, the Oregon tax trade, insurance, utilities, and how to build a Bend budget before you tour.",
    content: `
<p>Most cost-of-living pages are a pile of numbers nobody checked. This one is built the other way. Every figure below names its source and the date we pulled it, September 7, 2026, and the housing figures link to the live market pages that update from MLS data every day. Where a number moves weekly, we say so.</p>

<h2>Housing is the real cost</h2>
<p>Bend is priced like a resort town. Over the ninety days ending September 7, 2026, the median closed sale price for a single-family home in Bend was $733,000, from 475 closings in our MLS database. Redmond's was $499,000 from 143 closings. The live version of both, with price per square foot and days on market, is on the <a href="/housing-market/bend">Bend</a> and <a href="/housing-market/redmond">Redmond</a> market pages.</p>
<p>Turn those into a payment. Freddie Mac's national average 30-year fixed rate was 6.71% for the week of September 3, 2026. With 20% down, the Bend median pencils to $3,788 a month in principal and interest, plus about $426 in property tax at the county's average effective rate, for $4,214 before insurance. Redmond pencils to $2,579 plus $290, or $2,869. The rate moves every week and the medians move every day, so treat these as the September 2026 picture and run your own address with a lender.</p>
<p>Renting first is common. We do not publish rent figures because we do not have a verified source for them, and we would rather send you nothing than a number we cannot stand behind. Ask us and we will pull current rental listings for the neighborhood you are considering.</p>

<h2>West side, east side, and the towns nearby</h2>
<p>Inside Bend the west side costs more per square foot than the east side, for the same house. <a href="/blog/westside-vs-eastside-bend">Westside vs eastside Bend</a> explains the trade. Outside Bend, the same money buys more house in Redmond and more again in La Pine and Prineville, with a longer drive. <a href="/blog/bend-vs-redmond-vs-sisters">Bend vs Redmond vs Sisters</a> is the decision page for the towns.</p>

<h2>Taxes: the Oregon trade</h2>
<p>Oregon has no general sales tax. In exchange it has a state income tax. For 2026 the rates are 4.75%, 6.75%, 8.75%, and 9.9%, and the top rate starts at $125,000 of taxable income for a single filer and $250,000 for a joint return, per the Oregon Department of Revenue's 2026 estimated tax tables. Run your own income through both states before you decide the trade is a win.</p>
<p>Property tax in Oregon is charged on assessed value, not market value, and Measure 50 limits the growth of a home's maximum assessed value to 3% a year. A long-held home can carry a much lower bill than the same house next door that just sold. Your bill for a specific address is public on the county's DIAL lookup, and <a href="/blog/property-taxes-deschutes-county">our Deschutes County property tax guide</a> explains how the system works and when the bill is due.</p>
<p>Oregon has no state real estate transfer tax outside of Washington County, so buying or selling in Deschutes County carries no transfer tax line at closing.</p>

<h2>Insurance, utilities, and getting around</h2>
<p>Homeowners insurance is the line that moves most by address. Much of Central Oregon is wildfire-exposed, and premiums on two homes a mile apart can differ a lot. Get a quote on the specific house before you write an offer.</p>
<p>City of Bend water and sewer rates in effect since July 1, 2025: water is a $29.79 monthly base plus $2.48 per 100 cubic feet used, and sewer is a $42.71 base plus $4.48 per 100 cubic feet of your winter-quarter average, per the city's published rate schedule. Electricity and natural gas depend on the home and the season, so ask the seller for a year of Pacific Power and Cascade Natural Gas bills during the inspection period.</p>
<p>Gas costs more here than in most of the country. On September 7, 2026, AAA put Oregon's average at $5.02 a gallon against a $4.15 national average. That number moves daily. Bend drives short. Most crosstown trips are minutes outside the summer peak, and Cascades East Transit runs fixed routes in town.</p>
<p>For 2026 individual marketplace coverage, Oregon's Division of Financial Regulation approved silver-plan premiums for a 40-year-old between $518 and $620 a month depending on the carrier, an average increase of 9.7% over 2025. Five of the six carriers sell in Deschutes County.</p>

<h2>The reason people pay it</h2>
<p>The mountain, the river, and the trails are the line items people move here for. Mt. Bachelor is about 21 miles from downtown by road, and its 2026-27 adult full season pass was $1,399 on September 7, 2026, with a price increase scheduled for September 30. The Deschutes River Trail runs through the city. Most of the rest of the outdoor life bills at the cost of gas and gear.</p>
<p>Set the costs against the income side. Bend's median household income is $96,394, per the Census Bureau's 2020-2024 American Community Survey. Next to the payment on the median house above, that is the town's central tension, and it is why Redmond keeps absorbing Bend's demand.</p>

<h2>How to build a Bend budget before you tour</h2>
<ol>
<li>Pick a price from the live market page for the town and the side of town you want.</li>
<li>Have a lender turn it into a payment with taxes and insurance for a real address.</li>
<li>Run your income through Oregon's brackets and compare with your current state.</li>
<li>Add the recurring costs that are yours: the pass, the second car, the commute.</li>
<li>Tour with that number, not with the list prices.</li>
</ol>

<h2>Questions</h2>
<h3>What is the biggest cost of living in Bend?</h3>
<p>Housing. The median single-family sale in Bend was $733,000 over the ninety days ending September 7, 2026, from MLS closings, and the live number is on the <a href="/housing-market/bend">Bend market page</a>. Everything else in a Bend budget is small next to the payment.</p>
<h3>How much income do people need to buy in Bend?</h3>
<p>It depends on the down payment, the rate, the side of town, and the insurance on the specific house, so there is no single number. As a September 2026 reference, the Bend median with 20% down at Freddie Mac's 6.71% rate pencils to about $4,214 a month with property tax and before insurance. Take the current median to a lender and ask for the payment with taxes and insurance for a real address.</p>
<h3>How does Bend compare with Redmond on everyday costs?</h3>
<p>Housing is the difference. Over the ninety days ending September 7, 2026, Redmond's median single-family sale was $499,000 against Bend's $733,000. Taxes are the same state rules in both towns, and groceries, fuel, and utilities come from the same regional providers.</p>
<h3>Do property taxes make Bend more expensive than people expect?</h3>
<p>Usually the opposite. Oregon taxes assessed value, which Measure 50 caps at 3% growth a year, so many Bend homes carry a bill below what the sale price would suggest. For fiscal 2025-26 the Department of Revenue puts Deschutes County's average effective rate at about 0.7% of real market value. The bill for any address is public on the county's DIAL lookup.</p>
<h3>What should relocators budget beyond the mortgage payment?</h3>
<p>Homeowners insurance quoted on the specific address, property taxes from the county lookup, HOA dues if the home has an association, utilities from a year of the seller's bills, and the recurring costs of the outdoor life you are moving for.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the towns and price band that fit the payment, or <a href="/book">book a call</a> and we will build the budget with you before you tour.</p>
`,
  },
  {
    title: "Best Neighborhoods in Bend, Oregon for Buyers",
    slug: "best-neighborhoods-bend-buyers",
    category: "Buying Guides",
    tags: ["bend neighborhoods","buying guide","westside","eastside","where to live in bend"],
    hero_image_url: "/images/blog/best-neighborhoods-bend-buyers.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Best Neighborhoods in Bend, Oregon for Buyers | Ryan Realty",
    seo_description: "A buyer's guide to Bend's thirteen districts and the communities around them, grouped by budget, walkability, and lifestyle, with live inventory for each.",
    excerpt: "Bend's thirteen districts and the communities around them, grouped by the question buyers actually ask: walkable, value, views, or golf. With links to what is for sale in each.",
    content: `
<p>Bend has thirteen named districts inside the city and a ring of communities just outside it. Buyers do not need a ranking. They need to know which districts fit a budget, a commute, and a way of living. This guide groups the districts by the question buyers actually ask, then sends you to the live inventory for each one.</p>

<h2>How to use this guide</h2>
<p>Start with two numbers you already know: what you can spend, and how far you are willing to drive to the things you do every week. Bend is small enough that every district is within twenty minutes of downtown outside of summer traffic. It is expensive enough that the west side and the east side price very differently for the same square footage. Pick the section below that matches your budget, then open the district pages to see what is for sale today.</p>

<h2>Close-in west side</h2>
<p>The districts west of the Deschutes River and the Parkway are the oldest and the most walkable. <a href="/cities/bend/river-west">River West</a> and <a href="/cities/bend/old-bend">Old Bend</a> sit next to downtown, Drake Park, and the river trail. Lots are small, many homes date to the mill era, and a rebuilt or updated house here carries the highest price per square foot in the city. <a href="/communities/northwest-crossing">NorthWest Crossing</a> is the planned neighborhood on the west edge with its own commercial center, narrow streets, and alley-loaded garages. <a href="/cities/bend/awbrey-butte">Awbrey Butte</a> is the hill above the west side, with large lots, custom homes, and views of the Cascades. <a href="/cities/bend/summit-west">Summit West</a> and <a href="/cities/bend/century-west">Century West</a> run along the road to Mt. Bachelor, closer to the trailheads than to downtown.</p>
<p>Who this fits: buyers who want to walk or bike to downtown, the river, or the trails, and who will trade square footage and a garage for that.</p>

<h2>Value and space on the east and southeast</h2>
<p>East of the Parkway the lots get larger and the homes get newer. <a href="/cities/bend/orchard-district">Orchard District</a> and <a href="/cities/bend/mountain-view">Mountain View</a> sit east of downtown with a mix of mid-century ranches and newer infill. <a href="/cities/bend/larkspur">Larkspur</a> and <a href="/cities/bend/southeast-bend">Southeast Bend</a> hold most of the subdivisions built in the last twenty years, with three-car garages, single-level plans, and sidewalks. <a href="/cities/bend/boyd-acres">Boyd Acres</a> is on the north end near the new commercial growth. <a href="/cities/bend/southern-crossing">Southern Crossing</a> and <a href="/cities/bend/southwest-bend">Southwest Bend</a> straddle the south end, with quick access to the Old Mill District and the Deschutes River Trail.</p>
<p>Who this fits: buyers who want more house, a newer build, a flat driveway, and RV or boat parking, and who are fine driving to the west-side trailheads.</p>

<h2>Views, golf, and the resort ring</h2>
<p>Some of the largest lots and the biggest views are in the communities on the edge of the city and just outside it. <a href="/communities/tetherow">Tetherow</a> is on the west edge with a golf course and a lodge. <a href="/communities/broken-top">Broken Top</a> is a gated golf community on the west side. Farther out, <a href="/communities/sunriver">Sunriver</a>, <a href="/communities/eagle-crest">Eagle Crest</a>, and <a href="/communities/black-butte-ranch">Black Butte Ranch</a> are full resorts with their own amenities and homeowner associations. Every one of these carries HOA dues and rules that change the monthly cost, so read <a href="/blog/hoa-guide-central-oregon">our HOA guide</a> before you fall for a view.</p>
<p>Who this fits: buyers who want a course, a clubhouse, or a mountain view out the window, and who are budgeting for dues on top of the payment.</p>

<h2>How to tour on a short visit</h2>
<p>Most relocating buyers get one or two trips before they write an offer. Spend the first morning driving the west side and the east side back to back, with a stop at a coffee shop in each, so the price difference has a face. Spend the afternoon inside three or four homes in the district that felt right. Come back the next morning at commute time and drive from that district to wherever you will work, shop, and ski. Then open the <a href="/housing-market/bend">Bend market page</a> and look at what the district's homes have been closing at, not what they are listed at.</p>

<h2>Questions</h2>
<h3>What is the best neighborhood in Bend?</h3>
<p>There is no single best neighborhood in Bend. The west side districts win on walkability and access to the river and trails. The east and southeast districts win on square footage, newer construction, and price. The right one depends on your budget and how you spend a normal week.</p>
<h3>Which Bend neighborhoods are more affordable?</h3>
<p>Homes east of the Parkway, in districts like Southeast Bend, Larkspur, Orchard District, and Boyd Acres, generally close at a lower price per square foot than homes on the west side. The live numbers for each district are on its page and on the <a href="/housing-market/bend">Bend market page</a>.</p>
<h3>Which areas of Bend are the most walkable?</h3>
<p>River West, Old Bend, and NorthWest Crossing are the districts where people walk to coffee, dinner, and the river most often. Downtown and the Old Mill District are the two commercial centers, and the districts touching them are the walkable ones.</p>
<h3>How should a relocator pick a neighborhood on a short visit?</h3>
<p>Drive the west side and the east side back to back on the first morning, tour homes in one district that afternoon, and repeat the drive at commute time the next day. Then compare closed prices, not list prices, for that district before you decide.</p>
<h3>Do HOAs change the monthly cost in some neighborhoods?</h3>
<p>Yes. Tetherow, Broken Top, NorthWest Crossing, and every resort community carry homeowner association dues, and some carry transfer fees at closing. Many newer subdivisions on the east side have smaller HOAs. The dues and the rules are in the listing documents, and we read them with you before you offer.</p>

<h2>Next step</h2>
<p>Open <a href="/neighborhoods">the district pages</a> to see what is for sale in each one, or <a href="/homes-for-sale?city=bend">get listing alerts for Bend</a> and we will send you the new listings in the districts you pick.</p>
`,
  },
  {
    title: "Bend vs Redmond vs Sisters: Which Central Oregon Town Fits",
    slug: "bend-vs-redmond-vs-sisters",
    category: "Relocation Guides",
    tags: ["bend vs redmond","sisters oregon","redmond oregon","relocation","central oregon"],
    hero_image_url: "/images/blog/bend-vs-redmond-vs-sisters.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Bend vs Redmond vs Sisters: Which Central Oregon Town Fits?",
    seo_description: "What you get in Bend, Redmond, and Sisters, how far apart they are, what the same money buys, and which town fits which buyer. Live market pages for each.",
    excerpt: "Three towns within forty minutes of each other and three different places to live. What you are choosing, what each town gives up, and the live market page for each.",
    content: `
<p>Most people who move to Central Oregon start by searching Bend. A lot of them end up in Redmond or Sisters, and most of those are happy about it. The three towns sit within forty minutes of each other and share the same mountains, but they are different places to live. This is the decision page.</p>

<h2>What you are really choosing</h2>
<p>You are choosing between three things: how much house your money buys, how close you are to the things that made you look at Central Oregon, and how much town you want around you. Bend has the most of everything and costs the most. Redmond has the airport, a working downtown, and more house per dollar. Sisters is small, walkable, and quiet, with the Cascades right there. The live prices for each are on the market pages linked in each section.</p>

<h2>Bend</h2>
<p>Bend is the largest city in the region and the center of it. It has the hospital, the university branch, the breweries, the Old Mill District, and the trail network along the Deschutes. Mt. Bachelor is about 21 miles west of downtown by road. Housing runs from mill-era cottages on the west side to new subdivisions on the east and southeast, and the price gap between those two sides is real. Bend is where you buy if you want to walk or bike to things, if your work is here, or if you want the widest choice of homes. It is also where you pay the most for the same square footage. <a href="/cities/bend">Bend homes and districts</a>. <a href="/housing-market/bend">Bend market page</a>. <a href="/blog/moving-to-bend-relocation-guide">Moving to Bend guide</a>.</p>

<h2>Redmond</h2>
<p>Redmond is about 17 miles north of downtown Bend on Highway 97. It has the regional airport, the fairgrounds, a downtown that has filled in over the last decade, and most of the region's newer entry-level subdivisions. The same money buys more house and more lot in Redmond than in Bend, and the drive to downtown Bend is about 25 minutes without traffic. Smith Rock and the Crooked River are closer from Redmond than from Bend. Redmond is where you buy if you want a newer home, a real yard, and a Bend commute you can live with. <a href="/cities/redmond">Redmond homes</a>. <a href="/housing-market/redmond">Redmond market page</a>. <a href="/blog/moving-to-redmond-oregon-guide">Moving to Redmond guide</a>.</p>

<h2>Sisters</h2>
<p>Sisters is about 22 miles northwest of downtown Bend at the base of the Three Sisters. It is a small town with a western-themed main street, a rodeo, a folk festival, and a quilt show that fills the town every July. Housing is a mix of in-town lots, acreage on the edges, and Black Butte Ranch a few miles west. Inventory is thin because the town is small, so buyers often wait for the right house rather than choosing among many. Sisters is where you buy if you want quiet, a walkable center, and mountain access, and you do not need to be in Bend every day. <a href="/cities/sisters">Sisters homes</a>. <a href="/housing-market/sisters">Sisters market page</a>. <a href="/blog/moving-to-sisters-oregon-guide">Moving to Sisters guide</a>.</p>

<h2>Quick comparison</h2>
<ul>
<li>Most choice of homes and the most to do: Bend.</li>
<li>Most house for the money with a short commute: Redmond.</li>
<li>Smallest and quietest, closest to the mountains: Sisters.</li>
<li>Airport: Redmond. Hospital: Bend. Ski hill: closest from Bend.</li>
<li>Inventory: deepest in Bend, growing in Redmond, thin in Sisters.</li>
</ul>

<h2>Questions</h2>
<h3>Is Redmond cheaper than Bend?</h3>
<p>Yes, on a per-square-foot basis Redmond has consistently closed below Bend. The current median prices and the gap between them are on the <a href="/housing-market/redmond">Redmond</a> and <a href="/housing-market/bend">Bend</a> market pages, updated from live MLS data.</p>
<h3>Is Sisters a cheaper alternative to Bend?</h3>
<p>Not reliably. Sisters has a small housing stock and a lot of acreage and custom homes, so its median can sit near or above Bend's depending on what closed that month. Buyers choose Sisters for the town and the setting, not for a discount. Check the <a href="/housing-market/sisters">Sisters market page</a> for the current number.</p>
<h3>How long is the commute between these towns?</h3>
<p>Downtown Bend to downtown Redmond is about 17 miles on Highway 97, about 25 minutes without traffic. Bend to Sisters is about 22 miles on Highway 20, about 35 minutes. Both run longer on summer weekends and on snow days.</p>
<h3>Which town is better for remote workers?</h3>
<p>All three have fiber or cable service in town, and rural parcels need to be checked address by address. Bend has the most coworking space and coffee shops. Redmond has the airport if you fly for work. Sisters has the least noise. We check the provider at the specific address before you offer.</p>
<h3>Should I rent first before choosing a town?</h3>
<p>If you have never spent a winter here, renting for a few months is a reasonable way to test the drive, the snow, and the town before you buy. If you have visited in more than one season and know your commute, buying directly is common. Either way, set up <a href="/homes-for-sale">listing alerts</a> so you see the market move while you decide.</p>

<h2>Next step</h2>
<p>Open the three market pages side by side, then <a href="/homes-for-sale">set an alert</a> for the towns you have not ruled out. When you are ready to tour, <a href="/book">book a call</a> and we will plan a day that covers all three.</p>
`,
  },
  {
    title: "How to Sell Your House in Bend, Oregon",
    slug: "how-to-sell-your-home-bend",
    category: "Selling Guides",
    tags: ["selling guide","bend","home selling","central oregon","listing plan"],
    hero_image_url: "/images/blog/how-to-sell-your-home-bend.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "How to Sell Your House in Bend, Oregon | Step by Step",
    seo_description: "Selling a home in Bend from the first number to closing: pricing from real comps, prep that changes the price, the first two weeks, offers, and the 3% plan.",
    excerpt: "The sequence we run on every Bend listing: a real number, prep that changes the price, the first two weeks, offers compared on the net, and a closing signed from anywhere.",
    content: `
<p>Selling a home in Bend is a sequence of decisions, and the ones made before the sign goes in matter more than anything that happens after. This is the sequence we run on every listing, from the first number to the wire at closing, and what each step asks of you.</p>

<h2>Start with a real number</h2>
<p>The price comes from three sets of homes: what has closed near you in the last few months, what is pending now, and what is competing for the same buyers this weekend. We pull all three for your district and price band, adjust for size, condition, lot, and view, and send you a written valuation with the comps behind it. The valuation is free and does not require a listing agreement. If the number is lower than you hoped, that is the moment to know it, not six weeks into a listing. Our guide to <a href="/blog/how-to-price-your-bend-home">pricing a Bend home</a> explains the method and what to do if a listing stalls.</p>
<p>Check that number against your own math. Your net is the price minus the listing fee, any buyer-agent compensation you agree to, title and escrow, prorated taxes, your loan payoff, and whatever you spend on prep. Our <a href="/blog/cost-to-sell-house-bend-oregon">cost to sell</a> guide walks each line, and we send a net sheet with every offer.</p>

<h2>Prep that buyers notice</h2>
<p>Buyers in Central Oregon compare your home to the three others they toured that day. The fixes that move the price are the ones they notice from the door: a roof that is not at end of life, systems that work, a kitchen and baths that are clean and current enough, floors and paint that do not need a project. The fixes that only change the photos can be skipped. We walk the house with you, send a list with what each item is likely to cost and whether it changes the price, and you decide. The <a href="/blog/preparing-home-for-sale-checklist">pre-listing checklist</a> is the long version, and the <a href="/blog/home-staging-tips-central-oregon">staging guide</a> covers presentation.</p>
<p>Oregon requires a seller property disclosure on most residential sales. Fill it out completely. A disclosure that is careful and complete protects you after closing.</p>

<h2>Listing, photos, and the first two weeks</h2>
<p>We sign. We schedule photos and the sign. We start the marketing. It goes in the MLS as coming soon. When the photos and materials are ready, we go live and the sign goes in. Professional photography, a 3D tour, and the marketing plan are part of the <a href="/sell">3% listing plan</a>, with no add-on fees.</p>
<p>The first two weeks are the listing. Every buyer with a saved search sees the home the day it goes live and every agent with a matching client sends it that night. The first weekend of showings is the largest the home will ever have. A price that is right on day one sells into that attention. That is why the number comes first.</p>

<h2>Showings and the weekly report</h2>
<p>Showings run through an appointment system that confirms each one with you. Every week the home is listed you get a written report with the showing count, the feedback, and what has closed or gone pending nearby since we listed. If showings are steady and offers are not coming, the feedback tells us whether it is condition or price, and we change one thing at a time.</p>

<h2>Offers, concessions, and negotiation</h2>
<p>An offer is more than a price. It carries the financing, the earnest money, the inspection and appraisal contingencies, the closing date, any request that you cover part of the buyer's agent fee, and often a request for a credit toward the buyer's closing costs. Seller credits have become common in Bend. We send each offer with a net sheet so you compare the check at closing, not the headline price, and we counter on the terms that matter to you. On multiple offers we run them side by side.</p>

<h2>Inspection, appraisal, and closing</h2>
<p>After acceptance the buyer inspects, usually within the first two weeks, and may ask for repairs or a credit. We tell you what is reasonable for the price and the condition, and what is not. If the buyer has a loan, the lender orders an appraisal, and a price that came from real comps holds up. Title and escrow prepare the documents, you sign electronically or with a notary, taxes and HOA dues are prorated to the closing day, your loan is paid off from the proceeds, and the balance is wired to you. A typical financed sale in Oregon closes in a month to six weeks from acceptance. Our guide to <a href="/blog/what-happens-between-offer-accepted-and-closing">what happens between acceptance and closing</a> covers each step.</p>

<h2>Selling from out of state</h2>
<p>If you no longer live in Bend, every step above still works. We hold the keys, manage the vendors, and handle mail, snow, and security checks while the home is listed, and you sign from wherever you are. <a href="/blog/selling-your-bend-home-from-out-of-state">Selling your Bend home from out of state</a> covers it.</p>

<h2>Questions</h2>
<h3>What are the steps to sell a house in Bend?</h3>
<p>A written valuation from closed, pending, and active comps. Prep that changes the price, not just the photos. Photos, marketing, and a coming-soon period, then live in the MLS. Showings with a weekly written report. Offers compared on the net at closing. Inspection, appraisal, and a closing that is signed electronically and wired to you.</p>
<h3>How long does it take to sell a home in Bend right now?</h3>
<p>It depends on the price band and the neighborhood. The current median days on market for Bend, and how the price bands differ, is on the <a href="/housing-market/bend">Bend market page</a>, updated from live MLS data. A financed sale then takes about a month to six weeks from acceptance to closing.</p>
<h3>Do I need repairs and staging?</h3>
<p>Do the repairs a buyer notices from the door and the ones an inspector will flag. Skip the ones that only change the photos. Staging helps most on vacant homes, and virtual staging for empty rooms is part of our listing plan.</p>
<h3>What happens after I accept an offer?</h3>
<p>The buyer inspects and may ask for repairs or a credit. The lender orders an appraisal. Title and escrow prepare the closing documents, you sign, taxes and dues are prorated, your loan is paid off from the proceeds, and the balance is wired to you.</p>
<h3>What does it cost to list with Ryan Realty?</h3>
<p>One plan at 3% of the sale price, with no add-on fees. It covers photography, the 3D tour, the MLS listing, the marketing plan, every showing, weekly reports, remote-owner care, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer. Commission is negotiable and every listing agreement is its own conversation.</p>

<h2>Next step</h2>
<p><a href="/sell">Value my home</a> starts with your address and ends with a written valuation, the comps, and a net sheet. No listing agreement is required to get the number.</p>
`,
  },
  {
    title: "What It Costs to Sell a House in Bend (and Oregon)",
    slug: "cost-to-sell-house-bend-oregon",
    category: "Selling Guides",
    tags: ["cost to sell","seller closing costs","commission","bend","oregon"],
    hero_image_url: "/images/blog/cost-to-sell-house-bend-oregon.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Cost to Sell a House in Bend, Oregon: Fees, Title, Closing",
    seo_description: "Every line a Bend seller pays: listing fee, buyer-agent compensation under the 2024 rules, title and escrow, recording, prorations, HOA fees. No transfer tax.",
    excerpt: "The listing fee, buyer-agent compensation under the current rules, title and escrow, recording, prorations, and what is included. Oregon has no transfer tax, and we show the net before you accept.",
    content: `
<p>Sellers compare cost before they compare marketing, and they should. The costs of selling a home in Bend fall into a few buckets, most of them are knowable before you list, and one of them is negotiable in a way it was not a few years ago. Here is each line and who pays it.</p>

<h2>The big buckets</h2>
<ul>
<li>The listing fee you agree to with your broker.</li>
<li>Buyer-agent compensation, if you agree to offer it.</li>
<li>Title insurance, escrow, and recording.</li>
<li>Prorated property taxes, your loan payoff, and any HOA transfer fees.</li>
<li>Prep and repairs, plus anything you agree to credit the buyer after inspection.</li>
</ul>

<h2>Listing fee versus buyer-agent compensation</h2>
<p>These used to be one number. They are two now. Our listing fee is 3% of the sale price with no add-on fees, and it covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, and transaction management through close. Buyer-agent compensation is separate. Under the rules that took effect in August 2024, offers of compensation to the buyer's agent no longer appear in the MLS, and buyers sign a written agreement with their own agent that states what that agent will be paid. Whether you offer to cover some or all of that is a term of each offer, and you decide it offer by offer. We walk you through the trade before the first one arrives. Commission is negotiable and every listing agreement is its own conversation.</p>

<h2>Title, escrow, and recording</h2>
<p>Oregon has no state real estate transfer tax outside of Washington County, so in Deschutes County that line is zero. Title insurance premiums in Oregon are filed with the state, so the owner's policy is a published figure for the sale price, and in Central Oregon practice the seller customarily pays for it. The escrow fee is customarily split between buyer and seller. The county charges a recording fee for the deed. Your escrow officer quotes each of these from a published schedule before you sign, and they show up as line items on your settlement statement.</p>

<h2>Prorations, payoffs, and the HOA</h2>
<p>Property taxes are prorated to the closing day on Oregon's July-through-June tax year, so you pay your share of the current year. Your mortgage is paid off from the proceeds, along with a small fee to record the release. If the home is in a homeowners association, the association's own fee schedule sets what it charges for the transfer and the document package, and some Bend communities charge a percentage of the sale price. Our <a href="/blog/hoa-guide-central-oregon">HOA guide</a> covers what to ask for.</p>

<h2>Prep, marketing, and what is included</h2>
<p>Photography, the 3D tour, the marketing, and the showings are inside the 3% fee. What is not inside it is the work on the house: repairs, cleaning, staging, and anything you decide to fix before listing. We give you a list with what each item is likely to cost and whether it changes the price, and you decide. Our <a href="/blog/preparing-home-for-sale-checklist">pre-listing checklist</a> separates the fixes that matter from the ones that only change the photos.</p>

<h2>What the settlement statement looks like</h2>
<p>Before you accept an offer, we send a seller net sheet: the offered price, the listing fee, any buyer-agent compensation you agreed to, title and escrow, prorations, your payoff, and any credit to the buyer, with the net at the bottom. That is the number to plan around. When the final settlement statement arrives from escrow, it should match the net sheet within the prorations, and we go through it with you line by line.</p>

<h2>Questions</h2>
<h3>How much does it cost to sell a house in Bend?</h3>
<p>The listing fee, any buyer-agent compensation you agree to offer, title and escrow, the county recording fee, prorated property taxes, your loan payoff, and any HOA transfer fees, plus whatever you spend preparing the home. We itemize all of it on a seller net sheet before you accept an offer.</p>
<h3>What does Ryan Realty's 3% listing plan include?</h3>
<p>The listing fee is 3% of the sale price with no add-on fees. It covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, weekly written reports, remote-owner care, and transaction management through close.</p>
<h3>Who pays the buyer's agent now?</h3>
<p>The buyer agrees to a fee with their own agent in a written agreement before touring. Whether the seller covers some or all of it is negotiated in each offer. Since August 2024 that offer no longer appears in the MLS, so it is a term of the contract, decided offer by offer.</p>
<h3>Does Oregon charge a real estate transfer tax?</h3>
<p>No. Oregon has no state transfer tax, and Deschutes County has none. Washington County, near Portland, is the one county in Oregon that charges one.</p>
<h3>What other seller costs show up at closing?</h3>
<p>The owner's title insurance policy, the seller's share of the escrow fee, the recording fee for the release of your mortgage, prorated property taxes through closing day, your loan payoff, HOA transfer fees if the home is in an association, and any credit to the buyer you agreed to in the contract.</p>

<h2>Next step</h2>
<p><a href="/sell">Value my home</a> starts with your address. The written valuation is free and comes with a net sheet at the recommended price.</p>
`,
  },
  {
    title: "First-Time Home Buyer Guide for Bend and Central Oregon",
    slug: "first-time-home-buyer-guide-central-oregon",
    category: "First-Time Buyers",
    tags: ["first-time buyer","bend","redmond","central oregon","buying guide"],
    hero_image_url: "/images/blog/first-time-home-buyer-guide-central-oregon.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "First-Time Home Buyer Guide: Bend and Central Oregon (2026)",
    seo_description: "A first-home plan for Bend and Redmond: pre-approval first, what budgets buy, the purchase timeline, the inspections that matter here, and the buyer agreement.",
    excerpt: "The plan we run with first-time buyers in Bend and Redmond: pre-approval first, what budgets buy on each side of town, the timeline, the inspections that matter here, and the mistakes to skip.",
    content: `
<p>A meaningful share of our business is first-time buyers, and the Bend market can look closed to someone who has never bought. It is not. It asks for a plan, a real budget, and a willingness to look past the west side. This is the plan we run with first-time buyers in Bend, Redmond, and the towns around them.</p>

<h2>Get financed before you fall for a listing</h2>
<p>The first step is a full pre-approval from a lender, not an online prequalification. A pre-approval means the lender has seen your income, your credit, and your savings and has told you what they will lend and at what payment. In Bend a seller will not take an offer seriously without one, and you should not tour without one, because the payment decides the search. Ask the lender to show the payment with property taxes and homeowners insurance for a home at your target price. Insurance here varies by address because of wildfire exposure, and that line can change what you can afford.</p>
<p>Oregon has state programs for first-time buyers. Oregon Housing and Community Services runs the Oregon Bond Residential Loan Program, and Oregon offers a First-Time Home Buyer Savings Account with a state income tax benefit for contributions. The current terms and income limits are on those agencies' sites, and your lender will tell you whether you qualify.</p>

<h2>What different budgets tend to buy</h2>
<p>We do not print price bands here because they move every month. The pattern holds, though. At the entry level in Bend the choices are condos and townhomes, older homes on the east side, and smaller homes in the districts farther from downtown. The same money in Redmond buys a newer single-family home with a yard. Farther out, La Pine and Prineville buy more house again with a longer drive. The <a href="/housing-market/bend">Bend</a> and <a href="/housing-market/redmond">Redmond</a> market pages show the current medians, and <a href="/blog/bend-vs-redmond-vs-sisters">Bend vs Redmond vs Sisters</a> covers the trade in each direction.</p>

<h2>The purchase timeline</h2>
<p>Pre-approval first. Then the search, with alerts set for the districts and the price band, and tours in batches so the homes compare. When you find the one, we pull the closed sales and write the offer the same day, with earnest money that matches what similar homes have closed with. If the seller accepts, the inspection period runs first, then the appraisal, then the loan is finalized and the closing documents are signed. A financed purchase in Oregon typically closes in a month to six weeks from acceptance. Our guide to <a href="/blog/what-happens-between-offer-accepted-and-closing">what happens between acceptance and closing</a> walks each step, and <a href="/blog/understanding-earnest-money-oregon">earnest money in Oregon</a> covers the deposit.</p>

<h2>Inspections that matter here</h2>
<p>Every buyer should get a general inspection. In Central Oregon some homes need more. A home outside city sewer has a septic system, and a home outside city water has a well, and both need their own inspection and, for a well, a water test. Older homes on the west side need attention on the roof, the sewer line, and the electrical panel. Homes in the wildland-urban interface may carry defensible-space requirements that affect insurance. Our <a href="/blog/home-inspection-checklist-oregon-buyers">inspection checklist for Oregon buyers</a> lists what to order and when. If the inspection turns up a problem, you can ask for repairs, ask for a credit, or walk away inside the inspection period and get your earnest money back.</p>

<h2>Working with a buyer's broker</h2>
<p>Since August 2024 every buyer signs a written agreement with their agent before touring. It states what we do and what we are paid, and in the offer we ask the seller to cover that fee. You see the number before the first showing. <a href="/blog/buyers-agent-bend-buyer-broker-agreement">Working with a buyer's agent in Bend</a> explains the agreement and how payment works on a real deal.</p>

<h2>Mistakes we see first-time buyers make</h2>
<ul>
<li>Touring before the pre-approval, then losing the home to a buyer who had one.</li>
<li>Searching only the west side of Bend and concluding nothing is affordable.</li>
<li>Skipping the well or septic inspection on a rural home.</li>
<li>Waiving the inspection to win a bidding war.</li>
<li>Forgetting that the cash to close is the down payment plus closing costs plus prepaid taxes and insurance.</li>
<li>Changing jobs or opening a new credit line between pre-approval and closing.</li>
</ul>

<h2>After you close</h2>
<p>Your first property tax statement will reflect the assessed value, which in Oregon grows on a capped schedule rather than jumping to your purchase price. <a href="/blog/property-taxes-deschutes-county">How property taxes work in Deschutes County</a> explains it. Keep the inspection report, the disclosures, and the closing statement together. You will want them when you sell.</p>

<h2>Questions</h2>
<h3>Can a first-time buyer still buy in Bend?</h3>
<p>Yes. Entry-level buyers in Bend mostly buy condos, townhomes, and older or smaller single-family homes on the east side, and many buy in Redmond instead for a newer home with a yard. A full pre-approval and a search that includes the east side and the nearby towns is what makes it work.</p>
<h3>What should I do before I tour homes?</h3>
<p>Get a full pre-approval from a lender, with the payment shown including property taxes and insurance. Sign the buyer representation agreement with your agent. Set up listing alerts for the districts and the price band that fit the payment.</p>
<h3>How much earnest money is typical?</h3>
<p>Most accepted offers in the Bend area put 1 to 3 percent of the purchase price in earnest money, and competitive listings can require more. We set the number from the specific listing and what similar homes closed with.</p>
<h3>Should first-time buyers look at Redmond?</h3>
<p>Often, yes. Redmond has most of the region's newer entry-level subdivisions and closes at a lower price per square foot than Bend, with the airport in town and a drive of about 25 minutes to downtown Bend without traffic.</p>
<h3>What contingencies should I keep?</h3>
<p>Keep the inspection contingency and the financing contingency. The appraisal contingency protects you if the lender's appraisal comes in under the price. Waiving any of them can win a home, and it can also cost you the earnest money or the home if something goes wrong.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the districts and the price band that fit your payment, or <a href="/book">book a call</a> and we will set the plan up together.</p>
`,
  },
  {
    title: "Closing Costs for Home Buyers in Bend, Oregon",
    slug: "understanding-closing-costs-oregon",
    category: "Buying Guides",
    tags: ["closing costs","bend","oregon","buying guide","title and escrow"],
    hero_image_url: "/images/blog/what-happens-between-offer-accepted-and-closing.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Closing Costs for Buyers in Bend, Oregon (2026)",
    seo_description: "What Bend buyers pay at closing: lender fees under TRID, title and escrow, the county recording fee, prepaids, FHA and VA fees, and how seller credits help.",
    excerpt: "Lender fees, title and escrow, the county recording fee, prepaids, FHA and VA program fees, and no transfer tax. Plus how a seller credit changes the cash you bring.",
    content: `
<p>The sale price is not the check. A buyer in Bend brings the down payment plus closing costs plus prepaid items to the table, and most of those costs are more knowable than people expect, because Oregon regulates some of them and federal law caps how far the rest can move. Here is what a buyer pays at an Oregon closing, line by line.</p>

<h2>Closing costs versus down payment</h2>
<p>The down payment is the part of the price you are not borrowing. Closing costs are the fees to make the loan and the sale, paid on top of it. Prepaids are the first year of homeowners insurance, interest from the closing date to the end of the month, and a share of property taxes, collected at closing. Your cash to close is all three added together, and it is on the Closing Disclosure your lender is required to give you at least three business days before you sign.</p>

<h2>Typical buyer line items</h2>
<p><strong>Lender charges.</strong> Origination, underwriting, and the appraisal. These vary by lender, which is why you compare Loan Estimates. Under the federal TRID rules the lender's own fees carry zero tolerance, so they cannot go up between the Loan Estimate and closing, and certain third-party charges cannot rise more than 10% in total. As one published anchor, the VA's appraisal fee schedule effective May 1, 2026 sets a single-family appraisal in Oregon at $850, and conventional appraisals in Central Oregon price in the same territory.</p>
<p><strong>Title and escrow.</strong> The lender's title policy protects the loan, and the buyer usually pays for it. In Central Oregon practice the seller customarily pays for the owner's policy, and the escrow fee is customarily split. Both are contract terms and an offer can allocate them differently.</p>
<p><strong>Recording.</strong> Deschutes County charges $102 to record the first page of a deed or mortgage and $5 for each additional page, per the county clerk's fee schedule effective July 1, 2026.</p>
<p><strong>Prepaids.</strong> The first year of homeowners insurance, prepaid interest, and prorated property taxes. Oregon's property tax year runs July 1 through June 30, and escrow splits the current year to the day of closing.</p>
<p><strong>Transfer tax.</strong> None. Oregon has no state real estate transfer tax, and Deschutes County has none. Washington County, near Portland, is the one Oregon county that charges one.</p>

<h2>Loan program fees</h2>
<p><strong>FHA.</strong> The upfront mortgage insurance premium is 1.75% of the base loan amount, and it can be financed into the loan. The annual premium on a 30-year loan with less than 5% down and a loan amount at or under the FHA base limit is 0.55% of the loan per year, collected monthly, per HUD's current mortgagee letter.</p>
<p><strong>VA.</strong> The funding fee for a purchase is 2.15% of the loan on first use with less than 5% down, 3.3% on later use, 1.5% with 5% or more down, and 1.25% with 10% or more down. Veterans receiving VA compensation for a service-connected disability are exempt, and some Central Oregon veterans qualify without knowing it. Ask your lender to check.</p>

<h2>Seller credits and rate buydowns</h2>
<p>A seller credit toward closing costs lowers your cash to close without changing the price. A rate buydown funded by the seller lowers the payment. Both have become common in Bend closings as inventory grew, and both are asked for in the offer. Our <a href="/blog/bend-buyers-market-shift-2026">report on Bend's shift toward buyers</a> shows how often sellers have been giving them, from closed MLS data. Your loan program caps how large a seller credit can be, so ask the lender for the limit before you write the request.</p>

<h2>Timeline to the Closing Disclosure</h2>
<p>You get a Loan Estimate within three business days of applying. You get the Closing Disclosure at least three business days before signing, and it must match the Loan Estimate within the tolerance rules. Compare the two side by side. If a lender fee moved, ask why before you sign. Our guide to <a href="/blog/what-happens-between-offer-accepted-and-closing">what happens between acceptance and closing</a> covers the rest of the calendar.</p>

<h2>Questions</h2>
<h3>How much are closing costs for buyers in Bend?</h3>
<p>Lender fees, the lender's title policy, the buyer's share of escrow, a county recording fee of $102 for the first page, and prepaid insurance, interest, and prorated taxes. There is no transfer tax in Deschutes County. The exact total for your loan is on the Loan Estimate, and we go through it with you.</p>
<h3>Can the seller pay some of my closing costs?</h3>
<p>Yes. A seller credit toward closing costs is negotiated in the offer, and it has become common in Bend sales. Your loan program limits how large the credit can be, so we check the cap with your lender before writing the request.</p>
<h3>What is earnest money, and is it part of closing costs?</h3>
<p>Earnest money is a deposit you make when the seller accepts your offer, held in escrow. It is not a fee. At closing it is applied to your down payment and closing costs. <a href="/blog/understanding-earnest-money-oregon">Earnest money in Oregon</a> covers how much is typical and when it is refundable.</p>
<h3>When do I see the final numbers?</h3>
<p>On the Closing Disclosure, which federal law requires you to receive at least three business days before you sign. It follows the Loan Estimate you got when you applied, and lender fees cannot increase between the two.</p>
<h3>Do cash buyers still pay closing costs?</h3>
<p>Yes, fewer of them. A cash buyer pays no lender fees and no lender's title policy, but still pays the escrow fee, the recording fee, prorated property taxes, and the first year of insurance if they choose to carry it.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the homes in your price band, or <a href="/book">book a call</a> and we will connect you with a local lender for a Loan Estimate on a real address.</p>
`,
  },
  {
    title: "Westside vs Eastside Bend: Price, Walkability, and Trade-offs",
    slug: "westside-vs-eastside-bend",
    category: "Buying Guides",
    tags: ["westside bend","eastside bend","bend neighborhoods","buying guide"],
    hero_image_url: "/images/blog/westside-vs-eastside-bend.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Westside vs Eastside Bend: Price, Walkability, Trade-offs",
    seo_description: "The river and the Parkway split Bend into an older, walkable, pricier west side and a newer east side with more house for the money. What each side gives up.",
    excerpt: "West of the river is older, walkable, and pricier per square foot. East is newer, flatter, and more house for the money. The trade in plain terms, with the districts on each side.",
    content: `
<p>Every relocating buyer asks it in the first ten minutes: west side or east side? In Bend the line is the Deschutes River and the Parkway that runs beside it. West of that line is older, closer to the trails, and more expensive per square foot. East of it is newer, flatter, and more house for the money. Here is the trade in plain terms.</p>

<h2>The real difference</h2>
<p>The west side grew up first, around the mills on the river and the roads to the mountain. The east side grew when the city did, in subdivisions built decades later. That history is what you are buying. West-side homes tend to have smaller lots, mature trees, and a walk or short bike ride to downtown, the river trail, or a trailhead. East-side homes tend to have bigger garages, single-level plans, sidewalks, and newer systems. The mountains are visible from both sides. The trailheads are closer to the west.</p>

<h2>West side trade-offs</h2>
<p>What you get: the river, Drake Park, downtown, Shevlin Park, and the road to Mt. Bachelor within minutes. Districts like <a href="/cities/bend/river-west">River West</a>, <a href="/cities/bend/old-bend">Old Bend</a>, <a href="/communities/northwest-crossing">NorthWest Crossing</a>, <a href="/cities/bend/awbrey-butte">Awbrey Butte</a>, <a href="/cities/bend/summit-west">Summit West</a>, and <a href="/cities/bend/century-west">Century West</a>.</p>
<p>What you give up: square footage and lot size at a given price, and often a garage that fits two cars. Older homes need inspection attention on roofs, plumbing, and electrical. Summer parking near the river is a fact of life.</p>

<h2>East and southeast trade-offs</h2>
<p>What you get: newer construction, larger lots, three-car garages, RV parking, and a lower price per square foot. Districts like <a href="/cities/bend/southeast-bend">Southeast Bend</a>, <a href="/cities/bend/larkspur">Larkspur</a>, <a href="/cities/bend/orchard-district">Orchard District</a>, <a href="/cities/bend/mountain-view">Mountain View</a>, <a href="/cities/bend/boyd-acres">Boyd Acres</a>, and <a href="/cities/bend/southern-crossing">Southern Crossing</a>.</p>
<p>What you give up: the walk to downtown and the river, and a shorter drive to the mountain. Many east-side subdivisions have an HOA with rules on paint, fences, and parking. Some of the newest areas are still filling in, so the streets and the retail are a few years behind the homes.</p>

<h2>Budget examples</h2>
<p>We do not print a fixed price gap here because it moves every month. The <a href="/housing-market/bend">Bend market page</a> shows the current median and price per square foot from closed sales, and each district page shows what is for sale and what has closed there. Compare a west-side district and an east-side district at the same price and the trade becomes obvious in a minute.</p>

<h2>Related districts to browse</h2>
<p>All thirteen Bend districts are on <a href="/neighborhoods">the neighborhoods page</a>. Our <a href="/blog/best-neighborhoods-bend-buyers">buyer's guide to Bend neighborhoods</a> groups them by what each one is for.</p>

<h2>Questions</h2>
<h3>Is the west side always more expensive?</h3>
<p>On a per-square-foot basis the west side has closed higher than the east side for years, and that holds today. A specific east-side home with a view or acreage can still cost more than a specific west-side cottage. The current numbers by district are on the <a href="/housing-market/bend">Bend market page</a>.</p>
<h3>Is the east side a worse investment?</h3>
<p>No. The east and southeast are where most of Bend's new homes have been built, and they hold most of the entry-level and move-up inventory. The west side has held a premium, but both sides have appreciated with the city. What matters more than the side is the price you pay relative to what has closed nearby.</p>
<h3>Which side has larger homes and lots?</h3>
<p>The east and southeast. The newer subdivisions there have larger garages, flatter lots, and more single-level plans than the older west-side districts, where lots are smaller and much of the housing predates the city's growth.</p>
<h3>Which side works better without a car?</h3>
<p>The west side. River West, Old Bend, and NorthWest Crossing put downtown, groceries, and the river trail within a walk or a short bike ride. Cascades East Transit runs routes on both sides, and most east-side errands are a drive.</p>
<h3>Can I get a Bend address for less on the east side?</h3>
<p>Yes. The east and southeast districts are inside the city limits and carry a Bend address, and they close at a lower price per square foot than the west side. That is the main reason buyers end up there after starting their search on the west side.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale?city=bend">Get listing alerts for Bend</a>, or pick a side and open its district pages. When you are ready to tour both, <a href="/book">book a call</a>.</p>
`,
  },
  {
    title: "Is Now a Good Time to Buy in Bend?",
    slug: "is-now-a-good-time-to-buy-in-bend",
    category: "Market Analysis",
    tags: ["bend market","buyers market","good time to buy","concessions","bend"],
    hero_image_url: "/images/blog/is-now-a-good-time-to-buy-in-bend.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Is Now a Good Time to Buy a Home in Bend, Oregon?",
    seo_description: "How to read Bend's market as a buyer: months of supply, days to pending, price cuts, and seller credits by price band from live MLS data, and when to wait.",
    excerpt: "Read your price band, not the national headline. The local signals that matter, concessions versus price cuts, and when waiting makes sense. Live numbers on the market page.",
    content: `
<p>National headlines are about a national market that does not exist. Bend's market is a set of price bands and districts that move at their own pace, and the answer to whether now is a good time to buy depends on which of them you are shopping in, and on your own payment. Here is how to read it for yourself.</p>

<h2>Ignore the headline, read your price band</h2>
<p>A Bend home under the citywide median and a home well above it are in different markets. The entry band moves faster and, in our closed-sale data, is where seller credits are most common. The upper band carries more inventory and more time on market, and fewer of its sales close with a credit. Before you decide anything, open the <a href="/housing-market/bend">Bend market page</a> and look at months of supply and days on market for the band you are actually shopping in.</p>

<h2>The local signals that matter</h2>
<ul>
<li>Months of supply. Active listings divided by the monthly closing pace. Under four months favors sellers, four to six is balanced, over six favors buyers. The current number, and how it is calculated, is on the <a href="/months-of-supply">months of supply page</a>.</li>
<li>Days to pending. How long the homes that are selling take to find a buyer. Rising means more room to negotiate.</li>
<li>Price cuts. The share of active listings that have reduced their price at least once. Rising means sellers are chasing the market.</li>
<li>Concessions. How many closed sales included a seller credit. Our <a href="/blog/bend-buyers-market-shift-2026">report on Bend's shift toward buyers</a> tracks this from closed MLS data.</li>
<li>New listings. Whether more homes are coming on than going pending. When they are, choice grows and prices soften.</li>
</ul>
<p>We publish all of these from our own MLS database and explain the method on <a href="/how-we-get-our-numbers">how we get our numbers</a>.</p>

<h2>Concessions versus price cuts</h2>
<p>When a market softens, sellers usually give ground on terms before they give ground on price. A credit toward your closing costs or a rate buydown lowers your cash to close or your payment without changing the sale price. That is real money, and in the current Bend market it is on the table in a lot of deals. Ask for it in the offer. The listing agent may say no, and that answer tells you something about the price too.</p>

<h2>When waiting makes sense</h2>
<p>Waiting makes sense when your own numbers say so: when the payment on the homes you like does not fit, when your down payment is still growing, or when your job or your move is not settled. Waiting to time the market does not work here, because the thing that moves Bend prices most is mortgage rates, and nobody prices those well. A buyer who waits for a lower price often meets a higher rate, and the payment ends up the same. If the payment fits and you plan to stay for years, the market conditions are a negotiating question, not a go or no-go question.</p>

<h2>The refinance argument, and its limits</h2>
<p>The case for buying now in a soft market is that you negotiate the price and the credits today, and you can refinance the rate later if rates fall. The price is permanent. The rate is not. That argument holds when two things are true: the payment at today's rate fits without strain, and you plan to hold the home long enough that a refinance, which has its own closing costs, pays for itself. It fails when the payment only works if a refinance shows up on schedule. Nobody can promise that schedule, so we do not price a purchase on it.</p>
<p>The case for waiting is that inventory has been growing, and a buyer who waits may have more to choose from. That is true in the upper bands and less true at the entry level, where the choice is already thin. Rising inventory is a reason to negotiate harder now, not by itself a reason to sit out.</p>

<h2>What to check before you decide</h2>
<p>Get a real pre-approval, not a prequalification. Run the payment with taxes and insurance for the specific house, because insurance varies by address here. Look at the closed sales for the district, not the list prices. Then decide how much leverage the market gives you and use it in the offer.</p>

<h2>Questions</h2>
<h3>Is Bend a buyer's market right now?</h3>
<p>It depends on the price band. The current months of supply for Bend, with the threshold that defines a buyer's market, is on the <a href="/housing-market/bend">Bend market page</a>, updated from live MLS data. In our closed-sale data the entry-level band is where seller credits are most common, and the share falls as the price rises.</p>
<h3>Are sellers offering concessions in Bend?</h3>
<p>Yes, in a meaningful share of closed sales. Seller credits toward closing costs and rate buydowns went from rare to routine as inventory grew. The share of closings with a credit, from MLS data, is in <a href="/blog/bend-buyers-market-shift-2026">our report on the shift toward buyers</a>.</p>
<h3>Should I wait for prices to drop?</h3>
<p>Only if your own numbers say to wait. Bend prices have held while inventory grew, and mortgage rates move the payment more than list prices do. A buyer who waits for a lower price can meet a higher rate and end up with the same payment. If the payment fits and you plan to stay, use the market's leverage in the offer instead of waiting for it to change.</p>
<h3>Is it a better time to buy in Redmond than Bend?</h3>
<p>Redmond closes at a lower price per square foot than Bend, and in our first-half 2026 closed-sale data a larger share of Redmond sales carried a seller credit than Bend sales did. Compare the two on the <a href="/housing-market/redmond">Redmond</a> and <a href="/housing-market/bend">Bend</a> market pages.</p>
<h3>What should I check before I decide?</h3>
<p>A full pre-approval, the payment with taxes and insurance for a specific house, the closed sales in the district, and the months of supply and days to pending for your price band. Then decide how much to ask for in the offer.</p>

<h2>Next step</h2>
<p>Set up <a href="/homes-for-sale?city=bend">listing alerts for Bend</a> so you see price cuts the day they happen, or <a href="/book">book a call</a> and we will read your price band with you.</p>
`,
  },
  {
    title: "How to Price Your Bend Home So It Sells",
    slug: "how-to-price-your-bend-home",
    category: "Selling Guides",
    tags: ["pricing","list price","bend","selling guide","price reduction"],
    hero_image_url: "/images/blog/how-to-price-your-bend-home.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "How to Price Your Bend Home So It Sells | Ryan Realty",
    seo_description: "How we set a Bend list price from closed, pending, and active comps, why the first two weeks decide the sale, what showing feedback means, and when to cut.",
    excerpt: "Solds, pendings, and actives set the price. The first two weeks decide the sale. How to read showing feedback, when a cut is right, and how a credit changes what you net.",
    content: `
<p>The list price is the one decision a seller makes that the market answers directly. Price at what the buyers are choosing and the showings come. Price at what you hope for and the house sits, then sells for less after a cut. This is how we set a list price in Bend, and what to do when a listing stalls.</p>

<h2>Solds, actives, and pendings</h2>
<p>Three sets of homes decide your price. The closed sales tell you what buyers have actually paid for homes like yours in the last few months. The pendings tell you what buyers are agreeing to right now, before the closing shows up in the data. The actives are your competition, the homes a buyer will tour the same weekend as yours. A price that ignores any one of the three is a guess. We pull all three for your district and your price band, adjust for size, condition, lot, and view, and the range that comes out is the range you can defend to an appraiser later.</p>
<p>The current medians and days on market for the city are on the <a href="/housing-market/bend">Bend market page</a>. Your home's number comes from the handful of closings nearest it in place and time, not from the citywide median.</p>

<h2>The cost of missing the first window</h2>
<p>A new listing gets the most attention in its first two weeks. Every buyer with an alert sees it the day it goes live, every agent with a matching client sends it that night, and the first weekend of showings is the biggest one the house will ever have. A price that is right on day one sells into that attention. A price that is high on day one wastes it, and the buyers who passed do not come back on their own when the price drops later. They have to be told, and by then the listing carries a days-on-market number that reads as a warning.</p>

<h2>Condition and price travel together</h2>
<p>Buyers compare a home to the others they toured that day, not to its own potential. A house with an original kitchen and a new roof does not price like the renovated one two streets over, even at the same square footage. The two levers a seller controls are what to fix before listing and where to price what is left. Our <a href="/blog/preparing-home-for-sale-checklist">pre-listing checklist</a> covers the fixes that change the price and the ones that only change the photos. Do the first list. Skip the second.</p>

<h2>Reading buyer feedback</h2>
<p>Showings with no offers are data. If the house is getting toured and the feedback is about condition, the price is close and the presentation is off. If the feedback is about price, or the showings stop after the first weekend, the price is above what the comparable homes are closing at. If there are no showings at all, the price is far enough off that buyers are not even opening the listing, or the photos are not doing their job. We send you a written report every week the home is listed, with the showing count, the feedback, and what has closed or gone pending nearby since we listed.</p>

<h2>When a cut is the right move</h2>
<p>A price reduction is not a failure. It is the second listing, and it works when it is decisive. A small trim that keeps the house above the nearest closed sale does nothing. A cut that puts the house at or just under what buyers have been paying restarts the alerts and brings back the buyers who passed. One well-sized adjustment beats three small ones, because each small one adds days without adding showings.</p>

<h2>Concessions and what you net</h2>
<p>In the current Bend market many closed sales include a seller credit toward the buyer's closing costs or an interest-rate buydown. A credit lowers what you net the same way a price cut does, and buyers negotiate for them. When we price your home we model the net at the list price, at the likely offer, and with a credit, so the number you plan around is the check at closing, not the number on the sign. Our <a href="/blog/bend-buyers-market-shift-2026">report on Bend's shift toward buyers</a> shows how common concessions have become.</p>

<h2>Questions</h2>
<h3>How do you set a list price in Bend?</h3>
<p>We pull the closed sales, the pending sales, and the active competition for your district and price band, adjust for size, condition, lot, and view, and price inside the range those homes support. The written valuation is free and comes with the comps we used.</p>
<h3>Should I price high and negotiate down?</h3>
<p>No. In Bend a high list price costs you the first two weeks, when the home gets the most showings it will ever get. Buyers who pass at the high number do not return on their own when it drops. Pricing at what comparable homes are closing at brings more buyers in that first window and usually produces the stronger offer.</p>
<h3>What if my home is not getting showings?</h3>
<p>No showings at all means buyers are not opening the listing, which points to price or photos. Showings with no offers point to condition or a price just above the nearest closed sale. We read the weekly showing count and feedback with you and change one thing at a time.</p>
<h3>Do I automatically need a price cut?</h3>
<p>No. If the home is getting showings and the feedback is about condition, fix the condition or adjust the presentation first. A cut is the answer when the feedback is about price or when showings stop. When a cut is right, one decisive adjustment beats several small ones.</p>
<h3>How do concessions affect what I net?</h3>
<p>A seller credit toward the buyer's closing costs reduces your net the same way a price reduction does. We model your net at list, at the likely offer, and with a credit before you list, so you plan around the check at closing rather than the list price.</p>

<h2>Next step</h2>
<p><a href="/sell">Value my home</a> starts with your address and ends with a written valuation and the comps behind it. No listing agreement is required to get the number.</p>
`,
  },
  {
    title: "Property Taxes in Bend and Deschutes County, Explained",
    slug: "property-taxes-deschutes-county",
    category: "Buying Guides",
    tags: ["property taxes","deschutes county","bend","oregon","measure 50"],
    hero_image_url: "/images/blog/understanding-home-appraisals.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Property Taxes in Bend and Deschutes County (2026)",
    seo_description: "How Oregon property tax works in Deschutes County: assessed vs market value under Measure 50, the DIAL lookup, the November 15 calendar, and relief programs.",
    excerpt: "Oregon taxes assessed value, not what you paid. How Measure 50 works, how to look up any account, when the bill is due, how it is prorated at closing, and the 2026 relief programs.",
    content: `
<p>Oregon does something most states do not. It taxes a number that is usually well below what your home is worth. The gap between assessed value and market value explains why two identical houses on the same street can carry very different tax bills, and it is the first thing a Bend buyer or seller should understand. Every rule below is from the Oregon Department of Revenue or Deschutes County.</p>

<h2>Assessed value versus what you paid</h2>
<p>Measure 50, passed in 1997, set every property's maximum assessed value and limited its growth to 3% per year, no matter what the market does. Your tax is charged on assessed value, which is the lower of that capped number and the real market value. Central Oregon prices have grown far faster than 3% a year for most of the time since, so on most homes the assessed value sits well below the market value. A long-held home carries decades of capped growth. A newly built home enters the rolls closer to market. That is why your bill and your neighbor's can differ on the same street.</p>
<p>Your purchase does not reset the assessed value to the price you paid. That is the part that surprises buyers from California and other states.</p>

<h2>What Deschutes County owners actually pay</h2>
<p>In the Oregon Department of Revenue's property tax statistics report for fiscal 2025-26, Deschutes County's average consolidated rate was $16.80 per $1,000 of assessed value. Because assessed value trails market value, that works out to an average effective rate of about 0.698% of real market value, which the report states as $6.98 per $1,000 of Measure 5 value. At that effective rate a home at Bend's ninety-day median sale price of $733,000, as of September 7, 2026, carries about $5,116 a year. Your exact rate depends on your tax code area, so two Bend addresses can differ.</p>

<h2>Looking up an account</h2>
<p>Every Deschutes County account is public on the county's DIAL lookup at dial.deschutes.org. Search by address, owner, or account number and you get the assessed value, the real market value, the tax code area, and the current bill. Before you write an offer, look up the house. Before you list, look up your own and the comps. The rate depends on your tax code area, which is the specific stack of city, school, fire, and bond levies where the home sits, so two Bend addresses can differ.</p>

<h2>The calendar</h2>
<p>Statements go out by October 25. Pay in full by November 15 and you get a 3% discount. Pay two-thirds by then and the discount is 2%. Otherwise the bill splits into thirds due November 15, February 15, and May 15. When November 15 falls on a weekend the deadline moves to the next business day, and for 2026 Deschutes County lists Monday, November 16 as the due date. Oregon's property tax year runs July 1 through June 30.</p>

<h2>Buyer budgeting</h2>
<p>Use the current bill from DIAL for the payment estimate, and know that it will grow on the capped schedule rather than jumping to your price. Your lender collects a prorated share at closing and then a monthly amount in escrow. Insurance is the other line in that payment, and it varies by address more than tax does here.</p>

<h2>Seller prorations</h2>
<p>At closing the escrow officer splits the current tax year to the day. If you have already paid the year in full, you get the buyer's share back on the settlement statement. If the year is unpaid, your share through closing comes out of your proceeds. Either way the tax picture is part of the net sheet we send with every offer.</p>

<h2>Relief programs for 2026</h2>
<p><strong>Senior and disabled deferral.</strong> Oregon does not freeze taxes for seniors. It offers a deferral. The state pays the tax, places a lien on the home, and collects the balance with 6% annual interest when the home sells or transfers. For the 2026-27 tax year you qualify at age 62 or older, or if you are disabled and eligible for Social Security disability benefits, with household income under $70,000 and at least five full years owning and living in the home, per the Department of Revenue's program guide.</p>
<p><strong>Disabled veteran exemption.</strong> For 2026 a qualifying veteran or surviving spouse can exempt $27,092 or $32,512 of assessed value, depending on the category. The amount rises 3% each year. Claims are filed with the county assessor on or before April 1 before the tax year.</p>
<p><strong>Active-duty exemption.</strong> Set by formula under ORS 307.286, not by a published table: $60,000 of assessed value in the 2005-06 tax year, growing 3% a year since. The county assessor quotes the current-year figure when you file.</p>

<h2>If you think the number is wrong</h2>
<p>Appeals go to the county's Property Value Appeals Board. The petition is due by December 31, or the next business day. The appeal argues the real market value as of the assessment date, so recent comparable sales are the evidence that moves the board. If you bought the home for less than the county's market value, the closing statement is the first exhibit.</p>

<h2>Who to call</h2>
<p>Deschutes County Assessor, 541-388-6508, Deschutes Services Building, 1300 NW Wall Street, second floor, Bend.</p>

<h2>Questions</h2>
<h3>How are property taxes calculated in Deschutes County?</h3>
<p>The tax is the assessed value multiplied by the rate for the home's tax code area. Assessed value is the lower of the real market value and a maximum assessed value that Measure 50 caps at 3% growth per year. Both numbers and the rate are on the county's DIAL lookup for any address.</p>
<h3>Will my taxes jump after I buy?</h3>
<p>No. Oregon does not reset assessed value to your purchase price. The assessed value keeps growing on the 3% capped schedule, so the bill you see on DIAL before you buy is close to the bill you will get after.</p>
<h3>How are property taxes handled at closing?</h3>
<p>Escrow prorates the current July-through-June tax year to the closing day. The seller pays through closing, the buyer pays from closing on, and if the seller already paid the year in full the buyer's share is credited back on the settlement statement.</p>
<h3>Are Bend property taxes high compared with other Oregon cities?</h3>
<p>The rate depends on the tax code area, and the bill depends on how long the home has been held under the 3% cap, so a citywide ranking does not tell you much. Compare the actual bill on DIAL for the house you are considering with the bill on a comparable house wherever you are comparing.</p>
<h3>Where do I look up a specific property's taxes?</h3>
<p>The Deschutes County DIAL lookup at dial.deschutes.org. Search by address, owner, or account number for the assessed value, the market value, the tax code area, and the current bill.</p>

<h2>Next step</h2>
<p>When we run comps for a purchase or a sale, the tax picture comes with them. <a href="/sell">Value my home</a> for a written valuation with a net sheet, or <a href="/homes-for-sale">get listing alerts</a> and look up each home on DIAL before you tour.</p>
`,
  },
  {
    title: "Moving to Bend from California: What Changes",
    slug: "moving-to-bend-from-california",
    category: "Relocation Guides",
    tags: ["moving to bend","california","relocation","bend","central oregon"],
    hero_image_url: "/images/blog/moving-to-bend-from-california.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Moving to Bend from California: Taxes, Housing, and Timing",
    seo_description: "For California buyers looking at Bend: no sales tax, no transfer tax, how Oregon property tax differs, insurance, a visit plan beyond July, and buying first.",
    excerpt: "The California-specific questions: the tax trade, the transfer tax you will not pay, property taxes that do not reset, insurance, a visit plan beyond July, and buying before you move.",
    content: `
<p>California is the state we hear from most. A large share of our business is relocations, and most of the California buyers arrive with equity from a home sale, a remote or flexible job, and a list of questions that start with money and end with snow. This page answers the California-specific ones. The general guide is <a href="/blog/moving-to-bend-relocation-guide">Moving to Bend</a>.</p>

<h2>Why Californians look here</h2>
<p>The reasons are consistent: a smaller city with a real downtown, mountains and a river inside the city limits, four seasons, and a housing dollar that stretches further than it did in the Bay Area, Los Angeles, or San Diego. Bend is not cheap. But the same money buys more house and more lot here than in the California metros most people are leaving.</p>

<h2>Money differences that matter</h2>
<p>Oregon has no sales tax. That shows up on every purchase from a car to a couch, and it is the first thing most Californians notice. Oregon does have a state income tax, with a top rate that most California earners will find familiar, so the tax trade is not free. The current brackets are on the Oregon Department of Revenue site, and your accountant should run both states on your actual income before you decide.</p>
<p>Oregon has no state real estate transfer tax outside of Washington County, which is near Portland. In Deschutes County the transfer tax line at closing is zero. Property taxes here run on assessed value, which Oregon caps at a small annual increase, so a long-held home can carry a much lower bill than the house next door that just sold. That system is different from California's, and it is explained in <a href="/blog/property-taxes-deschutes-county">our Deschutes County property tax guide</a>.</p>
<p>Homeowners insurance is the line that surprises people. Much of Central Oregon is in a wildfire-exposed zone, and premiums vary a lot by address. Get a quote on the specific house before you write an offer, not after.</p>

<h2>A visit plan that is not only July</h2>
<p>Everyone visits in summer. Summer is the busiest, dustiest, most crowded version of Bend, and it is also the season with the most wildfire smoke. Come once in winter. Drive the roads with snow on them, see how the west side and the east side clear differently, and find out whether you like a real winter or only the idea of one. If you can only make one trip, make it in spring or fall and ask us what the other two seasons do to the house you are considering.</p>

<h2>Bend, Redmond, or Sisters</h2>
<p>Many California buyers who start in Bend end up in Redmond, where the same money buys a newer home with a bigger lot and the airport is ten minutes away, or in Sisters, which is smaller and quieter with the mountains closer. Our <a href="/blog/bend-vs-redmond-vs-sisters">Bend vs Redmond vs Sisters</a> guide is the decision page, and <a href="/blog/westside-vs-eastside-bend">westside vs eastside Bend</a> covers the split inside the city.</p>

<h2>Buying while you still live in California</h2>
<p>Most of our California clients buy before they move. We tour by video, send the disclosures and the inspection report the day we get them, and coordinate with your lender and the title company for a remote close. If you are selling in California first, the timing question is whether to buy contingent on that sale or to close there first and rent here for a few months. Contingent offers are harder to get accepted when a Bend seller has other offers, and easier when the home has been sitting. We read the specific listing and tell you which it is.</p>

<h2>Questions</h2>
<h3>Is Bend cheaper than the Bay Area or Southern California?</h3>
<p>For most of the buyers we work with, yes on housing. Bend's current median sale price is on the <a href="/housing-market/bend">Bend market page</a>, updated from live MLS data. Compare it with the median in the county you are leaving, and remember that Bend is a resort-priced town by Oregon standards, not a discount one.</p>
<h3>Should I sell in California before I buy in Bend?</h3>
<p>It depends on whether the Bend home you want has other offers. A contingent offer is a weaker offer when a seller has choices and a fine one when the home has been sitting. Many of our clients close in California first and rent in Bend for a few months. We tell you which path fits the specific house.</p>
<h3>Can I tour and close remotely?</h3>
<p>Yes. We tour by video, send every document the day we receive it, and your lender and the title company handle the close with electronic signatures and a notary near you.</p>
<h3>What surprises California buyers most?</h3>
<p>Winter driving, wildfire smoke in late summer, homeowners insurance costs that vary by address, and how much the west side of Bend costs compared with the east side. The no-sales-tax rule is the pleasant surprise.</p>
<h3>Bend, Redmond, or Sisters for a California relocator?</h3>
<p>Bend for the most to do and the widest choice of homes. Redmond for a newer home, a bigger lot, and the airport. Sisters for quiet and the mountains up close. The three market pages show the current prices side by side.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the towns you have not ruled out, or <a href="/book">book a call</a> and we will plan a visit that shows you more than July.</p>
`,
  },
  {
    title: "Working with a Buyer's Agent in Bend (Buyer-Broker Rules)",
    slug: "buyers-agent-bend-buyer-broker-agreement",
    category: "Buying Guides",
    tags: ["buyer broker agreement","buyer's agent","nar settlement","oregon","bend"],
    hero_image_url: "/images/blog/buyers-agent-bend-buyer-broker-agreement.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Buyer-Broker Agreements in Bend, Oregon: How Agents Get Paid",
    seo_description: "Why every buyer signs a written agreement before touring, what Oregon's HB 4058 and the 2024 rules require, and how a buyer's agent gets paid on a Bend deal.",
    excerpt: "Why the written agreement exists, what you sign before showings, how the fee gets paid on a real Bend deal, and why it matters most at a model home.",
    content: `
<p>Since August 2024 every buyer who tours a home with an agent signs a written agreement first. That rule changed how buyer's agents are paid, and it left a lot of buyers unsure what they are signing and why. This is the plain version for Bend and Central Oregon.</p>

<h2>Why the agreement exists</h2>
<p>The settlement of the national commission lawsuits required two things of every brokerage on a Realtor-affiliated MLS, which in Central Oregon is every brokerage you will deal with. Offers of buyer-agent compensation came out of the MLS, and buyers working with an agent now sign a written agreement before the first showing that states what the agent will do and what the agent will be paid. The point is that you see the number before you owe it, instead of learning at closing that a fee was baked into the deal.</p>

<h2>What you sign before showings</h2>
<p>The agreement names the agent and the brokerage, says how long it runs, describes what we do for you, and states the fee. Oregon wrote the same requirement into state law in 2024 with House Bill 4058, which requires a written buyer representation agreement before, or as soon as possible after, an agent starts assisting a buyer. The standard Oregon form is OREF 050, the Buyers Representation Agreement. We go through it with you before the first showing and we do not tour until it is signed, because the MLS rule does not allow it. The term is negotiable. Some buyers sign for a single property or a single day to start, then extend once they are comfortable.</p>

<h2>How pay works on a real Bend deal</h2>
<p>The fee in your agreement is what your agent is owed if you buy. Where the money comes from is negotiated in the offer. A seller can still agree to cover some or all of the buyer's agent fee as a term of the sale, and many do, because it widens the pool of buyers who can afford their home. It is no longer assumed and it is no longer posted. When we write your offer we ask the seller to pay it. If the seller covers all of it, you pay nothing out of pocket. If the seller covers part, the balance is yours at closing, and you knew the number before you toured. If you want the seller to pay it, that request goes in the offer, and it is one of the terms the seller weighs alongside price and timing.</p>

<h2>What a buyer's broker does here</h2>
<p>We set up the search and the alerts, tour with you, pull the closed sales for each home you like, write the offer, negotiate price and terms, manage the inspection period and any repair request, keep the lender and the title company on the timeline, and walk the property with you before closing. On land and rural homes we check the well, the septic, the zoning, and the access. On resort and HOA properties we read the documents before you commit. The <a href="/buy">buy page</a> lists the steps and the questions buyers ask most.</p>

<h2>New construction</h2>
<p>The agreement matters most at a model home. The builder's onsite representative works for the builder. If you walk in without your own agent and register, some builders will not let you add one later. Sign with us first, and we go with you or register you ahead of the visit. Our <a href="/blog/new-construction-guide-central-oregon">new construction guide</a> covers the rest.</p>

<h2>Questions</h2>
<h3>Do I need a written buyer-broker agreement before touring?</h3>
<p>Yes. Under the rules that took effect in August 2024, an agent working with a buyer must have a written agreement in place before touring a home with that buyer. We review it with you before the first showing.</p>
<h3>How does a buyer's agent get paid in Bend now?</h3>
<p>Your agreement states the fee. In the offer we ask the seller to cover it, and a seller can agree to cover some or all of it as a term of the sale. Any balance the seller does not cover is paid by you at closing, and you knew that number before you toured.</p>
<h3>Can I look at new construction without my own agent?</h3>
<p>You can, but the builder's representative works for the builder, and some builders will not let you bring in your own agent after you have registered at the model home. Sign the agreement with us first and we register you or go with you.</p>
<h3>What does a buyer's broker actually do in Central Oregon?</h3>
<p>Search and alerts, showings, comps on each home, the offer and the negotiation, the inspection period, coordination with the lender and title, and the final walk-through. On rural property that includes checking the well, the septic, the zoning, and the access.</p>
<h3>What if the seller offers nothing toward the buyer-agent fee?</h3>
<p>Then the fee in your agreement is yours at closing, or you make covering it a term of your offer. We tell you how the seller has responded to that request on similar homes before you decide how to write yours.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the homes you want to see, and we will send the agreement to read before the first tour. Or <a href="/book">book a call</a> and we go through it together.</p>
`,
  },
  {
    title: "Buying New Construction in Bend and Redmond",
    slug: "new-construction-guide-central-oregon",
    category: "Buying Guides",
    tags: ["new construction","bend","redmond","builders","buying guide"],
    hero_image_url: "/images/blog/new-construction-guide-central-oregon.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Buying New Construction in Bend and Redmond | Ryan Realty",
    seo_description: "How to buy a new-construction home in Bend or Redmond with your own broker: the model home, builder contracts, upgrades, inspections, and warranties.",
    excerpt: "The builder's representative works for the builder. How to buy a new home in Bend or Redmond with your own broker: the contract, the upgrades, the inspections, the rate lock, and the warranty offer Oregon requires.",
    content: `
<p>New construction is a large share of what is for sale in Bend and Redmond, and the builder's model home is where most of those sales start. The one thing to know before you walk in is that the person at the desk works for the builder. This guide covers how to buy a new home in Central Oregon with your own broker, and what to watch in the contract, the upgrades, the inspections, and the timeline.</p>

<h2>Before you walk into the model</h2>
<p>Many builders ask visitors to register on the first visit, and some will not allow you to add your own agent after that. Sign a buyer representation agreement with us first and we register you ahead of the visit or go with you. The builder's representative is helpful and knowledgeable and represents the builder. Our job is to represent you. <a href="/blog/buyers-agent-bend-buyer-broker-agreement">Working with a buyer's agent in Bend</a> explains the agreement.</p>

<h2>Spec, production, semi-custom, and custom</h2>
<p>A spec home is already built or under construction and priced to sell. A production home is a builder's plan on a builder's lot in a subdivision, with a menu of finishes. A semi-custom home starts from a plan and allows changes. A custom home is designed for your lot. Most new homes for sale in Bend and Redmond are production or spec homes in active subdivisions on the east side of Bend and across Redmond. The current inventory is on the <a href="/homes-for-sale">search page</a> with a new-construction filter, and the <a href="/cities/bend/southeast-bend">Southeast Bend</a> and <a href="/cities/redmond">Redmond</a> pages show where the subdivisions are.</p>

<h2>Contract and upgrade pitfalls</h2>
<p>A builder's contract is the builder's form, not the standard Oregon purchase agreement, and it is written for the builder. Read the sections on the earnest money and when it becomes non-refundable, on the builder's right to substitute materials, on the completion date and what happens if it slips, and on what the warranty covers and for how long. Upgrades are where the price moves. The model is usually shown with the upgraded package, and the base price is for the base package. We price the upgrades you want against what the same finishes cost in the resale market, and we negotiate on upgrades, closing cost credits, and rate buydowns through the builder's lender, which is where builders more often give ground than on the base price.</p>

<h2>Inspections during construction</h2>
<p>A new home gets city or county inspections at each code stage. Those inspections check the code, not the quality of the work. Hire your own inspector for a pre-drywall inspection when the framing, plumbing, and electrical are exposed, and a final inspection before the walk-through. Builders in Central Oregon are used to this. Bring the list from both to the final walk-through and get the fixes in writing before closing.</p>

<h2>Timeline and rate locks</h2>
<p>Ask the builder for the realistic completion date in writing and plan the financing around it. A rate lock has a term, and a build that slips past it can cost you a lock extension or a new rate. Builders with an affiliated lender often offer a long lock or a rate buydown as an incentive. Compare that offer with an outside lender before you commit, because the incentive can be worth less than the rate difference.</p>

<h2>Warranties, HOAs, and what Oregon requires</h2>
<p>Oregon does not set the terms of a new-home warranty. What state law requires, under ORS 701.320, is that the contractor make you a written offer of a warranty against defects in materials and workmanship, and you can accept or refuse it. The terms are the builder's, so read the warranty section and get it in writing before you sign. Oregon also requires the builder to be licensed with the Construction Contractors Board, and the CCB runs a notice-of-defect process for construction claims. Almost every new subdivision in Bend and Redmond has a homeowners association. Read the dues, the rules, and the transfer fees before you write the offer. Our <a href="/blog/hoa-guide-central-oregon">HOA guide</a> covers what to look for.</p>

<h2>What the city charges to build</h2>
<p>System development charges are the one-time fees a city collects at permit for the water, sewer, and road capacity a new home uses. Bend's adopted schedule, exhibit A to the council's fee resolution, lists the residential single-unit rate as an average of $7,181 for water, $5,890 for sewer, and $9,426 for transportation, $22,497 in total, with tiers by home size, and it is not phased in for residential. The parks charge is set separately by the Bend Park and Recreation District and is not in the city's table, so there is no single published all-in figure. A builder's price includes these fees. A custom build pays them at permit. The Census Bureau counted 646 new single-family units authorized by the City of Bend in 2025 and 1,166 across Deschutes County's permitting jurisdictions, so the fees fund a pipeline that is still well short of the state's target, covered in <a href="/blog/bend-new-growth-plan-housing-20-years">Bend's housing target</a>.</p>
<p>New homes permitted in Bend from May 15, 2026, and in Sisters and unincorporated Deschutes County from April 1, 2026, are built to Oregon's R327 wildfire code. The vents, siding, deck materials, and the noncombustible zone at the foundation are in the plans because the code requires them. <a href="/blog/deschutes-county-wildfire-building-codes">Wildfire building codes and defensible space</a> covers what that means for insurance.</p>

<h2>Resale comps still matter</h2>
<p>A new home is priced by the builder, not by an appraiser, until the loan is underwritten. If the price with upgrades is above what comparable homes in the subdivision have closed at, the appraisal can come in low. We pull the closed sales in the subdivision and the nearby resale homes before you sign, so the number you agree to is one the lender will support.</p>

<h2>Questions</h2>
<h3>Do I need my own agent for new construction?</h3>
<p>You are not required to have one, and the builder's representative works for the builder. Sign a buyer representation agreement first and register your agent on the first visit, because some builders will not let you add one later. Our fee is negotiated with the builder as a term of the sale.</p>
<h3>Are new builds cheaper than resale in Bend?</h3>
<p>Not on a per-square-foot basis in most subdivisions, once upgrades are added. New homes sell on newer systems, warranties, and builder incentives on financing and closing costs. Compare the all-in price with upgrades against the closed resale homes nearby, which we pull before you sign.</p>
<h3>What should I negotiate on a new build?</h3>
<p>Upgrades, closing cost credits, and rate buydowns through the builder's lender. Builders protect the base price because it sets the comps for the rest of the subdivision, and they give ground on incentives instead.</p>
<h3>How do inspections work during construction?</h3>
<p>The city or county inspects at each code stage. Hire your own inspector for a pre-drywall inspection while the framing and systems are exposed, and a final inspection before the walk-through. Get the fixes in writing before closing.</p>
<h3>New construction in Bend versus Redmond, what is different?</h3>
<p>Redmond has more active subdivisions and larger lots at a lower price per square foot. Bend's new construction is concentrated on the east and southeast side and prices higher. Both have HOAs in nearly every new subdivision. The current inventory for each is on the search page with the new-construction filter.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> with the new-construction filter for Bend or Redmond, or <a href="/book">book a call</a> before your first model-home visit.</p>
`,
  },
  {
    title: "Selling Your Bend Home from Out of State",
    slug: "selling-your-bend-home-from-out-of-state",
    category: "Selling Guides",
    tags: ["remote seller","out of state","bend","selling guide","vacant home"],
    hero_image_url: "/images/blog/selling-your-bend-home-from-out-of-state.jpg",
    author_broker_id: "2fda6811-2edf-49e3-b3ca-33e1052f82e6",
    published_at: '2026-09-07T16:00:00Z',
    status: 'published',
    seo_title: "Selling Your Bend Home from Out of State | Ryan Realty",
    seo_description: "How out-of-state owners sell a Bend home: a written valuation with photos, keys and vendors handled here, weekly reports, vacant-home care, remote closing.",
    excerpt: "Most of our out-of-state sellers never make the trip. Pricing without being here, access and vacant-home care, showings and offers by email, and closing from wherever you live.",
    content: `
<p>A large share of the homes we list in Bend belong to owners who no longer live here. Some moved for work, some inherited the house, some kept it as a second home and are done with it. Selling from out of state is normal here, and the process is built for it. This is what it looks like from the first call to the wire at closing.</p>

<h2>Remote selling is normal here</h2>
<p>Central Oregon has a high share of second homes and long-distance owners, so the title companies, inspectors, cleaners, and photographers all work with absent sellers every week. Documents are signed electronically. Closing documents that need a notary are handled by a mobile notary near you or by remote online notarization where your state allows it. You do not need to be in Bend for any step, and most of our out-of-state sellers never are.</p>

<h2>Pricing without being on the ground</h2>
<p>The price comes from the same three sets of homes it always does: what has closed nearby, what is pending, and what is competing. We pull those for your district, walk the house, and send a written valuation with the comps and photos so you can see the condition we are pricing against. If you have not seen the house in a while, that walk-through is where we find the things that need to be handled before photos, and we send you a list with what each one is likely to cost and whether it changes the price. Our guide to <a href="/blog/how-to-price-your-bend-home">pricing a Bend home</a> covers the method.</p>

<h2>Access, vendors, and vacant-home care</h2>
<p>We hold the keys and manage the lockbox. Showings run through an appointment system that notifies you of every one. For a vacant home we coordinate the cleaning, the yard, and the small repairs with vendors we already use, and you approve the quotes by email. Between listing and closing the house still needs someone to check it, and that is part of the listing plan: mail pickup, snow removal, plant watering, and security checks. Our <a href="/sell">3% listing plan</a> covers remote-owner care and move-out coordination.</p>
<p>If the home is furnished, we talk through what stays, what ships, and what sells, and we can bring in an estate-sale or haul-away service. If the home has been a rental, the tenant's lease and Oregon's notice rules set the timeline, and we plan the listing around them.</p>

<h2>Showings and offers from afar</h2>
<p>You see every showing and its feedback in a weekly written report. Offers come to you by email with our summary of the price, the terms, the financing, and the net at closing, and we walk through them by phone. Counteroffers and acceptance are signed electronically. The inspection period runs the same way, with the inspection report and any repair request sent to you the day we receive them.</p>

<h2>Closing from afar</h2>
<p>Title and escrow in Deschutes County prepare the seller documents ahead of closing. You sign with a mobile notary where you live, or by remote online notarization, and the signed package goes back to escrow. Your proceeds are wired to the account you specify. Utilities transfer on the closing date, and we confirm the house is empty and clean before the keys change hands.</p>

<h2>Questions</h2>
<h3>Can I sell my Bend home without being local?</h3>
<p>Yes. Every step from the listing agreement to the closing documents can be signed electronically or with a notary near you. We handle the keys, the vendors, the showings, and the walk-throughs in Bend, and most of our out-of-state sellers never make the trip.</p>
<h3>How do showings work if I live out of state?</h3>
<p>We manage the lockbox and the showing schedule, and every showing is confirmed through an appointment system that notifies you. You get a written report each week with the showing count and the feedback.</p>
<h3>Do I need to come back for closing?</h3>
<p>No. Escrow sends the seller documents ahead of time, you sign with a mobile notary where you live or through remote online notarization where it is allowed, and your proceeds are wired to you.</p>
<h3>How do you handle a vacant home?</h3>
<p>Remote-owner care is part of the listing plan: mail pickup, snow removal, plant watering, and security checks while the home is listed. We coordinate cleaning, yard work, and small repairs with local vendors, and you approve each quote by email.</p>
<h3>What does the process look like from the first call?</h3>
<p>We walk the house and send a written valuation with comps and photos. You approve any prep work by email. We list, run the showings, and report weekly. Offers come to you with a net sheet, and closing is signed remotely and wired to you.</p>

<h2>Next step</h2>
<p><a href="/sell">Value my home</a> works with any Bend address. Tell us where you live now and we plan the sale around it.</p>
`,
  },
]
