# Bottlenecks & Fixes — Top Local RE Site

**Date:** 2026-08-10  
**Scope:** What blocks **ryan-realty.com** from being the top *local hyperlocal* Central Oregon RE site on **traffic · UX · engagement · qualified leads**.  
**Sources:** `TOP_SITE_GOAL_SYSTEM.md`, `PAGE_IA_COMPONENT_MATRIX.md`, `DATA_FOUNDATION_TOP_SITE.md`, `ENDTOEND_MISSION.md`, live code (`lib/site-nav.ts`, `PublicNav`, `layout`, gates, GA/consent), data probe (alerts/GA4/visitor split).  
**Rule:** Warehouse is already portal-class. Bottleneck is **packaging · discovery · wayfinding · conversion · measurement** — not “more MLS.”

---

## 0. Executive picture

| Already strong | Currently weak |
|----------------|----------------|
| ~595k listings, live pulse, activity, geo snapshots, CMA (271), blog GSC winners | Dual-path chrome legacy + unshipped nav work |
| First-party `visitor_*` (~3.7k sessions/day-scale) | GA4 ~1–2 users same window (broken scoreboard) |
| Layer A restore started on city/community/nbhd | Sell / home / some market H1s still poetry |
| Buy · Areas · Market · Sell · About SSOT in `site-nav` | Conversion sinks cold (`listing_alerts` = 6, `saved_searches` = 2) |
| Brand locked (navy/cream/Amboqia/Geist) | Temptation to “refresh brand” or thin sitemap for GSC vanity |

**One line:** Stop inventing features and data; **ship P1–P2**, fix the scoreboard story, put alerts/CMA in the path of traffic, finish Layer A on money templates.

---

## 1. Ranked bottlenecks (severity × ease)

Score: **Impact** (traffic/UX/leads/measurement) × **Ease** (can ship this week without Matt/legal/schema). Higher rank = fix first.

| Rank | Bottleneck | Severity | Ease | Score | Layer |
|-----:|------------|----------|------|-------|-------|
| **1** | **Unshipped dual-chrome + Layer A mass** — work exists in tree but mission incomplete until commit + `npm run push` | Critical | Easy–Med | ★★★★★ | L1–L2 |
| **2** | **Wrong scoreboard (GA4-only ops)** — GA4 ≪ first-party; decisions read “traffic is dead” | Critical | Easy (process) / Hard (repair) | ★★★★★ | L5 |
| **3** | **Layer A incomplete on non-geo money pages** — sell, homepage hero defaults, city market H1s, residual poetry | High | Easy–Med | ★★★★☆ | L1 |
| **4** | **Conversion product cold** — alerts/saved search near-zero; traffic not absorbed | High | Med | ★★★★☆ | L6 |
| **5** | **Chrome dual-path residue** — `PublicNav` live, but `HideChrome` / `chrome-routes` / dead `SiteHeader` / `site-menu` still second IA surfaces | High | Med | ★★★★ | L2 |
| **6** | **Page-product slot gaps** — alerts CTA, standardized at-a-glance, FAQ Layer A questions inconsistent | High | Med | ★★★☆ | L3 |
| **7** | **Internal link / IA density** — orphans historically (pulse, rental calc, MoS); menu vs top-bar projections can drift | Med | Easy | ★★★☆ | L2 |
| **8** | **GSC child-sitemap errors / cold latency** — index health noise; temptation to thin universe | Med | Ops | ★★☆ | L1 |
| **9** | **Engagement under-instrumented for product decisions** — first-party rich but not weekly ritual | Med | Easy (ops) | ★★☆ | L5 |
| **10** | **2026 UI polish deferred too early or started too soon** — either stalling engagement or re-breaking H1s | Med | High risk if early | ★★ | L4 |
| **11** | **Authority / HOA facts unstructured** — GSC winners need sourced facts not MLS | Med–High long | Hard (content) | ★★ | L7 |
| **12** | **Brand-voice gate over-applied to Layer A** historically — poetry-killing SEO; gate green ≠ titles match queries | High (historical) | Policy + code | ★★★★ | L1 |

---

## 2. Owner class: code-now vs Matt vs ops

### 2.1 Code-fixable NOW (no Matt decision required)

| # | Work | Files / surface | Exit |
|---|------|-----------------|------|
| A | **Commit + push P1–P2** | PublicNav, `lib/site-nav.ts`, city/community H1s, `check-kb-shared-shell`, nav gates | `npm run push` green; live single Buy/Areas/Market/Sell/About bar |
| B | **Finish residual dual chrome** | Remove page-level `KbNav` if any remain; no `SiteHeader` in root layout (already); stop reintroducing dual mount | `check-kb-shared-shell` green; no double `<header>` in e2e |
| C | **Layer A money templates** | Sell H1 → sell intent language; homepage: Layer A vs Buffett default is **product** but geo money pages must stay exact-match; market city H1s `{City} Housing Market`; open houses / price drops already closer | Sample titles/H1s match portal language |
| D | **site-menu as projection** | `lib/site-menu.ts` must not re-author a second IA; top labels already Buy·Areas·… — enforce order + children mirror `KB_TOP_NAV` or derive | One tree, two views |
| E | **Alerts CTA on city / search / price-drops** | Wire existing `/lp/buyer-listing-alerts` or form into money templates (data exists) | Alert enrollments leave single digits |
| F | **Scoreboard docs + admin copy** | Document “primary = visitor_* + GSC; GA4 secondary until repaired” in ops-facing surfaces | Stop GA4-only panic |
| G | **Gate clarity for Layer A** | Prefer explicit SEO shell checks over voice regex fighting exact-match titles; brand-voice must not ban “Homes for Sale” | `ci:brand-voice` green *with* Layer A intact |

### 2.2 Matt decisions (block full P4 / some L6)

| Decision | Options | Why it blocks |
|----------|---------|---------------|
| **GA4 consent model** | (1) US analytics **default-grant** for analytics_storage + banner for marketing, or (2) **server Measurement Protocol** dual-write from `/api/visitors/track` so GA4 ≈ first-party | Today Consent Mode defaults all analytics to **denied** until cookie accept → GA4 near-zero vs real traffic |
| **Homepage H1 strategy** | Keep Buffett “MLS list…” (Layer B-forward home) vs exact-match “Central Oregon Homes for Sale” (max discovery) | Affects brand moment vs head-term play; city pages already locked |
| **Alerts product path** | Keep LP-only vs in-product enroll on search/city without full account | Determines conversion UX |
| **P5 UI scope** | Chrome-only polish now vs full city redesign after ship | Avoid re-breaking Layer A mid-mission |

### 2.3 Ops (not a code PR)

| Work | Notes |
|------|--------|
| **GSC weekly ritual** | Clicks, impressions, coverage; child sitemap `errors:1` triage — warm/fix generators, **do not delete geo/listing families** |
| **First-party visitors admin** | Weekly: sessions, engaged, top paths, LP landings |
| **Lead ritual** | Valuations, contact, alerts, CMA counts |
| **Tag Assistant / GA4** | Verify `G-ST40W4WM6T` + Consent Mode after Matt picks repair path |
| **Advanced consent modeling** | Enable in GA4 UI when consent path is intentional |

---

## 3. Explicit bad decisions & drift

These are the mistakes that created the current lag — name them so we stop replaying them.

### 3.1 Dual chrome (architectural)

- **What:** Parallel trees (`PRIMARY_NAV` mega / `KB_*`) + parallel headers (`SiteHeader` vs `KbNav`) + CSS dual path (`HideChrome` / `shouldHideDefaultChrome` hiding a header that sometimes still shipped in RSC).
- **Why bad:** Double nav, inconsistent labels (Homes vs Buy, Guides junk drawer), reachability gate stuffed mega-menus, Matt-visible UX failures.
- **Status 2026-08-10:** **Root layout mounts only `PublicNav` → `KbNav`.** Gate `check-kb-shared-shell` forbids page-level `KbNav` and layout `SiteHeader`. **Residual drift:** dead `SiteHeader`/`site-menu` mega stack still in repo; comments/docs still describe HideChrome as primary public path; `chrome-routes` still models “default chrome vs KB” as if dual product lives.

### 3.2 Poetry / personality H1s (SEO)

- **What:** Voice pass rewrote discovery shell into Buffett body language (`titleTop`/`titleBottom` like “Your price, and every comp behind it,” homepage default “The MLS list, and what it sold for,” sell/market personality).
- **Why bad:** Nobody searches those strings. Portals win SERP with **Homes for Sale / Housing Market**. Layer A was defined to stop this; brand-voice green ≠ SEO healthy.
- **Status:** City/community/nbhd/subdivision largely restored to **Homes for Sale**. Sell, homepage defaults, some market/lifestyle heroes still Layer-B-as-H1.

### 3.3 GA4 as sole scoreboard

- **What:** Ops/brain loops treat GA4 as traffic truth.
- **Why bad:** Audit: first-party ~3.7k sessions vs GA4 ~1–2 users. Consent Mode default-denied + blockers → undercount. Yields wrong priorities (“site is dead”) and kills investment in winners.
- **Status:** Consent Mode v2 **correctly implemented** for compliance (defaults denied, update on banner) — but **compliance correctness ≠ measurement adequacy** for a US brokerage ops dashboard.

### 3.4 site-menu order / second IA authoring

- **What:** `lib/site-menu.ts` re-authors columns (and historically Homes · Sell · Market · Guides) while `lib/site-nav.ts` is SSOT.
- **Why bad:** Labels and grouping drift; engineers “fix nav” in the wrong file; Menu+ vs desktop disagree.
- **Status:** Top-level order comment says Buy · Areas · Market · Sell · About — **good** — but file is still a **hand-authored parallel tree**, not a pure projection of `KB_TOP_NAV`.

### 3.5 HideChrome dual path complexity

- **What:** CSS `display:none` gates around default chrome to avoid hydration double-nav, while pages also self-mount KB chrome.
- **Why bad:** Two mental models (“hide default” vs “one public nav”). After PublicNav-only layout, much of this is **dead complexity** that future PRs will re-break if not retired carefully.
- **Status:** PublicNav self-hides on LP/admin/sign/account; HideChrome remains for legacy/footer/legal paths and muscle memory.

### 3.6 Conversion infrastructure without product surface

- **What:** Full CRM, LPs, `listing_alerts` table, CMA pipeline — **6 alert rows, 2 saved searches**.
- **Why bad:** Traffic + inventory moat without capture = portal-adjacent brochure. Data foundation already flags this as conversion gold unused.

### 3.7 Sitemap vanity thinning (temptation, not always shipped)

- **What:** React to GSC errors by removing URL classes.
- **Why bad:** Destroys indexation of inventory/geo long-tail; sitemap is independent of nav on purpose.

### 3.8 Invented stats / HOA theater

- **What:** Filling layouts with numbers not from pulse/snapshot/activity.
- **Why bad:** §0 and fair-housing risk; destroys trust moat vs portals.

### 3.9 Brand “refresh” as engagement strategy

- **What:** New fonts/colors/gradients “to feel 2026.”
- **Why bad:** Matt lock: navy `#102742`, cream `#faf8f4`, Amboqia + Geist. Engagement comes from hierarchy/motion/data theater **inside** brand.

### 3.10 Gates that over-constrain Layer A

- **What:** Brand-voice / construction bans that historically flattened SEO titles and drama-swept useful H1s into beige or poetry extremes.
- **Why bad:** Layer A needs **boring query language**. Voice rules belong primarily under H1 (Layer B). Title/H1/meta must stay portal-match; body stays Buffett.
- **Status:** City H1 restore + brand-voice gate green is the correct reconciliation — **encode it** so the next voice pass cannot re-poetry money pages.

---

## 4. Recommended kill list (this mission)

Actionable, ordered. Do these; log and stop.

### K1 — Ship the dual-chrome kill (P1)

1. Ensure root `app/layout.tsx` only mounts `<PublicNav />` (done in tree).  
2. Zero page-level `<KbNav>` on `.kb-root` pages (`check-kb-shared-shell`).  
3. No layout `<SiteHeader />`.  
4. Confirm top bar labels: **Buy · Areas · Market · Sell · About** from `lib/site-nav.ts`.  
5. **Commit + `npm run push`.** Unshipped work is not a top site.

### K2 — Finish Layer A on remaining money surfaces (P2)

| Surface | Target Layer A |
|---------|----------------|
| `/cities/*`, `/communities/*`, nbhd, subdivision | **Keep** `{Place} / Homes for Sale` + matching titles |
| City housing market | `{City} Housing Market` (not “market report” poetry only) |
| `/sell` | Sell-intent H1 (e.g. sell your home / Bend sellers) — comps line can stay lead, not H1 |
| Open houses / price drops | Keep calendar / price-drop language (already closer) |
| Tools | Query language H1s (mortgage, rental, MoS) |
| Homepage | **Matt decision** if changing; do not block geo ship |

**Banned in Layer A:** “on the market now,” “the list,” metaphor-only H1s, drama headers.

### K3 — Stop GA4-only decisions (P0 process, now)

1. Primary: **GSC + visitor_sessions**.  
2. Leads: CRM + form events.  
3. GA4: campaigns only until Matt picks consent or MP dual-write.  
4. Explicit ban: “traffic is dead” from GA4 alone.

### K4 — Put alerts in the path of inventory traffic (P6 slice)

1. City + search + price-drops: primary or secondary CTA → listing alerts.  
2. Measure enrollments in `listing_alerts` (leave 6 → tens/hundreds).  
3. Do not build a new warehouse — wire existing LP/action.

### K5 — Collapse site-menu / mega into projections (P1 residual)

1. Either derive `MENU` from `KB_TOP_NAV` or gate that top-level order and core hrefs match.  
2. Delete or quarantine dead `SiteHeader` mega path once no public route imports it.  
3. Footer = denser same tree (`KB_FOOTER_COLUMNS` already).

### K6 — Measurement repair path (P4 — after Matt)

1. Tag Assistant cold session.  
2. Choose: default-grant analytics US **or** Measurement Protocol from first-party track.  
3. Success: GA4 within ~2× of engaged first-party, not 100–1000× off.

### K7 — GSC hygiene without thinning (ops)

1. Fix child sitemap generation reliability / warm cron.  
2. Re-check coverage after major deploys.  
3. **Never** drop geo/listing families to clear vanity errors.

### K8 — Page product parity on city only (P3 thin slice)

1. At-a-glance from pulse (active, median, DOM, MoS) standardized.  
2. Map + inventory + related areas + FAQ with Layer A questions.  
3. Alerts + Value my home reachable ≤2 clicks.

### Explicitly defer (not kills for this mission)

- Full P5 2026 redesign of every template.  
- National portal head-term war.  
- Mass community pages for all 1,848 MLS community names.  
- HOA structured DB until curated facts exist.  
- Brand color/font change.

---

## 5. What NOT to do

| Do not | Why |
|--------|-----|
| **Thin the sitemap** for cleaner GSC error counts | Destroys long-tail indexation; sitemap ≠ nav |
| **Invent inventory/medians/HOA/crime stats** to fill UI | §0, fair housing, trust moat death |
| **Change brand** (navy/cream/Amboqia/Geist) | Matt lock; not the engagement bottleneck |
| **Re-mount page-level KbNav or SiteHeader on public routes** | Dual chrome regression |
| **Poetry-ize Layer A** for design or voice purity | Ranking + LLM extract loss |
| **Use GA4 alone** to kill projects or declare traffic dead | Undercount by orders of magnitude |
| **Mass-generate 1,848 community pages** | Product/SEO thin content disaster |
| **Skip ship** for more redesign | Uncommitted P1–P2 is the #1 bottleneck |
| **Autoplay noise / fake urgency / confetti** | Anti-moat; fair housing adjacent risk |
| **Cache empty pulse as truth** | Poison-null; wrong Layer A numbers |
| **Put ad LPs in primary nav** except deliberate experiments | Scent/conversion confusion |
| **Beat Zillow on head terms as success criterion** | Wrong product; win long-tail + conversion |

---

## 6. Evidence snapshots (2026-08-10)

### 6.1 Architecture (code)

| Claim | Evidence |
|-------|----------|
| Single public header intent | `PublicNav` → `KbNav`; `app/layout.tsx` comment + mount |
| SSOT IA | `lib/site-nav.ts` `KB_TOP_NAV` Buy·Areas·Market·Sell·About |
| Dual-chrome gate | `scripts/check-kb-shared-shell.mjs` forbids page KbNav + layout SiteHeader |
| Residual dual path | `HideChrome` + `lib/site/chrome-routes.ts` still encode “default vs KB”; `SiteHeader.tsx` still present; `site-menu.ts` hand-authored MENU |
| GA consent default denied | `GoogleAnalytics.tsx` Consent Mode v2 defaults; `CookieConsentBanner` analytics only after accept (ad traffic auto-grant exception) |
| City Layer A | `app/cities/[slug]/page.tsx` title `Homes for Sale in {City}` + `titleBottom="Homes for Sale"` |
| Sell still poetry H1 | `app/sell/page.tsx` “Your price, and every comp behind it.” |
| Homepage hero default | `KbHero` defaults “The MLS list, and what it sold for.” |

### 6.2 Data (probe)

| Asset | Signal | Bottleneck type |
|-------|--------|-----------------|
| Active inventory | ~7.6k | Not the bottleneck |
| Pulse geos | 45 | Surface in Layer A |
| `listing_alerts` | **6** | Conversion |
| `saved_searches` | **2** | Conversion |
| `visitor_sessions` | ~69k cumulative; ~3.7k/day-scale | Measurement truth |
| GA4 | ~1–2 users same window | Measurement lie if sole scoreboard |
| Blog | 87; GSC click leaders | Invest Layer A + internal links |

---

## 7. Mission kill order (one week)

```
Day 0–1  K1 Ship P1 (nav/chrome) — commit + push
Day 1–2  K2 Layer A remaining money pages
Day 2    K3 Scoreboard process lock (first-party + GSC)
Day 2–3  K5 site-menu projection / dead chrome cleanup
Day 3–4  K4 Alerts CTA on city + search + price drops
Day 4+   K8 City slot parity (thin)
Ops      K7 GSC child sitemaps (no thinning)
Matt     K6 GA4 repair choice → implement
```

**Done when:** real visitor sees one nav, money geos have portal-match H1s, gates green on main, ops uses dual-source scoreboard, alert enrollments moving, no one plans brand recolor or sitemap amputation.

---

## 8. Related docs

| Doc | Role |
|-----|------|
| `TOP_SITE_GOAL_SYSTEM.md` | Outcomes, layers, phases |
| `PAGE_IA_COMPONENT_MATRIX.md` | Nav diagnosis + slot parity |
| `DATA_FOUNDATION_TOP_SITE.md` | What data exists / underused |
| `ENDTOEND_MISSION.md` | Execution packages P1–P6 |
| `marketing_brain_skills/brand-voice/VOICE.md` | Layer B; must not own Layer A titles |

---

*Architecture diagnosis only. No application code changes in this pass — this file is the bottleneck SSOT for the top-site mission.*
