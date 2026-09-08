# SITE-02b Separate Evaluator Verdict

**Evaluator:** Separate agent (cloud session, separate from builder)  
**Evaluated:** 2026-09-08  
**Rubric version:** v1-2026-09-08  
**Page classes:** COMMUNITY (`/communities/[slug]`), SELL (`/sell`)

---

## COMMUNITY PAGE CLASS

### Scores (three independent passes)
**Pass 1:** 85  
**Pass 2:** 83  
**Pass 3:** 86  
**MEDIAN:** **85**

### Sub-scores (median pass)
- Design quality: 21/30
- Originality: 25/30
- Interaction: 15/15
- Craft: 15/15
- Honesty and function: 10/10

### Rises above prior mark
**Prior mark:** 68  
**Current median:** 85  
**Rise:** +17 points ✓

---

## SELL PAGE CLASS

### Scores (three independent passes)
**Pass 1:** 86  
**Pass 2:** 84  
**Pass 3:** 86  
**MEDIAN:** **86**

### Sub-scores (median pass)
- Design quality: 22/30
- Originality: 24/30
- Interaction: 15/15
- Craft: 15/15
- Honesty and function: 10/10

### Rises above prior mark
**Prior mark:** 83  
**Current median:** 86  
**Rise:** +3 points ✓

---

## DEFECTS

### COMMUNITY (`/communities/sunriver`)

1. **Section:** `.v3-drawing` answer container  
   **Severity:** taste  
   **Finding:** The answer reads as three stacked bands separated by hairlines rather than as one composed object. Each drawing varies its form (pair, rule, strip) which shows compositional intent within the answer, but the overall page is still form-card-then-sections. No rhythm connects the opening card to the answer drawings — they are two separate visual moments rather than one designed page.

2. **Section:** First-screen form (`.v3-drawing` predecessor)  
   **Severity:** taste  
   **Finding:** The opening screen is a cream card with a form on a navy field (the hero photo is missing as an environment artifact, but the composition would be the same with it present). This is a default card treatment — centered, boxed, isolated — rather than a composed opening that earns the page. The card does not visually prepare the reader for the drawn answer that follows.

3. **Section:** Form card (`VALUE MY HOME` eyebrow)  
   **Severity:** taste  
   **Finding:** The eyebrow "VALUE MY HOME" in tracked caps reads as an internal label rather than as the words a visitor would say. A person asks "What would my home sell for in Sunriver?" — the eyebrow should use those words or omit itself, not stamp an all-caps process name on the ask.

4. **Section:** Answer claim sentences (`.v3-drawing__claim`)  
   **Severity:** taste  
   **Finding:** The three claim sentences vary in voice: the first is editorial and complete ("48 detached homes are for sale..."), the second follows the same pattern, but the third shifts to "We already found 8 recent sales..." with a first-person plural that the prior claims did not establish. The shift is jarring. Either all three speak as the brokerage or all three state facts without attribution.

5. **Section:** Mobile 375, form card  
   **Severity:** taste  
   **Finding:** At 375 the form card takes the full width of the cream band but still reads as a card (padding, visual separation from the navy ground). The card metaphor serves no purpose at mobile width where the band itself IS the container — the inner padding is wasted vertical space.

6. **Section:** New listings section (below the fold, visible in desktop.png)  
   **Severity:** taste  
   **Finding:** The "11 houses came on the market" section uses a huge display numeral and reads as a separate design moment with no visual connection to the answer above it. The type size and weight hierarchy breaks — the answer draws use body and label sizes, then this section jumps to a display scale with no transition.

7. **Section:** Source disclosures (`.v3-drawing__source`)  
   **Severity:** functional  
   **Finding:** The source disclosures are present and correct, but at 375 they drop under the reading row which pushes them into a secondary position. A source trace is not optional metadata — it is the mandatory accompaniment to every figure (section 0). The layout should not demote it to "more info" visually.

### SELL (`/sell`)

1. **Section:** Hero opening  
   **Severity:** taste  
   **Finding:** The opening screen is a sparse hero with one centered form card. This is the most conventional landing-page treatment possible — centered CTA on a photo hero. It does not set up the drawn answer that follows, and a visitor who has not yet submitted sees no indication that this page will draw their market data rather than just collecting their address.

2. **Section:** Form card  
   **Severity:** taste  
   **Finding:** Same card-on-hero issue as COMMUNITY. The cream card floats on the navy with no compositional tie to the answer it will reveal. The metaphor is "fill out this form" rather than "ask this page a question and it will draw the answer."

3. **Section:** `.v3-drawing` answer  
   **Severity:** taste  
   **Finding:** Same stacked-bands composition as COMMUNITY. The three drawings vary their forms internally, but the answer as a whole is still sections down the page rather than one composed object.

4. **Section:** Answer claim sentences  
   **Severity:** taste  
   **Finding:** Same voice inconsistency as COMMUNITY — "671 detached homes are for sale" and "Half the homes that sold in Bend" are editorial fact statements, but "We already found 10 recent Bend sales close enough to 2323 NW High Lakes Loop" shifts to first-person brokerage voice.

5. **Section:** Desktop answer, comp strip (`.v3-drawing__strip`)  
   **Severity:** taste  
   **Finding:** The dot strip draws 10 comps across a February-to-August axis with collision lanes. At desktop width (1440) the marks cluster in the middle months and leave the January end nearly empty, which makes the strip read as unbalanced. The geometry is correct (marks land where they belong), but the visual weight is all on the right half of the axis.

6. **Section:** Mobile 375, days-to-pending rule  
   **Severity:** taste  
   **Finding:** The rule draws one 23-day mark on a 0-120 axis with no context mark (the answer IS Bend, so there is no city median to compare against). At 375 the axis labels (0, 30, 60, 90, 120 days) crowd the measure and the "23 days" mark label sits directly above the dot, which reads as cramped. The vertical spacing is correct per the code but the figure needs more breathing room at this width.

7. **Section:** Answer footer, reading row (`.v3-drawing__reading`)  
   **Severity:** functional  
   **Finding:** The idle state ("Hover, tap or tab a bar for what it counts") appears only under the FIRST drawing, and the second and third drawings have a blank reading row until the visitor interacts. This saves vertical space but makes the later drawings look incomplete before interaction — a first-time visitor does not know that the blank footer row is waiting for a tap.

---

## BEATS

### COMMUNITY vs. competitors

**Competing pages:**
- Zillow community pages (e.g. zillow.com/sunriver-or/)
- Sunriver Resort's own site (sunriver-resort.com)
- Tetherow community site (tetherow.com)
- Redfin neighborhood pages

**Metric we win:** **Data interactivity and depth.**

Zillow's community pages show median price, listings count, and price history as static charts — hover reveals nothing beyond the tooltip on the line chart. Sunriver Resort and Tetherow show photography and amenities but no market data. This page draws three interactive figures where every mark reveals its reading, and the months-of-supply bars DO the division rather than printing a ratio. A visitor can interrogate every data point. The portals have more listings and more property types; we win on how the data is shown and how much a hover reveals.

### SELL vs. competitors

**Competing pages:**
- Zillow What's My Home Worth (zillow.com/sellers-guide/home-value/)
- Redfin Home Value (redfin.com/what-is-my-home-worth)
- Realtor.com home value estimator
- Opendoor instant offer

**Metric we win:** **Drawn answer over ledger.**

Zillow and Redfin return an AVM dollar figure, a confidence range, and a scrolling list of comps with prices. Opendoor returns an instant cash offer. All of them print the numbers and make the visitor read the ledger. This page DRAWS the answer: months of supply as two bars the visitor can see without doing division, days-to-pending as a mark on a rule with city context, comps as a collision-lane strip by close month where every dot reveals size/bed/bath/proximity. The portals have the AVM and the price; we win on translating the market data into a form a non-broker can read at a glance.

**Does not beat on:** Photography (the hero photo was missing in the capture as an environment artifact, and even when present it is one stock Old Mill shot rather than a Sunriver-specific image for the community page). Dollar figures (Matt's ruling: no price for a typed address on a public page, so we show comps as dots with readings but no sale price, while Zillow shows the dollar amount). Instant valuation (we require broker follow-up; the portals return an AVM immediately).

---

## VERDICTS

### COMMUNITY

The three drawings ARE the work — months of supply as two bars on one scale, days-to-pending as a mark on a context rule, and comps as a collision-lane dot strip. Each drawing is a deliberate non-template shape, each rewards interaction with a reading, and each carries its source trace. The craft is correct: hierarchy by size and weight, tabular numerals, spacing on a scale, responsive reflow at 375. The page rises 17 points above the prior mark (68 → 85) because it replaced a label-and-value ledger with drawings that do the work the ledger made the reader do.

What keeps it from 90+ is that the page is still SECTIONS rather than one composed object. The opening is a card on a hero (conventional), the answer is three bands separated by hairlines (correct but not breathtaking), and the transition between them has no rhythm. A cropped section would read as Ryan Realty from the type and color, but the overall composition is stacked moments rather than one deliberate page. The drawings themselves are original; the page they sit on is not yet.

The answer is honest (every figure sourced, empty states handled, flow completes) and interactive (every mark reveals more data, no decorative motion). It beats the portals on data interactivity and loses on photography and instant dollar figures. It is a real rise and a finished item under the current rubric.

### SELL

The same three drawings, the same interaction model, the same craft. Rises 3 points (83 → 86) because it already scored higher on the prior mark — the gap was smaller to close. The opening is even sparser than COMMUNITY: one hero with a centered form card, the most conventional CTA treatment possible. The answer draws are the same quality, but the page AS A WHOLE still reads as ask-then-answer rather than as one designed surface.

The voice inconsistency ("671 homes are for sale" editorial fact, then "We already found 10 sales" first-person brokerage) is the same defect COMMUNITY carries. The dot strip at desktop shows the geometric correctness but not the visual balance — 10 marks clustered in the middle months leave the axis ends feeling empty. The idle reading row appears only under the first drawing, which makes the later drawings look incomplete before interaction.

It beats Zillow and Redfin on the drawn answer over the ledger: the portals print an AVM and a scrolling comp list, this page draws the market context as bars and rules and a strip. It loses on instant dollar figures (by design — no price for a typed address on a public page) and on the AVM itself. It is a real rise and a finished item.

---

## WHAT WOULD MOVE BOTH PAGES TO 90+

1. **Compose the opening and the answer as one page.** The form card and the drawn answer are two separate visual moments. Design them as one rhythm: the ask is the first data section, not a card floating above the answer.

2. **Eliminate the voice shift.** Either all three claims speak as the brokerage ("We counted 48 homes for sale...") or all three state editorial facts ("48 homes are for sale..."). Do not mix.

3. **Give the answer a composed width and rhythm.** The three bands are correct as hairline-separated figures, but they fill the measure edge-to-edge with no internal composition. Vary the widths, or nest one figure beside another, or pull one figure into a wider measure — something that shows the answer was designed as one object rather than as three sections stacked.

4. **Photography that matches the place.** The environment artifact hid this defect, but even when the hero photo loads it is one stock Old Mill shot for every Central Oregon page. A Sunriver page deserves a Sunriver photograph.

5. **Interaction affordance before the first tap.** The idle reading row ("Hover, tap or tab a bar for what it counts") appears only under the first drawing. Show it under all three, or show a visual affordance (a pulse, a faint cursor icon on the marks) so a first-time visitor knows the drawings are interactive before they guess to tap one.

---

## ENVIRONMENT ARTIFACT (not scored as a design defect)

The hero photograph at the top of `/communities/sunriver` (and presumably other community pages) is missing in the captured screenshots — it renders as a flat navy field. This is a known environment artifact: the capture sandbox blocks all remote images. Verified that the page requests the Supabase asset-library storage URL and cdn.resize.sparkplatform.com for listing photos, both of which return naturalWidth 0 in the sandbox. The only 4xx the page produced was `/api/visitors/track` refusing an automation user agent.

The flat navy field visible at the top of `community/shots/desktop.png` and `community/shots/mobile375.png` is the MISSING PHOTOGRAPH, not a design decision. This evaluation judged layout, type, rhythm, hierarchy, and the drawings. The missing photography is noted separately but did not move the design score — the composition would be a card-on-hero whether the photo loads or not.

---

**End of evaluation.**
