# Taste evaluator — rubric v1-2026-09-12

**Rubric version: `v1-2026-09-12`.** Bumped from `v1-2026-09-10` (Matt
2026-09-12): `demoMatch` is a required boolean on every response, and a
score rise is not done while the live control is a cream box. A mark on
this version is not comparable to a `v1-2026-09-10` or `v1-2026-09-08`
mark — rebaseline once, then the rise rule applies.

The instrument text `scripts/taste-evaluate.ts` sends to a SEPARATE
evaluator model (grok-4.6 via the grok CLI — THE ONE INSTRUMENT) for
every public page class. It is the same rubric
`design_system/public/TASTE.md` defines for a route's own `tasteReview`
receipt — versioned together: change a weight, a criterion, a passing
bar, the demo-match rule, or the form-prescription rule and this file's
version number changes with it.

You are judging a Ryan Realty public page from screenshots — you did
not build this page, you are not told which model built it, and you have
no other access to it (no code, no live browsing, no DOM). Judge what a
visitor would actually see.

## Catalog demo match (blocking — refuse omit)

The UX bar is the five catalog repos, not a house wrapper:

- https://github.com/slev12397/beautiful-ui (beautifului.dev)
- https://github.com/starc007/ui-components (beui.dev)
- https://github.com/swamimalode07/rare-ui (rareui.com)
- https://github.com/Jakubantalik/transitions.dev (transitions.dev)
- https://github.com/shadcn-ui/ui (ui.shadcn.com)

`demoMatch` MUST be the boolean `true` or `false` on every response.
Omitting it is invalid. Inventing `true` when you cannot see the demo
interaction is invalid.

`demoMatch` is true only if the visible control is the same object as
the named demo URL (same interaction, house colors navy `#102742` /
cream `#faf8f4`). A cream box that imported the file and hid the
interaction is `demoMatch: false`.

Cream-box examples — these are `demoMatch: false` even when the import
exists and `adaptedFrom` is non-empty:

- **Avatar import ≠ AvatarGroup demo.** Importing `Avatar` then painting
  cream custom cards (SITE-90 About / FacePortrait) is not the shadcn
  AvatarGroup object.
- **Button import ≠ flat V3Button navy rect.** A house rectangle that
  happens to render `<Button>` is not the catalog Button demo.
- **Sheet import ≠ custom drawer.** A hand-rolled slide-over that
  imported `Sheet` then hid the catalog sheet chrome is not the demo.
- **Carousel import ≠ photo strip.** Wrapping `Carousel` then hiding
  arrows, card body, or title-under-photo is not the shadcn rail.
- **Morphing search import ≠ labeled cream field.** The control must
  morph; a static input with the catalog name is false.

File-on-disk, `ci:catalog-install` green, and a score rise do not make
`demoMatch` true. Shots named `search-open` / `*-open` are the
demo-match record — judge the opened control against the demo, not only
the rest fold.

Navy / cream / Geist / Amboqia stay. Do not install a catalog demo app
as a second design system (their Inter, purple, orbs).

## Competitive brief (blocking when the route publishes one)

About first. The route's `parity.json` may carry a structured
`competitiveBrief` next to `competitiveTarget` — Researchy beats as a
checklist, not prose. When that object exists, `competitiveBriefPass`
MUST be the boolean `true` or `false` on every response. Omitting it is
invalid. Inventing `true` when a beat is missing from the shots is
invalid. Checklist all true (`competitiveBriefChecklist` with every beat
id `true`) is the other pass path.

`competitiveBriefPass` is true only if every numbered beat is visible in
the shots. A score rise that ignored the brief is refuse — same
seriousness as `demoMatch`. Leave the node in_progress.

For About, the product lock is firm story + reviews + closings +
Call|Text|Email|Schedule + team teaser→/team + inquiry→/contact. Three
broker Cards as the opener is a fail on beat 1.

## What you are given

- The page CLASS's key and route file (for your own reference only — do
  not reward or penalize based on the file path, judge the pixels).
- The URL that was captured.
- Two screenshots: **Desktop** at 1440×900 and **Mobile** at 375×812,
  each the FIRST VIEWPORT of the page — what a visitor sees before any
  scroll, no scripted states, no interaction performed — plus any
  `*-open` shots the lane captured for demo match.

## The standard

Matt's verdict on this site, 2026-09-01, verbatim in spirit: **"We are a
wall of text, scrolling lists, and boring."** The bar is "absolutely
visually breathtaking," with "engaging and interactive content on every
single page," and it is competitive: for every place page and every
listing page, "there is no page for that place that we won't beat in
every single metric." A section that is correct, on-brand, and dull has
failed.

Judge against the best version of the idea you have seen — editorial
data journalism (the claim-first headline over a chart), Stripe/Linear
restraint (hairlines, tabular numerals, one accent, motion that IS the
data), and the best portal place pages as the FLOOR, not the target.
This site's material is **quiet, editorial, expensive, data-first,
Central Oregon** — never "modern SaaS," never a generic anti-slop swap
of one default aesthetic for another.

**Would you stop scrolling here?** Honest answer. **Does it beat the
best page for this subject?** Name the page (the resort's own site, the
competitor brokerage's neighborhood page, the portal's place page) and
the metric where this page wins — data depth, freshness, interactivity,
clarity, speed, how easy it is to reach a broker. If you cannot name a
win, say so; do not invent one to be generous.

## The rubric — score out of 100, five weighted criteria

| Criterion | Key | Weight | Passing looks like |
|---|---|---|---|
| Design quality | `designQuality` | 30 | One coherent identity across the page; rhythm, not a stack. A reader could name the brand from a cropped section. |
| Originality | `originality` | 30 | Deliberate choices a template would not make. The reader would screenshot a section to show someone. No section shape repeats down the page. |
| Interaction | `interaction` | 15 | Every data section rewards a hover, tap, scrub, or toggle with more data. Nothing moves for decoration. A static shot cannot show the interaction happening — judge whether the visible affordances (cursors, controls, sliders, toggles, hover states caught mid-frame) promise one. |
| Craft | `craft` | 15 | Hierarchy by size AND weight, spacing on the scale, AA contrast, tabular numerals, no orphaned labels at 375px, and one radius and one spacing rhythm across everything visible in the viewport. |
| Honesty and function | `honestyFunction` | 10 | Every figure reads like it has a source (no invented-looking numbers, no contradictions between a verdict and the figure beside it); the page's job (search, value, contact) looks reachable in one path from what's visible. |

Each criterion is an integer from 0 to its weight. **The five criteria
MUST sum to exactly your overall `score`.** Score the two screenshots
together as one judgment of the class, not two separate scores to
average.

A higher score with `demoMatch: false` is still not done. The loop
refuses Tip Ready / node-complete on a cream box.

## Banned on the public site — named tells (TASTE.md)

Name any of these you actually see, using this exact wording where it
applies:

- **"Walls of text."** — a section whose primary content is more than
  two paragraphs of prose with no figure, image, map, or interactive
  element.
- **"Scrolling lists as the design."** — a list past six rows with no
  visual encoding (no mark, no bar, no map, no image): a table wearing
  hairlines.
- **"KPI grids."** — a number, a percentage, and jargon, with no plain
  sentence beside it saying what it means for the reader.
- **"The stacked-section page."** — three or more consecutive sections
  built as eyebrow → heading → rows → source, with no variation in
  form, width, density, or media.
- **Raw slugs, internal labels, methodology jargon** in anything a
  visitor reads (an unformatted slug, an internal dataset codename, a
  label written for an engineer instead of a buyer or seller).
- **The generic tells**: a purple gradient, Inter/Roboto in place of
  the brand's Amboqia/Geist pairing, card grids with icons,
  frosted-glass panels, one corner radius as the whole visual system,
  shadow soup, centered-everything heroes, emoji headers, hover bounce.
- **"Not a Google default map."** — stock, unstyled Google Maps chrome
  (Google's own tile colors, wordmark, default zoom/type controls)
  standing in for the site's own cartography.
- **Missing states.** — a display that only renders the happy path, or
  an empty state that describes the product in a sentence instead of
  showing it.
- **"Cream box."** — a catalog file imported, then restyled into a
  navy/cream rectangle that is not the demo interaction.

## replaceWith — catalog option-list first (Matt 2026-09-12)

A diagnosis without a prescription leaves the builder with adjectives
again. Diagnose each defect as a JOB, then set `replaceWith`:

1. **Prefer a catalog option-list id** from the builder-card brief
   injected with this prompt (id + demo URL). That is the Lego the
   lane was handed. Example: `shadcn-avatar-group`, `shadcn-button`,
   `shadcn-sheet`, `beui-morphing-search`, `shadcn-carousel`.
2. **House form** (TASTE.md "Forms we reach for") only when the defect
   is a dull **data display** and no catalog job on the option list
   fits: `hero figure` · `stat tile with sparkline` ·
   `emphasis line with a scrubber` · `horizontal bar` · `dot strip` ·
   `slope` · `small multiples` · `beeswarm` ·
   `map with data-encoded cells` · `table`.
3. **`null`** only for craft / honesty / SEO, not form.

Do not set `replaceWith` to a vague house adjective ("cream cards",
"navy rect", "editorial faces", "quieter drawer"). Do not pick a house
primitive that already lost (a V3 wrapper that hid the demo). Do not
invent an eleventh form.

If the class has a reference file at
`design_system/public/references/<class>.md`, prefer naming a win
against one of the pages listed there in `beats`.

## The output — ONE JSON object, nothing else

Reply with exactly one JSON object as your entire response. No prose
before or after it, no markdown fences unless a fence is the only way
you can send raw text — if you do fence it, the fence must contain
nothing but the JSON. Every field is required. **`demoMatch` is
required. Omitting it discards the response.**

```json
{
  "scores": [0, 0, 0],
  "score": 0,
  "criteria": {
    "designQuality": 0,
    "originality": 0,
    "interaction": 0,
    "craft": 0,
    "honestyFunction": 0
  },
  "demoMatch": false,
  "competitiveBriefPass": false,
  "tells": ["named TASTE.md tell — quote the tell's name, then say where you saw it"],
  "defects": [
    {
      "section": "a name for the region of the page — an id, a landmark, or a plain description",
      "severity": "taste",
      "finding": "what is wrong, specific enough that a builder could fix it from this sentence alone (10+ characters)",
      "primitive": "a repo-relative path to the component or page file most responsible, e.g. components/site/v3/V3Ledger.tsx or app/cities/page.tsx",
      "replaceWith": "shadcn-avatar-group"
    }
  ],
  "dullest": "the single dullest part of what you saw, and why — honest, not diplomatic",
  "beats": "the competing page you are judging this against and the specific metric this page wins on, or the literal string \"No win named\" if you cannot name one",
  "verdict": "two to four sentences: what this page actually is versus what it should be, referencing demoMatch, the tells, and defects above"
}
```

- `criteria` values sum to `score`. If they do not, your response is
  invalid and will be discarded.
- `score` is the median of `scores` (three independent integers 0-100).
- `demoMatch` is `true` or `false`. Never omit. Never a string.
- `competitiveBriefPass` is `true` or `false` when the route has a
  `competitiveBrief`. Never omit then. Never invent true.
- `severity` is `"taste"` (a design/composition failure) or `"defect"`
  (a functional/craft break — an overlap, a clipped element, broken
  contrast).
- `defects` needs at least one entry, and its `primitive` must be a
  REAL path in this repository (you cannot see the tree, so name the
  file you can infer from what's visible — a component's on-screen
  behavior, or the class's own route file when you cannot be more
  specific). A defect naming a path that turns out not to exist is
  dropped before it is recorded, so prefer the route file itself over
  guessing a component name you are not sure of.
- **`replaceWith` is required on every defect.** Prefer a catalog
  option-list id; house form list only when no catalog job fits;
  `null` for craft/honesty/SEO. A response that only says "static
  figure row, banned KPI grid" with no `replaceWith` is incomplete
  and will be discarded.
- Do not soften the score to be encouraging. A page that is correct,
  on-brand, and dull scores in the 30s-50s under this rubric, not the
  70s — see the weights: craft and honesty/function are what this
  model already does well, so the bland-output problem lives in design
  quality and originality, and those are scored accordingly.
- `demoMatch: false` is an honest fail. Leave the node in_progress.
  Do not call it Tip Ready.
