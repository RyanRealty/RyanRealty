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

/**
 * 36 long-tail buyer queries. New child routes are living/cost/hoa/str/vs.
 * Price-band, acreage, and new-construction queries enhance existing routes.
 * HOA and STR only where the repo already holds a sourced figure.
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
  communityCost('tetherow', 'Tetherow'),
  communityCost('sunriver', 'Sunriver'),
  communityCost('northwest-crossing', 'Northwest Crossing'),
  communityCost('caldera-springs', 'Caldera Springs'),
  cityCost('bend', 'Bend'),
  cityCost('redmond', 'Redmond'),
  cityLiving('bend', 'Bend'),
  cityLiving('redmond', 'Redmond'),
  cityLiving('sisters', 'Sisters'),
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
  preset('bend', 'Bend', 'under-400k', 'Bend homes under $400000', 'Bend homes under $400,000', 'Bend homes under $400,000'),
  preset('bend', 'Bend', 'under-500k', 'Bend homes under $500000', 'Bend homes under $500,000', 'Bend homes under $500,000'),
  preset('bend', 'Bend', 'under-600k', 'Bend homes under $600000', 'Bend homes under $600,000', 'Bend homes under $600,000'),
  preset('bend', 'Bend', 'under-750k', 'Bend homes under $750000', 'Bend homes under $750,000', 'Bend homes under $750,000'),
  preset('redmond', 'Redmond', 'under-500k', 'Redmond homes under $500000', 'Redmond homes under $500,000', 'Redmond homes under $500,000'),
  preset('bend', 'Bend', 'acreage', 'homes with acreage Bend', 'Bend homes with acreage', 'Bend homes with acreage'),
  preset('bend', 'Bend', 'new-construction', 'new construction Bend', 'New construction homes in Bend', 'New construction homes in Bend'),
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
