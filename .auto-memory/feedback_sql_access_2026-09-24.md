# Database access: never pause for approval (Matt 2026-09-24)

Matt: "You always have access. Don't stop to ask for SQL access." / "You are still asking for sql
permissions you always have permission."

- The prompts Matt saw came from the claude.ai **Supabase connector** (`mcp__Supabase__execute_sql`),
  whose per-call approval is set at claude.ai/customize/connectors, not in this repo. The repo's
  `.claude/settings.json` already allows it.
- **Do database work through the repo's service-role client from the terminal instead**: a tsx
  script (`scripts/…` or a scratch `scripts/zz-*.ts`, excluded from git) using
  `createServiceClient()` from `@/lib/supabase/service`, run with `npx tsx`. It needs no approval
  and goes through the same DAL rules. Migrations: `apply_migration` is still the connector; batch
  them into one call, or run the SQL through a script when the connector would prompt.
- The repo's own `pre-tool-use` hook refusing an aggregate over a stat table is CLAUDE.md §0, not
  a permission: use a row read or the DAL function, and keep going.
