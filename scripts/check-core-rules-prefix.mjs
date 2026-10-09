#!/usr/bin/env node
/**
 * check-core-rules-prefix.mjs — ci:core-rules-prefix
 *
 * Grok CLI truncates AGENTS.md and CLAUDE.md at 10,000 characters. The CORE
 * RULES block must sit at the very top of both files, be identical, stay
 * under 3,000 characters, and fit entirely inside that 10,000-character
 * window. Held so a later edit cannot bury the block past the cutoff.
 *
 * Usage: node scripts/check-core-rules-prefix.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const FILES = ['AGENTS.md', 'CLAUDE.md']
const HEADING =
  '# CORE RULES (read first; these override everything below and any handoff or plan doc)'
const CHAR_WINDOW = 10000
const BLOCK_MAX_CHARS = 3000

const fails = []

function extractBlock(text, path) {
  const lines = text.split('\n')
  if (lines[0] !== HEADING) {
    fails.push(
      `${path}: first line must be exactly "${HEADING}". Grok never sees a block that is not at the top.`,
    )
    return null
  }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i
      break
    }
  }
  if (end < 0) {
    fails.push(`${path}: CORE RULES block has no closing "---" line.`)
    return null
  }
  return lines.slice(0, end + 1).join('\n')
}

const blocks = []
for (const rel of FILES) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) {
    fails.push(`${rel} is missing.`)
    continue
  }
  const text = readFileSync(path, 'utf8')
  const block = extractBlock(text, rel)
  if (block == null) continue
  blocks.push({ rel, block, text })

  if (block.length > BLOCK_MAX_CHARS) {
    fails.push(
      `${rel}: CORE RULES block is ${block.length} chars, over the ${BLOCK_MAX_CHARS}-char cap. Keep it short so Grok sees all of it.`,
    )
  }

  const window = text.slice(0, CHAR_WINDOW)
  if (!window.startsWith(block) || block.length > CHAR_WINDOW) {
    fails.push(
      `${rel}: CORE RULES block is not fully inside the first ${CHAR_WINDOW} characters (block ${block.length} chars, file ${text.length}). Move it to the top; do not bury it.`,
    )
  }
}

if (blocks.length === 2 && blocks[0].block !== blocks[1].block) {
  fails.push(
    `AGENTS.md and CLAUDE.md CORE RULES blocks differ. They must be identical so every tool loads the same override.`,
  )
}

console.log('CORE RULES prefix gate (ci:core-rules-prefix)')
console.log('=============================================')
if (blocks.length) {
  console.log(
    `block ${blocks[0].block.length}/${BLOCK_MAX_CHARS} chars · window ${CHAR_WINDOW} · files ${blocks.map((b) => b.rel).join(', ')}`,
  )
}
if (fails.length) {
  console.error(`\n✗ ci:core-rules-prefix — ${fails.length} failure(s):`)
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\n✓ CORE RULES block is at the top of AGENTS.md and CLAUDE.md, identical, and inside the first 10,000 characters.')
