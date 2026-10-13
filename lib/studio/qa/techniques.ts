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
  /** True when at least one technique carries a valid category. */
  hasCategories: boolean
}

/** Read the registry. Throws when the file is missing or malformed. */
export function loadTechniqueRegistry(path: string = TECHNIQUE_REGISTRY_PATH): TechniqueRegistry {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { techniques?: Record<string, { category?: unknown }> }
  if (!raw || typeof raw !== 'object' || !raw.techniques || typeof raw.techniques !== 'object') {
    throw new Error(`${path} has no "techniques" object`)
  }
  const categories = new Map<string, TechniqueCategory | null>()
  for (const [name, def] of Object.entries(raw.techniques)) {
    const c = def && typeof def === 'object' ? def.category : undefined
    categories.set(name, typeof c === 'string' && (TECHNIQUE_CATEGORIES as readonly string[]).includes(c) ? (c as TechniqueCategory) : null)
  }
  return { categories, hasCategories: [...categories.values()].some((c) => c !== null) }
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
