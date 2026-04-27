# Data Accuracy — ABSOLUTE, NON-NEGOTIABLE (READ FIRST)

**Every number that leaves this shop must be verified against the source of truth before it goes in front of a human, a social feed, an email, an MLS, a website, a video, a chart, a report, or a listing document.** No exceptions. Matt is a licensed principal broker. Publishing inaccurate data — price, inventory, DOM, YoY, sale-to-list, absorption, neighborhood stats, anything — is a compliance risk to Ryan Realty's license. This rule outranks speed, style, cost, and every other instruction in this file.

## What "verified" means (mandatory checklist before publish, send, or render)

1. **Name the source.** Every stat must trace to one of: live Supabase (`ryan-realty-platform`, table + filter documented), MLS direct pull, official agency data (ORMLS, NAR, Case-Shiller, OHCS, Census, BLS, FRED), or a linked primary-source URL. "I remember" is not a source. LLM-recall numbers are not a source.
2. **Pull the query fresh.** Re-run the SQL/API call in this session. Never reuse a hard-coded value from a prior script without re-confirming.
3. **Print the raw result.** Show the row counts, the date window, the filter (`PropertyType='A'` for SFR, geography, status, close-date range). The number in the deliverable must equal the number in the printout.
4. **Cross-check math.** Derived stats (months of supply, YoY %, absorption, median, price/sqft) get recomputed and the computation is shown. Market classification (seller/balanced/buyer) must match the actual months-of-supply number against the ≤4 / 4–6 / ≥6 thresholds.
5. **Reconcile narrative to data.** Every sentence, subhead, verdict, and pill has to be consistent with the number it sits next to. A "seller's market" verdict next to 4.3 months of supply is a fail.
6. **QA the rendered output.** For video or image deliverables, capture stills of every scene and visually confirm the displayed number matches the verified number. For text, grep the draft for every figure and map each to the source row.
7. **If a stat can't be verified, it doesn't ship.** Cut it. Don't estimate. Don't round-fill. Don't "approximate." The deliverable goes out with fewer numbers rather than one wrong one.

## What triggers this rule

Any deliverable containing market statistics, listing data, financial figures, neighborhood claims, competitive comparisons, or historical comparisons — including market reports, social video, email newsletters, blog posts, landing pages, listing descriptions, IG/TikTok/FB captions, printed flyers, video thumbnails, open-house signage, CMAs, seller net sheets, and anything else that goes to a consumer, client, lead, or public audience.

## What's forbidden

- Hard-coding numbers from a previous version of a deliverable into a new version without re-verifying.
- Trusting CountUp targets, chart values, or pill text that came from memory, prior chats, or another AI system.
- Using "about," "roughly," or "approximately" as a substitute for pulling the actual data.
- Shipping a deliverable when any stat has a question mark next to it in the source trace.
- Letting narrative voice override data — if the data contradicts the pre-written story, the story changes, not the data.

## Enforcement

Before any market-data deliverable is sent, rendered, posted, or committed: produce a one-line verification trace per figure ("$475K median — Supabase listings, PropertyType='A', City='Redmond', CloseDate 2026-01-01..2026-04-19, median(ClosePrice) = $475,000 over 188 rows"). Matt or a reviewer can audit the trace. No trace, no ship.

---

# Draft-First, Commit-Last — ABSOLUTE (READ SECOND)

**Nothing gets committed, pushed, posted, sent, rendered to a tracked location, or written to a place a publishing automation can pick up — until Matt has personally seen the draft and explicitly approved it.** No exceptions. This rule outranks every autonomy convenience instruction in this file, including "always push directly to main," "push to origin immediately after every commit," and "never ask Matt to run anything manually."

The autonomy rules below describe HOW work happens once it's approved. They do NOT grant authority to commit unreviewed work.

## What this means in practice

1. **Build to a draft location, not to main.** Render videos to `out/` (gitignored). Write copy to a scratch file. Scaffold Remotion comps and run them locally — but do NOT `git add` the final deliverable until Matt has eyes on it.
2. **Show the draft.** Send the rendered MP4 path, paste the copy, open the artifact in a preview tool, attach stills from the render, or otherwise put the work in front of Matt in a way he can actually evaluate.
3. **Wait for explicit approval.** "Looks good," "ship it," "push it," "commit and push," "approved," "go" — words Matt actually says. Silence is not approval. A successful build is not approval. A scorecard hitting its threshold is not approval. A subagent's "ready" report is not approval.
4. **Then commit + push.** Once approved, follow the existing workflow (single-checkout `main`, push to `origin` immediately, no feature branches).

## What's forbidden

- Auto-committing rendered MP4s to `public/v5_library/` (or any tracked location) without showing Matt first.
- Auto-pushing copy, captions, blog posts, emails, social drafts, CMAs, listing descriptions to anywhere a downstream automation could pick them up before Matt sees them.
- Treating a passing scorecard / quality gate / build as approval. Those are necessary, not sufficient.
- Treating "the user said 'do X'" several turns ago as approval for the specific deliverable produced now. Re-confirm each turn before commit.
- Pushing first and asking forgiveness. Reverting a published commit costs more than waiting one turn.

## What is still auto-allowed (no approval needed)

- Local file edits, npm installs, dependency updates needed to get a draft to the review point.
- Running tests, builds, and renders to scratch (`out/`, `tmp/`, gitignored paths).
- Pulling latest from `main` to stay in sync.
- Reading any file in the repo.
- Drafting `scorecard.json` / `citations.json` / verification traces alongside the draft.
- Asking Matt clarifying questions before building the draft.

The rule governs COMMIT and PUSH. It does not govern the work that produces the draft.

## How to ask for approval (the standard format)

When a draft is ready, surface it like this:

> **Draft ready:** `<path or preview URL>`
> **Scorecard:** `<X/100>` (format minimum `<Y>`)
> **Verification trace:** `<one-line summary>`
> **Ready to commit + push to `main` on your sign-off.**

Then stop. Do not commit. Do not push. Wait.

## When in doubt

If a deliverable could plausibly be the kind of thing Matt would want to review, treat it as draft-first. The cost of one extra confirmation turn is far cheaper than the cost of an unwanted commit landing on `main` and propagating to the production build, the website, the social pipeline, or the email queue.

---

# Video Build Hard Rules (READ THIRD — for any video task)

**These are the ship-blocker rules every video build must follow.** Inlining them here so agents do NOT have to re-read 2,000+ lines of `video_production_skills/*.md` for routine builds. Read those skill files only when doing something novel (new format, new sub-skill, edge case).

## Format
- 1080×1920 portrait, 30 fps, h264 + aac, faststart, file < 100 MB.
- **Length: 30–45s for viral cuts. Never over 60s.** News clips, listings, market data → 30–45s. Long-form market reports may go to 60s.
- Captions burned in. ~80% of short-form viewers are muted; captions carry the video.

## Hook (first 2 seconds)
- Motion engaged by frame 12 (0.4s). Never static at frame 0.
- On-screen text by frame 30 (1.0s). Centered, 64–80 px headline.
- First spoken word is content (no "hey," "today," "welcome," "let's talk about").
- Hook contains specific element: number, place name, contradicting claim, or visual surprise.
- **Banned openings:** logo, brokerage name, title card on black, "REPRESENTED BY," slow boundary draw, agent intro, generic drone-with-no-overlay.

## Beats
- Standard 2–3s per beat. Luxury drone 3–4s MAX. **No beat over 4s.**
- Minimum 12 beats in a 45s video.
- Three motion types minimum (push_in, push_counter, slow_pan, multi_point_pan, gimbal_walk, cinemagraph, parallax).

## Pattern interrupts (anchored to real content beats, not gimmicks)
- 25% mark: new visual register or text shock.
- 50% mark: hard register shift (exterior → interior, drone → closeup, etc.).
- Final 15%: kinetic stat reveal. **No brokerage attribution, no logo, no contact info in the reveal frame.**

## Text overlays
- Safe zone 900×1400 inside 1080×1920 (90 px margin every edge).
- Body ≥ 48 px, headlines 64–80 px.
- Min 2s display per block. Max 5–7 words per block.
- Numbers carry units always: "$3,025,000" not "3,025,000," "4 bedrooms" not "4 BR."
- White text + shadow OR dark pill under text. Never white-on-white, never gold-on-gold.

## VO (ElevenLabs only)
- **Voice: Victoria, ID `qSeXEcewz7tA0Q0qk9fH`** (locked 2026-04-27 — permanent). No other voice.
- Settings: stability `0.50`, similarity `0.75`, style `0.35`, `use_speaker_boost: true`. Model `eleven_turbo_v2_5`.
- **`previous_text` chained** across all lines for prosody continuity.
- Numbers spelled out for ingestion: "475,000" → "four hundred seventy five thousand."
- IPA phoneme tag for tricky place names on `eleven_v3` model: Deschutes (`dəˈʃuːts` — "duh-shoots"), Tumalo (`TOO-muh-low`), Tetherow, Awbrey, Terrebonne.
- Sentences short. Two clauses max. No commas where Matt wouldn't pause.

## Brand (zero in frame for viral cuts)
- **No logo, no "Ryan Realty" text, no phone, no agent name, no URL anywhere in the video frame.**
- Brand colors: Navy `#102742`, Gold `#D4AF37` (news clips) / `#C8A864` (listing reels), Cream `#F2EBDD`, Charcoal `#1A1A1A`. No off-brand hex.
- Fonts: Amboqia (headlines), AzoSans (body, captions). No Helvetica, no system fallback.
- **End card uses `listing_video_v4/public/brand/stacked_logo_white.png`** — never text-only Ryan Realty.
- News-clip caption pill spec: bottom zone y 1480–1720, AzoSans 56 px, 70% navy pill (`rgba(16,39,66,0.70)`), 24 px corner radius, 2 px gold top border. Must NOT overlay graphics.

## Banned words (any caption, VO, on-screen text, blog, email, listing copy)
- stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home
- meticulously maintained, entertainer's dream, tucked away, hidden gem
- truly, spacious, cozy, luxurious, updated throughout
- "approximately," "roughly," "about" as a substitute for the real number
- Em-dashes, semicolons, AI filler ("delve," "leverage," "tapestry," "navigate," "robust," "seamless," "comprehensive," "elevate," "unlock")

## Render hygiene
- `cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92`
- **Concurrency=1 is required** (Chrome OOMs higher).
- Audio-codec patch is in place (native `aac` encoder, not `libfdk_aac`); ffmpeg/ffprobe symlinks point at static-ffmpeg. If audio-mix hangs, fall back to video-only render + ffmpeg post-mix via `scripts/mix_news_audio.sh`.
- Pre-render asset audit: verify `public/v5_library/`, `public/brand/stacked_logo_white.png`, `public/fonts/*`, all referenced VO mp3s exist.

## Quality gate (run BEFORE asking for approval)
```
[ ] ffprobe Duration in [30s, 60s]
[ ] ffmpeg blackdetect strict (pix_th=0.05) returns ZERO sequences
[ ] Frame at 0s has motion + content (not black, not logo)
[ ] Frame at 25% has visual register change
[ ] Frame at 50% has pattern interrupt
[ ] Final 15% is kinetic reveal
[ ] No frozen frames at beat boundaries
[ ] No black bars at transitions (parent div transparent + Sequence overlap)
[ ] Banned-words grep clean across captions, VO script, source pills
[ ] All on-screen numbers carry units and trace to citations.json
[ ] No logo / "Ryan Realty" / phone / agent name in any frame except end card
[ ] File size < 100 MB
```

## Viral scorecard (run AFTER quality gate, BEFORE asking for approval)
- Score 1–10 in each of 10 categories per `video_production_skills/VIRAL_GUARDRAILS.md` §3 (hook, retention, text, audio, format, engagement, cover, cta, voice/brand, antislop).
- **Format minimums:** listing video 85, market data 80, neighborhood 80, meme 75, earth zoom 85, news clip 80. Default ship floor 80.
- Write `out/<deliverable>/scorecard.json` next to the render. Write `out/<deliverable>/citations.json` with every figure traced to a primary source.
- Auto-zero hits (banned word, unverified number, AI without disclosure, fair-housing hit) = ship-blocker regardless of headline score.

## Draft-first applies (see "Draft-First, Commit-Last" above)
- Render to `out/` (gitignored). Run quality gate + scorecard. Show Matt the path + scorecard summary. Wait for explicit approval. Then move to `public/v5_library/` and commit.

## When to read the long skill files
Read the full `video_production_skills/VIDEO_PRODUCTION_SKILL.md` + `VIRAL_GUARDRAILS.md` + `ANTI_SLOP_MANIFESTO.md` ONLY when:
- First time doing a brand-new format (no prior render in `out/` or `public/v5_library/` matches).
- An edge case isn't covered by the rules above.
- Auditing or debugging a scoring decision.
- Onboarding a new sub-skill (`depth_parallax/`, `gaussian_splat/`, `audio_sync/`, etc.).

For routine rebuilds — listing videos, news clips, market data drops, area guides — these inline rules are enough. Do NOT re-ingest 2,000 lines per build.

---

# Design System Rules — MANDATORY

## shadcn/ui is the ONLY styling authority

Every UI element on this site MUST use shadcn/ui components from `@/components/ui/`. No exceptions.

### Component Mapping (use these, not raw HTML):
| Need | Use This | NOT This |
|------|----------|----------|
| Button | `<Button>` from `@/components/ui/button` | `<button>`, `<a className="btn-...">` |
| Card container | `<Card>` from `@/components/ui/card` | `<div className="rounded-... border...">` |
| Form select | `<Select>` from `@/components/ui/select` | `<select>` |
| Text input | `<Input>` from `@/components/ui/input` | `<input>` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox` | `<input type="checkbox">` |
| Badge/tag | `<Badge>` from `@/components/ui/badge` | `<span className="rounded-full...">` |
| Dialog/modal | `<Dialog>` from `@/components/ui/dialog` | custom modal divs |
| Dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | custom dropdown divs |
| Tabs | `<Tabs>` from `@/components/ui/tabs` | custom tab implementations |
| Tooltip | `<Tooltip>` from `@/components/ui/tooltip` | `title` attribute |
| Separator | `<Separator>` from `@/components/ui/separator` | `<hr>`, `<div className="border-t...">` |
| Label | `<Label>` from `@/components/ui/label` | `<label>` |
| Textarea | `<Textarea>` from `@/components/ui/textarea` | `<textarea>` |
| Switch/toggle | `<Switch>` from `@/components/ui/switch` | `<input type="checkbox">` styled as toggle |
| Avatar | `<Avatar>` from `@/components/ui/avatar` | `<img className="rounded-full...">` |
| Table | `<Table>` from `@/components/ui/table` | `<table>` |
| Accordion | `<Accordion>` from `@/components/ui/accordion` | custom expand/collapse |
| Alert | `<Alert>` from `@/components/ui/alert` | `<div className="bg-yellow...">` |
| Progress | `<Progress>` from `@/components/ui/progress` | custom progress bars |
| Skeleton | `<Skeleton>` from `@/components/ui/skeleton` | custom loading placeholders |
| Sheet (mobile menu) | `<Sheet>` from `@/components/ui/sheet` | custom slide-out panels |

### Color Tokens (use these, not hex/named colors):
| Need | Use | NOT |
|------|-----|-----|
| Primary action | `bg-primary text-primary-foreground` | `bg-blue-600`, `bg-[#102742]` |
| Secondary | `bg-secondary text-secondary-foreground` | `bg-gray-100` |
| Accent/CTA | `bg-accent text-accent-foreground` | `bg-gold`, `bg-amber-500` |
| Destructive | `bg-destructive text-destructive-foreground` | `bg-red-500 text-white` |
| Success | `bg-success text-success-foreground` | `bg-green-500 text-white` |
| Warning | `bg-warning text-warning-foreground` | `bg-yellow-500` |
| Muted text | `text-muted-foreground` | `text-gray-500` |
| Borders | `border-border` | `border-gray-200` |
| Card background | `bg-card` | `bg-white` |
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |

### Utility Function:
Always use `cn()` from `@/lib/utils` for conditional/merged classes. Never string concatenate class names.

### Custom CSS Classes:
DO NOT use `card-base`, `btn-cta`, or any custom CSS class from globals.css. Use shadcn components directly.

### Legacy backup (removed — no-op rule):
The `_style_backup/` directory was removed from the repo. Never recreate it. Use only `@/components/ui/` and `app/globals.css`. (The entry remains in `tsconfig.json`'s `exclude` array for historical reasons — harmless.)

---

## Opus Orchestrator Policy (MANDATORY)

This agent runs on Opus. Opus is ~15× the per-token cost of Haiku. **Do not burn Opus context on mechanical/bulk work.** Delegate to subagents via the `Agent` tool (`model: "sonnet"` or `"haiku"`).

**Always delegate:**
- Codebase enumeration and grep sweeps across many files (`Explore` subagent)
- Bulk refactors / rename-across-repo tasks
- Reading/parsing >10 files to understand a module
- Running long test suites, builds, or deployments
- Data extraction from Supabase / large CSVs / logs

**Opus keeps:**
- Architecture decisions (ADRs), system design
- The final code review before ship
- User-facing product decisions and trade-offs
- Complex debugging where context across multiple systems matters

Launch parallel subagents in a single message when work is independent. **Never use `git worktree` or a non-`main` branch for this repo** — all code changes land in the single checked-out `main` working tree. See memory: `feedback_orchestrator_pattern.md`.

---

## Work Standards

- **No shortcuts, no assumptions.** When coding, implement the full solution from start to finish. Never stop halfway and present partial work as complete. When answering questions about the codebase, trace the logic all the way through to a confirmed answer — no surface-level glances, no guesses.
- **Always verify your own work.** Before saying something is done or something is true, confirm it. Run the code, check the output, read the actual files. Never assume. Every claim about code behavior must be verified by actually reading the relevant code. Every fix must be tested to confirm it works before reporting it's done.
- **Truthful and accurate, always.** If you're not sure, say so. Never state something as fact unless you've confirmed it. If you got something wrong, own it immediately.
- **No partial answers.** When asked about status, where things stand, or how something works, go all the way through to the end to figure out the exact answer. There are never any assumptions being made — always confirm.
- **Always push directly to main.** No **`git worktree`**, no extra local or remote branches, no feature branches unless explicitly asked — one checkout, **`main` only**.
- **Same pipeline as Cursor.** Matt switches between Claude Code and Cursor on one repo. Before work: `git pull --rebase origin main`. After every commit on `main`: **push to `origin` immediately** — no “saved locally” commits. **Migrations:** apply to hosted Supabase in the same delivery as code that depends on them (see `AGENTS.md` *Claude Code ↔ Cursor*, `.cursor/rules/production-parity.mdc`, `.cursor/rules/supabase-migrations-auto.mdc`). Optional continuity: `~/.claude/plans/HANDOFF-*.md` + `docs/plans/task-registry.json`.
- **Never ask Matt to run anything manually.** You handle ALL git operations, ALL terminal commands, ALL deployments, everything. Matt never touches the terminal. If something needs to be done, you do it.
- **Proactively clear git locks.** Before ANY git operation (commit, merge, rebase, pull, push), check for .git/index.lock and remove it if it's stale. Never let a lock file block progress. Never report a lock file to Matt as a blocker — just fix it.
- **No blocked builds or commits.** Builds must never back up. Commits must never be blocked. If something is in the way, fix it yourself. Exhaust every option before reporting an issue.

---

## Persistent memory (repo)

Durable cross-session notes live in **`.auto-memory/`** (same pattern as Cowork `feedback_*.md` references in video skills). **Cascade Peaks video (in flight):** append status to `.auto-memory/memory_cascade_peaks_video_handoff.md` — do not let handoff notes live only in chat. **Local Remotion env (Mac / Cursor, parity with Cowork `work/cascade_peaks`):** `npm run video:cascade-peaks:setup` then `video/cascade-peaks/README.md`.

**Hand off to Cursor / the other Claude agent:** Before Matt switches tools, update **`docs/plans/CROSS_AGENT_HANDOFF.md`** (Current block: what shipped, what is next, commit SHA, skills you read). The other side pulls `main` and reads that file first. See **`AGENTS.md`** (*Cross-agent handoff* + *Skills*).

---

## Skill Routing

**Global index:** Before loading skills ad hoc, open **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** (or the git mirror **`docs/plans/GLOBAL_SKILLS_REGISTRY.md`**) for the full inventory: repo skills, Cursor plugins (Vercel, Supabase, Figma, Superpowers, etc.), `skills-cursor`, TRANSACTION COORDINATOR skills, and Cowork-mounted skills (section E). **`~/.cursor/GLOBAL_SKILLS_REGISTRY.md`** is a stub that points at the canonical file.

**Load skills first:** If a task might match any **`SKILL.md`** in this repo (`.cursor/skills/`, `video_production_skills/`, `social_media_skills/`, `automation_skills/`) or in Cursor’s bundled skill paths, **read that skill file before doing the work**—same bar as Cursor agents (`AGENTS.md` *Skills*).

**Mandatory:** `engineering:code-review` on every meaningful change before ship. `engineering:deploy-checklist` before any production deploy. `design:design-system` audits whenever shadcn/ui compliance is in question.

**Data work:** `data:*` skills fire automatically on any Supabase / SQL / analytics task.

Everything else (debugging, architecture, testing-strategy, documentation, incident-response, tech-debt, accessibility-review, ux-copy, web-artifacts-builder) fires on trigger match — no table needed.

---

## Video Production — REQUIRED

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` before writing any video code or Remotion composition. This is non-negotiable.**

### Data Accuracy in Video — OUTRANKS EVERYTHING

**Every number shown or spoken in a video MUST trace to a verified primary source. Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` Section 0 in full before writing any video code. A pretty render with a wrong number does not ship — even at 100/100 on the viral scorecard.**

- All figures trace to Supabase (`market_pulse_live`, `market_stats_cache`, `listings`), Spark API (`SPARK_API_BASE_URL` + `SPARK_API_KEY` in `.env.local`), or a named primary source (NAR, Case-Shiller, NAHB, AEI, etc.).
- Query the primary source live BEFORE scaffolding the BEATS array — never inherit numbers from a brief, prior chat turn, web article, or previous render.
- `citations.json` ships alongside every render. One entry per figure: source, table, column, filter, row count, `fetched_at_iso`, query text. No citations, no ship.
- Research briefs, web articles, and conversation context are untrusted. Cross-verify against the primary database.
- Unverifiable stat = cut. No estimating. No rounding to fill a gap. No "approximately."
- **Market reports**: always `property_type='A'` (SFR), YTD windows, apples-to-apples periods. YoY = same window across two years, not Q1 vs full-year.
- **Spark × Supabase reconciliation is a HARD PRE-RENDER GATE for market reports.** Before `npx remotion render` runs, the agent queries Spark for every figure that also exists in Supabase, prints both values + delta %, and **STOPS the render if any `|delta| > 1%`**. Surface the conflict to Matt (figure, Supabase value + query, Spark value + query, delta, suspected cause) and wait for resolution. Re-render only after Matt confirms. Spark wins for active inventory + DOM; Supabase wins for reconciled historical close data once it's refreshed past the Spark cutover date. Document the cross-check in `citations.json`.
- **Months of supply** = `active_listings / (closed_last_6_months / 6)`. Thresholds: ≤ 4 seller's, 4–6 balanced, ≥ 6 buyer's. Verdict pill must match the number.
- **Never round in a way that changes the narrative.** $474,500 → `$475K` is fine; $474,500 → `$500K` is not.

`.env.local` cred status (verified 2026-04-27): `SPARK_API_KEY` ✅, `SPARK_API_BASE_URL` ✅ (`https://replication.sparkapi.com/v1`). `SPARK_TOKEN`, `BRIDGE_API_KEY`, `RESO_API_KEY` ❌ not provisioned — surface to Matt before any build that needs them.

### ElevenLabs Voice — MANDATORY

- **Voice: Victoria — Voice ID: `qSeXEcewz7tA0Q0qk9fH`**
- Voice profile: middle-aged American, conversational, warm, trustworthy, relatable. Designed for explainer videos, viral social, and modern brand VO. Saved on account as "Victoria — Ryan Realty Anchor."
- Env vars in `.env.local`: `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH`, `ELEVENLABS_VOICE_ID_VICTORIA=qSeXEcewz7tA0Q0qk9fH`
- API key: `ELEVENLABS_API_KEY` in `.env.local`
- **ALWAYS use Victoria for ALL voiceover.** No other voice. No substituting. No asking.
- **Canonical model + settings**: `eleven_turbo_v2_5`, stability `0.50`, similarity_boost `0.75`, style `0.35`, `use_speaker_boost: true`. These match the market-report scorecards Matt approved. Different model or different settings = different-sounding voice = a rejected render.
- Use `previous_text` chaining for prosody continuity across sentences within a clip.
- Use IPA phoneme tags for tricky pronunciations (e.g., Deschutes → `<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>`).
- Matt approved this voice 2026-04-27 — Victoria is the permanent voice. Do not switch without explicit Matt direction.

### Video Review Gate — MANDATORY

- **No rendered video MP4 gets committed or pushed without Matt's explicit approval.**
- This applies to anything that lands in `listing_video_v4/public/v5_library/` or any other user-facing/public-facing path. Source code changes (`.tsx`, `.py`, skill docs, scorecards, citations.json) push as normal — those are infrastructure, not the deliverable.
- Workflow:
  1. Render to `listing_video_v4/out/<name>.mp4` (local, untracked).
  2. Run the QA gate (blackdetect, audio non-silent check, duration/codec verify).
  3. **Present the local file path to Matt** for review (`open /Users/matthewryan/RyanRealty/listing_video_v4/out/<name>.mp4`). If multiple clips, list each path.
  4. Wait for explicit ship approval (e.g., "ship it", "approved", "push").
  5. Only after approval: copy to `public/v5_library/`, `git add` the MP4, commit, push.
- This rule overrides the default "always push immediately" rule from `feedback_always_push.md` for video deliverables. Code changes that describe the video still push immediately.
- Reason: bad audio, wrong voice, wrong end card, wrong duration — all caught by Matt before the MP4 lands on `main` and gets distributed. Cheaper to fix in `out/` than to revert a public commit.
- Locked 2026-04-27. Applies to every format: news clips, listing reels, market reports, neighborhood guides, memes with rendered video.

### Pacing Rule — First Scenes

- The first scene / hook text MUST stay on screen long enough for the viewer to read it completely. **Minimum 3 seconds** for any text-heavy opening scene.
- **No scene with readable text shorter than 2.5 seconds.**
- The hook should grab attention but NOT flash by so fast nobody can read it.
- This rule applies to every video format: news clips, listing reels, market reports, neighborhood guides, memes with text overlay.

**Pair-required (load all three before any build):**

1. **`video_production_skills/ANTI_SLOP_MANIFESTO.md`** — banned-content gate. Twelve rules, every one a ship-blocker. Banned generic real estate language, banned AI-passed-as-real photos, ElevenLabs-only VO with pronunciation overrides, banned openings, AI disclosure requirements, beat-synced music or none, source-verified data only, 30-day human review on every new format, no AI humor, no engagement bait, voice rules (no semicolons, no em-dashes, no AI filler), and brand visual standards. Every skill in `video_production_skills/`, `social_media_skills/`, and `automation_skills/` references it.

2. **`video_production_skills/VIRAL_GUARDRAILS.md`** — pre-publish virality gate. 100-point scorecard with format-specific minimum scores (listing video 85, market data 80, neighborhood 80, meme 75, earth zoom 85; default ship floor 80). Frame-by-frame hook spec (motion by 0.4s, content by 1.0s, payoff by 2.0s, confirmation by 3.0s, qualified-view threshold at 5.0s for TikTok 2026). Retention-structure timing (25%, 50%, 75%, final-15% beats). Platform-specific length / aspect / cadence specs. Engagement-trigger menu. Citation-rich data on the 2026 algorithms across TikTok, Reels, Shorts, FB, X, LinkedIn. Every piece scores against this gate before publish; `scorecard.json` ships next to the render. Quick-reference: `video_production_skills/VIRAL_SCORECARD_QUICKREF.md`.

3. **`video_production_skills/VIDEO_PRODUCTION_SKILL.md`** — the master skill itself. Codifies the hard constraints (length, hook, cuts, retention, branding rules), creative direction (formula, pacing, shot sequence by price tier), AI video pipeline (when warranted, when banned), brand rules, the pre-render asset audit, and the post-render quality gate. Every Schoolhouse v5 round (v1 through v5.9) is logged with the specific failure that produced each rule.

The manifesto governs *what's banned*. The viral guardrails govern *what's required to publish*. The master skill governs *how the video is built*. The three layer; they do not contradict.

For quick reference during work, keep `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md` (production checklist) AND `video_production_skills/VIRAL_SCORECARD_QUICKREF.md` (publish-day scorecard) open.

Every video build opens all three master files before scaffolding the BEATS array, engineers the BEATS array against the VIRAL_GUARDRAILS scorecard from beat 0 (do not "score later"), runs the quality gate (ffmpeg blackdetect strict + frame extraction + visual scrub) before push, and writes a `scorecard.json` next to every render. Self-enforce — don't wait for Matt to find an obvious bug.

The full master sub-skill index (depth_parallax, gaussian_splat, cinematic_transitions, audio_sync, social_calendar, market_report_video, news_video, google_maps_flyover, brand_assets, listing_launch, area_guides, ai_platforms, content_pipeline, quality_gate) is in §10 of the master skill. Operations manual is `video_production_skills/AGENT_HANDOFF.md`; rendered MP4 inventory is `video_production_skills/ASSET_LOCATIONS.md`.

### Sister skill libraries

Three sibling directories at the repo root carry the autonomous viral content engine:

- **`video_production_skills/`** — master skill, manifesto, plus the format and capability skills above PLUS six viral format skills added in §11: `earth_zoom`, `data_viz_video`, `listing_reveal`, `meme_content`, `avatar_market_update`, `neighborhood_tour`. Some of the §11 skills overlap conceptually with earlier ones (`earth_zoom` ↔ `google_maps_flyover`, `neighborhood_tour` ↔ `area_guides`, `listing_reveal` ↔ `listing_launch`, `data_viz_video` ↔ `market_report_video`) — both sets coexist while the team chooses which is canonical per format. Read the relevant SKILL.md before invoking.
- **`social_media_skills/`** — platforms (algorithm briefs, channel specs, viral hooks, trending audio, profile optimization, audits), content (calendar, creation, repurposing, animation rules, AI video, Synthesia, quality gate, Remotion), ops (analytics, API wrappers, community management, ads, lead nurture), intelligence (Paid Ads, Organic Growth, Marketing, Canva/CapCut). Index at `social_media_skills/README.md`.
- **`automation_skills/`** — three triggers (`listing_trigger`, `market_trigger`, `trend_trigger`) + six pipelines (`post_scheduler`, `performance_loop`, `repurpose_engine`, `engagement_bot`, `thumbnail_generator`, `ab_testing`). Defines 19 database tables, the OAuth flow for Meta/TikTok/YouTube/LinkedIn, the post queue with first-30-days human review gate, format performance scoring, and FUB lead capture from inbound DMs/comments.

Every skill in all three libraries references `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md`. Content that violates the manifesto does not ship. Content that fails to clear the format-specific minimum on the viral scorecard does not ship.
