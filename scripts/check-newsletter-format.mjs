#!/usr/bin/env node
/**
 * check-newsletter-format.mjs — static shell lint for the newsletter HTML
 * template (covers G-NL-7).
 *
 * `lib/email-templates/newsletter-shell.ts` is the ONE place newsletter email
 * markup lives (every send wraps admin-authored body_html in this shell). A
 * regression here breaks rendering or compliance for every newsletter, not
 * just one send, so the shell gets a static lint independent of any live
 * send: dark-mode client safety, a mobile-safe outer width, a readable body
 * font size, and the CAN-SPAM footer (postal address + unsubscribe).
 *
 * Checks (all against the raw template-literal source):
 *   - `color-scheme` meta tag present (prevents Apple Mail / Outlook dark-mode
 *     from inverting the navy header into unreadable colors).
 *   - Outer content table max-width <= 640px (mobile-safe; > 640px clips or
 *     forces horizontal scroll on narrow email clients).
 *   - Body font-size >= 16px (readability floor; email clients silently
 *     autoscale text smaller than 16px on mobile Gmail/Outlook).
 *   - Footer references BROKERAGE_POSTAL_ADDRESS and contains "Unsubscribe".
 *   - Navy masthead present (`#102742` — Design System v2 brand color).
 *
 * Static text checks only. Mirrors the house style of
 * scripts/check-email-send-gated.mjs.
 *
 * Usage:
 *   node scripts/check-newsletter-format.mjs            # human output
 *   node scripts/check-newsletter-format.mjs --json      # machine output
 *   node scripts/check-newsletter-format.mjs --report    # never exits 1
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsComments } from './lib/strip-js-comments.mjs'

const ROOT = process.cwd()
const SHELL_PATH = join(ROOT, 'lib/email-templates/newsletter-shell.ts')
const MAX_OUTER_WIDTH_PX = 640

/**
 * Pure: run every check against the shell's raw source text. Returns an array
 * of { id, ok, detail } — one row per assertion, in check order.
 */
export function runChecks(source) {
  const results = []

  if (source == null) {
    return [{ id: 'file-exists', ok: false, detail: 'lib/email-templates/newsletter-shell.ts not found' }]
  }

  // color-scheme meta tag (dark-mode client safety).
  const hasColorScheme = /name="color-scheme"/.test(source)
  results.push({
    id: 'color-scheme-meta',
    ok: hasColorScheme,
    detail: hasColorScheme
      ? 'newsletter-shell.ts — <meta name="color-scheme" ...> present'
      : 'newsletter-shell.ts — missing <meta name="color-scheme" ...>; Apple Mail / Outlook dark mode can invert the navy header',
  })

  // Outer table max-width <= 640px.
  const widths = [...source.matchAll(/max-width:\s*(\d+)px/g)].map((m) => Number(m[1]))
  if (widths.length === 0) {
    results.push({
      id: 'outer-max-width',
      ok: false,
      detail: `newsletter-shell.ts — no max-width:<n>px found; expected an outer content table <= ${MAX_OUTER_WIDTH_PX}px`,
    })
  } else {
    const largest = Math.max(...widths)
    const ok = largest <= MAX_OUTER_WIDTH_PX
    results.push({
      id: 'outer-max-width',
      ok,
      detail: ok
        ? `newsletter-shell.ts — largest max-width is ${largest}px (<= ${MAX_OUTER_WIDTH_PX}px)`
        : `newsletter-shell.ts — largest max-width is ${largest}px, exceeds the ${MAX_OUTER_WIDTH_PX}px mobile-safe ceiling`,
    })
  }

  // Body font-size >= 16px (current shell body cell hardcodes 16px).
  const hasBodyFont16 = /font-size:16px/.test(source)
  results.push({
    id: 'body-font-size',
    ok: hasBodyFont16,
    detail: hasBodyFont16
      ? 'newsletter-shell.ts — body cell has font-size:16px'
      : 'newsletter-shell.ts — no font-size:16px found on the body cell; email clients autoscale smaller text on mobile',
  })

  // Footer: postal address + unsubscribe.
  const hasAddressRef = /BROKERAGE_POSTAL_ADDRESS/.test(source)
  const hasUnsubscribe = /Unsubscribe/.test(source)
  const footerOk = hasAddressRef && hasUnsubscribe
  results.push({
    id: 'footer-compliance',
    ok: footerOk,
    detail: footerOk
      ? 'newsletter-shell.ts — footer references BROKERAGE_POSTAL_ADDRESS and contains "Unsubscribe"'
      : `newsletter-shell.ts — footer missing ${!hasAddressRef ? 'BROKERAGE_POSTAL_ADDRESS reference' : ''}${!hasAddressRef && !hasUnsubscribe ? ' and ' : ''}${!hasUnsubscribe ? '"Unsubscribe" text' : ''}`,
  })

  // Navy masthead present.
  const hasNavy = /#102742/.test(source)
  results.push({
    id: 'navy-masthead',
    ok: hasNavy,
    detail: hasNavy
      ? 'newsletter-shell.ts — navy masthead #102742 present'
      : 'newsletter-shell.ts — no #102742 found; the masthead must use the Design System v2 navy',
  })

  // Frame parity with the approved email.html mockup (spec §7): wordmark masthead,
  // Old Mill hero, and the per-broker close block.
  const hasWordmark = />\s*Ryan Realty\s*<\/td>/.test(source)
  results.push({
    id: 'masthead-wordmark',
    ok: hasWordmark,
    detail: hasWordmark
      ? 'newsletter-shell.ts — "Ryan Realty" masthead wordmark present'
      : 'newsletter-shell.ts — missing the "Ryan Realty" masthead wordmark cell (email.html parity)',
  })

  const hasHero = /hero-oldmill/.test(source)
  results.push({
    id: 'hero-image',
    ok: hasHero,
    detail: hasHero
      ? 'newsletter-shell.ts — Old Mill hero image present'
      : 'newsletter-shell.ts — missing the canonical Old Mill hero (hero-oldmill), the email.html full-bleed hero',
  })

  const hasBrokerClose = /senderBroker/.test(source) && /TALK TO/.test(source)
  results.push({
    id: 'broker-close',
    ok: hasBrokerClose,
    detail: hasBrokerClose
      ? 'newsletter-shell.ts — per-broker close block present (senderBroker + "TALK TO" CTA)'
      : 'newsletter-shell.ts — missing the per-broker close block (senderBroker param + "TALK TO {first}" CTA, spec §5/A6)',
  })

  return results
}

// Strip comments so a TS doc-comment can't fake an HTML-shell check; the shell's
// markup lives in a template literal, which stripJsComments preserves.
function loadSource() {
  return existsSync(SHELL_PATH) ? stripJsComments(readFileSync(SHELL_PATH, 'utf8')) : null
}

// ── runner ───────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const asJson = process.argv.includes('--json')
  const report = process.argv.includes('--report')

  const results = runChecks(loadSource())
  const failures = results.filter((r) => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ pass: failures.length === 0, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} newsletter-format: ${r.id} — ${r.detail}`)
    }
    if (failures.length) {
      console.error(`\n✗ newsletter-format: ${failures.length} check(s) failed. Fix lib/email-templates/newsletter-shell.ts.`)
    } else {
      console.log(`\n✓ newsletter-format: all ${results.length} checks passed (G-NL-7 shell lint).`)
    }
  }

  if (failures.length && !report) process.exit(1)
  process.exit(0)
}
