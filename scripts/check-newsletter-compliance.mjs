#!/usr/bin/env node
/**
 * check-newsletter-compliance.mjs — CAN-SPAM + RFC 8058 static compliance gate
 * for the newsletter send path (covers G-NL-1 / G-NL-2 / G-NL-3).
 *
 * A newsletter send that skips any of these protections is a CAN-SPAM
 * violation risk to Ryan Realty's license (CLAUDE.md §0):
 *
 *   G-NL-1  Physical postal address + unsubscribe link.
 *           `lib/email/prepare.ts` must define BROKERAGE_POSTAL_ADDRESS with a
 *           real street-number fallback (not an empty string / placeholder),
 *           and the newsletter shell (`lib/email-templates/newsletter-shell.ts`)
 *           must reference that constant AND render an unsubscribe link.
 *
 *   G-NL-2  RFC 8058 one-click unsubscribe headers. Both newsletter send
 *           actions (`app/actions/newsletter.ts` and
 *           `app/actions/contact-newsletter.ts`) must set the
 *           `List-Unsubscribe` + `List-Unsubscribe-Post` headers on the
 *           outbound send — the mechanism Gmail/Yahoo use to render a native
 *           one-click unsubscribe instead of routing a complaint.
 *
 *   G-NL-3  Non-empty plain-text body. `app/actions/newsletter.ts` must derive
 *           a plain-text alternative via htmlToPlainText(...) when the admin
 *           didn't author one, so a send never dispatches an empty text part
 *           (HTML-only sends are a spam signal at Gmail/Yahoo).
 *
 * Static text checks only — no network calls, no live send. Mirrors the house
 * style of scripts/check-email-send-gated.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-compliance.mjs            # human output
 *   node scripts/check-newsletter-compliance.mjs --json      # machine output
 *   node scripts/check-newsletter-compliance.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

const PATHS = {
  prepare: join(ROOT, 'lib/email/prepare.ts'),
  shell: join(ROOT, 'lib/email-templates/newsletter-shell.ts'),
  newsletter: join(ROOT, 'app/actions/newsletter.ts'),
  contactNewsletter: join(ROOT, 'app/actions/contact-newsletter.ts'),
}

/** A real street-number-first address, e.g. "115 NW Oregon Ave". Placeholder/empty fails. */
const STREET_NUMBER_RE = /\d+\s+\S/

// Strip comments so a required token in a doc comment can't fake a pass (check
// CODE, not comments — see scripts/lib/strip-js-comments.mjs).
function safeRead(path) {
  if (!existsSync(path)) return null
  return stripJsComments(readFileSync(path, 'utf8'))
}

/**
 * Pure: run every check against already-read file contents. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks({ prepare, shell, newsletter, contactNewsletter }) {
  const results = []

  // G-NL-1a: BROKERAGE_POSTAL_ADDRESS defined with a real street-number fallback.
  if (prepare == null) {
    results.push({ id: 'G-NL-1 postal-address-defined', ok: false, detail: 'lib/email/prepare.ts not found' })
  } else {
    const m = prepare.match(/export const BROKERAGE_POSTAL_ADDRESS\s*=([\s\S]*?);/)
    if (!m) {
      results.push({
        id: 'G-NL-1 postal-address-defined',
        ok: false,
        detail: 'lib/email/prepare.ts does not export a BROKERAGE_POSTAL_ADDRESS constant',
      })
    } else {
      const fallbackMatch = m[1].match(/\|\|\s*'([^']*)'/) ?? m[1].match(/\|\|\s*"([^"]*)"/)
      const fallback = fallbackMatch ? fallbackMatch[1] : ''
      const ok = fallback.trim().length > 0 && STREET_NUMBER_RE.test(fallback)
      results.push({
        id: 'G-NL-1 postal-address-defined',
        ok,
        detail: ok
          ? `lib/email/prepare.ts — BROKERAGE_POSTAL_ADDRESS fallback "${fallback}"`
          : `lib/email/prepare.ts — BROKERAGE_POSTAL_ADDRESS fallback is empty/placeholder (expected a street-number address, e.g. "115 NW Oregon Ave"), got: "${fallback}"`,
      })
    }
  }

  // G-NL-1b: the newsletter shell references the address AND renders an unsubscribe link.
  if (shell == null) {
    results.push({ id: 'G-NL-1 shell-footer', ok: false, detail: 'lib/email-templates/newsletter-shell.ts not found' })
  } else {
    const hasAddressRef = /BROKERAGE_POSTAL_ADDRESS/.test(shell)
    const hasUnsubUrl = /unsubscribeUrl/.test(shell)
    const hasUnsubWord = /Unsubscribe/.test(shell)
    const ok = hasAddressRef && hasUnsubUrl && hasUnsubWord
    results.push({
      id: 'G-NL-1 shell-footer',
      ok,
      detail: ok
        ? 'lib/email-templates/newsletter-shell.ts — references BROKERAGE_POSTAL_ADDRESS and renders an unsubscribe link'
        : `lib/email-templates/newsletter-shell.ts — missing ${!hasAddressRef ? 'BROKERAGE_POSTAL_ADDRESS reference' : ''}${!hasAddressRef && (!hasUnsubUrl || !hasUnsubWord) ? ', ' : ''}${!hasUnsubUrl ? 'unsubscribeUrl usage' : ''}${!hasUnsubUrl && !hasUnsubWord ? ', ' : ''}${!hasUnsubWord ? '"Unsubscribe" text' : ''}`,
    })
  }

  // G-NL-2: RFC 8058 headers on both newsletter send actions.
  for (const [label, src] of [
    ['app/actions/newsletter.ts', newsletter],
    ['app/actions/contact-newsletter.ts', contactNewsletter],
  ]) {
    if (src == null) {
      results.push({ id: `G-NL-2 rfc8058 (${label})`, ok: false, detail: `${label} not found` })
      continue
    }
    const hasListUnsub = /List-Unsubscribe/.test(src)
    const hasPost = /List-Unsubscribe-Post/.test(src)
    const ok = hasListUnsub && hasPost
    results.push({
      id: `G-NL-2 rfc8058 (${label})`,
      ok,
      detail: ok
        ? `${label} — sets List-Unsubscribe + List-Unsubscribe-Post headers`
        : `${label} — missing ${!hasListUnsub ? 'List-Unsubscribe' : ''}${!hasListUnsub && !hasPost ? ' and ' : ''}${!hasPost ? 'List-Unsubscribe-Post' : ''} header(s)`,
    })
  }

  // G-NL-3: non-empty plain-text fallback in app/actions/newsletter.ts.
  if (newsletter == null) {
    results.push({ id: 'G-NL-3 plain-text-fallback', ok: false, detail: 'app/actions/newsletter.ts not found' })
  } else {
    const ok = /letter\.body_text\?\.trim\(\)\s*\|\|\s*htmlToPlainText\(/.test(newsletter)
    results.push({
      id: 'G-NL-3 plain-text-fallback',
      ok,
      detail: ok
        ? 'app/actions/newsletter.ts — body_text falls back to htmlToPlainText(...) when the admin left it blank'
        : 'app/actions/newsletter.ts — expected the fallback pattern `letter.body_text?.trim() || htmlToPlainText(` (a send could dispatch empty plain-text)',
    })
  }

  return results
}

function loadInputs() {
  return {
    prepare: safeRead(PATHS.prepare),
    shell: safeRead(PATHS.shell),
    newsletter: safeRead(PATHS.newsletter),
    contactNewsletter: safeRead(PATHS.contactNewsletter),
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
      console.log(`${r.ok ? '✓' : '✗'} newsletter-compliance: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-compliance: ${failures.length} check(s) failed. Fix the source, not this gate.`)
    } else {
      console.log(`\n✓ newsletter-compliance: all ${results.length} checks passed (G-NL-1, G-NL-2, G-NL-3).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
