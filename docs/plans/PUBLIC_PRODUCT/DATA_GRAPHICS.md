# Data graphics — how regular people read sales data

Locked 2026-09-05. Places pages **win by showing the market**, not by explaining it in paragraphs and not by dumping broker jargon.

Portals list houses. Official resort sites list amenities. We list houses **and** make the sales record visible as graphics a non-broker can read in two seconds. That is the differentiator.

Parent: [`PLACE_PAGES.md`](PLACE_PAGES.md). Outline: [`PAGE_OUTLINE.md`](PAGE_OUTLINE.md). Geometry: `lib/charts/plot.ts` → `V3Chart` / `V3Atlas`. No second library.

**UX.** One question per graphic. Plain label. Number on hover. Caption is the sentence a person would say.  
**DX.** One primitive. Draw-on / scrub / replay on V3Chart. Reduced-motion = already drawn.  
**AX.** The caption is the line the broker says on the phone. Same figure as the CMA.  
**Do not break.** §0 (trace every figure). MOS formula unchanged. `--rr-exception` only for a real decline. Do not chart n that’s too small.

---

## The only questions a place page answers with data

A regular person does not ask “months of supply” or “median days to pending.” They ask the left column. We draw the middle. The jargon lives in `/how-we-get-our-numbers` and on hover, never as the H2.

| They mean | Label on the page | Graphic | Source (one) |
|---|---|---|---|
| What’s for sale here? | The homes | **Atlas + Field** (pins, type toggle, photo row) | Live MLS in this boundary |
| What do they cost? | Typical price | **Strip or slope** of recent closes, typical ask as one mark on that strip — not a lone `$950,000` tile | `ClosePrice` / `ListPrice` in-window |
| How fast do they sell? | How long until it goes under contract | **Line or lollipop** of list-to-pending over time | median days to pending, same window as pulse |
| Are there enough homes? | Homes for sale vs a month of sales | **Mix / two-bar**: actives vs (sold last 6 months ÷ 6). That *is* months of supply. Do not lead with “3.9 MOS.” Caption: “About four months of homes on the market.” Verdict pill matches the number (≤4 seller · 4–6 balanced · ≥6 buyer). | pulse MOS inputs |
| Which part is moving? | What’s selling inside | **Encoded bars or ledger**: child plats/neighborhoods by sold count or pending time | comps in each child |
| What already sold? | Sold | **Atlas toggle** (sold dots on the same map), not a second page | closed in-window |

If a row’s `n` is too small to be honest (fewer than 6 closes in the window for a typical, fewer than 3 children for a comparison), **omit the graphic**. Do not pad. Quiet one line: “Too few recent sales here to chart.” (Tetherow already says this for some trends.)

---

## How each graphic must behave

1. **Claim first.** One sentence under the H2, in the words from the table. Then the drawing. No how-to.
2. **The drawing is the number.** The typical price is a mark on a strip of real closes, not a hero numeral that fights the Atlas.
3. **Hover / scrub / replay** reveals the exact figure, the window, and `n`. Keyboard gets the same reading.
4. **Draw-on** the series when the section enters the viewport (visitor caused scroll). Replay control for AX. `prefers-reduced-motion`: final frame only.
5. **One typical per place page.** Cost **or** pace can sit under Atlas, not both as equal KPI tiles. The other is a door to `/housing-market/{city}` or a disclosure.
6. **Same cents as every other surface.** Listing payment, pulse, MOS page, this chart — one formula each. Cross-check before ship.
7. **Navy on cream.** Subject series navy. Context tints. Exception ink only if YoY or MOS is a real decline/drawdown the section is about.
8. **Source line.** Table + filter + window + `n` + fetched date. No “updated recently.”

---

## Slots on each place grain (do not add a fifth)

### City `/cities/[slug]`

| Slot | Question | Graphic |
|---|---|---|
| Fold | What’s for sale | Atlas + Field of this city |
| After children doors | What do they cost **or** how fast | One slope or pending-time chart for **this city** |
| Children | Which part is moving | Neighborhood / resort doors with a bar or mark (sold or count) |
| Omit | MOS tile, five-number leftover HUD, “seller’s market” as a giant word next to `$950,000` | Verdict is a **caption** on the Atlas or under the one chart |

ZIP: houses only. Chart only if `n` holds.

### Neighborhood

| Slot | Question | Graphic |
|---|---|---|
| Fold | What’s for sale | Atlas of **this** boundary |
| After houses | Which plats are moving | Bars: child plats |
| One more | How fast **or** cost | One chart. Omit if `n` thin. |

### Master-plan (Tetherow, Caldera, …)

| Slot | Question | Graphic |
|---|---|---|
| Fold | Belonging + what’s for sale | Owned still, then Atlas of **this** inventory (their site has none) |
| After villages | What do they cost here | Slope or strip of **this community’s** closes, not Bend’s median |
| Villages | Which village is moving | Bars |
| Omit | City MOS theater, Bend KPI clone | Too-few-sales Quiet is legal |

### Plat

| Slot | Question | Graphic |
|---|---|---|
| Fold | The homes | List, or Atlas if pins earn it |
| Optional | What sold | One mark or omit |

---

## What this replaces (live defects)

- Leftover HUD: `679` / `$950,000` / `seller’s market` / `3.9` / `23` — five questions, no drawing, jargon labels.
- Atlas how-to sentence repeating counts.
- Market Instrument on a place page that restates the HUD.
- Mix charts with no hover.
- YoY `−5.2%` in navy.

---

## What we will not build

- A second chart kit (Lieflat, Recharts, D3 app).
- Animated numbers counting up on load.
- MOS explained with a paragraph instead of actives vs sold/month.
- A chart of Bend’s median on a Tetherow page.
- Graphics that need a broker to interpret the axis.

The test: show the graphic to someone who does not sell houses. They should answer the question in the left column without reading a footnote. The footnote is there for Matt, Google, and the CMA.
