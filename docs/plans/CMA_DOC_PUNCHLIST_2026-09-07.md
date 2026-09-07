# CMA document punch list (orchestrator, 2026-09-07, from the live 2465 7th immersive + Sep 6 letter shots)

Principle: every section opens with the one fact it proves, in seller language, then the evidence. The reader's questions, in order:
(1) what is it worth and why, (2) for expired: why did mine not sell, (3) what does it compete with at that price, (4) how fast will it go at that price, (5) what next.

P1. Sold/unsold band chart is unreadable: every value is printed twice (left label and right label), "Didn't sell $360K" sits at the top with no reading, the takeaway is never stated. Replace with ONE price ruler: closed sales as filled navy dots at close price, unsold as hollow dots at last ask, two labeled ticks: "Your last ask $460K" and "Recommended $389K". Caption states the fact: "9 sold from $410K to $460K. 2 asked and did not sell. Your ask sat at the top of the band. Adjusted for size and date, homes like yours land at $372K to $399K." Numbers from pricing, never recomputed in the renderer.

P2. Expired order. "Your last listing" is section 8 of 9. For an expired owner it is the why. Move it to directly after "How we got the price" (before competition) and give it the P1 ruler plus the three failed-then-sold stats it already has. Keep the three-act spine: number+why → comps → next.

P3. "This market" block contradicts the number beside it: median sold $458,500 (4 closes, 2 to 4 bed, 90 days) next to a $389,000 recommend, with no line reconciling them (§0 rule 5). Either state the reconciliation in one sentence from data ("Those four were 1,6xx to 2,1xx sqft. Yours is 1,440.") or drop the block for subjects where the band is not the subject's product. Decide from data, not by default.

P4. "New listings and asking prices" month ledger for the subdivision (1 to 3 listings a month, dashes) conveys nothing. Replace with "How fast homes like yours went": days to offer of the kept sales (1, 4, 5, 3, 51) on one axis against the subject's own 186 days, and the Redmond 21-day median as a tick. This is the "what happens when overpriced" chart Matt asked for. Letter and immersive both.

P5. Duplicate facts: "Recommended list · Last on market Feb 2026 at $460,000 (withdrawn)" repeats inside competition; "What we searched" bullets ("Sales near Diamond Bar Ranch." / "5 closed sales.") are filler. One statement each, once.

P6. The land section renders six identical 0.14-acre rectangles for a tract subdivision. Render only when lots differ materially (spread > 25 percent or any lot ≥ 0.5 acre); otherwise one line: "Every kept sale sits on a 0.14 to 0.16 acre lot like this one."

P7. Voice: next step says "I am here" (canon: We). Check every seller-facing sentence for "I" outside the signed letter. "Sorry this listing did not sell." is right.

P8. Matrix lead line: above the comps matrix, one sentence with the five adjusted closes' median and the recommend so the 20-row table has a reading before the reader enters it. Keep thumbnails. Row labels "Brought to today / Brought to your size" get one legend line explaining time and size adjustment (and style when applied).

P9. Print `?print=1` serves the frozen build blob; PDF re-renders from render_args. Make `?print=1` render from render_args like the PDF (lib/cma/serve-document.ts) so a reviewer sees what the client gets.

P10. Every chapter in immersive exists in print and vice versa, in the same order (spine item 2). Today "How recent sellers sold" and the disclosure are print-only; expired scene is immersive-always. One assembler order.

Verification for every item: the look-pass tool at 816 letter, 1280 immersive, 375 both; contact sheet reviewed by the orchestrator before Matt sees a URL.
