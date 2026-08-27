#!/usr/bin/env node
/**
 * check-page-purpose.mjs — THE PAGE CONTRACTS BIND, OR THEY ARE DECORATION.
 *
 * Matt, 2026-08-27, on being told every page's plan was "written down":
 * "undoubtedly your bots will skip over it, not read it, ignore it... nobody
 * gives a fuck that you write it down somewhere." He is right, and it is this
 * repo's own first law (CLAUDE.md section 6): prose is advisory, gates are
 * enforced. The per-page purpose work of 2026-08-27 -- who the page beats, what
 * sections it carries, in what order -- landed in parity.json fields that
 * NOTHING read. An agent could delete a section, reorder the page, or strip the
 * competitive target, and every gate stayed green.
 *
 * WHAT BINDS NOW, per public-route contract in design_system/ryan-realty/ui_kits:
 *
 *   1. competitiveTarget EXISTS and is non-trivial. A public page with no
 *      stated way to beat the field is unfinished, and "TODO" is not a target.
 *   2. Every binding sectionOrder entry RESOLVES IN THE PAGE FILE -- by its
 *      `#id` (preferred) or by its leading `<Component` mount -- so a deleted
 *      section fails the build instead of vanishing quietly.
 *   3. The entries resolve IN ORDER (greedy subsequence over the page source,
 *      which is JSX order, which is DOM order). A reorder is a contract edit,
 *      visible in the diff, never a silent drift.
 *
 * WHAT A BINDING ENTRY IS. sectionOrder lines are prose for a human plus tokens
 * for this gate. A line binds iff it contains a `#some-id` token, or its first
 * word is a component name (CamelCase with at least one lowercase letter --
 * which is what exempts commentary like "MISSING: ..." and "APP FRAME ...").
 * Lines that bind by neither are annotations and are skipped, so the contract
 * can still carry judgment ("MISSING: live inventory") without lying to CI.
 *
 * Scope: contracts whose route matches app/** minus admin. The change path is
 * two-sided on purpose: edit the page -> the gate makes you edit the contract;
 * edit the contract -> the diff shows Matt the plan changed.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'

const failures = []
let checkedContracts = 0
let boundEntries = 0

const contracts = readdirSync(join(ROOT, KITS), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `${KITS}/${e.name}/parity.json`)
  .filter((rel) => existsSync(join(ROOT, rel)))

for (const rel of contracts) {
  let d
  try {
    d = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
  } catch {
    continue // ci:mockup-coverage owns unparseable-contract failures
  }
  const route = typeof d.route === 'string' ? d.route.trim() : ''
  if (!route.startsWith('app/') || route.startsWith('app/admin')) continue
  if (!existsSync(join(ROOT, route))) continue // mockup-coverage owns dead routes
  checkedContracts++

  // -- 1. the competitive target ------------------------------------------------
  const target = typeof d.competitiveTarget === 'string' ? d.competitiveTarget.trim() : ''
  if (target.length < 40) {
    failures.push(
      `${rel}: competitiveTarget is ${target ? `${target.length} chars` : 'missing'}. ` +
      `Every public page states how it beats the field, or it is unfinished (Matt 2026-08-27).`
    )
  }

  // -- 2 + 3. the section order binds against the page source -------------------
  const order = Array.isArray(d.sectionOrder) ? d.sectionOrder : []
  if (order.length === 0) {
    failures.push(`${rel}: sectionOrder is missing or empty. The page's section set is the plan; write it.`)
    continue
  }
  const src = readFileSync(join(ROOT, route), 'utf8')

  let cursor = -1
  for (const raw of order) {
    const entry = typeof raw === 'string' ? raw : ''
    const idMatch = entry.match(/#([a-z0-9][a-z0-9-]*)/)
    const compMatch = entry.match(/^([A-Z][A-Za-z0-9]*)/)
    const comp =
      compMatch && /[a-z]/.test(compMatch[1]) ? compMatch[1] : null
    if (!idMatch && !comp) continue // annotation line — does not bind
    boundEntries++

    // Greedy subsequence: search FORWARD from the previous hit, so repeated
    // components (two V3Ledger sections) resolve to their own mounts.
    //
    // WHEN AN ID IS STATED, THE ID IS THE ONLY TOKEN. The first version also
    // accepted the component mount as a fallback, and the break test caught it
    // immediately: renaming #service-area out of the about page still PASSED,
    // because <V3Ledger was still mounted somewhere. A fallback that can be
    // satisfied by a different section is not a check on THIS section.
    const tokens = idMatch ? [`id="${idMatch[1]}"`] : [`<${comp}`]
    let pos = -1
    for (const t of tokens) {
      const i = src.indexOf(t, cursor + 1)
      if (i !== -1 && (pos === -1 || i < pos)) pos = i
    }
    if (pos === -1) {
      // present at all, just out of order? distinguish the two failures.
      const anywhere = tokens.some((t) => src.includes(t))
      failures.push(
        anywhere
          ? `${rel}: "${entry.slice(0, 70)}" renders OUT OF ORDER in ${route}. The order is the plan; ` +
            `if the page's order is right, change the contract so the diff shows the plan changed.`
          : `${rel}: "${entry.slice(0, 70)}" does not render in ${route} (looked for ${tokens.join(' or ')}). ` +
            `A section the plan names was deleted, or the contract describes a page that does not exist.`
      )
      continue
    }
    cursor = pos
  }
}

console.log('page purpose contracts (ci:page-purpose)')
console.log('========================================')
console.log(`  public-route contracts checked : ${checkedContracts}`)
console.log(`  binding section entries        : ${boundEntries}`)

if (failures.length) {
  console.error(`\nFAIL - ${failures.length} contract violation(s):\n`)
  for (const f of failures) console.error('  ' + f)
  console.error(
    '\nThe contract is the plan Matt approved. Change the page AND the contract together,\n' +
    'so the plan change is in the diff — never one without the other.'
  )
  process.exit(1)
}
console.log('\nOK - every public page renders its planned sections, in the planned order, with a stated target.')
