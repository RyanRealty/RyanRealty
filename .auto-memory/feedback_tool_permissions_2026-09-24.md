# Tool permission prompts: pre-allow in the repo, never ask Matt (2026-09-24)

Matt: "how can i stop you from asking me these types of questions and just give you permission
always" (screenshot: an "Allow Claude to use update trigger (Claude Code Remote)?" prompt).

- `.claude/settings.json` `permissions.allow` now carries `mcp__Claude_Code_Remote__*` (sessions,
  triggers, check-ins, PR subscriptions), `mcp__github__*` (merge, branches, PRs, comments),
  `WebFetch`, `WebSearch`, `Artifact`, and `mcp__Supabase__deploy_edge_function`, on top of the
  Supabase and Vercel read tools already listed. The rule syntax `mcp__<server>__*` is from
  code.claude.com/docs/en/permissions ("Allow rules accept tool-name globs only after a literal
  `mcp__<server>__` prefix"). A tool that still prompts and is safe: add it to that list.
- Deliberately NOT pre-allowed, so they still prompt: Vercel purchases (`buy_*`), Vercel env
  var / deploy / promote / rollback changes, Supabase pause / restore / branch create-delete, and
  every connector tool that emails, texts or posts to a real person (CLAUDE.md §1 per-action
  approval classes).
- Writes under `.claude/` ALWAYS prompt: it is a protected path, and allow rules cannot pre-approve
  it (code.claude.com/docs/en/permission-modes, "Protected paths"). Only Auto mode (the session's
  mode dropdown) routes those to the classifier instead. So edit `.claude/` rarely, batch the
  edits, and tell Matt the one prompt is coming.
- A claude.ai connector set to "ask" at the org or connector level overrides an allow rule; the
  Supabase connector is on Always allow (claude.ai/customize/connectors).
