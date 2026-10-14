/**
 * lib/content/process/rules-version.ts - what the rules say right now.
 *
 * Reads the numbers each rule holds from where they live (QA_THRESHOLDS and
 * video_types.json) and hashes them with the rules themselves. A stamp records
 * this hash as rulesVersion; a later step refuses a stamp made under other rules.
 */
import { canonicalJson, sha256Hex } from './canonical'
import { CAPS, RULES, type Rule } from './rules'
import { buildThresholdData, resolveAll, thresholdsOf, type ThresholdData } from './threshold-path'
import { EXTRA_BANNED_PHRASES, QA_THRESHOLDS, REQUIRED_TECHNIQUE_CATEGORIES, loadVideoTypes, type VideoTypesFile } from '../../studio/qa/thresholds'

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

/** sha256 of the canonical rules plus every resolved threshold. */
export function rulesVersion(data: ThresholdData = thresholdData(), rules: readonly Rule[] = RULES): string {
  const thresholds = Object.fromEntries(Object.entries(resolveAll(data, rules)).map(([k, v]) => [k, v.resolved]))
  return sha256Hex(canonicalJson({ rules, thresholds }))
}
