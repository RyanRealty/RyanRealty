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
  // 11C/11D (2026-08-07). 38 pages migrated across eight families; these 28 are
  // scoped here. The other 10 are deferred for ONE reason, not skipped: they
  // mount client islands from @/components/admin/<legacy> (BpoBoard, CmaBoard,
  // DealsBoard, the newsletter panels), which rule 3 blacklists and which the
  // migration mounts as-is by design — the same call already recorded above for
  // people/[id]'s G50 composer chokepoints. Each lands here when its island
  // migrates; the work-queue item is 11f-mounted-islands.
  'app/admin/(protected)/brokers/edit/page.tsx',
  'app/admin/(protected)/brokers/new/page.tsx',
  'app/admin/(protected)/brokers/page.tsx',
  'app/admin/(protected)/crm/deals/[id]/page.tsx',
  'app/admin/(protected)/crm/import/[id]/page.tsx',
  'app/admin/(protected)/crm/import/new/map/page.tsx',
  'app/admin/(protected)/crm/import/new/page.tsx',
  'app/admin/(protected)/crm/import/new/preview/page.tsx',
  'app/admin/(protected)/crm/import/page.tsx',
  'app/admin/(protected)/geo/area-guide-upload/page.tsx',
  'app/admin/(protected)/geo/page.tsx',
  'app/admin/(protected)/geo/resort-communities/page.tsx',
  'app/admin/(protected)/media/banners/page.tsx',
  'app/admin/(protected)/media/page.tsx',
  'app/admin/(protected)/media/photos/page.tsx',
  'app/admin/(protected)/media/stock-photos/page.tsx',
  'app/admin/(protected)/newsletters/analytics/page.tsx',
  'app/admin/(protected)/newsletters/enroll/page.tsx',
  'app/admin/(protected)/newsletters/new/page.tsx',
  'app/admin/(protected)/newsletters/page.tsx',
  'app/admin/(protected)/reports/brokers/page.tsx',
  'app/admin/(protected)/reports/cma-performance/page.tsx',
  'app/admin/(protected)/reports/custom/page.tsx',
  'app/admin/(protected)/reports/emails/page.tsx',
  'app/admin/(protected)/reports/lead-flow/page.tsx',
  'app/admin/(protected)/reports/leads/page.tsx',
  'app/admin/(protected)/reports/market/page.tsx',
  'app/admin/(protected)/reports/traffic-sources/page.tsx',
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
