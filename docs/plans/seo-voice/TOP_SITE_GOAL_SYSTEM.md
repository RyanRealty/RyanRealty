# Top Real Estate Site — Unified Goal System

**Date:** 2026-08-10  
**Goal:** Make **ryan-realty.com** the top real-estate site *we can realistically own* for Central Oregon on four outcomes: **traffic · user experience · engagement · lead generation**.  
**Not the goal:** Beat Zillow nationally on “homes for sale.” That is a different product (portal scale). We win **hyperlocal + trust + product depth** where portals are shallow and local sites are thin.

**Matt locks already captured**

| Decision | Lock |
|----------|------|
| Nav top bar | **Buy · Areas · Market · Sell · About** |
| Lifestyle | Under **Areas** |
| Dual chrome | **Kill** — one public header |
| City H1 | **`{City}` + `Homes for Sale`** |
| Brand retained | **Navy `#102742` · cream `#faf8f4` · Amboqia display · Geist body** |
| Everything else UI | **2026-standard, hyper-engaging** (within brand) |

---

## 0. One scoreboard (four outcomes)

If a project does not move one of these, it is not priority.

| Outcome | North-star metric | Supporting metrics | Source of truth |
|---------|-------------------|--------------------|-----------------|
| **Traffic** | Organic sessions (real humans) + GSC clicks | Impressions, index coverage, branded vs non-branded queries | **GSC + first-party visitors** (not GA4 alone until fixed) |
| **UX** | Task success: find a home / get a value / contact | Core Web Vitals (LCP/INP/CLS), mobile scroll depth, zero double-nav | Web Vitals API + lab + first-party |
| **Engagement** | Engaged sessions (score > threshold) | Pages/session, time on market/city pages, video plays, map interactions | `visitor_sessions.engagement_score` |
| **Leads** | **Qualified lead events** | `generate_lead`, `valuation_requested`, tour/call events, CMA starts, LP form submits | CRM + GA4 key events + first-party |

**Definition of “top” for Ryan Realty (12-month):**

1. **#1 or #2 local organic** for money queries we can win:  
   `homes for sale {city}` long-tails, `{community} homes`, `{city} housing market`, `sell house bend`, broker-intent, lifestyle×homes.  
2. **Best on-site product** vs local brokerages (map + live data + CMA + one broker).  
3. **Highest engaged visit rate** among comparable local broker sites (first-party).  
4. **Highest lead volume and quality** from organic + owned (not only paid).

Portals still own pure head terms. We win **intent clusters + conversion**.

---

## 1. The system is six layers (one product)

Work any layer in isolation and the others break (we already proved this with voice vs SEO, and GA4 vs real traffic).

```
┌─────────────────────────────────────────────────────────────┐
│ L0  GOAL + SCOREBOARD (this doc)                            │
├─────────────────────────────────────────────────────────────┤
│ L1  DISCOVERY — SEO shell + LLM/AEO + sitemap + GSC         │
│     Layer A titles/H1s · schema · llms.txt · index health   │
├─────────────────────────────────────────────────────────────┤
│ L2  WAYFINDING — single nav IA + internal links             │
│     Buy · Areas · Market · Sell · About                     │
├─────────────────────────────────────────────────────────────┤
│ L3  PAGE PRODUCT — component matrix (parity + moat)         │
│     Stats · map · inventory · market · FAQ · broker · CMA   │
├─────────────────────────────────────────────────────────────┤
│ L4  EXPERIENCE — 2026 UI (brand colors/fonts LOCKED)        │
│     Motion · density · hierarchy · interaction · mobile     │
├─────────────────────────────────────────────────────────────┤
│ L5  MEASUREMENT — dual-source truth                         │
│     First-party primary · GA4 repaired · GSC weekly         │
├─────────────────────────────────────────────────────────────┤
│ L6  CONVERSION — paths to lead                              │
│     Value my home · alerts · contact · listing CTAs · LP    │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** A change in L4 (UI) may not break L1 (H1/title). A change in L1 may not invent numbers (§0). A change in L5 must not “fix” traffic by undercounting.

---

## 2. L1 — Discovery (traffic)

### 2.1 Layer A vs Layer B (voice + SEO)

| Layer | Surfaces | Rule |
|-------|----------|------|
| **A — Discovery shell** | `<title>`, meta, **H1**, first 1–2 sentences, FAQ questions, schema `name`, nav labels, `llms.txt` | Query language + place + property type + live number. Boring is correct. |
| **B — Brand body** | Sections under H1, CTAs, sell process, about, LP persuasion | Buffett: one person, plain facts, personality OK, no hype |

**City pattern (locked):**  
- Title: `Homes for Sale in {City}, Oregon | Ryan Realty`  
- H1: `{City}` / `Homes for Sale`  
- Lead: live count + median + days when real  

**Banned in Layer A:** “on the market now,” “the list,” “what will the payment be,” metaphor-only H1s.

### 2.2 Sitemap + GSC (do not break)

- Sitemap is **independent of nav** (`buildAllUrls` / `/sitemaps/{core,geo,listings,matrix,content}.xml`).  
- Gates: `ci:sitemap-resolvable`, `ci:sitemap-inventory-gate`.  
- GSC: property verified; index has **~9.2k URLs submitted**. Child sitemaps currently show **errors:1** on several classes — fix as ops, not by thinning the universe.  
- After major URL or template deploys: re-check live index + optional resubmit. **Never** delete geo/listing families from the sitemap to “clean” GSC.

### 2.3 Competitive traffic strategy

| Query class | Who wins today | Our play |
|-------------|----------------|----------|
| `homes for sale bend` | Portals | Exact-match H1 + live product; accept portal SERP dominance; win long-clicks via depth |
| `{neighborhood} homes` | Contestable | **Win** — polygon + inventory + local prose |
| `{city} housing market` | Contestable | **Win** — MoS methodology + charts + FAQ |
| `sell house bend` / valuation | Contestable | **Win** — fee transparency + CMA |
| Lifestyle (trails, parks) × homes | Weak locals | **Win** — content engine joins |

---

## 3. L2 — Wayfinding (UX + crawl paths)

**Single public chrome:** `PublicNav` → `KbNav` ← `lib/site-nav.ts`  

| Top item | Dest | Children include |
|----------|------|------------------|
| **Buy** | `/homes-for-sale` | map, open houses, price drops, luxury, compare, videos, alerts |
| **Areas** | `/area-guides` | cities, communities, schools, parks, **trails, events, venues, golf** |
| **Market** | `/housing-market` | reports, activity, months of supply, blog/FAQ/resources, **all calculators** |
| **Sell** | `/sell` | valuation form, our listings, motivated |
| **About** | `/about` | team, reviews, contact, join |

**Footer / Menu+** = denser projections of the same tree (no second IA).  
**No orphan money URLs.** Pulse, rental calculator, months-of-supply live under Market.

---

## 4. L3 — Page product (engagement + conversion)

Every public page is a **slot recipe** (see `PAGE_IA_COMPONENT_MATRIX.md`).

**Parity (must match portals/locals):** exact-match H1, live count, map, listing cards, related areas, open houses link, FAQ where relevant.  

**Moat (must beat them):**  
written CMA path · named broker · MoS methodology · GIS subdivisions · school/park/event ↔ homes · video · fee transparency · `llms.txt` + AI bots allowed · first-party CRM (not a lead marketplace).

**Page-family priority for “top site”:**  
1. City / neighborhood / community  
2. Search + listing detail  
3. Market reports  
4. Sell + valuation  
5. LPs (paid amplification of organic winners)  
6. Lifestyle entities (topical authority)

---

## 5. L4 — Experience UI (2026 standards, brand locked)

### 5.1 Locked (never “refresh” away)

| Token | Value |
|-------|--------|
| Navy | `#102742` |
| Cream | `#faf8f4` |
| Display | Amboqia Boriango (`--font-amboqia-safe`) |
| Body | Geist |
| Numerals | Tabular on every figure |
| Copy laws | §0 accuracy · Layer A/B · fair housing |

### 5.2 Free to modernize (2026 engagement bar)

Bring the **interface craft** to current top consumer products (Linear / Apple / modern editorial real estate), **without** purple gradients, Inter, or new brand colors.

| Technique | Apply to RR as |
|-----------|----------------|
| Clear visual hierarchy | One Amboqia moment per viewport; body stays Geist; size scale 12–14–16–20–28–40+ |
| Spatial confidence | Asymmetry, overlap, full-bleed photo moments, less equal-column card grids |
| Fluid motion | Hero load stagger; scroll-linked section reveals; 150–400ms ease; **prefers-reduced-motion** |
| High-quality hover/focus | Buttons, listing cards, map pins, nav panels — intentional, not default browser |
| Sticky smart chrome | Solid/blur nav on scroll; mobile sticky primary CTA on money pages |
| Dense data, light chrome | Market HUD / stats as “instrument panel,” not brochure fluff |
| Progressive disclosure | Filters, FAQs, plan comparison: reveal, don’t dump |
| Instant feedback | Search suggest, valuation form states, optimistic UI where safe |
| Touch targets | ≥44px mobile; one primary CTA per view |
| Performance as UX | LCP hero preloaded; maps/charts below fold; no layout thrash |

### 5.3 What “hyper engaging” is not

- Autoplaying noise, confetti, dark patterns  
- Fake urgency / fake social proof  
- Animation that delays data or H1  
- Redesigning fonts/colors “to feel modern”

### 5.4 UI rollout order (after L1–L2 stable)

1. **Global chrome** — PublicNav polish (blur, panels, mobile Menu+)  
2. **Homepage** — hero + towns + map rhythm  
3. **City template** — the money page  
4. **Listing detail** — conversion surface  
5. **Sell / valuation** — seller path  
6. **Market** — data theater done honestly  
7. **LPs** — paid acquisition creative surface  

Each step: lab CWV + first-party engagement + lead events before calling done.

---

## 6. L5 — Measurement (stop flying blind)

### 6.1 Proven split (2026-08-10 audit)

| Source | Yesterday-scale signal | Role |
|--------|------------------------|------|
| **First-party** `visitor_sessions` | ~3.7k sessions Aug 9; ~350 with engagement >1 | **Primary product truth** |
| **GSC** | ~14 clicks / ~842 impr Aug 8 | **Organic demand** |
| **GA4** | ~1–2 users same window | **Broken for ops** until repaired |

### 6.2 Dual-source operating model

| Question | Answer with |
|----------|-------------|
| Did people use the site? | First-party visitors admin |
| Is Google sending demand? | GSC |
| Are campaigns attributing? | GA4 + UTMs + first-party campaign fields |
| Are we getting leads? | CRM + key events |

### 6.3 GA4 repair (required for “top site” ops)

1. Tag Assistant cold session: confirm `G-ST40W4WM6T` + Consent Mode.  
2. Enable / verify **advanced consent modeling** in GA4.  
3. Product decision: **US analytics default-grant** (banner for marketing) *or* **server Measurement Protocol** from `/api/visitors/track` so GA4 ≈ first-party.  
4. Until fixed: **ban “traffic is dead” decisions based only on GA4.**

### 6.4 Weekly ops ritual (30 min)

1. GSC: clicks, impressions, top queries, coverage errors.  
2. First-party: sessions, engaged, top paths, LP landings.  
3. Leads: valuation / contact / alerts / CMA.  
4. CWV: any p75 regression.  
5. One ship that moves a scoreboard metric.

---

## 7. L6 — Conversion system (leads)

Every high-traffic template must expose **one primary and one secondary** path:

| Intent | Primary | Secondary |
|--------|---------|-----------|
| Buyer browsing | Search / map / alerts | Contact / schedule |
| Seller researching | **Value my home** (form page) | Sell plan / call |
| Market reader | Alerts / valuation | Full report share |
| Listing viewer | Contact / tour | Valuation of *their* home |
| LP paid | Form above fold | Phone |

**Lead quality rules:** consent-honest, no dark patterns, broker accountability in copy, fee facts on sell.

**Funnel metrics:** visit → engaged → form start → submit → CRM person → first touch.

---

## 8. Phased program (comprehensive, ordered)

Dependencies are intentional. Do not skip to UI polish while discovery/measurement are wrong.

| Phase | Name | Deliverables | Exit criteria |
|-------|------|--------------|---------------|
| **P0** | Stabilize truth | Dual-source dashboard note; GA4 undercount documented; stop bad decisions | Team uses first-party + GSC |
| **P1** | Wayfinding | Single nav tree live; dual chrome killed; gates green | Buy/Areas/Market/Sell/About on all public pages |
| **P2** | Discovery shell | Layer A restore geo + tools + market + sell; `ci:seo-shell` | City H1 = Homes for Sale; GSC sample titles correct |
| **P3** | Page product | Slot parity on city/nbh/community/listing/sell | Matrix P slots green on money pages |
| **P4** | Measurement repair | Consent or MP fix; GSC sitemap error triage | GA4 within ~2× of engaged first-party (not 100× off) |
| **P5** | UI 2026 | Chrome → home → city → listing → sell motion/layout | Engagement score ↑; CWV not worse |
| **P6** | Conversion lift | CTA hierarchy, form UX, LP alignment | Lead events ↑ at same or better quality |
| **P7** | Authority flywheel | Content engine depth, AEO FAQs, off-site citations | Non-brand organic + AI mentions |

**In flight already (repo):** nav SSOT rewrite, PublicNav, Layer A geo H1 restores, component matrix, analytics diagnosis. **Ship P1–P2 first**, then P4, then P5.

---

## 9. Guardrails (non-negotiable)

1. **§0** — no fake stats to fill UI.  
2. **Layer A** — never poetry-ize H1/title for “design.”  
3. **Brand** — navy/cream/Amboqia/Geist only.  
4. **Fair housing** — lifestyle copy describes places, not people.  
5. **Sitemap** — do not thin the universe for vanity GSC cleanliness.  
6. **Performance** — motion and imagery subordinate to LCP/INP.  
7. **One primary CTA** per view.  
8. **Gates** — nav-reachability, brand-voice, sitemap-resolvable, kb-shared-shell, CWV budgets.

---

## 10. 90-day success picture

If we execute P0–P6 with discipline:

| Outcome | 90-day target (directional) |
|---------|-----------------------------|
| Traffic | GSC clicks **↑** or stable with better query mix (more community/market/sell); first-party engaged sessions **↑** |
| UX | No double nav; LCP hero green on city/home; mobile task paths clear |
| Engagement | Higher % sessions with score >1; more multi-page city→listing→contact |
| Leads | More valuation + contact + alert submits from organic (not only paid LPs) |
| Measurement | GA4 usable again; weekly ritual running |

---

## 11. Related docs

| Doc | Role |
|-----|------|
| **`DATA_FOUNDATION_TOP_SITE.md`** | **DB + DAL map — every page slot must cite a real source** |
| `PAGE_IA_COMPONENT_MATRIX.md` | Nav diagnosis + component parity/moat matrix |
| `marketing_brain_skills/brand-voice/VOICE.md` | Layer A/B must be amended into this |
| `.claude/skills/frontend-design/SKILL.md` | UI craft inside locked brand |
| `docs/CONTENT_ENGINE_SPEC.md` | Entity/SEO content machine |
| `ADMIN_PRODUCT/data-atlas.md` | CRM process writer→reader chains |
| Admin visitors + GSC + CRM | Live scoreboard |

---

## 12. Immediate next execution (when you say go)

1. **Ship P1** — commit PublicNav + site-nav + gates (sitemap untouched).  
2. **Ship P2** — finish Layer A on remaining money templates.  
3. **Start P4** — GA4 dual-write or US analytics consent decision.  
4. **Then P5** — UI 2026 on chrome + homepage + city only (not whole site at once).

---

*This is the single goal document. SEO, voice, nav, page structure, analytics, sitemap/GSC, and UI modernization are not separate projects — they are layers of becoming the top local real-estate site on traffic, experience, engagement, and leads.*
