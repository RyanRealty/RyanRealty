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
    published_at: '2026-09-09T05:38:54Z',
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
    published_at: '2026-09-09T05:38:54Z',
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
    published_at: '2026-09-09T05:38:54Z',
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
    published_at: '2026-09-09T05:38:54Z',
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
  // ─── vandevert-ranch ───
  {
    title: "Vandevert Ranch Sold One Home in 12 Months. Should You Still Try to Buy One?",
    slug: "vandevert-ranch-one-home-sold-in-12-months",
    category: 'Community Spotlights',
    tags: ["vandevert ranch","bend oregon real estate","gated community","little deschutes river","equestrian community"],
    hero_image_url: "/images/blog/vacation-rental-rules-bend-deschutes.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Vandevert Ranch: One Sale in 12 Months. Worth It?",
    seo_description: "Vandevert Ranch sold 1 home in 12 months. What we can verify about the ranch, the HOA, and the drive, and why we won't quote dues or a price.",
    excerpt: "One home sold at Vandevert Ranch in the last 12 months, and dues and price figures don't clear our shop's own floors. What we can verify before you wait on a listing.",
    content: `
<p>Vandevert Ranch is 15 homes on the Little Deschutes River, gated, ranch-covenant construction only, about twenty minutes south of Bend. If you found this page, you're probably not shopping the way you'd shop a Bend subdivision, because there's nothing here to shop. There's no active inventory we can quote, no median price, no days-on-market figure, nothing that clears our own publishing floor. What follows is what we can actually verify: the ranch's history, how it's owned and governed, what the HOA runs, and the honest gaps where a number should be and isn't. Read it before you decide whether to keep waiting on this one.</p>

<h2>How rarely do homes actually come up for sale at Vandevert Ranch?</h2>
<p>Exactly 1 detached home in Vandevert Ranch closed in the last 12 months. One sale, across a community of 15 homes total. That's not a slow year. Fifteen owners who mostly bought a ranch to keep, not to flip, and a single closing over a full year is close to a normal year here. We don't have a current count of homes for sale that clears our own publishing floor, so we're not going to hand you a number that looks precise and isn't. If you're serious about buying at Vandevert Ranch, plan on watching for the listing before it happens rather than shopping an inventory that mostly doesn't exist. We keep an eye on the <a href="/communities/vandevert-ranch">current listings and sales history for Vandevert Ranch</a> so you don't have to refresh a portal every morning.</p>

<h2>What is Vandevert Ranch, and who actually owns the land?</h2>
<p>It's still a working ranch before it's a subdivision. William Plutarch Vandevert homesteaded this land on the Little Deschutes River in 1892, before Bend or Deschutes County existed as we know them today, according to <a href="https://vandevertranch.org/history.html" target="_blank" rel="noopener nofollow">the homeowners association's own history</a>. He ran cattle under the Hashknife brand, a mark he'd used years earlier as a range foreman in Arizona and Texas, and the homestead doubled as a U.S. post office and stagecoach stop. Vandevert and his wife Sadie raised eight children on the ranch, three of whom became doctors, and he lived here until his death in 1944. His son Claude sold the 320-acre ranch in 1970 while keeping the right to live out his life on the property. Brothers Michael and John Stone held it through the early 1980s, and Jim and Carol Gardner bought it out of bankruptcy in 1987.</p>
<p>The Gardners are the reason this is a residential community at all. They restored the log homestead, folded the surrounding land into 400 acres, and opened 21 custom homesites to buyers starting in 1993, all governed by covenants that require log, timber, or stone construction. Jim Gardner, a Harvard graduate and former president of Lewis and Clark College, wrote a one-page governing philosophy for the ranch in 1991 built around natural beauty, historic integrity, privacy, and low density, and the homeowners association still points to that document today. Day-to-day management now runs through Aperion Property Management, the same firm that manages Crosswater, Pronghorn, and the Ranch at the Canyons.</p>

<h2>What does the HOA cover, and why won't we quote you a dues figure?</h2>
<p>Here's the honest version. Only 2 of the current Vandevert Ranch listings in our data report an HOA due at all, and our own floor for publishing a figure is 5 listings. 2 doesn't clear 5, so we're not averaging two numbers and calling it a dues figure, and we're not guessing at one either. If you get serious about a specific address, get the current assessment and the reserve study directly from Aperion Property Management before you write an offer. What we can tell you is what the association actually runs day to day: the common land along both banks of the Little Deschutes, the fishing pond, the equestrian facilities and riding trails, the tennis and pickleball courts, and the upkeep of the historic homestead and schoolhouse. That's a lot of shared infrastructure for 15 homes to carry together, worth knowing even without a monthly number attached to it.</p>

<h2>What is actually on the land: the river, the pond, and the trails?</h2>
<p>The common land runs along both banks of the Little Deschutes River, and it's real river frontage, not a retention pond with a view. At the center of it is a stocked fishing pond longtime owners call Rainbow Lake, 3.2 acres with 1,000 feet of shoreline, holding rainbow trout. There's no golf course on the ranch itself, but Crosswater Golf Course sits within a mile of the gate, and Vandevert owners hold an annual scramble there. On-site, the ranch has stables, paddocks, and about 8 miles of riding trail with a full-time animal caretaker, plus tennis and pickleball courts and walking and biking paths through the common land. Elk and mule deer move through seasonally, and otter, beaver, and osprey are around the river year-round. Elevation on the ranch runs from 4,160 feet near the river up to 4,180 feet at the entrance gate, worth knowing if you're picturing a valley floor. This part of the ranch, the part you can't get inside city limits, is the whole reason most buyers here don't blink at the drive.</p>

<h2>Is Vandevert Ranch a full-time neighborhood or mostly second homes?</h2>
<p>Mostly second homes, by the homeowners association's own account. That tracks with everything else about the place: a gated 15-home ranch a real drive from the nearest grocery store fits a weekend-and-summer rhythm better than a daily commute. If you're planning to live here full-time, the practical questions are the same ones any rural Central Oregon buyer needs answered for a specific parcel: which school your kids would attend (the area falls inside the Bend-La Pine School District, which also serves Sunriver and the Three Rivers corridor, though you should confirm the exact boundary for the address), how far the nearest urgent care actually is, and whether your work can run from a ranch instead of an office.</p>

<h2>What is winter like, and what does living this far out actually cost you in time?</h2>
<p>You're buying into pine forest, and that's a real trade-off, not a marketing footnote. The ranch's own Natural Resources Stewardship Plan includes a wildfire risk map built to Oregon's Senate Bill 360 forestland standards, the same law that requires defensible-space fuel reduction around structures in classified interface areas statewide. Living here means clearing brush every season, not just mowing a lawn. Deschutes County took wildfire risk in the wider south-county area seriously enough to win a <a href="https://www.deschutescounty.gov/m/newsflash/home/detail/118" target="_blank" rel="noopener nofollow">$3.4 million federal Community Wildfire Defense Grant</a> in 2025 for mitigation work covering the region. None of that makes the ranch unsafe. It does mean fire-season vigilance most Bend subdivisions never have to think about, plus a longer drive for groceries, medical care, and daily errands than you'd have inside city limits. That trade is exactly why the owners who buy here made the decision on purpose, not by accident.</p>

<h2>Can you rent out a home at Vandevert Ranch?</h2>
<p>We don't have the current CC&Rs' rental clause in front of us, and we're not going to guess at a rule this consequential. What we do know: the ranch runs under a 1991 governing philosophy built around low density and privacy, most owners treat it as a second home rather than a rental property, and Aperion Property Management administers whatever the current covenants say. If a rental income plan is part of why you're considering Vandevert Ranch, get the actual CC&Rs and any rental restriction language from the HOA before you make an offer, not after. That's a short phone call that can save you a purchase you can't use the way you planned.</p>

<h2>How far is Vandevert Ranch from Bend and from Sunriver?</h2>
<p>By the homeowners association's own account, it's about 20 minutes and 16 miles north to Bend on US-97, and about 5 minutes and 3 miles south to the Sunriver exit off the same highway. That puts groceries, urgent care, and a full-service hospital inside a half-hour drive, with Sunriver Village's restaurants and shops closer than that. It also means every errand costs you real time compared to a Bend subdivision, the trade-off Vandevert Ranch owners make with their eyes open.</p>

<h2>When were the homes at Vandevert Ranch built, and what do you have to build to match them?</h2>
<p>The 15 homes on the ranch were built between 1993 and 2003, the years right after the Gardners opened the original 21 homesites to buyers. Anything new on the ranch has to follow the same design covenant that's applied since 1993: log, timber, or stone construction only, nothing that breaks the ranch's look from the road or the river. That's part of why a rebuild or a major remodel here isn't a quick permit, and it's worth reading the actual architectural guidelines from Aperion before you budget one. You can see what's currently listed and whatever sales history we have on the <a href="/communities/vandevert-ranch">Vandevert Ranch community page</a>.</p>

<h2>If you decide to pursue a purchase here, what should you actually expect?</h2>
<p>Expect patience more than negotiation. With 1 sale in the last 12 months across 15 homes, you're not going to out-negotiate a market that barely trades. What actually helps: get pre-approved and ready to move before a listing appears, ask your broker to watch <a href="/communities/vandevert-ranch">Vandevert Ranch specifically</a> rather than a general Bend or Sunriver search, and treat the drive, the covenants, and the missing HOA figure as things to verify directly with Aperion Property Management rather than assume. A ranch this small rewards the buyer who's already done the homework when the one listing finally shows up, not the buyer who starts the homework after.</p>

<h2>Questions</h2>
<h3>How many homes are in Vandevert Ranch?</h3>
<p>15 detached homes, built out between 1993 and 2003 on the 21 custom homesites the Gardners opened to buyers starting in 1993.</p>
<h3>How often does a home come up for sale at Vandevert Ranch?</h3>
<p>Rarely. Exactly 1 detached home closed in the last 12 months, and we don't have a current for-sale count that clears our own publishing floor. Plan to watch for a listing, not shop an inventory.</p>
<h3>What are the HOA dues at Vandevert Ranch?</h3>
<p>We're not going to give you a figure. Only 2 of the current listings in our data report a due, and our floor for publishing a number is 5. Get the current assessment directly from Aperion Property Management for any specific address.</p>
<h3>Is Vandevert Ranch a gated community?</h3>
<p>Yes. It's a gated, HOA-governed ranch on the Little Deschutes River, managed day to day by Aperion Property Management, the same firm that runs Crosswater, Pronghorn, and the Ranch at the Canyons.</p>
<h3>How far is Vandevert Ranch from Bend?</h3>
<p>About 20 minutes and 16 miles north on US-97, by the homeowners association's own account. Sunriver is closer, about 5 minutes and 3 miles south.</p>
<h3>Can you build anything you want at Vandevert Ranch?</h3>
<p>No. New construction has followed a log, timber, or stone covenant since the ranch opened its first 21 homesites in 1993. Get the current architectural guidelines from Aperion before you budget a build or a remodel.</p>

<h2>Next step</h2>
<p>If Vandevert Ranch is the specific place you want, don't wait on a portal alert. Tell <a href="/team">the Ryan Realty team</a> you want this ranch by name, and we'll watch it directly and reach out the moment something real comes up. You can also bookmark the <a href="/communities/vandevert-ranch">Vandevert Ranch community page</a> for whatever public listing history we can show, plus everything sourced in this guide.</p>
`,
  },
  // ─── three-rivers ───
  {
    title: "Three Rivers, Oregon: What Homes Cost in 2026",
    slug: "three-rivers-oregon-homes-cost-2026",
    category: 'Community Spotlights',
    tags: ["three rivers oregon","bend real estate","la pine oregon","deschutes river","rural living"],
    hero_image_url: "/images/blog/vacation-rental-rules-bend-deschutes.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Three Rivers, Oregon: What Homes Cost in 2026",
    seo_description: "62 homes for sale at a $766,000 median ask, $597,500 median sale over 12 months. What Three Rivers costs, and why HOA dues vary by subdivision.",
    excerpt: "62 homes for sale in Three Rivers at a $766,000 median ask, against an $597,500 median sale price over the last 12 months from 80 closings. No single HOA number exists here, and here's why.",
    content: `
<p>Three Rivers isn't a resort. It's a stretch of unincorporated Deschutes County along the Deschutes and Little Deschutes rivers, south of Sunriver and north of La Pine, made up of more than 20 named subdivisions that were platted independently over the decades, each running its own show. If you're looking here, you're probably comparing it to Sunriver, wondering what a neighborhood with this many small HOAs actually costs to carry, or trying to figure out whether a specific lot has a well or a water bill. This guide answers all of that with figures pulled fresh from our MLS database, plus what the area's own public records and homeowner associations say about themselves. One number you won't find below is a single HOA due amount, and the section on the subdivisions explains exactly why.</p>

<h2>What does it cost to buy a home in Three Rivers right now?</h2>
<p>Right now, 62 homes are for sale in Three Rivers, at a median asking price of $766,000. Over the last 12 months, 80 detached homes closed here, at a median sale price of $597,500. That's a wide gap between what's listed today and what actually closed over the past year, and it's worth sitting with rather than averaging away. Part of it is simply mix. The homes on the market at any one moment aren't a cross-section of the neighborhood, they're whatever happens to be listed that week, and a run of larger or newer river-adjacent homes coming up for sale can pull the asking median up without changing what a typical buyer eventually pays. Don't treat $766,000 as a forecast for where this year's closings will land. <a href="/communities/three-rivers">See the current homes for sale in Three Rivers</a> and ask us for the closed comps in the specific subdivision and price point you're considering.</p>

<h2>How fast are homes selling?</h2>
<p>Over the last 12 months, the median time from listing to an accepted offer in Three Rivers was 43 days, based on 75 homes that went under contract in that window. Over just the last 90 days, that figure was 27 days, based on 17 homes, a smaller sample worth reading as a signal rather than a settled number. Read together, the shorter window suggests homes have been moving faster lately than the year as a whole, but with only 17 sales in a 90-day window, one or two unusual deals can move the median more than they would in a bigger sample. Ask your broker for the current pending activity in the specific subdivision you're watching before you set your own timeline for an offer.</p>

<h2>What's for sale in Three Rivers today?</h2>
<p>The 62 homes on the market span the same range the neighborhood always has. Some are manufactured homes on modest, sub-quarter-acre lots in the older platted subdivisions. Others are custom homes on five-plus acre timbered lots backing directly onto the Deschutes. That range is exactly why the $766,000 median asking price only tells you so much on its own. A listing in Water Wonderland and a riverfront custom build in Fall River Estates can both be "a home for sale in Three Rivers" and be nothing alike in price, lot size, or utilities. <a href="/communities/three-rivers">Browse what's currently listed</a> and filter by subdivision to see the real range for yourself.</p>

<h2>How is Three Rivers different from Sunriver next door?</h2>
<p>Three Rivers sits directly south of Sunriver, close enough that parts of it border Sunriver's own edge, but it isn't part of the resort and never has been. Sunriver operates as a single planned community with one association and its own private amenities. Three Rivers has none of that structure. There's no gate, no master HOA, and no resort concierge desk. Mail here goes to Bend or La Pine, county services come from Deschutes County rather than a resort district, and the area is made up of more than 20 separate subdivisions platted at different times, each governing itself. If what you want is Sunriver's amenities and a single point of contact, <a href="/communities/sunriver">Sunriver</a> is the better fit. If you want river access and more land for less structure, and you don't mind doing homework subdivision by subdivision, Three Rivers is worth a closer look.</p>

<h2>What are the subdivisions, and what do dues look like?</h2>
<p>More than 20 named subdivisions make up Three Rivers, among them:</p>
<ul><li>Deschutes River Recreation Homesites</li><li>River Meadows</li><li>Sun Dance</li><li>Deschutes Pines</li><li>Cougar Grove</li><li>Fall River Estates</li><li>Lazy River and Lazy River West</li><li>Pinewood Country Estates</li><li>Spring River Acres</li><li>Water Wonderland</li><li>Vandevert Ranch</li></ul>
<p>There is no single master association covering the area, and that's the reason we won't hand you one HOA due figure to plan around. Deschutes River Recreation Homesites, the largest of the platted groups, doesn't even run as one association. <a href="https://drrhunit9.org/" target="_blank" rel="noopener nofollow">Unit 9</a> and Unit 6 each keep their own property owners association, their own board, and their own governing documents, and neither publishes its dues on a public page. Unit 9's financial records sit behind an owner sign-in. Vandevert Ranch, a separate gated subdivision, runs its own association too. <a href="http://www.vandevertranch.org/" target="_blank" rel="noopener nofollow">Its own site</a> describes it as a low-density community where twenty ranch owners share 350 acres of common land on both banks of the Little Deschutes and hold about 50 acres in individual lots, and it doesn't publish a due amount on its public pages either.</p>
<p>We could hand you a blended average across every association that reports a number, and it would be technically true and practically useless, because it would tell you nothing about the specific HOA whose CC&Rs you'd actually be agreeing to. So we're not going to. Before you write an offer on any Three Rivers home, get that subdivision's current dues, its reserve study, and its CC&Rs directly from its association. We can help track down the right contact for the specific unit or subdivision you're looking at.</p>

<h2>Is this a full-time neighborhood or a second-home area?</h2>
<p>The 2020 census counted 3,925 residents living in the Three Rivers census-designated place, up from 3,014 in 2010. That's a real, growing, year-round population, not a scattering of vacation cabins. There's no city government here. Deschutes County provides public services, and kids attend Three Rivers School, a K-8 school in the Bend-La Pine School District that sits a few miles north in Sunriver. Students move on to Caldera High School or La Pine High School after eighth grade, since there's no high school inside Three Rivers itself. That mix, full-time families needing schools and county services alongside owners who use their place seasonally, shows up in the housing stock too, with modest manufactured homes on small lots sitting not far from custom homes on riverfront acreage.</p>

<h2>Do homes have wells and septic, or city utilities?</h2>
<p>Most subdivisions in Three Rivers rely on private wells and septic systems rather than a city water or sewer utility. That's standard for the area, and it comes with a documented trade-off. The <a href="https://www.oregon.gov/deq/Residential/Documents/ossDeschutesGroundwaterFS.pdf" target="_blank" rel="noopener nofollow">Oregon Department of Environmental Quality</a> has flagged the Sunriver-to-La Pine corridor, which includes Three Rivers, for groundwater vulnerable to nitrate contamination from septic systems. The area's porous volcanic soil and shallow water table are the same conditions that make a well easy to drill, and they also let septic effluent reach that water table faster than in other parts of the state. Deschutes County requires a site evaluation before approving a new septic system here, and the most common reason a parcel fails that evaluation is a water table sitting too close to the surface. If you're considering acreage in Three Rivers, get the well and the septic system tested and evaluated as part of your due diligence, before you're past the inspection window, not after.</p>
<p>The forest that gives the area its character is also fuel. In 2025, <a href="https://cascadebusnews.com/udrc-2025-annual-report/" target="_blank" rel="noopener nofollow">Upper Deschutes River Communities logged 39 completed defensible-space reimbursement projects</a> across the Three Rivers area, in subdivisions including River Meadows, Deschutes River Recreation Homesites, and Fall River Estates, part of a program serving the La Pine Rural Fire Protection District. Clearing brush and thinning canopy is routine, ongoing work your neighbors here are already doing, not an optional upgrade you'd be the only one taking on.</p>

<h2>What's winter like here?</h2>
<p>Three Rivers sits at an elevation of 4,187 feet. Reaching the mountains from here takes more planning than it does from Bend. Mt. Bachelor is roughly 23 miles away via Century Drive or US-97, and the Cascade Lakes Highway segment of that route <a href="https://www.centraloregondaily.com/news/local/deschutes-county-odot-winter-road-closures/article_d10a1c9c-2858-462c-87b6-225acd03ab29.html" target="_blank" rel="noopener nofollow">closes for the season every year, typically in mid-November</a>, with snow at the higher elevations reaching as much as 10 feet deep. It reopens before Memorial Day. For groceries, a restaurant, or a clinic in the meantime, the Village at Sunriver is the closest stop, a short drive north on US-97.</p>

<h2>Can you rent out a home in Three Rivers?</h2>
<p>Deschutes County doesn't run a permitting or zoning program specifically for short-term rentals in its unincorporated areas the way Bend, Redmond, or Sisters do inside their city limits. What the <a href="https://www.deschutescounty.gov/743/Transient-Lodging-Tax-Frequently-Asked-Q" target="_blank" rel="noopener nofollow">county does require</a> is registration: anyone renting a Three Rivers property for 30 days or less has to register with the Deschutes County Tax Office, display a county-issued Certificate of Authority number in any advertisement, and collect the county's 8% transient room tax on the rent. That's a tax and registration rule, not a permit that caps how many rentals a subdivision can have. The rule that actually limits what you can do with a specific property lives in that subdivision's own CC&Rs. With more than 20 separate associations governing Three Rivers, and Deschutes River Recreation Homesites split further into separate units with their own governing documents, a rental restriction that applies in one subdivision may not exist in the next one over. Get the specific association's rental rules in writing before you buy with a rental plan in mind.</p>

<h2>How far is Three Rivers from Bend and La Pine?</h2>
<p>Three Rivers borders Sunriver directly along US-97, about a 10-minute drive from the center of Three Rivers to Sunriver Village. Bend is about <a href="https://www.rome2rio.com/s/Three-Rivers-South/Bend" target="_blank" rel="noopener nofollow">22 miles north, roughly a 30-minute drive</a> via US-97. La Pine is closer, about 16 miles south, roughly a 21-minute drive. For day-to-day errands, the Village at Sunriver is the nearest stop for groceries, a restaurant, or a clinic.</p>

<h2>When were most Three Rivers homes built?</h2>
<p>Three Rivers holds about 1,800 detached homes today, 1,797 in our most current count, and most of them, 1,795 homes in our data, were built between 1979 and 2015. That's a long, steady build-out rather than one development wave, which tracks with an area made up of more than 20 subdivisions platted at different times. The oldest lineage in the area belongs to Vandevert Ranch, whose land traces back to <a href="https://en.wikipedia.org/wiki/William_Vandevert" target="_blank" rel="noopener nofollow">an 1892 homestead purchase</a>, when William Vandevert bought 160 acres from his brother Charlie for $600 and homesteaded another 160 acres himself. His sons sold the ranch in 1970, and about a century after the original founding, with 80 more acres added, it became the gated subdivision that still carries the family name today.</p>

<h2>Questions</h2>
<h3>Is Three Rivers a resort community?</h3>
<p>No. Three Rivers is a census-designated place made up of more than 20 independent subdivisions, with no master association, no gate, and no resort amenities. Mail addresses here are Bend or La Pine. If you want a single planned resort community with shared amenities, look at <a href="/communities/sunriver">Sunriver</a>, just to the north.</p>
<h3>How much does a home in Three Rivers cost?</h3>
<p>62 homes are for sale right now at a median asking price of $766,000. Over the last 12 months, 80 detached homes closed at a median sale price of $597,500.</p>
<h3>What are the HOA dues in Three Rivers?</h3>
<p>There isn't one number to give you. Three Rivers has no master association, and dues are set by each subdivision's own HOA, or, in the case of Deschutes River Recreation Homesites, by separate unit associations that don't publish their figures publicly. Get the current dues from the specific association before you write an offer.</p>
<h3>Do Three Rivers homes have city water and sewer?</h3>
<p>Most don't. Most subdivisions rely on private wells and septic systems, and Deschutes County requires a site evaluation before approving a new septic system in the area, since the Oregon DEQ has flagged the local groundwater as vulnerable to nitrate contamination.</p>
<h3>How far is Three Rivers from Bend?</h3>
<p>About 22 miles, roughly a 30-minute drive via US-97.</p>
<h3>Can I rent out a home in Three Rivers?</h3>
<p>You can, subject to two layers of rules. Deschutes County requires registration, a Certificate of Authority number in your ad, and its 8% transient room tax for any rental of 30 days or less. Beyond that, the actual restrictions come from the specific subdivision's CC&Rs, which vary from one association to the next.</p>

<h2>Next step</h2>
<p>Every Three Rivers subdivision is its own small market with its own rules, so the fastest way to get a real answer is to talk to someone who knows the specific one you're looking at. <a href="/team">Meet the Ryan Realty team</a>, or <a href="/communities/three-rivers">see the current Three Rivers listings</a> and we'll pull the closed comps and the HOA contact for the subdivision that catches your eye.</p>
`,
  },
  // ─── mountain-high ───
  {
    title: "Mountain High: 8 Sales in 12 Months, a $210 HOA",
    slug: "mountain-high-hoa-dues-homes-sold-2026",
    category: 'Community Spotlights',
    tags: ["mountain-high","golf communities","bend oregon","hoa dues","south bend"],
    hero_image_url: "/images/blog/broken-top-bend-golf-community.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Mountain High Bend: 8 Sales, $210 HOA",
    seo_description: "Mountain High's HOA dues, its public 9-hole golf course, build years, and rental rules, sourced from MLS data, the HOA's own documents, and the City of Bend.",
    excerpt: "What Mountain High's HOA dues cover, what the public Old Back Nine course costs to play, when the homes were built, and the rental rules that apply.",
    content: `
<p>Mountain High sits on Bend's south side, off China Hat Road, built around a public nine-hole golf course called the Old Back Nine. If you're looking at a home here, the real questions are usually simple ones: what the HOA dues actually pay for, whether the golf course is open to anyone or only to owners, how old the houses are, and what you can and can't do with the place if you don't live there full time. Here's what we can verify, with the window and the sample size behind every figure, plus what the golf course's own site, the recorded HOA documents, and the City of Bend say about the rest.</p>

<h2>How many homes are for sale in Mountain High right now, and how many sell in a year?</h2>
<p>Right now there are 5 homes for sale in Mountain High. Over the last 12 months, 8 detached homes closed. Mountain High has 188 detached homes total, so 8 sales in a year works out to a turnover of about 4% (8 divided by 188 is 4.3%), a small, slow-moving market where most owners aren't going anywhere.</p>
<p>We don't have a clean, publishable median sale price or median asking price for a sample this size, and we don't have a reliable median days-to-contract figure either, so we won't guess at any of the three. The <a href="/communities/mountain-high">Mountain High community page</a> carries the current listings with real prices, and that's the number to use, not a memory of what a house sold for last year. If you want recent closed comps for a specific address, reach out and we'll pull them for you.</p>

<h2>What do the HOA dues in Mountain High actually cover?</h2>
<p>The median HOA due in Mountain High is $210 a month, or $2,520 a year, based on the 45 current listings that report dues. Mountain High is organized into three villages, Alpine, Aspen, and Willow Creek, and the recorded governing documents split the work between a neighborhood-wide board and each village's own committee, which sets architecture, landscaping, and fencing rules for that village specifically. The board can raise the general assessment up to 5% a year on its own, and it can levy a special assessment of up to $250 a lot in a year without a vote too. Anything above that needs 60% owner approval. An unpaid assessment carries a late fee of 5% or $50, whichever is greater, plus 15% annual interest, so dues aren't optional once they're billed.</p>
<p>The documents also rule out accessory dwelling units and splitting a lot, and they keep the community residential only. Inside the gates, Mountain High has a community pool and tennis and pickleball courts. None of that runs through a separate club membership on top of the HOA, the way it does in some golf communities. It's part of what the $210 a month is already paying for.</p>

<h2>Is the golf course at Mountain High open to the public, and what does it cost to play?</h2>
<p>Yes. The <a href="https://www.oldbacknine.com/" target="_blank" rel="noopener nofollow">Old Back Nine at Mountain High</a> is a public course sitting right inside the neighborhood, described on the course's own site as tucked "between mature pines," so you don't have to buy a home here or join anything to book a tee time, and an owner doesn't have to golf to live here either. It plays nine holes at par 36, about 2,882 yards from the back tees.</p>
<p>As of this writing, the course's own rate sheet lists 9-hole green fees at $47 before 3 p.m. and $35 from 3 p.m. to close, with a $29 replay rate and $20 for juniors. A power cart runs $12 a person, a push cart $5, and club rentals are $20, or $25 for premium clubs. Like most Central Oregon courses, it closes for the season and reopens each spring, so it's a warm-weather amenity, not a year-round one.</p>

<h2>Why is it called the "Old Back Nine," and what happened to the front nine?</h2>
<p>The name is a leftover from a longer course. Jan Ward of J.L. Ward Co. built the original nine holes in 1987 and added a second nine in 1990, for a full eighteen. The course closed in 2002 in a dispute between Ward and the City of Bend, and homeowners sued to get it reopened. A Deschutes County Circuit Court ruling in 2006 ordered Ward to rebuild nine holes on the northeast side of China Hat Road, and the rebuilt course reopened in spring 2009 under its current name, using the original back-nine hole numbers, 10 through 18. The front nine was never rebuilt, which is why Mountain High's golf course today is nine holes instead of eighteen.</p>

<h2>When were the homes in Mountain High built, and what does that mean for a buyer?</h2>
<p>Most of Mountain High's 188 detached homes were built between 1984 and 1997. That's a neighborhood of mostly 1980s and 1990s construction, not new builds, so walking into a showing here, expect original or once-replaced roofs, windows, and mechanical systems on a lot of these homes, and budget an inspection with that age in mind. It also means the lots and the tree cover are established rather than freshly planted, which is part of the setting most buyers are drawn to here in the first place. A build era this consistent is also a useful comp filter: when you're pricing a specific house, you're mostly comparing it against homes from the same 13-year window, not a mix of decades.</p>

<h2>Is Mountain High a full-time neighborhood or a place people use part time?</h2>
<p>Mountain High is a gated community built around a golf course, a pool, and tennis and pickleball courts, the kind of setup that works for a household living there year-round and for one that's there part of the year. The low turnover, about 4% of the neighborhood's homes changing hands a year, points to owners who tend to stay once they're in, whether that's a full-time household or a second home they come back to on a schedule. We don't have data that breaks that split out for Mountain High specifically, so we'll describe the place rather than guess at who's inside it: three named villages, Alpine, Aspen, and Willow Creek, each with its own architectural rules, laid out on large, mature lots around the course.</p>

<h2>What are the rental rules if I want to buy in Mountain High as an investment or a part-time home?</h2>
<p>The HOA's recorded governing documents keep Mountain High residential only, with no lot subdivisions and no accessory dwelling units, and they don't spell out a village-specific minimum lease term in what we could review. That means a short-term rental here runs on the same rule as anywhere else in the city. Bend's short-term rental ordinance defines "short-term" as a stay under 30 consecutive days and requires a permit either way. A Type I permit covers a whole house rented infrequently, up to four rental periods or 30 rental days a year, or an owner-occupied home with up to two bedrooms rented an unlimited number of days. A Type II permit covers a whole house rented more than that, and it comes with a 500-foot separation requirement from another permitted short-term rental nearby. Check both the <a href="https://bendoregon.gov/services/business/short-term-rentals/" target="_blank" rel="noopener nofollow">City of Bend's short-term rental page</a> and Mountain High's own governing documents before you count on renting the place out.</p>

<h2>What's winter like in a golf community on Bend's south side?</h2>
<p>The Old Back Nine closes for the season and reopens each spring, so golf is a warm-weather draw here, not a year-round one, and the same goes for the pool and the outdoor courts. That's the one seasonal fact we can point to directly from the course's own site. We don't have a sourced figure for snow load, road plowing, or winter access specific to this neighborhood, so we're not going to estimate one. If winter access matters to your decision, ask us and we'll help you get a straight answer from the HOA before you write an offer.</p>

<h2>How far is Mountain High from downtown Bend and the Old Mill District?</h2>
<p>Mountain High sits off China Hat Road, just north of Lost Tracks Golf Club, on Bend's south side, inside the city rather than out toward Sunriver or La Pine. From there it's a short drive, minutes rather than half an hour, to both downtown Bend and the Old Mill District. The golf course markets itself on the mountain views from its own fairways, but we don't have a sourced drive-time figure to Mt. Bachelor from this specific address, so we won't put a number on that one.</p>

<h2>What's for sale in Mountain High right now?</h2>
<p>As of this writing, 5 homes are for sale in Mountain High, a small list in a 188-home neighborhood, in line with how few homes changed hands over the last 12 months. Rather than post a price snapshot that goes stale the day we publish it, we'll point you to the <a href="/communities/mountain-high">live listings on the Mountain High community page</a>, where the count and the prices update as the market moves.</p>

<h2>Questions</h2>
<h3>How many homes are for sale in Mountain High?</h3>
<p>5, as of this writing. Check the <a href="/communities/mountain-high">Mountain High community page</a> for the current list, since a 5-home inventory can change within days.</p>
<h3>What are the HOA dues in Mountain High?</h3>
<p>A median of $210 a month, or $2,520 a year, based on the 45 current listings that report dues.</p>
<h3>Is the golf course at Mountain High open to the public?</h3>
<p>Yes. The Old Back Nine is a public nine-hole course inside the neighborhood, and no membership is required to play. As of this writing it charges $47 before 3 p.m. and $35 after, per the course's own rate sheet.</p>
<h3>When were most Mountain High homes built?</h3>
<p>Between 1984 and 1997, across the neighborhood's 188 detached homes.</p>
<h3>Can I rent my Mountain High home out short-term?</h3>
<p>Only with a City of Bend short-term rental permit. The city defines short-term as under 30 consecutive days and requires a permit either way, with separate rules for an infrequent rental and a frequent one.</p>
<h3>What are the three villages inside Mountain High?</h3>
<p>Alpine, Aspen, and Willow Creek, each with its own architectural committee under the HOA's recorded governing documents.</p>

<h2>Next step</h2>
<p>If you're weighing Mountain High against another south-side or golf-course neighborhood, we can walk you through the HOA and rental math with real numbers for the address you're considering, not neighborhood averages. <a href="/team">Talk to our team</a> and we'll help you figure out whether this one actually fits how you plan to use it.</p>
`,
  },
  // ─── mt-bachelor-village ───
  {
    title: "What $620 a Month Buys You at Mt. Bachelor Village",
    slug: "mt-bachelor-village-condo-dues-buyers-guide",
    category: 'Community Spotlights',
    tags: ["mt bachelor village","bend condominiums","hoa dues","resort communities","second home"],
    hero_image_url: "/images/blog/getting-around-central-oregon-transportation.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Mt. Bachelor Village HOA Dues: $620 a Month",
    seo_description: "Mt. Bachelor Village condo HOA dues: $620 a month from 69 listings. The rental program, the HOA structure, and what to ask before you buy.",
    excerpt: "Condo dues at Mt. Bachelor Village run $620 a month across 69 reporting listings. What that covers, how the rental program works, and what to ask before you offer.",
    content: `
<p>Mt. Bachelor Village sits where SW Century Drive leaves town and starts to climb toward the mountain, with 239 condominiums built between 1974 and 1994 stacked above a bend in the Deschutes River. It is one of the few Bend addresses built to be a resort first and a neighborhood second, and that shows up in almost every question a buyer asks about it. This guide answers the ones we hear most, with real numbers where we have them and a plain admission where we do not. You can see what is currently listed at <a href="/communities/mt-bachelor-village">Mt. Bachelor Village</a> any time you want the live picture.</p>

<h2>What do the HOA dues at Mt. Bachelor Village actually cover?</h2>
<p>Across the 69 current condominium listings at Mt. Bachelor Village that report a number, the median HOA due is $620 a month, or $7,440 a year. That is high for a Bend condo, and it should be. This is not a standard HOA maintaining a roof and a strip of lawn. It is a resort HOA, and the dues carry resort-scale grounds keeping, exterior maintenance on buildings that are now 30 to 50 years old, insurance on riverfront property, and upkeep of the common areas and trail that make the address worth having. We do not have a published, line-item budget showing exactly how that $620 splits between operating costs and reserves, so treat that as an open question, not a settled fact. Ask the HOA for its current budget and reserve study before you write an offer, not after.</p>

<h2>Is it a condo, or one of the few houses?</h2>
<p>Almost everyone who buys here buys a condominium. Out of 239 condominiums, the detached side of Mt. Bachelor Village totals only 5 homes in our data, and none of the 5 currently report HOA dues, which tells you how small and how different that slice of the community really is. If a detached home comes up, treat it as its own conversation, not a smaller version of the condo math above. A five-home segment does not behave like a market, and we are not going to force a trend line onto it. For nearly every buyer, the real decision at <a href="/communities/mt-bachelor-village">Mt. Bachelor Village</a> is which building and which view, not condo versus house.</p>

<h2>How does the rental program work, and what are the rules?</h2>
<p>Mt. Bachelor Village was built to be rented. Brooks Resources, the Bend developer that opened the resort in 1974 on 170 acres along the river, sold the original condominiums as fractional and whole-interest ownership, "with the ability for the owners to put their unit in the rental program to accommodate overnight guests as inventory allowed," in the developer's own words, published on its <a href="https://brooksresources.com/community/mount-bachelor-village/" target="_blank" rel="noopener nofollow">community history page</a>. Today the on-site rental operation runs as Mt. Bachelor Village Lodging, described on the resort's own site as the exclusive on-site manager offering direct booking with resort amenities included. The resort itself changed hands in 2018, when Oksenholt Companies bought it from Brooks Resources after more than four decades of ownership, but that sale was of the resort's operating business, not of individual condominium units or the HOA. Owning here means owning into a working resort: expect turnover, cleaning crews, and guests who do not know your unit number from anyone else's. If a quiet building matters to you, ask on your tour which wings see the least rental traffic, and ask specifically what it takes to enroll or withdraw a unit from the rental program, since that is a resort decision, not an HOA one.</p>

<h2>Is Mt. Bachelor Village better as a second home or a full-time address?</h2>
<p>Both work here, and the ownership split above is a lot of why. A full-time owner gets a river-adjacent address a short drive from downtown Bend without the upkeep of a detached home. A second-home owner gets a unit that can sit in the rental program and earn something when it is empty. What does not work as well is expecting the quiet, low-traffic feel of a standard subdivision HOA. This is a resort with a working rental program built into its foundation, and the dues, the guest traffic, and the building age all trace back to that one fact. Decide which of those two owners you are before you tour, because the same unit reads very differently depending on the answer.</p>

<h2>What's the river trail actually like?</h2>
<p>The resort's own nature trail runs 2.2 miles, described on its <a href="https://www.mtbachelorvillage.com/amenities" target="_blank" rel="noopener nofollow">amenities page</a> as "pristine wilderness, brimming with wildlife and breathtaking scenery," looping along the ridge above the Deschutes River. It connects into Bend's broader Deschutes River Trail system, so you can walk or run well past the resort's own loop without getting in a car. For a buyer who wants river access and a trail out the door as much as square footage, this is the amenity that delivers every single day, more reliably than the pool does. The same page notes a seasonal outdoor pool, open Memorial Day through September, and a year-round outdoor jacuzzi, plus EV charging on site, all resort-wide draws rather than line items we can trace to a specific dues dollar.</p>

<h2>Does winter close the road to Mt. Bachelor Village?</h2>
<p>Century Drive becomes the Cascade Lakes Scenic Byway once it climbs past town, and the stretch of that route beyond Mt. Bachelor closes to cars every winter, typically December through March, according to the <a href="https://en.wikipedia.org/wiki/Cascade_Lakes_Scenic_Byway" target="_blank" rel="noopener nofollow">route's own record</a>. Mt. Bachelor Village sits close enough to town that the closure does not touch your daily access. It affects the highway further out, past the mountain, not the drive between the resort and Bend. What winter here does mean is a real one: expect snow on the grounds and the walk to your car, and do not assume every "Century Drive winter closure" headline you see is about your own street. Usually it is not.</p>

<h2>How is the HOA structured, and who runs it?</h2>
<p>The Mt. Bachelor Village HOA is managed by Aperion Management Group, a professional HOA management company, according to the <a href="https://www.mtbachelorvillage.com/mt-bachelor-village-home-owner-association" target="_blank" rel="noopener nofollow">HOA's own page</a> on the resort's site. That is worth knowing going in. A managed association usually means steadier collections and cleaner records than an informal, owner-run board, but budget and reserve decisions still get made by a board working through that manager, not by a vote at the mailbox. Ask for the last two years of board minutes and the current reserve study before you close. That is the fastest way to see whether the $620 median due is keeping pace with a resort this age, or falling behind it.</p>

<h2>What does it mean that most buildings are 30 to 50 years old?</h2>
<p>Most of the condominiums at Mt. Bachelor Village were built between 1974 and 1994, across 239 units, so the newest are already past 30 years old and the oldest are past 50. That is not a red flag by itself. Plenty of well-run associations keep buildings that age in excellent condition. But it does change what you check before you buy. Roofs, siding, decks, plumbing, and pool equipment all have a finite life, and on a building this age you want documentation of what has been replaced and what is original, not an assumption from the listing photos. This is exactly what a reserve study is for, and it is a real part of why dues here run well above a newer Bend building.</p>

<h2>How far is it really to downtown Bend and to Mt. Bachelor?</h2>
<p>The resort's address, 19717 SW Mount Bachelor Dr, sits close enough to town that the <a href="https://www.mtbachelorvillage.com/" target="_blank" rel="noopener nofollow">resort's own site</a> markets it as "just minutes from Mt. Bachelor and downtown Bend," and puts the drive to Mt. Bachelor Ski Area at about 30 minutes. That is the trade this location makes. You give up being in the middle of downtown for being on the road that leads straight to the mountain, with the river and a trail system in between. For a buyer cross-shopping this against a downtown condo or a house on Awbrey Butte, that is the real comparison to run: drive time to the mountain against walk time to a coffee shop, not price per square foot.</p>

<h2>How do lenders treat a condo in a resort like this?</h2>
<p>Financing a condo inside a resort is its own conversation with a lender, and it is worth having early, before you fall for a specific unit. In general, lenders look at a building's owner-occupancy ratio, how much of its budget goes to reserves, whether any single owner or entity holds an outsized share of units, and whether the HOA carries adequate insurance. A building that leans heavily toward short-term rentals or carries fractional-ownership units can trip a lender's warrantability rules in ways a standard subdivision condo never does. None of that is unique to Mt. Bachelor Village. It is true of resort condos generally. It does mean your pre-approval for "a condo" is not automatically good for this condo. Get your lender the HOA questionnaire and current budget before you are under contract, not during your inspection period.</p>

<h2>What should you ask before you make an offer?</h2>
<ul>
<li>Ask for the current reserve study and the last HOA budget, and compare the reserve balance to the age of the roofs and decks.</li>
<li>Ask whether the unit is currently enrolled in the rental program, and what it actually takes to enroll or withdraw one.</li>
<li>Ask your lender to run the HOA questionnaire on this specific building before you write, not after you are under contract.</li>
<li>Ask for two years of board minutes, not just the current budget, so you can see how the board has handled past repairs.</li>
<li>Walk the grounds and the trail at the time of day you would actually use them, not only during a scheduled showing.</li>
</ul>

<h2>Questions</h2>
<h3>How much are HOA dues at Mt. Bachelor Village?</h3>
<p>The median is $620 a month, or $7,440 a year, from the 69 current condominium listings that report a number. That figure is specific to condominiums. The small number of detached homes on the property do not report dues.</p>
<h3>Are there houses for sale at Mt. Bachelor Village, or only condos?</h3>
<p>Mostly condos. The community totals only 5 detached homes against 239 condominiums, and none of the 5 currently report HOA dues in our data. Nearly every buyer here is choosing between condominium buildings, not between a condo and a house.</p>
<h3>Can I rent out my unit at Mt. Bachelor Village?</h3>
<p>Yes, that is part of how the resort was built. The original developer sold units as fractional and whole-interest ownership with the ability to place them in a rental program, and today that program runs as Mt. Bachelor Village Lodging, the resort's own on-site manager. Ask what it takes to enroll or withdraw a specific unit before you buy it.</p>
<h3>How old are the buildings at Mt. Bachelor Village?</h3>
<p>Most of the 239 condominiums were built between 1974 and 1994. That puts the newest units past 30 years old and the oldest past 50, which is a real factor in the $620 median HOA due and in what you should ask about reserves before you buy.</p>
<h3>Does the winter road closure near Mt. Bachelor affect access to the resort?</h3>
<p>No. The seasonal closure on the Cascade Lakes Scenic Byway, typically December through March, applies to the stretch of highway past Mt. Bachelor, well beyond the resort. Mt. Bachelor Village keeps normal, year-round access from town.</p>
<h3>Where do the numbers in this guide come from?</h3>
<p>The HOA dues, unit count, detached-home count, and build years come from our own market data, pulled fresh from the current listing set. The resort's history, ownership, rental program, amenities, and HOA management are drawn from the resort's own website and its developer's published history, with a link to each source above.</p>

<h2>Next step</h2>
<p>See what is currently listed at <a href="/communities/mt-bachelor-village">Mt. Bachelor Village</a>, or talk to one of the brokers on our <a href="/team">team</a> about a specific unit, the rental program, or how a building's reserve study actually looks before you write an offer.</p>
`,
  },
  // ─── inn-of-the-7th-mountain ───
  {
    title: "Second Home or Rental? What Buying at Inn of the 7th Mountain Actually Means",
    slug: "inn-of-the-7th-mountain-second-home-or-rental",
    category: 'Community Spotlights',
    tags: ["inn of the 7th mountain","bend oregon","resort condos","vacation rentals","condo ownership"],
    hero_image_url: "/images/blog/first-time-home-buyer-guide-central-oregon.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Inn of the 7th Mountain: Second Home or Rental Unit?",
    seo_description: "What owning a unit at Inn of the 7th Mountain means: ownership type, the rental program, HOA basics, and what to ask before you buy.",
    excerpt: "Ownership here is part condo, part rental program, part timeshare. What that means before you buy, and why we won't publish a price or dues figure yet.",
    content: `
<p>Inn of the 7th Mountain sits on Century Drive southwest of Bend, on the road up to Mt. Bachelor, right next to <a href="/communities/widgi-creek">Widgi Creek</a>. It looks like one resort from the road, but what you'd actually be buying into is more layered than that: part condominium, part vacation-rental operation, part timeshare, and old enough to have real history behind it. A detailed 2008 account of a dispute over building repairs described the Inn as being in its thirty-fifth year at the time, which puts its original construction around 1973, spread across 21 separate condo buildings. Before you get to any question about a specific unit, it helps to understand what kind of ownership you're stepping into today. This guide walks through that, plus the questions worth asking before you write an offer. See current details on our <a href="/communities/inn-of-the-7th-mountain">Inn of the 7th Mountain community page</a> any time.</p>

<h2>Is a unit here ownership, a timeshare, or a mix of both?</h2>
<p>The honest answer is all three, depending on the building and the unit. Inn of the 7th Mountain is condominium-titled, meaning units are individually owned parcels rather than hotel rooms, but the ownership sitting inside that structure isn't uniform. Some units are deeded outright to one owner, the way any Bend condo works. Others are affiliated with WorldMark by Wyndham's vacation-ownership program, which operates on the same grounds today under the name WorldMark Bend &ndash; Seventh Mountain Resort. And a 2008 <a href="https://www.bendsource.com/news/the-feud-at-the-seventh-mountain-condo-owners-prominent-oregon-family-fight-over-repairs-to-inn-2130385/" target="_blank" rel="noopener nofollow">Bend Source report</a> on a dispute over building repairs described a condo owners' association whose rolls included both full owners and fractional owners, a structure that predates whichever operator runs the front desk today. Before you write an offer on a specific unit, get the ownership type in writing. It changes what you can do with the unit, who governs it, and what vote you get.</p>

<h2>What does the rental program actually mean if you own here?</h2>
<p>A meaningful share of the individually owned units at Inn of the 7th Mountain are enrolled in short-term vacation rental programs. <a href="https://www.vacasa.com/usa/Inn-of-the-Seventh-Mountain-OR/" target="_blank" rel="noopener nofollow">Vacasa</a> is one of the companies managing units here, listing everything from one-bedroom condos to larger multi-bedroom layouts and handling cleaning, maintenance, and guest service for owners who don't want to run a rental themselves. Putting a unit into a program like that can turn it into income on the weeks you're not using it, but it comes with trade-offs: you're sharing hallways, parking, and pool time with paying guests, you agree to the program's calendar rules about how many owner-use weeks you can block off, and in most programs you give up the option to simply lock the door and leave for six months the way you could with a standalone house. If rental income is part of your math, ask the manager for their payout structure and occupancy pattern on a comparable unit before you count on a number, not after you own it.</p>

<h2>How do HOA and resort fees work here, in plain terms?</h2>
<p>Every unit carries a monthly assessment, and at a property like this the assessment tends to cover more ground than the landscaping and reserve line a typical Bend HOA covers: exterior maintenance on buildings dating to the 1970s, common-area utilities, the shared pools and seasonal ice rink, and often basic cable or internet get folded in alongside standard reserves. The 2008 Bend Source reporting on this property is a useful caution about the ceiling on that number: the association at the time proposed a special assessment for exterior repairs large enough to split ownership into two competing factions over how to pay for it, on top of the regular monthly fee, after years of deferred maintenance. We're not printing a current dues number in this guide (see below for why), but the lesson holds regardless of what today's figure is: ask for the association's reserve study and recent meeting minutes before you buy, not just this month's assessment.</p>

<h2>Second home, rental, or full-time: which one fits?</h2>
<p>These aren't mutually exclusive here, but they do point to different units and different diligence. A full-time home is the least common fit at a property built around overnight guests, resort amenities, and a rental desk. if that's the goal, look closely at winterization, sound isolation from neighboring short-term guests, and whether the specific building allows long-term occupancy under its own rules. A second home works well if you want ski-season and summer weekends without owning a whole house, and you're comfortable sharing common areas with renters when you're not there. A rental-first purchase is the most straightforward fit for the property as it actually operates today, provided you underwrite it on real occupancy data from a manager rather than a hopeful estimate. Whichever lane you're in, tell your broker up front. It changes which units, which buildings, and which HOA documents actually matter to your decision.</p>

<h2>What amenities actually come with a unit?</h2>
<p>Per <a href="https://www.vacasa.com/usa/Inn-of-the-Seventh-Mountain-OR/" target="_blank" rel="noopener nofollow">Vacasa's own listing page</a> for the property, shared amenities include pools and hot tubs, a mini golf course, sports courts, an on-site restaurant and bar, and riverfront access. The resort's own site, <a href="https://www.seventhmountain.com/" target="_blank" rel="noopener nofollow">seventhmountain.com</a>, lists a fitness center and business center, high-speed WiFi, and kitchens in most suites, plus warm-weather activities like whitewater rafting, kayak tours, and horseback trail rides, and cold-weather features including a seasonal ice skating rink. None of that is guaranteed to any one owner in perpetuity. amenities at a resort like this can be added, closed for a season, or reworked by whoever operates the front desk. Confirm what's currently open and what your HOA dues fund versus what's a pay-to-use guest activity before you assume a pool or a court comes with the unit at no extra cost.</p>

<h2>What is winter like on Century Drive, and how far is the drive to Mt. Bachelor?</h2>
<p>Century Drive is the one road to Mt. Bachelor, and Inn of the 7th Mountain sits on it, closer to town than the mountain itself. In winter that road carries the ski traffic and the weather that comes with it. <a href="https://ktvz.com/news/accidents-crashes/2024/12/14/string-of-crashes-close-century-drive-the-road-to-mt-bachelor-now-open-again/" target="_blank" rel="noopener nofollow">KTVZ has reported</a> on multi-vehicle crashes closing the highway during storms, and traction tires or chains are a real requirement on plenty of winter days, not a suggestion. None of that closes the resort itself. being on the road to the mountain is a large part of what the address is for, and it's exactly why a ski-season rental here draws guests. If you buy expecting a quick, easy commute in every storm, budget the extra time and the right tires, and plan for the same experience for any renter you put in the unit for a powder weekend.</p>

<h2>How is this different from buying next door at Widgi Creek?</h2>
<p>The two communities share more than a fence line. On our own map data, the recorded plats that make up Inn of the 7th Mountain sit inside the same mapped boundary used for the <a href="/communities/widgi-creek">Widgi Creek</a> community, and the golf course now known as Widgi Creek Golf Club originally carried the name Seventh Mountain Golf Village before it was renamed. What's different today is the product you'd actually own. Widgi Creek is built around single-family homes and low-rise golf course condos, most bought as a house or a straightforward second home with a conventional HOA behind each product type. Inn of the 7th Mountain is an older, denser condominium complex built for overnight guests as much as for owners, with an active vacation-rental operation and a timeshare brand sharing the grounds. If what you want is a quiet golf-course house, you're shopping next door. If you want a unit that can also earn money while you're not in it, you're shopping here.</p>

<h2>Can you get a normal mortgage on a resort condo like this?</h2>
<p>Not always, and not on every unit. Lenders look hard at buildings with a working rental program, deeded fractional interests, or a timeshare operator on the same site, and they can classify a unit as a non-warrantable condo, meaning it doesn't qualify for a standard conventional loan on the usual terms. That can mean a higher rate, a larger down payment, a portfolio or specialty lender, or in some cases a cash purchase. A building's litigation history and any pending special assessment, the kind Bend Source documented here in 2008, can also affect whether a lender will touch it at all. Talk to a lender who has actually closed a resort-condo loan in Central Oregon before you write an offer, and ask specifically whether the building you're considering has cleared a condo questionnaire recently. Don't assume your regular home lender's approval on a different property carries over here.</p>

<h2>What should you ask before you make an offer?</h2>
<ul>
<li>What is this specific unit's ownership type: full deeded ownership, fractional, or affiliated with WorldMark by Wyndham's program?</li>
<li>Is the unit currently enrolled in a rental program, and if so, under what contract terms and for how long?</li>
<li>What does the monthly assessment include, and what is billed separately as a resort or amenity fee?</li>
<li>Can I see the association's most recent reserve study and the last two years of meeting minutes?</li>
<li>Is there a pending or recently completed special assessment, and what was it for?</li>
<li>Will a conventional lender finance this specific building right now, or does it require a specialty loan?</li>
<li>What are the rules on owner-use weeks, pets, and long-term occupancy for this unit's building?</li>
</ul>

<h2>Why doesn't this guide have a price or a dues number?</h2>
<p>Every figure we publish on this site is backed by our own recorded closed-sale and MLS data, and right now our database doesn't hold enough recorded activity at Inn of the 7th Mountain to publish a reliable median price, an active-listing count, days-to-contract, or an HOA dues figure. Rather than estimate, round to a guess, or borrow a number from Widgi Creek or another neighboring community, we're leaving those numbers out of this guide until our records actually cover this property. If you want to see what's listed for sale here today, a broker can pull the current MLS listings by hand and walk you through them directly, with real numbers attached to real units instead of a stand-in figure.</p>

<h2>Questions</h2>
<h3>Is Inn of the 7th Mountain a good second home, or is it really an income property?</h3>
<p>It can work as either, and some owners run it as both. The honest starting point is your own goal: a place you and your family use often, or a unit that primarily earns rental income with occasional personal use. That answer should drive which building and which unit you look at, since rental-active buildings and quieter owner-heavy buildings are not interchangeable.</p>
<h3>Can I actually get a mortgage on a unit here?</h3>
<p>Sometimes, but not automatically. Many buildings here fall into non-warrantable condo territory because of the rental program, fractional ownership, or the on-site timeshare operation, which can mean a specialty lender, a larger down payment, or a cash purchase. Confirm financing on the specific unit before you assume your usual pre-approval applies.</p>
<h3>How is Inn of the 7th Mountain different from Widgi Creek next door?</h3>
<p>Widgi Creek is single-family homes and low-rise golf course condos built mainly for owners. Inn of the 7th Mountain is an older, denser condominium complex built around overnight guests, with an active vacation-rental program and a timeshare brand on site. They share a mapped boundary and some history, but they are different products for different buyers.</p>
<h3>Does Ryan Realty have current prices or listing counts for Inn of the 7th Mountain?</h3>
<p>Not published in this guide. Our records don't yet cover enough sales here for us to print a verified median price, listing count, or dues figure, and we won't estimate one. A broker can pull whatever is currently listed on the MLS by hand and send it to you directly.</p>
<h3>What should I do first if I'm interested in a unit here?</h3>
<p>Get in touch before you look at a specific listing. A broker can tell you which buildings carry which ownership type, what's currently enrolled in a rental program, and what to ask the HOA before you write anything.</p>

<h2>Next step</h2>
<p>Visit our <a href="/communities/inn-of-the-7th-mountain">Inn of the 7th Mountain community page</a> for what we know about the property, or <a href="/team">reach out to one of our brokers</a> to get current listings pulled by hand and walk through ownership type, rental enrollment, and financing on a specific unit before you make an offer.</p>
`,
  },
  // ─── rivers-edge ───
  {
    title: "Golf Course Frontage or River Side: Choosing Your Lot in Rivers Edge",
    slug: "rivers-edge-golf-frontage-or-river-side",
    category: 'Community Spotlights',
    tags: ["rivers edge","bend","golf community","north bend","deschutes river"],
    hero_image_url: "/images/blog/broken-top-bend-golf-community.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Golf Frontage or River Side? Rivers Edge, Bend",
    seo_description: "Golf frontage or river side in Rivers Edge, Bend: what the homeowner-owned golf course means, what the HOA covers, and the numbers we won't publish yet.",
    excerpt: "Rivers Edge homeowners bought their own golf course in 2022. Here's the golf-frontage vs river-side decision, what the HOA covers, and what we still can't tell you.",
    content: `
<p>Rivers Edge sits on Bend's north side, wrapped around a golf course that the neighborhood itself now owns. That last part is not a marketing line. In March 2022 the homeowners who live here bought the golf course outright to keep it from becoming a housing development, and that ownership structure changes some of the usual assumptions a buyer brings to a golf-course neighborhood. This guide walks through what living here actually means: the difference between a golf-frontage lot and a river-side one, what the homeowners association covers, what the river and the trail actually give you, and the questions worth asking before you write an offer. We also tell you, plainly, why you won't find a median price or a dues figure below.</p>

<h2>What does it mean that the golf course is public, not private?</h2>
<p>River's Edge Golf Course, at 400 NW Pro Shop Drive, has always been open to any golfer who books a tee time or walks up, not a members-only club. That stayed true through a real threat to change it. The Purcell family, who built the course, put it up for sale in 2021, and the buyer under contract, Pahlisch Homes, planned to convert roughly half of the 18 holes into new home sites. Homeowners in the surrounding neighborhoods sued in April 2021 to stop it, and four homeowner associations combined into a Master Association that closed on buying the course themselves on March 21, 2022. It now operates as a non-profit chartered to stay an affordable, public 18-hole course, and the association has since put real money into restoring the ponds, waterfalls and bunkers and registered the course with Audubon International for water conservation.</p>
<p>What that means for you as a homeowner: you get golf-course scenery and, on the fairway-facing lots, a wide-open view, without a golf membership on your closing costs. You also don't get a private club's control over pace of play, guest policy or dress code, because the course still serves the public, not just the neighborhood. And unlike a community built around a private club, the golf course here is not a separate business that can fail, sell, or get redeveloped out from under the neighborhood on its own timeline. Its ownership <em>is</em> the neighborhood's ownership. That is a genuinely unusual structure among Bend's golf communities, and it is worth understanding before you assume Rivers Edge works like <a href="/communities/rivers-edge">any other course-front address in Bend</a>.</p>

<h2>What does the HOA actually cover here?</h2>
<p>Rivers Edge is not governed by one single association. The neighborhood grew out of several recorded plats, and the Master Association that now owns the golf course was formed by combining four separate homeowner associations specifically to make that purchase possible. Its main job today, beyond the usual roads, common areas and covenant enforcement, is operating a golf course, which is not a line item most Bend HOAs carry. A real estate description of the neighborhood we reviewed calls the recorded covenants and restrictions &quot;comprehensive,&quot; which is consistent with a community built in phases over more than a decade.</p>
<p>Here is where we stop and tell you what we don't know. We could not reach the association's own site to confirm a current dues figure, a reserve balance, or the exact rules each sub-association enforces, and we are not going to print a number we can't stand behind. Before you write an offer, ask the listing agent for the specific HOA's current budget, the reserve study, and, because the golf course itself is now the community's asset, its capital plan. That last document tells you more about your future assessments here than it would in almost any other Bend HOA.</p>

<h2>What do the river and the trail actually give you?</h2>
<p>The Deschutes River Trail's River Run Reach, maintained by Bend Park and Recreation District, runs along the river between Pioneer Park and Sawyer Park and passes directly through and alongside the River's Edge golf course. It's 1.46 miles of trail (0.2 paved, the rest compacted gravel), open 5 a.m. to 10 p.m., and it's genuinely wild in stretches: the district's own trail page notes ospreys, trumpeter swans, otters and beaver in the wetlands along this reach. It also warns, accurately, that the trail is unprotected through the golf course, so watch for stray shots.</p>
<p>The nearest formal river access is First Street Rapids Park, a 7.2-acre park on both banks a short distance downstream, with a boat landing used for canoe and kayak put-ins. None of this is a private amenity of the neighborhood. It's public park district infrastructure that happens to run through Rivers Edge, which means you get the access without an HOA maintaining it, but you also don't get to gate it off. If quiet, exclusive river frontage is what you're after, ask specifically whether a given lot's river frontage touches the public trail corridor or sits above it.</p>

<h2>Rivers Edge Village and Phase 5: how do the two plats differ?</h2>
<p>Our own MLS records carry two separate named plats under the Rivers Edge name: Rivers Edge Village, which is the original and by far the larger of the two, and Phase 5 Rivers Edge, a smaller, later addition. That split matters practically. Covenants, architectural rules and even which sub-association a home belongs to can differ by plat, so &quot;it's in Rivers Edge&quot; is not the same statement as &quot;it's on this specific recorded plat with this specific set of restrictions.&quot; Ask which plat a listing sits on and get that plat's own CC&amp;Rs, not a generic Rivers Edge summary, before you rely on anything they say about setbacks, rentals or exterior changes.</p>

<h2>Is Rivers Edge a full-time neighborhood or a second-home one?</h2>
<p>The homes here read more like full-time housing stock than typical resort-community second-home stock: mostly single-story designs on quarter- to half-acre lots, several with triple-car garages, built for golf-course or city-view frontage rather than a lock-and-leave floor plan. That layout tends to draw retirees and empty-nesters looking to stay in one place year-round as much as it draws a second-home buyer who wants river and golf access a few weeks at a time. Both buyers show up here, and the neighborhood doesn't sort cleanly into one or the other the way a condo-heavy resort community often does. If full-time livability matters to you, single-story, three-car-garage floor plans on a quarter-acre-plus lot are a reasonable proxy for what to expect.</p>

<h2>What does winter look like on Bend's north side?</h2>
<p>The golf course itself gives you an honest read on the season. Per its own site, it's generally closed for part of November and February, and all of December and January, with the driving range staying open on a self-serve basis nearly year-round. That closure window is the neighborhood's own quiet season: fewer golfers on the fairways, a canyon setting along the river that holds shade and cold air longer than open ground, and a course maintenance crew instead of foursomes outside your window. We don't have a sourced temperature or snowfall figure specific to this address to hand you, so treat &quot;canyon along a river on the north side of town&quot; as the physical fact and ask a broker who has walked the neighborhood in January what it actually feels like.</p>

<h2>What are the rental rules?</h2>
<p>This is the section where we have to say we don't know, rather than guess. The comprehensive covenants that govern Rivers Edge almost certainly address rentals, both short-term and long-term, but we could not confirm the current text from the association's own site, and MLS remarks vary listing to listing. If a rental strategy, whole or partial, is part of why you're buying here, get the specific plat's rental restrictions in writing from the HOA before you write an offer, not after. This is exactly the kind of detail a resale certificate is supposed to settle, and it's worth the wait to get it before closing.</p>

<h2>How close is downtown, the airport, and the mountain?</h2>
<p>Rivers Edge sits close enough to the center of town that downtown Bend and the Old Mill District are a short drive across the river rather than a highway commute, and Awbrey Butte rises directly behind the neighborhood on the west side. Redmond's airport is a straightforward run north out of town on the same main highway every other Bend neighborhood uses. Mt. Bachelor is reached the same way it is from anywhere else in town, through downtown and out the Cascade Lakes corridor. We're not giving you a specific mile count or drive time here because we couldn't confirm one from an official source for this specific address, and a few minutes of variance depending on exactly where in Rivers Edge you're starting from is the honest answer anyway.</p>

<h2>When were the homes here built?</h2>
<p>We can tell you the golf course's own timeline with confidence: River's Edge Investments formalized the project in 1987 as the original nine holes, and the back nine was added in 1992 to make it a full 18. Residential development in the neighborhood grew alongside those two phases and continued after, which is consistent with a community built out over roughly a decade rather than in one release. What we don't have is a verified year-built range for the homes themselves pulled from our own records, the way we can give you for some other Bend neighborhoods, so we're not printing one. A broker can pull the specific build year for any address you're looking at from the county assessor before you ever tour it.</p>

<h2>What should you ask before you write an offer here?</h2>
<p>A short list, specific to this neighborhood rather than generic advice: which plat, Rivers Edge Village or Phase 5, the home actually sits on, and that plat's current CC&amp;Rs. Whether the lot fronts the golf course directly, and if so, how the seller has handled stray balls, fencing and landscaping facing the fairway. The Master Association's current financials and the golf course's own capital plan, since that course is the community's asset and its upkeep is now the neighborhood's business. The specific plat's rental policy in writing if an income strategy matters to your purchase. And whether any river frontage on the lot is above the public trail corridor or shares it. A <a href="/team">Ryan Realty broker</a> can pull the current HOA documents, the plat map and the comparable listings for the exact address you're considering.</p>

<h2>Why don't we publish numbers for Rivers Edge yet?</h2>
<p>Every other neighborhood guide we publish carries a median price, a homes-for-sale count, or an HOA dues figure pulled fresh from our own records and checked against the source before it goes out. Rivers Edge doesn't have a mapped boundary in our system yet, which means we can't reliably tie a listing to this specific neighborhood the way we can elsewhere, and we won't estimate, round, or borrow a number from a similar-sounding Bend community to fill the gap. Rather than publish a figure we can't verify, we're leaving this guide without one until that mapping work is done. That doesn't mean current listings don't exist. A Ryan Realty broker can pull active Rivers Edge listings, recent closed sales and a real comparison by hand today, address by address, on the <a href="/communities/rivers-edge">Rivers Edge community page</a>.</p>

<h2>Questions</h2>
<h3>Is River's Edge Golf Course open to the public?</h3>
<p>Yes. It has operated as a public course since it opened, and since the surrounding homeowners bought it in March 2022, it's been chartered specifically to stay a public, affordable 18-hole course rather than convert to a private club or additional housing.</p>
<h3>Do Rivers Edge homeowners get free or discounted golf?</h3>
<p>We could not confirm a resident rate from a source we trust for this guide. Ask the course directly what, if anything, changes for homeowners in the neighborhood that now owns it.</p>
<h3>Is Rivers Edge one HOA or several?</h3>
<p>Several. The neighborhood grew out of multiple recorded plats, including Rivers Edge Village and Phase 5 Rivers Edge, and four separate homeowner associations combined into a Master Association specifically to buy and operate the golf course. Ask which specific association and plat govern the home you're considering.</p>
<h3>Can I access the river from Rivers Edge?</h3>
<p>The Deschutes River Trail's River Run Reach runs along and through the golf course, and First Street Rapids Park a short distance away has a boat landing for canoes and kayaks. Both are public Bend Park and Recreation District infrastructure, not a private neighborhood amenity, so confirm whether a specific lot's river frontage sits on that public corridor before assuming it's exclusive.</p>
<h3>Why doesn't this guide list a median price or HOA dues for Rivers Edge?</h3>
<p>Our records don't have a mapped boundary for this neighborhood yet, so we can't confidently tie listings to it the way we do for other Bend communities, and we won't publish an estimate. A broker can still pull current listings and comps by hand for a specific address.</p>
<h3>Are the homes in Rivers Edge mostly full-time residences or vacation homes?</h3>
<p>We don't have occupancy data to answer that with a figure. The housing stock itself, mostly single-story homes on quarter- to half-acre lots, reads as suited to full-time living, and the neighborhood appears to draw both full-time owners and second-home buyers rather than sorting cleanly into one group.</p>

<h2>Next step</h2>
<p>Rivers Edge rewards a buyer who asks specific questions before writing an offer, not a generic golf-course-community pitch. Visit the <a href="/communities/rivers-edge">Rivers Edge community page</a> for what we can show you today, and talk to a <a href="/team">Ryan Realty broker</a> who can pull the current listings, the right plat's HOA documents, and a real comparison for the address you have in mind.</p>
`,
  },
  // ─── crooked-river-ranch ───
  {
    title: "Crooked River Ranch: Are You Ready for Acreage, a Well, and Septic?",
    slug: "crooked-river-ranch-rural-acreage-wells-septic",
    category: 'Community Spotlights',
    tags: ["crooked river ranch","terrebonne","rural living","well and septic","central oregon"],
    hero_image_url: "/images/blog/brasada-ranch-central-oregon.jpg",
    published_at: '2026-09-09T05:38:54Z',
    status: 'draft',
    seo_title: "Crooked River Ranch: Ready for a Well and Septic?",
    seo_description: "Crooked River Ranch, OR: rural acreage, wells and septic, a public golf course, and the HOA that runs the roads. Sourced facts, not a resort pitch.",
    excerpt: "Crooked River Ranch is roughly 12,000 rural acres near Terrebonne, not a resort: wells, septic, a public golf course, and an HOA that runs the roads.",
    content: `
<p>Crooked River Ranch is not a resort. It's a large rural planned community on the canyon rim above the Crooked and Deschutes rivers near Terrebonne, split across northern Deschutes and southern Jefferson counties. There's a golf course and a ranch-wide homeowners association, but the acreage lots, the wells and septic systems, and the high desert setting make this a different kind of buy than a gated golf community closer to Bend. Every fact below traces to the Crooked River Ranch Club and Maintenance Association, the Crooked River Ranch Fire &amp; Rescue district, the Crooked River Ranch Water Company, Jefferson County's own permitting pages, or our own MLS database. If you want to see the <a href="/communities/crooked-river-ranch">Crooked River Ranch community page</a> and what's listed there right now, start there and use this guide alongside it.</p>

<h2>What do the dues at Crooked River Ranch actually pay for?</h2>
<p>Every property at Crooked River Ranch belongs to the Crooked River Ranch Club and Maintenance Association, and every owner pays into it. Across the 13 current listings in our MLS database that report an association fee, the median works out to $48 a month, $576 a year. That figure moves around by lot, so confirm the actual assessment on any specific property before you write an offer.</p>
<p>What the assessment funds, alongside the Ranch's Special Road District, is real physical infrastructure: a swimming pool, tennis and pickleball courts, a baseball field, a basketball court, a horse arena, a disc golf course, and two community parks, MacPherson Park and Panorama Park, each with a pavilion. It also funds a Road Department that maintains the Ranch's own network of roads, separate from the county roads that also cross the property. This isn't a gated community with a concierge desk. It's an association that runs the physical infrastructure of an unincorporated community that never became a city.</p>

<h2>What does the Club and Maintenance Association actually run?</h2>
<p>The Association is organized as a nonprofit corporation, governed by an elected Board of Directors, and it functions like local government for everything the counties don't handle directly. Standing committees cover architectural review, meaning new construction and remodels get checked against the Ranch's CC&amp;Rs before you break ground, plus CC&amp;R enforcement and the roads. The administration office sits at 5195 SW Clubhouse Road in Terrebonne, next to the golf clubhouse, and that's the first stop for CC&amp;R questions, architectural review applications, and assessment questions. Read the <a href="https://www.crookedriverranch.com/association" target="_blank" rel="noopener nofollow">Association's own page</a> before you assume anything about what a lot allows.</p>

<h2>What is the golf course like?</h2>
<p>The golf course anchors the Ranch physically and socially. It's an 18-hole, par-71 public course carved into high desert terrain, with the Crooked River Canyon cutting straight through the layout. The signature hole is No. 5, a tee shot across the canyon that the club's own site calls one of the most spectacular holes in golf. The clubhouse runs a pro shop, a restaurant, and men's and women's clubs, and the property also carries an RV park and cabins for stay-and-play visitors. If golf is part of why you're looking here, play a round before you make an offer. The <a href="https://www.crookedriverranchgc.com/" target="_blank" rel="noopener nofollow">course is public</a>, so you don't need to own a home on the Ranch to try it first.</p>

<h2>How do water, septic, and other utilities work out here?</h2>
<p>Crooked River Ranch runs its own water utility, the Crooked River Ranch Water Company, a system regulated by the Oregon Public Utility Commission and the Oregon Health Authority's drinking water program. It serves more than 1,500 homes and commercial properties from a mix of production wells, including one drilled 1,100 feet deep, a cistern, and a one-million-gallon elevated storage tank, all tied together through a SCADA control system installed to fix long-standing low-pressure problems. Not every lot connects to that system. Some outlying parcels rely on a private well instead, which is normal for a rural subdivision this size.</p>
<p>There is no ranch-wide sewer. Every home runs its own on-site septic system, permitted and inspected under Jefferson County's On-Site Septic Program, with the small portion of the Ranch that sits in Deschutes County following that county's own equivalent process. Electricity comes from Pacific Power. If you're used to municipal water and sewer, budget time to understand well and septic maintenance, and ask any seller for septic inspection and pump records before you close. You can read more about the <a href="https://www.crrwater.com/about-1" target="_blank" rel="noopener nofollow">water company's own regulatory setup</a> directly.</p>

<h2>What does fire protection look like in high desert country?</h2>
<p>Crooked River Ranch Fire &amp; Rescue is its own special district, formed in 1977 after residents petitioned for it. Before that, the Ranch had no local fire or EMS coverage at all. Today it runs as a combination department, with a Fire Chief and shift Captain and Firefighter Paramedics on the career side, plus volunteer Lieutenants and firefighters, many of them also certified paramedics or EMTs. That structure matters here because this is high desert terrain, with sagebrush and juniper right up against a lot of backyards, and wildfire is a real planning factor rather than an abstract one. Ask about defensible space and the roofing and vent materials on any home you're considering, the same way you would anywhere in Central Oregon's wildland urban interface. You can read the <a href="https://www.crrfire-or.gov/about-us" target="_blank" rel="noopener nofollow">district's own history and staffing</a> on its site.</p>

<h2>What happens to the roads when winter hits?</h2>
<p>The Ranch's road network, close to 90 miles of it, splits into roughly a dozen miles of county road and the rest Association and Special Road District roads. Because the Ranch sits at close to 2,800 feet, winter brings real snow and ice, and because so much of the system is locally maintained rather than run by a county, plowing priority and timing depend on the Road Department and Special Road District's own schedule, not on Deschutes or Jefferson County's plow routes. Residents have organized their own supplemental help in hard winters too. In 2025, a local volunteer group that also does other work on the Ranch cited snow removal for medical patients as one of the things it pitches in on. If a reliable route out in a storm matters to you, ask which road actually serves your specific lot and who plows it.</p>

<h2>Is Crooked River Ranch a full-time neighborhood or a second-home community?</h2>
<p>The 2020 Census counted 4,912 residents at Crooked River Ranch, spread across more than 2,600 privately owned lots on roughly 12,000 acres, most parcels running from about one to more than five acres. That gap between lot count and year-round population says something on its own. Not every parcel holds a full-time household. The same census recorded a median resident age of 57.6, with more than a third of residents 65 or older, a pattern that fits a mix of retirees and second-home owners more than a young-family suburb. It doesn't mean it's exclusively either. Plenty of households live here year-round and commute into Redmond or Bend, and plenty of lots sit as recreational or future-build property. Figure out which kind of buyer you are before you shop, because it changes what you should ask about winter access, water service, and how active a specific lot has actually been.</p>

<h2>Can you rent out a home on the Ranch?</h2>
<p>If you're picturing Crooked River Ranch as a short-term rental play, slow down and read the CC&amp;Rs on the specific lot first. The Association's CC&amp;R Committee reviews complaints and enforcement under the Ranch's covenants and meets monthly at the Clubhouse Road office. We did not find a published, ranch-wide short-term rental ban or a published blanket allowance, so the honest answer is that it depends on your specific lot's covenants and on whatever the Board has adopted most recently. That's a question for the Association office directly, not a guess from us or from any other site. What the Ranch does run itself is short-term lodging at the golf course, cabins and stay-and-play packages booked through the pro shop, alongside an RV park. That's ranch-run visitor lodging, not a private homeowner renting out a house, and it doesn't answer what your own CC&amp;Rs allow.</p>

<h2>How far is it to Redmond, Bend, and the airport?</h2>
<p>Crooked River Ranch sits roughly 12 to 14 miles by car from Redmond, about a 20-to-25-minute drive up Highway 97, and roughly 30 miles from downtown Bend, somewhere around 40 to 50 minutes non-stop depending on the route and traffic. Redmond Municipal Airport, the airport that handles commercial flights for Central Oregon, sits in that same close range from the Ranch as Redmond itself. Terrebonne, where the Ranch's mail is addressed and where the closest grocery store and post office sit, is a much shorter hop for most of the Ranch. None of that is a quick daily commute if your job sits in downtown Bend, but it's a realistic distance if you work in Redmond, or if your household only needs to make the Bend drive occasionally.</p>

<h2>When were most of the homes built?</h2>
<p>Homes at Crooked River Ranch mostly went up over a long build-out window rather than one development push. In the current membership read of the Ranch's detached housing stock, 341 homes fall between build years 1978 and 2006, a span of nearly three decades. That means the housing stock ranges from late-1970s construction to homes built in the mid-2000s, roughly 20 to 48 years old as of today, and the systems in an older home, the well, the septic, the roof, the wiring, deserve inspection scrutiny that matches that actual age, no matter how well-kept a house looks from the driveway.</p>

<h2>What does buying a rural lot at Crooked River Ranch actually involve?</h2>
<p>Buying here is closer to buying acreage than buying a subdivision lot in town, and the process reflects that. Because the Ranch straddles two counties, your specific parcel falls under either Jefferson County or Deschutes County land use and building rules, not both, so confirm which county governs your lot before you assume anything about permits. If the lot needs a new septic system, <a href="https://www.jeffersoncountyor.gov/cd/page/site-septic-program" target="_blank" rel="noopener nofollow">Jefferson County's On-Site Septic Program</a> requires a land use approval first, then a soil evaluation using open test pits dug on the actual site, and only then a permit to construct a system that meets Oregon DEQ standards. Water is the other variable. Some lots tie into the Crooked River Ranch Water Company, others rely on a private well, and you should confirm which one applies to the specific parcel, not the neighborhood in general, before you write an offer. Every build or remodel also goes through the Association's architectural review process against the Ranch's CC&amp;Rs, on top of whatever the county requires. None of this is unusual for rural Central Oregon. It's just different from what a buyer moving from a city subdivision expects, and it's worth walking through with someone who knows the Ranch before you get attached to a specific lot.</p>

<h2>Questions</h2>
<h3>Is Crooked River Ranch a resort community?</h3>
<p>No. It has a public golf course and a homeowners association, but it isn't run or marketed as a resort. It's a large rural planned community with acreage lots, wells and septic, and a ranch-wide association that functions like local government for what the counties don't cover.</p>
<h3>How much are the HOA dues at Crooked River Ranch?</h3>
<p>Across the 13 current listings in our MLS database that report an association fee, the median is $48 a month, $576 a year. Confirm the actual dues on any specific listing before you rely on that median, since it moves by lot.</p>
<h3>Do homes at Crooked River Ranch have city water and sewer?</h3>
<p>Most connect to the Crooked River Ranch Water Company, a system regulated by the Oregon Public Utility Commission and the Oregon Health Authority. Some outlying lots run on a private well instead. There is no public sewer anywhere on the Ranch. Every home uses its own on-site septic system.</p>
<h3>How far is Crooked River Ranch from Redmond and Bend?</h3>
<p>Roughly 12 to 14 miles and 20 to 25 minutes to Redmond, and roughly 30 miles and 40 to 50 minutes to downtown Bend, depending on route and traffic. Redmond Municipal Airport sits in that same close range from the Ranch.</p>
<h3>When were most of the homes built?</h3>
<p>In the current membership read of the detached housing stock, 341 homes fall between 1978 and 2006 build years, so the Ranch grew steadily over nearly three decades rather than all at once.</p>
<h3>Is Crooked River Ranch full-time or mostly second homes?</h3>
<p>Both. The 2020 Census counted 4,912 residents against more than 2,600 privately owned lots, with a median resident age of 57.6, which points to a mix of full-time residents, retirees, and second-home owners rather than one dominant pattern.</p>
<h3>Where do the numbers in this guide come from?</h3>
<p>The HOA figure and the build-year range come from our own MLS database, read September 9, 2026: the association-fee field across the 13 current listings that report one, and build years across the 341 homes in the current membership read. Homes for sale, closed sales, and sale prices are withheld here because there isn't a publishable number at any grain right now, and we don't estimate or round-fill a figure we can't verify. Every other fact in this guide, the golf course, the fire district, the water company, the county permitting process, traces to that organization's own page, several of them linked above.</p>

<h2>Next step</h2>
<p>Ready to see what's actually out there? <a href="/communities/crooked-river-ranch">Browse the Crooked River Ranch community page</a> for current listings, or <a href="/team">talk to our team</a> about a specific lot, its well and septic setup, and which county governs your parcel before you write an offer.</p>
`,
  },
]

export default posts
