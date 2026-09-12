/**
 * taste-evaluate-result.mjs — parse / fail rules for the SEPARATE evaluator.
 *
 * The grok CLI is THE ONE INSTRUMENT. A missing binary or a 402 is an honest
 * fail: do not invent demoMatch true. A parsed result that omits demoMatch
 * or sets it false is not a pass — print the JSON, then exit non-zero so
 * the node stays in_progress.
 */
export const EVALUATOR_MODEL = 'grok-4.6'
export const RUBRIC_VERSION = 'v1-2026-09-12'
export const RUBRIC_PATH = 'design_system/public/taste-evaluator.v1-2026-09-12.md'

export function grokCliFailure(status, stderr, stdout, { cliMissing = false } = {}) {
  const blob = `${stderr ?? ''}\n${stdout ?? ''}`
  if (cliMissing || status === 127 || /ENOENT|no grok CLI|No such file or directory/i.test(blob)) {
    return {
      kind: 'missing',
      message:
        'taste-evaluate: grok CLI missing. Do not invent demoMatch. Leave the node in_progress.',
    }
  }
  if (/\b402\b/.test(blob) || /payment required|insufficient (credits|quota)|quota exceeded/i.test(blob)) {
    return {
      kind: '402',
      message:
        'taste-evaluate: grok CLI 402 (subscription/quota). Do not invent demoMatch. Leave the node in_progress.',
    }
  }
  if (status !== 0 && status != null) {
    return {
      kind: 'error',
      message: `taste-evaluate: grok CLI exited ${status}: ${blob.trim().slice(0, 400)}`,
    }
  }
  return null
}

/** Problems on a parsed evaluator object. Empty = schema ok (demoMatch may still be false). */
export function evaluatorResultProblems(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['taste-evaluate: evaluator JSON missing. Do not invent demoMatch. Leave the node in_progress.']
  }
  if (typeof parsed.demoMatch !== 'boolean') {
    return ['taste-evaluate: demoMatch must be true or false. The catalog demo is the UX bar.']
  }
  return []
}

export function demoMatchBlocksDone(parsed) {
  return !parsed || typeof parsed !== 'object' || parsed.demoMatch !== true
}

export function evaluatorEnvelope({ parsed, shots, extra = {} }) {
  return {
    evaluatorModel: EVALUATOR_MODEL,
    rubricVersion: RUBRIC_VERSION,
    shots,
    result: parsed,
    ...extra,
  }
}
