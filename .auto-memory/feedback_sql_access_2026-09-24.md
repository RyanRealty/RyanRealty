# Database access: never pause for approval (Matt 2026-09-24)

Matt: "You always have access. Don't stop to ask for SQL access." / "You are still asking for sql
permissions you always have permission."

- The prompts Matt saw came from the claude.ai **Supabase connector**, whose per-call approval lands
  on Matt's phone (`execute_sql`, then `query_logs` from a subagent). Matt: "Please stop asking",
  "you have api access to supabase can you not use that instead of always prompting me", then
  "Stop asking me". So `.claude/settings.json` **denies every Supabase connector tool, including
  `apply_migration`**, for every session and subagent in this repo. Do not re-allow any of them,
  and do not tell a subagent to use any `mcp__Supabase__*` tool.
- **Do database work through the repo's service-role client from the terminal instead**: a tsx
  script (`scripts/…` or a scratch `scripts/zz-*.ts`, excluded from git) using
  `createServiceClient()` from `@/lib/supabase/service`, run with `npx tsx`. It needs no approval
  and goes through the same DAL rules. Migrations (DDL) have no service-role path. They run with
  `SUPABASE_DB_HOST` / `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD` through `pg` (see
  `scripts/apply-sql-function.mjs`): on Matt's machine from `.env.local`, in a cloud session only
  once those three are set as environment variables in the cloud environment's settings. Until
  then a migration waits, recorded as pending in the handoff; it never goes through the connector.
- The repo's own `pre-tool-use` hook refusing an aggregate over a stat table is CLAUDE.md §0, not
  a permission: use a row read or the DAL function, and keep going.
