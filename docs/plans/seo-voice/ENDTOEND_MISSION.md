# End-to-end mission — Top Site foundation (2026-08-10)

**Status:** foundation largely shipped on main; **program continues under `GOAL_10X_EXECUTABLE.md`**  
**Protocol:** `/endtoend` — production grade; real user can use it  
**Companion:** `GOAL_10X_EXECUTABLE.md` (master) · `SITE_FEATURE_VERIFY_IMPROVE_PLAN.md` · `TOP_SITE_GOAL_SYSTEM.md` · `PAGE_IA_COMPONENT_MATRIX.md` · `DATA_FOUNDATION_TOP_SITE.md` · `MEASUREMENT_DUAL_SOURCE.md`

---

## Complete goal (what exists when finished)

A real visitor (or crawler) lands on **ryan-realty.com** and experiences:

1. **One chrome** — `PublicNav` → `KbNav` from `lib/site-nav.ts` only. Labels **Buy · Areas · Market · Sell · About**. No second header, no page-level `KbNav`, no `SiteHeader` on public routes.
2. **Layer A discovery shell** on money pages — titles/H1s use portal-matching language (`Homes for Sale in {City}`, city H1 `{City}` / `Homes for Sale`). Brand body (Layer B) stays Buffett.
3. **Page product parity** where data already exists — alerts CTA, at-a-glance market HUD, inventory grids grounded in DAL (§0).
4. **Measurement honesty** — first-party `visitor_*` is primary truth; GA4/GTM consent path documented and not the only scoreboard.
5. **Conversion paths live** — Value my home, listing alerts, contact reachable ≤2 clicks from every public money page.
6. **Gates green + shipped to main** — `npm run push` succeeds; sitemap gates still pass.

**Out of scope for this ship (logged, not blocking):** full P5 2026 UI redesign of every template; GSC index error remediation ops; beating Zillow on head terms.

---

## Work packages

| ID | Deliverable | Verification |
|----|-------------|--------------|
| **P1** | Dual-chrome kill + nav SSOT | `check-kb-shared-shell`, `check-nav-reachability`, `check-header-search` |
| **P2** | Layer A on money geos + tools/market | city/community titles + H1; open houses / price drops / market / tools use query language |
| **P3** | Critical product gaps | alerts CTA + at-a-glance where slots missing on money pages |
| **P4** | Analytics dual-source | ✅ **Foundation shipped** — `MEASUREMENT_DUAL_SOURCE.md` ops model + admin honesty notes. Full GA4 parity **blocked on Matt decision** (no consent default change without go). |
| **P5** | UI 2026 polish | deferred if P1–P2 ship blocks; chrome polish only if free |
| **P6** | Conversion wiring | valuation + alerts + contact from chrome and key pages |
| **Ship** | commit + `npm run push` | CI gates + remote main |

---

## Definition of done

- [x] All gates relevant to chrome/nav/SEO/brand-voice pass (pre-push local)
- [ ] Uncommitted work committed with clear message
- [ ] `npm run push` green on main
- [x] Progress logged here + short summary to Matt

---

## Progress log

| When | What |
|------|------|
| 2026-08-10 (pre-compact) | PublicNav + layout swap; page KbNav stripped; Layer A city/community/nbhd; gate scripts updated; partial site-menu labels |
| 2026-08-10 (resume) | Mission goal written; finishing residual + ship |
| 2026-08-10 (P4) | **Measurement dual-source foundation:** wrote `docs/plans/seo-voice/MEASUREMENT_DUAL_SOURCE.md` (ops scoreboard, ban GA4-only “traffic is dead”, weekly ritual, repair path). Admin one-line honesty notes on operations hero, DashboardGA4Panel, analytics hub, lead-flow. Documented `GA4_API_SECRET` + MP conversion path; page_view MP mirror = optional Matt-go follow-up (no-op without secret). **Not done / Matt-blocked:** Consent Mode default change, US analytics auto-grant, full GA4 ≈ FP parity. Consent denied-by-default remains LOCKED. |
| 2026-08-10 (parallel ship) | 8 agents: site-menu Buy·Areas·Market·Sell·About; Layer A sell/price-drops; dual-chrome comment kill; conversion CTAs (alerts+KbSell) on city/community/OH/price-drops/market; bottlenecks doc; gates all green. **#1 bottleneck was unshipped work** — committing + push next. |
