/**
 * lib/studio/qa/techniques.ts - check 15 ("Techniques ran") logic.
 *
 * The brief names the techniques it means to use; the manifest lists the ones the
 * renderer actually executed. A brief technique that never ran is a failure, and
 * a film must have run at least one hook, one scene and one type technique. The
 * category of each technique is the optional `category` field in
 * .claude/skills/ryan-studio/techniques/registry.json (owned by the studio skill,
 * not edited here). A registry with no categories at all cannot be judged, so
 * the check fails with "registry has no categories".
 */
import { readFileSync } from 'node:fs'
import {
  REQUIRED_TECHNIQUE_CATEGORIES,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_REGISTRY_PATH,
  type TechniqueCategory,
} from './thresholds'

export interface TechniqueRegistry {
  /** name -> category, or null when the registry gives that technique none. */
  categories: Map<string, TechniqueCategory | null>
  /** name -> status ("planned", "ready", "approved"), or null when the registry gives none. */
  status?: Map<string, string | null>
  /** name -> tier ("signature", "base"), or null when the registry gives none. */
  tier?: Map<string, string | null>
  /** True when at least one technique carries a valid category. */
  hasCategories: boolean
}

/** Read the registry. Throws when the file is missing or malformed. */
export function loadTechniqueRegistry(path: string = TECHNIQUE_REGISTRY_PATH): TechniqueRegistry {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { techniques?: Record<string, { category?: unknown; status?: unknown; tier?: unknown }> }
  if (!raw || typeof raw !== 'object' || !raw.techniques || typeof raw.techniques !== 'object') {
    throw new Error(`${path} has no "techniques" object`)
  }
  const categories = new Map<string, TechniqueCategory | null>()
  const status = new Map<string, string | null>()
  const tier = new Map<string, string | null>()
  for (const [name, def] of Object.entries(raw.techniques)) {
    const tr = def && typeof def === 'object' ? def.tier : undefined
    tier.set(name, typeof tr === 'string' ? tr : null)
    const c = def && typeof def === 'object' ? def.category : undefined
    categories.set(name, typeof c === 'string' && (TECHNIQUE_CATEGORIES as readonly string[]).includes(c) ? (c as TechniqueCategory) : null)
    const st = def && typeof def === 'object' ? def.status : undefined
    status.set(name, typeof st === 'string' ? st : null)
  }
  return { categories, status, tier, hasCategories: [...categories.values()].some((c) => c !== null) }
}

export interface TechniqueEvaluation {
  noCategories: boolean
  /** Brief techniques the renderer never ran. */
  notRun: string[]
  /** Manifest techniques the registry does not list. */
  unknown: string[]
  /** Manifest techniques the registry lists without a category. */
  uncategorized: string[]
  /** Executed techniques grouped by category. */
  byCategory: Partial<Record<TechniqueCategory, string[]>>
  /** Required categories with no executed technique. */
  missingCategories: TechniqueCategory[]
  pass: boolean
}

/** Pure comparison for check 15. */
export function evaluateTechniques(
  briefTechniques: readonly string[],
  manifestTechniques: readonly string[],
  registry: TechniqueRegistry,
): TechniqueEvaluation {
  const ran = new Set(manifestTechniques)
  const notRun = briefTechniques.filter((t) => !ran.has(t))
  const unknown = manifestTechniques.filter((t) => !registry.categories.has(t))
  const uncategorized = manifestTechniques.filter((t) => registry.categories.has(t) && registry.categories.get(t) === null)
  const byCategory: Partial<Record<TechniqueCategory, string[]>> = {}
  for (const name of manifestTechniques) {
    const c = registry.categories.get(name)
    if (c) (byCategory[c] ??= []).push(name)
  }
  const missingCategories = REQUIRED_TECHNIQUE_CATEGORIES.filter((c) => !byCategory[c] || byCategory[c]!.length === 0)
  const noCategories = !registry.hasCategories
  const pass =
    !noCategories && briefTechniques.length > 0 && notRun.length === 0 && unknown.length === 0 && missingCategories.length === 0
  return { noCategories, notRun, unknown, uncategorized, byCategory, missingCategories, pass }
}

/** Check 15 as problems: what the brief named and did not run, unknown names, and uncovered categories. */
export function techniqueProblems(briefTechniques: readonly string[], ran: readonly string[], registry: TechniqueRegistry): string[] {
  const ev = evaluateTechniques(briefTechniques, ran, registry)
  const problems: string[] = []
  if (ev.noCategories) problems.push('registry has no categories')
  if (briefTechniques.length === 0) problems.push('the brief names no techniques')
  if (ev.notRun.length) problems.push(`brief technique(s) the renderer never ran: ${ev.notRun.join(', ')}`)
  if (ev.unknown.length) problems.push(`manifest technique(s) not in the registry: ${ev.unknown.join(', ')}`)
  if (!ev.noCategories && ev.missingCategories.length) problems.push(`no ${ev.missingCategories.join(', ')} technique ran`)
  const floor = signatureFloorProblem(ran, registry)
  if (floor) problems.push(floor)
  return problems
}

/**
 * The status rungs (Matt 2026-10-14): planned (an idea with a home), ready
 * (code and test, built), approved (Matt saw its showcase reel and said yes).
 * A base technique is usable when ready or approved; a signature technique
 * only when approved: no film is built from showpieces Matt has not seen.
 */
export function usableTechnique(name: string, registry: TechniqueRegistry): boolean {
  if (!registry.categories.has(name)) return false
  const status = registry.status?.get(name) ?? null
  if (registry.tier?.get(name) === 'signature') return status === 'approved'
  return status === 'ready' || status === 'approved'
}

/** Brief techniques a film may not use: unknown, planned, or a signature Matt has not approved. */
export function notReadyTechniques(briefTechniques: readonly string[], registry: TechniqueRegistry): string[] {
  return briefTechniques.filter((t) => !usableTechnique(t, registry))
}

/** Why a technique cannot be used, in a line a brief author can act on. */
export function unusableReason(name: string, registry: TechniqueRegistry): string {
  if (!registry.categories.has(name)) return `"${name}" is not in the registry`
  const status = registry.status?.get(name) ?? 'no status'
  if (registry.tier?.get(name) === 'signature') return `signature technique "${name}" is ${status}, not approved (Matt approves a signature technique after seeing its showcase reel)`
  return `"${name}" is ${status}, not ready`
}

export const SIGNATURE_FLOOR_MESSAGE =
  'this film has no approved signature technique; every film runs at least one approved signature technique (pick one from the registry, or build one and have Matt approve its reel)'

/** The floor: at least one approved signature technique among these. Null when it holds. */
export function signatureFloorProblem(techniques: readonly string[], registry: TechniqueRegistry): string | null {
  return techniques.some((t) => registry.tier?.get(t) === 'signature' && usableTechnique(t, registry)) ? null : SIGNATURE_FLOOR_MESSAGE
}
