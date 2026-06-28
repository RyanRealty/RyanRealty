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
}

/** Deep sourced About paragraphs for a community slug, or null if none. */
export function getCommunitySeoAbout(slug: string): string[] | null {
  return CONTENT[slug]?.paragraphs ?? null
}
