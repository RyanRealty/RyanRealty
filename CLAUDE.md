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
   (segment, geography, status, close-date range). The printed number must equal the shipped one.
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
- **SFR** = `property_sub_type='Single Family Residence'` (bare `'A'` is a mixed bucket — MARKET_TRUTH D1). YTD windows, apples-to-apples periods. YoY = the
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

# §3. Design System

**THE PUBLIC SITE HAS ONE DESIGN SYSTEM (2026-08-27).** `components/site/v3` is the only
register, and its look lives entirely in
[`components/site/v3/tokens.css`](components/site/v3/tokens.css) on `:root`. One file, 118
pages: change a value there and every public page moves, charts and scrims included. Brand
color is applied as `bg-navy` / `text-cream` (Tailwind theme colors reading those tokens),
never a literal hex. The spec is
[`design_system/public/PUBLIC_UI.md`](design_system/public/PUBLIC_UI.md); the pattern set is
OPEN (build a new barrel primitive when a section needs one) and the only rhythm rule is that
no two adjacent sections share a pattern. Held by `ci:one-design-system` and
`ci:chrome-single-source`. The KB register, the legacy chrome, and the per-surface mockups
were deleted 2026-08-27.

**TASTE IS A GATE (Matt 2026-09-01).** Before any public page work, read
[`design_system/public/TASTE.md`](design_system/public/TASTE.md): the page to beat, banned
tells, interaction on every data section, and a SEPARATE-agent evaluator pass recorded as
`tasteReview` in the route's parity.json. Held by `ci:taste-canon`. Any agent, every session.

**Everything below governs PRINT, SOCIAL and EMAIL artifacts, plus admin/product surfaces.**
It is not the public site's look.

**Canonical source: [`design_system/ryan-realty/`](design_system/ryan-realty/).** Read order:
[`MANIFEST.md`](design_system/ryan-realty/MANIFEST.md) →
[`SKILL.md`](design_system/ryan-realty/SKILL.md) →
[`colors_and_type.css`](design_system/ryan-realty/colors_and_type.css). Never invent colors,
fonts, or asset paths from memory — open the source.

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

**No per-surface mockup any more** (retired 2026-08-26, deleted 2026-08-27); the target is
[`PUBLIC_UI.md`](design_system/public/PUBLIC_UI.md), built from `components/site/v3`. The
`parity.json` beside each binds and is THE PAGE PLAN —
[`PAGE_PLAN.md`](design_system/public/PAGE_PLAN.md): class, objective, the questions the page
must answer, the rival it beats. `ci:page-plan` walks every public route and asks for one
(25/112 had one on 2026-09-05). Grind: `/site-consistency`, one class at a time.

**The table below is for ADMIN and PRODUCT surfaces.** On the public site the equivalent
rule is: build from the v3 barrel, and a section that fits no existing pattern gets a NEW
barrel primitive rather than hand-rolled markup.

**The primitive-per-need table lives in the canonical source**, not here:
[`design_system/ryan-realty/SKILL.md`](design_system/ryan-realty/SKILL.md). The rule it
encodes is one line: on admin and product surfaces build from `@/components/ui/*` and use
the semantic token classes (`bg-primary`, `text-muted-foreground`, `border-border`), never a
raw HTML control and never a raw color. On the PUBLIC site build from `components/site/v3`.

Always use `cn()` from `@/lib/utils` for conditional/merged classes; never string-concatenate
class names. Do NOT use `card-base`, `btn-cta`, or any custom class from globals.css. The
`--font-sans` token is Geist (loaded via `next/font/geist`); the radix-nova stone neutral base
and the `--primary` oklch (evaluates to navy) are correct — do not edit.

## Assets

Inventory lives in [`MANIFEST.md`](design_system/ryan-realty/MANIFEST.md) — open it rather
than naming a file from memory. The two this file keeps referring to: the heritage wordmark
[`logo-blue.png`](design_system/ryan-realty/assets/brand/logo-blue.png), and the mascot
**Jax** (`blue-dog.png`, `white-dog.png` on dark).

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

## Migration from the retired v1 spec

The retired v1 tokens — retired `#D4AF37`, `#C8A864`, `#F2EBDD`, AzoSans body type, the gold
logo bar — are held out by [`check-claude-canon.mjs`](scripts/check-claude-canon.mjs), which
fails any line reintroducing one without marking it retired. Rendered videos in
`public/v5_library/` stay as-is; a re-render migrates to v2.

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

# §4. Media — Grok surface + Studio (2026-08-26)

Never add a second video factory; Remotion is deleted.
**Every Grok call goes through [`lib/grok/`](lib/grok/)** (text, JSON, search,
vision, stills, edits, motion). Model ids sit in `lib/grok/client.ts`, gated by
`ci:grok-models`. Never call `api.x.ai` elsewhere.


**Production is the Studio:** [`lib/studio/`](lib/studio/), `/admin/studio`.
Slate cron is off. Drafts land `ready`; only Matt's approval plus
`publisher-sweep` posts (§1).
**Read [`docs/GROK_CRAFT_CANON.md`](docs/GROK_CRAFT_CANON.md) before generating.**
Non-negotiable: vision-inspect a hero still BEFORE paying for motion; 6s, one
camera axis; `generate_audio` off; no rendered text or logos in frame. Prompts
come from [`lib/studio/craft.ts`](lib/studio/craft.ts), never hand-written.

# §5. Marketing brain — producer runtime retired (2026-08-18)

Hourly SKILL.md producers are off. Inbox + `/marketing/request` file a row but
run no producer. CMA, newsletter, CRM, and the Facebook seller report stay as
TypeScript products. Social/media production is the Studio (§4).
Voice canon: [`marketing_brain_skills/brand-voice/VOICE.md`](marketing_brain_skills/brand-voice/VOICE.md).

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
| Every PUBLIC ROUTE has a page plan: class, objective, answers, named rival | gated (ratchet) | `check-page-plan.mjs` |
| DAL boundary — no raw `.from()` outside `lib/data/` | gated | `check-dal-boundary.mjs` |
| Every `app/<route>/page.tsx` imports the DAL | gated | `check-page-dal.mjs` |
| `listings` mixed-case columns are quoted | gated | `check-dal-column-quoting.mjs` |
| MoS formula + thresholds | gated | `check-market-formula.mjs` |
| Aggregate SQL over a stat table (an aggregate is a stat) | gated at tool time | `pre-tool-use.mjs` |
| No NEW raw stat aggregate in `scripts/` | gated (ratchet) | `check-script-stat-source.mjs` |
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
4. **[`docs/DATA_COVERAGE_INDEX.md`](docs/DATA_COVERAGE_INDEX.md)** — auto-generated; per entity,
   every other table holding it, rows, freshness, DEAD/THIN. **Read before claiming a gap.**

Both auto-generated files are regenerated by G16 — **do not hand-edit.**

## Rules

1. **Schema discovery is forbidden** — read the snapshot; never query `information_schema`.
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
5. **The one legit use of `execute_sql`:** data quality, not schema. Read the snapshot first,
   then run ONE targeted query.
6. **Don't aggregate raw `listings` for market reports — use the cache.**

## The mixed-case column trap (#1 cause of failed listings queries)

`listings` uses RETS mixed-case column names that Postgres preserves only when quoted. **In raw
SQL, every mixed-case column must be wrapped in double quotes** or the query returns "column
does not exist."

Quoted: `"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`,
`"Longitude"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"SubdivisionName"`, `"ClosePrice"`,
`"CloseDate"`, `"BedroomsTotal"`, `"BathroomsTotal"`.
Bare (lower-case): `year_built`, `pending_timestamp`, `price_per_sqft`.
Never publish `"DaysOnMarket"` as DOM (it is list-to-close). Warning: `docs/DATABASE_FOR_AI_AGENTS.md` §4a.

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
`v3-2026-05-07` — that is the stamp on the row — and never claim v4 for a served figure.**

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
  [`AGENTS.md`](AGENTS.md) Worktrees + Cost-aware push. **R-221:** do not poll GitHub Actions.
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
in Cursor's bundled paths, **read that skill before doing the work**.

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

## Content routing — which file to load per deliverable

| Trigger | Load this |
|---|---|
| Any video build | **§4** — Grok Imagine / Grok Video. Remotion factory is gone. |
| SEO blog post | [`social_media_skills/blog-post/SKILL.md`](social_media_skills/blog-post/SKILL.md). Publishing path is Supabase `blog_posts` rendered by the live Next site. |
| Paid Meta pipeline, marketing automation, weekly optimization crons, seller funnel | [`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`](docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md) first, then [`docs/MARKETING_LEAD_FLOW.md`](docs/MARKETING_LEAD_FLOW.md), `.cursor/skills/facebook-seller-growth/SKILL.md` |
| Facebook lead-gen ad | the two docs above for live wiring, then `social_media_skills/facebook-lead-gen-ad/SKILL.md` |
| Seller LP follow-up workflow | **The in-house CRM sequence engine.** `app/lp/seller-home-value/actions.ts` → `autoEnrollByPersonId()` in [`lib/crm/enroll.ts`](lib/crm/enroll.ts); `/api/cron/crm-auto-enroll` sweeps misses; `/api/cron/crm-sequence-engine` fires touches (pause-on-reply lives inside it); `/api/cron/crm-scheduled-sends` delivers. Sequences edited at `/admin/crm/sequences`. |
| Expired / Canceled / Withdrawn listing workflow | `/lp/expired-listing` · `public.expired_listings`. Detection runs inside the delta sync. |
| Per-broker agent attribution | `?agent=<slug>` (`matt`, `rebecca`, `paul`, or full-name variants) → `components/AgentAttributionBridge.tsx` writes the `rr_agent_attribution` cookie (90-day). Server: `readAttributedAgentServer()` in `app/actions/agent-attribution-read.ts`. Both LP forms call it and override the default Matt-routing when set. |
| Broker texts the marketing line (SMS agent) | [`docs/plans/BROKER_SMS_AGENT_2026-07-31.md`](docs/plans/BROKER_SMS_AGENT_2026-07-31.md) · `lib/agent/` |
| Any PDF a person receives | [`docs/PAGE_CONTRACT.md`](docs/PAGE_CONTRACT.md) |
| Supabase market-data tables | §7 and the three docs it names |
| Asset library | manifest at `data/asset-library/manifest.json`, CLI at [`lib/asset-library.mjs`](lib/asset-library.mjs). Photos carry vision grades — search the `vision_*` fields. |
| CMA / valuation | [`lib/cma/`](lib/cma/) + [`marketing_brain_skills/producers/cma/SKILL.md`](marketing_brain_skills/producers/cma/SKILL.md). Recorded in `public.cmas` + `cma_comps`. |
| Public UI/UX grind / next version of the site / page grade | **KILLED 2026-08-16.** Do not run page-grade. The skill is a refuse stub. Look is Matt keep/kill on real pages. Product of record: [`docs/plans/PUBLIC_PRODUCT/PRODUCT.md`](docs/plans/PUBLIC_PRODUCT/PRODUCT.md). |

**CRM is in-house** `public.crm_people` via `sendEvent()` in [`lib/crm/send-event.ts`](lib/crm/send-event.ts). Review at `/admin/crm`.
