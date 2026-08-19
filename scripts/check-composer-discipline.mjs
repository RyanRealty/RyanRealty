#!/usr/bin/env node
/**
 * check-composer-discipline.mjs — G50: one compose interface for every send.
 *
 * Matt directive 2026-07-15: "anytime a text or sms or email is sent I always
 * want it to use the same interface." The canonical surfaces are:
 *   - components/admin/crm/SmsComposer.tsx   (CRM chat bar — every SMS)
 *   - components/admin/crm/EmailComposer.tsx (Gmail-style — every email)
 *   - components/admin/crm/EmailBodyEditor.tsx (the shared editing core, for
 *     bulk hosts that own audience/scheduling)
 *
 * Before the 2026-07-15 consolidation, five surfaces had hand-rolled their own
 * compose UIs (mobile compose sheet SMS bar, expired/FSBO SendDocDialog, the
 * admin one-off email page, the cohort blast form, the people-list batch-email
 * dialog) — each drifted separately. This gate stops the class from coming
 * back:
 *
 * RULE: a .tsx file that references a LIVE message-send action AND renders its
 * own <Textarea must import one of the canonical composer components. Files
 * that merely bind actions (server pages) don't render Textareas and pass;
 * template/automation EDITORS that author bodies for later sends are
 * allowlisted below with reasons. Escape hatch for a genuinely new case:
 * `// composer-ok: <reason>` anywhere in the file.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next', 'out', 'dist'])

// Live send actions — a UI referencing one of these IS a send surface.
// stageDscrDealListDraftAction stages a Gmail draft rather than sending, but it
// composes a message a human then sends, so it is a compose surface and belongs
// under the one-interface rule like the rest.
const SEND_ACTIONS =
  /sendCrmSmsAction|sendCrmEmailAction|sendComposeAction|sendAdminEmail|sendDocEmailAction|sendDocSmsAction|bulkEmailCohortAction|dispatchComposeCohortAction|scheduleComposeCohortAction|stageDscrDealListDraftAction/

const CANONICAL_IMPORT =
  /@\/components\/admin\/crm\/(SmsComposer|EmailComposer|EmailBodyEditor|ComposeSurface)/

// Reviewed exemptions. Keep each entry justified — an unjustified entry is a
// gate hole, not a convenience.
const ALLOWLIST = new Map([
  // Edits a queued AI/template first-text inline before APPROVING it — an
  // approval-queue editor, not a compose surface; the send fires later from
  // the sequence engine.
  ['app/admin/(protected)/crm/approvals/page.tsx', 'approval-queue inline edit of a queued text'],
])

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

const violations = []
for (const file of SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
  const rel = relative(ROOT, file)
  // The canonical composers themselves are the interface.
  if (/components\/admin\/crm\/(SmsComposer|EmailComposer|EmailBodyEditor|ComposeSurface)\.tsx$/.test(rel)) continue
  const src = readFileSync(file, 'utf8')
  if (!SEND_ACTIONS.test(src)) continue
  if (!src.includes('<Textarea') && !src.includes('<textarea')) continue
  if (CANONICAL_IMPORT.test(src)) continue
  if (src.includes('composer-ok:')) continue
  if (ALLOWLIST.has(rel)) continue
  violations.push(rel)
}

if (violations.length) {
  console.error('✗ ci:composer-discipline (G50) — bespoke compose UI on a send surface:\n')
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\nEvery text/email send uses the canonical interface: SmsComposer (SMS chat bar),' +
      '\nEmailComposer (full email form), or EmailBodyEditor (embedded editing core for bulk' +
      '\nhosts). Render one of those instead of a raw <Textarea>, or — for a reviewed' +
      '\nnon-compose editor — add `// composer-ok: <reason>` or an ALLOWLIST entry with a reason.',
  )
  process.exit(1)
}
console.log('✓ ci:composer-discipline — every send surface renders a canonical composer')
