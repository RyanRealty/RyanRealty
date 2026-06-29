/**
 * Deep, sourced "About" prose for the highest-SEO-opportunity resort-community
 * pages. Overrides the thin default community.description on the community detail
 * page so these pages carry substantive, locally-accurate content and climb from
 * page 2 to page 1 for "[community] homes for sale". Approved by Matt 2026-06-28.
 *
 * §0 Data Accuracy: every claim was researched and traced to an official or
 * authoritative source (see `sources`). Facts that could not be verified (HOA
 * dues, conflicting figures, awards) were deliberately OMITTED, not invented.
 * Do not add a claim without a source; re-verify when editing.
 *
 * Brand voice: no em-dashes, semicolons, exclamation marks, or banned words
 * (checked clean on commit).
 */

type CommunitySeoContent = { heading: string; paragraphs: string[]; sources: string[] }

const CONTENT: Record<string, CommunitySeoContent> = {
  'broken-top': {
    heading: 'About Broken Top',
    paragraphs: [
      'Broken Top is a private, gated community on the west side of Bend, Oregon, established in 1992. It sits in southwest Bend off Century Drive, the road that climbs west out of town toward Mt. Bachelor and the Cascade Range. The community takes its name from Broken Top, the eroded volcanic peak in the Cascades west of the city.',
      'The community was built around a golf course. During 1990 and 1991, the ownership group behind the development looked at several of the best-known course architects in the country, including Jack Nicklaus, before awarding the design to the team of Tom Weiskopf and Jay Morrish. Construction ran through 1992 and finished on October 31 of that year. The course held its grand opening on July 4, 1993.',
      'Broken Top Club plays to a par of 72 and measures 7,161 yards from the back tees, with a course rating of 73.5 and a slope of 131. The 18 holes run through pines with views of the Cascade peaks, and the course is managed by Troon. Bentgrass greens and winter rye fairways carry the layout through the high-desert seasons.',
      'The club is the center of life here. A 27,000-square-foot clubhouse overlooks a 6-acre lake at the heart of the property. Members have access to a fitness center, a yoga studio, and locker rooms with spas and steam rooms. There is an outdoor saltwater pool, 2 tennis courts, and 8 pickleball courts. A golf performance center was completed in 2020. Private walking and biking paths run through the community.',
      'The homes range from custom single-family residences to townhomes, many set along the fairways with golf course and mountain views. The community is organized into sections under the Broken Top Community Association, and HOA structure varies by section. A staffed gated entrance controls access.',
      'What sets Broken Top apart is the combination: a Weiskopf and Morrish course, a full slate of club amenities, and a gated west-side address minutes from the start of the Cascade Lakes Highway. If you are weighing Broken Top, reach out and we will walk you through what is available and how the sections and HOA dues differ.',
    ],
    sources: [
      'https://www.brokentop.com/about-us/history-1',
      'https://troon.com/course/broken-top-club',
      'https://btca.nabrnetwork.com/',
    ],
  },
  tetherow: {
    heading: 'About Tetherow',
    paragraphs: [
      'Tetherow sits on the west side of Bend, on roughly 700 acres bordering the Deschutes National Forest. The community grew up around a golf course that opened in the summer of 2008, and today it combines homes, a hotel, restaurants, and a recreation campus on one piece of high-desert land minutes from downtown.',
      'Tetherow Golf Club is a par-72, 18-hole course designed by David McLay Kidd, the architect behind Bandon Dunes on the Oregon coast. Kidd moved to Bend to build it and still lives in the area. The course is a links-style layout with fescue fairways, and the routing opens up views of the Cascade peaks, including the Three Sisters and Broken Top. Golf Digest ranked it No. 57 on its Top 100 Courses list, and it runs on a semi-private model, so tee times for non-members who are not staying at the resort are limited.',
      'The 50-room hotel sits at the center of the resort, with in-room fireplaces, balconies, and mountain views. Three restaurants operate on site. The recreation facility carries a heated outdoor pool that stays open year round, plus a fitness center, sauna, and hot tubs. Walking and biking trails run through the property, and lodging guests get a complimentary shuttle to downtown Bend and the Old Mill District.',
      "Tetherow holds several residential neighborhoods alongside the resort, from the Glen and Crescent to the Heath. Homes here are governed by the Tetherow Owners Association, a planned community under Oregon's Planned Community Act, established in 2009. Dues vary by neighborhood, and ownership comes with access to the pool, fitness center, trails, and dining. Club memberships for golf and social use are structured separately from the residential association.",
      'Two things genuinely distinguish Tetherow. The first is the course pedigree, a David McLay Kidd design from the same hand as Bandon Dunes, set against the Cascades rather than the coast. The second is the location. You are 10 minutes from downtown Bend and a short drive up Century Drive toward Mt. Bachelor. Few communities put a Top 100 course, a full resort, and that kind of access to both town and mountain on the same ground.',
    ],
    sources: [
      'https://tetherow.com/luxury-golf-resort/golf-course/',
      'https://tetherow.com/blog/tetherow-jumps-to-no-57-on-top-100-courses-list-by-golfdigest/',
      'https://www.tetherowowners.com/',
    ],
  },
  'black-butte-ranch': {
    heading: 'About Black Butte Ranch',
    paragraphs: [
      'Black Butte Ranch sits about 8 miles northwest of Sisters, Oregon, at the base of Black Butte, surrounded by the Deschutes National Forest. Seven Cascade peaks rise on the horizon, and the 6,436-foot summit of Black Butte stands over the community to the northeast. The setting is high-country Central Oregon: stands of ponderosa pine, groves of aspen, open meadows, and a private lake spread across roughly 1,800 acres.',
      'The land was a working cattle and horse ranch starting in the 1880s. The first house in the area, a small log cabin, was built by Till Glaze in 1881. In the mid-1930s, San Francisco businessman Stewart S. Lowery bought the property and gave it the name Black Butte Ranch. Brooks Resources acquired full title in January 1970 and developed the residential resort you see today, setting up the homeowner association at the same time. The first residents arrived in 1971. By 1987 the homeowner association had taken ownership of the golf courses, lodge, and shops.',
      'The Ranch has two championship courses. Big Meadow, a Robert Muir Graves design updated in 2007, runs over 7,000 yards from the championship tees. Glaze Meadow reopened in 2012 after a renovation by architect John Fought and plays 7,007 yards from the back tees. The Little Meadow Putting Course, also a John Fought design, opened in 2020 as a third option.',
      'Black Butte Ranch carries 27 miles of paved paths for biking and walking the property. There are five swimming pools, including a year-round indoor lap pool at the Glaze Meadow Recreation Center plus seasonal outdoor pools. The Ranch has 14 tennis courts and 12 pickleball courts. Professional wranglers run guided horseback rides, and the Deschutes and McKenzie rivers put fly fishing within reach.',
      'Brooks Resources built the Ranch as a community of residential and summer homes with limited commercial activity, and that character holds. Homes here trade on what surrounds them: forest, meadow, mountain views, and direct access to the golf, trails, and water at the foot of the Cascades. If you want to see what is on the market at Black Butte Ranch, reach out and we will walk you through current listings.',
    ],
    sources: [
      'https://www.blackbutteranch.com/the-ranch/history/',
      'https://www.blackbutteranch.com/golf/golf-courses/',
      'https://en.wikipedia.org/wiki/Black_Butte_Ranch,_Oregon',
    ],
  },
  'brasada-ranch': {
    heading: 'About Brasada Ranch',
    paragraphs: [
      'Brasada Ranch sits in the high desert of Powell Butte, on the open ground between Bend, Redmond, and Prineville. The resort community covers 1,800 acres on the flank of Powell Butte, and 900 of those acres are kept as protected open space. From across the property you look west to the peaks of the Cascade Range, with the scrub and rim-rock of the Oregon high desert in the foreground.',
      'The land was once the Shumway family cattle holdings. The window and door manufacturer Jeld-Wen developed it into a residential resort starting in 2005, built to environmental standards. Brasada became the first newly built destination resort in the United States to earn LEED Gold certification. In November 2010, Jeld-Wen sold the resort to Northview Hotel Group, which runs the lodging and amenities alongside the homes.',
      'Brasada Canyons opened in 2007. It was designed by Oregon PGA player Peter Jacobsen and Jim Hardy. The 18-hole, par-72 course runs 7,295 yards from the back tees and climbs through the canyons from 3,272 feet to just over 4,000 feet, so the elevation changes carry you from hole to hole with no two fairways running parallel. It plays as a private course, open to members and guests of the ranch.',
      'The Athletic Center holds strength and cardio equipment, weights, and Peloton bikes, with classes that include pilates and yoga. There are two pools, the Sundance Pool with a seasonal waterslide and lazy river and the Cascade adult pool, plus outdoor hot tubs open year-round. Spa Brasada offers body and beauty treatments. The equestrian program, Brasada Trails, keeps American Quarter horses and runs riding on 900 acres of trails. Residents also reach hiking and biking trails, fishing ponds, tennis and pickleball courts, and a dog park. Two restaurants serve the property, both open to the public.',
      'Brasada is built around the golf course and the open desert, with custom homes and cabins set across the 1,800 acres. The protected acreage and the spacing of the homesites keep the Cascade and high-desert views open from much of the community, which is part of what sets it apart from a standard subdivision. If you are looking at Brasada Ranch homes for sale, reach out and we will walk you through what is on the market.',
    ],
    sources: [
      'https://www.brasada.com/activities-and-amenities',
      'https://traveloregon.com/things-to-do/outdoor-recreation/golf/brasada-canyons-golf-course/',
      'https://visitcentraloregon.com/poi/brasada-ranch/',
    ],
  },
  "eagle-crest": {
    heading: "About Eagle Crest",
    paragraphs: [
      "Eagle Crest is a master-planned golf resort community on the high desert west of Redmond, Oregon, in Deschutes County. The resort spans 1,700 acres along the rim of the Deschutes River canyon, about 6 miles west of Redmond. Home development began in 1985 and grew in three phases, first on the resort side near the Deschutes River, then across Cline Falls Road into the Ridge area.",
      "Golf anchors the community. Eagle Crest operates three courses open year round. The Resort Course is the original layout, an 18-hole par-72 course designed by Gene Mason that plays 6,673 yards from the back tees and runs along the river canyon through the first phase of homes. The Ridge Course, completed in 1993 and designed by John Thronson, is an 18-hole par-72 that plays 6,927 yards through native juniper. A third course, the par-63 Challenge Course, rounds out the lineup for shorter rounds.",
      "Beyond golf, the resort carries amenities most Central Oregon neighborhoods do not. Eagle Crest has five pools, three sports centers, and an 18-hole putting course, plus a spa and trails with access to the Deschutes River. The 100-room Inn at Eagle Crest serves visitors and gives the community a hotel and conference base at its center.",
      "The housing here covers a wide range. The resort side holds the original home sites and condominium and townhome groupings overlooking the river canyon and the Resort Course fairways. The Ridge side carries a larger set of subdivisions built out over more than a decade, mixing single-family homes, cottages, and attached units. That spread means buyers can find anything from a lock-and-leave second home to a full-time residence on a fairway lot.",
      "What draws people to Eagle Crest is the combination of resort access and year-round living in one gated setting. Owners get the courses, the pools, the sports centers, and the river trails on site, with Redmond a short drive east for an airport and daily needs and Bend reachable within the wider Central Oregon corridor. The result is a community that works as both a vacation base and a primary home.",
      "If you are weighing a home, a cottage, or a condominium at Eagle Crest, we can walk you through what is currently on the market and how the resort side and the Ridge side differ on price, setting, and homeowner costs. Reach out to our team when you are ready to look at current listings.",
    ],
    sources: [
      "https://www.eagle-crest.com/",
      "https://www.eagle-crest.com/golf-course/",
      "https://www.eagle-crest.com/central-oregon-resort/",
      "https://en.wikipedia.org/wiki/Eagle_Crest_Resort",
      "https://oregoncourses.com/eagle-crest-ridge-course/",
    ],
  },
  pronghorn: {
    heading: "About Pronghorn",
    paragraphs: [
      "Pronghorn is a golf and residential community northeast of Bend, Oregon, set off Powell Butte Highway between Bend and Redmond. It opened in 2002 and built its name around two championship golf courses and a community of homes spread across the high-desert landscape. If you are searching real estate listings, you will still see this community labeled Pronghorn in the MLS, which is the name most buyers know it by.",
      "In 2022 the resort rebranded as Juniper Preserve under owner The Resort Group, a Hawaii-based company, with day-to-day operations managed by Troon. The new name points to the centuries-old juniper forest on the property and a shift in focus toward wellness alongside golf. The change matters for buyers in one practical way. The resort markets itself as Juniper Preserve today, but the residential community and its listings are still cataloged under the Pronghorn name, so you may see both used to describe the same place.",
      "Golf anchors the community. The Jack Nicklaus Signature course opened in 2004 and plays to a par of 72 at more than 7,300 yards from the back tees, with a slope rating of 148. The Tom Fazio championship course also plays to a par of 72 and measures 7,456 yards from the back tees. The Nicklaus course is open to resort and public play, while the Fazio course is reserved for members and their guests.",
      "Beyond golf, the property sits amid roughly 20,000 acres of federally protected land, which keeps the surrounding high desert open and undeveloped. Juniper Lodge, a 104-room lodge, opened in 2019 and sits alongside a spa, fitness facilities, pools, and dining within the community. Homes here range from single-family residences to townhomes set among the juniper and the two courses.",
      "For buyers, Pronghorn offers a quieter setting than the city itself while staying within reach of both Bend and Redmond and the Redmond airport. The drive to downtown Bend is short, and the location off Powell Butte Highway puts the Cascades, the Deschutes River corridor, and Central Oregon's trail networks within easy range.",
      "If you are considering Pronghorn, also searched as Juniper Preserve, we can walk you through what is currently for sale, how the two course memberships work, and what ownership in the community involves. Reach out to our team and we will share the latest listings and answer your questions.",
    ],
    sources: [
      "https://www.theresortgroup.com/press/pronghorn-resort-rebrands-as-juniper-preserve",
      "https://ktvz.com/news/business/2022/11/11/after-20-years-pronghorn-club-and-resort-rebrands-as-juniper-preserve-a-destination-wellness-resort/",
      "https://bendbulletin.com/2022/11/13/pronghorn-resort-changes-name-and-focus-in-rebrand-as-juniper-preserve/",
      "https://oregoncourses.com/pronghorn-golf-club-nicklaus-course/",
      "https://www.where2golf.com/usa-oregon/pronghorn-golf-club-fazio-course/",
      "https://troon.com/course/pronghorn-at-juniper-preserve",
    ],
  },
  "caldera-springs": {
    heading: "About Caldera Springs",
    paragraphs: [
      "Caldera Springs is a residential resort community in Sunriver, Oregon, about 15 miles south of Bend. It sits adjacent to Sunriver Resort and the Crosswater community, within reach of the Deschutes National Forest and the Newberry National Volcanic Monument. The community started in 2006 and is set among ponderosa pine forest, lakes, and streams in Central Oregon.",
      "The original master plan laid out a 400-acre community with 320 single-family homes and 45 cabins, along with a lake house, a pool and fitness facility, a nine-hole short course, and 12 miles of biking and walking trails. Caldera Springs also includes a 220-acre wildlife forest preserve that is permanently protected from development.",
      "Since 2021, Caldera Springs has been the subject of a 600-acre expansion tied to a master plan reimagination of Sunriver Resort and Caldera Springs valued at more than $100 million. The expansion has added new homesites, vacation homes, parks, trails, lakes, and amenities to the east of the original community.",
      "The centerpiece of the expansion is Forest House, a family recreation center with multiple outdoor pools, a lazy river, a dual-racer waterslide described as one of Oregon's longest, and a fitness center, plus Piney's, an indoor and outdoor cafe and bar. Next to it, Forest Park adds six pickleball courts, a dog park, a play area, and a winter sledding hill. The reimagined Lake House serves waterfront dining with views of Obsidian Lake. Forest House offers access to Caldera Springs homeowners and to guests staying in a Sunriver Resort vacation home at Caldera Springs.",
      "Homes here range from cabins to larger single-family residences, including Forestbrook, a newer collection of three- and four-bedroom homes. Many owners place their homes in a full-service vacation rental program run with Sunriver Resort Vacation Properties, which handles maintenance and guest care. Sunriver Resort and Caldera Springs are managed by CoralTree Hospitality.",
      "If you are weighing a purchase at Caldera Springs, our team can walk you through what is currently for sale and how ownership and the rental program work. Reach out and we will share the homes and homesites available now.",
    ],
    sources: [
      "https://calderasprings.com/",
      "https://www.sunriverresort.com/caldera-springs",
      "https://www.pactrust.com/about/partnerships/caldera-springs/",
      "https://ktvz.com/news/business/2024/09/10/caldera-springs-in-sunriver-expands-amenities-adds-new-elements-for-visitors-residents-to-enjoy/",
      "https://www.bendsource.com/business/sunriver-resort-expands-its-amenity-offerings-with-the-debut-of-forest-house-forest-park-and-reimagined-lake-house-at-caldera-springs-21612444/",
    ],
  },
  "awbrey-glen": {
    heading: "About Awbrey Glen",
    paragraphs: [
      "Awbrey Glen is a private golf community on Awbrey Butte, on the northwest side of Bend, Oregon. Brooks Resources Corporation broke ground on the development in 1992, building a residential neighborhood around a championship golf course on the butte's pine-covered slopes. The residential portions of the community are gated, with private homesites set among ponderosa pine and rock outcroppings.",
      "The community is built around Awbrey Glen Golf Club, a private 18-hole course. The course was designed by Oregon golf course designer Gene \"Bunny\" Mason and opened in 1993, and it has more recently been updated by David McLay Kidd. It plays to a par of 72 and measures 7,007 yards, with a slope rating of 135 from the back tees.",
      "Beyond the main course, the club's learning center holds what it describes as one of the deeper practice setups in Central Oregon. It includes a double-ended driving range, practice bunkers, and putting and pitching greens, along with The Loop, a five-hole par-three course. The club calls The Loop the only course of its kind in the area.",
      "Awbrey Glen Golf Club is member-owned. Membership covers more than the golf course, with dining that looks out toward the mountains, a pool complex that includes a lap pool, a kiddie pool, and a hot tub, a fitness center, and a calendar of social and family events. The clubhouse sits at 2500 NW Awbrey Glen Drive.",
      "Living on Awbrey Butte puts you minutes from downtown Bend and the Deschutes River, with the Cascade peaks on the western horizon. The neighborhood's position on the butte gives many homesites long views, and the surrounding terrain keeps lots private even within a gated golf community. Homes here range across single-level and multi-story floor plans, most built from the 1990s onward as the community filled in.",
      "If you are considering a move to Awbrey Glen, our team can walk you through what is currently on the market and how homes here compare. Reach out whenever you would like to talk through the current listings.",
    ],
    sources: [
      "https://www.awbreyglen.com/golf",
      "https://www.awbreyglen.com/",
      "https://brooksresources.com/community/awbrey-glen/",
      "https://www.golflink.com/golf-courses/or/bend/awbrey-glen-golf-club",
      "https://www.golfpass.com/travel-advisor/courses/11268-awbrey-glen-golf-club",
    ],
  },
  "northwest-crossing": {
    heading: "About NorthWest Crossing",
    paragraphs: [
      "NorthWest Crossing is a master-planned, mixed-use neighborhood on the west side of Bend, Oregon, built on 486 acres that West Bend Property Company bought from the Miller family in the late 1990s. West Bend Property Company is a partnership between Brooks Resources Corporation and Tennant Developments, formed when two local developers decided to build the project together rather than compete for the land.",
      "The neighborhood was laid out on neo-traditional, new-urbanist principles. Instead of separating houses from everything else, the plan mixes single-family and multifamily homes with shops, restaurants, offices, light-industrial space, parks, trails, and civic buildings. The developers wrote a Mixed-Use Overlay Zone into the city code to make that blend possible, and the street grid is built for walking, with narrow lanes, alley-loaded garages, and front porches close to the sidewalk.",
      "Homes were sold a different way too. Rather than hand the work to a single production builder, West Bend Property Company created the NorthWest Crossing Builders' Guild and sold individual lots to qualified builders through a lottery. The first lottery was held in 2001, construction started in early 2002, and the sales center opened that June. Residential development concluded in 2018, so most of the neighborhood is now established rather than under construction.",
      "Daily life centers on the parks and the commercial core. The neighborhood includes several parks, among them Discovery Park, which opened on the west side of NW Mt. Washington Drive in 2015 with grassy open space, a small lake, picnic pavilions, a dog park, and a community garden. Compass Park hosts summer gatherings and outdoor movies. The commercial blocks along NW Crossing Drive hold restaurants, coffee shops, and small businesses within walking distance of most homes.",
      "The NorthWest Crossing Saturday Farmers Market is the neighborhood's best-known event. It runs Saturdays from late May through September on NW Crossing Drive between Mt. Washington Drive and Compass Park, drawing more than 150 vendors at its summer peak. The market began in 2007 as part of the developers' shift toward events and amenities, and by 2026 it was in its 19th season. For families, the area is served by Bend-La Pine schools including High Lakes Elementary and Summit High School.",
      "If you are weighing a move to NorthWest Crossing, the housing mix runs from townhomes and cottages to larger single-family homes, and inventory moves quickly given the location and walkability. Reach out to our team and we can walk you through what is on the market right now and what to expect on price and timing.",
    ],
    sources: [
      "https://www.northwestcrossing.com/nwx-history",
      "https://brooksresources.com/community/northwest-crossing-2/",
      "https://www.nwxfarmersmarket.com/",
      "https://www.terrain.org/unsprawl/18/",
    ],
  },
  sunriver: {
    heading: "About Sunriver",
    paragraphs: [
      "Sunriver is a planned residential and resort community in Deschutes County, Oregon, about fifteen miles south of Bend. Portland developer John Gray and attorney Donald V. McCallum named the community, and the first home site was sold in 1968. The community sits on the grounds of the former Camp Abbot, a World War II Army camp that trained combat engineers. The camp opened in 1942 and was abandoned by June 1944, when most of the buildings were razed. The original Officers' Club was spared and stands today as the Great Hall.",
      "The early plan set Sunriver apart from open-ended subdivisions by fixing a finite number of home sites and keeping density low across roughly 3,300 acres. Gray and McCallum built the community around the surrounding forest, the Deschutes River, and the Cascade backdrop rather than clearing it. The initial condominiums were completed in 1968 alongside the Sunriver Lodge, and lot sales began in 1969.",
      "The Sunriver Owners Association, founded in 1968, runs the community much like a small-town government. SROA is a 501(c)(4) not-for-profit directed by a nine-member board, and it oversees about 4,200 private properties along with the common areas. Its staff maintains 66 miles of roads and 34 miles of paved pathways that connect homes to the river, the golf courses, the meadows, and the surrounding forest. The path network is one of the reasons buyers come to Sunriver, since you can reach most of the community on foot or by bike without using a car.",
      "Golf anchors the resort side of Sunriver. Sunriver Resort operates three 18-hole courses. Crosswater, designed by Robert E. Cupp and opened in 1995, plays to a par of 72 and measures 7,683 yards from the back tees. At its opening it was the longest course in the country, and it later hosted the JELD-WEN Tradition, a senior major championship, from 2007 to 2010. The Meadows course plays to a par of 71 at 7,012 yards and was redesigned by John Fought in 1999. The Woodlands course, a par 72, was designed by Robert Trent Jones Jr.",
      "Sunriver works as both a full-time home and a vacation property. The 2020 census counted 2,023 year-round residents, up from 1,393 in 2010, and many more homes serve as second homes or short-term rentals. Mount Bachelor ski area is about twenty minutes away by car, so winters here put downhill and Nordic skiing within easy reach of the front door. The mix of full-time households and seasonal owners shapes how the housing market here behaves through the year.",
      "If you are weighing a purchase in Sunriver, whether as a primary residence or a second home, our team can walk you through what is currently on the market and how the community's HOA structure, rental rules, and amenities affect each property. Reach out and we will share the homes for sale that fit what you are looking for.",
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Sunriver,_Oregon",
      "https://en.wikipedia.org/wiki/Sunriver_Resort",
      "https://www.sunriverowners.org/owners/owner-information/what-is-sroa",
      "https://www.sunriverowners.org/community/about-sunriver/history",
      "https://www.where2golf.com/usa-oregon/sunriver-resort-crosswater-course/",
      "https://en.wikipedia.org/wiki/Crosswater_Club",
    ],
  },
  crosswater: {
    heading: "About Crosswater",
    paragraphs: [
      "Crosswater is a private, gated golf community inside Sunriver, Oregon, about 15 miles south of Bend. It sits on roughly 600 acres of woodlands, meadows, and wetlands at the confluence of the Deschutes and Little Deschutes rivers, at about 4,160 feet of elevation. Sunriver Resort assembled the land, a former cattle-grazing parcel known as Big Meadow, in the early 1990s, then built the course and the surrounding home sites around the river corridor.",
      "The community is organized around the Crosswater golf course, designed by Robert E. Cupp and opened in 1995. It plays to a par of 72 and measures 7,683 yards from the back tees, with a course rating of 76.5 and a slope of 145. The fairways and greens are bent grass, set in a heathland-style layout. When it opened in 1995, it was the longest course in the United States.",
      "The course has hosted national competition. Crosswater held The Tradition, a senior major on the Champions Tour, from 2007 through 2010, and has served as a site for the PGA Professional National Championship in 2001, 2007, 2013, and 2017. In 2025 the USGA selected Sunriver Resort to host four future championships, including the U.S. Mid-Amateur in 2031 and the U.S. Junior Amateur in 2036, both scheduled to be played on Crosswater. The course also carries recognition on Golf Digest's America's 100 Greatest Public Courses list.",
      "Crosswater was certified as an Audubon Cooperative Sanctuary in 1999, a designation tied to how the course was built around the natural site. The development restored riverbanks along the property and preserved native fescue grasses, ponderosa pines, and riverine habitat rather than clearing them.",
      "Owning a home in Crosswater connects you to both the private club and the wider Sunriver Resort. Membership provides access to the Crosswater golf course and the resort's amenities, and the community's location along the rivers and within Sunriver puts trails, fishing, and the rest of Central Oregon's high-desert recreation close at hand. Home sites here tend to be large, with many backing to the golf course, the river corridor, or open meadow.",
      "Inventory in a community this size moves slowly, and well-positioned river or fairway lots draw steady interest. If you want to see what is currently available in Crosswater, or understand how a specific home is priced against recent sales, reach out and our team will walk you through the current listings.",
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Crosswater_Club",
      "https://thepnga.org/news/sunriver-resort-selected-to-host-four-usga-championships/",
      "https://www.usga.org/content/usga/home-page/articles/2025/03/SunriverAnnouncement.html",
      "https://linksmagazine.com/crosswater_golf_club/",
      "https://www.sunriverresort.com/blog/golf-digest-names-crosswater-golf-course-one-of-americas-100-greatest-public-courses",
    ],
  },
  "widgi-creek": {
    heading: "About Widgi Creek",
    paragraphs: [
      "Widgi Creek is a golf community along SW Century Drive, the road locals also know as the Cascade Lakes Highway, on the southwest edge of Bend, Oregon. The setting is forested and quiet, with homes spread among towering ponderosa pines and the Deschutes River corridor running nearby. You reach it just as you leave town heading toward the mountains, which puts daily errands in Bend and a day on the slopes within the same short drive.",
      "The community is built around The Golf Club at Widgi Creek, an 18-hole course that plays to a par of 72. It was designed by golf course architect Robert Muir Graves, ASGCA, whose routing threads narrow, tree-lined fairways through the pines and finishes at undulating greens. The trees and the greens, rather than raw length, are what make the round demanding.",
      "The course has a layered history. It first opened as Seventh Mountain Golf Village, went through a name change and a sale, and became Widgi Creek by 1993. Over the years it earned recognition from golf media, including a spot among Golf Digest's Best Places to Play, and readers of The Source have voted it Central Oregon's favorite public golf course more than 20 times.",
      "Location is a large part of what living here means. The Inn of the Seventh Mountain resort sits just down Century Drive, and the highway continues west toward Mt. Bachelor and the string of Cascade lakes. That corridor is the gateway to skiing and snowboarding in winter and to hiking, paddling, and mountain biking the rest of the year, all of it starting close to your front door.",
      "Beyond golf, the club has added a pickleball facility, so the property supports more than one sport in the same place. Homes at Widgi Creek tend to draw buyers who want a forested, recreation-first setting with course frontage or course views, while staying inside a short drive of downtown Bend and the Old Mill District.",
      "If you are weighing a move to Widgi Creek, current inventory here is limited and moves with the season. Reach out to our team and we can walk you through what is available, what has sold recently, and how a home in this part of Bend fits what you are looking for.",
    ],
    sources: [
      "https://www.widgi.com/",
      "https://www.golfpass.com/travel-advisor/courses/62-widgi-creek-golf-club",
      "https://www.golflink.com/golf-courses/or/bend/widgi-creek-golf-club",
      "https://www.golfdigest.com/courses/or/widgi-creek-golf-club-widgi-creek",
      "https://oregoncourses.com/widgi-creek-golf-course/",
    ],
  },
  "vandevert-ranch": {
    heading: "About Vandevert Ranch",
    paragraphs: [
      "Vandevert Ranch is a gated residential community south of Bend, Oregon, near Sunriver, set along both banks of the Little Deschutes River. It traces directly to one of the area's oldest working ranches, and the land is older than Deschutes County and predates the founding of the city of Bend.",
      "The ranch was homesteaded in 1892 by William Plutarch Vandevert, a cattleman who settled the property with his wife, Sadie, a schoolteacher, and raised eight children there. In its early years the homestead also served as a U.S. post office and a stagecoach stop, and the family's cattle carried the Hashknife brand. The Vandevert family held the ranch into the 1980s, which kept the homestead in one family for close to a century.",
      "Two pieces of that history still stand on the land. The original log homestead and the one-room Harper schoolhouse are both among the thirty-three sites listed as Historic Resources in Deschutes County. The schoolhouse has been restored, and the homestead anchors the community that grew up around it.",
      "The modern community began in 1988, when Jim and Carol Gardner bought the ranch, restored the homestead, and developed the land as a gated community that kept the Vandevert name. The result is a low-density layout of large parcels along the river, built around a shared log-home character that sets it apart from most Central Oregon subdivisions.",
      "Owners share open space on both banks of the Little Deschutes River, with river access for fishing and floating close at hand. The setting puts you within a short drive of Sunriver to the north and roughly sixteen miles south of Bend, so you reach town services and the recreation around the Cascades without giving up the privacy of a rural ranch parcel.",
      "Homes here come to market a few at a time, and most are custom log-built estates on acreage, so inventory is limited and each property is different. If you are weighing a move to Vandevert Ranch, reach out to our team and we will walk you through what is currently for sale and how the community fits what you are looking for.",
    ],
    sources: [
      "http://vandevertranch.org/history.html",
      "http://vandevertranch.org/",
      "https://en.wikipedia.org/wiki/William_Vandevert",
      "https://www.enjoybendlife.com/three-rivers-south/vandevert-ranch/",
      "https://www.cascadehasson.com/Vandevert-Ranch",
    ],
  },
  "three-rivers": {
    heading: "About Three Rivers",
    paragraphs: [
      "Three Rivers, also called Three Rivers South, is an unincorporated community and census-designated place in Deschutes County, Oregon. It sits in south-central Deschutes County, south of Sunriver and north of La Pine, just west of U.S. Route 97. The community is part of the Bend metropolitan area and shares the 97707 zip code with neighboring Sunriver.",
      "The area takes its name from the rivers that run through it. The Deschutes and Little Deschutes rivers join within the community, with the Little Deschutes passing through the eastern side and the Deschutes through the west. The Spring River, a short spring-fed river in the north, joins the Deschutes from the west. That river network is the reason many homes here come with water frontage and direct access to the Deschutes.",
      "Three Rivers covers about 7.5 square miles at an elevation near 4,187 feet. It is surrounded by the Deschutes National Forest, and the residential lots sit among ponderosa and lodgepole pines. The forested setting and larger lot sizes give the community a quieter feel than the planned resort layout of nearby Sunriver.",
      "The population was 3,925 at the 2020 census, up from 3,014 in 2010 and 2,445 in 2000. Housing here ranges from cabins and single-level homes to riverfront properties, and the community draws both full-time residents and second-home owners who want room between neighbors and proximity to the water.",
      "Families in Three Rivers are served by Bend-La Pine Schools, including Three Rivers School, a K-8 campus located in Sunriver. Sunriver Village sits a short drive north, putting dining, groceries, and recreation within reach while keeping homes set back in the trees.",
      "If you are looking at Three Rivers as a primary home, a riverfront property, or a forested lot south of Sunriver, our team tracks what comes on the market here. Reach out and we can walk you through the current listings and what they mean for your search.",
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Three_Rivers,_Oregon",
      "https://www.bend.k12.or.us/threerivers",
      "https://centraloregonbuzz.com/communities/three-rivers-south/",
    ],
  },
}

/** Deep sourced About paragraphs for a community slug, or null if none. */
export function getCommunitySeoAbout(slug: string): string[] | null {
  return CONTENT[slug]?.paragraphs ?? null
}
