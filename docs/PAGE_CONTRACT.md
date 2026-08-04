# THE PAGE CONTRACT

**One page box for every document that reaches a person as a PDF or a print:** CMA, BPO, market
report, net sheet, flyer, anything attached to an email.

**The rule: content may never enter a header, a footer, or a margin, and it may never be
silently clipped.** A document that breaks either half does not get sent.

This is not a style preference. A CMA that quietly dropped part of a comparable is a §0
data-accuracy failure on a document a licensed principal broker signed.

Canonical code: [`lib/pdf/page-contract.ts`](../lib/pdf/page-contract.ts).

---

## The two ways it broke

Both measured on real documents, both fixed 2026-08-03.

### 1. Fixed-height sheets that clip

```css
.page { height: 11in; overflow: hidden; }   /* banned */
```

Content past the box was cut off and simply absent from the PDF. No error, no ellipsis, and
nothing downstream could detect it — a clipped row is never drawn, so there is no ink in the
finished file to measure. The document just comes out short a comparable.

Measured on a delivered CMA (`public/drafts/cma-21042-robin`): 9px of a comparable's stat line
destroyed at the page-5 boundary, and the overrun crowded the footer band before it clipped.

The dangerous copy of this rule lived in an `@media print` block, not the screen rule — it
governed the PDF and was easy to miss reading the stylesheet top to bottom.

### 2. Bands reserved with padding on a box that fragments

```css
.page { padding: 0.7in 0.75in; }   /* banned when the box flows across sheets */
```

CSS padding is applied once at the top of a box and once at the bottom. A `.page` div that
fragments across sheets therefore gives the **first** sheet a top margin, the **last** sheet a
bottom margin, and every interior sheet **none**.

Measured on a 5-sheet BPO: body text **1.5pt from the paper edge** on sheets 3, 4 and 5. Every
BPO longer than two sheets printed that way, which is most of them.

---

## What to do instead

- **Reserve the bands with `@page { margin }`, never with padding on a wrapper.** `@page`
  applies to every sheet, interior ones included. Use `pageContractCss()`.
- **Draw running headers/footers into the margin strips** via `pdfRenderOptions(marks)`, which
  uses Chrome's `displayHeaderFooter`. Marks that live in the margin cannot collide with body
  content — they are not competing for the same space. `<span class="pageNumber">` gives the
  real sheet count instead of a number the renderer guessed before pagination.
- **Never `overflow: hidden`, `overflow: clip`, or `max-height` on a sheet container.** Overflow
  must stay visible so it stays measurable. Too much content is a build failure Matt can see,
  never a document a client receives short.
- **Let sections FLOW.** A `.page` element is a logical section that starts on fresh paper
  (`break-before: page`), not a fixed sheet. A section long enough to spill then gets a properly
  margined continuation sheet instead of clipping or running off the edge. The CMA was migrated
  to this on 2026-08-04; nothing in the codebase still models a `.page` as one physical sheet.

### Geometry

| | |
|---|---|
| Paper | US Letter, portrait, 612 × 792 pt |
| Default bands (`MARGIN_IN`) | top 0.75in · right 0.6in · bottom 0.7in · left 0.6in |
| CMA bands (`CMA_MARGIN_IN`) | top 0.4in · right 0.6in · bottom 0.7in · left 0.6in |
| No-ink zone | 0.25in from every paper edge — nothing enters it, running marks included |
| Bleed tolerance | 2pt (glyph boxes carry ascender/descender slack; a hairline tolerance false-alarms) |

**A document may declare its own bands.** The contract is *"nothing may enter the
bands"*, not one universal band size. The CMA runs a smaller top band because its
section header is an ordinary in-flow element at the top of each section rather
than a running mark in the margin — forcing the BPO's 0.75in top on it would
waste 0.35in of every sheet and push more content into overflow.

Whatever a document declares, it must pass the SAME margins to
`pageContractCss`, `pdfRenderOptions`, and `assertPdfPageSafety`. The CSS that
reserves the band and the check that polices it have to agree, or the check is
measuring a box the document never used.

---

## Enforcement — three layers, none of them prose

| Layer | Runs | Catches |
|---|---|---|
| `ci:pdf-page-safety` — [`check-pdf-page-safety.mjs`](../scripts/check-pdf-page-safety.mjs) | every commit, no browser, no secrets | a sheet container that clips; a fragmenting box that reserves bands with padding |
| [`assertPageFit()`](../lib/pdf/assert-page-fit.ts) | in the browser, after layout, before `page.pdf()` | content that WOULD be clipped. **This is the only layer that can see it** — clipped content leaves no trace in the PDF |
| [`assertPdfPageSafety()`](../lib/pdf/assert-page-safety.ts) | on the produced bytes, inside every send path | text in a header, footer, or margin. Measured with pdfjs against the real sheet dimensions, so no CSS refactor, new renderer, or longer narrative can route around it |

The byte-level rules:

- **EDGE** — no text within 0.25in of any paper edge, running marks included.
- **STRADDLE** — no text run crosses the content-box boundary. A run belongs wholly to the body,
  wholly to the header strip, or wholly to the footer strip. Crossing means content grew into a
  reserved band.
- **SIDE** — no text in the left/right margins at all. There is no legitimate side strip.

`runningMarksInBody: true` relaxes STRADDLE for documents that draw their own marks inside the
body instead of in the margin strips — the `@react-pdf/renderer` surfaces (market report,
listing, rental, comparison), whose `fixed` footer is a page element. EDGE and SIDE always
apply. The CMA and BPO both use real margin-strip marks, so STRADDLE applies to them in full.

### Rendered proof

```bash
npm run test:int -- lib/pdf/page-contract lib/cma/page-safety lib/bpo/page-safety
```

- [`lib/pdf/page-contract.int.test.ts`](../lib/pdf/page-contract.int.test.ts) — torture fixtures:
  220 flowing paragraphs, a 160-row table, an image taller than the sheet, six forced breaks.
- [`lib/cma/page-safety.int.test.ts`](../lib/cma/page-safety.int.test.ts) — baseline CMA clean;
  an overstuffed one (12 comps + a 60-sentence narrative) flowing onto clean extra sheets; and a
  single section long enough to spill, which must produce a properly margined continuation
  sheet rather than the paper-edge bleed the un-clipped fixed model produced.
- [`lib/bpo/page-safety.int.test.ts`](../lib/bpo/page-safety.int.test.ts) — a fixture long enough
  to produce interior sheets, because a two-sheet fixture cannot reproduce the defect.

**Each suite carries a negative control** — the old model must still FAIL. A safety check that
has never failed is not known to work.

---

## Stored documents freeze their CSS

`public.cmas.html_content` holds the fully rendered document, and
`lib/cma-pdf.ts` serves that string — it does not re-render. **A stylesheet fix
therefore reaches new builds only.** Every document already in the table keeps
the CSS it was born with.

On 2026-08-03 that meant 219 of 243 stored CMAs still carried the sheet-clipper
after the renderer was fixed, and **77 of them were actively deleting content**
(worst: 247px, ~2.6in, off the sheet-3 description block).

Two lessons, both paid for:

1. **When a document stylesheet changes, ask what it does to the STORED corpus,
   not just to the next build.** The remediation scripts are
   `scripts/_cma-unclip-stored-html.mjs` (surgical string fix) and
   `scripts/_cma-rerender-stored.mjs` (true re-render under the flowing model).
2. **Re-measure before writing.** The first remediation pass patched only the
   `@media print` rule; the base `.page` rule's `height: 11in; overflow: hidden`
   still applied, because a print block overrides only the properties it
   restates. The script re-measured each patched document and refused to write
   77 of them. Without that step those 77 would be recorded as fixed and still
   be losing content.

A re-render is safe precisely because `renderCmaHtml` is a pure function of
`render_args` — it cannot move a figure. `_cma-rerender-stored.mjs` still
verifies that claim per document by diffing every currency, percentage and date
token between the old and new HTML, and refuses the write on any drift. §0 does
not accept "correct by construction" as a substitute for checking.

## Escape hatches

- `PDF_PAGE_SAFETY=warn` — downgrades both runtime assertions to logged warnings. For local
  iteration on a redesign only. Never set in production.
- `PDF_PAGE_SAFETY=off` — disables them entirely. Reserved for debugging the checks themselves.
- `page-contract-exempt` in a comment on the line above a CSS rule — a documented, diffable,
  countable exception to the static gate. Silence is not an exception.

---

## Adding a new PDF surface

1. Include `pageContractCss()` at the top of the stylesheet.
2. Render through `htmlToPdfBuffer(html, { label, marks })` — both assertions are already wired
   into it. Do not call `page.pdf()` directly.
3. For a `@react-pdf/renderer` document, spread `REACT_PDF_PAGE_STYLE` into the `<Page>` style
   and `REACT_PDF_FOOTER_STYLE` into any `fixed` footer. react-pdf paginates flow content on its
   own but does **not** reserve space for an absolutely-positioned fixed footer — content flows
   under it unless the page's bottom padding reserves the band.
4. Add a rendered int test with a fixture long enough to produce interior sheets.
