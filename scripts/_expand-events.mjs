/**
 * _expand-events.mjs — append the comprehensive, source-verified Central Oregon
 * event slate to data/co-events.ts. Data traces to the three research passes on
 * 2026-07-03; every date is verified against the organizer's official site or
 * left null with a recurrence descriptor (CLAUDE.md §0). Blurbs are original,
 * brand-voice, factual. Idempotent: skips slugs already in the registry.
 */

import fs from 'node:fs'

const V = '2026-07-03'
// [slug,name,category,schemaType,city,geoSlug,venue,lat,lng,recurrence,next,end,price,org,url,blurb]
const E = [
  // ── Markets (weekly, ongoing — recurrence-only) ──
  ['bend-farmers-market','Bend Farmers Market','market','Event','Bend','bend','Brooks Alley, downtown Bend',44.0585,-121.3132,'Weekly, Wednesdays 11am to 3pm, May through mid-October',null,null,'Free','Bend Farmers Market','https://www.bendfarmersmarket.com/','A downtown Bend farmers market in Brooks Alley, with local growers, food makers, and prepared food every Wednesday through the growing season.'],
  ['nwx-farmers-market','NorthWest Crossing Farmers Market','market','Event','Bend','bend','NW Crossing Dr & Fort Clatsop, Bend',44.0606,-121.3462,'Weekly, Saturdays 10am to 2pm, late May through September',null,null,'Free',null,'https://www.nwxfarmersmarket.com/','A Saturday market in the NorthWest Crossing neighborhood, with farm stands, makers, live music, and a strong local following through the summer.'],
  ['redmond-farmers-market','Redmond Farmers Market','market','Event','Redmond','redmond','Centennial Park, 725 SW Evergreen Ave, Redmond',44.2726,-121.1745,'Weekly, Fridays 3pm to 7pm, May through August',null,null,'Free','Redmond Oregon Farmers Market','https://www.redmondoregonfarmersmarket.org/','A Friday afternoon market in Redmond’s Centennial Park, with local produce, food carts, and makers through the summer.'],
  ['sisters-farmers-market','Sisters Farmers Market','market','Event','Sisters','sisters','Fir Street Park, Sisters',44.2912,-121.5487,'Weekly, Sundays 10am to 2pm, June through October',null,null,'Free','Seed to Table Oregon','https://www.sistersfarmersmarket.com/','A Sunday market in Fir Street Park run by Seed to Table, with local growers and makers through the season.'],
  ['crop-farmers-market','CROP Farmers Market','market','Event','Prineville','prineville','Stryker Park, Prineville',44.2996,-120.8345,'Weekly, Saturdays 9am to 1pm, June through September',null,null,'Free','Crooked River Open Pastures','https://cropfarmersmarket.org/','Prineville’s Saturday farmers market in Stryker Park, run by Crooked River Open Pastures, with local farm goods through the summer.'],
  // ── Arts / community ──
  ['first-friday-art-walk','First Friday Art Walk','arts','VisualArtsEvent','Bend','bend','Downtown Bend galleries and shops',44.0582,-121.3153,'Monthly, the first Friday of every month, 5pm to 8pm',null,null,'Free','Downtown Bend Business Association','https://www.downtownbend.org/first-friday','A monthly evening art walk through downtown Bend, with galleries, shops, and restaurants showing local artists on the first Friday of every month.'],
  ['bend-venture-conference','Bend Venture Conference','community','Event','Bend','bend','Downtown Bend',44.0601,-121.3138,'Annually, mid-October','2026-10-15','2026-10-16','Ticketed','EDCO','https://www.bendvc.com/','The largest angel conference in the Northwest, run by EDCO, bringing founders and investors to downtown Bend for two days each October.'],
  ['sunriver-art-fair','Sunriver Art Fair','arts','VisualArtsEvent','Sunriver','sunriver','The Village at Sunriver',43.8735,-121.4419,'Annually, the second weekend of August','2026-08-07','2026-08-09','Free','Sunriver Women’s Club','https://sunriverwomensclub.org/sraf-home','A juried outdoor art fair in The Village at Sunriver, with dozens of artists across three days, run by the Sunriver Women’s Club.'],
  // ── Food & drink ──
  ['the-little-woody','The Little Woody','food-drink','FoodEvent','Bend','bend','Deschutes Historical Museum lawn, downtown Bend',44.0588,-121.3186,'Historically annual in late August. 2026 is billed as the final year.','2026-08-29','2026-08-29','Ticketed','Deschutes Historical Museum','https://thelittlewoody.com/','A barrel aged beer, cider, and whiskey festival on the Deschutes Historical Museum lawn. The 2026 edition is billed as the last one.'],
  ['central-oregon-beer-week','Central Oregon Beer Week','food-drink','FoodEvent','Bend','bend','Breweries across Central Oregon',44.0582,-121.3153,'Annually, late May, at breweries across the region',null,null,null,'Oregon Brewers Guild','https://www.oregoncraftbeer.org/cobeerweek','A week of tap takeovers, tastings, and brewer events across Central Oregon breweries each spring.'],
  // ── Community / seasonal ──
  ['bend-4th-of-july-pet-parade','Bend 4th of July Pet Parade','community','Event','Bend','bend','Harmon Park to Drake Park, downtown Bend',44.0577,-121.3204,'Annually, the morning of July 4th',null,null,'Free','Bend Park and Recreation District','https://www.bendparksandrec.org/activities/4th-of-july/','A downtown Bend tradition since 1932, when kids and families march their pets from Harmon Park to Drake Park on the morning of the Fourth.'],
  ['sunriver-4th-of-july','Sunriver 4th of July Festival & Bike Parade','seasonal','Event','Sunriver','sunriver','The Village at Sunriver',43.8735,-121.4419,'Annually, July 4th',null,null,null,'The Village at Sunriver','https://www.villageatsunriver.com/','A family Fourth of July in The Village at Sunriver, with a decorated bike parade and carnival games. Sunriver holds no fireworks because of fire risk.'],
  ['la-pine-frontier-days','La Pine Frontier Days','festival','Festival','La Pine','la-pine','Frontier Heritage Park, La Pine',43.6704,-121.5031,'Annually, over the July 4th weekend',null,null,null,'La Pine Frontier Days Association','https://lapinefrontierdays.org/','La Pine’s Fourth of July weekend tradition, with a parade, vendors, and community events downtown.'],
  ['downtown-bend-tree-lighting','Downtown Bend Christmas Tree Lighting','seasonal','Event','Bend','bend','Brandis Square, downtown Bend',44.0587,-121.3122,'Annually, the first Sunday of December','2026-12-07',null,'Free','Downtown Bend Business Association','https://www.downtownbend.org/christmas','The downtown holiday kickoff at Brandis Square, with the tree lighting, music, and shops open late on the first Sunday of December.'],
  ['sunriver-grand-illumination','Sunriver Resort Grand Illumination','seasonal','Event','Sunriver','sunriver','Sunriver Resort',43.8918,-121.4407,'Annually, mid-to-late November','2026-11-21',null,null,'Sunriver Resort','https://www.sunriverresort.com/','Sunriver Resort’s holiday kickoff, with the lighting of the resort and family activities in late November.'],
  ['winter-pridefest','Winter PrideFest','community','Event','Bend','bend','Venues across Bend and Mt. Bachelor',44.0035,-121.6884,'Annually, early March',null,null,'Ticketed','Out Central Oregon','https://www.winterpridefestcentraloregon.com/','A four day winter celebration and the largest annual fundraiser for Out Central Oregon, with events across Bend and on the slopes of Mt. Bachelor.'],
  ['bend-pride','Bend Pride','community','Event','Bend','bend','Drake Park, Bend',44.0585,-121.3196,'Annually, early June',null,null,'Free',null,'https://www.bendpride.com/','A community celebration in Drake Park each June, free and open to all.'],
  // ── Festivals with confirmed dates ──
  ['sisters-harvest-faire','Sisters Harvest Faire','festival','Festival','Sisters','sisters','Downtown Sisters',44.2909,-121.5493,'Annually, the second weekend of October','2026-10-10','2026-10-11','Free','Sisters Area Chamber of Commerce','https://www.sisterscountry.com/events/sisters-harvest-faire','A downtown Sisters street fair with more than a hundred artisan and food booths across a fall weekend.'],
  ['crook-county-fair','Crook County Fair','festival','Festival','Prineville','prineville','Crook County Fairgrounds, Prineville',44.2857,-120.8339,'Annually, the first full week of August','2026-08-05','2026-08-08','Free','Crook County Fairgrounds','https://www.crookcountyfairgrounds.com/p/fair','Prineville’s Blue Ribbon Days, four days of 4-H and livestock exhibits, carnival rides, and free admission at the county fairgrounds.'],
  ['jefferson-county-fair','Jefferson County Fair & Rodeo','festival','Festival','Madras','madras','Jefferson County Fairgrounds, Madras',44.6459,-121.1301,'Annually, the last full week of July','2026-07-22','2026-07-25',null,'Jefferson County Event Complex','https://www.jeffersoncountyor.gov/fairgrounds','Madras’s county fair and rodeo, with livestock, carnival rides, and rodeo events over four days in late July.'],
  ['airshow-of-the-cascades','Airshow of the Cascades','festival','Festival','Madras','madras','Madras Municipal Airport',44.6699,-121.1548,'Annually, late August','2026-08-28','2026-08-29','Ticketed','Airshow of the Cascades','https://cascadeairshow.com/','A two day airshow at the Madras airport, with vintage aircraft, aerobatics, and a Friday night show, now in its third decade.'],
  ['crooked-river-roundup','Crooked River Roundup','community','SportsEvent','Prineville','prineville','Crook County Fairgrounds, Prineville',44.2857,-120.8339,'Annually. Rodeo in late June, horse races in mid-July.','2026-07-15','2026-07-18',null,'Crooked River Roundup Association','https://crookedriverroundup.com/','Prineville’s long running rodeo and pari-mutuel horse races at the county fairgrounds, a summer tradition since the 1940s.'],
  // ── Races / sports ──
  ['dirty-half','Dirty Half','race','SportsEvent','Bend','bend','Skyline Ranch Road, Bend',44.0206,-121.3908,'Annually, early June',null,null,'Ticketed','FootZone Bend','https://www.footzonebend.com/dirty-half','A trail half marathon on the trails west of Bend, one of FootZone’s signature local races.'],
  ['happy-girls-run','Happy Girls Run','race','SportsEvent','Sisters','sisters','FivePine Campus, Sisters',44.2846,-121.5364,'Annually, late October','2026-10-24',null,'Ticketed','Happy Girls Run','https://happygirlsrun.com/','A women’s half marathon, 10K, and 5K on the trails and roads around Sisters each fall.'],
  ['i-like-pie','I Like Pie','race','SportsEvent','Bend','bend','Riverbend Park, Bend',44.0446,-121.3186,'Annually, Thanksgiving morning','2026-11-26',null,'Ticketed','Cascade Relays Foundation','https://cascaderelays.com/events/i-like-pie/','A Thanksgiving morning fun run from Riverbend Park, with pie at the finish, benefiting the Cascade Relays Foundation.'],
  ['cascade-gravel-grinder','Cascade Gravel Grinder','sports','SportsEvent','Sisters','sisters','Sisters, Oregon',44.2909,-121.5493,'Annually, late May',null,null,'Ticketed','Oregon Gravel Grinder Series','https://www.oregongravelgrinder.com/cascade','A gravel cycling event on the forest roads around Sisters, part of the Oregon Gravel Grinder series.'],
  ['bend-marathon','Bend Marathon and Half','race','SportsEvent','Bend','bend','Downtown Bend',44.0582,-121.3153,'Annually, mid-April',null,null,'Ticketed','Bend Marathon','https://www.bend-marathon.com/','A spring marathon, half, and relay that runs through Bend’s neighborhoods and along the Deschutes.'],
  // ── Music festivals & series ──
  ['music-on-the-green','Music on the Green','music','MusicEvent','Redmond','redmond','American Legion Park, Redmond',44.2726,-121.1745,'Alternating Wednesdays, late June through early September','2026-07-08','2026-09-02','Free','Visit Redmond Oregon','https://www.visitredmondoregon.com/music-on-the-green/','A free outdoor concert series on alternating Wednesday evenings in Redmond, a summer tradition run by Visit Redmond.'],
  ['bend-roots-revival','Bend Roots Revival','music','MusicEvent','Bend','bend','Midtown Bend corridor',44.0596,-121.3126,'Annually, mid-September','2026-09-11','2026-09-13','Free','Bend Roots Revival','https://bendroots.net/','A free, family friendly celebration of the region’s music, with more than a hundred local and regional acts across Midtown Bend stages.'],
  ['sisters-folk-festival','Sisters Folk Festival','music','MusicEvent','Sisters','sisters','Stages across downtown Sisters',44.2909,-121.5493,'Annually, late September','2026-09-25','2026-09-27','Ticketed','Sisters Folk Festival','https://www.sistersfolkfest.org/','An Americana and roots festival across seven stages in downtown Sisters, with more than thirty artists over a weekend each fall.'],
  ['big-ponderoo','Big Ponderoo','music','MusicEvent','Sisters','sisters','Village Green City Park, Sisters',44.2905,-121.5525,'Annually, late June','2027-06-25','2027-06-26','Ticketed','Sisters Folk Festival','https://www.bigponderoo.com/','An Americana and bluegrass festival in Village Green Park from the team behind the Sisters Folk Festival.'],
  // ── Theater / performing arts ──
  ['bend-comedy-festival','Bend Comedy Festival','arts','Event','Bend','bend','Tower Theatre and downtown Bend venues',44.0601,-121.3138,'Annually, Labor Day weekend','2026-09-04','2026-09-06','Ticketed','Bend Comedy','https://www.bendcomedyfestival.com/','Three days of stand-up, improv, and sketch across downtown Bend venues over Labor Day weekend.'],
  ['ballet-bend','Ballet Bend Presents','arts','Event','Bend','bend','Tower Theatre, Bend',44.058,-121.313,'Recurring performances through the Tower Theatre season','2026-09-25','2026-09-26','Ticketed','Ballet Bend','https://www.towertheatre.org/events','A contemporary dance company that stages performances at the Tower Theatre through the season.'],
  ['nutcracker-bend','The Nutcracker','arts','Event','Bend','bend','Mountain View High School Auditorium, Bend',44.0705,-121.2758,'Annually, December','2026-12-06','2026-12-14','Ticketed','Central Oregon School of Ballet','https://centraloregonschoolofballet.com/nutcracker/','The Central Oregon School of Ballet’s annual Nutcracker, a December tradition since the early 1980s.'],
  ['sunriver-stars-summer-play','Sunriver Stars Summer Play','arts','Event','Sunriver','sunriver','Sunriver Nature Center Amphitheater',43.8735,-121.4419,'Annually, late August','2026-08-20','2026-08-21','Free','Sunriver Stars Community Theater','https://sunriverstars.org/','A free outdoor family play at the Sunriver Nature Center Amphitheater, staged by the Sunriver Stars community theater each summer.'],
]

const CAT = { market:'market',arts:'arts',community:'community',seasonal:'seasonal',festival:'festival','food-drink':'food-drink',race:'race',sports:'sports',music:'music' }
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)

let ts = fs.readFileSync('data/co-events.ts', 'utf8')
const existing = new Set([...ts.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]))

const blocks = E.filter((r) => !existing.has(r[0])).map((r) => {
  const [slug,name,category,schemaType,city,geoSlug,venue,lat,lng,recurrence,next,end,price,org,url,blurb] = r
  const lines = [
    `  {`,
    `    slug: ${q(slug)},`,
    `    name: ${q(name)},`,
    `    category: ${q(CAT[category])},`,
    `    schemaType: ${q(schemaType)},`,
    `    city: ${q(city)},`,
    `    geoSlug: ${q(geoSlug)},`,
    `    venue: ${q(venue)},`,
    lat != null ? `    lat: ${lat},` : null,
    lng != null ? `    lng: ${lng},` : null,
    `    recurrence: ${q(recurrence)},`,
    `    nextConfirmedDate: ${next ? q(next) : 'null'},`,
    `    endDate: ${end ? q(end) : 'null'},`,
    price ? `    priceInfo: ${q(price)},` : null,
    org ? `    organizer: ${q(org)},` : null,
    `    officialUrl: ${q(url)},`,
    `    lastVerified: '${V}',`,
    `    blurb:`,
    `      ${q(blurb)},`,
    `  },`,
  ].filter(Boolean)
  return lines.join('\n')
}).join('\n')

if (!blocks) { console.log('nothing new to add'); process.exit(0) }
ts = ts.replace(/\n\]\n\n\/\*\* Direct slug lookup/, `\n${blocks}\n]\n\n/** Direct slug lookup`)
fs.writeFileSync('data/co-events.ts', ts)
console.log(`appended ${E.filter((r) => !existing.has(r[0])).length} events`)
