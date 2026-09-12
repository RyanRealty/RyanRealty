#!/usr/bin/env node
/**
 * taste-receipt.mjs — the tasteReview receipt contract (design_system/public/TASTE.md).
 *
 * A score is only a measurement if you can say what produced it. Before
 * 2026-09-08 a receipt was {evaluatedAt, score, beats, evaluator, shots} and two
 * marks from different models, against different shots, under a different
 * rubric, were compared as if they were the same instrument. SITE-11 recorded
 * "82 -> 81 -> 75 and 88 on the same commit"; SITE-M1 stalled on a human because
 * "the 88 mark came from a different evaluator against shots that no longer
 * exist". Both are the same bug: the receipt did not record the instrument.
 *
 * This module is the shape and the two computations the gate cannot guess:
 * the median of the three scorings, and the hash of the shots the score was
 * given for. `scripts/check-taste-canon.mjs` imports it; a lane runs it as a
 * CLI to get the hash for the receipt it is about to write.
 *
 *   node scripts/lib/taste-receipt.mjs design_system/ryan-realty/ui_kits/sell/parity.json
 *   node scripts/lib/taste-receipt.mjs desktop=path/a.png mobile375=path/b.png
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Receipts evaluated on or after this date must carry the v2 fields. */
export const RECEIPT_V2_FROM = '2026-09-08'

/**
 * Catalog demoMatch rule (Matt 2026-09-12). Receipts on this date / rubric
 * that name a catalog adaptedFrom id cannot claim rise or the 70 finish
 * line without demoMatch: true. Older receipts stay valid so ci:taste-canon
 * stays green for honest pre-rule marks.
 */
export const DEMO_MATCH_RULE_FROM = '2026-09-12'
export const DEMO_MATCH_RUBRIC = 'v1-2026-09-12'
export const FINISH_LINE = 70

/** The three identity keys that decide whether two marks are the same instrument. */
export const IDENTITY_KEYS = ['evaluatorModel', 'rubricVersion', 'shotsHash']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** A model id, not a sentence: no whitespace, no prose. */
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,63}$/
const RUBRIC_RE = /^v\d+-\d{4}-\d{2}-\d{2}$/
const HASH_RE = /^sha256:[0-9a-f]{64}$/

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function isNonEmptyString(v, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

/** Path guard shared with the gate: repo-relative, no traversal, on disk. */
export function shotOk(root, rel) {
  if (typeof rel !== 'string' || !rel.trim()) return false
  if (rel.includes('..') || rel.startsWith('/')) return false
  return existsSync(join(root, rel))
}

export function sha256File(abs) {
  return createHash('sha256').update(readFileSync(abs)).digest('hex')
}

/**
 * The hash the receipt binds its score to. Every shot in the `shots` block
 * counts, in sorted key order, so adding, dropping, or re-capturing any shot
 * changes the hash and the old mark stops being a baseline.
 * Returns null when a shot is missing — a hash over files that are not there
 * would be a fiction.
 */
export function shotsHashFor(root, shots) {
  if (!isPlainObject(shots)) return null
  const keys = Object.keys(shots).sort()
  if (keys.length === 0) return null
  const h = createHash('sha256')
  for (const k of keys) {
    const rel = shots[k]
    if (!shotOk(root, rel)) return null
    h.update(`${k}\n${sha256File(join(root, rel))}\n`)
  }
  return `sha256:${h.digest('hex')}`
}

/** The median of exactly three scorings. */
export function median3(nums) {
  if (!Array.isArray(nums) || nums.length !== 3) return null
  if (!nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) return null
  return [...nums].sort((a, b) => a - b)[1]
}

/** Receipts on or after the cutoff owe the v2 fields. */
export function isV2Receipt(tr) {
  return isPlainObject(tr) && DATE_RE.test(String(tr.evaluatedAt ?? '')) && String(tr.evaluatedAt) >= RECEIPT_V2_FROM
}

/**
 * Which identity keys differ between this receipt and the prior mark it names.
 * A prior mark that differs on any of them was produced by a different
 * instrument and is not a valid baseline.
 */
export function identityDrift(tr, prior) {
  if (!isPlainObject(prior)) return [...IDENTITY_KEYS]
  return IDENTITY_KEYS.filter((k) => String(prior[k] ?? '') !== String(tr[k] ?? ''))
}

/**
 * Every v2 rule, as a list of plain problems. Empty array = the receipt passes.
 * `rubricText` is design_system/public/TASTE.md — a rubricVersion that does not
 * appear there is a rubric nobody can read.
 */
export function receiptV2Problems(tr, { root, rubricText, headReceipt = null, competitiveBrief = null } = {}) {
  const p = []
  if (!isPlainObject(tr)) return ['tasteReview is not an object.']

  // 1. Who scored it, and on which model.
  if (!isNonEmptyString(tr.evaluatorModel) || !MODEL_RE.test(tr.evaluatorModel.trim())) {
    p.push('evaluatorModel must be the model string itself (e.g. "claude-opus-4-1"), not a sentence.')
  }
  if (!isNonEmptyString(tr.builderModel) || !MODEL_RE.test(tr.builderModel.trim())) {
    p.push('builderModel must be the model string that BUILT the page, so the different-model rule is checkable.')
  }
  if (
    isNonEmptyString(tr.evaluatorModel) &&
    isNonEmptyString(tr.builderModel) &&
    tr.evaluatorModel.trim() === tr.builderModel.trim()
  ) {
    p.push(
      `evaluatorModel and builderModel are both "${tr.builderModel.trim()}" — the evaluator is a SEPARATE agent on a DIFFERENT model from the builder (TASTE.md).`,
    )
  }

  // 2. Which rubric produced the number.
  if (!isNonEmptyString(tr.rubricVersion) || !RUBRIC_RE.test(tr.rubricVersion.trim())) {
    p.push('rubricVersion must look like "v1-2026-09-08" — a rubric change has to be visible in the receipt.')
  } else if (typeof rubricText === 'string' && !rubricText.includes(tr.rubricVersion.trim())) {
    p.push(
      `rubricVersion "${tr.rubricVersion.trim()}" appears nowhere in design_system/public/TASTE.md. Record the version there before scoring against it.`,
    )
  }

  // 3. What was captured.
  const spec = tr.shotSpec
  if (!isPlainObject(spec)) {
    p.push('shotSpec is missing: { routes: [...], viewports: [1440, 375], states: [...] }.')
  } else {
    if (!Array.isArray(spec.routes) || spec.routes.length === 0 || !spec.routes.every((r) => isNonEmptyString(r))) {
      p.push('shotSpec.routes must be a non-empty list of the routes that were captured.')
    }
    const vps = Array.isArray(spec.viewports) ? spec.viewports.filter((n) => Number.isFinite(n)) : []
    if (!vps.includes(375) || !vps.some((n) => n >= 1280)) {
      p.push('shotSpec.viewports must include 375 and a desktop width of 1280 or more (TASTE.md: desktop and 375px).')
    }
    if (!Array.isArray(spec.states) || spec.states.length === 0 || !spec.states.every((s) => isNonEmptyString(s))) {
      p.push('shotSpec.states must name the states captured (e.g. "default", "answer-open", "sent").')
    }
  }

  // 4. The shots the score was given for, bound by hash.
  if (!isNonEmptyString(tr.shotsHash) || !HASH_RE.test(tr.shotsHash.trim())) {
    p.push('shotsHash must be "sha256:<64 hex>" — run `node scripts/lib/taste-receipt.mjs <parity.json>`.')
  } else {
    const actual = shotsHashFor(root, tr.shots)
    if (!actual) {
      p.push('shotsHash cannot be verified: a file named in shots is not on disk.')
    } else if (actual !== tr.shotsHash.trim()) {
      p.push(
        `shotsHash ${tr.shotsHash.trim()} does not match the shots on disk (${actual}). The score belongs to shots that changed; re-score or re-hash.`,
      )
    }
  }

  // 5. Three scorings, one median. One pass is noise (SITE-11: 82, 81, 75, 88).
  const med = median3(tr.scores)
  if (med === null) {
    p.push('scores must be three integers 0-100 — the same shots scored three times in one evaluator call.')
  } else if (tr.score !== med) {
    p.push(`score ${tr.score} is not the median of scores ${JSON.stringify(tr.scores)} (median ${med}).`)
  }

  // 6. Named findings. A bare number is not a review.
  if (!Array.isArray(tr.defects)) {
    p.push('defects must be an array of { section, finding } — a score with no named findings is a bare number.')
  } else {
    const bad = tr.defects.filter((d) => !isPlainObject(d) || !isNonEmptyString(d.section) || !isNonEmptyString(d.finding, 10))
    if (bad.length > 0) p.push(`defects has ${bad.length} entry(ies) without a section and a finding of 10+ characters.`)
    if (tr.defects.length === 0 && Number.isFinite(tr.score) && tr.score < 95) {
      p.push(`defects is empty at score ${tr.score}. Below 95 the rubric lost points somewhere — name where.`)
    }
  }

  // 7. What this mark was compared to, and whether the comparison was legal.
  const cmp = String(tr.comparedToPrior ?? '')
  const prior = tr.priorMark
  // The committed receipt for this route is a prior mark whether or not the new
  // one admits it. "first" is not an exit from the rise rule.
  const headScored =
    isPlainObject(headReceipt) && Number.isInteger(headReceipt.score) && JSON.stringify(headReceipt) !== JSON.stringify(tr)
      ? headReceipt
      : null
  if (headScored && (cmp === 'first' || prior == null)) {
    p.push(
      `this route's committed tasteReview already scored ${headScored.score} on ${headScored.evaluatedAt}. Name it in priorMark and set comparedToPrior "rose" or "rebaselined" — "first" is not an exit from the rise rule.`,
    )
  }
  if (!['first', 'rose', 'rebaselined'].includes(cmp)) {
    p.push('comparedToPrior must be "first", "rose", or "rebaselined".')
  } else if (cmp === 'first') {
    if (prior != null) p.push('comparedToPrior "first" but priorMark is set. A first mark has no prior.')
  } else {
    if (!isPlainObject(prior)) {
      p.push(`comparedToPrior "${cmp}" needs priorMark: { evaluatedAt, score, ${IDENTITY_KEYS.join(', ')} }.`)
    } else if (!Number.isInteger(prior.score)) {
      p.push('priorMark.score must be the integer mark it is being compared to.')
    } else {
      const drift = identityDrift(tr, prior)
      if (cmp === 'rose') {
        if (drift.length > 0) {
          p.push(
            `comparedToPrior "rose" but the prior mark differs on ${drift.join(', ')} — a different instrument is NOT a baseline. Set comparedToPrior "rebaselined".`,
          )
        } else if (!(Number.isInteger(tr.score) && tr.score > prior.score)) {
          p.push(`score ${tr.score} did not rise above the prior mark ${prior.score}. The item is not done (TASTE.md).`)
        }
      } else {
        if (drift.length === 0) {
          p.push(
            'comparedToPrior "rebaselined" but the prior mark matches on evaluatorModel, rubricVersion and shotsHash — it IS comparable, so the score must rise.',
          )
        } else if (!isNonEmptyString(tr.rebaselineReason, 10) || !drift.some((k) => tr.rebaselineReason.includes(k))) {
          p.push(`rebaselineReason must name the key(s) that differ: ${drift.join(', ')}.`)
        }
      }
    }
  }

  // 8. UI/UX may rise; honesty cannot fall or be omitted to skip the hold
  //    (Matt 2026-09-10). requiredComponents / JSON-LD / ask roles are held
  //    against HEAD in check-taste-canon.mjs. Payload and tap targets stay
  //    on ci:runtime-gates (shrink-only). Titles/JSON-LD source presence stay
  //    on ci:seo-shell / ci:ai-structured-data.
  const holdPrior = isPlainObject(tr.priorMark) ? tr.priorMark : headScored
  p.push(...productHoldProblems(tr, holdPrior))
  if (headScored && holdPrior !== headScored) p.push(...productHoldProblems(tr, headScored))

  // 9. Catalog adaptedFrom + rise/done without demoMatch true is a cream box
  //    (Matt 2026-09-12). Score rise is not Tip Ready.
  p.push(...catalogDemoMatchProblems(tr))

  // 10. Per-route competitiveBrief (About first, Matt 2026-09-12). Rise / 70
  //     without competitiveBriefPass true (or checklist all true) is refuse.
  //     Omit is refuse. Do not invent true.
  p.push(...competitiveBriefProblems(tr, competitiveBrief))

  return p
}

/** House ids are files we already own. Catalog ids must show a real demo match. */
export function isHouseAdaptedId(id) {
  const s = String(id ?? '')
  return /^(house-|listing-|V3)/.test(s) || s.startsWith('components/')
}

export function adaptedFromCatalogIds(adaptedFrom) {
  if (!Array.isArray(adaptedFrom)) return []
  return adaptedFrom
    .map((hit) => (isPlainObject(hit) ? hit.id : hit))
    .filter((id) => isNonEmptyString(id) && !isHouseAdaptedId(id))
}

export function underDemoMatchRule(tr) {
  if (!isPlainObject(tr)) return false
  const evaluatedAt = String(tr.evaluatedAt ?? '')
  const rubric = String(tr.rubricVersion ?? '')
  return evaluatedAt >= DEMO_MATCH_RULE_FROM || rubric >= DEMO_MATCH_RUBRIC
}

/**
 * A catalog-class receipt that claims rise or the finish line without
 * demoMatch: true is not done. Omitting demoMatch on a post-rule receipt
 * is the same as false.
 */
export function catalogDemoMatchProblems(tr) {
  if (!isPlainObject(tr)) return []
  const catalogIds = adaptedFromCatalogIds(tr.adaptedFrom)
  if (catalogIds.length === 0) return []
  if (!underDemoMatchRule(tr)) return []

  const named = catalogIds.join(', ')
  const demo = tr.demoMatch
  const p = []
  if (typeof demo !== 'boolean') {
    p.push(
      `demoMatch must be true or false when adaptedFrom names catalog modules (${named}). Omitting it is a cream-box receipt.`,
    )
  }
  const claimsRiseOrDone =
    String(tr.comparedToPrior ?? '') === 'rose' || (Number.isInteger(tr.score) && tr.score >= FINISH_LINE)
  if (claimsRiseOrDone && demo !== true) {
    p.push(
      `score rise / finish line is not done while demoMatch is ${demo === false ? 'false' : 'missing'} (adaptedFrom: ${named}). A cream-box import is not a demo match. Leave the node in_progress.`,
    )
  }
  return p
}

/**
 * Per-route Researchy checklist (About first, Matt 2026-09-12). Structured
 * beats, not a prose competitiveTarget. A score that ignores the brief is
 * the same class of lie as omitting demoMatch.
 */
export const COMPETITIVE_BRIEF_RULE_FROM = '2026-09-12'

export function parseCompetitiveBrief(raw) {
  if (!isPlainObject(raw)) return null
  const beats = []
  for (const b of Array.isArray(raw.beats) ? raw.beats : []) {
    if (!isPlainObject(b)) continue
    const id = String(b.id ?? '').trim()
    const text = String(b.text ?? '').trim()
    if (!id || text.length < 20) continue
    beats.push({
      id,
      text,
      pass: typeof b.pass === 'boolean' ? b.pass : null,
    })
  }
  if (beats.length === 0) return null
  return {
    id: isNonEmptyString(raw.id) ? raw.id : null,
    source: isNonEmptyString(raw.source) ? raw.source : '',
    productLock: isNonEmptyString(raw.productLock) ? raw.productLock : '',
    refuse: isNonEmptyString(raw.refuse) ? raw.refuse : '',
    beats,
  }
}

export function competitiveBriefShapeProblems(raw, { minBeats = 8, label = 'competitiveBrief' } = {}) {
  if (!isPlainObject(raw)) {
    return [`${label} must be a structured checklist ({ id, source, beats[] }), not prose.`]
  }
  const brief = parseCompetitiveBrief(raw)
  if (!brief) {
    return [`${label}.beats must be objects with id and 20+ character text.`]
  }
  if (brief.beats.length < minBeats) {
    return [`${label} must list ${minBeats} Researchy beats (has ${brief.beats.length}).`]
  }
  return []
}

/**
 * true | false | undefined (omit / incomplete). Checklist all true is a pass.
 * A lone `competitiveBriefPass: true` with a partial false checklist is false.
 */
export function competitiveBriefVerdict(tr, brief) {
  if (!parseCompetitiveBrief(brief) && !isPlainObject(tr)) return undefined
  const parsed = parseCompetitiveBrief(brief)
  if (!parsed) return undefined

  const checklist = isPlainObject(tr?.competitiveBriefChecklist) ? tr.competitiveBriefChecklist : null
  let fromChecklist
  if (checklist) {
    const missing = parsed.beats.some((b) => typeof checklist[b.id] !== 'boolean')
    if (missing) return undefined
    fromChecklist = parsed.beats.every((b) => checklist[b.id] === true)
  }

  const reviewBrief = parseCompetitiveBrief(tr?.competitiveBrief)
  let fromReviewBeats
  if (reviewBrief && reviewBrief.beats.every((b) => typeof b.pass === 'boolean')) {
    fromReviewBeats = reviewBrief.beats.every((b) => b.pass === true)
  }

  const pass = tr?.competitiveBriefPass
  const named = typeof pass === 'boolean' ? pass : null

  if (named === false || fromChecklist === false || fromReviewBeats === false) return false
  if (named === true || fromChecklist === true || fromReviewBeats === true) {
    if (fromChecklist === false || fromReviewBeats === false) return false
    return true
  }
  return undefined
}

export function underCompetitiveBriefRule(tr) {
  if (!isPlainObject(tr)) return false
  const evaluatedAt = String(tr.evaluatedAt ?? '')
  const rubric = String(tr.rubricVersion ?? '')
  return evaluatedAt >= COMPETITIVE_BRIEF_RULE_FROM || rubric >= DEMO_MATCH_RUBRIC
}

/**
 * A route that publishes a competitiveBrief cannot claim rise or the finish
 * line without competitiveBriefPass: true (or checklist all true). Omit is
 * refuse. Honest false below 70 on a rebaseline stays valid.
 */
export function competitiveBriefProblems(tr, brief) {
  const parsed = parseCompetitiveBrief(brief)
  if (!parsed) return []
  if (!isPlainObject(tr)) return ['tasteReview is not an object.']
  if (!underCompetitiveBriefRule(tr)) return []

  const verdict = competitiveBriefVerdict(tr, parsed)
  const p = []
  if (verdict === undefined) {
    p.push(
      'competitiveBriefPass must be true or false when the route has a competitiveBrief. Omitting it is refuse. Do not invent true. Checklist all true is the other pass path.',
    )
  }
  const claimsRiseOrDone =
    String(tr.comparedToPrior ?? '') === 'rose' || (Number.isInteger(tr.score) && tr.score >= FINISH_LINE)
  if (claimsRiseOrDone && verdict !== true) {
    p.push(
      `score rise / finish line is not done while competitiveBriefPass is ${verdict === false ? 'false' : 'missing'}. Looking that invents past the Researchy checklist is refuse. Leave the node in_progress.`,
    )
  }
  return p
}

/**
 * Tip Ready / node-complete: the receipt itself must show demoMatch true
 * and, when a competitiveBrief exists, competitiveBriefPass true.
 * Used by completeWorkNode and `node scripts/lib/taste-receipt.mjs --ship`.
 */
export function tasteDoneProblems(tr, { competitiveBrief = null } = {}) {
  if (!isPlainObject(tr)) return ['tasteReview is required to mark a SITE node done.']
  const catalogIds = adaptedFromCatalogIds(tr.adaptedFrom)
  const p = []
  if (typeof tr.demoMatch !== 'boolean') {
    p.push('demoMatch must be true or false — do not invent it. Leave the node in_progress.')
  } else if (tr.demoMatch !== true) {
    p.push('demoMatch is false. The live control is not the catalog demo. Not done; leave the node in_progress.')
  }
  if (catalogIds.length && tr.demoMatch !== true) {
    p.push(
      `adaptedFrom names catalog modules (${catalogIds.join(', ')}) but demoMatch is not true. File-on-disk / score rise is not a demo match.`,
    )
  }
  const parsed = parseCompetitiveBrief(competitiveBrief) || parseCompetitiveBrief(tr.competitiveBrief)
  if (parsed) {
    const verdict = competitiveBriefVerdict(tr, parsed)
    if (verdict === undefined) {
      p.push(
        'competitiveBriefPass must be true or false — do not invent it. Leave the node in_progress.',
      )
    } else if (verdict !== true) {
      p.push(
        'competitiveBriefPass is false. The page does not hit the Researchy checklist. Not done; leave the node in_progress.',
      )
    }
  }
  return p
}

/**
 * SITE-* done evidence must record a grok-4.6 demoMatch: true.
 * CLI missing / 402 in the evidence is an honest fail, not Tip Ready.
 */
export function siteQueueDoneEvidenceProblems(evidence, { versionGap, competitiveBriefRequired } = {}) {
  const gap = String(versionGap ?? '')
  if (gap && !/^SITE-\d+/.test(gap)) return []
  const text = String(evidence ?? '')
  if (!text.trim()) return ['evidence is required — a node is done when the environment says so']
  if (/\b402\b/.test(text) && /grok|taste-evaluate|quota|payment required/i.test(text)) {
    return ['grok CLI 402 — do not invent demoMatch. Leave the node in_progress.']
  }
  if (/no grok CLI|grok CLI missing|GROK_CLI/i.test(text)) {
    return ['grok CLI missing — do not invent demoMatch. Leave the node in_progress.']
  }
  if (/\bdemoMatch\b\s*[:=]\s*false\b/i.test(text)) {
    return ['evidence records demoMatch false — not done. Leave the node in_progress.']
  }
  if (!/\bdemoMatch\b\s*[:=]\s*true\b/i.test(text)) {
    return [
      'SITE done evidence must include demoMatch: true from grok-4.6. Score rise without a demo match is not Tip Ready.',
    ]
  }
  if (/\bcompetitiveBriefPass\b\s*[:=]\s*false\b/i.test(text)) {
    return [
      'evidence records competitiveBriefPass false — Looking invented past the brief, or the checklist is not all true. Not done. Leave the node in_progress.',
    ]
  }
  const needsBrief =
    competitiveBriefRequired === true ||
    /SITE-90/.test(gap) ||
    /taste-evaluate(?:\.ts)?\s+about\b/i.test(text) ||
    /ui_kits\/about/i.test(text)
  if (needsBrief && !/\bcompetitiveBriefPass\b\s*[:=]\s*true\b/i.test(text)) {
    return [
      'SITE done evidence must include competitiveBriefPass: true (or checklist all true). Score rise without the Researchy brief is not Tip Ready.',
    ]
  }
  return []
}

function criterionScore(obj, names) {
  const c = isPlainObject(obj?.criteria) ? obj.criteria : isPlainObject(obj?.perCriterion) ? obj.perCriterion : null
  if (!c) return null
  for (const n of names) {
    if (Number.isInteger(c[n])) return c[n]
  }
  return null
}

/**
 * A prettier page that scores lower on honesty than the prior mark on the
 * same instrument is not done. Design/originality/interaction may move;
 * honestyFunction (HF/10) must hold or rise when the prior recorded it.
 * Omitting the criterion to skip the hold is the same as dropping it.
 */
export function productHoldProblems(tr, prior) {
  if (!isPlainObject(tr) || !isPlainObject(prior)) return []
  const next = criterionScore(tr, ['honestyFunction', 'honesty'])
  const prev = criterionScore(prior, ['honestyFunction', 'honesty'])
  if (prev != null && next == null) {
    return [
      `honestyFunction omitted while the prior mark recorded ${prev}. Record it; UI/UX cannot hide a drop in honesty (CLAUDE.md §0).`,
    ]
  }
  if (next == null || prev == null) return []
  if (next < prev) {
    return [
      `honestyFunction ${next} fell below the prior mark ${prev}. UI/UX cannot buy a drop in honesty (CLAUDE.md §0).`,
    ]
  }
  return []
}

/** Names from a parity.json requiredComponents list (strings or {name}). */
export function componentNames(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((c) => (typeof c === 'string' ? c : isPlainObject(c) ? String(c.name ?? '') : ''))
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Product roles a taste pass may rename but must not delete. JSON-LD and the
 * conversion ask are the ones a prettier fold most often drops; titles, tap
 * targets, and payload stay on their own gates.
 */
export const PRODUCT_HOLD_ROLES = Object.freeze([
  { id: 'json-ld', label: 'JSON-LD', re: /MetadataBlock|JsonLd|jsonld|JSON-LD/i },
  {
    id: 'ask',
    label: 'conversion ask',
    re: /Ask|AlertsSheet|StickyAsk|LeadCapture|ContactForm|CtaStrip|PriceCta|SearchAlert/i,
  },
])

/**
 * requiredComponents may grow or rename. It may not shrink, and a JSON-LD or
 * conversion-ask role present at HEAD must still be present (ContactAsk →
 * V3Ask is a rename, not a drop).
 */
export function requiredComponentsHoldProblems(currentList, headList) {
  const p = []
  const current = componentNames(currentList)
  const head = componentNames(headList)
  if (head.length === 0) return p
  if (current.length < head.length) {
    p.push(
      `requiredComponents shrank ${head.length} → ${current.length}. UI/UX cannot drop a required section.`,
    )
  }
  for (const role of PRODUCT_HOLD_ROLES) {
    const had = head.filter((n) => role.re.test(n))
    const has = current.some((n) => role.re.test(n))
    if (had.length > 0 && !has) {
      p.push(
        `${role.label} dropped from requiredComponents (had ${had.join(', ')}). UI/UX cannot drop it.`,
      )
    }
  }
  return p
}

/* CLI: print the shotsHash for a parity.json, or for key=path pairs.
 * `--ship <parity.json>` is the Tip Ready / node-complete gate. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd()
  const args = process.argv.slice(2)
  if (args[0] === '--ship') {
    const rel = args[1]
    if (!rel) {
      console.error('usage: node scripts/lib/taste-receipt.mjs --ship <parity.json>')
      process.exit(2)
    }
    const d = JSON.parse(readFileSync(join(root, rel), 'utf8'))
    const problems = tasteDoneProblems(d?.tasteReview, { competitiveBrief: d?.competitiveBrief ?? null })
    if (problems.length) {
      console.error(problems.join('\n'))
      process.exit(1)
    }
    console.log(
      parseCompetitiveBrief(d?.competitiveBrief)
        ? 'ship OK — demoMatch true · competitiveBriefPass true'
        : 'ship OK — demoMatch true',
    )
    process.exit(0)
  }
  if (args.length === 0) {
    console.error(
      'usage: node scripts/lib/taste-receipt.mjs <parity.json> | --ship <parity.json> | key=path [key=path ...]',
    )
    process.exit(2)
  }
  let shots
  if (args.length === 1 && args[0].endsWith('.json')) {
    const d = JSON.parse(readFileSync(join(root, args[0]), 'utf8'))
    shots = d?.tasteReview?.shots
    if (!isPlainObject(shots)) {
      console.error(`${args[0]} has no tasteReview.shots to hash.`)
      process.exit(2)
    }
  } else {
    shots = Object.fromEntries(
      args.map((a) => {
        const i = a.indexOf('=')
        if (i < 1) {
          console.error(`not a key=path pair: ${a}`)
          process.exit(2)
        }
        return [a.slice(0, i), a.slice(i + 1)]
      }),
    )
  }
  const hash = shotsHashFor(root, shots)
  if (!hash) {
    console.error('a file named in shots is not on disk — nothing to hash.')
    process.exit(1)
  }
  console.log(hash)
}
