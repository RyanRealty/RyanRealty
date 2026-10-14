-- /blog/best-neighborhoods-bend-buyers: district comparison table and answer blocks
-- (SEO & AEO Desk brief 2026-10-09, AIV a3/a4/a5/a9). Matt's OK is required before merge.
--
-- Adds, in the existing guide: an H2 "Bend's neighborhoods by the numbers" with a table of the 14
-- Bend districts plus NorthWest Crossing and the Bend row; an H2 "NorthWest Crossing or Old Bend?";
-- one Awbrey Butte sentence in "Views, golf, and the resort ring"; an H2 "Is northeast Bend a good
-- place to buy?"; and three questions (8 in all, so FAQPage carries 8). An empty answer block
-- carries data-figures-as-of="2026-10-08" so the byline prints "Figures as of Oct 8, 2026", and
-- with figures in the body the rail no longer prints "This guide carries no market figure".
--
-- Every figure was read from public.market_metric (detached, Oregon Data Share MLS) on
-- 2026-10-09 at 06:50 PT: 12-month median_close, closed_count and median_sale_to_original_list,
-- months_of_supply (6-month), period_end 2026-10-08; median_days_to_contract_90d, period_end
-- 2026-10-06 (its newest row), rounded to whole days the way the district pages print it.
-- Unpublishable cells (Old Bend and Southern Crossing days and supply) print a dash, and Old
-- Bend's 89.5% of original list stays a dash on the AIV spot-check hold. No pooled NE figure.
--
-- Guarded by the md5 of the body it was written against; the DO block fails the migration if
-- an existing row did not land on the new body (a database without the row is skipped).
-- Re-running is a no-op. scripts/blog-content/aeo-guides-2026-09.ts carries the same body, so
-- `npx tsx scripts/seed-blog-posts.ts --only aeo-guides-2026-09 --slug best-neighborhoods-bend-buyers`
-- does not undo this. To revert, run the REVERT block at the end of this file.

update public.blog_posts set
  content = $nb$
<div class="v3-blog-answer" data-figures-as-of="2026-10-08"></div>
<p>Bend has thirteen named districts inside the city and a ring of communities just outside it. Buyers do not need a ranking. They need to know which districts fit a budget, a commute, and a way of living. This guide groups the districts by the question buyers actually ask, then sends you to the live inventory for each one.</p>

<h2>Bend's neighborhoods by the numbers</h2>
<table>
<caption>Single-family homes by Bend neighborhood district, last 12 months, as of Oct 8, 2026</caption>
<thead><tr><th scope="col">Neighborhood</th><th scope="col">Median sale price</th><th scope="col">Homes sold</th><th scope="col">Median days to an offer*</th><th scope="col">Sold vs. original list</th><th scope="col">Months of supply</th></tr></thead>
<tbody>
<tr><th scope="row"><a href="/cities/bend/summit-west">Summit West</a></th><td>$1,570,000</td><td>179</td><td>63</td><td>96.7%</td><td>4.3</td></tr>
<tr><th scope="row"><a href="/cities/bend/awbrey-butte">Awbrey Butte</a></th><td>$1,172,000</td><td>131</td><td>37</td><td>94.3%</td><td>3.5</td></tr>
<tr><th scope="row"><a href="/communities/northwest-crossing">NorthWest Crossing</a>†</th><td>$1,149,500</td><td>54</td><td>14</td><td>97.4%</td><td>2.4</td></tr>
<tr><th scope="row"><a href="/cities/bend/old-bend">Old Bend</a></th><td>$1,007,500</td><td>22</td><td>–</td><td>–</td><td>–</td></tr>
<tr><th scope="row"><a href="/cities/bend/century-west">Century West</a></th><td>$1,005,000</td><td>53</td><td>22</td><td>96.0%</td><td>2.0</td></tr>
<tr><th scope="row"><a href="/cities/bend/river-west">River West</a></th><td>$996,000</td><td>89</td><td>27</td><td>96.5%</td><td>2.8</td></tr>
<tr><th scope="row"><a href="/cities/bend/southern-crossing">Southern Crossing</a></th><td>$840,000</td><td>31</td><td>–</td><td>98.4%</td><td>–</td></tr>
<tr><th scope="row"><a href="/cities/bend/southeast-bend">Southeast Bend</a></th><td>$747,500</td><td>70</td><td>20</td><td>97.1%</td><td>2.5</td></tr>
<tr><th scope="row"><a href="/cities/bend/southwest-bend">Southwest Bend</a></th><td>$729,500</td><td>120</td><td>41</td><td>96.9%</td><td>2.9</td></tr>
<tr><th scope="row"><a href="/cities/bend/orchard-district">Orchard District</a></th><td>$625,000</td><td>71</td><td>37</td><td>96.4%</td><td>1.9</td></tr>
<tr><th scope="row"><a href="/cities/bend/old-farm-district">Old Farm District</a></th><td>$625,000</td><td>234</td><td>16</td><td>98.0%</td><td>2.8</td></tr>
<tr><th scope="row"><a href="/cities/bend/boyd-acres">Boyd Acres</a></th><td>$610,000</td><td>170</td><td>26</td><td>98.3%</td><td>2.8</td></tr>
<tr><th scope="row"><a href="/cities/bend/mountain-view">Mountain View</a></th><td>$575,000</td><td>177</td><td>18</td><td>97.7%</td><td>2.8</td></tr>
<tr><th scope="row"><a href="/cities/bend/larkspur">Larkspur</a></th><td>$567,650</td><td>96</td><td>18</td><td>98.2%</td><td>3.5</td></tr>
<tr><th scope="row"><strong><a href="/housing-market/bend">Bend, all</a></strong></th><td><strong>$765,000</strong></td><td><strong>2,215</strong></td><td><strong>31</strong></td><td><strong>97.0%</strong></td><td><strong>3.5</strong></td></tr>
</tbody>
</table>
<p>*Median days from listing to an accepted offer, for homes that went under contract in the last 90 days. "Sold vs. original list" is the median closing price as a share of the first list price over the last 12 months. A dash means too few homes sold to publish that figure. †NorthWest Crossing is a planned community inside the west-side districts, not a separate district, so its sales overlap the district rows. Figures come from Oregon Data Share MLS (detached single-family homes inside each recorded boundary) as of Oct 8, 2026. Each neighborhood page updates daily.</p>

<h2>How to use this guide</h2>
<p>Start with two numbers you already know: what you can spend, and how far you are willing to drive to the things you do every week. Bend is small enough that every district is within twenty minutes of downtown outside of summer traffic. It is expensive enough that the west side and the east side price very differently for the same square footage. Pick the section below that matches your budget, then open the district pages to see what is for sale today.</p>

<h2>Close-in west side</h2>
<p>The districts west of the Deschutes River and the Parkway are the oldest and the most walkable. <a href="/cities/bend/river-west">River West</a> and <a href="/cities/bend/old-bend">Old Bend</a> sit next to downtown, Drake Park, and the river trail. Lots are small, many homes date to the mill era, and a rebuilt or updated house here carries the highest price per square foot in the city. <a href="/communities/northwest-crossing">NorthWest Crossing</a> is the planned neighborhood on the west edge with its own commercial center, narrow streets, and alley-loaded garages. <a href="/cities/bend/awbrey-butte">Awbrey Butte</a> is the hill above the west side, with large lots, custom homes, and views of the Cascades. <a href="/cities/bend/summit-west">Summit West</a> and <a href="/cities/bend/century-west">Century West</a> run along the road to Mt. Bachelor, closer to the trailheads than to downtown.</p>
<p>Who this fits: buyers who want to walk or bike to downtown, the river, or the trails, and who will trade square footage and a garage for that.</p>

<h2>NorthWest Crossing or Old Bend?</h2>
<p>NorthWest Crossing and Old Bend are both west-side neighborhoods where the median home sells for more than $1 million, so the choice is newer and planned or historic and next to downtown. Over the last 12 months, single-family homes sold for a median of $1,149,500 in NorthWest Crossing on 54 sales and $1,007,500 in Old Bend on 22 sales, against $765,000 for Bend as a whole (Oregon Data Share MLS, as of Oct 8, 2026). NorthWest Crossing is a master-planned neighborhood with its own shops, parks, and alley-loaded garages, and eight in ten of its homes were built between 2003 and 2017. Old Bend is the city's original neighborhood, bordering downtown and Drake Park, with small lots and eight in ten homes built between 1916 and 2000. NorthWest Crossing homes that sold in the last 90 days went under contract in a median of 14 days. Old Bend had too few sales to publish that figure.</p>
<p>Figures: Ryan Realty, Oregon Data Share MLS, detached single-family, as of Oct 8, 2026 (<a href="/communities/northwest-crossing">NorthWest Crossing</a>, <a href="/cities/bend/old-bend">Old Bend</a>, <a href="/housing-market/bend">Bend</a>).</p>

<h2>Value and space on the east and southeast</h2>
<p>East of the Parkway the lots get larger and the homes get newer. <a href="/cities/bend/orchard-district">Orchard District</a> and <a href="/cities/bend/mountain-view">Mountain View</a> sit east of downtown with a mix of mid-century ranches and newer infill. <a href="/cities/bend/larkspur">Larkspur</a> and <a href="/cities/bend/southeast-bend">Southeast Bend</a> hold most of the subdivisions built in the last twenty years, with three-car garages, single-level plans, and sidewalks. <a href="/cities/bend/boyd-acres">Boyd Acres</a> is on the north end near the new commercial growth. <a href="/cities/bend/southern-crossing">Southern Crossing</a> and <a href="/cities/bend/southwest-bend">Southwest Bend</a> straddle the south end, with quick access to the Old Mill District and the Deschutes River Trail.</p>
<p>Who this fits: buyers who want more house, a newer build, a flat driveway, and RV or boat parking, and who are fine driving to the west-side trailheads.</p>

<h2>Is northeast Bend a good place to buy?</h2>
<p>If you want more house for the money and don't need to walk to downtown, northeast Bend is one of the better places in the city to buy. Over the last 12 months, single-family homes sold for a median of $575,000 in Mountain View on 177 sales, $610,000 in Boyd Acres on 170 sales, and $625,000 in the Orchard District on 71 sales, against $765,000 for Bend as a whole (Oregon Data Share MLS, as of Oct 8, 2026). Lower prices didn't mean slow sales. Homes in Mountain View and Boyd Acres that sold in the last 90 days went under contract in a median of 18 and 26 days, faster than Bend's 31. The trade-off is distance from the river and the west-side trails, and newer, more suburban streets. Eight in ten Boyd Acres homes were built between 1994 and 2018, and eight in ten in Mountain View between 1986 and 2017. The Orchard District, next to Pilot Butte and about a mile from downtown, is older, with eight in ten homes built between 1949 and 2008.</p>
<p>Figures: Ryan Realty, Oregon Data Share MLS, detached single-family, as of Oct 8, 2026 (<a href="/cities/bend/mountain-view">Mountain View</a>, <a href="/cities/bend/boyd-acres">Boyd Acres</a>, <a href="/cities/bend/orchard-district">Orchard District</a>, <a href="/housing-market/bend">Bend</a>).</p>

<h2>Views, golf, and the resort ring</h2>
<p>Some of the largest lots and the biggest views are in the communities on the edge of the city and just outside it. <a href="/communities/tetherow">Tetherow</a> is on the west edge with a golf course and a lodge. <a href="/communities/broken-top">Broken Top</a> is a gated golf community on the west side. Farther out, <a href="/communities/sunriver">Sunriver</a>, <a href="/communities/eagle-crest">Eagle Crest</a>, and <a href="/communities/black-butte-ranch">Black Butte Ranch</a> are full resorts with their own amenities and homeowner associations. Every one of these carries HOA dues and rules that change the monthly cost, so read <a href="/blog/hoa-guide-central-oregon">our HOA guide</a> before you fall for a view. Awbrey Butte, the hill above the west side, had a median single-family sale price of $1,172,000 over the last 12 months on 131 sales, as of Oct 8, 2026 (<a href="/cities/bend/awbrey-butte">Awbrey Butte homes and market</a>).</p>
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
<h3>Which is better, NorthWest Crossing or Old Bend?</h3>
<p>It depends on whether you want newer and planned or historic and next to downtown. Both are west-side neighborhoods with medians above $1 million: $1,149,500 in NorthWest Crossing on 54 sales and $1,007,500 in Old Bend on 22 sales over the last 12 months, as of Oct 8, 2026. Most NorthWest Crossing homes were built between 2003 and 2017, and most Old Bend homes between 1916 and 2000.</p>
<h3>What is the median home price in Awbrey Butte?</h3>
<p>The median single-family sale price in Awbrey Butte was $1,172,000 over the last 12 months, on 131 sales, as of Oct 8, 2026, about 53% above Bend's citywide median of $765,000.</p>
<h3>Is northeast Bend a good place to buy a house?</h3>
<p>For buyers who want more house for the money, yes. Over the last 12 months, the median single-family sale was $575,000 in Mountain View, $610,000 in Boyd Acres, and $625,000 in the Orchard District, against $765,000 citywide, as of Oct 8, 2026. Homes in Mountain View and Boyd Acres also went under contract faster than the Bend median. The trade-off is distance from the river and the west-side trails.</p>

<h2>Next step</h2>
<p>Open <a href="/neighborhoods">the district pages</a> to see what is for sale in each one, or <a href="/homes-for-sale?city=bend">get listing alerts for Bend</a> and we will send you the new listings in the districts you pick.</p>
$nb$,
  updated_at = now()
where slug = 'best-neighborhoods-bend-buyers' and md5(content) = '3790ed686b0aa5200e1c02d7e2680b1b';

do $$
begin
  if exists (
    select 1 from public.blog_posts
    where slug = 'best-neighborhoods-bend-buyers' and md5(content) <> '3ceea7533ee9d376a49bfddfab7bb28c'
  ) then
    raise exception 'best-neighborhoods-bend-buyers: body drifted from %, not updated', '3790ed686b0aa5200e1c02d7e2680b1b';
  end if;
end
$$;

-- REVERT (run by hand; restores the body this migration replaced):
-- update public.blog_posts set
--   content = $nb$
-- <p>Bend has thirteen named districts inside the city and a ring of communities just outside it. Buyers do not need a ranking. They need to know which districts fit a budget, a commute, and a way of living. This guide groups the districts by the question buyers actually ask, then sends you to the live inventory for each one.</p>
--
-- <h2>How to use this guide</h2>
-- <p>Start with two numbers you already know: what you can spend, and how far you are willing to drive to the things you do every week. Bend is small enough that every district is within twenty minutes of downtown outside of summer traffic. It is expensive enough that the west side and the east side price very differently for the same square footage. Pick the section below that matches your budget, then open the district pages to see what is for sale today.</p>
--
-- <h2>Close-in west side</h2>
-- <p>The districts west of the Deschutes River and the Parkway are the oldest and the most walkable. <a href="/cities/bend/river-west">River West</a> and <a href="/cities/bend/old-bend">Old Bend</a> sit next to downtown, Drake Park, and the river trail. Lots are small, many homes date to the mill era, and a rebuilt or updated house here carries the highest price per square foot in the city. <a href="/communities/northwest-crossing">NorthWest Crossing</a> is the planned neighborhood on the west edge with its own commercial center, narrow streets, and alley-loaded garages. <a href="/cities/bend/awbrey-butte">Awbrey Butte</a> is the hill above the west side, with large lots, custom homes, and views of the Cascades. <a href="/cities/bend/summit-west">Summit West</a> and <a href="/cities/bend/century-west">Century West</a> run along the road to Mt. Bachelor, closer to the trailheads than to downtown.</p>
-- <p>Who this fits: buyers who want to walk or bike to downtown, the river, or the trails, and who will trade square footage and a garage for that.</p>
--
-- <h2>Value and space on the east and southeast</h2>
-- <p>East of the Parkway the lots get larger and the homes get newer. <a href="/cities/bend/orchard-district">Orchard District</a> and <a href="/cities/bend/mountain-view">Mountain View</a> sit east of downtown with a mix of mid-century ranches and newer infill. <a href="/cities/bend/larkspur">Larkspur</a> and <a href="/cities/bend/southeast-bend">Southeast Bend</a> hold most of the subdivisions built in the last twenty years, with three-car garages, single-level plans, and sidewalks. <a href="/cities/bend/boyd-acres">Boyd Acres</a> is on the north end near the new commercial growth. <a href="/cities/bend/southern-crossing">Southern Crossing</a> and <a href="/cities/bend/southwest-bend">Southwest Bend</a> straddle the south end, with quick access to the Old Mill District and the Deschutes River Trail.</p>
-- <p>Who this fits: buyers who want more house, a newer build, a flat driveway, and RV or boat parking, and who are fine driving to the west-side trailheads.</p>
--
-- <h2>Views, golf, and the resort ring</h2>
-- <p>Some of the largest lots and the biggest views are in the communities on the edge of the city and just outside it. <a href="/communities/tetherow">Tetherow</a> is on the west edge with a golf course and a lodge. <a href="/communities/broken-top">Broken Top</a> is a gated golf community on the west side. Farther out, <a href="/communities/sunriver">Sunriver</a>, <a href="/communities/eagle-crest">Eagle Crest</a>, and <a href="/communities/black-butte-ranch">Black Butte Ranch</a> are full resorts with their own amenities and homeowner associations. Every one of these carries HOA dues and rules that change the monthly cost, so read <a href="/blog/hoa-guide-central-oregon">our HOA guide</a> before you fall for a view.</p>
-- <p>Who this fits: buyers who want a course, a clubhouse, or a mountain view out the window, and who are budgeting for dues on top of the payment.</p>
--
-- <h2>How to tour on a short visit</h2>
-- <p>Most relocating buyers get one or two trips before they write an offer. Spend the first morning driving the west side and the east side back to back, with a stop at a coffee shop in each, so the price difference has a face. Spend the afternoon inside three or four homes in the district that felt right. Come back the next morning at commute time and drive from that district to wherever you will work, shop, and ski. Then open the <a href="/housing-market/bend">Bend market page</a> and look at what the district's homes have been closing at, not what they are listed at.</p>
--
-- <h2>Questions</h2>
-- <h3>What is the best neighborhood in Bend?</h3>
-- <p>There is no single best neighborhood in Bend. The west side districts win on walkability and access to the river and trails. The east and southeast districts win on square footage, newer construction, and price. The right one depends on your budget and how you spend a normal week.</p>
-- <h3>Which Bend neighborhoods are more affordable?</h3>
-- <p>Homes east of the Parkway, in districts like Southeast Bend, Larkspur, Orchard District, and Boyd Acres, generally close at a lower price per square foot than homes on the west side. The live numbers for each district are on its page and on the <a href="/housing-market/bend">Bend market page</a>.</p>
-- <h3>Which areas of Bend are the most walkable?</h3>
-- <p>River West, Old Bend, and NorthWest Crossing are the districts where people walk to coffee, dinner, and the river most often. Downtown and the Old Mill District are the two commercial centers, and the districts touching them are the walkable ones.</p>
-- <h3>How should a relocator pick a neighborhood on a short visit?</h3>
-- <p>Drive the west side and the east side back to back on the first morning, tour homes in one district that afternoon, and repeat the drive at commute time the next day. Then compare closed prices, not list prices, for that district before you decide.</p>
-- <h3>Do HOAs change the monthly cost in some neighborhoods?</h3>
-- <p>Yes. Tetherow, Broken Top, NorthWest Crossing, and every resort community carry homeowner association dues, and some carry transfer fees at closing. Many newer subdivisions on the east side have smaller HOAs. The dues and the rules are in the listing documents, and we read them with you before you offer.</p>
--
-- <h2>Next step</h2>
-- <p>Open <a href="/neighborhoods">the district pages</a> to see what is for sale in each one, or <a href="/homes-for-sale?city=bend">get listing alerts for Bend</a> and we will send you the new listings in the districts you pick.</p>
-- $nb$,
--   updated_at = now()
-- where slug = 'best-neighborhoods-bend-buyers' and md5(content) = '3ceea7533ee9d376a49bfddfab7bb28c';
