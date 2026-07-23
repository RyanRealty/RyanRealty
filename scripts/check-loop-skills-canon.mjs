#!/usr/bin/env node
/**
 * check-loop-skills-canon.mjs — ci:loop-skills-canon (W13.3).
 *
 * Keeps the tracked loop skills consistent with canon after the 2026-07-21
 * streamlining:
 *   1. The crm-e2e + tc-builder loop skills are actually git-TRACKED (their
 *      .gitignore un-ignore landed AND the files were committed — an un-ignore
 *      without a commit leaves them absent from clones).
 *   2. No tracked LOOP skill (a SKILL.md under .claude/skills/) carries the
 *      SUPERSEDED blanket approval model. The 2026-07-21 model ("full autonomy post-hoc for
 *      reversible work; per-action approval only for sends/publishing/spend/OAuth")
 *      replaced "Draft-First, Commit-Last always". The signature of the retired
 *      model is "commit-last" — a positive "draft-first" for a publishing/content
 *      class is still fine, so the gate targets only the blanket "commit-last".
 *      SCOPE: .claude/skills/ only. The producer skill trees (social_media_skills/,
 *      marketing_brain_skills/, automation_skills/) still carry ~80 stale
 *      "§0.5 (Draft-First, Commit-Last)" citations — a repo-wide sweep tracked as
 *      a separate follow-up (W13.3 scoped to the loop skills + cursor rules).
 *   3. tc-builder carries no stale "## PAUSED" fleet-state block.
 *   4. No cursor rule re-introduces the retired "no hyphens or colons" voice
 *      contradiction (canon allows compound hyphens + structural colons).
 *
 * Exit: 0 = clean, 1 = a canon drift.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const problems = []
const SKILLS_DIR = '.claude/skills'
const CURSOR_DIR = '.cursor/rules'

function tracked(path) {
  try {
    return execSync(`git ls-files -- ${path}`, { encoding: 'utf8' }).trim().length > 0
  } catch {
    return false
  }
}

// 1. crm-e2e + tc-builder must be tracked.
for (const skill of ['crm-e2e', 'tc-builder']) {
  const dir = `${SKILLS_DIR}/${skill}`
  if (!existsSync(join(process.cwd(), dir, 'SKILL.md'))) {
    problems.push(`${skill}: ${dir}/SKILL.md not on disk`)
  } else if (!tracked(`${dir}/SKILL.md`)) {
    problems.push(
      `${skill}: ${dir}/SKILL.md is NOT git-tracked — the .gitignore un-ignore landed but the file was never committed, so it is absent from every clone. \`git add ${dir}\`.`,
    )
  }
}

// 2. No tracked skill carries the superseded blanket "commit-last" approval model.
function trackedSkillFiles() {
  try {
    return execSync(`git ls-files -- '${SKILLS_DIR}/**/SKILL.md'`, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}
for (const f of trackedSkillFiles()) {
  const text = readFileSync(join(process.cwd(), f), 'utf8')
  if (/commit[-\s]last/i.test(text)) {
    problems.push(
      `${f}: contains the superseded "commit-last" blanket approval model. The 2026-07-21 model is full autonomy post-hoc for reversible work; per-action approval only for sends/publishing/spend/OAuth. Rewrite the approval section.`,
    )
  }
}

// 3. tc-builder has no stale "## PAUSED" fleet-state block.
const tcb = `${SKILLS_DIR}/tc-builder/SKILL.md`
if (existsSync(join(process.cwd(), tcb)) && /^##\s+PAUSED/im.test(readFileSync(join(process.cwd(), tcb), 'utf8'))) {
  problems.push(`${tcb}: still carries a "## PAUSED" block — stale fleet state, strip it (W13.3).`)
}

// 4. No cursor rule re-introduces the "no hyphens or colons" voice contradiction.
//    Checked PER LINE: a line that documents the removal ("...was wrong / is
//    removed / contradicted canon...") is allowed; a line that ASSERTS the rule
//    is not. A whole-file exemption would let a re-introduction hide behind the
//    same file's own removal note.
if (existsSync(join(process.cwd(), CURSOR_DIR))) {
  for (const name of readdirSync(join(process.cwd(), CURSOR_DIR))) {
    if (!name.endsWith('.mdc')) continue
    const p = `${CURSOR_DIR}/${name}`
    const lines = readFileSync(join(process.cwd(), p), 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (/no hyphens or colons/i.test(line) && !/was wrong|contradicted canon|is removed|old blanket/i.test(line)) {
        problems.push(
          `${p}:${i + 1}: re-introduces "no hyphens or colons" — canon allows compound hyphens (single-family, ryan-realty.com) + structural colons. Remove it.`,
        )
      }
    })
  }
}

console.log('Loop-skills canon gate (ci:loop-skills-canon)')
console.log('=============================================')
if (problems.length) {
  console.error('\nCanon drift:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n\x1b[31m✗ ci:loop-skills-canon: ${problems.length} drift(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Loop skills tracked, on the 2026-07-21 approval model, no PAUSED block, no hyphen/colon contradiction.')
process.exit(0)
