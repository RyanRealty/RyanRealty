#!/usr/bin/env node
/**
 * audit-brain.mjs
 *
 * Comprehensive audit of the marketing brain pipeline. Run before pushing
 * changes that touch:
 *   - producer SKILL.md files
 *   - REGISTRY.md
 *   - vercel.json
 *   - generate-briefs.ts / measurement-loop.ts / performance-bias.ts
 *
 * Catches regressions from parallel sessions (Cursor + Claude Code racing
 * each other on the same files) before they make it to production.
 *
 * Exit code 0 = all green, 1 = any hard failure.
 *
 * Usage: node scripts/audit-brain.mjs [--strict]
 * --strict: fail on warnings too.
 *
 * Locked 2026-05-17.
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = dirname(dirname(__filename))
const STRICT = process.argv.includes('--strict')

let hardFails = 0
let warnings = 0

function check(name, fn) {
  process.stdout.write(`[ check ] ${name.padEnd(60)} `)
  try {
    const r = fn()
    if (r === true) { console.log('PASS') }
    else if (r === 'warn') { console.log('WARN'); warnings++ }
    else { console.log(`FAIL  ${r || ''}`); hardFails++ }
  } catch (e) {
    console.log(`FAIL  ${e.message}`)
    hardFails++
  }
}

const reg = readFileSync(join(REPO_ROOT, 'marketing_brain_skills/producers/REGISTRY.md'), 'utf8')
const vc = JSON.parse(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf8'))

// 1. REGISTRY.md has all 22 Phase 4/6 NEW producer rows
const NEW_PRODUCERS = [
  'broker-contact-card','map_route_video','school_district_overlay','walkability_overlay',
  'market_pulse_short','clip_compilation','virtual_staging','floor_plan_render',
  'comparable_grid','testimonial_card','map_static_card','newsletter','listing-description',
  'cma-narrative','market-report-blog','meta-creative-variant','google-ads-copy',
  'nextdoor-business-ad','site-neighborhood-page','ops-google-ads','comms-client-update',
  'analyze-competitor',
]
check('REGISTRY.md has all 22 NEW producer rows', () => {
  const missing = NEW_PRODUCERS.filter((n) => !new RegExp(`^\\| ${n} \\|`, 'm').test(reg))
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`
})

// 2. vercel.json has all 10 NEW cron handlers
const NEW_CRONS = [
  '/api/cron/performance-pull-48h','/api/cron/performance-pull-7d','/api/cron/performance-pull-30d',
  '/api/cron/weekly-cycle','/api/cron/snapshot-channels',
  '/api/cron/producer-dispatcher','/api/cron/producer-runtime','/api/cron/publisher-sweep',
  '/api/cron/seller-lead-attribution','/api/cron/strategy-revision-check',
  '/api/cron/loop-health-check',
]
check('vercel.json has all 11 new cron handlers', () => {
  const have = new Set(vc.crons.map((c) => c.path))
  const missing = NEW_CRONS.filter((p) => !have.has(p))
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`
})

// 3. lib/punctuation-guard.ts exists and exports assertNoDashes
check('lib/punctuation-guard.ts exports assertNoDashes', () => {
  const src = readFileSync(join(REPO_ROOT, 'lib/punctuation-guard.ts'), 'utf8')
  return src.includes('export function assertNoDashes') ? true : 'missing export'
})

// 4. app/api/social/publish/route.ts calls assertNoDashes
check('publish route calls assertNoDashes (P0 guard)', () => {
  const src = readFileSync(join(REPO_ROOT, 'app/api/social/publish/route.ts'), 'utf8')
  return src.includes('assertNoDashes(') ? true : 'P0 guard not wired'
})

// 5. Phase 4.6 migrations all present
const MIGRATIONS = [
  '20260516200000_marketing_brain_actions_upgrade.sql',
  '20260516200100_content_performance_upgrade.sql',
  '20260516200200_marketing_cost_ledger.sql',
  '20260516200300_producer_change_requests.sql',
  '20260516200400_marketing_strategy.sql',
  '20260516200500_producer_execution_failures.sql',
]
check('All 6 Phase 4.6 migration files on disk', () => {
  const missing = MIGRATIONS.filter((m) => !existsSync(join(REPO_ROOT, 'supabase/migrations', m)))
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`
})

// 6. Strategy doc + KPI dashboard exist
check('Q3 2026 strategy + KPI dashboard on disk', () => {
  if (!existsSync(join(REPO_ROOT, 'marketing_brain_skills/strategy/Q3-2026-strategy.md'))) return 'strategy missing'
  if (!existsSync(join(REPO_ROOT, 'marketing_brain_skills/strategy/KPI-dashboard.md'))) return 'KPI dashboard missing'
  return true
})

// 7. Brain learning loop wired
check('Brain learning loop wired (performance-bias.ts + generate-briefs)', () => {
  if (!existsSync(join(REPO_ROOT, 'lib/marketing-brain/performance-bias.ts'))) return 'performance-bias.ts missing'
  const gb = readFileSync(join(REPO_ROOT, 'lib/marketing-brain/generate-briefs.ts'), 'utf8')
  return gb.includes('performance-bias') ? true : 'generate-briefs does not import performance-bias'
})

// 8. Admin UIs + diagnostic tools present
check('Admin UIs + diagnostic tools present', () => {
  const required = [
    'app/admin/(protected)/producers/page.tsx',
    'app/admin/(protected)/approval-queue/page.tsx',
    'app/admin/(protected)/kpi-dashboard/page.tsx',
    'app/api/admin/run-loop-cycle/route.ts',
    'app/api/admin/run-producer/[id]/route.ts',
    'scripts/loop-health-check.mjs',
    'scripts/brain-activity-report.mjs',
    'scripts/validate-producer.mjs',
  ]
  const missing = required.filter((p) => !existsSync(join(REPO_ROOT, p)))
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`
})

// 9. Validator pass rate >= 90%
check('Validator pass rate >= 90% across all SKILL.md', () => {
  const roots = [
    'marketing_brain_skills/producers',
    'marketing_brain_skills/analyze-anomaly',
    'marketing_brain_skills/analyze-experiment',
    'marketing_brain_skills/analyze-competitor',
    'social_media_skills',
    'video_production_skills',
    'automation_skills/content_engine',
  ]
  const findCmd = `find ${roots.map((r) => `'${join(REPO_ROOT, r)}'`).join(' ')} -name SKILL.md 2>/dev/null | sort -u`
  const files = execSync(findCmd, { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean)
  let pass = 0
  for (const f of files) {
    try {
      execSync(`node '${join(REPO_ROOT, 'scripts/validate-producer.mjs')}' '${f}'`, { stdio: 'ignore' })
      pass++
    } catch {}
  }
  const rate = Math.round((100 * pass) / files.length)
  if (rate >= 90) return true
  if (rate >= 75) return 'warn'
  return `pass rate ${rate}% (${pass}/${files.length})`
})

// 10. No em-dashes in producer SKILL.md files.
// Uses Python because macOS BSD grep's character class [—–] matches individual
// UTF-8 continuation bytes, producing false positives. Python's re module
// handles multi-byte chars cleanly.
check('No em-dashes in any producer SKILL.md', () => {
  const out = execSync(`python3 -c "
import os, re
dr = re.compile(r'[–—―⸺⸻]')
roots = ['marketing_brain_skills/producers','social_media_skills','video_production_skills','automation_skills/content_engine']
hits = []
for root in roots:
    rp = os.path.join('${REPO_ROOT}', root)
    if not os.path.isdir(rp): continue
    for dp, dn, fn in os.walk(rp):
        if 'SKILL.md' in fn:
            with open(os.path.join(dp,'SKILL.md'), errors='replace') as f:
                if dr.search(f.read()): hits.append(os.path.join(dp,'SKILL.md'))
print('\\n'.join(hits))
"`, { shell: '/bin/bash' }).toString().trim()
  if (!out) return true
  const files = out.split('\n').filter(Boolean)
  return files.length === 0 ? true : `${files.length} file(s) have dashes: ${files.slice(0, 3).join(', ')}`
})

console.log(`\n--- summary ---`)
console.log(`Hard failures: ${hardFails}`)
console.log(`Warnings:      ${warnings}`)
if (STRICT && warnings > 0) {
  console.log(`\nSTRICT MODE: warnings count as failures.`)
  process.exit(1)
}
if (hardFails > 0) {
  console.log(`\nAUDIT FAILED. Fix the issues above before pushing changes to brain spec files.`)
  process.exit(1)
}
console.log(`\nAudit clean. Pipeline state is healthy.`)
process.exit(0)
