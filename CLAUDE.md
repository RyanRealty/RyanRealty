# Ryan Realty — agent canon

This file is loaded into every session. It holds the rules that outrank convenience, and
nothing else. Anything longer than a rule lives in the doc it points at.

**Read order:** §0 data accuracy → §1 approval → §2 brand voice → then whichever of §3–§9
your task touches.

**Fleet start (mandatory before subject tunnels):** read
[`docs/plans/ENTERPRISE_MAP/SESSION_HANDOFF.md`](docs/plans/ENTERPRISE_MAP/SESSION_HANDOFF.md)
and the current block in [`docs/plans/CROSS_AGENT_HANDOFF.md`](docs/plans/CROSS_AGENT_HANDOFF.md).
The enterprise map (`docs/plans/ENTERPRISE_MAP/`) is the whole-system SoR for what exists,
what is verified, and what is open — not a side doc. Subject work (admin, CRM, growth)
still runs; it does not erase other planes from Sense.

**Every development cycle routes through THE LOOP v1.6.0 — [`docs/DEVELOPMENT_PROCESS.md`](docs/DEVELOPMENT_PROCESS.md).** Session boot: `npx tsx scripts/loop-brief.ts` (the durable work graph, not the chat, is the source of record for in-flight work). The brief serves a **ship class**: same-category fleet findings share one `npm run push` and one `deploy:verify`. Do not rebuild after each bot finding.
One self-improving cycle: ingest telemetry → diagnose → prioritize → fix the class → verify
exhaustively → ship → measure → learn → lock behind a gate → compete. It carries the preflight
contract, the live-environment rules, the escape-ledger protocol, and the approval model.
Enforced by G44 (`ci:process-canon`).

**A rule that lives only in chat history is lost next session.** When Matt issues a directive
that creates a permanent rule, do both: apply it to the immediate work, AND write it here (or
into the producer SKILL.md that owns the surface). See §6 — if a rule keeps being violated, the
answer is a new mechanical gate, not more prose.

---

# §0. Data Accuracy — ABSOLUTE, NON-NEGOTIABLE

**Every number that leaves this shop must be verified against the source of truth before it
goes in front of a human, a social feed, an email, an MLS, a website, a video, a chart, a
report, or a listing document.** No exceptions. Matt is a licensed principal broker.
Publishing inaccurate data — price, inventory, DOM, YoY, sale-to-list, absorption,
neighborhood stats, anything — is a compliance risk to Ryan Realty's license. This rule
outranks speed, style, cost, and every other instruction in this file.

## What "verified" means (mandatory before publish, send, or render)

1. **Name the source.** Every stat traces to one of: live Supabase (table + filter
   documented), MLS direct pull, official agency data (ORMLS, NAR, Case-Shiller, OHCS,
   Census, BLS, FRED), or a linked primary-source URL. "I remember" is not a source.
   LLM-recall numbers are not a source.
2. **Pull the query fresh.** Re-run the SQL/API call in this session. Never reuse a hard-coded
   value from a prior script without re-confirming.
3. **Print the raw result.** Show row counts, the date window, the filter
   (`PropertyType='A'` for SFR, geography, status, close-date range). The number in the
   deliverable must equal the number in the printout.
4. **Cross-check math.** Derived stats (months of supply, YoY %, absorption, median,
   price/sqft) get recomputed and the computation shown.
5. **Reconcile narrative to data.** Every sentence, subhead, verdict, and pill must be
   consistent with the number it sits next to. A "seller's market" verdict next to 4.3 months
   of supply is a fail.
6. **QA the rendered output.** For video or image deliverables, capture stills of every scene
   and confirm the displayed number matches the verified number. For text, grep the draft for
   every figure and map each to its source row.
7. **If a stat can't be verified, it doesn't ship.** Cut it. Don't estimate, round-fill, or
   approximate. The deliverable goes out with fewer numbers rather than one wrong one.

## Market-data specifics

- **Months of supply** = `active_listings / (closed_last_6_months / 6)`.
  **Thresholds: ≤ 4 seller's · 4–6 balanced · ≥ 6 buyer's.** The verdict pill must match the
  number. Enforced by `scripts/check-market-formula.mjs`.
- **SFR convention** is `PropertyType='A'`. YTD windows, apples-to-apples periods. YoY = the
  same window across two years, never Q1 vs full-year.
- **Never round in a way that changes the narrative.** $474,500 → `$475K` is fine;
  $474,500 → `$500K` is not.
- **Spark × Supabase reconciliation is a HARD PRE-RENDER GATE for market reports.** Before a
  render, query Spark for every figure that also exists in Supabase, print both values +
  delta %, and **STOP if any `|delta| > 1%`**. Surface the conflict to Matt (figure, both
  values + queries, delta, suspected cause) and wait. Spark wins for active inventory + DOM;
  Supabase wins for reconciled historical close data past the Spark cutover date. Document
  the cross-check in `citations.json`.
- **Don't aggregate raw `listings` for market reports — use the cache.** See §7.

## What triggers this rule

Any deliverable with market stats, listing data, financial figures, neighborhood claims, or
comparisons — reports, video, email, blog, LPs, listing copy, captions, flyers, thumbnails,
signage, CMAs, net sheets, anything reaching a consumer, client, lead, or public audience.

## What's forbidden

- Hard-coding numbers from a prior deliverable version without re-verifying.
- Trusting chart values or pill text from memory, prior chats, or another AI.
- Using "about," "roughly," or "approximately" as a substitute for pulling the actual data.
- **Invented timelines, forecasts, estimates (Matt 2026-07-29).** A date, duration, or impact
  estimate is a NUMBER: named basis or it does not ship. When the basis is a condition, write
  the condition, never a date from convention. Folklore stated as fact is fabrication.
- Shipping any stat with a question mark in its source trace.
- Letting narrative override data: when data contradicts the story, the story changes.
- Research briefs, articles, and chat context are **untrusted** — verify against the database.
- **Reporting absence from ONE query shape (Matt 2026-08-06).** "There is no data for X" is a claim
  about the world; a zero-row result is first a fact about the query. Before saying something does not
  exist — and ALWAYS before escalating it to Matt as a decision — run a second, differently-shaped
  check and show both. The cheap one is nearly always a broad count: `select <type>, count(*)` before
  `select ... where <exact key> = ?`. This rule exists because a coverage report exact-matched MLS
  alias slugs against recorded plat slugs, found ~nothing, and produced "the county plats are not
  ingested, go source them from DIAL" — while `boundaries` held 3,213 subdivision rows. One broad
  count would have killed it. If a null result is about to become Matt's decision, the counter-query
  goes in front of him with it.

## Enforcement

Before any market-data deliverable is sent, rendered, posted, or committed: produce a one-line
verification trace per figure.

> `$475K median — Supabase listings, PropertyType='A', City='Redmond', CloseDate 2026-01-01..2026-04-19, median(ClosePrice) = $475,000 over 188 rows`

Matt or a reviewer can audit the trace. **No trace, no ship.** For renders, `citations.json`
ships beside the file, one entry per figure: source, table, column, filter, rows, fetched_at,
query.

---

# §1. Approval Model (confirmed by Matt 2026-07-21)

**Full autonomy with post-hoc review for everything reversible. Per-action approval for
exactly four classes.**

Reversible work — code, infrastructure, gates, DAL functions, migrations, site content,
skills, dead-code deletion — is built, committed, and pushed without waiting for review. Matt
reviews after the fact; a bad change gets reverted.

**Per-action approval (Matt must say yes to the specific action, every time — silence is never
approval, a passing gate is never approval, a successful build is never approval):**

1. **Outbound messages to real people** — email or SMS to a client, lead, or prospect that an
   agent initiates. Broker-initiated sends from the CRM are the broker acting for themselves.
2. **Publishing posts** — anything landing on a public social channel. The publisher requires
   a human approval stamp ≤ 7 days old.
3. **Ad spend** — creating, changing, or scaling paid campaigns.
4. **OAuth grants** — connecting accounts or granting scopes.

**Broker self-approval (2026-08-01):** `content:*` drafts a broker initiates on the broker
SMS agent line are approved by that broker (APPROVE reply = the stamp, same 7-day freshness;
Matt gets a daily digest). Everything else above is unchanged.

**One commit-time class keeps an approval marker:** rendered content deliverables (video files
in tracked `public/` paths) require `Approved-by: matt` or `Draft-shown: <url>` in the commit
message — enforced by `scripts/check-draft-first.mjs` via the commit-msg hook. Everything else
commits clean.

Content drafts (video, copy, creative) still get built to scratch (`out/`, gitignored) and
shown to Matt before they enter a distribution path.

---

# §2. Brand Voice — applies to EVERY piece of public-facing text

**Canonical source, and the ONLY one: [`marketing_brain_skills/brand-voice/VOICE.md`](marketing_brain_skills/brand-voice/VOICE.md).**
Read it before writing any text a member of the public will see. Locked D11
(2026-08-12). This section is a pointer, not a second copy.

**Triggers.** Any text a lead, client, or visitor reads, whatever produces it: email
bodies and subjects, SMS bodies, saved-search and listing alerts, CMA/BPO/report
prose, every site page and component, landing pages, social captions, video
on-screen text we author, and any document a client opens. Not governed: code,
comments, commit messages, admin screens, internal docs. Never rewritten: customer
reviews, another broker's remarks, quoted third parties, MLS remarks.

**Enforced, not advisory.** [`scripts/check-brand-voice.mjs`](scripts/check-brand-voice.mjs)
(`ci:brand-voice`, in `ci:gates` and the pre-commit hook) fails the commit, reading a
machine-readable projection of the canon in
[`scripts/brand-voice-vocabulary.cjs`](scripts/brand-voice-vocabulary.cjs). Runtime
send paths hard-fail through `lib/voice/check.ts` (`ci:voice-send-paths`).

**The rule broken most often:** state the fact, then stop. Never write a sentence
whose job is to explain the sentence before it.

**Standing rule:** any copy created for the public runs through this canon. It is
mechanical at both ends, so nobody has to remember: `ci:voice-constructions` fails
the commit, and the same patterns run inside `lib/voice/check.ts`, the chokepoint
every content path already blocks on. The repo-wide rewrite is a grinder, `/voice-canon`
([`.claude/skills/voice-canon/SKILL.md`](.claude/skills/voice-canon/SKILL.md));
where it left off is machine-written to
[`scripts/voice-canon-state.json`](scripts/voice-canon-state.json) on every scan,
never hand-maintained.


---

# §3. Design System (v2, locked 2026-05-12)

**Canonical source: [`design_system/ryan-realty/`](design_system/ryan-realty/).** Read order:
[`MANIFEST.md`](design_system/ryan-realty/MANIFEST.md) →
[`SKILL.md`](design_system/ryan-realty/SKILL.md) →
[`colors_and_type.css`](design_system/ryan-realty/colors_and_type.css). Never invent colors,
fonts, or asset paths from memory — open the source.

**The codebase is the source of truth, not the Claude Design project** (flipped 2026-05-14).
The design project at `b87a4e11-1017-4fb5-bc82-ed8fec1ec568` is a previewer + prototyping
surface. Codebase → project: Matt asks the design agent to "sync from codebase". Project →
codebase: the design agent writes to `codebase-patches/design_system/ryan-realty/<exact-path>`,
then Matt asks the codebase agent to "apply design patches" (rsync, commit, push). Neither side
depends on the other being available.

## Two registers — pick one per surface, never mix

| Register | Use for | Color | Type |
|---|---|---|---|
| **Heritage** | Yard signs, postcards, door hangers, email banners, IG posts + carousels, print flyers, brag sheets, section heroes, listing-tour video, news clips, all "stamped" moments | Navy `#102742` **monochrome** on cream `#faf8f4` | **Amboqia Boriango** display; the pre-rendered wordmark as image, never re-typeset |
| **Web / product** | Homepage, search, market hub, dashboards, forms, every UI surface | Navy `#102742` primary on warm stone | **Geist** for UI/body/data, **Amboqia Boriango** for display + hero H1s |

## Tokens

**Two-color palette only** (Matt 2026-05-13): `--rr-navy` `#102742` (logo, CTAs, headlines,
focus intent, end cards) and `--rr-cream` `#faf8f4` (primary background). White `#FFFFFF` and
black `#000000` are allowed only for text-on-photo legibility and scrim layers. Off-brand hex
is banned.

**One exception accent** (Matt 2026-08-17): `--rr-exception` marks a data exception —
a drawdown, a decline, a breached threshold — and nothing else. Never decoration, never a
CTA, never a background, never on a surface that is not showing data. If nothing is wrong,
use navy.

Retired, do not reintroduce: `--rr-navy-deep` (use `rgba(16,39,66,0.85)` for hover/pressed),
`--rr-sand` (use `rgba(16,39,66,0.08)` for borders/dividers), `--rr-fir`, `--rr-sky`, and both
retired golds plus the retired v1 cream — see the migration table below.

**Type decision tree.** Wordmark or section hero stamp → use the pre-rendered image from
`design_system/ryan-realty/assets/brand/`, do not re-typeset. Display moment (hero H1, pull
quote, testimonial, yard-sign text, postcard headline, slide title) → **Amboqia Boriango**,
navy on cream, tracking `-0.01em` to `0.08em` for all-caps signage. Arched ribbon sub-label →
**Azo Sans Medium**, uppercase, tracked `0.12em` (its only surviving use). Body, UI, market
data, forms, nav, video captions → **Geist** (400/500/600/700); Geist Mono for code.

**Radii** base 10px: `sm 6 · md 8 · lg 10` (button/input) `· xl 14` (card) `· 2xl 18 · 3xl 22`.
Badge = pill. **Shadows** navy-tinted only, `rgb(16 39 66 / opacity)`. **Focus ring** 3px warm
stone, never navy, always visible. **Motion ladder** 200ms fades · 300ms entrances · 400ms
fade-up · 2s loops · 20s Ken Burns; ease-out entrances, ≤16px travel, always respect
`prefers-reduced-motion`.

## The component library IS the design system

`@/components/ui/` holds radix-nova primitives **re-skinned to the design system**. "shadcn"
and "the design system" are the same thing here, not a choice. Build every UI element from
`@/components/ui/`. Do NOT hand-roll raw HTML controls on product surfaces.

**The per-surface visual target is the mockup at
`design_system/ryan-realty/ui_kits/<surface>/index.html`.** Display headings (page H1s +
section H2s) use the Amboqia face via the `H1`/`H2`/`DisplayHeading` primitives in
`components/site/primitives` (which carry `font-display`), never plain Geist.

| Need | Use | NOT |
|---|---|---|
| Button | `<Button>` | `<button>`, `<a className="btn-...">` |
| Card | `<Card>` | `<div className="rounded-... border...">` |
| Select · Input · Checkbox · Textarea · Label · Switch | the matching `@/components/ui/*` | the raw HTML element |
| Badge | `<Badge>` | `<span className="rounded-full...">` |
| Dialog · DropdownMenu · Tabs · Tooltip · Accordion · Sheet | the matching `@/components/ui/*` | custom divs, `title` attribute |
| Separator | `<Separator>` | `<hr>`, `<div className="border-t...">` |
| Avatar | `<Avatar>` | `<img className="rounded-full...">` |
| Table · Alert · Progress · Skeleton | the matching `@/components/ui/*` | hand-rolled equivalents |

| Need | Use | NOT |
|---|---|---|
| Primary action | `bg-primary text-primary-foreground` | `bg-blue-600`, a raw navy hex |
| Secondary · Accent · Destructive · Success · Warning | `bg-<token> text-<token>-foreground` | `bg-gray-100`, `bg-red-500 text-white`, … |
| Muted text | `text-muted-foreground` | `text-gray-500` |
| Borders | `border-border` | `border-gray-200` |
| Card / page background | `bg-card` / `bg-background` | `bg-white`, `bg-gray-50` |

Always use `cn()` from `@/lib/utils` for conditional/merged classes; never string-concatenate
class names. Do NOT use `card-base`, `btn-cta`, or any custom class from globals.css. The
`--font-sans` token is Geist (loaded via `next/font/geist`); the radix-nova stone neutral base
and the `--primary` oklch (evaluates to navy) are correct — do not edit.

## Assets

Full inventory in [`MANIFEST.md`](design_system/ryan-realty/MANIFEST.md). Most-used:
heritage wordmark [`logo-blue.png`](design_system/ryan-realty/assets/brand/logo-blue.png);
signature lockup `illustration-05.png`; mascot **Jax** `blue-dog.png` / `white-dog.png` for
dark backgrounds; scene illustrations `scene-tower.png`, `scene-water-pageant.png`; 14
numbered wordmark variations `illustration-01..14.png`; element cutouts under
`assets/brand/navy-cream/`.

**CANONICAL BRAND HERO PHOTO (locked 2026-05-13):**
[`hero-old-mill-master-4k.jpg`](design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg)
— Old Mill District drone frame. **Use it for ANY surface needing a banner, cover, header,
hero, or cinematic anchor.** Pre-cropped at every social aspect in the same `hero/` folder,
top-anchored so the flag stays visible. Crop discipline mandatory (see that folder's README).
iStock subscription license — active sub required at publish time.

**Broker headshots** at `design_system/ryan-realty/assets/team/`: `matt-ryan`,
`paul-stevenson`, `rebecca-peterson`, each `.png` (transparent, **canonical**) and `.jpg`
(white bg, legacy). Use the `.png` by default — the subject is alpha-matted so the portrait
drops onto any background without a white box. All three share identical head height (552px)
and centering. Mirrors at `public/images/brokers/`. **Never re-create a rectangular box behind
a portrait** with background fills, fake-frame shadows, or borders — the transparent edge IS
the composition.

**Listing-agent rule:** every per-listing deliverable (flyer, IG carousel, listing-video end
card, blog byline, lead-gen ad, email) carries the **listing agent's** headshot, resolved from
the Supabase `listings` row (`ListAgentEmail`, `ListAgentFullName`). For brand-led content
(market reports, news clips, memes, neighborhood guides) the brokerage speaks — omit the
headshot, use Jax.

## Migration conflicts vs the retired v1 spec (resolved 2026-05-12)

| Surface | v1 — retired | v2 — locked |
|---|---|---|
| Listing video footer logo bar | retired gold `#C8A864` logo on a 70%-black bar | Navy logo on a cream-tinted bar, from `logo-blue.png` |
| News clip caption pill | retired: navy pill, gold top border, AzoSans 56px | No pill. Single-word Amboqia caption, white + drop shadow (§4) |
| Body / UI / caption font | retired: AzoSans | Geist for body/UI/data, Amboqia for display + video captions |
| Cream background | retired `#F2EBDD` | `#faf8f4` |
| Palette | retired: navy, gold, cream, charcoal | Navy + cream only |
| Gold accents `#D4AF37` | retired everywhere | none — navy on cream |
| Mascot | not specified | **Jax** the blue lab, explicitly part of brand |

Already-rendered videos in `public/v5_library/` stay as-is. New renders use v2; a re-render
migrates to v2.

## Skill self-binding

Every content skill (`marketing_brain_skills/producers/*`, `social_media_skills/*`,
`automation_skills/*`) MUST reference both
[`design_system/ryan-realty/SKILL.md`](design_system/ryan-realty/SKILL.md) and
[`social_media_skills/platform-best-practices/SKILL.md`](social_media_skills/platform-best-practices/SKILL.md)
in its required-references section. A skill that produces content without loading both is
non-compliant — fix the skill, not the workaround.

**Platform best practices (locked 2026-05-13)** resolve the recurring questions: logo in frame
(almost always no on short-form — "the logo is a closer, not an opener"), Matt on camera
(per-surface matrix), captions, length, aspect, hook timing, cadence, SEO. **Default to the
matrix.** When asking Matt a content question, frame it as: "Best practice says X. Follow it,
or override?" Research sources at `docs/research/best-practices-*.md`.

---

# §4. Video Build Hard Rules

**These are the ship-blocker rules for every video build, and they are the ONLY ones.**
`video_production_skills/` was deleted 2026-06-15 (Matt directive, commit `abd59955`) — 83
files, every format producer, the manifesto, the viral guardrails. Nothing survives except
three code modules still imported by the Remotion projects:
[`SingleWordCaption.tsx`](video_production_skills/captions/canonical/SingleWordCaption.tsx),
[`safe-zones.ts`](video_production_skills/captions/canonical/safe-zones.ts),
[`load-amboqia.ts`](video_production_skills/captions/canonical/load-amboqia.ts) (mirrored at
`video/market-report/src/captions/`). Video producers were removed from the producer registry
2026-06-14 — a brain row naming one cannot execute. **There is no longer a longer skill to go
read. If a rule is missing for an edge case, decide it, apply it, and write it into this
section.**

**§0 outranks everything here.** A pretty render with a wrong number does not ship, even at
100/100 on the scorecard. Query the primary source live BEFORE scaffolding the BEATS array.

## Format
1080×1920 portrait, 30 fps, h264 + aac, faststart, file < 100 MB. Captions burned in (~80% of
short-form viewers are muted). **Length 30–45s for viral cuts, never over 60s;** long-form
market reports may reach 60s.

## Hook (first 2 seconds)
Motion engaged by frame 12 (0.4s) — never static at frame 0. On-screen text by frame 30 (1.0s),
centered, 64–80px. Payoff by 2.0s, confirmation by 3.0s (TikTok's qualified-view threshold is
5.0s — the first five seconds decide distribution). First spoken word is content: no "hey,"
"today," "welcome," "let's talk about." The hook carries a specific element: a number, a place
name, a contradicting claim, or a visual surprise.

**Banned openings:** logo, brokerage name, title card on black, "REPRESENTED BY," slow boundary
draw, agent intro, generic drone with no overlay.

## First frame as thumbnail (t=0) — ship-blocker, locked 2026-05-20
Platforms auto-generate the feed thumbnail from frame 0 unless a custom cover is supplied. A
black frame, logo card, blank background, or low-contrast title slide kills click-through
before the algorithm sees it.

Frame 0 must contain real photo content (hero photography, listing photo, live tile, drone
shot — not a brand card), a title overlay if needed at thumbnail-readable size (64–80px, not
body copy), and strong contrast.

**Banned at t=0:** pure black (luma mean < 30/255), pure white, any solid brand-color
background with no photo, the wordmark alone, a "Coming Up"/"Sponsored by" card, a blurred or
focus-pull-from-black ramp.

Enforced by [`scripts/check_first_frame.py`](scripts/check_first_frame.py) — **every render
runs it before the file moves out of `out/`.** Thresholds: luma 30–240, variance ≥ 250,
saturation ≥ 8 at mid-luma. The script's docstring is the spec.

## Beats + pattern interrupts
2–3s per beat standard; luxury drone 3–4s MAX; **no beat over 4s**. Minimum 12 beats in a 45s
video. Three motion types minimum (push_in, push_counter, slow_pan, multi_point_pan,
gimbal_walk, cinemagraph, parallax). No frozen frames at beat boundaries, no black bars at
transitions (parent div transparent + Sequence overlap).

Interrupts anchored to real content, not gimmicks: **25%** new visual register or text shock ·
**50%** hard register shift (exterior → interior, drone → closeup) · **75%** escalation ·
**final 15%** kinetic stat reveal. No brokerage attribution, logo, or contact info in the
reveal frame.

Locked 2026-05-07 for market-data video: narrative-only VO (the VO does not recite the numbers
the screen already shows), caption sync locked to VO timestamps with no padding, multi-color
line chart on the price beat, and photo diversity (no repeated photo inside one render).

## Text overlays + safe zones
**Import the constants from [`safe-zones.ts`](video_production_skills/captions/canonical/safe-zones.ts)
(mirror: [`video/market-report/src/captions/safe-zones.ts`](video/market-report/src/captions/safe-zones.ts))
— never hardcode coordinates per comp.**

| Aspect | Working safe zone | Avoid |
|---|---|---|
| Portrait 1080×1920 | x 90–990, y 280–1480 | top 0–280 (profile pill + follow), right 960–1080 (action column), bottom 1480–1920 (caption box + engagement chrome) |
| Landscape 1920×1080 | x 90–1830, y 80–1000 | top 0–80 (title overlay), bottom 1000–1080 (control bar) |
| Square 1080×1080 | x 90–990, y 90–1010 | no major platform overlay |

Body ≥ 48px, headlines 64–80px. Min 2s display per block, max 5–7 words per block. **Any scene
with readable text holds ≥ 2.5s; a text-heavy opening holds ≥ 3s** — the hook grabs attention
without flashing by unread. Numbers carry units always: "$3,025,000" not "3,025,000", "4
bedrooms" not "4 BR". White text + shadow OR a dark pill under text; never white-on-white.

## Captions — HARD RULES (ship-blockers)
Captions are the most-watched element on muted feeds. Choppy or overlapping captions kill
retention.

1. **Captions NEVER render over other visual components** — no overlap with stats, numbers,
   charts, logos, end-card elements, or animated text overlays. If a competing element needs
   the zone for a beat, the caption is suppressed for that beat.
2. **A dedicated reserved zone no other component may enter.** Portrait y 1280–1460 (center
   1370), x 90–990. Landscape y 880–1000 (center 940), x 90–1830. Square y 850–1010 (center
   930), x 90–990. Constants: `CAPTION_PORTRAIT` / `CAPTION_LANDSCAPE` / `CAPTION_SQUARE`.
   (The older y 1480–1720 portrait coords sat inside the platform action UI — retired.)
3. **SINGLE-WORD AMBOQIA** (Matt 2026-05-20, supersedes the sentence-with-highlight rule).
   ONE word at a time, large, centered, in Amboqia Boriango — never AzoSans, Geist, Anton, or
   Inter. The word appears at speech start and fades at speech end. No phrase windows, no
   3-word chunks, no full sentences, no karaoke highlight, no pill background, no gold. White
   text + soft drop shadow directly on the photo. Canonical component:
   [`SingleWordCaption.tsx`](video_production_skills/captions/canonical/SingleWordCaption.tsx)
   (market-report mirror: [`here`](video/market-report/src/captions/SingleWordCaption.tsx)).
   **Every video with VO uses it — no exceptions, no alternates.**
4. **Crossfade ≤ 100ms between adjacent words.** Hard cuts flicker and are banned. Gaps under
   100ms crossfade; gaps over 500ms render true silence. `CROSSFADE_SEC = 0.08`.
5. **Timing syncs to ElevenLabs `/v1/forced-alignment` word timestamps** — never clock-time
   slots or `<Sequence>` boundaries. Generate the alignment JSON next to every VO MP3 before
   rendering; the component reads `{ text, startSec, endSec }` per word.
6. **No choppy or jittery changes.** No flicker, 1-frame blips, mid-word fade-outs, font-size
   oscillation, or re-layout jumps. Amboqia loads via `loadAmboqia()` from
   [`load-amboqia.ts`](video_production_skills/captions/canonical/load-amboqia.ts) before the
   first render — a caption render without the brand font is a ship-blocker.

*Migration status (2026-07-24):* legacy caption components remain under `video/*` and
`listing_video_v4` — migrate each to a re-export of the canonical component when touched.
**Known breakage:** several gate-excluded comps under `video/` import a dead `safe-zones`
path and do not compile — repoint when next touched.

## VO — ElevenLabs Victoria, mandatory
**Voice: Victoria, ID `qSeXEcewz7tA0Q0qk9fH`** (locked 2026-04-27, permanent — saved as
"Victoria — Ryan Realty Anchor"). Middle-aged American, conversational, warm, trustworthy. **No
other voice, no other vendor, no substituting, no asking.**

**Canonical model + settings (2026-05-07, conversational tuning):** `eleven_turbo_v2_5`,
stability **`0.40`**, similarity_boost **`0.80`**, style **`0.50`**, `use_speaker_boost: true`.
A different model or different settings is a different-sounding voice and a rejected render.
**Never fall back to the old 0.50/0.75/0.35 values.** Override per-script via `voice_settings`
in `script.json`.

**Every VO call goes through [`scripts/_voice_lib.py`](scripts/_voice_lib.py) — no inline ElevenLabs API calls.**
Env: `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_ID_VICTORIA`, `ELEVENLABS_API_KEY`.

Delivery: sentences short, two clauses max, no commas where Matt wouldn't pause. Split long
sentences into clauses; for very long lines use multiple `segments` rather than one run-on.
`previous_text` chained across all lines for prosody continuity. Numbers spelled out for
ingestion ("475,000" → "four hundred seventy five thousand"). IPA phoneme tags work on
`eleven_turbo_v2_5` and `eleven_flash_v2`, and are silently SKIPPED on `eleven_v3` — use turbo
for any line needing forced pronunciation. Tricky names: Deschutes (`dəˈʃuːts`, "duh-shoots"),
Tumalo (`TUM-uh-low`, NOT "TOO-muh-low" — local pronunciation, verified 2026-05-06), Tetherow,
Awbrey, Terrebonne, Paulina (`pol-EYE-nuh`), Madras (`MAD-russ`).

## Brand in frame
- **News, market reports, area guides, memes, evergreen:** zero brand. No logo, no "Ryan
  Realty" text, no phone, no agent name, no URL anywhere in frame.
- **Listing videos:** the navy logo IS in frame, in the 200px footer bar only (below). No
  phone, agent name, or URL anywhere else.
- Colors and fonts per §3. End card uses
  [`stacked_logo_white.png`](listing_video_v4/public/brand/stacked_logo_white.png) — never
  text-only Ryan Realty.

**Listing video overlay system (approved 2026-04-28, colors migrated to v2 2026-05-12).** The
old single-panel approach is dead. TWO layers, both required, byte-identical across every
video in a batch:
1. **Text-zone scrim:** `rgba(0,0,0,0.40)` covering ONLY the headline/address/price block. Hard
   rectangle. **No feathering, no drop shadows, no `text-shadow`, no `filter: drop-shadow()`.**
   Photo shows through at 60%.
2. **Logo footer bar:** 200px tall, flush bottom (`y=1720→1920`), cream-tinted over the photo.
   Navy wordmark from [`logo-blue.png`](design_system/ryan-realty/assets/brand/logo-blue.png),
   **580px wide**, vertically centered. No gold, no drop shadow.

The strip between the two layers shows clean unobstructed photo — no scrim, no gradient.

## Render hygiene
```
cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 \
  --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92
```
**Concurrency=1 is required** (Chrome OOMs higher). The audio-codec patch is in place (native
`aac`, not `libfdk_aac`); ffmpeg/ffprobe symlink to static-ffmpeg. If the audio mix hangs, fall
back to a video-only render plus
`ffmpeg -i video.mp4 -i vo.mp3 -c:v copy -c:a aac -shortest`. Pre-render asset audit: verify
`listing_video_v4/public/v5_library/`, the brand logo, `listing_video_v4/public/fonts/`, and
every referenced VO mp3 exists.

## Quality gate (run BEFORE asking for approval)
```
[ ] ffprobe Duration in [30s, 60s]
[ ] ffmpeg blackdetect strict (pix_th=0.05) returns ZERO sequences
[ ] python3 scripts/check_first_frame.py <render.mp4>  ← ship-blocker
[ ] Frame at 25% has a visual register change
[ ] Frame at 50% has a pattern interrupt
[ ] Final 15% is a kinetic reveal
[ ] No frozen frames at beat boundaries; no black bars at transitions
[ ] Banned-words grep clean across captions, VO script, source pills
[ ] All on-screen numbers carry units and trace to citations.json
[ ] No logo / "Ryan Realty" / phone / agent name in any frame except the end card
[ ] File size < 100 MB
```

## Viral scorecard (AFTER the quality gate, BEFORE asking for approval)
Score 1–10 in each of: hook, retention, text, audio, format, engagement, cover, cta,
voice/brand, antislop. **Format minimums:** listing video 85 · market data 80 · neighborhood
80 · meme 75 · earth zoom 85 · news clip 80. Default ship floor 80. Write
`out/<deliverable>/scorecard.json` and `citations.json` next to the render. Engineer the BEATS
array against the scorecard from beat 0 — never "score later."

**Auto-zero, ship-blocking regardless of headline score:** a banned word, an unverified number,
AI without disclosure, or a fair-housing hit.

## Banned-content gate (each one blocks a ship on its own)
1. No generic real-estate language (§2 applies to captions, VO, on-screen text, and the post
   caption carrying the video).
2. **Do not invent a listing.** Subject-property stills and the view from an address are
   camera or MLS. Place chrome may be generated from a real local still. Prompt-only scenic
   slop is refuse. Charts render in code. Standard: creative-brain law 1.
3. VO is ElevenLabs Victoria only, with the pronunciations above.
4. Music is beat-synced or absent. A bed that fights the edit is worse than silence.
5. Every number is source-verified per §0 and present in `citations.json`.
6. A brand-new format gets human review for its first 30 days before running unattended.
7. No AI-written humor, no engagement bait ("comment YES for the link", "wait for it", fake
   questions).
8. Brand visual standards hold in every frame.

## Video review gate — no MP4 ships without Matt (locked 2026-04-27)
**No rendered video is committed or pushed without Matt's explicit approval.** Applies to
`listing_video_v4/public/v5_library/` and every other public path, in every format. Source
changes (`.tsx`, `.py`, skill docs, scorecards, citations.json) push as normal — those are
infrastructure, not the deliverable.

1. Render to `out/` (untracked). 2. Run the quality gate. 3. Present the local path to Matt.
4. Wait for explicit ship approval. 5. Only then copy to `public/v5_library/`, add, commit,
push. Cheaper to fix in `out/` than to revert a public commit.

---

# §5. Marketing Brain Architecture

Any agent producing content, writing site copy, mutating ad campaigns, or sending
communications on behalf of Ryan Realty reads this first.

**Producer freeze lifted 2026-07-21** (G45 deleted); producers still route through the
action-row protocol, the approval queue, and the voice/QA gates.

## Three invocation modes

| Mode | Matt says | Skill | What happens |
|---|---|---|---|
| **Run brain** | "run the brain", "weekly brain", "what should we make" | [`marketing_brain_skills/run/SKILL.md`](marketing_brain_skills/run/SKILL.md) | Full cycle: audits → action rows → dispatch producers in parallel → surface drafts |
| **Direct produce** | "make a listing video for…", "create a flyer for…" | [`marketing_brain_skills/produce/SKILL.md`](marketing_brain_skills/produce/SKILL.md) | Parse request → one action row → dispatch the matching producer → surface draft |
| **Read plan** | "show me the brain report", "what's pending" | read-only query | Surface pending rows + statuses, no dispatch |

**Never invoke a producer directly without going through one of the two entry-point skills** —
they enforce the approval gate and the action-row audit trail.

## The protocol: `marketing_brain_actions`

Every marketing action gets one row in `public.marketing_brain_actions`. Key columns:
`action_type` (`content:listing_reel`, `site:copy_update`, `ops:meta_ads_pause`, …), `target`
(`mls:220189422`, `/listings`, `city:Bend`), `assigned_producer` (path to the producer's
SKILL.md), `payload`, `data_evidence`, `generation_reason`, `executor_response`, `executed_at`.
`public.content_briefs` is a backward-compat view over it.

```
pending → in_production → ready → [Matt approves] → approved → executed → measured
                                                                  │
                                           killed ◄───────────────┘ (Matt cancels or QA fails)
```

| prefix | approval | what counts as approval |
|---|---|---|
| `content:*` | matt-review-draft | Matt says "ship it" / "approved" / "go" after seeing the draft |
| `site:*` | matt-review-PR | Matt merges the PR |
| `ops:*` | matt-explicit | Matt explicitly names the action (never inferred) |
| `comms:alert`, `analyze:*` | none | internal; surfaced in the digest |

## Execution path

**The canonical path is the cron.** Brain creates `pending` → `producer-dispatcher` →
`in_production` → `producer-runtime` executes (loads the producer's SKILL.md, calls the
Messages API, cost-capped $5/row, $15/run, max 3 rows/run) → `ready` → Matt reviews at
`/admin/approval-queue` → approve → `publisher-sweep` → `executed` →
`marketing-measurement-loop` → `measured`.

A **one-shot admin trigger** (`POST /api/admin/run-producer/[id]`) runs exactly one row with
the same logic. The **direct CLI** (`python3 scripts/build_X.py <payload.json>`) is legacy and
discouraged — guarded by `require_action_row(payload)` in `scripts/_producer_lib.py`, opt-in
per producer; once a producer calls the guard, rogue invocations refuse unless
`PRODUCER_ALLOW_ROGUE=1`.

**Cadences come from [`vercel.json`](vercel.json), not from prose** — prose drifted and was
wrong until 2026-07-24. Read the schedule there. `scripts/check-cron-registered.mjs`
(`ci:cron-registered`) enforces that every cron route is registered.

**Skill-only producers** (REGISTRY rows marked `⚠️ NO_SCRIPT`) run ONLY via the
producer-runtime cron, which reads the SKILL.md directly. Cron-callable does not require a
build script — the SKILL.md IS the recipe.

## Registry + routing

**Path: [`marketing_brain_skills/producers/REGISTRY.md`](marketing_brain_skills/producers/REGISTRY.md).**
Sections A–F are brain-callable producers; G–I are capabilities and infrastructure. Find the
row whose `action_types` contains your string; its `path` column is `assigned_producer`.
**Never hard-code a producer path — always resolve through the registry.**

**Every `content:*` action dispatches through
[`automation_skills/content_engine/SKILL.md`](automation_skills/content_engine/SKILL.md)**,
regardless of source. No content producer is invoked directly — the content engine owns
storyboard → build → QA → Matt review → publish → post-mortem. Skipping it skips the QA gate
and the viral scorecard. Non-content actions dispatch directly to `assigned_producer/SKILL.md`.

## Producer expertise model — tiered mandatory reads

Every producer reads its own references before executing. **These apply GLOBALLY — every piece
of content inherits them whether the producer "knows about" the rule or not. If a rule is
hidden in a skill the producer doesn't load, the rule itself is broken: move it into a tier.**

- **Tier 1 — every producer:** §0 data accuracy · §1 approval model · design system SKILL.md ·
  brand-voice SKILL.md + voice_guidelines.md (`grep_banned()` / `has_hard_fail()` from
  `scripts/_producer_lib.py`).
- **Tier 2 — every content producer, additionally:** the content engine SKILL.md ·
  platform-best-practices SKILL.md · §4 video hard rules (which replaced the deleted
  ANTI_SLOP_MANIFESTO and VIRAL_GUARDRAILS).
- **Tier 3 — video / animated producers, additionally:** §4 captions · §4 safe zones (import,
  never hardcode) · §4 ElevenLabs settings (through the shared libs, no inline API calls) ·
  `scripts/check_first_frame.py` before publish.
- **Tier 4 — flat-design / static-image producers** (FB lead-gen ad, flyer, IG carousel,
  LinkedIn doc carousel, map card, Google Ads SERP card), additionally:
  [`competitor-design-recon/SKILL.md`](marketing_brain_skills/competitor-design-recon/SKILL.md)
  — read `out/design-recon/<format>/recon.md` at build time and adapt a documented pattern
  instead of inventing layouts.
- **Tier 5 — the one producer SKILL.md** matching your action_type, resolved through REGISTRY.

The [`TEMPLATE.md`](marketing_brain_skills/producers/TEMPLATE.md) scaffold enumerates these
tiers and the 10 required sections (scope · action types · payload schema · recipe · tools ·
output format · approval gate · status flow · failure modes · related skills). Its frontmatter
must list every `action_types` string the producer handles.

**Recommended pre-render enforcement**, in order: (1) verify the source imports the canonical
voice + caption/safe-zone libs, (2) run the brand-voice check on all on-screen text + VO,
(3) render then `check_first_frame.py`, (4) blackdetect + duration.

**Exemplar:** [`social_media_skills/list-kit/SKILL.md`](social_media_skills/list-kit/SKILL.md)
is the canonical compound-producer pattern — one data pull fans out to 5 parallel deliverables,
verification trace per figure, kit-manifest.json, approval gate, publish step, asset-library
registration. Read it before building any new orchestrator-class producer.

*Platform tokens (2026-05-06):* Meta LIVE with publishing scopes; LinkedIn/YouTube/X/GBP
tokened; TikTok/Pinterest/Threads need a first-time OAuth connect.

---

# §6. Mechanical guardrails

Prose rules in this file are advisory. **The only rules I am required to follow are the ones
encoded as mechanical gates — they fail my commit.** Full catalog:
[`docs/MECHANICAL_GATES.md`](docs/MECHANICAL_GATES.md).

Before every commit on a user-facing surface:

```bash
npm run ci:gates
```

**[`package.json`](package.json) → `ci:gates` is the authoritative chain — do not re-enumerate
it in prose, it drifts.** It runs design-tokens, seo-routes, DAL boundary, brand-voice, mockup
parity, page DAL, static params, cron-registered, and the meta-gate `ci:gates-wired`, among
many others.

The meta-gate fails on any `scripts/check-*.mjs` that runs nowhere — closing the blind spot the
2026-06-20 audit found (28 gate files ran nowhere while docs called some "enforced"). 7 remain
a tracked orphan backlog in `scripts/gates-wired-baseline.json`; the count may only shrink.

**Mockup parity** (`scripts/check-mockup-parity.mjs`) is the one added 2026-05-28 that matters
most: every Wave 3 page rebuild must satisfy
`design_system/ryan-realty/ui_kits/<route>/parity.json`, which enumerates every component the
mockup says the page must import. Editing `app/<route>/page.tsx` without the matching
components fails CI. New gated route: place the mockup, create `parity.json`, the gate picks it
up.

DB-dependent gates (G16 `ci:data-access`) run locally/nightly — they hit live Supabase, so they
are NOT in the secret-less static chain.

**If a guardrail keeps being violated, the answer is a new mechanical gate, not more prose.**
Add it via the pattern in `docs/MECHANICAL_GATES.md`.

## Which rule here is a gate, and which is only prose

A gated rule fails the commit whether or not you read the section. An ungated rule is enforced
by a reviewer or by nothing — those are the ones that rot, so treat them as the ones to convert
next.

| Rule | Mechanism | Gate script |
|---|---|---|
| Brand voice — punctuation, invented quotes, Value my home | gated | `check-brand-voice.mjs` (vocabulary in `brand-voice-vocabulary.cjs`) |
| Design tokens — no off-brand hex, no raw controls | gated | `lint-design-tokens.js` |
| Mockup parity per surface | gated | `check-mockup-parity.mjs` |
| DAL boundary — no raw `.from()` outside `lib/data/` | gated | `check-dal-boundary.mjs` |
| Every `app/<route>/page.tsx` imports the DAL | gated | `check-page-dal.mjs` |
| `listings` mixed-case columns are quoted | gated | `check-dal-column-quoting.mjs` |
| MoS formula + thresholds | gated | `check-market-formula.mjs` |
| Schema snapshot + DAL index stay current | gated, local/nightly (needs DB creds) | `check-data-access.mjs` |
| Every cron route registered in `vercel.json` | gated | `check-cron-registered.mjs` |
| THE LOOP process canon, no rogue plan files, ship-class (no rebuild per fleet finding) | gated | `check-process-canon.mjs` |
| Loop skills stay on the 2026-07-21 approval model | gated | `check-loop-skills-canon.mjs` |
| Every `scripts/check-*.mjs` actually runs somewhere | gated (meta) | `check-gates-wired.mjs` |
| A ledger row cannot claim "done" without a real mechanism | gated (meta) | `check-program-complete.mjs` |
| This file cites no dead path, no decommissioned doc, no retired v1 token, and does not regrow | gated | [`check-claude-canon.mjs`](scripts/check-claude-canon.mjs) |
| Rendered video deliverables carry an approval marker | gated via commit-msg hook | `check-draft-first.mjs` |
| First frame of a render is a usable thumbnail | gated in the render pipeline, not CI | `check_first_frame.py` |
| §0 data accuracy — every number traces to a named source | **prose + reviewer.** No gate can read a deliverable's intent; the per-figure verification trace is the mechanism | — |
| §4 video hard rules — length, hook, beats, safe zones, VO | **prose + the hand-run quality gate** | — |
| §1 approval model — the four per-action classes | **prose**, except the commit-msg marker | — |

---

# §7. Data + Supabase discipline

**Project:** `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`). `listings` held 589K+ rows as of
2026-04-29 — always paginate or aggregate, never `SELECT *` without a tight filter.

**Read these BEFORE writing any SQL or market-report code:**

1. **[`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md)** — every `public.*`
   table, the cache model (`market_pulse_live` 10–15 min freshness, `market_stats_cache` 6-hour),
   the 14 resort communities + 14 Bend neighborhoods + cities, slug formats per `geo_type`, the
   SFR-only convention, and the mixed-case quoting rule. Registry source of truth:
   [`data/resort-communities.json`](data/resort-communities.json).
2. **[`docs/DATABASE_SCHEMA_SNAPSHOT.md`](docs/DATABASE_SCHEMA_SNAPSHOT.md)** — auto-generated;
   every column, type, nullable, default, plus row counts on hot tables.
3. **[`docs/DAL_INDEX.md`](docs/DAL_INDEX.md)** — auto-generated; every DAL function, the tables
   it touches, columns it selects, cache key + TTL + tags.

Both auto-generated files are regenerated by G16 — **do not hand-edit.**

## Rules

1. **Schema discovery is forbidden.** If you need to know a table's columns, read the snapshot.
   **Never query `information_schema`** — the answer is already on disk, and the query wastes
   context to reproduce it.
2. **DAL-first reads.** If the data is reachable via a function in `DAL_INDEX.md`, call it.
   `getMarketPulse({geoType, geoSlug})` beats `SELECT FROM market_pulse_live …`. Ad-hoc queries
   bypass `unstable_cache`, hit production directly, and load a system whose response times
   affect every user.
3. **No raw `.from()` outside `lib/data/`** (G1). **Every `app/<route>/page.tsx` imports
   `@/lib/data`** (G8).
4. **Snapshot + index stay current** (G16). Drift = a migration landed without refreshing the
   snapshot, or a DAL change without refreshing the index. Fix:
   `npm run ci:data-access -- --refresh`, then commit. The snapshot regenerates via
   `public._agent_schema_dump()` (SECURITY DEFINER, migration
   `20260528020000_agent_schema_dump_function.sql`); the index by AST-walking `lib/data/**/*.ts`.
5. **The one legit use of `execute_sql`:** investigating actual data quality, not schema. Even
   then read the snapshot first, then run ONE targeted query.
6. **Don't aggregate raw `listings` for market reports — use the cache.**

## The mixed-case column trap (#1 cause of failed listings queries)

`listings` uses RETS mixed-case column names that Postgres preserves only when quoted. **In raw
SQL, every mixed-case column must be wrapped in double quotes** or the query returns "column
does not exist."

Quoted: `"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`,
`"Longitude"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"SubdivisionName"`, `"ClosePrice"`,
`"CloseDate"`, `"CumulativeDaysOnMarket"`, `"BedroomsTotal"`, `"BathroomsTotal"`.
Bare (lower-case): `year_built`, `pending_timestamp`, `price_per_sqft`.

```sql
-- correct
SELECT "StreetNumber", "ListPrice", year_built FROM listings
WHERE "StandardStatus" = 'Active' LIMIT 50;
-- silently wrong: "column does not exist"
SELECT StreetNumber, ListPrice FROM listings WHERE StandardStatus = 'Active';
```

**This applies to RAW SQL only.** supabase-js handles bare mixed-case names correctly —
putting literal `"` inside a JS string sends the quotes to PostgREST as part of the column name
and silently returns nothing. Enforced by `check-dal-column-quoting.mjs`.

## Methodology version — cite the stamp, not the definition

`public.cache_methodology_definitions` holds 3 rows and the newest definition is
`v4-2026-05-15`. **But no live cache row is stamped v4.** Every row the site serves carries
`methodology_version = 'v3-2026-05-07'`: `market_pulse_live` 17/17 rows,
`market_stats_cache` 10,955 rows, plus 70 legacy `v1-pre-fix` and 5 NULL. **State
`v3-2026-05-07` — that is the stamp on the row — and never claim v4 for a served figure.** The
v4 definition was registered by migration
`supabase/migrations/20260515170000_resort_communities_neighborhood_aliases.sql` but the cache
writer never adopted the string. That gap is a tracked defect, not a doc error.

---

# §8. Work standards

- **No shortcuts, no assumptions.** Implement the full solution start to finish. Never present
  partial work as complete. When answering questions about the codebase, trace the logic all
  the way through to a confirmed answer — no surface-level glances, no guesses.
- **Always verify your own work.** Before saying something is done or true, confirm it: run the
  code, check the output, read the actual files. Every claim about code behavior must be
  verified by reading the relevant code. Every fix must be tested before it's reported done.
- **Truthful and accurate, always.** If you're not sure, say so. Never state something as fact
  unless you've confirmed it. If you got something wrong, own it immediately.
- **No partial answers.** On status questions, go all the way to the exact answer.
- **Ship on `main`.** Default checkout is `main`. Worktrees OK for parallel/experiment work —
  merge or hand off in `CROSS_AGENT_HANDOFF.md` before stop (anti-strand). See
  [`AGENTS.md`](AGENTS.md) Worktrees + Cost-aware push and `.cursor/rules/production-parity.mdc`.
- **Never ask Matt to run anything manually.** All git operations, terminal commands, and
  deployments are yours. Matt never touches the terminal.
- **Proactively clear git locks.** Check for and remove a stale `.git/index.lock` before any git
  operation. Never report a lock file as a blocker — fix it.
- **No blocked builds or commits.** If something is in the way, fix it. Exhaust every option
  before reporting an issue.
- **No half measures. Research how pros do it first, nail it the first time.** Before
  scaffolding anything non-trivial, look at how the best in the field actually do it and build
  to that standard. Don't ship a minimum-viable thing and iterate ten times — that wastes
  Matt's review cycles and produces drift.
- **Vault is the sole source of truth for transaction coordination.** Never reconcile
  transactions against SkySlope — it is a workflow tool, not a system of record. Treating it as
  authoritative is a known failure mode that produces wrong audit numbers.
- **Full company scope on all audits.** Every audit runs across all brokers, all mailboxes, and
  the max available date range by default. Never narrow to one broker, one inbox, or the last
  30 days unless Matt explicitly asks. Partial-scope audits miss outliers and produce false
  clean reports.

## Opus orchestrator policy

This agent runs on Opus, roughly 15× Haiku's per-token cost. **Do not burn Opus context on
mechanical or bulk work** — delegate via the `Agent` tool (`model: "sonnet"` or `"haiku"`).

**Always delegate:** codebase enumeration and grep sweeps, bulk refactors and rename-across-repo
tasks, reading/parsing >10 files to understand a module, long test suites and builds, data
extraction from Supabase / large CSVs / logs.

**Opus keeps:** architecture decisions, the final code review before ship, user-facing product
decisions and trade-offs, and complex debugging where context spans multiple systems.

Launch parallel subagents in one message when the work is independent.

## Persistent memory + handoff

Durable cross-session notes live in **`.auto-memory/`**. **Hand off to Cursor / the other agent**
by updating [`docs/plans/CROSS_AGENT_HANDOFF.md`](docs/plans/CROSS_AGENT_HANDOFF.md) (what
shipped, what is next, commit SHA, skills you read) before Matt switches tools. The other side
pulls `main` and reads that file first. See [`AGENTS.md`](AGENTS.md).

---

# §9. Skill routing

**Global index:** open `~/.claude/GLOBAL_SKILLS_REGISTRY.md` (git mirror:
`docs/plans/GLOBAL_SKILLS_REGISTRY.md`) for the full inventory before loading skills ad hoc.

**Load skills first.** If a task might match any `SKILL.md` in this repo (`.claude/skills/`,
`.cursor/skills/`, `marketing_brain_skills/`, `social_media_skills/`, `automation_skills/`) or
in Cursor's bundled paths, **read that skill before doing the work**. `video_production_skills/`
is NOT in that list — it holds three code modules and no skills.

**Mandatory:** `engineering:code-review` on every meaningful change before ship.
`engineering:deploy-checklist` before any production deploy. `design:design-system` when
shadcn/ui compliance is in question. `data:*` fires automatically on any Supabase/SQL/analytics
task. Everything else fires on trigger match.

## Sister skill libraries

- **`social_media_skills/`** — per-deliverable producer skills. Index at its README. Resolve
  through REGISTRY, never by guessing a path.
- **`automation_skills/`** — three triggers (`listing_trigger`, `market_trigger`,
  `trend_trigger`) plus the surviving pipelines under `automation_skills/automation/`
  (`post_scheduler`, `performance_loop`, `engagement_bot`, `ab_testing`, `publish`, `qa_pass`,
  `feedback_loop`, `buffer_poster`, `api_knowledge`) and `automation_skills/content_engine/`.
  `repurpose_engine` and `thumbnail_generator` were deleted 2026-06-15. Inbound DM/comment lead
  capture writes to `public.crm_people`.
- **`video_production_skills/`** — **not a skill library.** Three code modules only.

## Content routing — which file to load per deliverable

| Trigger | Load this |
|---|---|
| Any video build (market report, listing reel, news clip, neighborhood guide, meme) | **§4 of this file** — the complete ruleset. Remotion projects live in `video/` and `listing_video_v4/`. |
| SEO blog post | [`social_media_skills/blog-post/SKILL.md`](social_media_skills/blog-post/SKILL.md). Publishing path is Supabase `blog_posts` rendered by the live Next site. |
| Paid Meta pipeline, marketing automation, weekly optimization crons, seller funnel | [`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`](docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md) first, then [`docs/MARKETING_LEAD_FLOW.md`](docs/MARKETING_LEAD_FLOW.md), `.cursor/skills/facebook-seller-growth/SKILL.md` |
| Facebook lead-gen ad | the two docs above for live wiring, then `social_media_skills/facebook-lead-gen-ad/SKILL.md` |
| Seller LP follow-up workflow | **The in-house CRM sequence engine.** `app/lp/seller-home-value/actions.ts` → `autoEnrollByFubId()` in [`lib/crm/enroll.ts`](lib/crm/enroll.ts); `/api/cron/crm-auto-enroll` sweeps misses; `/api/cron/crm-sequence-engine` fires touches (pause-on-reply lives inside it); `/api/cron/crm-scheduled-sends` delivers. Sequences edited at `/admin/crm/sequences`. |
| Expired / Canceled / Withdrawn listing workflow | [`marketing_brain_skills/producers/expired-listing-lp/SKILL.md`](marketing_brain_skills/producers/expired-listing-lp/SKILL.md) · `/lp/expired-listing` · `public.expired_listings`. Detection runs inside the delta sync, NOT on a schedule — the `detect-expired-listings` route exists but is not registered in `vercel.json`. Voice: authentic, never salesy, no "most agents do X" framing. |
| Per-broker agent attribution | `?agent=<slug>` (`matt`, `rebecca`, `paul`, or full-name variants) → `components/AgentAttributionBridge.tsx` writes the `rr_agent_attribution` cookie (90-day). Server: `readAttributedAgentServer()` in `app/actions/agent-attribution-read.ts`. Both LP forms call it and override the default Matt-routing when set. |
| Broker texts the marketing line (SMS agent) | [`docs/plans/BROKER_SMS_AGENT_2026-07-31.md`](docs/plans/BROKER_SMS_AGENT_2026-07-31.md) · `lib/agent/` |
| Any PDF a person receives | [`docs/PAGE_CONTRACT.md`](docs/PAGE_CONTRACT.md) |
| Supabase market-data tables | §7 and the three docs it names |
| Asset library | manifest at `data/asset-library/manifest.json`, CLI at [`lib/asset-library.mjs`](lib/asset-library.mjs). Photos carry vision grades — search the `vision_*` fields. |
| CMA / valuation ("what's this property worth", "pricing opinion on…") | [`marketing_brain_skills/producers/cma/SKILL.md`](marketing_brain_skills/producers/cma/SKILL.md) — branded HTML CMA, signed by the broker handling the listing (resolved from `public.brokers`, falls back to Matt). Recorded in `public.cmas` + `cma_comps`. |
| Public UI/UX grind / next version of the site / page grade | **KILLED 2026-08-16.** Do not run page-grade. The skill is a refuse stub. Look is Matt keep/kill on real pages. Product of record: [`docs/plans/PUBLIC_PRODUCT/PRODUCT.md`](docs/plans/PUBLIC_PRODUCT/PRODUCT.md). |

**The CRM is in-house.** Follow Up Boss was decommissioned 2026-06-24; every lead path now
writes to `public.crm_people` via `sendEvent()` → `ensureNativeLead`. Docs written before the
cutover describe an engine that no longer runs — read their "Follow Up Boss" as "the in-house
CRM", and do not build against the retired workflow docs. Archive index:
[`docs/archive/fub-era/README.md`](docs/archive/fub-era/README.md).
