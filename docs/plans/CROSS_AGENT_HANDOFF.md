# Current — 2026-09-22 (Matt: another brokerage's phone stays off the listing)

Surface: Grok Build, primary checkout. A listing detail for a home that is not ours shows the listing brokerage name. The listing broker's phone, email, and personal name are not on that page. A Ryan Realty listing can still name our agent and our phone. Node: none.

**Rule for this file.** ONE `# Current` block. At session end, replace it (surface, SHA, what landed, what is next, skills read) and carry forward every still-open Matt directive; never stack a new one on top. `ci:handoff-current` fails a second `# Current`. Older blocks move verbatim to `docs/archive/`. Boot doc for "run the loop": `docs/RUN_LOOP.md`.

**Still open from the 51 blocks archived 2026-09-23** (each checked against the tree and `loop_work_nodes` on 2026-09-23 08:50Z; every other directive in those blocks is on the tree or its node is done, including SITE-153 and SITE-155, the 2026-09-22 header and dog directives):

- SITE-93 city, SITE-95 compare, SITE-104 neighborhood, SITE-112 subdivision: the work is on main (PR #253, merge `4d0905f5a`); each node is blocked only on a grok-4.6 rejudge to confirm `demoMatch`. Matt 2026-09-23 made `demoMatch` a recorded note, so each closes on the `docs/RUN_LOOP.md` §4 accept test with evidence from the live page. SITE-104's 375 shots predate the phone dock; SITE-112 also owes `/subdivisions/keystone-terrace`, 14px wider than a 375 screen (`.srch-chip-actions`).
- CMA letter `cma-20506-murphy` (Matt 2026-09-22: the home's own photo, evidence columns, alignment): built, not sent, `auto_send` off. Sending it is Matt's per-action yes (CLAUDE.md §1). No node.
- Content-floor re-seed proposed with SITE-119 (done): cities + community `sectionDepth.atlas.items` 8 to 4 once aria-hidden swatches stopped counting. Waiting on Matt's approval; no parity file carries `sectionDepth` yet. No node.

**Matt p0 nodes blocked on a person (from the work graph, not the archived blocks).** SITE-146 dog floater crop rematch #3: land `wt/site-146-20260920` @ `82dcaa345`; Matt's phone is the done gate. SITE-147 homepage "Central Oregon right now" pulse: land only `app/_v3/home-pulse.ts`, its test and the four pulse shots from `wt/site-147-20260920` @ `7c472ac5f`, never the full cherry-pick. SITE-63: Matt picks the contact fold (`design_system/public/references/contact-decision-sheet.html`).

**Standing holds.** No owner email from a land. CMA `auto_send` stays off. Do not reopen SITE-151/152 (Matt 2026-09-21). Matt dropped the typeahead city-to-place-page change (2026-09-19, "never mind"); a city pick still opens search results. Place-craft Tip Ready keeps the competitor first-look and map-drives-hierarchy locks (`ci:place-craft`, SITE-128).

**Graph at 2026-09-23 08:50Z (public-ux SITE nodes not done or killed): 34.** 24 blocked: 15 on dated measurement windows (SITE-01 to 12, 02b, 23, 32), SITE-186 and 187 on 28-day GSC windows, and the 7 on a person above. 2 in progress (SITE-184, 185, `cloud-grinder-2026-09-23-08`). 8 open GSC gaps (SITE-181, 182, 183, 188 to 192).

# Prior

Every earlier block is verbatim in `docs/archive/CROSS_AGENT_HANDOFF-2026-09-15-through-2026-09-22.md`
(2026-09-15 to 2026-09-22) and `docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md` (2026-06 to
2026-09-12). Read them only for a named SHA.
