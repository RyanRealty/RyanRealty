# CMA handoff (START HERE). Updated 2026-10-09 9:20 AM PT

Any agent: read this section first, then continue. Everything below it is older history.

## Goal and definition of done
Every unsent expired-listing CMA draft is rebuilt and saved on current main. Each one either passes every check (ready for Matt to send) or carries a clear hold or fail reason. Fleet bar: no new fails or holds against the baseline without Matt's yes (rule 25).

## Where things stand
- **Code fixes merged to main** (tip `1ca218db3`, code through `d095a9d10` plus docs #477): #447 price clock plus #456 failed-ask pricing, #449, #453, #454, #455, #457, #466 size-mix trend (rule 30), #467 live map (rule 31), #468 stored competition/unsold rows (rule 32). Delivered letters stay frozen. **Do not list #452 as merged** — it is still open.
- **Not done yet: the saved rebuild of the unsent drafts.** About 437 drafts. A first attempt on 10/9 at 7:03 AM was STOPPED by Matt because it ran before the fixes were live. 4 drafts were saved in that run (Wild Rose, Fern Dell, Purcell, Saginaw). They lacked #447, so rebuild them again.
- **Open PRs:** #476 CI speedup (https://github.com/RyanRealty/RyanRealty/pull/476 — checks about 45 min down to about 10; merge once green). #452 ignore a same-ask pending reversal inside an hour (https://github.com/RyanRealty/RyanRealty/pull/452 — still open; needs a rule-25 fleet score before merge). Optional, not blocking rebuild: #471 admin CMA view perf / parcel index.
- **Latest fleet scores (dry run):** price-clock 108/140 built, 23 prices moved (median 2.3%). failed-ask 109/143 (new fail cma-1235-hartford, new hold cma-140-4th; the session recommends accepting both). disclose 110/143. All runs predate #466, #467 and #468.

## Next steps, in order
1. Confirm the Vercel production deploy of main `d095a9d10` or later is live.
2. Optional, read-only: `npm run cma:render-audit`. It should show fail 0.
3. Saved rebuild of every unsent draft (status draft or held, never delivered, finalized or archived). Base it on `scripts/_rebuild-cma.ts`. On the Mac mini, the sharded copy is `~/RyanRealty-wt-rebuild/scripts/_rebuild-shard.local.ts` (untracked). Run 8 shards in parallel at concurrency about 4. Each home must pass the live-status gate (skip Active, Pending or Coming Soon, or sold since the letter; fail closed) and the Spark check before it is written. It saves rows and never sends. About 7 minutes per home, so roughly 2 hours.
4. Produce the ready-to-send list with admin links (`/admin/cmas/<slug>/view`): ready, held with reason, skipped, failed. A report script exists at `~/RyanRealty-wt-rebuild/scripts/_rebuild-report.local.ts`.

## Commands
- Tests: `npx vitest run lib/cma` (the full suite runs in the push hook).
- Fleet score (dry run, saves nothing): `npm run cma:fleet` (rule 25; compare against `docs/plans/cma-handoff/fleet-baseline-2026-10-08.json`).
- Stored-letter render check: `npm run cma:render-audit` (read-only, reads prod).
- Lookpass: `npx tsx scripts/cma-lookpass.ts --check <slug>...`
- Push: `CI_GATES_SERIAL=1 npm run push` (repo wrapper; never `--no-verify`).

## Known failure buckets (examples)
- Too few sales to set a price: cma-20289-schaeffer (4 of 5), cma-68050-fryrear-sisters (0).
- Unit address can't be verified, so the live-status gate fails closed: cma-1015-4th, cma-1940-monterey-pines, cma-9004-split-rail-la-pine.
- Back on the market, skip: cma-3062-nw-kelly-hill.
- Flagged with the price under a failed ask (review): cma-20676-wild-rose, cma-14355-fern-dell-la-pine, cma-3037-purcell, cma-915-saginaw.
- Rule 22 holds: the failed ask sits inside the sales range (Purcell, Woodsman).
- Pre-10/4 rows store no subdivision names. #468 now prints them when they're in the area the build searched.

## Matt's decisions (binding)
- Pricing rules 15, 16, 20 and 22 in `marketing_brain_skills/producers/cma/SKILL.md` section 0.3, plus rules 29 to 32 (added 10/8 and 10/9).
- A home back on the market is never rebuilt and never sent. Live status comes first.
- Delivered letters never change.
- PRs only. Agents may merge their own PRs once checks are green (Matt, 10/9). Never push to main directly, no force-push or rebase.
- Production DB is read-only except the saved rebuild of drafts. No sends. Never use buyer or seller names in public copy.
- Use Matt's Grok subscription, never the XAI, OpenAI or Anthropic API keys, for agent sessions.

## Mac mini tooling (`~/grok-build`)
`run-session.sh` (headless grok-4.7 at xhigh), `prompts/_rules.md` (rules every session gets), `fleet-start.sh`, `jobs/*.json` manifests, and the LaunchAgent `com.ryanrealty.grok-build` (resumes unfinished jobs after a reboot). All rebuild jobs are currently marked done/stopped.


---

# CMA work handoff (Bend expired letters + 3062 NW Kelly Hill)

**Read this first if you are picking up the CMA work.** It is kept current by whichever session is doing the work. Last updated 2026-10-09 by the Grok session on this branch.

## Start here (any machine)

```bash
git fetch origin
git checkout claude/beautiful-lamport-2x4fjs && git pull origin claude/beautiful-lamport-2x4fjs
git ls-remote origin fix/on-market-value fix/relist-clock fix/plat-ground-facts   # in-flight fix branches, see "In flight"
```

The work branch is `claude/beautiful-lamport-2x4fjs`. Landing is a pull request to main. Matt merges. Do not push, fast-forward, or merge into main. No rebase, force-push, or reset.

## STOPPING POINT, 2026-10-09

This section is the current order. It overrides every older landing line in this file.

Landing is a pull request to main. Matt merges. Do not push, fast-forward, or merge into main. No rebase, force-push, or reset. Nothing is sent to any owner. The production database is read-only from these sessions.

This session (`~/RyanRealty`, branch `claude/beautiful-lamport-2x4fjs`) found `origin/main` already joined to the branch. Merge commit `632b64564` ("Merge origin/main before landing (round 1)", author Claude) has parents `be92e394e` and `0918d4418` (Google Signals back on, #446). At the start of this write, that commit was the tip of both `origin/main` and this branch. This session did not push to main. The commit that adds this section is the pull request.

Other sessions own the rest. This session did not do their work.

- `fix/price-clock` at `d2ae3129c`. Its unit file was 14/14 when last reviewed. Its own pull request.
- `fix/reader-5-engine`. Kelly Hill on-market date window. Matt's direction is closer to $716,000. Do not hardcode that dollar amount.
- `fix/reader-5-render`. Chart and wording fixes from the fifth read.
- Six read-only letter reviews. They land in `~/grok-build/reviews/<slug>.md`. Checked at this commit: that directory exists and is empty, so the reviews are in progress. Slugs: `cma-62475-woodsman`, `cma-2382-jackson`, `cma-3037-purcell`, `cma-1648-pheasant`, `cma-3177-coho`, `cma-2745-aldrich`.
- The fleet score lands in `~/grok-build/fleet/`. A price-clock run is in progress at `~/grok-build/fleet/price-clock/`, git SHA `d2ae3129c`, run `2026-10-09T03-18-36.729Z`. It is not finished (`complete` is false, `finishedAt` is empty). At this check it had scored 11 homes: 6 built, 5 failed on the minimum-comp floor, 0 harness errors. That partial is not the fleet result.

Nothing has been sent to any owner. Do not rebuild the ten drafts until Matt approves the pull requests and names the letters.

## Hard constraints (Matt's, standing)

**Sending and approval**
- Nothing is sent, queued, enqueued or approved without Matt's per-report approval.
- A rebuild never sends, enqueues or approves.
- Do not text 615 Reed Market; it is an SMS lead.
- Keats and 1195 Remarkable were already delivered. Do not resend.
- CMA email wording changes need Matt's sign-off.

**Letter text**
- No buyer, seller or owner names in public copy.
- No em dashes in letter or public text.

**Data access**
- Raw SQL is for `-- audit:` row reads only. Aggregates go through the DAL; the hook refuses aggregates on `listings` and `sale_pricing_facts`.
- Agents run tests with `--project unit` only. The `*.int.test.ts` tests write to production.

**Process**
- Rule 25: any comp-search or pricing change is measured with the fleet scorer before it lands. Matt says yes to the fleet result before main moves.
- Never ask Matt to run anything. Ask him decisions with AskUserQuestion, recommended option first.
- Push with `CI_GATES_SERIAL=1 npm run push`. Parallel tsc runs get OOM-killed.
- After a production deploy, run `npm run deploy:verify`. Retry once on "fetch failed".

## Where things are (2026-10-08 ~23:30 UTC)

- **All four ruling fixes are merged** on the branch at `3b1c7b036`: plat-identity, wording 3 and 4, on-market-value, relist-clock and plat-ground-facts with seat order. The final fleet score on `3b1c7b036` was started 23:2x UTC in the cloud against `docs/plans/cma-handoff/fleet-baseline-2026-10-08.json`. If no result is recorded below, rerun it (see Fleet), show Matt the result, and on his yes open a PR to `main`; Matt merges.

### Earlier state

- **Main:** `95af9d7bd`. Deploy `dpl_33tipxiwy9fhkoDr9UgkMZ2KQSSP` is verified.
- **Branch head:** `994e3722a` plus the handoff commit. On top of main it carries:
  - `fix/plat-identity` `fceb282b5`: one "on the subject's ground" decision by plat polygon, any MLS spelling (`lib/pricing/plat-ground.ts`).
  - `fix/letter-wording-3` `0ea6cb430`: clamped held covers say "set the range". Also:
    - pin note
    - whole elapsed months
    - tied top weights
    - held net page title
    - rule-20 lot-size disclosure
    - "Your last ask was"
  - `fix/letter-wording-4` `f6fc98a62`: came-off homes print their own asks and the true reason. Also:
    - exact, distinct compact money labels
    - chips with close month
    - competition wording
    - on-market closing eyebrow
    - "did not sell at its last ask"
  - A merge of origin/main `d2ecdd84b`.
  - The rule 26 SKILL.md text.
- **Engine-affecting and not yet fleet-scored:** plat-identity. A fleet run on `994e3722a` was started in the cloud. If its result is not recorded below, rerun it (see Fleet).

## In flight (2026-10-08 evening): three fix branches for Matt's rulings

Each was started by a cloud agent with `docs/plans/cma-handoff/fix-brief.md`.

- **If a branch exists on origin:** review it, merge it into the work branch, and run the unit tests for the touched files.
- **If it does not exist:** redo it from the task spec at the bottom of this file.

| Branch | Ruling (Matt 2026-10-08) | Engine? |
|---|---|---|
| `fix/on-market-value` **MERGED** (`199bf68a6`) | On-market subject: the opinion of value is the likely sale the weighted sales point to, not the list figure. Kelly Hill becomes $716,000, not $733,000. Rule 27. | yes (on-market only) |
| `fix/relist-clock` **MERGED** (`32077999a`, SKILL rule 28) | Relisted or back-on-market homes use one clock, their last stretch. First ask comes from that stretch, and the row is labeled "after it last came on the market". The subject's first ask is the price in effect when it went Active. | wording/data |
| `fix/plat-ground-facts` **MERGED** (`537a0b10f`, seat order included) | A recorded addition or phase in the same neighborhood is the home's own subdivision everywhere, including the facts ladder, weights, room rule, pockets, anchor, date gate and review. Rule 24. | yes |

## Cloud session record, 2026-10-09

- **Landed on main:** `632b64564` with Matt's yes on the final fleet score: 108 of 140 build; 22 moves, median 2.5%; holds +2/-2; Mount Bachelor newly failing. It carries all of the 10-08 rulings plus clamp-line.
  - First job: run `npm run deploy:verify` and confirm it is READY. Retry once on "fetch failed".
- **Drafts:** all ten were rebuilt on 10-09 from `ecf1a1e62`, i.e. the landed code minus main's own commits. They are drafts and nothing was sent. They will be rebuilt again after step 2 below.
- **Branches pushed, NOT merged** (merge into `claude/beautiful-lamport-2x4fjs` in this order, run the unit tests, then run a fleet score):
  1. **`fix/price-clock` `d2ae3129c`.** Rule 16's cut test and the comp sale-to-original ratios move to the last stretch (Matt: "Yes, after this landing"). Wild Rose goes from $593,000 to $591,000.
  2. **`fix/reader-5-engine`** (if on origin).
     - An on-market subject's rule-15 window runs from its on-market date to the letter date.
     - **Matt 2026-10-09 on Kelly Hill: "it's definitely going to be closer to 716. It's listed at 699 currently, and it hasn't sold."** When the window has too few local sales, a home that sat unsold through its asks counts as the local market not rising. Its own-ground sales then move down with Bend's index, which brings Kelly Hill back to about $716,000. The note under the grid must say so truthfully.
     - Also: MLS dated fields (WithdrawDate etc.) set the day a stretch ended; "No home sold in X" replaces "matched" when zero sales; one subdivision name in text and map (never a bare MLS code like "CLAB").
  3. **`fix/reader-5-render`** (if on origin):
     - "What happened" chart labels must never collide;
     - each sentence prints once per letter;
     - the "Original list" cell says when it is the ask on the home's return;
     - complete Jacksonville Basis sentence;
     - River West caption matches its count;
     - "value", not "price", on on-market letters;
     - no mid-word address breaks;
     - Saginaw small wording.

  If a reader-5 branch is missing on origin, redo it from these bullets with `docs/plans/cma-handoff/fix-brief.md`.
- **Then:** each of those branches is its own pull request. Matt merges. Do not push, fast-forward, or merge into main. After a merge is on main, `deploy:verify`. Rebuild the ten only when Matt names the letters. Reader notes land in `~/grok-build/reviews/<slug>.md`. Re-read all ten, including the six not re-read on 10-09 (Woodsman, Jackson, Purcell, Pheasant, Coho, Aldrich). Then send Matt the links table only after he approves each letter.
- **Matt 2026-10-09: "Trust the MLS fields"** for room counts. 1340 Cumberland stays 3 bed even though its remarks say 2, and Jacksonville is unchanged.
- **Open for Matt:** see "Open questions" below. Item 9 is new: main's "One rule set" doc paragraph contradicts rule 20's 25% line and the 5-sale floor.

## Late 2026-10-08 / early 10-09 status (read this before "Fleet")

**Final fleet score on `3b1c7b036`** (all ruling fixes; clamp-line is wording only), against the baseline:
- 108 of 140 build (baseline 109).
- Newly failing: cma-19717-mount-bachelor.
- Newly holding under-ask-15: cma-2681-moonlight ($474,000 vs $575,000) and cma-62665-big-sage ($2,294,000 vs $2,750,000).
- Holds cleared: cma-140-4th and cma-21380-oakview.
- 22 prices moved, median 2.5%. Range: Oakview +7.8%, Irving -7.4%, Moonlight -5.0%, Ponderosa +4.2%, Jacksonville -3.7%, Devils Lake 61578 +3.5%.
- Full report: `fleet/final4/*.md` in the cloud scratch (not on disk here). Rerun if needed.
- **Awaiting Matt's yes to land.**

**All ten drafts were rebuilt from `ecf1a1e62` (drafts only) on 2026-10-09 ~00:20 to 01:00 UTC**, before landing, to save time. Readers then reviewed Jacksonville, Saginaw, Kelly Hill and Wild Rose. Findings:
- **Kelly Hill: the opinion is now $744,000, not ~$716,000** (range $693,273 to $788,042).
  - Cause: Westside Meadows sales became own plat (rule 24). The rule-15 local date gate then got no listing window, because an active subject has no off-market date (`build.ts` `offDate: cycle.offMarketDate`), so no sale moved down for date.
  - The letter also gives a false reason: "there is no recent listing of your home".
  - Fix on `fix/reader-5-engine` (in progress): an on-market subject's window runs from its on-market date to the letter date.
- **Jacksonville:**
  - 1340 Cumberland's remarks say 2 bed / 1 bath, but its MLS fields say 3 bed. **Matt 2026-10-09: "Trust the MLS fields"**, so no change.
  - The status date comes from the log (Sep 29) rather than the MLS WithdrawDate (Sep 28). Fix on `fix/reader-5-engine`.
  - The Basis sentence lost its lead, and the River West caption says "listed" for homes that were only on the market in the window. Fix on `fix/reader-5-render`.
- **Saginaw:**
  - Chart label collisions ($925K over the end label; the phone caption over $995K).
  - Two sentences repeated across chapters.
  - "matched your home" printed when there were zero sales.
  - Fixes on both reader-5 branches.
- **Wild Rose:**
  - "CLAB" in the text vs "Tara View Estates" on the map.
  - The "Original list" row shows last-stretch asks unlabeled.
  - Address heads break mid-word.
  - Fixes on both reader-5 branches.
- **Not re-read yet:** Woodsman, Jackson, Purcell, Pheasant, Coho, Aldrich.

**`fix/price-clock` `d2ae3129c` is pushed, NOT merged.** Per Matt, it goes after this landing. It moves rule 16's cut test and the comp sale-to-original ratios to the last stretch. Wild Rose goes from $593,000 to $591,000; Saginaw is unchanged. It needs its own fleet score.

**Order from here:** superseded by "STOPPING POINT, 2026-10-09" above. Do not fast-forward main. Each fix branch is its own pull request. Matt merges.

## Fleet (rule 25)

```bash
# from a clean detached worktree of the commit to score, with node_modules symlinked
NODE_USE_ENV_PROXY=1 npm run cma:fleet -- --concurrency 4 \
  --baseline docs/plans/cma-handoff/fleet-baseline-2026-10-08.json --out-dir <scratch dir>
```

- **Baseline:** `docs/plans/cma-handoff/fleet-baseline-2026-10-08.json` (summary in the `.md` beside it). Main `95af9d7bd` built 109 of 140 Bend expireds; the failures are mostly Matt's five-sale floor.
- **Runtime:** about 70 minutes at concurrency 4 to 5.
- **What to show Matt:**
  - build count vs baseline;
  - every home whose price moved more than 1%, with why;
  - new failures with their reasons.
- Matt accepted the last three results with "Yes, land and rebuild".
- **Interim score, `994e3722a` (plat-identity only), 2026-10-08 21:40 UTC:**
  - 108 of 140 build (baseline 109).
  - Newly failing: cma-19717-mount-bachelor (1 price-setting sale in Century West; built at $602,000 before).
  - Newly holding: cma-62665-big-sage (under-ask-15, $2,294,000 vs $2,750,000).
  - 12 prices moved, median 2.8%:
    - cma-1355-jacksonville $732,000 to $705,000 (1367 Milwaukee found).
    - cma-429-irving -7.4%.
    - About seven homes down 2 to 3% with unchanged comps. The competition read now sees actives in additions (e.g. Providence Phase 4 for cma-3153-cromwell), and the actives nudge pulls the list down.
  - The final score must be run on the branch head after `fix/plat-ground-facts` lands.

## Landing steps after the fleet yes

1. Open a pull request to main. Matt merges. Do not push, fast-forward, or merge into main.
2. After that merge is on main, `npm run deploy:verify`.
3. Rebuild the drafts, one at a time or 2 to 3 in parallel: `npx tsx scripts/_rebuild-cma.ts <slug>`. This writes the draft row only; it cannot send.
4. Run one reader agent per letter with `docs/plans/cma-handoff/reader-brief.md`. Fix hard defects, then repeat.
5. Give Matt the links table: `https://ryan-realty.com/admin/cmas/<slug>/view`, with recommended vs last ask, range, and hold status. Wait for his per-report approval.

## The ten drafts (as built on `95af9d7bd`, 2026-10-08 19:20 to 19:29 UTC; all need a rebuild after landing)

| Slug | Rec | Last ask | Range | State | Expected change after landing |
|---|---|---|---|---|---|
| cma-3177-coho | $551,000 | $569,000 | $531,576 to $551,876 | Ready | wording only |
| cma-2745-aldrich | $479,000 | $495,000 | $473,949 to $479,161 | Ready | chips get dates; "Your last ask was" |
| cma-1355-jacksonville | $732,000 | $734,999 | $695,610 to $732,795 | Ready | 1367 Milwaukee now found on own plat; price may move down; came-off paragraph |
| cma-2382-jackson | $625,000 | $639,000 | $598,620 to $635,458 | Ready | competitor 2260 Indigo on last-stretch clock |
| cma-1648-pheasant | $566,000 | $599,900 | $499,599 to $569,365 | Flagged wide range | "17 sales" |
| cma-3037-purcell | $555,000 | $565,000 | $550,951 to $570,165 | Held, ask inside range | range-only weights wording |
| cma-62475-woodsman | $1,576,000 | $1,600,000 | $1,554,207 to $1,618,053 | Held, ask inside range | "Weight among these sales"; axis labels $1.62M / $1.55M |
| cma-20676-wild-rose | $593,000 | $599,900 | $627,332 to $724,442 | Held, ask under every sale | first ask $599,900 (Coming Soon $625K dropped); relist clock; lot disclosure; "did not sell at its last ask" |
| cma-915-saginaw | $911,000 | $925,000 | $987,577 to $1,113,820 | Held, ask under every sale | competition now has 733 Saginaw and 1340 Trenton pending; $1.05M label; 628 Portland stretch; Kenwood additions as own plat may move weights |
| cma-3062-nw-kelly-hill | $733,000 | $699,999 (listed now with another brokerage) | $674,070 to $733,116 | Regular CMA, opinion of value | opinion becomes $716,000; came-off homes' real asks ($895,000, $999,000) and reason (size) |

## Matt's rulings on 2026-10-08 (all in `marketing_brain_skills/producers/cma/SKILL.md` §0.3)

- **Rule 23:** an ADU sale skips.
- **Rule 20:**
  - One 20% price line from the independent anchor, for both search and review.
  - Lot size under one acre is disclosed, never a drop.
  - The 25% size line applies everywhere.
- **Rule 8:**
  - A refill stays on the same rung.
  - Only real communities wall the search.
- **Rule 27:**
  - 3% fee for everyone.
  - An on-market home gets an opinion of value, never a pitch.
  - The opinion is the likely sale (evening ruling).
- **Rule 15:** own-ground pocket sales move down with the Bend index only if the local read fell.
- **Street-anchor:** "Trim normally". A street sale at an end is set aside; the street cap does not set the price.
- **Rule 26:** the held letter says the home "did not sell at its last ask", never "buyers passed".
- **Listing days:** relists use the last stretch, labeled.
- **Rule 24:** additions in the same neighborhood are own plat everywhere.
  - Whole communities in the MLS alias map (NorthWest Crossing, Tetherow, Caldera Springs phases) count as own plat too: "Yes, whole community".
  - Inside own ground, own-street and exact-plat sales seat first, then additions/family/alias plats, newest first within each group: "Own street and exact plat first". 20617 Foxborough keeps 20624 Foxborough Ln.

## Open questions for Matt (not yet asked or answered)

1. **Public listing read.** Does the own-ground date rule (rule 15) apply to the public listing read? (`lib/pricing/select.ts` `priceSubjectFromFacts`.)
2. **Clamped list letters.** On unheld letters where the failed-ask ceiling moved the cover, the clamp sentence names a figure the weights don't produce. Example: 615 Reed Market says "support a value of $533,000" while its weights blend to $510,945.
   - Recommendation: have that sentence name the weighted figure.
3. **Cedar Ridge** is on the real-derived-community list, but no recorded plat carries it.
4. **Wild Rose** (ask under every sale): the cover is $34,332 under the printed low, and rule 26 prints no clamp sentence, so nothing on the page explains the gap. This is by design under rule 26. Confirm Matt is fine with it.
5. **Jacksonville:**
   - The last ask was up only 6 days. The rec ($732,000) is $2,999 under it, and the failed-ask ceiling did not apply.
   - The subject is marketed "ready for a builder", but every comp is finished, and condition is not adjusted.
   - Matt should eyeball this one.

6. On-market letters (from `fix/on-market-value`):
   - **Opinion above the current ask.** Rule 3 never holds on-market origins. Examples: Kelly Hill $716,000 vs $699,999; cma-17171-chaparral $1,525,000 vs $1,225,000; cma-1617-nw-8th $799,000 vs $599,000. Recommended: no new hold, since rule 9 keeps every send with Matt.
   - **Fallback.** When the grid cannot reproduce the weighted sale, the cover keeps the list figure under "Our opinion of value". This is 9 of 12 stored on-market rows, mostly old builds. Recommended: flag those for review.
   - **Our own listings.** The on-market decision treats our own listings as on market too.

7. Relist clock (from `fix/relist-clock`):
   - **Pricing still reads MLS OriginalListPrice.** This affects two things:
     - the list-price engine's sale-to-original-ask ratios over relisted comps;
     - rule 16's cut test in the failed-ask pull. Wild Rose counts as "cut from $625K", but on its last stretch the ask never moved, which allows a larger pull.
   - Recommendation: move both to the last stretch, scored with `cma:fleet` first. This moves prices, so it is Matt's call.
   - **"95.7 percent of the price they first asked"** is a city statistic measured from each listing's first ask. Bend's median days use the last stretch. This is a methodology call.
   - **MLS correction blips** (Pending to Closed to Active to Pending within minutes) can make the last stretch 0 days and print "offer 0 days". This predates the fix and needs its own rule.

8. Answered by Matt 2026-10-08 (late):
   - **Clamp line on unheld letters:** "Name the weighted figure". The sentence names what the weighted sales support (615 Reed Market: $511,000, not $533,000), then why the list sits at the cover. Merged (`fix/clamp-line` `99fa423b7`, SKILL rule 16). It changes wording only, so no fleet run is needed. Open: on 702 Willitts the stored weighted price is figured before seller concessions, so the printed grid doesn't reproduce it, and the sentence names no figure there. Recommendation: leave as is.
   - **On-market grid fallback:** "Keep the list figure". No change.
   - **Price clock:** "Yes, after this landing". Move rule 16's cut test and the sale-to-original-ask ratios to the last-stretch clock (rule 28) as a separate engine change with its own fleet score, after the current landing. It can move Wild Rose's price. **Next engine task.**

9. **Conflicting doc line from main.** PR #438 (a Grok CLI session) added a "One rule set (Matt 2026-10-08)" paragraph to SKILL.md §0.3. It says:
   - a 35% living-area picker cutoff is the only size cutoff;
   - there is no second review;
   - the search widens when fewer than 3 comps pass.

   That contradicts rule 20 (Matt 2026-10-08, "25% everywhere"), locked rule 8 (minimum 5 price-setting sales) and the review that rule 4 binds to the picker. The code follows the rules from this session, and the paragraph is kept verbatim. **Ask Matt which stands.**

## Backlog (after the drafts ship)

- Stored `render_args.expiredAudit.findings` strings are stale (pre-trim ranges, 25-day median, "over 1 cut"). Regenerate them on rebuild, or stop storing them.
- `builderReads.getLikeHomeSales` still matches the subdivision by name prefix (ILIKE 'prefix%').
- Flex gold `it.skip` tests in `lib/pricing/match.test.ts` are pending Matt.
- The CLAUDE.md restructure Matt approved, for after the CMA work.
- Carried over:
  - Burnside date-adjustment check.
  - 139 Roosevelt and 714 10th find zero sales in their neighborhoods.
  - City-wide `failedRowDays` (`local-outcomes.ts`) withdrawn days.
  - Multi-unit reader neighborhood false positive.
  - BPO rule-20 under-side check.

## Task specs for the in-flight branches (redo from these if a branch is missing)

All three use `docs/plans/cma-handoff/fix-brief.md`.

**fix/on-market-value.**
- When `lib/cma/subject-on-market.ts` says the subject is on the market, the opinion figure is the expected sale. That is the same figure and rounding `lib/cma/expected-sale.ts` prints as "near $X", rounded to the thousand.
- Carry it as the cover price and the stored `cmas.recommended_list`. The admin view, cover, $/sqft line and competition band center must all agree. The range is unchanged.
- Page 2 says it once: "The three sales that set this value point to $716,000 once each is weighted by how closely it matches your home."
- Do not change hold rules. Report what the on-market hold does with the new figure.
- Non-on-market letters must not change. Prove it with a test and a scratch re-render of cma-3177-coho.
- Update rule 27.
- Also fix the awkward one-sale trim phrase in `lib/cma/cover-value.ts`.

**fix/relist-clock.**
- One clock per row: the last stretch on the market.
- Days to offer count as now. First ask / original list comes from the same stretch, meaning the price in effect when that stretch began. Label the row "after it last came on the market".
- A summary like "All five sales shown had an offer within 47 days" must be true on that clock, and must say "of last coming on the market" when any row restarted.
- Cases:
  - 20676 Wild Rose comps 61197 Cottonwood and 61131 Brown Trout.
  - 915 Saginaw's 628 Portland: the stretch began at $1,395,000.
  - 1355 Jacksonville's 1613 Ithaca.
  - 2382 Jackson competitor 2260 Indigo: $645,000 to $550,000 over 115 days.
  - The Wild Rose subject's first ask is $599,900. The Coming Soon $625,000 was changed 14 seconds before Active.
- Do not change the Bend median definition.

**fix/plat-ground-facts.**
- Route every own-plat decision in the facts path and pricing through `lib/pricing/plat-ground.ts`:
  - `match.ts` walk, `passesTier` and `bracketEligible`;
  - `select.ts`;
  - weights;
  - price-line exemption;
  - room rule own-plat allowance (locked rule 4);
  - pocket rungs (locked rule 5);
  - `price-anchor.ts` plat level;
  - the date gate's `localGate`;
  - `judge-ground.ts`.
- The picker and the review must agree; test it on an addition sale.
- Keep the community wall, the 25% size line and the 20% price line.
- Show a real flip, e.g. a Kenwood subject with a Kenwood First Addition sale (cma-915-saginaw).
- Update rule 24.
