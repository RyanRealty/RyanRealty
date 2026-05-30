#!/usr/bin/env node
// .claude/hooks/pre-tool-use.mjs
//
// G-runtime — Claude Code PreToolUse hook. The runtime layer of the
// unified enforcement architecture. Returns `permissionDecision:
// "deny"` to refuse tool calls that violate the six rule classes
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
//   5. Write|Edit — refuse edits to `app/<route>/page.tsx` when the
//      matching `design_system/ryan-realty/ui_kits/<route>/parity.json`
//      mockup contract does not exist on disk.
//   6. Write|Edit — refuse edits whose content contains banned-voice
//      tokens (em-dash, en-dash, semicolon, exclamation, §6.2 banned
//      words) inside user-facing paths.
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
//     SQL to allow a raw read past the DAL boundary.
//   - Write|Edit voice refusals: include `// brand-voice:exempt`
//     ONE LINE ABOVE the banned token (escape hatch for code
//     references like `import dynamic from 'next/dynamic'` — but
//     check-brand-voice.mjs already skips import lines).
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

// ─── Lazy-load the banned-vocabulary list ────────────────────────────

let VOCAB = null
function getVocab() {
  if (VOCAB) return VOCAB
  try {
    VOCAB = require(join(projectRoot, 'scripts/brand-voice-vocabulary.cjs'))
  } catch {
    VOCAB = { PUNCTUATION: [], BANNED_WORD_STRINGS: [] }
  }
  return VOCAB
}

// ─── Lazy-load the schema snapshot to find DAL-covered tables ────────

let DAL_TABLES = null
function getDalCoveredTables() {
  if (DAL_TABLES) return DAL_TABLES
  // Tables a DAL function reads. Extracted from docs/DAL_INDEX.md
  // reverse-index — but parsed lazily from the file at hook time so a
  // newly-added DAL function gets honored without a redeploy.
  try {
    const md = readFileSync(join(projectRoot, 'docs/DAL_INDEX.md'), 'utf8')
    // Pull `Tables:` lines + reverse-index table column.
    const tables = new Set()
    const tableLineRe = /^\*\*Tables:\*\* (.+)$/gm
    let m
    while ((m = tableLineRe.exec(md))) {
      const list = m[1]
      for (const tok of list.split(',')) {
        const name = tok.trim().replace(/^`|`$/g, '')
        if (name) tables.add(name)
      }
    }
    DAL_TABLES = tables
  } catch {
    DAL_TABLES = new Set()
  }
  return DAL_TABLES
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
    const dalTables = getDalCoveredTables()
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
}

// ─── Refusal 5+6: Write|Edit — parity contract + brand voice ─────────

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

    // Refusal 6: brand-voice in user-facing surfaces.
    //
    // Apply only to user-facing JSX-bearing files. The CI script
    // scripts/check-brand-voice.mjs is the authoritative gate; this
    // hook fires earlier (at edit time) on obvious banned tokens so
    // the agent doesn't write the banned word in the first place.
    const isUserFacingPath =
      /^app\//.test(stripRoot(filePath, projectRoot)) ||
      /^components\/(site|listing|search|reports|listing-detail)/.test(
        stripRoot(filePath, projectRoot),
      )
    const isCodeOnly =
      /\/(api|admin|cron)\//.test(filePath) ||
      filePath.endsWith('.test.ts') ||
      filePath.endsWith('.test.tsx') ||
      filePath.endsWith('.spec.ts')

    if (isUserFacingPath && !isCodeOnly && newContent) {
      // Only scan content that's actually user-facing: string literals
      // and JSX text between tags. Code identifiers (`dynamic(...)`,
      // function names, type names) and comments are NOT user-facing
      // and trigger false positives if we scan raw source.
      const scannable = extractContent(newContent)
      const vocab = getVocab()

      // Punctuation — em-dash etc.
      for (const p of vocab.PUNCTUATION || []) {
        for (const chunk of scannable) {
          if (!chunk.text.includes(p.char)) continue
          // Exclamation false-positive: the `!=` / `!==` comparison operators
          // are JS code, not prose punctuation. A JSX expression container
          // (`{a != null ? ... : ...}`) is sometimes extracted as a chunk, so
          // skip when every `!` in the chunk is part of `!=` (no prose `!`).
          if (p.char === '!' && !/!(?!=)/.test(chunk.text)) continue
          // Standalone data-placeholder em-dash is allowed (e.g.
          // `<dd>{"—"}</dd>` or a JSX text node whose trimmed value
          // is just `"—"`).
          if (chunk.text.trim() === p.char) continue
          deny(
            'WRITE-BRAND-VOICE',
            `Banned punctuation ${p.label} in user-facing file ${filePath}\n   In: "${chunk.text.slice(0, 80)}"`,
            `${p.advice} The ESLint rule rr-brand-voice/no-violations + CI gate G3 catch this at build time — fix it here in the editor.`,
          )
        }
      }
      // Banned words — word-boundary match against the scannable content.
      for (const word of vocab.BANNED_WORD_STRINGS || []) {
        const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
        for (const chunk of scannable) {
          if (!re.test(chunk.text)) continue
          deny(
            'WRITE-BRAND-VOICE',
            `Banned word "${word}" in user-facing file ${filePath}\n   In: "${chunk.text.slice(0, 80)}"`,
            'See CLAUDE.md §3 + marketing_brain_skills/brand-voice/voice_guidelines.md §6. Rewrite without the banned token. Use the real number / concrete fact instead of the vague qualifier.',
          )
        }
      }
    }
  }
}

approve()

// ─── Helpers ─────────────────────────────────────────────────────────

function stripRoot(path, root) {
  return path.startsWith(root + '/') ? path.slice(root.length + 1) : path
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Heuristic — does this chunk look like JavaScript / TypeScript code
// rather than user-facing JSX text? The `>` / `<` extractor frequently
// catches JS expressions between a TS generic (`React.TouchEvent>`) and
// a less-than operator (`if (a < b)`) and treats the JS code in between
// as JSX text. Those chunks contain unmistakable code markers:
//   - arrow function `=>`
//   - statement terminator `;`
//   - `const`/`let`/`var`/`function`/`return` keywords
//   - `useState/useEffect/useCallback/useMemo/useRef` React hooks
//   - object property `: ` followed by capitalised type name
// A chunk that contains any of these is JS, not JSX text — skip it so
// `!==`, `&&`, etc. don't fire the punctuation rule.
function looksLikeJsCode(text) {
  if (/=>/.test(text)) return true
  if (/;\s*$/.test(text)) return true
  if (/\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|throw|try|catch|finally|new|typeof|instanceof|in|of)\b/.test(text)) return true
  if (/\buse(State|Effect|Callback|Memo|Ref|Context|Reducer|Layout(?:Effect)?)\b/.test(text)) return true
  if (/[a-z]\([^)]*\)\s*[{=]/.test(text)) return true
  return false
}

// Pull "content" chunks from source: string literals (single, double,
// backtick) and JSX text between tags. Skip line + block comments and
// import lines so code identifiers like `dynamic(...)` don't false-
// positive against the brand-voice vocabulary. Returns an array of
// `{ type, text }` chunks.
function extractContent(src) {
  const chunks = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    // Skip line comment.
    if (ch === '/' && src[i + 1] === '/') {
      const eol = src.indexOf('\n', i)
      i = eol === -1 ? src.length : eol
      continue
    }
    // Skip block comment.
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    // Skip whole import line.
    if (i === 0 || src[i - 1] === '\n') {
      const restOfLine = src.slice(i, src.indexOf('\n', i) === -1 ? src.length : src.indexOf('\n', i))
      if (/^\s*import\s/.test(restOfLine) || /^\s*export\s+.*\bfrom\s/.test(restOfLine)) {
        const eol = src.indexOf('\n', i)
        i = eol === -1 ? src.length : eol
        continue
      }
    }
    // String literal.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      const start = ++i
      let val = ''
      while (i < src.length) {
        const c = src[i]
        if (c === '\\') {
          val += c + (src[i + 1] || '')
          i += 2
          continue
        }
        if (c === quote) {
          chunks.push({ type: 'string', text: val })
          i++
          break
        }
        // Skip template literal interpolations.
        if (quote === '`' && c === '$' && src[i + 1] === '{') {
          let depth = 1
          i += 2
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            i++
          }
          continue
        }
        val += c
        i++
      }
      continue
    }
    // JSX text — between `>` and `<`. Strip JSX expression containers
    // (`{...}`) because those are JS code (data placeholders,
    // computed values, etc.), not literal user-facing text. The
    // string literals inside the expression containers are already
    // captured by the string-literal branch above.
    if (ch === '>') {
      const nextLt = src.indexOf('<', i + 1)
      if (nextLt > i + 1) {
        const raw = src.slice(i + 1, nextLt)
        const text = raw.replace(/\{[^{}]*\}/g, '').trim()
        if (text.length > 0 && !looksLikeJsCode(text)) {
          chunks.push({ type: 'jsx-text', text })
        }
        i = nextLt
        continue
      }
    }
    i++
  }
  return chunks
}
