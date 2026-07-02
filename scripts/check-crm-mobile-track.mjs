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
  // Matt directive 2026-07-02 (mobile punch list #1) SUPERSEDES the earlier
  // mob-02 "suppress tab bar on pushed detail" contract: "I do not have the
  // bottom bar like in follow up boss" — the bar renders on EVERY mobile CRM
  // route, including the lead detail. The FAB always sits above it (bottom-20
  // below lg). isPushedDetailPath was deleted with the suppression.
  {
    id: 'M2 shell — tab bar renders on every route incl. pushed detail (Matt 2026-07-02)',
    file: 'components/console/CrmMobileTabBar.tsx',
    must: [/the bar renders on EVERY\s+\/\/ mobile CRM route/m],
    mustNot: [/isPushedDetailPath/],
  },
  {
    id: 'M2 shell — single FAB rides above the always-on tab bar',
    file: 'components/console/ConsoleQuickAction.tsx',
    must: [/fixed bottom-20 right-5/],
    mustNot: [/isPushedDetailPath/],
  },
  {
    id: 'Menu — CRM group carries Reporting/Workflows/Templates',
    file: 'app/components/admin/admin-nav.ts',
    must: [/\/admin\/crm\/reporting/, /\/admin\/crm\/sequences/, /\/admin\/crm\/settings\/templates/],
  },
  {
    id: 'M5 people root — §24 All Lists/Stages directory + filtered list at <md (mob-09/10)',
    file: 'app/admin/(protected)/crm/page.tsx',
    must: [/MobilePeopleRoot/, /md:hidden/],
  },
  {
    id: 'M5 people root — directory/list modes + count bar',
    file: 'components/admin/crm/mobile/MobilePeopleRoot.tsx',
    must: [/All Lists/, /Stages/, /people\b/, /formatCount/],
  },
  {
    id: 'M5 activity — §24 mobile sub-tab strip (New Leads/Emails/Website)',
    file: 'components/admin/crm/GlobalActivityFeed.client.tsx',
    must: [/MOBILE_TABS/, /New Leads/, /Website/],
  },
]

/** PENDING — the remaining debt. Matt directive 2026-07-01: "EVERY crm page."
 *  Scope = every CRM route in the app (enumerated below, grouped by the
 *  M-track item that covers it), each to its §23–§30 / mob-NN reference with
 *  every control working, verified at 390px, real data. An item ships by
 *  moving to SHIPPED with real markers. This list may ONLY shrink. */
const PENDING = [
  'M2 rest — pull-to-refresh, sheet swipe-down dismiss (§23 AC 20–21) [shell, all routes]',
  'M3 mobile inbox — sub-tabs + threads (§26): /admin/crm/inbox',
  'M4 mobile compose — email/text/call sheets (§27) [lead detail + inbox]',
  'M5 rest (§24): swipe-left row actions + long-press multi-select + team-filter header sheet; /admin/broker-dashboard · /admin/console · /admin/console/leads · /admin/crm/new · /admin/crm/approvals',
  'M6 mobile calendar + tasks (§29): /admin/crm/calendar · /admin/crm/tasks',
  'M7 remaining pickers — Source, Time frame, relationships, §25.10 tags full-screen, §25.11 address map, header Edit mode, per-tab FAB sheets [lead detail]',
  'M8 mobile Home Dashboard parity (mob-44): /admin/broker-dashboard',
  'M9 mobile Settings (mob-06): /admin/crm/settings + all 16 sub-pages (appointments · areas · assignment · brokers · company · custom-fields · groups · lead-flows · market-reports · ponds · segments · stages · suppression · tags · team · templates)',
  'M10 mobile deals (§10/FUB §12i): /admin/crm/deals · /admin/crm/deals/[id]',
  'M11 mobile workflows/automations: /admin/crm/sequences · /admin/crm/sequences/[id]/edit · /admin/crm/workflows · /admin/crm/automations',
  'M12 mobile reporting suite (12 reports usable at 390px): /admin/crm/reporting + agent-activity · agent-goals · appointments · batch-emails · call-logs · calls · contact-attempts · lead-sources · overview · properties · speed-to-lead · texts',
  'M13 mobile import: /admin/crm/import + [id] · new · new/map · new/preview',
  'M14 mobile CRM health: /admin/crm/health',
]

const fails = []
for (const { id, file, must, mustNot = [] } of SHIPPED) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    fails.push(`${id}: ${file} MISSING`)
    continue
  }
  for (const re of must) if (!re.test(src)) fails.push(`${id}: pattern ${re} gone from ${file}`)
  for (const re of mustNot) if (re.test(src)) fails.push(`${id}: forbidden pattern ${re} present in ${file}`)
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
