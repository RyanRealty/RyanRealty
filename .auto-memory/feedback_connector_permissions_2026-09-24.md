# Connectors: always allow (Matt 2026-09-24)

Matt: "these should always be set to always allow for minimum interruption" (the claude.ai
connectors used in cloud sessions).

- Two layers decide whether a connector call interrupts Matt. Layer 1 is the connector's tool
  permissions at claude.ai/customize/connectors, on Matt's account; an agent cannot change it. A
  tool on "Needs approval" there prompts on every call, even in auto mode, whatever the repo
  allows. Layer 2 is `.claude/settings.json` `permissions`: `mcp__<Server>__*` in `allow` lets a
  call skip the auto-mode classifier.
- Default for every connected connector: Always allow in both layers.
- The only exceptions: tools that message a real person (CLAUDE.md §1), spend money, or take
  production offline. Gmail `send_message` / `reply` / `forward`, Calendar `respond_to_event`,
  Drive `share_file`, Vercel `buy_*` / `create_or_transfer_domain` / `pause_project`, Supabase
  `create_project` / `pause_project` / `restore_project` / `delete_branch`, Era Context
  `billing__upgrade` / `billing__confirm_*` / `billing__uncancel_subscription` (spend),
  `connections__disconnect_institution` (can't be undone) and `knowledge__remember` (a fact saved
  in a third-party app). They stay "Needs approval" (layer 1) and `ask` (layer 2), so Matt's one
  tap is the approval.
- Supabase `execute_sql` and `apply_migration` are ALLOWED: the connector is on Always allow and
  Matt said to use it (`feedback_sql_access_2026-09-24.md`). He confirmed that again when PR
  #360 merged main, overriding an earlier `execute_sql` deny in that PR.
- Write `ask` and `deny` rules as `mcp__*<Server>__<tool>` globs. Sessions that fetch claude.ai
  connectors themselves name tools `mcp__claude_ai_<Server>__<tool>`, so an exact cloud name
  leaves the rule open there.
- An agent cannot write its own permission rules: the auto-mode classifier refuses an edit to
  `.claude/settings.json` that widens permissions or registers hooks ("Self-Modification", seen
  2026-09-24). Put the exact diff in front of Matt and apply it only on his explicit go-ahead.
- Notion and Era Context were added on Matt's approval of the exact diff ("Just get them all
  going", then "Apply as shown", 2026-09-24). Era Context says money movement is coming; the day
  it ships such a tool, put it in `ask`.
- Adding a connector: add `mcp__<Server>__*` to `allow` and its send, publish and spend tools to
  `ask` in the same change.
- Full write-up: `docs/CLOUD_ENVIRONMENT_SETUP.md` section 6.
