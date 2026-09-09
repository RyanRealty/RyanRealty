import type { BlogPostSeed } from '../seed-blog-posts'

/**
 * SITE-31 (2026-09-09): one guide for each of the eleven registry communities that had none.
 * Every figure in these posts was pulled fresh on 2026-09-09 from public.market_metric
 * (segment=detached, definition_id=mt-v1) and RPC get_place_character, mirroring the DAL's
 * predicates, and is stated with its window and sample size; a figure the shop's floors withheld
 * is absent, not estimated. Five communities carry no market figure at all (Inn of the 7th
 * Mountain, Rivers Edge: no rows at any grain; Mt Bachelor Village, Crooked River Ranch: HOA only;
 * Three Rivers' blended HOA figure is deliberately omitted). Non-figure claims cite the community's
 * provenance-gated content file or a primary URL, recorded on the SITE-31 node.
 *
 * Seeded as DRAFTS: CLAUDE.md §1 shows copy drafts to Matt before they enter a distribution path,
 * and social_media_skills/blog-post/SKILL.md flips status to published on his go.
 *   npx tsx scripts/seed-blog-posts.ts --only community-guides-2026-09
 */
export const posts: BlogPostSeed[] = [
  // ─── pronghorn ───
  {
    title: "Juniper Preserve: What It Costs to Buy in 2026",
    slug: "juniper-preserve-what-it-costs-to-buy",
    category: 'Community Spotlights',
    tags: ["juniper preserve","pronghorn","bend oregon","golf community","resort real estate"],
    hero_image_url: "/images/blog/eagle-crest-affordable-resort-redmond.jpg",
    published_at: '2026-09-09T05:24:16Z',
    status: 'draft',
    seo_title: "Juniper Preserve: What It Costs to Buy in 2026",
    seo_description: "11 homes for sale, a $1,998,800 median sale price over 24 months, and $265/mo HOA dues in Juniper Preserve, formerly Pronghorn.",
    excerpt: "What 11 current listings, 17 recent sales, and HOA dues actually run in Juniper Preserve (formerly Pronghorn), Bend's private golf resort community.",
    content: `
<p>Juniper Preserve is the private golf resort community northeast of Bend that a lot of longtime locals still call by its old name, Pronghorn. The resort rebranded in October 2022, but the homeowners association, the recorded plats, and the street signs never changed, so you'll run into both names depending on what you're reading. This guide walks through what a home here actually costs, what the club side does and doesn't include, how the four neighborhoods differ, and what's for sale as of this writing. Every figure below comes from our own listing data or the resort's own published sources, dated so you know exactly how current it is.</p>

<h2>What does it cost to buy in Juniper Preserve right now?</h2>
<p>As of this writing, 11 homes are for sale in Juniper Preserve, and the median asking price across those 11 listings is $1,595,000. That's the asking side of the picture. <a href="/communities/pronghorn">Browse the current listings on our Juniper Preserve community page</a> to see the actual homes behind that number, since the mix of what's on the market shifts the median from month to month in a community this small.</p>

<h2>What have homes actually sold for?</h2>
<p>Over the last 24 months, the median sale price in Juniper Preserve was $1,998,800, from 17 closings. We're using a 24-month window here on purpose. The 12-month sample doesn't clear the threshold we use before publishing a number, so we're not going to guess at it. Seventeen sales over two years tells you something on its own: this is a low-volume, high-value market, not a place where a fresh median shows up every quarter.</p>

<h2>How fast do homes sell?</h2>
<p>Over that same 24-month window, the median time from listing to an accepted contract was 63 days, on those 17 sales. And in the last 12 months, 5 detached homes closed in the community. Put those two together and the pattern is clear: Juniper Preserve moves at a resort pace. Buyers take their time, and even a well-priced listing tends to sit longer than it would in a typical Bend subdivision.</p>

<h2>What do the HOA dues cover, and how much are they?</h2>
<p>Median HOA dues across the 84 current listings that report them run $265 a month, or $3,180 a year. That figure is dues to Pronghorn Community Association Inc., the residential HOA that governs the neighborhoods, not the resort's club side. <a href="https://www.communitypay.us/directory/oregon/bend/pronghorn-community-association-inc/" target="_blank" rel="noopener nofollow">Oregon Secretary of State records</a> show the association registered on December 3, 2002, and it currently collects dues from 969 units across the property's four neighborhoods. What that HOA number doesn't include is golf. Buying a home here does not automatically come with club privileges, and the Fazio course specifically is limited to members and their guests, so a buyer who wants full access to both courses is budgeting for a club membership on top of the purchase price and the HOA dues, not assuming it comes with the deed.</p>

<h2>What are the four neighborhoods, and how do they differ?</h2>
<p>Juniper Preserve's residential side splits into four distinct neighborhoods, and the differences matter more than they look on a map. Four Peaks sits between the Nicklaus and Fazio courses, close to the clubhouse, and its homes can be set up as nightly or short-term rentals. The Estates sit behind a second gate, with views over one course or the other and a quieter, more private feel than the rest of the property. The Residence Club and Residences are three- and four-bedroom townhomes along the 18th hole of the Nicklaus course, sold as whole or partial ownership and fully furnished. The Villas sit east of the Nicklaus course's 17th fairway, built in a Tuscan-inspired style with stone, timber, and covered paver patios. <a href="https://juniperpreserve.com/real-estate/" target="_blank" rel="noopener nofollow">The resort's own real estate page</a> lays out the distinctions between them in more detail than any single MLS listing will.</p>

<h2>Can you rent out a home here?</h2>
<p>It depends which of the four neighborhoods you're in. Four Peaks is the one built for nightly and short-term rentals, so it's the neighborhood to look at first if rental income on a second home is part of your plan. The Estates, the Residence Club and Residences, and the Villas aren't described the same way in the resort's own materials, so if a rental plan matters to your purchase, confirm the specific rules for that address with the HOA and the resort before you write an offer. Rules inside a private resort can vary from one neighborhood to the next in ways a public listing won't spell out.</p>

<h2>Is this a full-time home or a second home?</h2>
<p>Both, and the neighborhood you choose tends to answer that question for you. The Residence Club and Residences are built and sold as fully furnished second homes, whole or partial ownership, made for buyers who want the resort without year-round upkeep. Four Peaks and the Villas work either way. The Estates, behind their own gate, read more like a full-time residential neighborhood that happens to sit inside a resort. None of this adds up to a walkable town center anywhere on the property. Groceries, a hardware store, or a dentist mean a drive into Bend, and daily life outside the resort's own dining and shop options means getting in the car.</p>

<h2>What's the golf like, and do you need a club membership?</h2>
<p>Two courses, both par-72, both designed by big names. The Jack Nicklaus Signature Course opened in 2004, plays 7,379 yards from the tips over ancient lava ridges, and is the only Nicklaus design in Oregon. It takes public tee times, so you don't have to own here to play it. The Tom Fazio Championship Course opened in 2007, plays 7,456 yards, and is reserved for members and their guests, with a par-3 eighth hole that crosses a 45-foot canyon over an exposed lava tube. Juniper Preserve is one of only two clubs in the country with a Nicklaus and a Fazio course on the same property. <a href="https://pronghorn.club/golf/" target="_blank" rel="noopener nofollow">Golf Digest</a> has ranked the Nicklaus course #36 among America's public courses and #6 in Oregon, and named the resort #18 on its list of America's best golf resorts for 2025. None of those rankings come with the deed. If you want to play the Fazio course regularly, you're pricing in a club membership right alongside the home.</p>

<h2>How far is it to town, the airport, and the mountain?</h2>
<p>Juniper Preserve sits off Powell Butte Highway, about 20 minutes from downtown Bend. Redmond's airport, Roberts Field, is about 30 minutes away. Mt. Bachelor, if you're driving down for a ski day, is about 60 minutes via Bend and Century Drive. Those drive times are the trade-off for the privacy: 640 acres of juniper forest ringed by roughly 20,000 acres of federally protected BLM land, with sightlines running from the fairways to Mt. Bachelor and the Three Sisters and no subdivision in between.</p>

<h2>What's on the property besides the two golf courses?</h2>
<p>The golf gets top billing, but it isn't the whole resort. The Juniper Lodge, a 104-room boutique hotel, opened in April 2019 and anchors the hospitality side, along with the Juniper Spa, which includes an on-property lava cave used for guided meditation and sound baths. The Trailhead is the resort's outdoor recreation hub, with heated pools, hot tubs, and fitness facilities, plus its own casual dining at the Trailhead Grill. Iris is the resort's fine-dining restaurant, open to guests, members, and the public, and the Coyote Lounge at the clubhouse rounds out the bar and lounge side. There's also Spirit Island, a private event venue built for weddings, with capacity up to 300. None of that is included in the HOA dues either. It's part of what the club membership and the resort's own room and dining rates cover, separate from what you pay to own the house.</p>

<h2>Who developed Juniper Preserve, and when were the homes built?</h2>
<p>Most homes in Juniper Preserve were built between 2005 and 2024, the 10th to 90th percentile of the 97 homes in our data, out of 98 detached homes total in the community. The Resort Group, a Hawaii-based hospitality company, <a href="https://www.theresortgroup.com/press/pronghorn" target="_blank" rel="noopener nofollow">took ownership of the resort from its original developer in February 2012</a>. That's the same company behind the October 2022 rebrand from Pronghorn Resort to Juniper Preserve, a move aimed at the resort's hospitality side more than the residential one. That's why you'll still see "Pronghorn" on the HOA paperwork, the street signs, and the MLS. The rebrand changed what the hotel and club call themselves, not the neighborhood's legal name.</p>

<h2>Questions</h2>
<h3>Is Juniper Preserve the same place as Pronghorn?</h3>
<p>Yes. The resort rebranded from Pronghorn Resort to Juniper Preserve in October 2022, but the residential HOA, Pronghorn Community Association Inc., kept its original name, and every home here is still tagged "Pronghorn" in the MLS. Both names refer to the same 640 acres northeast of Bend.</p>
<h3>How many homes are in Juniper Preserve?</h3>
<p>98 detached homes, based on our current data.</p>
<h3>What's the median home price in Juniper Preserve?</h3>
<p>Over the last 24 months, the median sale price was $1,998,800, from 17 closings. Right now, the 11 homes for sale carry a median asking price of $1,595,000.</p>
<h3>Do I have to join the golf club to live here?</h3>
<p>No. Owning a home in Juniper Preserve doesn't automatically include club privileges. The Nicklaus course takes public tee times, but the Fazio course is limited to members and their guests, so full golf access means budgeting for a separate club membership.</p>
<h3>How much are the HOA dues?</h3>
<p>Median dues across the 84 current listings that report them are $265 a month, or $3,180 a year. That covers the residential association only, not club or golf fees.</p>
<h3>How long does it take to sell a home in Juniper Preserve?</h3>
<p>Over the last 24 months, the median time from listing to accepted contract was 63 days, based on 17 sales.</p>

<h2>Next step</h2>
<p>If you're weighing a purchase in Juniper Preserve, the numbers above are a starting point, not the whole picture. Every neighborhood inside the resort has its own rules on rentals, furnishing, and club access, and that detail matters more here than it does in a standard subdivision. <a href="/communities/pronghorn">See what's currently listed in Juniper Preserve</a>, or talk to our <a href="/team">team</a> about which of the four neighborhoods actually fits what you're trying to do, whether that's a full-time move or a second home you plan to rent out part of the year.</p>
`,
  },
  // ─── awbrey-glen ───
  {
    title: "Awbrey Glen: A $1,349,000 Median and an $87 HOA",
    slug: "awbrey-glen-median-price-hoa-dues-2026",
    category: 'Community Spotlights',
    tags: ["awbrey-glen","golf communities","bend oregon","hoa dues","west side bend"],
    hero_image_url: "/images/blog/broken-top-bend-golf-community.jpg",
    published_at: '2026-09-09T05:24:16Z',
    status: 'draft',
    seo_title: "Awbrey Glen Homes: $1,349,000 Median in 2026",
    seo_description: "Awbrey Glen's 12-month median sale price, HOA dues, and golf club structure, sourced from MLS data and the club's own site, with dates and sample sizes.",
    excerpt: "What Awbrey Glen homes sold for over the last 12 months, what the HOA dues cover, how the golf club works, and what's for sale on Bend's west side now.",
    content: `
<p>Awbrey Glen sits on Awbrey Butte on Bend's northwest side, built around an 18-hole golf course that opened in 1993. If you're weighing a move here, the questions are usually practical: what a home actually sells for, what the HOA and the club cost separately, how the neighborhood was built out, and whether the golf lifestyle is worth the extra layer of dues. Here's what we can verify, with the window and the sample size behind every figure, plus what the community's own sources say about the golf course, the club, and the trail that ends at the neighborhood's edge.</p>

<h2>What does a home in Awbrey Glen cost right now?</h2>
<p>Over the last 12 months, the median sale price in Awbrey Glen was $1,349,000, from 11 closings. That's the figure to anchor on if you're budgeting for the neighborhood today. There are 207 detached homes in Awbrey Glen, so 11 sales in a year works out to roughly 1 in 19 homes changing hands, a small, deliberate market rather than a churning one.</p>
<p>Right now there are 3 homes for sale in Awbrey Glen. We don't have a clean, publishable asking-price figure for that group of 3 to share here, so we won't guess at one. The <a href="/communities/awbrey-glen">Awbrey Glen community page</a> carries the live listings with current prices, and that's the number to use, not a memory of what the neighborhood sold for last year.</p>

<h2>How fast are homes in Awbrey Glen selling?</h2>
<p>Over the last 12 months, the median time from listing to accepted contract in Awbrey Glen was 29.5 days, based on 10 homes that went under contract in that window. Combined with 11 closings over the same period, that tells you homes here don't sit for long once they're priced right, even in a neighborhood with only 207 homes total. It's a small enough sample that one unusual sale can move the number, so treat 29.5 days as a read on recent behavior, not a guarantee for your specific listing or offer.</p>

<h2>What do the HOA dues in Awbrey Glen cover, and what don't they cover?</h2>
<p>The median HOA due in Awbrey Glen is $87 a month, or $1,044 a year, based on the 50 current listings that report dues. That covers the gated residential sections themselves. It does not cover the golf course, the clubhouse, the pool, or the fishing lake. Those belong to Awbrey Glen Golf Club, a separate, member-owned organization, and the club took over ownership of the course and clubhouse in 2006, the same year the gated residential sections reached build-out. The HOA and the club are run independently of each other, so a homeowner in Awbrey Glen can pay HOA dues without ever joining the club, and a club member doesn't have to live inside the gates to belong.</p>
<p>That two-structure setup is the single most important thing to understand before you make an offer here. It means the number on the HOA disclosure isn't the whole story of what living in Awbrey Glen costs if golf, the pool, or the restaurant matter to you.</p>

<h2>What is Awbrey Glen Golf Club, and what does membership get you?</h2>
<p>The golf course was designed by Gene "Bunny" Mason and opened for play in 1993, after Brooks Resources Corporation broke ground in 1992. David McLay Kidd, the architect behind Tetherow and Bandon Dunes, later reworked Mason's original design. The course plays 7,007 yards from the back tees at par 72, across five sets of tees, according to <a href="https://www.awbreyglen.com/golf" target="_blank" rel="noopener nofollow">the club's own site</a>.</p>
<p>The practice side is built for people who take the game seriously and for kids who are just starting. There's a dual-ended driving range, practice bunkers, and putting and pitching greens staffed by PGA professionals, plus The Loop, a five-hole, par-three course the club describes as the only one of its kind in Central Oregon. The youth program runs through an Explorer group with year-round outdoor activities, and the head youth coach holds the U.S. Kids Golf Foundation's Master Kids Coach certification, a distinction the club says makes him the only coach with that credential in Central Oregon.</p>
<p>Beyond golf, membership includes a lap pool, a kiddie pool, and a hot tub open through the summer, plus a private catch-and-release lake stocked with rainbow trout. Nineteen, the club restaurant, serves lunch and dinner with Cascade Range views and is open to the public, not just members, so you can try the room before you join anything. The club currently counts roughly 375 members choosing among family, generational, golf, and sports membership options. A member-run nonprofit based at the club, Give Back, has distributed more than $1 million to Central Oregon families in need.</p>
<p>Guest access follows the same split as the HOA and the club. Sponsored guests can play the golf course, but the pool, the practice facility, and the fishing lake are reserved for members only. Read the full breakdown of amenities and access on the <a href="/communities/awbrey-glen">Awbrey Glen community page</a> before you assume a perk comes with the house.</p>

<h2>Is Awbrey Glen a full-time neighborhood or a second-home community?</h2>
<p>Awbrey Glen is built for a household that wants the golf lifestyle and is willing to fund the club as a second, ongoing cost on top of the HOA. Club membership is optional, not required to own a home in the gated sections, so you can buy here and skip the club entirely. But the neighborhood's amenities, the pool, the practice facility, and the lake, are only reachable through membership, so a homeowner who opts out of the club is largely buying the address and the golf-community setting, not the golf-community lifestyle.</p>
<p>It's a poorer fit for a buyer who wants Awbrey Butte's setting without a club commitment, or who wants to step out the front door onto a trail rather than drive to reach one, a real trade-off we cover next.</p>

<h2>What's winter like for a household in Awbrey Glen?</h2>
<p>Mt. Bachelor is about 30 minutes southwest of Awbrey Glen by way of Century Drive, roughly 22 miles from the community. That drive time is worth knowing if skiing or riding is as much a part of your routine as golf, since it puts the mountain within an easy morning trip rather than a full outing. Beyond that drive time, we don't have a sourced figure for snow load, road conditions, or seasonal course closures specific to Awbrey Glen, so we're not going to estimate one here. If winter access is a deciding factor for you, ask us and we'll help you get a direct answer from the club and the neighborhood before you write an offer.</p>

<h2>How close is Awbrey Glen to downtown Bend and the river?</h2>
<p>Awbrey Glen sits on Awbrey Butte, on Bend's northwest side, on a site with outcroppings of lava rock and reddish basalt. <a href="https://brooksresources.com/community/awbrey-glen/" target="_blank" rel="noopener nofollow">Brooks Resources Corporation</a>, the developer, says it preserved as many trees as possible during construction and applied fire-conscious building practices throughout.</p>
<p>The Deschutes River Trail's Awbrey Reach segment, built over a buried Tumalo irrigation canal, terminates inside the Awbrey Glen neighborhood, according to <a href="https://www.bendparksandrec.org/trail/deschutes-river-trail-awbrey-reach/" target="_blank" rel="noopener nofollow">Bend Park and Recreation District</a>. It runs 3.9 miles round trip on compacted gravel, with views down into the Deschutes River canyon and across to Riley Ranch Nature Reserve, and it connects north to the Archie Briggs Canyon Trail by way of a steep climb. The trade-off is access: parking is very limited on the Awbrey Glen end, so most people reach the trail by parking at Sawyer Park first, and the trail doesn't cross the river to Riley Ranch itself. So the trail is genuinely at the neighborhood's edge, but reaching it comfortably on a busy day usually means driving to Sawyer Park rather than walking out your own gate.</p>

<h2>When were the homes in Awbrey Glen built, and what does that mean for a buyer?</h2>
<p>Most of Awbrey Glen's 207 detached homes were built between 1996 and 2008, which lines up with what the community's own history says: the golf course opened in 1993 and the gated residential sections reached build-out in 2006. In practical terms, a buyer touring Awbrey Glen today is mostly touring homes from that mid-1990s-to-late-2000s window, not brand-new construction and not a neighborhood of teardown-and-rebuild lots. That's worth knowing walking into an inspection, since it sets a rough baseline for the age of a home's major systems even before you know the specific address.</p>

<h2>What's for sale in Awbrey Glen right now?</h2>
<p>As of this writing, 3 homes are for sale in Awbrey Glen. That's a small list in a 207-home neighborhood, which is typical for the community given how few homes changed hands over the last 12 months. Rather than post a snapshot that goes stale the day we publish it, we'd rather point you to the <a href="/communities/awbrey-glen">live listings on the Awbrey Glen community page</a>, where the count and the prices update as the market moves.</p>

<h2>Questions</h2>
<h3>What is the median sale price in Awbrey Glen?</h3>
<p>$1,349,000, the median over the last 12 months, from 11 closings.</p>
<h3>What are the HOA dues in Awbrey Glen?</h3>
<p>A median of $87 a month, or $1,044 a year, based on the 50 current listings that report dues. That figure covers the HOA only, not club membership.</p>
<h3>Do I have to join Awbrey Glen Golf Club to buy a home there?</h3>
<p>No. Club membership is a second, optional layer on top of the HOA. The club is member-owned and run independently, so you can own a home in the gated sections without joining, but the pool, practice facility, and fishing lake are for members only.</p>
<h3>Who designed the Awbrey Glen golf course?</h3>
<p>Gene "Bunny" Mason designed the original course, which opened for play in 1993 after Brooks Resources Corporation broke ground in 1992. David McLay Kidd, who also designed Tetherow and Bandon Dunes, later reworked Mason's design. It plays 7,007 yards from the back tees at par 72.</p>
<h3>When were most homes in Awbrey Glen built?</h3>
<p>Most of the 207 detached homes were built between 1996 and 2008. The gated residential sections reached build-out in 2006, the same year club ownership of the course and clubhouse transferred to its members.</p>
<h3>How many homes are for sale in Awbrey Glen right now?</h3>
<p>3, as of this writing. Check the <a href="/communities/awbrey-glen">Awbrey Glen community page</a> for the current list and prices, since a 3-home inventory can change within days.</p>

<h2>Next step</h2>
<p>If you're comparing Awbrey Glen against another west-side or resort community, we can walk you through the HOA-versus-club math with real numbers for the address you're considering, not neighborhood averages. <a href="/team">Talk to our team</a> and we'll help you figure out whether the club is worth it for how you'd actually use it.</p>
`,
  },
  // ─── crosswater ───
  {
    title: "Crosswater Sold Just One Home in the Last 12 Months. Here's What Buying In Actually Costs",
    slug: "crosswater-one-home-sold-in-12-months",
    category: 'Community Spotlights',
    tags: ["crosswater","sunriver","golf community","hoa dues","resort real estate"],
    hero_image_url: "/images/blog/sunriver-year-round-living-vs-vacation.jpg",
    published_at: '2026-09-09T05:24:16Z',
    status: 'draft',
    seo_title: "Crosswater Real Estate: 1 Sale in 12 Months, Explained",
    seo_description: "One home sold at Crosswater in 12 months. The real HOA dues, club membership costs, and SROA fees, all sourced, for buyers weighing this Sunriver community.",
    excerpt: "Crosswater sold one home in 12 months. The real HOA dues, club membership costs, and SROA fees, sourced, for buyers weighing this private Sunriver community.",
    content: `
<p>Crosswater is a private, gated golf community inside Sunriver, about 15 miles south of Bend on 600 acres where the Deschutes and Little Deschutes Rivers cross the golf course as many as seven times in a round. It is one of the smallest, quietest corners of the Central Oregon resort market, and the numbers back that up: 77 detached homes total, and in the last 12 months only one of them changed hands. If you are looking at <a href="/communities/crosswater">homes for sale at Crosswater</a>, the first thing to understand is that you are shopping in a market that barely trades. Here is what we can tell you, honestly, with a source behind every figure.</p>

<h2>How rarely do homes come up for sale at Crosswater?</h2>
<p>Crosswater counts 77 detached homes. Right now, 1 is listed for sale. Over the last 12 months, 1 detached home closed. That is roughly 1.3% of the community's homes trading in a year, versus the double-digit turnover you would see in a typical Bend subdivision. When a Crosswater home does list, it does not sit in a deep pool of comparable, recently-sold homes the way a Bend neighborhood does. Comps here often mean looking back further than 12 months, or widening to nearby resort communities, to build a fair picture of value.</p>
<p>We are not going to give you a sale price or an asking price for that one closing. Our own data standard withholds any dollar figure, or even a range, when the sample is this thin, because a single transaction in a community this size can be identified, and a single number can mislead as easily as inform. If you want the real figure for underwriting an offer, that is a conversation with a broker who can pull the actual closed sale from the MLS directly, not a number published on a blog post.</p>

<h2>What do the HOA dues cover, and what does the club cost separately?</h2>
<p>Two different bills exist at Crosswater, and it is easy to blur them into one. The Crosswater Owners' Association HOA dues run a median of $477 a month, or $5,724 a year, based on the six current listings that report dues. That HOA figure covers what an HOA typically covers: roads, gates, common-area landscaping, and the association's administration inside the Crosswater plat.</p>
<p>The Crosswater Club is a separate membership, run by the club, not the HOA, and it is the only way to use the golf course, The Grille restaurant, the pro shop, and Sage Springs Spa and Fitness. Per <a href="https://crosswater.com/membership" target="_blank" rel="noopener nofollow">the club's own published rate page</a>, Resident membership runs a $60,000 initiation fee plus $725 a month for local members or $625 a month for members based out of the area. A Social membership, which gets you the clubhouse, dining, and the club calendar but no golf, is a lower bar: $2,500 initiation and $145 a month. Those club fees are not HOA dues, and neither figure substitutes for the other when you are budgeting to own here.</p>

<h2>Is Crosswater Club membership required to buy a home here?</h2>
<p>Buying a lot or a home at Crosswater means buying into the club structure, not just a golf-course address. The course itself is private, reserved for Crosswater Club members and Sunriver Resort guests, and golf access runs through the club, not through the property deed alone. If golf is the point for you, the club also sells a Golf membership to non-owners at a $40,000 initiation with the same $725/$625 monthly dues as Resident membership, which tells you the club treats course access as its own product, separate from real estate. If golf is not the point, the Social tier gets you into the clubhouse and the calendar for a fraction of the cost. Either way, plan on paying the club something. There is no version of ownership at Crosswater that skips it entirely if you want to use what makes the community what it is.</p>

<h2>Full-time home or second home: how do people actually use Crosswater?</h2>
<p>Across the wider Sunriver plan that Crosswater sits inside, roughly 4,200 homesites support a 2020 Census count of just 2,023 full-time residents, a pattern of most homes standing empty for stretches of the year and filling up around holidays, summer, and ski season. Crosswater itself is smaller and more private than the rest of Sunriver, and some of its own units lean further toward part-time use: Sunriver Resort's vacation rental program offers Osprey Pointe condominiums directly, which means not every owner there is living in the home full time. If you are picturing a full-time, every-week-of-the-year neighborhood, recalibrate. Crosswater fills and empties with the resort calendar more than a conventional Bend subdivision does.</p>

<h2>What is winter like at Crosswater?</h2>
<p>This stretch of Deschutes County sits around 4,170 feet in elevation, and winter here means real snow and real cold, not a coastal-Oregon drizzle. Mt. Bachelor is about a 41-minute, 22-mile drive from Crosswater via Century Drive, which is close enough that a lot of owners treat a Crosswater home as a ski base as much as a golf base. Inside Sunriver, the SHARC recreation center runs a snow-tubing hill through the winter months, one of the few warm-weather-resort amenities that flips over to a cold-weather draw rather than closing for the season. The golf course itself is a summer-and-shoulder-season amenity. Expect the fairways to go quiet under snow for a real chunk of the year, which is part of why so many owners here treat the home as seasonal rather than year-round.</p>

<h2>What are the rental rules, inside Sunriver and inside Crosswater?</h2>
<p>Rental rules are not one blanket answer across this community, and we would rather tell you that plainly than guess. What we can confirm: some Osprey Pointe condominiums at Crosswater are enrolled directly in Sunriver Resort's own vacation rental program, so short-term rental is an active, documented practice for at least part of the community. The single-family estate lots and the Canoe Camp homes sit under the Crosswater Owners' Association's own governing documents, and we have not seen a published, sourced statement of that association's current rental policy for those properties. Do not assume rental income is either guaranteed or prohibited on an estate lot until you have read the actual CC&Rs for that specific plat. Separately, the Sunriver Owners Association, which every property owner in the broader plan answers to, focuses its published rules on exterior design and common-area standards rather than rental use. Pull the specific governing documents for whichever address you are considering before you underwrite a rental income assumption.</p>

<h2>What does Sunriver Owners Association membership add, and is it the same as the Crosswater HOA?</h2>
<p>No, and this is where buyers get tripped up. Owning inside Crosswater typically means answering to two associations, not one. The Crosswater Owners' Association runs the community's own dues, described above. Separately, the Sunriver Owners Association (SROA) governs the broader Sunriver plan Crosswater sits inside, and membership there is automatic and mandatory the moment you close, with no opting out. SROA's own published 2026 maintenance fee is $172.94 a month, $2,075.28 a year, with $30 of every month's payment going straight into the reserve fund for capital repairs. The board sets that rate every November and can raise it up to 6% without an owner vote. SROA membership is what maintains the common areas and design standards across the plan and requires Design Committee approval before you make an exterior change to a home, down to repainting a fascia board or removing a native tree. We have not found a published figure showing whether the $477 Crosswater HOA dues already include the SROA assessment or sit on top of it, so confirm that stacking directly against the specific listing's HOA disclosure before you budget.</p>

<h2>How far is Crosswater from Bend and from Mt. Bachelor?</h2>
<p>Sunriver Village, with Crosswater's closest everyday shopping and groceries, is about 5 minutes away. Bend, and the fuller range of retail, dining, and services that comes with a real city, is about 20 minutes north. Redmond Airport is about a 41-minute, 33-mile drive north on US-97. Mt. Bachelor is about a 41-minute, 22-mile drive via Century Drive. Those last two numbers landing at the same drive time despite very different mileage tells you something about the roads: the airport run is a straight highway shot, while the mountain drive climbs and winds.</p>

<h2>When were the homes at Crosswater built?</h2>
<p>The golf course opened in 1995, designed by Robert E. Cupp in a heathland style, and home construction followed close behind. Most of Crosswater's 77 detached homes were built between 1997 and 2006, which puts the bulk of the community's construction inside its first decade. That means most homes here are now roughly two to three decades old, built to a specific late-1990s-through-mid-2000s standard, worth keeping in mind on anything you are evaluating for updates versus original finishes.</p>

<h2>What is the golf course like, and who can play it?</h2>
<p>Crosswater's course plays 7,683 yards from the championship tees, a par-72 layout that was the longest course in the country when it opened in 1995. It is a heathland-style design with bent-grass fairways and greens, five tee placements per hole, a course rating of 76.5, and a slope of 145. Golf Digest named it Best New Resort Course of 1995, ranked it as high as 28th nationally in 2005-06, and placed it 69th on its America's 100 Greatest Public Courses list for 2025-26, along with 11th best in Oregon. Golfweek ranks it 17th among the country's best residential golf courses. The course hosted the JELD-WEN Tradition, a PGA Tour Champions major, for four straight years from 2007 through 2010, along with the PGA Professional National Championship and NCAA Division I championships.</p>
<p>None of that is open to the public. The course is reserved for Crosswater Club members and Sunriver Resort guests, which is the whole reason the club membership question above matters as much as it does. You cannot buy a home here and assume you can walk on and play. You buy in, then you join.</p>

<h2>Questions</h2>
<h3>How many homes are for sale at Crosswater right now?</h3>
<p>One. That is the current active-listing count for the community, out of 77 total detached homes.</p>
<h3>What did the one home that closed in the last 12 months sell for?</h3>
<p>We are not publishing that figure. Our data standard withholds sale price, asking price, and days to contract when a community has only one closing to draw from, because a single number in a market this small can misstate the picture or effectively identify one seller's transaction. Ask a broker to pull the actual closed sale from the MLS directly if you need it for an offer.</p>
<h3>How much are the HOA dues at Crosswater?</h3>
<p>A median of $477 a month, $5,724 a year, based on the six current listings that report dues. That is separate from the Sunriver Owners Association's mandatory $172.94-a-month assessment and separate again from Crosswater Club membership dues.</p>
<h3>Do I have to join the Crosswater Club if I buy here?</h3>
<p>Effectively, yes, if you want to use the golf course, The Grille, or Sage Springs Spa and Fitness. The course is private and runs through club membership, not the property deed. A Social membership, at a lower cost, gets you the clubhouse without golf.</p>
<h3>Is the Crosswater golf course open to the public?</h3>
<p>No. It is reserved for Crosswater Club members and Sunriver Resort guests only.</p>
<h3>How far is Crosswater from Bend?</h3>
<p>About 20 minutes north. Sunriver Village, with everyday shopping, is about 5 minutes from Crosswater.</p>

<h2>Next step</h2>
<p>A community this thin rewards having someone in your corner who already knows the plats, the club structure, and what the last handful of sales actually looked like. <a href="/communities/crosswater">See current homes for sale at Crosswater</a>, compare it against the wider <a href="/communities/sunriver">Sunriver market</a> if you want more inventory to look at, or <a href="/team">talk to our team</a> about what a realistic search here looks like given how rarely these homes come up.</p>
`,
  },
  // ─── widgi-creek ───
  {
    title: "Widgi Creek: Condo or House, and What Each Costs",
    slug: "widgi-creek-condo-or-house-what-it-costs",
    category: 'Community Spotlights',
    tags: ["widgi-creek","bend golf communities","condos vs homes","hoa dues","century drive","community spotlight"],
    hero_image_url: "/images/blog/first-time-home-buyer-guide-central-oregon.jpg",
    published_at: '2026-09-09T05:24:16Z',
    status: 'draft',
    seo_title: "Widgi Creek: Condo or House, and What Each Costs",
    seo_description: "Widgi Creek condo vs house costs, the $75 detached HOA due, three separate HOAs, the golf, and the winter Century Drive closure.",
    excerpt: "Widgi Creek's $1,346,250 median, $75-a-month detached HOA dues, and why the neighborhood runs on three separate HOAs, not one.",
    content: `
<p>Widgi Creek sits on SW Century Drive, about five miles southwest of downtown Bend, wrapped around a public golf course that has been open since 1991. It mixes single-family homes with a larger stock of condominiums across four plats, so the shopping list here looks different depending on which product you want. This guide walks through what each one costs, how the HOAs actually work (there are three of them, not one), what the golf course adds to daily life, and what the winter road closure up the hill does and does not mean for you. Every figure below comes from our own MLS data or a named primary source, dated so you can check it yourself.</p>

<h2>Should you buy a condo or a house at Widgi Creek?</h2>
<p>Widgi Creek splits into two different products under one name. Single-family lots back onto the fairways or up against the Deschutes National Forest boundary, on plats named Widgi Creek, PointsWest, and Milepost 1. The Elkai Woods townhomes are a separate plat that fronts the course directly, trading yard space for a shorter walk to the first tee and a lower-maintenance property. The neighborhood currently counts 105 detached homes against 220 condominiums, so if you are picturing a golf-course community, the odds favor you ending up in a condo here rather than a house. You can see what is actually listed in each plat on our <a href="/communities/widgi-creek">Widgi Creek community page</a>, which breaks the inventory out across all four.</p>

<h2>What does it cost to buy a detached home in Widgi Creek?</h2>
<p>Over the 24 months ending September 7, 2026, the median sale price for a detached home in Widgi Creek was $1,346,250, from 10 closings. That is a small sample, so treat it as a read on the neighborhood rather than an appraisal for any one house. In the 12 months ending the same date, 7 detached homes closed. As of August 30, 2026, the 10 detached homes on the market carried a median asking price of $1,224,500, a bit below that 24-month closed median, which is typical when a market has cooled from its peak pricing. We do not have a separately reported median for the Elkai Woods condominiums in this window, so we will not put a number on that here. If condo pricing is what you need, ask us and we will pull comparable closings directly.</p>

<h2>How fast do homes sell in Widgi Creek?</h2>
<p>Over that same 24-month window, the median time from listing to accepted contract for a detached home was 16.5 days, based on 10 sales. That is fast, and combined with only 7 closings in the last 12 months, it tells you the neighborhood turns over quickly relative to how few homes actually change hands each year. A well-priced house on a golf lot does not sit long. It also means the handful of homes for sale at any given moment is close to the whole opportunity set for the year, not a small slice of a much bigger pool. If you wait for a big selection to show up before you look seriously, you may be waiting through more than one selling season.</p>

<h2>What do the HOA dues cover, and why do they differ by plat?</h2>
<p>Widgi Creek is not one HOA. A 2020 Oregon Court of Appeals case names three separate associations tied to the property: the Widgi Creek Homeowners Association, the Elkai Woods Homeowners Association, and the Elkai Woods Fractional Homeowners Association. A single-family lot on Widgi Creek, PointsWest, or Milepost 1 falls under the Widgi Creek HOA. An Elkai Woods townhome answers to its own HOA, and a fractional Elkai Woods unit answers to a third one again. Those are three different sets of governing documents and three different budgets, not one shared assessment.</p>
<p>For detached homes, the current median HOA due is $75 a month, $900 a year, from the 37 current listings that report dues. That figure covers detached lots only. Widgi Creek also has 220 condominiums, and their dues are not part of that $75 median. If you are comparing a house on Milepost 1 to a condo at Elkai Woods, do not assume the dues land anywhere close together. Ask for the specific HOA's current budget and reserve study before you write an offer on either kind of property. You can <a href="https://caselaw.findlaw.com/court/or-court-of-appeals/2092117.html" target="_blank" rel="noopener nofollow">read the court's own description</a> of the three associations if you want the primary source.</p>

<h2>What's the golf like at Widgi Creek?</h2>
<p>The course opened in 1991, one of a wave of Central Oregon courses built that year as the region's golf-destination era took hold. It first went by Seventh Mountain Golf Village before it became Widgi Creek Golf Club. Robert Muir Graves, who spent close to fifty years designing courses across the American West and served a term as president of the American Society of Golf Course Architects in the mid-1970s, routed it along the rim of the Deschutes River Canyon. It plays to a par 72 across 6,911 yards from the back tees, with a 73.4 rating and a 134 slope.</p>
<p>It has always been a public course, which cuts both ways. Golf Digest named it among the best new courses of 1995 and has kept it on its Best Places to Play list most years since, and Source Weekly readers have voted it Central Oregon's favorite public course more than 20 times. Anyone can book a tee time here, member or visitor, which means the course does not come with the screened privacy that a members-only layout like Broken Top or Pronghorn sells. The clubhouse runs a full-service restaurant and bar with a banquet room that holds up to 150, and pickleball courts and Operation 36 Golf Academy instruction sit on site too, all open to the public rather than restricted to owners.</p>
<p>None of that requires owning here, and none of it is included in HOA dues. If you want to play, membership is separate: a seven-day membership starts at $3,350 a year, a five-day weekday membership starts at $2,950, and the Widgi Pass, a discounted green-fee option for golfers who do not want a full membership, runs $149 a year, per <a href="https://www.widgi.com/golf/memberships" target="_blank" rel="noopener nofollow">the club's own posted rates</a>. Those are club fees, not an HOA assessment, and they are optional even if you live on the fairway.</p>

<h2>What happens to Century Drive in winter, and how far is Mt. Bachelor?</h2>
<p>Century Drive continues southwest past Widgi Creek as the Cascade Lakes Scenic Byway, and Mt. Bachelor sits 22 miles further out on that same road. Deschutes County closes the highway west of Mt. Bachelor, between the Dutchman Flat and Deschutes Bridge gates, typically from mid-November into the following spring, according to the <a href="https://www.deschutescounty.gov/road/page/road-department-plans-seasonal-closures-cascade-lakes-highway-and-paulina-lake-road" target="_blank" rel="noopener nofollow">Deschutes County Road Department</a>. That closure is a real planning factor for the resort communities further down Century Drive. It is not one for Widgi Creek. The neighborhood sits well inside the closure line, so it keeps year-round road access all winter, even in years when the gates close early.</p>

<h2>Is Widgi Creek a full-time neighborhood or a second-home community?</h2>
<p>Widgi Creek reads more like a full-time Bend neighborhood than a seasonal resort. Being close to town and inside the winter closure line, both covered above, means you are not cut off from Bend for four months the way an owner further out on Century Drive can be. The elevation runs close to 3,900 feet, a few hundred feet above the valley floor where most of Bend sits, which is part of why the pine cover reads heavier here than it does closer to the river downtown, but it does not change your winter commute the way it does for communities past the gates.</p>
<p>That said, the golf-course setting and the public clubhouse pull second-home buyers too, particularly ones who want an active course and a restaurant on site rather than the gated seclusion of a members-only community. Both kinds of owners show up in the neighborhood's day-to-day, and neither is the right one across the board. It depends on whether you are set on privacy, in which case Widgi Creek's public course is a poor fit, or you would rather have a restaurant, a pro shop, and instructors a short drive away, which fits a full-time or frequent owner well.</p>

<h2>What are the rental rules if you want to rent out a home here?</h2>
<p>Because Widgi Creek runs on three separate HOAs rather than one, rental rules are not uniform across the neighborhood. The Widgi Creek Homeowners Association, the Elkai Woods Homeowners Association, and the Elkai Woods Fractional Homeowners Association each write and enforce their own governing documents, and a rule that applies to a single-family lot on Milepost 1 does not automatically apply to an Elkai Woods townhome or a fractional unit. We do not have each association's current rental policy in front of us to quote here, and pulling one HOA's rule and applying it to the whole neighborhood would be a mistake given how differently the three are structured. If renting the property matters to your decision, get the specific HOA's current CC&Rs and rental policy before you write an offer, not after.</p>

<h2>How close is Widgi Creek to downtown Bend and the airport?</h2>
<p>Widgi Creek sits about five miles southwest of downtown Bend on SW Century Drive, closer to town than the resort communities further out the same road. That is the neighborhood's real advantage over places fifteen or twenty miles out: you get a golf-course setting without giving up a short drive to downtown restaurants, groceries, or an office. Redmond Airport is about 35 minutes north, which is close to the drive time from most Bend addresses, since the airport's location is fixed relative to the whole city rather than specific to Widgi Creek.</p>

<h2>When were the homes at Widgi Creek built?</h2>
<p>Most of the detached homes in Widgi Creek were built between 1993 and 2017, based on the 105 detached homes in the current record, with the golf course itself having opened in 1991 just ahead of that build-out. That is a wide window, so a house here could be a 1990s original or one built well into the 2010s, and the difference matters for what you will want to check during inspection. We do not have a separately reported build-year range for the 220 condominiums in this window, so we are not going to estimate one. Ask your broker to pull the recorded year for the specific unit you are considering.</p>

<h2>What's for sale in Widgi Creek right now?</h2>
<p>As of September 7, 2026, 8 detached homes are for sale in Widgi Creek. That count does not include any Elkai Woods condominiums that may also be listed. We do not have a separately reported active count for condos in this pull. Eight is a small list either way, consistent with a neighborhood where only 7 detached homes closed in the last 12 months, so the homes on the market at any given moment represent a meaningful share of what is realistically available this year, not just a sliver of a much bigger pool. Because inventory is thin and moves fast, that 16.5-day median from listing to contract again, the practical approach is to set up alerts rather than check back occasionally. See what is currently listed, across all four plats, on the <a href="/communities/widgi-creek">Widgi Creek community page</a>.</p>

<h2>Questions</h2>
<h3>Is Widgi Creek mostly condos or houses?</h3>
<p>Mostly condos by count. The neighborhood has 220 condominiums against 105 detached homes, spread across four plats: Widgi Creek, PointsWest, Elkai Woods, and Milepost 1.</p>
<h3>What is a house in Widgi Creek worth right now?</h3>
<p>Over the 24 months ending September 7, 2026, the median sale price for a detached home was $1,346,250, from 10 closings. As of August 30, 2026, the 10 detached homes on the market had a median asking price of $1,224,500.</p>
<h3>How much are the HOA dues?</h3>
<p>The median for detached homes is $75 a month, $900 a year, from the 37 current listings that report dues. That figure is for detached lots only. It does not include the 220 condominiums, which pay dues to a different association.</p>
<h3>Is Widgi Creek governed by one HOA?</h3>
<p>No. There are three: the Widgi Creek Homeowners Association, the Elkai Woods Homeowners Association, and the Elkai Woods Fractional Homeowners Association, confirmed in a 2020 Oregon Court of Appeals case. Which one governs your property depends on the plat.</p>
<h3>Does the winter road closure affect Widgi Creek?</h3>
<p>Not the neighborhood itself. Deschutes County closes Century Drive west of Mt. Bachelor, between the Dutchman Flat and Deschutes Bridge gates, typically from mid-November into spring. Widgi Creek sits inside that closure line, about five miles from downtown, so it keeps year-round access.</p>
<h3>How many homes are for sale in Widgi Creek right now?</h3>
<p>8 detached homes, as of September 7, 2026. That does not include any Elkai Woods condominiums also on the market, which we do not have a separate count for. Only 7 detached homes closed in the last 12 months, so the current list is a large share of a year's worth of activity, not a small slice of it.</p>

<h2>Next step</h2>
<p>Widgi Creek's three HOAs and its two very different products, condo and detached, are exactly the kind of thing worth walking through with someone who knows the plats, not just the listing photos. <a href="/team">Meet the Ryan Realty team</a>, or see current inventory on the <a href="/communities/widgi-creek">Widgi Creek community page</a>, and we will help you sort out which plat, and which HOA, fits what you are after.</p>
`,
  },
]

export default posts
