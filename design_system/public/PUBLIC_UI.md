# Public UI — the visual language

The rules that decide how a public page LOOKS. It is a living spec, not a lock:
it changes when Matt decides something better, and the changelog at the bottom
records every change with the reason.

**What governs, in one place:**

| | Where |
|---|---|
| The look — every color, radius, rule weight, size, motion value | `components/site/v3/tokens.css`, on `:root`. ONE file, 118 pages. |
| The patterns a section can be | §3. Six today, and the set is OPEN. |
| Which register a surface wears (Broadside / Ledger) | §6 |
| Contrast floors | §4 |
| Motion | §5 |

**What is mechanically enforced, so nobody has to remember it:**
`ci:one-design-system` (one register, one token file, no raw brand values, no
elevation shadows) · `ci:chrome-single-source` (one header, one footer) ·
`ci:design-tokens` · `ci:public-ui` (the migration ratchet) · `ci:public-v3`.
Everything else in this file is prose, and prose is advisory — if a rule here
keeps getting broken, the answer is a gate, not more paragraphs.

**Brand is the one thing this file does not decide.** Navy `#102742`, cream
`#faf8f4`, Amboqia display, Geist body, and the voice canon are inherited and
locked elsewhere (`CLAUDE.md` §2 and §3).

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

## 3. The pattern set — SIX TODAY, OPEN (Matt 2026-08-27)

These six are the vocabulary the site is built from, and almost every section a page needs
is already one of them. **The set is not closed.** A seventh pattern is allowed, expected
when the work calls for it, and is added by building it — not by asking permission here
first.

**The one condition, and it is the whole point:** a new pattern is a PRIMITIVE. It lands in
`components/site/v3` as a real component with its own stylesheet reading
`components/site/v3/tokens.css`, exported from the barrel, available to every page. What is
forbidden is the ONE-OFF: a page that hand-rolls its own section markup with its own look,
because that is a second design system arriving one page at a time, which is exactly what
the site spent 2026-08-27 removing. Enforced mechanically by `ci:one-design-system`, which
does not care how many patterns exist and does care that every one of them reads the tokens.

**Why "closed" is gone.** It was written 2026-08-11 to stop the shop growing a bespoke
component per page, which is a real failure mode. But "closed" does not say that — it says
a section that fits none of the six may not exist, and that is what got acted on. Paired
with the four-pattern cap it deleted seven sections off the homepage draft and five off
`/communities/[slug]`, and it justified deleting the community market charts with "the
barrel has no chart primitive and the pattern set is closed" three weeks after `V3Chart` was
built. Matt, seeing the rule restated: "6 and closed, that is such a stupid rule ... nuke it
from existence." The failure mode it was aiming at is real and is now gated properly; the
absolute it stated was not, and is gone.

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

**Rhythm rule (amended 2026-08-27, Matt — the pattern cap is GONE).** No two adjacent
sections share a pattern. That is the whole rule. **A page uses as many of the six as its
content needs, up to all six.**

The old rule capped a page at four of the six and told the author to "split it or cut one."
In practice nobody split a page; the cap cut content. It deleted seven sections off the
homepage (the alert capture, the seller ask, the reviews, the brokers, the ticker, and the
pace and mix market figures) and it deleted the featured rail, the ticker, the market
charts, the open-house list and the activity feed off `/communities/[slug]`. Matt granted a
place-family exception on 2026-08-26 to stop it eating six standing directives, which was
the same rule failing the same way on three more routes. **A visual-language rule may not
decide what content a page carries.** Matt killed the cap on 2026-08-27 rather than grant a
fourth exception; the place-family exception is retired into this rule, having been
superseded rather than revoked.

**What replaces it.** The section set of a page is a PRODUCT decision and belongs to Matt
and to the standing directives (the contract tests in
`components/site/__tests__/site-contracts.test.ts`). The pattern set decides how a section
LOOKS, never whether it exists. A migration that cannot express a section in one of the
patterns BUILDS the primitive it needs, into `components/site/v3`, reading the tokens — it
does not delete the section, and it no longer has to stop and ask whether a seventh pattern
is permitted. It is.

**What still binds, and why it is enough.** "No two adjacent share a pattern" is what stops
a page reading as mush, and it does that work without touching content: a run of Ledgers
becomes Ledger / Quiet / Ledger, which is a rhythm decision, not a cut. The per-destination
opening table below still fixes what each grain OPENS on, so five grains still read as five
places. And an enumeration still counts once (see below).

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
suit it; or a run whose members a person chose. An enumeration counts once for the
adjacency rule, exactly like any other section.

**One shop, five place rhythms** (Matt 2026-08-14). Chrome, type, tokens, Field/Ledger
row language, and the motion ladder are the same site. The first pattern names the grain.
A city, a neighborhood, a master-plan, a plat, and a listing that wear the same first
screen are a lock break. A listing that looks like another product is a lock break.
Master-plan is not a neighborhood with a nicer name. Tetherow is an exemplar of the
master-plan template, not a one-off product.

**Per-destination openings.** What each grain OPENS on. This is what keeps five
place types from reading as one page, and it binds whatever the pattern set holds:

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
| navy-70 (`--v3-navy-70`, navy at 70%) on cream | 8.2:1 | AAA |
| cream-60 on navy | 5.99:1 | AA (muted text only, ≥16px) |
| navy on white `#ffffff` | 16.1:1 | AAA |
| white on navy | 16.1:1 | AAA |

Rejected: navy-50 on cream (3.9:1 — fails AA for body) and cream-40 on navy (3.4:1).
**Muted text stops at navy-70 / cream-60.** Every shade is `color-mix()` off the two base
colors, so these ratios hold only while the base colors do — a style template that changes
navy or cream must be re-checked against this table before it ships.

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

## 6. THE LOOK — the two registers (Matt 2026-08-26)

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
| mast rule (header bottom, nothing else) | `--v3-rule-mast` | 4px navy | 3px navy in-scope; the ONE site chrome mounts in app/layout.tsx outside every page scope, so every page — search included — shows the Broadside mast today |
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

---

---

# Changelog

Why each rule is the way it is, so a dead one is not reintroduced as a new idea.

- **2026-08-11** — written greenfield after the IA lock, under design amnesia (see
  above), and granted by Matt on the moving prototype. Six patterns, declared
  closed; a four-of-six cap per page.
- **2026-08-26** — an enumeration counts once for the rhythm rule (a run of one
  section rendered per member of a set the place determines is one section).
- **2026-08-26** — THE LOOK: two registers, Broadside and Ledger, §6. A register
  varies structure, density, rule weight and motion only.
- **2026-08-26** — the three big place pages allowed a fifth pattern. *Retired
  2026-08-27: superseded when the cap died.*
- **2026-08-27** — **the four-pattern cap is DEAD.** It never split a page; it cut
  content — seven sections off the homepage draft, five off `/communities/[slug]`.
  A visual-language rule may not decide what content a page carries.
- **2026-08-27** — **the pattern set is OPEN.** "Closed at six" was aimed at
  page-local one-offs but stated as "a section that fits none may not exist", and
  that is what got acted on: the community market charts were deleted for want of
  a chart primitive three weeks after `V3Chart` was built. A new pattern is now
  built as a barrel primitive; the one-off is what `ci:one-design-system` blocks.
- **2026-08-27** — the token block moved to `:root` alone and every shade became
  `color-mix()` off the two base colors, so a style template reaches the charts,
  the scrims and the hairlines instead of only the solid colors.
- **2026-08-27** — this file restructured: rules first, provenance last. The
  self-graded craft scorecard was deleted (a number a document gives itself
  measures nothing), and the corrupted amendment paragraph it carried since
  2026-08-26 went with it.
