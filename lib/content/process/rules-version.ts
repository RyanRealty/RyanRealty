/**
 * lib/content/process/rules-version.ts - what the rules say right now.
 *
 * Reads the numbers each rule holds from where they live (QA_THRESHOLDS and
 * video_types.json) and hashes them with the rules themselves AND with the code
 * that enforces them. A stamp records this hash as rulesVersion; a later step
 * refuses a stamp made under other rules. Hashing only the rules' metadata and
 * numbers would leave every old stamp valid after a change to the LOGIC of a check
 * (a regex, a comparison, a new branch), which is how a loosened check would ship
 * unseen. So the version also covers every enforced rule's enforcer module and the
 * other non-test source files in the same directories (the helpers an enforcer
 * imports sit next to it).
 */
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { canonicalJson, hashFile, sha256Hex } from './canonical'
import { CAPS, RULES, type Rule } from './rules'
import { buildThresholdData, resolveAll, thresholdsOf, type ThresholdData } from './threshold-path'
import { EXTRA_BANNED_PHRASES, QA_THRESHOLDS, REQUIRED_TECHNIQUE_CATEGORIES, REPO_ROOT, loadVideoTypes, type VideoTypesFile } from '../../studio/qa/thresholds'

/** The data thresholds are read from, as this checkout has it. */
export function thresholdData(file: VideoTypesFile = loadVideoTypes()): ThresholdData {
  return buildThresholdData({
    qa: QA_THRESHOLDS as unknown as Record<string, unknown>,
    extraBannedPhrases: EXTRA_BANNED_PHRASES,
    requiredTechniqueCategories: REQUIRED_TECHNIQUE_CATEGORIES,
    caps: CAPS,
    videoTypes: { defaults: file.defaults as Record<string, unknown>, types: file.types as Record<string, Record<string, unknown>>, banned_phrases: file.banned_phrases, fair_housing_flags: file.fair_housing_flags },
  })
}

export { resolveAll, thresholdsOf }

/** Code and scripts: what can change how a check decides. Data files are covered by the thresholds; docs and fixtures are not enforcement. */
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|py|sh)$/
/** Tests, type declarations and test support do not decide anything a stamp relied on. */
const NOT_ENFORCEMENT = /(?:\.(?:test|spec)\.[a-z]+$|\.d\.[a-z]+$|^test-)/

/**
 * Every source file whose content a stamp's rules rest on, by repo-relative path: each enforced rule's
 * enforcer module, and the other non-test source files directly in the same directories. A planned or
 * retired rule enforces nothing, so its enforcer (if it names one) is not read. Every call reads the
 * files (a few hundred KB): no cache, so an edit that keeps a file's size and mtime is still seen.
 */
export function enforcerSources(rules: readonly Rule[] = RULES, root: string = REPO_ROOT): Record<string, string> {
  const files = new Set<string>()
  for (const r of rules) {
    if (r.status !== 'enforced' || !r.enforcer) continue
    files.add(r.enforcer.module)
    const dir = dirname(r.enforcer.module)
    const abs = join(root, dir)
    if (!existsSync(abs)) continue
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isFile() && SOURCE_FILE.test(e.name) && !NOT_ENFORCEMENT.test(e.name)) files.add(dir === '.' ? e.name : `${dir}/${e.name}`)
    }
  }
  return Object.fromEntries([...files].sort().map((rel) => [rel, hashFile(join(root, rel)) ?? 'missing']))
}

/** sha256 of the canonical rules, every resolved threshold, and the source of the code that enforces them. */
export function rulesVersion(data: ThresholdData = thresholdData(), rules: readonly Rule[] = RULES, root: string = REPO_ROOT): string {
  const thresholds = Object.fromEntries(Object.entries(resolveAll(data, rules)).map(([k, v]) => [k, v.resolved]))
  return sha256Hex(canonicalJson({ rules, thresholds, enforcers: enforcerSources(rules, root) }))
}
