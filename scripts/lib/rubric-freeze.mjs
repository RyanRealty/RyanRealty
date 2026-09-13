/**
 * rubric-freeze.mjs — the pure checks behind ci:rubric-freeze.
 *
 * The site queue's accept test is a ruler. Between 2026-09-08 and 2026-09-12
 * the ruler changed four times, and each change rebaselined every class, so
 * a page could be rebuilt three times and never once be measured as better
 * than before. `design_system/public/taste-rule-freeze.json` names the ruler
 * for one full round; these functions say whether the code and the table
 * still match it.
 *
 * Two questions, both mechanical:
 *   1. drift  — do the live constants (rubric version, rubric file, finish
 *      line, judge chain, rule dates) equal the manifest?
 *   2. coverage — does every class in the registry have a table row scored
 *      on the manifest's rubric by an allowed judge, with an integer median?
 *
 * A rubric bump that ships without full coverage fails. That is the point.
 */

export function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

/** Shape problems with the manifest itself. */
export function manifestProblems(manifest) {
  if (!isPlainObject(manifest)) return ['taste-rule-freeze.json must be an object.']
  const p = []
  if (!/^v\d+-\d{4}-\d{2}-\d{2}$/.test(String(manifest.rubricVersion ?? ''))) {
    p.push('manifest.rubricVersion must look like v1-2026-09-12.')
  }
  if (typeof manifest.rubricPath !== 'string' || !manifest.rubricPath.endsWith('.md')) {
    p.push('manifest.rubricPath must name the rubric markdown file.')
  }
  if (!Number.isInteger(manifest.finishLine) || manifest.finishLine < 1 || manifest.finishLine > 100) {
    p.push('manifest.finishLine must be an integer 1-100.')
  }
  if (typeof manifest.primaryEvaluator !== 'string' || !manifest.primaryEvaluator.trim()) {
    p.push('manifest.primaryEvaluator must name the first link of the judge chain.')
  }
  if (!Array.isArray(manifest.allowedEvaluators) || manifest.allowedEvaluators.length === 0) {
    p.push('manifest.allowedEvaluators must list every model allowed to sign a receipt.')
  } else if (!manifest.allowedEvaluators.includes(manifest.primaryEvaluator)) {
    p.push('manifest.allowedEvaluators must include manifest.primaryEvaluator.')
  }
  for (const k of ['frozenAt', 'receiptV2From', 'demoMatchRuleFrom', 'competitiveBriefRuleFrom', 'riseFloorFrom']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(manifest[k] ?? ''))) p.push(`manifest.${k} must be a YYYY-MM-DD date.`)
  }
  // A rise floor is a NUMBER (CLAUDE.md §0): it ships with a named basis or not at all.
  if (!Number.isInteger(manifest.riseFloor) || manifest.riseFloor < 1 || manifest.riseFloor > 30) {
    p.push('manifest.riseFloor must be an integer 1-30 — the smallest rise the judge can tell from its own noise.')
  }
  const basis = manifest.riseFloorBasis
  if (!isPlainObject(basis) || !isNonEmptyString(basis.method) || !isNonEmptyString(basis.command) || !isNonEmptyString(basis.table)) {
    p.push('manifest.riseFloorBasis must record { method, command, table, ... } — a floor with no basis is an invented number.')
  } else if (Number.isInteger(basis.q95) && basis.q95 !== manifest.riseFloor) {
    p.push(`manifest.riseFloor ${manifest.riseFloor} does not equal riseFloorBasis.q95 ${basis.q95} — re-run riseFloorBasis.command and write what it prints.`)
  }
  if (manifest.coverageExceptions != null && !isPlainObject(manifest.coverageExceptions)) {
    p.push('manifest.coverageExceptions must be an object of class -> reason.')
  }
  return p
}

/**
 * Live constants vs the manifest. `live` is what the modules export today:
 * { rubricVersion, rubricPath, finishLine, tableFinishLine, primaryEvaluator,
 *   allowedEvaluators, receiptV2From, demoMatchRuleFrom, demoMatchRubric,
 *   competitiveBriefRuleFrom }
 */
export function driftProblems(manifest, live) {
  const p = []
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const check = (label, got, want) => {
    if (!same(got, want)) {
      p.push(`${label} drifted: code says ${JSON.stringify(got)}, the freeze says ${JSON.stringify(want)}.`)
    }
  }
  check('rubricVersion (scripts/lib/taste-evaluate-result.mjs RUBRIC_VERSION)', live.rubricVersion, manifest.rubricVersion)
  check('rubricPath (scripts/lib/taste-evaluate-result.mjs RUBRIC_PATH)', live.rubricPath, manifest.rubricPath)
  check('finishLine (scripts/lib/taste-receipt.mjs FINISH_LINE)', live.finishLine, manifest.finishLine)
  check('finishLine (scripts/lib/taste-table-core.mjs FINISH_LINE)', live.tableFinishLine, manifest.finishLine)
  check('primaryEvaluator (EVALUATOR_MODEL)', live.primaryEvaluator, manifest.primaryEvaluator)
  check(
    'allowedEvaluators (ALLOWED_EVALUATORS)',
    [...(live.allowedEvaluators ?? [])].sort(),
    [...(manifest.allowedEvaluators ?? [])].sort(),
  )
  check('receiptV2From (RECEIPT_V2_FROM)', live.receiptV2From, manifest.receiptV2From)
  check('demoMatchRuleFrom (DEMO_MATCH_RULE_FROM)', live.demoMatchRuleFrom, manifest.demoMatchRuleFrom)
  check('demoMatchRubric (DEMO_MATCH_RUBRIC)', live.demoMatchRubric, manifest.rubricVersion)
  check('competitiveBriefRuleFrom (COMPETITIVE_BRIEF_RULE_FROM)', live.competitiveBriefRuleFrom, manifest.competitiveBriefRuleFrom)
  check('riseFloor (scripts/lib/taste-receipt.mjs RISE_FLOOR)', live.riseFloor, manifest.riseFloor)
  check('riseFloorFrom (RISE_FLOOR_FROM)', live.riseFloorFrom, manifest.riseFloorFrom)
  return p
}

/**
 * Rubric files newer than the frozen one are a bump that skipped the freeze.
 * `rubricFiles` are the basenames under design_system/public/.
 */
export function strayRubricProblems(manifest, rubricFiles) {
  const frozen = String(manifest.rubricVersion ?? '')
  const p = []
  for (const f of rubricFiles ?? []) {
    const m = f.match(/^taste-evaluator\.(v\d+-\d{4}-\d{2}-\d{2})\.md$/)
    if (!m) continue
    if (m[1] > frozen) {
      p.push(
        `${f} is newer than the frozen rubric ${frozen}. Either bump taste-rule-freeze.json and re-run the whole table in this change, or delete the file.`,
      )
    }
  }
  return p
}

/**
 * Every registry class must be on the frozen rubric from an allowed judge.
 * `registryClasses` is taste-classes.json's `classes` array; `table` is
 * taste-table.json. Returns problems; the caller prints the re-run command.
 */
export function coverageProblems(manifest, registryClasses, table) {
  const p = []
  const rows = new Map()
  for (const r of Array.isArray(table?.rows) ? table.rows : []) {
    if (isPlainObject(r) && typeof r.key === 'string') rows.set(r.key, r)
  }
  const instrument = isPlainObject(table?.instrument) ? table.instrument : {}
  const allowed = new Set(manifest.allowedEvaluators ?? [])
  const isAllowed = (m) => {
    const s = String(m ?? '').trim()
    return allowed.has(s) || /^claude-(sonnet|opus)-\d/.test(s)
  }
  const exceptions = isPlainObject(manifest.coverageExceptions) ? manifest.coverageExceptions : {}
  for (const cls of Array.isArray(registryClasses) ? registryClasses : []) {
    const key = isPlainObject(cls) ? String(cls.key ?? '') : ''
    if (!key) continue
    if (typeof exceptions[key] === 'string' && exceptions[key].trim()) continue
    const row = rows.get(key)
    if (!row) {
      p.push(`${key}: no row in the table.`)
      continue
    }
    const rubric = row.rubricVersion ?? instrument.rubricVersion
    if (rubric !== manifest.rubricVersion) {
      p.push(`${key}: scored on ${rubric ?? 'an unrecorded rubric'}, the freeze is ${manifest.rubricVersion}.`)
      continue
    }
    const model = row.evaluatorModel ?? instrument.evaluatorModel
    if (!isAllowed(model)) {
      p.push(`${key}: scored by ${model ?? 'an unrecorded model'}, not a judge on the chain (${[...allowed].join(', ')}).`)
      continue
    }
    if (!Number.isInteger(row.median)) {
      p.push(`${key}: no integer median${row.invalid ? ` (${row.invalid})` : ''}.`)
      continue
    }
    if (typeof row.invalid === 'string' && row.invalid.trim()) {
      p.push(`${key}: row is invalid — ${row.invalid}`)
      continue
    }
    // Rows scored from the tableRowsBindFrom date owe what a receipt owes: the
    // judge's demoMatch verdict and a hash of the shots the median was given
    // for (Matt 2026-09-12: the table dropped demoMatch; rows named shots
    // nobody could find).
    const bindFrom = String(manifest.tableRowsBindFrom ?? '')
    const scoredOn = String(table?.evaluatedAt ?? '')
    if (bindFrom && scoredOn >= bindFrom) {
      if (typeof row.demoMatch !== 'boolean') {
        p.push(`${key}: no demoMatch verdict on the row (${JSON.stringify(row.demoMatchVotes ?? null)}) — the rubric requires it on every scoring.`)
      }
      if (!/^sha256:[0-9a-f]{64}$/.test(String(row.shotsHash ?? ''))) {
        p.push(`${key}: no shotsHash — the row does not bind to the shots it was scored on.`)
      }
    }
  }
  return p
}

/** One call for the gate: every problem, grouped. */
export function rubricFreezeProblems({ manifest, live, rubricFiles, registryClasses, table }) {
  const shape = manifestProblems(manifest)
  if (shape.length) return { shape, drift: [], stray: [], coverage: [] }
  return {
    shape: [],
    drift: driftProblems(manifest, live),
    stray: strayRubricProblems(manifest, rubricFiles),
    coverage: coverageProblems(manifest, registryClasses, table),
  }
}
