/**
 * _expand-thin-blurbs.mjs — one-off: replace the 17 thin event blurbs flagged by
 * check-content-uniqueness (G-DUP) with fuller, factual, brand-voice write-ups
 * from the verified 2026-07-03 research. Idempotent-ish: only rewrites the listed
 * slugs. Uses JSON.stringify for safe escaping (Prettier normalizes quotes).
 */
import fs from 'node:fs'

const FILE = 'data/co-events.ts'
const NEW = {
  'redmond-farmers-market':
    'A Friday afternoon farmers market in Centennial Park in downtown Redmond, running from May into August. Local growers, ranchers, and food makers set up each week alongside food carts and live music, a warm-weather gathering that pauses only for the week of the county fair.',
  'central-oregon-beer-week':
    'A week of tap takeovers, brewer dinners, rare keg tappings, and collaboration pours across Central Oregon breweries each spring. Bend anchors one of the densest brewery scenes in the country, and Beer Week is when the region puts its best and most experimental beers forward.',
  'la-pine-frontier-days':
    'La Pine marks the Fourth of July weekend with Frontier Days, a small town tradition built around a downtown parade, a community barbecue, vendors, and family games at Frontier Heritage Park. It is La Pine at its most neighborly, the kind of hometown Fourth that has faded in bigger places.',
  'sunriver-grand-illumination':
    'Sunriver Resort opens the holiday season with its Grand Illumination, a late November evening when the resort lights up for winter. Families gather for the tree lighting, hot cocoa, music, and a visit from Santa, kicking off weeks of holiday activities across Sunriver.',
  'bend-pride':
    'Bend Pride brings the community together in Drake Park each June for a free afternoon of music, local vendors, drag performances, and family activities along Mirror Pond. It is a growing celebration in a town that has become one of the more welcoming small cities in the interior Northwest.',
  'sisters-harvest-faire':
    'One of the largest craft fairs in Central Oregon, the Sisters Harvest Faire fills the downtown streets with more than a hundred artisan and food booths across a fall weekend. It pairs handmade goods and regional food with the crisp shoulder season weather that makes autumn in Sisters worth the drive.',
  'jefferson-county-fair':
    'Madras hosts the Jefferson County Fair and Rodeo over four days in late July at the county fairgrounds. Expect 4-H and livestock exhibits, carnival rides, live music, and PRCA rodeo action, the kind of full county fair that anchors the agricultural calendar in this part of Central Oregon.',
  'dirty-half':
    'A trail half marathon on the singletrack and forest roads just west of Bend, the Dirty Half is one of the signature FootZone races and a fixture of the local running calendar each June. The course climbs into the pines above town and rewards runners with big Cascade views.',
  'happy-girls-run':
    'A race weekend for women on the trails and roads around Sisters, with half marathon, 10K, and 5K distances each fall. Based at the FivePine campus, Happy Girls draws a big, supportive field and finishes with music, food, and a celebration built around the runners.',
  'i-like-pie':
    'A Thanksgiving morning fun run from Riverbend Park along the Deschutes, the I Like Pie run trades finish line medals for slices of pie and raises money for the Cascade Relays Foundation. It has become a holiday tradition for Bend families looking to earn their turkey.',
  'cascade-gravel-grinder':
    'A gravel cycling event on the forest and ranch roads around Sisters, part of the Oregon Gravel Grinder series. Riders choose from several distances across high desert terrain, with the Three Sisters on the horizon and a finish line gathering in town. It lands in late spring each year.',
  'bend-marathon':
    'The Bend Marathon and Half runs through the neighborhoods, river trails, and Old Mill District of Bend each spring, with marathon, half, and relay options. It is a mid sized, runner friendly race that shows off the city on foot, from the west side streets to the banks of the Deschutes.',
  'music-on-the-green':
    'A free outdoor concert series on alternating Wednesday evenings in Redmond through the summer, Music on the Green brings regional bands to a city park for a relaxed family night out. Neighbors bring chairs and blankets, food carts line up, and kids run the lawn while the music plays.',
  'big-ponderoo':
    'A summer Americana and bluegrass festival in the Village Green park in Sisters, from the team behind the Sisters Folk Festival. Big Ponderoo pairs a strong roots music lineup with art, food, and the walkable small town setting that makes Sisters a festival town. It returns in late June.',
  'bend-comedy-festival':
    'Over Labor Day weekend, the Bend Comedy Festival takes over the Tower Theatre and other downtown venues with three days of stand-up, improv, and sketch. National touring comics share the bill with the local comedy scene that has grown up around the weekly open mics in Bend.',
  'ballet-bend':
    'Ballet Bend is a contemporary dance company that stages performances at the Tower Theatre through the season, from original works to guest companies on tour. Its shows bring a level of professional dance to Central Oregon that a town this size rarely supports.',
  'nutcracker-bend':
    'The Central Oregon School of Ballet stages its Nutcracker each December, a full length holiday production that has been a Bend tradition since the early 1980s. Generations of local dancers have grown up performing it, and it fills the auditorium across a run of December shows.',
}

let src = fs.readFileSync(FILE, 'utf8')
const slugMatches = [...src.matchAll(/\n\s*slug:\s*'([^']+)'/g)]
const blurbRe = /(\bblurb:\s*\n?\s*)(['"])(?:\\.|(?!\2)[^\\])*\2/
let n = 0
// Rebuild from the back so indices stay valid.
for (let i = slugMatches.length - 1; i >= 0; i--) {
  const slug = slugMatches[i][1]
  if (!NEW[slug]) continue
  const start = slugMatches[i].index
  const end = i + 1 < slugMatches.length ? slugMatches[i + 1].index : src.length
  const block = src.slice(start, end)
  const replaced = block.replace(blurbRe, (_m, pre) => `${pre}${JSON.stringify(NEW[slug])}`)
  if (replaced === block) {
    console.error(`FAIL: could not replace blurb for ${slug}`)
    process.exit(2)
  }
  src = src.slice(0, start) + replaced + src.slice(end)
  n++
}
fs.writeFileSync(FILE, src)
console.log(`expanded ${n} thin blurbs`)
