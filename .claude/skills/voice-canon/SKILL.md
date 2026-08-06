---
name: voice-canon
description: Drive every public-facing word in the codebase to the Buffett voice canon. Runs the violation scanner, works the ranked worklist down to zero, verifies by rendering, and ships. Use when Matt says "run voice canon", "fix the voice", or after any voice rule changes.
---

# Voice canon — the grinder

Matt, 2026-08-05: *"I need this to be thorough, take the entire code base into
account."* / *"A hard coded gate, anytime any content or copy is created it is run
through this voice. Period."* / *"The marketing brain is also required to use this
voice, every fucking thing."*

*"I want this to be something that can just grind until done."*

This is not a reading assignment. It is a grinder: one number, driven to zero, one
file at a time, resumable across sessions. A firing that fixes one file and stops is
a failure. Chain files until a stop condition below actually fires.

## The number

```bash
npm run ci:voice-constructions:next        # THE GRINDER'S COMMAND: the next file + its fixes
npm run ci:voice-constructions:report      # every violation, file:line, with the fix
npm run ci:voice-constructions:worklist    # the same, ranked JSON, worst file first
npm run ci:voice-constructions             # the gate: shrink-only ratchet
```

`--next` prints one target and its violations, or `DONE · 0 violations` when the
work is finished. That single command is the whole loop condition: run it, fix what
it names, run it again. Never ask which file to do next; the command answers.

The scanner walks the **entire repository** (3,052 files at last count), skipping
only build output, tests, admin surfaces, and the directories listed in
`SKIP_TOP` inside `scripts/check-voice-constructions.mjs`. Anything else that holds
a string a member of the public could read is in scope, including the marketing
brain, every producer SKILL.md, client documents, email and SMS builders, landing
pages, and the content registries.

`--worklist` is your task list. Each entry is `{file, count, hits[]}` and each hit
carries `line`, the canon `rule` it breaks, a `label`, the offending `snippet`, and
a `fix` instruction. You do not need to guess what is wrong.

## The canon

[`marketing_brain_skills/brand-voice/VOICE.md`](../../../marketing_brain_skills/brand-voice/VOICE.md).
Read it once before the first edit. It is the only voice document in the repo, and
`scripts/voice-constructions.cjs` is its machine-readable form.

The rule you will apply most: **state the fact, then stop.** Delete any sentence
whose job is explaining the sentence before it.

## Grind semantics

**Keep going until one of these fires, and name which one when you stop:**

1. `npm run ci:voice-constructions:next` prints `DONE · 0 violations`.
2. **Context nearly spent.** Finish the file in hand, commit it, append the count
   and the next target to `docs/plans/ADMIN_PRODUCT/progress.txt`, push, stop. A
   fresh session runs `/voice-canon` and resumes from the number.
3. **A decision only Matt can make** (a legal string, a claim that needs his
   judgment, a pattern you believe is wrong). Log it, skip that file, keep grinding
   the rest. Do not stall the whole run on one file.

Anything else — a failing test, a gate, a flaky run, an unfamiliar file — is yours
to work through, not a reason to stop.

**Batch the commits, not the work.** Commit every 5 to 10 files, or at a surface
boundary, whichever comes first. Push whenever a batch is green. Never hold 40 files
of edits in an uncommitted tree.

## The loop

Repeat until `--next` says DONE. Each pass:

1. **Ask what is next.**
   ```bash
   npm run ci:voice-constructions:next
   ```
2. **Read the whole file, not just the flagged lines.** The scanner finds shapes it
   has patterns for. A file with three flagged sentences usually has five bad ones.
   Fix the flagged and the obvious neighbours in one pass.
3. **Rewrite against the canon.** Delete interpretation, keep every fact. If a
   judgment genuinely has to survive, move it inside a quote attributed to the
   signing broker (rule 3). Shorter is the normal outcome; if your rewrite is
   longer, it is probably wrong.
4. **Never change a number, a citation, a source line, a legal disclosure, or a
   consent string.** CLAUDE.md §0 outranks this work. See the exclusions below.
5. **Update the tests that assert the old copy.** A test asserting a banned
   sentence is a test that encodes the bug. Change the assertion to the new copy.
6. **Verify the file still compiles and its tests pass.**
   ```bash
   npx tsc --noEmit -p tsconfig.json
   npx vitest run <the file's test>
   ```
7. **Re-run `--next`.** The number must be lower than the previous pass. If it is
   not, you did not actually fix the file: read the snippet again, it is still
   there. Then immediately start the next file. Do not stop to report progress
   between files.

When the number stops moving because the remaining hits are false positives,
do **not** widen the exemption list to make them disappear. Either the pattern is
wrong (fix `scripts/voice-constructions.cjs`, regenerate the mirror with
`node scripts/gen-voice-constructions.mjs --write`, and say so in the commit) or
the copy is genuinely bad. Silencing a true positive is the failure mode this whole
system exists to prevent.

## Surfaces the scanner cannot see

Three, and each needs its own pass. They are not optional.

**1. Copy stored in the database.** The scanner reads files. These rows are read by
the public:

```bash
node --env-file=.env.local -e '
import("@supabase/supabase-js").then(async ({createClient}) => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
  for (const [t, cols] of [["crm_templates","key, channel, subject, body"], ["crm_sequences","key, steps"], ["blog_posts","slug, title, excerpt"]]) {
    const {data} = await sb.from(t).select(cols).limit(200)
    console.log("=== " + t + " ===", JSON.stringify(data, null, 1).slice(0, 4000))
  }
})'
```

Run each stored body through the runtime checker before and after rewriting:
`checkBrandVoice(body)` from `lib/voice/check.ts` returns the same violations the
gate does. Write changes through a migration or a one-shot script, never by hand in
production. `scripts/voice-rewrite-batch.ts` already reads `blog_posts` and
`crm_templates` and writes an advisory report; use it rather than rebuilding it.

**2. Prompts that tell a model how to write.** These are voice doctrine hiding in
code, and they are how bad copy regenerates after you fix it. Find them:

```bash
rg -n "system:|SYSTEM =|Never use|Never write|no em.?dash|Voice:" lib/ app/ --glob '*.ts' -g '!*.test.*'
```

Every one must carry the canon's rules, not its own hand-typed list. Known
instances already repointed: `lib/cma/subdivision-story.ts` (`STORY_SYSTEM`),
`lib/cma/judge.ts`, `lib/voice/reviewer.ts`. Expect more in the brain.

**3. Anything generated at request time.** The immersive CMA renders per request
from stored `render_args`, so fixing `lib/cma/immersive.ts` changes every existing
document with no rebuild. The print artifact is stored, so it needs a rebuild to
change. Know which one you are looking at before concluding a fix did not work.

## Never touch

- `lib/crm/sms-consent-text.ts` — carrier-verified A2P wording. `ci:sms-consent`
  fails the build if it changes. Rewriting it means re-filing the campaign.
- Legal text: the Oregon Initial Agency Disclosure in `lib/crm/email-signature.ts`,
  the ORS 696.010/696.290 notice in `lib/bpo/render.ts`, the CMA's OAR
  863-015-0190 disclosure, everything in `components/legal/`.
- `lib/testimonials.ts` — verbatim client reviews. Someone else's words, exempt by
  the canon's own scope rule. Rewrite the page copy around them, never the quotes.

## Verify by reading, not by grepping

A zero on the scanner means no *known shape* survives. It does not mean the writing
is good. Before declaring done:

1. Rebuild a CMA and read the whole thing, both presentations (the immersive web
   view and `?print=1`).
2. Render one email, one SMS, and one landing page, and read them the same way.
3. Confirm no figure moved: compare the rebuilt document's citations against the
   previous version. Numbers identical, prose different.
4. `npm run build`, the full suite, then the browser.

## Resuming

State lives in two places, both on disk, so a cold session needs no chat history:

- `scripts/voice-constructions-baseline.json` — the count at last commit.
- `docs/plans/ADMIN_PRODUCT/progress.txt` — the running ledger.

A fresh session: read this file, run `npm run ci:voice-constructions:next`, and
start grinding. Nothing else is needed.

Every time the count drops, re-baseline so the ratchet locks the gain in:

```bash
npm run ci:voice-constructions:baseline
```

That is what makes the progress permanent. Without it the gate still allows the old,
higher count.

## Ship

`npm run push`, then verify the deploy. Batch commits by surface family (client
documents, email, SMS, landing pages, site, brain, database). Append what you did
to `docs/plans/ADMIN_PRODUCT/progress.txt`.

## Why the gate cannot be skipped

Two enforcement points, both already wired:

- **Commit time:** `ci:voice-constructions` in `ci:gates` and the pre-commit hook.
  Ratcheted, so the count may only shrink.
- **Runtime:** the same patterns run inside `lib/voice/check.ts`, the single
  chokepoint every content path calls and blocks on (blog save, CMA build, BPO
  build, social publish, CRM templates, newsletters). `ci:voice-send-paths`
  AST-verifies each path both calls it and gates the send on the result, so a new
  content path cannot forget.

`scripts/gen-voice-constructions.mjs` keeps the in-bundle mirror
(`lib/brand-voice/constructions.ts`) identical to the `.cjs` source, and
`ci:voice-constructions-parity` fails the commit if they drift.
