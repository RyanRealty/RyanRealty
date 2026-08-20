#!/usr/bin/env node
/**
 * Weekly market report — geographic scope lock.
 *
 * THE CLASS. The MLS/Spark feed is statewide and so is `listing_tile_mv`
 * (verified live 2026-08-19: 76,925 Medford rows, 40,851 Grants Pass, 34,304
 * Klamath Falls). Anything that pulls listings without naming a geography, then
 * publishes the result under "Central Oregon", is publishing Southern Oregon.
 *
 * THE FOUNDING CASE. Seven published weekly reports did exactly that.
 * /housing-market/reports/weekly-2026-05-24 stored 38 city sections and 274
 * closings under "Here's what happened in the Central Oregon real estate market
 * last week, by city"; 26 of those cities — Medford 43, Grants Pass 17, Klamath
 * Falls 14, Central Point 13, Ashland, Talent, White City, Albany, Clackamas,
 * Portland, Salem … — are out of area, roughly half the closings. Also
 * weekly-2026-03-08, 03-22, 03-29, 04-12, 05-10, 05-17.
 *
 * THE LOCK. One geography (lib/central-oregon.ts), applied at both ends:
 *   • generation — getMarketReportData returns through `scopeReportCities`
 *   • render     — getMarketReportBySlug returns through `scopeReportHtml`
 * and the dead pending source stays dead.
 *
 *   node scripts/check-publish-report-city-scope.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const checks = []

function src(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

// ── 1. The scope module is the one geography ────────────────────────────────
const scope = src('lib/market/report-scope.ts')
checks.push({
  label: 'report-scope exports the generation filter, the render filter, and the city predicate',
  ok:
    /export function isReportScopeCity\(/.test(scope) &&
    /export function scopeReportCities</.test(scope) &&
    /export function scopeReportHtml\(/.test(scope) &&
    /export const REPORT_SCOPE_LABEL = 'Central Oregon'/.test(scope),
})
checks.push({
  label: 'report-scope derives its geography from lib/central-oregon, not a second list',
  ok:
    /import \{ isCentralOregonCity \} from '@\/lib\/central-oregon'/.test(scope) &&
    !/\[\s*'bend'/i.test(scope) &&
    !/'Medford'|'Grants Pass'|'Klamath Falls'/.test(scope),
})
checks.push({
  label: 'report-scope removes only sections it positively resolved out of area',
  ok:
    /unresolvedSections/.test(scope) &&
    /if \(city == null\) \{\s*\n\s*unresolvedSections \+= 1\s*\n\s*return section/.test(scope),
})

// ── 2. Generation is scoped ─────────────────────────────────────────────────
const action = src('app/actions/market-reports.ts')
checks.push({
  label: 'getMarketReportData returns through scopeReportCities',
  ok:
    /import \{ scopeReportCities \} from '@\/lib\/market\/report-scope'/.test(action) &&
    /export async function getMarketReportData\([\s\S]*?\n\}/.test(action) &&
    /return scopeReportCities\(/.test(
      action.match(/export async function getMarketReportData\([\s\S]*?\n\}/)?.[0] ?? '',
    ),
})
checks.push({
  label: 'the report body still claims Central Oregon (change the claim, revisit the scope)',
  ok: /Central Oregon real estate market last week, by city/.test(
    src('app/actions/generate-market-report.ts'),
  ),
})

// ── 3. Render is scoped ─────────────────────────────────────────────────────
const reader = src('lib/data/market/getMarketReports.ts')
checks.push({
  label: 'getMarketReportBySlug returns a scoped body',
  ok:
    /import \{ scopeReportHtml \} from '@\/lib\/market\/report-scope'/.test(reader) &&
    /const scoped = scopeReportHtml\(row\.content_html\)/.test(reader) &&
    /content_html: row\.content_html == null \? null : scoped\.html/.test(reader),
})
checks.push({
  label: 'the report-body cache key was bumped past the unscoped bodies',
  ok:
    /'market-report-by-slug-v2'/.test(reader) && !/'market-report-by-slug-v1'/.test(reader),
})
checks.push({
  label: 'app/actions no longer ships a second, unscoped report reader',
  ok:
    !/export async function getMarketReportBySlug/.test(action) &&
    !/from\('market_reports'\)/.test(action),
})

// ── 4. The dead pending source stays dead ───────────────────────────────────
// `listing_history.event` carries no Pending value — verified live 2026-08-19
// over 3,900,010 rows. A filter on it can only ever return [], which is why
// every published report showed zero pendings while the copy promised them.
const DEAD_PENDING_RE = /ilike\(\s*['"]event['"]\s*,\s*['"]%Pending%['"]\s*\)/i
const offenders = []
for (const dir of ['lib', 'app']) {
  const stack = [join(ROOT, dir)]
  while (stack.length) {
    const cur = stack.pop()
    for (const entry of readdirSync(cur)) {
      if (entry === 'node_modules' || entry === '.next') continue
      const full = join(cur, entry)
      if (statSync(full).isDirectory()) {
        stack.push(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry) || /\.test\.|\.spec\./.test(entry)) continue
      if (DEAD_PENDING_RE.test(readFileSync(full, 'utf8'))) offenders.push(relative(ROOT, full))
    }
  }
}
checks.push({
  label: 'no reader filters listing_history on a Pending event that does not exist',
  ok: offenders.length === 0,
  detail: offenders.join(', '),
})
const pendingDal = src('lib/data/listings/getWentPendingInWindow.ts')
checks.push({
  label: "the weekly report reads pendings from activity_events 'status_pending'",
  ok:
    /getWentPendingInWindow/.test(action) &&
    /from\('activity_events'\)/.test(pendingDal) &&
    /\.eq\('event_type', 'status_pending'\)/.test(pendingDal),
})
checks.push({
  label: 'the pending read is scoped, paged, and throws rather than returning a quiet empty',
  ok:
    /scope: 'service-area'/.test(pendingDal) &&
    /isServiceAreaCity/.test(pendingDal) &&
    /fetchPagedRows/.test(pendingDal) &&
    /throw new Error\(`\[getWentPendingInWindow\]/.test(pendingDal),
})

// ── 4b. A window the pending source cannot answer prints nothing, not 0 ─────
// `activity_events` begins 2026-03-12 (verified live 2026-08-19, anon, two
// shapes: earliest row of any event_type 2026-03-12T12:54:05.062Z; count over
// 2026-02-01..2026-03-11 across every type = 0, over 2026-03-12..18 = 813).
// /reports/sales/<city>/last-year covers calendar 2025 and published "0" as a
// visible figure, as a Dataset variableMeasured value, and as "No pending
// sales in this period" on all seven PRIMARY_CITIES. A zero the source cannot
// measure is a fabricated fact, the same class as the dead listing_history
// filter above.
checks.push({
  label: 'the pending DAL names its coverage start and exports the predicate',
  ok:
    /export const PENDING_SOURCE_COVERAGE_START_ISO = '2026-03-12T12:54:05\.062Z'/.test(pendingDal) &&
    /export function isPendingWindowCovered\(/.test(pendingDal),
})
const salesPage = src('app/reports/sales/[city]/[period]/page.tsx')
const datasetLiteral = salesPage.match(/const datasetVariables[\s\S]*?\n {2}\]/)?.[0] ?? ''
const figuresLiteral = salesPage.match(/const figures: V3InstrumentFigure\[\] = \[[\s\S]*?\n {2}\]/)?.[0] ?? ''
checks.push({
  label: 'the sales report withholds the pending figure outside the source coverage window',
  ok:
    /isPendingWindowCovered/.test(salesPage) &&
    /const pendingCovered = isPendingWindowCovered\(start\.toISOString\(\)\)/.test(salesPage) &&
    // the unconditional pushes are gone from both literals
    datasetLiteral.length > 0 &&
    !/Pending sales/.test(datasetLiteral) &&
    figuresLiteral.length > 0 &&
    !/Pending sales/.test(figuresLiteral) &&
    // and each one is now inside the coverage branch
    /if \(pendingCovered\) \{[\s\S]{0,120}datasetVariables\.push\(\{ name: 'Pending sales'/.test(salesPage) &&
    /if \(pendingCovered\) \{[\s\S]{0,240}label: v3Text\('Pending sales'\)/.test(salesPage) &&
    // the empty state may not claim zero over a window the source cannot answer
    /emptyMessage=\{v3Text\(\s*\n?\s*pendingCovered/.test(salesPage),
})

// ── 5. The behavioural proof cannot be deleted silently ─────────────────────
const test = src('lib/market/__tests__/report-scope.test.ts')
checks.push({
  label: 'the unit test still proves the founding out-of-area cities are dropped',
  ok:
    /'Medford'/.test(test) &&
    /'Grants Pass'/.test(test) &&
    /'Klamath Falls'/.test(test) &&
    /scopeReportHtml/.test(test),
})
const coverageTest = src('lib/data/listings/went-pending-coverage.test.ts')
checks.push({
  label: 'the unit test still pins last-year outside the pending source coverage',
  ok:
    /isPendingWindowCovered\('2025-01-01/.test(coverageTest) &&
    /verdicts\['last-year'\]\)\.toBe\(false\)/.test(coverageTest),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}${!c.ok && c.detail ? ` — ${c.detail}` : ''}`)
}
if (failed.length) {
  console.error(`\npublish-report-city-scope: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-report-city-scope: ${checks.length}/${checks.length}`)
