/**
 * Central Oregon trails registry (hiking + mountain biking).
 *
 * Source of truth for the /central-oregon/trails hub + detail pages. Central
 * Oregon is a trail town; this covers the marquee hiking and mountain-bike
 * trails. Each trail is the ENTITY (go do it + what it is like to live near the
 * trailhead) and pairs with the live homes for sale nearby, the same moat the
 * golf + venue pages use (docs/CONTENT_ENGINE_SPEC.md §11a).
 *
 * Data provenance (CLAUDE.md §0 — verified + cited, never invented):
 *   - Facts (length, difficulty, use, fee) trace to `officialUrl` (the land
 *     manager: USFS Deschutes National Forest, Bend Park & Recreation District,
 *     Oregon State Parks, or BLM) as of `lastVerified`. AllTrails and other
 *     crowd sources are NOT primary. Where a fact could not be verified from the
 *     official source it is omitted.
 *   - `blurb` is an ORIGINAL, brand-voice write-up. Never scraped.
 *   - `lat`/`lng` are the TRAILHEAD, used to join the live active single-family
 *     listings within ~1.5 miles (same box the golf + park pages use).
 *
 * Schema: trails emit `TouristAttraction` JSON-LD — the policy-safe type for a
 * public recreation destination we do NOT own or operate.
 */

export type TrailUse = 'hike' | 'mtb' | 'both'
export type TrailDifficulty = 'easy' | 'moderate' | 'hard'

export type CoTrail = {
  /** kebab-case slug. Stable, unique. */
  slug: string
  name: string
  city: string
  /** City slug for the cross-link to /cities/[slug] + the market band. */
  geoSlug: string
  /** Primary use — hiking, mountain biking, or both. */
  use: TrailUse
  /** Round-trip miles where the official source states it; note in `distanceNote`. */
  lengthMiles?: number
  /** How the distance is measured, when it needs a word ('round trip', 'one way', 'loop'). */
  distanceNote?: string
  difficulty?: TrailDifficulty
  /** Elevation gain in feet, when the official source states it. */
  elevationGainFt?: number
  /** Trailhead latitude (WGS84) — anchors the nearby-homes query + map. */
  lat?: number
  /** Trailhead longitude (WGS84). */
  lng?: number
  /** Managing agency (USFS Deschutes NF, Bend Park & Recreation District, etc.). */
  landManager: string
  /** Access/parking fee where one applies ('Northwest Forest Pass', 'Free', etc.). */
  fee?: string
  /** Original, brand-voice write-up. Never scraped. */
  blurb: string
  /** Official land-manager URL the facts trace to (CLAUDE.md §0). */
  officialUrl: string
  /** Slug of the Ryan Realty resort community the trailhead sits in, when any. */
  communitySlug?: string
  /** ISO 'YYYY-MM-DD' this row was last verified against officialUrl. */
  lastVerified: string
}

export const TRAIL_USE_LABEL: Record<TrailUse, string> = {
  hike: 'Hiking',
  mtb: 'Mountain biking',
  both: 'Hiking & biking',
}

export const TRAIL_DIFFICULTY_LABEL: Record<TrailDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
}

/** kebab-case a trail name for its slug. */
export function slugifyTrailName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The registry. Every fact is verified against `officialUrl` as of
 * `lastVerified`. Populated 2026-07-03 from source-verified research.
 */
export const CO_TRAILS: CoTrail[] = [
  // ─── BEND — in-town & close-in (homes nearby) ──────────────────────────
  {
    slug: 'pilot-butte',
    name: 'Pilot Butte',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lengthMiles: 1,
    distanceNote: 'one way',
    lat: 44.060673,
    lng: -121.283364,
    landManager: 'Oregon State Parks',
    blurb:
      'Pilot Butte is the cinder cone in the middle of Bend, and the one-mile climb to the summit trades a short, steep effort for a full 360-degree view of the Cascades. Oregon State Parks keeps it open year round, and it sits inside the east-side neighborhoods, so plenty of homes look right at it.',
    officialUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=33',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'deschutes-river-trail-first-street',
    name: 'Deschutes River Trail (First Street Rapids)',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lengthMiles: 1.46,
    lat: 44.067515,
    lng: -121.313723,
    landManager: 'Bend Park & Recreation District',
    blurb:
      'The River Run Reach of the Deschutes River Trail runs 1.46 flat miles along the west bank from First Street Rapids Park, connecting Pioneer Park to Sawyer Park. It is mostly gravel, easy to walk, and threads through some of the closest-in riverfront neighborhoods in Bend.',
    officialUrl: 'https://www.bendparksandrec.org/trail/deschutes-river-trail-river-run-reach/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'shevlin-park',
    name: 'Shevlin Park Loop Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lengthMiles: 6,
    distanceNote: 'loop',
    lat: 44.082648,
    lng: -121.378386,
    landManager: 'Bend Park & Recreation District',
    blurb:
      "Shevlin Park gives you a six-mile loop along the canyon rim through old-growth ponderosa, with a few short steep pitches and Tumalo Creek at the bottom. The nearly 1,000-acre park sits on Bend's west edge, minutes from the Westside neighborhoods that back up to it.",
    officialUrl: 'https://www.bendparksandrec.org/trail/shevlin-park-trails/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sawyer-park',
    name: 'Sawyer Park Trails',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lengthMiles: 2,
    lat: 44.085933,
    lng: -121.308777,
    landManager: 'Bend Park & Recreation District',
    blurb:
      'Sawyer Park spreads across 53 acres on both sides of the Deschutes off O.B. Riley Road, with two miles of easy trail split between paved path, gravel, and dirt. It is a quiet stretch of river close to the north-end neighborhoods and the parkway.',
    officialUrl: 'https://www.bendparksandrec.org/trail/sawyer-park-trails/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'riley-ranch',
    name: 'Riley Ranch Nature Reserve',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lengthMiles: 3.2,
    distanceNote: 'loop',
    lat: 44.095967,
    lng: -121.326886,
    landManager: 'Bend Park & Recreation District',
    fee: 'Free',
    blurb:
      "Riley Ranch is a 184-acre nature reserve on Bend's northwest edge, with 3.2 miles of loop trail dropping toward the Deschutes canyon. Dogs and bikes are not allowed anywhere in it, which keeps it calm, and the newer northwest neighborhoods sit right at its gate.",
    officialUrl: 'https://www.bendparksandrec.org/trail/riley-ranch-nature-reserve-trails/',
    lastVerified: '2026-07-03',
  },
  // ─── BEND — mountain biking (Phil's network) ───────────────────────────
  {
    slug: 'phils-trail',
    name: "Phil's Trail",
    city: 'Bend',
    geoSlug: 'bend',
    use: 'mtb',
    lat: 44.044608,
    lng: -121.384984,
    landManager: 'USFS Deschutes National Forest',
    blurb:
      "Phil's Trail is the namesake of the biggest mountain-bike network on the west side of Bend, one of the best-known trailheads in the Northwest. The riding starts minutes from town off Skyliners Road, which is why the neighborhoods out that way fill with people who ride before work.",
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/phils-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'whoops-trail',
    name: 'Whoops Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'mtb',
    lat: 44.044608,
    lng: -121.384984,
    landManager: 'USFS Deschutes National Forest',
    blurb:
      "Whoops is the jump trail in the Phil's network, a downhill run of tabletops and bermed rollers that riders lap all summer. It shares the Phil's Trailhead west of Bend, so it draws the same crowd that made the whole west side a mountain-bike address.",
    officialUrl: 'https://cotamtb.com/ebikes',
    lastVerified: '2026-07-03',
  },
  // ─── BEND — Cascade Lakes & high country (public land) ─────────────────
  {
    slug: 'tumalo-falls',
    name: 'Tumalo Falls',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lat: 44.0318028,
    lng: -121.5661556,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Northwest Forest Pass',
    blurb:
      'Tumalo Falls is the payoff at the end of Skyliners Road, a wall of water you can see from the parking area and hike above on the North Fork Trail. A Northwest Forest Pass gets you in, and it is one of the closest big-waterfall trailheads to any city in Oregon.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/tumalo-falls-day-use-area',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'green-lakes',
    name: 'Green Lakes Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lat: 44.030375,
    lng: -121.7358389,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Central Cascades Wilderness Permit',
    blurb:
      'The Green Lakes Trail follows Fall Creek up into the Three Sisters Wilderness, past cascades to a set of alpine lakes under South Sister and Broken Top. It is one of the most-walked trails in the state, so a Central Cascades Wilderness Permit is required from mid-June through mid-October.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/green-lakes-soda-creek-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'south-sister-climber-trail',
    name: 'South Sister Climber Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lat: 44.0349917,
    lng: -121.7656861,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Central Cascades Wilderness Permit',
    blurb:
      'The South Sister Climber Trail leaves the Devils Lake trailhead about 29 miles west of Bend and works its way to the top of the tallest peak you can walk up without a rope. It needs a Central Cascades Wilderness Permit in summer, and most people start it before dawn.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/devils-lake-south-sister-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'tumalo-mountain',
    name: 'Tumalo Mountain Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lat: 43.9998528,
    lng: -121.6637083,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Northwest Forest Pass',
    blurb:
      'Tumalo Mountain is the short, steep climb across the highway from Mount Bachelor, and the summit lines up South Sister, Broken Top, and Bachelor in one view. It starts at the Dutchman Sno-Park, which means a Northwest Forest Pass in summer and a Sno-Park permit in winter.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/dutchman-sno-park-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'benham-falls',
    name: 'Deschutes River Trail (Benham Falls East)',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    lat: 43.9310306,
    lng: -121.4132278,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Northwest Forest Pass',
    blurb:
      'Benham Falls East puts you on the Deschutes River Trail in old-growth ponderosa south of Bend, where the river funnels into a long stretch of whitewater. The trail runs north toward town and south toward Sunriver, and a Northwest Forest Pass covers the parking.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/benham-falls-east-day-use-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'ray-atkeson-trail',
    name: 'Ray Atkeson Loop Trail',
    city: 'Bend',
    geoSlug: 'bend',
    use: 'hike',
    distanceNote: 'loop',
    lat: 44.013487,
    lng: -121.736897,
    landManager: 'USFS Deschutes National Forest',
    fee: 'Northwest Forest Pass',
    blurb:
      'The Ray Atkeson Loop circles part of Sparks Lake with South Sister standing over the water, the same view the landscape photographer it is named for made famous. It is an easy loop off the Cascade Lakes Highway, covered by a Northwest Forest Pass.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/ray-atkeson-trailhead',
    lastVerified: '2026-07-03',
  },
  // ─── SMITH ROCK & NORTH ────────────────────────────────────────────────
  {
    slug: 'misery-ridge',
    name: 'Misery Ridge Trail',
    city: 'Terrebonne',
    geoSlug: 'terrebonne',
    use: 'hike',
    lengthMiles: 1,
    distanceNote: 'one way',
    lat: 44.365891,
    lng: -121.137377,
    landManager: 'Oregon State Parks',
    fee: 'day-use fee',
    blurb:
      'Misery Ridge is the signature climb at Smith Rock, a one-mile push up the spine of the park that drops you at Monkey Face on the far side. Smith Rock draws climbers from around the world, and the state park charges a day-use fee at the lot in Terrebonne.',
    officialUrl:
      'https://stateparks.oregon.gov/index.cfm?do=main.loadFile&load=_siteFiles/publications/Smith_Rock_Trail_Map(Web)112059.pdf',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'smith-rock-river-trail',
    name: 'Smith Rock River Trail',
    city: 'Terrebonne',
    geoSlug: 'terrebonne',
    use: 'hike',
    lengthMiles: 2.2,
    distanceNote: 'one way',
    lat: 44.365891,
    lng: -121.137377,
    landManager: 'Oregon State Parks',
    fee: 'day-use fee',
    blurb:
      'The River Trail runs 2.2 flat miles along the Crooked River at the base of Smith Rock, under the walls where the climbers are. It is the easy way to see the park, and it ties into Misery Ridge if you want to make a loop. A day-use fee covers the lot.',
    officialUrl:
      'https://stateparks.oregon.gov/index.cfm?do=main.loadFile&load=_siteFiles/publications/Smith_Rock_Trail_Map(Web)112059.pdf',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'steelhead-falls',
    name: 'Steelhead Falls Trail',
    city: 'Terrebonne',
    geoSlug: 'terrebonne',
    use: 'hike',
    lengthMiles: 0.5,
    distanceNote: 'one way',
    lat: 44.411145,
    lng: -121.2927,
    landManager: 'BLM Prineville District',
    fee: 'Free',
    blurb:
      'Steelhead Falls is a half-mile walk down to a wide drop on the Deschutes River, on BLM land north of Crooked River Ranch. It is free, relatively easy with one short steep section, and a local favorite for a quick swim on a hot day.',
    officialUrl: 'https://www.blm.gov/visit/steelhead-falls-trail',
    communitySlug: 'crooked-river-ranch',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'peterson-ridge',
    name: 'Peterson Ridge Trail',
    city: 'Sisters',
    geoSlug: 'sisters',
    use: 'both',
    lat: 44.280732,
    lng: -121.549999,
    landManager: 'USFS Deschutes National Forest',
    blurb:
      'Peterson Ridge is the trail system right out of Sisters, a web of routes that hikers and mountain bikers share across juniper and pine with the Cascades ahead of you. It starts at the edge of town, which is part of why Sisters holds its own as a trail town.',
    officialUrl: 'https://www.fs.usda.gov/r06/deschutes/recreation/peterson-ridge-trailhead',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'alder-springs',
    name: 'Alder Springs Trail',
    city: 'Sisters',
    geoSlug: 'sisters',
    use: 'hike',
    lat: 44.423848,
    lng: -121.364331,
    landManager: 'USFS Crooked River National Grassland',
    fee: 'Free',
    blurb:
      'Alder Springs drops off the high desert into a green canyon, crosses Whychus Creek, and follows it down to the confluence with the Deschutes. It is a free, day-use trail on the Crooked River National Grassland, and the contrast between sagebrush rim and creekside shade is the whole point.',
    officialUrl: 'https://www.fs.usda.gov/r06/ochoco/recreation/trails/alder-springs-trail-855',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'gray-butte',
    name: 'Gray Butte Trail',
    city: 'Terrebonne',
    geoSlug: 'terrebonne',
    use: 'hike',
    lat: 44.428816,
    lng: -121.09023,
    landManager: 'USFS Crooked River National Grassland',
    fee: 'Free',
    blurb:
      'The Gray Butte Trail climbs the flank of Gray Butte through juniper and sage, tying into routes that reach BLM land and the back side of Smith Rock. It is a no-fee trail on the Crooked River National Grassland, quieter than the state park next door.',
    officialUrl: 'https://www.fs.usda.gov/r06/ochoco/recreation/trails/gray-butte-trail-852',
    lastVerified: '2026-07-03',
  },
]

/** Direct slug lookup. */
export function getTrailBySlug(slug: string): CoTrail | undefined {
  return CO_TRAILS.find((t) => t.slug === slug)
}
