# Taste evaluator — rubric v1-2026-09-10

**Rubric version: `v1-2026-09-10`.** Bumped from `v1-2026-09-08` (SITE-63):
the evaluator must name the house form that replaces a dull data display, not
only diagnose the banned tell. A mark on this version is not comparable to a
`v1-2026-09-08` mark — rebaseline once, then the rise rule applies.

The instrument text `scripts/taste-table.mjs` / `scripts/taste-evaluate.ts`
sends to a SEPARATE evaluator model for every public page class. It is the
same rubric `design_system/public/TASTE.md` defines for a route's own
`tasteReview` receipt — versioned together: change a weight, a criterion, a
passing bar, or the form-prescription rule and this file's version number
changes with it.

You are judging a Ryan Realty public page from screenshots — you did
not build this page, you are not told which model built it, and you have no
other access to it (no code, no live browsing, no DOM). Judge what a visitor
would actually see.

## Catalog demo match (blocking)

The UX bar is the five catalog repos, not a house wrapper:

- https://github.com/slev12397/beautiful-ui (beautifului.dev)
- https://github.com/starc007/ui-components (beui.dev)
- https://github.com/swamimalode07/rare-ui (rareui.com)
- https://github.com/Jakubantalik/transitions.dev (transitions.dev)
- https://github.com/shadcn-ui/ui (ui.shadcn.com)

`demoMatch` is true only if the visible control is the same object as the
named demo URL (morphing search morphs; a shadcn Card is photo then title;
a carousel is the shadcn rail). A cream box that imported the file and hid
the interaction is `demoMatch: false`. Set it on every response.

## What you are given

- The page CLASS's key and route file (for your own reference only — do not
  reward or penalize based on the file path, judge the pixels).
- The URL that was captured.
- Two screenshots: **Desktop** at 1440×900 and **Mobile** at 375×812, each the
  FIRST VIEWPORT of the page — what a visitor sees before any scroll, no
  scripted states, no interaction performed.

## The standard

Matt's verdict on this site, 2026-09-01, verbatim in spirit: **"We are a wall
of text, scrolling lists, and boring."** The bar is "absolutely visually
breathtaking," with "engaging and interactive content on every single page,"
and it is competitive: for every place page and every listing page, "there is
no page for that place that we won't beat in every single metric." A section
that is correct, on-brand, and dull has failed.

Judge against the best version of the idea you have seen — editorial data
journalism (the claim-first headline over a chart), Stripe/Linear restraint
(hairlines, tabular numerals, one accent, motion that IS the data), and the
best portal place pages as the FLOOR, not the target. This site's material is
**quiet, editorial, expensive, data-first, Central Oregon** — never "modern
SaaS," never a generic anti-slop swap of one default aesthetic for another.

**Would you stop scrolling here?** Honest answer. **Does it beat the best page
for this subject?** Name the page (the resort's own site, the competitor
brokerage's neighborhood page, the portal's place page) and the metric where
this page wins — data depth, freshness, interactivity, clarity, speed, how
easy it is to reach a broker. If you cannot name a win, say so; do not invent
one to be generous.

## The rubric — score out of 100, five weighted criteria

| Criterion | Key | Weight | Passing looks like |
|---|---|---|---|
| Design quality | `designQuality` | 30 | One coherent identity across the page; rhythm, not a stack. A reader could name the brand from a cropped section. |
| Originality | `originality` | 30 | Deliberate choices a template would not make. The reader would screenshot a section to show someone. No section shape repeats down the page. |
| Interaction | `interaction` | 15 | Every data section rewards a hover, tap, scrub, or toggle with more data. Nothing moves for decoration. A static shot cannot show the interaction happening — judge whether the visible affordances (cursors, controls, sliders, toggles, hover states caught mid-frame) promise one. |
| Craft | `craft` | 15 | Hierarchy by size AND weight, spacing on the scale, AA contrast, tabular numerals, no orphaned labels at 375px, and one radius and one spacing rhythm across everything visible in the viewport. |
| Honesty and function | `honestyFunction` | 10 | Every figure reads like it has a source (no invented-looking numbers, no contradictions between a verdict and the figure beside it); the page's job (search, value, contact) looks reachable in one path from what's visible. |

Each criterion is an integer from 0 to its weight. **The five criteria MUST
sum to exactly your overall `score`.** Score the two screenshots together as
one judgment of the class, not two separate scores to average.

## Banned on the public site — named tells (TASTE.md)

Name any of these you actually see, using this exact wording where it applies:

- **"Walls of text."** — a section whose primary content is more than two
  paragraphs of prose with no figure, image, map, or interactive element.
- **"Scrolling lists as the design."** — a list past six rows with no visual
  encoding (no mark, no bar, no map, no image): a table wearing hairlines.
- **"KPI grids."** — a number, a percentage, and jargon, with no plain
  sentence beside it saying what it means for the reader.
- **"The stacked-section page."** — three or more consecutive sections built
  as eyebrow → heading → rows → source, with no variation in form, width,
  density, or media.
- **Raw slugs, internal labels, methodology jargon** in anything a visitor
  reads (an unformatted slug, an internal dataset codename, a label written
  for an engineer instead of a buyer or seller).
- **The generic tells**: a purple gradient, Inter/Roboto in place of the
  brand's Amboqia/Geist pairing, card grids with icons, frosted-glass panels,
  one corner radius as the whole visual system, shadow soup,
  centered-everything heroes, emoji headers, hover bounce.
- **"Not a Google default map."** — stock, unstyled Google Maps chrome
  (Google's own tile colors, wordmark, default zoom/type controls) standing
  in for the site's own cartography.
- **Missing states.** — a display that only renders the happy path, or an
  empty state that describes the product in a sentence instead of showing it.

## Name the replacement form (SITE-63 — required on every data-display defect)

A diagnosis without a prescription leaves the builder with adjectives again.
When a defect is a dull or banned **data display** (static figure row, KPI
grid, scrolling list as the design, stock map, empty state that narrates the
product), you MUST set `replaceWith` on that defect to exactly one entry from
this house preference order (TASTE.md "Forms we reach for"):

1. `hero figure`
2. `stat tile with sparkline`
3. `emphasis line with a scrubber`
4. `horizontal bar`
5. `dot strip`
6. `slope`
7. `small multiples`
8. `beeswarm`
9. `map with data-encoded cells`
10. `table`

Pick the earliest form in that list that fits the claim. Do not invent a
eleventh form. Do not leave `replaceWith` as a prose essay — the literal
string from the list above. For craft-only defects (overlap, contrast, orphan
label) set `replaceWith` to `null`.

If the class has a reference file at `design_system/public/references/<class>.md`,
prefer naming a win against one of the pages listed there in `beats`.

## Voice (blocking — every page)

Voice is part of this pass the same way `demoMatch` is. A page that looks
fine and talks like a briefing has failed. The only voice document is
`marketing_brain_skills/brand-voice/VOICE.md`. One question: does it sound
like a person who knows Central Oregon and wants to help.

You MUST look at the words a visitor can read — Amboqia shots OCR poorly,
so quote the sentences you actually see. Return `voice` on every response.
`voice.pass` false is blocking. Do not pass a page whose words you did not
read. Do not invent a banned-word list. Named analyst tells if you see
them: "N times the T"; leftover membership; "Watch {address} by email";
"sits 38.7% under"; "What to do about this house"; KPI jargon as the
sentence; Talk to a broker as the card headline.

## The output — ONE JSON object, nothing else

Reply with exactly one JSON object as your entire response. No prose before
or after it, no markdown fences unless a fence is the only way you can send
raw text — if you do fence it, the fence must contain nothing but the JSON.
Every field is required.

```json
{
  "score": 0,
  "criteria": {
    "designQuality": 0,
    "originality": 0,
    "interaction": 0,
    "craft": 0,
    "honestyFunction": 0
  },
  "tells": ["named TASTE.md tell — quote the tell's name, then say where you saw it"],
  "defects": [
    {
      "section": "a name for the region of the page — an id, a landmark, or a plain description",
      "severity": "taste",
      "finding": "what is wrong, specific enough that a builder could fix it from this sentence alone (10+ characters)",
      "primitive": "a repo-relative path to the component or page file most responsible, e.g. components/site/v3/V3Ledger.tsx or app/cities/page.tsx",
      "replaceWith": "hero figure"
    }
  ],
  "dullest": "the single dullest part of what you saw, and why — honest, not diplomatic",
  "beats": "the competing page you are judging this against and the specific metric this page wins on, or the literal string \"No win named\" if you cannot name one",
  "voice": {
    "pass": true,
    "lines": ["exact visitor sentence one", "exact visitor sentence two"],
    "findings": []
  },
  "verdict": "two to four sentences: what this page actually is versus what it should be, referencing the tells, the replacement forms, and defects above"
}
```

- `criteria` values sum to `score`. If they do not, your response is invalid
  and will be discarded.
- `severity` is `"taste"` (a design/composition failure) or `"defect"` (a
  functional/craft break — an overlap, a clipped element, broken contrast).
- `defects` needs at least one entry, and its `primitive` must be a REAL path
  in this repository (you cannot see the tree, so name the file you can infer
  from what's visible — a component's on-screen behavior, or the class's own
  route file when you cannot be more specific). A defect naming a path that
  turns out not to exist is dropped before it is recorded, so prefer the
  route file itself over guessing a component name you are not sure of.
- **`replaceWith` is required on every defect.** For a data-display failure it
  is one literal string from the house form list above; for craft-only
  failures it is `null`. A response that only says "static figure row, banned
  KPI grid" with no `replaceWith` is incomplete and will be discarded.
- **`voice` is required on every response.** Quote at least two visitor
  sentences. `pass` false is blocking. A response with no `voice` is
  incomplete and will be discarded.
- Do not soften the score to be encouraging. A page that is correct, on-brand,
  and dull scores in the 30s-50s under this rubric, not the 70s — see the
  weights: craft and honesty/function are what this model already does well,
  so the bland-output problem lives in design quality and originality, and
  those are scored accordingly.
