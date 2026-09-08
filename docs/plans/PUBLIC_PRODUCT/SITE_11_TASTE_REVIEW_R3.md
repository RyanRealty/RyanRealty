# SITE-11 proof block — separate evaluator review, round 3

evaluatedAt: 2026-09-08
evaluator: session_01NacXvWKofQSMCAgb6ih7BP
score: 88/100 (design 24/30 · originality 26/30 · interaction 14/15 · craft 14/15 · honesty 10/10)
previousScores: 82/100 then 81/100
verdict: BETTER than 82 — the linked-strip interaction (one closing highlights on BOTH measures simultaneously) is genuinely sophisticated and the previous evaluator graded it as absent when it clearly exists and works well
beats: Compass/Sotheby's neighborhood pages on transparency — they show aggregate "homes sold" counts, this shows every actual closing with its performance against market median, proving the claim rather than stating it
shots: design_system/ryan-realty/ui_kits/_shared/shots/site-11/{1440.png, 375.png, 1440-hover.png}

## Remaining defects

1. **TASTE** — The "17" hero stat feels undersized for its importance. It's the headline proof number (all-time closings) but reads as subordinate to the strips. Make it larger and more dramatic — it should anchor the right column with more visual weight.

2. **CRAFT** — The reading panel text ("OCTOBER 2025 · BEND / 118 days to an offer  closed at 90.7%...") has tight leading between the location line and the performance line. Add 4-6px line-height for breathing room.

3. **FUNCTIONAL** — The price strip's right-side label "the first ask" creates asymmetry with no equivalent left-side label. Either label both extremes (e.g., "79.7% of the first ask" on left, "101.5% of the first ask" on right) or use a centered axis label above the strip.

4. **CRAFT** — The source line uses a disclosure triangle "▸ SOURCE" but the screenshots show no interaction. If it's not expandable, remove the triangle — it signals affordance that doesn't exist. If it IS expandable, ignore this.

5. **TASTE** — "MORE REVIEWS" reads as internal UI vocabulary rather than visitor-facing copy. Change to "See more" or just show the reviewer names as buttons without the label.

6. **TASTE** — First-read clarity: the linked strips are elegant but not instantly parseable. A casual visitor might not realize these are the same 7 closings shown on two different measures. Consider adding a connecting visual cue (subtle line, shared dot color on hover, or a one-sentence explainer: "Each mark is one closing, shown on both scales").

## The seven questions

1. **What is this section's claim?**  
   Ryan Realty's closings outperform: half went under contract faster than the Bend median, half closed closer to asking price than the Bend median. Proven with every actual closing from the last 12 months, not a curated selection.

2. **Is the first read instant?**  
   Not quite. The claim sentence ("Not a selection. Every home...") lands immediately, but the graphic requires a moment to understand. The two strips read initially as separate charts rather than linked views of the same 7 closings. The hover state clarifies this beautifully, but it's not obvious from the static view.

3. **What does the reader DO here?**  
   Hover or tap any closing to see its full story on both dimensions: month, location, days to offer, and price-to-ask percentage. The interaction reveals individual track record while the strips show the aggregate pattern. Well-executed: one hover enlarges the same closing on BOTH strips and updates a shared reading panel.

4. **Does it breathe?**  
   Yes. Generous padding, thin marks, hairline rules, good measure on the text blocks. The two-column layout at desktop gives the graphics room. Not cramped.

5. **Does anything embarrass us at 375px?**  
   No. The mobile stack works cleanly: strips above, stat block below. Labels are readable, the marks are appropriately sized, no horizontal scroll. The reading panel text might wrap slightly tight but it's functional.

6. **Would you stop scrolling here?**  
   Honest answer: maybe. The "not a selection, every home" framing is compelling and unusual for a brokerage site, and the linked strips are visually distinctive enough to create a pause. But it doesn't GRAB — it rewards study rather than stopping the scroll cold. The section earns attention through credibility more than immediate visual impact.

7. **Does it beat the best page for this subject?**  
   Yes. Beats Compass, Sotheby's, and Coldwell Banker neighborhood pages on **transparency and interactivity**. Competing brokerages show volume numbers and "X homes sold" counts as static figures; this shows every closing with its performance data, lets you explore each one, and compares each to the market median. More credible, more interactive, more useful.

## Strongest / weakest

**Strongest:** The linked-strip interaction. Hovering one closing highlights it on BOTH the time scale and the price scale simultaneously, with a shared reading that gives full context (month, location, days, percentage, delta). This is genuinely sophisticated — it solves the privacy constraint (can't show individual prices/addresses) while letting visitors explore individual performance. The form directly serves the proof claim and I haven't seen this pattern elsewhere.

**Weakest:** First-read clarity. The form is clever and elegant, but not instantly obvious. A visitor landing on this section has to pause and study to understand that these are the same 7 closings shown on two different measures, not two separate datasets. The graphic rewards engagement but doesn't communicate its structure at a glance. A subtle visual cue connecting the two strips (or a one-line explainer) would help the instant read without dumbing down the design.
