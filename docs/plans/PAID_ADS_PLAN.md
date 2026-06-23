# Ryan Realty — Paid-Ads Plan (Meta-primary, seller-first)

**Created:** 2026-06-23. Synthesis of: deep research (104-agent, adversarially verified — 15 claims confirmed, 10 refuted), the ads-readiness codebase audit (8 LPs + capture path + tracking), and the per-broker attribution investigation. Supersedes ad-hoc ad plans.

> **Verified-only.** Every number here survived 3-vote adversarial verification. Numbers that were REFUTED and must NOT anchor the plan: "19%/15% lower CPL with CLO," "$21.98 avg CPL," "2-5% vs 10-15% conversion," "traffic qualifies 50-70%," "Custom Audiences bypass Housing," McGen "22% in 14 days." Don't cite them.

---

## 1. The strategic shape (what the research actually supports)

1. **Meta is primary. Run Lead-Conversion campaigns** (instant forms optimized for completions/booking), NOT Awareness or Traffic. Add **qualifier questions** to every instant form to fight junk leads. (high confidence, Meta-doc + 7-source consensus)
2. **"Housing" Special Ad Category is MANDATORY and load-bearing.** It strips age/gender/ZIP and protected-class targeting, and **limits lookalikes/saved audiences**. Account restriction/ad rejection if not declared. (high, Meta Ad Standards)
   - **Implication:** the consent-gated **13,900-homeowner Custom Audience** is the primary precision lever (Custom Audiences stay usable under Housing). **The 1% lookalike we just built may be Housing-LIMITED — must verify in Ads Manager before relying on it** (open decision #3). Custom Audiences do NOT "bypass" Housing — refuted.
3. **Pixel + CAPI + dedup is the tracking spine — and we already have it** (audit: 100% Pixel + CAPI coverage, shared `event_id` dedup). Pixel-only loses ~30-40% of conversions to ATT/ITP/ad-blockers; CAPI recovers ~10-25% of that. ✅ Already shipped.
4. **CRM→CAPI "qualified" quality loop (Conversion Leads Optimization):** fire a quality event back to Meta when a `crm_people` lead reaches a qualified stage, so Meta learns *which* leads convert. Right architecture to BUILD now — BUT needs **~50 qualified events / ad-set / week** to exit learning. At our volume (~1 buyer / 7 sellers per 60 days) it won't meaningfully optimize delivery yet. Build it; treat the efficiency gain as latent until volume scales. (high)
5. **Follow-up SPEED is the single highest-leverage lever.** Lead-to-client on paid is structurally tiny (**0.4-1.2%**), and speed dominates: 5-min vs 30-min response = **21× qualification odds**; **78% of buyers work with the first agent to respond** (MIT/Oldroyd, 15k leads). Every lead must hit `crm_people` + a human within **minutes**. (high)
6. **Model ROAS on lifetime commission, not in-window.** Median real-estate Meta in-window ROAS ~0.64 is an attribution artifact (closes happen offline weeks-months later; true ROAS rises ~6:1 over longer windows). **ROAS = cost-per-qualified-lead × close-rate × avg-commission**, full cycle. (medium)
7. **Custom LPs for high-intent/high-value; instant forms for top-of-funnel volume.** Use message-matched LPs (our seller/FSBO/expired pages, one goal each) for seller + home-valuation; instant forms for buyer-interest volume. (medium)
8. **CPL is rising (~$27.66, +21% YoY) and form quality falling** (US cross-industry, WordStream/LocaliQ). Budget for rising CPLs; lean on qualifier questions + the CAPI quality loop. (high)

---

## 2. Campaign architecture (concrete, seller-first)

**Special Ad Category = Housing on every campaign. US 15-mi min radius (Central Oregon).**

| # | Campaign | Objective | Audience (Housing-legal) | Destination |
|---|---|---|---|---|
| 1 | **Seller — Home Value** (flagship) | Lead-Conversion | 13,900 homeowner Custom Audience (+1% LAL *if eligible*) | Instant form w/ qualifiers, OR traffic → `/lp/seller-home-value` |
| 2 | **Expired / FSBO** | Lead-Conversion | Broad Central Oregon + interest layers (Housing limits apply) | `/lp/expired-listing`, `/lp/fsbo` (high-intent, custom LP) |
| 3 | **Buyer — Listing Alerts** (volume builder) | Lead-Conversion | Broad + lookalike (if eligible) | Instant form → also manufactures qualified events to make CLO viable |

- **Creative angles** (research + brand voice): show-don't-tell, a number beats an adjective. Seller: "What would your home bring today?" + a real local comp. Expired: the honest read. Avoid banned hype words.
- **Seller-first** because we already own the seller audience engine. Buyer runs partly to build event volume toward the CLO learning threshold.

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

## 6. Open decisions (need Matt — these shape execution, not blockers)

1. **Monthly ad budget?** Sets scale + whether we can reach the ~50-qualified-events/ad-set/week CLO threshold.
2. **Actual close rate + avg commission per qualified lead** (by source if known) — the missing inputs for the real ROAS model. (Trust `qualified_*` metrics; `new_leads` is import-polluted.)
3. **Verify in Ads Manager: is the 1% lookalike Housing-eligible?** If limited, the Custom Audience carries targeting alone.
4. **Google Search / PMax for high-intent seller capture** ("sell my house Bend", home-valuation queries) — research established Meta-primary but did not benchmark Google head-to-head for this market. Worth a test budget?

---

## 7. Sequenced roadmap

- **Phase 0 — DONE:** Meta Custom Audience live (13.9k, consent-gated, realtor-excluded) + lookalike; Pixel+CAPI verified 100%; buyer/expired native-fallback + broker-aware fallback shipped.
- **Phase 1 — Capture integrity (no new ad spend needed):** native fallback on contact/home-valuation/housing-market; invert FB webhook to native-first; CRM→CAPI qualified quality loop; expired `LandingPageTracker`; buyer LP `?v=` prefill.
- **Phase 2 — Per-broker enablement:** hidden-field FB routing + webhook parse; broker LP-URL generator; per-broker dashboard.
- **Phase 3 — Launch + measure:** seller-first campaigns under Housing; instant forms w/ qualifiers; measure **cost-per-qualified-lead** (not in-window ROAS); speed-to-lead < minutes; iterate.

**Guiding metric:** cost-per-**qualified**-lead and speed-to-first-touch — not clicks, not in-window ROAS.
