/**
 * Frozen noindex LPs — the named hole in ci:public-ui B.
 *
 * B (legacyPages) counts public pages that import a non-v3 register and zero v3.
 * Paid/frozen LPs are conversion surfaces E-SYSTEM already noindexed. Restyling
 * them is out of lease. They still exist, so they would pin B > 0 forever unless
 * B is allowed to ignore them.
 *
 * THE HOLE THIS MODULE CLOSES: an exclusion that said "any noindex page" would
 * let a new public route hide from the wrap by adding robots.index=false. This
 * list is the exclusion, and it is tight:
 *
 *   1. Every entry is under app/lp/ and is a page.tsx.
 *   2. Every entry's why names noindex (the growth comment).
 *   3. The page file currently declares robots index:false (or pageMetadata
 *      noindex: true). Becoming indexable fails ci:public-ui.
 *   4. A public page NOT on this list still counts toward B, even if noindex.
 *   5. Growing the list without (2)+(3) fails. A new LP with non-v3 imports
 *      still grows A (nonV3ImportSites), which may only shrink, so it cannot
 *      sneak in without an explicit --allow-growth on A.
 *
 * Source of truth for the wrap gate. scripts/__tests__/check-public-ui-frozen-lps.test.ts
 * break-tests the validator. Do not restyle listed pages.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** @typedef {{ file: string, why: string }} FrozenNoindexLp */

/** @type {readonly FrozenNoindexLp[]} */
export const FROZEN_NOINDEX_LPS = Object.freeze([
  {
    file: 'app/lp/tetherow/heath/page.tsx',
    why: 'E-SYSTEM frozen Heath LP. robots noindex. Do not restyle.',
  },
])

const ROBOTS_NOINDEX =
  /robots\s*:\s*\{[^}]*\bindex\s*:\s*false\b|\bnoindex\s*:\s*true\b|robots\s*:\s*['"]noindex/s

/**
 * @param {string} src
 * @returns {boolean}
 */
export function pageDeclaresNoindex(src) {
  return ROBOTS_NOINDEX.test(src)
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
export function isFrozenNoindexLp(rel) {
  return FROZEN_NOINDEX_LPS.some((row) => row.file === rel)
}

/**
 * @param {string} root
 * @param {readonly FrozenNoindexLp[]} [entries]
 * @returns {string[]} failures
 */
export function frozenNoindexLpFailures(root, entries = FROZEN_NOINDEX_LPS) {
  const failures = []
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push('frozen noindex LP list is empty — B exclusion must be named, not a heuristic')
    return failures
  }
  const seen = new Set()
  for (const row of entries) {
    if (!row || typeof row.file !== 'string' || typeof row.why !== 'string') {
      failures.push('frozen noindex LP row is missing file or why')
      continue
    }
    if (!row.file.startsWith('app/lp/') || !row.file.endsWith('/page.tsx')) {
      failures.push(`${row.file}: frozen B exclusion is LP page.tsx only, not a public content route`)
    }
    if (!/noindex/i.test(row.why)) {
      failures.push(`${row.file}: why must name noindex so the list cannot grow as a silent hide`)
    }
    if (seen.has(row.file)) failures.push(`${row.file}: duplicate frozen LP row`)
    seen.add(row.file)
    const abs = join(root, row.file)
    if (!existsSync(abs)) {
      failures.push(`${row.file}: listed frozen LP does not exist`)
      continue
    }
    const src = readFileSync(abs, 'utf8')
    if (!pageDeclaresNoindex(src)) {
      failures.push(`${row.file}: listed as frozen noindex LP but the page is indexable`)
    }
  }
  return failures
}

/**
 * @param {string} root
 * @param {readonly FrozenNoindexLp[]} [entries]
 */
export function assertFrozenNoindexLps(root, entries = FROZEN_NOINDEX_LPS) {
  const failures = frozenNoindexLpFailures(root, entries)
  if (failures.length) {
    const err = new Error(`frozen noindex LPs: ${failures.join('; ')}`)
    err.failures = failures
    throw err
  }
}
