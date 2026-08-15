#!/usr/bin/env node
/**
 * check-version-manifest.mjs — the anti-shortcut gate (THE LOOP v1.4.0).
 *
 * "These five things will be enough" is the failure mode this gate kills:
 * selection must happen over the FULL enumerated universe, and the version
 * manifest may never quietly shrink. Static file checks only (no DB) so it
 * runs in the secret-less ci:gates chain.
 *
 * Fails when:
 *   1. VERSION manifest is missing, or its Status header is missing /
 *      not OPEN|CERTIFIED (CERTIFIED must carry a commit SHA).
 *   2. A below-floor capability (maturity band 2/1/0 in the Enterprise Map
 *      CAPABILITIES matrix) is not mentioned anywhere in the manifest —
 *      i.e. it has no gap row, Matt move, or explicit PARK. Dropping a CAP
 *      from the plan without accounting for it becomes a build failure.
 *   3. A red-health integration (INTEGRATIONS health counts) is not
 *      mentioned in the manifest.
 *   4. Gap rows G1..Gmax or Matt moves M1..Mmax have holes — a silently
 *      deleted row breaks numbering and fails here.
 *   5. A gap row marked DONE carries no date evidence (YYYY-MM-DD).
 *
 * Catalog: docs/MECHANICAL_GATES.md. Canon: docs/DEVELOPMENT_PROCESS.md
 * §Company versions.
 */
import { readFileSync, existsSync } from 'node:fs'

const MANIFEST = 'docs/plans/ENTERPRISE_MAP/VERSION-1.md'
const CAPS = 'docs/plans/ENTERPRISE_MAP/matrix/CAPABILITIES.md'
const INTS = 'docs/plans/ENTERPRISE_MAP/matrix/INTEGRATIONS.md'

const fails = []

for (const f of [MANIFEST, CAPS, INTS]) {
  if (!existsSync(f)) {
    console.error(`FAIL: ${f} missing — the version manifest and map matrices are load-bearing`)
    process.exit(1)
  }
}

const manifest = readFileSync(MANIFEST, 'utf8')
const caps = readFileSync(CAPS, 'utf8')
const ints = readFileSync(INTS, 'utf8')

// 1. Status header
const status = manifest.match(/^\*\*Status:\s*(OPEN|CERTIFIED)\b(.*)$/m)
if (!status) {
  fails.push(`${MANIFEST}: missing "**Status: OPEN|CERTIFIED**" header`)
} else if (status[1] === 'CERTIFIED' && !/\b[0-9a-f]{8,40}\b/.test(status[2])) {
  fails.push(`${MANIFEST}: CERTIFIED without a commit SHA — certification is a commit, not a claim`)
}

// 2. Below-floor capabilities must be accounted for in the manifest.
function bandCaps(src, band) {
  const row = src.match(new RegExp(`^\\|\\s*${band}\\s+[A-Za-z]+\\s*\\|([^|]*)\\|`, 'm'))
  if (!row) return []
  return [...row[1].matchAll(/\b(\d{3})\b/g)].map((m) => `CAP-${m[1]}`)
}
const belowFloor = [...bandCaps(caps, 2), ...bandCaps(caps, 1), ...bandCaps(caps, 0)]
for (const cap of belowFloor) {
  if (!manifest.includes(cap)) {
    fails.push(
      `${cap} is below the Working floor in ${CAPS} but appears nowhere in ${MANIFEST} — add a gap row, a Matt move, or an explicit PARK. The plan may not quietly shrink.`,
    )
  }
}

// 3. Red integrations must be accounted for. The count cell is authoritative:
// a zero-count row's explanation may cite historical ids without reviving them.
const redRow = ints.match(/^\|\s*\*\*red\*\*\s*\|\s*\**(\d+)\**\s*\|([^|]*)\|/m)
const redCount = redRow ? Number(redRow[1]) : 0
const redInts =
  redRow && redCount > 0 ? [...redRow[2].matchAll(/\b(\d{3})\b/g)].map((m) => `INT-${m[1]}`) : []
for (const int of redInts) {
  if (!manifest.includes(int)) {
    fails.push(`${int} is red in ${INTS} but unaccounted in ${MANIFEST}`)
  }
}

// 4. Numbering continuity + tail pin — deletion protection. The adversarial
// audit (2026-08-15) proved deleting the HIGHEST-numbered row was invisible
// when max derived from surviving rows. The manifest must declare its own
// maxima in a "**Max:** Gnn · Mnn" header line; the gate cross-checks both
// directions (declared < actual = stale header; actual < declared = deleted
// tail). The declared max may only grow.
const maxHeader = manifest.match(/^\*\*Max:\*\*\s*G(\d+)\s*·\s*M(\d+)/m)
if (!maxHeader) {
  fails.push(`${MANIFEST}: missing the "**Max:** Gnn · Mnn" pin line — without it, tail-row deletion is invisible`)
}
function continuity(prefix, declaredMax) {
  const ids = [...manifest.matchAll(new RegExp(`^\\|\\s*${prefix}(\\d+)\\s*\\|`, 'gm'))].map((m) =>
    Number(m[1]),
  )
  if (ids.length === 0) {
    fails.push(`${MANIFEST}: no ${prefix}-rows found — the gap table is the plan; it cannot be empty`)
    return
  }
  const actualMax = Math.max(...ids)
  if (declaredMax != null) {
    if (actualMax < declaredMax) {
      fails.push(
        `${MANIFEST}: Max pin declares ${prefix}${declaredMax} but the highest row present is ${prefix}${actualMax} — tail row(s) were deleted instead of closed or parked`,
      )
    } else if (actualMax > declaredMax) {
      fails.push(`${MANIFEST}: rows reach ${prefix}${actualMax} but the Max pin says ${prefix}${declaredMax} — update the pin in the same change`)
    }
  }
  const limit = Math.max(actualMax, declaredMax ?? 0)
  for (let i = 1; i <= limit; i++) {
    if (!ids.includes(i)) {
      fails.push(
        `${MANIFEST}: ${prefix}${i} is missing while ${prefix}${limit} exists — a row was deleted instead of being closed with evidence (DONE + date) or PARKED`,
      )
    }
  }
}
continuity('G', maxHeader ? Number(maxHeader[1]) : null)
continuity('M', maxHeader ? Number(maxHeader[2]) : null)

// 5. DONE rows carry date evidence — G AND M rows (audit: M rows escaped this).
for (const m of manifest.matchAll(/^\|\s*([GM]\d+)\s*\|([^\n]*)$/gm)) {
  const [, id, rest] = m
  if (/\bDONE\b/.test(rest) && !/\b\d{4}-\d{2}-\d{2}\b/.test(rest)) {
    fails.push(`${MANIFEST}: ${id} claims DONE without a date — evidence or it did not happen`)
  }
}

console.log('Version-manifest comprehensiveness gate')
console.log('=======================================')
console.log(
  `below-floor CAPs: ${belowFloor.length} · red INTs: ${redInts.length} · status: ${status?.[1] ?? 'MISSING'}`,
)
if (fails.length === 0) {
  console.log('The version manifest accounts for the full universe. No silent shrinkage.')
  process.exit(0)
}
console.log()
for (const f of fails) console.log('FAIL  ' + f)
process.exit(1)
