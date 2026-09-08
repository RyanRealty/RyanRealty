# SITE-11 proof block — separate evaluator review, round 3

evaluatedAt: 2026-09-08  
evaluator: session_01SYBLYiH2ybXahytGkMoXiE  
score: 75/100 (design 18/30 · originality 20/30 · interaction 14/15 · craft 14/15 · honesty 9/10)  
previousScores: 82/100 then 81/100  
verdict: WORSE than 82 — the synchronized interaction is sound but the visual form is too quiet and sparse to command attention; the page still reads as a conventional stack  
beats: Competitor brokerages on transparency (they don't show individual closings), but loses on visual impact  
shots: design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440.png, design_system/ryan-realty/ui_kits/_shared/shots/site-11/375.png, design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440-hover.png

## Score breakdown

**Design quality: 18/30**  
The identity is coherent — navy on cream, Amboqia display, Geist body, clean hairlines. But this is still fundamentally a stacked-section page: eyebrow → heading → claim → graphic 1 → graphic 2 → reading box → stat → review → CTAs. That exact pattern is what TASTE.md identifies as "the stacked-section page" banned tell. No compositional rhythm, no variation in width or density, no surprise. Quiet is the register; dull is the failure.

**Originality: 20/30**  
The synchronized dot strips ARE a distinctive solution to the "no dual axis" constraint — showing both days and price as linked strips with shared hover is creative. But the visual execution doesn't push far enough. The dots themselves are conventional marks. Seven small dots on wide tracks feel sparse and underpopulated. The static view is unremarkable. Would someone screenshot this? Maybe the hover state if they could capture it, but not the resting frame.

**Interaction: 14/15**  
This is where the section succeeds. Pointing at one mark on either strip highlights the SAME closing on both tracks simultaneously and updates the shared reading beneath ("OCTOBER 2025 · BEND · 118 days to an offer · closed at 90.7% of the first ask · 9.3% under the first ask"). The interaction reveals real data, not decoration. Pointer, touch, and keyboard all work (roving tabindex, arrow keys walk marks, ARIA live region announces changes). Minor deduction: no scrubbing along timeline, no filtering by location/type, no comparison mode between closings.

**Craft: 14/15**  
Typography hierarchy is clear, spacing consistent, navy-on-cream contrast excellent, thin marks per dataviz canon, no orphaned labels on mobile, numerals appear tabular. The reading box is clean but feels slightly disconnected from the strips visually — it sits below as a separate element rather than being integrated into the graphic.

**Honesty: 9/10**  
Source line present: "7 closings, September 2025 to September 2026, in Bend and Redmond." The n=7 constraint is respected (no per-closing price, no address). The reading shows month, location, days, percentage — all derived and traced. CTAs are clear. Loading/empty/error states cannot be verified from static screenshots.

## Remaining defects

1. **TASTE** — Seven dots are too small and too sparse on wide desktop tracks. The static view doesn't stop a scroll. Make the strips TALLER (200-300px each) and the dots LARGER (r=6-8) so each closing feels significant rather than lost in white space. Class: `.v3-proofblock__track` height and `.v3-proofblock__mark` r attribute.

2. **TASTE** — The reading box sits disconnected below the strips. Integrate it INTO the experience: overlay it on hover, or place it as a sidebar between the two strips, or make it emerge from the strips themselves. Class: `.v3-proofblock__reading` positioning.

3. **TASTE** — The page is still a vertical stack with no compositional surprise. Break it: put the two strips side by side on desktop (≥1024px), or offset them vertically with the reading between them, or vary their widths (days full-width, price 75%, reading in the remaining 25%). Anything but centered equal blocks down the page.

4. **FUNCTIONAL** — The hovered mark should be visually distinguished on BOTH strips simultaneously beyond just the label appearing. Add a subtle connecting indicator (a faint vertical rule, a shared glow in navy at 0.15 opacity, or a trace line) so the "these are the same closing" relationship is visible, not just stated. Class: `.v3-proofblock__mark.is-active` on both strips.

5. **CRAFT** — The gap between the fastest closing (2 days) and the slowest (160 days) tells a story but isn't emphasized. The outliers at both ends could be visually distinguished — not by color (navy only) but by annotation ("fastest" / "slowest"), subtle emphasis (bold label), or position (pull them slightly out from the track). CSS: `.v3-proofblock__mark[data-extreme]` selector.

6. **TASTE** — The eyebrow "THE RECORD · LAST 12 MONTHS" and the claim sentence both sit in the narrow text measure while the strips span wider. Either bring the claim OUT to the full strip width so it sits over what it describes, or bring the strips IN to match the text measure and make the whole section one coherent width. Class: `.v3-proofblock__claim` width.

7. **CRAFT** — On mobile (375.png), the strips stack vertically but there's no visual cue that they are LINKED. Add a connecting element between them — a subtle vertical rule, a label that says "Same homes on both", or animate the transition from days → price to show the connection. Mobile-specific class under `@media (max-width: 47.9375rem)`.

## The seven questions

1. **What is this section's claim?** "Ryan Realty's 17 closings in the last year performed better than the Bend market median on both speed and price." Clear in the data, though the prose claim "Not a selection. Every home Ryan Realty listed and closed..." could be stronger — it's defensive ("not a selection") rather than assertive.

2. **Is the first read instant?** Not really. The resting view shows two strips of small dots. You have to read the labels ("DAYS FROM LISTED TO UNDER CONTRACT", "SALE PRICE AGAINST THE FIRST ASKING PRICE") to understand what they show. The median reference helps but the "so what" isn't immediate. A static viewer sees dots, not dominance.

3. **What does the reader DO here?** Hover/tap/arrow through the seven closings to see each one's full detail on both dimensions. The synchronized interaction works. But there could be MORE: scrub along the timeline to see how the market changed month by month, filter by Bend vs Redmond, compare one closing to another, toggle to see only above-median or only under-ask.

4. **Does it breathe?** Yes. Thin marks, generous spacing, hairline rules, no clutter. Maybe TOO generous — the seven sparse dots feel lonely on the wide tracks. The breathing becomes empty space.

5. **Does anything embarrass us at 375px?** No. Everything stacks cleanly. Labels are readable, targets are tappable, no wrapping or clipping visible in the mobile screenshot.

6. **Would you stop scrolling here?** Honest answer: No. The dots are too small. The strips are too quiet. The static view doesn't grab me. I might stop if I noticed the hover interaction working, but the resting state doesn't earn the pause. A casual scroll past sees "some dots and a review" — conventional.

7. **Does it beat the best page for this subject?** Beats competitor brokerages on transparency (they don't show individual closing performance). Beats portals on broker-specific data (they don't show it). But on VISUAL IMPACT? No. A competitor with a bold before/after photo grid of their listings, a rich Atlas of their sold pins with hover details, or a dramatic slope chart showing their advantage over the market would be more arresting. We win on honesty; we lose on presence.

## Strongest moment

The synchronized hover interaction — when you point at one closing and see both its days AND its price light up simultaneously on the two strips, with the full reading updating beneath ("OCTOBER 2025 · BEND · 118 days to an offer · closed at 90.7% of the first ask · 9.3% under the first ask"). That ONE moment does something a static table or a conventional chart cannot: it shows the relationship between speed and price for the same home without dual axes or a scatter that would encode price (forbidden by the no-price constraint). The form solves the constraint elegantly.

## Weakest moment

The static state, especially on desktop. Seven small navy dots scattered across two wide cream strips look sparse and unimpressive. The section doesn't OWN the viewport — it sits politely in the scroll like any other stacked band. The white space dominates the marks. A viewer scrolling past sees "some data" but no reason to stop. The resting view undersells the interactive capability, and most viewers will never discover the hover.
