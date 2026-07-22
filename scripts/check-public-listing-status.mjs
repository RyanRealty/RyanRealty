#!/usr/bin/env node
/**
 * G-COMINGSOON — "Coming Soon" must never reach a public-facing surface.
 *
 * Why this gate exists: on 2026-07-21 Coming Soon listings were found rendering
 * on the live public site — in the search grid, on listing detail pages, in
 * public inventory counts, and in the sitemap submitted to Google. Root cause
 * was not one bug but drift: the "on-market statuses" list had been copy-pasted
 * into ~20 independent files with no shared definition, so Coming Soon was
 * present in some public predicates and absent from others, and nothing failed
 * when a new public query re-added it.
 *
 * The fix was lib/listing-status-public.ts (single source of truth). This gate
 * keeps it that way: no public-surface file may name the Coming Soon status
 * directly. Admin/broker/sync files may — they are allowlisted below with a
 * reason, because brokers must see their own pre-marketing inventory.
 *
 * Run: npm run ci:public-listing-status  (wired into ci:gates)
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const SOURCE_OF_TRUTH = 'lib/listing-status-public.ts'

/**
 * Files permitted to reference Coming Soon directly. Each entry needs a reason.
 * Adding a PUBLIC file here is a compliance decision, not a lint decision —
 * don't do it to make the gate pass.
 */
const ALLOWLIST = new Map([
  [SOURCE_OF_TRUTH, 'the single source of truth — defines the policy'],
  ['scripts/check-public-listing-status.mjs', 'this gate'],
  ['lib/listing-status.ts', 'MLS state classifier shared with sync; comment only'],
  ['lib/format/listing-status.ts', 'pill CSS classifier; admin console styling'],
  ['lib/sync/deltaSync.ts', 'MLS delta sync must track Coming Soon transitions'],
  ['lib/data/admin/syncCounts.ts', 'admin sync dashboard — broker-only'],
  ['lib/data/admin/listingEdit.ts', 'admin listing editor — broker-only'],
  ['lib/data/prospecting/batch.ts', 'broker prospecting tooling'],
  ['lib/data/prospecting/compliance.ts', 'broker compliance tooling'],
  ['lib/data/prospecting/get.ts', 'broker prospecting tooling'],
  ['lib/data/expired/outreach.ts', 'expired-listing outreach: re-list guard'],
  ['components/console/StatusPill.tsx', 'admin console status pill — no public importer'],
  ['lib/spark.ts', 'Spark MLS API client — must request Coming Soon to sync it'],
  ['app/actions/sync-spark.ts', 'MLS sync action — must ingest Coming Soon'],
  ['lib/video-tours-listing-videos-join.ts', 'shared row helper; callers apply the public predicate'],
  ['app/marketing/request/deliverables.ts', 'broker marketing-request menu (coming-soon teaser is a broker deliverable)'],
])

/** Directories whose files are broker-authenticated by construction. */
const ADMIN_PREFIXES = ['app/admin/', 'components/admin/', 'app/api/admin/', 'app/api/cron/']

/**
 * Source globs the gate scans.
 *
 * supabase/migrations is deliberately EXCLUDED: migrations are an append-only
 * historical ledger and cannot be edited to satisfy a gate. SQL-side status
 * predicates (search_listings_advanced, listing_search_mv, geo_snapshot_mv,
 * listing_boundary_xref_mv) are tracked separately — see
 * docs/plans/COMING_SOON_SQL_FOLLOWUP.md. The app layer, which is what actually
 * renders the public site, is fully covered here.
 */
const SCAN_GLOBS = ['app', 'components', 'lib']

const COMING_SOON_RE = /coming[\s_-]*soon/i

/**
 * The gate targets Coming Soon used as an MLS STATUS, not the English phrase.
 * "Photos coming soon" in a placeholder is fine; `'Coming Soon'` in a status
 * predicate is not. A line is a violation only when it mentions Coming Soon AND
 * carries status context.
 */
const STATUS_CONTEXT_RE =
  /StandardStatus|standard_status|statusFilter|ListingStatus|status_filter|p_status|STATUS_TONE|PILL_TONE|statusLabel|statusDot|\bstatus\s*[=:)]|\bstatus\b\s*===/

/**
 * Identifiers exported by the source of truth. A file that references Coming
 * Soon only through these is doing the right thing — it delegated the policy.
 */
const DELEGATED_RE =
  /COMING_SOON_STATUS|isComingSoonStatus|isPubliclyDisplayableStatus|PUBLIC_ACTIVE_STATUSES|PUBLIC_PENDING_STATUSES|PUBLIC_ON_MARKET_STATUSES|PUBLIC_ACTIVE_OR_PREDICATE|PUBLIC_ON_MARKET_OR_PREDICATE|PUBLIC_SEARCH_STATUS_FILTERS|MV_NOT_COMING_SOON_OR_PREDICATE/

function tracked() {
  return execSync(
    `git ls-files ${SCAN_GLOBS.join(' ')}`,
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
    .split('\n')
    .filter((f) => /\.(ts|tsx|mjs|sql)$/.test(f))
}

const violations = []

for (const file of tracked()) {
  if (ALLOWLIST.has(file)) continue
  if (ADMIN_PREFIXES.some((p) => file.startsWith(p))) continue

  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (!COMING_SOON_RE.test(src)) continue

  src.split('\n').forEach((line, i) => {
    if (!COMING_SOON_RE.test(line)) return
    // A comment that merely explains the exclusion is fine — what we forbid is
    // naming the status in an actual predicate or displayable value.
    const trimmed = line.trim()
    const isComment =
      trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') ||
      trimmed.startsWith('--')
    if (isComment) return
    // Delegating to the source of truth is the fix, not a violation.
    if (DELEGATED_RE.test(line)) return
    // English prose ("Photos coming soon") is not an MLS status reference.
    if (!STATUS_CONTEXT_RE.test(line)) return
    violations.push({ file, line: i + 1, text: trimmed.slice(0, 160) })
  })
}

if (violations.length > 0) {
  console.error('\n[31m✗ G-COMINGSOON: "Coming Soon" referenced on a public-facing surface[0m\n')
  console.error('  Coming Soon is an MLS pre-marketing state. Showing it to the public is a')
  console.error('  licensing violation for Ryan Realty. It may only appear on /admin surfaces')
  console.error('  and broker/sync tooling.\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    ${v.text}`)
  }
  console.error(`\n  Fix: import the public status policy from ${SOURCE_OF_TRUTH}`)
  console.error('       (PUBLIC_ACTIVE_STATUSES / PUBLIC_ACTIVE_OR_PREDICATE /')
  console.error('        isPubliclyDisplayableStatus / isComingSoonStatus).')
  console.error('  If the file is genuinely broker-only, add it to ALLOWLIST in')
  console.error('  scripts/check-public-listing-status.mjs with a reason.\n')
  process.exit(1)
}

console.log(`✓ G-COMINGSOON: no public surface references Coming Soon (${ALLOWLIST.size} allowlisted broker/sync files)`)
