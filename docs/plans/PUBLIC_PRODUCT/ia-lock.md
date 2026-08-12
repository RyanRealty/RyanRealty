# P5 IA — destinations, continuity, cuts (LOCK PENDING)

Derived 2026-08-11 from the 28 LOCKED processes' §11 destination implications (P3 lock,
decisions.md) and the P4 data atlas. Names are plain-English job names proposed under
amnesia; Matt renames or approves at the IA lock. **This document binds only when
decisions.md records the IA lock.**

## The graph, not a menu

The site is one exploration graph (founding directive 2). Destinations below are the
graph's regions, not silo pages. Every route in `page-inventory.json` carries
`destination` + `visitor_objective` + `machine_objective` + `exits` — the exits ARE the
graph edges. Dead ends outside the legal/service annex are defects.

## Destinations (job-traced)

| Destination | The job it serves (process-traced) | Cadence | What folds in |
|---|---|---|---|
| **Homes** | "Show me the homes — live, filterable, on a map" (find-a-home). One browse system at `/homes-for-sale` + the listing-detail node. Curated intents are MODES of it, not siblings: open houses, price drops, luxury, sold, video browse. | continuous | `/feed` → mode of `/videos` (Matt P3), `/compare` → mode, buyer guides attach as a layer (Q2) |
| **Places** | "Tell me about this place before I commit to it" (evaluate-a-place). The geo ladder: city → neighborhood → community → subdivision → zip, with POI content folded in (P3 merge). `/oregon/*` is its protected out-of-market boundary tier (refer-out-of-area). | continuous | three parallel index pages collapse to one entry; duplicate community URL spaces collapse (GSC + 301) |
| **Market** | "What does Ryan Realty know about this market — present, past, and what it means" (explore-market-knowledge; founding directive 4). Per-geo market nodes with the verdict above the fold; reports as citable leaves; the WORD leaves (blog, FAQ) join this knowledge family — numbers and words are one trust engine (read-content PDS). | continuous | `/pulse` becomes the present-tense view, not a second feed; `/resources` dissolves |
| **Sell** | "Decide whether and how to sell — and get the real number" (plan-a-sale + get-home-value.written-cma). Plan + proof + process + THE one valuation intake spine (`/sell#get-value`, locked). | event-driven | `/sell/valuation` + `/home-valuation` → 301 to the spine (one spine, never forked — locked); situation content folds as variants pending GSC |
| **Saved** | "Pick up my search where I left it, and what changed" (save-and-return.portal). Saved homes, saved searches, alert management, the change feed. Auth-gated; reached from persistent chrome, not the nav row. | daily | `/dashboard` cut (portal duplicate, per PDS); alert manager lives here |
| **About** | "Who are these people, and how do I reach them" (contact-form-inquiry + trust surfaces). About, team, reviews, contact — one trust cluster with one contact completion. | rare | **Recruiting** (join-the-brokerage) is an off-graph node in this cluster whose chrome must not sell the recruit a CMA |

**No destination (by design):** deliver-alerts, capture-and-attribute, earn-search-traffic,
measure-search-traffic-gsc, track-outbound-engagement, cookie-consent (global overlay +
footer affordance), pwa-offline (shell contract), ods-idx-attribution (required slot on
listing detail + chrome), broker-direct-call-text (one-tap affordance stamped across the
graph), guest-alert-capture (component contract on host nodes), run-the-numbers (the three
calculators dissolve into context: payment math on listings, underwrite math on the
investor lens, hold math on the valuation spine — no `/tools` index), newsletter (the ask
lives in chrome; the issue is an off-site node whose links re-enter the graph),
sign-transaction-documents + view-client-valuation-doc (tokenized service nodes: no nav,
noindex, frozen URL namespaces — live links exist in client inboxes).

## Nav proposal (mobile-first, 390 is truth)

Top bar: **Homes · Places · Market · Sell · About** + persistent **Get your home's value**
CTA (→ the spine) + **Saved** as the account affordance (icon, not a nav word).

Derivation note (amnesia): this resembles the old bar because the jobs' plain-English
names land near the old words — the derivation is from the locked processes, and the
deltas are real: Areas→Places (the job is evaluating a place, not browsing "areas"),
Buy→Homes pending Q2 (the buyer's job is homes, education attaches to it), tools/feed/
compare/resources/dashboard cease to exist as nav concepts, blog+FAQ move under Market
knowledge, and the LP layer leaves the graph entirely.

## Continuity spec (founding directive 5 — an IA requirement, not polish)

What context persists across which edges:

1. **Place context** — established on any Places/Market/listing node, follows the visitor:
   Places(Tumalo) → Homes arrives pre-filtered to Tumalo; → Market arrives on the Tumalo
   node; listing detail → Places climbs to ITS ladder (already built: resolvePlaceContext).
2. **Search context** — filter/map state survives browse ↔ detail ↔ back and browse ↔
   place-node hops; a save captures the CURRENT context, never a blank form.
3. **Intent shading** — a visitor arriving through Sell or holding a valuation sees
   seller-shaded next steps on Market/Places nodes (their CMA doc exits back into the
   graph); buyer-context visitors see alert/save asks. One primary CTA per viewport either
   way (acceptance bar).
4. **Identity** — guest capture (email-only) upgrades in place to the portal without
   re-entry; attribution cookie survives every hop (capture-and-attribute contract).
Mechanics (how state carries: URL params vs storage vs server) are P6/P7 decisions; WHAT
carries on WHICH edges is locked here.

## SEO carve-outs (data, not shape)

Un-renamable: `/privacy`, `/data-deletion` (pinned by A2P carrier review + OAuth consent
screens), `/sign/*`, `/cma/*`, `/bpo/*` (live links in client inboxes), published broker
phone numbers. Every cut/rename of an indexed route requires the GSC evidence row and a
301; `/oregon/*` equity is protected; canonical URLs are the GSC scope keys — renames fork
metric history (measure-search-traffic-gsc PDS).

## Amnesia test (recorded)

- Blacklist opened as design input: NONE (no kb section stacks, no old mockups, no prior
  program's IA files as targets).
- Every destination traces to locked processes (table above), not to a route that exists
  today; the folds/cuts are the proof the current shape was not inherited.
- Names are the jobs' plain-English words; where a name lands on an existing word (Market,
  Sell, About), the coincidence is because the job's name IS that word.
- Could this exist if the current public site did not? Yes — nothing above requires it.

## Cut-list

Lives in `cut-list.md` (route cuts vs surface cuts vs Explicitly NOT cut), frozen at the
IA lock. Every route cut carries its GSC evidence verdict and a 301 target.
