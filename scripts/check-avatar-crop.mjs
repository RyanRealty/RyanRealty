#!/usr/bin/env node
/**
 * check-avatar-crop.mjs — G49: circular people-avatars must not center-crop portraits.
 *
 * The broker headshots are normalized 800×1200 PORTRAITS (full head in the top
 * half of the frame). A circular avatar styled `rounded-full object-cover` with
 * the DEFAULT (center) object-position crops a portrait source to the torso and
 * cuts the head off — the 2026-07-15 CRM audit found this on ~20 surfaces at
 * once because every render inherited the default. `object-position` only acts
 * on the overflowing axis, so top-anchoring is a no-op for square/landscape
 * photos and correct for every portrait of a person.
 *
 * Rule: any string literal in a .tsx file that contains BOTH `rounded-full`
 * and `object-cover` must also carry an explicit object-position —
 * `object-top`, `object-center`, or an arbitrary `object-[…]`. Writing
 * `object-center` is an explicit (allowed) choice; omitting it is the bug.
 * Escape hatch for genuinely non-person circular images:
 * `// avatar-crop-ok: <reason>` on the same or previous line.
 *
 * Founding fix: commit "stop beheading broker headshots" — the two shared
 * primitives (components/ui/avatar.tsx AvatarImage, CrmMobileKit CrmAvatar)
 * plus 9 inline <img> renders.
 *
 * Usage: node scripts/check-avatar-crop.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next', 'out', 'dist'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (/\.tsx$/.test(name)) acc.push(p)
  }
  return acc
}

// Line-based: class lists are written on one line in this codebase. A line
// carrying both tokens without an explicit object-position is the bug.
const violations = []
for (const file of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((text, i) => {
    if (!text.includes('rounded-full') || !text.includes('object-cover')) return
    if (/object-top|object-center|object-bottom|object-\[/.test(text)) return
    if (text.includes('avatar-crop-ok') || (lines[i - 1] ?? '').includes('avatar-crop-ok')) return
    violations.push({ file: relative(ROOT, file), line: i + 1, literal: text.trim().slice(0, 100) })
  })
}

if (violations.length) {
  console.error('✗ ci:avatar-crop (G49) — circular avatar crops without an explicit object-position:\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  "${v.literal}"`)
  }
  console.error(
    '\nA `rounded-full object-cover` image center-crops portrait sources (the 800×1200 broker' +
      '\nheadshots) to the torso — the head gets cut off. Add `object-top` (right for any photo of' +
      '\na person; no effect on square/landscape sources), or opt out with `// avatar-crop-ok: <reason>`.',
  )
  process.exit(1)
}
console.log('✓ ci:avatar-crop — every rounded-full object-cover literal carries an explicit object-position')
