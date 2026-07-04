#!/usr/bin/env node
/**
 * check-newsletter-authz.mjs — G-NL-AUTHZ. The newsletter mutations that reach the
 * whole subscriber list or the company-wide CRM (bulk enroll/send, crmTag), or that
 * author recipient-facing HTML (create/update), MUST be superuser-only.
 *
 * requireAdmin() only proves the caller is SOME admin — it never checks role — so a
 * `broker` (Paul/Rebecca) or a future `report_viewer` would otherwise be able to
 * blast the company-wide book (getAudienceEligiblePeople has no assigned_broker
 * scope) or author HTML that renders in another admin's browser. This gate fails if
 * any of these actions is gated by requireAdmin instead of requireSuperuser.
 *
 * Static scan of app/actions/newsletter.ts. Usage:
 *   node scripts/check-newsletter-authz.mjs            # human, exits 1 on hit
 *   node scripts/check-newsletter-authz.mjs --report   # never exits 1
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const FILE = join(ROOT, 'app/actions/newsletter.ts')

// Actions that MUST be superuser-only (company-wide reach or recipient-HTML authoring).
const SUPERUSER_ONLY = [
  'adminBulkAssignNewsletterAction',
  'adminBulkEnrollNewsletterAction',
  'adminCreateNewsletterAction',
  'adminUpdateNewsletterAction',
  'adminDeleteNewsletterAction',
  'adminSendNewsletterAction',
  'adminBulkOneOffSendAction',
  'adminGenerateNewsletterDraftAction',
]

/** Return the body text of `export async function <name>(...)` up to the next top-level export. */
function bodyOf(src, name) {
  const start = src.search(new RegExp(`export async function ${name}\\b`))
  if (start < 0) return null
  const next = src.slice(start + 1).search(/\nexport async function /)
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next)
}

export function runChecks(src) {
  const results = []
  for (const name of SUPERUSER_ONLY) {
    const body = bodyOf(src, name)
    if (body == null) {
      results.push({ id: name, ok: false, detail: `not found in app/actions/newsletter.ts` })
      continue
    }
    const usesSuper = /await requireSuperuser\(\)/.test(body)
    const usesAdmin = /await requireAdmin\(\)/.test(body)
    const ok = usesSuper && !usesAdmin
    results.push({
      id: name,
      ok,
      detail: ok
        ? 'gated by requireSuperuser()'
        : usesAdmin
          ? 'gated by requireAdmin() — a broker/report_viewer can reach the whole list. Use requireSuperuser().'
          : 'no requireSuperuser() gate found',
    })
  }
  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const report = process.argv.includes('--report')
  const src = stripJsComments(readFileSync(FILE, 'utf8'))
  const results = runChecks(src)
  const failures = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} newsletter-authz: ${r.id} — ${r.detail}`)
  if (failures.length) {
    console.error(`\n✗ newsletter-authz: ${failures.length} action(s) not superuser-gated. Fix the source, not this gate.`)
    if (!report) process.exit(1)
  } else {
    console.log(`\n✓ newsletter-authz: all ${results.length} company-wide/authoring actions are superuser-only.`)
  }
  process.exit(0)
}
