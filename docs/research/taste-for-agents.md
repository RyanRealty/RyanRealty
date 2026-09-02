# Design taste for AI coding agents — research brief

Compiled 2026-09-01. All source-attributed claims below are paraphrases of WebFetch/WebSearch
tool summaries unless in quotation marks with a source cited immediately after — WebFetch
returns AI-generated summaries of pages, not verbatim page text, so even quoted fragments may
be the fetch tool's paraphrase rather than the original author's exact words. Treat every line
here as informational research, not a verified quote for publication.

## 0. The seed post — x.com/alextalksai/status/2094519795043479723

**Could not be retrieved.** WebFetch returned `HTTP 402 Payment Required` on the X URL (X's
API paywall, not a content block). Targeted WebSearch for the author handle + "taste" +
"coding agents", for the tweet's numeric ID, and for quote-tweet coverage found no page that
identifies or quotes this specific post. "alextalksai" as a handle otherwise resolves to an AI
advisory practice (alextalksai.com, run by Alexandra Zubko) — unclear if this is the same
account, and no page attributes any specific taste-for-agents claim to that handle. Per the
task's own accuracy standard: this section is a documented miss, not a filled-in guess. The
searches did surface the live public conversation the post was almost certainly part of or
reacting to — the "Taste Skill" open-source project's viral run (8K→78K GitHub stars,
early–mid 2026) and the broader "AI slop UI" discourse below, which is where the rest of this
brief concentrates.

---

## 1. What makes AI-generated UI feel tasteless — the visual tells, by source

**Taste Skill review (andrew.ooo)** — paraphrase of the article's framing: ask any current
model for "a SaaS landing page" and you reliably get a centered hero, a 3-column feature grid,
a pricing table, emoji icons, and "probably a purple gradient somewhere." The failure is
statistical, not stylistic — every vibe-coded app converges on the same shape because the
model has no design judgment, only the training-data average.

**Why Your AI Keeps Building the Same Purple Gradient Website (prg.sh)** — tells named:
Inter/Roboto/Arial as the default type family; purple gradients on white backgrounds; timid,
evenly-distributed color palettes; solid white or light-gray backgrounds with no depth;
three-column grids with icons; centered hero sections; predictable feature boxes; rounded
corners everywhere; subtle 0.1-opacity shadows; micro-interactions scattered without strategy
rather than motion used deliberately. Missing, not just generic: real visual hierarchy beyond
font-size, color theory, whitespace-as-design, brand personality, form validation, and error/
empty states.

**SmoothUI — AI Design Slop** — tells named: "the purple-to-cyan gradient" as the single most
common marker; glassmorphism with a neon glow; six identical cards in a row (icon + heading +
two lines of text, repeated); a hover bounce on every interactive element; missing focus
states; missing error/empty states; contrast and accessibility failures. This piece is
explicit that it will not give numeric thresholds — its fix is process (build → critique →
fix → re-evaluate loop), not a spacing/type scale.

**Anthropic — "Improving frontend design through Skills" (claude.com/blog)** — names the
mechanism as "distributional convergence": absent instruction, the model reaches for the
statistically safest, most common pattern in its training distribution, which is exactly the
generic SaaS template. Named tells: Inter and Roboto fonts; purple gradients on white
backgrounds; predictable, repeated layout and component patterns; flat solid-color backgrounds
instead of atmospheric depth. Anthropic's own framing: this output is "immediately
recognizable — and dismissible."

**Anthropic engineering — GAN-style generator/evaluator harness
(anthropic.com/engineering/harness-design-long-running-apps)** — the evaluator agent was
explicitly instructed to penalize "telltale signs of AI generation like purple gradients over
white cards" as part of scoring "originality." Independent confirmation, from inside
Anthropic's own tooling, that purple-gradient-on-white is treated as the canonical slop
signature, not just a meme.

**Cross-source pattern (all of the above agree):** the tells cluster into five repeatable
categories — (1) one over-used typeface (Inter/Roboto/Arial); (2) one over-used color move
(purple→blue or purple→cyan gradient, low-saturation palette, everything on white/light-gray);
(3) one over-used layout (centered hero, 3-or-6-card grid, bento grid); (4) decorative rather
than functional motion (hover bounce, glow, glass blur) paired with *missing* functional states
(focus, error, empty, loading); (5) flatness — no depth, no atmosphere, no brand-specific
identity, indistinguishable from any other AI output in the same session.

---

## 2. Concrete, mechanical rules practitioners give

### Typography

- Anthropic frontend-design skill (paraphrase, claude.com/blog): avoid Inter, Roboto, Open
  Sans, Lato, and default system fonts; reach for fonts with real character — examples given:
  JetBrains Mono, Playfair Display, Bricolage Grotesque. Principle stated: "High contrast =
  interesting" — pair a display face with a monospace, or a serif with a geometric sans, rather
  than one safe sans-serif everywhere. Type-scale rule: **jump sizes by 3x or more between
  levels, not the usual ~1.5x** — the claim is that small, timid jumps read as generic.
- Taste Skill (paraphrase, andrew.ooo review): bans Inter for creative work outright; mandates
  from a short list — Geist, Outfit, Cabinet Grotesk, or Satoshi.
- Refactoring UI (Wathan & Schoger), paraphrased from summaries: most interface problems are
  hierarchy problems — the reader can't tell what to look at first because everything carries
  similar visual weight. Fix hierarchy with font *size and weight together*, not size alone.
  Recommends a **1:1.618 (golden-ratio) step** for both a type-size preset scale and a spacing
  scale, so the two systems stay proportionally related.
- weberdominik.com "Rules for creating good-looking user interfaces, from a developer" — the
  most mechanically strict source found: **use only 2 font weights** total (one for
  headlines/emphasis, one for body) and **use only 2 text colors** (a darker shade for primary
  content, a lighter shade for secondary — example given: Tailwind `text-gray-900` and
  `text-gray-700`). Icon stroke weight must visually match the weight of the adjacent text.
- SmoothUI (paraphrase): cap body-text line length near **65 characters**; use a true ellipsis
  character `…`, never three periods `...`; reserve underlines exclusively for links (never
  decorative).

### Spacing, layout, components

- weberdominik.com: hard cap component *variants* rather than let them multiply — e.g. exactly
  3 button types (primary/solid, secondary/flat, tertiary/light) and a single style per other
  component (e.g., one Listbox style, not several). Form labels always sit above the input,
  never beside it. Group related fields with Card components rather than dividers alone.
  Explicit value judgment: **"slight imperfections with library components" are preferable to
  "perfection with custom components"** — i.e., don't hand-roll a control the design system
  already solved.
- Taste Skill (paraphrase, andrew.ooo + everydev.ai): forbid centered-hero layouts at high
  frequency — push toward asymmetric splits instead; cap accent-color saturation under 80%;
  require an explicit "brief inference" pass (industry, audience, mood, motion depth, layout
  family) before any code is generated, so the layout choice is argued for, not defaulted to.
- Refactoring UI (paraphrased): "embrace whitespace" as a design *material*, not empty space
  left over — generous padding around buttons/text reduces fatigue and does load-bearing
  hierarchy work that borders and boxes were doing badly.

### Color

- Anthropic (paraphrase): "dominant colors with sharp accents outperform timid, evenly
  distributed palettes." Commit to one cohesive aesthetic and hold it with CSS variables rather
  than sampling many similar mid-tone colors.
- Ryan Realty's own design system already encodes an extreme version of this same rule
  independently (§3 of `CLAUDE.md`): a **two-color palette** (navy + cream, white/black only
  for text-on-photo legibility), with a single reserved exception accent for data anomalies —
  i.e., the "commit to dominant + sharp accent, ban timid mid-tones" rule taken to its logical
  end.
- prg.sh / SmoothUI: purple-to-blue or purple-to-cyan gradients on light backgrounds are
  treated as disqualifying by default — not "use sparingly," but named as the single most
  recognizable AI tell and avoided outright.

### Motion

- Emil Kowalski (Linear), "Agents with Taste" (paraphrase, emilkowal.ski/ui/agents-with-taste):
  - Scale-in transforms should **start from `scale(0.95)`, never `scale(0)`** — starting from
    zero reads as an element popping from nowhere; a higher starting value reads as natural
    settling motion.
  - Easing chosen by *what the motion is doing*, not by feel: entering/exiting the viewport →
    ease-out; something moving or morphing on-screen → ease-in-out; a hover state change →
    ease; constant/looping motion → linear.
  - Duration bands, in milliseconds: **micro-interactions 100–150ms; standard UI (tooltips,
    dropdowns) 150–250ms; modals/drawers 200–300ms; nothing in a UI transition should exceed
    ~300ms.**
  - Minimum interactive hit-area: **44px**, achieved with an invisible pseudo-element if the
    visible control is smaller.
  - Buttons should compress slightly on press: `transform: scale(0.97)` on `:active`.
  - If an animation reads as jittery, add `will-change: transform` before touching anything
    else.
  - A **frequency rule**: anything a user sees 100+ times a day should get *no* animation at
    all — the cost of motion scales with how often it's seen, so heavily-repeated UI (list
    rows, common buttons) should be the least animated part of the product.
  - Kowalski separately (his `You Don't Need Animations` essay, per search summaries) argues
    most products over-animate: the default should be *no* animation, added back only where it
    clarifies cause and effect, not as decoration.
- This repo's own `CLAUDE.md` §3 "Motion ladder" (200ms fades / 300ms entrances / 400ms
  fade-up / 2s loops / 20s Ken Burns, ease-out entrances, ≤16px of travel, respect
  `prefers-reduced-motion`) sits inside the same numeric band Kowalski describes — independent
  convergence on "keep it under ~300ms for anything the user is actively watching."
- Anthropic (paraphrase): prefer CSS-only motion where possible; use the Motion library for
  React when JS is required; the highest-leverage move is **one well-orchestrated page-load
  with staggered reveals**, rather than many small independent micro-interactions scattered
  around the page.
- SmoothUI / general consensus across sources: animate `transform` and `opacity` only — never
  `width`, `height`, `top`, or `left` — because those trigger layout/paint on every frame
  instead of running on the compositor.

### Information density, real content, restraint

- weberdominik.com and Refactoring UI both converge on the same underlying claim even though
  neither states it as a slogan: constrain the *number of choices* the system offers (2 font
  weights, 2 text colors, 3 button variants, one scale ratio) rather than trying to police
  taste after the fact — restraint is enforced by narrowing the palette of legal moves, not by
  reviewing output for tastefulness.
- None of the fetched sources gave a specific "always use real content, never lorem ipsum"
  rule in so many words, but it is implied throughout the "missing states" critique (SmoothUI,
  prg.sh): slop UIs are recognizable partly because they only render the happy-path/populated
  state and never show loading, empty, or error states — i.e., real content discipline extends
  to *all* content states, not just the default one.

---

## 3. How authors recommend encoding taste into agent instructions

**Package it as a loadable skill file, not a permanent system-prompt block.**
Anthropic's own conclusion (paraphrase, claude.com/blog): rather than embedding design guidance
permanently in the system prompt, they moved it into a **Skill** — a markdown document the
agent loads on demand — because it delivers domain-specific guidance "exactly when needed,
without permanent context overhead." Their comprehensive frontend-design skill is reported at
roughly **~400 tokens** and is credited with a measurable jump in output quality across
typography, color, motion, and backgrounds. This is architecturally identical to what this
repo already does with `.claude/skills/frontend-design/SKILL.md` and the sister skill-library
pattern in `CLAUDE.md` §9 — independent convergence on the same mechanism.

**Forbidden-pattern lists, stated explicitly and by name.** Every practitioner source that
gave concrete guidance did it as a named-and-banned list, not abstract principle: "do not use
Inter, Roboto, or Arial"; "avoid purple gradients"; "skip three-box layouts" (prg.sh,
paraphrase). The Anthropic evaluator agent's scoring criteria explicitly penalize "telltale
signs of AI generation like purple gradients over white cards" — the same technique used as a
grading rubric line item rather than a prompt aside.

**Reference examples, not just rules in prose.** prg.sh's recommended technique (paraphrase):
extract 3–5 designs the human genuinely admires, write down *what specifically* works about
each one, and feed those descriptions to the model alongside the functional spec — taste
transferred as annotated reference, not adjective ("make it elegant").

**Generator/evaluator critique loop, run by two separate agent instances.** Anthropic's
harness-design-long-running-apps engineering post (paraphrase) is the most detailed mechanism
found: a **generator** agent builds, a separate **evaluator** agent — using Playwright to
actually navigate and screenshot the live rendered app rather than judge a description of it —
grades the result against four fixed criteria: **design quality** (coherent visual identity),
**originality** (deliberate creative choices vs. template defaults — explicitly penalizing the
purple-gradient tell), **craft** (typography hierarchy, spacing consistency, color harmony,
contrast ratios), and **functionality** (can a user actually complete the task). Two findings
worth carrying over directly:
  - **Self-evaluation doesn't work** — "agents confidently praise their own work even when
    quality is mediocre" (paraphrase). The critique has to come from a separate pass/agent that
    isn't invested in having already produced the thing.
  - **Weighting matters more than criteria count** — Claude already scored well on craft and
    functionality by default; the bland-output problem was concentrated in design quality and
    originality specifically, so those two had to be weighted more heavily in the rubric, or the
    evaluator converges back to "technically fine, aesthetically generic."
  - **The prompting language shapes the aesthetic**, sometimes unpredictably — a phrase like
    "the best designs are museum quality" pushed outputs toward a specific visual register the
    author hadn't intended, meaning the rubric's own wording is itself a design lever, not a
    neutral instrument.

**"Look at it" as a mandatory ritual, not a suggestion.** developersdigest.tech's framing
(paraphrase): the maturation path for coding agents is "put your workflow in files, then put
your taste in files too, then make the agent prove it used them" — i.e., a taste skill only
has teeth if the harness *requires* the agent to check its own output against the rubric before
declaring done, the same way a lint gate requires a pass before merge. Their stated success
metric for whether a taste skill is working: fewer layout corrections, better design-system
adherence, less copy cleanup, better planning quality on the next run — not adoption/install
count.

**Repo-local, not generic, is the end state.** developersdigest.tech again (paraphrase):
generic installed skills are a starting point; the durable version embeds the *team's own*
design tokens, banned patterns, verification commands, and approved reference examples directly
into the repository rather than relying on an external, one-size-fits-all skill package. This
matches this repo's own model — `design_system/ryan-realty/` as the canonical, repo-local
source rather than a generic taste package, with a mechanical gate
(`scripts/check-claude-canon.mjs` et al.) enforcing it rather than prose alone.

---

## 4. Adjacent "developing taste" context (human, not agent-specific, but cited by the agent-taste writers as the reasoning behind their rules)

- **Emil Kowalski, "Developing Taste"** (paraphrase, emilkowal.ski/ui/developing-taste): taste
  is a trained instinct, not innate preference. Method given: identify tastemakers respected in
  the field, study *why* their choices work rather than only what they made, and practice the
  craft regularly with targeted feedback — the gap between current output and refined taste is
  signal of progress, not failure. Cites Steve Jobs' framing: expose yourself to the best things
  humans have done. This essay is the explicit stated basis for his separate agent-facing essay
  in §3 above — the claim is that the mechanical rules for agents are *downstream of* this
  human framework, not a substitute for it.
- **Karri Saarinen (Linear co-founder/CEO)**, Lenny's Podcast interview (paraphrase): "when you
  understand your craft really well, ... you also often have the taste to know what good looks
  like" — taste presented as inseparable from deep craft knowledge, not a separate aesthetic
  sense layered on top.
- **"Taste is the new bottleneck" framing** (designative.info and multiple 2026 essays,
  paraphrased): as AI drives execution cost toward zero, judgment — knowing *what should be
  built*, not what *could* be — becomes the scarce resource. Directly analogous to why a
  rubric/gate approach (§3) matters more than raw generation capability: the model can produce
  endless variations, so the differentiator moves entirely into the review/selection layer.

---

## 5. Full source list

| Source | URL |
|---|---|
| Taste Skill review | https://andrew.ooo/posts/taste-skill-anti-slop-ai-frontend-review/ |
| Taste Skills Are Turning Agent Review Into Infrastructure — Developers Digest | https://www.developersdigest.tech/blog/taste-skills-ai-agents-design-review |
| Taste Skill (project site) | https://www.tasteskill.dev/ |
| EveryDev.ai — Taste Skill tool page | https://www.everydev.ai/tools/taste-skill |
| Why Your AI Keeps Building the Same Purple Gradient Website | https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website |
| AI Design Slop: Why AI-Generated UI Looks Generic — SmoothUI | https://smoothui.dev/blog/ai-design-slop |
| Improving frontend design through Skills — Anthropic (Claude blog) | https://claude.com/blog/improving-frontend-design-through-skills |
| Harness design for long-running application development — Anthropic Engineering | https://www.anthropic.com/engineering/harness-design-long-running-apps |
| Emil Kowalski — "Agents with Taste" | https://emilkowal.ski/ui/agents-with-taste |
| Emil Kowalski — "Developing Taste" | https://emilkowal.ski/ui/developing-taste |
| Rules for creating good-looking user interfaces, from a developer — weberdominik.com | https://weberdominik.com/blog/rules-user-interfaces/ |
| Taste Is the New Bottleneck — designative.info (fetch blocked, HTTP 403; used search-result summary only) | https://www.designative.info/2026/02/01/taste-is-the-new-bottleneck-design-strategy-and-judgment-in-the-age-of-agents-and-vibe-coding/ |
| Inside Linear: Building with taste, craft, and focus — Karri Saarinen, Lenny's Podcast | https://www.lennysnewsletter.com/p/inside-linear-building-with-taste |
| Refactoring UI summaries (book by Adam Wathan & Steve Schoger; no single canonical URL fetched — synthesized from multiple summary pages found via search) | https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802 |
| x.com/alextalksai/status/2094519795043479723 — **unreachable, HTTP 402; content not identified via search** | https://x.com/alextalksai/status/2094519795043479723 |

## 6. Gaps / honesty notes

- The seed post (§0) is the one item in this brief that could not be verified at all — not
  paraphrased, not summarized, simply not located. Flagging this explicitly rather than
  inferring its content from the surrounding Taste Skill discourse it may or may not be part of.
- Every "concrete rule" above came through WebFetch's summarization layer, which the task
  brief itself warns returns paraphrases, not verbatim source text (per `reference_webfetch_
  returns_summaries` in this environment's own memory). None of the numbers here (e.g. the
  44px hit-area, the 100–150ms duration band, the 1:1.618 ratio, the "~400 token" skill size)
  should be treated as a direct quote — they are the fetch tool's rendering of the source
  page's claim, and would need a direct read of the original page to cite verbatim.
- designative.info blocked WebFetch with HTTP 403; only the WebSearch snippet was available for
  that source, so its entry in §2/§4 is thinner than the others.
