# SITE-11 proof block — separate evaluator review

**evaluatedAt:** 2026-09-08  
**evaluator:** session_01DmUyqbSqkVmNQVyVKh5awz (sonnet separate evaluator)  
**score:** 82/100 (design 24/30 · originality 22/30 · interaction 14/15 · craft 14/15 · honesty 8/10)  
**beats:** Compass agent profiles, Zillow agent pages — we win on data depth (every closing shown, not cherry-picked), transparency (clear market benchmarking), and interaction (linked highlighting, hover details)  
**shots:**
- `design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440.png` (desktop)
- `design_system/ryan-realty/ui_kits/_shared/shots/site-11/375.png` (mobile)
- `design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440-hover.png` (hover state)

---

## Defects

1. **TASTE** — The two horizontal dot strips side-by-side feel like separate charts rather than one integrated proof graphic. A single scatter plot (x=days to contract, y=price achievement %) with Bend median crosshairs would unify the data into one richer field instead of two parallel tracks.

2. **CRAFT** — The right-side stats ("17 homes closed", "$13,384,000") feel visually separated from the left-side charts, creating a two-column layout rather than one integrated section. The big "17" sits apart from the data it summarizes.

3. **TASTE** — The eyebrow "THE RECORD" in small caps feels generic. The display line "Every home we listed and closed" carries the claim; the eyebrow adds little and could be omitted or made more specific.

4. **FUNCTIONAL** — No visible empty-state handling in screenshots. What renders if Ryan Realty has zero closings in a period? The section needs "No closings in this period" copy rather than breaking or showing empty strips.

5. **CRAFT** — All dots on both strips are identical in size. Encoding a third dimension (total sale price or property type) via dot radius would add information density without complicating the reading.

6. **TASTE** — The review quote is lengthy prose (six sentences). On a data-first proof section, the quote could be trimmed to one standout sentence: "Matt was always available to make the process as smooth as possible." The current length dilutes impact.

7. **CRAFT** — The reviewer name pills ("MJB", "E Oster", "Audra Hedberg") look like interactive controls but their function is unclear from the screenshots. If they filter or navigate to other reviews, the affordance should be clearer (underline, arrow, hover state visible).

---

## The seven questions

### 1. What is this section's claim, in one plain sentence?
Here is every home Ryan Realty listed and closed in the last year, showing how fast each sold and how the sale price compared to asking, benchmarked against the Bend market median.

### 2. Is the first read instant?
YES. The headline "Every home we listed and closed" plus the large "17" immediately communicate accountability and scale. The two dot strips show performance visually at a glance — you see the spread and the Bend median mark without reading labels.

### 3. What does the reader DO here, and does it reveal more data?
Point at any dot on either strip to see that specific closing's details: location (Redmond), days to contract (2 days to offer), and price achievement (101.5% of first ask, 15% over). The same closing highlights on both strips simultaneously, linking the two dimensions. This reveals the story of each individual transaction.

### 4. Does it breathe?
YES. Generous whitespace around elements, thin dot marks, hairline rules on the strips, clean typography hierarchy. The negative space between the two strips and around the stats gives the section room to be read rather than scanned past.

### 5. Does anything embarrass us at 375?
NO. Everything stacks cleanly in the mobile view. Text is readable, no clipped labels visible, no horizontal scroll outside containers, no wrapped numerals. The charts stack vertically, stats follow, then CTAs. Touch targets appear adequate (the dots and the call/text buttons).

### 6. Would you stop scrolling here? If it is dull, name what is dull and say what FORM would fix it.
MAYBE. The linked interaction is clever and the honesty frame is strong, but the section visually reads quiet and editorial rather than striking.

**What's dull:** The two horizontal strips side-by-side create a dashboard/ledger layout rather than one composed graphic. The form is correct but conservative — it feels like two separate charts that happen to share hover state, not one integrated visualization. The big "17" on the right sits apart from the proof it represents.

**What FORM would fix it:** A single scatter plot with days-to-contract on one axis and price-achievement-% on the other, with Bend median lines crossing as reference marks. Each dot would encode both dimensions simultaneously, and the field would show clustering (fast sales at good prices vs outliers). The current two-strip approach is legible but doesn't exploit the visual power of showing correlation in one drawing. Alternatively: a timeline where each closing is a vertical mark scaled by price achievement, creating a skyline of performance rather than two flat strips.

### 7. Does it beat the best page for this subject? Name the competing page and the metric where we win or lose.

**COMPETING PAGE:** Compass agent profiles, Zillow Premier Agent pages, Redfin agent track records, or any competitor brokerage's "recent sales" section (e.g., Windermere broker pages showing transaction history).

**WE WIN on:**
- **Data depth:** Every closing shown, not a cherry-picked "featured sale" carousel. The "Not a selection" frame is accountability.
- **Transparency:** Clear benchmarking against Bend market median on both metrics. Competitors show their numbers in a vacuum.
- **Interaction:** Linked highlighting across both charts on hover, revealing each closing's full story. Competitor pages are often static lists or image carousels.
- **Honesty:** Source line, verified review count, explicit time window. Nothing is inflated or vague.

**WE LOSE on:**
- **Visual impact:** Competitor agent pages often lead with large property photos, map pins showing sold locations, or richer visual presentations of the portfolio. Our proof block is data-first and text-forward — correct, but not visually arresting. A scrolling user might pass it as "another chart section" rather than stopping to explore the interaction.
- **Emotional engagement:** Photos of sold homes create tangible proof. Our dots are abstract. The review quote helps, but the proof itself is geometric rather than photographic.

---

## Strongest

The **linked dual-strip interaction** where hovering one mark highlights the same closing on both charts simultaneously is genuinely original and data-revealing. A template would show two separate charts or a static table. This interaction lets a reader explore the full story of each closing (location, speed, price achievement) without leaving the view. The honesty frame ("Not a selection. Every home...") is strong accountability messaging that differentiates from competitor cherry-picking.

## Weakest

**Visual composition and form.** The two separate horizontal strips plus right-side stats create a dashboard/ledger feel rather than one striking, integrated graphic. The section reads as correct, restrained, editorial — but not visually inventive enough to screenshot and share. A bolder form (a single scatter plot showing correlation between days and price achievement, or a different geometry altogether — a skyline, a radial plot, a beeswarm with Bend median overlay) would make this section feel like a signature piece rather than a well-executed report band. The current form is competent but conservative; it doesn't exploit the visual opportunity of showing 17 closings as one composed proof rather than two parallel tracks.
