# Ryan Realty — Paid-Ads Plan (Meta-primary, seller-first)

**Created:** 2026-06-23. Synthesis of: deep research (104-agent, adversarially verified — 15 claims confirmed, 10 refuted), the ads-readiness codebase audit (8 LPs + capture path + tracking), and the per-broker attribution investigation. Supersedes ad-hoc ad plans.

> **Verified-only.** Every number here survived 3-vote adversarial verification. Numbers that were REFUTED and must NOT anchor the plan: "19%/15% lower CPL with CLO," "$21.98 avg CPL," "2-5% vs 10-15% conversion," "traffic qualifies 50-70%," "Custom Audiences bypass Housing," McGen "22% in 14 days." Don't cite them.

---

## 1. The strategic shape (what the research actually supports)

1. **Meta is primary. Run Lead-Conversion campaigns** (instant forms optimized for completions/booking), NOT Awareness or Traffic. Add **qualifier questions** to every instant form to fight junk leads. (high confidence, Meta-doc + 7-source consensus)
2. **"Housing" Special Ad Category is MANDATORY and reshapes targeting** (decision #3, researched 2026-06-23 — see §8). It strips age/gender/ZIP and protected-class targeting. Account restriction/ad rejection if not declared. (high, Meta Ad Standards)
   - **Lookalike audiences are NOT usable for Housing** — confirmed across 5 sources (Special Ad Audiences, the old workaround, were also retired Aug 2022). **The 1% lookalike we built cannot target Housing ads.** It's not wasted (it's a CAPI signal + Google Customer-Match seed + non-Housing use), but cross it off the Meta-targeting plan.
   - **The 13,900 customer-file Custom Audience for Housing is CONTESTED** — real-estate practitioner sources say uploaded lists are still usable; others cite a Jan-2025 US restriction on customer-list audiences for HEC. **Matt must confirm in Ads Manager: set Special Ad Category = Housing, then check if "Ryan Realty CRM Leads" is selectable for inclusion** (2-min, authoritative). Plan assumes it MAY be unavailable.
   - **The Housing-legal precision levers (confirmed available):** retargeting / engagement Custom Audiences (LP visitors, video viewers, lead-form openers, page engagers), broad geo (city/region, 15-mi+ radius, no ZIP), interest targeting (Zillow, Apartments.com, home-improvement), and Advantage+ automated audience. **→ The customer file's biggest paid value shifts to Google Customer Match + retargeting-seed + CAPI, not Meta inclusion targeting.**
3. **Pixel + CAPI + dedup is the tracking spine — and we already have it** (audit: 100% Pixel + CAPI coverage, shared `event_id` dedup). Pixel-only loses ~30-40% of conversions to ATT/ITP/ad-blockers; CAPI recovers ~10-25% of that. ✅ Already shipped.
4. **CRM→CAPI "qualified" quality loop (Conversion Leads Optimization):** fire a quality event back to Meta when a `crm_people` lead reaches a qualified stage, so Meta learns *which* leads convert. Right architecture to BUILD now — BUT needs **~50 qualified events / ad-set / week** to exit learning. At our volume (~1 buyer / 7 sellers per 60 days) it won't meaningfully optimize delivery yet. Build it; treat the efficiency gain as latent until volume scales. (high)
5. **Follow-up SPEED is the single highest-leverage lever.** Lead-to-client on paid is structurally tiny (**0.4-1.2%**), and speed dominates: 5-min vs 30-min response = **21× qualification odds**; **78% of buyers work with the first agent to respond** (MIT/Oldroyd, 15k leads). Every lead must hit `crm_people` + a human within **minutes**. (high)
6. **Model ROAS on lifetime commission, not in-window.** Median real-estate Meta in-window ROAS ~0.64 is an attribution artifact (closes happen offline weeks-months later; true ROAS rises ~6:1 over longer windows). **ROAS = cost-per-qualified-lead × close-rate × avg-commission**, full cycle. (medium)
7. **Custom LPs for high-intent/high-value; instant forms for top-of-funnel volume.** Use message-matched LPs (our seller/FSBO/expired pages, one goal each) for seller + home-valuation; instant forms for buyer-interest volume. (medium)
8. **CPL is rising (~$27.66, +21% YoY) and form quality falling** (US cross-industry, WordStream/LocaliQ). Budget for rising CPLs; lean on qualifier questions + the CAPI quality loop. (high)

---

## 2. Campaign architecture — at $20/day (the prove-it phase)

**$20/day (~$600/mo) is ONE campaign, one ad set — not three.** Spreading it starves them all: Meta needs ~50 events/ad-set/week to exit learning, and at ~$28 CPL, $600/mo ≈ **~21 leads/mo total** — already below threshold. Run one thing well, prove lead quality + speed-to-close, then scale.

**Launch campaign: Seller — Home Value.**
- **Objective:** Lead-Conversion, instant form with 2-3 **qualifier questions** (fights junk). Special Ad Category = **Housing**. Central Oregon (Bend/Redmond, 15-mi+ radius, no ZIP).
- **Audience (Housing-legal only):** broad Central Oregon geo + **Advantage+** (Meta finds the seller within the geo), optional home-improvement/Zillow interest layer. **NOT the lookalike** (illegal under Housing). Customer file ONLY if Ads Manager confirms it's selectable (decision #3).
- **Destination — A/B:** (a) Meta **instant form** (cheapest CPL, fastest-to-CRM) vs (b) **traffic → `/lp/seller-home-value`** (higher intent, AND it builds a website-visitor retargeting audience that IS Housing-legal — the precision lever the customer file can't be).
- **Retargeting ad set** (once LP traffic accrues): website-visitor / lead-form-opener Custom Audience. This is the durable Housing-legal targeting asset — every traffic dollar seeds it.
- **Creative** (brand voice — show don't tell, a number beats an adjective): "What would your home bring today?" + a real recent local comp. No banned hype words.
- **Scale trigger:** once cost-per-qualified-lead is known and ≥1 deal is attributable, add Expired/FSBO + Buyer campaigns and lift budget.

### Budget & ROAS reality ($20/day, 2.5% commission)
- ~$600/mo ≈ **~21 leads/mo** at a ~$28 US benchmark CPL (refresh with actuals).
- One close at **2.5% commission** on a typical Central Oregon sale (~$700k illustrative — confirm actual avg) ≈ **~$17,500/side**.
- **Break-even ≈ ONE closed deal per ~29 months of spend** ($17,500 ÷ $600/mo). Even an extremely low close rate is profitable — this is **NOT a ROAS-risk play, it's a volume/learning + lead-quality play.**
- **Ignore in-window ROAS.** Track **cost-per-QUALIFIED-lead** and **speed-to-first-touch**; the per-close commission carries the economics.
- **The real risk is volume** (~21 leads/mo is below Meta's learning threshold → delivery won't self-optimize), which is why creative + speed-to-lead + a single tight campaign matter more than algorithm tricks at this budget.

### Google — parallel test (decision #4: yes)
Run a small **Google Search** test alongside Meta for **high-intent seller capture** Meta literally cannot target under Housing: queries like *"sell my house Bend"*, *"home value Bend OR"*, *"what's my home worth"*. Search catches active intent; Meta catches interrupt-demand. Google also has its own Housing restrictions (confirm Customer Match eligibility), but Search-by-keyword intent is the gap Meta's Housing rules leave wide open. Point these ads at `/lp/seller-home-value?agent=<broker>` so attribution + per-broker routing carry over. Keep it small ($5-10/day) until cost-per-qualified-lead is comparable.

---

## 3. Landing pages — rebuild for message match (audit-grounded)

The 5 Tier-1 LPs already have single conversion goals + KB design + Pixel/CAPI. Targeted fixes:

- **Match each ad to its LP** (seller ad → seller LP, expired ad → expired LP). One ad : one LP : one goal.
- **DO NOT point ads at the SEO hubs** `/lp/bend`, `/lp/central-oregon-golf` — dual CTAs, no form, decision paralysis. Organic only.
- **Cold-traffic friction:** the seller/expired LPs use 2-step forms (address → contact). Fine for warm/BOFU; for cold paid traffic, A/B a **single-step address-first** variant.
- **`/lp/expired-listing` is missing `LandingPageTracker`** → no page-view event for ads. Add it.
- **`/lp/buyer-listing-alerts` ignores URL params** → can't prefill/message-match from ad creative. Add `?v=` variant support like the seller LPs.

---

## 4. Lead capture — verify end-to-end (the "CRM captures correctly" deliverable)

**✅ Shipped this session:** buyer + expired LPs now have native-CRM fallback (were FUB-only → would lose every lead on FUB cutover); native fallback routes to the agent-attributed broker (commit `dfa64e40`).

**⬜ Remaining capture gaps (from the audit — same fix pattern):**
- `/contact`, `/home-valuation`, `/housing-market/[slug]` are still **FUB-only** → lose leads on cutover. Add `ensureNativeLead` fallback (housing-market also drops UTM/attribution — add it).
- **FB lead webhook is FUB-first-then-mirror** → orphans the lead if FUB fails. **Invert to native-first, then push FUB.**

**⬜ Close the attribution loop (research deliverable #4):** wire `crm_people` qualified-stage changes to fire a **CAPI "qualified" quality event** back to Meta (Conversion Leads). Build now; latent until volume.

---

## 5. Per-broker ads (Matt's requirement — answered)

**Goal: each broker runs the same creative; their ads funnel leads to them.**

- **Traffic-to-LP ads: WORKS TODAY.** `ryan-realty.com/lp/<page>?agent=rebecca` → `rr_agent_attribution` cookie → LP form assigns the lead to that broker → flows to `crm_people.assigned_broker`. Verified end-to-end for seller/buyer/expired/FSBO.
- **FB lead-form ads: NO per-broker routing today** (server-to-server, no cookie → all default to Matt). **Fix: add a hidden `assigned_broker` field per broker's form**; the webhook parses `field_data` and routes. (Alternatives: per-broker FB Pages via `page_id`, or campaign-name convention — hidden field is the best effort/robustness tradeoff.)
- **Self-serve, to build:**
  1. **Broker LP-URL generator** (`/admin/broker-links`) — a broker picks a page + their name, gets `?agent=` URLs + QR codes. (~1-2h)
  2. **FB lead-form setup runbook** per broker (the hidden-field convention). (~1h)
  3. **Per-broker conversion dashboard** (`marketing_assignments` by broker × source). (~2h)
  4. FUB smart lists by broker (FUB UI, Matt — 30 min) — moot post-cutover.

---

## 6. Decisions — RESOLVED 2026-06-23

1. **Budget: $20/day (~$600/mo)** until results show → ONE campaign (§2), prove-it phase, below Meta's learning threshold by design.
2. **Avg commission 2.5%** (~$17.5k/side on a ~$700k sale); **close rate unknown** → track cost-per-qualified-lead + actual closes. Commission math: break-even ≈ 1 deal / ~29 months, so economics are safe; volume is the constraint.
3. **Housing audience — RESEARCHED (§8): lookalike is OUT for Housing; customer-file is CONTESTED → Matt confirms in Ads Manager.** Precision lever shifts to retargeting + broad geo + Advantage+.
4. **Google: YES** — small parallel Search test for high-intent seller queries (§2 "Google — parallel test").

**Still useful to confirm when convenient:** actual avg sale price (for the ROAS model) and whether the customer-file audience is selectable under Housing in Ads Manager.

---

## 7. Sequenced roadmap

- **Phase 0 — DONE:** Meta Custom Audience live (13.9k, consent-gated, realtor-excluded) + lookalike; Pixel+CAPI verified 100%; buyer/expired native-fallback + broker-aware fallback shipped.
- **Phase 1 — Capture integrity (no new ad spend needed):** native fallback on contact/home-valuation/housing-market; invert FB webhook to native-first; CRM→CAPI qualified quality loop; expired `LandingPageTracker`; buyer LP `?v=` prefill.
- **Phase 2 — Per-broker enablement:** hidden-field FB routing + webhook parse; broker LP-URL generator; per-broker dashboard.
- **Phase 3 — Launch + measure:** seller-first campaigns under Housing; instant forms w/ qualifiers; measure **cost-per-qualified-lead** (not in-window ROAS); speed-to-lead < minutes; iterate.

**Guiding metric:** cost-per-**qualified**-lead and speed-to-first-touch — not clicks, not in-window ROAS.

---

## 8. Housing-category audience research (decision #3, 2026-06-23)

Researched because the first-pass research said "Custom Audiences stay usable under Housing" but other sources flagged a Jan-2025 restriction. Findings across 5 sources:

- **Lookalike audiences: NOT usable for Housing — unanimous.** "Lookalikes: Not available for Special Ad Category campaigns." Special Ad Audiences (the 2019-2022 workaround) stopped accepting new creation **Aug 25, 2022** and are deprecated for HEC. → **The 1% lookalike we built can't target Housing ads.**
- **Customer-file (uploaded list) Custom Audiences: CONTESTED.** A real-estate-specific source still recommends uploading lists ("past clients, leads, or email subscribers"); others cite a **Jan-2025 US restriction on customer-list audiences for housing/employment/credit.** No primary Meta doc reachable (JS-gated). → **Authoritative check = Ads Manager:** set Special Ad Category = Housing, open the audience selector, see if "Ryan Realty CRM Leads" is selectable for inclusion. Plan assumes it may be unavailable.
- **Confirmed Housing-legal:** retargeting/engagement Custom Audiences (LP visitors, video viewers, lead-form openers, page engagers), broad geo (city/region, 15-mi+ radius, no ZIP), interest targeting, Advantage+ automated audience.
- **So:** the customer file's paid value shifts off Meta inclusion-targeting and onto Google Customer Match + retargeting-seed + the CAPI quality signal. The Meta precision lever becomes **retargeting people who hit the LPs** — which is why driving LP traffic (vs instant forms only) compounds.

Sources: [agencyfifty3](https://agencyfifty3.com/blog/facebook-is-removing-one-of-its-key-audiences-for-use-in-housing-campaigns/) · [adamigo](https://www.adamigo.ai/blog/meta-housing-ads-policy-real-estate-compliance-tips) · [leadenforce](https://leadenforce.com/blog/special-ad-category-audience-tips-for-real-estate-credit-and-employment-ads) · [jonloomer](https://www.jonloomer.com/special-ad-audiences-going-away-for-facebook-targeting/) · Meta Business Help Center 2220749868045706 (primary, JS-gated — confirm in-platform).
