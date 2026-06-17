#!/usr/bin/env node
/**
 * G51 — KB menu-overlay hidden-state guard (locks the "giant CONTACT" fix).
 *
 * The KB full-screen menu overlay (components/site/kb/KbNav.client.tsx) renders
 * its nav words — including "Contact" — in Amboqia at up to 7rem. When CLOSED it
 * must be hidden by opacity + visibility + pointer-events, NOT by the off-screen
 * transform alone: a transformed ancestor (a Lenis smooth-scroll wrapper, a GSAP
 * pin, or any transform on .kb-root) breaks `position:fixed`, which once left the
 * giant links painting inline over the hero (the reported "giant CONTACT" ghost
 * + broken tablet layout). This gate fails the build if that defense is removed,
 * so the fix cannot silently regress.
 *
 * Asserts:
 *   - the closed `.kb-root .menu-overlay { ... }` rule declares opacity:0,
 *     visibility:hidden, AND pointer-events:none.
 *   - the `.kb-root .menu-overlay.open { ... }` rule re-enables all three
 *     (opacity:1, visibility:visible, pointer-events:auto).
 *
 * Usage: node scripts/check-kb-overlay-hidden.mjs
 */
import { readFileSync } from 'node:fs'

const FILE = 'components/site/kb/kb.css'
const css = readFileSync(FILE, 'utf8')

// Base (closed) rule: `.menu-overlay {` — NOT `.menu-overlay.open {`.
const closed = css.match(/\.kb-root\s+\.menu-overlay\s*\{([^}]*)\}/)
// Open rule.
const open = css.match(/\.kb-root\s+\.menu-overlay\.open\s*\{([^}]*)\}/)

const fails = []
const has = (body, decl) => new RegExp(decl.replace(/[-:]/g, '\\$&').replace(/\s+/g, '\\s*')).test(body)

if (!closed) {
  fails.push('could not find the closed `.kb-root .menu-overlay { ... }` rule')
} else {
  const body = closed[1]
  for (const decl of ['opacity:0', 'visibility:hidden', 'pointer-events:none']) {
    if (!has(body, decl)) fails.push(`closed .menu-overlay is missing "${decl}" (transform-only hiding regresses the giant CONTACT ghost)`)
  }
}

if (!open) {
  fails.push('could not find the `.kb-root .menu-overlay.open { ... }` rule')
} else {
  const body = open[1]
  for (const decl of ['opacity:1', 'visibility:visible', 'pointer-events:auto']) {
    if (!has(body, decl)) fails.push(`open .menu-overlay is missing "${decl}" (the menu would not show when toggled)`)
  }
}

if (fails.length) {
  console.error(`\n✗ kb-overlay-hidden: ${FILE} — the menu-overlay hidden-state defense is broken:\n`)
  for (const f of fails) console.error('  • ' + f)
  console.error(
    '\n  The closed KB menu overlay MUST hide via opacity:0 + visibility:hidden + pointer-events:none,\n' +
      '  not the transform alone — see the comment in kb.css and the giant-CONTACT incident.',
  )
  process.exit(1)
}
console.log('✓ kb-overlay-hidden: closed menu-overlay hides via opacity+visibility+pointer-events; .open re-enables all three.')
process.exit(0)
