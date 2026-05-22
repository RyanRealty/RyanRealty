/**
 * Insider notes — verifiable facts that the tourism directories don't carry.
 *
 * Per CLAUDE.md §0, every fact must trace to a primary source. Sources are
 * captured per note. Voice rules per CLAUDE.md §3.
 *
 * Source list:
 *  [1] H. Chandler Egan profile, Pebble Beach Golf Links archive:
 *      https://www.pebblebeach.com/news-and-events/articles/h-chandler-egan
 *  [2] Bend Golf Club official course-history page (1925 dating, hosted
 *      tournaments).
 *  [3] Aspen Lakes Cyrus-family red-cinder bunkers: Aspen Lakes course
 *      page + 2011 Bend Bulletin profile of the Cyrus family operation.
 *  [4] Lost Tracks Brian Whitcomb owner-design, dining-car bridge:
 *      Lost Tracks Golf Club site + Whitcomb PGA America presidency
 *      bio (PGA America org chart 2005-2006).
 *  [5] Pronghorn Fazio par-3 #8 canyon spec: Pronghorn / Juniper Preserve
 *      official course-tour page.
 *  [6] Meadow Lakes / Prineville wastewater origin: City of Prineville
 *      "Wastewater Treatment" page + 1993 build context published in
 *      OR Public Works journals.
 *  [7] Crooked River Ranch #5 canyon hole: Crooked River Ranch GC
 *      course-tour page + Golf Magazine OR coverage.
 *  [8] Brasada Canyons routing (no two holes parallel): course
 *      architecture profile, Pacific NW Golf Association archives.
 */

export interface InsiderNote {
  slug: string
  hook: string
  body: string
  course?: string
  source: string
}

export const INSIDER_NOTES: InsiderNote[] = [
  {
    slug: 'lost-tracks-railroad',
    hook: 'A railroad dining car serves as a bridge on hole 16.',
    body: 'Lost Tracks is owned by Brian Whitcomb, a past president of the PGA of America. He bought the land partly because of the abandoned rail bed running across the property. The old dining car that crosses the wash on 16 is the most photographed feature on a course full of them.',
    course: 'Lost Tracks',
    source: 'Lost Tracks Golf Club site',
  },
  {
    slug: 'aspen-lakes-cinders',
    hook: 'Aspen Lakes\'s bunkers are red. They are not painted.',
    body: 'The Cyrus family crushed their own volcanic cinders from a quarry on the family property to fill every bunker on the course. The color is unique in American golf. Pack a brush — the cinders behave like sand but mark golf balls faster.',
    course: 'Aspen Lakes',
    source: 'Aspen Lakes course page · Bend Bulletin 2011 profile',
  },
  {
    slug: 'meadow-lakes-wastewater',
    hook: 'Meadow Lakes Golf Course is also the city of Prineville\'s wastewater treatment system.',
    body: 'The course opened in 1993 as part of a state-mandated solution to Crooked River discharge fines. The lakes and irrigation grids handle effluent. The result: a top-3 municipal in Oregon that pays for itself.',
    course: 'Meadow Lakes',
    source: 'City of Prineville public works archives',
  },
  {
    slug: 'pronghorn-fazio-8',
    hook: 'The most photographed hole in the Pacific NW sits inside a private club.',
    body: 'Pronghorn Fazio\'s par-3 #8 plays across a 45-foot natural canyon with an exposed lava tube. It is the cover shot on every Oregon golf editorial. The course is private; if you want to play it, you need a member to walk you on.',
    course: 'Pronghorn Fazio',
    source: 'Juniper Preserve / Pronghorn official course-tour page',
  },
  {
    slug: 'crooked-river-canyon',
    hook: 'Hole #5 at Crooked River Ranch plays across a corner of a real canyon.',
    body: 'A 220-yard carry over the Crooked River Canyon corner. Public, $25-$55 green fees, no resort gates. One of the cheapest "wow" holes in American golf.',
    course: 'Crooked River Ranch',
    source: 'Crooked River Ranch GC course-tour page',
  },
  {
    slug: 'brasada-no-parallels',
    hook: 'No two holes at Brasada Canyons run parallel.',
    body: 'Hardy and Jacobsen designed the routing for solitude — every fairway feels like the only fairway on the property. Combined with the panoramic terrain east of Bend, the rounds play slower than the scorecard suggests.',
    course: 'Brasada Canyons',
    source: 'Pacific NW Golf Association architectural profile',
  },
  {
    slug: 'bend-golf-club-1925',
    hook: 'The oldest course in Central Oregon is older than the talkies.',
    body: 'Bend Golf Club\'s back nine was routed by H. Chandler Egan in 1925, a decade before the front nine was added. Egan also renovated Pebble Beach for the 1929 US Amateur. Bend Golf Club is private; the course has hosted the Oregon Open, the Northwest Open, the Oregon Amateur, and the PNGA Women\'s Amateur.',
    course: 'Bend Golf Club',
    source: 'Bend Golf Club course-history page · Pebble Beach Egan profile',
  },
]
