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
  `create_project` / `pause_project`. They stay "Needs approval" (layer 1) and `ask` (layer 2),
  so Matt's one tap is the approval.
- `mcp__Supabase__execute_sql` stays DENIED (`feedback_sql_access_2026-09-24.md`). Always-allow
  does not reopen it.
- An agent cannot write its own permission rules: the auto-mode classifier refuses an edit to
  `.claude/settings.json` that widens permissions or registers hooks ("Self-Modification", seen
  2026-09-24). Put the exact diff in front of Matt and apply it only on his explicit go-ahead.
- Adding a connector: add `mcp__<Server>__*` to `allow` and its send, publish and spend tools to
  `ask` in the same change.
- Full write-up: `docs/CLOUD_ENVIRONMENT_SETUP.md` section 6.
