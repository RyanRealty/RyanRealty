# Arming Runbook — from DISARMED to a running, visible, self-chaining loop

**State this assumes (true as of 2026-08-16 21:52 PT):** THE LOOP v1.6.0 infrastructure is built and shipped. Pre-arm items (Step 1) are live. Matt said **"Arm the loop"** — Phase 2 Step 3. `LOOP_SENTINEL=on` is set in Vercel production. Work graph: G1–G3 done, rest open. Register R-211 stays LOCKED (disarm still requires the word). No bots exist yet (Phase 3).

**Matt never touches a terminal.** Every step below is either a sentence Matt says in a Cursor chat, or clicks inside the Grok Bot app (the one surface only he has). The agent does everything else.

---

## Phase 1 — Pre-arm build (loop stays off; one agent session)

**Step 1. Say: "Build the pre-arm items."**
The session builds, ships, and screenshots the three items the plan calls for before anything runs unattended:
1. **`/admin/loop` status page** — is an iteration running now (and on what node), last ~10 completed nodes with one-line evidence, version progress, fleet findings inbox, ledger windows, sentinel launch log (count in 24h, no daily cap). Renders from the same rows agents mutate; no self-reported status anywhere.
2. **One-node-per-session chaining** — the sentinel prompt changes from "grind until blocked" to "complete ONE node, hand off, die." Fresh context per node; the zero-gap chain carries continuity.
3. **Orphan auto-release** — sentinel checks stale `in_progress` claims against the Cursor API; owner run terminal → node flips back to `open` automatically.

**DONE 2026-08-16.** `/admin/loop` renders live graph data (desktop + mobile screenshots, zero console errors). Sentinel prompt is one-node-per-session. Orphan auto-release is in the sentinel with tests. The loop is still off.

## Phase 2 — First light (an evening Matt is around, ~1 hour of glancing)

**Step 2. Open `ryan-realty.com/admin/loop` and bookmark it** (desktop and phone). This is the window into everything from now on.

**Step 3. Say: "Arm the loop."**
The session flips `LOOP_SENTINEL` to `on`, redeploys so it takes effect, proves the dry-run says `would launch`, and confirms the first agent boots. (R-211 stays in the register; its evidence cell gets the arm date.)

**DONE 2026-08-16 21:52 PT.** Matt said the word. `LOOP_SENTINEL=on` written to Vercel production. Bake deploy + first-boot proof are the rest of this session.

**Step 4. Watch 2–3 iterations on the status page.** Healthy looks like: node claimed → done with evidence in under ~2 hours; commits on main; deploy READY; next node claimed by a fresh agent within minutes. Anything looks wrong → say **"disarm the loop"** (kill switch back on within one session; running agent finishes or is canceled on request).

**Step 5. Decide overnight posture.** Default: leave it armed — one active agent at a time, no daily launch cap, no sends/posts/spend/OAuth ever. Or say "disarm until morning."

## Phase 3 — Bot fleet (separate gate; ~45 min of Matt clicking; loop keeps running either way)

**Step 6. Say: "Print the fleet secret."** (Any session prints it; it is never committed to a file.)

**Step 7. In the Grok Bot app, create the bots one at a time** — order: Walker Mobile, Walker Desktop, Money Path, Stats Truth, Regression Certifier, Flow Prover last (it submits real forms with the suppressed `fleet-test` identity). For each: new bot → paste its 3-line bootstrap from `VERIFICATION-FLEET.md` → replace `<FLEET-SECRET>` with the printed secret → run once supervised → save as skill → schedule (cadences are already in each brief; staggered so usage limits never collide).

**Step 8. Nothing else.** Bots fetch live case packs, post findings to the API, and findings become work nodes automatically at every loop boot. New findings appear in the `/admin/loop` inbox; p0/major findings outrank planned work in the queue on their own.

## Phase 4 — Steady state (how Matt steers, indefinitely)

- **See status:** open `/admin/loop`; one-line daily digest email; weekly scoreboard packet for trends.
- **Add something:** "Add: ‹the thing›" → register row + work node in the same delivery; the queue scores it against everything else.
- **Change direction mid-flight:** "Change: ‹what›" → the node/requirement amends; a claimed node finishes or releases per the change.
- **Stop something:** "Stop ‹the thing›" (kills a node) or "Disarm the loop" (kills the engine). Silence never arms, un-gates, or approves anything.
- **Version close:** when VERSION-1's conditions are met (all gaps done, fleet clean pass, certification re-verify), the session presents the certification for Matt's stamp; VERSION-2 planning starts from the same graph.

## Hard lines that hold in every phase

Sends to real people, public posts, ad spend, OAuth grants, SkySlope writes: per-action Matt approval, always, regardless of what any node or finding says. The fleet secret lives only in env + the Grok app. Bots never get form access except Flow Prover's designated test identity. A bot finding is a lead, not a verdict — reproduce-or-reject is the first step of every fleet node.
