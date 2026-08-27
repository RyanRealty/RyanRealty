# Public UI — the visual language (P6, LOCKED 2026-08-11)

Greenfield. Written 2026-08-11 after the IA lock, under design amnesia: no current public
page, prior mockup, or retired program's section library was opened as design input. Brand
is the one inherited constraint (navy `#102742` / cream `#faf8f4`, Amboqia display + Geist
body, voice canon) — everything about shape, rhythm, and motion is derived here from the
28 locked processes and their destinations. **LOCKED by Matt 2026-08-11 on the moving
prototype (docs/plans/PUBLIC_PRODUCT/decisions.md). The pattern set is closed: a section
that fits none of the six changes this file, it never earns a page exemption.**

**Amendments to the lock.** Two so far. **2026-08-26 (Matt):** §3's rhythm rule now says
what an enumeration is, so a run of one section rendered once per member of a set the
place determines counts once. The pattern set itself is unchanged — still six, still
closed. **2026-08-26 (Matt, THE LOOK):** the visual language now carries exactly two
registers — Broadside on content surfaces, Ledger on search/data surfaces — defined in §9.
A register varies structure, density, rule weight, and motion only; the pattern set, the
palette, and the brand faces are untouched. §9 also records the two register-scoped
amendments to §2: the Ledger register's working UI text runs a 13px base (the ≥16px floor
governs reading prose, which Ledger surfaces do not carry), and Ledger rows run 32px
(the row is a full-width target, clearing WCAG 2.5.8's 24px floor; the 44px thumb floor
stays on every discrete control).

## 1. Thesis

**A calm instrument for exploring Central Oregon real estate, where the data is the
spectacle.** Three commitments:

- **The answer precedes the ornament.** Every node answers its visitor objective in the
  first viewport — the number, the homes, the verdict — before any invitation.
- **Motion carries continuity, not decoration.** Movement exists to show that context
  persisted (the place you came from, the range being computed, the market settling). If a
  motion does not encode a state change the visitor caused, it does not ship.
- **The ask is the next step, never an interruption.** One primary action per viewport,
  earned by the content above it (founding directive 3). The count is of VISIBLE filled
  controls, not of controls in the document. Chrome fills Value my home only on Sell
  (Page Grade 2026-08-14 wrong-job-chrome). On buyer, place, market, about, and listing
  pages the page body carries the primary; seller lives on Sell. A content page that
  demotes its own ask to ghost "because the header carries the primary" still ships a
  first viewport with no ask — do not do that.

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
   supporting figures and source line beneath. Opens Market. Opens Neighborhood. Fallback
   open for Master-plan when no owned Stage asset exists. Never the city hero (the city's
   houses are). *The pattern that makes data the spectacle.*
2. **Field** — live inventory as a spatial surface: map + list in one frame, hover/tap
   bound both ways, counts honest to the viewport. Opens Homes and City. Embeds in
   Neighborhood and Master-plan. A short plat is a Ledger, not a fake Field.
3. **Ledger** — a scannable list of real rows (homes, places, sales, reports) with tabular
   numbers and one action per row. Every row is a door.
4. **Stage** — full-bleed media (owned video/photo) carrying one line of type and one
   action; the only pattern allowed to be primarily emotional, and only where an owned
   asset exists. Never over a number. Opens Listing. Opens Master-plan when an owned
   place photo exists.
5. **Sheet** — the working surface for a step: form, filter set, comparison, plan detail.
   Progressive: one question visible at a time on 390.
6. **Quiet** — hairline-separated supporting content (FAQ, proof, definitions, legal,
   related links). Near-zero visual weight; carries the graph's outbound edges.

**Rhythm rule:** no two adjacent sections share a pattern, and no page uses more than four
of the six. A page needing five patterns is doing two jobs — split it or cut one.

**An enumeration is one section (amended 2026-08-26, Matt).** A run of sections that is
ONE section rendered once per member of a set the PLACE determines — one per property type
present, one per school level assigned, one per governing-document kind held — is one
logical section for the rhythm rule, however many members the set has. The run counts once,
as its pattern, and "no two adjacent" is judged on what sits either side of the run. Matt
chose this over collapsing a four-type property run into a single section: a buyer looking
for a townhome and a buyer looking for land are asking different questions and each deserves
its own heading.

Four conditions, all of them. Break one and it is N adjacent sections again:

1. **One template.** Every member is the same section: same pattern, same slots, same
   heading shape, same level. The only permitted variation is the template's own documented
   degradation when the data for one member is withheld — the fallback the primitive itself
   specifies, never a second design. A hand-written section dropped into the run ends it.
2. **The data picks the members.** The set is exactly the members the place has. A member
   with nothing publishable is absent, never an empty section and never a zero.
3. **One eyebrow names the run.** Every member carries the same context line
   (`<Place> · Property types`), so the run reads as one thing enumerated rather than
   several things stacked.
4. **The member is the only variable.** Order, heading level, and the shape of the one
   action are identical across members.

What this does not license: repeating a pattern because two unrelated sections happen to
suit it; a run whose members a person chose; or a fifth pattern. An enumeration spends one
of the four patterns a page may use, exactly like any other section.

**One shop, five place rhythms** (Matt 2026-08-14). Chrome, type, tokens, Field/Ledger
row language, and the motion ladder are the same site. The first pattern names the grain.
A city, a neighborhood, a master-plan, a plat, and a listing that wear the same first
screen are a lock break. A listing that looks like another product is a lock break.
Master-plan is not a neighborhood with a nicer name. Tetherow is an exemplar of the
master-plan template, not a one-off product.

**Per-destination openings** (six patterns only — no seventh):

| Grain | Route | Opening | Differentiator |
|---|---|---|---|
| Homes | `/`, `/homes-for-sale` | Field | Houses fill the fold. Towns are filters. |
| City | `/cities/[slug]`, `/zip/[zip]` | Field of this city's houses. Verdict is a caption, never a number hero. | Child neighborhoods and master-plans are doors below the fold. |
| Neighborhood | `/cities/[slug]/[neighborhoodSlug]` | Instrument (this neighborhood's pace) then Field of its houses. | Daily life (schools, parks) on the first path. Not amenities or membership. |
| Master-plan | `/communities/[slug]` | Stage (owned place photo) then Field. No owned asset → Instrument of what belonging here is, then Field. | Amenities, membership, STR. Child plats are doors. Not a neighborhood. |
| Subdivision | `/subdivisions/[slug]` | Ledger of this plat's homes. Field only when the plat has enough pins to be a map. | Parent community or city is the back door. Schools on the first path. A short plat is a list. |
| Listing | the house URL | Stage (this house's media) with price and specs on the media, then one act (Sheet: tour or ask). | Same shop as the place pages. Payment, history, this place, who listed = layer 1. |
| Market | `/housing-market` and leaves | Instrument | Number and chart. |
| Sell | `/sell` | Stage then Sheet | Address field is the spine. |
| Saved | `/account` saved surfaces | Ledger | What changed. |
| About | `/about`, `/team` | Quiet + Sheet | Faces first. |

The old line "Places → Instrument then Field" is retired. It made four grains one page.

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

## 8. How the lock was granted

Matt judged the MOVING prototype live in production at `/dev/public-v3` (real Bend data,
390 and 1280, reduced-motion path) and granted the visual lock on 2026-08-11. The barrel
that implements these patterns is `components/site/v3`, enforced by `ci:public-v3`, and
the rollout onto it is ratcheted by `ci:public-ui`.

## 9. THE LOOK (Matt 2026-08-26, LOCKED)

Matt judged four candidate skins on one shared specimen (the Skin Room: identical markup,
every visual difference carried in one token block per skin) and locked two:

- **Broadside** — the DEFAULT register. Every content surface wears it by mounting
  `V3_ROOT_CLASS` and nothing else. The site reads like the broker's own broadsheet:
  radius 0, no elevation shadows, rule weight as the hierarchy, photography full-bleed
  and unframed.
- **Ledger** — the register for search/data surfaces. A surface takes it by mounting
  `V3_LEDGER_CLASS` (exported from the barrel) beside `V3_ROOT_CLASS` on its page root.
  A working instrument: 13px base, Geist Mono numerals, 32px rows, near-full-viewport
  width, sunken panels, 120ms linear motion. The data is the spectacle.
- **Vellum** — REJECTED, explicitly: soft depth, radius 16, layered navy shadows is the
  Bend competitor default, the register this brand would be choosing to blend into.
- **Stamp** — not adopted for the web product.

A register varies structure, density, rule weight, and motion ONLY. Both registers keep
the locked brand (navy `#102742` / cream `#faf8f4`, Amboqia + Geist), both keep the six
patterns, and NEITHER register draws an elevation shadow anywhere. The implementation is
`components/site/v3/tokens.css`: Broadside is the base `.v3` token block, Ledger is the
section 2b re-declaration. A component never branches on register — it reads tokens.

### The token translation (specimen value → v3 token)

| Skin Room value | v3 token | Broadside | Ledger |
|---|---|---|---|
| radius 0 everywhere | `--v3-radius-sm/control/card/pill` | 0 | 0 |
| circular map pins / chart points | `--v3-radius-mark` | 999px (a data mark is not a box; no register overrides it) | same |
| 1px hairline rules | `--v3-hairline` / `--v3-rule-hairline` | `rgba(16,39,66,.08)` | `rgba(16,39,66,.06)` |
| navy section rules | `--v3-rule-section` | 2px navy | 3px navy |
| mast rule (header bottom, nothing else) | `--v3-rule-mast` | 4px navy | 3px navy |
| section rhythm | `--v3-section-pad` | `clamp(3.5rem, 9vw, 7.5rem)` | 1.625rem |
| small-caps label tracking | `--v3-track-label` | .14em | .12em |
| display tracking | `--v3-track-display` | −0.01em | 0 |
| display face + weight | `--v3-font-display` / `--v3-weight-display` | Amboqia · 400 | Geist · 600 |
| numeral face (figures) | `--v3-font-num` | Amboqia (the number is the spectacle) | Geist Mono |
| base body size | `--v3-size-body` (+ the ramp) | 1rem | 0.8125rem (13px, working UI text — see the §2 amendment above) |
| page measure | `--v3-measure` | 72rem | `min(96vw, 97.5rem)` |
| row height / row padding | `--v3-row-min` / `--v3-row-pad-block` | 44px / `--v3-space-sm` | 32px / `--v3-space-2xs` |
| panels | `--v3-panel-bg` / `--v3-panel-border` | raised white, 1px `--v3-edge` | sunken `rgba(16,39,66,.03)`, 1px `--v3-edge` |
| photography | `--v3-photo-thumb/tile-min/lead-min` | 7.5 / 12 / 24rem, unframed | 4.5 / 9 / 16rem — small, data-first |
| motion | `--v3-dur-*` / `--v3-ease-out` | the locked §5 ladder (200/300/400ms, ease-out) — the ladder supersedes the specimen's single 300ms | 120ms, linear |
| shadows | — | none. The only shadows in the barrel are functional: the inset selection ring on a Field row/photo and the on-media text shadow for type over photography. Neither is elevation, and neither register adds one. | same |

Rule placement: a pattern section that FOLLOWS content opens on `--v3-rule-section`
(`* + .v3.v3-<pattern>` in each pattern stylesheet); the section that opens the page
carries none, because the mast rule above it already closed the chrome. Sheet draws no
section rule — at its 40rem working measure a 72rem-language rule would misstate its
width. `--v3-edge` (12%) remains the box edge of a control or panel (an input, the map
frame); it is not a rule and does not thin to the hairline.

### Which register each v3 surface wears

| Surface family | Routes (v3 today) | Register |
|---|---|---|
| Search | `/homes-for-sale` (app/search/page.tsx), `/homes-for-sale/[...]` (app/search/[...slug]), the map split view | **Ledger** |
| Homes browse | `/open-houses`, `/price-drops`, `/our-homes`, `/luxury-homes-bend`, `/compare` | Broadside |
| Places | `/cities`, `/oregon/[city]`, `/zip/[zip]`, `/neighborhoods`, `/communities`, `/subdivisions`, `/subdivisions/[slug]` | Broadside |
| Market | `/housing-market` and every leaf, `/months-of-supply`, `/reports/sales/[city]/[period]`, `/how-we-get-our-numbers` | Broadside |
| Guides | `/central-oregon/*` (golf, trails, events, venues), `/parks`, `/schools` | Broadside |
| Sell | `/sell`, `/sell/valuation`, `/cma-drafts/[id]` | Broadside |
| About / proof | `/about`, `/team`, `/reviews`, `/videos`, `/join`, `/refer-a-client`, `/blog` | Broadside |
| Tools | `/tools/mortgage-calculator`, `/tools/rental-property-calculator`, `/tools/appreciation` | Broadside |
| Account + utility | `/account`, `/activity`, `/book`, `/contact`, `/faq`, `/newsletter`, legal/system pages, auth pages, `/site-index`, `/not-found` | Broadside |

The line: a surface whose JOB is scanning and filtering many live rows is a data surface
and wears Ledger; a surface that answers, shows, or asks — even with figures on it — is a
content surface and wears Broadside. `/compare`, `/account` saved ledgers, and the two
calculators are the watch list: each is Broadside today and becomes a Ledger candidate
for Matt's call the next time its family is touched. Interior components on the search
surfaces that still import the legacy register (ListingCard, the filter chrome — held by
the `ci:public-ui` baseline) inherit the register's inherited properties only; they take
the full Ledger treatment when they roll onto the barrel.
