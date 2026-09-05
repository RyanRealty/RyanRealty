# Goal — Deep-audit punchlist, end to end (2026-09-05)

Source: `out/audits/deep-audit-2026-09-04.md`. Protocol: `.claude/skills/endtoend/SKILL.md`.

## What exists when finished

A broker (or the next agent) can trust the live loops without reading May 2026 fossils:

1. **Publish → measure works.** Approving a Studio draft and letting publisher-sweep run stamps `executed_at`, writes `published_to`, and the measurement/performance-pull crons can find the row. Empty seed `content_performance` rows do not flip status to `measured`. A measurement-loop run always leaves a `performance_loop_completed` digest, including 0-candidate days.
2. **Loop-sentinel is observable.** Every skip (kill switch, missing key, launch HTTP fail, standdown) writes `sync_logs`. Cursor Cloud owners like `cursor-cloud-bc-…` auto-release when their run is terminal. Two fossil `in_progress` claims from August are released. **The loop is not re-armed here** — if production `LOOP_SENTINEL=off`, that stays; the skip is visible.
3. **Token health tells the truth.** Dead X refresh classifies as `needs-reauth`. LinkedIn with no refresh token is heartbeat **204 skipped**, not daily 500. snapshot-channels persists a roll-up and does not pretend parked/missing platforms are live.
4. **Queues are honest.** Fossil producer `in_production`/`pending` rows are killed. Sense/ready counts can be split later; CMA ready is not treated as Studio ready in health copy where we touch it. Seller sequence no longer dies on unresolved `%address%` when an address exists on the person.
5. **Security and hygiene land.** `likes` anon cannot read `user_id`. `cma_deliveries` RLS doc matches live. Leftover render-worker PII payload is deleted. High-confidence FKs added where orphan counts are zero.
6. **Nightly G55 is green** for the listing-detail remainder restyle (12 unused modules gone, tests retargeted).
7. **Skill/docs drift no longer routes agents into deleted video SKILLs or AgentFire WordPress as the live factory.**
8. **Producer inventory no longer lists deleted Remotion scripts.** `test-all-producers.mjs` refuses.

## What a real user does

- Matt opens `/admin/studio`, approves one ready draft (his §1 stamp — this mission does not stamp). Sweep runs, row becomes executed with `executed_at`. Next measurement window can pull IG/FB metrics.
- Matt opens `/admin/loop` / loop-brief and sees X as needs-reauth (not auto-refresh) and LinkedIn still PARKED.
- Sequence engine can send a seller first-touch when the person has an address.
- Anon key cannot dump like-row `user_id`s.
- Next agent loading skills is pointed at Studio / `crm_people`, not Remotion / FUB / WordPress.

## Bar

- Tests through the public interface for every logic change (TDD).
- Live SELECT after data writes; no invented counts.
- `npm run ci:gates` green on the ship. One `npm run push` + `deploy:verify` if the app changed.
- Browser check only where UI changed (listing-detail orphan deletion is a non-render if those modules were unused).

## Stops (named, not silent)

1. **Missing credentials / Matt-gated:** X and LinkedIn reconnect (`/api/x/authorize`, `/api/linkedin/authorize`) — §1 OAuth. Studio approve/publish — §1. Ad spend. This mission does not grant OAuth or approve posts.
2. **Destructive ambiguity:** dropping 8 DEAD tables and adding FKs on 17k-row `westside_parcels` only after orphan counts. If orphans exist, skip the FK and record it.
3. **Conflicting requirements:** GROK_BOT_BRAIN says the loop is armed; durable memory says do not re-arm until Matt says “arm the loop.” **This mission does not change `LOOP_SENTINEL`.** It only makes skips visible and releases stranded claims.

## Out of this ship (explicit)

- Next 16.1.6 → 16.3.4 if the bump fails `ci:gates` (try; park if red).
- Closing 8 Learn ledger windows (needs measured deltas, not a code toggle).
- Regenerating ENTERPRISE_MAP cron photo inventories (docs; do if cheap).
- Matt reviewing 13 Studio drafts.
- Deleting 757MB `out/xai-ryanrealty-studio` craft (escalate, do not delete).

## Progress

Started 2026-09-05.

- C1: publisher-sweep stamps `executed_at`; measurement digest always writes; seed rows do not flip `measured`. Backfilled 0 remaining executed-without-stamp.
- C2: skip logs + stale 3-day release + `cursor-cloud-bc-` owners. Did not flip `LOOP_SENTINEL`.
- D3–D5: heartbeat-aware token classifier; LinkedIn heartbeat skip; snapshot-channels drop linkedin/google-ads + persist roll-up.
- D6: `%address%` falls back to contact street. One live seller-lp CMA still `in_production` (2026-09-02) — left alone.
- D2/D19/D15: killed 111 fossil rows; stuck classifying audit run `killed`; weekend-events IG backfilled `2235ded4-…`; PII render-worker dir deleted.
- D9: likes anon SELECT removed; authenticated own-row only. Applied on hosted DB.
- D11: deleted 12 unused listing-detail modules; retargeted tests/gates. G55 green.
- D7: skills point at Studio / crm_people. Page-grade file stays absent (G44).
- D18: producer-inventory pruned Remotion; test-all-producers exits 2.
- Parked: Next bump, protobufjs override, DEAD table drops, FKs, Learn windows, OAuth, Studio stamps.
