# Handoff — FUB Smart List Wiring (2026-05-27 / updated 2026-05-28)

**Status:** Blocked. Filter-wiring pilot on Bend - River West (id 104) FAILED to evaluate (saved filters preserved correctly, but the list shows 0 people). Root cause identified.
**Owner:** Matt Ryan (ryan-realty.followupboss.com)
**Goal:** Wire 28 smart lists with inclusion + universal-exclusion filters + Share-with-everyone visibility.

---

## 🚨 CRITICAL FINDING (2026-05-28) — FUB 1.0 vs 2.0 split

**Root cause for why Bend - River West shows 0 even with filters saved:**

The FUB v1 API exposes an `isFub2` boolean on `/v1/smartLists/<id>`:

- **FUB 2.0 smart lists** (`isFub2: true`): saving filters via the FUB 2.0 UI WORKS correctly. The list re-evaluates and shows the correct contact count.
- **FUB 1.0 legacy smart lists** (`isFub2: false`): saving filters via the FUB 2.0 UI SAVES THE FILTER CHIPS but the v1 backend doesn't evaluate them. The list shows 0 people forever.

**Inventory (verified 2026-05-28):**

| Status | Count | Lists |
|---|---|---|
| **FUB 2.0 ✅ (filters work)** | **19** | Realtors (23), All Expireds (37), Matts Sphere (39), Expired No Contact (41), Absentee Owners No Contact (42), All Clients (46), Migration Realtors (48), Absentee Owners (54), Recent Online Activity (56), FSBO (57), Vandevert (60), Crosswater (62), Caldera Springs (63), Sunstone Loop (64), Tetherow (98), Sunriver (99), Pronghorn (100), Black Butte Ranch (101), Northwest Crossing (102) |
| **FUB 1.0 ❌ (filters broken)** | **26** | All 13 Bend - X (104-116: River West, Summit West, Old Bend, Awbrey Butte, Mountain View, Old Farm District, Southwest Bend, Orchard District, Larkspur, Century West, Southeast Bend, Southern Crossing, Boyd Acres), all 12 WestsidePool (130, 131, 132, 133, 134, 135, 136, 137, 142, 143, 144, 145), plus duplicate Past Clients (8), Sphere (9), Leads (1), Hot Prospects (2), Nurture (3), etc. |

**Why this happened:** Bend - X + WestsidePool lists were created via Chrome MCP "Save as Smart List" in earlier sessions — that flow hits the v1 backend. Tetherow + 8 resort neighborhoods were created via FUB 2.0 "+ New" button in sidebar — that flow creates v2 lists.

## 🎉 SOLUTION FOUND (2026-05-28, mid-pilot): the v2 duplicates already exist!

Probing all smart list ids 1-200 revealed that the 7 Bend - X lists I care about ALREADY HAVE v2 duplicates (ids 152-158). The sidebar shows the v2 versions; the URL `/2/people/list/<v1-id>` lands on the v1 broken duplicate. The v2 duplicates are pre-populated with the inclusion filter (e.g. `neighborhood:bend-river-west` chip) showing the right count (2,363 people).

**The fix:** wire exclusion filters on the v2 ids (152-158), then DELETE the v1 duplicates (104-116). Approach below.

### v1 → v2 ID mapping for the 7 Bend - X lists (verified 2026-05-28)

| v1 id (DELETE) | v2 id (USE THIS) | List name | Tag count |
|---|---|---|---|
| 104 | **152** | Bend - River West | 2,363 |
| 107 | **153** | Bend - Awbrey Butte | 1,757 |
| 105 | **154** | Bend - Summit West | 1,469 |
| 113 | **155** | Bend - Century West | 862 |
| 115 | **156** | Bend - Southern Crossing | 541 |
| 106 | **157** | Bend - Old Bend | 530 |
| 116 | **158** | Bend - Boyd Acres | 359 |

### v1 lists with NO v2 duplicate (DELETE — unwanted extras)

108 Mountain View, 109 Old Farm District, 110 Southwest Bend, 111 Orchard District, 112 Larkspur, 114 Southeast Bend (6 lists Matt didn't ask for — created in earlier experiments)

### WestsidePool v1 lists (130-145) — need to recreate as v2

12 lists: 130 Homeowner DB, 131 Likely Sellers Hot, 132 Likely Sellers Warm, 145 Likely Sellers Cool, 133 OOS, 134 High Equity, 142 Rate Locked, 135 Industry Realtors, 136 Broker Recruit Pool, 137 Needs Enrichment, 143 Has Mobile Phone, 144 BatchData Enriched

For these, no v2 duplicate exists yet. Create via FUB 2.0 "+ New" then wire filters then delete v1.

## Wiring plan (revised 2026-05-28) — PROGRESS UPDATE

**Phase 1 — Wire 7 Bend-X v2 lists (152-158):** ✅ COMPLETE
- 152 Bend - River West ✅ wired + verified (1,993 people)
- 153 Bend - Awbrey Butte ✅ wired + verified (1,483 people)
- 154 Bend - Summit West ✅ wired + verified (1,251 people)
- 155 Bend - Century West ✅ wired + verified (718 people)
- 156 Bend - Southern Crossing ✅ wired + verified (450 people)
- 157 Bend - Old Bend ✅ wired + verified (434 people)
- 158 Bend - Boyd Acres ✅ wired + verified (317 people)

**Phase 1b — Delete v1 Bend-X duplicates** ✅ COMPLETE
13 v1 lists deleted via API DELETE /v1/smartLists/<id>: 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116 (includes 6 unwanted extras: Mountain View, Old Farm District, Southwest Bend, Orchard District, Larkspur, Southeast Bend)

**Phase 2 — Wire 18 existing v2 lists** ⚠️ 1/18 complete
- 98 Tetherow ✅ wired + verified (702 people)
- 99 Sunriver ⏳
- 100 Pronghorn ⏳
- 101 Black Butte Ranch ⏳
- 102 Northwest Crossing ⏳
- 60 Vandevert ⏳
- 62 Crosswater ⏳
- 63 Caldera Springs ⏳
- 64 Sunstone Loop ⏳
- 23 Realtors ⏳ (only compliance+stage — inverted)
- 37 All Expireds ⏳
- 41 Expired No Contact ⏳
- 42 Absentee Owners No Contact ⏳
- 46 All Clients ⏳ (minimal)
- 48 Migration Realtors ⏳ (inverted)
- 54 Absentee Owners ⏳
- 56 All Recent Online Activity ⏳
- 57 FSBO ⏳

**API investigation outcomes (2026-05-28):**
- `/api/v1/smartLists/<id>` on tenant subdomain returns full filter spec (vs public api.followupboss.com which returns metadata only) — confirmed via network capture
- Injected-JS `fetch()` and `XMLHttpRequest` to that endpoint hang permanently — FUB likely intercepts via service worker or CSP
- Update List click does NOT fire a visible save API call on Chrome MCP network capture — either Chrome MCP doesn't capture it or save is silent/queued
- Playwright session at `tmp/fub-session.json` is expired (2 days old). Re-capture needs login flow.
- `scripts/_fub-capture-save.mjs` written but blocked on session re-capture
- Path forward: continue Chrome MCP wiring (proven, ~5 min/list with retries)

**Phase 3 — Create 12 new v2 WestsidePool lists via FUB 2.0 "+ New":**
Then wire filters per universal exclusion spec.

**Phase 4 — Delete 12 v1 WestsidePool duplicates (130-145):**
After v2 versions are wired and verified.

Estimated remaining: ~3 hours.

## Wiring pattern (PROVEN — use this for remaining lists)

Per-list MCP sequence (each list takes 5-7 min with occasional retry):

1. **Navigate + wait** — `navigate('/2/people/list/<id>')` then `wait 10s` (FUB SPA takes time to hydrate after URL change)
2. **Focus filter input via JS, then type via computer:**
   ```js
   document.querySelector('input[placeholder="Add a filter"]').focus()
   ```
   then `computer.type "Tags"` then `wait 3s`
3. **find** the "Tags option under DETAILS in dropdown menu" → click via ref
4. **JS click radio:** `Array.from(document.querySelectorAll('.Radio-box'))[2].click()` (i=2 = exclude any, i=1 = exclude for Stage filter)
5. **find** the "blue plus button below exclude any radio in Tags filter row" → click via ref
6. **JS set value + JS click suggestion** for each of 6 exclusion tags (compliance:hard-stop, tcpa:litigator, Bounced, Unsubscribed, contact:do-not-email, audience:broker-recruit):
   ```js
   const setNative = (inp, v) => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(inp, v); inp.dispatchEvent(new Event('input', { bubbles: true })); }
   const filterInput = Array.from(document.querySelectorAll('input[placeholder="Search"]')).find(inp => { const r = inp.getBoundingClientRect(); return r.x > 1500 && r.y > 200 })
   filterInput.focus(); setNative(filterInput, '<TAG>')
   // wait 2s
   const t = Array.from(document.querySelectorAll('div')).find(el => el.textContent.trim() === '<TAG>' && el.children.length === 0)
   t?.click()
   ```
7. **press Escape** to close dropdown after last tag
8. **Repeat steps 2-7 for Stage filter:** type "Stage" → click Stage option → click boxes[1] (Stage exclude) → for each of 4 stages (Real Estate Agent, Vendor, Trash, Archive) → JS set + JS click suggestion → between each stage, **find** "plus button next to last chip" → click via ref
9. **Click "Update List"** at top right
10. **Navigate away + back** to verify persistence: `navigate('/2/people/list/<id>')` then check headers contain all 3 filter rows + count is correct

### Known issues + retries needed

1. **"NOT FOUND" on first chip attempt** — sometimes the JS click on a suggestion fails because the dropdown hasn't rendered yet. Retry by calling the JS set + click sequence again.
2. **"NO INPUT" on Archive (4th stage)** — happens intermittently. Re-find the [+] button by ref and retry.
3. **Dropdown doesn't open after type** — if the typed text doesn't appear in the input, use `input.focus()` via JS first, then `computer.type`. The native click via Chrome MCP sometimes doesn't trigger focus on this SPA.
4. **Browser hangs on `fetch()`** — avoid making internal-API fetches inside `javascript_tool` — the renderer locks for 45s+. Stick to DOM manipulation only.
5. **Add Person modal opens accidentally** — if the wrong [+] button gets clicked (e.g. the global FAB add-person), close via clicking Cancel (button at ~y=318) then continue.

## Tag counts to expect (post-exclusion, verified pattern: ~16% drop)

| List id | Tag include | Tag count | Expected after exclusions |
|---|---|---|---|
| 152 | bend-river-west | 2,363 | ~1,993 ✅ verified |
| 153 | bend-awbrey-butte | 1,757 | ~1,483 ✅ verified |
| 154 | bend-summit-west | 1,469 | ~1,251 ✅ verified |
| 155 | bend-century-west | 862 | ~720 |
| 156 | bend-southern-crossing | 541 | ~450 |
| 157 | bend-old-bend | 530 | ~440 |
| 158 | bend-boyd-acres | 359 | ~300 |

---

## Pickup prompt (paste this into a fresh session)

> Resume the FUB smart list wiring work from `docs/HANDOFF_FUB_SMART_LIST_WIRING_2026-05-27.md`. Current state: I've already deleted 21 lists (Nurture x2, exact-name dupes x5, unconfigured stubs x6, Matt-requested x4 — No Contact/Old Bend Farm/Monthly Newsletter/Do Not Text, 4 empty-tag lists — Empty Nest/Recently Divorced/Recently Moved/Retirement Age) and reorganized the rest into Pipeline (7 lists) and Neighborhoods (16 lists) collections. The Pipeline collection was moved above Neighborhoods in the sidebar.
>
> The work I still need to do: 28 smart lists currently have NO saved filters (sidebar counts are stale FUB cache). Each needs:
> 1. Inclusion filter (per the spec in `out/fub-smart-list-wiring-spec.md`, updated tag schema in this doc)
> 2. Universal exclusion filter (8 tag-excludes + 4 stage-excludes)
> 3. "Share with everyone" toggle ON
>
> Use Chrome MCP with the `mac mini chrome` browser (deviceId `deb95298-0353-4203-be38-27ac39834b22`). The "mac" browser is also OK as fallback. FUB URL pattern is `https://ryan-realty.followupboss.com/2/people/list/<id>`. Login is already captured in the active session.
>
> Start by validating end-to-end on Bend - River West (id 104) — add inclusion tag `neighborhood:bend-river-west`, add exclusion tag/stage filters, share with everyone. Verify contacts appear (~2,363 expected per tag count). Then batch the remaining 27.
>
> Critical files to read first:
> - `out/fub-smart-list-wiring-spec.md` — the full spec
> - `scripts/_fub-ui-wire-smart-list-filters.mjs` — existing Playwright script (FUB 1.0 era, may need updates for 2.0)
> - This doc for status + tag schema reality
>
> Don't use the existing Playwright script blindly — its tag schema is wrong (`seller-score:hot` is correct, NOT `lifecycle:likely-seller-hot`). The verified tag-count map is in this doc.

---

## What's been done so far

### Deletions (21 total via FUB v1 API DELETE)

| Round | IDs | Names |
|---|---|---|
| Nurture cleanup | 58, 61 | Nurture Seller, Nurture Buyer |
| Exact-name duplicates | 146-150 | Likely Sellers Hot/Warm + OOS + High Equity + Rate Locked (older copies of 131, 132, 133, 134, 142) |
| Unconfigured stubs | 117-122 | Eagle Crest, Three Rivers, Brasada Ranch, Widgi Creek, Broken Top, Awbrey Glen — all had 0 filters and 0 contacts |
| Matt explicit | 45, 24, 36, 59 | No Contact, Old Bend - Farm, Monthly Newsletter, Do Not Text |
| Empty-tag lists | 138, 139, 140, 141 | Empty Nest, Recently Divorced, Recently Moved, Retirement Age — no underlying tag data exists |

### Reorganization (Chrome MCP Move-to-Collection)

| Action | Lists moved |
|---|---|
| Into Neighborhoods folder | Bend - River West, Bend - Awbrey Butte, Bend - Summit West, Bend - Century West, Bend - Southern Crossing, Bend - Old Bend, Bend - Boyd Acres (7 total) |
| Into Pipeline folder | New Leads: No Call Attempt, Cold/Bi-Monthly, Old Leads: No Call Attempt (3 total) |
| Collection reorder | Pipeline now sits ABOVE Neighborhoods in sidebar |

### Current Pipeline collection (7 lists)

Active & Pending Clients · Hot/Weekly · Warm/Bi-Weekly · Past Clients/Sphere: Quarterly · New Leads: No Call Attempt · Cold/Bi-Monthly · Old Leads: No Call Attempt

### Current Neighborhoods collection (16 lists)

Tetherow · Sunriver · Pronghorn · Black Butte Ranch · Northwest Crossing · Vandevert · Crosswater · Caldera Springs · Sunstone Loop — Showing Brokers · Bend - River West · Bend - Awbrey Butte · Bend - Summit West · Bend - Century West · Bend - Southern Crossing · Bend - Old Bend · Bend - Boyd Acres

---

## The verified tag schema (queried 2026-05-27)

**Tags WITH contacts — safe to use as inclusion filters:**

| Tag | Count | Used for which list |
|---|---|---|
| `neighborhood:bend-river-west` | 2,363 | Bend - River West |
| `neighborhood:bend-awbrey-butte` | (verify) | Bend - Awbrey Butte |
| `neighborhood:bend-summit-west` | (verify) | Bend - Summit West |
| `neighborhood:bend-century-west` | (verify) | Bend - Century West |
| `neighborhood:bend-southern-crossing` | (verify) | Bend - Southern Crossing |
| `neighborhood:bend-old-bend` | (verify) | Bend - Old Bend |
| `neighborhood:bend-boyd-acres` | (verify) | Bend - Boyd Acres |
| `neighborhood:tetherow` | 842 | Tetherow |
| `neighborhood:sunriver` | (verify) | Sunriver |
| `neighborhood:pronghorn` | 6 | Pronghorn |
| `neighborhood:black-butte-ranch` | (verify) | Black Butte Ranch |
| `neighborhood:northwest-crossing` | (verify) | Northwest Crossing |
| `neighborhood:vandevert` | (verify) | Vandevert |
| `neighborhood:crosswater` | (verify) | Crosswater |
| `neighborhood:caldera-springs` | (verify) | Caldera Springs |
| `neighborhood:sunstone-loop` | (verify) | Sunstone Loop — Showing Brokers |
| `seller-score:hot` | **353** | Likely Sellers — Hot (NOT `lifecycle:likely-seller-hot` — that's 0) |
| `seller-score:warm` | **3,000** | Likely Sellers — Warm |
| `seller-score:cool` | **2,564** | Likely Sellers — Cool |
| `geo:out-of-state` | 1,158 | Out-of-State Owners |
| `equity:high` | 5,749 | High Equity Owners |
| `lifecycle:rate-locked` | 1,004 | Rate Locked Owners |
| `intent:expired-listing` | 306 | All Expireds, Expired No Contact |
| `audience:broker-recruit` | 233 | Broker Recruit Pool |
| `industry:realtor` | 2,405 | Industry Realtors — West Side |
| `contact:mobile-phone` | 2,613 | Has Mobile Phone |
| `enrich:batchdata-matched` | 5,805 | BatchData Enriched |
| `owner:absentee-outofstate` | 838 | Absentee Owners (combine with `owner:absentee-instate`) |
| `area:bend-westside` | 7,675 | Homeowner DB — West Side All |
| `import:westside-2026-05` | 7,675 | (provenance — combine in inclusion) |
| `contact:needs-enrichment` | (verify) | Needs Enrichment — West Side |
| `Sphere` | 2,215 | Matts Sphere (raw legacy tag) |
| `Past Client` | 15 | Past Clients (raw FUB tag) |
| `FSBO` | 6 | FSBO (raw FUB tag) |

**Tags VERIFIED with 0 contacts (those lists already deleted):**

`lifecycle:likely-seller-hot`, `lifecycle:likely-seller-warm`, `lifecycle:likely-seller-cool`, `demo:empty-nest`, `demo:age-55-plus`, `life:recently-divorced`, `life:recently-moved`, `life:empty-nest`, `intent:fsbo`, `relationship:sphere`

---

## The universal exclusion (apply to every lead-facing list)

**Tags do NOT include any of:**
- `compliance:hard-stop` (3,227 — master TCPA/DNC/deceased safety)
- `tcpa:litigator` (141 — belt-and-suspenders)
- `Bounced` (1,176 — bad email)
- `Unsubscribed` (230 — opt-out)
- `contact:do-not-email` (877)
- `audience:broker-recruit` (233 — keep recruits out of seller/buyer lists; INVERTED for the Broker Recruit Pool list itself)

**Stage IS NOT any of:**
- Real Estate Agent (id 45)
- Vendor (id 46)
- Trash (id 11)
- Archive (id 44)

**Inverted exclusion (realtor-target lists):** For Realtors, Migration Realtors, Industry Realtors — West Side, Broker Recruit Pool, TCPA Litigators — Hard Stop — these lists are MEANT to contain realtors/recruits, so don't exclude those tags. Just keep the compliance and stage exclusions.

---

## Lists left to wire (28 total)

Order of execution (highest-value first):

### Tier 1 — Lead-driving (do first, 12 lists)
1. Likely Sellers — Hot (id 131) — `tag includes seller-score:hot`
2. Likely Sellers — Warm (id 132) — `tag includes seller-score:warm`
3. Likely Sellers — Cool (id 145) — `tag includes seller-score:cool`
4. Out-of-State Owners (id 133) — `tag includes geo:out-of-state`
5. High Equity Owners (id 134) — `tag includes equity:high`
6. Rate Locked Owners (id 142) — `tag includes lifecycle:rate-locked`
7. Bend - River West (id 104) — `tag includes neighborhood:bend-river-west` ← **pilot list**
8. Bend - Awbrey Butte (id 107) — `tag includes neighborhood:bend-awbrey-butte`
9. Bend - Summit West (id 105)
10. Bend - Century West (id 113)
11. Bend - Southern Crossing (id 115)
12. Bend - Old Bend (id 106)

### Tier 2 — Neighborhoods + expired (do second, 8 lists)
13. Bend - Boyd Acres (id 116)
14. Tetherow (id 98)
15. Sunriver (id 99)
16. Pronghorn (id 100)
17. Black Butte Ranch (id 101)
18. Northwest Crossing (id 102)
19. All Expireds (id 37)
20. Expired No Contact (id 41)

### Tier 3 — Operational (do third, 5 lists)
21. Vandevert (id 60)
22. Crosswater (id 62)
23. Caldera Springs (id 63)
24. Sunstone Loop (id 64)
25. Absentee Owners (id 54) — `tag includes owner:absentee-outofstate OR owner:absentee-instate`

### Tier 4 — Special (handle separately due to inverted exclusion, 3 lists)
26. Realtors (id 23) — `stage = Real Estate Agent`, NO realtor exclusion
27. Industry Realtors — West Side (id 135) — `tag includes industry:realtor AND area:bend-westside`, NO realtor exclusion
28. Broker Recruit Pool (id 136) — `tag includes audience:broker-recruit`, NO broker-recruit exclusion

### Skip or defer
- Matts Sphere (id 39) — uses raw "Sphere" tag (2,215 contacts) — Matt to confirm if he wants this wired
- Past Clients (id 8) — FUB default with 15 contacts on "Past Client" tag — may already work
- TCPA Litigators — Hard Stop — this IS the exclusion target, special case

---

## Chrome MCP execution pattern (per list)

```
1. navigate /people/list/<id>
2. wait 5s for page load
3. find "Add a filter input" → click ref → type "Tags" → wait 2s
4. find "Tags option in dropdown" → click ref
5. (filter UI loads with "is not empty / include / exclude / is empty" radio)
6. find "include" radio → click ref
7. find "tag search input in filter row" → click ref → type tag value
8. find tag suggestion → click ref
9. (repeat for each include tag if multiple)
10. find "Add a filter input" → click → type "Tags" again
11. find "Tags option" → click
12. find "exclude" radio → click
13. type each exclusion tag and click suggestion: compliance:hard-stop, tcpa:litigator, Bounced, Unsubscribed, contact:do-not-email, audience:broker-recruit
14. find "Add a filter input" → type "Stage"
15. find "Stage option" → click
16. find "is not" / "exclude" radio → click
17. select stages: Real Estate Agent, Vendor, Trash, Archive
18. find "Update List" button at top right → click
19. find "Edit" link next to list title → click
20. find "Share with everyone" checkbox → click (to check it)
21. find "Save List" button → click
22. (optional) find "Only Me" toggle in sidebar list view → click to enable for Matt's view
```

**Use `find` for refs instead of coordinates** — much more reliable than coordinate clicks (which drift between sessions and after page reflows).

---

## Known issues + workarounds

1. **JS execution hangs:** FUB UI service worker can wedge the renderer. Workaround: close + reopen the tab.
2. **Position drift:** Lists shift up after moves/deletes. Use `find` tool for refs.
3. **Dropdown timing:** Wait 2s after opening dropdowns before clicking options.
4. **Update List vs Edit:** "Update List" saves FILTER changes (filter panel). "Edit" opens metadata dialog (name + share + agents).
5. **"Share with everyone" is OFF by default:** Every list I created via UI defaulted to PRIVATE. Must explicitly check the box.
6. **Browser selection prompt:** When multiple browsers connected (mac + macbook + mac mini chrome), AskUserQuestion is required. Default is mac mini chrome (deviceId `deb95298-0353-4203-be38-27ac39834b22`).

---

## Alternative path — fix and use the existing Playwright script

`scripts/_fub-ui-wire-smart-list-filters.mjs` already exists with the right structure (LISTS array, addTagFilter helper, etc.) but needs:

1. Update FUB base URL: `app.followupboss.com` → `ryan-realty.followupboss.com/2`
2. Update tag schema (LISTS array): `seller-score:hot/warm/cool` instead of `lifecycle:likely-seller-*`
3. Remove the lists we deleted (Empty Nest, Recently Divorced, etc.)
4. Add the Neighborhoods folder lists (Bend - X, resort communities)
5. Verify the addTagFilter helper still works against FUB 2.0 UI
6. Run with `--explore --id 104` first to capture screenshots and confirm UI flow
7. Then `--dry-run` then `--apply --only 104` for pilot
8. Then `--apply` for full batch

Time estimate for Playwright path: ~2 hr dev + 30 min run = 2.5 hr total. More reliable than Chrome MCP coordinate clicks.

---

## Spec doc

`out/fub-smart-list-wiring-spec.md` — has the per-list inclusion/exclusion spec. **Update it with the corrected tag schema before executing** (seller-score:hot not lifecycle:likely-seller-hot).

---

## What success looks like

- All 28 lists have inclusion + exclusion filters saved
- All 28 lists show "Shared with everyone" in the sidebar
- Each list opened shows actual contact counts (not 0, not stale cache)
- Sidebar counts match the tag counts in the schema table above (~7K for Homeowner DB, ~2K for River West, etc.)
- Realtor stage contacts don't appear in any non-realtor list (verify by spot-check)
- TCPA Litigators / Bounced / Hard Stop contacts don't appear in any lead-facing list
- Matt confirms a few of his most-used lists "look right"
