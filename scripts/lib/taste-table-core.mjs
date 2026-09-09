#!/usr/bin/env node
/**
 * taste-table-core.mjs — pure logic for `scripts/taste-table.mjs` (SITE-51).
 *
 * THE NODE (2026-09-09): "the finish line is 70 on the table instrument. The
 * tool prints, after the table, every class under 70 as the candidate set for
 * the next round, sorted bottom first, and `--diff` marks a class that crossed
 * 70 since the previous table." This module holds every computation the CLI
 * needs that does NOT touch the network, a browser, or a subprocess, so it can
 * be tested without any of those: the class registry loader, the median +
 * criteria math shared with the route-receipt contract (`taste-receipt.mjs`),
 * picking which of the three scorings a row's fields come from, the diff
 * against a prior table (including the 70-crossing markers), and regenerating
 * the markdown block in `docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md`.
 *
 * The CLI (`scripts/taste-table.mjs`) owns everything impure: spawning
 * `take-route-shots.mjs`, calling the Anthropic SDK or the `claude` CLI, and
 * reading git history for `builderModel`.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isNonEmptyString, isPlainObject, median3 } from './taste-receipt.mjs'

export { isNonEmptyString, isPlainObject, median3 }

/** Matt, 2026-09-09: "the finish line is 70 on the table instrument." */
export const FINISH_LINE = 70

/** The rubric this instrument scores against — TASTE.md's five-criterion table. */
export const RUBRIC_VERSION = 'v1-2026-09-08'

/** Criterion -> its point cap. TASTE.md: DQ 30 / OR 30 / IN 15 / CR 15 / HF 10. */
export const CRITERIA_WEIGHTS = Object.freeze({
  designQuality: 30,
  originality: 30,
  interaction: 15,
  craft: 15,
  honestyFunction: 10,
})
export const CRITERIA_KEYS = Object.freeze(Object.keys(CRITERIA_WEIGHTS))

/** Co-Authored-By display name -> the model id `taste-table.json` records. */
export const KNOWN_BUILDER_MODELS = Object.freeze({
  'Claude Fable 5.1': 'claude-fable-5-1',
  'Claude Opus 5': 'claude-opus-5',
  'Claude Sonnet 5': 'claude-sonnet-5',
})

// ---------------------------------------------------------------------------
// class registry — design_system/public/taste-classes.json
// ---------------------------------------------------------------------------

/**
 * Parse + validate the class registry. The tool reads ONLY this file for a
 * class's URL — it never derives one from a route's dynamic segment, because a
 * route like `app/cities/[slug]/page.tsx` has no single URL to guess.
 *
 * Returns `{ classes, problems }`. A class missing `url` (or `route`, or
 * `key`) is DROPPED from `classes` and named in `problems` — the caller
 * decides whether an empty-registry or partial-registry run is fatal.
 */
export function loadClassRegistry(raw) {
  const problems = []
  if (!Array.isArray(raw)) {
    return { classes: [], problems: ['taste-classes.json must be a JSON array of {key, route, url}.'] }
  }
  const classes = []
  const seen = new Set()
  raw.forEach((entry, i) => {
    if (!isPlainObject(entry)) {
      problems.push(`entry ${i}: not an object.`)
      return
    }
    const { key, route, url } = entry
    if (!isNonEmptyString(key)) {
      problems.push(`entry ${i}: missing "key".`)
      return
    }
    if (seen.has(key)) {
      problems.push(`"${key}": duplicate class key.`)
      return
    }
    seen.add(key)
    if (!isNonEmptyString(route)) problems.push(`"${key}": missing "route" (the page file this class scores).`)
    if (!isNonEmptyString(url)) {
      problems.push(`"${key}": missing "url" — the tool never guesses a URL for a dynamic route.`)
    }
    if (isNonEmptyString(route) && isNonEmptyString(url)) {
      classes.push({ key: key.trim(), route: route.trim(), url: url.trim() })
    }
  })
  return { classes, problems }
}

/** `--classes a,b` — a named subset. Returns `{ subset, missing }`. */
export function filterClasses(classes, csv) {
  if (!isNonEmptyString(csv)) return { subset: classes, missing: [] }
  const want = [
    ...new Set(
      String(csv)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
  const have = new Set(classes.map((c) => c.key))
  const missing = want.filter((k) => !have.has(k))
  const wantSet = new Set(want)
  const subset = classes.filter((c) => wantSet.has(c.key))
  return { subset, missing }
}

// ---------------------------------------------------------------------------
// scoring math — shared shape with scripts/lib/taste-receipt.mjs
// ---------------------------------------------------------------------------

/** Sum of the five criteria must equal the scoring's own score, each within its weight. */
export function criteriaProblems(criteria, score) {
  if (!isPlainObject(criteria)) return ['criteria is missing or not an object.']
  const p = []
  let sum = 0
  for (const k of CRITERIA_KEYS) {
    const v = criteria[k]
    if (!Number.isInteger(v) || v < 0 || v > CRITERIA_WEIGHTS[k]) {
      p.push(`criteria.${k} must be an integer 0-${CRITERIA_WEIGHTS[k]} (got ${JSON.stringify(v)}).`)
      continue
    }
    sum += v
  }
  if (p.length === 0 && Number.isInteger(score) && sum !== score) {
    p.push(`criteria sums to ${sum}, not the score ${score}.`)
  }
  return p
}

/**
 * Three independent scorings of the same shots -> the median score, and the
 * scoring object (criteria/tells/defects/dullest/beats/verdict) whose score
 * EQUALS the median — first match, per SITE-51's design. `scorings` is an
 * array of 3 `{ score, criteria, tells, defects, dullest, beats, verdict }`.
 */
export function selectMedianScoring(scorings) {
  if (!Array.isArray(scorings) || scorings.length !== 3) {
    return { median: null, picked: null, scores: null }
  }
  const scores = scorings.map((s) => (isPlainObject(s) ? s.score : null))
  const median = median3(scores)
  if (median === null) return { median: null, picked: null, scores }
  const picked = scorings.find((s) => isPlainObject(s) && s.score === median) ?? null
  return { median, picked, scores }
}

// ---------------------------------------------------------------------------
// defects — every one must name a primitive that exists on disk
// ---------------------------------------------------------------------------

const DEFECT_SEVERITIES = new Set(['taste', 'defect'])

/** A single defect is well-formed AND names a primitive that exists at `root`. */
export function defectExists(defect, root) {
  return (
    isPlainObject(defect) &&
    isNonEmptyString(defect.section) &&
    DEFECT_SEVERITIES.has(defect.severity) &&
    isNonEmptyString(defect.finding, 10) &&
    isNonEmptyString(defect.primitive) &&
    !defect.primitive.includes('..') &&
    existsSync(join(root, defect.primitive))
  )
}

/**
 * Keep only defects that exist on disk. A dangling primitive path (the file
 * was renamed, or the evaluator invented one) is dropped rather than shipped.
 */
export function survivingDefects(defects, root) {
  if (!Array.isArray(defects)) return []
  return defects.filter((d) => defectExists(d, root))
}

// ---------------------------------------------------------------------------
// row assembly + validation
// ---------------------------------------------------------------------------

/**
 * Build one `taste-table.json` row from a class + its picked scoring. Returns
 * `{ row, problems }` — `problems` is non-empty when the scoring could not be
 * trusted (bad median, bad criteria, no surviving defect); the row still
 * carries an `invalid` field in that case so the run can record the class
 * rather than silently drop it (ACCEPT: "Exit non-zero on any invalid row").
 */
export function buildRow({ key, url, route, scorings, builderModel, shots, root }) {
  const problems = []
  const { median, picked, scores } = selectMedianScoring(scorings)

  if (median === null) {
    problems.push('scores must be three integers 0-100 (three independent scorings of the same shots).')
    return {
      row: {
        key,
        url,
        route,
        median: null,
        scores,
        criteria: null,
        tells: [],
        defects: [],
        dullest: '',
        beats: '',
        verdict: '',
        builderModel,
        shots,
        invalid: problems.join(' '),
      },
      problems,
    }
  }

  const critProblems = picked ? criteriaProblems(picked.criteria, picked.score) : ['no scoring matched the median.']
  problems.push(...critProblems)

  const kept = picked ? survivingDefects(picked.defects, root) : []
  if (kept.length === 0) {
    problems.push('no defect names a primitive that exists on disk.')
  }

  const row = {
    key,
    url,
    route,
    median,
    scores,
    criteria: picked?.criteria ?? null,
    tells: Array.isArray(picked?.tells) ? picked.tells : [],
    defects: kept,
    dullest: picked?.dullest ?? '',
    beats: picked?.beats ?? '',
    verdict: picked?.verdict ?? '',
    builderModel,
    shots,
  }
  if (problems.length > 0) row.invalid = problems.join(' ')
  return { row, problems }
}

/** builderModel === evaluatorModel is allowed (recorded + warned), never silently dropped. */
export function sameModelWarning(row, evaluatorModel) {
  if (isNonEmptyString(row.builderModel) && row.builderModel === evaluatorModel) {
    return `${row.key}: evaluatorModel and builderModel are both "${evaluatorModel}" — the receipts gate will refuse a same-model receipt for this route.`
  }
  return null
}

// ---------------------------------------------------------------------------
// builder model — from the route file's last commit's Co-Authored-By trailer
// ---------------------------------------------------------------------------

/**
 * `git log -1 --format=%B -- <route>` -> the model id `taste-table.json`
 * records for `builderModel`. The three named models map to their slug; any
 * other "Co-Authored-By: <Name> <email>" keeps the raw name (SITE-51 design:
 * "else the raw name"); no trailer at all -> "unknown".
 */
export function builderModelFromCommitBody(body) {
  const text = String(body ?? '')
  const m = text.match(/^Co-Authored-By:\s*([^<\n]+?)\s*(?:<[^>]*>)?\s*$/im)
  if (!m) return 'unknown'
  const name = m[1].trim()
  if (!name) return 'unknown'
  return KNOWN_BUILDER_MODELS[name] ?? name
}

// ---------------------------------------------------------------------------
// diff — this table vs. a prior one
// ---------------------------------------------------------------------------

/**
 * Per-class change against a prior table's rows. `↑70` when a class's median
 * crossed the finish line upward since the prior mark, `↓70` when it fell back
 * under it. A class absent from the prior table has `prevMedian: null` and no
 * marker (there is nothing to have crossed).
 */
export function computeDiff(previousRows, currentRows, { finishLine = FINISH_LINE } = {}) {
  const prevByKey = new Map((previousRows ?? []).filter(isPlainObject).map((r) => [r.key, r]))
  return (currentRows ?? []).map((r) => {
    const prev = prevByKey.get(r.key)
    const prevMedian = prev && Number.isInteger(prev.median) ? prev.median : null
    const change = prevMedian === null || !Number.isInteger(r.median) ? null : r.median - prevMedian
    let marker = null
    if (prevMedian !== null && Number.isInteger(r.median)) {
      if (prevMedian < finishLine && r.median >= finishLine) marker = `↑${finishLine}`
      else if (prevMedian >= finishLine && r.median < finishLine) marker = `↓${finishLine}`
    }
    return { key: r.key, prevMedian, median: r.median, change, marker }
  })
}

/** Classes in `previousRows` with no row at all in `currentRows` — a diff should never hide these. */
export function droppedClasses(previousRows, currentRows) {
  const have = new Set((currentRows ?? []).filter(isPlainObject).map((r) => r.key))
  return (previousRows ?? []).filter(isPlainObject).map((r) => r.key).filter((k) => !have.has(k))
}

// ---------------------------------------------------------------------------
// markdown — docs/plans/ENTERPRISE_MAP/SITE_PAGES_E2E.md "Taste table" section
// ---------------------------------------------------------------------------

export const TASTE_TABLE_START = '<!-- taste-table:start -->'
export const TASTE_TABLE_END = '<!-- taste-table:end -->'

function truncate(value, max = 150) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

/** The defect primitive named on the most rows in this class's own defects. */
export function primitiveNamedMost(defects) {
  const counts = new Map()
  for (const d of defects ?? []) {
    if (!isNonEmptyString(d?.primitive)) continue
    counts.set(d.primitive, (counts.get(d.primitive) ?? 0) + 1)
  }
  let best = null
  let bestCount = 0
  for (const [primitive, count] of counts) {
    if (count > bestCount) {
      best = primitive
      bestCount = count
    }
  }
  return best
}

/** Escape a literal string for use inside a `new RegExp(...)`. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Render the markdown block: the ranked table plus the "Under 70, bottom
 * first" candidate list THE NODE requires after every run.
 */
export function renderMarkdownTable(rows, { evaluatedAt, instrument, finishLine = FINISH_LINE } = {}) {
  const header = [
    '| class | median | scores | DQ/30 | OR/30 | IN/15 | CR/15 | HF/10 | tells | primitive named most | verdict |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  const body = (rows ?? []).map((r) => {
    const c = r.criteria ?? {}
    const primitive = primitiveNamedMost(r.defects)
    const scores = Array.isArray(r.scores) ? r.scores.join(' · ') : ''
    return (
      `| ${r.key} | **${r.median}** | ${scores} | ${c.designQuality ?? ''} | ${c.originality ?? ''} | ` +
      `${c.interaction ?? ''} | ${c.craft ?? ''} | ${c.honestyFunction ?? ''} | ${(r.tells ?? []).length} | ` +
      `${primitive ? `\`${primitive}\`` : '—'} | ${truncate(r.verdict)} |`
    )
  })
  const under = (rows ?? [])
    .filter((r) => Number.isInteger(r.median) && r.median < finishLine)
    .slice()
    .sort((a, b) => a.median - b.median)
  const underLines =
    under.length > 0
      ? under.map((r) => `- \`${r.key}\` — **${r.median}**`)
      : ['- none — every class on this table is at or above the finish line.']

  const stamp =
    `_Regenerated ${evaluatedAt ?? '?'} by \`scripts/taste-table.mjs\` — ` +
    `${instrument?.evaluatorModel ?? '?'}, rubric ${instrument?.rubricVersion ?? '?'}, ` +
    `${instrument?.scorings ?? 3} scorings, ${instrument?.aggregate ?? 'median'}. Source: ` +
    '`design_system/public/taste-table.json`._'

  return [
    stamp,
    '',
    ...header,
    ...body,
    '',
    `**Under ${finishLine}, bottom first:**`,
    '',
    ...underLines,
  ].join('\n')
}

/**
 * Idempotent regeneration of the marker-wrapped block inside `fullText`.
 *
 * - Markers already present -> replace only what is between them.
 * - No markers yet (first run) -> find the CURRENT markdown table (the first
 *   `| class | ... median ... |` header and its contiguous `|`-prefixed rows)
 *   and wrap that span, leaving every other line of the section — the intro
 *   prose, "Primitives named on the most classes", "Done rule", "Finish
 *   line" — untouched.
 * - No table found at all -> append the wrapped block at the end of the file,
 *   so the tool never silently no-ops on an unfamiliar fixture.
 */
export function regenerateMarkdownSection(fullText, block, { start = TASTE_TABLE_START, end = TASTE_TABLE_END } = {}) {
  const wrapped = `${start}\n${block}\n${end}`
  const markerRe = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`)
  const text = String(fullText ?? '')
  if (markerRe.test(text)) return text.replace(markerRe, wrapped)

  const lines = text.split('\n')
  let spanStart = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*\|.*\bclass\b.*\|.*\bmedian\b.*\|/i.test(lines[i])) {
      spanStart = i
      break
    }
  }
  if (spanStart === -1) {
    const sep = text.endsWith('\n') ? '' : '\n'
    return `${text}${sep}\n${wrapped}\n`
  }
  let spanEnd = spanStart
  for (let i = spanStart; i < lines.length; i += 1) {
    if (/^\s*\|/.test(lines[i])) spanEnd = i
    else break
  }
  const before = lines.slice(0, spanStart).join('\n')
  const after = lines.slice(spanEnd + 1).join('\n')
  return `${before}\n${wrapped}\n${after}`
}
