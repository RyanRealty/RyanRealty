# Agent navigation audit, 2026-09-24

Where agents go in this repo, what it costs them to get there, and the CLAUDE.md pointers
that shorten the worst trips. Every number below comes from git history or from parsed
agent transcripts made in this session. Nothing is estimated unless it says so.

## Bottom line

- The CMA is the most expensive place to find things. An agent asked to change how the CMA
  price is set took 15 and 28 tool calls to reach `lib/pricing/`, which CLAUDE.md never
  named. Four of the six baseline CMA runs read the 87 KB producer `SKILL.md` before
  reaching any code, because CLAUDE.md pointed there first.
- Search-box, map and place-alert tasks averaged 2 to 3.5 wrong files per run, working
  down from the UI before reaching the file that owns the logic. The place FAQ task read the
  1,443-line city `page.tsx` in chunks first.
- Three routing-table rows in CLAUDE.md cut the tokens spent before reaching the right
  file by 58% on the five tasks they were written from (3.73M to 1.58M).
  - On four held-out tasks the cut was 30% where a row names the area.
  - One held-out CMA task whose files no row names got worse, so across all four held-out
    tasks the change was 4%.
  - A pointer helps only where it names the file.
- Finding the file costs a median 7 calls, and 8% of all tokens in these runs. Most tokens
  go to what agents do after they arrive. Pointers can only shrink that 8%.
- A same-day follow-up named the CMA market chapter and the snapshot crons, paid for by
  removing a duplicate link. Merging main's new "ask Matt" rule later cost a stale §3
  paragraph. CLAUDE.md is 37,460 bytes and its budget was lowered to match, so the next
  pointer still has to be paid for by trimming something.
- The replay agents also flagged defects on `main`. The five leads were checked and fixed on
  this branch, with the related defects found alongside. Ten product calls went to Matt:
  four are decided and built (2026-09-24), six are still open. See the last two sections.

## How this was measured

1. **Destinations.** 4,978 non-merge commits on `main` from 2026-06-24 to 2026-09-24.
   - 2,992 carry an agent marker: a Claude or Cursor co-author or session trailer, or an
     agent as author.
   - 651 are CI bot commits.
   - 1,335 carry no marker.
2. **Paths.** Tool-call transcripts from past sessions are not kept in cloud containers.
   Only per-session token totals are visible, and one "Run loop" session alone shows
   1.69B cache-read tokens. So the paths were replayed.
   - Tasks: 19 real tasks from commits made in the last three weeks, phrased the way Matt
     asks for work, plus 4 held-out tasks.
   - Ground truth: the files the real commit changed.
   - Agents: each run is a cold agent on the model the fleet runs now, with CLAUDE.md in
     context, told to find where the change goes, read-only.
   - Scale: 37 baseline runs. Every tool call and token count was parsed from the
     transcripts.
3. **A/B.**
   - The problem: agents spawned inside a session load CLAUDE.md once, at session start, so
     they never see an edited file. Both a worktree agent and a probe after an
     Edit-tool change still quoted the old row.
   - The design: both arms get the routing table pasted into the prompt, so both see it
     equally prominently.
     - Placebo: the current table.
     - Treatment: the edited table.
   - Clean-up: two placebo runs read the new rows from disk before reaching their target and
     are excluded.

**Terms.**

- **Calls to target:** tool calls up to and including the first one that opens a file the
  real commit changed.
- **Tokens processed:** input (including cache reads) plus output, summed over those turns.
  This is raw volume. Cache reads bill at a fraction of fresh input.
- **Context added:** how much the search grew the context window before the target.
- **Starting context:** a cold agent begins at a median 66,102 tokens before its first call.

**Limits.**

- One or two runs per task per condition, and single runs varied a lot (the CMA pricing
  task took 15 calls once and 28 the next time).
- Several tasks were already fixed on `main`, so agents also spent calls confirming that.
- These are subagents, not full sessions.

## 1. Where agents go

**Files agents change most** (commits touching the file, 90 days):

| Commits | File | Note |
|---|---|---|
| 692 | `docs/plans/CROSS_AGENT_HANDOFF.md` | handoff note, every session |
| 654 | `CHANGELOG.md` | bookkeeping |
| 251 | `package.json` | gate wiring |
| 177 | `app/communities/[slug]/page.tsx` | place page |
| 175 / 155 | `docs/DAL_INDEX.md` / `docs/DATABASE_SCHEMA_SNAPSHOT.md` | generated |
| 147 | `app/cities/[slug]/page.tsx` | place page |
| 133 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx` | place page |
| 123 | `app/listing/[listingKey]/page.tsx` | listing page |
| 111 | `app/page.tsx` | home |
| 108 | `app/subdivisions/[slug]/page.tsx` | place page |
| 103 | `lib/data/index.ts` | DAL barrel |
| 99 | `lib/cma/build.ts` | CMA |

**Areas by activity** (commits, and days in the 90 with at least one commit):

| Area | Commits | Active days |
|---|---|---|
| DAL `lib/data/` | 798 | 87 |
| CI gates `scripts/check-*.mjs`, `scripts/lib/` | 789 | 83 |
| Admin UI `app/admin/`, `components/admin/` | 564 | 73 |
| Place pages (city, community, subdivision, ZIP and housing-market routes, `lib/place/`, `lib/site/place-*`) | 545 | 64 |
| CMA `lib/cma/`, `lib/pricing/`, `lib/data/cma/` | 476 | 55 |
| CRM (`lib/crm/`, `lib/data/crm/`, admin CRM UI) | 469 | 69 |
| Parity contracts `design_system/ryan-realty/ui_kits/` | 438 | 51 |
| v3 components `components/site/v3/` | 407 | 37 |
| Listing detail | 253 | 51 |
| Migrations | 233 | 62 |
| Map search `components/search/`, `app/search/` | 219 | 56 |

**Files agents opened most in the 37 baseline runs:**

| Opens | Runs | Chars returned | File |
|---|---|---|---|
| 23 | 4 | 120,811 | `components/search/MapSearchView.tsx` |
| 20 | 4 | 257,730 | `components/SearchMapClustered.tsx` |
| 16 | 3 | 80,283 | `app/cities/[slug]/page.tsx` |
| 13 | 2 | 100,013 | `lib/pricing/estimate.ts` |
| 13 | 2 | 67,218 | `app/cities/[slug]/[neighborhoodSlug]/page.tsx` |
| 12 | 11 | 10,115 | `docs/plans/CROSS_AGENT_HANDOFF.md` |
| 11 | 4 | 53,779 | `lib/cma/build.ts` |
| 11 | 4 | 76,184 | `lib/cma/opinion-pages.ts` |
| 6 | 4 | 121,358 | `marketing_brain_skills/producers/cma/SKILL.md` |

By folder, `lib/cma/` took 103 opens in 8 runs, the most of any folder.

## 2. Calls and tokens to reach each destination (baseline)

| # | Task | File the real change touched | Calls (runs) | Context added | Tokens processed | Wrong files / run | Doc detours / run |
|---|---|---|---|---|---|---|---|
| 1 | T04 CMA price from 5 tightest sales | `lib/pricing/ladder.ts`, `lib/cma/comps.ts` | 15, 28 | 89.6K | 1.82M | 0.5 | 2.5 |
| 2 | T05 CMA evidence table columns | `lib/cma/status-price-summary.ts` | 11, 12 | 31.9K | 0.71M | 0 | 1.0 |
| 3 | T08 search box suggests sold homes | `lib/data/listings/searchSuggestTiles.ts` | 11, 8 | 27.5K | 0.48M | 3.5 | 0 |
| 4 | H2 CMA market chapter (held-out) | `lib/cma/listing-window-market.ts` | 9, 8 | 29.3K | 0.37M | 0 | 1.0 |
| 5 | T03 place FAQ repeats stats | `lib/site/place-faq-extras.ts` | 11, 10 | 27.9K | 0.36M | 0 | 0 |
| 6 | T01 community title | `app/communities/[slug]/_v3/community-metadata.ts` | 6, 7 | 13.0K | 0.33M | 0 | 0 |
| 7 | T13 TC mail filing | `lib/tc/mail-rules.ts` | 7, 4 | 16.2K | 0.30M | 0 | 0.5 |
| 8 | T07 map price badges | `components/SearchMapClustered.tsx` | 8, 6 | 17.5K | 0.30M | 2.0 | 0 |
| 9 | T15 quote avatar colors | `components/site/v3/V3Proof.client.tsx` | 7, 7 | 14.7K | 0.30M | 0 | 0 |
| 10 | H4 map region (held-out) | `components/SearchMapClustered.tsx` | 3, 9 | 20.8K | 0.28M | 2.0 | 0 |
| 11 | H1 place alert copy (held-out) | `lib/site/place-alerts.ts` | 7, 4 | 18.7K | 0.27M | 2.0 | 0 |
| 12 | T10 CRM texts after 8pm | `app/api/cron/crm-sequence-engine/` | 7, 7 | 15.9K | 0.27M | 1.0 | 0 |
| 13 | T02 city rail photo | `lib/place/city-community-rail-photo.ts` | 5 | 10.4K | 0.22M | 0 | 0 |
| 14 | T12 Meta ads snapshot cron | `app/api/cron/marketing-snapshot-meta-ads/route.ts` | 6, 6 | 11.4K | 0.22M | 0.5 | 0.5 |
| 15 | H3 price-drops count (held-out) | `lib/data/listings/getPriceDrops.ts` | 4, 4 | 8.5K | 0.14M | 0 | 0 |
| 16 to 23 | loop brief, price-cut mark, CRM Gmail, admin CRM mobile, scoreboard, CI content floor, parity contract, home alt text | | 3 to 5 | 6.7K to 8.3K | 0.14M | 0 to 1 | 0 |

The cheap group (rows 16 to 23) shows what a direct path costs: 3 to 5 calls and about
0.14M tokens, most of it the agent's starting context read on each turn.

## 3. Paths where agents searched, opened wrong files or backtracked

- **CMA pricing (T04).**
  - The CLAUDE.md row sent agents to `lib/cma/` and the producer `SKILL.md`. Both runs
    grepped then read the SKILL.md, and one grepped `docs/DAL_INDEX.md` for "cma".
  - Then they traced the engine: `lib/pricing/estimate.ts` was opened 5 times in one run,
    plus `reconciliation.ts`, `lib/cma/pricing.ts`, `lib/bpo/engine.ts` and `select.ts`
    (twice), before reaching `ladder.ts`.
  - `lib/cma/pricing.ts` looks like the answer but is not. The engine
    (`applyEngineRecommendedList` in `estimate.ts`) overwrites its recommended price on the
    cover.
  - The runs changed direction 5 and 3 times after an open.
- **CMA evidence table (T05).**
  - "Evidence table" appears nowhere in code, so the search for it hit only an archived
    handoff.
  - Agents then grepped "evidence" in `lib/cma/` twice and read `opinion-scenes.ts` and
    `render-pricing-page.ts` twice before `status-ppsf.ts`, with 3 repeated searches in one
    run.
  - Listing `lib/cma/` (250 files) cost 6K to 21K characters on each run that did it.
- **Search box (T08).** Agents worked down from the UI through 3 to 4 wrong files before
  `lib/data/listings/searchSuggestTiles.ts`: `V3ChromeSearch`, the API route, `V3MorphSearch`
  and `SearchSuggest`.
- **CMA market chapter (H2).** Both runs read the CMA SKILL.md (64K characters in one run)
  and grepped "mortgage" repeatedly. The code calls the thing Matt meant "the rate per
  foot".
- **Place FAQ (T03).** Agents read the 1,443-line `app/cities/[slug]/page.tsx` in four
  chunks, then `lib/site/market-faq.ts`, before `lib/site/place-faq-extras.ts`.
- **Map (T07, H4).**
  - Across the first runs agents opened `lib/maps/markers.ts`, `app/search/page.tsx`
    (638 lines, opened in both tasks), `search-frame.css`, `lib/map-constants.ts` and
    `lib/search/search-opening.ts` before `components/SearchMapClustered.tsx`.
  - That file is at the top of `components/`, not in `components/search/`.
- **Place alert copy (H1).** The first run opened `V3StickyAsk.client.tsx`, the "Value my
  home" bar rather than the alerts bar, plus a 35K-character saved tool output, before
  reaching `lib/site/place-alerts.ts`.
- **Meta ads snapshot (T12).** CLAUDE.md §5 names `marketing_brain_skills/snapshot-channels`,
  so one run read that SKILL.md before the cron route.
- **Handoff history.** 20 of 37 runs grepped `CROSS_AGENT_HANDOFF.md` or its archive,
  all 20 after reaching the target and 2 of them also before. They were checking whether
  the work had already shipped. It is cheap: about 25K characters across 16 opens.

## 4. The five most wasteful paths

Ranked by tokens processed before the agent reached the right file, averaged over baseline
runs.

| Rank | Path | Tokens processed | Calls | Context added | Why | Area active days |
|---|---|---|---|---|---|---|
| 1 | CMA pricing to `lib/pricing/ladder.ts` / `match.ts` / `lib/cma/comps.ts` | 1.82M | 15, 28 | 89.6K | CLAUDE.md named `lib/cma/` and the 87 KB SKILL.md, never `lib/pricing/` | 55 |
| 2 | CMA evidence tables to `lib/cma/status-*.ts` | 0.71M | 11, 12 | 31.9K | Matt's word ("evidence") is not in any file name; `lib/cma/` has 250 files | 55 |
| 3 | Search box to `lib/data/listings/` | 0.48M | 11, 8 | 27.5K | Walked UI to action to DAL through 3 to 4 files | 87 |
| 4 | CMA market chapter to `lib/cma/listing-window-market.ts` | 0.37M | 9, 8 | 29.3K | SKILL.md detour; "rate" means price per foot in code | 55 |
| 5 | Place FAQ to `lib/site/place-faq-extras.ts` | 0.36M | 11, 10 | 27.9K | Read the 1,443-line route `page.tsx` in chunks | 64 |

## 5. CLAUDE.md edits

Three rows in the §9 routing table. The draft CMA row named `status-*.ts` but did not use
the word "evidence", and it did not help (T05: 14 calls). The final row uses Matt's words.

```diff
-| CMA / valuation | [`lib/cma/`](lib/cma/) + [`marketing_brain_skills/producers/cma/SKILL.md`](marketing_brain_skills/producers/cma/SKILL.md). Recorded in `public.cmas` + `cma_comps`. |
+| CMA / valuation | Comp search + count: [`lib/pricing/`](lib/pricing/) `ladder.ts`, `match.ts`; cover price `estimate.ts`. Letter: [`lib/cma/`](lib/cma/) chapters `opinion-*.ts`, evidence tables `status-*.ts`. Rulings: [`SKILL.md`](marketing_brain_skills/producers/cma/SKILL.md) (long: grep it). Recorded in `public.cmas` + `cma_comps`. |
+| Place page code | Sections: [`lib/site/`](lib/site/) `place-*.ts`, [`lib/place/`](lib/place/). Route-only: `app/<route>/[slug]/_v3/`. `page.tsx` is wiring: grep it. |
+| Listings, search box, map | Reads: [`lib/data/listings/`](lib/data/listings/). Map + price badges: [`components/SearchMapClustered.tsx`](components/SearchMapClustered.tsx). |
```

CLAUDE.md goes from 37,026 to 37,526 bytes, exactly its budget in
`scripts/claude-canon-baseline.json`.

- Each folder and the map file is a markdown link, so `ci:claude-canon` fails if one of
  them moves.
- The file names in backticks (`ladder.ts`, `status-*.ts` and the rest) are not checked
  by the gate. They were verified by hand on 2026-09-24.

**Measured effect** (tokens processed before reaching the target. Control = baseline plus
clean placebo runs.)

| Task | Control calls | Treatment calls | Control tokens | Treatment tokens | Change | Context added |
|---|---|---|---|---|---|---|
| T05 CMA evidence table | 12, 11, 16 | 4, 4 | 0.82M | 0.22M | -73% | 32.4K to 9.5K |
| T08 search box | 11, 8 | 3, 3 | 0.48M | 0.14M | -70% | 27.5K to 7.6K |
| T01 community title | 6, 7, 6 | 4, 5 | 0.33M | 0.14M | -57% | 18.2K to 7.7K |
| T04 CMA pricing | 28, 15, 17 | 11, 12 | 1.75M | 0.81M | -54% | 92.5K to 43.2K |
| T03 place FAQ | 10, 11, 8 | 7, 6 | 0.35M | 0.26M | -24% | 27.5K to 13.4K |
| **Written-from tasks** | | | **3.73M** | **1.58M** | **-58%** | |
| H1 place alert copy | 7, 4, 4 | 4, 3 | 0.23M | 0.14M | -38% | 15.2K to 8.2K |
| H4 map region | 3, 9 | 3, 6 | 0.28M | 0.18M | -34% | 20.8K to 9.3K |
| H3 price-drops count | 4, 4, 6 | 6, 4 | 0.20M | 0.18M | -8% | 13.4K to 9.5K |
| H2 CMA market chapter | 8, 9, 6 | 8, 9 | 0.32M | 0.48M | +47% | 26.3K to 17.6K |
| **Held-out tasks** | | | **1.03M** | **0.99M** | **-4%** | |

Control calls are listed as baseline run 1, baseline run 2, then placebo.

**What the A/B shows.**

- The placebo alone matched baseline: 3.98M against 4.01M tokens over the seven tasks it
  ran clean. Pasting the table into the prompt does not help by itself. The named files
  do.
- The first draft of the CMA row named `status-*.ts` but never the word "evidence".
  - It left T05 flat: 14 calls, -1%.
  - T04 still improved (-50%).
  - Naming the table the way Matt names it is what moved T05 to 4 calls.
- Held-out, the three tasks inside an area a row names dropped 30% (0.71M to 0.50M).
- The CMA market chapter, which no row names, took the same number of calls and more
  tokens.
- These pointers help where they name the file in the task's own words. They do not make
  agents faster in general.

**Follow-up, same day: two more pointers.**

- The CMA row now also names the market chapter: `listing-window-*.ts` + `market-charts.ts`.
- §5 now names the snapshot cron routes, `app/api/cron/marketing-snapshot-*`, instead of the
  snapshot `SKILL.md`.
- Paid for by removing §5's second link to `VOICE.md` (§2 keeps it). CLAUDE.md was 37,477
  bytes after this, and the budget in `scripts/claude-canon-baseline.json` was lowered to
  match.

Measured the same way: the table (H2) or §5 (T12) pasted into both arms, run against the tree
from before the edit.

| Task | Without: calls | With: calls | Without: context added | With: context added | Without: tokens | With: tokens |
|---|---|---|---|---|---|---|
| H2 CMA market chapter | 8, 9 | 5, 7 | 14.1K, 21.2K | 10.9K, 10.2K | 0.38M, 0.58M | 0.39M, 0.38M |
| T12 Meta ads snapshot | 6 | 6, 6 | 14.0K | 8.9K, 12.2K | 0.46M | 0.30M, 0.45M |

- H2 "without" is the two final-table runs from the A/B above. They had the three rows but no
  market chapter. With it, runs reached the file in fewer calls and added about 40% less
  context. Tokens fell 20% on average, on two runs per arm.
- T12 did not change. Every run took 6 calls, with or without the pointer, and it was never a
  costly path. One of the two runs with the pointer still read the snapshot `SKILL.md`.
- T12 "without" is one placebo run. The second grepped this report, which sat in the replay
  tree, one call before its target, so it is dropped. Four other runs found the report after
  reaching their target, which leaves their counts standing.
- Token totals do not line up with the A/B table above. The T12 runs here made 1 to 1.5 tool
  calls per turn, against 2 in the earlier T12 runs, and every turn re-reads the whole
  context, so T12's token counts rose in both arms.

## What these edits do not fix

- **The CMA market chapter** had no pointer when the A/B ran. The follow-up above added one.
- **Work after the target.** Finding the file took 13.6M of the 168.5M tokens processed in
  the baseline runs, 8% at the median. The other 92% went to what agents did after they
  arrived: tests, gates, history and callers. These replays pushed that on purpose ("find
  exactly where, with line numbers"), so real sessions may differ. It is still where most
  tokens go.
- **The 87 KB CMA `SKILL.md`.**
  - Before the edit, 4 of 6 baseline CMA runs read it before reaching any code, at 6K to
    64K characters per read.
  - With the final row, 1 of 6 treatment runs touched it first, with a grep of about 350
    characters.
  - It is still the canonical rulings file. Keeping the rulings at the top would make the
    grep land faster.

## Leads the replay agents raised, now fixed

The first version of this report listed five leads from the replay agents without checking
them. Each was then checked against `main` and fixed on this branch, with the related defects
found while checking. The commits below are on PR #364.

- **Texts deferred after 8pm came back two mornings later** (`eee548b0a`).
  - `nextSmsWindow` added a day after 8pm Pacific, but by then the UTC date has already
    rolled over. 21:00 PDT on 2026-09-24 returned 2026-09-26 16:05Z.
  - The same bug held evening market-report bulk sends a day (`nextEmailSendWindow`,
    `54d6a9086`).
  - The sequence editor and two help pages said texts go until 9pm. The rule is 8pm, and
    the editor now reads it from the rule (`4b49aa5a1`).
  - A text could still go out after 8pm. The quiet-hours check ran several awaits before
    the Twilio call, and the engine's :58 run could pass it at 7:59. It is now asked again
    right before the send in the sequence engine and the composer (`76f3a5d09`), and in
    cold prospecting (`4ce7e9785`).
- **Price drops** (`96d676ec5`, wording `7d56bbda7`).
  - Pages that say single-family listed condos, townhomes and manufactured homes, because
    the filter was property type `A`. It is now the `Single Family Residence` sub type, and
    alert sign-ups save the same filter.
  - The price-cut read stopped at 1,000 rows. It now pages.
  - A failed listing read was cached as an empty week for 30 minutes. It now throws, and a
    read that fails shows "Couldn't load right now" with no count.
  - City pages printed the number of cards shown instead of the total, and a hidden cap of
    40 per city cut under their own limit of 48. The weekly digest counted the capped list.
    The count is now the whole window and the page's limit is the only cap.
  - Both pages called `noStore()` on an empty week, which is an HTTP 500 inside a Next 16
    ISR render. A failed read now shortens the page's cache life with `refuseDegradedIsr`;
    a real empty week caches normally.
- **The desktop map-only view opened the region at a whole-number zoom** (`632addf81`).
  - Related: price badges for homes off the map were pulled onto the map's edge and piled
    up there. They now hide until their home is in view (`3407d4229`).
- **Gmail calls had no deadline** (`1d13861ff`).
  - Gmail sign-in now gets 10 seconds, and each CMA draft or send request 30.
  - A send that times out after it left may have gone out, so it no longer falls back to
    Resend, which could deliver the CMA twice. The broker is told to check Sent.
  - The same guard covers the BPO send and the CMA request confirmation.
- **The TC mail rules doc** missed the client-on-several-files exception (`35624f1db`).

Also fixed while checking:

- Search-box city counts came from a 250-row sample of text matches. They are now the exact
  count of homes the results page shows for that city (`4bcbbed1a`).
- The CMA's fallback comp search dropped the CMA's as-of date, which turns off the age
  penalty when it keeps the tightest comps. The main search already passed it (`948c864af`).
- Smaller: the mobile edit sheet's Add phone and Add email buttons (`b5d884fe6`), the
  listing page's parity file (`d9cab7216`), two dead pointers in `docs/README.md`
  (`6fbb232b3`), the loop brief now prints place-membership freshness (`66a336bb5`), and the
  snapshot `SKILL.md` described crons that no longer exist (`a2f205324`).

**Behavior changes to know about.**

- Texts held by the engine's daily carrier cap (500 by default) now wait for the next
  morning, as the hold's log line says. Before, the date bug made them re-check every 15 minutes.
- City price-drop pages list up to 48 homes. They asked for 48 and the hidden cap gave 40.
- City price-drop alerts now follow the single-family filter. Before, they covered every
  property type in the city.
- A CMA built from the fallback comp search now weighs comp age, like the main search.
- A Gmail send that times out is not sent again through Resend and is not marked delivered.

**Found while fixing, not fixed.**

- Other Google API clients with no timeouts: `lib/marketing-brain/inbox-reply.ts` and
  `inbox-poll.ts`, `lib/google-calendar.ts`, `lib/data/loop/gsc-api.ts`,
  `lib/newsletter/postmaster.ts`, `app/actions/search-console-report.ts`.
- `scripts/check-site-index-freshness.mjs` requires `/site-index` to call `noStore()` when
  empty, the same ISR 500 pattern.
- `ci:reachable-exports` (13 orphan modules) and `ci:shadcn-burndown` fail on `main`. None of
  the files they name are in this branch, and neither gate is in the CI chain.
- Twilio can still deliver a text posted at 7:59:59pm after 8pm.

## Decisions for Matt

Replay agents also raised these. Each one changes what the product does or reverses an earlier
call, so none was built before Matt answered.

### Decided 2026-09-24 and built

Matt picked the recommended option on all four. Commits are on
`claude/agent-navigation-efficiency-dp5zj5`, the follow-up PR after #364.

- **The new price on a listing's price-cut line (T06): "Add the new price."** The line
  now reads old price struck through, new price, "Cut $X", then percent and date
  (`PriceDropMark.tsx`, commit "the price-cut line prints the new price").
- **"Real estate" in community titles (T01): "Roll out, skip 2."** Every registered community
  is titled "{name} real estate | Homes for Sale | {city}, OR". Sunriver and Black Butte Ranch
  keep "{name} Homes for Sale" because their city pages already say "{place} real estate".
  Compound noindex slugs are unchanged. Mountain High keeps its count
  ("Mountain High real estate | 8 Homes for Sale | Bend, OR"), and one listing now reads
  "1 Home", not "1 homes". A registry sweep test holds the rule. The hand-copied
  `scripts/_seo-contact-sheet.mjs` is deleted.
- **Broker-picked comps (T04): "Keep uncapped."** No code change. The ruling is recorded in
  the CMA skill (§0.1) so it is not reopened.
- **Evidence price table (T05): "FlexMLS style."** One table: List, Sold and $/sqft across,
  Low, Avg, Median and High down each status (Closed, Pending, Active, Expired). The separate
  "Dollars a square foot" board is folded in. The ruling is recorded in the CMA skill (§0.2),
  and the letter-flow contract pins the layout.

Found while checking T05, not caused by it: the nightly int test
`lib/cma/page-safety.int.test.ts` fails on `main`. With 12 comparable sales, comp
addresses sit 2.3 to 2.4pt into the PDF's left margin. It is filed as its own task.

### Still open

- **Pending homes in the search box (T08).** Suggestions include Pending listings on purpose:
  the site's on-market statuses (`PUBLIC_ON_MARKET_STATUSES`) are Active, Active Under
  Contract and Pending. Dropping Pending means changing that rule. The city counts above
  follow the results page, which shows Active and Active Under Contract.
- **Deeper place FAQ questions (T03).** About half the questions added on 2026-09-22
  (`af236fac9`) are market figures again; the rest list names already on the page.
  Neighborhood pages already load schools, HOA dues, CC&Rs and build years that never reach
  the FAQ. A city-page test forbids HOA and school-district data in the city FAQ.
- **The region filling the desktop map (H4).** With fractional zoom the whole-region fit
  still keeps up to 128px of padding per side (`v3FitPadding`), so the tall region fills the
  height and only part of the width. Filling the width crops the top and bottom of the frame,
  where Madras and La Pine sit.
- **The loop brief seeding ranking work itself (T14).** The brief prints a hint to run the
  seeder by hand; the Monday cron (`loop-weekly-measure`) seeds. Seeding from the brief
  changes what every session's boot writes to the work graph, and `docs/RUN_LOOP.md` §7 would
  change with it.
- **Content inside the page's own hidden overlays (T11).** `0ea697108` counts rows that a
  modal manager hid (`data-aria-hidden`). Rows under the page's own `aria-hidden`, such as a
  closed overlay host, still count as zero. One replay argued those should count.
- **The Meta ads snapshot on a day with no ad delivery (T12).** It returns 200 with
  `empty: true`. Failing it instead would mark the snapshot failed every day while ads are
  off. The 2026-09-22 visibility audit found no Meta ads rows after 2026-06-19. `6303fd2ca`
  chose 200 on purpose.

## Appendix: the replay tasks

Each run got the same prompt around the ask:

- Find exactly where the change goes and reply with `FILES:` and line numbers.
- Read-only. No edits, builds, tests, commits or database queries.
- The session boot reads were already done.

Ground truth lists files the real commit changed. Opening any one of them counts as
reaching the target.

| ID | Ask | Commit | Ground truth |
|---|---|---|---|
| T01 | Community pages should put the words 'real estate' in the browser title, like 'Tetherow real estate'. Find where the community page title gets built. | `cf8f4c418` | `app/communities/[slug]/_v3/community-metadata.ts` |
| T02 | On the Bend city page, the NorthWest Crossing card in the communities rail shows no photo. Fix the card photo. | `f2d0d410d` | `lib/place/city-community-rail-photo.ts` |
| T03 | The FAQ on city and neighborhood pages just repeats the market pulse stats. I want deeper questions there. | `af236fac9` | `lib/site/place-faq-extras.ts` |
| T04 | The CMA price should come from the five tightest comparable sales, not the whole comp set. | `7842575df` | `lib/cma/comps.ts`, `lib/pricing/ladder.ts`, `lib/pricing/match.ts` |
| T05 | In the CMA evidence table, give each price (list, sold, price per square foot) its own column. | `ee0753914` | `lib/cma/status-price-summary.ts`, `lib/cma/render-css-sections.ts`, `lib/cma/immersive-css.ts`, `lib/cma/status-ppsf.ts` |
| T06 | On a listing page, a price cut should show as the two prices, old and new, not the little slope graphic. | `d49b0dbab` | `components/site/listing-detail/PriceDropMark.tsx`, `components/site/listing-detail/PriceCtaStrip.tsx` |
| T07 | On map search, the price badges spill outside the map frame and pile on top of each other where listings are dense. | `4d35fd9d0` | `components/SearchMapClustered.tsx`, `components/search/search-map-marks.css` |
| T08 | The site search box suggests sold homes. It should only suggest homes that are on the market. | `3c0d7c8d3` | `lib/data/listings/searchSuggestTiles.ts` |
| T09 | CRM Gmail calls sometimes hang forever. Every Gmail API call needs a deadline and a retry. | `f07ce4b11` | `lib/crm/gmail.ts` |
| T10 | Sequence texts from the CRM must never go out after 8pm Oregon time. | `32af7d2c4` | `app/api/cron/crm-sequence-engine/helpers.ts`, `app/api/cron/crm-sequence-engine/route.ts` |
| T11 | The content-floor CI check fails a page when a closed modal hides a section. A closed modal is page state, not a missing section. | `0ea697108` | `scripts/lib/content-floor.mjs`, `scripts/check-route-content-floor.mjs` |
| T12 | The daily Meta ads snapshot reports success even when no insights got written. It should fail in that case. | `6303fd2ca` | `app/api/cron/marketing-snapshot-meta-ads/route.ts` |
| T13 | In TC mail filing, a client who is on several transaction files gets dropped. That mail should be queued for review instead. | `173f45a17` | `lib/tc/mail-rules.ts` |
| T14 | When the site queue is empty, the loop brief should seed ranking work instead of reporting nothing to do. | `8a2c71e3a` | `scripts/loop-brief.ts`, `scripts/seed-gsc-ranking-queue.ts` |
| T15 | The testimonial quote avatar initials flash the wrong colors before they paint navy and cream. | `99a11374c` | `components/site/v3/V3Proof.client.tsx`, `components/site/v3/V3Proof.css` |
| T16 | The homepage 'browse places' photos need alt text that names the place. | `737eea893` | `app/_v3/HomeBrowsePlaces.tsx` |
| T17 | place_membership goes stale. It should stay current on its own, and the loop scoreboard should flag it when it falls behind. | `8e9fd3d3d` | `lib/data/loop/signals.ts`, `lib/data/loop/place-membership-freshness.ts` |
| T18 | In the admin CRM on a phone, the person Info section is cropped and the Add-phone button looks like a floating action button. Fix both. | `c67a32709` | `components/admin/crm/person-detail/PersonWorkspace.tsx`, `components/admin/shared/mobile/MobileContactPointsSection.tsx` |
| T19 | The listing detail page got a new section. Make the mockup-parity check require it so it can't silently disappear. | `635015027` | `design_system/ryan-realty/ui_kits/listing-detail/parity.json` |
| H1 (held-out) | The sticky 'get alerts' ask on city, community and neighborhood pages sounds robotic. Make it talk like a person. | `d98cef36f` | `lib/site/place-alerts.ts` |
| H2 (held-out) | In the CMA's market chapter, when prices rose while mortgage rates fell, the letter should explain the rise right beside the lower rate. | `b30f361b8` | `lib/cma/listing-window-market.ts`, `lib/cma/market-charts.ts` |
| H3 (held-out) | The price-drops page shows an empty window even though homes have dropped their price. Fix what it reads and the count it shows. | `b32f97c39` | `lib/data/listings/getPriceDrops.ts`, `lib/data/listings/getListingTiles.ts` |
| H4 (held-out) | On desktop map search, the service-area region doesn't fill the map. | `e657224c8` | `components/SearchMapClustered.tsx`, `components/search/MapSearchView.tsx` |
