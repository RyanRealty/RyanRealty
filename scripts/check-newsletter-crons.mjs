#!/usr/bin/env node
/**
 * check-newsletter-crons.mjs — cron wiring gate for the newsletter send +
 * reconcile pipeline (covers G-NL-15).
 *
 * The newsletter queue is only as reliable as the crons that drain it. A
 * `vercel.json` edit that drops the `/api/cron/newsletter-send` or
 * `/api/cron/newsletter-reconcile` entry (a bad merge, a copy-paste
 * mistake during an unrelated cron cleanup) silently stops every newsletter
 * from ever leaving `draft`/`sending` — with no error, no red build, just a
 * queue that never drains. This gate makes both crons a checked-in fact.
 *
 *   G-NL-15  `vercel.json` `crons` array must contain an entry whose `path`
 *            is `/api/cron/newsletter-send`.
 *   G-NL-15  `vercel.json` `crons` array must contain an entry whose `path`
 *            is `/api/cron/newsletter-reconcile`.
 *   G-NL-15  Both route files must exist:
 *            `app/api/cron/newsletter-send/route.ts` and
 *            `app/api/cron/newsletter-reconcile/route.ts`.
 *
 * Static checks only — reads and JSON.parses vercel.json plus existsSync on
 * the two route files, no network calls, no live cron trigger. Mirrors the
 * house style of scripts/check-newsletter-compliance.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-crons.mjs            # human output
 *   node scripts/check-newsletter-crons.mjs --json      # machine output
 *   node scripts/check-newsletter-crons.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()

const PATHS = {
  vercelJson: join(ROOT, 'vercel.json'),
  sendRoute: join(ROOT, 'app/api/cron/newsletter-send/route.ts'),
  reconcileRoute: join(ROOT, 'app/api/cron/newsletter-reconcile/route.ts'),
}

/**
 * Pure: run every check against already-read/parsed inputs. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks({ crons, sendRouteExists, reconcileRouteExists }) {
  const results = []

  if (crons == null) {
    results.push({ id: 'G-NL-15 vercel-json-parsed', ok: false, detail: 'vercel.json missing or not valid JSON (or has no crons array)' })
    results.push({ id: 'G-NL-15 cron-newsletter-send', ok: false, detail: 'vercel.json not readable, cannot check crons' })
    results.push({ id: 'G-NL-15 cron-newsletter-reconcile', ok: false, detail: 'vercel.json not readable, cannot check crons' })
  } else {
    const paths = crons.map((c) => c && c.path).filter(Boolean)

    const hasSendCron = paths.includes('/api/cron/newsletter-send')
    results.push({
      id: 'G-NL-15 cron-newsletter-send',
      ok: hasSendCron,
      detail: hasSendCron
        ? 'vercel.json — crons array contains /api/cron/newsletter-send'
        : 'vercel.json — crons array is missing an entry with path "/api/cron/newsletter-send" (the send queue will never drain)',
    })

    const hasReconcileCron = paths.includes('/api/cron/newsletter-reconcile')
    results.push({
      id: 'G-NL-15 cron-newsletter-reconcile',
      ok: hasReconcileCron,
      detail: hasReconcileCron
        ? 'vercel.json — crons array contains /api/cron/newsletter-reconcile'
        : 'vercel.json — crons array is missing an entry with path "/api/cron/newsletter-reconcile" (stalled sends will never auto-recover)',
    })
  }

  results.push({
    id: 'G-NL-15 route-newsletter-send',
    ok: sendRouteExists,
    detail: sendRouteExists
      ? 'app/api/cron/newsletter-send/route.ts — exists'
      : 'app/api/cron/newsletter-send/route.ts — not found (cron entry would 404)',
  })

  results.push({
    id: 'G-NL-15 route-newsletter-reconcile',
    ok: reconcileRouteExists,
    detail: reconcileRouteExists
      ? 'app/api/cron/newsletter-reconcile/route.ts — exists'
      : 'app/api/cron/newsletter-reconcile/route.ts — not found (cron entry would 404)',
  })

  return results
}

function loadInputs() {
  let crons = null
  if (existsSync(PATHS.vercelJson)) {
    try {
      const parsed = JSON.parse(readFileSync(PATHS.vercelJson, 'utf8'))
      if (Array.isArray(parsed.crons)) crons = parsed.crons
    } catch {
      crons = null
    }
  }
  return {
    crons,
    sendRouteExists: existsSync(PATHS.sendRoute),
    reconcileRouteExists: existsSync(PATHS.reconcileRoute),
  }
}

// ── runner ───────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')

  const results = runChecks(loadInputs())
  const failures = results.filter((r) => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} newsletter-crons: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-crons: ${failures.length} check(s) failed. Fix vercel.json or the missing route.`)
    } else {
      console.log(`\n✓ newsletter-crons: all ${results.length} checks passed (G-NL-15).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
