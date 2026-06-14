#!/usr/bin/env node
/**
 * check-lp-conversion.mjs — landing pages stay "dialed" for conversion.
 *
 * Matt directive 2026-06-13: grade every LP on a measurable rubric so a page
 * can't quietly ship (or regress) with a broken conversion path. Prints a
 * per-LP grade and ratchets total deductions against a baseline — a page that
 * drops a criterion fails CI.
 *
 * A capture LP (one with a form / lead-create path) is graded on:
 *   • lead-create wired   — calls create*Lead (form → FUB person)
 *   • CAPI                — Meta Conversions API fires on submit
 *   • GA4 generate_lead   — server/client lead event
 *   • confirmation        — a thank-you / success state after submit
 *   • clear CTA           — a submit button
 * Informational LPs (no form) are graded on the CTA criterion only.
 *
 * Ratchet: total deductions vs scripts/lp-conversion-baseline.json. Fails on
 * increase. Lower it with --update as pages are dialed in (refuses to raise).
 *
 * Usage:  node scripts/check-lp-conversion.mjs           # CI
 *         node scripts/check-lp-conversion.mjs --update  # lower the baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LP_ROOT = 'app/lp'
const BASELINE_PATH = 'scripts/lp-conversion-baseline.json'

function filesIn(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...filesIn(p))
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

// One LP per directory that contains a page.tsx (recurse: tetherow/heath etc.).
function lpDirs() {
  const out = []
  const visit = (dir) => {
    const entries = readdirSync(dir)
    if (entries.includes('page.tsx')) out.push(dir)
    for (const e of entries) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) visit(p)
    }
  }
  visit(LP_ROOT)
  return out
}

const CRITERIA = [
  { key: 'lead-create', captureOnly: true, re: /createCmaRequest|submit[A-Z]\w*Form|create\w*(?:Lead|Person|Inquiry)|followupboss|upsertFub|createOrUpdateFub/i },
  { key: 'capi', captureOnly: true, re: /meta-capi|sendCapi|capiLead|metaCapi|trackMetaLead|fbq\(/i },
  { key: 'ga4-lead', captureOnly: true, re: /generate_lead|measurement-protocol|ga4MeasurementProtocol|trackLead|gtag\(/i },
  { key: 'confirmation', captureOnly: true, re: /thank|submitted|success|confirmation|we (?:got|have|received)|on its way/i },
  { key: 'cta', captureOnly: false, re: /type=["']submit["']|<Button|<button|href=["'][^"']*(?:contact|seller-home-value|buyer-listing|sell-your-home|\/lp\/)/ },
]

const dirs = lpDirs()
let totalDeductions = 0
const grades = {}

for (const dir of dirs) {
  const blob = filesIn(dir).map((f) => readFileSync(f, 'utf8')).join('\n')
  // A page that mounts a shared LP form (e.g. <SellerLPForm/>) delegates its
  // conversion wiring to that form, which is graded where it lives. Credit it.
  const delegatesForm = /\b[A-Z]\w*LPForm\b/.test(blob)
  const hasOwnForm = filesIn(dir).some((f) => f.endsWith('actions.ts')) || /<form|<Form|onSubmit|create\w*Lead/.test(blob)
  const isCapture = hasOwnForm || delegatesForm
  const applicable = CRITERIA.filter((c) => !c.captureOnly || isCapture)
  const missing = applicable.filter((c) => {
    if (c.re.test(blob)) return false
    // Delegated pages inherit the shared form's lead-create/CAPI/GA4/confirm + CTA.
    if (delegatesForm && (c.captureOnly || c.key === 'cta')) return false
    return true
  }).map((c) => c.key)
  totalDeductions += missing.length
  const name = dir.replace('app/lp/', '')
  grades[name] = { capture: isCapture, score: `${applicable.length - missing.length}/${applicable.length}`, missing }
}

const update = process.argv.includes('--update')
let baseline = { total: Infinity }
try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* first run */ }

// Always print the grade card.
console.log('Landing-page conversion grades:')
for (const [name, g] of Object.entries(grades)) {
  const flag = g.missing.length ? `  ✗ missing: ${g.missing.join(', ')}` : '  ✓'
  console.log(`  ${g.score}  ${name}${g.capture ? '' : ' (info)'}${flag}`)
}

if (update) {
  if (Number.isFinite(baseline.total) && totalDeductions > baseline.total) {
    console.error(`✗ refusing to raise baseline (${baseline.total} → ${totalDeductions}). Dial the pages first.`)
    process.exit(1)
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({ total: totalDeductions, grades }, null, 2) + '\n')
  console.log(`✓ lp-conversion baseline set to ${totalDeductions}`)
  process.exit(0)
}

if (totalDeductions > baseline.total) {
  console.error(`✗ lp-conversion REGRESSION: ${totalDeductions} deductions vs baseline ${baseline.total}. A landing page lost a conversion criterion.`)
  process.exit(1)
}

console.log(`✓ lp-conversion OK — ${totalDeductions} deductions (baseline ${baseline.total === Infinity ? totalDeductions : baseline.total}); no regression.`)
process.exit(0)
