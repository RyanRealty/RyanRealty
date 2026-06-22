#!/usr/bin/env node
/**
 * check-console-kit.mjs — admin design cannot regress to a data dump.
 *
 * Matt directive 2026-06-15 (after the lead-command-center drift): every
 * broker-facing admin console surface must be assembled from the SHARED console
 * kit so the look lives in one place and cannot drift page-by-page. The kit's
 * panel primitive `ConsoleSection` makes a heading MANDATORY, which is the exact
 * thing that was missing ("a bunch of text and boxes, no headings").
 *
 * This gate is a tripwire: each page in REQUIRED_KIT_PAGES must import
 * `ConsoleSection` from `@/components/console/ConsoleSection`. If a migration is
 * reverted or a new edit strips the kit, CI goes red. The list only GROWS —
 * removing a page from it requires deleting the page, not unstyling it.
 *
 * The companion mockup-parity gate (check-mockup-parity.mjs) enforces the
 * richer per-surface component contract via design_system/ryan-realty/ui_kits/
 * <surface>/parity.json. This gate is the cheap, always-on floor.
 *
 * Usage: node scripts/check-console-kit.mjs        # CI mode (fail on miss)
 *        node scripts/check-console-kit.mjs --list  # print status table
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')

// Every broker console surface that has been migrated to the kit. APPEND as each
// page is migrated — never remove (ratchet up). A page here that drops the kit
// import fails CI.
const REQUIRED_KIT_PAGES = [
  'app/admin/console/leads/[id]/page.tsx',
  // CRM cluster
  'app/admin/(protected)/crm/inbox/page.tsx',
  'app/admin/(protected)/crm/workflows/page.tsx',
  'app/admin/(protected)/crm/tasks/page.tsx',
  'app/admin/(protected)/crm/sequences/page.tsx',
  'app/admin/(protected)/crm/approvals/page.tsx',
  // Comms cluster
  'app/admin/(protected)/newsletters/page.tsx',
  'app/admin/(protected)/newsletters/[id]/page.tsx',
  'app/admin/(protected)/newsletters/new/page.tsx',
  'app/admin/(protected)/newsletters/subscribers/page.tsx',
  'app/admin/(protected)/email/campaigns/page.tsx',
  'app/admin/(protected)/email/compose/page.tsx',
  // Ops / data cluster
  'app/admin/(protected)/approval-queue/page.tsx',
  'app/admin/(protected)/expired-listings/page.tsx',
  'app/admin/(protected)/spark-status/page.tsx',
  'app/admin/(protected)/sync/page.tsx',
  'app/admin/(protected)/reports/page.tsx',
  'app/admin/(protected)/audit-log/page.tsx',
  // People / transactions cluster
  'app/admin/(protected)/people/page.tsx',
  'app/admin/(protected)/deals/page.tsx',
  'app/admin/(protected)/financials/page.tsx',
  'app/admin/(protected)/commissions/page.tsx',
  'app/admin/(protected)/cmas/page.tsx',
  'app/admin/(protected)/sign-off/page.tsx',
  // Ops / home cluster
  'app/admin/(protected)/operations/page.tsx',
  'app/admin/(protected)/crm/new/page.tsx',
  'app/admin/(protected)/crm/deals/page.tsx',
  'app/admin/(protected)/forms/page.tsx',
  'app/admin/(protected)/fub-attribution/page.tsx',
]

const KIT_IMPORT = /@\/components\/console\/ConsoleSection/

const args = new Set(process.argv.slice(2))
const LIST = args.has('--list')

let failed = 0
const rows = []
for (const rel of REQUIRED_KIT_PAGES) {
  const abs = resolve(ROOT, rel)
  let ok = false
  let reason = ''
  if (!existsSync(abs)) {
    reason = 'file missing'
  } else {
    const src = readFileSync(abs, 'utf8')
    ok = KIT_IMPORT.test(src)
    if (!ok) reason = 'does not import ConsoleSection from the console kit'
  }
  if (!ok) failed++
  rows.push({ rel, ok, reason })
}

if (LIST) {
  console.log('Console kit coverage:')
  for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${r.rel}${r.ok ? '' : ` — ${r.reason}`}`)
}

if (failed > 0) {
  console.error(`\n✗ Console kit: ${failed} surface(s) not built from the shared kit (components/console/ConsoleSection).`)
  for (const r of rows.filter((x) => !x.ok)) console.error(`  - ${r.rel}: ${r.reason}`)
  console.error('\nEvery broker console page must use <ConsoleSection> (mandatory headings) so the admin cannot regress to a headless data dump.')
  process.exit(1)
}

console.log(`✓ Console kit: ${rows.length} surface(s) built from the shared kit.`)
