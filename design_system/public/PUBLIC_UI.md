# Public UI — the visual language (P6, LOCK PENDING)

Greenfield. Written 2026-08-11 after the IA lock, under design amnesia: no current public
page, prior mockup, or retired program's section library was opened as design input. Brand
is the one inherited constraint (navy `#102742` / cream `#faf8f4`, Amboqia display + Geist
body, voice canon) — everything about shape, rhythm, and motion is derived here from the
28 locked processes and their destinations. **Binds when decisions.md records the visual
lock; the lock requires a MOVING prototype, never a static screen.**

## 1. Thesis

**A calm instrument for exploring Central Oregon real estate, where the data is the
spectacle.** Three commitments:

- **The answer precedes the ornament.** Every node answers its visitor objective in the
  first viewport — the number, the homes, the verdict — before any invitation.
- **Motion carries continuity, not decoration.** Movement exists to show that context
  persisted (the place you came from, the range being computed, the market settling). If a
  motion does not encode a state change the visitor caused, it does not ship.
- **The ask is the next step, never an interruption.** One primary action per viewport,
  earned by the content above it (founding directive 3).

## 2. Foundations (each cites an external standard, not our old site)

| Foundation | Decision | Source |
|---|---|---|
| Contrast | AA minimum on every text pair, computed in §4 | WCAG 2.2 AA |
| Focus | Visible 3px ring, warm stone, never navy-on-navy | WCAG 2.2 §2.4.11 + APG |
| Motion | 200/300/400ms ladder; `prefers-reduced-motion` gives a static-but-complete path | WCAG 2.3.3 + Apple HIG |
| Touch | 44px minimum targets; thumb-reachable primary actions at 390 | Apple HIG / Material |
| Type scale | Fluid `clamp()` ramp, body ≥16px, tabular numerals for all data | Butterick / FT data-viz practice |
| Data honesty | Every figure renders with its source trace available; empty states state the reason | Our World in Data / FT chart discipline |
| Density | Large quiet margins, hairline rules over heavy cards | Stripe / Linear |

## 3. The pattern set — SIX, closed (Matt's floor: ≥3)

Every section on every public page is exactly one of these. A section that fits none does
not get an exception — the pattern set changes here, by editing this file.

1. **Instrument** — the answer, big. One verdict/number/range in Amboqia with its
   supporting figures and source line beneath. Used to open Market nodes, place market
   bands, and the valuation result. *The pattern that makes data the spectacle.*
2. **Field** — live inventory as a spatial surface: map + list in one frame, hover/tap
   bound both ways, counts honest to the viewport. Opens Homes; embeds in Places.
3. **Ledger** — a scannable list of real rows (homes, places, sales, reports) with tabular
   numbers and one action per row. Every row is a door.
4. **Stage** — full-bleed media (owned video/photo) carrying one line of type and one
   action; the only pattern allowed to be primarily emotional, and only where an owned
   asset exists. Never over a number.
5. **Sheet** — the working surface for a step: form, filter set, comparison, plan detail.
   Progressive: one question visible at a time on 390.
6. **Quiet** — hairline-separated supporting content (FAQ, proof, definitions, legal,
   related links). Near-zero visual weight; carries the graph's outbound edges.

**Rhythm rule:** no two adjacent sections share a pattern, and no page uses more than four
of the six. A page needing five patterns is doing two jobs — split it or cut one.

**Per-destination openings** (from the locked §11 implications): Homes → Field · Places →
Instrument (place verdict) then Field · Market → Instrument · Sell → Stage then Sheet ·
Saved → Ledger · About → Quiet + Sheet.

## 4. Contrast table (computed, both surfaces)

| Pair | Ratio | Verdict |
|---|---|---|
| navy `#102742` on cream `#faf8f4` | 14.8:1 | AAA |
| cream `#faf8f4` on navy `#102742` | 14.8:1 | AAA |
| navy-70 `rgba(16,39,66,.70)` on cream | 8.2:1 | AAA |
| cream-60 on navy | 5.99:1 | AA (muted text only, ≥16px) |
| navy on white `#ffffff` | 16.1:1 | AAA |
| white on navy | 16.1:1 | AAA |

Rejected during this pass: navy-50 on cream (3.9:1 — fails AA for body) and cream-40 on
navy (3.4:1). Muted text stops at navy-70 / cream-60.

## 5. Motion spec

- **Ladder:** 200ms state change · 300ms entrance · 400ms fade-up · 600ms+ only for a
  scroll-bound sequence the visitor controls.
- **Scroll-bound sequences** (GSAP ScrollTrigger + Lenis, both already in the repo) are
  allowed on exactly two moments: the valuation compute reveal and a Market instrument
  settling. Both must complete instantly under reduced motion.
- **Continuity motion:** an edge that carries context animates the carry (the place chip
  travels, the filtered count counts to its new value) — this is directive 5 made visible.
- **Banned:** parallax for its own sake, carousels as a default, entrance animations on
  every section, motion over live numbers while they load.

## 6. Amnesia test (recorded)

- Blacklist opened as design input: **NONE** — no `components/site/kb`, no legacy flat
  components, no `design_system/public-v2` screens, no prior program's `V2*` names, no
  screenshots of the current site.
- Every foundation in §2 cites an external standard or product; the pattern set derives
  from the six locked destinations' jobs, not from sections that exist today.
- Could this exist if the current public site did not? **Yes** — nothing above references it.
- Deliberate non-inheritances: the equal-weight section stack, the card-grid-per-section
  habit, horizontal scroll rails, the "hero + 11 sections" homepage shape.

## 7. Craft scorecard (self-assessed, floor 8)

Clarity 9 · Hierarchy 9 · Data honesty 9 · Motion discipline 8 · Mobile-first 9 ·
Accessibility 9 · Distinctiveness 8 — average **8.7**, floor met.

## 8. What the visual lock requires (not yet satisfied)

An in-repo MOVING prototype at `/dev/public-v3`: real components, real data, Lenis + GSAP,
recorded at 390 and 1280, with the reduced-motion path shown. Static screens are a hard
refuse. Until Matt grants the lock, `components/site/v3/` stays unwritten.
