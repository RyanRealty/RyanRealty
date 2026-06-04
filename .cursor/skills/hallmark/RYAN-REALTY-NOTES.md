# Hallmark at Ryan Realty — reconciliation notes

Hallmark (by @nutlope, MIT) is vendored here verbatim. It is a general anti-AI-slop design skill that picks from 20 themes or generates a custom palette per brief. **Ryan Realty's brand is locked, so we use Hallmark's discipline and structure, not its theme engine.** Read this before running any Hallmark verb on Ryan Realty work.

## Overrides for Ryan Realty work

1. **Pin the theme. Do not rotate.** Ignore Step 1/2.6 theme selection and the 20-theme catalog and the custom-OKLCH branch. The theme is always the Ryan Realty brand: navy `#102742` on cream `#faf8f4`, **Amboqia Boriango** display + **Geist** body, tabular numerals, no emoji. Source of truth: `design_system/ryan-realty/SKILL.md` and `app/globals.css` tokens.
2. **Tokens are ours.** Hallmark's "locked tokens" discipline maps to our `ci:design-tokens` gate: no raw hex, no arbitrary Tailwind brackets, build from `@/components/ui/*`. Reference our existing CSS variables, do not mint new color tokens.
3. **Honest copy is law, not a discipline.** Hallmark discipline #2 (no fabricated metrics) is identical to `CLAUDE.md` §0 Data Accuracy, which is non-negotiable here. Every stat, review, and sold price renders only if it is pulled live and verified. No placeholder invented numbers.
4. **Brand voice.** Apply Ryan Realty voice on any copy Hallmark drafts: no em-dash, no semicolons, no banned words (luxury, premier, boutique, stunning, nestled, curated, bespoke, elevate, seamless). Curly quotes literal in JSX.

## What to use Hallmark FOR (the genuinely useful parts)

- **`hallmark audit <path>`** — ranked anti-pattern punch list on an existing page. Read-only. Great first pass on `/lp/*` and site surfaces.
- **`hallmark study <screenshot|URL>`** — extract design DNA from a reference (never copies pixels), produce a diagnosis.
- **`hallmark redesign <path>`** — rework visual structure inside existing implementation boundaries (respects routes, components, copy intent).
- **The disciplines + anti-patterns + slop-test references** — structural variety, no re-drawn browser chrome, no italic headers, mobile gates at 320/375/414/768. These are brand-agnostic and apply as-is.

The canonical wrapper that ties this into our brand + gates is `../frontend-design/SKILL.md`. Start there.
