import { communityPath } from '@/lib/communities/community-public-pair'
import type { BuyerAnswerDef, BuyerAnswerKind, BuyerAnswerPlaceKind } from './types'

function communityLiving(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `comm-${slug}-living`,
    query: `is ${name} a good place to live`,
    kind: 'living',
    path: `${communityPath(slug)}/living`,
    title: `${name} housing market`,
    h1: `Is ${name} a good place to live?`,
    slug,
    placeKind: 'community',
  }
}

function communityCost(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `comm-${slug}-cost`,
    query: `cost to live in ${name}`,
    kind: 'cost',
    path: `${communityPath(slug)}/cost`,
    title: `Cost to live in ${name}`,
    h1: `What does it cost to live in ${name}?`,
    slug,
    placeKind: 'community',
  }
}

function cityLiving(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `city-${slug}-living`,
    query: `is ${name} Oregon a good place to live`,
    kind: 'living',
    path: `/cities/${slug}/living`,
    title: `${name} housing market`,
    h1: `Is ${name} a good place to live?`,
    slug,
    placeKind: 'city',
    citySlug: slug,
  }
}

function cityCost(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `city-${slug}-cost`,
    query: `cost to live in ${name} Oregon`,
    kind: 'cost',
    path: `/cities/${slug}/cost`,
    title: `Cost to live in ${name}`,
    h1: `What does it cost to live in ${name}?`,
    slug,
    placeKind: 'city',
    citySlug: slug,
  }
}

function communityHoa(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `comm-${slug}-hoa`,
    query: `${name} HOA fees`,
    kind: 'hoa',
    path: `${communityPath(slug)}/hoa`,
    title: `${name} HOA fees`,
    h1: `What are ${name} HOA fees?`,
    slug,
    placeKind: 'community',
  }
}

function communityStr(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `comm-${slug}-str`,
    query: `${name} short-term rental rules`,
    kind: 'str',
    path: `${communityPath(slug)}/short-term-rentals`,
    title: `${name} short-term rental rules`,
    h1: `${name} short-term rental rules`,
    slug,
    placeKind: 'community',
  }
}

function communityVs(
  slug: string,
  name: string,
  otherSlug: string,
  otherName: string,
): BuyerAnswerDef {
  return {
    id: `vs-${slug}-${otherSlug}`,
    query: `${name} vs ${otherName}`,
    kind: 'vs',
    path: `${communityPath(slug)}/vs/${otherSlug}`,
    title: `${name} vs ${otherName}`,
    h1: `${name} vs ${otherName}`,
    slug,
    otherSlug,
    placeKind: 'community',
    otherPlaceKind: 'community',
  }
}

function cityVs(slug: string, name: string, otherSlug: string, otherName: string): BuyerAnswerDef {
  return {
    id: `vs-${slug}-${otherSlug}`,
    query: `${name} vs ${otherName} Oregon`,
    kind: 'vs',
    path: `/cities/${slug}/vs/${otherSlug}`,
    title: `${name} vs ${otherName}`,
    h1: `${name} vs ${otherName}`,
    slug,
    otherSlug,
    placeKind: 'city',
    otherPlaceKind: 'city',
    citySlug: slug,
  }
}

function neighborhoodLiving(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `hood-${slug}-living`,
    query: `is ${name} Bend a good place to live`,
    kind: 'living',
    path: `/cities/bend/${slug}/living`,
    title: `${name} housing market`,
    h1: `Is ${name} a good place to live?`,
    slug,
    placeKind: 'neighborhood',
    citySlug: 'bend',
  }
}

function neighborhoodCost(slug: string, name: string): BuyerAnswerDef {
  return {
    id: `hood-${slug}-cost`,
    query: `cost to live in ${name} Bend`,
    kind: 'cost',
    path: `/cities/bend/${slug}/cost`,
    title: `Cost to live in ${name}`,
    h1: `What does it cost to live in ${name}?`,
    slug,
    placeKind: 'neighborhood',
    citySlug: 'bend',
  }
}

function preset(
  citySlug: string,
  cityName: string,
  presetSlug: string,
  query: string,
  title: string,
  h1: string,
): BuyerAnswerDef {
  return {
    id: `preset-${citySlug}-${presetSlug}`,
    query,
    kind: 'preset',
    path: `/homes-for-sale/${citySlug}/${presetSlug}`,
    title,
    h1,
    slug: citySlug,
    placeKind: 'city',
    citySlug,
    presetSlug,
  }
}

function regionPreset(
  presetSlug: string,
  query: string,
  title: string,
  h1: string,
): BuyerAnswerDef {
  return {
    id: `preset-central-oregon-${presetSlug}`,
    query,
    kind: 'preset',
    path: `/homes-for-sale/${presetSlug}`,
    title,
    h1,
    slug: 'central-oregon',
    placeKind: 'city',
    citySlug: 'central-oregon',
    presetSlug,
  }
}

/**
 * Long-tail buyer queries. Child routes are living/cost/hoa/str/vs plus
 * from-out-of-state, second-home, and buying. Price-band and acreage queries
 * enhance existing search-preset routes. HOA and STR only where the repo
 * already holds a sourced figure. Batch 2 adds communities and Bend districts
 * with >=3 active SFR (or meaningful sold pace); Crosswater, Vandevert Ranch,
 * Shevlin Commons, and Discovery West stay off the registry (thin or no hub).
 */
export const BUYER_ANSWER_DEFS: readonly BuyerAnswerDef[] = Object.freeze([
  communityLiving('tetherow', 'Tetherow'),
  communityLiving('sunriver', 'Sunriver'),
  communityLiving('caldera-springs', 'Caldera Springs'),
  communityLiving('northwest-crossing', 'Northwest Crossing'),
  communityLiving('awbrey-glen', 'Awbrey Glen'),
  communityLiving('eagle-crest', 'Eagle Crest'),
  communityLiving('black-butte-ranch', 'Black Butte Ranch'),
  communityLiving('juniper-preserve', 'Juniper Preserve'),
  communityLiving('broken-top', 'Broken Top'),
  communityLiving('brasada-ranch', 'Brasada Ranch'),
  communityLiving('three-rivers', 'Three Rivers'),
  communityCost('tetherow', 'Tetherow'),
  communityCost('sunriver', 'Sunriver'),
  communityCost('northwest-crossing', 'Northwest Crossing'),
  communityCost('caldera-springs', 'Caldera Springs'),
  communityCost('broken-top', 'Broken Top'),
  communityCost('brasada-ranch', 'Brasada Ranch'),
  communityCost('three-rivers', 'Three Rivers'),
  communityCost('juniper-preserve', 'Juniper Preserve'),
  communityCost('eagle-crest', 'Eagle Crest'),
  communityCost('black-butte-ranch', 'Black Butte Ranch'),
  cityCost('bend', 'Bend'),
  cityCost('redmond', 'Redmond'),
  cityLiving('bend', 'Bend'),
  cityLiving('redmond', 'Redmond'),
  cityLiving('sisters', 'Sisters'),
  neighborhoodLiving('old-bend', 'Old Bend'),
  neighborhoodLiving('southeast-bend', 'Southeast Bend'),
  neighborhoodLiving('century-west', 'Century West'),
  neighborhoodLiving('southwest-bend', 'Southwest Bend'),
  neighborhoodLiving('summit-west', 'Summit West'),
  neighborhoodLiving('old-farm-district', 'Old Farm District'),
  neighborhoodCost('old-bend', 'Old Bend'),
  neighborhoodCost('southeast-bend', 'Southeast Bend'),
  neighborhoodCost('century-west', 'Century West'),
  neighborhoodCost('southwest-bend', 'Southwest Bend'),
  neighborhoodCost('summit-west', 'Summit West'),
  neighborhoodCost('old-farm-district', 'Old Farm District'),
  communityHoa('tetherow', 'Tetherow'),
  communityHoa('sunriver', 'Sunriver'),
  communityHoa('caldera-springs', 'Caldera Springs'),
  communityStr('tetherow', 'Tetherow'),
  communityStr('juniper-preserve', 'Juniper Preserve'),
  communityVs('tetherow', 'Tetherow', 'caldera-springs', 'Caldera Springs'),
  communityVs('sunriver', 'Sunriver', 'tetherow', 'Tetherow'),
  communityVs('northwest-crossing', 'Northwest Crossing', 'awbrey-glen', 'Awbrey Glen'),
  communityVs('eagle-crest', 'Eagle Crest', 'juniper-preserve', 'Juniper Preserve'),
  cityVs('bend', 'Bend', 'redmond', 'Redmond'),
  cityVs('bend', 'Bend', 'sisters', 'Sisters'),
  {
    id: 'city-bend-from-out-of-state',
    query: 'buying a house in Bend from out of state',
    kind: 'from-out-of-state',
    path: '/cities/bend/from-out-of-state',
    title: 'Buying a house in Bend from out of state',
    h1: 'Buying a house in Bend from out of state',
    slug: 'bend',
    placeKind: 'city',
    citySlug: 'bend',
  },
  {
    id: 'comm-sunriver-second-home',
    query: 'buying a second home in Sunriver',
    kind: 'second-home',
    path: `${communityPath('sunriver')}/second-home`,
    title: 'Buying a second home in Sunriver',
    h1: 'Buying a second home in Sunriver',
    slug: 'sunriver',
    placeKind: 'community',
  },
  {
    id: 'city-redmond-buying',
    query: 'buying a home in Redmond',
    kind: 'buying',
    path: '/cities/redmond/buying',
    title: 'Buying a home in Redmond',
    h1: 'Buying a home in Redmond',
    slug: 'redmond',
    placeKind: 'city',
    citySlug: 'redmond',
  },
  preset('bend', 'Bend', 'under-400k', 'Bend homes under $400000', 'Bend homes under $400,000', 'Bend homes under $400,000'),
  preset('bend', 'Bend', 'under-500k', 'Bend homes under $500000', 'Bend homes under $500,000', 'Bend homes under $500,000'),
  preset('bend', 'Bend', 'under-600k', 'Bend homes under $600000', 'Bend homes under $600,000', 'Bend homes under $600,000'),
  preset('bend', 'Bend', 'under-750k', 'Bend homes under $750000', 'Bend homes under $750,000', 'Bend homes under $750,000'),
  preset('redmond', 'Redmond', 'under-500k', 'Redmond homes under $500000', 'Redmond homes under $500,000', 'Redmond homes under $500,000'),
  preset('bend', 'Bend', 'acreage', 'homes with acreage Bend', 'Bend homes with acreage', 'Bend homes with acreage'),
  preset('bend', 'Bend', 'over-1-5m', 'luxury homes for sale in Bend', 'Bend luxury homes for sale', 'Bend homes over $1,500,000'),
  preset('bend', 'Bend', 'new-construction', 'new construction Bend', 'New construction homes in Bend', 'New construction homes in Bend'),
  regionPreset(
    'acreage',
    'acreage for sale Central Oregon',
    'Central Oregon acreage for sale',
    'Homes on an acre or more in Central Oregon',
  ),
  regionPreset(
    'under-500k',
    'homes under 500k Central Oregon',
    'Central Oregon homes under $500,000',
    'Homes under $500,000 in Central Oregon',
  ),
  {
    id: 'page-new-construction',
    query: 'new construction Bend Oregon',
    kind: 'new-construction',
    path: '/new-construction',
    title: 'New construction in Bend',
    h1: 'New construction homes in Bend',
    slug: 'bend',
    placeKind: 'city',
    citySlug: 'bend',
  },
])

const BY_PATH = new Map(BUYER_ANSWER_DEFS.map((def) => [def.path, def]))
const BY_ID = new Map(BUYER_ANSWER_DEFS.map((def) => [def.id, def]))

export function buyerAnswerByPath(path: string): BuyerAnswerDef | null {
  return BY_PATH.get(path) ?? null
}

export function buyerAnswerById(id: string): BuyerAnswerDef | null {
  return BY_ID.get(id) ?? null
}

export function buyerAnswersOfKind(kind: BuyerAnswerKind): BuyerAnswerDef[] {
  return BUYER_ANSWER_DEFS.filter((def) => def.kind === kind)
}

export function buyerAnswerChildDefs(): BuyerAnswerDef[] {
  return BUYER_ANSWER_DEFS.filter((def) => def.kind !== 'preset' && def.kind !== 'new-construction')
}

export function buyerAnswerSitemapPaths(): string[] {
  return buyerAnswerChildDefs().map((def) => def.path)
}

export function communityBuyerAnswerParams(
  kind: Exclude<BuyerAnswerKind, 'vs' | 'preset' | 'new-construction'>,
  placeKind: BuyerAnswerPlaceKind,
): Array<{ slug: string }> {
  return BUYER_ANSWER_DEFS.filter(
    (def) => def.kind === kind && def.placeKind === placeKind && !def.otherSlug,
  ).map((def) => ({ slug: def.slug }))
}

export function neighborhoodBuyerAnswerParams(
  kind: 'living' | 'cost',
): Array<{ slug: string; neighborhoodSlug: string }> {
  return BUYER_ANSWER_DEFS.filter(
    (def) => def.kind === kind && def.placeKind === 'neighborhood',
  ).map((def) => ({ slug: def.citySlug ?? 'bend', neighborhoodSlug: def.slug }))
}

export function vsBuyerAnswerParams(placeKind: BuyerAnswerPlaceKind): Array<{ slug: string; other: string }> {
  return BUYER_ANSWER_DEFS.filter((def) => def.kind === 'vs' && def.placeKind === placeKind && def.otherSlug).map(
    (def) => ({ slug: def.slug, other: def.otherSlug as string }),
  )
}

export function isBuyerAnswerPreset(citySlug: string, presetSlug: string): boolean {
  return BUYER_ANSWER_DEFS.some(
    (def) => def.kind === 'preset' && def.citySlug === citySlug && def.presetSlug === presetSlug,
  )
}
