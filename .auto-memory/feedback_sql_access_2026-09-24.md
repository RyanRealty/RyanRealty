# Database access: never pause for approval (Matt 2026-09-24)

Matt: "You always have access. Don't stop to ask for SQL access." / "You are still asking for sql
permissions you always have permission."

- The prompts Matt saw came from the claude.ai **Supabase connector**, whose per-call approval lands
  on Matt's phone (`execute_sql`, then `query_logs` from a subagent). Matt: "Please stop asking",
  then "you have api access to supabase can you not use that instead of always prompting me". So
  `.claude/settings.json` **denies every Supabase connector tool except `apply_migration`** for
  every session and subagent in this repo. Do not re-allow them, and do not tell a subagent to use
  any `mcp__Supabase__*` tool.
- **Do database work through the repo's service-role client from the terminal instead**: a tsx
  script (`scripts/…` or a scratch `scripts/zz-*.ts`, excluded from git) using
  `createServiceClient()` from `@/lib/supabase/service`, run with `npx tsx`. It needs no approval
  and goes through the same DAL rules. Migrations are the one exception: DDL has no service-role
  path here (no database URL or access token in the environment), so `apply_migration` stays the
  connector. Batch every pending migration into ONE call so Matt sees at most one prompt, until he
  sets that tool to "Always allow" at claude.ai/customize/connectors.
- The repo's own `pre-tool-use` hook refusing an aggregate over a stat table is CLAUDE.md §0, not
  a permission: use a row read or the DAL function, and keep going.
