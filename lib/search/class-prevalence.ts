/**
 * class-prevalence — typed loader + threshold logic over the per-class
 * prevalence census (plan §5, 2026-07-30).
 *
 * The census artifact (data/search-metadata/class-prevalence.json, generated
 * by scripts/generate-class-prevalence.mjs) counts live listings per
 * (field, value, property class A/B/C/D) across listing_search_mv. This
 * module turns those counts into per-class validity for the filter UI:
 *
 *   'shown'          the value has live matches under the selected class
 *   'disabled-zero'  zero matches under the class, but the value exists in
 *                    the vocabulary — rendered disabled with the reason,
 *                    never silently removed (plan §7.1 rule 2)
 *   'hidden'         zero matches AND the Spark AppliesTo hint agrees the
 *                    value does not belong to the class — not offered
 *
 * Validity comes from OBSERVED prevalence; the metadata hint is a
 * tie-breaker only (plan §5 — trusting AppliesTo alone would have hidden
 * Deck/Patio from residential search). `prominent` marks values at or above
 * the §5 threshold — min(0.5% of class rows, 25 listings) — used for
 * ordering: prominent values sort first, low-count values sink, and a value
 * with ANY live match stays selectable because disabling a real match would
 * fabricate a dead end (§0).
 *
 * The artifact is ~120 KB, so it is loaded lazily via loadClassPrevalence()
 * (dynamic import, own chunk) — never import the JSON statically from UI.
 */

import { SUBTYPE_TO_CLASS, propertyTypeFilterToCodes, type PropertySubTypeClass } from '@/lib/property-type'

// ---------------------------------------------------------------------------
// Types over the artifact
// ---------------------------------------------------------------------------

export type PropertyClass = PropertySubTypeClass // 'A' | 'B' | 'C' | 'D'

export const PROPERTY_CLASS_ORDER: readonly PropertyClass[] = ['A', 'B', 'C', 'D']

/** Buyer-facing class names, matching the plan §4.2 class table. */
export const PROPERTY_CLASS_LABELS: Readonly<Record<PropertyClass, string>> = {
  A: 'Residential',
  B: 'Manufactured',
  C: 'Multi-family',
  D: 'Land',
}

export interface PrevalenceValueEntry {
  /** Live-listing counts in fixed [A, B, C, D] order. */
  counts: readonly [number, number, number, number]
  /** Count across ALL classes, E-H and unclassed rows included. */
  total: number
  /** Spark AppliesTo classes for this value — design-time hint only. */
  hint?: readonly string[]
}

export interface PrevalenceField {
  kind: 'multi' | 'boolean' | 'text'
  mv: string
  values: Record<string, PrevalenceValueEntry>
}

export interface ClassPrevalenceArtifact {
  generatedAt: string
  rowTotals: { A: number; B: number; C: number; D: number; other: number; total: number }
  fields: Record<string, PrevalenceField>
}

// ---------------------------------------------------------------------------
// Lazy artifact loader (client + server safe)
// ---------------------------------------------------------------------------

let artifactPromise: Promise<ClassPrevalenceArtifact> | null = null

export function loadClassPrevalence(): Promise<ClassPrevalenceArtifact> {
  if (!artifactPromise) {
    artifactPromise = import('@/data/search-metadata/class-prevalence.json').then(
      (mod) => (mod.default ?? mod) as unknown as ClassPrevalenceArtifact,
    )
  }
  return artifactPromise
}

// ---------------------------------------------------------------------------
// Threshold logic (plan §5 — thresholds are named constants, moved by commit)
// ---------------------------------------------------------------------------

/** A value is prominent in a class when it covers this share of class rows... */
export const SHOWN_MIN_SHARE = 0.005
/** ...or this many listings, whichever bar is LOWER (plan §5). */
export const SHOWN_MIN_COUNT = 25

/**
 * The §5 prominence threshold for a class of `classRows` live rows:
 * min(0.5% of rows, 25), floored at 1 so a zero count is never prominent.
 */
export function shownThreshold(classRows: number): number {
  return Math.max(1, Math.min(classRows * SHOWN_MIN_SHARE, SHOWN_MIN_COUNT))
}

export type ClassPrevalenceState = 'shown' | 'disabled-zero' | 'hidden'

export interface ValueClassAssessment {
  state: ClassPrevalenceState
  /** Live count under the selected classes (total when unscoped). */
  count: number
  /** count >= the §5 threshold — drives ordering, never selectability. */
  prominent: boolean
  threshold: number
}

/** Sum an entry's counts across a class scope (null scope = artifact total). */
export function countForClasses(
  entry: PrevalenceValueEntry,
  classes: readonly PropertyClass[] | null,
): number {
  if (!classes) return entry.total
  let sum = 0
  for (const cls of classes) sum += entry.counts[PROPERTY_CLASS_ORDER.indexOf(cls)] ?? 0
  return sum
}

/**
 * Assess one (field, value) under a class scope. Returns null when the
 * artifact has no entry — the caller renders unconditioned rather than
 * guessing (§0: no fabricated zero).
 */
export function assessValue(
  artifact: ClassPrevalenceArtifact,
  fieldKey: string,
  value: string,
  classes: readonly PropertyClass[] | null,
): ValueClassAssessment | null {
  const entry = artifact.fields[fieldKey]?.values[value]
  if (!entry) return null
  const count = countForClasses(entry, classes)
  const classRows = classes
    ? classes.reduce((n, cls) => n + artifact.rowTotals[cls], 0)
    : artifact.rowTotals.total
  const threshold = shownThreshold(classRows)
  if (count > 0) return { state: 'shown', count, prominent: count >= threshold, threshold }
  // Zero under this scope. Hidden only when the metadata hint AGREES the
  // value belongs to none of the selected classes (plan §5); an absent or
  // contradicting hint keeps the value visible-but-disabled.
  const hint = entry.hint
  const hidden =
    classes !== null &&
    Array.isArray(hint) &&
    hint.length > 0 &&
    classes.every((cls) => !hint.includes(cls))
  return { state: hidden ? 'hidden' : 'disabled-zero', count: 0, prominent: false, threshold }
}

// ---------------------------------------------------------------------------
// Property-class scope from the propertyType URL param
// ---------------------------------------------------------------------------

/**
 * Resolve the propertyType URL param to the census classes it constrains.
 * Returns null when the param does not condition A-D at all: empty ("all
 * types"), unmapped values, and Commercial (classes E-H — the census carries
 * no prevalence for them, so conditioning switches off rather than guessing).
 */
export function classesForPropertyType(
  value: string | null | undefined,
): readonly PropertyClass[] | null {
  const codes = propertyTypeFilterToCodes(value)
  if (!codes) return null
  const classes = codes.filter((c): c is PropertyClass =>
    (PROPERTY_CLASS_ORDER as readonly string[]).includes(c),
  )
  return classes.length > 0 ? classes : null
}

/** Display label for any propertyType URL value (codes included), or null. */
export function propertyTypeDisplayLabel(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  if (!v) return null
  if (/^[a-d]$/i.test(v)) return PROPERTY_CLASS_LABELS[v.toUpperCase() as PropertyClass]
  const lower = v.toLowerCase()
  if (lower === 'residential') return 'Residential'
  if (lower === 'land' || lower === 'lots' || lower === 'acreage') return 'Land'
  if (lower === 'commercial' || lower === 'business') return 'Commercial'
  if (lower === 'multi-family' || lower === 'multifamily' || lower === 'multi family' || lower === 'income') {
    return 'Multi-family'
  }
  return null
}

// ---------------------------------------------------------------------------
// Sub-type auto-narrow (plan §4.5.3 / §7.1 rule 2)
// ---------------------------------------------------------------------------

/** The property classes covered by the selected sub types (SUBTYPE_TO_CLASS). */
export function classesOfSubTypes(subTypes: readonly string[]): PropertyClass[] {
  const seen = new Set<PropertyClass>()
  for (const subType of subTypes) {
    const cls = SUBTYPE_TO_CLASS[subType]
    if (cls) seen.add(cls)
  }
  return PROPERTY_CLASS_ORDER.filter((cls) => seen.has(cls))
}

/**
 * The propertyType URL value that exactly covers the selected sub types'
 * classes — the auto-narrow target (picking Duplex narrows the class to C;
 * picking across classes widens instead of blocking).
 *
 * Returns:
 *   null   no sub types selected — leave propertyType alone
 *   ''     the selection spans Land plus another class — no single value
 *          covers it, so the class filter clears (widen, never block)
 *   value  the narrowest propertyType covering every selected class
 */
export function autoNarrowPropertyType(subTypes: readonly string[]): string | null {
  const classes = classesOfSubTypes(subTypes)
  if (classes.length === 0) return null
  if (classes.length === 1) return propertyTypeValueForClass(classes[0])
  if (!classes.includes('D')) return 'Residential'
  return ''
}

/** The propertyType URL value constraining exactly one census class. */
export function propertyTypeValueForClass(cls: PropertyClass): string {
  if (cls === 'C') return 'multi-family'
  if (cls === 'D') return 'Land'
  return cls
}

/**
 * Whether the current propertyType already covers every given class — when it
 * does, auto-narrow leaves the user's wider scope alone.
 */
export function propertyTypeCovers(
  value: string | null | undefined,
  classes: readonly PropertyClass[],
): boolean {
  const scope = classesForPropertyType(value)
  if (scope === null) {
    // Null scope from an EMPTY param means "all types" (covers everything);
    // null from Commercial means A-D are out of scope entirely.
    const codes = propertyTypeFilterToCodes(value)
    return codes === null
  }
  return classes.every((cls) => scope.includes(cls))
}

/** The class where a value has its highest live count — the "switch class" resolution target. */
export function bestClassForValue(
  artifact: ClassPrevalenceArtifact,
  fieldKey: string,
  value: string,
): PropertyClass | null {
  const entry = artifact.fields[fieldKey]?.values[value]
  if (!entry) return null
  let best: PropertyClass | null = null
  let bestCount = 0
  PROPERTY_CLASS_ORDER.forEach((cls, i) => {
    const count = entry.counts[i] ?? 0
    if (count > bestCount) {
      best = cls
      bestCount = count
    }
  })
  return best
}
