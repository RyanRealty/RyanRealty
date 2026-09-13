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
import { readFileSync } from 'node:fs'

export const EVALUATOR_MODEL = 'grok-4.6'
/**
 * The SAME judge through the Cursor CLI (Matt 2026-09-12: "I now have grok 4.6
 * in cursor, can we use it there"). `cursor-agent --model <id>` on the Cursor
 * subscription (CURSOR_API_KEY stripped, `cursor-agent login` is the auth). It
 * is grok-4.6 either way, so a receipt signed through this link compares to a
 * grok-CLI mark; the link that answered is recorded as `transport`.
 */
export const CURSOR_JUDGE_MODEL = 'grok-4.6'
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

/** grok | sonnet | opus | null — the ruler family a model id belongs to. */
export function judgeFamily(model) {
  const m = String(model ?? '')
  if (/grok/i.test(m)) return 'grok'
  if (/sonnet/i.test(m)) return 'sonnet'
  if (/opus/i.test(m)) return 'opus'
  return null
}

/**
 * THE ROUND'S RULER (Matt 2026-09-12). The judge that scored the current
 * taste-table.json is the judge every route receipt in the round is compared
 * against. grok reads ~20 points under sonnet on the same page (about: 31 vs
 * 52), so a link flip mid-round turns every route's next pass into a
 * rebaseline instead of progress. The chain therefore starts at the table's
 * judge; grok gets the chair back at the next FULL table run, not on a route.
 * Returns { model, family } or { model: null, family: null } when no table.
 */
export function roundJudge(root, { readFile } = {}) {
  const read = readFile ?? ((p) => readFileSync(p, 'utf8'))
  try {
    const raw = read(`${root.replace(/\/$/, '')}/design_system/public/taste-table.json`)
    const instrument = JSON.parse(raw)?.instrument ?? {}
    const model = instrument.evaluatorModel
    const m = typeof model === 'string' && model.trim() && model !== 'mixed' ? model.trim() : null
    // The link that answered for the table (grok | cursor | claude), so a grok
    // round keeps ONE transport of grok-4.6 unless that transport is out.
    const link = typeof instrument.judgeLink === 'string' ? instrument.judgeLink : null
    return { model: m, family: judgeFamily(m), link }
  } catch {
    return { model: null, family: null, link: null }
  }
}

/**
 * The links to try, in order, for one route receipt.
 *   requested 'grok' | 'cursor' | 'claude' -> that link only (an explicit --evaluator).
 *   round judge sonnet/opus      -> the claude CLI on that alias; the OTHER
 *                                   alias when the builder is that family
 *                                   (a model never grades its own page).
 *   round judge grok, or no table -> grok-4.6 through the grok CLI and through
 *                                   the Cursor CLI (the round's link first),
 *                                   then claude by builder.
 * Each entry: { link: 'grok' } | { link: 'cursor', model } | { link: 'claude', alias, reason }.
 */
export function judgeOrder({ round = { model: null, family: null, link: null }, builderModel = null, requested = 'auto' } = {}) {
  const byBuilder = pickFallbackAlias(builderModel)
  if (requested === 'grok') return [{ link: 'grok', reason: '--evaluator grok' }]
  if (requested === 'cursor') return [{ link: 'cursor', model: CURSOR_JUDGE_MODEL, reason: '--evaluator cursor' }]
  if (requested === 'claude') return [{ link: 'claude', alias: byBuilder, reason: '--evaluator claude' }]
  if (round.family === 'sonnet' || round.family === 'opus') {
    const builderFamily = judgeFamily(builderModel)
    const alias = builderFamily === round.family ? (round.family === 'sonnet' ? 'opus' : 'sonnet') : round.family
    const reason =
      alias === round.family
        ? `round judge ${round.model} scored the current table; grok returns at the next full table run`
        : `round judge ${round.model} is the builder's family (${builderModel}); the other claude alias grades, and this route rebaselines`
    return [{ link: 'claude', alias, reason }]
  }
  const why = round.model ? `round judge ${round.model}` : 'no table judge on record; chain default'
  const grokCli = { link: 'grok', reason: `${why} — grok CLI` }
  const cursorCli = { link: 'cursor', model: CURSOR_JUDGE_MODEL, reason: `${why} — the same grok-4.6 through the Cursor CLI` }
  return [
    ...(round.link === 'cursor' ? [cursorCli, grokCli] : [grokCli, cursorCli]),
    { link: 'claude', alias: byBuilder, reason: 'both grok-4.6 links missing or out' },
  ]
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
 * Does `cursor-agent --list-models` name the judge? The CLI's `--model` is a
 * request; an id the account cannot serve must not quietly become "Auto" and
 * sign a receipt as grok-4.6. The id has to appear as its own token on a line.
 */
export function cursorModelListed(listOutput, model = CURSOR_JUDGE_MODEL) {
  const text = String(listOutput ?? '')
  if (!text.trim()) return false
  const id = model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w.-])${id}(?![\\w.-])`, 'm').test(text)
}

/**
 * Classify a `cursor-agent -p` run. Not logged in is 'missing' (the link is
 * not there until `cursor-agent login`), a usage cap or an unavailable model is
 * '402', anything else is a real error the caller must see. Both of the first
 * two hand the shots to the next link; neither invents a verdict.
 */
export function cursorCliFailure(status, stderr, stdout, { cliMissing = false } = {}) {
  const blob = `${stderr ?? ''}\n${stdout ?? ''}`
  if (cliMissing || status === 127 || /ENOENT|command not found|No such file or directory/i.test(blob)) {
    return {
      kind: 'missing',
      message: 'taste-evaluate: cursor-agent CLI missing. Do not invent demoMatch. Next link.',
    }
  }
  // `--list-models` prints "No models available for this account." when logged out.
  if (/authentication required|not logged in|please run .agent login|unauthori[sz]ed|\b401\b|no models available for this account/i.test(blob)) {
    return {
      kind: 'missing',
      message:
        'taste-evaluate: cursor-agent is not logged in (run `cursor-agent login` once, browser OAuth). Do not invent demoMatch. Next link.',
    }
  }
  if (
    /\b402\b|\b429\b|usage limit|rate.?limit|quota|out of (requests|credits)|payment required|billing|model (is )?not available|not available for (this|your) (account|plan)/i.test(
      blob,
    )
  ) {
    return {
      kind: '402',
      message: `taste-evaluate: cursor-agent limit/model unavailable: ${blob.trim().slice(0, 300)}. Do not invent demoMatch. Next link.`,
    }
  }
  if (status !== 0 && status != null) {
    return { kind: 'error', message: `taste-evaluate: cursor-agent exited ${status}: ${blob.trim().slice(0, 400)}` }
  }
  return null
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
  // 2026-09-13: the CLI said "You've hit your weekly limit · resets Sep 15" with
  // api_error_status 429 and this regex ("hit your limit") missed it, so 23 classes
  // were retried as "malformed". Match the wrapper's status code and the phrasing.
  const QUOTA_RE =
    /rate.?limit|\b429\b|usage limit|hit your (?:\w+ )?limit|(?:weekly|daily|session) limit|quota|payment required|\b402\b|billing|insufficient credits/i
  const wrapperText = wrapper && wrapper.is_error ? String(wrapper.result ?? JSON.stringify(wrapper)) : ''
  const apiStatus = wrapper && typeof wrapper === 'object' ? Number(wrapper.api_error_status) : NaN
  if (apiStatus === 429 || apiStatus === 402 || QUOTA_RE.test(blob) || QUOTA_RE.test(wrapperText)) {
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
