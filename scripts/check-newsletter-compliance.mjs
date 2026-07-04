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
  // The bulk send path is now the queue drain (Phase 3); the one-click path stays
  // in contact-newsletter.ts. Both must carry the RFC 8058 headers + multipart.
  sendQueue: join(ROOT, 'lib/newsletter/send-queue.ts'),
  contactNewsletter: join(ROOT, 'app/actions/contact-newsletter.ts'),
  // Bulk enroll + bulk one-off live here; both must refuse to resurrect an opt-out.
  newsletterActions: join(ROOT, 'app/actions/newsletter.ts'),
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
export function runChecks({ prepare, shell, sendQueue, contactNewsletter, newsletterActions }) {
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

  // G-NL-2: RFC 8058 headers on both newsletter send paths (bulk drain + one-click).
  for (const [label, src] of [
    ['lib/newsletter/send-queue.ts', sendQueue],
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

  // G-NL-3: non-empty plain-text fallback in the queue render path.
  if (sendQueue == null) {
    results.push({ id: 'G-NL-3 plain-text-fallback', ok: false, detail: 'lib/newsletter/send-queue.ts not found' })
  } else {
    const ok = /body_text\?\.trim\(\)\s*\|\|\s*htmlToPlainText\(/.test(sendQueue)
    results.push({
      id: 'G-NL-3 plain-text-fallback',
      ok,
      detail: ok
        ? 'lib/newsletter/send-queue.ts — renderForRecipient falls back to htmlToPlainText(...) when body_text is blank'
        : 'lib/newsletter/send-queue.ts — expected the fallback pattern `body_text?.trim() || htmlToPlainText(` (a send could dispatch empty plain-text)',
    })
  }

  // G-NL-3b: bulk enroll + bulk one-off must NEVER reactivate an opt-out. Both
  // paths enroll via subscribeToNewsletter, which flips ANY existing row back to
  // status='active' — so each must exclude previously unsubscribed/bounced/complained
  // addresses BEFORE enrolling. Re-sending to an opt-out is a CAN-SPAM violation
  // (CLAUDE.md §0). The guard is a `status !== 'active'` filter feeding an exclusion
  // set. This gate fails if either path drops it. (See S-10 in the send-queue.)
  for (const [label, src] of [
    ['lib/newsletter/send-queue.ts (one-off enqueue)', sendQueue],
    ['app/actions/newsletter.ts (bulk enroll)', newsletterActions],
  ]) {
    if (src == null) {
      results.push({ id: `G-NL-3b no-optout-reactivation (${label})`, ok: false, detail: `${label} not found` })
      continue
    }
    // Match `.filter((x) => x.status !== 'active')` regardless of the param name.
    const hasGuard = /\.filter\(\s*\(\s*\w+\s*\)\s*=>\s*\w+\.status\s*!==\s*'active'\s*\)/.test(src)
    results.push({
      id: `G-NL-3b no-optout-reactivation (${label})`,
      ok: hasGuard,
      detail: hasGuard
        ? `${label} — excludes non-active (opted-out) addresses before enrolling`
        : `${label} — missing the opt-out guard \`.filter((s) => s.status !== 'active')\` before subscribeToNewsletter; a bulk send could resurrect an unsubscribe (CAN-SPAM risk)`,
    })
  }

  return results
}

function loadInputs() {
  return {
    prepare: safeRead(PATHS.prepare),
    shell: safeRead(PATHS.shell),
    sendQueue: safeRead(PATHS.sendQueue),
    contactNewsletter: safeRead(PATHS.contactNewsletter),
    newsletterActions: safeRead(PATHS.newsletterActions),
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
