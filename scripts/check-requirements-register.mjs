#!/usr/bin/env node
/**
 * check-requirements-register.mjs — G57: Matt's requirements may never be dropped.
 *
 * docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md is the demand side of the company
 * version: every directive Matt has issued, dispositioned. This gate makes
 * "he said five things so forget the 120 others" a build failure. Static file
 * checks only (no DB) so it runs in the secret-less ci:gates chain.
 *
 * Fails when:
 *   1. The register is missing, or R-IDs are not contiguous R-001..R-max
 *      (a deleted requirement breaks numbering — rows leave only by becoming
 *      SUPERSEDED in place).
 *   2. A row's disposition is not in the closed set.
 *   3. A MISSING row does not cite a covering gap (G-number) — unbuilt
 *      requirements must be carried by the version manifest, not float.
 *   4. A MISSING/PARTIAL row has an empty Covers cell.
 *   5. A G-number cited anywhere in the register does not exist in
 *      VERSION-1.md (dangling coverage).
 *
 * Catalog: docs/MECHANICAL_GATES.md (G57). Canon: DEVELOPMENT_PROCESS.md.
 */
import { readFileSync, existsSync } from 'node:fs'

const REGISTER = 'docs/plans/ENTERPRISE_MAP/REQUIREMENTS.md'
const MANIFEST = 'docs/plans/ENTERPRISE_MAP/VERSION-1.md'
const DISPOSITIONS = new Set(['LOCKED', 'VERIFIED', 'PARTIAL', 'MISSING', 'PARKED', 'GATED', 'SUPERSEDED'])

const fails = []

for (const f of [REGISTER, MANIFEST]) {
  if (!existsSync(f)) {
    console.error(`FAIL: ${f} missing`)
    process.exit(1)
  }
}

const register = readFileSync(REGISTER, 'utf8')
const manifest = readFileSync(MANIFEST, 'utf8')

// Parse rows: | R-### | requirement | source | disposition | covers |
const rows = []
for (const m of register.matchAll(/^\|\s*R-(\d{3})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm)) {
  rows.push({
    num: Number(m[1]),
    requirement: m[2].trim(),
    source: m[3].trim(),
    disposition: m[4].trim().replace(/\*/g, ''),
    covers: m[5].trim(),
  })
}

if (rows.length === 0) {
  console.error(`FAIL: no R-rows parsed from ${REGISTER}`)
  process.exit(1)
}

// 1. Contiguity + tail pin. The adversarial audit (2026-08-15) proved deleting
// the highest-numbered row was invisible; the register must declare its max in
// a "**Max:** R-nnn" line, cross-checked both directions.
const maxHeader = register.match(/^\*\*Max:\*\*\s*R-(\d{3})/m)
if (!maxHeader) {
  fails.push(`${REGISTER}: missing the "**Max:** R-nnn" pin line — without it, tail-row deletion is invisible`)
}
const declaredMax = maxHeader ? Number(maxHeader[1]) : null
const nums = new Set(rows.map((r) => r.num))
const actualMax = Math.max(...nums)
if (declaredMax != null) {
  if (actualMax < declaredMax) {
    fails.push(`Max pin declares R-${String(declaredMax).padStart(3, '0')} but the highest row present is R-${String(actualMax).padStart(3, '0')} — tail row(s) were deleted instead of SUPERSEDED in place`)
  } else if (actualMax > declaredMax) {
    fails.push(`rows reach R-${String(actualMax).padStart(3, '0')} but the Max pin says R-${String(declaredMax).padStart(3, '0')} — update the pin in the same change`)
  }
}
const max = Math.max(actualMax, declaredMax ?? 0)
for (let i = 1; i <= max; i++) {
  if (!nums.has(i)) {
    fails.push(`R-${String(i).padStart(3, '0')} is missing while R-${String(max).padStart(3, '0')} exists — requirements leave only by becoming SUPERSEDED in place, never by deletion`)
  }
}
const dupes = rows.map((r) => r.num).filter((n, i, a) => a.indexOf(n) !== i)
for (const d of [...new Set(dupes)]) {
  fails.push(`R-${String(d).padStart(3, '0')} appears more than once`)
}

// 2-4. Dispositions + coverage
const counts = {}
for (const r of rows) {
  counts[r.disposition] = (counts[r.disposition] ?? 0) + 1
  if (!DISPOSITIONS.has(r.disposition)) {
    fails.push(`R-${String(r.num).padStart(3, '0')}: unknown disposition "${r.disposition}" (allowed: ${[...DISPOSITIONS].join(', ')})`)
    continue
  }
  const coversEmpty = !r.covers || r.covers === '—' || r.covers === '-'
  if (r.disposition === 'MISSING' && !/G\d+/.test(r.covers)) {
    fails.push(`R-${String(r.num).padStart(3, '0')} is MISSING but cites no covering gap (G-number) — unbuilt requirements must be carried by the version manifest`)
  }
  if ((r.disposition === 'MISSING' || r.disposition === 'PARTIAL') && coversEmpty) {
    fails.push(`R-${String(r.num).padStart(3, '0')} is ${r.disposition} with an empty Covers cell — name the gap, owner, or residual that carries it`)
  }
}

// 5. Dangling gap references — MISSING rows only. Their Covers cell must name
// manifest gap rows; other dispositions may cite mechanical gates (G44, G56…)
// or loops as free-form evidence, which live in a different G-namespace.
const manifestGaps = new Set([...manifest.matchAll(/^\|\s*(G\d+)\s*\|/gm)].map((m) => m[1]))
for (const r of rows) {
  if (r.disposition !== 'MISSING') continue
  for (const g of r.covers.matchAll(/\b(G\d+)\b/g)) {
    if (!manifestGaps.has(g[1])) {
      fails.push(`R-${String(r.num).padStart(3, '0')} (MISSING) cites ${g[1]} which is not a gap row in ${MANIFEST}`)
    }
  }
}

console.log('Requirements-register gate (G57)')
console.log('================================')
console.log(
  `rows: ${rows.length} (R-001..R-${String(max).padStart(3, '0')}) · ` +
    Object.entries(counts)
      .sort()
      .map(([k, v]) => `${k} ${v}`)
      .join(' · '),
)
if (fails.length === 0) {
  console.log('Every requirement is present, dispositioned, and covered. Nothing dropped.')
  process.exit(0)
}
console.log()
for (const f of fails) console.log('FAIL  ' + f)
process.exit(1)
