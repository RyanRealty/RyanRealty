#!/usr/bin/env node
/**
 * check-sarah-panel.mjs — Sarah intent panel + single public FAB lock.
 *
 * Usage: node scripts/check-sarah-panel.mjs
 */
import { sarahPanelProblems, SARAH_PANEL_GATE } from './lib/sarah-panel.mjs'

const failures = sarahPanelProblems({ root: process.cwd() })

if (failures.length) {
  console.error(`${SARAH_PANEL_GATE} FAILED\n`)
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  `${SARAH_PANEL_GATE} OK: intent chips, no broker chrome row, Eve mic, CRM/CMA capture, cookie settings kept as the only extra public floater.`,
)
