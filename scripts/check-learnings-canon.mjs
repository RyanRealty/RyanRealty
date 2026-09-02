#!/usr/bin/env node
/**
 * check-learnings-canon.mjs — G71: docs/LEARNINGS.md compounds in ENTRIES, never in prose.
 *
 * LEARNINGS.md is the one document every agent reads before executing. Its whole
 * value is that a correction from Matt lands there the same session, so the file
 * MUST be allowed to grow. What it must not do is bloat: an entry that turns into
 * a paragraph, a rule that has a gate but still carries its full war story, a
 * lesson with no pointer to where it is enforced, or a pointer that quietly drops
 * out of the files that tell agents to read it. Each of those is a rule here.
 *
 *   L1  POINTER LOSS. CLAUDE.md, AGENTS.md and docs/GROK_BOT_BRAIN.md each name
 *       `docs/LEARNINGS.md`. Lose the pointer on any surface and that agent stops
 *       reading the file, silently.
 *   L2  ENTRY SHAPE. Every entry (a `- **Rule.**` bullet outside a code fence) is
 *       at most MAX_ENTRY_LINES lines and MAX_ENTRY_BYTES bytes. A lesson is a rule,
 *       the incident, and two pointers. The founding file's longest entry was 9
 *       lines / 734 bytes; the caps sit just above that.
 *   L3  GRADUATION. An entry whose `Lives in:` names a `check-*.mjs` gate is at
 *       most GATED_ENTRY_LINES lines: the gate carries the enforcement and
 *       docs/MECHANICAL_GATES.md carries the founding case, so the entry keeps
 *       only the rule, one line of incident, and the pointer. The named script
 *       must also exist on disk; a `Lives in` that points at a gate nobody built
 *       is a false claim of enforcement.
 *   L4  RATCHET. Entries missing a `→ Lives in:` pointer, and entries missing a
 *       `Source:` line, are counted against scripts/learnings-canon-baseline.json
 *       and both counts may only SHRINK. Every NEW entry therefore carries both.
 *
 *   node scripts/check-learnings-canon.mjs                    # gate (exit 1 on fail)
 *   node scripts/check-learnings-canon.mjs --report           # human-readable, exit 0
 *   node scripts/check-learnings-canon.mjs --json             # machine-readable
 *   node scripts/check-learnings-canon.mjs --write-baseline   # record current counts (shrink-only)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DOC = 'docs/LEARNINGS.md'
const BASELINE_PATH = 'scripts/learnings-canon-baseline.json'
const POINTER_SURFACES = ['CLAUDE.md', 'AGENTS.md', 'docs/GROK_BOT_BRAIN.md']

export const MAX_ENTRY_LINES = 9
export const MAX_ENTRY_BYTES = 800
export const GATED_ENTRY_LINES = 6

const args = process.argv.slice(2)
const REPORT = args.includes('--report')
const JSON_OUT = args.includes('--json')
const WRITE_BASELINE = args.includes('--write-baseline')

/**
 * Parse the bullet entries out of the document. An entry starts on a line
 * beginning `- **`, continues over indented lines, and ends at a blank line, a
 * heading, or the next bullet. Fenced code blocks are skipped entirely, so the
 * entry template in "How to add an entry" is not itself an entry.
 */
export function parseEntries(text) {
  const lines = text.split('\n')
  const entries = []
  let cur = null
  let section = ''
  let fence = false
  const flush = () => {
    if (cur) entries.push(cur)
    cur = null
  }
  lines.forEach((line, i) => {
    if (/^```/.test(line)) {
      fence = !fence
      flush()
      return
    }
    if (fence) return
    if (/^#{1,6} /.test(line)) {
      flush()
      section = line.replace(/^#+\s*/, '')
      return
    }
    if (/^- \*\*/.test(line)) {
      flush()
      cur = { section, startLine: i + 1, lines: [line] }
      return
    }
    if (cur && /^\s{2,}\S/.test(line)) {
      cur.lines.push(line)
      return
    }
    flush()
  })
  flush()
  return entries.map((e) => {
    const body = e.lines.join('\n')
    const livesIn = /→\s*Lives in:/.test(body)
    const source = /\bSource:/.test(body)
    const gateRefs = [...body.matchAll(/check-[a-z0-9-]+\.mjs/g)].map((m) => m[0])
    const livesInMatch = body.match(/→\s*Lives in:([^\n]*(?:\n\s+[^\n]*)*)/)
    const livesInText = livesInMatch ? livesInMatch[1] : ''
    const gatedBy = [...livesInText.matchAll(/check-[a-z0-9-]+\.mjs/g)].map((m) => m[0])
    return {
      section: e.section,
      startLine: e.startLine,
      title: e.lines[0].replace(/^- \*\*/, '').split('**')[0].slice(0, 80),
      lineCount: e.lines.length,
      bytes: Buffer.byteLength(body),
      livesIn,
      source,
      proseOnly: /Lives in:[^\n]*prose only/i.test(body),
      gateRefs,
      gatedBy,
    }
  })
}

export function evaluate({ text, surfaces, baseline, scriptExists }) {
  const failures = []
  const entries = parseEntries(text)

  for (const [file, content] of Object.entries(surfaces)) {
    if (content === null) failures.push(`L1 ${file} is missing; it must exist and name ${DOC}.`)
    else if (!content.includes(DOC)) failures.push(`L1 ${file} no longer names ${DOC}. That agent surface has stopped reading the learnings file.`)
  }

  for (const e of entries) {
    const where = `${DOC}:${e.startLine} "${e.title}"`
    if (e.lineCount > MAX_ENTRY_LINES) {
      failures.push(`L2 ${where} runs ${e.lineCount} lines (max ${MAX_ENTRY_LINES}). An entry is the rule, the incident, and two pointers. Move the story to the owning canon.`)
    }
    if (e.bytes > MAX_ENTRY_BYTES) {
      failures.push(`L2 ${where} is ${e.bytes} bytes (max ${MAX_ENTRY_BYTES}). Cut it to the rule, the incident, and the pointers.`)
    }
    if (e.gatedBy.length > 0) {
      if (e.lineCount > GATED_ENTRY_LINES) {
        failures.push(`L3 ${where} is enforced by ${e.gatedBy.join(', ')} but still runs ${e.lineCount} lines (max ${GATED_ENTRY_LINES} once gated). The gate and docs/MECHANICAL_GATES.md hold the story; keep the rule, one line of incident, and the pointer.`)
      }
      for (const g of e.gatedBy) {
        if (!scriptExists(g)) failures.push(`L3 ${where} claims enforcement by scripts/${g}, which does not exist. A Lives-in that names an unbuilt gate is a false claim; build it or write "prose only".`)
      }
    }
  }

  const missingLivesIn = entries.filter((e) => !e.livesIn)
  const missingSource = entries.filter((e) => !e.source)
  const counts = { entries: entries.length, missingLivesIn: missingLivesIn.length, missingSource: missingSource.length }

  if (baseline === null) {
    failures.push(`L4 ${BASELINE_PATH} is missing or unreadable. Record it: node scripts/check-learnings-canon.mjs --write-baseline`)
  } else {
    if (counts.missingLivesIn > baseline.missingLivesIn) {
      const fresh = missingLivesIn.slice(-(counts.missingLivesIn - baseline.missingLivesIn))
      failures.push(`L4 ${counts.missingLivesIn} entries lack a "→ Lives in:" pointer, over the ${baseline.missingLivesIn} baseline. Every new entry says where the rule is enforced (gate script, CLAUDE.md §N, R-NNN, or "prose only"). Likely: ${fresh.map((e) => `line ${e.startLine} "${e.title}"`).join('; ')}`)
    }
    if (counts.missingSource > baseline.missingSource) {
      const fresh = missingSource.slice(-(counts.missingSource - baseline.missingSource))
      failures.push(`L4 ${counts.missingSource} entries lack a "Source:" line, over the ${baseline.missingSource} baseline. Every new entry names the file, session, or ledger row it came from. Likely: ${fresh.map((e) => `line ${e.startLine} "${e.title}"`).join('; ')}`)
    }
  }

  const proseOnly = entries.filter((e) => e.proseOnly).length
  const gated = entries.filter((e) => e.gatedBy.length > 0).length
  return { failures, counts: { ...counts, proseOnly, gated, bytes: Buffer.byteLength(text) }, entries }
}

function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'))
    if (typeof parsed.missingLivesIn !== 'number' || typeof parsed.missingSource !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function main() {
  const docPath = path.join(ROOT, DOC)
  if (!existsSync(docPath)) {
    console.error(`✗ ci:learnings-canon — ${DOC} does not exist.`)
    process.exit(1)
  }
  const text = readFileSync(docPath, 'utf8')
  const surfaces = Object.fromEntries(
    POINTER_SURFACES.map((f) => [f, existsSync(path.join(ROOT, f)) ? readFileSync(path.join(ROOT, f), 'utf8') : null]),
  )
  const existing = readBaseline()
  const scriptExists = (name) => existsSync(path.join(ROOT, 'scripts', name))

  if (WRITE_BASELINE) {
    const { counts } = evaluate({ text, surfaces, baseline: { missingLivesIn: Infinity, missingSource: Infinity }, scriptExists })
    if (existing && (counts.missingLivesIn > existing.missingLivesIn || counts.missingSource > existing.missingSource)) {
      console.error(
        `✗ refusing to write a LARGER baseline (missingLivesIn ${existing.missingLivesIn}→${counts.missingLivesIn}, missingSource ${existing.missingSource}→${counts.missingSource}). ` +
          `The ratchet only shrinks. Give the new entries their pointers instead.`,
      )
      process.exit(1)
    }
    writeFileSync(
      path.join(ROOT, BASELINE_PATH),
      JSON.stringify(
        {
          note: `Ratchet for ci:learnings-canon (G71). Entries in ${DOC} missing a "→ Lives in:" pointer or a "Source:" line. Both counts may only SHRINK: every new entry carries both. Refresh with node scripts/check-learnings-canon.mjs --write-baseline after fixing old entries, never to admit new debt.`,
          generatedAt: new Date().toISOString(),
          entries: counts.entries,
          missingLivesIn: counts.missingLivesIn,
          missingSource: counts.missingSource,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`baseline written: ${counts.entries} entries, missingLivesIn ${counts.missingLivesIn}, missingSource ${counts.missingSource}.`)
    return
  }

  const result = evaluate({ text, surfaces, baseline: existing, scriptExists })
  const c = result.counts
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: result.failures.length === 0, counts: c, failures: result.failures }, null, 2))
    process.exit(REPORT || result.failures.length === 0 ? 0 : 1)
  }
  console.log('LEARNINGS.md canon gate (ci:learnings-canon, G71)')
  console.log('=================================================')
  console.log(
    `${c.entries} entries · ${c.bytes} bytes · gated ${c.gated} · prose-only ${c.proseOnly} (next gates to build) · ` +
      `missing Lives-in ${c.missingLivesIn}/${existing?.missingLivesIn ?? '—'} · missing Source ${c.missingSource}/${existing?.missingSource ?? '—'}`,
  )
  if (result.failures.length > 0) {
    console.error(`\n✗ ci:learnings-canon — ${result.failures.length} failure(s):`)
    for (const f of result.failures) console.error(`  - ${f}`)
    process.exit(REPORT ? 0 : 1)
  }
  console.log('\n✓ LEARNINGS.md compounds in entries, not prose: every surface points at it, no entry is a paragraph, gated rules are collapsed, pointer debt did not grow.')
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) main()
