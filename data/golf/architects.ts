/**
 * Architect cross-cut — the SERP wedge no competitor owns.
 *
 * Source: out/golf-lp-research/research-notes.md §5.
 * Voice rules per CLAUDE.md §3 — no banned words, no marketing slop,
 * Matt-direct + honest.
 */

import { GOLF_COURSES, type GolfCourse } from './courses'

export interface GolfArchitect {
  slug: string
  name: string
  bio: string
  /** Other famous courses they designed, for the SEO/E-A-T halo. */
  alsoKnownFor?: string[]
  /** Wikipedia or official-bio URL for outbound E-E-A-T signal. */
  wikipediaUrl?: string
  /** Fallback initials displayed as a monogram when no licensed
   * portrait exists. 2–3 chars. Renders Playfair caps in a navy
   * circle, brand-aligned. */
  monogram: string
}

export const GOLF_ARCHITECTS: GolfArchitect[] = [
  {
    slug: 'david-mclay-kidd',
    name: 'David McLay Kidd',
    monogram: 'DMK',
    bio: 'Scottish-born links specialist. Returned American golf design to firm-and-fast, ground-game-friendly playing surfaces.',
    alsoKnownFor: ['Bandon Dunes', 'St Andrews Castle Course', 'Mammoth Dunes (Sand Valley)'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/David_McLay_Kidd',
  },
  {
    slug: 'jack-nicklaus',
    name: 'Jack Nicklaus',
    monogram: 'JN',
    bio: '18 major championships. His signature design work spans over 300 courses worldwide. Pronghorn Nicklaus is the only signature Nicklaus in Oregon.',
    alsoKnownFor: ['Muirfield Village', 'PGA West Stadium', 'Cabo del Sol Ocean Course'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Jack_Nicklaus',
  },
  {
    slug: 'tom-fazio',
    name: 'Tom Fazio',
    monogram: 'TF',
    bio: "America's most prolific Top-100 architect. Known for using dramatic native terrain — at Pronghorn that means lava tubes and ancient juniper.",
    alsoKnownFor: ['Shadow Creek', 'Sand Ridge', 'Wade Hampton'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Tom_Fazio',
  },
  {
    slug: 'cupp-fought',
    name: 'Robert E. Cupp & John Fought',
    monogram: 'C&F',
    bio: 'A working partnership that delivered Crosswater, then split. Cupp continued with Jim Ramey on Caldera Links and Quail Run. Fought went on to renovate Glaze Meadow and Sunriver Meadows.',
    alsoKnownFor: ['Pumpkin Ridge (Witch Hollow + Ghost Creek)'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Robert_E._Cupp',
  },
  {
    slug: 'john-fought',
    name: 'John Fought',
    monogram: 'JF',
    bio: '1977 US Amateur champion. As an architect, the rare designer who renovates as carefully as he builds new — his 2012 rework of Glaze Meadow is the reason it sits in the destination eight.',
    alsoKnownFor: ['Pumpkin Ridge', 'The Reserve Vineyards South Course', 'Langdon Farms'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/John_Fought',
  },
  {
    slug: 'robert-trent-jones-jr',
    name: 'Robert Trent Jones Jr.',
    monogram: 'RTJ',
    bio: 'Second-generation course architect; over 270 courses across 40+ countries. The Woodlands at Sunriver opened in 1981 and still plays as Jones designed it.',
    alsoKnownFor: ['Chambers Bay (2015 US Open)', 'Poppy Hills', 'The Prince Course at Princeville'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Robert_Trent_Jones_Jr.',
  },
  {
    slug: 'robert-muir-graves',
    name: 'Robert Muir Graves',
    monogram: 'RMG',
    bio: 'San Francisco-based, prolific in the Pacific NW. Five Central Oregon courses bear his routing — Big Meadow, Widgi Creek, River\'s Edge, and the front + back of The Greens at Redmond.',
    alsoKnownFor: ['Half Moon Bay Old Course (renovation)', 'Tilden Park (renovation)'],
  },
  {
    slug: 'weiskopf-morrish',
    name: 'Tom Weiskopf & Jay Morrish',
    monogram: 'W&M',
    bio: '1973 Open champion turned course architect; partnered with Morrish through the mid-1990s. Broken Top was one of their late collaborations.',
    alsoKnownFor: ['Loch Lomond', 'TPC Scottsdale Stadium', 'Forest Highlands'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Tom_Weiskopf',
  },
  {
    slug: 'bunny-mason',
    name: 'Gene "Bunny" Mason',
    monogram: 'BM',
    bio: 'Designed five Central Oregon courses across two decades. Eagle Crest Resort + Ridge + Challenge, Awbrey Glen, and the front nine at Crooked River Ranch.',
    alsoKnownFor: ['Sunset Grove (Forest Grove)', 'McKenzie River GC'],
  },
  {
    slug: 'john-harbottle-iii',
    name: 'John Harbottle III',
    monogram: 'JH',
    bio: 'Pacific NW architect known for building strategic, playable munis. Juniper in Redmond is widely ranked Best Municipal in Oregon.',
    alsoKnownFor: ['Wine Valley (Walla Walla)', 'Stevinson Ranch'],
  },
  {
    slug: 'hardy-jacobsen',
    name: 'Jim Hardy & Peter Jacobsen',
    monogram: 'H&J',
    bio: 'Tour-pro-and-coach pairing. Jacobsen brings the player\'s eye for shot variety; Hardy brings the architectural rigor. Brasada Canyons is widely cited as their best mountain-desert work.',
    alsoKnownFor: ['Genoa Lakes Resort', 'Tetherow (early routing consultation)'],
  },
  {
    slug: 'william-overdorf',
    name: 'William Overdorf',
    monogram: 'WO',
    bio: 'Oregon-based architect. Aspen Lakes was a multi-phase build: front nine 1996, back nine 2000. The Cyrus family commissioned and still owns the course.',
    alsoKnownFor: ['Crooked River Ranch (renovation)'],
  },
  {
    slug: 'brian-whitcomb',
    name: 'Brian Whitcomb',
    monogram: 'BW',
    bio: 'Former PGA of America president. Owner-designed Lost Tracks on his own land south of Bend; the old railroad-dining-car bridge on hole 16 is the most photographed feature.',
  },
  {
    slug: 'egan-baldock',
    name: 'H. Chandler Egan & Bob Baldock',
    monogram: 'HCE',
    bio: 'Egan was a Pebble Beach renovator and Oregon\'s first national golf figure. He routed the back nine at Bend Golf Club in 1925. Bob Baldock added the front nine in 1973.',
    alsoKnownFor: ['Pebble Beach (Egan, 1929 renovation)'],
    wikipediaUrl: 'https://en.wikipedia.org/wiki/H._Chandler_Egan',
  },
  {
    slug: 'bill-robinson',
    name: 'Bill Robinson',
    monogram: 'BR',
    bio: 'Designed Meadow Lakes in 1993 as both a top-3 Oregon municipal AND the city of Prineville\'s wastewater-disposal infrastructure — a Crooked River discharge solution Robinson built into the routing.',
  },
  {
    slug: 'other',
    name: 'Other',
    monogram: '·',
    bio: 'Courses without a single named lead architect.',
  },
]

export function architectFor(designerSlug: string): GolfArchitect | undefined {
  return GOLF_ARCHITECTS.find((a) => a.slug === designerSlug)
}

export function coursesByArchitect(): Array<{ architect: GolfArchitect; courses: GolfCourse[] }> {
  const map = new Map<string, GolfCourse[]>()
  for (const c of GOLF_COURSES) {
    const arr = map.get(c.designerSlug) ?? []
    arr.push(c)
    map.set(c.designerSlug, arr)
  }
  return GOLF_ARCHITECTS
    .filter((a) => map.has(a.slug) && a.slug !== 'other')
    .map((a) => ({ architect: a, courses: map.get(a.slug)! }))
    .sort((x, y) => y.courses.length - x.courses.length)
}
