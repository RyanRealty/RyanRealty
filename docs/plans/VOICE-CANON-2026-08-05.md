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

### Phase 4 target map (audited 2026-08-05)

About 588 files carry public copy, plus three database tables. Work them in this
order. Counts are real; verify before trusting.

| Surface | Files | Notes |
|---|---|---|
| Client documents | 18 | `lib/cma/render.ts`, `immersive.ts`, `render-blocks.ts`, `register-gate.ts`, `expired-audit.ts`, `development.ts`, `rental-potential.ts`, the three `zoning-*.ts` explainers, `lib/bpo/render.ts`, `narrative.ts`, `send.ts`, and five `lib/pdf/*` documents |
| Email | 13 | `lib/email/shell.ts` is THE shell every client email inherits, so it is the highest-leverage single file. Then `lib/crm/listing-alert-email.ts` and `market-report-email.ts` (the saved-search sends Matt named), `lib/newsletter/produce-draft.ts`, `lib/tc/signing-emails.ts`, `lib/cma-deliver.ts`, `lib/cma/request-emails.ts`, `lib/email-templates/*` |
| SMS | 2 + DB | `app/api/twilio/inbound-sms/route.ts` HELP/STOP/START replies. Bodies live in `crm_templates`. |
| Landing pages | 25 | `app/lp/**` plus `lib/lead-landing-content.ts`, the registry driving `/buy/[intent]` and `/sell/[intent]`. `app/lp/tetherow/page.tsx` alone is 1,715 lines. |
| Site pages | 119 | `app/**/page.tsx`, public only. Admin-gated pages under `app/dashboard/marketing/**`, `app/marketing/request`, `app/dev/**`, `app/team/[slug]/edit` are staff tools: skip them. |
| Error and empty states | 10 | `app/error.tsx`, `global-error.tsx`, `not-found.tsx` + `components/NotFoundClient.tsx`, and seven per-route `error.tsx` files |
| Site components | 152 | `components/site/**`. The `kb/` section library (24 files) renders across the homepage and every geo page, so it pays first. |
| Other public components | ~220 | `components/{landing,seller-lp,geo-page,broker,city,community,neighborhood,search,account,dashboard,auth,pulse,tools,reports,listing,listing-detail,compare,videos,legal,tc/pdf-sign}/**`. Skip `components/ui/**` (primitives, no prose) and `components/console/**` (admin only). |
| Content data | 38 | `lib/city-content.ts`, `lib/community-content.ts`, `lib/community-seo-content.ts`, `app/faq/data.ts`, `data/co-{events,parks,trails,venues,schools}.ts`, `data/golf-landing.ts`, and 27 `data/resort-community-*.json` files |
| Share and meta | 3 | `app/api/og/route.tsx`, `app/llms.txt/route.ts`, `lib/share-metadata.ts` |
| Database | 3 tables | `crm_templates` (email + SMS bodies), `crm_sequences.steps` (inline subject/body), `blog_posts`, plus `newsletters` drafts |

`scripts/voice-rewrite-batch.ts` with `lib/voice/reviewer.ts` already reads
`blog_posts` and `crm_templates` and writes an advisory report. Use it for those two
tables instead of writing something new. It does not reach `crm_sequences`, the CMA
and BPO prose, or the email files, so those are hand work.

### Do not touch, three exclusions

1. **`lib/crm/sms-consent-text.ts`** is carrier-verified A2P wording. `ci:sms-consent`
   fails the build if it changes. Rewriting it means re-filing the campaign.
2. **The Oregon Initial Agency Disclosure line** in `lib/crm/email-signature.ts`, the
   ORS 696.010/696.290 notice in `lib/bpo/render.ts`, the CMA's OAR 863-015-0190
   disclosure, and everything in `components/legal/**` are legally worded. They need
   legal sign-off, not a voice pass.
3. **`lib/testimonials.ts`** holds 25 verbatim Google review quotes. They are the
   client's words, exempt by the canon's own scope rule. Rewrite the page copy around
   them, never the quotes.

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

## Appendix — verified inventory (audited 2026-08-05)

A full repo audit ran when this prompt was written. Verify each item, but nothing
below is a guess. Phase 1 exists to catch what moved since.

**Doctrine documents to delete:**
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (640 lines, the old "single
  source of truth," still asserts a retired 6-attribute model)
- `marketing_brain_skills/brand-voice/voice_system_v2.md` (14 lines, already a
  retirement stub)
- `design_system/ryan-realty/preview/voice-rules.html`, `voice-banned.html`,
  `voice-canonical.html` (rendered duplicates of the retired models)
- `social_media_skills/meme_lord/voice_grader.md` (its own banned list; cites a
  manifesto that no longer exists) and `humor_calibration.md` (fold anything worth
  keeping into the canon first, then delete)

**Doctrine sections to strip out of otherwise-live files:**
- `marketing_brain_skills/brand-voice/SKILL.md` (219 lines) becomes a thin router
- `CLAUDE.md` §2 collapses to a pointer
- `design_system/ryan-realty/SKILL.md` lines 39-67 hold a THIRD framework ("Four
  rules") with its own banned list that still bans `turnkey`, un-banned in 2026-06-02
- `design_system/ryan-realty/MANIFEST.md` lines 89-111, same framework again, and its
  producer mandate-load claim is already factually wrong
- `skills/youtube-market-reports/brand-system.md` §4, a fourth restatement, bans
  `turnkey`, `spacious`, `cozy`
- `.cursor/rules/blog-voice.mdc` keeps its 3 blog-specific phrases, drops the stale
  description of the retired canon
- `.auto-memory/memory_marketing_brain_decisions.md` line 20 still names the retired
  5-attribute model as live. Agents read this file for cross-session context, so a
  stale rule here reinfects future sessions. Fix it or delete the line.

**Voice doctrine in code (each has its own hand-typed list that drifts):**
- `lib/cma/judge.ts` lines 219-221, comp-judge narrative prompt. Bans `turnkey` and
  `luxury`/`premium`; canon bans neither by that name.
- `lib/cma/subdivision-story.ts` `STORY_SYSTEM`, the neighborhood-story prompt.
- `lib/cma/rental-potential.test.ts` lines 479-485, a test asserting its own list.
- `.tmp_env/fub-setup/27-wire-plan-content.mjs`, dormant one-off with a stale list.
- `lib/voice/reviewer.ts` runs an Orwell-rules advisory pass. Keep the mechanism,
  re-point its rules at the canon.

**References to repoint:** 128 files cite `voice_guidelines.md` and/or `VOICE.md`.
The bulk are producer and social SKILL.md files (26 + 28) plus historical audit docs.
**The producer gate no longer requires the deleted file:** `validate-producer.mjs`
was repointed to require `VOICE.md` in an earlier wave, and a prior audit proved the
gate passes with `voice_guidelines.md` off disk. So those citations are vestigial
prose and can be stripped in bulk. Leave dated historical records alone; they are
records, not instructions.

**Two pre-existing defects to fix while in here:**
1. 22 files cite `ANTI_SLOP_MANIFESTO.md`, which was deleted and does not exist.
2. At least 15 files cite "CLAUDE.md §3" for brand voice. Brand voice is §2; §3 is
   the design system. Includes live code: `lib/crm/templateVoiceCheck.ts`,
   `lib/crm/market-report-email.ts`, `lib/crm/listing-alert-email.ts`,
   `scripts/brand-voice-vocabulary.cjs`, `docs/MECHANICAL_GATES.md`.

**Enforcement already unified (do not rebuild, only re-point):**
`scripts/brand-voice-vocabulary.cjs` is the single vocabulary source, mirrored into
`lib/brand-voice/generated-vocabulary.ts` and a Python mirror, with parity enforced by
`ci:voice-vocab-parity`. Runtime hard-fail scanning is centralized in
`lib/voice/check.ts` and gated by `ci:voice-send-paths`, which AST-verifies each send
path both calls the check and blocks on failure. `.claude/hooks/pre-tool-use.mjs`
refuses writes containing banned tokens.

**The parity manifest has four holes** that are exactly the drift points above:
`lib/cma/judge.ts`, `lib/cma/subdivision-story.ts`, `lib/cma/rental-potential.test.ts`,
and the dormant `.tmp_env` script are not in `CONSUMER_MANIFEST`. Add them.

**The stale-rule example that proves why this is needed:** the pre-migration
`VOICE.md` named `541.213.6706` as the primary public phone. That is the private
forward target. The public number has been `541.703.3095` since the 2026-06-24 Twilio
cutover. A duplicate doc drifted from the truth and nobody caught it. One canon,
enforced by a gate.

**Do not sweep up:** `lib/voice/alignment.ts` and `scripts/_voice_lib.py` govern the
ElevenLabs TTS voice (audio), not writing style.

---

## Progress log

Work completed before this prompt was handed off, so a fresh agent does not redo it:

- Canon written: `marketing_brain_skills/brand-voice/VOICE.md`, Buffett-anchored.
- Phase 4, reports: prose rewritten in `lib/cma/immersive.ts`, `lib/cma/render.ts`,
  and the failed-ask client note in `lib/cma/expired-audit.ts`. Aphorism pairs,
  meaning-narration, sermon clauses, and drama headers removed. Tests updated, 648
  passing.
- Phase 2, in-code doctrine: `STORY_SYSTEM` in `lib/cma/subdivision-story.ts`
  rewritten against the canon.

Everything else in Phases 1 through 7 remains.

---

## Recovery run, 2026-08-06 — finishing the stranded rewrite

The rewrite was dispatched across 13 background agents on 2026-08-06. The Claude
Code process exited while all 13 were mid-task, so their edits are on disk and
uncommitted, and none of them reached the end of its file list. Their transcripts
survive at `~/.claude/projects/-Users-matthewryan-RyanRealty/dfae0324-.../subagents/`.

**Measured state at pickup**, not claimed: 97 files dirty, 646 files assigned.
Per-agent landed-vs-lost, computed from the transcripts against `git status`:

| Agent | Edits landed | Stopped at |
|---|---|---|
| portal auth + states | 24 | running the brand-voice check |
| remaining site components | 15 | "next batch: RelatedAreas, ResortCommunities, ReviewsBlock" |
| root components | 14 | starting the verification suite |
| geo pages | 12 | the duplicate "homes for sale" construction |
| site page prose | 11 | the commission section |
| legal pages + blog | 1 of ~30 | applying its first edits |
| content registries | 1 of ~12 | `data/golf-landing.ts` |
| remaining LPs | 0 | about to edit `app/lp/tetherow/page.tsx` |
| CMA publication gate | 0 | still reading the architecture |

### What done means for this run

1. The canon→vocabulary projection is mechanically proven, so the gate cannot be
   green for the wrong reason again.
2. Every public surface the 13 agents never reached is rewritten to the canon.
3. Gates green, typecheck clean, and the result read in a browser rather than
   asserted from a diff.
4. Committed and pushed.

### Root cause fixed first

`VOICE.md` line 178 bans six self-praise terms. `brand-voice-vocabulary.cjs`
projected three. `lead="Honest answers to the questions Bend buyers and sellers
ask us every week"` therefore shipped live on `/faq` while `ci:brand-voice`
reported clean. The vocabulary file's contract was only ever enforced downstream
(canon → consumers, by `ci:voice-vocab-parity`); upstream (canon → vocabulary) was
enforced by nobody. `PROJECTION_REQUIRED` + the assertion in `check-brand-voice.mjs`
close it, and the check is verified by deliberately removing a term and confirming
exit 1.

### Outcome, 2026-08-06

Shipped `03105634..cd874778`, 12 commits. Twelve agents over disjoint file sets,
every report verified against the diff rather than taken at its word.

Three gates added, each because something had already shipped past the existing
ones:

| Gate | Catches | Found because |
|---|---|---|
| canon→vocabulary projection | a VOICE.md term absent from the machine list | "Honest answers" live on /faq, gate green |
| `affordance-instruction` | copy explaining that a control works | "Click any dot" on nine route families |
| `reassurance-no-receipt` | character claims with nothing behind them | "No pressure" on twelve pages |
| `ci:private-phone` | a demoted number republished | 541.213.6706 live on three client surfaces |

Two findings outrank the copy work and are worth reading on their own:

1. **The city map contradicted itself.** `app/cities/[slug]/page.tsx:183` queried
   all property types while the subtitle promised single-family, which is why the
   map badge read 1,000 beside a hero reading 491. The sentence moved to match the
   data, because that query also feeds a ticker and two other consumers.
2. **The private forward number was published.** Golf landing page with a live
   `tel:` link, the Tetherow broker block, and the e-signing page. Its own test
   asserted the old number as "brand-locked."

**Open, needs Matt.** `buildRegionNarrative()` in
`app/housing-market/central-oregon/page.tsx` and `buildNarrative()` in
`app/housing-market/[...slug]/page.tsx` generate unattributed market-behavior
judgments ("Buyers have more room to negotiate on price and terms"). Rule 3 says
a judgment goes in a quote under a name. There is no attribution component on
those pages to reuse, so a compliant fix is a product decision, not a word swap,
and nobody should put words in a broker's mouth without asking.
