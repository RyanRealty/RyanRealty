/**
 * taste-evaluate-result.mjs — parse / fail rules for the SEPARATE evaluator.
 *
 * THE RULER AND ITS FALLBACK (Matt 2026-09-12: "fix it all").
 *
 * grok-4.6 through the grok CLI is the primary judge. From 2026-09-11 10:17
 * every fire returned `402 Payment Required: Grok Build usage balance
 * exhausted`, the cloud lanes never had the CLI at all, and every SITE node
 * ended "not done, do not merge" — three PRs parked, zero lanes able to
 * finish. A loop whose only judge is unreachable is not a loop.
 *
 * So the judge is now a CHAIN, in this order, and the receipt records which
 * link answered:
 *   1. grok-4.6 via the grok CLI (subscription; XAI_API_KEY stripped).
 *   2. claude via the claude CLI (subscription). sonnet by default; opus when
 *      the builder was sonnet, so evaluatorModel != builderModel still holds.
 * Both unreachable is the only honest fail. A switch between links changes
 * `evaluatorModel`, so ci:taste-canon's identity keys rebaseline the class
 * ONCE — that is the designed behaviour, not a loophole.
 *
 * A parsed result that omits demoMatch or sets it false is not a pass — print
 * the JSON, then exit non-zero so the node stays in_progress. When the route
 * publishes a competitiveBrief, competitiveBriefPass is the same rule.
 */
export const EVALUATOR_MODEL = 'grok-4.6'
export const RUBRIC_VERSION = 'v1-2026-09-12'
export const RUBRIC_PATH = 'design_system/public/taste-evaluator.v1-2026-09-12.md'

/** Claude CLI aliases → the canonical id the CLI reports in `modelUsage`. */
export const FALLBACK_EVALUATORS = Object.freeze({
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-5',
})

/**
 * Every model allowed to sign a Tip Ready receipt. grok-4.5 is a builder and
 * is not here; nothing a lane builds with may also grade it.
 */
export const ALLOWED_EVALUATORS = Object.freeze([EVALUATOR_MODEL, ...Object.values(FALLBACK_EVALUATORS)])

export function isAllowedEvaluator(model) {
  const m = String(model ?? '').trim()
  if (!m) return false
  if (ALLOWED_EVALUATORS.includes(m)) return true
  // The claude CLI may report a dated id (claude-sonnet-5-20260901). Same family, same ruler.
  return /^claude-(sonnet|opus)-\d/.test(m)
}

/**
 * Which claude alias to fall back to so the judge is never the builder.
 * `builderModel` is whatever the lane recorded (claude-sonnet-5, grok-4.5,
 * claude-fable-5-1, …). Unknown or non-sonnet → sonnet.
 */
export function pickFallbackAlias(builderModel) {
  return /sonnet/i.test(String(builderModel ?? '')) ? 'opus' : 'sonnet'
}

export function grokCliFailure(status, stderr, stdout, { cliMissing = false } = {}) {
  const blob = `${stderr ?? ''}\n${stdout ?? ''}`
  if (cliMissing || status === 127 || /ENOENT|no grok CLI|No such file or directory/i.test(blob)) {
    return {
      kind: 'missing',
      message:
        'taste-evaluate: grok CLI missing. Do not invent demoMatch. Leave the node in_progress.',
    }
  }
  if (/\b402\b/.test(blob) || /payment required|insufficient (credits|quota)|quota exceeded|balance exhausted/i.test(blob)) {
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

/** The two grok failures that hand the shots to the next link in the chain. */
export function grokFailureFallsBack(fail) {
  return Boolean(fail && (fail.kind === 'missing' || fail.kind === '402'))
}

/**
 * Classify a claude CLI run. `wrapper` is the parsed `--output-format json`
 * object (or null). Returns { kind, message } or null when the call is good.
 */
export function claudeCliFailure(status, stderr, wrapper, { cliMissing = false } = {}) {
  const blob = String(stderr ?? '')
  if (cliMissing || status === 127 || /ENOENT|command not found/i.test(blob)) {
    return {
      kind: 'missing',
      message: 'taste-evaluate: claude CLI missing too. Both judges unreachable. Do not invent demoMatch. Leave the node in_progress.',
    }
  }
  // Only an explicit account/usage message is a quota fail. A bare "limit" is not:
  // "exceeded the output token limit" is a real error the caller must see.
  const QUOTA_RE = /rate.?limit|\b429\b|usage limit|hit your limit|quota|payment required|\b402\b|billing|insufficient credits/i
  const wrapperText = wrapper && wrapper.is_error ? String(wrapper.result ?? JSON.stringify(wrapper)) : ''
  if (QUOTA_RE.test(blob) || QUOTA_RE.test(wrapperText)) {
    return {
      kind: '402',
      message: `taste-evaluate: claude CLI limit/quota: ${(wrapperText || blob).trim().slice(0, 300)}. Both judges unreachable. Do not invent demoMatch. Leave the node in_progress.`,
    }
  }
  if (status !== 0 && status != null) {
    return { kind: 'error', message: `taste-evaluate: claude CLI exited ${status}: ${(blob.trim() || wrapperText).slice(0, 400)}` }
  }
  if (!wrapper || typeof wrapper !== 'object') {
    return { kind: 'error', message: 'taste-evaluate: claude CLI did not return its --output-format json wrapper.' }
  }
  if (wrapper.is_error) {
    return { kind: 'error', message: `taste-evaluate: claude CLI reported an error: ${wrapperText.slice(0, 400)}` }
  }
  return null
}

/**
 * The model id the claude CLI actually answered with, off the wrapper's
 * `modelUsage` keys; falls back to the alias's canonical id.
 */
export function claudeModelFromWrapper(wrapper, alias) {
  const usage = wrapper && typeof wrapper === 'object' ? wrapper.modelUsage : null
  if (usage && typeof usage === 'object') {
    const ids = Object.keys(usage).filter((k) => /^claude-/.test(k))
    if (ids.length) return ids[0]
  }
  return FALLBACK_EVALUATORS[alias] ?? FALLBACK_EVALUATORS.sonnet
}

/** Problems on a parsed evaluator object. Empty = schema ok (booleans may still be false). */
export function evaluatorResultProblems(parsed, { competitiveBrief = null } = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['taste-evaluate: evaluator JSON missing. Do not invent demoMatch. Leave the node in_progress.']
  }
  if (typeof parsed.demoMatch !== 'boolean') {
    return ['taste-evaluate: demoMatch must be true or false. The catalog demo is the UX bar.']
  }
  if (competitiveBrief) {
    const pass = parsed.competitiveBriefPass
    const checklist = parsed.competitiveBriefChecklist
    const hasChecklist = checklist && typeof checklist === 'object' && !Array.isArray(checklist)
    if (typeof pass !== 'boolean' && !hasChecklist) {
      return [
        'taste-evaluate: competitiveBriefPass must be true or false when the route has a competitiveBrief. Omitting it is refuse. Do not invent true.',
      ]
    }
  }
  return []
}

export function demoMatchBlocksDone(parsed) {
  return !parsed || typeof parsed !== 'object' || parsed.demoMatch !== true
}

export function competitiveBriefBlocksDone(parsed, { competitiveBrief = null } = {}) {
  if (!competitiveBrief) return false
  if (!parsed || typeof parsed !== 'object') return true
  if (parsed.competitiveBriefPass === true) return false
  const checklist = parsed.competitiveBriefChecklist
  if (checklist && typeof checklist === 'object' && !Array.isArray(checklist)) {
    const ids = Array.isArray(competitiveBrief.beats) ? competitiveBrief.beats.map((b) => String(b.id)) : []
    if (ids.length && ids.every((id) => checklist[id] === true)) return false
  }
  return true
}

export function evaluatorBlocksDone(parsed, { competitiveBrief = null } = {}) {
  return demoMatchBlocksDone(parsed) || competitiveBriefBlocksDone(parsed, { competitiveBrief })
}

export function evaluatorEnvelope({ parsed, shots, evaluatorModel = EVALUATOR_MODEL, transport = 'grok-cli', extra = {} }) {
  return {
    evaluatorModel,
    rubricVersion: RUBRIC_VERSION,
    transport,
    shots,
    result: parsed,
    ...extra,
  }
}
