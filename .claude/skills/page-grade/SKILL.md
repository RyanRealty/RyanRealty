---
name: page-grade
description: >-
  Grade every unique public page plus one exemplar per template against
  PAGE-GRADE.md v2.4. Family strip at merge (one shop, five place rhythms).
  Grade wave writes no product code. Then fix every open class, then regrade.
  Use when Matt says "page grade", "run the grind", "run the grade",
  "next version of the site", "UI/UX loop", or "/page-grade".
  NOT a 143-route dump. NOT a second Public Product OS.
---

# Page Grade — look, then fix, then look again

The rubric is `docs/plans/PUBLIC_PRODUCT/PAGE-GRADE.md` (v2.4).
Openings live in `design_system/public/PUBLIC_UI.md` §3.
Universe is `docs/plans/PUBLIC_PRODUCT/grade-universe.json`.
Ledger is `docs/plans/PUBLIC_PRODUCT/grade-ledger.json`.
The board is still `docs/plans/ADMIN_PRODUCT/EXECUTION.md`.

`experience-rollout` stays superseded. `public-product-os` still owns
the locks. This skill does not reopen IA or invent a seventh pattern.

**Two waves, one grind.** Graders look and score. They do not write
product code. After merge, a fix wave takes every open class in one
pass (parallel agents, exclusive file ownership). Then regrade the
universe. Repeat until universe P0 is 0 or Matt says stop. A score is
not a redesign license. Do not stop after one class.

## What you were about to miss

Scoring every city, every master-plan, and every listing is the
classifier dump already named in PUBLIC-PRODUCT-OS.

Scoring eight isolated URLs missed two things Matt named: the site must
be one shop, and city / neighborhood / master-plan / subdivision /
listing each have their own rhythm. Tetherow is the master-plan
exemplar, not a one-off product.

Grading and then editing in the same agent makes the score the homework
of the person who will change the page. Keep the waves split. Chain them.

## Universe (always)

Read `grade-universe.json`. That is the set. Unique public pages plus
one live exemplar per template. Account is a signed-in firing. Admin is
a later firing. Listing URL aliases are one listing family.

Say the family, then the exemplar: **master-plan (exemplar Tetherow)**,
not "Tetherow."

Beat matrix runs only on `beat_on` in that file, never on every unique
page.

## Orient (every firing, cheap)

1. Read PAGE-GRADE.md v2.4 and PUBLIC_UI.md §3. Do not rescore from memory.
2. Read `grade-universe.json` and `grade-ledger.json`.
3. Glance EXECUTION.md. Do not remount chrome.
4. Print ≤5 bullets: universe P0 count, top open class, one-shop /
   wrong-grain, Beat trails, last SHA. Then grade.

## One revolution

```
ingest ledger + universe
  → one capture process writes 390 then 1280 PNGs (cookie still up)
  → dispatch one grader agent per universe route, same turn
  → each grader writes only its card file
  → conductor family strip (mandatory) → merge cards → ledger
  → report one block
  → if Matt said "grade only": STOP
  → fix wave: every open class in one pass (product skill, not this wave)
  → regrade the universe
  → repeat
```

Do not open `app/`, `components/`, or `lib/` in the grade wave.
Do not add a gate. Do not remount `V3Chrome`. The quieter control is
named on the punch so the fix wave has a target.

## Parallel

| Seat | Who | Writes |
|---|---|---|
| Conductor | Capture in **one** Playwright process. Dispatch. Family strip. Merge. Report. Chain the fix wave. | `grade-ledger.json`, `progress.txt` |
| One grader per universe route | Score that route only. Hunt. Beat only if the route is in `beat_on`. | `looks/<date>-page-grade/cards/<slug>.json` only |
| Fix agents (after merge) | One class or exclusive file slice. Load the product skill. Parallel OK when paths do not overlap. | The files that class needs. Pathspec only. No `git add -A`. |

**Hard split.** Two graders never share a route. No grader writes the
ledger, `progress.txt`, another card, or product code. Capture stays
serial. Many Chromiums at once OOM.

**Family strip (conductor, required).** Lay the 390 first screens in
one row: home, search, city, neighborhood, master-plan, plat, listing,
sell, market, about. Same shop? Auto-fail 26 if not. Can a stranger
name each place grain? Auto-fail 27 on the confused crop. Graders
cannot pass these. They do not see the strip.

**Card schema** (one file per route, no prose wrapper):

```json
{
  "route": "/communities/tetherow",
  "grain": "master-plan",
  "thing": "Tetherow houses + belonging",
  "verdict": "FAIL",
  "auto_fails": [1, 27],
  "axes": {
    "job": 3, "path": 3, "opening": 2, "distinct": 3,
    "craft": 4, "motion": 2, "perf": null,
    "honesty": 6, "reach": 4, "simple": 4, "quiet": 2, "beat": 3
  },
  "path": { "start": "", "now": "", "next": "", "finish": "", "back": "" },
  "copy_words": 18,
  "clutter": 8,
  "send": false,
  "punches": [{ "sev": "P0", "defect": "", "better": "" }],
  "beat": { "zillow": { "thing_first": "TRAIL", "must_win": "TRAIL" } },
  "evidence": ["docs/plans/PUBLIC_PRODUCT/looks/..."]
}
```

`perf` is `null` unless that agent measured it. Do not invent ms.
Unknown Beat seats are omitted, not guessed. `grain` is required on
every place and listing card.

**Merge.** Conductor writes one-shop and wrong-grain from the strip,
then ranks `open_classes` (reach × routes × Beat trail × grain miss).
One report block.

## Matt language

| Matt says | Unit |
|---|---|
| `page grade` / `run the grind` / `/page-grade` | One revolution: grade universe → family strip → fix every open class → regrade. |
| `grade only` | Grade universe. Family strip. Ledger. Stop. |
| `grade /cities/bend` | That family only. Still run the strip against the other grain exemplars on disk. |
| `beat matrix` | Beat on `beat_on` only. |
| `admin grade` / `account grade` | That battery only. Do not mix. |
| `fix <class>` | Fix wave only. Then regrade the class routes. |

## Hard refuses

- Product code, primitive, chrome edit, or copy rewrite in a grade wave
- Score all 143 public + 160 admin routes, or every master-plan URL
- Treat Tetherow as a one-off product
- Collapse city / neighborhood / master-plan / subdivision into "Places"
- Mark GREEN, or average a FAIL into a 7
- Copy Zillow / Cascade / Compass chrome
- Reopen process / IA locks, or add a seventh v3 pattern
- Restore KB / v2 / explore registers
- Remount `V3Chrome` on a page
- Claim Beat without equivalent-URL PNGs
- Invent a Lighthouse number
- `git add -A` (this tree is dirty with other sessions)

## Better control

Every punch names the quieter control (PAGE-GRADE.md § Quiet). Do not
add helper text, a tooltip, or a second CTA as the *named* fix. Grain
misses name the locked opening in PUBLIC_UI.md §3, not a new pattern.

## Flush

Update `grade-ledger.json`: `last_run`, per-route scores, `open_classes`,
`one_shop`, `wrong_grain`, Beat cells, look paths. Append one line to
`docs/plans/PUBLIC_PRODUCT/progress.txt`. Grade wave: ledger and looks
only. Fix wave: pathspec commit when Matt asked to ship, never `git add -A`.

## Report (one block)

Universe P0 count · one-shop pass/fail · wrong-grain list · verdict per
route · top class · Beat must-wins WIN/TRAIL · what the fix wave will
touch. No essay.
