# CMA work handoff (Bend expired letters + 3062 NW Kelly Hill)

**Read this first if you are picking up the CMA work.** It is kept current by whichever session is doing the work. Last updated 2026-10-08 evening by the Claude Code cloud session.

## Start here (any machine)

```bash
git fetch origin
git checkout claude/beautiful-lamport-2x4fjs && git pull origin claude/beautiful-lamport-2x4fjs
git ls-remote origin fix/on-market-value fix/relist-clock fix/plat-ground-facts   # in-flight fix branches, see "In flight"
```

The work branch is `claude/beautiful-lamport-2x4fjs`. Main is landed from it by fast-forward only (`git push origin HEAD:main` after `npm run push`). No rebase, force-push or reset.

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

## Where things are (2026-10-08 ~21:50 UTC)

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
| `fix/relist-clock` | Relisted or back-on-market homes use one clock, their last stretch. First ask comes from that stretch, and the row is labeled "after it last came on the market". The subject's first ask is the price in effect when it went Active. | wording/data |
| `fix/plat-ground-facts` | A recorded addition or phase in the same neighborhood is the home's own subdivision everywhere, including the facts ladder, weights, room rule, pockets, anchor, date gate and review. Rule 24. | yes |

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

## Landing steps after the fleet yes

1. `CI_GATES_SERIAL=1 npm run push`, then `git push origin HEAD:main` (fast-forward only).
2. `npm run deploy:verify`.
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
