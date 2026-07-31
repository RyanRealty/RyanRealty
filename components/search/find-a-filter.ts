/**
 * find-a-filter — pure matching + ranking for the pinned filter search in the
 * All-filters sheet (plan §7.1 rule 1).
 *
 * Matches FIELD LABELS and VALUES, client-side, over the field registry plus
 * the class-prevalence census (zoning codes included). Normalization squashes
 * case, punctuation, and spacing so 'MUA-10', 'mua 10' and 'mua10' collide.
 * Hits are ranked by match tier (exact, prefix, substring), then live count
 * descending, so the answer surfaces instead of the alphabet. Zero-count
 * hits are dropped — a suggestion that returns nothing is a dead end.
 *
 * Pure module: no React, no fetch. The sheet owns applying a hit.
 */

import { SEARCH_FIELDS, type SearchFieldDef } from '@/lib/search/field-registry'
import {
  assessValue,
  type ClassPrevalenceArtifact,
  type PropertyClass,
} from '@/lib/search/class-prevalence'
import {
  allZoningDefinitions,
  allZoningJurisdictions,
  normalizeZoningToken,
  type ZoningDefinition,
} from '@/lib/zoning/resolve'

// ---------------------------------------------------------------------------
// Zoning definitions (plan §6.3): a zoning hit carries its plain-English
// meaning when a definition exists. Keyed jurisdiction:code, so the same code
// in two jurisdictions NEVER auto-picks — the hit says how many jurisdictions
// define it and lists their names; the plain-English line renders only when
// the meaning is unambiguous (exactly one jurisdiction, or all agree).
// ---------------------------------------------------------------------------

export interface ZoningHitDefinition {
  /** Plain-English meaning — set only when a single jurisdiction defines it. */
  plainEnglish: string | null
  /** Jurisdiction display names that define this code. */
  jurisdictions: string[]
  /** 'verified' only when every contributing entry is chapter-verified. */
  status: 'verified' | 'unverified'
}

/** Definitions grouped by normalized code, built once per index build. */
export function zoningDefinitionsByCode(): Map<string, ZoningDefinition[]> {
  const byCode = new Map<string, ZoningDefinition[]>()
  for (const def of Object.values(allZoningDefinitions())) {
    const key = normalizeZoningToken(def.code)
    const list = byCode.get(key)
    if (list) list.push(def)
    else byCode.set(key, [def])
  }
  return byCode
}

function zoningHitDefinition(
  byCode: Map<string, ZoningDefinition[]>,
  code: string,
): ZoningHitDefinition | undefined {
  const defs = byCode.get(normalizeZoningToken(code))
  if (!defs || defs.length === 0) return undefined
  return {
    plainEnglish: defs.length === 1 ? defs[0]!.plainEnglish : null,
    jurisdictions: defs.map(
      (d) => allZoningJurisdictions()[d.jurisdiction]?.name ?? d.jurisdiction,
    ),
    status: defs.every((d) => d.status === 'verified') ? 'verified' : 'unverified',
  }
}

/** DOM id for a field's row in the sheet — the target of 'field' jump hits. */
export function fieldAnchorId(fieldKey: string): string {
  return `all-filters-field-${fieldKey}`
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Lowercase and strip everything but letters and digits: 'MUA-10' -> 'mua10'. */
export function normalizeFindQuery(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export type FindFilterHitKind = 'multi-value' | 'boolean' | 'zoning' | 'field'

export interface FindIndexEntry {
  kind: FindFilterHitKind
  fieldKey: string
  fieldLabel: string
  /** The exact URL value this entry applies (multi option, zoning code, '1'). */
  value: string
  /** Display label for the value ('Duplex', 'MUA10', field label for booleans). */
  valueLabel: string
  /** Normalized haystacks: the value/label plus registry voice synonyms. */
  haystacks: readonly string[]
  /** Normalized field label, matched at a lower tier. */
  fieldHaystack: string
}

function voiceAlternates(def: SearchFieldDef, option?: string): string[] {
  if (option) {
    const phrases = def.voiceValues?.[option]
    return phrases ? phrases.map(normalizeFindQuery) : []
  }
  return (def.voice ?? []).filter((p) => !p.includes(' n')).map(normalizeFindQuery)
}

/**
 * Build the searchable index from the registry plus (when loaded) the census
 * artifact's zoning vocabulary. Cheap enough to rebuild per sheet open, and
 * pure so tests can pin it.
 */
export function buildFindIndex(artifact: ClassPrevalenceArtifact | null): FindIndexEntry[] {
  const entries: FindIndexEntry[] = []
  for (const def of SEARCH_FIELDS) {
    const fieldHaystack = normalizeFindQuery(def.label)
    if (def.kind === 'multi') {
      for (const option of def.options ?? []) {
        entries.push({
          kind: 'multi-value',
          fieldKey: def.key,
          fieldLabel: def.label,
          value: option,
          valueLabel: option,
          haystacks: [normalizeFindQuery(option), ...voiceAlternates(def, option)],
          fieldHaystack,
        })
      }
      continue
    }
    if (def.kind === 'boolean') {
      entries.push({
        kind: 'boolean',
        fieldKey: def.key,
        fieldLabel: def.label,
        value: '1',
        valueLabel: def.label,
        haystacks: [fieldHaystack, ...voiceAlternates(def)],
        fieldHaystack,
      })
      continue
    }
    if (def.key === 'zoning' && artifact) {
      for (const code of Object.keys(artifact.fields.zoning?.values ?? {})) {
        entries.push({
          kind: 'zoning',
          fieldKey: 'zoning',
          fieldLabel: def.label,
          value: code,
          valueLabel: code,
          haystacks: [normalizeFindQuery(code)],
          fieldHaystack,
        })
      }
      continue
    }
    // Ranges and other text fields: a jump target — selecting scrolls to the
    // control instead of applying a value.
    entries.push({
      kind: 'field',
      fieldKey: def.key,
      fieldLabel: def.label,
      value: '',
      valueLabel: def.label,
      haystacks: [fieldHaystack, ...voiceAlternates(def)],
      fieldHaystack,
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface FindFilterHit extends FindIndexEntry {
  /** Live count under the class scope; null for jump hits (no value). */
  count: number | null
  tier: number
  /** Zoning hits: the plain-English definition layer (plan §6.3). */
  definition?: ZoningHitDefinition
}

const TIER_EXACT = 0
const TIER_PREFIX = 1
const TIER_SUBSTRING = 2
const TIER_FIELD_LABEL = 3

function matchTier(haystacks: readonly string[], fieldHaystack: string, q: string): number | null {
  let best: number | null = null
  for (const h of haystacks) {
    if (!h) continue
    if (h === q) return TIER_EXACT
    if (h.startsWith(q)) best = best === null ? TIER_PREFIX : Math.min(best, TIER_PREFIX)
    else if (h.includes(q)) best = best === null ? TIER_SUBSTRING : Math.min(best, TIER_SUBSTRING)
  }
  if (best === null && fieldHaystack.includes(q)) best = TIER_FIELD_LABEL
  return best
}

export const FIND_FILTER_MAX_HITS = 30

/** Module-level memo: the definitions file is static per bundle. */
let zoningByCodeMemo: Map<string, ZoningDefinition[]> | null = null

/**
 * Rank index entries for a query under the current class scope. Zero-count
 * value hits are dropped; jump hits (ranges/text fields) carry no count and
 * rank below counted hits within their tier.
 */
export function searchFindIndex(
  index: readonly FindIndexEntry[],
  artifact: ClassPrevalenceArtifact | null,
  rawQuery: string,
  classes: readonly PropertyClass[] | null,
): FindFilterHit[] {
  const q = normalizeFindQuery(rawQuery)
  if (q.length < 2) return []
  const hits: FindFilterHit[] = []
  for (const entry of index) {
    const tier = matchTier(entry.haystacks, entry.fieldHaystack, q)
    if (tier === null) continue
    let count: number | null = null
    if (artifact && entry.kind !== 'field') {
      const key = entry.kind === 'boolean' ? 'true' : entry.value
      const assessment = assessValue(artifact, entry.fieldKey, key, classes)
      if (assessment) {
        if (assessment.count === 0) continue // never suggest a dead end
        count = assessment.count
      } else if (entry.kind === 'zoning') {
        // Zoning codes exist only via the census; no entry means no matches.
        continue
      }
    }
    if (entry.kind === 'zoning') {
      const byCode = zoningByCodeMemo ?? (zoningByCodeMemo = zoningDefinitionsByCode())
      hits.push({ ...entry, count, tier, definition: zoningHitDefinition(byCode, entry.value) })
      continue
    }
    hits.push({ ...entry, count, tier })
  }
  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      (b.count ?? -1) - (a.count ?? -1) ||
      a.valueLabel.localeCompare(b.valueLabel),
  )
  return hits.slice(0, FIND_FILTER_MAX_HITS)
}
