#!/usr/bin/env node
/**
 * generate-search-registry.mjs — SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30 §11 P1.
 *
 * The pipeline's normalize + generate stages, in detect-and-prove mode: the
 * generator does NOT rewrite lib/search/field-registry.ts (that is T0's later
 * compose step). It proves the hand-maintained registry against the MLS's own
 * field metadata and emits a reviewable report the ci:search-registry-generated
 * gate re-derives and compares.
 *
 *   raw Spark pulls (gitignored, data/search-metadata/raw/ or --input <dir>)
 *     └─ normalize ──► data/search-metadata/spark-metadata.snapshot.json  (committed)
 *   snapshot + curation + registry (parsed via the TypeScript AST — repo rule:
 *   code-inspecting tooling uses AST/module resolution, never regex)
 *     └─ compare ───► data/search-metadata/registry-report.json           (committed)
 *
 * Model (plan §2.2 + §5, applied):
 *   - Spark metadata is DESIGN-TIME vocabulary only: which fields exist, which
 *     values are legal, which property classes each value belongs to.
 *   - Per-value class validity ships as `AppliesTo` HINTS only
 *     (`valueClassesHint`). Real class conditioning comes from OBSERVED
 *     per-class prevalence in our own database (the P3 census artifact), never
 *     from this file — Spark marks `Deck`/`Patio` class-B-only while they
 *     appear on ~a third of live class-A listings.
 *   - This report deliberately contains NO live-DB numbers so the gate's
 *     byte-for-byte reproduction check stays deterministic and secret-less.
 *
 * Concept model (plan §10): the MLS publishes one custom field per allowed
 * value of a parent enum. Normalization collapses that:
 *   - `<StandardName>`      — every StandardField; enum values merge the
 *                             /standardfields values pull with the Labels of CF
 *                             booleans whose StandardizedAs points at it.
 *   - `cf:<Field Name>`     — CF list/scalar fields with no standard parent
 *                             (e.g. `cf:ADU SqFt`, `cf:CCR's YN`).
 *   - `group:<Group Label>` — CF groups of parentless booleans acting as one
 *                             enum (e.g. `group:Flood`, `group:Rooms`); values
 *                             are the member Labels (Label, not field name —
 *                             field names carry MLS dedup suffixes: `Office2`).
 *
 * Curation (plan §11.1) lives in data/search-metadata/curation.json, keyed by
 * stable ids. Humans own source mappings, derived-field declarations, option
 * allowlists, and exclusions — each with a REQUIRED reason. Humans structurally
 * cannot own vocabulary membership: there is no curation field that ADDS a
 * metadata value, only explanations of divergence.
 *
 * The mask-dead exclusion set (the 10 fields removed 2026-07-30 plus
 * laundryFeatures, removed 2026-07-29) rides in curation.json so the generator
 * can never re-propose them and the gate fails if one reappears.
 *
 * Usage:
 *   node scripts/generate-search-registry.mjs                 # snapshot must exist
 *   node scripts/generate-search-registry.mjs --input <dir>   # (re)normalize raw pulls first
 *
 * Exits 1 when the comparison finds violations (unmapped field, unexplained
 * option, exclusion reappearance) — the same conditions the gate enforces.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

export const DATA_DIR = 'data/search-metadata'
export const SNAPSHOT_PATH = `${DATA_DIR}/spark-metadata.snapshot.json`
export const CURATION_PATH = `${DATA_DIR}/curation.json`
export const REPORT_PATH = `${DATA_DIR}/registry-report.json`
export const REGISTRY_PATH = 'lib/search/field-registry.ts'

const RAW_STANDARD = 'spark-standardfields.json'
const RAW_CUSTOM = 'spark-customfields.json'
const RAW_VALUES = 'spark-field-values.json'

// ── deterministic JSON ──────────────────────────────────────────────────────
/** Stringify with every object's keys sorted, so diffs are reviewable and the
 * gate can compare byte-for-byte. Arrays keep their (already sorted) order. */
export function canonicalJson(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v).sort()) out[k] = sort(v[k])
      return out
    }
    return v
  }
  return JSON.stringify(sort(value), null, 2) + '\n'
}

const uniqSorted = (arr) => [...new Set(arr)].sort()

// ── name conventions (mechanical identity only — anything else is curation) ──
const pascalFromCamel = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const pascalFromSnake = (s) =>
  s
    .replace(/_arr$/, '')
    .split('_')
    .map((p) => (p === 'yn' ? 'YN' : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
const titleSpaced = (s) =>
  s
    .replace(/_arr$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')

// ── normalize: raw Spark pulls → committed snapshot ─────────────────────────
export function normalizeRaw(rawDir) {
  const read = (f) => JSON.parse(readFileSync(join(rawDir, f), 'utf8'))
  const standard = read(RAW_STANDARD)
  const custom = read(RAW_CUSTOM)
  const fieldValues = read(RAW_VALUES)

  const pulledAt = [RAW_STANDARD, RAW_CUSTOM, RAW_VALUES]
    .map((f) => statSync(join(rawDir, f)).mtime.toISOString().slice(0, 10))
    .sort()
    .pop()

  /** conceptId -> concept */
  const concepts = {}
  const anomalies = []

  // 1. Every StandardField is a concept.
  for (const [name, def] of Object.entries(standard)) {
    concepts[name] = {
      conceptKind: 'standard',
      sparkName: name,
      group: null,
      label: def.Label ?? name,
      type: def.Type ?? null,
      searchable: def.Searchable === true,
      hasList: def.HasList === true,
      multiSelect: def.MultiSelect === true,
      classes: uniqSorted(def.MlsVisible ?? []),
      payloads: uniqSorted(def.Payloads ?? []),
      values: null,
      valueClassesHint: null,
    }
  }

  // 2. Seed enum values from the per-field values pull (AppliesTo = hint only).
  const applyValues = (concept, entry) => {
    const values = uniqSorted(entry.values ?? [])
    const hint = {}
    for (const bc of entry.byClass ?? []) hint[bc.v] = uniqSorted([...(hint[bc.v] ?? []), ...(bc.a ?? [])])
    concept.values = uniqSorted([...(concept.values ?? []), ...values])
    concept.valueClassesHint = { ...(concept.valueClassesHint ?? {}) }
    for (const [v, a] of Object.entries(hint)) {
      concept.valueClassesHint[v] = uniqSorted([...(concept.valueClassesHint[v] ?? []), ...a])
    }
  }

  // 3. CustomFields: fold StandardizedAs booleans into their parent enum;
  //    parentless booleans aggregate into group:* concepts; parentless
  //    list/scalar fields become cf:* concepts.
  const cfConceptByFieldName = {}
  for (const [groupLabel, groupDef] of Object.entries(custom)) {
    for (const [fieldName, def] of Object.entries(groupDef.Fields ?? {})) {
      const label = def.Label ?? fieldName
      const classes = uniqSorted(def.MlsVisible ?? [])
      if (def.StandardizedAs && def.Type === 'Boolean') {
        const parent = concepts[def.StandardizedAs]
        if (!parent) continue // StandardizedAs points at a field the SF pull does not carry
        parent.values = uniqSorted([...(parent.values ?? []), label])
        parent.valueClassesHint = { ...(parent.valueClassesHint ?? {}) }
        parent.valueClassesHint[label] = uniqSorted([...(parent.valueClassesHint[label] ?? []), ...classes])
        continue
      }
      if (def.StandardizedAs) continue // scalar alias of a standard field — the SF concept covers it
      if (def.Type === 'Boolean') {
        const id = `group:${groupLabel}`
        const g = (concepts[id] ??= {
          conceptKind: 'group',
          sparkName: groupLabel,
          group: groupLabel,
          label: groupLabel,
          type: 'Boolean',
          searchable: false,
          hasList: true,
          multiSelect: true,
          classes: [],
          payloads: null,
          values: [],
          valueClassesHint: {},
        })
        g.searchable = g.searchable || def.Searchable === true
        g.classes = uniqSorted([...g.classes, ...classes])
        g.values = uniqSorted([...g.values, label])
        g.valueClassesHint[label] = uniqSorted([...(g.valueClassesHint[label] ?? []), ...classes])
        continue
      }
      // CF field names are unique except one known collision ('Listing
      // Service' appears in two groups) — disambiguate with the group label.
      const id = concepts[`cf:${fieldName}`] ? `cf:${groupLabel}/${fieldName}` : `cf:${fieldName}`
      concepts[id] = {
        conceptKind: 'custom',
        sparkName: fieldName,
        group: groupLabel,
        label,
        type: def.Type ?? null,
        searchable: def.Searchable === true,
        hasList: def.HasList === true,
        multiSelect: false,
        classes,
        payloads: null, // Spark publishes Payloads on StandardFields only
        values: null,
        valueClassesHint: null,
      }
      cfConceptByFieldName[fieldName] = id
    }
  }

  // 4. Attach pulled value lists (SF names and CF field names share the pull).
  for (const [name, entry] of Object.entries(fieldValues)) {
    const target = concepts[name] ?? concepts[cfConceptByFieldName[name] ?? '']
    if (target) applyValues(target, entry)
  }

  // 5. Plan §10.2 trap 2: a field whose own Label is one of its values
  //    (ArchitecturalStyle.Label === "A-Frame") must be flagged loudly, never
  //    shipped as a display label.
  for (const [id, c] of Object.entries(concepts)) {
    if (c.values && c.values.includes(c.label) && c.label !== c.sparkName && titleSpaced(c.sparkName) !== c.label) {
      anomalies.push(`${id}: metadata Label ${JSON.stringify(c.label)} is one of the field's own values — do not use it as a display label`)
    }
  }

  const standardCount = Object.values(concepts).filter((c) => c.conceptKind === 'standard').length
  return {
    _meta: {
      generatedBy: 'scripts/generate-search-registry.mjs',
      plan: 'docs/plans/SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md §11 (P1)',
      source: 'Spark API raw pulls (spark-standardfields.json, spark-customfields.json, spark-field-values.json) — raw is gitignored; this normalized snapshot is the committed artifact',
      sourcePulledAt: pulledAt,
      note: 'valueClassesHint carries Spark AppliesTo/MlsVisible per value as a HINT only — class validity is decided by observed per-class prevalence in our own database (plan §2.2/§5), never by this file.',
      counts: {
        concepts: Object.keys(concepts).length,
        standard: standardCount,
        custom: Object.values(concepts).filter((c) => c.conceptKind === 'custom').length,
        group: Object.values(concepts).filter((c) => c.conceptKind === 'group').length,
        searchable: Object.values(concepts).filter((c) => c.searchable).length,
      },
    },
    anomalies: anomalies.sort(),
    concepts,
  }
}

// ── registry extraction (TypeScript AST — never regex) ──────────────────────
export function extractRegistryFields(root = process.cwd()) {
  const path = join(root, REGISTRY_PATH)
  const sf = ts.createSourceFile(REGISTRY_PATH, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let arr = null
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'SEARCH_FIELDS' && n.initializer) {
      let init = n.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression
      if (ts.isArrayLiteralExpression(init)) arr = init
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!arr) throw new Error(`${REGISTRY_PATH}: SEARCH_FIELDS array literal not found`)

  const lit = (node) => {
    if (ts.isStringLiteralLike(node)) return node.text
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(lit)
    return undefined
  }

  const fields = []
  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue
    const f = {}
    for (const p of el.properties) {
      if (!ts.isPropertyAssignment(p)) continue
      const name = ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) ? p.name.text : null
      if (!name) continue
      if (['key', 'label', 'kind', 'mv', 'category'].includes(name)) f[name] = lit(p.initializer)
      if (name === 'options') f.options = lit(p.initializer)
      if (name === 'dalExpression') f.dalExpression = lit(p.initializer)
    }
    if (f.key) fields.push(f)
  }
  return fields
}

// ── loaders ─────────────────────────────────────────────────────────────────
export const loadSnapshot = (root = process.cwd()) => JSON.parse(readFileSync(join(root, SNAPSHOT_PATH), 'utf8'))
export const loadCuration = (root = process.cwd()) => JSON.parse(readFileSync(join(root, CURATION_PATH), 'utf8'))

// ── comparison: registry × snapshot × curation → report + violations ────────
export function buildComparison({ snapshot, curation, registryFields }) {
  const concepts = snapshot.concepts
  const problems = []
  const sources = curation.sources ?? {}
  const allow = curation.optionAllowlist ?? {}
  const exclusions = curation.exclusions ?? {}

  const excludedKeys = new Set(Object.keys(exclusions))
  const excludedConcepts = new Set()
  const excludedMvs = new Set()
  for (const e of Object.values(exclusions)) {
    for (const c of e.concepts ?? []) excludedConcepts.add(c)
    for (const m of e.mvColumns ?? []) excludedMvs.add(m)
  }

  // Resolution: curation first, then mechanical name identity only.
  const resolve = (f) => {
    const cur = sources[f.key]
    if (cur?.derived) return { concept: null, resolution: 'derived', reason: cur.reason ?? null, viaValue: null }
    if (cur?.concept) return { concept: cur.concept, resolution: 'curation', reason: cur.reason ?? null, viaValue: cur.viaValue ?? null }
    for (const [cand, how] of [
      [pascalFromCamel(f.key), 'auto:key'],
      [pascalFromSnake(f.mv ?? ''), 'auto:mv'],
      [`group:${titleSpaced(f.key)}`, 'auto:group'],
      [`group:${titleSpaced(f.mv ?? '')}`, 'auto:group'],
      [`cf:${titleSpaced(f.key)}`, 'auto:cf'],
    ]) {
      if (cand && concepts[cand]) return { concept: cand, resolution: how, reason: null, viaValue: null }
    }
    return { concept: null, resolution: 'unmapped', reason: null, viaValue: null }
  }

  const mappedConcepts = new Set()
  const fieldsReport = {}
  let curationAdditionTotal = 0
  let candidateGapTotal = 0

  for (const f of registryFields) {
    const r = resolve(f)
    const concept = r.concept ? concepts[r.concept] : null
    if (r.concept) mappedConcepts.add(r.concept)

    // (c) the mask-dead exclusion set can never quietly come back
    if (excludedKeys.has(f.key)) {
      problems.push(`exclusion violated: registry key '${f.key}' is on the mask-dead exclusion list (${exclusions[f.key].reason})`)
    }
    if (r.concept && excludedConcepts.has(r.concept)) {
      problems.push(`exclusion violated: registry field '${f.key}' maps to excluded concept '${r.concept}'`)
    }
    if (f.mv && excludedMvs.has(f.mv)) {
      problems.push(`exclusion violated: registry field '${f.key}' reads mask-dead MV column '${f.mv}'`)
    }

    // (a) every registry field maps to a metadata field or is declared derived
    if (r.resolution === 'unmapped') {
      problems.push(`unmapped: registry field '${f.key}' (mv ${f.mv}) matches no metadata concept and has no curation source/derived entry`)
    }
    if (r.resolution === 'derived' && !r.reason) {
      problems.push(`derived without reason: registry field '${f.key}' — curation derived entries require a reason`)
    }
    if (r.concept && !concept) {
      problems.push(`bad curation: registry field '${f.key}' maps to '${r.concept}' which is not in the snapshot`)
    }

    // (b) options: registry ⊆ metadata ∪ allowlist; the rest are candidate gaps
    const metaValues = concept?.values ?? null
    let curationAdditions = []
    let unexplained = []
    let candidateGaps = []
    if (f.options && f.options.length) {
      const allowed = new Set((allow[f.key] ?? []).map((a) => a.option))
      const meta = new Set(metaValues ?? [])
      curationAdditions = uniqSorted(f.options.filter((o) => !meta.has(o)))
      unexplained = curationAdditions.filter((o) => !allowed.has(o))
      if (metaValues) candidateGaps = uniqSorted(metaValues.filter((v) => !f.options.includes(v)))
      for (const o of unexplained) {
        problems.push(
          metaValues
            ? `option not in metadata: '${f.key}' option '${o}' is absent from ${r.concept} values and from the curation allowlist`
            : `option unverifiable: '${f.key}' option '${o}' — concept ${r.concept ?? '(none)'} carries no metadata value list and the option is not allowlisted`,
        )
      }
    }
    if (r.viaValue && metaValues && !metaValues.includes(r.viaValue)) {
      const allowed = new Set((allow[f.key] ?? []).map((a) => a.option))
      if (!allowed.has(r.viaValue)) {
        problems.push(`viaValue not in metadata: '${f.key}' targets ${r.concept} value '${r.viaValue}' which the metadata does not list`)
      }
    }
    curationAdditionTotal += curationAdditions.length
    candidateGapTotal += candidateGaps.length

    fieldsReport[f.key] = {
      kind: f.kind ?? null,
      mv: f.mv ?? null,
      sparkSource: r.concept,
      resolution: r.resolution,
      resolutionReason: r.reason,
      viaValue: r.viaValue,
      searchable: concept ? concept.searchable : null,
      idxPayload: concept ? (concept.payloads ? concept.payloads.includes('IDX') : null) : null,
      classes: concept ? concept.classes : null,
      metadataOptions: metaValues,
      curationAdditions,
      candidateGaps,
    }
  }

  // Long tail (P5 feed): exposable metadata concepts with no registry mapping.
  // Standard = Searchable && IDX payload (plan §10.1). Custom/group concepts
  // carry no Payloads flag, so searchable-only, reported separately.
  const longStandard = []
  const longCustom = []
  for (const [id, c] of Object.entries(concepts)) {
    if (mappedConcepts.has(id) || excludedConcepts.has(id)) continue
    if (!c.searchable) continue
    if (c.conceptKind === 'standard') {
      if (c.payloads?.includes('IDX')) longStandard.push(id)
    } else {
      longCustom.push(id)
    }
  }
  longStandard.sort()
  longCustom.sort()

  const byResolution = {}
  for (const f of Object.values(fieldsReport)) byResolution[f.resolution] = (byResolution[f.resolution] ?? 0) + 1

  const report = {
    _meta: {
      generatedBy: 'scripts/generate-search-registry.mjs',
      plan: 'docs/plans/SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md §11 (P1)',
      registry: REGISTRY_PATH,
      snapshot: SNAPSHOT_PATH,
      curation: CURATION_PATH,
      snapshotPulledAt: snapshot._meta?.sourcePulledAt ?? null,
      note: 'Deterministic (sorted keys, no timestamps, no live-DB reads) so ci:search-registry-generated can require byte-for-byte reproduction. Coverage/prevalence is the separate P3 census artifact — per plan §2.2/§5 class validity comes from observed prevalence; metadata AppliesTo is a hint only.',
    },
    summary: {
      registryFields: registryFields.length,
      byResolution,
      mappedConcepts: mappedConcepts.size,
      curationAdditionTotal,
      candidateGapTotal,
      longTailStandardCount: longStandard.length,
      longTailCustomCount: longCustom.length,
      exclusions: excludedKeys.size,
    },
    fields: fieldsReport,
    exclusions,
    longTail: {
      standardSearchableIdxUnregistered: { count: longStandard.length, concepts: longStandard },
      customSearchableUnregistered: { count: longCustom.length, concepts: longCustom },
    },
    anomalies: snapshot.anomalies ?? [],
  }
  return { report, problems: problems.sort() }
}

// ── main ────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  const root = process.cwd()
  const inputIdx = process.argv.indexOf('--input')
  const rawDir = inputIdx > -1 ? process.argv[inputIdx + 1] : null

  mkdirSync(join(root, DATA_DIR), { recursive: true })

  if (rawDir) {
    for (const f of [RAW_STANDARD, RAW_CUSTOM, RAW_VALUES]) {
      if (!existsSync(join(rawDir, f))) {
        console.error(`✗ --input ${rawDir}: missing ${f} (need all three raw Spark pulls)`)
        process.exit(1)
      }
    }
    const snapshot = normalizeRaw(rawDir)
    writeFileSync(join(root, SNAPSHOT_PATH), canonicalJson(snapshot))
    console.log(`normalized ${snapshot._meta.counts.concepts} concepts → ${SNAPSHOT_PATH}`)
  } else if (!existsSync(join(root, SNAPSHOT_PATH))) {
    console.error(`✗ ${SNAPSHOT_PATH} not found and no --input <dir> given.`)
    console.error('  Provide the directory holding the raw Spark pulls (spark-standardfields.json, spark-customfields.json, spark-field-values.json).')
    process.exit(1)
  }

  if (!existsSync(join(root, CURATION_PATH))) {
    console.error(`✗ ${CURATION_PATH} not found — the curation layer (sources, optionAllowlist, exclusions) is a required committed artifact.`)
    process.exit(1)
  }

  const snapshot = loadSnapshot(root)
  const curation = loadCuration(root)
  const registryFields = extractRegistryFields(root)
  const { report, problems } = buildComparison({ snapshot, curation, registryFields })
  writeFileSync(join(root, REPORT_PATH), canonicalJson(report))

  const s = report.summary
  console.log('Search registry generator (plan §11 P1)')
  console.log('=======================================')
  console.log(`registry fields: ${s.registryFields} · resolutions: ${JSON.stringify(s.byResolution)}`)
  console.log(`option divergences explained by curation: ${s.curationAdditionTotal} · candidate option gaps: ${s.candidateGapTotal}`)
  console.log(`long tail — standard searchable+IDX unregistered: ${s.longTailStandardCount} · custom/group searchable unregistered: ${s.longTailCustomCount}`)
  console.log(`mask-dead exclusions enforced: ${s.exclusions}`)
  if (report.anomalies.length) {
    console.log('\nMetadata anomalies (plan §10.2):')
    for (const a of report.anomalies) console.log(`  ! ${a}`)
  }
  console.log(`\nwrote ${REPORT_PATH}`)

  if (problems.length) {
    console.error('\nProblems:')
    for (const p of problems) console.error(`  ✗ ${p}`)
    console.error(`\n✗ ${problems.length} problem(s) — fix the registry, the curation layer, or the snapshot before shipping.`)
    process.exit(1)
  }
  console.log('✓ registry fully explained by metadata + curation.')
}
