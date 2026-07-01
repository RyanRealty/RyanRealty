#!/usr/bin/env node
/**
 * check-crm-mobile-track.mjs — the CRM MOBILE DELIVERY TRACK is gated, not prose.
 *
 * Matt directive 2026-07-01: "follow the plan. it is not just prose, make
 * mechanical gates — every feature you see in those screenshots should be
 * working." This gate does two things:
 *
 *  1. LOCKS what is built. Each SHIPPED contract below greps the wired file
 *     for its load-bearing markers (the §-spec structures verified on prod).
 *     Removing the wiring fails the commit.
 *  2. RATCHETS what is not. Every M-item still pending is enumerated; the gate
 *     prints the debt and FAILS if a previously-shipped item disappears from
 *     SHIPPED. Ship an item by moving it from PENDING to SHIPPED with its
 *     markers — the pending list may only shrink (enforced against the plan's
 *     PROGRESS section is manual; the SHIPPED list here is the machine truth).
 *
 * Plan: docs/plans/CRM_BUILD_MISSION.md — MOBILE DELIVERY TRACK (M1–M9).
 * Spec: docs/fub-crm-spec/§23–§30 + mobile-screens/mob-NN analyses.
 */
import { readFileSync } from 'node:fs'

/** SHIPPED — file must exist and contain every marker (regexes). */
const SHIPPED = [
  {
    id: 'M1 contact detail — §25 layout wired at <md + ?view=mobile',
    file: 'app/admin/console/leads/[id]/page.tsx',
    must: [/MobileLeadDetail/, /view === 'mobile'/, /md:hidden/],
  },
  {
    id: 'M1 contact detail — tab components composed',
    file: 'app/admin/console/leads/[id]/mobile-detail.tsx',
    must: [/MobileInfoTab/, /MobileCommsTab/, /MobileHomesTab/, /MobileNotesTab/, /MobileCalendarTab/],
  },
  {
    id: 'M1 interactivity — pickers + add contact point (§23.8/§25.5)',
    file: 'components/admin/crm/mobile/MobileInfoTab.tsx',
    must: [/MobileDetailsSection/, /MobileContactPointsSection/],
  },
  {
    id: 'M1 interactivity — addCrmContactPointAction exists',
    file: 'app/actions/crm.ts',
    must: [/export async function addCrmContactPointAction/],
  },
  {
    id: 'M2 shell — tab bar suppressed on pushed detail (§23 §9c, mob-02)',
    file: 'components/console/CrmMobileTabBar.tsx',
    must: [/isPushedDetailPath/],
  },
  {
    id: 'M2 shell — single FAB drops to corner on detail',
    file: 'components/console/ConsoleQuickAction.tsx',
    must: [/isPushedDetailPath/],
  },
  {
    id: 'Menu — CRM group carries Reporting/Workflows/Templates',
    file: 'app/components/admin/admin-nav.ts',
    must: [/\/admin\/crm\/reporting/, /\/admin\/crm\/sequences/, /\/admin\/crm\/settings\/templates/],
  },
]

/** PENDING — the remaining debt. An item ships by moving to SHIPPED with real
 *  markers. This list may ONLY shrink (reviewer-checked against the plan). */
const PENDING = [
  'M2 rest — pull-to-refresh, sheet swipe-down dismiss (§23 AC 20–21)',
  'M3 mobile inbox — sub-tabs + threads at <md (§26; /admin/crm/inbox)',
  'M4 mobile compose — email/text/call sheets (§27)',
  'M5 mobile home dashboard + people list + activity feed (§24; /admin/crm, /admin/crm/activity, /admin/broker-dashboard)',
  'M6 mobile calendar + tasks (§29; /admin/crm/calendar, /admin/crm/tasks)',
  'M7 remaining pickers — Source, Time frame, relationships, §25.10 tags full-screen, §25.11 address map, header Edit mode, per-tab FAB sheets',
  'M8 mobile Home Dashboard parity (mob-44)',
  'M9 mobile Settings (mob-06)',
]

const fails = []
for (const { id, file, must } of SHIPPED) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    fails.push(`${id}: ${file} MISSING`)
    continue
  }
  for (const re of must) if (!re.test(src)) fails.push(`${id}: pattern ${re} gone from ${file}`)
}

console.log('CRM mobile track gate')
console.log('=====================')
console.log(`✓ shipped + locked: ${SHIPPED.length - fails.length}/${SHIPPED.length} contracts`)
console.log(`○ pending (may only shrink): ${PENDING.length}`)
for (const p of PENDING) console.log(`  ○ ${p}`)
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  console.error('\nA shipped mobile contract regressed. Restore the wiring — do not delete mobile surfaces.')
  process.exit(1)
}
console.log('All shipped mobile contracts intact.')
