# Voice canon migration — the end-to-end prompt

**Matt, 2026-08-05:** "I want to use the Buffett method. I want this to be a
comprehensive solution that covers any public-facing text. Scour my site, remove any
existing references to voice or any kind of voice references at all, so there is
absolutely nothing that conflicts and I don't ever run into what we're going through
right now again. Nuke any references to old voice models. Remove any existing rules
that were already in place for the voice. Any banned words, any whatever, all of it
gets nuked, and we replace it with this new voice."

Run this file end to end. It is written to be executed by an agent with no other
context. Do not summarize it back and stop; execute it.

---

## The one input

[`marketing_brain_skills/brand-voice/VOICE.md`](../../marketing_brain_skills/brand-voice/VOICE.md)
is the canon. Read it completely before touching anything. It is the ONLY source of
voice rules that survives this migration. Nothing is inherited from any older file:
not a banned word, not a category, not a "law," not a phrase list.

If any instruction below conflicts with the canon, the canon wins.

## What done means

1. Exactly one file in the repo defines voice. Every other one is deleted, and every
   reference to a deleted one is repointed or removed.
2. No banned-word list, tone rule, or style directive survives anywhere except as a
   projection of the canon. The old lists are gone, not merged.
3. Every public-facing string in the repo has been read and rewritten where it broke
   the canon. Public means anything a lead, client, or visitor reads: email bodies,
   SMS bodies, saved-search and listing-alert sends, report prose, page copy, LP
   copy, listing copy, sequence touches, PDFs, error and empty states.
4. Two mechanical gates exist and are wired: one that fails a commit on the banned
   constructions, one that fails a commit if voice doctrine reappears outside the
   canon file.
5. The Byron CMA and one email, one SMS, and one page are rendered and read to
   confirm the new voice landed.
6. Everything is committed and pushed, deploy verified.

Stop only for a genuinely destructive ambiguity. Errors, gate failures, and flaky
runs are yours to work through.

---

## Phase 1 — Discover

Do not trust any list, including the appendix at the bottom of this file. Build the
inventory fresh, because the repo moves.

Run these and keep the output as your working checklist:

```bash
# A. Voice doctrine documents (candidates for deletion)
rg -l -i "brand.?voice|voice.?guideline|tone of voice|voice_system|style guide" \
  --glob '!node_modules' --glob '!.next' --glob '*.md'

# B. Every reference to the files you are about to delete
rg -n "voice_guidelines|voice_system_v2|VOICE\.md|brand-voice/SKILL" \
  --glob '!node_modules' --glob '!.next'

# C. Voice doctrine hiding inside code as LLM prompts
rg -n -i "banned|no em.?dash|plain english|do not use|never use|brand voice|tone:|voice:" \
  lib/ app/ scripts/ --glob '*.ts' --glob '*.tsx' --glob '*.mjs' -g '!*.test.*'

# D. Public-facing copy surfaces
rg -l "subject|Subject" lib/crm/ lib/email/ app/api/ --glob '*.ts' | sort
rg -l "sendSms|messageBody|body:" lib/crm/ lib/agent/ --glob '*.ts' | sort
ls app/lp/*/page.tsx app/*/page.tsx components/site/**/*.tsx 2>/dev/null | sort

# E. Copy that lives in the DATABASE, not in files
#    (sequence touches, blog posts, saved-search alert templates)
grep -rn "crm_sequences\|sequence_steps\|blog_posts\|listing_alerts" docs/DATABASE_SCHEMA_SNAPSHOT.md | head -20
```

For the database copy: query the live tables, print every stored template body, and
treat each one as a rewrite target. Copy in a table is still copy the public reads.
Sequence touch bodies and any stored email/SMS template are in scope.

Write the assembled inventory to `docs/research/voice-migration-inventory.md` before
you change anything. That file is the audit trail and the checklist you work down.

## Phase 2 — Nuke

Delete outright. Do not merge, do not "preserve the good parts," do not leave a
tombstone file:

- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/brand-voice/voice_system_v2.md`
- Any other document Phase 1A surfaced whose purpose is to define voice, tone, or
  style, except the canon itself.

Rewrite, do not delete:

- `marketing_brain_skills/brand-voice/SKILL.md` becomes a thin router: what the
  skill does, when it fires, and a pointer to the canon. It must contain zero voice
  rules of its own. If it currently restates rules, that text dies.
- `CLAUDE.md` §2 collapses to a pointer. Keep only: the section exists, the canon
  path, the fact that the gate enforces it, and the trigger list of what counts as
  public text. Every rule, word list, and example moves out. §2 must not be a second
  place to look.
- Every producer, skill, and rule file that Phase 1B found citing a deleted doc gets
  its reference repointed at the canon. A dangling reference to a deleted file is a
  failure of this migration.
- Every LLM prompt Phase 1C found (report narrative prompts, agent system prompts,
  the CMA story engine, comp-judge narrative instructions, any drafting prompt) has
  its embedded style instructions replaced with the canon's rules. These prompts are
  voice doctrine hiding in code and are the most likely source of a future conflict.
  Where practical, have the prompt import a single exported constant rather than
  restating rules inline, so there is one place to change.

## Phase 3 — Rebuild the vocabulary from the canon only

`scripts/brand-voice-vocabulary.cjs` keeps its module shape, because nine consumers
import it (eslint config, the CI gate, the pre-tool-use hook, preflight, several
build scripts). Preserve every exported name. Replace every list's CONTENTS with the
canon's lists, derived only from `VOICE.md`. Nothing carries over because it was
there before: if a word is not banned by the canon, it is not banned.

Then add what the old lists could never catch, the sentence-shape patterns from the
canon's "Banned constructions" section:

- meaning-narration openers: "this tells you", "what this means", "in other words",
  "put simply", "this is history, not a forecast"
- sermon clauses: "which is one more reason", "and that matters because", "which is
  why it is so important"
- data-speaks constructions: numbers that "say", "tell", "reveal", or "prove"
- the throat-clear: "before the numbers", "let's take a look at"

Regenerate the gate baseline afterward. The baseline is allowed to move because the
rules changed underneath it; it may not move again after that without a fix.

## Phase 4 — Rewrite the copy

Work down the Phase 1 inventory surface by surface. For each file: read every
public string, apply the canon, rewrite what breaks it.

Order, highest reader-volume first:

1. **Reports.** `lib/cma/render.ts`, `lib/cma/immersive.ts`,
   `lib/cma/expired-audit.ts`, `lib/cma/development.ts`,
   `lib/cma/rental-potential.ts`, `lib/bpo/**`. Apply rule 2 hardest here: delete
   every sentence that explains the sentence before it. Apply rule 3: any judgment
   that survives moves inside a quote attributed to the signing broker.
2. **Email bodies and subjects**, including saved-search and listing-alert sends.
3. **SMS bodies**, including sequence touches. Leave the legally fixed consent text
   in `lib/crm/sms-consent-text.ts` alone.
4. **Landing pages** (`app/lp/**`), then site pages and site components.
5. **Database-stored copy**: sequence step bodies and any stored template. Write a
   migration or a one-shot script; do not hand-edit production rows without one.

Rewrite rules, non-negotiable:

- Never change a number, a source line, a citation, or a disclosure while rewriting
  prose. CLAUDE.md §0 outranks this migration. If a rewrite would drop a figure's
  trace, keep the trace and cut the adjectives around it.
- Legal and compliance text (consent language, fair-housing notices, the CMA's
  Oregon disclosure under OAR 863-015-0190, e-sign notices) is not a voice surface.
  Do not touch it.
- Shorter is the default outcome. If a rewrite is longer than the original, it is
  probably wrong.

## Phase 5 — Gate it so this cannot come back

Two scripts. Both wired into `ci:gates` in `package.json`, both with tests, both
following the AST-based pattern in `docs/MECHANICAL_GATES.md`.

**Gate 1 — banned constructions.** Extend `scripts/check-brand-voice.mjs` to fail on
the sentence-shape patterns added in Phase 3, not just words. Ratcheted like the
existing gate: the count may only shrink.

**Gate 2 — voice canon singularity.** New: `scripts/check-voice-canon.mjs`. It fails
the commit when voice doctrine exists anywhere except the canon. Concretely, it
fails when:

- a `.md` file outside `marketing_brain_skills/brand-voice/VOICE.md` contains a
  banned-word list, a "voice"/"tone" rule section, or a style-guide heading;
- any file references a deleted voice document by name;
- `CLAUDE.md` §2 grows past a pointer (assert a hard line-count ceiling on the
  section);
- a new `.md` file appears whose name matches voice/tone/style patterns.

Allowlist exactly one path: the canon. This gate is the mechanism that answers "I
don't ever want to run into this again." Without it, this migration decays.

Register both in `docs/MECHANICAL_GATES.md`.

## Phase 6 — Verify by reading, not by grepping

A passing gate is not proof the voice is right. Read the output.

1. Rebuild the Byron CMA through the full engine and read the whole document, both
   presentations: the immersive web view and `?print=1`. Every sentence that
   explains another sentence is a defect to fix now.
2. Render one email, one SMS, and one landing page. Read them the same way.
3. Confirm no figure changed anywhere. Compare the rebuilt report's citations blob
   against the pre-migration one: numbers identical, prose different.
4. `npm run build`, the full test suite, then the browser.

## Phase 7 — Ship

Commit per family, not one megacommit. Suggested boundaries: the nuke, the
vocabulary rebuild, reports, email and SMS, site and LP, database copy, the gates.
Push with `npm run push`, then verify the deploy. Update
`docs/plans/CROSS_AGENT_HANDOFF.md` when finished.

---

## Appendix — known inventory at the time of writing

A starting point, not a substitute for Phase 1. Verify each against the repo.

**Doctrine documents:** `marketing_brain_skills/brand-voice/VOICE.md` (the canon, now
rewritten), `voice_guidelines.md` (640 lines, delete), `voice_system_v2.md` (14
lines, already marked retired, delete), `brand-voice/SKILL.md` (219 lines, reduce to
a router).

**Enforcement:** `scripts/brand-voice-vocabulary.cjs` (245 lines, contents replaced,
exports preserved), `scripts/check-brand-voice.mjs` (580 lines, extended),
`eslint-rules/no-brand-voice-violations.js`, `.claude/hooks/pre-tool-use.mjs`,
`scripts/preflight.ts`, and the build scripts that import the vocabulary.

**Known doctrine in code:** the CMA story-engine prompt in
`lib/cma/subdivision-story.ts` (`STORY_SYSTEM`), the comparability-judge narrative
instructions in `lib/cma/judge.ts`, the prose reviewer in `lib/cma/voice-sanitize.ts`
and its caller. Expect more; Phase 1C is what finds them.

**Known copy in code:** `lib/cma/render.ts` and `lib/cma/immersive.ts` (heavy),
`lib/cma/expired-audit.ts`, `lib/cma/development.ts`, `lib/cma/rental-potential.ts`,
CRM composers under `lib/crm/`, the listing-alert send path, `app/lp/*/page.tsx`,
`app/**/page.tsx`, `components/site/**`.

**Known copy in the database:** CRM sequence step bodies, `blog_posts`, and any
stored alert template. Query before assuming.

**The stale-rule example that proves why this is needed:** the pre-migration
`VOICE.md` named `541.213.6706` as the primary public phone. That number is the
private forward target; the public number has been `541.703.3095` since the 2026-06-24
Twilio cutover. A duplicate doc drifted from the truth and nobody caught it. One
canon, enforced by a gate.
