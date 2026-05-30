#!/usr/bin/env node
// .claude/hooks/__tests__/pre-tool-use.test.mjs
//
// Runtime hook tests. Drives every refusal in
// `.claude/hooks/pre-tool-use.mjs` by piping a representative
// PreToolUse payload to the hook and asserting:
//   - it exits 0 (per spec — the hook always exits 0)
//   - it writes a `permissionDecision: "deny"` JSON to stdout
//   - the reason string carries the expected rule code
//
// Also tests that benign tool calls pass through without a deny.
//
// Run via:
//   node .claude/hooks/__tests__/pre-tool-use.test.mjs

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const HOOK = resolve(__dirname, '..', 'pre-tool-use.mjs')
const PROJECT = resolve(__dirname, '..', '..', '..')

let pass = 0
let fail = 0
const failures = []

function run(name, payload, expect) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
  })
  let decision = null
  try {
    const out = JSON.parse(r.stdout || '{}')
    decision = out?.hookSpecificOutput?.permissionDecision || null
  } catch {
    /* no JSON — treated as approve */
  }
  const reason = (() => {
    try {
      return JSON.parse(r.stdout || '{}')?.hookSpecificOutput?.permissionDecisionReason ?? ''
    } catch {
      return ''
    }
  })()

  if (expect.deny) {
    const ok = decision === 'deny' && reason.includes(expect.contains)
    if (ok) {
      pass++
      console.log(`  ✓ ${name}`)
    } else {
      fail++
      const err = `[FAIL] ${name}: expected deny w/ "${expect.contains}", got decision=${decision}, reason=${reason.slice(0, 120)}`
      failures.push(err)
      console.error('  ✗', err)
    }
  } else {
    const ok = decision !== 'deny'
    if (ok) {
      pass++
      console.log(`  ✓ ${name}`)
    } else {
      fail++
      const err = `[FAIL] ${name}: expected approve, got deny: ${reason.slice(0, 120)}`
      failures.push(err)
      console.error('  ✗', err)
    }
  }
}

console.log('PreToolUse hook tests')
console.log('=====================')

// ── Bash destructive ──────────────────────────────────────────────────
run(
  'Bash: rm -rf is denied',
  { tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/build' } },
  { deny: true, contains: 'BASH-DESTRUCTIVE' },
)
run(
  'Bash: rm -rf with allow-destructive bypass passes',
  { tool_name: 'Bash', tool_input: { command: 'rm -rf out/tmp # allow-destructive: cleaning render scratch' } },
  { deny: false },
)
run(
  'Bash: git push --force is denied',
  { tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } },
  { deny: true, contains: 'BASH-DESTRUCTIVE' },
)
run(
  'Bash: git reset --hard is denied',
  { tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~5' } },
  { deny: true, contains: 'BASH-DESTRUCTIVE' },
)
run(
  'Bash: psql is denied',
  { tool_name: 'Bash', tool_input: { command: 'psql -h db.x.supabase.co -U postgres' } },
  { deny: true, contains: 'BASH-DB-CLI' },
)
run(
  'Bash: pg_dump is denied',
  { tool_name: 'Bash', tool_input: { command: 'pg_dump -d ryanrealty > backup.sql' } },
  { deny: true, contains: 'BASH-DB-CLI' },
)
run(
  'Bash: --no-verify is denied',
  { tool_name: 'Bash', tool_input: { command: 'git commit -m "fix" --no-verify' } },
  { deny: true, contains: 'BASH-NO-VERIFY' },
)
run(
  'Bash: normal command passes',
  { tool_name: 'Bash', tool_input: { command: 'npm test' } },
  { deny: false },
)

// ── execute_sql schema discovery ──────────────────────────────────────
run(
  'execute_sql: information_schema discovery is denied',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: { query: 'SELECT column_name FROM information_schema.columns WHERE table_name=$1' },
  },
  { deny: true, contains: 'SQL-SCHEMA-DISCOVERY' },
)
run(
  'execute_sql: pg_catalog discovery is denied',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: { query: 'SELECT * FROM pg_catalog.pg_tables' },
  },
  { deny: true, contains: 'SQL-SCHEMA-DISCOVERY' },
)
run(
  'execute_sql: -- audit: bypass on info_schema passes',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: {
      query:
        '-- audit: confirming column "PropertyType" still exists after Spark feed change\nSELECT column_name FROM information_schema.columns WHERE table_name=\'listings\' LIMIT 5',
    },
  },
  { deny: false },
)
run(
  'execute_sql: _agent_schema_dump() RPC passes',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: { query: 'SELECT * FROM _agent_schema_dump() LIMIT 100' },
  },
  { deny: false },
)
run(
  'apply_migration: information_schema in DDL passes (migrations need it)',
  {
    tool_name: 'mcp__5adfee1a-x__apply_migration',
    tool_input: {
      query:
        "CREATE FUNCTION dump() RETURNS TABLE(c text) AS $$ SELECT column_name FROM information_schema.columns $$ LANGUAGE sql;",
    },
  },
  { deny: false },
)

// ── execute_sql DAL bypass ────────────────────────────────────────────
run(
  'execute_sql: raw SELECT on listing_tile_mv is denied (DAL covers it)',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: { query: "SELECT listing_key, list_price FROM listing_tile_mv WHERE city='Bend' LIMIT 10" },
  },
  { deny: true, contains: 'SQL-DAL-BYPASS' },
)
run(
  'execute_sql: raw SELECT on listings (DAL-covered) is denied',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: { query: 'SELECT "ListingKey", "ListPrice" FROM listings LIMIT 5' },
  },
  { deny: true, contains: 'SQL-DAL-BYPASS' },
)
run(
  'execute_sql: -- audit: bypass on DAL table passes',
  {
    tool_name: 'mcp__5adfee1a-x__execute_sql',
    tool_input: {
      query:
        "-- audit: spot-checking 5 rows of listing_tile_mv to debug a stale cache report\nSELECT listing_key, list_price FROM listing_tile_mv LIMIT 5",
    },
  },
  { deny: false },
)

// ── Write|Edit voice ──────────────────────────────────────────────────
run(
  'Write: banned word in user-facing JSX is denied',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/sell/page.tsx',
      content: 'export default function P() {\n  return <div>This stunning home awaits.</div>\n}',
    },
  },
  { deny: true, contains: 'WRITE-BRAND-VOICE' },
)
run(
  'Edit: banned word in components/site/* is denied',
  {
    tool_name: 'Edit',
    tool_input: {
      file_path: 'components/site/listing-detail/Hero.tsx',
      new_string: '<div>A truly breathtaking property.</div>',
    },
  },
  { deny: true, contains: 'WRITE-BRAND-VOICE' },
)
run(
  'Write: em-dash in user-facing JSX is denied',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/about/page.tsx',
      content: 'export default () => <p>Honest — direct — kind.</p>',
    },
  },
  { deny: true, contains: 'WRITE-BRAND-VOICE' },
)
run(
  'Write: em-dash as data placeholder passes',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/about/page.tsx',
      content: 'export default () => <dd>{"—"}</dd>',
    },
  },
  { deny: false },
)
run(
  'Write: != operator in a JSX expression is not flagged as an exclamation',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'components/site/Stat.tsx',
      content: 'export const Stat = ({ n }) => <div>{n != null ? <span>{n}</span> : null}</div>',
    },
  },
  { deny: false },
)
run(
  'Write: a real prose exclamation is still denied',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'components/site/Stat.tsx',
      content: 'export const Stat = () => <div>Sold over asking!</div>',
    },
  },
  { deny: true, contains: 'WRITE-BRAND-VOICE' },
)
run(
  'Write: banned word in API route is allowed (excluded)',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/api/foo/route.ts',
      content: 'export const dynamic = "force-dynamic"',
    },
  },
  { deny: false },
)
run(
  'Write: banned word in test file is allowed (excluded)',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'components/site/Hero.test.tsx',
      content: '// test: stunning is a banned word — verify the rule catches it',
    },
  },
  { deny: false },
)
run(
  'Write: next/dynamic import is allowed (import line skipped)',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'components/site/Map.tsx',
      content: "import dynamic from 'next/dynamic'\nexport const Map = dynamic(() => import('./MapClient'))",
    },
  },
  { deny: false },
)

// ── Write parity check ────────────────────────────────────────────────
run(
  'Write: new app/<route>/page.tsx without parity.json is denied',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/some-new-route/page.tsx',
      content: 'export default () => <div>hi</div>',
    },
  },
  { deny: true, contains: 'PAGE-PARITY-MISSING' },
)
run(
  'Write: new app/<route>/page.tsx with @no-parity opt-out passes',
  {
    tool_name: 'Write',
    tool_input: {
      file_path: 'app/some-new-route/page.tsx',
      content: '// @no-parity — utility route, no mockup\nexport default () => <div>hi</div>',
    },
  },
  { deny: false },
)

// ── ALLOW_ALL_HOOKS=1 bypass ──────────────────────────────────────────
{
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /tmp' },
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT, ALLOW_ALL_HOOKS: '1' },
  })
  let decision = null
  try {
    decision = JSON.parse(r.stdout || '{}')?.hookSpecificOutput?.permissionDecision || null
  } catch {
    /* */
  }
  if (decision !== 'deny') {
    pass++
    console.log('  ✓ ALLOW_ALL_HOOKS=1 disables all refusals')
  } else {
    fail++
    failures.push('[FAIL] ALLOW_ALL_HOOKS=1 should disable refusals')
    console.error('  ✗ ALLOW_ALL_HOOKS=1 did NOT bypass')
  }
}

console.log('')
console.log(`Pass: ${pass} · Fail: ${fail}`)
if (fail > 0) {
  console.error('')
  for (const f of failures) console.error(f)
  process.exit(1)
}
process.exit(0)
