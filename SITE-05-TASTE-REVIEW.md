# SITE-05 Taste Review — V3StickyAsk

**SCORE: 87/100** (design 27/30, originality 24/30, interaction 13/15, craft 13/15, honesty 10/10)

**BEATS:** Redfin's mobile contact bar on **data depth** — Redfin's sticky bar carries only a CTA; this one re-presents a live market verdict with months of supply, classification, and date stamp.

---

## DEFECTS

### FUNCTIONAL/CRAFT (must fix):

1. **Contrast on the tail text fails AA at small sizes** (visible in 375-b-shown.png, 1440-b-shown.png, both files). The verdict tail uses `--v3-ink-on-navy-muted` = cream-60 on navy = 5.99:1 contrast. V3StickyAsk.css line 89 claims "AA at this size" but `--v3-size-source` may be under 16px (Ledger base is 13px). At 14px, 5.99:1 is barely AA; at 13px it fails. The verdict must be legible. **Fix:** Either guarantee the tail renders at ≥16px, or lighten `--v3-ink-on-navy-muted` to a higher ratio (7:1+) for body text under 16px. The PUBLIC_UI contrast table (§4) lists cream-60 with the qualifier "muted text only, ≥16px" — this violates that floor if the tail is smaller.

2. **The months figure (the KEY data) doesn't stand out enough** (375-b-shown.png, 1440-b-shown.png). The tail reads "seller's market · 3.9 months · read Sep 7" at one nearly-uniform weight and color. V3StickyAsk.css line 112 gives `.v3-sticky-ask__mos` full `--v3-ink-on-navy` while the rest is muted, but at this small size the hierarchy is too subtle. The months figure is THE FIGURE — the data the control exists to carry — and it should read as such at a glance. **Fix:** Increase the months span to `font-size: var(--v3-size-body)` (from `--v3-size-source`) and/or `font-weight: var(--v3-weight-medium)`, or wrap it and its unit ("3.9 months") so both parts get the emphasis, not just the number.

3. **The place name hides on narrow phones, orphaning the verdict** (375-b-shown.png at widths under 400px, per V3StickyAsk.css line 174). At `max-width: 25rem` the place name disappears, leaving "seller's market · 3.9 months · read Sep 7" with no geography. On /cities/bend that's recoverable (the page title says Bend), but on /cities/bend/northwest-crossing the hidden "Northwest Crossing" makes the verdict generic — a visitor scrolling can't tell WHICH neighborhood this is about. **Fix:** Keep the place name on all widths; abbreviate the classification on narrow phones instead ("NW Crossing · seller's · 3.9 mo · Sep 7"). The place is the anchor; the full prose classification ("seller's market") is the part a narrow screen can compress.

### TASTE OPINIONS (builder may argue):

4. **The desktop plate is too SMALL** (1440-b-shown.png). It reads as a correct, functional control — flush to the corner, radius 0, navy on cream, proper Broadside — but it's sized so modestly that a visitor might not notice it appear. The Broadside thesis (PUBLIC_UI §1) is "the data is the spectacle," and this control carries LIVE DATA: a market verdict with a figure and a date. It could own that corner more boldly. The geometry is right; the scale is timid. **Suggestion:** Increase the label to `--v3-size-body-lg` or `--v3-size-nav-lg`, expand the padding from `--v3-space-sm/lg` to `--v3-space-md/xl`, and give the verdict tail room to be a READING, not a footnote. The corner-flush shape is the signature; let it be bigger.

5. **"read Sep 7" sounds bureaucratic** (375-b-shown.png, 1440-b-shown.png, tail's fourth span). The tail ends "read Sep 7" to surface the §0 trace, which is correct, but "read" is metadata jargon — a visitor doesn't care when the broker READ the figure, they care when it's CURRENT. The full trace ("Source: market_pulse_live, months of supply 3.9, read Sep 7.") is in the title attribute for screen readers and hover; the visible tail can be more conversational. **Suggestion:** Change the fourth span to "as of Sep 7" or just "Sep 7" (dropping the "read" verb). It's still a date stamp, still §0-compliant, and it reads as recency rather than workflow.

6. **The arrow hover motion is generic** (inferred from V3StickyAsk.css line 127, not visible in shots). The arrow translates `--v3-space-3xs` (~4px) to the right on hover. That's correct to the reading direction, but it's also what every link's arrow does. For a control this deliberately shaped, the hover state could be more distinctive — the whole plate could slightly expand, or the tail could brighten, or the hairline rule could thicken. Not a blocker (the current motion is purposeful, not decorative), but a refinement that would make the control feel more premium.

---

## KEEP (things that are genuinely right — do not "fix" these):

1. **The corner-flush desktop geometry** (1440-b-shown.png). The plate sits flush to the bottom and left edges, radius 0, no shadow, no margin. That IS the design. It reads as a printed corner slug, not a floating toast, which is why it belongs to the Broadside register. A floating capsule with rounded corners and a margin would be the template default; this is the deliberate choice that makes it Ryan Realty's.

2. **Radius 0 everywhere**. Correct to the Broadside register (PUBLIC_UI §6). Do not add rounded corners to "soften" it, and do not round the dismiss button's focus ring into a circle — the register's language is EDGES and RULES, and this control speaks it.

3. **The visibility rule** (lib/sticky-ask.ts line 120, `stickyAskShown()`). The control appearing only after the sentinel has scrolled fully above the viewport, retiring while the target ask is in view, and respecting a dismissal is THE WHOLE POINT. PUBLIC_UI §1 counts visible filled controls — this is allowed to exist only because it never shares the viewport with the ask it points at. Do not make it always-visible, do not remove the target-in-view retirement, and do not let a designer argue "just show it all the time so people see it." The rule is what makes it work.

---

## THE REVIEW IN CONTEXT

**What this component IS:** A sticky "Value my home" control that re-presents a live market verdict after the page's hero has scrolled away, and retires while the on-page valuation ask is in view. Desktop: a navy plate flush in the bottom-left corner. Phone: a bottom bar. It's the one bottom-fixed element on these pages, and it publishes `--rr-sticky-bottom` so other sticky elements (SITE-04's alerts strip) can dock above it.

**Why it's 87, not 95:** The craft and function are very strong (13/15 and 10/10). The design quality and originality are good but not breathtaking (27/30 and 24/30) — it's correct to the Broadside register and more deliberate than a template, but the desktop plate is sized so modestly it doesn't command the corner the way it could, and the phone bar is more conventional. The interaction is purposeful but shallow (13/15) — the verdict tail is live data, but there's no second layer of revelation (no hover detail, no expansion, no scrub).

**Why it's NOT 72:** Because the form is right. The corner-flush geometry, the hairline rule between label and tail, the graceful degradation at narrow widths, the way the months figure gets full cream while the rest is muted — these are deliberate choices a template would not make. The code is clean (no formatting in the component, the verdict built server-side, proper §0 traces). The only functional defects are contrast and hierarchy, both fixable without changing the shape.

**The one thing that would move it past 90:** Make the desktop plate BIGGER and the months figure BOLDER. The geometry is signature; the scale is the limiter. A control this deliberately shaped, carrying live market data on a licensed broker's site, can own that corner more confidently. Increase the label size, expand the padding, give the verdict tail room to be a READING. Keep radius 0, keep the flush edges, keep the hairline rule — those are correct. Just make it 40% larger and let "3.9 months" be a figure, not a caption digit.

---

**Evaluator:** Separate agent (not the builder)  
**Evaluated:** 2026-09-08  
**Shots reviewed:** 1440-{a,b,c,d}, 375-{a,b,c,d} (8 files)  
**Code reviewed:** V3StickyAsk.client.tsx, V3StickyAsk.css, lib/sticky-ask.ts, lib/ask-source.ts  
**Rubric:** design_system/public/TASTE.md (design 30, originality 30, interaction 15, craft 15, honesty 10)
