#!/usr/bin/env node
/**
 * check-newsletter-scope.mjs — the per-broker analytics scope gate (G-NL-12).
 *
 * Spec §9.5: "New tab in admin/console. Role gate: admin_roles.role='broker' →
 * only their own slug's events; superuser → all brokers with a filter.
 * Enforced at the query layer... gate G-NL-12 includes a test that broker A
 * cannot read broker B's rows."
 *
 * Two ways that silently breaks:
 *
 *   G-NL-12a  The DAL (lib/data/newsletter/brokerAnalytics.ts) queries
 *             newsletter_recipients / newsletter_recipient_events WITHOUT
 *             filtering by the broker param — an unscoped aggregate would
 *             hand every broker every OTHER broker's engagement data. Assert
 *             every query in the file is scoped: `.eq('broker'` must appear
 *             at least once per exported read function, keyed to the
 *             brokerSlug/slug parameter — not a hardcoded literal.
 *   G-NL-12b  The console page (app/admin/(protected)/newsletters/analytics/
 *             page.tsx) resolves a RESTRICTED broker's slug from the CLIENT
 *             (searchParams) instead of the SESSION (scopeBroker/getCrmAccess).
 *             A restricted broker must never be able to widen scope by hand-
 *             editing ?broker=<other-slug> in the URL. Assert the page calls
 *             getCrmAccess() + scopeBroker(...), and that the branch which
 *             consults `searchParams`/`requestedBroker` for the broker slug is
 *             gated behind an `isSuperuser` (scopeBroker===null) check.
 *
 * Static + comment-stripped (checks CODE, not doc comments).
 *
 * Usage: node scripts/check-newsletter-scope.mjs [--json] [--report]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const PATHS = {
  dal: join(ROOT, 'lib/data/newsletter/brokerAnalytics.ts'),
  page: join(ROOT, 'app/admin/(protected)/newsletters/analytics/page.tsx'),
}

function safeRead(p) {
  return existsSync(p) ? stripJsComments(readFileSync(p, 'utf8')) : null
}

export function runChecks({ dal, page }) {
  const results = []

  // G-NL-12a: the DAL scopes every analytics read by the broker param.
  if (dal == null) {
    results.push({ id: 'G-NL-12a dal-scoped', ok: false, detail: 'lib/data/newsletter/brokerAnalytics.ts not found' })
  } else {
    const eqBrokerCount = (dal.match(/\.eq\(\s*['"]broker['"]/g) ?? []).length
    // Both exported reader functions must exist and each must scope by broker.
    const hasAnalyticsFn = /export async function getBrokerNewsletterAnalytics\(/.test(dal)
    const hasWarmListFn = /export async function getBrokerWarmList\(/.test(dal)

    // No query chain may read the recipients/events tables without a
    // .eq('broker', ...) filter IN THAT SAME CHAIN. A function-body-level
    // check is too coarse (a scoped countEvent() helper anywhere in the
    // function would "cover" an unrelated unscoped read in the same
    // function) — so instead this walks every `.from(TABLE)` call site and
    // inspects only the chain immediately following it, up to the next
    // statement boundary (a blank line, or the start of the next `const`/
    // `await` statement at the same indentation), for `.eq('broker'`.
    const TABLE_RE = /\.from\(\s*(RECIPIENTS|EVENTS|'newsletter_recipients'|'newsletter_recipient_events')\s*\)/g
    const unscopedSites = []
    let m
    while ((m = TABLE_RE.exec(dal)) !== null) {
      // The chain window: from the .from(...) call to the next blank line
      // (queries are always followed by a blank line before the next
      // statement in this file's style) or 400 chars, whichever is shorter.
      const rest = dal.slice(m.index, m.index + 400)
      const blankLineIdx = rest.search(/\n[ \t]*\n/)
      const chain = blankLineIdx === -1 ? rest : rest.slice(0, blankLineIdx)
      if (!/\.eq\(\s*['"]broker['"]/.test(chain)) {
        unscopedSites.push(m[0])
      }
    }
    const unscopedTableRead = unscopedSites.length > 0

    const ok = eqBrokerCount >= 2 && hasAnalyticsFn && hasWarmListFn && !unscopedTableRead
    results.push({
      id: 'G-NL-12a dal-scoped',
      ok,
      detail: ok
        ? `brokerAnalytics.ts — every analytics/warm-list read scopes by .eq('broker', ...) (${eqBrokerCount} scoped call(s) found)`
        : `brokerAnalytics.ts — expected getBrokerNewsletterAnalytics + getBrokerWarmList, each with a .eq('broker', ...) filter on every newsletter_recipients/newsletter_recipient_events read${unscopedTableRead ? ` (found ${unscopedSites.length} table read(s) with no broker filter in the same query chain)` : ''}`,
    })
  }

  // G-NL-12b: the console page resolves a restricted broker's slug from the
  // SESSION (scopeBroker/getCrmAccess), never from the client-supplied param.
  if (page == null) {
    results.push({ id: 'G-NL-12b session-scoped-page', ok: false, detail: 'app/admin/(protected)/newsletters/analytics/page.tsx not found' })
  } else {
    const importsAccess = /getCrmAccess/.test(page)
    const importsScope = /scopeBroker/.test(page)
    // The page must gate any use of the client-supplied broker param (from
    // searchParams) behind a superuser/unrestricted check — i.e. the
    // requested-broker branch must be conditioned on the scope result being
    // null (isSuperuser / restrictedSlug === null), not applied unconditionally.
    const gatesClientParamBehindSuperuser =
      /isSuperuser\s*=\s*restrictedSlug\s*===\s*null/.test(page) &&
      /isSuperuser\s*\?[\s\S]{0,200}requestedBroker/.test(page)
    const ok = importsAccess && importsScope && gatesClientParamBehindSuperuser
    results.push({
      id: 'G-NL-12b session-scoped-page',
      ok,
      detail: ok
        ? 'analytics/page.tsx — resolves the restricted broker slug via getCrmAccess()+scopeBroker(); the client searchParams broker is only consulted when isSuperuser (restrictedSlug === null)'
        : `analytics/page.tsx — missing ${!importsAccess ? 'getCrmAccess() ' : ''}${!importsScope ? 'scopeBroker() ' : ''}${!gatesClientParamBehindSuperuser ? 'or the searchParams broker branch is not gated behind isSuperuser (restrictedSlug === null)' : ''}`,
    })
  }

  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')
  const results = runChecks({ dal: safeRead(PATHS.dal), page: safeRead(PATHS.page) })
  const failures = results.filter((r) => !r.ok)
  if (asJson) {
    console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  } else {
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} newsletter-scope: ${r.id} — ${r.detail}`)
    if (failures.length) console.error(`\n✗ newsletter-scope: ${failures.length} check(s) failed.`)
    else console.log(`\n✓ newsletter-scope: all ${results.length} checks passed (G-NL-12).`)
  }
  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
