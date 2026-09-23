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
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tipReadyCatalogInstallProblems } from './catalog-install.mjs'
import { ALLOWED_EVALUATORS, EVALUATOR_MODEL, isAllowedEvaluator } from './taste-evaluate-result.mjs'
import {
  ABOUT_LOCK_ID,
  aboutLockSourceProblems,
  aboutRequiredComponentProblems,
  aboutTipReadyProblems,
  isAboutLockBrief,
} from './about-lock.mjs'
import { manneredPublicCopyProblems, resolveCopySourceForTaste } from './mannered-public-copy.mjs'
import {
  breadcrumbFoldDensityProblems,
  listingHeroFoldDensityProblems,
  placeHeroFoldDensityProblems,
} from './listing-fold-density.mjs'
import { listingKeepExploringProblems } from './listing-keep-exploring.mjs'
import { dogFloaterProblems } from './dog-floater.mjs'
import {
  competitorFirstLookProblems,
  isPlaceCraftDocument,
  isPlaceCraftDoneClaim,
  mapDrivesHierarchyProblems,
  placeCraftShipProblems,
  resolveCompetitorFirstLook,
} from './place-craft.mjs'
import { isMapHierarchyDocument, mapHierarchyShipProblems } from './map-hierarchy.mjs'
import { isHierarchyNamingDocument, hierarchyNamingShipProblems } from './hierarchy-naming.mjs'
import {
  isPlaceTypedInventoryDocument,
  placeTypedInventoryShipProblems,
} from './place-typed-inventory.mjs'
import { isSearchAtlasDocument, searchAtlasShipProblems } from './search-atlas.mjs'

export { manneredPublicCopyProblems, resolveCopySourceForTaste } from './mannered-public-copy.mjs'

/** Receipts evaluated on or after this date must carry the v2 fields. */
export const RECEIPT_V2_FROM = '2026-09-08'

/**
 * THE OBJECTIVE CHANGED (Matt 2026-09-22 / 2026-09-23, visibility audit
 * PROCESS-3 + UXLIVE-11). The site queue is scored on being seen (Search
 * Console clicks and position, AI referrals) and converting; the taste median
 * is a FLOOR that may not regress, not the score (docs/RUN_LOOP.md §1, §4).
 * Matt 2026-09-23: "Don't assume any rules from the past that might keep us
 * from hitting our goals are permanent." Evidence: 0 of 27 classes reached the
 * 70 finish line on the frozen table (best 67), so the queue could never
 * finish, and 172 September nodes were steered by a score that has no
 * visibility or conversion term. So:
 *   - demoMatch and competitiveBriefPass are RECORDED notes (true | false, never
 *     invented), not completion gates;
 *   - FINISH_LINE is a reference mark the taste table prints; it no longer
 *     decides done (it stays exported because ci:rubric-freeze pins it);
 *   - Tip Ready (`--ship`) requires NO REGRESSION on the same instrument:
 *     comparedToPrior "first" | "rose" | "held" | "rebaselined", where "held"
 *     may sit below the prior mark only by less than the rise floor (a smaller
 *     move is the judge's own noise, riseFloorBasis in taste-rule-freeze.json).
 * The rubric itself is unchanged (v1-2026-09-12).
 *
 * DEMO_MATCH_RULE_FROM: receipts on this date / rubric that name a catalog
 * adaptedFrom id must RECORD demoMatch as true or false.
 */
export const DEMO_MATCH_RULE_FROM = '2026-09-12'
export const DEMO_MATCH_RUBRIC = 'v1-2026-09-12'
export const FINISH_LINE = 70
/** The date the objective moved off the finish line (Matt 2026-09-23). */
export const TASTE_FLOOR_FROM = '2026-09-23'

/**
 * The rise floor (Matt 2026-09-12: "there can be no gaps"). "Score must rise"
 * with no floor let pure judge noise count as done: on the 2026-09-13 table
 * (27 classes x 3 scorings, grok-4.6 through the Cursor CLI, rubric
 * v1-2026-09-12) two medians-of-3 of the SAME page differ by >= 1 in 30% of
 * bootstrap draws, by >= 2 in 12%, by >= 3 in 4.1%. RISE_FLOOR is the
 * smallest rise whose no-change probability is under 5% — the smallest rise
 * the instrument can tell from itself. (The sonnet-judged table of 2026-09-12
 * was noisier, sd 4.84 vs 2.24, and carried a floor of 6 for one day; no
 * receipt was written under it.) Basis and the reproduction command live in
 * design_system/public/taste-rule-freeze.json (riseFloorBasis); ci:rubric-freeze
 * fails if this constant drifts from the manifest. Receipts evaluated before
 * RISE_FLOOR_FROM were accepted under the bare rise and stay valid.
 */
export const RISE_FLOOR = 3
export const RISE_FLOOR_FROM = '2026-09-13'

/** The minimum rise a receipt evaluated on `evaluatedAt` owes over its prior mark. */
export function riseFloorFor(evaluatedAt) {
  return String(evaluatedAt ?? '') >= RISE_FLOOR_FROM ? RISE_FLOOR : 1
}

/**
 * How far a "held" mark may sit under its prior mark on the same instrument
 * before it is a regression: one less than the rise floor. The rise floor is
 * the smallest move the judge can tell from its own noise, in either
 * direction, so a smaller drop is the judge disagreeing with itself, and a
 * drop of the full floor or more is the page getting worse (Matt 2026-09-23:
 * taste is a floor that may not regress).
 */
export function regressionToleranceFor(evaluatedAt) {
  return riseFloorFor(evaluatedAt) - 1
}

/**
 * The look floor on one receipt: did the median fall on the same instrument,
 * and did honesty fall? Empty = no regression. A "first" or "rebaselined"
 * mark has no comparable prior, so only the honesty hold applies to it.
 */
export function tasteFloorProblems(tr, { headReceipt = null } = {}) {
  if (!isPlainObject(tr)) return []
  const p = []
  const prior = isPlainObject(tr.priorMark) ? tr.priorMark : null
  const cmp = String(tr.comparedToPrior ?? '')
  if (prior && Number.isInteger(prior.score) && Number.isInteger(tr.score) && (cmp === 'rose' || cmp === 'held')) {
    const drift = identityDrift(tr, prior, headReceipt)
    if (drift.length === 0) {
      const tol = regressionToleranceFor(tr.evaluatedAt)
      if (tr.score < prior.score - tol) {
        p.push(
          `taste floor regressed: median ${tr.score} is ${prior.score - tr.score} under the prior mark ${prior.score} on the same instrument (a drop of ${tol + 1} or more is outside the judge's noise). Fix the page; taste may not regress (Matt 2026-09-23).`,
        )
      }
    }
  }
  p.push(...productHoldProblems(tr, prior))
  return p
}

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
 *
 * evaluatorModel and rubricVersion are compared receipt-to-prior: the same
 * judge on the same rubric. shotsHash is NOT — a page that changed has new
 * shots by definition, so comparing the new hash to the prior's would make
 * every real rise a "rebaseline" and the only passable "rose" a re-score of
 * unchanged pixels (the noise case the rise floor exists to exclude). The
 * prior's shotsHash instead binds the named prior to the receipt committed at
 * HEAD (`headReceipt`): a priorMark whose hash is not the committed receipt's
 * names a mark against shots that no longer exist (the SITE-M1 case) and
 * drifts. When no HEAD receipt is given, shotsHash cannot drift.
 */
export const SHOTS_IDENTITY_FIX_FROM = '2026-09-13'

export function identityDrift(tr, prior, headReceipt = null) {
  if (!isPlainObject(prior)) return [...IDENTITY_KEYS]
  // Receipts written before the fix compared the new hash to the prior's and
  // recorded "shotsHash differs" as their rebaseline reason. They stay valid.
  if (String(tr?.evaluatedAt ?? '') < SHOTS_IDENTITY_FIX_FROM) {
    return IDENTITY_KEYS.filter((k) => String(prior[k] ?? '') !== String(tr[k] ?? ''))
  }
  const drift = IDENTITY_KEYS.filter(
    (k) => k !== 'shotsHash' && String(prior[k] ?? '') !== String(tr[k] ?? ''),
  )
  if (
    isPlainObject(headReceipt) &&
    isNonEmptyString(headReceipt.shotsHash) &&
    String(prior.shotsHash ?? '') !== String(headReceipt.shotsHash)
  ) {
    drift.push('shotsHash')
  }
  return drift
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
      `this route's committed tasteReview already scored ${headScored.score} on ${headScored.evaluatedAt}. Name it in priorMark and set comparedToPrior "rose", "held" or "rebaselined" — "first" is not an exit from the no-regression rule.`,
    )
  }
  if (!['first', 'rose', 'held', 'rebaselined'].includes(cmp)) {
    p.push('comparedToPrior must be "first", "rose", "held", or "rebaselined".')
  } else if (cmp === 'first') {
    if (prior != null) p.push('comparedToPrior "first" but priorMark is set. A first mark has no prior.')
  } else {
    if (!isPlainObject(prior)) {
      p.push(`comparedToPrior "${cmp}" needs priorMark: { evaluatedAt, score, ${IDENTITY_KEYS.join(', ')} }.`)
    } else if (!Number.isInteger(prior.score)) {
      p.push('priorMark.score must be the integer mark it is being compared to.')
    } else {
      const drift = identityDrift(tr, prior, headScored)
      if (cmp === 'held') {
        // Matt 2026-09-23: a pass may improve visibility or information and
        // leave the look where it was. "held" records that the median did not
        // fall outside the judge's noise on the same instrument.
        if (drift.length > 0) {
          p.push(
            `comparedToPrior "held" but the prior mark differs on ${drift.join(', ')} — a different instrument is NOT a baseline. Set comparedToPrior "rebaselined".`,
          )
        } else {
          const tol = regressionToleranceFor(tr.evaluatedAt)
          if (!(Number.isInteger(tr.score) && tr.score >= prior.score - tol)) {
            p.push(
              `score ${tr.score} fell below the prior mark ${prior.score} by more than the judge's noise (${tol}) on the same instrument. The look regressed; fix the page (Matt 2026-09-23: taste is a floor).`,
            )
          }
        }
      } else if (cmp === 'rose') {
        if (drift.length > 0) {
          p.push(
            `comparedToPrior "rose" but the prior mark differs on ${drift.join(', ')} — a different instrument is NOT a baseline. Set comparedToPrior "rebaselined".`,
          )
        } else {
          const floor = riseFloorFor(tr.evaluatedAt)
          if (!(Number.isInteger(tr.score) && tr.score >= prior.score + floor)) {
            p.push(
              floor > 1
                ? `score ${tr.score} did not rise by the floor of ${floor} over the prior mark ${prior.score} (needs ${prior.score + floor}). A smaller rise is inside the judge's own noise: record comparedToPrior "held", not "rose" (TASTE.md).`
                : `score ${tr.score} did not rise above the prior mark ${prior.score}: record comparedToPrior "held", not "rose" (TASTE.md).`,
            )
          }
        }
      } else {
        if (drift.length === 0) {
          p.push(
            'comparedToPrior "rebaselined" but the prior mark matches on evaluatorModel, rubricVersion and shotsHash — it IS comparable: record "rose" or "held".',
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

  // 9. Catalog adaptedFrom: demoMatch is RECORDED true or false (Matt
  //    2026-09-12), a note, not a completion gate (Matt 2026-09-23).
  p.push(...catalogDemoMatchProblems(tr))

  // 10. Per-route competitiveBrief (About first, Matt 2026-09-12):
  //     competitiveBriefPass is RECORDED true or false. Omit is refuse; do not
  //     invent true. A false no longer blocks done (Matt 2026-09-23).
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
 * A post-rule catalog-class receipt records the judge's demoMatch verdict as
 * true or false. Omitting it hides the verdict, so it is refused. Since Matt
 * 2026-09-23 a false is an honest note: it no longer blocks a rise, the finish
 * line, or done.
 */
export function catalogDemoMatchProblems(tr) {
  if (!isPlainObject(tr)) return []
  const catalogIds = adaptedFromCatalogIds(tr.adaptedFrom)
  if (catalogIds.length === 0) return []
  if (!underDemoMatchRule(tr)) return []

  const named = catalogIds.join(', ')
  const p = []
  if (typeof tr.demoMatch !== 'boolean') {
    p.push(
      `demoMatch must be recorded true or false when adaptedFrom names catalog modules (${named}). It is a note, not a gate (Matt 2026-09-23); record the judge's verdict, never invent it.`,
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
 * `ci:page-purpose` companion to competitiveTarget ≥40 chars.
 * About must encode the Researchy 1–8 checklist. Any other kit that
 * carries `competitiveBrief` must be complete — empty / prose-only / short
 * beats are refuse. Kits without the field stay on the string target only.
 * Tip Ready / node-complete still refuse via taste-receipt --ship + site-queue-done.
 */
export function competitiveBriefPurposeProblems(kit, parsed) {
  if (!isPlainObject(parsed)) {
    return [
      'competitiveBrief must be a structured checklist ({ id, source, beats[] }), not prose.',
    ]
  }
  const hasField = Object.prototype.hasOwnProperty.call(parsed, 'competitiveBrief')
  if (kit !== 'about' && !hasField) return []
  return competitiveBriefShapeProblems(parsed.competitiveBrief)
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
 * A route that publishes a competitiveBrief records competitiveBriefPass as
 * true or false (or a complete checklist). Omit is refuse. Since Matt
 * 2026-09-23 a false is an honest note, not a block on rise or done.
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
      'competitiveBriefPass must be recorded true or false when the route has a competitiveBrief. Omitting it is refuse. Do not invent true. Checklist all true is the other pass path.',
    )
  }
  return p
}

/**
 * Tip Ready / node-complete (Matt 2026-09-23): the receipt was signed by the
 * judge chain, records its verdicts (demoMatch for catalog modules,
 * competitiveBriefPass when a brief exists) without inventing them, and did
 * not regress on the same instrument (tasteFloorProblems). A true verdict is
 * no longer required. Used by `node scripts/lib/taste-receipt.mjs --ship`;
 * lib/data/loop/site-queue-done.ts mirrors it for completeWorkNode.
 */
export const TIP_READY_EVALUATOR = EVALUATOR_MODEL
/** The judge chain: grok-4.6 first, the claude CLI when grok is missing or 402. */
export const TIP_READY_EVALUATORS = ALLOWED_EVALUATORS
export const isTipReadyEvaluator = isAllowedEvaluator

/**
 * About opener contract (Matt 2026-09-12 / 2026-09-14). AboutFaces or
 * AboutTeamTeaser as a required About section is refuse. Brokers belong
 * on /team. AboutFirm opens. AboutOffice carries address + OREA.
 */
export function aboutOpenerProblems(kit, parsed) {
  return aboutRequiredComponentProblems(kit, parsed)
}

/**
 * Tip Ready on the receipt itself — not on evidence prose.
 * competitiveBriefPass must be the boolean true on tasteReview. A hand-typed
 * "competitiveBriefPass: true" string is not a pass.
 */
export function defectReplaceWithProblems(tr) {
  if (!isPlainObject(tr) || !Array.isArray(tr.defects)) return []
  const p = []
  for (const [i, d] of tr.defects.entries()) {
    if (!isPlainObject(d)) continue
    if (!('replaceWith' in d)) {
      p.push(`defects[${i}] is missing replaceWith. Empty replaceWith fails Tip Ready.`)
      continue
    }
    if (d.replaceWith == null) continue
    if (typeof d.replaceWith === 'string' && !d.replaceWith.trim()) {
      p.push(
        `defects[${i}] has empty replaceWith. Name a catalog id from the builder card, or null for craft/honesty/SEO.`,
      )
    }
  }
  return p
}

export function tipReadyReceiptProblems(
  tr,
  { competitiveBrief = null, requireBrief = false, kit = null, root = process.cwd(), sourceText } = {},
) {
  if (!isPlainObject(tr)) {
    return ['tasteReview is required to mark a SITE node done. Bare evidence prose is refuse.']
  }
  const p = []
  if (!isTipReadyEvaluator(tr.evaluatorModel)) {
    p.push(
      `evaluatorModel must be one of the judge chain (${TIP_READY_EVALUATORS.join(', ')}) — a mark from anywhere else is not a measurement. Leave the node in_progress.`,
    )
  }
  if (tr.demoMatch !== undefined && typeof tr.demoMatch !== 'boolean') {
    p.push('demoMatch, when recorded, is the boolean the judge returned. Do not invent it.')
  } else if (adaptedFromCatalogIds(tr.adaptedFrom).length && typeof tr.demoMatch !== 'boolean') {
    p.push('demoMatch must be recorded true or false when adaptedFrom names catalog modules (a note, not a gate). Do not invent it.')
  }
  const parsed = parseCompetitiveBrief(competitiveBrief) || parseCompetitiveBrief(tr.competitiveBrief)
  if (requireBrief || parsed) {
    if (typeof tr.competitiveBriefPass !== 'boolean') {
      p.push(
        'parity tasteReview.competitiveBriefPass must be recorded as the boolean the judge returned. Bare evidence prose is refuse. Leave the node in_progress.',
      )
    } else if (tr.competitiveBriefPass === true && isAboutLockBrief(parsed, kit)) {
      // Claiming the About pass still needs its quotes from the live source.
      p.push(...aboutTipReadyProblems(tr, parsed, { root, sourceText, kit }))
    }
  }
  p.push(...tasteFloorProblems(tr))
  p.push(...defectReplaceWithProblems(tr))
  if (tr.shotsHash != null && !HASH_RE.test(String(tr.shotsHash).trim())) {
    p.push('tasteReview.shotsHash must be sha256:<64 hex> like a v2 receipt.')
  }
  return p
}

/**
 * Open-state evidence: a shot key/path matching *-open / search-open, or a
 * shotSpec state that names open. Empty open evidence is refuse when the
 * receipt is a catalog class (adaptedFrom catalog ids, or opts.catalogClass).
 */
export function isOpenStateToken(s) {
  const t = String(s ?? '').trim()
  if (!t) return false
  if (/(?:^|[-_/.])search-open(?:[-_.]|\.[a-z0-9]+|$)/i.test(t)) return true
  if (/(?:^|[-_/.])[a-z0-9]+-open(?:[-_.]|\.[a-z0-9]+|$)/i.test(t)) return true
  if (/^open$/i.test(t)) return true
  return false
}

export function hasOpenStateEvidence(tr) {
  if (!isPlainObject(tr)) return false
  const shots = isPlainObject(tr.shots) ? tr.shots : {}
  for (const [k, v] of Object.entries(shots)) {
    if (isOpenStateToken(k) || isOpenStateToken(String(v))) return true
  }
  const states = Array.isArray(tr.shotSpec?.states) ? tr.shotSpec.states : []
  return states.some((s) => isOpenStateToken(s))
}

export function needsOpenStateEvidence(tr, { catalogClass = false } = {}) {
  if (catalogClass === true) return true
  return adaptedFromCatalogIds(tr?.adaptedFrom).length > 0
}

export function openStateEvidenceProblems(tr, opts = {}) {
  if (!isPlainObject(tr)) return []
  if (!needsOpenStateEvidence(tr, opts)) return []
  if (hasOpenStateEvidence(tr)) return []
  const named = adaptedFromCatalogIds(tr.adaptedFrom).join(', ') || 'catalog class'
  return [
    `catalog adaptedFrom / catalog-class (${named}) requires open-state evidence: a tasteReview.shots path matching *-open / search-open, or shotSpec.states including open. Empty open evidence is refuse.`,
  ]
}

export function tasteDoneProblems(tr, { competitiveBrief = null, catalog = null, route = null, root = process.cwd(), catalogIo = null, catalogClass = false, kit = null, sourceText } = {}) {
  if (!isPlainObject(tr)) return ['tasteReview is required to mark a SITE node done.']
  const p = tipReadyReceiptProblems(tr, { competitiveBrief, kit, root, sourceText })
  // Matt's dated copy calls (2026-09-14..18), recorded in VOICE.md "Matt's calls on site copy".
  p.push(...manneredPublicCopyProblems(resolveCopySourceForTaste({ sourceText, route, kit, root })))
  p.push(...openStateEvidenceProblems(tr, { catalogClass }))
  p.push(...tipReadyCatalogInstallProblems(tr.adaptedFrom, { catalog, route, root, catalogIo }))
  const listingKit = kit === 'listing-detail' || route === 'app/listing/[listingKey]/page.tsx'
  if (existsSync(join(root, 'components/site/v3/V3Breadcrumb.tsx'))) {
    p.push(...breadcrumbFoldDensityProblems({ root }))
  } else if (listingKit) {
    p.push('listing-detail Tip Ready requires the shared V3Breadcrumb primitive.')
  }
  if (listingKit) p.push(...listingHeroFoldDensityProblems({ root }))
  if (listingKit) p.push(...listingKeepExploringProblems({ root }))
  p.push(...dogFloaterProblems({ root }))
  const placeKit =
    kit === 'city' ||
    kit === 'community' ||
    kit === 'neighborhood' ||
    kit === 'subdivision' ||
    kit === 'place-type' ||
    kit === 'place-type-community'
  if (placeKit) p.push(...placeHeroFoldDensityProblems({ root }))
  if (placeKit) p.push(...mapDrivesHierarchyProblems({ root }))
  return p
}

/**
 * SITE-* done evidence (Matt 2026-09-23). The accept test is docs/RUN_LOOP.md
 * §4 (visibility, information, voice, floors, measurement); demoMatch and
 * competitiveBriefPass are notes. What this still refuses: empty evidence; a
 * judge failure (402, CLI missing) offered with no signed receipt behind it; a
 * named receipt whose look regressed on the same instrument; "Tip Ready" prose
 * without the --ship exit 0; place craft without its first-look evidence.
 */
export const JUDGE_UNREACHABLE_RE = /\b402\b|payment required|balance exhausted|no grok CLI|grok CLI missing|GROK_CLI|claude CLI missing|both judges/i

export function resolveSiteQueueKit(evidence, versionGap) {
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

function loadKitParity(kit, root = process.cwd()) {
  if (!kit) return null
  const rel = join(root, 'design_system/ryan-realty/ui_kits', kit, 'parity.json')
  if (!existsSync(rel)) return null
  try {
    return JSON.parse(readFileSync(rel, 'utf8'))
  } catch {
    return null
  }
}

export function siteQueueDoneEvidenceProblems(
  evidence,
  { versionGap, tasteReview, competitiveBrief, parity, loadParity, root } = {},
) {
  const gap = String(versionGap ?? '')
  if (gap && !/^SITE-\d+/.test(gap)) return []
  const text = String(evidence ?? '')
  if (!text.trim()) return ['evidence is required — a node is done when the environment says so']
  const judgeUnreachable = JUDGE_UNREACHABLE_RE.test(text)

  const kit = resolveSiteQueueKit(text, gap)
  const loaded = loadParity === false ? null : isPlainObject(parity) ? parity : loadKitParity(kit, root)
  const tr = isPlainObject(tasteReview) ? tasteReview : loaded?.tasteReview
  const brief = competitiveBrief ?? loaded?.competitiveBrief
  const copyRoot = root ?? process.cwd()

  // A verdict is a note now, but it is still never invented: evidence that
  // claims true against a receipt that records false is refused.
  for (const key of ['demoMatch', 'competitiveBriefPass']) {
    const claimsTrue = new RegExp(`\\b${key}\\b\\s*[:=]\\s*true\\b`, 'i').test(text)
    if (claimsTrue && isPlainObject(tr) && tr[key] === false) {
      return [`evidence says ${key}: true but the route's receipt records false. Do not invent a verdict.`]
    }
  }

  if (judgeUnreachable) {
    const receiptProblems = tipReadyReceiptProblems(tr, { competitiveBrief: brief, kit, root: copyRoot })
    if (receiptProblems.length) {
      return [
        `evidence records a judge failure (402 / CLI missing); a failed judge is not a score. Either the look did not change (say so and cite no score) or the fallback verdict is on the route's parity.json tasteReview. ${receiptProblems[0]}`,
      ]
    }
  }
  if (isPlainObject(tr)) {
    const floor = tasteFloorProblems(tr)
    if (floor.length) return floor
    const copy = manneredPublicCopyProblems(resolveCopySourceForTaste({ route: loaded?.route, kit, root: copyRoot }))
    if (copy.length) return copy
  }
  if (/\bTip Ready\b/i.test(text) && !/--ship\b/.test(text) && !/\bship OK\b/i.test(text)) {
    return [
      'Tip Ready language without `node scripts/lib/taste-receipt.mjs --ship` exit 0 is refuse. Prose is not Tip Ready.',
    ]
  }
  if (isPlaceCraftDoneClaim(text, gap) || isPlaceCraftDocument(loaded)) {
    const look = resolveCompetitorFirstLook(loaded, tr)
    const firstLook = competitorFirstLookProblems(look, { root: copyRoot })
    if (firstLook.length) return firstLook
    const hierarchy = mapDrivesHierarchyProblems({ root: copyRoot })
    if (hierarchy.length) return hierarchy
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

/** Engine picker contract (not a SITE page). Cos prose is refuse. */
export function isPickerContract(d) {
  return isPlainObject(d) && d.kind === 'picker-contract'
}

export function pickerContractProblems(d, { root = process.cwd() } = {}) {
  if (!isPickerContract(d)) return ['picker-contract kind is required']
  const p = []
  const files = Array.isArray(d.testFiles) ? d.testFiles : []
  const contracts = Array.isArray(d.contracts) ? d.contracts.map((c) => String(c)) : []
  if (files.length === 0) p.push('picker-contract testFiles is empty. Encode the contracts as tests.')
  if (contracts.length === 0) p.push('picker-contract contracts is empty.')
  const text = files
    .map((rel) => {
      const abs = join(root, rel)
      return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
    })
    .join('\n')
  for (const id of contracts) {
    if (!text.includes(`contract: ${id}`)) {
      p.push(`contract ${id} is missing from testFiles. Cos prose is not Tip Ready.`)
    }
  }
  return p
}

export function runPickerContractTests(d, { root = process.cwd() } = {}) {
  const files = Array.isArray(d.testFiles) ? d.testFiles : []
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=dot', ...files], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
  return {
    status: r.status ?? 1,
    output: `${r.stdout ?? ''}${r.stderr ?? ''}`,
  }
}

/* CLI: print the shotsHash for a parity.json, or for key=path pairs.
 * `--ship <parity.json>` is the Tip Ready / node-complete gate. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd()
  const args = process.argv.slice(2)
  if (args[0] === '--about-lock') {
    const problems = aboutLockSourceProblems({ root })
    if (problems.length) {
      console.error(problems.join('\n'))
      process.exit(1)
    }
    console.log(`about lock OK — ${ABOUT_LOCK_ID}`)
    process.exit(0)
  }
  if (args[0] === '--ship') {
    const rel = args[1]
    if (!rel) {
      console.error('usage: node scripts/lib/taste-receipt.mjs --ship <parity.json> | --about-lock')
      process.exit(2)
    }
    const d = JSON.parse(readFileSync(join(root, rel), 'utf8'))
    if (isPickerContract(d)) {
      const problems = pickerContractProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        process.exit(1)
      }
      const ran = runPickerContractTests(d, { root })
      if (ran.status !== 0) {
        console.error(ran.output)
        console.error('ship refuse — picker contract tests failed. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — picker contract tests passed')
      process.exit(0)
    }
    if (isPlaceCraftDocument(d)) {
      const problems = placeCraftShipProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        console.error('ship refuse — place craft Tip Ready needs competitor first-look + map-drives-hierarchy. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — place craft · map-drives-hierarchy · competitor first-look')
      process.exit(0)
    }
    if (isMapHierarchyDocument(d)) {
      const problems = mapHierarchyShipProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        console.error('ship refuse — map hierarchy Tip Ready needs subject-polygon-only + child-select zoom. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — map-hierarchy · subject-polygon-only · child-select-zooms')
      process.exit(0)
    }
    if (isHierarchyNamingDocument(d)) {
      const problems = hierarchyNamingShipProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        console.error('ship refuse — hierarchy naming Tip Ready needs community≠neighborhood + name-only crumbs. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — hierarchy-naming · community≠neighborhood · breadcrumb-sameness')
      process.exit(0)
    }
    if (isPlaceTypedInventoryDocument(d)) {
      const problems = placeTypedInventoryShipProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        console.error('ship refuse — place typed inventory Tip Ready needs typed stock + scrubber unmounted. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — place-typed-inventory · typed stock · empty omit · scrubber unmounted')
      process.exit(0)
    }
    if (isSearchAtlasDocument(d)) {
      const problems = searchAtlasShipProblems(d, { root })
      if (problems.length) {
        console.error(problems.join('\n'))
        console.error('ship refuse — search atlas Tip Ready needs map-dominant + labeled compare + house sheet. Cos prose is not Tip Ready.')
        process.exit(1)
      }
      console.log('ship OK — search-atlas · map-dominant · labeled compare · house sheet')
      process.exit(0)
    }
    const kitFromPath = rel.includes('ui_kits/') ? rel.split('/').filter(Boolean).at(-2) : null
    const kit = /ui_kits\/about\//.test(rel.replace(/\\/g, '/')) ? 'about' : kitFromPath
    let catalog = null
    let catalogClass = false
    try {
      const raw = JSON.parse(readFileSync(join(root, 'design_system/public/taste-catalog.json'), 'utf8'))
      catalog = { installById: raw.installById, classes: raw.classes, routeClasses: raw.routeClasses }
      catalogClass = Boolean(
        (kit && (raw.classes?.[kit] || raw.routeClasses?.[kit])) ||
          adaptedFromCatalogIds(d?.tasteReview?.adaptedFrom).length,
      )
    } catch {
      catalog = null
    }
    const problems = tasteDoneProblems(d?.tasteReview, {
      competitiveBrief: d?.competitiveBrief ?? null,
      catalog,
      route: typeof d?.route === 'string' ? d.route : null,
      root,
      catalogClass,
      kit,
    })
    if (kit === 'about' && d?.tasteReview?.competitiveBriefPass !== true) {
      problems.push(...aboutLockSourceProblems({ root }))
    }
    if (problems.length) {
      console.error(problems.join('\n'))
      process.exit(1)
    }
    const tr = d?.tasteReview ?? {}
    const notes = [`demoMatch ${typeof tr.demoMatch === 'boolean' ? tr.demoMatch : 'n/a'}`]
    if (parseCompetitiveBrief(d?.competitiveBrief)) notes.push(`competitiveBriefPass ${tr.competitiveBriefPass}`)
    console.log(`ship OK — no regression (${String(tr.comparedToPrior ?? 'first')}) · ${notes.join(' · ')} (notes) · open-state · catalog-install`)
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
