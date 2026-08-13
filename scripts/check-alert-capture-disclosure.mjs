#!/usr/bin/env node
/**
 * check-alert-capture-disclosure.mjs — ci:alert-capture-disclosure.
 *
 * A PUBLIC EMAIL-CAPTURE SURFACE ON A LICENSED BROKER'S SITE OWES THE VISITOR
 * FOUR THINGS, AND THREE OF THEM KEPT LEAVING DURING THE v3 MIGRATION.
 *
 * The KB block every listing-alert sheet replaced (KbCommunityAlerts) rendered a
 * visually-hidden `company` honeypot and always printed "One email per new
 * listing. Unsubscribe any time." The barrel's Sheet renders one labelled control
 * per step, so the honeypot could not be expressed as a field, and three
 * migrations answered that the same way: drop the trap, hardcode `company: ''`,
 * and drop the disclosure with it. The declaration, where there was one, named
 * only the honeypot. What actually shipped was an address collected with no
 * frequency statement and no unsubscribe statement, in front of a per-IP limiter
 * that had lost the cheap filter standing in front of it.
 *
 * V3Sheet now takes a sheet-level `trap`, so nothing is missing from the barrel
 * and the honeypot is one prop. This gate keeps it from leaving again.
 *
 * THE RULE, for every surface that calls the listing-alert capture action:
 *   1. it passes a `trap` to the Sheet,
 *   2. it forwards the trap's own answer, never a hardcoded `company: ''` — a
 *      trap whose value is never read is not a trap,
 *   3. it states how often the email comes, and
 *   4. it states how to stop it.
 *
 * The pre-existing sheets are a FROZEN LEDGER naming which requirement each one
 * fails, measured 2026-08-12. A surface not on the ledger must pass all four; a
 * ledgered surface may not fail a NEW one. Fix a row by fixing the sheet and
 * deleting the row.
 *
 * Exit 0 = every listing-alert capture surface discloses and traps.
 */
import { readFileSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const SELF = 'scripts/check-alert-capture-disclosure.mjs'

/** The action that creates a recurring email subscription from a public form. */
const CAPTURE_ACTION = /submitSearchAlertSignup/

/**
 * Comments out, LINE comments before BLOCK comments. The reverse order is a real
 * defect this repo has already paid for: a `/*` inside a `//` line opens a
 * phantom block comment that swallows the rest of the file, and four public pages
 * went invisible to two gates that way. Every requirement below reads code, and a
 * docblock that QUOTES the defect it is warning about ("hardcodes `company: ''`")
 * must not be read as the defect.
 */
const stripComments = (src) =>
  src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

const REQUIREMENTS = [
  {
    id: 'honeypot',
    // Register-aware: the v3 Sheet takes a sheet-level `trap`, the KB and flat
    // registers render their own hidden input. Either is the trap; neither is
    // optional on a public write path.
    test: (src) => /\btrap=\{/.test(src) || /name=(?:"company"|'company'|\{[^}]*company)/i.test(src),
    say: 'renders no honeypot (the naive-bot filter in front of the per-IP limiter)',
  },
  {
    id: 'company-wired',
    test: (src) => !/company:\s*(''|"")/.test(src),
    say: "hardcodes `company: ''` instead of forwarding the trap's own answer",
  },
  {
    id: 'frequency',
    // An English SENTENCE, not a token. An earlier cut accepted the bare word
    // "daily", which every one of these files carries as the notification_frequency
    // argument to buildAlertCreatePayload('daily') — a code literal no visitor
    // reads, so the requirement passed on eight surfaces and meant nothing.
    test: (src) =>
      /(one|1) email per|per new listing|per new match|each new listing|each new match|every new listing|every new match/i.test(
        src,
      ),
    say: 'states no send frequency in copy a visitor reads',
  },
  {
    id: 'unsubscribe',
    // "Pause from any alert email" is a real control and it is not this. The
    // capture's standing promise is that the subscription can be ENDED, and the
    // canon sentence says so: "Unsubscribe any time."
    test: (src) => /unsubscribe|opt[- ]out/i.test(src),
    say: 'states no unsubscribe path',
  },
]

/**
 * Frozen 2026-08-12. Each row is a surface shipping without the named
 * requirement. It may only SHRINK, and a ledgered surface may not start failing
 * a requirement it currently passes.
 */
//
// PAID DOWN 2026-08-12: the neighborhood sheet's row is gone. Both sentences the
// KB block always carried ("One email per new listing. Unsubscribe any time.")
// are back in the copy beside the field, so that surface now passes every
// requirement rather than being excused from two.
const LEDGER = {
  'components/SaveSearchButton.tsx': ['frequency', 'unsubscribe'],
  'components/site/listing-detail/RoomRestyle.client.tsx': ['frequency', 'unsubscribe'],
}

const files = [...walkFiles('app'), ...walkFiles('components')].filter(
  (f) => f !== SELF && !f.startsWith('app/dev/') && !f.includes('__tests__') && !f.endsWith('.test.tsx'),
)

const failures = []
const fixed = []
let surfaces = 0

for (const f of files) {
  const src = stripComments(readFileSync(f, 'utf8'))
  if (!CAPTURE_ACTION.test(src)) continue
  // The action's own module defines it; it captures nothing itself.
  if (f.startsWith('app/actions/')) continue
  surfaces += 1
  const allowed = new Set(LEDGER[f] ?? [])
  for (const req of REQUIREMENTS) {
    const ok = req.test(src)
    if (!ok && !allowed.has(req.id)) failures.push({ file: f, req })
    if (ok && allowed.has(req.id)) fixed.push({ file: f, id: req.id })
  }
}

console.log('listing-alert capture disclosure gate (ci:alert-capture-disclosure)')
console.log('==================================================================')
console.log(`${surfaces} capture surface(s) scanned.`)

for (const { file, id } of fixed) {
  console.log(`  · ${file} now satisfies "${id}" — drop it from the ledger in this gate.`)
}

if (failures.length) {
  console.error('\nCapture surfaces missing a required disclosure or the honeypot:')
  for (const { file, req } of failures) console.error(`  ✗ ${file} — ${req.say}`)
  console.error('\n  V3Sheet takes a sheet-level `trap={{ name: "company", label: "Company" }}`,')
  console.error('  forward `answers.company` to the action, and say the frequency and the')
  console.error('  unsubscribe path in the step prose. See')
  console.error('  app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx.')
  console.error('\nFAILED.')
  process.exit(1)
}

console.log('OK — every listing-alert capture surface traps bots and discloses.')
process.exit(0)
