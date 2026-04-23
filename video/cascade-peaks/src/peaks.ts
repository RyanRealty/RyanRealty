// Cascade Peaks content pack — the 10 peaks Matt locked for the video.
//
// Field spec per Matt (2026-04-21):
//   - Elevation + last eruption (volcanoes)
//   - Origin story (how it got its name)
//   - Distinguishing feature (how to recognize from Bend)
//   - 2-3 surprising facts (first ascent, summit counts, fatalities,
//     difficulty, geology)
//   - Local knowledge line ("glows pink at sunset", etc.)
//   - One "huh I didn't know that" hook
//
// Tone: playful friend teaching you the mountains while hanging out — not
// Wikipedia. Memorable comparisons. Everything short enough to fit IG safe
// zones. Numbers verified against master list and USGS CVO / SummitPost /
// Peakbagger (source trace in cascade_peaks_master_list.md).
//
// Pacing target: 8-10s per peak so all facts can be absorbed without pausing.

export type Peak = {
  /** Slug for internal references. */
  id: string;
  /** Display name (exactly as labeled on the HUD and in headlines). */
  name: string;
  /** Shorter label for the panoramic HUD where space is tight. */
  shortName?: string;
  /** Decimal degrees. */
  lat: number;
  lon: number;
  /** Elevation in feet. */
  elevationFt: number;
  /** Distance from Bend city center in miles (great-circle). */
  distanceMi: number;
  /** Compass bearing from Bend. */
  bearing: string;
  /** Scene order for the deep-dive sequence (south-to-north in the pan). */
  order: number;
  /** Last known eruption as a short display string. null for non-volcanic. */
  lastEruption: string | null;
  /** Short playful origin story (max ~200 chars — 2 lines on IG). */
  origin: string;
  /** Distinguishing feature Matt specified — what to point the callout at. */
  distinguishingFeature: string;
  /** Headline "huh" hook — the single most memorable fact. */
  hook: string;
  /** Additional short facts (each ≤ 90 chars). Rendered as stacked bullets. */
  facts: string[];
  /** Local knowledge line — "the one that [does the thing]". */
  localKnowledge: string;
  /** Camera hints for the 3D orbit — wide radius + high camera (oblique) so
   *  the full volcano and neighbors read; tuned after tile QA. */
  camera: {
    /** Horizontal orbit radius in meters (camera arcs at this distance). */
    orbitRadiusM: number;
    /** Camera Z above the summit in meters (steep look-down onto massif). */
    cameraHeightM: number;
    /** Orbit start angle in degrees (0 = east, 90 = north). */
    startAzimuthDeg: number;
    /** Sweep in degrees across the orbit. Positive = counter-clockwise. */
    sweepDeg: number;
  };
};

// ---------------------------------------------------------------------------
// The 10 locked peaks, south-to-north (matches the intro pan direction).
// ---------------------------------------------------------------------------

export const PEAKS: Peak[] = [
  {
    id: 'paulina',
    name: 'Paulina Peak',
    shortName: 'Paulina',
    lat: 43.7208,
    lon: -121.258,
    elevationFt: 7985,
    distanceMi: 37.4,
    bearing: 'S',
    order: 1,
    lastEruption: '~1,300 years ago',
    origin:
      'Named for Paulina, a 19th-century Paiute leader whose band lived across Central Oregon before settlers pushed them out.',
    distinguishingFeature:
      'Towering rim of Newberry Caldera — two lakes sit inside the crater below',
    hook:
      'The youngest volcanic eruption in Oregon happened right here — 1,300 years ago.',
    facts: [
      'Highest point on the Newberry Caldera rim',
      'Two alpine lakes — Paulina and East — sit inside the crater',
      'Obsidian Flow is one of the largest in the Lower 48',
      'You can drive to the summit in summer',
    ],
    localKnowledge:
      'The paved summit road has views across 5 states on a clear day.',
    camera: {
      orbitRadiusM: 7800,
      cameraHeightM: 2800,
      startAzimuthDeg: 225,
      sweepDeg: 88,
    },
  },
  {
    id: 'bachelor',
    name: 'Mt. Bachelor',
    shortName: 'Bachelor',
    lat: 43.9788,
    lon: -121.6885,
    elevationFt: 9065,
    distanceMi: 22.1,
    bearing: 'WSW',
    order: 2,
    lastEruption: '~10,000 years ago',
    origin:
      'Early settlers saw three peaks clustered together (the Sisters) and one smaller cone off by itself — the "bachelor." Was later known briefly as Bachelor Butte.',
    distinguishingFeature:
      'Near-perfect symmetrical cone — the only peak that looks manufactured',
    hook:
      'Oregon\'s largest ski area is stamped on the face you see from Bend every morning.',
    facts: [
      '4,318 skiable acres — biggest resort in Oregon',
      '3,365 ft vertical drop, top-to-bottom runs',
      'One of the youngest volcanoes in Oregon',
      'Over 1 million visitors per winter',
    ],
    localKnowledge:
      "When the top turns white in October, locals say \"Bachelor's got his hat on.\"",
    // Symmetrical cone — close orbit showing off the manufactured-looking form.
    // Start NE (facing Bend viewers), sweep clockwise across the N/NW side.
    camera: {
      orbitRadiusM: 9200,
      cameraHeightM: 3200,
      startAzimuthDeg: 45,
      sweepDeg: 118,
    },
  },
  {
    id: 'broken_top',
    name: 'Broken Top',
    shortName: 'Broken Top',
    lat: 44.1004,
    lon: -121.7023,
    elevationFt: 9175,
    distanceMi: 24.9,
    bearing: 'WNW',
    order: 3,
    lastEruption: '~100,000 years ago',
    origin:
      'The name is literal — the entire summit was blown off in an eruption, leaving a jagged half-crater. Pioneers called it Broken Top because that\'s what it looks like.',
    distinguishingFeature:
      'The shattered caldera rim — looks like someone took a bite out of the mountain',
    hook:
      'There\'s a turquoise crater lake hidden inside the mountain most people have never heard of.',
    facts: [
      'No true summit — you walk the jagged crater rim',
      'Bend Glacier & Crook Glacier live inside the cirque',
      'Class 4 scramble to the highest crag',
      'The pink volcanic rock around the crater is rhyolite',
    ],
    localKnowledge:
      'This is the jagged one. If it looks like something bit the top off, that\'s Broken Top.',
    // Shattered caldera — elevated orbit so viewer can see into the jagged
    // crater. Start NNE, sweep clockwise to reveal the crater opening to the E.
    camera: {
      orbitRadiusM: 9200,
      cameraHeightM: 3300,
      startAzimuthDeg: 20,
      sweepDeg: 118,
    },
  },
  {
    id: 'south_sister',
    name: 'South Sister',
    shortName: 'S. Sister',
    lat: 44.1031,
    lon: -121.7689,
    elevationFt: 10358,
    distanceMi: 29.0,
    bearing: 'W',
    order: 4,
    lastEruption: '~2,000 years ago',
    origin:
      'Early Methodist missionaries named the Three Sisters "Faith, Hope, and Charity." South Sister was Charity. The name never caught on. The other one did.',
    distinguishingFeature:
      'Oregon\'s 3rd tallest peak — perfectly round crater at the summit',
    hook:
      'There\'s a lake at the summit that\'s the highest in Oregon.',
    facts: [
      'Oregon\'s 3rd highest peak — 10,358 ft',
      'Youngest stratovolcano in Oregon — actively monitored',
      'Teardrop Pool at the summit is the highest lake in Oregon',
      '~5,000 people summit it every year',
    ],
    localKnowledge:
      'The one that glows pink at sunset — every Bend sunset photo has her in the background.',
    // Oregon's 3rd highest — 10358 ft, prominent glaciated dome. Back off enough
    // to frame the summit crater + Teardrop Pool. Start ESE (facing Bend),
    // sweep clockwise to reveal the Prouty Glacier on the N flank.
    camera: {
      orbitRadiusM: 10500,
      cameraHeightM: 3800,
      startAzimuthDeg: 110,
      sweepDeg: 125,
    },
  },
  {
    id: 'middle_sister',
    name: 'Middle Sister',
    shortName: 'M. Sister',
    lat: 44.1344,
    lon: -121.7783,
    elevationFt: 10047,
    distanceMi: 30.0,
    bearing: 'WNW',
    order: 5,
    lastEruption: '~14,000 years ago',
    origin:
      'Hope, in the original missionary naming. Locals just call her Middle Sister — the one between her siblings.',
    distinguishingFeature:
      'More rugged and eroded than South Sister — big Hayden Glacier on her east flank',
    hook:
      'She\'s the forgotten Sister — everyone climbs South, nobody climbs Middle.',
    facts: [
      '4th highest peak in Oregon',
      'Hayden Glacier covers her entire east face',
      'Class 3 scramble to the summit — trickier than South',
      'Older than her sisters by roughly 100,000 years',
    ],
    localKnowledge:
      'Between the famous two. If you squint, the asymmetric silhouette is the giveaway.',
    // Middle Sister — Hayden Glacier covers her east face. Start E so the
    // glacier is hero at scene open, then sweep clockwise across S to show
    // the asymmetric silhouette that distinguishes her from South & North.
    camera: {
      orbitRadiusM: 9800,
      cameraHeightM: 3500,
      startAzimuthDeg: 90,
      sweepDeg: 125,
    },
  },
  {
    id: 'north_sister',
    name: 'North Sister',
    shortName: 'N. Sister',
    lat: 44.1679,
    lon: -121.7631,
    elevationFt: 10085,
    distanceMi: 31.7,
    bearing: 'WNW',
    order: 6,
    lastEruption: '~50,000 years ago',
    origin:
      'Faith, in the missionary naming. She\'s the oldest Sister — and the one climbers fear.',
    distinguishingFeature:
      'The most jagged and technical of the Three — crumbling rock spires on top',
    hook:
      'Climbers call the summit ridge the "Terrible Traverse" — one of the most dangerous scrambles in Oregon.',
    facts: [
      'Oldest of the Three Sisters by ~100,000 years',
      'Class 4 rock climbing to the summit — no easy route',
      'Multiple glaciers on her flanks, including Thayer',
      'Only mountain in the Sisters with documented summit fatalities',
    ],
    localKnowledge:
      'The pointy, beat-up one just left of Middle Sister — that\'s North.',
    // North Sister — mirror the Washington config that worked: wide orbit,
    // ~1000m above summit, so photogrammetry resolves the jagged summit as
    // silhouette against sky. Start ESE, sweep around the south face.
    camera: {
      orbitRadiusM: 11800,
      cameraHeightM: 4200,
      startAzimuthDeg: 100,
      sweepDeg: 70,
    },
  },
  {
    id: 'washington',
    name: 'Mt. Washington',
    shortName: 'Washington',
    lat: 44.3306,
    lon: -121.8378,
    elevationFt: 7794,
    distanceMi: 46.9,
    bearing: 'NW',
    order: 7,
    lastEruption: '~900,000 years ago — extinct',
    origin:
      'Named for George Washington by a 19th-century survey team. Unclear why this particular peak, but the name stuck.',
    distinguishingFeature:
      'Sharp volcanic plug — the entire outer volcano eroded away, leaving only the hardened core',
    hook:
      'What you\'re looking at is the inside of a volcano. Glaciers ate the rest.',
    facts: [
      'A "plug dome" — the hardened lava neck of an ancient volcano',
      'Class 5.4 rock climb to the spire — no walk-up route',
      'The outer cone was entirely stripped by Ice Age glaciers',
      'Visible from the I-5 corridor on clear days',
    ],
    localKnowledge:
      'The sharp spike north of the Sisters. Looks like a single sharp tooth.',
    // Mt. Washington — narrow volcanic plug spire; Google's photogrammetry
    // smooths thin verticals, so go WIDE for landscape context instead of
    // trying to frame the spire tight. Higher+further orbit reads the
    // distinctive silhouette against the wilderness shoulder.
    camera: {
      orbitRadiusM: 11200,
      cameraHeightM: 4100,
      startAzimuthDeg: 140,
      sweepDeg: 76,
    },
  },
  {
    id: 'three_fingered_jack',
    name: 'Three Fingered Jack',
    shortName: '3F Jack',
    lat: 44.4792,
    lon: -121.8441,
    elevationFt: 7841,
    distanceMi: 63.8,
    bearing: 'NNW',
    order: 8,
    lastEruption: '~100,000 years ago',
    origin:
      'Named for an outlaw named "Three Fingered Jack" who prospected in the area in the 1860s. He was missing two fingers. The mountain has three fingers. The math works.',
    distinguishingFeature:
      'Three jagged spires on the summit ridge — like fingers pointing up at the sky',
    hook:
      'It used to be a 12,000 ft volcano. Ice Age glaciers shredded it down to three spikes.',
    facts: [
      'Originally a full stratovolcano — now just the erosional remnants',
      'Class 4-5 rock climbing to the true summit',
      'The three spires are visible from Hwy 20 west of Sisters',
      'Loose rock — reportedly one of the scariest summits in Oregon',
    ],
    localKnowledge:
      'If you see three jagged points in a row, it\'s Three Fingered Jack. Once you spot it you can never un-see it.',
    // Three Fingered Jack — three jagged spires on a N-S ridge. Narrow
    // verticals → Google's photogrammetry smooths them when close (same
    // pattern we hit on Washington and N. Sister), but orientation matters
    // more here: from south the three fingers stack END-ON (just looks like
    // one bump). Must view the ridge from the SIDE (W or E) to get the
    // iconic three-in-a-row silhouette. Start due WEST, sweep 60° across the
    // SW face — shows all three pinnacles separated against sky.
    camera: {
      orbitRadiusM: 11500,
      cameraHeightM: 4000,
      startAzimuthDeg: 260,
      sweepDeg: 60,
    },
  },
  {
    id: 'black_butte',
    name: 'Black Butte',
    shortName: 'Black Butte',
    lat: 44.3975,
    lon: -121.638,
    elevationFt: 6436,
    distanceMi: 38.7,
    bearing: 'NNW',
    order: 9,
    lastEruption: '~1.4 million years ago',
    origin:
      'Named for the dark volcanic rock covering its flanks. On maps as early as the 1860s — one of the most recognizable landmarks on the Bend-to-Sisters drive.',
    distinguishingFeature:
      'Perfectly symmetrical cone standing alone east of the Cascade crest — looks like a giant anthill',
    hook:
      'It\'s basically a textbook volcano that nobody in Bend can name.',
    facts: [
      'Stood-alone cone — a parasitic vent of Green Ridge',
      'Active CCC fire lookout tower on the summit',
      'Lower slopes owned by The Nature Conservancy',
      'One of the most photographed peaks along Hwy 20',
    ],
    localKnowledge:
      'The dark cone standing alone on the drive to Sisters — the one everyone sees, few can name.',
    // Black Butte — classic standalone cone. Google's tile coverage out here
    // is softer than the volcanic crest, and the tileset misbehaves when the
    // camera is too level (horizontal angles trigger streaming weirdness).
    // Settled on 3.2 km / 600 m — enough down-pitch (~11°) for the viewOffset
    // math to work and tiles to stream cleanly, wide enough to show the
    // cone's standalone profile. Start SSE (Hwy 20 driver's angle), sweep
    // clockwise 100°.
    camera: {
      orbitRadiusM: 11000,
      cameraHeightM: 3800,
      startAzimuthDeg: 150,
      sweepDeg: 85,
    },
  },
  {
    id: 'jefferson',
    name: 'Mt. Jefferson',
    shortName: 'Jefferson',
    lat: 44.6738,
    lon: -121.7997,
    elevationFt: 10497,
    distanceMi: 82.1,
    bearing: 'NNW',
    order: 10,
    lastEruption: '~1,000 years ago (approx.)',
    origin:
      'Named by Lewis & Clark in 1806 for President Thomas Jefferson, who sent them west. Second-highest peak in Oregon.',
    distinguishingFeature:
      'Sharp pyramidal summit — Oregon\'s most heavily glaciated mountain',
    hook:
      'Oregon\'s 2nd tallest peak. Five glaciers. And almost nobody has stood on top.',
    facts: [
      'Oregon\'s 2nd highest peak — 10,497 ft',
      '5 named glaciers — most of any Oregon volcano',
      'Class 4 summit — only ~200 successful ascents per year',
      'Visible on clear days from Portland to Bend',
    ],
    localKnowledge:
      'The pyramid-shaped peak far to the north. If you can see it from Bend, it\'s an exceptionally clear day.',
    // Mt. Jefferson — Oregon's 2nd tallest, sharpest pyramidal summit, 5 named
    // glaciers. Higher elevated orbit so the glaciated upper pyramid fills
    // frame. Start SE, sweep to show the Jefferson Park glaciers on the N face.
    camera: {
      orbitRadiusM: 10500,
      cameraHeightM: 3800,
      startAzimuthDeg: 130,
      sweepDeg: 125,
    },
  },
];

// Sanity check at import time — fail fast if the data pack gets out of sync.
if (PEAKS.length !== 10) {
  throw new Error(
    `cascade_peaks: expected 10 locked peaks, got ${PEAKS.length}`,
  );
}

// ---------------------------------------------------------------------------
// Aubrey Butte vantage for the intro panoramic — per Matt's spec the camera
// stands on Aubrey and pans south-to-north across the skyline.
// ---------------------------------------------------------------------------

export const AUBREY_BUTTE = {
  /** Approximate summit coords per Matt's spec. */
  lat: 44.0631,
  lon: -121.3283,
  /** Extra meters above Aubrey summit — higher = more aerial, less “flat” horizon. */
  cameraHeightM: 520,
};
