# Handoff — Heath / Tetherow LP "Home as an Asset" (2026-06-13)

**Author:** Claude Code session, 2026-06-13.
**Branch:** `main`. **My last commit:** `d3a4549a` (Heath repeat-sales rebuild). Commits after it (`f16b6f4b` changelog, `8213b3ec` broker command center) are a PARALLEL session — not mine.
**Supersedes the Heath portion of** `docs/plans/HANDOFF_CRM_SESSION_2026-06-12.md` (that doc's §6 listed the chart as broken — it is now fixed/redesigned).
**Memories:** `project_heath_lp_charts` (needs updating — see §6), `project_lead_funnel_audit_2026-06-12`.

---

## 1. What this was

The Tetherow Heath LP (`/lp/tetherow/heath`) needed an investment-grade, "ultra professional" section answering a smart buyer's question: how does property here perform as an asset? Matt's key redirect mid-build: **stop showing market-report averages (median sale / DOM / sale-to-list); show how an actual home has performed over time** — bought $X, resold $Y years later, that's Z%/yr.

---

## 2. DONE & verified live (commit d3a4549a)

The section is rebuilt and shipped: **"How homes here have performed over time"** — a repeat-sales (Case-Shiller-style) appreciation view.

- **Headline ribbon:** median annualized appreciation (**+6.8%/yr** live), # resales analyzed, median hold, current median home price.
- **Three hero "story" cards:** real homes — bought (year) $X → sold (year) $Y, holding period, +%/yr and +% total. Picks are deterministic (longest hold, strongest return, most recent).
- **Per-home bar list:** the 8 most recent resales with annualized-return bars.
- **Shown methodology** so the number is auditable (required by §0).

**Verified end-to-end:** the DAL output was checked against direct SQL (130 clean Tetherow pairs, median +6.9% in SQL / +6.8% live after cache refresh). The new heading, the stat, the bars, and the methodology all appear in the **server-rendered HTML** (confirmed via curl).

### Why this implementation is correct
- **Server-rendered, no recharts.** The previous attempt used recharts `ResponsiveContainer`, which measured 0×0 in the App Router and never painted ("recent closings doesn't work"). That component is **deleted**. Server HTML renders reliably AND is better for SEO (the numbers are in the page source).
- **§0 data accuracy is the whole game.** Raw repeat-sale pairs lie — a parcel bought as land then built on shows a fake "1,300% return." The DAL screens every pair to a true same-home comparison.

### Files
- `lib/data/listings/getRepeatSalesAppreciation.ts` — the DAL function (NEW). Exported from `lib/data/index.ts`.
- `app/lp/tetherow/heath/_components/HeathAssetPerformance.tsx` — the server component (NEW).
- `app/lp/tetherow/heath/page.tsx` — wired in; old chart prep removed.
- DELETED: `app/lp/tetherow/heath/_components/HeathPerformanceCharts.client.tsx`.

### The DAL methodology (so it can be reused / audited)
`getRepeatSalesAppreciation(subdivisionLike)`:
1. Page through ALL closed `listings` for `SubdivisionName ILIKE <pattern>` (PostgREST caps at 1000 rows; Tetherow has ~1,522 — **must paginate or the median skews**).
2. Group by `StreetNumber || ' ' || StreetName`; keep addresses with 2+ sales.
3. Pair = first sale (buy) vs most-recent sale (sell).
4. **Screen:** both sales have sqft; sqft within 15% (no rebuild/addition); held ≥4 years; annualized return in [0%, 20%] (drops data errors + missed rebuilds).
5. Return pairs + median annualized + median years + count. Cached 6h, tag `listings`.
6. Mixed-case columns selected WITHOUT double-quotes (`.select('StreetNumber,...')`) — PostgREST is case-sensitive but unquoted; double-quotes fail.

---

## 3. Data reality (verified facts to reuse)
- Tetherow closed sales all-time: **1,522**. Last 12 months: 57 (subdivision 'Tetherow' = 44, 'Tetherow Crossing' = 13).
- **Heath alone has ~0 recent closings** — the MLS does not tag Heath separately from the parent Tetherow community. All Heath-level reads fall back to Tetherow parent (consistent with the existing ribbon + CMA copy). `HEATH_MLS_ALIASES[0] = 'The Heath at Tetherow'`.
- Repeat-sales median annualized appreciation (screened): **~6.8–6.9%/yr** over 130 same-home pairs. Hold periods 4–28 years.
- HOA dues (verified, on page): **$2,244/yr**.

---

## 4. Open Heath items (NOT done — next session)
1. **Golf dues + property-tax panel.** Currently the page says "ask us." Needs EITHER Matt's verified Tetherow membership tiers + Deschutes effective rate, OR compute taxes from Deschutes assessed values on recent sales (verifiable). **Never invent these numbers (§0, license risk).**
2. **SEO: move the URL.** Metadata/JSON-LD are good and the page is `index:true`, but the path `/lp/tetherow/heath` signals "ad landing page." To rank for "Heath at Tetherow real estate," move to a semantic path like `/communities/tetherow/heath` with a **301** from the LP URL. (robots allows /lp; canonical currently self-points to the /lp URL.)
3. **Templatize.** `getRepeatSalesAppreciation` + `HeathAssetPerformance` are generic — reuse the "home as an asset over time" section across every resort/subdivision LP (Broken Top, Caldera, Pronghorn, Tetherow Crossing). Pass the subdivision pattern.
4. **(optional) Hero-card address display** — currently strips the street number and shows "A home on <street>". Confirm that reads well; consider showing the year-over-year as a tiny sparkline per card.

---

## 5. CRITICAL process note — shared working tree
A **parallel session** is actively editing this repo (TC system, broker command center, brand-voice rework, homepage v6, trails DAL). Its uncommitted work lives in the same tree. This bit me twice this session:
- `lib/data/index.ts` is **shared** — the parallel session added `trails/getTrail*` exports referencing uncommitted files. Committing the working `index.ts` broke the pre-push typecheck. **Fix used:** stage a clean `index.ts` blob (origin + only your export) via `git hash-object -w` + `git update-index --cacheinfo`, leaving the working file (with their edits) untouched.
- The brand-voice baseline + scripts kept getting swept into commits. **Always** `git diff --cached --name-status` before committing; pathspec-scope every `git add`; never `git add -u` without a path; never `git add .`.
- `--no-verify` is BLOCKED by a hook guard — don't try it.

---

## 6. Memory to update
`project_heath_lp_charts` still says the chart is BROKEN. Update it: the chart is REPLACED by the server-rendered repeat-sales appreciation section (commit d3a4549a, live, verified). Keep the open items (golf/tax panel, SEO URL, templatize) from §4 above.

---

## 7. Verify it's live
```bash
curl -s -A "Mozilla/5.0 Chrome/137" https://ryan-realty.com/lp/tetherow/heath \
  | grep -o "How homes here have performed over time"   # heading present
```
Or open https://ryan-realty.com/lp/tetherow/heath and scroll to the "A long-term asset" section.
