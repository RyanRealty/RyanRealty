# Measurement dual-source — ops scoreboard

**Date:** 2026-08-10  
**Status:** dual-source ops live + **server page_view MP mirror shipped (2026-08-10)**.  
**Locks:** Consent Mode v2 denied-by-default is **LOCKED** by `ci:tracking-policy` / `docs/TRACKING_POLICY.md`. Do **not** auto-grant analytics for all US traffic without Matt’s explicit go.  
**Companion:** `TOP_SITE_GOAL_SYSTEM.md` §L5 · `ENDTOEND_MISSION.md` P4 · `docs/TRACKING_POLICY.md`

### Server page_view mirror (chosen repair path)

| Piece | Behavior |
|-------|----------|
| Trigger | Successful `page_view` / `listing_view` write in `POST /api/visitors/track` |
| Transport | `lib/ga4-measurement-protocol.ts` → `mp/collect` |
| When **skipped** | Consent is `analytics`/`all` **and** browser already has `_ga` (client gtag is live — avoid double-count) |
| When **fires** | Essential-only consent, or no `_ga` (denied / blocked / never loaded) |
| Privacy | GPC opt-out still drops the whole track (no FP write, no MP). Declined consent still rejected. |
| Secret | `GA4_API_SECRET` + measurement id — no-op warn once if missing |

---

## 0. The ban (read first)

| Banned | Why |
|--------|-----|
| **“Traffic is dead” from GA4 alone** | First-party `visitor_sessions` is ~**3.7k/day**. GA4 often shows **~1–2 users** in the same window. That is **consent + ad-blocker undercount**, not a dead site. |
| Using GA4 sessions as the **only** numerator for “site is working / SEO is working” | GSC clicks + first-party visitors answer that. GA4 answers consented Google-visible behavior. |
| “Fixing” traffic by **default-granting** `analytics_storage` without Matt approval | Violates locked Consent Mode v2 policy (G48). |
| Adding first-party and GA4 counts together | Different populations. **Compare; never sum.** |

**Product truth for “are people on the site?”**  
→ `POST /api/visitors/track` → `visitor_sessions` / `visitor_events` (and admin surfaces that read them: live visitors, funnel-breakdown, social real-time, traffic-sources first-party column, LP leaderboard).

**Google / Ads / external reporting truth (partial, consent-gated)**  
→ GA4 property `527333348` / stream `G-ST40W4WM6T` via GTM `GTM-WV6R4NZ5` + client gtag, after Accept (or modeled cookieless pings when denied).

### G4 permanent decision (2026-08-10)

**First-party + GSC are primary** for “is traffic dead?” and product/SEO decisions.  
**GA4 is supplementary** (Ads, Signals, Google ecosystem) until it is within ~2× engaged FP — and even then FP remains the honest daily scoreboard.  
**Do not block shipping** on GA4 parity. Weekly ritual: `node scripts/analytics/scoreboard-snapshot.mjs` (`SCOREBOARD_RITUAL.md`).  
G3 (Advanced Consent Modeling / Blended reporting identity) remains optional Matt UI work — **docs ready:** [`GA4_OPS_CHECKLIST_MATT.md`](./GA4_OPS_CHECKLIST_MATT.md) (exact clicks); **blocked on Matt**.

---

## 1. Ops scoreboard — which source answers which question

| Question | Primary source | Secondary / cross-check | Do not use alone |
|----------|----------------|-------------------------|------------------|
| How many real sessions hit us today? | **`visitor_sessions`** (first-party) | Live admin pulse; optional GA4 for consented slice | GA4 users/sessions |
| Is organic discovery working? | **GSC** clicks + impressions | First-party landing pages with organic referrer / UTMs | GA4 organic sessions (severely undercounted) |
| What pages engage? | **`visitor_events` + engagement_score** | Funnel-breakdown admin | GA4 top pages only |
| Are we getting leads? | **CRM** (`crm_people`, valuation_requests, listing_inquiries, CMAs) | Server `generate_lead` MP (when secret set); Meta CAPI | GA4 lead events alone |
| Channel mix for **paid** optimization? | UTM + `visitor_sessions` first-touch + Meta/Ads consoles | GA4 source/medium (consented only) | GA4 as sole ROAS denominator |
| Consent / privacy posture healthy? | Cookie banner + G48 gates + `docs/TRACKING_POLICY.md` | Tag Assistant (see §4) | — |
| “How does Google see us?” (Ads linkage, Signals, modeling) | **GA4** after consent + Advanced Consent Modeling in UI | Tag Assistant | First-party as a substitute for Google Ads signals |

### Rough scale (why dual-source is mandatory)

| Source | Order of magnitude (observed 2026-08) | Notes |
|--------|--------------------------------------|--------|
| First-party `visitor_sessions` | **~3.7k / day** | Survives most ad blockers; gated only for `declined` / essential refusal |
| GA4 active users (typical undiagnosed window) | **~1–2** | GTM/gtag blocked or consent denied → near-zero client hits |
| GSC | Separate product | Clicks ≠ sessions; still the SEO discovery scoreboard |

Gap is **expected** under denied-by-default Consent Mode v2 + ad blockers. Gap is **not** proof the site has no traffic.

---

## 2. Architecture (what fires when)

```
Visitor lands
    │
    ├─► Consent Mode v2 defaults: analytics_storage + ad_* = denied
    │     (components/GoogleAnalytics.tsx — LOCKED G48)
    │
    ├─► First-party VisitTracker → POST /api/visitors/track
    │     unless consent is declined / GPC opt-out
    │     → visitor_sessions + visitor_events   ★ PRIMARY PRODUCT TRUTH
    │
    ├─► GTM / gtag full tags only after hasAnalyticsConsent()
    │     → GA4 client hits (often killed by ad blockers even after Accept)
    │
    └─► Server conversions (optional): lib/ga4-measurement-protocol.ts
          fireGa4Event / fireLeadGenerated AFTER lead success
          requires GA4_API_SECRET — no-op warn if missing
          ★ does NOT currently mirror page_view
```

**Locked policy reminders**

- Defaults stay **denied** until Accept (or documented ad-traffic marketing auto-grant paths — not a blanket US analytics grant).
- Changing defaults or “grant analytics for all US traffic” = **Matt go only**.
- Do not invent traffic in admin UI to make GA4 “look healthy.”

---

## 3. Weekly ritual (ops)

**Cadence:** same day each week (e.g. Monday ops) — 10–15 minutes.  
**Agent-runnable spine (G2):** `docs/plans/seo-voice/SCOREBOARD_RITUAL.md`  
**Script (no Matt click):** `node scripts/analytics/scoreboard-snapshot.mjs`  
Optional: `--append-verify-log` · `--json`

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Run **scoreboard-snapshot** (FP 1d/7d/30d, engaged score≥2, alerts, saves, CO 2024 mart) | Sessions ≫ 0; order of magnitude stable |
| 2 | Optional: `/admin` live pulse cross-check | Same class as script |
| 3 | Open GSC performance (28d) — ops with access | Clicks/impressions trend; note money queries |
| 4 | Open GA4 real-time + last 7 days | Record users/sessions **as consented Google view only** |
| 5 | Compute **ratio** first-party sessions ÷ GA4 sessions (same calendar window) | Log ratio. Do **not** declare traffic dead if ratio ≫ 1 |
| 6 | Leads: CRM inbound + valuation_requests week | Lead volume independent of GA4 |
| 7 | If ratio worse than last week | Run Tag Assistant / debug (§4) before product panic |
| 8 | Log one line in `VERIFY_LOG.md` Data probe snapshots | Script row or manual paste |

**Scoreboard line template**

```
Week of YYYY-MM-DD | FP 1d/7d/30d: N/N/N | eng7d: N (x%) | alerts: T/A/+30d | saves: N | CO2024: sold/$B | [GA4 users: N | GSC clicks: N]
```

---

## 4. Path to repair (ordered; no silent policy change)

### 4.1 Free / always-on hygiene (no Matt decision)

1. **Tag Assistant / GA4 DebugView**  
   - Confirm Consent Mode defaults = denied on first paint.  
   - Accept All → `analytics_storage` granted → `page_view` hits DebugView.  
   - Decline → no full analytics cookies; first-party may still track non-declined essential path.  
2. **Confirm env**  
   - `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / GTM container present in production.  
   - Service account for **admin Data API** (read dashboards) is separate from Measurement Protocol secret.  
3. **Ad-blocker awareness**  
   - Even Accept + healthy tags undercount vs first-party; that is structural.  
4. **Admin honesty**  
   - Any tile labeled bare “Sessions / traffic” that is GA4-only must say **GA4** and point ops to first-party primary (see admin notes below).

### 4.2 Advanced Consent Modeling (GA4 UI — Matt/ops)

- **Exact clicks:** [`GA4_OPS_CHECKLIST_MATT.md`](./GA4_OPS_CHECKLIST_MATT.md) (Blended identity · modeling eligibility · Tag Assistant smoke).  
- In GA4 Admin, enable **advanced consent modeling** / behavioral modeling where available for the property.  
- Improves **modeled** reporting inside Google when many hits are cookieless.  
- Does **not** replace first-party truth; does **not** require changing our denied defaults.  
- **Recommended** as first Matt-approved Google-side lever.  
- **G3 status:** docs ready; **blocked on Matt** UI (no agent API for these three items).

### 4.3 Optional: Measurement Protocol `page_view` mirror (Matt go)

| Item | Detail |
|------|--------|
| Today | `lib/ga4-measurement-protocol.ts` fires **conversion-class** events (`generate_lead`, etc.) after server success. Safe **no-op** if `GA4_API_SECRET` missing. |
| Secret | `GA4_API_SECRET` referenced in `.env.example` / `.env.local` (often empty). Generate in GA4 → Admin → Data Streams → Measurement Protocol API secrets. |
| Proposed follow-up | From `/api/visitors/track` (or a thin helper), after successful first-party `page_view` write, `void fireGa4Event({ eventName: 'page_view', … })` with stable `client_id` when known. |
| Why it helps | Server-side hit bypasses client ad blockers for **volume** in GA4; still should respect consent flags on the track payload (do not MP-mirror `declined`). |
| Why it is **not** auto-shipped | Changes what Google receives; can double-count with client gtag if both fire for consented users unless client_id/session carefully joined; needs Matt go + secret in prod. |
| Size | Clean follow-up; implement only when secret is set and Matt approves. Keep no-op without secret. |

**Do not implement full MP pageviews in this P4 foundation** unless explicitly approved and kept secret-gated.

### 4.4 Optional: US analytics default-grant (Matt go — policy change)

| Option | Effect | Risk |
|--------|--------|------|
| **A. Status quo (default)** | Denied-by-default forever; first-party primary forever | GA4 stays thin; honest |
| **B. Advanced modeling only** | Better GA4 estimates; defaults unchanged | Low legal/product risk |
| **C. MP page_view mirror for non-declined** | GA4 volume closer to first-party for tracked sessions | Medium — config + double-count care |
| **D. Default-grant `analytics_storage` for US traffic** | Much higher GA4 parity | **Policy change** — requires Matt; update TRACKING_POLICY + G48 review; not agent-autonomous |

**Agents must not ship D (or blanket auto-grant) without Matt’s explicit go.**

---

## 5. Code map (for implementers)

| Piece | Path | Role |
|-------|------|------|
| Consent defaults | `components/GoogleAnalytics.tsx` | CM v2 denied-by-default |
| Consent helpers | `components/CookieConsentBanner.tsx` | `hasAnalyticsConsent` |
| First-party client | `components/VisitTracker.tsx` | POST track unless declined |
| First-party ingest | `app/api/visitors/track/route.ts` | Product SoR for sessions/events |
| GA4 MP | `lib/ga4-measurement-protocol.ts` | Server events; needs `GA4_API_SECRET` |
| Lead MP wrapper | `lib/lead-tracking.ts` | `generate_lead` after capture |
| Admin dual view | `app/admin/.../reports/traffic-sources` | FP vs GA4 side-by-side (good pattern) |
| Admin FP funnel | `app/admin/.../analytics/funnel-breakdown` | visitor_* only |
| Policy lock | `docs/TRACKING_POLICY.md` + `ci:tracking-policy` | G48 |

---

## 6. Admin surfaces that mislead if read naively

These still show **GA4** as “sessions / traffic” without always saying first-party is primary. Prefer `/admin/reports/traffic-sources` (dual) or funnel-breakdown (FP) for volume.

| Surface | Issue | Ops rule |
|---------|-------|----------|
| `/admin` operations hero “Sessions, 30 days” | GA4 number | Treat as **GA4 sessions**, not site traffic |
| `/admin/analytics` Overview tabs | GA4 Data API | Consented Google view only |
| `/admin/reports/lead-flow` | Funnel top = GA4 sessions | Conversion rate vs GA4 is inflated vs real traffic |
| `/admin` GA4 deep panel | “Sessions / Total users” | Cross-check first-party before product decisions |

One-line UI notes (where cheap) point back here and to first-party visitors.

---

## 7. Definition of done for P4 (this mission)

| Done now | Still blocked on Matt |
|----------|------------------------|
| This dual-source ops doc | Option D (US analytics default-grant) |
| Ban on GA4-only “traffic is dead” in ops language | Optional MP page_view mirror + prod `GA4_API_SECRET` |
| Weekly ritual defined | Any TRACKING_POLICY default change |
| Admin honesty notes on worst GA4-only labels | Full GA4 ≈ first-party parity |
| MP conversion path documented (exists, secret-gated) | — |
| **G4 FP-primary permanent** (below) | Waiting on GA4 ≈ FP parity — **not required** |

---

## 7b. G4 permanent dual-source decision (2026-08-10) — LOCKED

**Decision: first-party + GSC are permanent primary traffic truth. GA4 is supplementary until (if ever) engaged GA4 is within ~2× of engaged first-party — and even then FP stays primary for product ops.**

| Layer | Role | When to trust it alone |
|-------|------|------------------------|
| **First-party** (`visitor_sessions` / `visitor_events`, scoreboard-snapshot) | **Primary product truth** — sessions, engagement, funnels | Always for “is the site working / who engaged” |
| **GSC** | **Primary discovery truth** — clicks, impressions, money queries | Always for organic SEO health |
| **GA4** (client + MP conversions) | **Supplementary** Google/Ads view (consent + ad-block gated) | Paid optimization cross-check; never sole traffic numerator |

### Why permanent (not “until GA4 catches up”)

1. **Consent Mode v2 denied-by-default is LOCKED** (`ci:tracking-policy`). GA4 undercount vs FP is structural, not a bug to “fix” by auto-granting analytics.
2. Observed scale (2026-08): FP **thousands/day**; undiagnosed GA4 windows often **~1–2 users**. Ratio ≫ 2× is expected under policy + blockers.
3. **Do not wait for GA4 parity** to declare traffic healthy, ship conversion work, or run the weekly scoreboard. G4 queue unit is **closed as FP-primary permanent**, not deferred on GA4 ops (G3 Tag Assistant / modeling remain useful but are not blockers for product truth — checklist: [`GA4_OPS_CHECKLIST_MATT.md`](./GA4_OPS_CHECKLIST_MATT.md)).
4. GA4 remains valuable for Ads linkage, Signals, and consented behavior — **compare, never sum** with FP; never use GA4-only to claim “traffic is dead.”

### Ops one-liner

> Scoreboard = **FP sessions + engaged + GSC** for truth · **GA4** as consented Google slice · CRM for leads.

---

## 8. Matt decision options (checklist)

Present clearly when asking for a go:

1. **Keep defaults denied; use dual-source forever** (recommended baseline).  
2. **Enable Advanced Consent Modeling** in GA4 UI (recommended add-on).  
3. **Generate `GA4_API_SECRET` + enable server `page_view` MP mirror** for non-declined track events (volume repair without default-grant).  
4. **Default-grant analytics for US traffic** (policy change — highest GA4 parity, highest scrutiny).  
5. **Do nothing Google-side** — only first-party + GSC for top-site scoreboard (valid if Matt prioritizes privacy posture over GA4 dashboards).

---

## References

- `docs/TRACKING_POLICY.md`  
- `docs/GA4_USER_TRACKING_SETUP.md`  
- **`docs/plans/seo-voice/GA4_OPS_CHECKLIST_MATT.md`** — G3 Matt UI checklist (Blended · modeling · Tag Assistant)  
- `docs/plans/seo-voice/TOP_SITE_GOAL_SYSTEM.md` (L5)  
- `docs/plans/seo-voice/ENDTOEND_MISSION.md` (P4)  
- `lib/ga4-measurement-protocol.ts`  
- `app/api/visitors/track/route.ts`  
