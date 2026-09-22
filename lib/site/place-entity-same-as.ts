/**
 * Verified sameAs URLs for Place / City JSON-LD.
 *
 * Answer engines (Google, ChatGPT, Perplexity) will not treat our Place node as
 * the Bend/Tetherow entity unless it links out to Wikipedia, Wikidata, or the
 * official site. Organization sameAs is already on the root layout; Place nodes
 * on /cities/* and /communities/* shipped without it (live audit 2026-09-22).
 *
 * Wikidata Q-ids resolved 2026-09-22 via wbgetentities on enwiki titles.
 * Official community origins come from lib/community-seo-content.ts sources
 * (the same pages the About prose already cites). Do not add a URL that is
 * not Wikipedia, Wikidata, a city .gov, or that sourced official origin.
 */

export type PlaceEntitySameAs = {
  /** Canonical site path, no trailing slash. */
  readonly path: `/${string}`
  readonly sameAs: readonly string[]
}

export const PLACE_ENTITY_SAME_AS: readonly PlaceEntitySameAs[] = [
  {
    path: '/cities/bend',
    sameAs: [
      'https://en.wikipedia.org/wiki/Bend,_Oregon',
      'https://www.wikidata.org/wiki/Q671288',
      'https://www.bendoregon.gov',
    ],
  },
  {
    path: '/cities/redmond',
    sameAs: [
      'https://en.wikipedia.org/wiki/Redmond,_Oregon',
      'https://www.wikidata.org/wiki/Q1650600',
      'https://www.redmondoregon.gov',
    ],
  },
  {
    path: '/cities/sisters',
    sameAs: [
      'https://en.wikipedia.org/wiki/Sisters,_Oregon',
      'https://www.wikidata.org/wiki/Q532964',
    ],
  },
  {
    path: '/cities/sunriver',
    sameAs: [
      'https://en.wikipedia.org/wiki/Sunriver,_Oregon',
      'https://www.wikidata.org/wiki/Q3459533',
    ],
  },
  {
    path: '/cities/la-pine',
    sameAs: [
      'https://en.wikipedia.org/wiki/La_Pine,_Oregon',
      'https://www.wikidata.org/wiki/Q1003838',
      'https://www.lapineoregon.gov',
    ],
  },
  {
    path: '/cities/prineville',
    sameAs: [
      'https://en.wikipedia.org/wiki/Prineville,_Oregon',
      'https://www.wikidata.org/wiki/Q330678',
    ],
  },
  {
    path: '/cities/madras',
    sameAs: [
      'https://en.wikipedia.org/wiki/Madras,_Oregon',
      'https://www.wikidata.org/wiki/Q334041',
    ],
  },
  {
    path: '/cities/terrebonne',
    sameAs: [
      'https://en.wikipedia.org/wiki/Terrebonne,_Oregon',
      'https://www.wikidata.org/wiki/Q2545081',
    ],
  },
  {
    path: '/cities/powell-butte',
    sameAs: [
      'https://en.wikipedia.org/wiki/Powell_Butte,_Oregon',
      'https://www.wikidata.org/wiki/Q7236060',
    ],
  },
  {
    path: '/cities/culver',
    sameAs: [
      'https://en.wikipedia.org/wiki/Culver,_Oregon',
      'https://www.wikidata.org/wiki/Q3458905',
    ],
  },
  {
    path: '/communities/tetherow',
    sameAs: ['https://tetherow.com'],
  },
  {
    path: '/communities/broken-top',
    sameAs: ['https://www.brokentop.com'],
  },
  {
    path: '/communities/black-butte-ranch',
    sameAs: [
      'https://en.wikipedia.org/wiki/Black_Butte_Ranch,_Oregon',
      'https://www.wikidata.org/wiki/Q4920461',
      'https://www.blackbutteranch.com',
    ],
  },
  {
    path: '/communities/brasada-ranch',
    sameAs: ['https://www.brasada.com'],
  },
  {
    path: '/communities/eagle-crest',
    sameAs: [
      'https://en.wikipedia.org/wiki/Eagle_Crest_Resort',
      'https://www.wikidata.org/wiki/Q5325065',
      'https://www.eagle-crest.com',
    ],
  },
  {
    path: '/communities/caldera-springs',
    sameAs: ['https://calderasprings.com'],
  },
  {
    path: '/communities/awbrey-glen',
    sameAs: ['https://www.awbreyglen.com'],
  },
  {
    path: '/communities/northwest-crossing',
    sameAs: ['https://www.northwestcrossing.com'],
  },
  {
    path: '/communities/sunriver',
    sameAs: [
      'https://en.wikipedia.org/wiki/Sunriver,_Oregon',
      'https://www.wikidata.org/wiki/Q3459533',
      'https://en.wikipedia.org/wiki/Sunriver_Resort',
      'https://www.wikidata.org/wiki/Q7641161',
    ],
  },
  {
    path: '/communities/crosswater',
    sameAs: [
      'https://en.wikipedia.org/wiki/Crosswater_Club',
      'https://www.wikidata.org/wiki/Q5188884',
    ],
  },
  {
    path: '/communities/widgi-creek',
    sameAs: ['https://www.widgi.com'],
  },
  {
    path: '/communities/three-rivers',
    sameAs: [
      'https://en.wikipedia.org/wiki/Three_Rivers_South,_Oregon',
      'https://www.wikidata.org/wiki/Q2360817',
    ],
  },
]

const BY_PATH = new Map(PLACE_ENTITY_SAME_AS.map((row) => [row.path, row.sameAs]))

/** Strip origin + trailing slash so `/cities/bend` and the absolute URL match. */
export function canonicalPlacePath(url: string | undefined): string | null {
  if (!url) return null
  let path = url.trim()
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      path = new URL(path).pathname
    }
  } catch {
    return null
  }
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path.toLowerCase()
}

export function placeEntitySameAs(url: string | undefined): readonly string[] {
  const path = canonicalPlacePath(url)
  if (!path) return []
  return BY_PATH.get(path) ?? []
}

export function mergePlaceSameAs(
  url: string | undefined,
  extra?: ReadonlyArray<string>,
): string[] | undefined {
  const seen = new Set<string>()
  const out: string[] = []
  for (const href of [...placeEntitySameAs(url), ...(extra ?? [])]) {
    const key = href.replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(href)
  }
  return out.length > 0 ? out : undefined
}
