# Weekly scoreboard ritual (ops)

**Owner:** any agent or ops (not Matt-click dependent)  
**Cadence:** same weekday each week (~10 min)  
**Primary doc:** `MEASUREMENT_DUAL_SOURCE.md` (dual-source rules)  
**Live probe:** `node scripts/analytics/scoreboard-snapshot.mjs`  
**Log:** one row in `VERIFY_LOG.md` Data probe snapshots table

---

## 0. Why this exists

GA4 alone undercounts under Consent Mode v2 + blockers. Product truth is
first-party `visitor_sessions` / conversion tables. This ritual locks a
repeatable FP + alerts + saves line so “are we winning?” is answered from data,
not vibes.

---

## 1. Steps (agent-runnable)

| # | Action | How | Pass |
|---|--------|-----|------|
| 1 | **FP sessions** | `node scripts/analytics/scoreboard-snapshot.mjs` | 1d/7d/30d ≫ 0; order of magnitude stable vs last week |
| 2 | **Engaged** | Same script (`engagement_score >= 2`) | Log rate; investigate only if rate collapses, not if GA4 is thin |
| 3 | **Alerts** | Script: total / active / created 30d | Trend over weeks; B1 success = created 30d moving up |
| 4 | **Saved searches** | Script `saved_searches` count | Legacy/share; secondary to listing_alerts |
| 5 | **CO closed (mart)** | Script mart 2024 cell | Sanity that analytics foundation still answers |
| 6 | **Optional GSC** | Search Console UI or export (Matt or ops with access) | Clicks/impressions 28d — not required for agent-only run |
| 7 | **Optional GA4** | Admin dual-source or GA4 UI | Record as **consented Google view only**; never sole traffic claim |
| 8 | **Write VERIFY_LOG** | `… --append-verify-log` **or** paste the printed row | One new snapshot row per week (or after material ship) |

### One-liner

```bash
node scripts/analytics/scoreboard-snapshot.mjs
# optional: write the table row
node scripts/analytics/scoreboard-snapshot.mjs --append-verify-log
# machine-readable
node scripts/analytics/scoreboard-snapshot.mjs --json
```

Requires `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Scoreboard line template

```
Week of YYYY-MM-DD | FP 1d: N | FP 7d: N | eng7d: N (x%) | FP 30d: N | eng30d: N (x%) | alerts: T/A/+30d | saves: N | CO2024: sold/$B
```

Do **not** add GA4 + FP. Compare them if both present.

---

## 3. Definitions

| Metric | Source | Definition |
|--------|--------|------------|
| FP sessions | `visitor_sessions` | Rows with `first_seen_at` in window |
| Engaged | same | `engagement_score >= 2` |
| Alerts | `listing_alerts` | Total; `is_active=true`; `created_at` in 30d |
| Saves | `saved_searches` | Row count (legacy / public-share) |
| CO closed 2024 | `analytics_mart_market_annual` | region `central-oregon`, year 2024, type_scope `all` |

---

## 4. Related

- Dual-source rules + ban list: `MEASUREMENT_DUAL_SOURCE.md`
- Program queue: `EXECUTION_QUEUE.md` unit **G2**
- Snapshot history: `VERIFY_LOG.md` → Data probe snapshots
