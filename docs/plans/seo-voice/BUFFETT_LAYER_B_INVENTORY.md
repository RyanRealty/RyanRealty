# Buffett Layer B body inventory (K1)

**Date:** 2026-08-10  
**Unit:** EXECUTION_QUEUE K1  
**Law:** Layer A (title / H1 / primary meta on money routes) is locked by `ci:seo-shell` and must not be “poetry-rewritten.” This inventory is **body copy only** (leads, section prose, FAQ answers, CTAs, empty states, tool explainers).

**K2 lock:** Do **not** re-sweep the four retired shape rules (aphorism pair, meaning-narration, sermon clause, obvious restatement) — `SESSION_INTENT_SSOT.md` / VOICE.md 2026-08-06.

**Exit for K1:** this inventory exists and is the worklist. **Not** rewriting all families in this unit.

---

## Status legend

| Tag | Meaning |
|-----|---------|
| **PASS-NEEDED** | Body still carries generic/AI-ish or thin prose; schedule a Layer B pass |
| **PARTIAL** | Some sections already Buffett-tight; residual spots remain |
| **LIGHT** | Thin surface (legal, auth, tool math); voice pass low leverage |
| **SKIP** | Account/dashboard/dev/signed-in utilities — not public SEO bodies |
| **DATA** | Body is mostly live numbers + labels; voice pass = methodology honesty only |

---

## Public `page.tsx` families (public site, not admin/api/dev)

### Money / conversion (highest leverage)

| Family | Routes (pattern) | Layer B status | Notes |
|--------|------------------|----------------|-------|
| Home | `/` | **PARTIAL** | Hero Layer A locked; body modules (about/sell/articles) still worth a pass |
| Search | `/search`, `/search/[...slug]`, `/homes-for-sale/*` | **PARTIAL** | Filter chrome + empty states; avoid shell poetry |
| Listing | `/listing/[listingKey]`, by-address/by-key | **PARTIAL** | Specs/history DATA; CTAs + restyle coach already shipping |
| City | `/cities/[slug]` | **PARTIAL** | Large KB body; Layer A H1 locked |
| Neighborhood | `/cities/[slug]/[neighborhoodSlug]` | **PARTIAL** | Boundary honesty + body depth |
| Community | `/communities/[slug]` | **PARTIAL** | Resort configs vary; research prose uneven |
| Sell | `/sell`, `/sell/valuation`, `/sell/[intent]` | **PARTIAL** | Form-first; residual process copy |
| Market hub | `/housing-market` | **PARTIAL** | FAQ cube-backed (M1); hub chrome residual |
| Market report | `/housing-market/[...slug]`, central-oregon, annual-review, reports/* | **DATA / PARTIAL** | Stats from pulse/mart; narrative blocks still PASS-NEEDED |
| Market history | `/housing-market/history` | **DATA** | Explorer UI |
| Open houses | `/open-houses`, `/open-houses/[city]` | **PARTIAL** | |
| Price drops | `/price-drops`, `/price-drops/[city]` | **PARTIAL** | |
| LPs | `/lp/*` | **PARTIAL** | Conversion gate exists; body still marketing-register risk |
| Buyer intent | `/buy`, `/buy/[intent]` | **PASS-NEEDED** | Intent pages often thinner |
| Luxury | `/luxury-homes-bend` | **PASS-NEEDED** | |
| Our homes | `/our-homes` | **PARTIAL** | Inventory list + chrome |
| Motivated | `/motivated-sellers`, `/[city]` | **PASS-NEEDED** | |
| Compare | `/compare` | **LIGHT** | Utility |

### Lifestyle (F04) — under Areas nav

| Family | Routes | Layer B status | Notes |
|--------|--------|----------------|-------|
| Parks index | `/parks` | **PARTIAL** | M3 homes cross-link present; card grid is name/meta |
| Park detail | `/parks/[slug]` | **PARTIAL** | Registry facts + nearby homes |
| Schools index/detail | `/schools`, `/schools/[slug]` | **PARTIAL** | Fair-housing safe (no school scores as marketing) |
| Trails | `/central-oregon/trails`, `/[slug]` | **PARTIAL** | |
| Events | `/central-oregon/events`, `/[slug]` | **PARTIAL** | |
| Venues | `/central-oregon/venues`, `/[slug]` | **PARTIAL** | |
| Golf detail | `/central-oregon/golf/[slug]` | **PARTIAL** | LP entry `/lp/central-oregon-golf` |

### Tools (F06)

| Family | Routes | Layer B status | Notes |
|--------|--------|----------------|-------|
| Mortgage calculator | `/tools/mortgage-calculator` | **LIGHT** | Defaults from `getCalculatorDefaults` (§0); explainer residual |
| Rental calculator | `/tools/rental-property-calculator` | **LIGHT** | FAQ + tool math |
| Appreciation | `/tools/appreciation` | **LIGHT** | Scenario rate labeled; not live market rate |
| Months of supply | `/months-of-supply` | **DATA / PARTIAL** | Methodology body |

### Content / AEO (F08)

| Family | Routes | Layer B status | Notes |
|--------|--------|----------------|-------|
| Blog index | `/blog` | **PARTIAL** | List chrome |
| Blog post | `/blog/[slug]` | **PASS-NEEDED** | DB HTML bodies — per-post voice; **market claims → cubes (M2)** for new market posts |
| FAQ index/detail | `/faq`, `/faq/[slug]` | **PARTIAL** | Static answers in `app/faq/data.ts` |
| Site index | `/site-index` | **LIGHT** | Directory |
| Resources | `/resources` | **PASS-NEEDED** | Link hub prose |
| Area guides / zip / oregon | `/area-guides`, `/zip/[zip]`, `/oregon/[city]` | **PASS-NEEDED** | Uneven depth |
| Subdivisions | `/subdivisions/[slug]` | **PARTIAL** | |
| Areas alias | `/areas/[slug]` | **PARTIAL** | |
| Activity / pulse / feed | `/activity`, `/pulse`, `/feed` | **DATA / LIGHT** | |
| Videos | `/videos` | **LIGHT** | |

### Trust (F09)

| Family | Routes | Layer B status | Notes |
|--------|--------|----------------|-------|
| About | `/about` | **PARTIAL** | Strong verified facts; residual polish |
| Team index/detail | `/team`, `/team/[slug]` | **PARTIAL** | Bios from brokers DAL |
| Reviews | `/reviews` | **LIGHT** | Verbatim Google quotes — do not rewrite |
| Contact | `/contact` | **LIGHT** | |
| Join | `/join` | **PASS-NEEDED** | Recruiting body |
| Marketing request | `/marketing/request` | **LIGHT** | Internal-ish |

### Auth & compliance (F12)

| Family | Routes | Layer B status | Notes |
|--------|--------|----------------|-------|
| Login / signup / forgot | `/login`, `/signup`, `/forgot-password` | **LIGHT** | |
| Auth error | `/auth-error` | **LIGHT** | |
| Privacy / terms / cookies | `/privacy`, `/terms`, `/cookies` | **LIGHT** | Legal accuracy > voice |
| DMCA / fair housing / a11y / data deletion | matching routes | **LIGHT** | |
| Unsubscribes | `/alerts/unsubscribe`, `/newsletter/unsubscribe` | **LIGHT** | |

### Account / dashboard (SKIP for public Layer B)

All `/account/*`, `/dashboard/*`, `/sign/[token]`, `/cma-drafts/*`, offline — **SKIP**.

---

## Suggested Layer B pass order (when grinding voice)

1. City + community residual bodies (organic + money)  
2. Listing residual CTAs / empty states (not shell)  
3. Sell + LP body register  
4. Market narrative blocks (cube-backed claims only)  
5. Lifestyle detail prose (fair-housing safe)  
6. Blog **new** posts via content engine (not mass rewrite of historical HTML)  
7. Tools explainers last (low SEO leverage)

---

## Explicit non-work for K1

- No mass rewrite of Layer A shells.  
- No re-enable of retired voice shape scanners (K2).  
- No inventing market stats in body rewrites (§0).  
- Reviews: quote verbatim only.

---

## Related

- `ci:seo-shell` — Layer A forever gate  
- `marketing_brain_skills/brand-voice/VOICE.md`  
- `SESSION_INTENT_SSOT.md` K2  
- M2: `scripts/analytics/content-market-claims.mjs` + market-report-blog Step 4a  
