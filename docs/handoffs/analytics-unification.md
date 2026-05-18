# Handoff — Analytics Agent (unify GA4 + install FUB pixel)

**Mission:** Make sure both Ryan Realty sites — `ryan-realty.com` (WordPress / AgentFire) and `ryanrealty.vercel.app` (Next.js) — feed the same GA4 property AND have the FUB tracking pixel installed. The brain currently sees only ~2% of actual traffic because the WordPress site ships its data to a separate GA4 property the brain doesn't read.

Matt's directive: **both sites use the SAME GA4 measurement ID — specifically the one the brain reads. And install the Follow Up Boss pixel on both sites so we can attribute leads by browsing path.**

Run autonomously end-to-end. Drive Chrome via the Claude_in_Chrome MCP for any UI work; use Vercel CLI / API for env changes. Surface for Matt's approval only on irreversible state changes per CLAUDE.md §0.5.

---

## 0. Current state (verified 2026-05-16)

| Tracker | `ryan-realty.com` (WordPress) | `ryanrealty.vercel.app` (Vercel) |
|---|---|---|
| GA4 Measurement ID | `G-5FM3WEY062` ✓ installed | `G-ST40W4WM6T` ✓ installed |
| Meta (Facebook) Pixel | `1546878946032105` ✓ — PageView + ViewContent | `1546878946032105` ✓ — PageView + Lead on form submit |
| Follow Up Boss Pixel | ❌ NOT installed | ❌ NOT installed |

**What the brain reads (verified via .env.local + Vercel env):**

- `GOOGLE_GA4_PROPERTY_ID = 527333348` — this is the numeric Property ID for the GA4 property that contains measurement ID `G-ST40W4WM6T` (the Vercel app's property). Confirmed because the brain's `marketing_channel_daily` page-level data only shows Vercel paths: `/admin/social`, `/dashboard`, `/lp/seller-home-value`, `/cma-drafts/...`, `/login`.

**Target end state:**

- Both sites send GA4 hits to the property the brain reads = `527333348` = measurement ID `G-ST40W4WM6T`
- WordPress's old `G-5FM3WEY062` tag is removed (no double-counting)
- FUB Pixel installed on both sites (you'll get the pixel snippet from FUB → Admin → Pixel Tracker)
- Brain's `audit-website` skill starts returning actionable opportunities within 24-48h instead of `insufficient_data`

---

## 1. Required reading (in order, before doing anything)

1. **`CLAUDE.md`** — especially §0 (data accuracy), §0.5 (draft-first), "Marketing Brain Architecture", "Skill Routing"
2. **`.auto-memory/memory_marketing_brain_decisions.md`** — every accumulated gotcha through 2026-05-16. Required.
3. **`marketing_brain_skills/tools_registry/ga4/SKILL.md`** — GA4 service account pattern, the `GOOGLE_GA4_PROPERTY_ID` env var
4. **`marketing_brain_skills/tools_registry/meta-graph/SKILL.md`** — Meta Pixel context (not changing it, just for awareness)
5. **`marketing_brain_skills/tools_registry/follow-up-boss/SKILL.md`** — FUB integration overview
6. **`components/GoogleAnalytics.tsx` + `app/layout.tsx`** — current GA4 install pattern on the Vercel side. The FUB pixel will follow the same component pattern.
7. **`lib/marketing-brain/audit-website.ts`** — what unblocks when GA4 has full data

---

## 2. Procedure — full sequence

### Step 1 — Verify the property mapping

Before changing anything, **confirm** that `GOOGLE_GA4_PROPERTY_ID = 527333348` maps to measurement ID `G-ST40W4WM6T` (not the other one). Drive Chrome via `mcp__Claude_in_Chrome__*`:

1. List browsers: `mcp__Claude_in_Chrome__list_connected_browsers`
2. Ask Matt which browser to use (he'll pick "mac")
3. `select_browser` with his deviceId
4. Open a new tab, navigate to `https://analytics.google.com/`
5. If not logged in: ask Matt to sign in with his Ryan Realty Google account
6. Once in: navigate to Admin → Property settings on whichever property has `G-ST40W4WM6T`
7. Confirm the numeric Property ID matches `527333348`
8. Also note the Property NAME for both `G-ST40W4WM6T` and `G-5FM3WEY062` properties (Matt has probably named them something like "Ryan Realty Vercel App" and "Ryan Realty Main Site")

**If they don't match expectations, STOP and surface to Matt before continuing.**

### Step 2 — Get the FUB pixel snippet

Drive Chrome to FUB:

1. Navigate to `https://app.followupboss.com/`
2. If not logged in: ask Matt to sign in
3. Once in: Admin → Pixel Tracker (or similar — exact menu may be "Pixel" or "Tracking Code")
4. Copy the pixel snippet — usually looks like:
   ```html
   <script async src="https://app.followupboss.com/pixel/<FUB_ACCOUNT_ID>.js"></script>
   ```
5. Capture the `FUB_ACCOUNT_ID` value (you'll use it in two install paths below)

Note: if FUB has a checkbox for "track all page views" make sure that's enabled. If they ask for the website URL during pixel setup, enter BOTH `ryan-realty.com` and `ryanrealty.vercel.app`.

### Step 3 — Add the GA4 service account to BOTH properties (for safety + future-proofing)

The brain's service account is `viewer@ryanrealty.iam.gserviceaccount.com`. It currently has access only to property `527333348`. Even though Matt's directive is "both sites use the same ID," granting the service account viewer access to BOTH GA4 properties is a quick safety step so:
- If you accidentally configure the wrong measurement ID later, you can pivot without re-granting
- The brain can run a brief diff to compare old WordPress property historical data vs new combined property to validate migration

Drive Chrome at analytics.google.com:

1. Admin → Property `G-5FM3WEY062` → Property Access Management
2. Add `viewer@ryanrealty.iam.gserviceaccount.com` with role "Viewer"
3. Save

(Don't worry about removing it later — read-only access on the old property is harmless and lets you audit historical data.)

### Step 4 — Update Vercel app to use the FUB pixel

Author a new component `components/FollowUpBossPixel.tsx`:

```tsx
'use client'

import Script from 'next/script'

const FUB_PIXEL_ID = process.env.NEXT_PUBLIC_FUB_PIXEL_ID

export default function FollowUpBossPixel() {
  if (!FUB_PIXEL_ID) return null
  return (
    <Script
      id="fub-pixel"
      strategy="afterInteractive"
      src={`https://app.followupboss.com/pixel/${FUB_PIXEL_ID}.js`}
      async
    />
  )
}
```

Then wire into `app/layout.tsx` next to the existing `<GoogleAnalytics />` reference (line 184 area):

```tsx
import GoogleAnalytics from '../components/GoogleAnalytics'
import FollowUpBossPixel from '../components/FollowUpBossPixel'
// ...
<GoogleAnalytics />
<FollowUpBossPixel />
```

Add `NEXT_PUBLIC_FUB_PIXEL_ID=<fub_account_id_from_step_2>` to `.env.local` AND to all 3 Vercel envs:

```sh
TOKEN='<fub_account_id_value>'
echo "$TOKEN" | vercel env add NEXT_PUBLIC_FUB_PIXEL_ID production
echo "$TOKEN" | vercel env add NEXT_PUBLIC_FUB_PIXEL_ID development
# Preview: CLI is broken; use the API workaround
VTOKEN=$(jq -r '.token' ~/Library/Application\ Support/com.vercel.cli/auth.json)
PROJECT_ID=$(jq -r '.projectId' .vercel/project.json)
ORG_ID=$(jq -r '.orgId' .vercel/project.json)
curl -sS -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$ORG_ID" \
  -H "Authorization: Bearer $VTOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"NEXT_PUBLIC_FUB_PIXEL_ID\",\"value\":\"$TOKEN\",\"target\":[\"preview\"],\"type\":\"encrypted\"}"
unset TOKEN VTOKEN
```

### Step 5 — Redeploy production

```sh
LATEST=$(vercel ls --prod 2>&1 | grep -oE "https://ryanrealty-[a-z0-9]+-ryanrealtys-projects\.vercel\.app" | head -1)
vercel redeploy "$LATEST" --target production
```

Wait ~90 seconds, then verify by hitting `https://ryan-realty.vercel.app/` and checking the rendered HTML for the FUB script. Browser DevTools Network tab is the truth source — look for a request to `app.followupboss.com/pixel/<id>.js`.

### Step 6 — Update the WordPress site

This is the part where you'll need Matt's AgentFire admin access. Drive Chrome:

1. Navigate to `https://ryan-realty.com/wp-admin/` or whatever the AgentFire admin URL is (Matt knows; ask him)
2. If not logged in: ask Matt to sign in
3. AgentFire admin → Site Settings / SEO & Analytics (exact menu varies by AgentFire version)
4. **Replace** the existing GA4 Measurement ID `G-5FM3WEY062` → `G-ST40W4WM6T`
   - If AgentFire has a single field for GA4: just replace
   - If AgentFire has a custom header script with `G-5FM3WEY062`: replace it in-place
   - Save changes
5. **Add the FUB Pixel snippet** to AgentFire's custom header script:
   ```html
   <script async src="https://app.followupboss.com/pixel/<FUB_PIXEL_ID>.js"></script>
   ```
   Save
6. (Optional) Confirm Meta Pixel `1546878946032105` is still there and untouched

### Step 7 — Verify both sites fire correctly

After ~2 minutes for AgentFire cache to clear:

1. Open `https://ryan-realty.com/` in Chrome incognito (so no extension auto-fires)
2. Open DevTools → Network tab → filter "gtag" — confirm a request to `googletagmanager.com/gtag/js?id=G-ST40W4WM6T` fires (NOT `G-5FM3WEY062`)
3. Filter "fubapp" or "followupboss" — confirm a request to `app.followupboss.com/pixel/<id>.js` fires
4. Filter "fbevents" — confirm Meta Pixel still fires (unchanged)
5. Repeat for `https://ryanrealty.vercel.app/`

If any pixel doesn't fire, debug before declaring done.

### Step 8 — Verify the brain picks up new data

Wait 24h for GA4 to process. Then query Supabase:

```sql
SELECT date, scope_id, sum(value)::int as views
FROM public.marketing_channel_daily
WHERE channel='ga4' AND metric='page_views' AND scope='page' AND date >= current_date - 1
GROUP BY date, scope_id ORDER BY views DESC LIMIT 20;
```

Expected: WordPress paths (`/`, `/contact/`, `/about-us/`, `/explore/bend/{neighborhood}/`, `/central-oregon-housing-market-update-october-2025...`, etc.) should now appear alongside the existing Vercel paths.

If after 48h WordPress paths still don't show: the AgentFire install didn't take. Re-inspect Step 6 in browser DevTools.

### Step 9 — Update memory log

Append to `.auto-memory/memory_marketing_brain_decisions.md`:

```markdown
## 2026-05-XX — Analytics unified: single GA4 ID across both sites

- Replaced WordPress GA4 measurement ID `G-5FM3WEY062` → `G-ST40W4WM6T`
  (matches Vercel side; brain reads property 527333348)
- Installed Follow Up Boss pixel on both sites (FUB_PIXEL_ID = <id>)
  - Vercel: via new `components/FollowUpBossPixel.tsx` component + NEXT_PUBLIC_FUB_PIXEL_ID env var (all 3 envs)
  - WordPress: AgentFire custom header script
- Granted GA4 service account `viewer@ryanrealty.iam.gserviceaccount.com`
  viewer access to property `G-5FM3WEY062` for historical-data audit
  capability (read-only; harmless)
- Verified <verification date>: brain receives WordPress page views in
  marketing_channel_daily within 24h of switch
- audit-website skill transitioned from returning `insufficient_data`
  to emitting real opportunities once full traffic landed
```

Commit + push the memory update.

### Step 10 — Surface summary to Matt

When Step 8 verification passes, surface:
- Old measurement IDs replaced with new
- FUB pixel install confirmed on both sites
- Brain's traffic visibility went from ~2% to ~100%
- Whatever new audit-website opportunities surfaced (if any)
- Any leftover issues for next session

---

## 3. Behavioral guardrails

- **Draft-first per CLAUDE.md §0.5.** Surface for approval before:
  - Replacing the WordPress GA4 tag (irreversible without re-adding the old one)
  - Removing any existing tracking from either site
- **Don't touch Meta Pixel.** It's correctly installed (same ID on both sites) and changing it would break ad attribution.
- **No `git add -A`.** Stage specific files per the cross-session collision rule in memory log.
- **Pull --rebase before push. Push immediately after commit.**
- **AgentFire CDN has a 5-15 min cache lag** per the AgentFire WordPress tool SKILL.md. Allow time before declaring an install broken.

---

## 4. Accumulated gotchas to remember

- **`vercel env add KEY preview --value X --yes`** is broken in agent mode — use REST API PATCH directly (the `Application Support/com.vercel.cli/auth.json` token pattern is documented in memory log)
- **`vercel env add` rejects overwrite** if env var already exists — use API PATCH to update existing
- **Vercel serverless functions need a redeploy** to pick up new env vars; just adding them isn't enough
- **AgentFire IDX custom post types** (listings, agents) — do NOT touch these in WordPress admin
- **Meta Pixel ID `1546878946032105`** is the same on both sites — DO NOT CHANGE
- **GA4 property `527333348`** is what the brain reads via `GOOGLE_GA4_PROPERTY_ID` env var — this is the target

---

## 5. Tools you have access to

- **`mcp__Claude_in_Chrome__*`** — drive Chrome for analytics.google.com, FUB admin, AgentFire admin
- **`mcp__computer-use__read_clipboard`** — read clipboard after click-to-copy actions
- **`mcp__5adfee1a-82b2-4661-a931-e7bf6763a9c9__execute_sql`** — verify Supabase data after the switch
- **`Bash`** — Vercel CLI, curl for API patches, git
- **`WebFetch`** — verify pixels are firing on each site after install

---

## 6. Definition of done

- [ ] WordPress site (`ryan-realty.com`) sends GA4 hits to measurement ID `G-ST40W4WM6T` (verified in browser DevTools Network)
- [ ] WordPress site's old `G-5FM3WEY062` tag removed (no double-counting)
- [ ] FUB pixel installed on WordPress (verified in DevTools)
- [ ] FUB pixel component shipped to Vercel app via `components/FollowUpBossPixel.tsx` + `NEXT_PUBLIC_FUB_PIXEL_ID` env var in all 3 Vercel envs (verified in DevTools after redeploy)
- [ ] Both sites' Meta Pixel `1546878946032105` continues to fire correctly (unchanged)
- [ ] GA4 service account has viewer access to the old property (for historical-data safety)
- [ ] After 24-48h: `marketing_channel_daily` shows WordPress paths in addition to Vercel paths
- [ ] `audit-website` brain skill starts emitting non-empty opportunity sets (validate by checking `marketing_brain_actions` for new `site:*` action rows from the next weekly cycle)
- [ ] Memory log updated with the change + verification date
- [ ] Final summary surfaced to Matt with old/new IDs + verification outcomes

---

## 7. If you get stuck

- **Can't find AgentFire's GA4 / custom header field** — different AgentFire themes hide it in different places. Ask Matt to point you to it, or try Site Settings → SEO → Tracking & Analytics → Custom Code → Header.
- **WordPress GA4 tag persists after replacement** — AgentFire might cache the rendered HTML. Check the page source via `view-source:https://ryan-realty.com/` to confirm. Try clearing AgentFire's site cache via admin.
- **FUB pixel doesn't show in DevTools** — check that `NEXT_PUBLIC_FUB_PIXEL_ID` is set in Vercel + redeployed. Confirm the AgentFire custom-header save actually persisted (some AgentFire versions need you to hit "Save" twice).
- **Brain still shows no WordPress data after 48h** — verify the AgentFire-served HTML has `G-ST40W4WM6T` in the gtag script, not the old ID. Verify the brain's `GOOGLE_GA4_PROPERTY_ID` env var matches the property containing that measurement ID.

When in doubt about an irreversible change, ASK MATT before doing it.

---

## 8. Final note

The brain's been making decisions on 2% of the actual traffic for weeks. The 2026-05-15 audit (`9062ab1c-9c7d-4053-86ad-a0bb33efd6c5`) found 7 winning topic × format combos but the underlying competitive data is thin because we don't even have our OWN traffic to compare against. Fixing this unblocks `audit-website`, makes `generate-briefs` site-SEO opportunities meaningful, and lets `measurement-loop` attribute content performance to real user paths.

Get it done.
