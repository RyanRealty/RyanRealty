#!/usr/bin/env node
/**
 * voice-diff-report — every copy change, per file, old text next to new text.
 *
 * Matt 2026-08-06: "i want you to show me your results for every page, what was
 * changed." Agent self-reports are claims. This reads the actual working-tree
 * diff and renders it, so the review is of what shipped rather than what
 * somebody said they did.
 *
 * Pairs removed and added lines within each diff hunk, keeps only the ones that
 * changed human-readable text, and prints them grouped by file.
 *
 *   node scripts/voice-diff-report.mjs                 working tree vs HEAD
 *   node scripts/voice-diff-report.mjs <ref>           working tree vs a ref
 *   node scripts/voice-diff-report.mjs <ref> --md      markdown, for pasting
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const REF = args.find((a) => !a.startsWith('--')) ?? 'HEAD'
const MD = args.includes('--md')

const diff = execSync(`git diff ${REF} -U0 -- . ':!*.test.*' ':!*baseline*.json' ':!scripts/voice-canon-state.json'`, {
  encoding: 'utf8',
  maxBuffer: 200 * 1024 * 1024,
})

/** Text a reader would see: strip code scaffolding so the pair reads as prose. */
function textOf(line) {
  const body = line.slice(1)
  const stripped = body
    .replace(/^\s*[-+*]?\s*/, '')
    .replace(/^\s*(const|let|var|export|import)\b.*$/, '')
    .trim()
  if (!stripped) return null
  // Keep lines that carry real words, not pure syntax.
  const words = stripped.replace(/[^A-Za-z' ]+/g, ' ').trim().split(/\s+/).filter((w) => w.length > 2)
  if (words.length < 3) return null
  return stripped.length > 240 ? `${stripped.slice(0, 237)}...` : stripped
}

const byFile = new Map()
let file = null
let removed = []
let added = []

function flush() {
  if (!file) return
  const pairs = []
  const max = Math.max(removed.length, added.length)
  for (let i = 0; i < max; i++) {
    const o = removed[i] ?? null
    const n = added[i] ?? null
    if (o || n) pairs.push([o, n])
  }
  if (pairs.length) byFile.set(file, [...(byFile.get(file) ?? []), ...pairs])
  removed = []
  added = []
}

for (const line of diff.split('\n')) {
  if (line.startsWith('diff --git')) {
    flush()
    file = line.split(' b/')[1] ?? null
    continue
  }
  if (line.startsWith('@@')) {
    flush()
    continue
  }
  if (line.startsWith('---') || line.startsWith('+++')) continue
  if (line.startsWith('-')) {
    const t = textOf(line)
    if (t) removed.push(t)
  } else if (line.startsWith('+')) {
    const t = textOf(line)
    if (t) added.push(t)
  }
}
flush()

const files = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
const totalEdits = files.reduce((n, [, v]) => n + v.length, 0)

if (files.length === 0) {
  console.log('No copy changes against', REF)
  process.exit(0)
}

console.log(MD ? `# Copy changes vs ${REF}\n` : `COPY CHANGES vs ${REF}`)
console.log(MD ? `${totalEdits} edits across ${files.length} files.\n` : `${totalEdits} edits across ${files.length} files.\n`)

for (const [f, pairs] of files) {
  console.log(MD ? `\n## ${f}  (${pairs.length})\n` : `\n${f}  (${pairs.length})`)
  for (const [o, n] of pairs) {
    if (o && n) {
      console.log(MD ? `- \`${o}\`\n  -> \`${n}\`` : `  - ${o}\n    -> ${n}`)
    } else if (n) {
      console.log(MD ? `- ADDED: \`${n}\`` : `  + ADDED: ${n}`)
    } else {
      console.log(MD ? `- CUT: \`${o}\`` : `  - CUT:   ${o}`)
    }
  }
}
console.log(MD ? '' : `\n${totalEdits} edits across ${files.length} files.`)
