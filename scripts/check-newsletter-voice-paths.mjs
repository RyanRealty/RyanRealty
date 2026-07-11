#!/usr/bin/env node
/**
 * check-newsletter-voice-paths.mjs — brand-voice gate wiring check for both
 * newsletter send entry points (covers G-NL-4).
 *
 * There are exactly two ways a newsletter goes out: the bulk admin-approve
 * path (app/actions/newsletter.ts) and the one-click contact-form path
 * (app/actions/contact-newsletter.ts). If either path can enqueue/send
 * without first running the brand-voice gate, a banned-word or punctuation
 * violation reaches a client inbox — a brand-voice failure CLAUDE.md treats
 * as a hard fail everywhere else, but silently skipped here it never gets
 * caught at all. This gate makes "both send paths call checkNewsletterVoice()"
 * a mechanical fact, not a hope.
 *
 *   G-NL-4  `app/actions/newsletter.ts` must call `checkNewsletterVoice(`
 *           before the bulk approve path enqueues a send.
 *   G-NL-4  `app/actions/contact-newsletter.ts` must call
 *           `checkNewsletterVoice(` before the one-click path sends.
 *
 * Static text checks only — no network calls, no live send. Mirrors the house
 * style of scripts/check-newsletter-compliance.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-voice-paths.mjs            # human output
 *   node scripts/check-newsletter-voice-paths.mjs --json      # machine output
 *   node scripts/check-newsletter-voice-paths.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()

const PATHS = {
  bulkAction: join(ROOT, 'app/actions/newsletter.ts'),
  oneClickAction: join(ROOT, 'app/actions/contact-newsletter.ts'),
}

// Strip comments so a required token in a doc comment can't fake a pass (a gate
// must check CODE, not comments — see scripts/lib/strip-js-comments.mjs).
function safeRead(path) {
  return existsSync(path) ? stripJsComments(readFileSync(path, 'utf8')) : null
}

/**
 * Pure: run every check against already-read file contents. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks({ bulkAction, oneClickAction }) {
  const results = []

  for (const [label, src] of [
    ['app/actions/newsletter.ts', bulkAction],
    ['app/actions/contact-newsletter.ts', oneClickAction],
  ]) {
    if (src == null) {
      results.push({ id: `G-NL-4 voice-gate-called (${label})`, ok: false, detail: `${label} not found` })
      continue
    }
    // A bare `checkNewsletterVoice(...)` mention is not enough — the RESULT must GATE
    // the send. Assert the call is assigned to a variable AND that variable's failure
    // (`if (!<var>.ok) return ...`) short-circuits before anything sends. A call whose
    // return is ignored ships a banned word straight to a client inbox.
    const assign = src.match(/(?:const|let|var)\s+(\w+)\s*=\s*checkNewsletterVoice\(/)
    const called = Boolean(assign)
    let blocks = false
    if (assign) {
      const v = assign[1]
      blocks = new RegExp(`if\\s*\\(\\s*!\\s*${v}\\.ok\\s*\\)[\\s\\S]{0,120}?\\breturn\\b`).test(src)
    }
    const ok = called && blocks
    results.push({
      id: `G-NL-4 voice-gate-called (${label})`,
      ok,
      detail: ok
        ? `${label} — checkNewsletterVoice(...) result gates the send (if (!<result>.ok) return)`
        : !called
          ? `${label} — expected the send to assign checkNewsletterVoice(...) to a result and act on it (a send path that skips the brand-voice gate can ship a banned word or punctuation violation to a client inbox)`
          : `${label} — checkNewsletterVoice(...) is called but its result never blocks the send (missing an \`if (!<result>.ok) return\` guard); an ignored voice result ships a banned word to a client inbox`,
    })
  }

  return results
}

function loadInputs() {
  return {
    bulkAction: safeRead(PATHS.bulkAction),
    oneClickAction: safeRead(PATHS.oneClickAction),
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
      console.log(`${r.ok ? '✓' : '✗'} newsletter-voice-paths: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-voice-paths: ${failures.length} check(s) failed. Fix the source, not this gate.`)
    } else {
      console.log(`\n✓ newsletter-voice-paths: all ${results.length} checks passed (G-NL-4).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
