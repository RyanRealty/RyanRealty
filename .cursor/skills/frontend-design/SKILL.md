---
name: frontend-design
description: Build distinctive, production-grade web UI for Ryan Realty that avoids generic AI-slop aesthetics. Use when building or reworking any web page, landing page, hero, component, or site surface. Wraps Anthropic's official frontend-design skill plus the Hallmark disciplines, reconciled to Ryan Realty's LOCKED brand (navy/cream, Amboqia + Geist), the §0 data-accuracy rule, and the design-token gate.
---

# Frontend design (Ryan Realty)

Use this skill for any web surface: landing pages (`/lp/*`), site pages, heroes, sections, components. It is the design-taste layer that sits on top of the shadcn/ui component rule and the `design_system/ryan-realty/` brand spec.

## Why this exists (the diagnosis)

The failure mode we keep hitting on landing pages is **generic-safe**: stacked centered cards on white, equal-width columns, a drop shadow on every box, and the same hero to 3-feature to CTA to footer rhythm every time. Reviewers read that as "plain" and "it's just not it." It is not a whitespace problem and not a photo problem. It is the absence of a committed, intentional point of view, executed in every detail.

This skill is sourced from how the field actually fixes that (researched on X, June 2026): Anthropic's official `frontend-design` skill (the foundation), the Hallmark community skill built on top of it, and the screenshot-score iteration loop that designers run with Claude.

## 1. Anthropic's frontend-design skill (verbatim foundation)

> Source: Anthropic, `anthropics/claude-code` plugin `frontend-design` (MIT). Reproduced verbatim. The full original is vendored at `reference/anthropic-frontend-design.md`.

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

### Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work. The key is intentionality, not intensity.

### Frontend Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

## 2. Ryan Realty reconciliation (READ THIS — it overrides the parts above that assume a greenfield)

Anthropic's skill assumes you get to invent a new aesthetic per project. **We do not.** Ryan Realty has already made the bold, intentional commitment, and it is locked:

- **The aesthetic POV is the brand:** heritage Americana plus warm Central Oregon, navy `#102742` on cream `#faf8f4`, **Amboqia Boriango** display paired with **Geist** body, tabular numerals, no emoji. That IS our "committed direction." Do not re-pick it per page.
- **Do NOT** swap fonts, generate a new palette, introduce a new accent color, rotate themes, or "go maximalist." Geist is our refined body font (it is not Inter, so the no-Inter rule is already satisfied). Amboqia is our distinctive display font. The font/color decisions are made.
- **DO** apply the skill's *principles* inside that locked system, which is exactly what we have been skipping:
  - **Dominant + sharp accent**, not timid and evenly-distributed. Let navy or cream dominate a section and punch one accent (the warning/gold star token, a single navy block), instead of gray cards floating on white.
  - **Asymmetry, overlap, grid-breaking, generous negative space.** Kill the equal-columns, everything-centered reflex. Offset blocks. Let one element bleed or oversize.
  - **One orchestrated page-load** with staggered reveals on the hero, not scattered micro-animations everywhere.
  - **Structural variety between pages** (Hallmark's core idea): two Ryan Realty pages must not share the same section rhythm. `/lp/seller-home-value` and `/lp/sell-your-home` should feel like different pages, not color-swaps of one template.
  - **Atmosphere over flat fills:** use real Central Oregon photography (the canonical Old Mill hero and the `design_system/ryan-realty/assets/` library) and subtle texture, not solid blocks, for depth. One contained dark navy moment per page is good, full-bleed-dark everywhere is not (we learned that one already).
  - **Meticulous detail:** spacing rhythm, optical alignment, consistent radii, hover states. This is where "designed" beats "generated."

### Non-negotiable Ryan Realty gates (these outrank everything above)

1. **§0 Data Accuracy / honest copy.** Never invent a metric, review, sold price, or stat to fill a layout. This is identical to Hallmark discipline #2 ("honest copy, no fabricated content") and to `CLAUDE.md` §0. If a number is not pulled live and verified, it does not render. Use the real DAL-backed values or a labeled placeholder, never a plausible-looking fake.
2. **Design tokens only.** No raw hex, no arbitrary Tailwind brackets (`w-[140px]`, `text-[120px]`, `min-h-[60vh]` are banned by `npm run ci:design-tokens`). Use the token scale and the `@/components/ui/*` design-system components. This is Hallmark's "locked tokens" discipline, already enforced as a CI gate here.
3. **shadcn/ui components.** Build from `@/components/ui/` per `CLAUDE.md` "Design System Rules." No hand-rolled raw HTML controls on product surfaces.
4. **Brand voice.** No em-dash, no semicolons in prose, no banned words (luxury, premier, boutique, stunning, nestled, curated, bespoke, elevate, seamless, world-class). Literal curly quotes in JSX, never `&rsquo;`/`&ldquo;` entities.
5. **Mobile verified** at 320 / 375 / 414 / 768 px: no horizontal scroll, no two-line clickable text, headers wrap long words.

## 3. The repeatable techniques (run these, do not eyeball it)

These move design quality more than any single rule. Adopted from designers on X (Afonso Matos, Aakash Gupta) and Hallmark's pre-emit self-critique.

- **Screenshot to score to iterate loop.** Render the page with Playwright (we already render LPs this way), take a full-page screenshot, then *look at it* and score it 1 to 10 against: hierarchy, intentionality, restraint, specificity, structural variety, detail. Anything under 8 gets a concrete revision pass. Repeat until it holds. Do not ship a page you have not looked at as an image.
- **Design-critique subagent.** Before showing Matt, hand the screenshot to a fresh reviewer (the `design:design-critique` skill / a Sonnet subagent) prompted to find what reads as generic-AI and what a senior designer would change. Fix those, then surface.
- **Commit the direction first.** State the one-sentence visual thesis for the page before writing JSX. If you cannot say what makes it memorable, you are about to build generic-safe again.
- **Pre-emit critique stamp.** Score the artifact (Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety) before handing back. Below 3 on any axis triggers a revision.

## 4. Deeper toolkit: Hallmark (vendored at `../hallmark/`)

The full Hallmark skill is installed alongside this one at `.cursor/skills/hallmark/` (MIT, by @nutlope). It is a larger, opinionated anti-slop system with three verbs that are directly useful on this repo:

- **`hallmark audit <target>`** — score an existing page against the anti-pattern list, return a ranked punch list (read-only). Good first move on `/lp/sell-your-home`.
- **`hallmark study <screenshot | URL>`** — extract the design DNA (structure, type pairing, color anchor) from a reference you admire and produce a diagnosis, without copying pixels.
- **`hallmark redesign <target>`** — rework the visual structure inside the existing implementation boundaries.

When running any Hallmark verb on Ryan Realty work, **pin the theme to the Ryan Realty brand** (navy/cream, Amboqia + Geist) instead of letting it rotate its 20 themes or generate a custom palette. See `.cursor/skills/hallmark/RYAN-REALTY-NOTES.md`. To pull upstream updates: `npx skills add nutlope/hallmark`.

## 5. Pre-ship checklist

```
[ ] Stated the one-sentence visual thesis for this page before building
[ ] Looks distinct from our other LPs (no shared section rhythm)
[ ] Dominant color + one sharp accent, not gray cards on white
[ ] At least one asymmetric / grid-breaking / oversized element
[ ] One orchestrated hero load, not scattered animations
[ ] Every number is live + verified (§0) — zero invented stats
[ ] ci:design-tokens clean (no hex, no arbitrary brackets)
[ ] shadcn/ui components, not raw HTML
[ ] Brand-voice clean (no em-dash, no banned words)
[ ] Rendered + screenshotted + self-scored >= 8, design-critique pass done
[ ] Mobile verified at 320 / 375 / 414 / 768
```

## Sources

- Anthropic `frontend-design` skill: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md (Mike Krieger, Nov 2025: https://x.com/mikeyk/status/1988691831836782610)
- Hallmark: https://github.com/nutlope/hallmark (@nutlope) — vendored at `../hallmark/`
- Screenshot-score loop: https://x.com/afonsolfm/status/2005228412575916109 · builder-validator: https://x.com/aakashgupta/status/2039442140405895546
- Full research capture: `out/x-research/`
