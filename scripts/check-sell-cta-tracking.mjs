#!/usr/bin/env node
/**
 * check-sell-cta-tracking.mjs: a /sell CTA may not ship without its tracking hook.
 *
 * Matt's hard rule (2026-09-28): every CTA and link click on /sell, including
 * /sell?from=cma, is tracked to the contact record. The page does it with ONE
 * delegated listener (app/sell/_v3/SellClickTracker.tsx) plus a named hook,
 * `data-sell-cta`, on every control the route renders itself, so the event
 * says WHICH control was pressed. This gate fails when:
 *
 *   1. app/sell/page.tsx does not mount <SellClickTracker />
 *   2. any <a>, <Link>, <V3Button> or <details> in a /sell route file lacks
 *      data-sell-cta inside its opening tag
 *   3. a <SellValueForm> on /sell lacks ctaHook, or the form stops putting
 *      data-sell-cta on its submit when ctaHook is set
 *   4. the tracker stops writing to both existing sinks (cta_click first-party
 *      event and trackCtaClick)
 *
 * Usage: node scripts/check-sell-cta-tracking.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SELL_ROUTE_FILES = [
  'app/sell/page.tsx',
  'app/sell/_v3/SellHowWeSell.tsx',
  'app/sell/_v3/SellClosings.tsx',
  'app/sell/_v3/SellFinalAsk.tsx',
]

const CONTROL_OPEN = /<(a|Link|V3Button|details)(\s[^>]*?)?>/gs

/** Opening tags of controls that carry no data-sell-cta. */
export function unhookedControls(src) {
  const out = []
  for (const m of src.matchAll(CONTROL_OPEN)) {
    const tag = m[0]
    if (!/data-sell-cta\s*=/.test(tag)) {
      const line = src.slice(0, m.index).split('\n').length
      out.push({ line, tag: tag.replace(/\s+/g, ' ').slice(0, 120) })
    }
  }
  return out
}

export function checkSellCtaTracking(root = process.cwd()) {
  const read = (rel) => readFileSync(join(root, rel), 'utf8')
  const failures = []
  const page = read('app/sell/page.tsx')
  if (!/<SellClickTracker\s*\/>/.test(page)) {
    failures.push('app/sell/page.tsx: <SellClickTracker /> is not mounted')
  }
  for (const rel of SELL_ROUTE_FILES) {
    for (const u of unhookedControls(read(rel))) {
      failures.push(`${rel}:${u.line}: control without data-sell-cta: ${u.tag}`)
    }
  }
  for (const m of page.matchAll(/<SellValueForm\b[^>]*>/gs)) {
    if (!/ctaHook=/.test(m[0])) failures.push('app/sell/page.tsx: <SellValueForm> without ctaHook')
  }
  const form = read('app/sell/_v3/SellValueForm.tsx')
  if (!/ctaHook \? \{ 'data-sell-cta': ctaHook \}/.test(form)) {
    failures.push('SellValueForm.tsx: submit no longer carries data-sell-cta from ctaHook')
  }
  if (!/entry,/.test(form)) failures.push('SellValueForm.tsx: submission no longer carries entry (from=cma)')
  const tracker = read('app/sell/_v3/SellClickTracker.tsx')
  if (!/fireFirstPartyEvent\('cta_click'/.test(tracker) || !/trackCtaClick\(/.test(tracker)) {
    failures.push('SellClickTracker.tsx: must write both cta_click (first party) and trackCtaClick (GA + CRM)')
  }
  return failures
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = checkSellCtaTracking()
  if (failures.length) {
    console.error('ci:sell-cta-tracking FAILED')
    for (const f of failures) console.error('  ' + f)
    process.exit(1)
  }
  console.log(`ci:sell-cta-tracking ok (${SELL_ROUTE_FILES.length} route files, every control hooked)`)
}
