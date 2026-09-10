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
import { builderCard, classForRoute } from './taste-catalog.mjs'

export { isNonEmptyString, isPlainObject, median3 }

/** Matt, 2026-09-09: "the finish line is 70 on the table instrument." */
export const FINISH_LINE = 70

/** Matt 2026-09-10: UI/UX rises; every other product metric holds or improves. */
export const PRODUCT_HOLD =
  'The loop is comprehensive: SEO, listing/page information, and UX all rise on the same pass. Name an SEO increment (title, JSON-LD, crawlable links, and/or payload/LCP better than HEAD). Name an information increment (listing cards carry price+address+beds/baths/sqft; listing detail keeps and fills the 13-row house contract; sourced figures stay). UX: catalog source installed, demo match. Product hold: honesty, sourced figures, requiredComponents, JSON-LD, titles, conversion asks, tap targets, and page payload must not fall. A prettier page that drops any of those, or that only restyles UX, is not done. ci:mockup-parity and ci:runtime-gates stay green. honestyFunction must not fall vs the prior mark (omitting it to skip the hold fails). requiredComponents cannot shrink vs HEAD; a JSON-LD or conversion-ask role present at HEAD must remain. Listing pages keep the 13-row house contract (bleed hero, PropertySpecs, MLS remarks, schools, payment, Tour/Call/Text).'

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

// ---------------------------------------------------------------------------
// seed drafts — SITE-62: a class under the finish line emits a DRAFT seed
// ---------------------------------------------------------------------------
//
// The table scores; the seeder upserts. Nothing joins them. This helper reads
// a table + the used version_gap set and returns TypeScript Seed literals a
// person pastes into scripts/seed-site-queue.ts after review. It never writes
// Supabase. Numbering is the next free SITE-\d+ after max(used), assigned in
// a stable order (class name, then median) so two runs on the same inputs
// emit the same ids.

const SITE_GAP_LITERAL = /versionGap:\s*['"](SITE-[^'"]+)['"]/g

/** Parse `versionGap: 'SITE-…'` literals out of seed-site-queue.ts source. */
export function collectUsedVersionGaps(sourceText) {
  const gaps = []
  const re = new RegExp(SITE_GAP_LITERAL.source, 'g')
  let m
  while ((m = re.exec(String(sourceText ?? '')))) {
    if (!gaps.includes(m[1])) gaps.push(m[1])
  }
  return gaps
}

/**
 * Next integer after max(SITE-\d+) among used gaps. SITE-M1 and any other
 * non-numeric suffix are used (they occupy a name) but do not sit in the
 * integer sequence.
 */
export function nextFreeSiteNumber(usedGaps) {
  let max = -1
  for (const g of usedGaps ?? []) {
    const m = String(g).match(/^SITE-(\d+)$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/** SITE-00 .. SITE-09 keep the seeder's two-digit pad; SITE-10+ are unpadded. */
export function formatSiteGap(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid site number ${n}`)
  return n < 10 ? `SITE-0${n}` : `SITE-${n}`
}

function firstSentence(text) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const m = s.match(/^(.+?[.!?])(?:\s|$)/)
  const sentence = m ? m[1] : s
  return sentence.length > 180 ? `${sentence.slice(0, 179).trimEnd()}…` : sentence
}

function scoresPhrase(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return 'unknown'
  return scores.join(' · ')
}

function defectLine(d) {
  const finding = String(d.finding ?? '').replace(/\s+/g, ' ').trim()
  const short = finding.length > 160 ? `${finding.slice(0, 159).trimEnd()}…` : finding
  return `${d.section} (${d.primitive}): ${short}`
}

function sortUnderFinishLine(rows) {
  return rows.slice().sort((a, b) => {
    const c = String(a.key ?? '').localeCompare(String(b.key ?? ''))
    if (c !== 0) return c
    return a.median - b.median
  })
}

const FILE_PATH_IN_PRIMITIVE = '[A-Za-z0-9_./-]+\\.(?:tsx|ts|jsx|js|mjs|css)'

/**
 * The table's evaluator often annotates `primitive` ("V3Quiet.tsx (shared)").
 * Seed drafts need a path that exists; they must not invent one. Try the raw
 * string, then the token before ` (`, then the first path-shaped substring
 * that is already in the field and on disk.
 */
export function resolvePrimitivePath(primitive, root) {
  if (!isNonEmptyString(primitive) || primitive.includes('..')) return null
  const raw = primitive.trim()
  const tryPath = (p) => Boolean(p) && !p.includes('..') && existsSync(join(root, p))
  if (tryPath(raw)) return raw
  const beforeParen = raw.split(/\s+\(/)[0].trim()
  if (beforeParen !== raw && tryPath(beforeParen)) return beforeParen
  const matches = raw.match(new RegExp(FILE_PATH_IN_PRIMITIVE, 'g')) ?? []
  for (const c of matches) {
    if (tryPath(c)) return c
  }
  return null
}

/** Defects whose primitive resolves to a file on disk. Severity is not a filter. */
export function draftDefects(defects, root) {
  if (!Array.isArray(defects)) return []
  const out = []
  for (const d of defects) {
    if (!isPlainObject(d)) continue
    const path = resolvePrimitivePath(d.primitive, root)
    if (!path) continue
    out.push({ ...d, primitive: path })
  }
  return out
}

function shotSpecText(shotSpec) {
  if (shotSpec == null) return 'first viewport, scripts/take-route-shots.mjs default, 1440 and 375'
  return typeof shotSpec === 'string' ? shotSpec : JSON.stringify(shotSpec)
}

function catalogObjectiveBit(card) {
  if (!card?.classKey) return ''
  const parts = [
    `Start with \`node scripts/lib/taste-catalog.mjs ${card.classKey} --preflight\`. Fetch and INSTALL the printed catalog jobs (shadcn add / registry URL); restyle navy/cream/Geist/Amboqia/Iconoir; keep the interaction. A cream box with the catalog name is not adapted. If a job has no house primitive, ADD one to components/site/v3 that still matches the demo.`,
  ]
  if (card.layoutLock) parts.push(`Layout lock: ${card.layoutLock}`)
  if (Array.isArray(card.fetch) && card.fetch.length) {
    parts.push(`Fetch: ${card.fetch.map((f) => f.id).join(', ')}.`)
  }
  if (Array.isArray(card.add) && card.add.length) {
    parts.push(`ADD if missing: ${card.add.join(', ')}.`)
  }
  parts.push('Record adaptedFrom on the receipt. Empty adaptedFrom is inventing a layout.')
  parts.push(PRODUCT_HOLD)
  return ` ${parts.join(' ')}`
}

function buildOneDraft(row, versionGap, defects, shotSpec, card) {
  const key = row.key
  const median = row.median
  const titleBit = firstSentence(row.verdict) || firstSentence(row.dullest) || 'under the finish line'
  const defectBit =
    defects.length > 0
      ? `Defects: ${defects.map(defectLine).join('; ')}.`
      : 'No on-disk primitive was named on the defects — fetch the catalog jobs and ADD a house primitive rather than inventing a layout.'
  return {
    versionGap,
    domain: 'public-ux',
    title: `${key}: ${titleBit}`,
    objective:
      `Class ${key} scored ${median} (${scoresPhrase(row.scores)}) on the table instrument. ` +
      `${defectBit}` +
      catalogObjectiveBit(card),
    output:
      `A reviewed seed in scripts/seed-site-queue.ts for class ${key}; recapture first-viewport shots on the table instrument; taste receipt per TASTE.md with adaptedFrom and replaceWith.`,
    accept:
      `On the table instrument, class ${key} scores above ${median}. Recapture shotSpec ${shotSpecText(shotSpec)}. ` +
      `tasteReview.adaptedFrom names a catalog module for this class. Each defect names replaceWith from the builder-card option list (id + demo URL), or null if craft/honesty/SEO not form. Live control must match the chosen demo (same interaction, our colors). Score rise without a demo match is not done. A taste score below 70 is not done for the class. Rebaseline is not done. Evidence names an SEO increment and an information/listing-inventory increment; a UX-only restyle is not done. ` +
      PRODUCT_HOLD,
  }
}

/**
 * Draft Seed objects for every class whose median is under the finish line.
 * A class at or above the line emits nothing.
 *
 * A class under the line emits when (a) a defect names a primitive that
 * exists at `root`, OR (b) the taste catalog has modules for that class —
 * missing house primitive is ADD to the barrel, not a skip. Only a class
 * with neither a disk primitive nor a catalog is skipped (warning).
 */
export function buildSeedDrafts({ table, usedGaps, root, finishLine = FINISH_LINE, catalog = null } = {}) {
  const rows = Array.isArray(table?.rows) ? table.rows : Array.isArray(table) ? table : []
  const shotSpec = isPlainObject(table?.instrument) ? table.instrument.shotSpec ?? null : null
  const under = rows.filter((r) => isPlainObject(r) && isNonEmptyString(r.key) && Number.isInteger(r.median) && r.median < finishLine)
  const sorted = sortUnderFinishLine(under)
  const drafts = []
  const skipped = []
  const warnings = []
  let n = nextFreeSiteNumber(usedGaps)
  for (const row of sorted) {
    const kept = draftDefects(row.defects, root)
    const classKey = catalog ? classForRoute(catalog, row.key) ?? row.key : null
    const card =
      classKey && Array.isArray(catalog?.classes?.[classKey]?.modules) && catalog.classes[classKey].modules.length >= 2
        ? builderCard(catalog, classKey)
        : null
    if (kept.length === 0 && !card) {
      skipped.push(row.key)
      warnings.push(
        `${row.key}: median ${row.median} is under ${finishLine} but no defect names a primitive that exists on disk and the catalog has no modules — skipped, not invented.`,
      )
      continue
    }
    drafts.push(buildOneDraft(row, formatSiteGap(n), kept, shotSpec, card))
    n += 1
  }
  return { drafts, skipped, warnings }
}

export const SEED_DRAFT_BANNER = [
  'DRAFT — not seeded. Nothing was written to Supabase by this tool.',
  'A class under the finish line is not a node until a person edits scripts/seed-site-queue.ts and runs `npx tsx scripts/seed-site-queue.ts`.',
  'This is review-and-paste, not auto-seed.',
  'Each draft already carries the catalog builder card (`node scripts/lib/taste-catalog.mjs <class> --preflight`) and an accept that requires adaptedFrom, replaceWith from the option list, and a demo match.',
  'Priority: SEO and information hold first. Product hold: UI/UX may rise; honesty, required sections, JSON-LD, asks, tap targets, and payload must hold or improve.',
].join('\n')

function formatOneDraft(d) {
  return [
    '  {',
    `    versionGap: ${JSON.stringify(d.versionGap)},`,
    `    domain: ${JSON.stringify(d.domain)},`,
    `    title: ${JSON.stringify(d.title)},`,
    `    objective:`,
    `      ${JSON.stringify(d.objective)},`,
    `    output: ${JSON.stringify(d.output)},`,
    `    accept:`,
    `      ${JSON.stringify(d.accept)},`,
    '  },',
  ].join('\n')
}

/** TypeScript Seed literals plus the DRAFT banner. Stdout of `--seed-draft`. */
export function formatSeedDrafts(drafts) {
  const body = (drafts ?? []).map(formatOneDraft).join('\n')
  return `${SEED_DRAFT_BANNER}\n\n${body}\n`
}
