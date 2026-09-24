# Database access: never pause for approval (Matt 2026-09-24)

Matt: "You always have access. Don't stop to ask for SQL access." / "You are still asking for sql
permissions you always have permission." Later the same day: "ok i updated my supabase connector to
always allow so if thats easier lets use it and not do the one off thing we did earlier".

- The claude.ai **Supabase connector** is set to **Always allow** at claude.ai/customize/connectors,
  so its calls no longer raise an approval on Matt's phone. Use it: `execute_sql` for data-quality
  reads (with the `-- audit:` comment the repo hook wants) and `apply_migration` for DDL.
  `.claude/settings.json` allows the read tools plus `execute_sql` and `apply_migration`; tools
  that could pause the project, restore it or delete a branch are deliberately not pre-allowed.
- Earlier the same day, before Matt changed that setting, every connector tool was briefly denied
  and reads went through service-role tsx scripts. That was the "one off thing"; Matt asked to drop
  it. A service-role script (`createServiceClient()` from `@/lib/supabase/service`, wrapped in an
  async `main()`, with `installServerOnlyShim()` from `scripts/lib/server-only-shim.cjs`) is still
  fine when a script is the natural tool, but it is not required.
- Never stop mid-task to ask Matt for database access, and never tell him a DB step is blocked on
  permission. If a connector call is refused, say what was refused and use a service-role script.
- The repo's own `pre-tool-use` hook refusing an aggregate over a stat table is CLAUDE.md §0, not
  a permission: use a row read or the DAL function, and keep going.
