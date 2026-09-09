/**
 * Rural homes are read as property (Matt 2026-09-08/09, Delta 4): outside a
 * boundary the comparison is of the parcel, and four things are HARD splits,
 * never dollar adjustments — irrigation (lib/pricing/classes.ts), the zoning
 * class, the outbuildings, and whether the land is usable. Every classifier
 * here fails OPEN on missing text: an unknown side never excludes a sale.
 *
 * Measured 2026-09-09 on 1,000 rural closes: the MLS zoning field is the
 * sentinel "********" on 75% of rows, so a sale's zone comes from the county
 * GIS (lib/pricing/sale-zoning.ts) when the MLS has none; remarks name an
 * outbuilding on 64% and terrain on 3%.
 */

export type ZoningClass = 'farm_forest' | 'rural_res' | 'urban' | 'unknown'

const FARM_FOREST_RE = /\b(EFU\w*|EF|F1|F2|FC|WR|SM|FP|OS&C|OSC)\b|EXCLUSIVE FARM|FOREST|WOODLOT/i
const RURAL_RES_RE = /\b(RR-?\s?\d+(?:\.\d)?\w*|RR|MUA-?\d*|MAU-?\d*|UAR-?\d*|SR-?\d*|SRM\d*|RRM\d*|CRRR|BBRR|AR|R\s?[25])\b|RURAL RES|RECREATIONAL RESIDE|SUBURBAN RESIDENTIA/i
const URBAN_RE = /\b(RS|RM|RH|RL|CG|CL|CC|CN|IL|IG|IP|UH|UM|UR-?\d|R-?\d|RSC|SR2\.5)\b/i
const SENTINEL_RE = /^[\s*\-_.?]*$|^(n\/?a|none|unknown|see remarks|tbd)$/i

/** The class a zone string belongs to. County RR5 / MLS "RR5; RURAL RES 5 AC" read the same. */
export function zoningClass(zone: string | null | undefined): ZoningClass {
  const z = (zone ?? '').trim()
  if (!z || SENTINEL_RE.test(z)) return 'unknown'
  if (FARM_FOREST_RE.test(z)) return 'farm_forest'
  if (RURAL_RES_RE.test(z)) return 'rural_res'
  if (URBAN_RE.test(z)) return 'urban'
  return 'unknown'
}

/** A farm/forest parcel never prices a rural-residential one, or the reverse. */
export function zoningClassCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = zoningClass(a)
  const cb = zoningClass(b)
  if (ca === 'unknown' || cb === 'unknown') return true
  return ca === cb
}

export type OutbuildingsClass = 'infrastructure' | 'none' | 'unknown'

const OUTBUILDING_RE =
  /\b(shop|workshop|barns?|stables?|arena|outbuildings?|pole[\s-]+barn|detached[\s-]+(?:garage|shop)|rv[\s-]+(?:garage|barn)|hangar|equipment[\s-]+(?:shed|building)|loafing[\s-]+shed)\b/i

/** What the remarks say stands on the land besides the house. */
export function outbuildingsClass(remarks: string | null | undefined): OutbuildingsClass {
  const t = (remarks ?? '').trim()
  if (!t) return 'unknown'
  return OUTBUILDING_RE.test(t) ? 'infrastructure' : 'none'
}

/** A shop-and-barn property and a bare house on land are different products, both ways. */
export function outbuildingsCompatible(subjectRemarks: string | null | undefined, saleRemarks: string | null | undefined): boolean {
  const a = outbuildingsClass(subjectRemarks)
  const b = outbuildingsClass(saleRemarks)
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

export type TerrainClass = 'usable' | 'unusable' | 'unknown'

const UNUSABLE_RE =
  /\b(lava(?:\s+rock)?|rock[\s-]+outcrops?|rocky\s+terrain|steep|unusable|not\s+usable|un-?buildable|wetlands?|flood\s?plain|canyon\s+rim)\b/i
const USABLE_RE = /\b(level|flat|usable\s+(?:acre|land|acreage|ground)|pasture|meadow|fully\s+fenced\s+and\s+cross[\s-]+fenced|tillable|productive)\b/i

/** What the remarks say about the land itself. Terrain from county GIS is a later source. */
export function terrainClass(remarks: string | null | undefined): TerrainClass {
  const t = (remarks ?? '').trim()
  if (!t) return 'unknown'
  const unusable = UNUSABLE_RE.test(t)
  const usable = USABLE_RE.test(t)
  if (unusable && !usable) return 'unusable'
  if (usable && !unusable) return 'usable'
  return 'unknown'
}

/** A house on lava rock and a house on level pasture are not peers. Unknown sides keep. */
export function terrainCompatible(subjectRemarks: string | null | undefined, saleRemarks: string | null | undefined): boolean {
  const a = terrainClass(subjectRemarks)
  const b = terrainClass(saleRemarks)
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

/** The one-line reason a rural split gives the trace. */
export const RURAL_SPLIT_REASON = {
  zoning_class: 'a different zoning class (farm or forest land against rural residential)',
  outbuildings: 'different outbuildings (a shop, barn, or arena on one side and none on the other)',
  terrain: 'different land (usable ground on one side, rock, slope, or wetland on the other)',
} as const

export type RuralSplitCounts = {
  zoning_class: number
  outbuildings: number
  terrain: number
  acreage_infrastructure: number
}

const ZONE_CLASS_LABEL: Record<ZoningClass, string | null> = {
  farm_forest: 'farm or forest land',
  rural_res: 'rural residential land',
  urban: 'city land',
  unknown: null,
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The story of the splits, for the reader (Matt 2026-09-08: "the story names
 * which set the price"). Counts are sales the search set aside for each rule;
 * nothing is said about a rule that set nothing aside. Null when there is
 * nothing to say.
 */
export function ruralSplitsSentence(input: {
  subjectZone: string | null | undefined
  counts: Partial<RuralSplitCounts> | null | undefined
}): string | null {
  const c = input.counts ?? {}
  const zoning = c.zoning_class ?? 0
  const out = c.outbuildings ?? 0
  const terrain = c.terrain ?? 0
  const infra = c.acreage_infrastructure ?? 0
  if (zoning + out + terrain + infra === 0) return null
  const cls = zoningClass(input.subjectZone)
  const zone = (input.subjectZone ?? '').trim()
  const parts: string[] = []
  if (zoning > 0) {
    const other = cls === 'farm_forest' ? 'rural residential land' : cls === 'rural_res' ? 'farm or forest land' : 'land in a different zoning class'
    parts.push(`${plural(zoning, 'sale', 'sales')} on ${other}`)
  }
  if (infra > 0) parts.push(`${plural(infra, 'sale', 'sales')} with a different irrigation or horse setup`)
  if (out > 0) parts.push(`${plural(out, 'sale', 'sales')} with different outbuildings`)
  if (terrain > 0) parts.push(`${plural(terrain, 'sale', 'sales')} on different ground`)
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
  const opening =
    cls !== 'unknown' && ZONE_CLASS_LABEL[cls]
      ? `This home sits on ${ZONE_CLASS_LABEL[cls]}${zone ? ` (zoned ${zone})` : ''}, and the search read the land as part of the home.`
      : 'On acreage the search reads the land as part of the home.'
  return `${opening} Before any price was taken, ${list} ${parts.length === 1 && !/sales/.test(parts[0]) ? 'was' : 'were'} set aside.`
}
