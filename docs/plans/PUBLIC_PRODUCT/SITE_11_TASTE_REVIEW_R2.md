# SITE-11 proof block — separate evaluator review, round 2

evaluatedAt: 2026-09-08
evaluator: session_017Yt29ebKVKR6N4ALSPUBS4
score: 81/100 (design 24/30 · originality 22/30 · interaction 12/15 · craft 14/15 · honesty 9/10)
previousScore: 82/100
verdict: SAME — the changes tightened the visual system and improved honesty, but didn't transform the section's fundamental form or interactivity
beats: Compass/Redfin proof blocks on specificity and honesty (17 named homes vs aggregated stats, market comparison vs generic claims)
shots:
- design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440.png
- design_system/ryan-realty/ui_kits/_shared/shots/site-11/375.png
- design_system/ryan-realty/ui_kits/_shared/shots/site-11/1440-hover.png

## Round-one items — did the fix land?

**Four changes made:**

1. ✓ Two dot strips unified into one field with single navy hairline — LANDED. Reads as one graphic measuring the same homes two ways, not two separate charts. Visual improvement.

2. ✓ "17" record frame clarified with "All time · $13,384,000 in closed volume" — LANDED. Makes the right rail honest about what it's showing. Honesty improvement.

3. ✓ Eyebrow carries window "LAST 12 MONTHS" — LANDED. Clearer than generic "THE RECORD" alone. Clarity improvement.

4. ✓ Review pills labeled "MORE REVIEWS", active pill solid navy, underline on hover — LANDED. Clearer affordance and interaction cues. UX improvement.

**Four refusals:**

1. "No visible empty state" — ACCEPT. Builder's reasoning holds: happy-path screenshots cannot show a state that only renders when data is missing. If it's unit-tested (builder claims it is), that's adequate verification.

2. "Encode sale price as dot radius" — ACCEPT. Seven closings is small enough that price + close month identifies a former client's home. Privacy constraint is legitimate and overrides the visualization improvement.

3. "Trim the six-sentence review quote" — ACCEPT. Repo canon (CLAUDE.md §2, VOICE.md) states reviews appear as written. Correct refusal.

4. "Replace strips with scatter of days vs price achievement" — ACCEPT. Scatter needs both coordinates per point and would silently drop the one closing with no publishable day count, charting six while stating seven. Honesty constraint is sound.

All four refusals have legitimate reasoning. None should be overridden.

## Remaining defects

1. **TASTE** — Dot strips are static, no hover interaction. Individual dots should have tooltips showing that home's timeline (listed date, pending date, days to pending) without revealing price. The data graphic's centerpiece doesn't let readers interrogate the data. Tag: `.day-strip` graphic, add hover state per dot with home story.

2. **TASTE** — Section stacks horizontally (intro text → graphic field → broker cards) with no compositional variety. This is the "stacked-section page" pattern TASTE.md calls out as banned. However, this is a PAGE-level rhythm problem, not fixable at the individual section level. Note for future composition pass when the full page layout is reconsidered.

3. **CRAFT** — Dot radius on the strips appears small (~3px visible). Consider r=4-5px for better individual data point readability, especially for the outliers at 2 days and 160 days. Tag: `.day-strip circle` size.

4. **TASTE** — The two strips use identical form (horizontal dot distribution) for different measures (days-to-pending, price-achievement). One being a different encoding (bars, slope, meter) would create visual variety and make the comparison clearer. However, builder's privacy constraints (can't show individual sale prices) legitimately limit encoding options. Mark as NOTED but likely unfixable within constraints.

## The seven questions

1. **What is this section's claim?** "Ryan Realty's homes sell faster and closer to ask than the whole market." The two dot strips show days-to-pending distribution (RR vs market median) and sale-price achievement (RR vs market median). The claim is clear and data-backed.

2. **Is the first read instant?** Almost. The anchoring sentences ("Half of them went under contract inside 52 days" and "Half closed at 93.7% of ask") make the strips readable. But you must read the labels to understand what the dots encode. A stronger form would make the RR-beats-market comparison instant without reading.

3. **What does the reader DO here?** Toggle between reviews via the name pills. That's the only interaction. The dot strips — the section's data centerpiece — are static. Missed opportunity: hover a dot to see that home's timeline, scrub to filter by date range, toggle property types. The data exists; the interaction doesn't.

4. **Does it breathe?** Yes. Generous padding, thin marks (2px lines), hairline rules (1px), adequate cream field around elements. No cramping or density problems.

5. **Does anything embarrass us at 375px?** No. Mobile screenshot shows clean vertical stacking, readable type, no wrapped numerals, no clipped labels, no horizontal scroll. The record stat moves below the graphics appropriately. Well executed.

6. **Would you stop scrolling here?** Honest answer: maybe, if I'm a seller evaluating brokerages. The proof is specific (17 named homes), comparative (vs whole market), and credible (Google reviews with real names). But would I screenshot it to show someone? No. It's tasteful and competent, but not remarkable or memorable.

7. **Does it beat the best page for this subject?** Competing proof blocks (Compass aggregated stats, Redfin generic testimonials, Sotheby's cinematic hero moments): We win on **specificity** (17 named transactions with real data vs vague claims) and **honesty** (market comparison framing, "6 of 7 carry a day count" caveat, source line with dates and geography). We lose on **interactivity** (Redfin's home-sale map is more engaging than static dots) and **emotional impact** (Sotheby's cinematic proof is more memorable than our editorial restraint). Overall: wins the trust competition, not the wow competition.

## Strongest / weakest

**Strongest element**: The honesty. The "6 of 7 carry a day count" annotation (admitting data gaps), the market-comparison framing (vs just claiming "we're great"), the "All time · $13,384,000 in closed volume" scope (not hiding behind "recent" or "selected"), the Google reviews with real names and dates — every choice says "we're not hiding anything." That's the brand, and it lands here. A seller evaluating brokerages would trust this section more than a competitor's generic claims.

**Weakest element**: The interaction. The dot strips are the section's visual and conceptual centerpiece — they show 17 real homes' performance vs the market — but they're static marks. Hover does nothing. You can't click a dot to see that home's story, scrub the timeline to filter by date, or toggle segments. The review carousel works (pills, hover, toggle), but the data graphic — the thing that differentiates this proof from everyone else's — doesn't reward curiosity. For a 2026 data section on a "breathtaking" site, that's the miss. The form is sound and the honesty is there; it just needs to let readers explore what they're seeing.
