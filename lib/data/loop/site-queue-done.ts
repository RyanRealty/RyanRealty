/**
 * SITE-* node-complete gate, the server twin of scripts/lib/taste-receipt.mjs
 * `siteQueueDoneEvidenceProblems` (so the DAL does not import the receipt CLI).
 *
 * Matt 2026-09-23 (visibility audit PROCESS-3 / UXLIVE-11): the site queue is
 * scored on being seen and converting (docs/RUN_LOOP.md §1); the taste median
 * is a floor that may not regress, and `demoMatch` / `competitiveBriefPass`
 * are recorded notes, not completion gates. "Don't assume any rules from the
 * past that might keep us from hitting our goals are permanent." Evidence: no
 * class ever reached the 70 finish line (best 67 of 27), so SITE nodes could
 * not close on a better-ranking page.
 *
 * What this still refuses:
 *   - empty evidence (a node is done when the environment says so);
 *   - a judge failure (402, CLI missing) offered with no signed receipt behind
 *     it: a failed judge is not a score;
 *   - a receipt whose median fell on the same instrument by the rise floor or
 *     more (the look regressed), or whose honesty fell;
 *   - "Tip Ready" prose without `node scripts/lib/taste-receipt.mjs --ship`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The judge chain (scripts/lib/taste-evaluate-result.mjs): grok-4.6 first,
 * the claude CLI (sonnet, or opus when the builder was sonnet) when grok is
 * missing or answers 402. Keep this list equal to ALLOWED_EVALUATORS there.
 */
const TIP_READY_EVALUATORS = ['grok-4.6', 'claude-sonnet-5', 'claude-opus-5'] as const
const HASH_RE = /^sha256:[0-9a-f]{64}$/
const JUDGE_UNREACHABLE_RE =
  /\b402\b|payment required|balance exhausted|no grok CLI|grok CLI missing|GROK_CLI|claude CLI missing|both judges/i

/**
 * Mirrors RISE_FLOOR / RISE_FLOOR_FROM in scripts/lib/taste-receipt.mjs (pinned
 * by ci:rubric-freeze to design_system/public/taste-rule-freeze.json). The
 * site-queue-done test fails if these drift from that manifest.
 */
export const SITE_DONE_RISE_FLOOR = 3
export const SITE_DONE_RISE_FLOOR_FROM = '2026-09-13'

function isTipReadyEvaluator(model: unknown): boolean {
  const m = String(model ?? '').trim()
  if (!m) return false
  if ((TIP_READY_EVALUATORS as readonly string[]).includes(m)) return true
  return /^claude-(sonnet|opus)-\d/.test(m)
}

type PriorMark = {
  score?: unknown
  evaluatorModel?: unknown
  rubricVersion?: unknown
  criteria?: unknown
  perCriterion?: unknown
}

export type SiteQueueTasteReview = {
  competitiveBriefPass?: unknown
  demoMatch?: unknown
  evaluatorModel?: unknown
  rubricVersion?: unknown
  evaluatedAt?: unknown
  score?: unknown
  comparedToPrior?: unknown
  priorMark?: PriorMark | null
  criteria?: unknown
  perCriterion?: unknown
  shotsHash?: unknown
  competitiveBrief?: unknown
  adaptedFrom?: unknown
  shots?: unknown
  shotSpec?: unknown
}

export type SiteQueueDoneOpts = {
  versionGap?: string | null
  /** Accepted for older callers; a brief no longer changes what done requires. */
  competitiveBriefRequired?: boolean
  tasteReview?: SiteQueueTasteReview | null
  competitiveBrief?: unknown
  parity?: { tasteReview?: SiteQueueTasteReview; competitiveBrief?: unknown } | null
  loadParity?: boolean
  root?: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function resolveSiteQueueKit(evidence: string, versionGap?: string | null): string | null {
  const gap = String(versionGap ?? '')
  const text = String(evidence ?? '')
  const fromPath = text.match(/ui_kits\/([a-z0-9-]+)/i)
  if (fromPath) return fromPath[1]
  const fromEval = text.match(/taste-evaluate(?:\.ts)?\s+([a-z0-9-]+)/i)
  if (fromEval) return fromEval[1]
  if (/SITE-90/.test(gap)) return 'about'
  if (/SITE-80|SITE-63/.test(gap)) return 'contact'
  if (/SITE-74/.test(gap)) return 'team'
  return null
}

function loadKitParity(kit: string | null, root = process.cwd()): Record<string, unknown> | null {
  if (!kit) return null
  const rel = join(root, 'design_system/ryan-realty/ui_kits', kit, 'parity.json')
  if (!existsSync(rel)) return null
  try {
    const parsed = JSON.parse(readFileSync(rel, 'utf8')) as unknown
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function hasStructuredBrief(raw: unknown): boolean {
  if (!isPlainObject(raw) || !Array.isArray(raw.beats)) return false
  return raw.beats.some((b) => {
    if (!isPlainObject(b)) return false
    return String(b.id ?? '').trim() !== '' && String(b.text ?? '').trim().length >= 20
  })
}

function isHouseAdaptedId(id: unknown): boolean {
  const s = String(id ?? '')
  return /^(house-|listing-|V3)/.test(s) || s.startsWith('components/')
}

function adaptedFromCatalogIds(adaptedFrom: unknown): string[] {
  if (!Array.isArray(adaptedFrom)) return []
  return adaptedFrom
    .map((hit) => (isPlainObject(hit) ? hit.id : hit))
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && !isHouseAdaptedId(id))
}

function criterionScore(obj: unknown, names: string[]): number | null {
  if (!isPlainObject(obj)) return null
  const c = isPlainObject(obj.criteria) ? obj.criteria : isPlainObject(obj.perCriterion) ? obj.perCriterion : null
  if (!c) return null
  for (const n of names) {
    const v = c[n]
    if (typeof v === 'number' && Number.isInteger(v)) return v
  }
  return null
}

/** One less than the rise floor: the judge cannot tell a smaller move from its own noise. */
export function regressionTolerance(evaluatedAt: unknown): number {
  return (String(evaluatedAt ?? '') >= SITE_DONE_RISE_FLOOR_FROM ? SITE_DONE_RISE_FLOOR : 1) - 1
}

/** The look floor: no median fall on the same instrument, no honesty fall. */
export function tasteFloorProblems(tr: SiteQueueTasteReview | null | undefined): string[] {
  if (!isPlainObject(tr)) return []
  const p: string[] = []
  const prior = isPlainObject(tr.priorMark) ? (tr.priorMark as PriorMark) : null
  const cmp = String(tr.comparedToPrior ?? '')
  const sameInstrument =
    prior != null &&
    String(prior.evaluatorModel ?? '') === String(tr.evaluatorModel ?? '') &&
    String(prior.rubricVersion ?? '') === String(tr.rubricVersion ?? '')
  if (
    prior &&
    sameInstrument &&
    (cmp === 'rose' || cmp === 'held') &&
    typeof prior.score === 'number' &&
    Number.isInteger(prior.score) &&
    typeof tr.score === 'number' &&
    Number.isInteger(tr.score)
  ) {
    const tol = regressionTolerance(tr.evaluatedAt)
    if (tr.score < prior.score - tol) {
      p.push(
        `taste floor regressed: median ${tr.score} is ${prior.score - tr.score} under the prior mark ${prior.score} on the same instrument (a drop of ${tol + 1} or more is outside the judge's noise). Fix the page; taste may not regress (Matt 2026-09-23).`,
      )
    }
  }
  if (prior) {
    const next = criterionScore(tr, ['honestyFunction', 'honesty'])
    const prev = criterionScore(prior, ['honestyFunction', 'honesty'])
    if (prev != null && next == null) {
      p.push(`honestyFunction omitted while the prior mark recorded ${prev}. Record it; UI/UX cannot hide a drop in honesty (CLAUDE.md §0).`)
    } else if (prev != null && next != null && next < prev) {
      p.push(`honestyFunction ${next} fell below the prior mark ${prev}. UI/UX cannot buy a drop in honesty (CLAUDE.md §0).`)
    }
  }
  return p
}

function tipReadyReceiptProblems(
  tr: SiteQueueTasteReview | null | undefined,
  { competitiveBrief = null }: { competitiveBrief?: unknown } = {},
): string[] {
  if (!isPlainObject(tr)) {
    return ['tasteReview is required when evidence cites a score. Bare evidence prose is refuse.']
  }
  const p: string[] = []
  if (!isTipReadyEvaluator(tr.evaluatorModel)) {
    p.push(
      `evaluatorModel must be one of the judge chain (${TIP_READY_EVALUATORS.join(', ')}) — a mark from anywhere else is not a measurement. Leave the node in_progress.`,
    )
  }
  if (adaptedFromCatalogIds(tr.adaptedFrom).length && typeof tr.demoMatch !== 'boolean') {
    p.push('demoMatch must be recorded true or false when adaptedFrom names catalog modules (a note, not a gate). Do not invent it.')
  }
  if ((hasStructuredBrief(competitiveBrief) || hasStructuredBrief(tr.competitiveBrief)) && typeof tr.competitiveBriefPass !== 'boolean') {
    p.push('parity tasteReview.competitiveBriefPass must be recorded as the boolean the judge returned. Leave the node in_progress.')
  }
  if (tr.shotsHash != null && !HASH_RE.test(String(tr.shotsHash).trim())) {
    p.push('tasteReview.shotsHash must be sha256:<64 hex> like a v2 receipt.')
  }
  return p
}

export function siteQueueDoneEvidenceProblems(
  evidence: string,
  { versionGap, tasteReview, competitiveBrief, parity, loadParity, root }: SiteQueueDoneOpts = {},
): string[] {
  const gap = String(versionGap ?? '')
  if (gap && !/^SITE-\d+/.test(gap)) return []
  const text = String(evidence ?? '')
  if (!text.trim()) return ['evidence is required — a node is done when the environment says so']
  const judgeUnreachable = JUDGE_UNREACHABLE_RE.test(text)

  const kit = resolveSiteQueueKit(text, gap)
  const loaded = loadParity === false ? null : isPlainObject(parity) ? parity : loadKitParity(kit, root)
  const tr = isPlainObject(tasteReview) ? tasteReview : (loaded?.tasteReview as SiteQueueTasteReview | undefined)
  const brief = competitiveBrief ?? loaded?.competitiveBrief

  // A verdict is a note now, but it is still never invented: evidence that
  // claims true against a receipt that records false is refused.
  for (const key of ['demoMatch', 'competitiveBriefPass'] as const) {
    const claimsTrue = new RegExp(`\\b${key}\\b\\s*[:=]\\s*true\\b`, 'i').test(text)
    if (claimsTrue && isPlainObject(tr) && tr[key] === false) {
      return [`evidence says ${key}: true but the route's receipt records false. Do not invent a verdict.`]
    }
  }

  if (judgeUnreachable) {
    const receiptProblems = tipReadyReceiptProblems(tr, { competitiveBrief: brief })
    if (receiptProblems.length) {
      return [
        `evidence records a judge failure (402 / CLI missing); a failed judge is not a score. Either the look did not change (say so and cite no score) or the fallback verdict is on the route's parity.json tasteReview. ${receiptProblems[0]}`,
      ]
    }
  }
  if (isPlainObject(tr)) {
    const floor = tasteFloorProblems(tr)
    if (floor.length) return floor
  }
  if (/\bTip Ready\b/i.test(text) && !/--ship\b/.test(text) && !/\bship OK\b/i.test(text)) {
    return [
      'Tip Ready language without `node scripts/lib/taste-receipt.mjs --ship` exit 0 is refuse. Prose is not Tip Ready.',
    ]
  }
  return []
}
