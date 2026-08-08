#!/usr/bin/env node
/**
 * check-admin-v2-tokens.mjs — the functional admin color gate (P7, 2026-08-05).
 *
 * The admin v2 language (design_system/admin/ADMIN_UI.md, visual lock
 * 2026-08-05) is exempt from the public-brand design-token gate. This gate is
 * what replaces it there: components/admin/v2/** must draw EVERY color from
 * the locked admin tokens.
 *
 * Rules:
 *   1. PARITY — components/admin/v2/tokens.css is byte-identical to the locked
 *      spec at design_system/admin/tokens.css. The runtime copy may not drift.
 *   2. NO RAW COLOR — outside tokens.css, no hex literals, no rgb()/hsl()/oklch()
 *      literals, and no Tailwind palette color classes anywhere under
 *      components/admin/v2/. Color reaches components only via var(--a-*).
 *   3. NO BRAND LEAK — the public brand is blacklisted as design input for the
 *      admin (amnesia, Matt 2026-08-04): no --rr-* tokens, no Amboqia, no Geist,
 *      and no imports from legacy components/admin/* (non-v2) or components/ui/*.
 *
 * Scope grows with the rollout: when P9 migrates app/admin surfaces onto v2,
 * add those paths to SCAN_DIRS.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SPEC = join(ROOT, 'design_system/admin/tokens.css')
const COPY = join(ROOT, 'components/admin/v2/tokens.css')
// Entries may be directories (scanned recursively) or single files — the file
// form scopes a route whose subtree still holds un-migrated legacy machinery
// (prospecting's [kind]/[id] review page migrates with a later unit; flip the
// entry to the bare dir when it does).
const SCAN_DIRS = [
  'components/admin/v2',
  'app/admin/(protected)/today',
  'app/admin/(protected)/messages',
  // people/[id] hosts the relocated legacy workspace (tools/, portal/) and the
  // G50 composer chokepoints mounted on the v2 person fold (11B B2:
  // CommsSection mounts SmsComposer/EmailComposer, SendSection mounts
  // ContactSendCenter — sanctioned legacy imports). File-form scope the
  // pure-v2 files; flip back to the bare dir when the chokepoints migrate.
  'app/admin/(protected)/people/page.tsx',
  'app/admin/(protected)/people/actions.ts',
  'app/admin/(protected)/people/[id]/page.tsx',
  'app/admin/(protected)/people/[id]/FieldEditors.tsx',
  'app/admin/(protected)/people/[id]/TasksSection.tsx',
  'app/admin/(protected)/people/[id]/NotesSection.tsx',
  'app/admin/(protected)/people/[id]/HomesSection.tsx',
  'app/admin/(protected)/prospecting/page.tsx',
  'app/admin/(protected)/prospecting/actions.ts',
  'app/admin/(protected)/prospecting/FilterSelect.tsx',
  'app/admin/(protected)/oversight',
  'app/admin/(protected)/valuations',
  'app/admin/(protected)/closings',
  'app/admin/(protected)/reports/page.tsx',
  'app/admin/(protected)/audiences',
  'app/admin/(protected)/content',
  'app/admin/(protected)/settings/page.tsx',
  // 11C/11D/11E (2026-08-07). The admin interior migration is COMPLETE — all
  // 143 admin pages are on the v2 language and ci:admin-ui rule B reads 0
  // legacy pages. These 90 files are token-scoped here.
  //
  // The rest are deferred for ONE stated reason, not skipped: they mount client
  // islands from @/components/admin/<legacy> or @/components/ui — BpoBoard,
  // CmaBoard, DealsBoard, ProspectDetailPage, the newsletter panels,
  // ListingsCsvExport, AdminListingEditor, SignOffControls and friends — which
  // rule 3 blacklists and which the migration mounts as-is BY DESIGN, the same
  // call already recorded above for people/[id]. A page joins this list the day
  // its island migrates; the work-queue item is 11f-mounted-islands.
  'app/admin/(protected)/analytics/action-required/page.tsx',
  'app/admin/(protected)/analytics/ad-roi/page.tsx',
  'app/admin/(protected)/analytics/cost-per-lead/page.tsx',
  'app/admin/(protected)/analytics/demographics/page.tsx',
  'app/admin/(protected)/analytics/funnel-breakdown/page.tsx',
  'app/admin/(protected)/analytics/google-business-profile/page.tsx',
  'app/admin/(protected)/analytics/google-search/page.tsx',
  'app/admin/(protected)/analytics/listing-performance/page.tsx',
  'app/admin/(protected)/analytics/lp-leaderboard/page.tsx',
  'app/admin/(protected)/analytics/meta-health/page.tsx',
  'app/admin/(protected)/analytics/page.tsx',
  'app/admin/(protected)/analytics/social/page.tsx',
  'app/admin/(protected)/approval-queue/page.tsx',
  'app/admin/(protected)/audiences/page.tsx',
  'app/admin/(protected)/audit-log/page.tsx',
  'app/admin/(protected)/blog/page.tsx',
  'app/admin/(protected)/broker-links/CopyLinkButton.tsx',
  'app/admin/(protected)/broker-links/page.tsx',
  'app/admin/(protected)/brokers/edit/page.tsx',
  'app/admin/(protected)/brokers/new/page.tsx',
  'app/admin/(protected)/brokers/page.tsx',
  'app/admin/(protected)/closings/page.tsx',
  'app/admin/(protected)/commissions/page.tsx',
  'app/admin/(protected)/content/page.tsx',
  'app/admin/(protected)/crm/approvals/page.tsx',
  'app/admin/(protected)/crm/deals/[id]/page.tsx',
  'app/admin/(protected)/crm/health/page.tsx',
  'app/admin/(protected)/crm/import/[id]/page.tsx',
  'app/admin/(protected)/crm/import/new/map/page.tsx',
  'app/admin/(protected)/crm/import/new/page.tsx',
  'app/admin/(protected)/crm/import/new/preview/page.tsx',
  'app/admin/(protected)/crm/import/page.tsx',
  'app/admin/(protected)/crm/new/page.tsx',
  'app/admin/(protected)/crm/referrals/page.tsx',
  // 11F (2026-08-08) — the reporting family, BARE DIR (not file-form): its
  // mounted islands migrated with it, so there is nothing left in the subtree to
  // carve around, and a new file under it is covered the day it lands. The
  // shared sub-nav and the shared broker+date filter now live in
  // crm/reporting/_components/ instead of components/admin/crm/reporting/.
  'app/admin/(protected)/crm/reporting',
  'app/admin/(protected)/crm/settings/appointments/page.tsx',
  'app/admin/(protected)/crm/settings/brokers/page.tsx',
  'app/admin/(protected)/crm/settings/company/registration/page.tsx',
  'app/admin/(protected)/crm/settings/page.tsx',
  'app/admin/(protected)/crm/settings/team/page.tsx',
  'app/admin/(protected)/crm/workflows/page.tsx',
  'app/admin/(protected)/deals/[key]/page.tsx',
  'app/admin/(protected)/email/campaigns/page.tsx',
  'app/admin/(protected)/financials/page.tsx',
  'app/admin/(protected)/forms/page.tsx',
  'app/admin/(protected)/geo/area-guide-upload/page.tsx',
  'app/admin/(protected)/geo/page.tsx',
  'app/admin/(protected)/geo/resort-communities/page.tsx',
  'app/admin/(protected)/guides/page.tsx',
  'app/admin/(protected)/help/HelpSearch.tsx',
  'app/admin/(protected)/help/[slug]/page.tsx',
  'app/admin/(protected)/help/page.tsx',
  'app/admin/(protected)/listings/ListingsStatusFilter.tsx',
  'app/admin/(protected)/listings/[listingKey]/page.tsx',
  'app/admin/(protected)/listings/page.tsx',
  'app/admin/(protected)/media/banners/page.tsx',
  'app/admin/(protected)/media/page.tsx',
  'app/admin/(protected)/media/photos/page.tsx',
  'app/admin/(protected)/media/stock-photos/page.tsx',
  'app/admin/(protected)/messages/page.tsx',
  'app/admin/(protected)/newsletters/analytics/page.tsx',
  'app/admin/(protected)/newsletters/enroll/page.tsx',
  'app/admin/(protected)/newsletters/new/page.tsx',
  'app/admin/(protected)/newsletters/page.tsx',
  'app/admin/(protected)/oversight/page.tsx',
  'app/admin/(protected)/people/[id]/page.tsx',
  'app/admin/(protected)/people/page.tsx',
  'app/admin/(protected)/prospecting/page.tsx',
  'app/admin/(protected)/reports/brokers/page.tsx',
  'app/admin/(protected)/reports/cma-performance/page.tsx',
  'app/admin/(protected)/reports/custom/page.tsx',
  'app/admin/(protected)/reports/emails/page.tsx',
  'app/admin/(protected)/reports/lead-flow/page.tsx',
  'app/admin/(protected)/reports/leads/page.tsx',
  'app/admin/(protected)/reports/market/page.tsx',
  'app/admin/(protected)/reports/page.tsx',
  'app/admin/(protected)/reports/traffic-sources/page.tsx',
  'app/admin/(protected)/settings/page.tsx',
  'app/admin/(protected)/sign-off/page.tsx',
  'app/admin/(protected)/signing/[envelopeId]/page.tsx',
  'app/admin/(protected)/signing/page.tsx',
  'app/admin/(protected)/site-pages/page.tsx',
  'app/admin/(protected)/sync/page.tsx',
  'app/admin/(protected)/sync/spark/page.tsx',
  'app/admin/(protected)/today/page.tsx',
  'app/admin/(protected)/users/page.tsx',
  'app/admin/(protected)/valuations/page.tsx',
  'app/admin/(protected)/visitors/VisitorFilterSelect.tsx',
  'app/admin/(protected)/visitors/[sessionId]/page.tsx',
  'app/admin/(protected)/visitors/live/page.tsx',
  'app/admin/access-denied/page.tsx',
]
const EXT = new Set(['.ts', '.tsx', '.css'])

const failures = []

// Rule 1 — parity
if (!existsSync(SPEC)) failures.push(`missing locked spec: ${relative(ROOT, SPEC)}`)
if (!existsSync(COPY)) failures.push(`missing runtime copy: ${relative(ROOT, COPY)}`)
if (existsSync(SPEC) && existsSync(COPY)) {
  if (readFileSync(SPEC, 'utf8') !== readFileSync(COPY, 'utf8')) {
    failures.push(
      `tokens drift: components/admin/v2/tokens.css != design_system/admin/tokens.css ` +
        `(the locked spec wins — edit design_system first, then cp to components/admin/v2)`,
    )
  }
}

// Rules 2 + 3 — scan
const HEX = /#[0-9a-fA-F]{3,8}\b/g
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\s*\(/g
const TW_PALETTE =
  /\b(?:bg|text|border|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{1,3})?(?:\/\d{1,3})?\b/g
const BRAND_LEAK = /--rr-|Amboqia|AmboqiaBoriango|\bGeist\b/g
const LEGACY_IMPORT = /from\s+['"](?:@\/)?components\/(?:admin\/(?!v2(?:\/|['"]))|ui\/)/g

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (EXT.has(entry.name.slice(entry.name.lastIndexOf('.')))) out.push(full)
  }
  return out
}

function report(file, lineIdx, rule, snippet) {
  failures.push(`${relative(ROOT, file)}:${lineIdx + 1} — ${rule}: ${snippet.trim().slice(0, 90)}`)
}

for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) {
    failures.push(`SCAN_DIRS entry missing on disk: ${dir}`)
    continue
  }
  const files = statSync(abs).isDirectory() ? walk(abs) : [abs]
  for (const file of files) {
    const isTokens = file === COPY
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (!isTokens) {
        if (HEX.test(line)) report(file, i, 'raw hex (use var(--a-*))', line)
        HEX.lastIndex = 0
        if (COLOR_FN.test(line)) report(file, i, 'color function literal (use var(--a-*))', line)
        COLOR_FN.lastIndex = 0
        if (TW_PALETTE.test(line)) report(file, i, 'Tailwind palette class (admin v2 does not use Tailwind color)', line)
        TW_PALETTE.lastIndex = 0
      }
      if (BRAND_LEAK.test(line)) report(file, i, 'public-brand leak (amnesia: no --rr-*/Amboqia/Geist in admin v2)', line)
      BRAND_LEAK.lastIndex = 0
      if (LEGACY_IMPORT.test(line)) report(file, i, 'import from legacy components/admin or components/ui (blacklisted)', line)
      LEGACY_IMPORT.lastIndex = 0
      // Rule 4 — chrome ban (ADMIN_UI §3 acceptance bar, Matt 2026-08-05):
      // filter sets are ONE compact control, never pill rows.
      if (line.includes('av2-chiprow')) {
        report(file, i, 'chip wall (acceptance bar #2: filters are one dropdown, not pill rows)', line)
      }
    })
  }
}

if (failures.length) {
  console.error('✗ admin-v2 token gate failed:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ admin-v2 tokens: runtime copy matches the locked spec; no raw color, no brand leak.')
