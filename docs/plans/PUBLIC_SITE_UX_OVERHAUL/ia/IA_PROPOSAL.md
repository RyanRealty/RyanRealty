# IA reimagine — options + recommendation (P4)

**Date:** 2026-08-11  
**Brand lock:** navy/cream + Amboqia/Geist only  
**Input:** Journey A/B/C fails/partials, PAGE_LEDGER, conversion map

---

## Option 1 — Journey-first (RECOMMENDED)

**Top bar (5):** Buy · Areas · Market · Sell · About  

| Item | Hub job | Children (tight) |
|---|---|---|
| **Buy** | Start find | All homes (map), Open houses, Price drops, Luxury, Alerts, Saved (account) |
| **Areas** | Place discovery | Cities index, top cities, Communities, Schools, Parks, Lifestyle |
| **Market** | Truth | Market overview, Reports, Activity, Tools (mortgage/rent/appreciate) |
| **Sell** | Value → list | Sell home, Home value, Our listings, Sell on a deadline |
| **About** | Trust | About, Team, Reviews, Contact, Join |

**Mobile tabs (5):** Buy · Areas · Sell · Saved · More  

**Rules:**
- Logo → home (buy-biased orientation, sell affordance in chrome).  
- `/buy` becomes a thin gateway into Buy hub (or redirects to `/homes-for-sale` with service modules below).  
- Lifestyle under Areas only (not top-level sprawl).  
- Cut or redirect low-value orphans listed in `CUT_LIST.md`.  
- Reachability: ≤2 interactions to any P0/P1 destination.

**Why this wins:** Matches journeys; closest to current `lib/site-nav.ts` lock (2026-08-10) so equity/redirects stay sane; still allows full visual reimagine.

---

## Option 2 — Search-first portal

Top: Search field always · Buy · Sell · Market · About  
Home is almost entirely search + map. Areas folded into search facets.

**Pros:** Portal competitive. **Cons:** Weakens geo SEO hubs and brokerage story; larger redirect blast.

---

## Option 3 — Brokerage-first

Top: About · Buy · Sell · Market · Contact  
Emphasizes trust over inventory.

**Pros:** Differentiation narrative. **Cons:** Fights how buyers actually arrive (homes queries); worse for conversion.

---

## Working lock

**Adopt Option 1 (Journey-first)** as working IA lock for execution.  
Matt may veto by writing an alternative in `decisions.md`.

## Cut list (draft — finalize at P8)

See `CUT_LIST.md` — candidates: duplicate market URLs, thin utility pages that only mirror hubs, legacy `/search` already 301s, unused marketing experiments.
