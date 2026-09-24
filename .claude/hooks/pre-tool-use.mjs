#!/usr/bin/env node
// .claude/hooks/pre-tool-use.mjs
//
// G-runtime — Claude Code PreToolUse hook. The runtime layer of the
// unified enforcement architecture. Returns `permissionDecision:
// "deny"` to refuse tool calls that violate the five rule classes
// inventoried at out/guardrail-inventory-2026-05-28.md. The agent
// sees the refusal reason and must comply.
//
// Refusal matrix (each prints "blocked: rule X — fix is Y"):
//
//   1. Bash — refuse rm -rf, git push --force, git reset --hard,
//      psql, pg_dump, raw GitHub force-merge invocations.
//   2. Bash — refuse direct DB CLI access (psql / pg_dump / supabase
//      db reset) where ad-hoc data inspection is intended.
//   3. mcp__*__execute_sql — refuse queries against information_schema
//      or pg_catalog (the snapshot has that data already).
//   4. mcp__*__execute_sql — refuse SELECTs against tables a DAL
//      function covers, unless the SQL carries an explicit `-- audit:`
//      comment justifying the raw read.
//   4b. mcp__*__execute_sql — refuse AGGREGATES (count/sum/avg/min/max/
//      median/percentile/GROUP BY) over a stat-bearing table even WITH an
//      `-- audit:` comment. An aggregate over a filtered window is a
//      statistic, and statistics come from the DAL. `-- audit:` keeps
//      licensing targeted row reads, which is what it was for.
//   5. Write|Edit — refuse edits to `app/<route>/page.tsx` when the
//      matching `design_system/ryan-realty/ui_kits/<route>/parity.json`
//      mockup contract does not exist on disk.
//
// The decisions are structured as `{hookSpecificOutput: {hookEventName,
// permissionDecision, permissionDecisionReason}}` per the Claude Code
// PreToolUse hook spec. Exit 0 with the JSON. Stdout is the channel.
//
// Bypass mechanisms (each surfaces the bypass in stderr for audit):
//   - Bash refusals: include `# allow-destructive: <reason>` in the
//     command to override (rare; only for confirmed user-approved
//     destructive ops).
//   - execute_sql refusals: include `-- audit: <reason>` in the
//     SQL to allow a raw ROW read past the DAL boundary. It does NOT
//     license an aggregate over a stat-bearing table — that has no
//     bypass, because a stat has exactly one legitimate source.
//
// To disable the entire hook (e.g., emergency unblock):
//   ALLOW_ALL_HOOKS=1
//
// Tests live at .claude/hooks/__tests__/pre-tool-use.test.mjs.

import { existsSync, readFileSync } from 'node:fs'
import { resolve, basename, dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ─── Read the proposed tool call from stdin ──────────────────────────

let input = ''
try {
  input = readFileSync(0, 'utf8')
} catch {
  // Stdin not available — pass through.
  approve()
}

let payload
try {
  payload = JSON.parse(input)
} catch {
  // Malformed payload — pass through; the runtime will report.
  approve()
}

const { tool_name = '', tool_input = {} } = payload
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()

if (process.env.ALLOW_ALL_HOOKS === '1') {
  approve()
}

// ─── Refusal helpers ─────────────────────────────────────────────────

function deny(rule, reason, fix) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[${rule}] ${reason}\n→ Fix: ${fix}`,
    },
  }
  process.stdout.write(JSON.stringify(out))
  process.exit(0)
}

function approve() {
  process.exit(0)
}

// ─── The ONE definition of a statistic ───────────────────────────────
//
// scripts/stat-tables.cjs is required lazily below. A stat is an aggregate over a table the DAL covers, and the
// covered set is parsed from docs/DAL_INDEX.md, which G16 regenerates from
// the code. No list is kept here, because keeping one here is how the hook
// and the CI gate drift apart.

let STATS = null
function getStats() {
  if (STATS) return STATS
  try {
    STATS = require(join(projectRoot, 'scripts/stat-tables.cjs'))
  } catch {
    STATS = null
  }
  return STATS
}

// ─── Refusal 1+2: Bash destructive + DB CLI ──────────────────────────

if (tool_name === 'Bash') {
  const cmd = String(tool_input.command || '')

  // Explicit bypass — must reference user-approval reason on the same line.
  const bypass = /#\s*allow-destructive:/i.test(cmd)

  if (!bypass) {
    // rm -rf / rm -fr / find -delete
    if (/\brm\s+-(rf|fr|rR|Rf|RF)\b/.test(cmd) || /find\s+[^|;]*-delete\b/.test(cmd)) {
      deny(
        'BASH-DESTRUCTIVE',
        `Bash \`rm -rf\` / \`find -delete\` are refused. Output: ${cmd.slice(0, 120)}`,
        'Specify file paths individually with `rm <file>`, OR if the destruction is truly required, append `# allow-destructive: <reason>` to the command and re-issue.',
      )
    }
    // git push --force / --force-with-lease without target
    if (/\bgit\s+push\b[^#]*--force(\s|$|--)/.test(cmd) || /\bgit\s+push\b[^#]*-f(\s|$)/.test(cmd)) {
      deny(
        'BASH-DESTRUCTIVE',
        `Force-pushing is refused. Output: ${cmd.slice(0, 120)}`,
        'Push without --force. If the upstream history truly needs rewriting, append `# allow-destructive: <reason>` to the command and re-issue.',
      )
    }
    // git reset --hard
    if (/\bgit\s+reset\s+--hard\b/.test(cmd)) {
      deny(
        'BASH-DESTRUCTIVE',
        `\`git reset --hard\` is refused. Output: ${cmd.slice(0, 120)}`,
        'Use `git restore <file>` or `git checkout <branch>` to avoid losing uncommitted work. If the discard is intended, append `# allow-destructive: <reason>` to the command.',
      )
    }
    // psql / pg_dump / supabase db reset
    if (/\bpsql\b/.test(cmd) || /\bpg_dump\b/.test(cmd) || /\bsupabase\s+db\s+reset\b/.test(cmd)) {
      deny(
        'BASH-DB-CLI',
        `Direct Postgres CLI is refused. Output: ${cmd.slice(0, 120)}`,
        'Read docs/DATABASE_SCHEMA_SNAPSHOT.md for schema questions. For real queries, use a DAL function or `mcp__*__execute_sql` with a `-- audit:` comment.',
      )
    }
    // git commit --no-verify / git push --no-verify
    if (/--no-verify\b/.test(cmd)) {
      deny(
        'BASH-NO-VERIFY',
        `\`--no-verify\` (bypassing git hooks) is refused. Output: ${cmd.slice(0, 120)}`,
        'Fix what the hook flags. The hooks exist because they catch real regressions. If a hook is genuinely broken, fix the hook itself.',
      )
    }
  }
}

// ─── Refusal 3+4: execute_sql — info_schema + DAL-covered tables ─────

if (/__execute_sql$/.test(tool_name) || /__apply_migration$/.test(tool_name)) {
  const sql = String(tool_input.query || tool_input.sql || '')
  const sqlLower = sql.toLowerCase()
  const hasAuditComment = /--\s*audit:/i.test(sql)

  // Refusal 3: information_schema / pg_catalog discovery.
  if (
    /\binformation_schema\b/i.test(sqlLower) ||
    /\bpg_catalog\b/i.test(sqlLower) ||
    /\bpg_class\b/i.test(sqlLower) ||
    /\bpg_attribute\b/i.test(sqlLower) ||
    /\bpg_matviews\b/i.test(sqlLower)
  ) {
    // Schema-dump function and migrations are allowed.
    const isSchemaDumpFn = /_agent_schema_dump\s*\(/i.test(sqlLower)
    const isMigration = /__apply_migration$/.test(tool_name)
    if (!isSchemaDumpFn && !isMigration && !hasAuditComment) {
      deny(
        'SQL-SCHEMA-DISCOVERY',
        `Schema-discovery SQL is refused. Snippet: ${sql.slice(0, 160)}`,
        'Read docs/DATABASE_SCHEMA_SNAPSHOT.md (auto-generated, 129 tables / 1820 columns). It carries every column name + type — no need to query information_schema. If a real audit is required, prepend `-- audit: <reason>` to the SQL.',
      )
    }
  }

  // Refusal 4: SELECT against a DAL-covered table without -- audit:.
  if (!hasAuditComment) {
    const dalTables = getStats()?.getDalCoveredTables(projectRoot) ?? new Set()
    if (dalTables.size > 0) {
      const fromMatches = [...sqlLower.matchAll(/\bfrom\s+([a-z_][a-z_0-9]*)/g)].map((m) => m[1])
      for (const t of fromMatches) {
        if (dalTables.has(t)) {
          deny(
            'SQL-DAL-BYPASS',
            `Raw SQL against \`${t}\` is refused. A DAL function covers this access pattern. Snippet: ${sql.slice(0, 160)}`,
            `Use the DAL function for \`${t}\` (see docs/DAL_INDEX.md). If a one-off audit query is required, prepend \`-- audit: <reason>\` to the SQL.`,
          )
        }
      }
    }
  }

  // Refusal 4b: an AGGREGATE over a DAL-covered table. No bypass.
  //
  // Matt, 2026-08-26: "all stats shoule come through one process, enforce
  // this." The `-- audit:` escape above is honor-system, and in one session it
  // computed inventory counts, closed-sale counts by property sub type, CMA
  // draft/delivery ratios and comp-pool depths. Those are statistics. They
  // informed product decisions and were quoted in commit messages and a
  // cross-agent handoff, having passed neither the DAL nor the caches it reads.
  //
  // The distinction that makes it enforceable:
  //   - a data-quality check is a targeted ROW read ("show me this row", "does
  //     this key exist"). That is what `-- audit:` is for, and it keeps working.
  //   - a STAT is an AGGREGATE over a filtered window, and it has exactly one
  //     legitimate source: the DAL.
  //
  // What counts as a stat table is NOT decided here — scripts/stat-tables.cjs
  // is the one definition, and it reads the generated docs/DAL_INDEX.md. The
  // CI gate for scripts/ requires the same file, so the two cannot disagree.
  //
  // `apply_migration` is exempt on purpose: the DDL that builds a cache or a
  // materialized view HAS to aggregate the base tables. That DDL *is* the one
  // process; this rule keeps everything else out of it.
  if (!/__apply_migration$/.test(tool_name)) {
    const stats = getStats()
    if (stats) {
      const dalTables = stats.getDalCoveredTables(projectRoot)
      const hit = stats.sqlAggregatesDalTable(sql, dalTables)
      if (hit) {
        deny(
          'SQL-STAT-BYPASS',
          `Aggregate SQL over \`${hit}\` is refused — an aggregate over a filtered window is a STATISTIC, and \`-- audit:\` does not license one. Snippet: ${sql.slice(0, 160)}`,
          `Stats come through one process: the DAL. Use the function that owns \`${hit}\` — the reverse index at the bottom of docs/DAL_INDEX.md names it. \`-- audit:\` still covers a targeted ROW read on \`${hit}\` (show me this row, does this key exist), so drop the aggregate and it passes. If the figure has no DAL function yet, add one under lib/data/ and call it (CLAUDE.md §0 + §7.6).`,
        )
      }
    }
  }
}

// ─── Refusal 5: Write|Edit — parity contract ─────────────────────────

if (tool_name === 'Write' || tool_name === 'Edit' || tool_name === 'MultiEdit') {
  const filePath = String(tool_input.file_path || tool_input.path || '')
  const newContent = String(
    tool_input.new_string || tool_input.content || tool_input.new_content || '',
  )

  if (filePath) {
    // Refusal 5: new app/<route>/page.tsx must have a parity.json contract.
    const pageMatch = /^app\/(.+?)\/page\.tsx?$/.exec(
      filePath.startsWith(projectRoot) ? filePath.slice(projectRoot.length + 1) : filePath,
    )
    if (pageMatch && tool_name === 'Write' && !existsSync(filePath)) {
      // NEW page being created. Require a matching parity contract OR an
      // explicit @no-parity comment in the file content.
      const route = pageMatch[1]
      const parityPath = join(
        projectRoot,
        'design_system/ryan-realty/ui_kits',
        route,
        'parity.json',
      )
      const hasOptOut = /\/\/\s*@no-parity\b/.test(newContent)
      if (!existsSync(parityPath) && !hasOptOut) {
        deny(
          'PAGE-PARITY-MISSING',
          `Creating ${pageMatch[0]} but no mockup parity contract at design_system/ryan-realty/ui_kits/${route}/parity.json`,
          `Either (a) drop the mockup at design_system/ryan-realty/ui_kits/${route}/index.html + parity.json before writing the page (matches the Wave 3 mockup-driven rebuild discipline), OR (b) add a top-of-file comment \`// @no-parity\` if this page genuinely doesn't have a mockup contract (rare — almost every public route in EXECUTION_PLAN.md §3 must have one).`,
        )
      }
    }
  }
}

approve()
