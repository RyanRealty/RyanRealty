# GA4 ops checklist (Matt UI only) — G3

**Status:** Docs ready · **blocked on Matt** (Google Analytics UI; no agent API path).  
**Property:** `Ryan Realty` · id **`527333348`** · stream measurement id **`G-ST40W4WM6T`** · GTM **`GTM-WV6R4NZ5`** (if still published).  
**Site:** `https://ryan-realty.com`  
**Why this exists:** Site code already runs Consent Mode v2 **denied-by-default** (`ci:tracking-policy`). These three Google-side toggles improve **how Google models and stitches** consented + cookieless hits. They do **not** replace first-party scoreboard truth (`MEASUREMENT_DUAL_SOURCE.md` §7b).

**Companion:** `MEASUREMENT_DUAL_SOURCE.md` · `docs/TRACKING_POLICY.md` · `docs/ANALYTICS_LEAD_TRACKING.md` §5.0 · EXECUTION_QUEUE **G3**

---

## Before you start

| Item | Note |
|------|------|
| Login | Use an account with **Editor** or **Admin** on property `527333348` |
| Do not | Default-grant `analytics_storage` for all US traffic (policy lock — needs separate Matt go) |
| Do not | Treat post-change GA4 users as “site traffic fixed” — FP remains primary |
| Time | ~10–15 minutes for all three sections |

---

## 1. Reporting identity → **Blended**

Blended lets GA4 stitch **User-ID + Google signals + device + modeled** users so multi-device and consent-gap traffic report more completely. Required for behavioral modeling under Advanced Consent Mode to appear in standard reports.

### Exact clicks

1. Open [Google Analytics](https://analytics.google.com/).
2. Confirm property is **Ryan Realty** (`527333348`) — property picker top-left.
3. Click **Admin** (gear, lower-left).
4. In the **Property** column, under **Data display**, click **Reporting identity**.
5. If you only see one option expanded, click **Show all** (bottom-right of the card) so **Blended**, **Observed**, and **Device-based** are all listed.
6. Select **Blended**.
7. Click **Save**.

### Pass criteria

| Check | Pass |
|-------|------|
| Selected option | **Blended** is the active radio |
| UI copy | Mentions modeling / combining methods (wording varies by GA4 version) |
| Change scope | Property-wide; retroactive for report views (safe to flip) |

### Notes

- **Observed** = only directly observed identities (no modeling) — thinner under consent deny rates.
- **Device-based** = cookies/device only — usually worse for multi-device + consent.
- This does **not** change our site consent defaults.

---

## 2. Advanced Consent Modeling / behavioral modeling eligibility

“Advanced Consent Modeling” in product language = **Advanced Consent Mode on the site** (already shipped) **+** GA4 **behavioral modeling** for denied-analytics traffic, which surfaces when **Reporting identity = Blended** and volume thresholds are met.

There is not always a separate permanent “turn on modeling” switch; modeling **activates when eligible**. Your job is to confirm identity + signals + eligibility messaging.

### Exact clicks (confirm + enable prerequisites)

1. Still in **Admin** for property `527333348`.
2. **Reporting identity** (above) must be **Blended** — re-check if unsure.
3. Property column → **Data collection and modification** → **Data collection**.
4. Confirm **Google signals data collection** is **On** (or turn On → Accept terms if Matt is fine with Signals for Ads/remarketing).  
   - Signals improves cross-device and Ads linkage; leave Off only if deliberate privacy tradeoff.
5. Scroll the same area / any **Consent settings** or modeling banners.  
   - If Google shows **“Modeling is unavailable for this property”**, note the listed reason (volume thresholds, consent implementation, Signals).
6. Optional (conversions): **Admin** → **Data display** → **Events** / **Conversions** — no change required for G3; conversion modeling is separate from session modeling.

### Volume thresholds (why modeling may lag)

Google typically requires roughly (order of magnitude; Google can change):

- Enough events with `analytics_storage=denied` over ~7 days, **and**
- Enough users with `analytics_storage=granted` over ~28 days  

Under denied-by-default + ad blockers, **eligibility can take days/weeks** after Blended is on. That is expected — not a code bug.

### Pass criteria

| Check | Pass |
|-------|------|
| Reporting identity | Blended |
| Google signals | On (recommended) or explicit Matt decision Off |
| Banner | No “fix consent mode implementation” error; thresholds may still show “unavailable” until volume builds |
| Site code | Already Advanced Mode (tags can send cookieless pings when denied) — **do not** change defaults without policy go |

### What this does *not* do

- Does not make GA4 equal first-party sessions.
- Does not require granting analytics cookies by default.

---

## 3. Tag Assistant smoke (consent + page_view)

Validates that production tags and Consent Mode behave on a real browser.

### A. Tag Assistant connect

1. Open [Tag Assistant](https://tagassistant.google.com/) (Chrome recommended).
2. Enter URL: `https://ryan-realty.com` (or a money URL: `/cities/bend`, `/search`).
3. Click **Connect** → allow the debug session window/tab.
4. In Tag Assistant, select the connected domain / tag id **`G-ST40W4WM6T`** (and GTM id if listed).

### B. First paint — defaults denied (no Accept yet)

1. If a cookie banner appears, **do not accept yet**.
2. In Tag Assistant → pick a recent event (e.g. first `page_view` or Consent update) → **Consent** tab (or Summary → Consent).
3. Confirm defaults roughly: **`analytics_storage` = denied**, **`ad_storage` / ad_user_data / ad_personalization` = denied** (or not granted).
4. Optional DevTools: Network filter `g/collect` or `google-analytics` — may see cookieless/minimal pings; full analytics cookies should **not** be set as granted.

### C. Accept All → analytics granted

1. On the site, click **Accept** / Accept all (banner wording may vary).
2. In Tag Assistant, find a new event after consent update.
3. Consent tab: **`analytics_storage` = granted** (ads params per banner choice).
4. Confirm a **`page_view`** (or config + page_view) **fires** after grant.
5. Optional: GA4 **Admin** → **DebugView** (or Configure → DebugView) while Tag Assistant is connected — you should see the debug device and `page_view` stream in near-real-time.

### D. Decline path (quick)

1. New private window → same Tag Assistant connect (or hard reload without prior consent cookie).
2. Click **Decline** / essential-only if offered.
3. Full analytics should **not** go to granted; first-party track may still run for non-declined essential paths (product truth — separate from GA4).

### Pass criteria

| Step | Pass |
|------|------|
| First paint | analytics denied by default |
| After Accept | analytics granted + `page_view` visible in Tag Assistant and/or DebugView |
| After Decline | analytics not granted; no “we fixed traffic by auto-accept” behavior |
| Measurement id | Hits associate with **`G-ST40W4WM6T`** |

### Fail → do next (before product panic)

1. Re-check prod env: `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / GTM container on Vercel production.
2. Ad blocker / Brave shields off for the smoke window only.
3. Confirm cookie banner still wired (`CookieConsentBanner` + `GoogleAnalytics` CM v2).
4. Log ratio FP sessions ÷ GA4 sessions in weekly scoreboard — large ratio is **expected**, not alone proof of broken tags.

---

## 4. After Matt completes G3

1. Check boxes on EXECUTION_QUEUE **G3** → `[x]` with date.  
2. One line in `VERIFY_LOG.md`:

```
G3 2026-MM-DD | Blended ✓ | modeling eligibility: [yes/pending thresholds] | Tag Assistant Accept page_view ✓
```

3. Keep **scoreboard-snapshot** / FP+GSC as primary (`SCOREBOARD_RITUAL.md`).  
4. Optional later (separate go): `GA4_API_SECRET` + MP page_view mirror — see MEASUREMENT_DUAL_SOURCE §4.3.

---

## 5. Explicit non-goals (agents + Matt)

| Out of scope for G3 | Why |
|---------------------|-----|
| Changing Consent Mode defaults to granted | TRACKING_POLICY / G48 lock |
| Declaring traffic healthy from GA4 alone | FP+GSC primary forever |
| API automation of these three UI items | Not available / not reliable vs UI |
| Replacing first-party scoreboard | G4 closed as dual-source permanent |

---

## Quick link card

| Task | Where |
|------|--------|
| Property | [analytics.google.com](https://analytics.google.com/) → Ryan Realty `527333348` |
| Blended | Admin → Data display → **Reporting identity** → **Blended** → Save |
| Signals / modeling prereqs | Admin → Data collection and modification → **Data collection** |
| Tag Assistant | [tagassistant.google.com](https://tagassistant.google.com/) → `https://ryan-realty.com` |
| DebugView | GA4 → Admin / Configure → **DebugView** (while TA connected) |
| Scoreboard | `node scripts/analytics/scoreboard-snapshot.mjs` |

*G3 = docs ready; blocked on Matt UI.*
