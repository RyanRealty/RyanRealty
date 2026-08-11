# Public Site UX Overhaul — Comprehensive Reimagine Program

**Status:** PLAN OF RECORD  
**Opened:** 2026-08-11  
**Updated:** 2026-08-11 (v2 — every page · every section · competitor-scored · Frankenstein kill)  
**Resume cue:** “public site reimagine” / “public UX overhaul”

---

## Mandate (Matt)

1. **Thorough reimagine** of the entire public site. Remove Frankenstein, disorganization, and weak design — not patch them.  
2. **Only brand lock:** colors (navy `#102742` / cream `#faf8f4`) and fonts (Amboqia + Geist). **Nothing else is sacred.**  
3. **Every page** and **every section** is in scope and must be analyzed.  
4. **Every analysis is competitive** — scored against named competitors, not against our own old kits.  
5. Optimize for **engagement + lead conversion**. This site is the brokerage’s primary landing surface.

Prior programs (`EXPERIENCE_SYSTEM`, `KB_SITE_CONVERSION`, `PAGE_REVIEW_REDESIGN`, partial KB migrations, design-audit folders) are **evidence and inventory only**. They are not the destination.

**§0 Data Accuracy** and **brand voice** remain absolute (product law, not visual style).

---

## 0. What “done” means

The Frankenstein site is gone when **all** of the following are true:

| Criterion | Definition |
|---|---|
| **Page coverage** | Every public route has an audit row: render score, competitor score, disposition, ship status |
| **Section coverage** | Every distinct section/pattern type has a disposition: redesign · merge · kill · rebuild-in-library — none left “unreviewed” |
| **One system** | One chrome, one section library, one CTA grammar; zero dual-nav / multi-era registers on money paths, then on all public routes |
| **Journey litmus** | Buyer · seller · brokerage timed paths pass on mobile (390) + desktop (1280) on production |
| **Competitive** | Flagship templates **lead** named local brokerages; find/sell core has **no embarrassing gap** vs Zillow/Redfin-class UX |
| **2026 bar** | Written checklist (§3) passes on every migrated template |
| **Conversion** | Primary CTAs instrumented; valuation + alerts + tour/contact funnels baselined and improving |
| **Gates** | Anti-regression: no new legacy section types; ratchet legacy count → 0 |

“Gates green” alone never means done. **Render + competitor matrix + disposition ledger** mean done.

---

## 1. The problem this program kills

| Failure | User experience |
|---|---|
| Multi-era UI | Sections and pages from different design generations stacked on one URL |
| Disjoint information | Stats, stories, CTAs, and tools compete instead of sequencing a job |
| Partial kit migrations | KB / legacy / hybrid / LP chrome mid-funnel |
| Unreviewed sections | Flagship pages improve while FAQ, testimonials, market bands, footers still read old |
| Low competitive bar | “Better than a brochure site” while still losing to portals and stronger locals |
| Code-claimed fixes | Audits pass in source while live pixels stay confused |

**Cure:** inventory everything → score against competitors → lock one system → rebuild every page from that system only.

---

## 2. Method — three tracks (comprehensive, not waterfall-only)

```text
TRACK T — TRUTH (what exists + how it loses)
  Full page inventory
  Full section-pattern inventory
  Journey A/B/C timed render audits
  Competitor battery (locals + portal)
  Baseline conversion (first-party + CRM)
  → PAGE_LEDGER + SECTION_LEDGER + JOURNEY scores

TRACK S — SYSTEM (what 2026 looks like for Ryan Realty)
  2026 UX bar (checklist)
  IA reimagine (Matt lock)
  Visual language + section library (Matt lock)
  Chrome + CTA grammar + motion/density
  Primitives + gates
  → One library pages may compose

TRACK R — ROLL (ship without re-Frankensteining)
  Litmus spines first (chrome → home → search → listing → sell → about)
  Then every remaining page family
  Every ship uses only library sections
  Ratchet: legacy section types → 0; unaudited pages → 0
```

**Rule:** Tracks T and S start immediately after BOOT. Track R does **not** restyle production until **IA + visual/section-library locks** exist — except mechanical fixes that unblock measurement (broken forms, P0 bugs). After locks, R ships continuously; T’s ledgers stay open until empty.

---

## 3. 2026 UX bar (ceiling — not “beat the weakest local”)

Every page and section is graded against this bar. Local competitors are necessary; **portals + modern product UX** set the ceiling.

| ID | Bar | Fails when… |
|---|---|---|
| B01 | **Intent in ≤5s** | Visitor cannot tell buy / sell / trust job from the first screen |
| B02 | **One primary action** | Multiple equal CTAs; no clear next step |
| B03 | **Portal-grade find** | Map/list/filter parity weak; mobile map second-class; search feels clunky vs Zillow/Redfin |
| B04 | **Data as interface** | Live numbers are wallpaper; not comparable, scoped, or actionable |
| B05 | **Section coherence** | Adjacent sections feel like different products |
| B06 | **Progressive disclosure** | Walls of features/matrices before proof or action |
| B07 | **Motion with purpose** | Decorative motion only, or none where feedback is needed; ignores reduced-motion |
| B08 | **Performance = UX** | Slow LCP/INP; layout shift; blocked interaction |
| B09 | **Trust UX** | Unsourced stats, dual broker identity, fee fog, empty media voids |
| B10 | **Capture without tax** | Hard walls before value; unclear post-submit |
| B11 | **Return visit** | No save/alert/continue path for explorers |
| B12 | **A11y default** | Poor focus, contrast, targets, semantics |
| B13 | **Mobile = desktop job** | Phone cannot complete the same primary job |
| B14 | **Honest empty/loading** | Black media, blank navy tiles, dead ad slots, silent failures |

**Competitive tiers (fixed battery — update names if SERP leaders change):**

| Tier | Role | Examples |
|---|---|---|
| Local brokerage | Must **win** | Cascade Hasson, Stellar Realty NW, Duren (or current “Bend real estate” leaders) |
| Portal | Must **not embarrass** on find/sell core | Zillow, Redfin equivalent surfaces |
| Product reference | Steal patterns (not brand) | Best-in-class map UX, fintech clarity, travel booking decision UI — only as pattern input |

---

## 4. Coverage law — every page, every section

### 4.1 Page ledger (unit = route)

File: `inventory/PAGE_LEDGER.json` (and human summaries under `audit/pages/`).

Every public route row includes:

| Field | Content |
|---|---|
| `route` | Canonical path |
| `template` | home, search, listing, sell, about, geo-city, … |
| `intent` | buy · sell · brokerage · market · tool · content · legal · lp |
| `register_now` | kb · legacy · hybrid · lp · unknown |
| `sections[]` | Ordered section pattern IDs on the page |
| `primary_cta_observed` | What the page actually pushes |
| `scores` | clarity, trust, engagement, conversion, 2026_bar (0–2 each) |
| `competitor` | Best equivalent URL + win/lose/tie on 6–10 rows |
| `disposition` | rebuild · redesign-in-place-forbidden · redirect · cut · legal-minimal |
| `priority` | P0–P3 from traffic × conversion × journey role |
| `status` | unaudited · audited · designed · building · shipped · verified |

**No public marketing route may remain `unaudited`.** Legal/privacy may be `legal-minimal` but still listed.

### 4.2 Section ledger (unit = pattern type)

File: `inventory/SECTION_LEDGER.json` (summaries under `audit/sections/`).

A **section** = a repeatable block (hero, stats band, listing mosaic, testimonial wall, FAQ, alert capture, market chart, team grid, fee matrix, sticky broker rail, footer, …).

Every section pattern row includes:

| Field | Content |
|---|---|
| `pattern_id` | Stable id e.g. `hero.search-first`, `band.live-stats`, `grid.listings` |
| `instances` | Example routes + screenshots |
| `job` | What user job it serves (or “none — cut”) |
| `2026_bar_hits` | Which B01–B14 it affects |
| `competitor_best` | Who does this block better + why |
| `disposition` | **redesign** · **merge-into:{id}** · **kill** · **library** (approved primitive) |
| `library_component` | Target primitive name once designed |
| `status` | unaudited · audited · specified · implemented · ratcheted |

**Frankenstein is impossible when:** pages only compose `status=library` sections, and `SECTION_LEDGER` has zero `unaudited` / zero orphan legacy types on migrated routes.

### 4.3 Journey overlays (unit = workflow)

Journeys do not replace page/section coverage — they **prioritize** and **prove** conversion.

#### Journey A — Buyer (specific home type)

| Step | Job | Primary conversion |
|---|---|---|
| A1 Land | Orient + start search | Open search/map |
| A2 Scope | Place, price, type, lifestyle | Apply filters / save criteria |
| A3 Browse | Compare options | Save homes |
| A4 Detail | Worth a tour? | Schedule tour / text / call |
| A5 Capture | Stay in market | Alerts / account |
| A6 Trust | Why this brokerage | Soft proof near decision |

**Litmus A:** cold home → filtered results → listing → tour or alert intent.  
Pass: ≤90s to meaningful results; ≤3 primary taps to tour/alert; zero chrome breaks; mobile map first-class.

#### Journey B — Seller

| Step | Job | Primary conversion |
|---|---|---|
| B1 Land | Feel seen as seller | Value my home |
| B2 Value | Real next step | Submit valuation |
| B3 Proof | Believe outcomes | Continue |
| B4 Plan | How we sell / fees | Book call |
| B5 Close loop | What happens next | CRM speed-to-lead |

**Litmus B:** seller entry → one valuation spine → confirmation.  
Pass: primary CTA above fold mobile; no duplicate valuation heroes; fee story scannable ≤60s.

#### Journey C — Brokerage / services

| Step | Job | Primary conversion |
|---|---|---|
| C1 Identity | Who / where / when | — |
| C2 People | Who I work with | Work with broker |
| C3 Services | Buy vs sell offers | Start path |
| C4 Proof | Reviews + real track record | Contact |
| C5 Differentiation | Why not larger competitors | Choose path |

**Litmus C:** about → team → buy or sell path → contact/valuation.  
Pass: state differentiator after one About screen; no empty track-record voids.

---

## 5. Competitive analysis protocol (mandatory on every page + section)

### 5.1 Per page

1. Identify the **best competitor equivalent** (local) + **portal equivalent** if the page is find/sell/list.  
2. Screenshot us + them at **390** and **1280**.  
3. Fill a matrix (8–12 rows): first paint intent, primary CTA, information hierarchy, interactivity, trust, mobile job completion, speed feel, unique data, lead hooks, section rhythm.  
4. One honest sentence: **where we lead · where we lose · what we will steal (pattern only).**  
5. Disposition cannot be “keep as-is” unless we **win** the matrix or the route is legal-minimal.

### 5.2 Per section pattern

1. Find the best instance of that *job* on a competitor (e.g. “how they show sold proof,” “how they do map pins,” “how they price listing packages”).  
2. Score our pattern 0–2 on clarity / engagement / modernity / conversion.  
3. Disposition: redesign to beat them, merge duplicates, or kill if no job.

### 5.3 Artifact paths

```text
audit/competitive/{date}/
  pages/{route-slug}.md + screenshots/
  sections/{pattern_id}.md + screenshots/
  MATRIX_SUMMARY.md
```

Ship reviews for a family are **incomplete** without competitive artifacts.

---

## 6. Phases (with locks)

| Phase | Name | Track | Output | Matt lock? |
|---|---|---|---|---|
| **P0** | BOOT | — | Package registered; scoreboard; folder skeleton; competitor list frozen | Brand already locked |
| **P1** | Full inventory | T | `PAGE_LEDGER` seed (all routes) + `SECTION_LEDGER` seed (all patterns from render crawl) | — |
| **P2** | Journey + competitive deep audit | T | A/B/C timed audits; competitive matrices for all **P0/P1 priority** pages and **all** section patterns | — |
| **P3** | Conversion map | T | Route → job → primary CTA → events → CRM; baseline metrics | **Process lock** |
| **P4** | IA reimagine | S | Nav, hubs, cut-list, redirects (2–3 options → one) | **IA lock** |
| **P5** | Visual + section library | S | tokens, PUBLIC_UI.md, primitives list, 5 reference screens (home/search/listing/sell/about), every section pattern mapped to a library target | **Visual lock** |
| **P6** | Primitives + gates | S | `components/site/v2` (name flexible), chrome, CTA grammar, ratchet gates | — |
| **P7** | Litmus spines | R | Journeys A+B pass on prod | **Litmus lock** |
| **P8** | Full roll | R | Every page rebuilt from library; section ratchet → 0 | — |
| **P9** | Depth | R | Geo/market/content depth, SEO shells, explorer | — |
| **P10** | Harden | R | Perf, a11y, delete cut-list, dual chrome gone forever | — |

### P8 roll order (default — re-rank after P2 scores)

1. Global chrome (nav, footer, account, mobile)  
2. Homepage  
3. Search / homes-for-sale  
4. Listing detail  
5. Sell + valuation  
6. About + team + reviews  
7. Buy hub  
8. Geo (cities, communities, neighborhoods, zips, subdivisions)  
9. Market (housing-market, reports)  
10. Tools  
11. Content (blog, guides, FAQ, resources)  
12. LPs last (explicit conversion before/after plan each)

---

## 7. Scoring rubrics

### Page score (each dimension 0–2)

- **Clarity** — intent and hierarchy  
- **Trust** — proof, honesty, broker identity  
- **Engagement** — interaction, data usefulness, rhythm  
- **Conversion** — primary CTA strength and friction  
- **2026 bar** — count of B01–B14 passes (normalize to 0–2)

**Priority:** `journey_role_weight × traffic_proxy × (4 - avg_score)` — worst important pages first.

### Section score

- Job clarity · visual modernity · competitive gap · conversion contribution · a11y/mobile  

**Kill** sections with no job. **Merge** sections that repeat the same job. **Redesign** sections we lose on.

---

## 8. Conversion system

### North-star actions

| Intent | Primary | Secondary |
|---|---|---|
| Buyer explore | Save search / listing alerts | Save home, account |
| Buyer ready | Tour / text / call | Contact form |
| Seller | Valuation / CMA | Call, contact |
| Brokerage | Contact / work with broker | — |

### Scoreboard

- First-party sessions + section engagement + CTA/form events  
- GSC landing demand  
- CRM leads by path + speed-to-lead  

Until GA4 is trusted, do not panic off GA4 alone (dual-source policy).

### CTA grammar (locked at P5)

- One primary button per view  
- Consistent global seller + buyer affordances  
- Phone available, never the only path  
- No five equal ghost buttons  

---

## 9. Engineering constraints

- Single checkout, `main` only  
- Surgical staging per family  
- Redirect bridges for cuts (preserve equity, not UX debt)  
- Pages compose library only — no one-off section forks  
- Fix + gate in same commit (anti-regression)  
- LPs: redesign only with conversion plan  
- Admin Product OS out of scope  
- Design amnesia until IA + visual locks  

---

## 10. Package layout

```text
docs/plans/PUBLIC_SITE_UX_OVERHAUL/
  README.md                 ← constitution (this file)
  SESSION_BOOT.md
  state.json
  work-queue.json
  progress.txt
  decisions.md
  inventory/
    PAGE_LEDGER.json
    SECTION_LEDGER.json
    ROUTE_CRAWL.md
  audit/
    journeys/
    pages/
    sections/
    competitive/
  conversion/
  ia/
  design/                   ← pointers to design_system mockups
  families/                 ← per-family ship briefs
```

---

## 11. Recommended next steps (execute in order)

These are the **operational** sequence. Do not skip to restyling pages.

### Step 1 — BOOT (this package → live program)

- [x] Constitution + brand lock written  
- [ ] Register `PUBLIC_SITE_UX_OVERHAUL/` in `docs/DEVELOPMENT_PROCESS.md` (G44 package row); mark Experience/KB conversion as **superseded as destination** (evidence only)  
- [ ] Freeze competitor list in `decisions.md`  
- [ ] Create empty ledgers + audit folders  
- [ ] Define baseline conversion queries (valuation completes, alert subscribes, contact/tour)  

**Exit:** `state.phase = P1_INVENTORY`

### Step 2 — P1 Full inventory (every page, every section)

1. Crawl all public routes → seed `PAGE_LEDGER.json` (complete list, even if scores empty).  
2. Render-crawl priority templates + sample of each family → extract **ordered section stacks** → seed `SECTION_LEDGER.json` with every unique pattern.  
3. Tag each page’s current register (kb/legacy/hybrid/lp).  
4. Attach traffic proxy where available (GSC / first-party).  

**Exit:** zero unknown public routes; section pattern catalog v1 complete (may grow when new instances found).

### Step 3 — P2 Comprehensive audit (competitive + journeys)

For **each section pattern** and **each page** (batch by family; P0/P1 priority first, but **queue must drain to empty**):

1. Production screenshots 390 + 1280  
2. Competitor equivalent matrix  
3. Scores + disposition  
4. Journey A/B/C timed runs with defect list cross-linked to page/section IDs  

**Exit:** no `unaudited` rows in either ledger; `audit/competitive/` filled; ranked rebuild backlog.

### Step 4 — P3 Conversion map → process lock

- Map every page to one job + one primary CTA + events + CRM destination  
- List instrumentation gaps  
- Matt process lock in `decisions.md`  

### Step 5 — P4 IA options → IA lock

- 2–3 IA proposals driven by journey + ledger (not by current menu inertia)  
- Cut-list + redirect plan  
- Matt picks one  

### Step 6 — P5 Visual + section library → visual lock

- New language under navy/cream + Amboqia/Geist only  
- Specify **every** section pattern’s library target (or kill/merge)  
- Five reference screens; competitive side-by-side of mockups  
- Matt visual lock  

### Step 7 — P6 Primitives + gates

- Build library + chrome  
- Gates: single chrome on public money paths; ban new legacy patterns; section ratchet  

### Step 8 — P7 Litmus spines on production

- Chrome + home + search + listing + sell path until Journeys A+B pass  
- Matt litmus lock  

### Step 9 — P8–P10 Drain the ledgers

- Rebuild every page family in order  
- Each family: competitive artifact + before/after render + ledger status → shipped  
- Delete cut routes; ratchet section types to zero  
- Perf/a11y harden  

---

## 12. What we will not do

- “Migrate everything to KB” or “finish Experience v3” as the strategy  
- Restyle a page while leaving its sections on old patterns  
- Ship a family without competitive artifacts  
- Claim done from code review alone  
- Protect a weak page because it already exists (redirect instead)  
- Rebrand colors/fonts  
- Touch admin CRM UI in this program  

---

## 13. Success narrative (for humans)

Before: a smart MLS-backed site that **feels pieced together** — mixed eras, uneven sections, soft brokerage story, conversion friction.

After: **one** public product. Every page composed from one section library. Every section justified by a user job and proven against competitors. Buyer, seller, and trust journeys feel inevitable. Frankenstein is not “improved” — it is **replaced**.

---

*Brand: navy/cream + Amboqia/Geist only. Coverage: every page, every section. Authority: render + competitors. Destination: one system.*
