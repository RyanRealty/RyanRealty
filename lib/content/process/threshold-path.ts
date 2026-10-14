/**
 * lib/content/process/threshold-path.ts - read the number a rule holds, and
 * say whether one reading is looser than another.
 *
 * Plain TypeScript with no imports: scripts/check-content-rules.mjs imports this
 * file directly (Node strips the types), and so does the rules file's own test.
 * The data comes in as arguments, so the gate and the code read one definition.
 *
 * A rule's threshold names where its number lives:
 *  - source 'qa': a dot path into QA_THRESHOLDS (lib/studio/qa/thresholds.ts),
 *    plus the lists that file also holds ('extra_banned_phrases').
 *  - source 'video_types': a path into .claude/skills/ryan-studio/tools/video_types.json.
 *      'defaults.K'  the default for key K, plus the value of every type that
 *                    sets its own K (effective(type) = perType[type] ?? value);
 *      'types.T.K'   type T's own K, defaults merged under it;
 *      'banned_phrases', 'fair_housing_flags'  the file's two lists.
 *
 * A list is compared as a set: more items is tighter, any item gone is looser.
 */
import type { Rule, RuleThreshold } from './rules'

export type ThresholdSource = 'qa' | 'video_types'
export type TighterIs = 'lower' | 'higher'
export type ThresholdSpec = { source: ThresholdSource; path: string; tighterIs: TighterIs }
export type ThresholdValue = number | boolean | string[]

export type ThresholdData = {
  qa: Record<string, unknown>
  videoTypes: {
    defaults: Record<string, unknown>
    types: Record<string, Record<string, unknown>>
    banned_phrases?: string[]
    fair_housing_flags?: string[]
  }
}

export type ResolvedThreshold = {
  /** The reading at this path (for 'defaults.K': the default). */
  value: ThresholdValue
  /** 'defaults.K' only: the value of each type that sets its own K. */
  perType?: Record<string, ThresholdValue>
}

const isValue = (v: unknown): v is ThresholdValue =>
  typeof v === 'number' || typeof v === 'boolean' || (Array.isArray(v) && v.every((x) => typeof x === 'string'))

function dig(root: unknown, path: string): unknown {
  let at: unknown = root
  for (const part of path.split('.')) {
    if (at === null || typeof at !== 'object' || !Object.prototype.hasOwnProperty.call(at, part)) return undefined
    at = (at as Record<string, unknown>)[part]
  }
  return at
}

/** Read one threshold. Throws when the path leads nowhere or to something that is not a number, a boolean or a list of words. */
export function resolveThreshold(spec: ThresholdSpec, data: ThresholdData): ResolvedThreshold {
  const fail = (why: string): never => {
    throw new Error(`threshold ${spec.source}:${spec.path} ${why}`)
  }
  if (spec.source === 'qa') {
    const v = dig(data.qa, spec.path)
    return isValue(v) ? { value: v } : fail('is not a number, a boolean or a list in the QA thresholds')
  }
  const vt = data.videoTypes
  const parts = spec.path.split('.')
  if (parts[0] === 'defaults' && parts.length === 2) {
    const key = parts[1]
    const base = vt.defaults[key]
    if (!isValue(base)) return fail('is not in video_types.json defaults')
    const perType: Record<string, ThresholdValue> = {}
    for (const [type, own] of Object.entries(vt.types)) {
      if (own && Object.prototype.hasOwnProperty.call(own, key) && isValue(own[key])) perType[type] = own[key] as ThresholdValue
    }
    return Object.keys(perType).length ? { value: base, perType } : { value: base }
  }
  if (parts[0] === 'types' && parts.length === 3) {
    const [, type, key] = parts
    const own = vt.types[type]
    if (!own) return fail('names a type video_types.json does not list')
    const v = Object.prototype.hasOwnProperty.call(own, key) ? own[key] : vt.defaults[key]
    return isValue(v) ? { value: v } : fail('is not a number, a boolean or a list for that type')
  }
  if (parts.length === 1 && (parts[0] === 'banned_phrases' || parts[0] === 'fair_housing_flags')) {
    const v = vt[parts[0]]
    return isValue(v) ? { value: v } : fail('is not a list in video_types.json')
  }
  return fail('is not a path this file reads (defaults.K, types.T.K, banned_phrases, fair_housing_flags)')
}

/** The reading for one video type: its own override when it has one, else the value. */
export function effectiveFor(r: ResolvedThreshold, type: string): ThresholdValue {
  return r.perType && Object.prototype.hasOwnProperty.call(r.perType, type) ? r.perType[type] : r.value
}

export type Comparison = 'same' | 'tighter' | 'looser'

const asNumber = (v: ThresholdValue): number | null => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : null)

/** Current against the last value Matt approved. A reading that cannot be compared is looser: nothing passes by default. */
export function compareValue(baseline: ThresholdValue | undefined, current: ThresholdValue | undefined, tighterIs: TighterIs): Comparison {
  if (baseline === undefined) return 'same'
  if (current === undefined) return 'looser'
  if (Array.isArray(baseline) || Array.isArray(current)) {
    if (!Array.isArray(baseline) || !Array.isArray(current)) return 'looser'
    const now = new Set(current)
    if (baseline.some((w) => !now.has(w))) return 'looser'
    return now.size > new Set(baseline).size ? (tighterIs === 'higher' ? 'tighter' : 'looser') : 'same'
  }
  const a = asNumber(baseline)
  const b = asNumber(current)
  if (a === null || b === null) return 'looser'
  if (a === b) return 'same'
  const lower = b < a
  return lower === (tighterIs === 'lower') ? 'tighter' : 'looser'
}

export type Looseness = { where: string; baseline: ThresholdValue; current: ThresholdValue | undefined; comparison: Comparison }

/**
 * Every place the current reading differs from the baseline, for one threshold:
 * the value itself and each video type's effective value (a type that sets its
 * own number is held to what it was; a new type is held to the default).
 */
export function compareResolved(
  baseline: ResolvedThreshold,
  current: ResolvedThreshold | null,
  tighterIs: TighterIs,
  currentTypes: readonly string[],
): Looseness[] {
  const out: Looseness[] = []
  const note = (where: string, b: ThresholdValue, c: ThresholdValue | undefined) => {
    const comparison = compareValue(b, c, tighterIs)
    if (comparison !== 'same') out.push({ where, baseline: b, current: c, comparison })
  }
  note('value', baseline.value, current?.value)
  if (!current) return out
  const types = new Set<string>([...Object.keys(baseline.perType ?? {}), ...Object.keys(current.perType ?? {}), ...currentTypes])
  for (const type of types) {
    if (!currentTypes.includes(type)) continue
    note(`type ${type}`, effectiveFor(baseline, type), effectiveFor(current, type))
  }
  return out
}

/** A rule's thresholds as a list (it may hold one, two, or none). */
export function thresholdsOf(rule: Pick<Rule, 'threshold'>): RuleThreshold[] {
  if (!rule.threshold) return []
  return Array.isArray(rule.threshold) ? [...(rule.threshold as readonly RuleThreshold[])] : [rule.threshold as RuleThreshold]
}

/** The key a rule's n-th threshold has in the baseline: 'R-001', then 'R-001#2'. */
export const thresholdKey = (id: string, index: number): string => (index === 0 ? id : `${id}#${index + 1}`)

/** Every threshold of every rule, resolved. */
export function resolveAll(data: ThresholdData, rules: ReadonlyArray<Pick<Rule, 'id' | 'threshold'>>): Record<string, { spec: RuleThreshold; resolved: ResolvedThreshold }> {
  const out: Record<string, { spec: RuleThreshold; resolved: ResolvedThreshold }> = {}
  for (const rule of rules) {
    thresholdsOf(rule).forEach((spec, i) => {
      out[thresholdKey(rule.id, i)] = { spec, resolved: resolveThreshold(spec, data) }
    })
  }
  return out
}

/** The data thresholds are read from, assembled from the QA constants, the lists beside them, the job caps and video_types.json. */
export function buildThresholdData(parts: {
  qa: Record<string, unknown>
  extraBannedPhrases: readonly string[]
  requiredTechniqueCategories: readonly string[]
  caps: Record<string, unknown>
  videoTypes: { defaults: Record<string, unknown>; types: Record<string, Record<string, unknown>>; banned_phrases: string[]; fair_housing_flags: string[] }
}): ThresholdData {
  return {
    qa: { ...parts.qa, extra_banned_phrases: [...parts.extraBannedPhrases], required_technique_categories: [...parts.requiredTechniqueCategories], caps: { ...parts.caps } },
    videoTypes: {
      defaults: parts.videoTypes.defaults,
      types: parts.videoTypes.types,
      banned_phrases: parts.videoTypes.banned_phrases,
      fair_housing_flags: parts.videoTypes.fair_housing_flags,
    },
  }
}

const isLeaf = (o: unknown): boolean => typeof o === 'number' || typeof o === 'boolean'

function leavesOf(o: unknown, prefix = ''): string[] {
  if (o && typeof o === 'object' && !Array.isArray(o)) return Object.entries(o).flatMap(([k, v]) => leavesOf(v, prefix ? `${prefix}.${k}` : k))
  return isLeaf(o) ? [prefix] : []
}

/**
 * Numbers and switches the factory holds that no rule's threshold names, as
 * 'qa:audio.lufsMin' or 'video_types:defaults.min_s': a number like that could
 * loosen without the ratchet seeing it. `unowned` lists the QA numbers that are
 * not limits (rules.ts UNRATCHETED). A string-valued key of a type (the Housing
 * category) is a locked value, not a number.
 */
export function unownedNumbers(data: ThresholdData, rules: ReadonlyArray<Pick<Rule, 'id' | 'threshold'>>, unowned: Record<string, string>): string[] {
  const owned = new Set(rules.flatMap((r) => thresholdsOf(r)).map((t) => `${t.source}:${t.path}`))
  const missing: string[] = []
  for (const path of leavesOf(data.qa)) if (!(path in unowned) && !owned.has(`qa:${path}`)) missing.push(`qa:${path}`)
  const vt = data.videoTypes
  for (const key of Object.keys(vt.defaults)) if (isLeaf(vt.defaults[key]) && !owned.has(`video_types:defaults.${key}`)) missing.push(`video_types:defaults.${key}`)
  for (const [type, own] of Object.entries(vt.types)) {
    for (const [key, value] of Object.entries(own)) {
      if (isLeaf(value) && !(key in vt.defaults) && !owned.has(`video_types:types.${type}.${key}`)) missing.push(`video_types:types.${type}.${key}`)
    }
  }
  return missing
}
